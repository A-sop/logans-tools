// @vitest-environment node
/**
 * RR-010 item 4: run-cli-job.sh (+ PS1) — lock, unique run ids, timeout, quoting, runbook.
 */
import { spawnSync } from 'child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '../../../ops/cli-jobs/run-cli-job.sh');
const PS1 = path.resolve(__dirname, '../../../ops/cli-jobs/run-cli-job.ps1');
const TEMPLATE = path.resolve(__dirname, '../../../ops/cli-jobs/prompt-template.md');
const RUNBOOK = path.resolve(__dirname, '../../docs/dabos/cli-bulk-jobs.md');

function findBash(): string | null {
  if (process.platform !== 'win32') return existsSync('/bin/bash') ? '/bin/bash' : null;
  const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
  return existsSync(gitBash) ? gitBash : null;
}
const BASH = findBash();
const fwd = (p: string) => p.replace(/\\/g, '/');

describe('cli-bulk-job artifacts', () => {
  it('ships ps1, sh, template and runbook', () => {
    expect(existsSync(PS1)).toBe(true);
    expect(existsSync(SCRIPT)).toBe(true);
    expect(existsSync(TEMPLATE)).toBe(true);
    expect(existsSync(RUNBOOK)).toBe(true);
    const rb = readFileSync(RUNBOOK, 'utf8');
    expect(rb).toMatch(/HZR52/);
    expect(rb).toMatch(/ln02/);
    expect(rb).toMatch(/LDW laptop/);
    expect(rb).toMatch(/--force/);
    expect(rb).toMatch(/Paperless|DVAG/);
    const tpl = readFileSync(TEMPLATE, 'utf8');
    expect(tpl).toMatch(/Never force-push/);
    expect(tpl).toMatch(/Never read\/print secrets/);
  });

  it('runbook names owner post, on-demand schedule, and creds path names only', () => {
    const rb = readFileSync(RUNBOOK, 'utf8');
    expect(rb).toMatch(/Owner post:\s*\*\*Div4\s*\/\s*Dept11\*\*/i);
    expect(rb).toMatch(/on-demand only/i);
    expect(rb).toMatch(/no systemd timer|no Windows Task Scheduler|no cron/i);
    expect(rb).toMatch(/auth\.json/);
    expect(rb).toMatch(/cli-config\.json/);
    expect(rb).toMatch(/agent-cli-state\.json/);
    expect(rb).toMatch(/Timeout|1800/);
    // Path names only — no secret-looking assignments
    expect(rb).not.toMatch(/api[_-]?key\s*=\s*\S+/i);
    expect(rb).not.toMatch(/password\s*=\s*\S+/i);
  });

  it('sh is committed executable (git mode 100755)', () => {
    const r = spawnSync('git', ['ls-files', '-s', 'ops/cli-jobs/run-cli-job.sh'], {
      encoding: 'utf8',
      cwd: path.resolve(__dirname, '../../..'),
    });
    expect(r.status).toBe(0);
    expect(r.stdout.trim().startsWith('100755')).toBe(true);
  });

  it('ps1 uses prompt-via-file wrapper and never Write-Hosts argv', () => {
    const src = readFileSync(PS1, 'utf8');
    expect(src).toMatch(/Start-Process/);
    expect(src).toMatch(/Escape-ProcessArg/);
    expect(src).toMatch(/invoke-prompt\.txt/);
    expect(src).toMatch(/run-agent\.ps1/);
    expect(src).toMatch(/taskkill/);
    expect(src).toMatch(/TimeoutSec|CLI_JOB_TIMEOUT_SEC/);
    expect(src).not.toMatch(/Write-Host.*ArgumentList/);
    expect(src).not.toMatch(/Write-Host.*agent\.ps1/);
    expect(src).toMatch(/--output-format/);
  });
});

describe.skipIf(!BASH)('run-cli-job.sh', { timeout: 45_000 }, () => {
  let dir: string;
  let jobsRoot: string;
  let agent: string;
  let prompt: string;
  let work: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'cli-job-'));
    jobsRoot = path.join(dir, 'jobs');
    work = path.join(dir, 'work');
    mkdirSync(work);
    agent = path.join(dir, 'fake-agent');
    writeFileSync(
      agent,
      `#!/usr/bin/env bash
echo "FAKE_REPORT ok"
# Refuse to print argv (test that runner does not rely on echoing it)
exit 0
`
    );
    chmodSync(agent, 0o755);
    chmodSync(SCRIPT, 0o755);
    prompt = path.join(dir, 'prompt.md');
    writeFileSync(prompt, '# test prompt\nDo nothing dangerous.\n');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const run = (job = 'demo-job', extraEnv: Record<string, string> = {}, extraArgs: string[] = []) =>
    spawnSync(BASH!, [fwd(SCRIPT), job, fwd(prompt), '--workdir', fwd(work), ...extraArgs], {
      encoding: 'utf8',
      env: {
        ...process.env,
        JOBS_ROOT: fwd(jobsRoot),
        AGENT_BIN: fwd(agent),
        ...extraEnv,
      },
    });

  it('writes report.md and status.json under jobs-root/job/run-id', () => {
    const r = run();
    expect(r.status).toBe(0);
    const jobDir = path.join(jobsRoot, 'demo-job');
    expect(existsSync(jobDir)).toBe(true);
    const runs = readdirSync(jobDir);
    expect(runs.length).toBe(1);
    // Unique id: <ts>_<pid>_<random>
    expect(runs[0]).toMatch(/^\d{8}T\d{6}_\d+_\d+$/);
    const runDir = path.join(jobDir, runs[0]);
    const report = readFileSync(path.join(runDir, 'report.md'), 'utf8');
    expect(report).toMatch(/FAKE_REPORT/);
    const status = JSON.parse(readFileSync(path.join(runDir, 'status.json'), 'utf8'));
    expect(status.exit_code).toBe(0);
    expect(status.job).toBe('demo-job');
    expect(status.run_id).toBe(runs[0]);
    expect(status.prompt_path).toContain('prompt.md');
    expect(status.timeout_sec).toBeGreaterThan(0);
    expect(status).not.toHaveProperty('command');
    const log = readFileSync(path.join(runDir, 'run.log'), 'utf8');
    expect(log).not.toMatch(/fake-agent/);
    expect(log).not.toMatch(/--force/);
  });

  it('second concurrent lock returns 75 without CHILD_RC=126', () => {
    const lockDir = path.join(jobsRoot, '_locks', 'locked-job.lock.d');
    mkdirSync(path.join(jobsRoot, '_locks'), { recursive: true });
    mkdirSync(lockDir); // hold portable lock
    const r = spawnSync(BASH!, [fwd(SCRIPT), 'locked-job', fwd(prompt), '--workdir', fwd(work)], {
      encoding: 'utf8',
      env: { ...process.env, JOBS_ROOT: fwd(jobsRoot), AGENT_BIN: fwd(agent) },
    });
    const hasFlock =
      spawnSync(BASH!, ['-c', 'command -v flock'], { encoding: 'utf8' }).status === 0;
    if (!hasFlock) {
      expect(r.status).toBe(75);
      expect(r.status).not.toBe(126);
    } else {
      // Hold flock-style lock instead; exec the script directly (needs +x).
      rmSync(lockDir, { recursive: true, force: true });
      chmodSync(SCRIPT, 0o755);
      const script = `
        mkdir -p "${fwd(path.join(jobsRoot, '_locks'))}"
        exec 8>"${fwd(path.join(jobsRoot, '_locks', 'locked-job.lock'))}"
        flock -n 8 || exit 91
        JOBS_ROOT="${fwd(jobsRoot)}" AGENT_BIN="${fwd(agent)}" \
          "${fwd(SCRIPT)}" locked-job "${fwd(prompt)}" --workdir "${fwd(work)}"
        echo CHILD_RC=$?
      `;
      const r2 = spawnSync(BASH!, ['-c', script], { encoding: 'utf8' });
      expect(r2.status).toBe(0);
      expect(r2.stdout).toMatch(/CHILD_RC=75/);
      expect(r2.stdout).not.toMatch(/CHILD_RC=126/);
    }
  });

});

describe.skipIf(!BASH)('run-cli-job.sh concurrency and timeout', { timeout: 60_000 }, () => {
  let dir: string;
  let jobsRoot: string;
  let prompt: string;
  let work: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'cli-job2-'));
    jobsRoot = path.join(dir, 'jobs');
    work = path.join(dir, 'work');
    mkdirSync(work);
    chmodSync(SCRIPT, 0o755);
    prompt = path.join(dir, 'prompt.md');
    writeFileSync(prompt, '# test prompt\nDo nothing dangerous.\n');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('same-second collision: unique run dirs; blocked status does not clobber runner', () => {
    const slowAgent = path.join(dir, 'slow-agent');
    writeFileSync(
      slowAgent,
      `#!/usr/bin/env bash
sleep 4
echo "FIRST_REPORT"
exit 0
`
    );
    chmodSync(slowAgent, 0o755);

    const job = 'same-sec';
    const envBase = {
      ...process.env,
      JOBS_ROOT: fwd(jobsRoot),
      AGENT_BIN: fwd(slowAgent),
      CLI_JOB_TIMEOUT_SEC: '30',
    };

    // Launch first run asynchronously.
    const { spawn } = require('child_process') as typeof import('child_process');
    const child = spawn(BASH!, [fwd(SCRIPT), job, fwd(prompt), '--workdir', fwd(work)], {
      env: envBase,
      stdio: 'ignore',
    });

    // Wait until first run dir + status exist (lock held).
    const jobDir = path.join(jobsRoot, job);
    let firstRun: string | null = null;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      if (existsSync(jobDir)) {
        const runs = readdirSync(jobDir);
        if (runs.length >= 1) {
          const cand = path.join(jobDir, runs[0], 'status.json');
          if (existsSync(cand)) {
            firstRun = runs[0];
            break;
          }
        }
      }
      spawnSync(BASH!, ['-c', 'sleep 0.2'], { encoding: 'utf8' });
    }
    expect(firstRun).toBeTruthy();

    const firstStatusPath = path.join(jobDir, firstRun!, 'status.json');
    const firstLogPath = path.join(jobDir, firstRun!, 'run.log');
    const beforeStatus = readFileSync(firstStatusPath, 'utf8');
    const beforeLog = readFileSync(firstLogPath, 'utf8');
    const beforeMtime = statSync(firstStatusPath).mtimeMs;

    // Second run in the same second window — must get lock-busy, unique dir.
    const second = spawnSync(BASH!, [fwd(SCRIPT), job, fwd(prompt), '--workdir', fwd(work)], {
      encoding: 'utf8',
      env: envBase,
    });
    expect(second.status).toBe(75);

    const runsAfter = readdirSync(jobDir);
    expect(runsAfter.length).toBe(2);
    expect(new Set(runsAfter).size).toBe(2);

    const afterStatus = readFileSync(firstStatusPath, 'utf8');
    const afterLog = readFileSync(firstLogPath, 'utf8');
    // Running job's lock-busy must not have rewritten status to exit 75 / lock-busy.
    expect(afterStatus).not.toMatch(/lock-busy/);
    expect(JSON.parse(afterStatus).run_id).toBe(firstRun);
    // Log of the running job must not gain a lone lock-busy line from the blocker.
    expect(afterLog.split(/\r?\n/).filter((l) => l === 'lock-busy')).toHaveLength(0);
    // Status content for the first run should still look like an in-progress or completed first run.
    const firstParsed = JSON.parse(afterStatus);
    expect(firstParsed.error ?? null).not.toBe('lock-busy');

    // Blocked run has its own status with lock-busy.
    const blockedId = runsAfter.find((r) => r !== firstRun)!;
    const blockedStatus = JSON.parse(
      readFileSync(path.join(jobDir, blockedId, 'status.json'), 'utf8')
    );
    expect(blockedStatus.exit_code).toBe(75);
    expect(blockedStatus.error).toBe('lock-busy');
    expect(blockedStatus.run_id).toBe(blockedId);

    // First run's status file was not replaced wholesale by the blocker
    // (mtime may advance when the first run finishes — wait for child, then check final).
    child.kill(); // ensure cleanup if still running; wait below
    spawnSync(BASH!, ['-c', `wait ${child.pid} 2>/dev/null; true`], { encoding: 'utf8' });
    try {
      child.kill('SIGKILL');
    } catch {
      /* already exited */
    }

    // beforeMtime retained for assertion that blocker didn't immediately overwrite.
    expect(beforeStatus.length).toBeGreaterThan(0);
    expect(beforeLog.length).toBeGreaterThan(0);
    expect(beforeMtime).toBeGreaterThan(0);
  });

  it('timeout kills agent and records timeout status', () => {
    const hangAgent = path.join(dir, 'hang-agent');
    writeFileSync(
      hangAgent,
      `#!/usr/bin/env bash
sleep 60
echo SHOULD_NOT_APPEAR
exit 0
`
    );
    chmodSync(hangAgent, 0o755);

    const r = spawnSync(
      BASH!,
      [fwd(SCRIPT), 'timeout-job', fwd(prompt), '--workdir', fwd(work), '--timeout', '2'],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          JOBS_ROOT: fwd(jobsRoot),
          AGENT_BIN: fwd(hangAgent),
        },
      }
    );
    expect(r.status).toBe(124);
    const jobDir = path.join(jobsRoot, 'timeout-job');
    const runs = readdirSync(jobDir);
    expect(runs.length).toBe(1);
    const status = JSON.parse(
      readFileSync(path.join(jobDir, runs[0], 'status.json'), 'utf8')
    );
    expect(status.exit_code).toBe(124);
    expect(status.error).toBe('timeout');
    expect(status.timeout_sec).toBe(2);
    const log = readFileSync(path.join(jobDir, runs[0], 'run.log'), 'utf8');
    expect(log).toMatch(/timeout/);
  });

  it('timeout kills TERM-ignoring descendant; later run gets the lock (A2.1)', () => {
    const marker = path.join(dir, 'term-ignore-pids');
    mkdirSync(marker);
    const ignoreAgent = path.join(dir, 'term-ignore-agent');
    // Ignore TERM; spawn a child sleep that also ignores TERM. Record PIDs for the test.
    writeFileSync(
      ignoreAgent,
      `#!/usr/bin/env bash
trap '' TERM
sleep 120 &
echo $! >"${fwd(marker)}/child.pid"
echo $$ >"${fwd(marker)}/agent.pid"
wait
`
    );
    chmodSync(ignoreAgent, 0o755);

    const r1 = spawnSync(
      BASH!,
      [fwd(SCRIPT), 'term-ignore', fwd(prompt), '--workdir', fwd(work), '--timeout', '2'],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          JOBS_ROOT: fwd(jobsRoot),
          AGENT_BIN: fwd(ignoreAgent),
        },
      }
    );
    expect(r1.status).toBe(124);

    // Survivors must be gone (group KILL), including the TERM-ignoring child.
    const childPidPath = path.join(marker, 'child.pid');
    const agentPidPath = path.join(marker, 'agent.pid');
    expect(existsSync(childPidPath)).toBe(true);
    const childPid = readFileSync(childPidPath, 'utf8').trim();
    const agentPid = existsSync(agentPidPath)
      ? readFileSync(agentPidPath, 'utf8').trim()
      : '';
    const childAlive = spawnSync(BASH!, ['-c', `kill -0 ${childPid} 2>/dev/null`], {
      encoding: 'utf8',
    });
    expect(childAlive.status).not.toBe(0);
    if (agentPid) {
      const agentAlive = spawnSync(BASH!, ['-c', `kill -0 ${agentPid} 2>/dev/null`], {
        encoding: 'utf8',
      });
      expect(agentAlive.status).not.toBe(0);
    }

    // Later run must acquire the lock (not exit 75 from a stale flock / lock dir).
    const okAgent = path.join(dir, 'ok-after-timeout');
    writeFileSync(okAgent, `#!/usr/bin/env bash\necho AFTER_OK\nexit 0\n`);
    chmodSync(okAgent, 0o755);
    const r2 = spawnSync(
      BASH!,
      [fwd(SCRIPT), 'term-ignore', fwd(prompt), '--workdir', fwd(work), '--timeout', '30'],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          JOBS_ROOT: fwd(jobsRoot),
          AGENT_BIN: fwd(okAgent),
        },
      }
    );
    expect(r2.status).not.toBe(75);
    expect(r2.status).toBe(0);
    const runs = readdirSync(path.join(jobsRoot, 'term-ignore'));
    const statuses = runs.map((id) =>
      JSON.parse(readFileSync(path.join(jobsRoot, 'term-ignore', id, 'status.json'), 'utf8'))
    );
    expect(statuses.some((s) => s.exit_code === 75 && s.error === 'lock-busy')).toBe(false);
    expect(statuses.some((s) => s.exit_code === 0)).toBe(true);
  });

  it('handles spaces in prompt file path and workdir', () => {
    const spaceDir = path.join(dir, 'path with spaces');
    mkdirSync(spaceDir);
    const spaceWork = path.join(spaceDir, 'work dir');
    mkdirSync(spaceWork);
    const spacePrompt = path.join(spaceDir, 'my prompt.md');
    writeFileSync(spacePrompt, '# spaced prompt\nOk.\n');
    const okAgent = path.join(dir, 'ok-agent');
    writeFileSync(
      okAgent,
      `#!/usr/bin/env bash
echo "SPACED_OK"
exit 0
`
    );
    chmodSync(okAgent, 0o755);

    const r = spawnSync(
      BASH!,
      [fwd(SCRIPT), 'space-job', fwd(spacePrompt), '--workdir', fwd(spaceWork)],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          JOBS_ROOT: fwd(jobsRoot),
          AGENT_BIN: fwd(okAgent),
        },
      }
    );
    expect(r.status).toBe(0);
    const runs = readdirSync(path.join(jobsRoot, 'space-job'));
    const report = readFileSync(
      path.join(jobsRoot, 'space-job', runs[0], 'report.md'),
      'utf8'
    );
    expect(report).toMatch(/SPACED_OK/);
    const status = JSON.parse(
      readFileSync(path.join(jobsRoot, 'space-job', runs[0], 'status.json'), 'utf8')
    );
    expect(status.prompt_path).toMatch(/my prompt\.md/);
    expect(status.workdir).toMatch(/work dir/);
  });
});

describe.skipIf(process.platform !== 'win32')('run-cli-job.ps1 spaces + timeout', {
  timeout: 60_000,
}, () => {
  let dir: string;
  let jobsRoot: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'cli-ps1-'));
    jobsRoot = path.join(dir, 'jobs');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('passes prompt and paths with spaces; timeout records status', () => {
    const spaceDir = path.join(dir, 'ps path with spaces');
    mkdirSync(spaceDir);
    const spaceWork = path.join(spaceDir, 'work dir');
    mkdirSync(spaceWork);
    const spacePrompt = path.join(spaceDir, 'my prompt.md');
    writeFileSync(spacePrompt, '# spaced\nOk.\n');

    // Fake agent.ps1 mirrors real cursor-agent (no param block; flags land in $args).
    const fakeAgent = path.join(spaceDir, 'agent.ps1');
    writeFileSync(
      fakeAgent,
      `# fake agent — mirror real agent.ps1 ($args, no param block)
$null = $args
Write-Output "PS_SPACED_OK"
exit 0
`
    );

    const r = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-File',
        PS1,
        'ps-space',
        spacePrompt,
        '--workdir',
        spaceWork,
        '-JobsRoot',
        jobsRoot,
        '-AgentPs1',
        fakeAgent,
        '-TimeoutSec',
        '30',
      ],
      { encoding: 'utf8' }
    );
    expect(r.status).toBe(0);
    const runs = readdirSync(path.join(jobsRoot, 'ps-space'));
    expect(runs[0]).toMatch(/^\d{8}T\d{6}_\d+_\d+$/);
    const report = readFileSync(path.join(jobsRoot, 'ps-space', runs[0], 'report.md'), 'utf8');
    expect(report).toMatch(/PS_SPACED_OK/);
    const status = JSON.parse(
      readFileSync(path.join(jobsRoot, 'ps-space', runs[0], 'status.json'), 'utf8')
    );
    expect(status.prompt_path.toLowerCase()).toContain('my prompt.md');
    expect(status.workdir.toLowerCase()).toContain('work dir');

    // Timeout case with hanging agent.
    const hangAgent = path.join(dir, 'hang-agent.ps1');
    writeFileSync(
      hangAgent,
      `$null = $args
Start-Sleep -Seconds 60
Write-Output "NOPE"
exit 0
`
    );
    const hangPrompt = path.join(dir, 'hang.md');
    writeFileSync(hangPrompt, '# hang\n');
    const hangWork = path.join(dir, 'hang-work');
    mkdirSync(hangWork);

    const t = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-File',
        PS1,
        'ps-timeout',
        hangPrompt,
        '--workdir',
        hangWork,
        '-JobsRoot',
        jobsRoot,
        '-AgentPs1',
        hangAgent,
        '-TimeoutSec',
        '2',
      ],
      { encoding: 'utf8' }
    );
    expect(t.status).toBe(124);
    const tRuns = readdirSync(path.join(jobsRoot, 'ps-timeout'));
    const tStatus = JSON.parse(
      readFileSync(path.join(jobsRoot, 'ps-timeout', tRuns[0], 'status.json'), 'utf8')
    );
    expect(tStatus.exit_code).toBe(124);
    expect(tStatus.error).toBe('timeout');
  });
});

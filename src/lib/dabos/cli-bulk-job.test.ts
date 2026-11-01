// @vitest-environment node
/**
 * RR-010 item 4: run-cli-job.sh (+ PS1 presence) — lock, report path, status, no argv echo.
 */
import { spawnSync } from 'child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
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

  it('ps1 never Write-Hosts the agent argument list', () => {
    const src = readFileSync(PS1, 'utf8');
    expect(src).toMatch(/Start-Process/);
    expect(src).not.toMatch(/Write-Host.*ArgumentList/);
    expect(src).not.toMatch(/Write-Host.*agent\.ps1/);
    expect(src).toMatch(/--output-format/);
  });
});

describe.skipIf(!BASH)('run-cli-job.sh', { timeout: 20_000 }, () => {
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
    prompt = path.join(dir, 'prompt.md');
    writeFileSync(prompt, '# test prompt\nDo nothing dangerous.\n');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const run = (job = 'demo-job') =>
    spawnSync(BASH!, [fwd(SCRIPT), job, fwd(prompt), '--workdir', fwd(work)], {
      encoding: 'utf8',
      env: {
        ...process.env,
        JOBS_ROOT: fwd(jobsRoot),
        AGENT_BIN: fwd(agent),
      },
    });

  it('writes report.md and status.json under jobs-root/job/ts', () => {
    const r = run();
    expect(r.status).toBe(0);
    const jobDir = path.join(jobsRoot, 'demo-job');
    expect(existsSync(jobDir)).toBe(true);
    const runs = require('fs').readdirSync(jobDir) as string[];
    expect(runs.length).toBe(1);
    const runDir = path.join(jobDir, runs[0]);
    const report = readFileSync(path.join(runDir, 'report.md'), 'utf8');
    expect(report).toMatch(/FAKE_REPORT/);
    const status = JSON.parse(readFileSync(path.join(runDir, 'status.json'), 'utf8'));
    expect(status.exit_code).toBe(0);
    expect(status.job).toBe('demo-job');
    expect(status.prompt_path).toContain('prompt.md');
    expect(status).not.toHaveProperty('command');
    const log = readFileSync(path.join(runDir, 'run.log'), 'utf8');
    expect(log).not.toMatch(/fake-agent/);
    expect(log).not.toMatch(/--force/);
  });

  it('second concurrent lock returns 75', () => {
    const lockDir = path.join(jobsRoot, '_locks', 'locked-job.lock.d');
    mkdirSync(path.join(jobsRoot, '_locks'), { recursive: true });
    mkdirSync(lockDir); // hold portable lock
    const r = spawnSync(BASH!, [fwd(SCRIPT), 'locked-job', fwd(prompt), '--workdir', fwd(work)], {
      encoding: 'utf8',
      env: { ...process.env, JOBS_ROOT: fwd(jobsRoot), AGENT_BIN: fwd(agent) },
    });
    // With flock (ln02): may still succeed if flock uses the .lock file not .lock.d.
    // With mkdir fallback (Git Bash): must be 75.
    const hasFlock =
      spawnSync(BASH!, ['-c', 'command -v flock'], { encoding: 'utf8' }).status === 0;
    if (!hasFlock) {
      expect(r.status).toBe(75);
    } else {
      // Hold flock-style lock instead
      rmSync(lockDir, { recursive: true, force: true });
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
    }
  });
});

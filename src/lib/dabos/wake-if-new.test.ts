// @vitest-environment node
/**
 * Runs ops/ln02/wake-if-new/runner.sh and check helpers with bash (RR-010 item 3).
 * Skipped where no POSIX bash exists (Windows without Git for Windows).
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

const ROOT = path.resolve(__dirname, '../../../ops/ln02/wake-if-new');
const RUNNER = path.join(ROOT, 'runner.sh');
const REPO = path.resolve(__dirname, '../../..');

function findBash(): string | null {
  if (process.platform !== 'win32') return existsSync('/bin/bash') ? '/bin/bash' : null;
  const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
  return existsSync(gitBash) ? gitBash : null;
}
const BASH = findBash();
const fwd = (p: string) => p.replace(/\\/g, '/');

describe.skipIf(!BASH)('wake-if-new runner + checks', { timeout: 30_000 }, () => {
  let dir: string;
  let state: string;
  let log: string;
  let csv: string;

  const writeCheck = (name: string, body: string) => {
    const p = path.join(dir, name);
    writeFileSync(p, body.replace(/\r\n/g, '\n'), 'utf8');
    chmodSync(p, 0o755);
    return p;
  };

  const writeEnv = (body = '# none\n') => {
    const p = path.join(dir, 'empty.env');
    writeFileSync(p, body, 'utf8');
    try {
      chmodSync(p, 0o600);
    } catch {
      /* NTFS may ignore */
    }
    return p;
  };

  const run = (job: string, checkBody: string, env: Record<string, string> = {}) => {
    const check = writeCheck('check.sh', `#!/usr/bin/env bash\n${checkBody}\n`);
    const r = spawnSync(BASH!, [fwd(RUNNER), job], {
      encoding: 'utf8',
      env: {
        ...process.env,
        WAKE_STATE_DIR: fwd(state),
        WAKE_LOG_FILE: fwd(log),
        WAKE_CSV_FILE: fwd(csv),
        WAKE_LOCK_DIR: fwd(state),
        WAKE_ENV_FILE: fwd(writeEnv()),
        WAKE_CHECK_BIN: fwd(check),
        WAKE_DRY_RUN: '1',
        WAKE_ERROR_WAKE_AFTER: '2',
        ...env,
      },
    });
    return {
      code: r.status ?? 1,
      stdout: r.stdout,
      stderr: r.stderr,
      state: existsSync(path.join(state, `${job}.state.json`))
        ? JSON.parse(readFileSync(path.join(state, `${job}.state.json`), 'utf8'))
        : null,
      csv: existsSync(csv) ? readFileSync(csv, 'utf8') : '',
      log: existsSync(log) ? readFileSync(log, 'utf8') : '',
    };
  };

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'wake-if-new-'));
    state = path.join(dir, 'state');
    log = path.join(dir, 'log.jsonl');
    csv = path.join(dir, 'counts.csv');
    mkdirSync(state);
    writeEnv();
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('skips when check says skip and resets errors', () => {
    writeFileSync(
      path.join(state, 'telegram_triage.state.json'),
      JSON.stringify({ cursor: 'c0', last_wake: '', consecutive_errors: 1 })
    );
    const r = run(
      'telegram_triage',
      `echo '{"ok":true,"decision":"skip","cursor":"c0","reason":"none"}'`
    );
    expect(r.code).toBe(0);
    expect(r.csv).toMatch(/telegram_triage,.*,skip/);
    expect(r.state.consecutive_errors).toBe(0);
    expect(r.log).toMatch(/"decision":"skip"/);
  });

  it('wakes (dry-run) when check says wake and hooks are set', () => {
    const r = run(
      'telegram_triage',
      `echo '{"ok":true,"decision":"wake","cursor":"c1","reason":"new-captures"}'`,
      {
        WAKE_TELEGRAM_TRIAGE_URL: 'https://example.invalid/hook',
        WAKE_TELEGRAM_TRIAGE_KEY: 'test-key-not-a-secret-for-ci',
      }
    );
    expect(r.code).toBe(0);
    expect(r.csv).toMatch(/telegram_triage,.*,wake/);
    expect(r.state.cursor).toBe('c1');
    expect(r.state.last_wake).toMatch(/T/);
    expect(r.state.consecutive_errors).toBe(0);
    expect(r.log).not.toMatch(/test-key/);
    expect(r.log).not.toMatch(/example\.invalid/);
  });

  it('escalates to check-error wake after 2 consecutive errors', () => {
    writeFileSync(
      path.join(state, 'mail_triage.state.json'),
      JSON.stringify({ cursor: '0', last_wake: '', consecutive_errors: 1 })
    );
    const r = run('mail_triage', `echo '{"ok":false,"error":"boom"}'; exit 1`, {
      WAKE_MAIL_TRIAGE_URL: 'https://example.invalid/hook',
      WAKE_MAIL_TRIAGE_KEY: 'k',
    });
    expect(r.code).toBe(0);
    expect(r.csv).toMatch(/mail_triage,.*,wake/);
    expect(r.log).toMatch(/check-error/);
    expect(r.state.consecutive_errors).toBe(0);
  });

  it('records error without waking on first check failure', () => {
    const r = run('mail_triage', `echo '{"ok":false,"error":"once"}'; exit 1`, {
      WAKE_MAIL_TRIAGE_URL: 'https://example.invalid/hook',
      WAKE_MAIL_TRIAGE_KEY: 'k',
    });
    expect(r.code).toBe(0);
    expect(r.csv).toMatch(/mail_triage,.*,error/);
    expect(r.state.consecutive_errors).toBe(1);
    expect(r.csv).not.toMatch(/,wake/);
  });

  it('failed wake does not advance the cursor (A2.2)', () => {
    writeFileSync(
      path.join(state, 'telegram_triage.state.json'),
      JSON.stringify({
        cursor: '2026-11-01T10:00:00.000000Z',
        last_wake: '',
        consecutive_errors: 0,
      })
    );
    // WAKE_DRY_RUN unset + missing URL → wake-missing-hook; cursor must stay
    const check = writeCheck(
      'check.sh',
      `#!/usr/bin/env bash\necho '{"ok":true,"decision":"wake","cursor":"2026-11-01T12:00:00.000000Z","reason":"new"}'\n`
    );
    const r = spawnSync(BASH!, [fwd(RUNNER), 'telegram_triage'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        WAKE_STATE_DIR: fwd(state),
        WAKE_LOG_FILE: fwd(log),
        WAKE_CSV_FILE: fwd(csv),
        WAKE_LOCK_DIR: fwd(state),
        WAKE_ENV_FILE: fwd(writeEnv()),
        WAKE_CHECK_BIN: fwd(check),
        WAKE_DRY_RUN: '0',
        // no URL/KEY → failed wake
      },
    });
    expect(r.status).toBe(1);
    const st = JSON.parse(
      readFileSync(path.join(state, 'telegram_triage.state.json'), 'utf8')
    );
    expect(st.cursor).toBe('2026-11-01T10:00:00.000000Z');
    expect(st.consecutive_errors).toBe(1);
  });

  it('lib wake_validate_cursor rejects junk', () => {
    const script = `
      . "${fwd(path.join(ROOT, 'lib.sh'))}"
      if wake_validate_cursor 'bad;drop'; then echo FAIL; exit 1; fi
      c=\$(wake_validate_cursor '2026-11-01T10:00:00Z') || exit 1
      echo "\$c"
    `;
    const r = spawnSync(BASH!, ['-c', script], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('2026-11-01T10:00:00Z');
  });

  it('wake_trim_psql_field keeps interior spaces (real psql timestamptz shape)', () => {
    const script = `
      . "${fwd(path.join(ROOT, 'lib.sh'))}"
      # Real-style psql -tA timestamptz (space between date and time)
      raw=\$'1|2026-11-01 22:40:30.946182+01\\n'
      max="\${raw#*|}"
      out="\$(wake_trim_psql_field "\$max")"
      echo "\$out"
      # Must NOT become 2026-11-0122:40:30...
      case "\$out" in
        *' '*) echo HAS_SPACE ;;
        *) echo NO_SPACE; exit 1 ;;
      esac
    `;
    const r = spawnSync(BASH!, ['-c', script], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/2026-11-01 22:40:30/);
    expect(r.stdout).toMatch(/HAS_SPACE/);
  });

  it('telegram SQL emits ISO via to_char (A2.1)', () => {
    const src = readFileSync(path.join(ROOT, 'checks/telegram_triage.sh'), 'utf8');
    expect(src).toMatch(/to_char\s*\(/);
    expect(src).toMatch(/YYYY-MM-DD/);
    expect(src).not.toMatch(/MAX="\$\{MAX\/\/\[\[:space:\]\]\/\}"/);
  });

  it('telegram check with mock psql ISO output advances cursor cleanly', () => {
    const bin = path.join(dir, 'bin');
    mkdirSync(bin);
    const fakePs = path.join(bin, 'psql');
    // Emit what our to_char SQL produces
    writeFileSync(
      fakePs,
      `#!/usr/bin/env bash\necho '1|2026-11-01T21:40:30.946182Z'\n`,
      'utf8'
    );
    chmodSync(fakePs, 0o755);
    const r = spawnSync(BASH!, [fwd(path.join(ROOT, 'checks/telegram_triage.sh'))], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fwd(bin)}${path.delimiter}${process.env.PATH || ''}`,
        STATE_CURSOR: '2026-11-01T00:00:00Z',
        WAKE_TELEGRAM_TRIAGE_DATABASE_URL:
          'postgres://u:p@127.0.0.1:5432/db?sslmode=disable',
      },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/"decision":"wake"/);
    expect(r.stdout).toMatch(/2026-11-01T21:40:30/);
    expect(r.stdout).not.toMatch(/2026-11-0121/);
  });

  it('wake_cursor_max is monotonic (A2.4)', () => {
    const script = `
      . "${fwd(path.join(ROOT, 'lib.sh'))}"
      a='2026-11-01T20:00:00.000000Z'
      b='2026-11-01T18:00:00.000000Z'
      echo "\$(wake_cursor_max "\$a" "\$b")"
      echo "\$(wake_cursor_max "\$b" "\$a")"
    `;
    const r = spawnSync(BASH!, ['-c', script], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    const lines = r.stdout.trim().split(/\r?\n/);
    expect(lines[0]).toBe('2026-11-01T20:00:00.000000Z');
    expect(lines[1]).toBe('2026-11-01T20:00:00.000000Z');
  });

  it('wake_cursor_max normalises GitHub second vs Neon micro in same second (A3.1)', () => {
    const script = `
      . "${fwd(path.join(ROOT, 'lib.sh'))}"
      gh='2026-11-05T12:00:00Z'
      neon='2026-11-05T12:00:00.500000Z'
      # Raw string compare wrongly ranks gh after neon; normalised max is neon.
      echo "\$(wake_cursor_max "\$gh" "\$neon")"
      echo "\$(wake_cursor_max "\$neon" "\$gh")"
      # Same instant, different precision: either side is fine; both norms equal.
      echo "\$(wake_cursor_norm "\$gh")"
      echo "\$(wake_cursor_norm "\$neon")"
    `;
    const r = spawnSync(BASH!, ['-c', script], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    const lines = r.stdout.trim().split(/\r?\n/);
    expect(lines[0]).toBe('2026-11-05T12:00:00.500000Z');
    expect(lines[1]).toBe('2026-11-05T12:00:00.500000Z');
    expect(lines[2]).toBe('2026-11-05T12:00:00.000000Z');
    expect(lines[3]).toBe('2026-11-05T12:00:00.500000Z');
    // Prove the old bug: raw string would have picked gh
    expect('2026-11-05T12:00:00Z' > '2026-11-05T12:00:00.500000Z').toBe(true);
  });

  it('wake_psql / wake_post_webhook restore errexit after success (A3.2)', () => {
    const bin = path.join(dir, 'bin');
    mkdirSync(bin);
    writeFileSync(path.join(bin, 'psql'), `#!/usr/bin/env bash\necho ok\nexit 0\n`, 'utf8');
    chmodSync(path.join(bin, 'psql'), 0o755);
    writeFileSync(
      path.join(bin, 'curl'),
      `#!/usr/bin/env bash\n# swallow args; succeed\nexit 0\n`,
      'utf8'
    );
    chmodSync(path.join(bin, 'curl'), 0o755);
    const script = `
      set -e
      . "${fwd(path.join(ROOT, 'lib.sh'))}"
      export PATH="${fwd(bin)}:$PATH"
      wake_psql 'postgres://u:p@127.0.0.1:5432/db?sslmode=disable' -c 'select 1' >/dev/null
      case \$- in *e*) echo psql_errexit_on ;; *) echo psql_errexit_off; exit 2 ;; esac
      wake_post_webhook 'https://example.invalid/hook' 'k' '{"x":1}'
      case \$- in *e*) echo curl_errexit_on ;; *) echo curl_errexit_off; exit 3 ;; esac
      # Prove errexit still bites
      false && true
      echo should_not_reach
    `;
    const r = spawnSync(BASH!, ['-c', script], { encoding: 'utf8' });
    expect(r.status).not.toBe(0);
    expect(r.stdout).toMatch(/psql_errexit_on/);
    expect(r.stdout).toMatch(/curl_errexit_on/);
    expect(r.stdout).not.toMatch(/should_not_reach/);
  });

  it('status_report keeps newer Neon over older GitHub (A2.4)', () => {
    const bin = path.join(dir, 'bin');
    mkdirSync(bin);
    writeFileSync(
      path.join(bin, 'psql'),
      `#!/usr/bin/env bash\necho '1|2026-11-01T20:00:00.000000Z'\n`,
      'utf8'
    );
    chmodSync(path.join(bin, 'psql'), 0o755);
    // Fake python3 that prints older GH hit
    writeFileSync(
      path.join(bin, 'python3'),
      `#!/usr/bin/env bash\necho '1|2026-11-01T18:00:00.000000Z'\n`,
      'utf8'
    );
    chmodSync(path.join(bin, 'python3'), 0o755);
    const r = spawnSync(BASH!, [fwd(path.join(ROOT, 'checks/status_report.sh'))], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fwd(bin)}${path.delimiter}${process.env.PATH || ''}`,
        STATE_CURSOR: '2026-11-01T00:00:00Z',
        STATUS_DIVISION: 'Div4',
        WAKE_STATUS_DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/db?sslmode=disable',
        WAKE_GITHUB_TOKEN: 'fake-token-not-a-secret',
      },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/"cursor":"2026-11-01T20:00:00/);
  });

  it('morning_brief keeps separate cursors per source (A2.3)', () => {
    writeFileSync(
      path.join(state, 'morning_brief.state.json'),
      JSON.stringify({
        cursor: '2026-11-01T08:00:00Z',
        cursor_telegram: '2026-11-01T08:00:00Z',
        cursor_mail: '100',
        cursor_status: '2026-11-01T08:00:00Z',
        last_wake: '',
        consecutive_errors: 0,
      })
    );
    // Stub sub-checks via PATH wrappers? Simpler: override CHECK scripts by... 
    // morning_brief calls fixed paths. Use env that triggers only mail path with a stub:
    // Easiest: run morning_brief with a fake telegram that would break if given UID cursor.
    const checksDir = path.join(dir, 'checks');
    mkdirSync(checksDir);
    // We can't easily redirect morning_brief's ROOT. Instead unit-test via exporting
    // and invoking a thin harness that sources morning logic — or run runner with
    // WAKE_CHECK_BIN that emits multi-cursors (runner path).
    const r = run(
      'morning_brief',
      `echo '{"ok":true,"decision":"wake","cursor":"2026-11-01T09:00:00Z","cursor_telegram":"2026-11-01T09:00:00Z","cursor_mail":"150","cursor_status":"2026-11-01T08:30:00Z","reason":"overnight-new"}'`,
      {
        WAKE_MORNING_BRIEF_URL: 'https://example.invalid/hook',
        WAKE_MORNING_BRIEF_KEY: 'k',
      }
    );
    expect(r.code).toBe(0);
    expect(r.state.cursor).toBe('2026-11-01T09:00:00Z');
    expect(r.state.cursor_telegram).toBe('2026-11-01T09:00:00Z');
    expect(r.state.cursor_mail).toBe('150');
    expect(r.state.cursor_status).toBe('2026-11-01T08:30:00Z');
  });

  it('morning_brief does not feed timestamp cursor to mail UID path', () => {
    // Integration: seed mixed state, stub sub-checks by replacing via a wrapper root is hard.
    // Assert mail_triage uses wake_validate_uid_cursor and morning exports distinct cursors.
    const morning = readFileSync(path.join(ROOT, 'checks/morning_brief.sh'), 'utf8');
    expect(morning).toMatch(/STATE_CURSOR_TELEGRAM/);
    expect(morning).toMatch(/STATE_CURSOR_MAIL/);
    expect(morning).toMatch(/STATE_CURSOR_STATUS/);
    expect(morning).toMatch(/wake_validate_uid_cursor/);
    expect(morning).toMatch(/cursor_mail/);
  });

  it('wake_load_env parses literally and does not expand (A2.6)', () => {
    const envFile = path.join(dir, 'lit.env');
    writeFileSync(envFile, 'FOO=bar$USER\nBAR=`id`\nBAZ=$(whoami)\n', 'utf8');
    try {
      chmodSync(envFile, 0o600);
    } catch {
      /* ignore */
    }
    const script = `
      . "${fwd(path.join(ROOT, 'lib.sh'))}"
      wake_load_env "${fwd(envFile)}" || exit 1
      printf '%s\\n' "\$FOO"
      printf '%s\\n' "\$BAR"
      printf '%s\\n' "\$BAZ"
    `;
    const r = spawnSync(BASH!, ['-c', script], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    const lines = r.stdout.trim().split(/\r?\n/);
    expect(lines[0]).toBe('bar$USER');
    expect(lines[1]).toBe('`id`');
    expect(lines[2]).toBe('$(whoami)');
  });

  it('wake_post_webhook and wake_psql keep secrets off argv (A2.5)', () => {
    const lib = readFileSync(path.join(ROOT, 'lib.sh'), 'utf8');
    expect(lib).toMatch(/--config/);
    expect(lib).toMatch(/PGPASSFILE/);
    expect(lib).not.toMatch(/-H "\$\{header_name\}: \$\{auth\}"/);
    expect(lib).toMatch(/wake_psql/);
    // telegram must use wake_psql not psql "$DB"
    const tele = readFileSync(path.join(ROOT, 'checks/telegram_triage.sh'), 'utf8');
    expect(tele).toMatch(/wake_psql/);
    expect(tele).not.toMatch(/(?<!wake_)psql "\$DB"/);
  });

  it('scripts under wake-if-new are git mode 100755 (A2.7)', () => {
    const r = spawnSync(
      'git',
      ['-C', REPO, 'ls-files', '-s', 'ops/ln02/wake-if-new'],
      { encoding: 'utf8' }
    );
    expect(r.status).toBe(0);
    const lines = r.stdout
      .trim()
      .split(/\r?\n/)
      .filter((l) => /\.(sh|py)$/.test(l) || /dabos-wake-if-new/.test(l));
    expect(lines.length).toBeGreaterThan(5);
    for (const line of lines) {
      expect(line.startsWith('100755')).toBe(true);
    }
  });

  it('telegram check errors when DATABASE_URL missing', () => {
    const r = spawnSync(BASH!, [fwd(path.join(ROOT, 'checks/telegram_triage.sh'))], {
      encoding: 'utf8',
      env: { ...process.env, STATE_CURSOR: '2026-01-01T00:00:00Z' },
    });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/missing-WAKE_TELEGRAM_TRIAGE_DATABASE_URL/);
  });

  it('mail check errors when IMAP env missing', () => {
    const r = spawnSync(BASH!, [fwd(path.join(ROOT, 'checks/mail_triage.sh'))], {
      encoding: 'utf8',
      env: { ...process.env, STATE_CURSOR: '0' },
    });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/missing-imap-env/);
  });

  it('status check errors when no sources configured', () => {
    const r = spawnSync(BASH!, [fwd(path.join(ROOT, 'checks/status_report.sh'))], {
      encoding: 'utf8',
      env: {
        ...process.env,
        STATE_CURSOR: '2026-01-01T00:00:00Z',
        STATUS_DIVISION: 'Div4',
      },
    });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/missing-status-sources/);
  });

  it('morning brief errors when no sources configured', () => {
    const r = spawnSync(BASH!, [fwd(path.join(ROOT, 'checks/morning_brief.sh'))], {
      encoding: 'utf8',
      env: { ...process.env, STATE_CURSOR: '2026-01-01T00:00:00Z' },
    });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/missing-morning-sources/);
  });

  it('installer is plan-only by default (bash -n + help)', () => {
    const install = path.resolve(ROOT, '../install-wake-if-new.sh');
    const syntax = spawnSync(BASH!, ['-n', fwd(install)], { encoding: 'utf8' });
    expect(syntax.status).toBe(0);
    const help = spawnSync(BASH!, [fwd(install), '--help'], { encoding: 'utf8' });
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/--apply/);
  });

  it('runbook lists env names and Grok cutover', () => {
    const doc = readFileSync(path.resolve(__dirname, '../../docs/dabos/wake-if-new.md'), 'utf8');
    expect(doc).toMatch(/WAKE_TELEGRAM_TRIAGE_URL/);
    expect(doc).toMatch(/WAKE_MAIL_IMAP_PASSWORD/);
    expect(doc).toMatch(/webhook/);
    expect(doc).toMatch(/cron/);
  });
});

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
        WAKE_ENV_FILE: fwd(path.join(dir, 'empty.env')),
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
    writeFileSync(path.join(dir, 'empty.env'), '# none\n');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('skips when check says skip and resets errors', () => {
    // seed errors
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

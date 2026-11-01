// @vitest-environment node
/**
 * Bash tests for ops/ln02/comm-center wake decision CSV (skip / wake / error escalation).
 * Skipped where no POSIX bash exists.
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

const ROOT = path.resolve(__dirname, '../../../../ops/ln02/comm-center');
const WAKE = path.join(ROOT, 'wake.sh');

function findBash(): string | null {
  if (process.platform !== 'win32') return existsSync('/bin/bash') ? '/bin/bash' : null;
  const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
  return existsSync(gitBash) ? gitBash : null;
}
const BASH = findBash();
const fwd = (p: string) => p.replace(/\\/g, '/');

describe.skipIf(!BASH)('comm-center wake.sh', { timeout: 30_000 }, () => {
  let dir: string;
  let state: string;
  let log: string;
  let csv: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'comm-center-'));
    state = path.join(dir, 'state');
    log = path.join(dir, 'log.jsonl');
    csv = path.join(dir, 'counts.csv');
    mkdirSync(state);
    writeFileSync(path.join(dir, 'empty.env'), '# none\n');
    // stub psql absent path: missing DB URL triggers error path
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const run = (post: string, env: Record<string, string> = {}) => {
    const r = spawnSync(BASH!, [fwd(WAKE), post], {
      encoding: 'utf8',
      env: {
        ...process.env,
        CC_STATE_DIR: fwd(state),
        CC_LOG_FILE: fwd(log),
        CC_CSV_FILE: fwd(csv),
        CC_ENV_FILE: fwd(path.join(dir, 'empty.env')),
        WAKE_DRY_RUN: '1',
        WAKE_ERROR_WAKE_AFTER: '2',
        // Force missing DB so check-error path runs without psql
        COMM_CENTER_DATABASE_URL: '',
        WAKE_DATABASE_URL: '',
        DATABASE_URL: '',
        ...env,
      },
    });
    return {
      code: r.status ?? 1,
      csv: existsSync(csv) ? readFileSync(csv, 'utf8') : '',
      log: existsSync(log) ? readFileSync(log, 'utf8') : '',
      state: existsSync(path.join(state, `${post}.state.json`))
        ? JSON.parse(readFileSync(path.join(state, `${post}.state.json`), 'utf8'))
        : null,
    };
  };

  it('records error then wakes with check-error on second failure', () => {
    const r1 = run('Div4', { WAKE_DIV4_URL: 'http://example.invalid/hook', WAKE_DIV4_KEY: 'k' });
    expect(r1.csv).toMatch(/Div4,.*,error/);
    expect(r1.state.consecutive_errors).toBe(1);

    const r2 = run('Div4', { WAKE_DIV4_URL: 'http://example.invalid/hook', WAKE_DIV4_KEY: 'k' });
    expect(r2.csv).toMatch(/Div4,.*,wake/);
    expect(r2.log).toMatch(/check-error/);
  });

  it('DIGEST slot skips without agent wake', () => {
    const r = run('DIGEST');
    expect(r.code).toBe(0);
    expect(r.csv).toMatch(/DIGEST,.*,skip/);
  });
});

describe.skipIf(!BASH)('comm-center clocks lib', { timeout: 15_000 }, () => {
  it('loads clocks.env.example without syntax error', () => {
    const script = `
      set -euo pipefail
      ROOT="${fwd(ROOT)}"
      . "$ROOT/lib.sh"
      cc_load_env "$ROOT/clocks.env.example"
      test -n "\${COMM_CLOCK_DIV1:-}"
      echo ok
    `;
    const p = path.join(os.tmpdir(), `cc-clocks-${Date.now()}.sh`);
    writeFileSync(p, script.replace(/\r\n/g, '\n'));
    chmodSync(p, 0o755);
    const r = spawnSync(BASH!, [fwd(p)], { encoding: 'utf8' });
    rmSync(p, { force: true });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('ok');
  });
});

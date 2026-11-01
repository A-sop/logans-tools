// @vitest-environment node
/**
 * Runs the real ops/ln02/bin/dabos-checkout-sync.sh with bash on temporary git repos (RR-010 step 0).
 * Skipped where no POSIX bash exists (Windows without Git for Windows).
 */
import { execFileSync, spawnSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '../../../ops/ln02/bin/dabos-checkout-sync.sh');

function findBash(): string | null {
  if (process.platform !== 'win32') return existsSync('/bin/bash') ? '/bin/bash' : null;
  const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
  return existsSync(gitBash) ? gitBash : null; // never WSL's System32 bash
}
const BASH = findBash();
const fwd = (p: string) => p.replace(/\\/g, '/');

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

describe.skipIf(!BASH)('ln02 dabos-checkout-sync.sh (fetch + fast-forward only)', { timeout: 60_000 }, () => {
  let dir: string;
  let origin: string;
  let work: string;
  let pusher: string;
  let state: string;
  let conf: string;

  const run = (repos: string[] = [work]) => {
    const r = spawnSync(BASH!, [fwd(SCRIPT)], {
      encoding: 'utf8',
      env: {
        ...process.env,
        STATE_DIR: fwd(state),
        CONF_DIR: fwd(conf),
        SYNC_REPOS: repos.map(fwd).join(' '),
        SYNC_SKIP_GUARDS: '1',
        SYNC_NPM_CI: '0',
      },
    });
    const statusPath = path.join(state, 'checkout-sync.status.json');
    const status = existsSync(statusPath) ? JSON.parse(readFileSync(statusPath, 'utf8')) : null;
    return { code: r.status, stderr: r.stderr, status, failFlag: existsSync(path.join(state, 'checkout-sync.FAIL')) };
  };
  const pushCommit = (msg: string) => {
    git(pusher, 'commit', '-q', '--allow-empty', '-m', msg);
    git(pusher, 'push', '-q', 'origin', 'main');
  };

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'ln02-sync-'));
    origin = path.join(dir, 'origin.git');
    work = path.join(dir, 'work');
    pusher = path.join(dir, 'pusher');
    state = path.join(dir, 'state');
    conf = path.join(dir, 'conf');
    mkdirSync(conf);
    git(dir, 'init', '-q', '--bare', '-b', 'main', origin);
    git(dir, 'clone', '-q', origin, pusher);
    writeFileSync(path.join(pusher, 'a.txt'), 'one\n');
    git(pusher, 'add', 'a.txt');
    git(pusher, 'commit', '-q', '-m', 'one');
    git(pusher, 'push', '-q', 'origin', 'main');
    git(dir, 'clone', '-q', origin, work);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('behind -> fast-forwarded to origin/main, status ok, no FAIL flag, FETCH_HEAD written', () => {
    pushCommit('two');
    const target = git(pusher, 'rev-parse', 'HEAD');
    const r = run();
    expect(r.code).toBe(0);
    expect(git(work, 'rev-parse', 'HEAD')).toBe(target);
    expect(r.status.state).toBe('ok');
    expect(r.status.repos[0].state).toBe('ok');
    expect(r.failFlag).toBe(false);
    expect(existsSync(path.join(work, '.git', 'FETCH_HEAD'))).toBe(true);
  });

  it('up to date -> no change, ok', () => {
    const head = git(work, 'rev-parse', 'HEAD');
    const r = run();
    expect(r.code).toBe(0);
    expect(r.status.repos[0].state).toBe('up_to_date');
    expect(git(work, 'rev-parse', 'HEAD')).toBe(head);
  });

  it('diverged -> untouched, FAIL flag, non-zero; a later clean run clears the flag', () => {
    git(work, 'commit', '-q', '--allow-empty', '-m', 'local only');
    const local = git(work, 'rev-parse', 'HEAD');
    pushCommit('remote only');
    const r = run();
    expect(r.code).not.toBe(0);
    expect(r.status.repos[0].state).toBe('diverged');
    expect(git(work, 'rev-parse', 'HEAD')).toBe(local);
    expect(r.failFlag).toBe(true);
    const other = path.join(dir, 'other');
    git(dir, 'clone', '-q', origin, other);
    const r2 = run([other]);
    expect(r2.code).toBe(0);
    expect(r2.failFlag).toBe(false);
  });

  it('local ahead -> untouched, reported as ahead, non-zero', () => {
    git(work, 'commit', '-q', '--allow-empty', '-m', 'local only');
    const local = git(work, 'rev-parse', 'HEAD');
    const r = run();
    expect(r.code).not.toBe(0);
    expect(r.status.repos[0].state).toBe('ahead');
    expect(git(work, 'rev-parse', 'HEAD')).toBe(local);
  });

  it('dirty tracked file -> refused, no fetch, file and HEAD untouched', () => {
    pushCommit('two');
    const head = git(work, 'rev-parse', 'HEAD');
    writeFileSync(path.join(work, 'a.txt'), 'local edit\n');
    const r = run();
    expect(r.code).not.toBe(0);
    expect(r.status.repos[0].state).toBe('dirty');
    expect(git(work, 'rev-parse', 'HEAD')).toBe(head);
    expect(readFileSync(path.join(work, 'a.txt'), 'utf8')).toBe('local edit\n');
  });

  it('wrong branch -> refused, untouched', () => {
    pushCommit('two');
    git(work, 'checkout', '-q', '-b', 'feature');
    const head = git(work, 'rev-parse', 'HEAD');
    const r = run();
    expect(r.code).not.toBe(0);
    expect(r.status.repos[0].state).toBe('wrong_branch');
    expect(git(work, 'rev-parse', 'HEAD')).toBe(head);
  });

  it('PAUSE-checkout-sync present -> nothing runs, exit 0', () => {
    pushCommit('two');
    const head = git(work, 'rev-parse', 'HEAD');
    writeFileSync(path.join(conf, 'PAUSE-checkout-sync'), '');
    const r = run();
    expect(r.code).toBe(0);
    expect(r.status.state).toBe('paused');
    expect(git(work, 'rev-parse', 'HEAD')).toBe(head);
  });

  it('the script never resets, forces, cleans or pushes', () => {
    const body = readFileSync(SCRIPT, 'utf8')
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('#'))
      .join('\n');
    expect(body).not.toMatch(/\breset\b|--force\b|\bclean\b|\bpush\b|checkout -f/);
  });
});

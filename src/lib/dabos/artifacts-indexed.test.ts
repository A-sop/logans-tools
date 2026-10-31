import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  computeArtifactsIndexedWeekly,
  gitBeforeArg,
  isLocalRemote,
  normaliseRemoteUrl,
  pageFingerprint,
  pagesAddedBetween,
  type PreviousDiv1Row,
  wikiPageFingerprints,
  wikiPageTargets,
} from '@/lib/dabos/artifacts-indexed';
import type { DabosSql } from '@/lib/dabos/dabos-connection';
import { postDivisionWeeklyStats } from '@/lib/dabos/division-weekly-stats';
import { closedOrgWeek, closedOrgWeekForIsoWeek } from '@/lib/dabos/org-week';

// FULLY SYNTHETIC: every page below is invented (synthetic-page-NN). No DABOS content, no real
// names, IDs or e-mail addresses. The real W44 check (232 -> 292 = 60) is a manual recount in the PR.

const W43 = closedOrgWeek(new Date('2026-10-22T12:30:00Z')); // Thu 15 Oct 14:00 -> Thu 22 Oct 14:00 Berlin (CEST)
const W44 = closedOrgWeek(new Date('2026-10-29T13:30:00Z')); // Thu 22 Oct 14:00 CEST -> Thu 29 Oct 14:00 CET
const W45 = closedOrgWeek(new Date('2026-11-05T13:30:00Z'));

const page = (n: number) => `synthetic-page-${String(n).padStart(2, '0')}`;
function indexText(pages: number[], extra: string[] = []): string {
  return [
    '# Synthetic wiki index',
    '| Page | Kind | Summary |',
    '|------|------|---------|',
    ...pages.map((n) => `| [Page ${n}](./entities\\${page(n)}.md) | entity | synthetic |`),
    ...extra,
    '- [Schema](./SCHEMA.md) - rules',
    '- [External](https://example.com/x.md) - external, skipped',
  ].join('\n');
}
const fps = (pages: number[]) => wikiPageFingerprints(indexText(pages));
const pagesExcl = (n: number) => n + 1; // + SCHEMA.md, which every synthetic index links

describe('wiki page targets (unique pages, not rows)', () => {
  it('normalises slashes, ./, trailing / and case; skips external links', () => {
    const text = [
      '| [A](./entities\\alpha.md) | entity | a |',
      '| [A again](./entities/alpha.md) | entity | dup, slash style |',
      '| [A upper](./Entities\\Alpha.md) | entity | dup, case |',
      '| [B](./sources\\beta.md#part) | source | anchor dropped |',
      '- [Inbox](./inbox/) - raw',
      '- [Ext](https://example.com/x.md) - external',
      '- [Anchor](#top) - anchor only',
    ].join('\n');
    expect([...wikiPageTargets(text)].sort()).toEqual(['entities/alpha.md', 'inbox', 'sources/beta.md']);
  });
  it('fingerprint format: sha256(utf8 normalised target), no salt, first 16 hex; unique sorted array', () => {
    // Known-answer vector so a backfill (#49) can check byte-for-byte: sha256("schema.md").
    expect(pageFingerprint('schema.md')).toBe('f52e28bb16f63c2f');
    const list = wikiPageFingerprints(indexText([2, 1, 1]));
    expect(list).toHaveLength(3); // 2 pages + SCHEMA.md
    expect(list).toEqual([...list].sort());
    for (const f of list) expect(f).toMatch(/^[0-9a-f]{16}$/);
    expect(list).toContain(pageFingerprint(`entities/${page(1)}.md`));
  });
});

describe('pagesAddedBetween', () => {
  it('counts additions, not the net change', () => {
    expect(pagesAddedBetween(['a', 'b', 'c'], ['b', 'c', 'd', 'e'])).toEqual({ added: 2, removed: 1 });
    expect(pagesAddedBetween(['a'], ['a'])).toEqual({ added: 0, removed: 0 });
  });
});

describe('gitBeforeArg: strictly before the Thu 14:00 Berlin boundary', () => {
  it('uses the last whole second before the boundary (CEST and CET weeks)', () => {
    expect(W44.start.toISOString()).toBe('2026-10-22T12:00:00.000Z'); // 14:00 CEST
    expect(W44.end.toISOString()).toBe('2026-10-29T13:00:00.000Z'); // 14:00 CET
    expect(gitBeforeArg(W44.start)).toBe('2026-10-22T11:59:59Z');
    expect(gitBeforeArg(W44.end)).toBe('2026-10-29T12:59:59Z');
  });
});

// ---------------------------------------------------------------------------------------------
// Synthetic upstream ("GitHub") repo `up`, branch main, committer time = when the commit was made:
//  c1 2026-10-15T08:00:00Z (10:00 Berlin, before W43 opens)  pages 1,2,3
//  c2 2026-10-22T11:59:58Z (13:59:58 Berlin, end of W43) +4                  -> 1,2,3,4
//  side branch from c2: s1 2026-10-22T11:59:59Z (W43's last second) adds 20; merged in W44 (M)
//  c3 2026-10-22T12:00:00Z (14:00:00 Berlin, first second of W44) +5,+6 (+ a duplicate link to 5)
//  M  2026-10-26T10:00:00Z merge of side: +20
//  c4 2026-10-29T12:59:59Z (13:59:59 CET, last second of W44) +7, -1
//  c5 2026-10-29T13:00:00Z (14:00:00 CET, first second of W45) +8,+9,+10
// `repo` = clone of `up` fetched (clone reflog) on 2026-11-06, after the W45 close.
// `stale` = clone of `up` fetched on 2026-10-28, before the W44 close, then never fetched.
// ---------------------------------------------------------------------------------------------
const tmp: string[] = [];
let up = '';
let repo = '';
let stale = '';
let plain = '';
let m133 = '';

function g(dir: string, args: string[], when?: string) {
  const env = { ...process.env };
  if (when) {
    env.GIT_AUTHOR_DATE = when;
    env.GIT_COMMITTER_DATE = when;
  }
  return execFileSync(
    'git',
    ['-c', 'user.name=Synthetic Test', '-c', 'user.email=test@example.invalid', '-c', 'core.autocrlf=false', '-C', dir, ...args],
    { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();
}
function writeIndex(dir: string, pages: number[], extra: string[] = []) {
  mkdirSync(path.join(dir, 'docs', 'wiki'), { recursive: true });
  writeFileSync(path.join(dir, 'docs', 'wiki', 'index.md'), indexText(pages, extra));
}
function commit(dir: string, pages: number[], when: string, extra: string[] = []) {
  writeIndex(dir, pages, extra);
  g(dir, ['add', '-A']);
  g(dir, ['commit', '-q', '-m', `synthetic ${when}`], when);
  return g(dir, ['rev-parse', 'HEAD']);
}
function newDir(prefix: string) {
  const d = mkdtempSync(path.join(tmpdir(), prefix));
  tmp.push(d);
  return d;
}
/**
 * Clone whose last fetch of origin/main happened at `fetchedAt`: the remote ref is re-created by a
 * fetch stamped at that time (reflog entry), and FETCH_HEAD's mtime is set to the same time.
 */
function cloneAt(src: string, fetchedAt: string, prefix: string) {
  const d = newDir(prefix);
  rmSync(d, { recursive: true, force: true });
  execFileSync('git', ['-c', 'core.autocrlf=false', 'clone', '-q', src, d], { stdio: ['ignore', 'pipe', 'pipe'] });
  g(d, ['update-ref', '-d', 'refs/remotes/origin/main']);
  g(d, ['fetch', '-q', 'origin'], fetchedAt);
  utimesSync(path.join(d, '.git', 'FETCH_HEAD'), new Date(fetchedAt), new Date(fetchedAt));
  return d;
}

const ids: Record<string, string> = {};

beforeAll(() => {
  up = newDir('div1-wiki-up-');
  g(up, ['init', '-q', '-b', 'main']);
  commit(up, [1, 2, 3], '2026-10-15T08:00:00Z');
  ids.c2 = commit(up, [1, 2, 3, 4], '2026-10-22T11:59:58Z');
  g(up, ['checkout', '-q', '-b', 'side']);
  commit(up, [1, 2, 3, 4, 20], '2026-10-22T11:59:59Z');
  g(up, ['checkout', '-q', 'main']);
  const dupOf5 = [`| [Page 5 again](./ENTITIES/${page(5)}.md/) | entity | duplicate link |`];
  commit(up, [1, 2, 3, 4, 5, 6], '2026-10-22T12:00:00Z', dupOf5);
  g(up, ['merge', '-q', '--no-ff', '--no-commit', '-s', 'ours', 'side'], '2026-10-26T10:00:00Z');
  writeIndex(up, [1, 2, 3, 4, 5, 6, 20], dupOf5);
  g(up, ['add', '-A']);
  g(up, ['commit', '-q', '-m', 'synthetic merge side'], '2026-10-26T10:00:00Z');
  ids.M = g(up, ['rev-parse', 'HEAD']);
  g(up, ['branch', 'frozen', ids.M]); // another branch of origin that stays at M
  ids.c4 = commit(up, [2, 3, 4, 5, 6, 20, 7], '2026-10-29T12:59:59Z', dupOf5);
  commit(up, [2, 3, 4, 5, 6, 20, 7, 8, 9, 10], '2026-10-29T13:00:00Z', dupOf5);

  repo = cloneAt(up, '2026-11-06T09:00:00Z', 'div1-wiki-git-');
  stale = cloneAt(up, '2026-10-28T10:00:00Z', 'div1-wiki-stale-');
  // The never-fetched copy: its checkout is behind (W43 state) and on a local branch.
  g(stale, ['reset', '-q', '--hard', ids.c2!]);

  plain = newDir('div1-wiki-plain-');
  writeIndex(plain, [2, 3, 4, 5, 6, 20, 7, 8, 9, 10]);

  // 133ea3be shape: GitHub main gets pages 4,5,6 on Thu 10 Sep 22:19Z (W38); a stale local copy
  // (forked before that) merges GitHub main on 29 Sep (W40) with ITSELF as first parent and is
  // pushed, so GitHub main's first-parent line only shows the pages arriving in W40.
  const src = newDir('div1-wiki-m133src-');
  g(src, ['init', '-q', '-b', 'main']);
  commit(src, [1, 2, 3], '2026-09-01T10:00:00Z');
  g(src, ['checkout', '-q', '-b', 'gh']);
  commit(src, [1, 2, 3, 4, 5, 6], '2026-09-10T22:19:00Z');
  ids.g2 = commit(src, [1, 2, 3, 4, 5, 6], '2026-09-17T04:02:00Z', ['<!-- synthetic edit, no new page -->']);
  g(src, ['checkout', '-q', 'main']);
  writeFileSync(path.join(src, 'notes.md'), 'synthetic stale-copy work\n');
  g(src, ['add', '-A']);
  g(src, ['commit', '-q', '-m', 'synthetic stale copy'], '2026-09-20T10:00:00Z');
  ids.l1 = g(src, ['rev-parse', 'HEAD']);
  g(src, ['merge', '-q', '--no-ff', '-m', 'synthetic merge GitHub main into stale copy', 'gh'], '2026-09-29T10:42:50Z');
  m133 = cloneAt(src, '2026-10-02T09:00:00Z', 'div1-wiki-m133-');
}, 120_000);

afterAll(() => {
  for (const d of tmp) rmSync(d, { recursive: true, force: true });
});

/** Runs consecutive weeks, feeding each week's row into the next as the start point. */
async function chain(root: string, weeks: number[], first: PreviousDiv1Row | null = null) {
  let prev = first;
  const out: Record<number, number | string> = {};
  for (const w of weeks) {
    const win = closedOrgWeekForIsoWeek(2026, w);
    const r = await computeArtifactsIndexedWeekly({ window: win, repoRoot: root, loadPreviousFingerprints: async () => prev });
    if (!r.ok) {
      out[w] = r.reason;
      prev = null;
      continue;
    }
    out[w] = r.value;
    prev = { week: win.id, fingerprints: r.basis.page_fingerprints, gitEndCommit: r.basis.git_end_commit ?? null };
  }
  return out;
}

describe('git: first week (no previous row) reads both ends first-parent from origin/main', { timeout: 60_000 }, () => {
  it('W44: pages added in the window (not the running total, not the net change)', async () => {
    const r = await computeArtifactsIndexedWeekly({ window: W44, repoRoot: repo });
    expect(r).toMatchObject({
      ok: true,
      value: 4,
      basis: {
        method: 'git',
        start_source: 'git_first_parent',
        git_ref: 'origin/main',
        git_fetch_signal: 'reflog',
        pages_at_start: pagesExcl(4),
        pages_at_end: pagesExcl(7),
        pages_added: 4,
        pages_removed: 1,
        git_end_commit: ids.c4,
      },
    });
  });
  it('W43 and W45: boundary commits at 13:59:58 / 14:00:00 Berlin land in the right week', async () => {
    expect(await computeArtifactsIndexedWeekly({ window: W43, repoRoot: repo })).toMatchObject({ ok: true, value: 1 });
    expect(await computeArtifactsIndexedWeekly({ window: W45, repoRoot: repo })).toMatchObject({
      ok: true,
      value: 3,
      basis: { pages_at_start: pagesExcl(7), pages_at_end: pagesExcl(10) },
    });
  });
  it('shallow clone: trusted only when the cut-off predates the snapshot time', async () => {
    const shallow = newDir('div1-wiki-shallow-');
    rmSync(shallow, { recursive: true, force: true });
    // --depth=2 keeps c5 + c4; c4 (2026-10-29T12:59:59Z) is the cut-off: before W45 opens, inside W44.
    execFileSync('git', ['clone', '-q', '--depth=2', '--branch', 'main', `file://${up.replace(/\\/g, '/')}`, shallow], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    g(shallow, ['update-ref', '-d', 'refs/remotes/origin/main']);
    g(shallow, ['fetch', '-q', 'origin'], '2026-11-06T09:00:00Z'); // reflog: fetch entry at the current tip
    expect(await computeArtifactsIndexedWeekly({ window: W45, repoRoot: shallow })).toMatchObject({ ok: true, value: 3 });
    const w44 = await computeArtifactsIndexedWeekly({ window: W44, repoRoot: shallow });
    expect(w44.ok).toBe(false);
    if (!w44.ok) expect(w44.reason).toMatch(/shallow git history does not reach the snapshot time/);
  });
});

describe('git: previous row = start point, origin/main at the close = end (F1)', { timeout: 60_000 }, () => {
  it('133ea3be shape: W38 = 3 (the week the pages were made), W39 = 0, W40 = 0 (no double count)', async () => {
    const out = await chain(m133, [37, 38, 39, 40]);
    expect(out).toEqual({ 37: 0, 38: 3, 39: 0, 40: 0 });
  });
  it('the close snapshot must descend from last week\'s git_end_commit (no jump to a stale line)', async () => {
    const W38 = closedOrgWeekForIsoWeek(2026, 38);
    const prev = { week: '2026-W37', fingerprints: fps([1, 2, 3]), gitEndCommit: ids.l1! };
    const r = await computeArtifactsIndexedWeekly({ window: W38, repoRoot: m133, loadPreviousFingerprints: async () => prev });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/does not descend from last week's git_end_commit/);
    const ok = await computeArtifactsIndexedWeekly({
      window: closedOrgWeekForIsoWeek(2026, 40),
      repoRoot: m133,
      loadPreviousFingerprints: async () => ({ week: '2026-W39', fingerprints: fps([1, 2, 3, 4, 5, 6]), gitEndCommit: ids.g2! }),
    });
    expect(ok).toMatchObject({ ok: true, value: 0, basis: { start_source: 'previous_row' } });
  });
  it('W43 -> W44 -> W45 chain on the synthetic main: 1, 4, 3 (each page counted once)', async () => {
    expect(await chain(repo, [43, 44, 45])).toEqual({ 43: 1, 44: 4, 45: 3 });
  });
  it('a page already in last week\'s row is not counted again; a page missing from it is', async () => {
    const r = await computeArtifactsIndexedWeekly({
      window: W45,
      repoRoot: repo,
      loadPreviousFingerprints: async () => ({ week: '2026-W44', fingerprints: fps([2, 3, 4, 5, 6, 20, 7, 8]) }),
    });
    expect(r).toMatchObject({ ok: true, value: 2, basis: { start_source: 'previous_row', snapshot_baseline_week: '2026-W44' } });
  });
});

describe('git: stale or wrong-ref checkouts are NOT POSTED, never a silent 0 (F2)', { timeout: 60_000 }, () => {
  const prevW44 = { week: '2026-W44', fingerprints: fps([2, 3, 4, 5, 6, 20, 7]) };
  it('origin/main last fetched before the close -> NOT POSTED (even with a previous row)', async () => {
    const r = await computeArtifactsIndexedWeekly({ window: W44, repoRoot: stale, loadPreviousFingerprints: async () => prevW44 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/^git: origin\/main not fetched since the close 2026-10-29T13:00:00\.000Z/);
      expect(r.reason).toMatch(/last fetch 2026-10-28T10:00:00\.000Z/);
    }
  });
  // A host-URL origin without network: `ssh://git@synthetic.invalid/org/<name>.git`, served by a
  // fake ssh (core.sshCommand) that runs `git upload-pack` on bare repos under `srv`. Git writes
  // FETCH_HEAD for it exactly as for GitHub (`ssh://synthetic.invalid/org/<name>`).
  const SSH_ORIGIN = 'ssh://git@synthetic.invalid/org/dabos.git';
  const SSH_MIRROR = 'ssh://git@synthetic.invalid/org/mirror.git';
  let srv = '';
  let sshCmd = '';
  beforeAll(() => {
    srv = newDir('div1-wiki-srv-');
    const bare = (name: string) => {
      const d = path.join(srv, 'org', name);
      execFileSync('git', ['clone', '-q', '--bare', up, d], { stdio: ['ignore', 'pipe', 'pipe'] });
      return d;
    };
    bare('dabos.git');
    g(bare('mirror.git'), ['update-ref', 'refs/heads/main', ids.M!]); // a second repo whose main = M
    writeFileSync(
      path.join(srv, 'fake-ssh.cjs'),
      [
        "const { spawnSync } = require('child_process');",
        "const path = require('path');",
        'const [base, , cmd] = process.argv.slice(2);',
        "const m = /^git[ -]upload-pack '(\\/org\\/[a-z]+\\.git)'$/.exec(cmd || '');",
        "if (!m) { process.stderr.write('fake-ssh: refused\\n'); process.exit(1); }",
        "const r = spawnSync('git', ['upload-pack', path.join(base, m[1])], { stdio: 'inherit' });",
        'process.exit(r.status === null ? 1 : r.status);',
      ].join('\n')
    );
    const q = (s: string) => `"${s.replace(/\\/g, '/')}"`;
    sshCmd = `${q(process.execPath)} ${q(path.join(srv, 'fake-ssh.cjs'))} ${q(srv)}`;
  });
  /** Repo whose origin is the host URL SSH_ORIGIN, last fetched (reflog + FETCH_HEAD) at `fetchedAt`. */
  function sshCloneAt(fetchedAt: string, prefix: string) {
    const d = newDir(prefix);
    g(d, ['init', '-q']);
    g(d, ['config', 'core.sshCommand', sshCmd]);
    g(d, ['config', 'ssh.variant', 'simple']);
    g(d, ['remote', 'add', 'origin', SSH_ORIGIN]);
    g(d, ['fetch', '-q', 'origin'], fetchedAt);
    g(d, ['checkout', '-q', '-b', 'main', 'origin/main']); // a work tree like any clone
    utimesSync(path.join(d, '.git', 'FETCH_HEAD'), new Date(fetchedAt), new Date(fetchedAt));
    return d;
  }
  /**
   * origin/main last fetched 28 Oct at M (W44 mid-week); origin then gained c4 (+page 7) on 29 Oct,
   * so the truth for W44 (first week) is 4 and the stale M would give 3.
   */
  function staleAtM(prefix: string, host = false) {
    const copy = host ? sshCloneAt('2026-10-28T10:00:00Z', prefix) : cloneAt(up, '2026-10-28T10:00:00Z', prefix);
    g(copy, ['update-ref', '-d', 'refs/remotes/origin/main']);
    g(copy, ['update-ref', '-m', 'fetch: synthetic', 'refs/remotes/origin/main', ids.M!], '2026-10-28T10:00:00Z');
    rmSync(path.join(copy, '.git', 'FETCH_HEAD'), { force: true });
    return copy;
  }
  const afterClose = new Date('2026-10-29T13:10:00Z');
  const touch = (copy: string, d = afterClose) => utimesSync(path.join(copy, '.git', 'FETCH_HEAD'), d, d);
  const notFetched = async (copy: string) => {
    const r = await computeArtifactsIndexedWeekly({ window: W44, repoRoot: copy });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/^git: origin\/main not fetched since the close/);
  };

  it('host origin: FETCH_HEAD written at/after the close and naming the origin/main commit counts as a fetch', async () => {
    const copy = sshCloneAt('2026-10-28T10:00:00Z', 'div1-wiki-fh-');
    g(copy, ['fetch', '-q', 'origin']); // nothing moved: no new reflog entry, FETCH_HEAD rewritten
    touch(copy, new Date('2026-11-05T13:10:00Z'));
    expect(await computeArtifactsIndexedWeekly({ window: W45, repoRoot: copy })).toMatchObject({
      ok: true,
      value: 3,
      basis: { git_fetch_signal: 'FETCH_HEAD', git_fetched_at: '2026-11-05T13:10:00.000Z' },
    });
    // A FETCH_HEAD line from origin's URL for branch main, but not naming the current origin/main
    // commit, is not a fetch of that commit (only the sha differs from the real line).
    const fh = path.join(copy, '.git', 'FETCH_HEAD');
    const real = readFileSync(fh, 'utf8').split('\n').find((l) => l.includes("branch 'main' of "))!;
    writeFileSync(fh, `${'0'.repeat(40)}${real.slice(40)}\n`);
    touch(copy, new Date('2026-11-05T13:10:00Z'));
    expect((await computeArtifactsIndexedWeekly({ window: W45, repoRoot: copy })).ok).toBe(false);
  });
  it('a second host remote holding the same commit, fetched after the close, is not a fetch of origin -> NOT POSTED', async () => {
    const copy = staleAtM('div1-wiki-2nd-', true);
    g(copy, ['remote', 'add', 'backup', SSH_MIRROR]);
    g(copy, ['fetch', '-q', 'backup']);
    touch(copy);
    await notFetched(copy); // (counted, it would post 3 instead of 4: page 7 is missing)
  });
  it('another branch of origin at the same commit, fetched after the close, is not a fetch of main -> NOT POSTED', async () => {
    const copy = staleAtM('div1-wiki-otherbranch-', true);
    g(copy, ['fetch', '-q', 'origin', 'frozen']);
    touch(copy);
    await notFetched(copy);
  });
  it('a relative directory named like the host URL is a local path, never origin -> NOT POSTED', async () => {
    const copy = staleAtM('div1-wiki-reldir-', true);
    const rel = path.join(copy, 'synthetic.invalid', 'org', 'dabos');
    execFileSync('git', ['clone', '-q', up, rel], { stdio: ['ignore', 'pipe', 'pipe'] });
    g(rel, ['reset', '-q', '--hard', ids.M!]);
    g(copy, ['fetch', '-q', 'synthetic.invalid/org/dabos', 'main']); // FETCH_HEAD: "... of synthetic.invalid/org/dabos"
    touch(copy);
    await notFetched(copy);
  });
  it('local-path origin: FETCH_HEAD is never trusted (`/x/dabos.git` vs `/x/dabos`, or even origin itself)', async () => {
    const local = newDir('div1-wiki-local-');
    const bareRepo = path.join(local, 'dabos.git');
    execFileSync('git', ['clone', '-q', '--bare', up, bareRepo], { stdio: ['ignore', 'pipe', 'pipe'] });
    g(bareRepo, ['update-ref', 'refs/heads/main', ids.M!]);
    const other = path.join(local, 'dabos'); // a different repository, same main commit
    execFileSync('git', ['clone', '-q', up, other], { stdio: ['ignore', 'pipe', 'pipe'] });
    g(other, ['reset', '-q', '--hard', ids.M!]);
    const copy = cloneAt(bareRepo, '2026-10-28T10:00:00Z', 'div1-wiki-localorigin-');
    g(copy, ['fetch', '-q', other, 'main']); // FETCH_HEAD: "branch 'main' of <local>/dabos" (git drops .git)
    touch(copy);
    await notFetched(copy);
    g(copy, ['fetch', '-q', 'origin']); // origin itself, nothing moved: still only the 28 Oct reflog entry
    touch(copy);
    await notFetched(copy);
  });
  it('update-ref of origin/main after the close is not a fetch -> NOT POSTED (no page that is not on origin)', async () => {
    const copy = staleAtM('div1-wiki-updref-');
    g(copy, ['checkout', '-q', '--detach', ids.M!]);
    const local = commit(copy, [1, 2, 3, 4, 5, 6, 20, 99], '2026-10-27T10:00:00Z'); // page 99 never on origin
    g(copy, ['update-ref', 'refs/remotes/origin/main', local], '2026-10-29T13:10:00Z');
    await notFetched(copy);
    // Even after a real fetch after the close, a later update-ref leaves the fetch entry stale.
    const copy2 = staleAtM('div1-wiki-updref2-');
    g(copy2, ['fetch', '-q', 'origin'], '2026-10-29T13:05:00Z'); // M -> c5, a real fetch after the close
    g(copy2, ['checkout', '-q', '--detach', ids.M!]);
    const local2 = commit(copy2, [1, 2, 3, 4, 5, 6, 20, 99], '2026-10-27T10:00:00Z');
    g(copy2, ['update-ref', '-m', 'manual', 'refs/remotes/origin/main', local2], '2026-10-29T13:10:00Z');
    await notFetched(copy2);
  });
  it('remote rename origin -> o2 -> origin after the close is not a fetch; a real fetch then counts correctly', async () => {
    const copy = staleAtM('div1-wiki-rename-');
    g(copy, ['remote', 'rename', 'origin', 'o2'], '2026-10-29T13:10:00Z');
    g(copy, ['remote', 'rename', 'o2', 'origin'], '2026-10-29T13:11:00Z');
    await notFetched(copy); // (counted, it would post the stale 3 instead of 4)
    g(copy, ['fetch', '-q', 'origin'], '2026-10-29T13:20:00Z');
    expect(await computeArtifactsIndexedWeekly({ window: W44, repoRoot: copy })).toMatchObject({
      ok: true,
      value: 4,
      basis: { git_fetch_signal: 'reflog', git_fetched_at: '2026-10-29T13:20:00.000Z' },
    });
  });
  it('a fetch at exactly the close (same ms) counts: at or after the close', async () => {
    const copy = staleAtM('div1-wiki-exact-');
    g(copy, ['fetch', '-q', 'origin'], '2026-10-29T13:00:00Z');
    expect(await computeArtifactsIndexedWeekly({ window: W44, repoRoot: copy })).toMatchObject({
      ok: true,
      value: 4,
      basis: { git_fetched_at: W44.end.toISOString() },
    });
  });
  it('remote URLs keep their class (host URL vs local path); scheme, user-info, .git, trailing / dropped for hosts', () => {
    const gh = normaliseRemoteUrl('https://user:synthetic-token@GitHub.com/Example-Org/example-repo.git/');
    expect(gh).toBe('url:github.com/Example-Org/example-repo');
    expect(normaliseRemoteUrl('git@github.com:Example-Org/example-repo.git')).toBe(gh);
    expect(normaliseRemoteUrl('ssh://git@github.com/Example-Org/example-repo')).toBe(gh);
    expect(normaliseRemoteUrl('https://github.com/Example-Org/other-repo')).not.toBe(gh);
    expect(normaliseRemoteUrl('github.com/Example-Org/example-repo')).not.toBe(gh); // relative directory
    expect(normaliseRemoteUrl('./github.com/Example-Org/example-repo')).not.toBe(gh);
    expect(normaliseRemoteUrl('file://github.com/Example-Org/example-repo')).not.toBe(gh);
    expect(normaliseRemoteUrl('/srv/x/dabos.git')).not.toBe(normaliseRemoteUrl('/srv/x/dabos'));
    expect(normaliseRemoteUrl('C:\\Dev\\Synthetic\\Repo')).toBe(normaliseRemoteUrl('file:///c:/dev/synthetic/repo/'));
    expect(isLocalRemote(normaliseRemoteUrl('C:\\Dev\\Synthetic\\Repo'))).toBe(true);
    expect(isLocalRemote(normaliseRemoteUrl('../up'))).toBe(true);
    expect(isLocalRemote(gh)).toBe(false);
    expect(gh).not.toMatch(/token|user/);
  });  it('HEAD or a local branch is never counted; the default is origin/main, not the checkout', async () => {
    for (const ref of ['HEAD', 'main']) {
      const r = await computeArtifactsIndexedWeekly({ window: W45, repoRoot: repo, gitRef: ref });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/is not a remote-tracking ref/);
    }
    g(repo, ['checkout', '-q', '-b', 'feature']);
    commit(repo, [2, 3, 4, 5, 6, 20, 7, 8, 9, 10, 77], '2026-11-02T10:00:00Z');
    try {
      expect(await computeArtifactsIndexedWeekly({ window: W45, repoRoot: repo })).toMatchObject({ ok: true, value: 3 });
    } finally {
      g(repo, ['checkout', '-q', 'main']);
    }
  });
});

describe('snapshot (no git work tree, or DABOS_WIKI_SOURCE=snapshot)', { timeout: 60_000 }, () => {
  const baseline = { week: '2026-W44', fingerprints: fps([2, 3, 4, 5, 6, 20, 7]) };
  const stamp = (dir: string, d: Date) => utimesSync(path.join(dir, 'docs', 'wiki', 'index.md'), d, d);
  it('uses the previous week Div1 fingerprints as the start', async () => {
    stamp(plain, new Date('2026-11-02T09:00:00Z'));
    const r = await computeArtifactsIndexedWeekly({ window: W45, repoRoot: plain, loadPreviousFingerprints: async () => baseline });
    expect(r).toMatchObject({
      ok: true,
      value: 3,
      basis: { method: 'snapshot', snapshot_baseline_week: '2026-W44', pages_at_start: 8, pages_at_end: 11 },
    });
  });
  it('a git work tree only uses its working copy when snapshot is requested explicitly', async () => {
    stamp(stale, new Date('2026-10-28T10:00:00Z'));
    const r = await computeArtifactsIndexedWeekly({
      window: W44,
      repoRoot: stale,
      source: 'snapshot',
      loadPreviousFingerprints: async () => ({ week: '2026-W43', fingerprints: fps([1, 2, 3]) }),
    });
    expect(r).toMatchObject({ ok: true, value: 1, basis: { method: 'snapshot' } });
  });
  it('refuses a file modified at or after the close (cannot attribute the week)', async () => {
    stamp(plain, W45.end);
    const r = await computeArtifactsIndexedWeekly({ window: W45, repoRoot: plain, loadPreviousFingerprints: async () => baseline });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/at or after the close/);
  });
  it('no baseline row -> NOT POSTED with a reason, never 0', async () => {
    const r = await computeArtifactsIndexedWeekly({ window: W45, repoRoot: plain, loadPreviousFingerprints: async () => null });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.reason).toMatch(/no previous-week Div1 baseline/);
  });
  it('missing index -> NOT POSTED', async () => {
    const r = await computeArtifactsIndexedWeekly({ window: W45, repoRoot: path.join(plain, 'nope') });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.reason).toMatch(/wiki index missing/);
  });
});

type StatRow = { ws: string; recordedAt: string; superseded: boolean; recordedBy: string; basis: unknown };

/**
 * Tagged-template fake: records stats inserts and answers the previous-week Div1 lookup from
 * `rows`, applying only the predicates the query actually has (superseded_at / recorded_by).
 */
function fakeSql(rows: StatRow[] = []) {
  const inserts: Array<{ ws: unknown; div: unknown; dept: unknown; metric: unknown; value: unknown; basis: unknown }> = [];
  const lookups: unknown[][] = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const q = strings.join('?');
    if (q.includes('insert into stats')) {
      const [ws, div, dept, metric, value, , basis] = values;
      inserts.push({ ws, div, dept, metric, value, basis });
      return Promise.resolve([{ metric_key: metric }]);
    }
    if (q.includes('select basis from stats')) {
      lookups.push(values);
      const hit = rows
        .filter((r) => r.ws === values[0])
        .filter((r) => !/superseded_at\s+is\s+null/i.test(q) || !r.superseded)
        .filter((r) => !/recorded_by/i.test(q) || r.recordedBy === 'week-close-poster')
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
      return Promise.resolve(hit.slice(0, 1).map((r) => ({ basis: r.basis })));
    }
    throw new Error(`unexpected query: ${q}`);
  }) as unknown as DabosSql;
  return { sql, inserts, lookups };
}

describe('postDivisionWeeklyStats emits the Div1 row', { timeout: 60_000 }, () => {
  it('W44 from git: one Div1 artifacts_indexed row = pages added, no page names in notes/basis', async () => {
    const { sql, inserts } = fakeSql();
    const res = await postDivisionWeeklyStats({ dabosSql: sql, window: W44, dabosRepoRoot: repo, only: ['Div1'] });
    expect(res.workspaceId).toBe('div-live-2026-W44');
    expect(res.inserted).toEqual(['Div1.artifacts_indexed']);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ ws: 'div-live-2026-W44', div: 'Div1', dept: null, metric: 'artifacts_indexed', value: 4 });
    const basis = JSON.parse(String(inserts[0]!.basis)) as Record<string, unknown>;
    expect(basis).toMatchObject({ method: 'git', pages_added: 4, org_week_end: '2026-10-29T13:00:00.000Z' });
    expect(res.notes.some((n) => n.startsWith('Div1 artifacts_indexed=4 '))).toBe(true);
    expect(JSON.stringify({ notes: res.notes, inserts })).not.toMatch(/synthetic-page/i);
  });
  it('--only filters the inserts: only=[Div2] never writes the Div1 row even when Div1 computed', async () => {
    const { sql, inserts } = fakeSql();
    const res = await postDivisionWeeklyStats({ dabosSql: sql, window: W44, dabosRepoRoot: repo, only: ['Div2'] });
    expect(res.notes.some((n) => n.startsWith('Div1 artifacts_indexed=4 '))).toBe(true);
    expect(inserts.filter((i) => i.div === 'Div1')).toHaveLength(0);
    expect(inserts.every((i) => i.div === 'Div2')).toBe(true);
  });
  it('start point = the ACTIVE previous row (superseded rows ignored; a backfill row by another recorder counts)', async () => {
    const W44ws = 'div-live-2026-W44';
    const rows: StatRow[] = [
      // Newer but superseded: would make W45 = 0.
      { ws: W44ws, recordedAt: '2026-10-30T09:00:00Z', superseded: true, recordedBy: 'week-close-poster', basis: { page_fingerprints: fps([2, 3, 4, 5, 6, 20, 7, 8, 9, 10]) } },
      // Active backfill row (e.g. #49), department NULL, other recorded_by: W45 = 4 (7, 8, 9, 10).
      { ws: W44ws, recordedAt: '2026-10-29T12:59:59.999Z', superseded: false, recordedBy: 'div1-backfill', basis: JSON.stringify({ page_fingerprints: fps([2, 3, 4, 5, 6, 20]) }) },
    ];
    const { sql, inserts, lookups } = fakeSql(rows);
    const res = await postDivisionWeeklyStats({ dabosSql: sql, window: W45, dabosRepoRoot: repo, only: ['Div1'] });
    expect(lookups[0]).toEqual([W44ws]);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ ws: 'div-live-2026-W45', div: 'Div1', dept: null, value: 4 });
    expect(JSON.parse(String(inserts[0]!.basis))).toMatchObject({ start_source: 'previous_row', snapshot_baseline_week: '2026-W44' });
    expect(res.notes.some((n) => n.startsWith('Div1 artifacts_indexed=4 '))).toBe(true);
  });
  it('a previous row with malformed fingerprints -> NOT POSTED (not "every page added")', async () => {
    const rows: StatRow[] = [
      { ws: 'div-live-2026-W44', recordedAt: '2026-10-29T12:59:59.999Z', superseded: false, recordedBy: 'x', basis: { page_fingerprints: ['entities/a.md'] } },
    ];
    const { sql, inserts } = fakeSql(rows);
    const res = await postDivisionWeeklyStats({ dabosSql: sql, window: W45, dabosRepoRoot: repo, only: ['Div1'] });
    expect(inserts).toHaveLength(0);
    expect(res.notes.some((n) => n.startsWith('Div1 artifacts_indexed NOT POSTED - previous-week Div1 row lookup failed'))).toBe(true);
  });
  it('W45 on a mirror without git: uses the W44 Div1 row baseline', async () => {
    utimesSync(path.join(plain, 'docs', 'wiki', 'index.md'), new Date('2026-11-02T09:00:00Z'), new Date('2026-11-02T09:00:00Z'));
    const rows: StatRow[] = [
      { ws: 'div-live-2026-W44', recordedAt: '2026-10-29T12:59:59.999Z', superseded: false, recordedBy: 'week-close-poster', basis: JSON.stringify({ page_fingerprints: fps([2, 3, 4, 5, 6, 20, 7]) }) },
    ];
    const { sql, inserts } = fakeSql(rows);
    const res = await postDivisionWeeklyStats({ dabosSql: sql, window: W45, dabosRepoRoot: plain, only: ['Div1'] });
    expect(res.notes.some((n) => n.startsWith('Div1 artifacts_indexed=3 ') && n.includes('method snapshot'))).toBe(true);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ ws: 'div-live-2026-W45', div: 'Div1', value: 3 });
  });
  it('no source -> no Div1 row and a visible NOT POSTED note (never a silent 0)', async () => {
    const { sql, inserts } = fakeSql();
    const res = await postDivisionWeeklyStats({ dabosSql: sql, window: W45, dabosRepoRoot: plain, only: ['Div1'] });
    expect(inserts).toHaveLength(0);
    expect(res.notes.some((n) => n.startsWith('Div1 artifacts_indexed NOT POSTED - '))).toBe(true);
  });
});
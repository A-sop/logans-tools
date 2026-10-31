import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, utimesSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  computeArtifactsIndexedWeekly,
  gitBeforeArg,
  pageFingerprint,
  pagesAddedBetween,
  wikiPageFingerprints,
  wikiPageTargets,
} from '@/lib/dabos/artifacts-indexed';
import type { DabosSql } from '@/lib/dabos/dabos-connection';
import { postDivisionWeeklyStats } from '@/lib/dabos/division-weekly-stats';
import { closedOrgWeek } from '@/lib/dabos/org-week';

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
  it('fingerprints are 16 hex chars and never the page name', () => {
    const fps = wikiPageFingerprints(indexText([1, 2]));
    expect(fps).toHaveLength(3); // 2 pages + SCHEMA.md
    for (const f of fps) expect(f).toMatch(/^[0-9a-f]{16}$/);
    expect(fps).toContain(pageFingerprint(`entities/${page(1)}.md`));
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
// Synthetic git repo. Main (first-parent) history, committer time = when it landed on main:
//  c1 2026-10-15T08:00:00Z (10:00 Berlin, before W43 opens)  pages 1,2,3
//  c2 2026-10-22T11:59:58Z (13:59:58 Berlin, end of W43) +4                  -> 1,2,3,4
//  side branch from c2: s1 dated 2026-10-22T11:59:59Z (W43's last second, the newest commit before\n//  W44 opens) adds 20, but only lands on main in W44 via merge M: first-parent counts it in W44
//  c3 2026-10-22T12:00:00Z (14:00:00 Berlin, first second of W44) +5,+6 (+ a duplicate link to 5)
//  M  2026-10-26T10:00:00Z merge of side: +20
//  c4 2026-10-29T12:59:59Z (13:59:59 CET, last second of W44) +7, -1
//  c5 2026-10-29T13:00:00Z (14:00:00 CET, first second of W45) +8,+9,+10
// W43: 3 -> 4 pages, 1 added.  W44: 4 -> 7 pages, 4 added (5,6,20,7), 1 removed.  W45: 7 -> 10, 3 added.
// ---------------------------------------------------------------------------------------------
let repo = '';
let plain = '';

function g(args: string[], when?: string) {
  const env = { ...process.env };
  if (when) {
    env.GIT_AUTHOR_DATE = when;
    env.GIT_COMMITTER_DATE = when;
  }
  return execFileSync(
    'git',
    ['-c', 'user.name=Synthetic Test', '-c', 'user.email=test@example.invalid', '-c', 'core.autocrlf=false', '-C', repo, ...args],
    { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] }
  );
}
function writeIndex(dir: string, pages: number[], extra: string[] = []) {
  mkdirSync(path.join(dir, 'docs', 'wiki'), { recursive: true });
  writeFileSync(path.join(dir, 'docs', 'wiki', 'index.md'), indexText(pages, extra));
}
function commit(pages: number[], when: string, extra: string[] = []) {
  writeIndex(repo, pages, extra);
  g(['add', '-A']);
  g(['commit', '-q', '-m', `synthetic ${when}`], when);
}

beforeAll(() => {
  repo = mkdtempSync(path.join(tmpdir(), 'div1-wiki-git-'));
  g(['init', '-q', '-b', 'main']);
  commit([1, 2, 3], '2026-10-15T08:00:00Z');
  commit([1, 2, 3, 4], '2026-10-22T11:59:58Z');
  g(['checkout', '-q', '-b', 'side']);
  commit([1, 2, 3, 4, 20], '2026-10-22T11:59:59Z');
  g(['checkout', '-q', 'main']);
  const dupOf5 = [`| [Page 5 again](./ENTITIES/${page(5)}.md/) | entity | duplicate link |`];
  commit([1, 2, 3, 4, 5, 6], '2026-10-22T12:00:00Z', dupOf5);
  g(['merge', '-q', '--no-ff', '--no-commit', '-s', 'ours', 'side'], '2026-10-26T10:00:00Z');
  writeIndex(repo, [1, 2, 3, 4, 5, 6, 20], dupOf5);
  g(['add', '-A']);
  g(['commit', '-q', '-m', 'synthetic merge side'], '2026-10-26T10:00:00Z');
  commit([2, 3, 4, 5, 6, 20, 7], '2026-10-29T12:59:59Z', dupOf5);
  commit([2, 3, 4, 5, 6, 20, 7, 8, 9, 10], '2026-10-29T13:00:00Z', dupOf5);

  plain = mkdtempSync(path.join(tmpdir(), 'div1-wiki-plain-'));
  writeIndex(plain, [2, 3, 4, 5, 6, 20, 7, 8, 9, 10]);
}, 60_000);

afterAll(() => {
  for (const d of [repo, plain]) if (d) rmSync(d, { recursive: true, force: true });
});

const pagesExcl = (n: number) => n + 1; // + SCHEMA.md, which every synthetic index links

describe('computeArtifactsIndexedWeekly from git history', { timeout: 30_000 }, () => {
  it('W44: pages added in the window (not the running total, not the net change)', async () => {
    const r = await computeArtifactsIndexedWeekly({ window: W44, repoRoot: repo });
    expect(r).toMatchObject({
      ok: true,
      value: 4,
      basis: {
        method: 'git',
        pages_at_start: pagesExcl(4),
        pages_at_end: pagesExcl(7),
        pages_added: 4,
        pages_removed: 1,
      },
    });
  });
  it('W43 and W45: boundary commits at 13:59:59 / 14:00:00 Berlin land in the right week', async () => {
    expect(await computeArtifactsIndexedWeekly({ window: W43, repoRoot: repo })).toMatchObject({
      ok: true,
      value: 1, // page 4 at 13:59:58; the side commit dated 13:59:59 only landed on main in W44
    });
    expect(await computeArtifactsIndexedWeekly({ window: W45, repoRoot: repo })).toMatchObject({
      ok: true,
      value: 3,
      basis: { pages_at_start: pagesExcl(7), pages_at_end: pagesExcl(10) },
    });
  });
  it('end fingerprints are the start baseline of the next week', async () => {
    const w44 = await computeArtifactsIndexedWeekly({ window: W44, repoRoot: repo });
    const w45 = await computeArtifactsIndexedWeekly({ window: W45, repoRoot: repo });
    if (!w44.ok || !w45.ok) throw new Error('expected ok');
    expect(pagesAddedBetween(w44.basis.page_fingerprints, w45.basis.page_fingerprints).added).toBe(3);
  });
  it('shallow clone: trusted only when the cut-off predates the window start', async () => {
    const shallow = mkdtempSync(path.join(tmpdir(), 'div1-wiki-shallow-'));
    try {
      // --depth=2 keeps c5 + c4; c4 (2026-10-29T12:59:59Z) is the cut-off: before W45 opens, inside W44.
      execFileSync('git', ['clone', '-q', '--depth=2', '--branch', 'main', `file://${repo.replace(/\\/g, '/')}`, shallow], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      expect(await computeArtifactsIndexedWeekly({ window: W45, repoRoot: shallow })).toMatchObject({ ok: true, value: 3 });
      const w44 = await computeArtifactsIndexedWeekly({ window: W44, repoRoot: shallow });
      expect(w44.ok).toBe(false);
      if (!w44.ok) expect(w44.reason).toMatch(/shallow git history does not reach the window start/);
    } finally {
      rmSync(shallow, { recursive: true, force: true });
    }
  });
  it('stale git (working-tree index differs from HEAD) is not trusted: no silent 0', async () => {
    writeIndex(repo, [2, 3, 4, 99]);
    try {
      const r = await computeArtifactsIndexedWeekly({ window: W45, repoRoot: repo });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toMatch(/differs from HEAD/);
        expect(r.reason).toMatch(/no previous-week Div1 baseline/);
      }
    } finally {
      g(['checkout', '-q', '--', 'docs/wiki/index.md']);
    }
  });
});

describe('computeArtifactsIndexedWeekly without git (ln02 mirror)', { timeout: 30_000 }, () => {
  const baseline = { week: '2026-W44', fingerprints: wikiPageFingerprints(indexText([2, 3, 4, 5, 6, 20, 7])) };
  it('uses the previous week Div1 fingerprints as the start', async () => {
    utimesSync(path.join(plain, 'docs', 'wiki', 'index.md'), new Date('2026-11-02T09:00:00Z'), new Date('2026-11-02T09:00:00Z'));
    const r = await computeArtifactsIndexedWeekly({
      window: W45,
      repoRoot: plain,
      loadPreviousFingerprints: async () => baseline,
    });
    expect(r).toMatchObject({
      ok: true,
      value: 3,
      basis: { method: 'snapshot', snapshot_baseline_week: '2026-W44', pages_at_start: 8, pages_at_end: 11 },
    });
  });
  it('refuses a file modified at or after the close (cannot attribute the week)', async () => {
    utimesSync(path.join(plain, 'docs', 'wiki', 'index.md'), W45.end, W45.end);
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

/** Tagged-template fake: records stats inserts; previous-week Div1 lookup returns `prevBasis`. */
function fakeSql(prevBasis: unknown = null) {
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
      return Promise.resolve(prevBasis ? [{ basis: prevBasis }] : []);
    }
    throw new Error(`unexpected query: ${q}`);
  }) as unknown as DabosSql;
  return { sql, inserts, lookups };
}

describe('postDivisionWeeklyStats emits the Div1 row', { timeout: 30_000 }, () => {
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
    const text = JSON.stringify({ notes: res.notes, inserts });
    expect(text).not.toMatch(/synthetic-page/i);
  });
  it('W45 on a mirror without git: uses the W44 Div1 row baseline', async () => {
    utimesSync(path.join(plain, 'docs', 'wiki', 'index.md'), new Date('2026-11-02T09:00:00Z'), new Date('2026-11-02T09:00:00Z'));
    const prev = { page_fingerprints: wikiPageFingerprints(indexText([2, 3, 4, 5, 6, 20, 7])) };
    const { sql, inserts, lookups } = fakeSql(JSON.stringify(prev));
    const res = await postDivisionWeeklyStats({ dabosSql: sql, window: W45, dabosRepoRoot: plain, only: ['Div1'] });
    expect(lookups[0]).toEqual(['div-live-2026-W44']);
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
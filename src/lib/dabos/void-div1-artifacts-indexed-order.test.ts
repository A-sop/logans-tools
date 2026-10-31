// @vitest-environment node
import fs from 'fs';
import path from 'path';

import { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it } from 'vitest';

import { createDabosTestDb, readRepoFile } from '@/test/pglite-dabos';

/**
 * Order check for 2026-10-31_void_div1_artifacts_indexed_w24_w28_w30.sql (Dept14 ruling 31 Oct
 * 2026 17:45 Berlin) against the other div-live corrections:
 *   #49 2026-10-31_backfill_div1_artifacts_indexed_w31_w44.sql (applied 31 Oct 17:30-17:32)
 *   #51 2026-10-31_supersede_div_live_w31_w43.sql (applied)
 *   #53 2026-10-31_repost_div_live_w44_and_w30_close.sql (applied)
 *   #54 2026-10-31_post_div5_qa_pass_rate_w44.sql (not applied)
 * Seeded with a copy of current prod: every div-live-* stats row plus the 5 workspace-less Div1
 * rows (read-only SELECT on DABOS Neon, Sat 31 Oct 2026 17:42-17:46 CET; 89 rows, 47 active; the
 * digests below are what prod returned and the seeded copy must reproduce them). Part A applies this
 * script and #54 in both orders. Part B rebuilds the 15:40 state (before #49/#51/#53) from the same
 * copy, checks it against #53's snapshot digest, and runs all 24 orders of the four PRs with this
 * script at every position after #53. Runs only when the needed SQL files are on the branch. Nothing
 * here connects to any network database.
 */
const FILES = {
  pr49: 'scripts/dabos/sql/2026-10-31_backfill_div1_artifacts_indexed_w31_w44.sql',
  pr51: 'scripts/dabos/sql/2026-10-31_supersede_div_live_w31_w43.sql',
  w44w30: 'scripts/dabos/sql/2026-10-31_repost_div_live_w44_and_w30_close.sql',
  div5w44: 'scripts/dabos/sql/2026-10-31_post_div5_qa_pass_rate_w44.sql',
  void: 'scripts/dabos/sql/2026-10-31_void_div1_artifacts_indexed_w24_w28_w30.sql',
} as const;
type Key = keyof typeof FILES;
const repoRoot = path.resolve(__dirname, '../../..');
const present = (keys: Key[]) => keys.every((k) => fs.existsSync(path.join(repoRoot, FILES[k])));
const sqlOf = (k: Key) => readRepoFile(FILES[k]);

const FIXTURE = path.join(__dirname, 'void-div1-artifacts-indexed-order.prod-snapshot.json');
// [id, workspace, division, department, metric, value, recorded_at, basis, recorded_by, superseded_at, reason]
type Snap = [
  string,
  string | null,
  string,
  string | null,
  string,
  string,
  string,
  object | null,
  string | null,
  string | null,
  string | null,
];
const SNAPSHOT = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Snap[];

const digestSql = (
  where: string
) => `SELECT md5(string_agg(concat_ws('|', id, coalesce(workspace_id,'-'), division_id,
    coalesce(department_id,'-'), metric_key, value::text,
    to_char(recorded_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS'), coalesce(basis::text,'-'),
    coalesce(recorded_by,'-'), coalesce(to_char(superseded_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS'),'-'),
    coalesce(superseded_reason,'-')), E'\\n' ORDER BY id)) AS digest FROM stats WHERE ${where}`;
/** Prod digests, 31 Oct 17:42-17:46 CET. div-live alone is #53's DIGEST_SQL format. */
const PROD_DIV_LIVE_MD5 = '43306b6ceff551e7cd4d1eca35a7eba7';
const PROD_ALL_MD5 = '10b6c3cee88e3263f6667549dd9d2322';
/** #53's 15:40 snapshot digest (div-live rows before #49/#51/#53). */
const MD5_1540 = '3ec6ced03789e4d46213a54533705ac6';
const R38 = 'Dept13 FAIL 2026-10-29: ln02 poster @2474654 (ISO window, all-time qa)';
const TAGS_49_51_53 = [
  '2026-10-31_backfill_div1_artifacts_indexed_w31_w44',
  '2026-10-31_supersede_div_live_w31_w43',
  '2026-10-31_repost_div_live_w44_and_w30_close',
];

async function seed(db: PGlite) {
  await db.query(
    `INSERT INTO divisions (id, operational_name) VALUES ('Div1','x'), ('Div2','x'), ('Div3','x'), ('Div4','x'), ('Div5','x'), ('Div6','x'), ('Div7','x')`
  );
  await db.query(
    `INSERT INTO departments (id, division_id, legacy_name, operational_name) VALUES
       ('Dept3','Div1','x','x'), ('Dept4','Div2','x','x'), ('Dept12','Div4','x','x')`
  );
  for (const [id, ws, div, dept, metric, value, at, basis, by, supAt, reason] of SNAPSHOT) {
    await db.query(
      `INSERT INTO stats (id, workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by, superseded_at, superseded_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        ws,
        div,
        dept,
        metric,
        value,
        at,
        basis === null ? null : JSON.stringify(basis),
        by,
        supAt,
        reason,
      ]
    );
  }
}

/** Back to 15:40: drop #49/#51/#53's rows and clear every supersede except #38's. */
async function rewindTo1540(db: PGlite) {
  await db.query(`DELETE FROM stats WHERE basis->>'correction' = ANY($1)`, [TAGS_49_51_53]);
  await db.query(
    `UPDATE stats SET superseded_at = NULL, superseded_reason = NULL
      WHERE superseded_at IS NOT NULL AND superseded_reason <> $1`,
    [R38]
  );
}

async function run(db: PGlite, sql: string): Promise<void> {
  try {
    await db.exec(sql);
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}

async function counts(db: PGlite) {
  const r = await db.query<{ total: number; active: number }>(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE superseded_at IS NULL)::int AS active FROM stats`
  );
  return r.rows[0]!;
}
const digest = async (db: PGlite, where: string) =>
  (await db.query<{ digest: string }>(digestSql(where))).rows[0]!.digest;
/** Every column of every row (for no-op re-runs). */
const allRows = async (db: PGlite) => (await db.query(`SELECT * FROM stats ORDER BY id`)).rows;

/** Order-independent picture of the table (as #53's order test): new ids and supersede times are not stable. */
async function picture(db: PGlite): Promise<string[]> {
  const r = await db.query<{ row: string }>(
    `SELECT concat_ws(' | ', coalesce(workspace_id, '(none)'), division_id, coalesce(department_id, '-'), metric_key, value::text,
              to_char(recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), coalesce(basis::text, '-'),
              coalesce(recorded_by, '-'), CASE WHEN superseded_at IS NULL THEN 'active' ELSE 'superseded' END,
              coalesce(superseded_reason, '-')) AS row
       FROM stats ORDER BY 1`
  );
  return r.rows.map((x) => x.row);
}

/** Keys with two active rows. GROUP BY treats NULL workspaces as one key (the 5 W24-W28 rows). */
async function doubleLiveKeys(db: PGlite, nullWorkspace: boolean): Promise<number> {
  const dup = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM (
       SELECT workspace_id, division_id, department_id, metric_key FROM stats
        WHERE superseded_at IS NULL AND (${nullWorkspace ? 'true' : 'workspace_id IS NOT NULL'})
        GROUP BY 1, 2, 3, 4 HAVING count(*) > 1) t`
  );
  return dup.rows[0]!.n;
}

/** Rows added / net active change of each script (supersede is in place: no row added). */
const DELTA: Record<Key, { total: number; active: number }> = {
  pr49: { total: 14, active: 14 },
  pr51: { total: 20, active: -10 },
  w44w30: { total: 6, active: 0 },
  div5w44: { total: 1, active: 1 },
  void: { total: 1, active: -6 }, // 7 superseded in place, 1 W30 repost
};
const END = { total: 91, active: 42 };

const permutations = <T>(xs: T[]): T[][] =>
  xs.length <= 1
    ? [xs]
    : xs.flatMap((x, i) =>
        permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])
      );

/** Applies keys in order, checking each delta and no double-live key outside the NULL workspace. */
async function applyAll(db: PGlite, order: Key[]) {
  let c = await counts(db);
  for (const k of order) {
    await run(db, sqlOf(k));
    const next = await counts(db);
    expect({ k, total: next.total - c.total, active: next.active - c.active }).toEqual({
      k,
      ...DELTA[k],
    });
    expect(await doubleLiveKeys(db, false)).toBe(0);
    c = next;
  }
  return c;
}

let referencePicture: string[] | null = null;
/** End picture of current prod -> this script -> #54. */
async function reference(): Promise<string[]> {
  if (referencePicture === null) {
    const db = await createDabosTestDb();
    await seed(db);
    await run(db, sqlOf('void'));
    await run(db, sqlOf('div5w44'));
    referencePicture = await picture(db);
    await db.close();
  }
  return referencePicture;
}

let db: PGlite | null = null;
const fresh = async () => {
  db = await createDabosTestDb();
  await seed(db);
  return db;
};
afterEach(async () => {
  await db?.close();
  db = null;
});

describe.skipIf(!present(['void', 'div5w44']))(
  'A: current prod -> this script and #54 in either order',
  { timeout: 120_000 },
  () => {
    it('the seed is the 89 prod rows (47 active), byte-for-byte, with the 5 workspace-less rows as one double-live key', async () => {
      const d = await fresh();
      expect(SNAPSHOT).toHaveLength(89);
      expect(await counts(d)).toEqual({ total: 89, active: 47 });
      expect(await digest(d, `workspace_id LIKE 'div-live-%'`)).toBe(PROD_DIV_LIVE_MD5);
      expect(await digest(d, `workspace_id LIKE 'div-live-%' OR workspace_id IS NULL`)).toBe(
        PROD_ALL_MD5
      );
      expect(await doubleLiveKeys(d, true)).toBe(1);
      expect(await doubleLiveKeys(d, false)).toBe(0);
    });

    for (const order of [
      ['void', 'div5w44'],
      ['div5w44', 'void'],
    ] as Key[][]) {
      it(`${order.join(' -> ')}: exact deltas, ${END.total}/${END.active}, the same end state, no double-live key, re-runs no-op`, async () => {
        const d = await fresh();
        expect(await applyAll(d, order)).toEqual(END);
        expect(await doubleLiveKeys(d, true)).toBe(0);
        expect(await picture(d)).toEqual(await reference());
        const once = await allRows(d);
        for (const k of order) await run(d, sqlOf(k));
        expect(await allRows(d)).toEqual(once);
        const div1 = await d.query<{ ws: string | null; v: string }>(
          `SELECT workspace_id AS ws, value::text AS v FROM stats
            WHERE division_id = 'Div1' AND metric_key = 'artifacts_indexed' AND superseded_at IS NULL
              AND (workspace_id IS NULL OR workspace_id <= 'div-live-2026-W30') ORDER BY 1`
        );
        expect(div1.rows).toEqual([{ ws: 'div-live-2026-W30', v: '0' }]);
      });
    }

    it('#53 run or re-run after this script aborts and changes nothing (its guards pin both W30 Div1 rows at 75)', async () => {
      if (!present(['w44w30'])) return;
      const d = await fresh();
      await run(d, sqlOf('void'));
      const before = await allRows(d);
      await expect(run(d, sqlOf('w44w30'))).rejects.toThrow(/guard 5d/);
      expect(await allRows(d)).toEqual(before);
    });
  }
);

const FOUR: Key[] = ['pr49', 'pr51', 'w44w30', 'div5w44'];
const RUNS: Key[][] = permutations(FOUR).flatMap((o) => {
  const at = o.indexOf('w44w30');
  return Array.from({ length: o.length - at }, (_, i) => [
    ...o.slice(0, at + 1 + i),
    'void' as Key,
    ...o.slice(at + 1 + i),
  ]);
});

describe.skipIf(!present([...FOUR, 'void']))(
  'B: from the 15:40 state, #49, #51, #53, #54 in any order with this script anywhere after #53',
  { timeout: 300_000 },
  () => {
    it('the rewound seed reproduces #53 snapshot digest (44 div-live rows, 38 active) plus the 5 workspace-less rows', async () => {
      const d = await fresh();
      await rewindTo1540(d);
      expect(await counts(d)).toEqual({ total: 49, active: 43 });
      expect(await digest(d, `workspace_id LIKE 'div-live-%'`)).toBe(MD5_1540);
    });

    it('covers 60 runs: 24 orders x every position after #53', () => {
      expect(RUNS).toHaveLength(60);
      expect(new Set(RUNS.map((o) => o.join())).size).toBe(60);
      for (const o of RUNS) expect(o.indexOf('void')).toBeGreaterThan(o.indexOf('w44w30'));
    });

    for (const order of RUNS) {
      it(`${order.join(' -> ')}: exact deltas, ${END.total}/${END.active}, the A end state, re-runs no-op`, async () => {
        const d = await fresh();
        await rewindTo1540(d);
        expect(await applyAll(d, order)).toEqual(END);
        expect(await doubleLiveKeys(d, true)).toBe(0);
        expect(await picture(d)).toEqual(await reference());
        const once = await allRows(d);
        for (const k of order) if (k !== 'w44w30') await run(d, sqlOf(k));
        expect(await allRows(d)).toEqual(once);
        // #53 re-run after this script aborts (guard 5d pins the W30 Div1 rows) and changes nothing.
        await expect(run(d, sqlOf('w44w30'))).rejects.toThrow(/guard 5d/);
        expect(await allRows(d)).toEqual(once);
      });
    }

    it('this script before #53 makes #53 abort unchanged (guard 1c), so it must follow #53', async () => {
      const d = await fresh();
      await rewindTo1540(d);
      await run(d, sqlOf('pr49'));
      await run(d, sqlOf('void'));
      const before = await allRows(d);
      await expect(run(d, sqlOf('w44w30'))).rejects.toThrow(/guard 1c/);
      expect(await allRows(d)).toEqual(before);
    });
  }
);

describe('Div1 void order check (file presence)', () => {
  it("this PR's SQL and the prod snapshot are present", () => {
    expect(present(['void'])).toBe(true);
    expect(SNAPSHOT).toHaveLength(89);
  });
});

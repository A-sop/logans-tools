// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { recordedAtForClosedOrgWeek, statWeekWindow } from '@/lib/dabos/org-week';
import { createDabosTestDb, readRepoFile } from '@/test/pglite-dabos';

/**
 * Guards of scripts/dabos/sql/2026-10-31_backfill_div1_artifacts_indexed_w31_w44.sql, on made-up
 * data in an in-process Postgres. The two W30 rows mirror DABOS Neon (read-only 2026-10-31);
 * nothing here connects to any network database.
 */
const SQL_PATH = 'scripts/dabos/sql/2026-10-31_backfill_div1_artifacts_indexed_w31_w44.sql';
const BACKFILL_SQL = readRepoFile(SQL_PATH);
const TAG = '2026-10-31_backfill_div1_artifacts_indexed_w31_w44';
const W30_IDS = ['dd2b66e2-1390-44b2-b2a4-d1829ff09400', '252780ef-4988-428a-ad3b-5eb6a6cf43db'];

/**
 * Weekly additions to DABOS docs/wiki/index.md (unique targets) at each Thu 14:00 Berlin close, on
 * DABOS main as published on GitHub (parent 2 at sync merges, never first-parent-only). Dept13 FAIL
 * v1: 2e1696fe (Fri 11 Sep 00:19 Berlin) added 3 pages in W38; sync merge 133ea3be (29 Sep) did not.
 */
const EXPECTED: Record<number, { value: number; before: number; after: number }> = {
  31: { value: 0, before: 218, after: 218 },
  32: { value: 9, before: 218, after: 227 },
  33: { value: 0, before: 227, after: 227 },
  34: { value: 2, before: 227, after: 229 },
  35: { value: 0, before: 229, after: 229 },
  36: { value: 0, before: 229, after: 229 },
  37: { value: 0, before: 229, after: 229 },
  38: { value: 3, before: 229, after: 232 },
  39: { value: 0, before: 232, after: 232 },
  40: { value: 0, before: 232, after: 232 },
  41: { value: 0, before: 232, after: 232 },
  42: { value: 0, before: 232, after: 232 },
  43: { value: 0, before: 232, after: 232 },
  44: { value: 60, before: 232, after: 292 },
};
const WEEKS = Object.keys(EXPECTED).map(Number);
const ws = (week: number) => `div-live-2026-W${week}`;

async function seed(db: PGlite, opts: { noDiv1?: boolean } = {}) {
  await db.query(
    `INSERT INTO divisions (id, operational_name) VALUES ${opts.noDiv1 ? '' : `('Div1', 'Div1'), `}('Div2', 'Div2')`
  );
  if (!opts.noDiv1) {
    await db.query(
      `INSERT INTO departments (id, division_id, legacy_name, operational_name) VALUES ('Dept3', 'Div1', 'x', 'x')`
    );
    // The two W30 rows on the old artifact-index.md basis (division row + Dept3 row). Must stay as is.
    for (const [id, dept] of [
      [W30_IDS[0], 'Dept3'],
      [W30_IDS[1], null],
    ] as const) {
      await db.query(
        `INSERT INTO stats (id, workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by)
         VALUES ($1, 'div-live-2026-W30', 'Div1', $2, 'artifacts_indexed', 75, '2026-07-26T21:59:59.999Z',
                 '{"note":"artifact-index.md counting basis"}'::jsonb, 'week-close-poster')`,
        [id, dept]
      );
    }
  }
  // Other divisions' rows in the same workspaces, and an old workspace-less Div1 row: never touched.
  await db.query(
    `INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at) VALUES
       ('div-live-2026-W31', 'Div2', 'leads_or_touchpoints_created', 4, '2026-08-02T21:59:59.999Z'),
       ('div-live-2026-W44', 'Div2', 'leads_or_touchpoints_created', 1, '2026-11-01T23:59:59.999Z')`
  );
  if (!opts.noDiv1) {
    await db.query(
      `INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at) VALUES
         (NULL, 'Div1', 'artifacts_indexed', 393, '2026-07-09T12:00:00.000Z')`
    );
  }
}

/** Run like `psql -v ON_ERROR_STOP=1`: on error the session ends, so roll back. */
async function runBackfill(db: PGlite): Promise<void> {
  try {
    await db.exec(BACKFILL_SQL);
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}

type Row = {
  id: string;
  workspace_id: string | null;
  division_id: string;
  department_id: string | null;
  metric_key: string;
  value: string;
  recorded_at: Date;
  basis: Record<string, unknown> | null;
  recorded_by: string | null;
  superseded_at: Date | null;
};

async function allRows(db: PGlite): Promise<Row[]> {
  const r = await db.query<Row>(
    `SELECT id, workspace_id, division_id, department_id, metric_key, value::text AS value, recorded_at,
            basis, recorded_by, superseded_at
       FROM stats ORDER BY id`
  );
  return r.rows;
}

async function div1Rows(db: PGlite): Promise<Row[]> {
  const r = await db.query<Row>(
    `SELECT id, workspace_id, division_id, department_id, metric_key, value::text AS value, recorded_at,
            basis, recorded_by, superseded_at
       FROM stats
      WHERE division_id = 'Div1' AND department_id IS NULL AND metric_key = 'artifacts_indexed'
        AND workspace_id ~ '^div-live-2026-W(3[1-9]|4[0-4])$'
      ORDER BY workspace_id`
  );
  return r.rows;
}

// PGlite cold start is slow on Windows (see #44); give each test headroom.
describe('2026-10-31 Div1 artifacts_indexed backfill SQL (div-live W31-W44)', { timeout: 30_000 }, () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await createDabosTestDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('recorded_at and windows in the script match org-week.ts (Thu 14:00 Berlin close - 1 ms)', () => {
    for (const week of WEEKS) {
      const w = statWeekWindow(2026, week);
      const rec = recordedAtForClosedOrgWeek(w);
      expect(BACKFILL_SQL).toContain(
        `'${ws(week)}', ${String(EXPECTED[week]!.value).padStart(2)}, '${rec}', '${w.start.toISOString()}', '${w.end.toISOString()}', ${EXPECTED[week]!.before}, ${EXPECTED[week]!.after},`
      );
    }
    // CEST weeks close 11:59:59.999Z, W44 (CET, after 25 Oct) 12:59:59.999Z.
    expect(recordedAtForClosedOrgWeek(statWeekWindow(2026, 31))).toBe('2026-07-30T11:59:59.999Z');
    expect(recordedAtForClosedOrgWeek(statWeekWindow(2026, 43))).toBe('2026-10-22T11:59:59.999Z');
    expect(recordedAtForClosedOrgWeek(statWeekWindow(2026, 44))).toBe('2026-10-29T12:59:59.999Z');
  });

  it('every value is the unique-page count added in the week (after - before) and weeks chain', () => {
    let prevAfter = EXPECTED[31]!.before;
    for (const week of WEEKS) {
      const e = EXPECTED[week]!;
      expect(e.before).toBe(prevAfter);
      expect(e.value).toBe(e.after - e.before);
      prevAfter = e.after;
    }
    expect(EXPECTED[38]!.value).toBe(3);
    expect(EXPECTED[40]!.value).toBe(0);
    expect(EXPECTED[42]!.value).toBe(0);
    expect(WEEKS.reduce((s, w) => s + EXPECTED[w]!.value, 0)).toBe(74);
  });

  it('inserts exactly 14 Div1 division rows with the right value, recorded_at and basis; W38 = 3, W40 = 0, W42 = 0', async () => {
    await seed(db);
    const before = await allRows(db);
    await runBackfill(db);
    const after = await allRows(db);
    expect(after.length).toBe(before.length + 14);

    const rows = await div1Rows(db);
    expect(rows).toHaveLength(14);
    for (const r of rows) {
      const week = Number(r.workspace_id!.slice(-2));
      const e = EXPECTED[week]!;
      const w = statWeekWindow(2026, week);
      expect(r.value).toBe(String(e.value));
      expect(r.recorded_at.toISOString()).toBe(recordedAtForClosedOrgWeek(w));
      expect(r.recorded_by).toBe('week-close-poster');
      expect(r.superseded_at).toBeNull();
      expect(r.basis).toMatchObject({
        ssot: 'DABOS/docs/wiki/index.md',
        year: 2026,
        week,
        window: { start: w.start.toISOString(), end: w.end.toISOString() },
        index_unique_before: e.before,
        index_unique_after: e.after,
        correction: TAG,
      });
      expect(String(r.basis!.note)).toContain('pages added to docs/wiki/index.md during the stat week');
    }
    const w38 = rows.find((r) => r.workspace_id === ws(38))!;
    expect(w38.value).toBe('3');
    expect(w38.basis).toMatchObject({ index_unique_before: 229, index_unique_after: 232, dabos_main_at_close: 'eef8b6e5' });
    const w40 = rows.find((r) => r.workspace_id === ws(40))!;
    expect(w40.value).toBe('0');
    expect(w40.basis).toMatchObject({ index_unique_before: 232, index_unique_after: 232 });
    expect(rows.find((r) => r.workspace_id === ws(42))!.value).toBe('0');
    expect(rows.find((r) => r.workspace_id === ws(44))!.value).toBe('60');

    // Every pre-existing row (W30 x2, Div2 rows, workspace-less Div1 row) is byte-identical.
    const ids = new Set(rows.map((r) => r.id));
    expect(after.filter((r) => !ids.has(r.id))).toEqual(before);
  });

  it('leaves both W30 rows untouched and does not duplicate them', async () => {
    await seed(db);
    const w30 = async () =>
      (await allRows(db)).filter((r) => r.workspace_id === 'div-live-2026-W30');
    const before = await w30();
    expect(before.map((r) => r.id).sort()).toEqual([...W30_IDS].sort());
    await runBackfill(db);
    await runBackfill(db);
    expect(await w30()).toEqual(before);
  });

  it('is idempotent: a second run succeeds and inserts nothing', async () => {
    await seed(db);
    await runBackfill(db);
    const once = await allRows(db);
    await runBackfill(db);
    expect(await allRows(db)).toEqual(once);
    expect(await div1Rows(db)).toHaveLength(14);
  });

  it('skips a week that already holds the same Div1 row (no duplicate) and fills the rest', async () => {
    await seed(db);
    await db.query(
      `INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at, recorded_by)
       VALUES ('div-live-2026-W38', 'Div1', 'artifacts_indexed', 3, '2026-09-17T11:59:59.999Z', 'week-close-poster')`
    );
    const before = (await allRows(db)).length;
    await runBackfill(db);
    expect((await allRows(db)).length).toBe(before + 13);
    const rows = await div1Rows(db);
    expect(rows).toHaveLength(14);
    expect(rows.filter((r) => r.workspace_id === ws(38))).toHaveLength(1);
  });

  it('a Dept3 row in a backfill week is left alone and does not block the division row', async () => {
    await seed(db);
    await db.query(
      `INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at)
       VALUES ('div-live-2026-W35', 'Div1', 'Dept3', 'artifacts_indexed', 7, '2026-08-27T11:59:59.999Z')`
    );
    await runBackfill(db);
    expect(await div1Rows(db)).toHaveLength(14);
    const dept3 = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM stats WHERE department_id = 'Dept3' AND workspace_id = 'div-live-2026-W35' AND value = 7`
    );
    expect(dept3.rows[0]!.n).toBe(1);
  });

  it('aborts and changes nothing when an existing W31-W44 Div1 row has a different value', async () => {
    await seed(db);
    await db.query(
      `INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at)
       VALUES ('div-live-2026-W42', 'Div1', 'artifacts_indexed', 1, '2026-10-15T11:59:59.999Z')`
    );
    const before = await allRows(db);
    await expect(runBackfill(db)).rejects.toThrow(/guard 1:/);
    expect(await allRows(db)).toEqual(before);
  });

  it('aborts on the v1 (Dept13 FAIL) placement: an existing W40 row of 3 differs from W40 = 0', async () => {
    await seed(db);
    await db.query(
      `INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at)
       VALUES ('div-live-2026-W40', 'Div1', 'artifacts_indexed', 3, '2026-10-01T11:59:59.999Z')`
    );
    const before = await allRows(db);
    await expect(runBackfill(db)).rejects.toThrow(/guard 1:/);
    expect(await allRows(db)).toEqual(before);
  });

  it('aborts and changes nothing when an existing W31-W44 Div1 row has a different recorded_at', async () => {
    await seed(db);
    await db.query(
      `INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at)
       VALUES ('div-live-2026-W44', 'Div1', 'artifacts_indexed', 60, '2026-11-01T23:59:59.999Z')`
    );
    const before = await allRows(db);
    await expect(runBackfill(db)).rejects.toThrow(/guard 1:/);
    expect(await allRows(db)).toEqual(before);
  });

  it('aborts when Div1 is missing from divisions', async () => {
    await seed(db, { noDiv1: true });
    const before = await allRows(db);
    await expect(runBackfill(db)).rejects.toThrow(/guard 0b/);
    expect(await allRows(db)).toEqual(before);
  });
});
// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDabosTestDb, readRepoFile } from '@/test/pglite-dabos';

/**
 * Guards of scripts/dabos/sql/2026-10-29_supersede_w44_poster_rows.sql, on made-up data in
 * an in-process Postgres. Ids match the script; values, labels and timestamps are invented.
 */
const CORRECTION_SQL = readRepoFile('scripts/dabos/sql/2026-10-29_supersede_w44_poster_rows.sql');
const MIGRATION_021 = readRepoFile('migrations/021_stats_conditions_superseded.sql');

const WS = 'div-live-2026-W44';
const STATS: [string, string, string | null, string][] = [
  ['2683a636-bb19-46f4-a800-1f73d5ba16ed', 'Div5', null, 'qa_pass_rate'],
  ['e2f0c13c-bc2f-420a-80cc-47539d40aedf', 'Div2', null, 'leads_or_touchpoints_created'],
  ['4e3ec69c-dfef-4ba4-9a89-1dffd4114623', 'Div2', 'Dept4', 'content_pieces_shipped'],
  ['01741053-8340-4b45-a2da-6bc707647cdf', 'Div4', null, 'shipped_outputs'],
  ['d9e75ecc-6b37-44f2-8929-786198cf47f0', 'Div4', 'Dept12', 'shipped_outputs'],
  ['b258a7bb-d67a-4ef7-9288-900e6d871e61', 'Div7', null, 'plan_completion_rate'],
];
const CONDITION_IDS = [
  '30ca4afd-3824-4897-93c6-ff494c275f58',
  '92dfb7b3-7bd5-4959-9c8a-6bb0721cf9fc',
  '18c914b8-9c7f-40ea-8865-5bcf9ea41163',
  '060a7997-255b-4870-84b2-38640dd1b34c',
  '1a60d12e-2f31-4ccc-9c9a-5612a80b526a',
  '6469092d-2e8b-4d75-85e4-5343586f7662',
  'be025a0d-efca-4eb7-9933-054430a1dfe9',
  'a078de50-9007-4cd3-b8a0-93074b3ba7bd',
  '9ea92055-8c29-4ae9-b0d2-07c122d0d74b',
  'f0fe4fc1-c440-4c36-969f-c77873af0232',
  '6984afe8-cfe6-42e8-93d2-54643ea886ec',
  'e23d9ec4-39f3-437e-a8f2-44cff39c33f9',
  '6d664f97-4e72-4bbe-aa3c-9535b342ca82',
  '448d849f-4bae-4d1b-8142-5d84d9d136f6',
  'ac3c58c7-5e4a-4214-8b62-ce580dd151bc',
  '5f9fb7d0-f4cd-4822-8f27-5033e0414329',
  '0cab3bcf-6bb8-4122-a547-6b0a9c45de0b',
  'dd1da962-91c4-4d02-ae1e-8d1bcf9127b2',
  'e20e54b0-280b-4189-a2d5-28cd6ec3400a',
  '1c42a603-47b6-44e4-8287-aaa5512ed186',
  '298628fc-d39e-4982-ab2b-1961f2713d13',
  'c450fc2d-7167-42a5-aaa3-fabb5cfa3e10',
  'f894de47-4471-41ba-83dc-c9924f595407',
  '32094da4-a0c5-43a2-8813-72b5e831d723',
  '4d471b91-7f28-4ffa-97ff-2e757b4c8b8c',
  'c232dcfb-4eae-4eae-a2be-65ebe7fb421d',
  '0ae910ae-5023-4173-995e-64c385f18f29',
  '451a216b-fee4-4601-b202-c6d64e342456',
];

async function seed(db: PGlite, opts: { skipStat?: string; extraWindowCondition?: boolean } = {}) {
  for (const d of ['Div1', 'Div2', 'Div3', 'Div4', 'Div5', 'Div6', 'Div7']) {
    await db.query(`INSERT INTO divisions (id, operational_name) VALUES ($1, $1)`, [d]);
  }
  await db.query(`INSERT INTO departments (id, division_id, legacy_name, operational_name) VALUES ('Dept4','Div2','x','x'), ('Dept12','Div4','x','x')`);
  for (const [id, div, dept, metric] of STATS) {
    if (id === opts.skipStat) continue;
    await db.query(
      `INSERT INTO stats (id, workspace_id, division_id, department_id, metric_key, value, recorded_at)
       VALUES ($1, $2, $3, $4, $5, 1, '2026-11-01T23:59:59.999Z')`,
      [id, WS, div, dept, metric]
    );
  }
  // Unrelated row in another workspace: must never be touched.
  await db.query(
    `INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at)
     VALUES ('gfp-live-2026-W44', 'Div6', 'conversions', 0, '2026-11-01T23:59:59.999Z')`
  );
  for (const [i, id] of CONDITION_IDS.entries()) {
    const at = new Date(Date.parse('2026-10-29T13:30:13.700Z') + i * 50).toISOString();
    await db.query(
      `INSERT INTO conditions (id, entity_type, entity_id, condition, created_at) VALUES ($1, $2, $3, 'Normal', $4)`,
      [id, i < 7 ? 'division' : 'department', `E${i}`, at]
    );
  }
  // Same-shape batches outside the window: must never be touched.
  await db.query(`INSERT INTO conditions (entity_type, entity_id, condition, created_at) VALUES ('division','Div1','Normal','2026-10-29T12:58:10Z'), ('division','Div1','Normal','2026-10-29T18:03:17Z')`);
  if (opts.extraWindowCondition) {
    await db.query(`INSERT INTO conditions (entity_type, entity_id, condition, created_at) VALUES ('division','Div9','Normal','2026-10-29T13:30:19Z')`);
  }
}

/** Run like `psql -v ON_ERROR_STOP=1`: on error the session ends, so roll back. */
async function runCorrection(db: PGlite): Promise<void> {
  try {
    await db.exec(CORRECTION_SQL);
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}

async function counts(db: PGlite) {
  const r = await db.query<{ s: number; c: number; ins: number; active_ws: number }>(`
    SELECT
      (SELECT count(*)::int FROM stats WHERE superseded_at IS NOT NULL) AS s,
      (SELECT count(*)::int FROM conditions WHERE superseded_at IS NOT NULL) AS c,
      (SELECT count(*)::int FROM stats WHERE recorded_by = 'dept11-correction') AS ins,
      (SELECT count(*)::int FROM stats WHERE workspace_id = '${WS}' AND superseded_at IS NULL) AS active_ws
  `);
  return r.rows[0]!;
}

describe('migration 021 (supersede columns)', () => {
  it('is idempotent (applies twice)', async () => {
    const db = await createDabosTestDb();
    await db.exec(MIGRATION_021);
    const cols = await db.query<{ n: number }>(`
      SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_name IN ('stats','conditions') AND column_name IN ('superseded_at','superseded_reason')`);
    expect(cols.rows[0]!.n).toBe(4);
    await db.close();
  });
});

describe('2026-10-29 W44 correction SQL', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await createDabosTestDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('supersedes 6 stats + 28 conditions and inserts Div4 shipped_outputs = 6', async () => {
    await seed(db);
    await runCorrection(db);
    expect(await counts(db)).toEqual({ s: 6, c: 28, ins: 1, active_ws: 1 });

    const reasons = await db.query<{ t: string; r: string }>(`
      SELECT DISTINCT 'stats' AS t, superseded_reason AS r FROM stats WHERE superseded_at IS NOT NULL
      UNION ALL
      SELECT DISTINCT 'conditions', superseded_reason FROM conditions WHERE superseded_at IS NOT NULL
      ORDER BY 1`);
    expect(reasons.rows).toEqual([
      { t: 'conditions', r: 'Dept13 FAIL 2026-10-29: poster default, not an assignment' },
      { t: 'stats', r: 'Dept13 FAIL 2026-10-29: ln02 poster @2474654 (ISO window, all-time qa)' },
    ]);

    const row = await db.query<Record<string, unknown>>(`
      SELECT division_id, department_id, metric_key, value::float8 AS value, recorded_at, basis, recorded_by
      FROM stats WHERE workspace_id = '${WS}' AND superseded_at IS NULL`);
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0]).toMatchObject({
      division_id: 'Div4',
      department_id: null,
      metric_key: 'shipped_outputs',
      value: 6,
      recorded_by: 'dept11-correction',
      basis: {
        source: 'marked value: Div4 W44 post 2026-10-29 14:41 Berlin',
        corrects: '01741053-8340-4b45-a2da-6bc707647cdf',
      },
    });
    expect((row.rows[0]!.recorded_at as Date).toISOString()).toBe('2026-10-29T12:59:59.999Z');

    // Rows outside scope untouched.
    const untouched = await db.query<{ n: number }>(`
      SELECT (SELECT count(*)::int FROM stats WHERE workspace_id <> '${WS}' AND superseded_at IS NULL)
           + (SELECT count(*)::int FROM conditions WHERE superseded_at IS NULL) AS n`);
    expect(untouched.rows[0]!.n).toBe(3);
  });

  it('aborts on re-run and changes nothing', async () => {
    await seed(db);
    await runCorrection(db);
    await expect(runCorrection(db)).rejects.toThrow(/guard 1/);
    expect(await counts(db)).toEqual({ s: 6, c: 28, ins: 1, active_ws: 1 });
  });

  it('aborts and rolls back when an expected stats row is missing', async () => {
    await seed(db, { skipStat: 'b258a7bb-d67a-4ef7-9288-900e6d871e61' });
    await expect(runCorrection(db)).rejects.toThrow(/guard 1: expected 6 active stats rows/);
    expect(await counts(db)).toEqual({ s: 0, c: 0, ins: 0, active_ws: 5 });
  });

  it('aborts when an unlisted stats row is active in the workspace', async () => {
    await seed(db);
    await db.query(`INSERT INTO stats (workspace_id, division_id, metric_key, value) VALUES ('${WS}', 'Div1', 'artifacts_indexed', 3)`);
    await expect(runCorrection(db)).rejects.toThrow(/guard 1b/);
    expect(await counts(db)).toEqual({ s: 0, c: 0, ins: 0, active_ws: 7 });
  });

  it('aborts when an unlisted conditions row sits in the window', async () => {
    await seed(db, { extraWindowCondition: true });
    await expect(runCorrection(db)).rejects.toThrow(/guard 2b/);
    expect(await counts(db)).toEqual({ s: 0, c: 0, ins: 0, active_ws: 6 });
  });

  it('aborts when an expected conditions row is already superseded', async () => {
    await seed(db);
    await db.query(`UPDATE conditions SET superseded_at = now(), superseded_reason = 'x' WHERE id = 'be025a0d-efca-4eb7-9933-054430a1dfe9'`);
    await expect(runCorrection(db)).rejects.toThrow(/guard 2: expected 28 active conditions rows in window, found 27/);
    expect(await counts(db)).toEqual({ s: 0, c: 1, ins: 0, active_ws: 6 });
  });

  it('aborts when migration 021 has not been applied', async () => {
    await db.close();
    db = await createDabosTestDb({ withSupersede: false });
    await seed(db);
    await expect(runCorrection(db)).rejects.toThrow(/guard 0: migration 021 not applied/);
  });
});

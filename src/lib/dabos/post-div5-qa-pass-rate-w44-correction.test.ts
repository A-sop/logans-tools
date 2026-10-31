// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { bucketStatWeek } from '@/lib/dabos/board-conditions-query';
import { recordedAtForClosedOrgWeek, statWeekOf, statWeekWindow } from '@/lib/dabos/org-week';
import { createDabosTestDb, readRepoFile } from '@/test/pglite-dabos';

/**
 * Guards of scripts/dabos/sql/2026-10-31_post_div5_qa_pass_rate_w44.sql, on made-up data in an
 * in-process Postgres. Ids and values mirror DABOS Neon (read-only 2026-10-31); nothing here
 * connects to any network database.
 */
const SQL_PATH = 'scripts/dabos/sql/2026-10-31_post_div5_qa_pass_rate_w44.sql';
const CORRECTION_SQL = readRepoFile(SQL_PATH);
const TAG = '2026-10-31_post_div5_qa_pass_rate_w44';
const BY = 'div-live-correction-2026-10-31';
const W44 = 'div-live-2026-W44';
const W44_CLOSE = recordedAtForClosedOrgWeek(statWeekWindow(2026, 44));
const W44_OLD = '2026-11-01T23:59:59.999Z';
const REASON_38 = 'Dept13 FAIL 2026-10-29: ln02 poster @2474654 (ISO window, all-time qa)';
const ID_38 = '2683a636-bb19-46f4-a800-1f73d5ba16ed';

/** Dept13 register backfill Instances 6-25 (W44), verdict per instance (DABOS #191 @ 248056df). */
const W44_VERDICTS: Record<number, 'PASS' | 'FAIL'> = {
  6: 'PASS',
  7: 'FAIL',
  8: 'PASS',
  9: 'PASS',
  10: 'PASS',
  11: 'PASS',
  12: 'PASS',
  13: 'FAIL',
  14: 'PASS',
  15: 'PASS',
  16: 'PASS',
  17: 'FAIL',
  18: 'FAIL',
  19: 'PASS',
  20: 'PASS',
  21: 'PASS',
  22: 'FAIL',
  23: 'PASS',
  24: 'FAIL',
  25: 'PASS',
};
/** Dept14 2026-10-31: not closed. */
const EXCLUDED = [15, 25];

async function seed(db: PGlite) {
  await db.query(
    `INSERT INTO divisions (id, operational_name) VALUES ('Div1','x'), ('Div2','x'), ('Div4','x'), ('Div5','x'), ('Div7','x')`
  );
  await db.query(
    `INSERT INTO departments (id, division_id, legacy_name, operational_name) VALUES
       ('Dept3','Div1','x','x'), ('Dept4','Div2','x','x'), ('Dept12','Div4','x','x')`
  );
  // The 6 #38-superseded W44 rows, plus out-of-scope rows that must stay byte-identical:
  // #53's Div4 W44 posts, #49's Div1 W44 row, a W43 Div5 row superseded by #51, a W30 row.
  await db.query(
    `INSERT INTO stats (id, workspace_id, division_id, department_id, metric_key, value, recorded_at, superseded_at, superseded_reason) VALUES
       ('${ID_38}', '${W44}', 'Div5', NULL, 'qa_pass_rate', 75, '${W44_OLD}', '2026-10-30T21:53:34.457Z', '${REASON_38}'),
       ('e2f0c13c-bc2f-420a-80cc-47539d40aedf', '${W44}', 'Div2', NULL, 'leads_or_touchpoints_created', 0, '${W44_OLD}', '2026-10-30T21:53:34.457Z', '${REASON_38}'),
       ('4e3ec69c-dfef-4ba4-9a89-1dffd4114623', '${W44}', 'Div2', 'Dept4', 'content_pieces_shipped', 0, '${W44_OLD}', '2026-10-30T21:53:34.457Z', '${REASON_38}'),
       ('01741053-8340-4b45-a2da-6bc707647cdf', '${W44}', 'Div4', NULL, 'shipped_outputs', 2, '${W44_OLD}', '2026-10-30T21:53:34.457Z', '${REASON_38}'),
       ('d9e75ecc-6b37-44f2-8929-786198cf47f0', '${W44}', 'Div4', 'Dept12', 'shipped_outputs', 2, '${W44_OLD}', '2026-10-30T21:53:34.457Z', '${REASON_38}'),
       ('b258a7bb-d67a-4ef7-9288-900e6d871e61', '${W44}', 'Div7', NULL, 'plan_completion_rate', 28.6, '${W44_OLD}', '2026-10-30T21:53:34.457Z', '${REASON_38}'),
       ('6f0b4f31-828c-4656-9b9d-4e2787fc0472', 'div-live-2026-W43', 'Div5', NULL, 'qa_pass_rate', 80, '2026-10-25T23:59:59.999Z', '2026-10-31T20:00:00Z', 'Dept14 2026-10-31: all-time value, weekly count has no closed verdicts'),
       ('a8ac8685-1795-4720-be9c-215396160c82', 'div-live-2026-W30', 'Div2', NULL, 'leads_or_touchpoints_created', 0, '2026-07-26T21:59:59.999Z', NULL, NULL)`
  );
  await db.query(
    `INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by) VALUES
       ('${W44}', 'Div4', NULL, 'shipped_outputs', 0, '${W44_CLOSE}', '{"correction":"2026-10-31_repost_div_live_w44_and_w30_close","part":"w44_repost"}', '${BY}'),
       ('${W44}', 'Div4', 'Dept12', 'shipped_outputs', 0, '${W44_CLOSE}', '{"correction":"2026-10-31_repost_div_live_w44_and_w30_close","part":"w44_repost"}', '${BY}'),
       ('${W44}', 'Div1', NULL, 'artifacts_indexed', 60, '${W44_CLOSE}', '{"correction":"2026-10-31_backfill_div1_artifacts_indexed_w31_w44"}', 'week-close-poster')`
  );
}

/** Run like `psql -v ON_ERROR_STOP=1`: on error the session ends, so roll back. */
async function run(db: PGlite, sql: string = CORRECTION_SQL): Promise<void> {
  try {
    await db.exec(sql);
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
  superseded_reason: string | null;
};

async function allRows(db: PGlite): Promise<Row[]> {
  const r = await db.query<Row>(
    `SELECT id, workspace_id, division_id, department_id, metric_key, value::text AS value, recorded_at,
            basis, recorded_by, superseded_at, superseded_reason
       FROM stats ORDER BY id`
  );
  return r.rows;
}

// PGlite cold start is slow on Windows (see #44); give each test headroom.
describe('2026-10-31 Div5 W44 qa_pass_rate post SQL', { timeout: 30_000 }, () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await createDabosTestDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('66.7 = 12/18 closed W44 verdicts from Instances 6-25 without #15 and #25 (poster rounding)', () => {
    const closed = Object.entries(W44_VERDICTS).filter(([i]) => !EXCLUDED.includes(Number(i)));
    const pass = closed.filter(([, v]) => v === 'PASS').map(([i]) => Number(i));
    const fail = closed.filter(([, v]) => v === 'FAIL').map(([i]) => Number(i));
    expect(Object.keys(W44_VERDICTS)).toHaveLength(20);
    expect([pass.length, closed.length]).toEqual([12, 18]);
    expect(Math.round((pass.length / closed.length) * 1000) / 10).toBe(66.7);
    expect(CORRECTION_SQL).toContain(`'pass_instances', jsonb_build_array(${pass.join(', ')})`);
    expect(CORRECTION_SQL).toContain(`'fail_instances', jsonb_build_array(${fail.join(', ')})`);
    expect(CORRECTION_SQL).toContain(`jsonb_build_object('instance', 15,`);
    expect(CORRECTION_SQL).toContain(`jsonb_build_object('instance', 25,`);
  });

  it('recorded_at is the W44 close from org-week.ts (CET) and buckets into W44', () => {
    expect(W44_CLOSE).toBe('2026-10-29T12:59:59.999Z');
    expect(CORRECTION_SQL).toContain(`w44_close constant timestamptz := '${W44_CLOSE}'`);
    expect(statWeekOf(new Date(W44_CLOSE)).isoWeek).toBe(44);
  });

  it('inserts exactly the one Div5 row with the ruled basis; every other row is unchanged', async () => {
    await seed(db);
    const before = await allRows(db);
    await run(db);
    const after = await allRows(db);
    expect(after).toHaveLength(before.length + 1);
    const byId = new Map(after.map((r) => [r.id, r]));
    for (const b of before) expect(byId.get(b.id)).toEqual(b);

    const mine = after.filter((r) => r.basis?.correction === TAG);
    expect(mine).toHaveLength(1);
    const r = mine[0]!;
    expect([r.workspace_id, r.division_id, r.department_id, r.metric_key, r.value]).toEqual([
      W44,
      'Div5',
      null,
      'qa_pass_rate',
      '66.7',
    ]);
    expect(r.recorded_at.toISOString()).toBe(W44_CLOSE);
    expect(r.recorded_by).toBe(BY);
    expect(r.superseded_at).toBeNull();
    expect(bucketStatWeek(2026, r.recorded_at, r.workspace_id)).toBe(44);
    expect(r.basis).toMatchObject({
      numerator: 12,
      denominator: 18,
      ruling: 'Dept14 ruling 2026-10-31',
      week: 44,
      excluded_instances: [
        { instance: 15, why: 'not closed (PASS conditional on #171)' },
        { instance: 25, why: 'not closed (W44 only if pre-merge)' },
      ],
    });
    expect(String(r.basis!.rule)).toMatch(/closed Dept13 verdicts .* Instances 6-25/);

    const live = after.filter(
      (x) => x.workspace_id === W44 && x.division_id === 'Div5' && x.superseded_at === null
    );
    expect(live).toEqual([r]);
  });

  it('a second run is a no-op and succeeds', async () => {
    await seed(db);
    await run(db);
    const once = await allRows(db);
    await run(db);
    expect(await allRows(db)).toEqual(once);
  });

  it('aborts and changes nothing when an active Div5 qa_pass_rate W44 row already exists', async () => {
    await seed(db);
    await db.query(
      `INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at)
       VALUES ($1, 'Div5', 'qa_pass_rate', 70, $2)`,
      [W44, W44_CLOSE]
    );
    const before = await allRows(db);
    await expect(run(db)).rejects.toThrow(/guard 1: 1 active Div5 qa_pass_rate row/);
    expect(await allRows(db)).toEqual(before);
  });

  it('aborts when the #38 Div5 row is missing or not superseded', async () => {
    await seed(db);
    await db.query(`UPDATE stats SET superseded_reason = 'other' WHERE id = $1`, [ID_38]);
    const before = await allRows(db);
    await expect(run(db)).rejects.toThrow(/guard 1b/);
    expect(await allRows(db)).toEqual(before);
  });

  it('a re-run aborts if the posted row was later superseded or changed', async () => {
    await seed(db);
    await run(db);
    await db.query(`UPDATE stats SET value = 70 WHERE basis->>'correction' = $1`, [TAG]);
    const before = await allRows(db);
    await expect(run(db)).rejects.toThrow(/guard 4: expected exactly one active Div5/);
    expect(await allRows(db)).toEqual(before);
  });

  it('a guard fires if the insert is dropped (mutation)', async () => {
    await seed(db);
    const mutated = CORRECTION_SQL.replace(
      /INSERT INTO stats \(workspace_id[\s\S]*?by_tag\);/,
      'PERFORM 1 WHERE false;'
    );
    expect(mutated).not.toBe(CORRECTION_SQL);
    const before = await allRows(db);
    await expect(run(db, mutated)).rejects.toThrow(/guard 2: inserted 0 rows/);
    expect(await allRows(db)).toEqual(before);
  });

  it('a guard fires if the value drifts from numerator/denominator (mutation)', async () => {
    await seed(db);
    const mutated = CORRECTION_SQL.replace(
      'val constant numeric := 66.7;',
      'val constant numeric := 70;'
    );
    expect(mutated).not.toBe(CORRECTION_SQL);
    await expect(run(db, mutated)).rejects.toThrow(/guard 0b/);
  });

  it('aborts when migration 021 has not been applied', async () => {
    await db.close();
    db = await createDabosTestDb({ withSupersede: false });
    await expect(run(db)).rejects.toThrow(/guard 0: migration 021 not applied/);
  });
});

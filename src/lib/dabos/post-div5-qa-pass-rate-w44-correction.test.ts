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

type Verdict = 'PASS' | 'FAIL' | 'CONDITIONAL' | 'PASS-conditional';
/**
 * All 47 W44 Dept13 verdict events, one per verdict on one PR at one SHA, from the Dept13
 * validation register W44 rebuild (Instances 6-26 and 36-61; DABOS #201 @da6ed2f3),
 * with Dept14 Amendment 1 (31 Oct 17:40): Instance 61 is a closed PASS.
 */
const W44_VERDICTS: Record<number, Verdict> = {
  6: 'PASS',
  7: 'FAIL',
  8: 'PASS',
  9: 'PASS',
  10: 'PASS',
  11: 'PASS',
  12: 'PASS',
  13: 'FAIL',
  14: 'PASS',
  15: 'PASS-conditional',
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
  26: 'PASS',
  36: 'CONDITIONAL',
  37: 'CONDITIONAL',
  38: 'CONDITIONAL',
  39: 'PASS',
  40: 'FAIL',
  41: 'CONDITIONAL',
  42: 'FAIL',
  43: 'CONDITIONAL',
  44: 'PASS',
  45: 'CONDITIONAL',
  46: 'CONDITIONAL',
  47: 'CONDITIONAL',
  48: 'CONDITIONAL',
  49: 'PASS',
  50: 'CONDITIONAL',
  51: 'FAIL',
  52: 'CONDITIONAL',
  53: 'CONDITIONAL',
  54: 'PASS',
  55: 'CONDITIONAL',
  56: 'CONDITIONAL',
  57: 'CONDITIONAL',
  58: 'PASS',
  59: 'PASS',
  60: 'PASS',
  61: 'PASS',
};
const DABOS_REGISTER = 'DABOS #201 @da6ed2f3ce2ed52e4592059ea740a19cdc2205a2';
/** Dept14 2026-10-31: only PASS / FAIL are closed verdicts. */
const isClosed = (v: Verdict) => v === 'PASS' || v === 'FAIL';
const EXCLUDED = Object.entries(W44_VERDICTS)
  .filter(([, v]) => !isClosed(v))
  .map(([i]) => Number(i));
const rate = (verdicts: Record<number, Verdict>) => {
  const closed = Object.values(verdicts).filter(isClosed);
  const pass = closed.filter((v) => v === 'PASS').length;
  return { pass, closed: closed.length, value: Math.round((pass / closed.length) * 1000) / 10 };
};

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

  it('71.0 = 22/31 closed W44 verdicts from the W44 rebuild (Instances 6-26, 36-61) without CONDITIONAL and the PASS-conditional Instance 15', () => {
    const entries = Object.entries(W44_VERDICTS).map(([i, v]) => [Number(i), v] as const);
    const of = (k: Verdict) => entries.filter(([, v]) => v === k).map(([i]) => i);
    expect(entries).toHaveLength(47);
    expect([
      of('PASS').length,
      of('FAIL').length,
      of('CONDITIONAL').length,
      of('PASS-conditional').length,
    ]).toEqual([22, 9, 15, 1]);
    expect(EXCLUDED).toHaveLength(16);
    const r = rate(W44_VERDICTS);
    expect([r.pass, r.closed]).toEqual([22, 31]);
    expect(r.value).toBe(71);
    expect(CORRECTION_SQL).toContain('num constant integer := 22;');
    expect(CORRECTION_SQL).toContain('den constant integer := 31;');
    expect(CORRECTION_SQL).toContain('val constant numeric := 71.0;');
    expect(CORRECTION_SQL).toContain(
      `'pass_instances', jsonb_build_array(${of('PASS').join(', ')})`
    );
    expect(CORRECTION_SQL).toContain(
      `'fail_instances', jsonb_build_array(${of('FAIL').join(', ')})`
    );
    expect(CORRECTION_SQL).toContain(`jsonb_build_object('instance', 15,`);
    expect(CORRECTION_SQL).not.toContain(`jsonb_build_object('instance', 61,`);
    expect(CORRECTION_SQL).toContain(
      `jsonb_build_object('instances', jsonb_build_array(${of('CONDITIONAL').join(', ')}), 'why', 'not closed (CONDITIONAL)')`
    );
    expect(CORRECTION_SQL).toContain(DABOS_REGISTER);
  });

  it('mutation: dropping Instance 25 or 61 back to PASS-conditional (21/30 = 70.0), or counting 15 as PASS (23/32 = 71.9), does not give 71.0', () => {
    const without25 = { ...W44_VERDICTS };
    delete without25[25];
    expect(rate(without25)).toEqual({ pass: 21, closed: 30, value: 70 });
    const cond61 = { ...W44_VERDICTS, 61: 'PASS-conditional' as const };
    expect(rate(cond61)).toEqual({ pass: 21, closed: 30, value: 70 });
    const with15 = { ...W44_VERDICTS, 15: 'PASS' as const };
    expect(rate(with15)).toEqual({ pass: 23, closed: 32, value: 71.9 });
  });

  for (const [label, num, den] of [
    ['dropping Instance 25 or 61 back to PASS-conditional', 21, 30],
    ['counting 15 as PASS', 23, 32],
  ] as const) {
    it(`guard 0b fires on the SQL when ${label} (${num}/${den}) but the value stays 71.0 (mutation)`, async () => {
      await seed(db);
      const mutated = CORRECTION_SQL.replace(
        'num constant integer := 22;',
        `num constant integer := ${num};`
      ).replace('den constant integer := 31;', `den constant integer := ${den};`);
      expect(mutated).not.toBe(CORRECTION_SQL);
      const before = await allRows(db);
      await expect(run(db, mutated)).rejects.toThrow(/guard 0b/);
      expect(await allRows(db)).toEqual(before);
    });
  }

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
      '71.0',
    ]);
    expect(r.recorded_at.toISOString()).toBe(W44_CLOSE);
    expect(r.recorded_by).toBe(BY);
    expect(r.superseded_at).toBeNull();
    expect(bucketStatWeek(2026, r.recorded_at, r.workspace_id)).toBe(44);
    expect(r.basis).toMatchObject({
      numerator: 22,
      denominator: 31,
      ruling: 'Dept14 ruling 2026-10-31',
      week: 44,
      pass_instances: [
        6, 8, 9, 10, 11, 12, 14, 16, 19, 20, 21, 23, 25, 26, 39, 44, 49, 54, 58, 59, 60, 61,
      ],
      fail_instances: [7, 13, 17, 18, 22, 24, 40, 42, 51],
      excluded_instances: [
        { instance: 15, why: 'not closed (PASS conditional: merge #171 first)' },
        {
          instances: [36, 37, 38, 41, 43, 45, 46, 47, 48, 50, 52, 53, 55, 56, 57],
          why: 'not closed (CONDITIONAL)',
        },
      ],
    });
    expect(String(r.basis!.rule)).toMatch(
      /closed Dept13 verdicts .* dated by when Div5 sent the verdict, from all 47 W44 events .*\(Instances 6-26 and 36-61\)/
    );
    expect(String(r.basis!.register)).toContain(DABOS_REGISTER);

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
       VALUES ($1, 'Div5', 'qa_pass_rate', 71, $2)`,
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
      'val constant numeric := 71.0;',
      'val constant numeric := 70.0;'
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

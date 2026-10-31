// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { bucketStatWeek } from '@/lib/dabos/board-conditions-query';
import { recordedAtForClosedOrgWeek, statWeekOf, statWeekWindow } from '@/lib/dabos/org-week';
import { createDabosTestDb, readRepoFile } from '@/test/pglite-dabos';

/**
 * Guards of scripts/dabos/sql/2026-10-31_supersede_div_live_w31_w43.sql, on made-up data in an
 * in-process Postgres. Ids, values and old recorded_at mirror DABOS Neon (read-only 2026-10-31);
 * nothing here connects to any network database.
 */
const SQL_PATH = 'scripts/dabos/sql/2026-10-31_supersede_div_live_w31_w43.sql';
const CORRECTION_SQL = readRepoFile(SQL_PATH);
const TAG = '2026-10-31_supersede_div_live_w31_w43';
const REASON = 'Div7 2026-10-31: old poster ISO-week-end recorded_at (not Thu 14:00 Berlin close)';
const BY = 'div-live-correction-2026-10-31';

const OLD_AT: Record<number, string> = {
  31: '2026-08-02T21:59:59.999Z',
  40: '2026-10-04T21:59:59.999Z',
  41: '2026-10-11T23:59:59.999Z',
  42: '2026-10-18T23:59:59.999Z',
  43: '2026-10-25T23:59:59.999Z',
};
const WEEKS = [31, 40, 41, 42, 43];
const ws = (week: number) => `div-live-2026-W${week}`;

// [id, week, division, department, metric, value]
type Old = [string, number, string, string | null, string, number];
const OLD: Old[] = [
  ['56b705f1-90fe-497f-9323-66ac9e6439a5', 31, 'Div2', 'Dept4', 'content_pieces_shipped', 0],
  ['1a8c8673-e138-4e2e-a1f4-94297890a897', 31, 'Div2', null, 'leads_or_touchpoints_created', 0],
  ['f48a9b7c-a48a-460d-bd49-99cd40ffa313', 31, 'Div4', 'Dept12', 'shipped_outputs', 1],
  ['640ca807-05ba-4f53-9e58-5c67350ae52f', 31, 'Div4', null, 'shipped_outputs', 1],
  ['b312891e-5735-4e40-8a5e-66a054e62ac4', 31, 'Div5', null, 'qa_pass_rate', 80],
  ['8c2598a7-9dd6-48da-8532-e3fa2aa59a66', 31, 'Div7', null, 'plan_completion_rate', 28.6],
  ['04aba747-f32e-4941-89cc-e9021500e184', 40, 'Div2', 'Dept4', 'content_pieces_shipped', 0],
  ['08fbe9d5-c006-41af-a0ed-df6303fe71b8', 40, 'Div2', null, 'leads_or_touchpoints_created', 0],
  ['797f9653-02d3-455b-8b29-169ace294bff', 40, 'Div4', null, 'shipped_outputs', 1],
  ['a4d2447e-6b8d-49c7-b924-dab9e2543d07', 40, 'Div4', 'Dept12', 'shipped_outputs', 1],
  ['9a1ccdf4-7f37-45d0-89d8-ced170267147', 40, 'Div5', null, 'qa_pass_rate', 80],
  ['95a6ea9d-c030-44d4-b043-92e36064350d', 40, 'Div7', null, 'plan_completion_rate', 28.6],
  ['f573e36e-369f-4488-b6fe-e93ddb3ee23e', 41, 'Div2', 'Dept4', 'content_pieces_shipped', 0],
  ['eb3a9a94-d82c-4460-9d55-dd2e473e91c8', 41, 'Div2', null, 'leads_or_touchpoints_created', 0],
  ['1621436d-50bf-4cda-b03e-38c080e3212c', 41, 'Div4', null, 'shipped_outputs', 1],
  ['0d95644d-6bee-42b9-906d-2315e27aed86', 41, 'Div4', 'Dept12', 'shipped_outputs', 1],
  ['d15efd9b-4e55-4bd1-a549-a6497d5077d6', 41, 'Div5', null, 'qa_pass_rate', 80],
  ['2aba1b75-1d92-460a-ab4e-553fa5e259b2', 41, 'Div7', null, 'plan_completion_rate', 28.6],
  ['4308f369-69ea-46b9-839a-685ce0911db1', 42, 'Div2', 'Dept4', 'content_pieces_shipped', 0],
  ['122385f6-b1cb-49bc-913f-cec9e19e08a5', 42, 'Div2', null, 'leads_or_touchpoints_created', 0],
  ['f87fe984-421a-42e4-91aa-4bb654df55d5', 42, 'Div4', null, 'shipped_outputs', 3],
  ['5b490646-d8c0-44ba-b65b-08d86d508d22', 42, 'Div4', 'Dept12', 'shipped_outputs', 3],
  ['bc8cea02-b519-4044-8bee-6000b2f03c94', 42, 'Div5', null, 'qa_pass_rate', 80],
  ['45c29d6e-9b82-4250-8a30-c67c1813ec1c', 42, 'Div7', null, 'plan_completion_rate', 28.6],
  ['77fd22e8-8afd-49e7-be08-f67c265c1363', 43, 'Div2', 'Dept4', 'content_pieces_shipped', 0],
  ['a555e075-64ff-43fc-b0f8-d55e00f8cb12', 43, 'Div2', null, 'leads_or_touchpoints_created', 0],
  ['b952846c-78d6-4c27-ac86-530398bb9a45', 43, 'Div4', null, 'shipped_outputs', 3],
  ['cb2c172f-5171-414f-b7d9-25bbd72ef2ef', 43, 'Div4', 'Dept12', 'shipped_outputs', 3],
  ['6f0b4f31-828c-4656-9b9d-4e2787fc0472', 43, 'Div5', null, 'qa_pass_rate', 80],
  ['31340bab-e56e-43de-b2cf-6c0af3fe8c3e', 43, 'Div7', null, 'plan_completion_rate', 28.6],
];
const OLD_IDS = OLD.map((o) => o[0]);

async function seed(db: PGlite, opts: { skip?: string; bump?: string } = {}) {
  await db.query(
    `INSERT INTO divisions (id, operational_name) VALUES ('Div1','x'), ('Div2','x'), ('Div4','x'), ('Div5','x'), ('Div6','x'), ('Div7','x')`
  );
  await db.query(
    `INSERT INTO departments (id, division_id, legacy_name, operational_name) VALUES
       ('Dept3','Div1','x','x'), ('Dept4','Div2','x','x'), ('Dept12','Div4','x','x')`
  );
  for (const [id, week, div, dept, metric, value] of OLD) {
    if (id === opts.skip) continue;
    await db.query(
      `INSERT INTO stats (id, workspace_id, division_id, department_id, metric_key, value, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, ws(week), div, dept, metric, id === opts.bump ? value + 1 : value, OLD_AT[week]]
    );
  }
  // Out of scope, must stay byte-identical: W30 rows, Div1 rows in the same workspaces (#49-style
  // backfill), the superseded W44 rows (#38: to-report), and gfp-live rows (#45/#47).
  await db.query(
    `INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by, superseded_at, superseded_reason) VALUES
       ('div-live-2026-W30', 'Div1', 'Dept3', 'artifacts_indexed', 75, '2026-07-26T21:59:59.999Z', '{"note":"old"}', 'week-close-poster', NULL, NULL),
       ('div-live-2026-W30', 'Div2', NULL, 'leads_or_touchpoints_created', 0, '2026-07-26T21:59:59.999Z', NULL, NULL, NULL, NULL),
       ('div-live-2026-W31', 'Div1', NULL, 'artifacts_indexed', 0, '2026-07-30T11:59:59.999Z', '{"correction":"2026-10-31_backfill_div1_artifacts_indexed_w31_w44"}', 'week-close-poster', NULL, NULL),
       ('div-live-2026-W42', 'Div1', NULL, 'artifacts_indexed', 0, '2026-10-15T11:59:59.999Z', '{"correction":"2026-10-31_backfill_div1_artifacts_indexed_w31_w44"}', 'week-close-poster', NULL, NULL),
       ('div-live-2026-W44', 'Div5', NULL, 'qa_pass_rate', 75, '2026-11-01T23:59:59.999Z', NULL, NULL, '2026-10-30T21:53:34.457Z', 'Dept13 FAIL 2026-10-29: ln02 poster @2474654 (ISO window, all-time qa)'),
       ('gfp-live-2026-W40', 'Div6', NULL, 'conversions', 0, '2026-10-04T21:59:59.999Z', NULL, 'gfp-poster', NULL, NULL)`
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

const stripSupersede = (r: Row) => {
  const { superseded_at, superseded_reason, ...rest } = r;
  void superseded_at;
  void superseded_reason;
  return rest;
};

// PGlite cold start is slow on Windows (see #44); give each test headroom.
describe('2026-10-31 div-live W31-W43 supersede-and-repost SQL', { timeout: 30_000 }, () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await createDabosTestDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('new recorded_at per workspace = org-week.ts close - 1 ms of the labelled week', () => {
    for (const week of WEEKS) {
      const rec = recordedAtForClosedOrgWeek(statWeekWindow(2026, week));
      expect(rec.endsWith('T11:59:59.999Z')).toBe(true); // CEST weeks
      expect(CORRECTION_SQL).toContain(`('${ws(week)}', '${rec}')`);
    }
  });

  it('documents the defect: every old recorded_at lies in the stat week after its label', () => {
    for (const week of WEEKS) {
      expect(statWeekOf(new Date(OLD_AT[week]!)).isoWeek).toBe(week + 1);
      expect(statWeekOf(new Date(recordedAtForClosedOrgWeek(statWeekWindow(2026, week)))).isoWeek).toBe(week);
    }
  });

  it('the script lists exactly the 30 expected rows (ids, keys, values, old recorded_at)', () => {
    for (const [id, week, div, dept, metric, value] of OLD) {
      expect(CORRECTION_SQL).toContain(
        `('${id}', '${ws(week)}', '${div}', ${dept ? `'${dept}'` : 'NULL'}, '${metric}', ${value}, '${OLD_AT[week]}')`
      );
    }
    expect(CORRECTION_SQL.match(/\('[0-9a-f-]{36}', 'div-live-2026-W\d\d'/g)).toHaveLength(30);
  });

  it('supersedes the 30 rows (not deleted, unchanged otherwise) and reposts each at the close, same value', async () => {
    await seed(db);
    const before = await allRows(db);
    await run(db);
    const after = await allRows(db);
    expect(after).toHaveLength(before.length + 30);

    const byId = new Map(after.map((r) => [r.id, r]));
    for (const b of before) {
      const a = byId.get(b.id)!;
      if (OLD_IDS.includes(b.id)) {
        expect(stripSupersede(a)).toEqual(stripSupersede(b));
        expect(a.superseded_at).not.toBeNull();
        expect(a.superseded_reason).toBe(REASON);
      } else {
        expect(a).toEqual(b); // out-of-scope rows byte-identical
      }
    }

    const reposts = after.filter((r) => r.basis?.correction === TAG);
    expect(reposts).toHaveLength(30);
    for (const [id, week, div, dept, metric, value] of OLD) {
      const mine = reposts.filter((r) => r.basis!.supersedes === id);
      expect(mine).toHaveLength(1);
      const r = mine[0]!;
      expect([r.workspace_id, r.division_id, r.department_id, r.metric_key, Number(r.value)]).toEqual([
        ws(week),
        div,
        dept,
        metric,
        value,
      ]);
      expect(r.recorded_at.toISOString()).toBe(recordedAtForClosedOrgWeek(statWeekWindow(2026, week)));
      expect(r.recorded_by).toBe(BY);
      expect(r.superseded_at).toBeNull();
      expect(r.basis!.old_recorded_at).toBe(OLD_AT[week]);
      // The board keeps the label, and the timestamp now agrees with it.
      expect(bucketStatWeek(2026, r.recorded_at, r.workspace_id)).toBe(week);
      expect(statWeekOf(r.recorded_at).isoWeek).toBe(week);
    }

    const active = await db.query<{ ws: string; n: number }>(
      `SELECT workspace_id AS ws, count(*)::int AS n FROM stats
        WHERE division_id <> 'Div1' AND superseded_at IS NULL AND workspace_id ~ '^div-live-2026-W(3[1-9]|4[0-3])$'
        GROUP BY 1 ORDER BY 1`
    );
    expect(active.rows).toEqual(WEEKS.map((w) => ({ ws: ws(w), n: 6 })));
  });

  it('a second run is a no-op and succeeds', async () => {
    await seed(db);
    await run(db);
    const once = await allRows(db);
    await run(db);
    expect(await allRows(db)).toEqual(once);
  });

  it('aborts and changes nothing when a listed row is missing', async () => {
    await seed(db, { skip: OLD_IDS[20] });
    const before = await allRows(db);
    await expect(run(db)).rejects.toThrow(/guard 1: unexpected state \(active old rows 29/);
    expect(await allRows(db)).toEqual(before);
  });

  it('aborts and changes nothing when a listed row has a different value', async () => {
    await seed(db, { bump: OLD_IDS[21] });
    const before = await allRows(db);
    await expect(run(db)).rejects.toThrow(/guard 1: unexpected state/);
    expect(await allRows(db)).toEqual(before);
  });

  it('aborts when an unlisted non-Div1 row exists in div-live W31..W43 (incl. W32-W39)', async () => {
    await seed(db);
    await db.query(
      `INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at)
       VALUES ('div-live-2026-W35', 'Div2', 'leads_or_touchpoints_created', 0, '2026-08-30T21:59:59.999Z')`
    );
    const before = await allRows(db);
    await expect(run(db)).rejects.toThrow(/guard 1: expected 30 non-Div1 rows/);
    expect(await allRows(db)).toEqual(before);
  });

  it('aborts on a partial state (a listed row already superseded for another reason)', async () => {
    await seed(db);
    await db.query(`UPDATE stats SET superseded_at = now(), superseded_reason = 'other' WHERE id = $1`, [
      OLD_IDS[0],
    ]);
    const before = await allRows(db);
    await expect(run(db)).rejects.toThrow(/guard 1: unexpected state/);
    expect(await allRows(db)).toEqual(before);
  });

  it('aborts after a partial apply (reposts deleted by hand) instead of reposting twice', async () => {
    await seed(db);
    await run(db);
    await db.query(`DELETE FROM stats WHERE basis->>'supersedes' = $1`, [OLD_IDS[5]]);
    const before = await allRows(db);
    await expect(run(db)).rejects.toThrow(/guard 1: unexpected state/);
    expect(await allRows(db)).toEqual(before);
  });

  it('a guard fires if the repost step is dropped (mutation)', async () => {
    await seed(db);
    const mutated = CORRECTION_SQL.replace(
      /INSERT INTO stats \(workspace_id[\s\S]*?FROM stats s JOIN div_live_w31_w43_fix f ON f\.id = s\.id;/,
      'PERFORM 1 WHERE false;'
    );
    expect(mutated).not.toBe(CORRECTION_SQL);
    const before = await allRows(db);
    await expect(run(db, mutated)).rejects.toThrow(/guard 3: reposted 0 rows/);
    expect(await allRows(db)).toEqual(before);
  });

  it('aborts when migration 021 has not been applied', async () => {
    await db.close();
    db = await createDabosTestDb({ withSupersede: false });
    await db.query(`INSERT INTO divisions (id, operational_name) VALUES ('Div2', 'x')`);
    await expect(run(db)).rejects.toThrow(/guard 0: migration 021 not applied/);
  });
});
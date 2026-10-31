// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { bucketStatWeek } from '@/lib/dabos/board-conditions-query';
import { recordedAtForClosedOrgWeek, statWeekOf, statWeekWindow } from '@/lib/dabos/org-week';
import { createDabosTestDb, readRepoFile } from '@/test/pglite-dabos';

/**
 * Guards of scripts/dabos/sql/2026-10-31_repost_div_live_w44_and_w30_close.sql, on made-up data in
 * an in-process Postgres. Ids, values and recorded_at mirror DABOS Neon (read-only 2026-10-31);
 * nothing here connects to any network database.
 */
const SQL_PATH = 'scripts/dabos/sql/2026-10-31_repost_div_live_w44_and_w30_close.sql';
const CORRECTION_SQL = readRepoFile(SQL_PATH);
const TAG = '2026-10-31_repost_div_live_w44_and_w30_close';
const REASON_REDATE =
  'Div7 2026-10-31: W30 old poster ISO-week-end recorded_at (not Thu 14:00 Berlin close)';
// Dept14 ruling 2026-10-31: superseded with NO repost.
const REASON_DIV5 = 'Dept14 2026-10-31: all-time value, weekly count has no closed verdicts';
const REASON_DIV7 = 'Dept14 2026-10-31: void basis per Logan 4 Oct ruling';
const reasonFor = (div: string) =>
  div === 'Div5' ? REASON_DIV5 : div === 'Div7' ? REASON_DIV7 : REASON_REDATE;
const reposted = (div: string) => div !== 'Div5' && div !== 'Div7';
const DIV5_W44_TAG = '2026-10-31_post_div5_qa_pass_rate_w44';
const REASON_51 =
  'Div7 2026-10-31: old poster ISO-week-end recorded_at (not Thu 14:00 Berlin close)';
const REASON_38 = 'Dept13 FAIL 2026-10-29: ln02 poster @2474654 (ISO window, all-time qa)';
const BY = 'div-live-correction-2026-10-31';
const W30 = 'div-live-2026-W30';
const W44 = 'div-live-2026-W44';
const W30_OLD = '2026-07-26T21:59:59.999Z';
const W30_CLOSE = recordedAtForClosedOrgWeek(statWeekWindow(2026, 30));
const W44_CLOSE = recordedAtForClosedOrgWeek(statWeekWindow(2026, 44));
const W44_OLD = '2026-11-01T23:59:59.999Z';

// [id, division, department, metric, value]
type Old = [string, string, string | null, string, number];
const W30_ROWS: Old[] = [
  ['a8ac8685-1795-4720-be9c-215396160c82', 'Div2', null, 'leads_or_touchpoints_created', 0],
  ['498ca334-3a11-426c-9524-3da7fb29e9bf', 'Div2', 'Dept4', 'content_pieces_shipped', 0],
  ['77d44bda-75df-4941-b0f3-f9d1f9084607', 'Div4', null, 'shipped_outputs', 1],
  ['6a9c4322-63c6-4907-9c12-a96ee8869139', 'Div4', 'Dept12', 'shipped_outputs', 1],
  ['ddb587d9-08e9-4f53-9112-957df3ebf1f7', 'Div5', null, 'qa_pass_rate', 80],
  ['47cee040-8a64-44d3-8a1b-64cf6d9931c4', 'Div7', null, 'plan_completion_rate', 28.6],
];
const W30_IDS = W30_ROWS.map((r) => r[0]);
const W30_REPOST = W30_ROWS.filter((r) => reposted(r[1]));
const W30_VOID = W30_ROWS.filter((r) => !reposted(r[1]));
const W30_DIV1: [string, string | null][] = [
  ['252780ef-4988-428a-ad3b-5eb6a6cf43db', null],
  ['dd2b66e2-1390-44b2-b2a4-d1829ff09400', 'Dept3'],
];
const W44_38: Old[] = [
  ['2683a636-bb19-46f4-a800-1f73d5ba16ed', 'Div5', null, 'qa_pass_rate', 75],
  ['e2f0c13c-bc2f-420a-80cc-47539d40aedf', 'Div2', null, 'leads_or_touchpoints_created', 0],
  ['4e3ec69c-dfef-4ba4-9a89-1dffd4114623', 'Div2', 'Dept4', 'content_pieces_shipped', 0],
  ['01741053-8340-4b45-a2da-6bc707647cdf', 'Div4', null, 'shipped_outputs', 2],
  ['d9e75ecc-6b37-44f2-8929-786198cf47f0', 'Div4', 'Dept12', 'shipped_outputs', 2],
  ['b258a7bb-d67a-4ef7-9288-900e6d871e61', 'Div7', null, 'plan_completion_rate', 28.6],
];
/** The W44 values this script posts: register value with a Dept13 pass/validated check only. */
const W44_POSTS: [string, string | null, string, number][] = [
  ['Div4', null, 'shipped_outputs', 0],
  ['Div4', 'Dept12', 'shipped_outputs', 0],
];

async function seed(
  db: PGlite,
  opts: { skip?: string; bump?: string; withPr49W44?: boolean; withDiv5W44?: boolean } = {}
) {
  await db.query(
    `INSERT INTO divisions (id, operational_name) VALUES ('Div1','x'), ('Div2','x'), ('Div3','x'), ('Div4','x'), ('Div5','x'), ('Div6','x'), ('Div7','x')`
  );
  await db.query(
    `INSERT INTO departments (id, division_id, legacy_name, operational_name) VALUES
       ('Dept3','Div1','x','x'), ('Dept4','Div2','x','x'), ('Dept12','Div4','x','x')`
  );
  for (const [id, div, dept, metric, value] of W30_ROWS) {
    if (id === opts.skip) continue;
    await db.query(
      `INSERT INTO stats (id, workspace_id, division_id, department_id, metric_key, value, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, W30, div, dept, metric, id === opts.bump ? value + 1 : value, W30_OLD]
    );
  }
  for (const [id, dept] of W30_DIV1) {
    await db.query(
      `INSERT INTO stats (id, workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by)
       VALUES ($1, $2, 'Div1', $3, 'artifacts_indexed', 75, $4, '{"note":"artifact-index.md counting basis"}', 'week-close-poster')`,
      [id, W30, dept, W30_OLD]
    );
  }
  for (const [id, div, dept, metric, value] of W44_38) {
    await db.query(
      `INSERT INTO stats (id, workspace_id, division_id, department_id, metric_key, value, recorded_at, superseded_at, superseded_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, '2026-10-30T21:53:34.457Z', $8)`,
      [id, W44, div, dept, metric, value, W44_OLD, REASON_38]
    );
  }
  // Out of scope, must stay byte-identical: #51-style W31 rows, a #49-style Div1 row, gfp-live.
  await db.query(
    `INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by, superseded_at, superseded_reason) VALUES
       ('div-live-2026-W31', 'Div2', NULL, 'leads_or_touchpoints_created', 0, '2026-08-02T21:59:59.999Z', NULL, NULL, '2026-10-31T12:00:00Z', '${REASON_51}'),
       ('div-live-2026-W31', 'Div2', NULL, 'leads_or_touchpoints_created', 0, '2026-07-30T11:59:59.999Z', '{"correction":"2026-10-31_supersede_div_live_w31_w43"}', '${BY}', NULL, NULL),
       ('div-live-2026-W31', 'Div1', NULL, 'artifacts_indexed', 0, '2026-07-30T11:59:59.999Z', '{"correction":"2026-10-31_backfill_div1_artifacts_indexed_w31_w44"}', 'week-close-poster', NULL, NULL),
       ('gfp-live-2026-W30', 'Div6', NULL, 'conversions', 0, '2026-07-26T21:59:59.999Z', NULL, 'gfp-poster', NULL, NULL)`
  );
  if (opts.withPr49W44) {
    await db.query(
      `INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by)
       VALUES ($1, 'Div1', NULL, 'artifacts_indexed', 60, $2, '{"correction":"2026-10-31_backfill_div1_artifacts_indexed_w31_w44"}', 'week-close-poster')`,
      [W44, W44_CLOSE]
    );
  }
  if (opts.withDiv5W44) {
    // The separate Div5 W44 qa_pass_rate PR, applied first: its key is read by no guard here.
    await db.query(
      `INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by)
       VALUES ($1, 'Div5', NULL, 'qa_pass_rate', 66.7, $2, $3, $4)`,
      [W44, W44_CLOSE, JSON.stringify({ correction: DIV5_W44_TAG }), BY]
    );
  }
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
describe('2026-10-31 div-live W44 repost + W30 close SQL', { timeout: 30_000 }, () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await createDabosTestDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('closes come from org-week.ts: W30 CEST 11:59:59.999Z, W44 CET 12:59:59.999Z', () => {
    expect(W30_CLOSE).toBe('2026-07-23T11:59:59.999Z');
    expect(W44_CLOSE).toBe('2026-10-29T12:59:59.999Z');
    expect(
      CORRECTION_SQL.match(new RegExp(`'${W30_OLD}', '${W30_CLOSE}', (true|false), '`, 'g'))
    ).toHaveLength(6);
    expect(
      CORRECTION_SQL.match(new RegExp(`'${W30_OLD}', '${W30_CLOSE}', true, '`, 'g'))
    ).toHaveLength(4);
    expect(
      CORRECTION_SQL.match(new RegExp(`'shipped_outputs', 0, '${W44_CLOSE}'`, 'g'))
    ).toHaveLength(2);
  });

  it('documents the defect: the old W30 recorded_at (Sunday) lies in stat week W31', () => {
    expect(new Date(W30_OLD).getUTCDay()).toBe(0);
    expect(statWeekOf(new Date(W30_OLD)).isoWeek).toBe(31);
    expect(statWeekOf(new Date(W30_CLOSE)).isoWeek).toBe(30);
    expect(statWeekOf(new Date(W44_CLOSE)).isoWeek).toBe(44);
  });

  it('lists exactly the 6 W30 rows and the 2 W44 posts, and no Div1 row to write', () => {
    for (const [id, div, dept, metric, value] of W30_ROWS) {
      expect(CORRECTION_SQL).toContain(
        `('${id}', '${W30}', '${div}', ${dept ? `'${dept}'` : 'NULL'}, '${metric}', ${value}, '${W30_OLD}', '${W30_CLOSE}', ${reposted(div)}, '${reasonFor(div)}')`
      );
    }
    expect(CORRECTION_SQL.match(/\('[0-9a-f-]{36}', 'div-live-2026-W30'/g)).toHaveLength(6);
    expect(
      CORRECTION_SQL.match(
        /^ {2}\('Div\d', (NULL|'Dept\d+'), '[a-z_]+', [\d.]+, '2026-10-29T12:59:59\.999Z'/gm
      )
    ).toHaveLength(2);
    expect(CORRECTION_SQL).not.toMatch(/^ {2}\('Div1',/m);
  });

  it('supersedes the 6 W30 rows, reposts the 4 Div2/Div4 at the W30 close (Div5/Div7 none), posts the 2 W44 rows; nothing else changes', async () => {
    await seed(db);
    const before = await allRows(db);
    await run(db);
    const after = await allRows(db);
    expect(after).toHaveLength(before.length + 6);

    const byId = new Map(after.map((r) => [r.id, r]));
    for (const b of before) {
      const a = byId.get(b.id)!;
      if (W30_IDS.includes(b.id)) {
        expect(stripSupersede(a)).toEqual(stripSupersede(b));
        expect(a.superseded_at).not.toBeNull();
        expect(a.superseded_reason).toBe(reasonFor(b.division_id));
      } else {
        expect(a).toEqual(b); // out-of-scope rows byte-identical (W30 Div1, #38 W44, #49/#51-style, gfp-live)
      }
    }

    const tagged = after.filter((r) => r.basis?.correction === TAG);
    expect(tagged).toHaveLength(6);
    expect(
      tagged.every(
        (r) => r.division_id !== 'Div1' && r.recorded_by === BY && r.superseded_at === null
      )
    ).toBe(true);

    expect(W30_VOID.map((r) => r[0])).toEqual([
      'ddb587d9-08e9-4f53-9112-957df3ebf1f7',
      '47cee040-8a64-44d3-8a1b-64cf6d9931c4',
    ]);
    for (const [id] of W30_VOID) {
      expect(after.filter((r) => r.basis?.supersedes === id)).toHaveLength(0);
    }
    for (const [id, div, dept, metric, value] of W30_REPOST) {
      const mine = tagged.filter((r) => r.basis!.supersedes === id);
      expect(mine).toHaveLength(1);
      const r = mine[0]!;
      expect([
        r.workspace_id,
        r.division_id,
        r.department_id,
        r.metric_key,
        Number(r.value),
      ]).toEqual([W30, div, dept, metric, value]);
      expect(r.recorded_at.toISOString()).toBe(W30_CLOSE);
      expect(r.basis!.old_recorded_at).toBe(W30_OLD);
      expect(r.basis!.part).toBe('w30_close');
      expect(bucketStatWeek(2026, r.recorded_at, r.workspace_id)).toBe(30);
      expect(statWeekOf(r.recorded_at).isoWeek).toBe(30);
    }

    const w44 = tagged.filter((r) => r.workspace_id === W44);
    expect(
      w44
        .map((r) => [
          r.division_id,
          r.department_id,
          r.metric_key,
          Number(r.value),
          r.recorded_at.toISOString(),
        ])
        .sort()
    ).toEqual(W44_POSTS.map(([d, dept, m, v]) => [d, dept, m, v, W44_CLOSE]).sort());
    for (const r of w44) {
      expect(r.basis!.part).toBe('w44_repost');
      expect(r.basis!.week).toBe(44);
      expect(bucketStatWeek(2026, r.recorded_at, r.workspace_id)).toBe(44);
    }

    const active = await db.query<{ ws: string; n: number }>(
      `SELECT workspace_id AS ws, count(*)::int AS n FROM stats
        WHERE superseded_at IS NULL AND workspace_id IN ($1, $2) GROUP BY 1 ORDER BY 1`,
      [W30, W44]
    );
    // W30: 4 Div2/Div4 reposts + 2 untouched Div1 rows. W44: the 2 Div4 posts only.
    expect(active.rows).toEqual([
      { ws: W30, n: 6 },
      { ws: W44, n: 2 },
    ]);
  });

  it('leaves a #49 Div1 W44 row (applied first) alone and posts no Div1 row of its own', async () => {
    await seed(db, { withPr49W44: true });
    const before = (await allRows(db)).filter((r) => r.division_id === 'Div1');
    await run(db);
    const after = await allRows(db);
    expect(after.filter((r) => r.division_id === 'Div1')).toEqual(before);
    expect(after.filter((r) => r.workspace_id === W44 && r.division_id === 'Div1')).toHaveLength(1);
  });

  it('tolerates the separate Div5 W44 qa_pass_rate post (applied before or after) and leaves it alone', async () => {
    await seed(db, { withDiv5W44: true });
    const div5 = (await allRows(db)).filter((r) => r.basis?.correction === DIV5_W44_TAG);
    expect(div5).toHaveLength(1);
    await run(db);
    await run(db); // no-op re-run with the Div5 row present
    const after = await allRows(db);
    expect(after.filter((r) => r.basis?.correction === DIV5_W44_TAG)).toEqual(div5);
    expect(after.filter((r) => r.basis?.correction === TAG)).toHaveLength(6);
  });

  it('a second run is a no-op and succeeds', async () => {
    await seed(db);
    await run(db);
    const once = await allRows(db);
    await run(db);
    expect(await allRows(db)).toEqual(once);
  });

  it('aborts and changes nothing when a listed W30 row is missing', async () => {
    await seed(db, { skip: W30_IDS[2] });
    const before = await allRows(db);
    await expect(run(db)).rejects.toThrow(/guard 1: unexpected state \(active old W30 rows 5/);
    expect(await allRows(db)).toEqual(before);
  });

  it('aborts and changes nothing when a listed W30 row has a different value', async () => {
    await seed(db, { bump: W30_IDS[4] });
    const before = await allRows(db);
    await expect(run(db)).rejects.toThrow(/guard 1: unexpected state/);
    expect(await allRows(db)).toEqual(before);
  });

  it('aborts when an unlisted non-Div1 row exists in W30', async () => {
    await seed(db);
    await db.query(
      `INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at)
       VALUES ($1, 'Div2', 'leads_or_touchpoints_created', 0, '2026-07-23T11:59:59.999Z')`,
      [W30]
    );
    const before = await allRows(db);
    await expect(run(db)).rejects.toThrow(/guard 1: expected 6 non-Div1 rows in div-live-2026-W30/);
    expect(await allRows(db)).toEqual(before);
  });

  it('aborts when a W30 Div1 row differs (both must stay 75, active, untouched)', async () => {
    await seed(db);
    await db.query(
      `UPDATE stats SET superseded_at = now(), superseded_reason = 'other' WHERE id = $1`,
      [W30_DIV1[1]![0]]
    );
    const before = await allRows(db);
    await expect(run(db)).rejects.toThrow(/guard 1c/);
    expect(await allRows(db)).toEqual(before);
  });

  it('aborts when a #38 W44 row is no longer superseded', async () => {
    await seed(db);
    await db.query(
      `UPDATE stats SET superseded_at = NULL, superseded_reason = NULL WHERE id = $1`,
      [W44_38[3]![0]]
    );
    const before = await allRows(db);
    await expect(run(db)).rejects.toThrow(
      /guard 1d: expected the 6 #38-superseded W44 rows, found 5/
    );
    expect(await allRows(db)).toEqual(before);
  });

  it('aborts when a non-Div1 W44 row exists beyond the 6 #38 rows (no double post)', async () => {
    await seed(db);
    await db.query(
      `INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at)
       VALUES ($1, 'Div4', 'shipped_outputs', 0, $2)`,
      [W44, W44_CLOSE]
    );
    const before = await allRows(db);
    await expect(run(db)).rejects.toThrow(
      /guard 1d: expected 5 non-Div1 rows in div-live-2026-W44 outside the Div5 qa_pass_rate key/
    );
    expect(await allRows(db)).toEqual(before);
  });

  it('aborts on a partial state (a listed W30 row already superseded for another reason)', async () => {
    await seed(db);
    await db.query(
      `UPDATE stats SET superseded_at = now(), superseded_reason = 'other' WHERE id = $1`,
      [W30_IDS[0]]
    );
    const before = await allRows(db);
    await expect(run(db)).rejects.toThrow(/guard 1: unexpected state/);
    expect(await allRows(db)).toEqual(before);
  });

  it('aborts after a partial apply (a W44 post deleted by hand) instead of posting twice', async () => {
    await seed(db);
    await run(db);
    await db.query(
      `DELETE FROM stats WHERE basis->>'part' = 'w44_repost' AND department_id = 'Dept12'`
    );
    const before = await allRows(db);
    await expect(run(db)).rejects.toThrow(/guard 1: unexpected state .*W44 posts 1/);
    expect(await allRows(db)).toEqual(before);
  });

  it('a guard fires if the W30 repost step is dropped (mutation)', async () => {
    await seed(db);
    const mutated = CORRECTION_SQL.replace(
      /INSERT INTO stats \(workspace_id[\s\S]*?FROM stats s JOIN div_live_w30_fix f ON f\.id = s\.id\n\s*WHERE f\.repost;/,
      'PERFORM 1 WHERE false;'
    );
    expect(mutated).not.toBe(CORRECTION_SQL);
    const before = await allRows(db);
    await expect(run(db, mutated)).rejects.toThrow(/guard 3: reposted 0 W30 rows/);
    expect(await allRows(db)).toEqual(before);
  });

  it('a guard fires if W30 Div5/Div7 get reposted after all (mutation)', async () => {
    await seed(db);
    const mutated = CORRECTION_SQL.replace(
      /(FROM stats s JOIN div_live_w30_fix f ON f\.id = s\.id)\n\s*WHERE f\.repost;/,
      '$1;'
    );
    expect(mutated).not.toBe(CORRECTION_SQL);
    const before = await allRows(db);
    await expect(run(db, mutated)).rejects.toThrow(/guard 3: reposted 6 W30 rows, expected 4/);
    expect(await allRows(db)).toEqual(before);
  });

  it('a guard fires if a W30 Div7 row loses its Dept14 reason (mutation)', async () => {
    await seed(db);
    const mutated = CORRECTION_SQL.replace(
      `false, '${REASON_DIV7}')`,
      `false, '${REASON_REDATE}')`
    );
    expect(mutated).not.toBe(CORRECTION_SQL);
    const before = await allRows(db);
    await expect(run(db, mutated)).rejects.toThrow(/guard 0c/);
    expect(await allRows(db)).toEqual(before);
  });

  it('a guard fires if the W44 insert is dropped (mutation)', async () => {
    await seed(db);
    const mutated = CORRECTION_SQL.replace(
      /INSERT INTO stats \(workspace_id[^;]*?FROM div_live_w44_post p[\s\S]*?\);\n/,
      'PERFORM 1 WHERE false;\n'
    );
    expect(mutated).not.toBe(CORRECTION_SQL);
    const before = await allRows(db);
    await expect(run(db, mutated)).rejects.toThrow(/guard 3b: posted 0 W44 rows/);
    expect(await allRows(db)).toEqual(before);
  });

  it('a guard fires if a Div1 W44 row is slipped into the post set (mutation)', async () => {
    await seed(db);
    const mutated = CORRECTION_SQL.replace(
      /INSERT INTO div_live_w44_post \(division, dept, metric, val, rec, register_check\) VALUES\n/,
      "$&  ('Div1', NULL, 'artifacts_indexed', 60, '2026-10-29T12:59:59.999Z', 'x'),\n"
    );
    expect(mutated).not.toBe(CORRECTION_SQL);
    const before = await allRows(db);
    await expect(run(db, mutated)).rejects.toThrow(/guard 0b/);
    expect(await allRows(db)).toEqual(before);
  });

  it('aborts when migration 021 has not been applied', async () => {
    await db.close();
    db = await createDabosTestDb({ withSupersede: false });
    await db.query(`INSERT INTO divisions (id, operational_name) VALUES ('Div2', 'x')`);
    await expect(run(db)).rejects.toThrow(/guard 0: migration 021 not applied/);
  });
});

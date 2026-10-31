// @vitest-environment node
import fs from 'fs';
import path from 'path';

import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDabosTestDb, readRepoFile } from '@/test/pglite-dabos';

/**
 * Order check for the four div-live data corrections that touch the same workspaces:
 *   #49 2026-10-31_backfill_div1_artifacts_indexed_w31_w44.sql (Div1 W31-W44 inserts)
 *   #51 2026-10-31_supersede_div_live_w31_w43.sql (non-Div1 W31-W43: Div2/Div4 re-dated,
 *       Div5/Div7 superseded without repost per Dept14 2026-10-31)
 *   this PR 2026-10-31_repost_div_live_w44_and_w30_close.sql (Div4 W44 posts + W30 fold-in,
 *       W30 Div5/Div7 superseded without repost)
 *   #54 2026-10-31_post_div5_qa_pass_rate_w44.sql (Div5 W44 qa_pass_rate 66.7, one insert)
 * Seeded with a copy of every div-live-* stats row on DABOS Neon (read-only SELECT, re-read
 * Sat 31 Oct 2026 ~15:40 CET, 44 rows, 38 active; SNAPSHOT_MD5 below is the digest prod returned
 * and the seeded copy must reproduce it). Runs only when all four SQL files are on the branch
 * (after #49, #51 and #54 merge); until then it is skipped. Nothing here connects to any network
 * database.
 */
const FILES = {
  pr49: 'scripts/dabos/sql/2026-10-31_backfill_div1_artifacts_indexed_w31_w44.sql',
  pr51: 'scripts/dabos/sql/2026-10-31_supersede_div_live_w31_w43.sql',
  w44w30: 'scripts/dabos/sql/2026-10-31_repost_div_live_w44_and_w30_close.sql',
  div5w44: 'scripts/dabos/sql/2026-10-31_post_div5_qa_pass_rate_w44.sql',
} as const;
type Key = keyof typeof FILES;
const repoRoot = path.resolve(__dirname, '../../..');
const allPresent = Object.values(FILES).every((f) => fs.existsSync(path.join(repoRoot, f)));

/** md5 over every div-live row, as returned by the read-only prod SELECT (see DIGEST_SQL). */
const SNAPSHOT_MD5 = '3ec6ced03789e4d46213a54533705ac6';
const DIGEST_SQL = `SELECT md5(string_agg(concat_ws('|', id, workspace_id, division_id, coalesce(department_id,'-'),
    metric_key, value::text, to_char(recorded_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS'),
    coalesce(basis::text,'-'), coalesce(recorded_by,'-'),
    coalesce(to_char(superseded_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS'),'-'),
    coalesce(superseded_reason,'-')), E'\\n' ORDER BY id)) AS digest
  FROM stats WHERE workspace_id LIKE 'div-live-%'`;
const R38 = 'Dept13 FAIL 2026-10-29: ln02 poster @2474654 (ISO window, all-time qa)';
const S38 = '2026-10-30T21:53:34.457Z';
const W30_DIV1_BASIS = (note: string) => ({
  dirs: [
    'C:\\Dev\\DABOS\\docs\\registers',
    'C:\\Dev\\DABOS\\docs\\policy',
    'C:\\DATA\\10_WORK\\dabos-registers',
    'C:\\DATA\\10_WORK\\dabos-registers\\offer-drafts',
  ],
  note,
  ssot: 'DABOS/docs/registers/artifact-index.md',
  parts: { dabosPolicy: 3, offerDrafts: 5, dabosRegisters: 16, dataRegistersTop: 51 },
});

// [id, workspace, division, department, metric, value, recorded_at, basis, recorded_by, superseded_at, reason]
type Snap = [
  string,
  string,
  string,
  string | null,
  string,
  number,
  string,
  object | null,
  string | null,
  string | null,
  string | null,
];
const SUN = {
  30: '2026-07-26T21:59:59.999Z',
  31: '2026-08-02T21:59:59.999Z',
  40: '2026-10-04T21:59:59.999Z',
  41: '2026-10-11T23:59:59.999Z',
  42: '2026-10-18T23:59:59.999Z',
  43: '2026-10-25T23:59:59.999Z',
  44: '2026-11-01T23:59:59.999Z',
} as const;
const six = (
  week: keyof typeof SUN,
  ids: [string, string, string, string, string, string],
  shipped: number,
  qa: number,
  sup: boolean
): Snap[] => {
  const ws = `div-live-2026-W${week}`;
  const s = sup ? S38 : null;
  const r = sup ? R38 : null;
  return [
    [ids[0], ws, 'Div2', null, 'leads_or_touchpoints_created', 0, SUN[week], null, null, s, r],
    [ids[1], ws, 'Div2', 'Dept4', 'content_pieces_shipped', 0, SUN[week], null, null, s, r],
    [ids[2], ws, 'Div4', null, 'shipped_outputs', shipped, SUN[week], null, null, s, r],
    [ids[3], ws, 'Div4', 'Dept12', 'shipped_outputs', shipped, SUN[week], null, null, s, r],
    [ids[4], ws, 'Div5', null, 'qa_pass_rate', qa, SUN[week], null, null, s, r],
    [ids[5], ws, 'Div7', null, 'plan_completion_rate', 28.6, SUN[week], null, null, s, r],
  ];
};
const SNAPSHOT: Snap[] = [
  [
    '252780ef-4988-428a-ad3b-5eb6a6cf43db',
    'div-live-2026-W30',
    'Div1',
    null,
    'artifacts_indexed',
    75,
    SUN[30],
    W30_DIV1_BASIS('artifact-index.md counting basis (division primary)'),
    'week-close-poster',
    null,
    null,
  ],
  [
    'dd2b66e2-1390-44b2-b2a4-d1829ff09400',
    'div-live-2026-W30',
    'Div1',
    'Dept3',
    'artifacts_indexed',
    75,
    SUN[30],
    W30_DIV1_BASIS('artifact-index.md counting basis'),
    'week-close-poster',
    null,
    null,
  ],
  ...six(
    30,
    [
      'a8ac8685-1795-4720-be9c-215396160c82',
      '498ca334-3a11-426c-9524-3da7fb29e9bf',
      '77d44bda-75df-4941-b0f3-f9d1f9084607',
      '6a9c4322-63c6-4907-9c12-a96ee8869139',
      'ddb587d9-08e9-4f53-9112-957df3ebf1f7',
      '47cee040-8a64-44d3-8a1b-64cf6d9931c4',
    ],
    1,
    80,
    false
  ),
  ...six(
    31,
    [
      '1a8c8673-e138-4e2e-a1f4-94297890a897',
      '56b705f1-90fe-497f-9323-66ac9e6439a5',
      '640ca807-05ba-4f53-9e58-5c67350ae52f',
      'f48a9b7c-a48a-460d-bd49-99cd40ffa313',
      'b312891e-5735-4e40-8a5e-66a054e62ac4',
      '8c2598a7-9dd6-48da-8532-e3fa2aa59a66',
    ],
    1,
    80,
    false
  ),
  ...six(
    40,
    [
      '08fbe9d5-c006-41af-a0ed-df6303fe71b8',
      '04aba747-f32e-4941-89cc-e9021500e184',
      '797f9653-02d3-455b-8b29-169ace294bff',
      'a4d2447e-6b8d-49c7-b924-dab9e2543d07',
      '9a1ccdf4-7f37-45d0-89d8-ced170267147',
      '95a6ea9d-c030-44d4-b043-92e36064350d',
    ],
    1,
    80,
    false
  ),
  ...six(
    41,
    [
      'eb3a9a94-d82c-4460-9d55-dd2e473e91c8',
      'f573e36e-369f-4488-b6fe-e93ddb3ee23e',
      '1621436d-50bf-4cda-b03e-38c080e3212c',
      '0d95644d-6bee-42b9-906d-2315e27aed86',
      'd15efd9b-4e55-4bd1-a549-a6497d5077d6',
      '2aba1b75-1d92-460a-ab4e-553fa5e259b2',
    ],
    1,
    80,
    false
  ),
  ...six(
    42,
    [
      '122385f6-b1cb-49bc-913f-cec9e19e08a5',
      '4308f369-69ea-46b9-839a-685ce0911db1',
      'f87fe984-421a-42e4-91aa-4bb654df55d5',
      '5b490646-d8c0-44ba-b65b-08d86d508d22',
      'bc8cea02-b519-4044-8bee-6000b2f03c94',
      '45c29d6e-9b82-4250-8a30-c67c1813ec1c',
    ],
    3,
    80,
    false
  ),
  ...six(
    43,
    [
      'a555e075-64ff-43fc-b0f8-d55e00f8cb12',
      '77fd22e8-8afd-49e7-be08-f67c265c1363',
      'b952846c-78d6-4c27-ac86-530398bb9a45',
      'cb2c172f-5171-414f-b7d9-25bbd72ef2ef',
      '6f0b4f31-828c-4656-9b9d-4e2787fc0472',
      '31340bab-e56e-43de-b2cf-6c0af3fe8c3e',
    ],
    3,
    80,
    false
  ),
  ...six(
    44,
    [
      'e2f0c13c-bc2f-420a-80cc-47539d40aedf',
      '4e3ec69c-dfef-4ba4-9a89-1dffd4114623',
      '01741053-8340-4b45-a2da-6bc707647cdf',
      'd9e75ecc-6b37-44f2-8929-786198cf47f0',
      '2683a636-bb19-46f4-a800-1f73d5ba16ed',
      'b258a7bb-d67a-4ef7-9288-900e6d871e61',
    ],
    2,
    75,
    true
  ),
];

async function seedSnapshot(db: PGlite) {
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

/** Order-independent picture of the table: ids of new rows and supersede times are not stable. */
async function picture(db: PGlite): Promise<string[]> {
  const r = await db.query<{ row: string }>(
    `SELECT concat_ws(' | ', workspace_id, division_id, coalesce(department_id, '-'), metric_key, value::text,
              to_char(recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), coalesce(basis::text, '-'),
              coalesce(recorded_by, '-'), CASE WHEN superseded_at IS NULL THEN 'active' ELSE 'superseded' END,
              coalesce(superseded_reason, '-')) AS row
       FROM stats ORDER BY 1`
  );
  return r.rows.map((x) => x.row);
}

const permutations = <T>(xs: T[]): T[][] =>
  xs.length <= 1
    ? [xs]
    : xs.flatMap((x, i) =>
        permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])
      );
const ORDERS: Key[][] = permutations(Object.keys(FILES) as Key[]);
/** Rows added / rows newly superseded by each script on the prod snapshot. */
const DELTA: Record<Key, { total: number; active: number }> = {
  pr49: { total: 14, active: 14 }, // 14 Div1 inserts W31-W44
  pr51: { total: 20, active: -10 }, // 30 superseded, 20 Div2/Div4 reposts (Div5/Div7 none)
  w44w30: { total: 6, active: 0 }, // 6 W30 superseded, 4 Div2/Div4 reposts, 2 Div4 W44 posts
  div5w44: { total: 1, active: 1 }, // Div5 W44 qa_pass_rate 66.7
};

async function doubleLiveKeys(db: PGlite): Promise<number> {
  const dup = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM (
       SELECT workspace_id, division_id, department_id, metric_key FROM stats WHERE superseded_at IS NULL
        GROUP BY 1, 2, 3, 4 HAVING count(*) > 1) t`
  );
  return dup.rows[0]!.n;
}

describe.skipIf(!allPresent)(
  'div-live corrections #49, #51, the W44/W30 repost and #54 in any order',
  { timeout: 120_000 },
  () => {
    let db: PGlite;
    const sql = allPresent
      ? (Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, readRepoFile(f)])) as Record<
          Key,
          string
        >)
      : ({} as Record<Key, string>);
    beforeEach(async () => {
      db = await createDabosTestDb();
      await seedSnapshot(db);
    });
    afterEach(async () => {
      await db.close();
    });

    it('the snapshot is the 44 prod div-live rows (38 active, 6 superseded by #38), byte-for-byte', async () => {
      expect(await counts(db)).toEqual({ total: 44, active: 38 });
      const d = await db.query<{ digest: string }>(DIGEST_SQL);
      expect(d.rows[0]!.digest).toBe(SNAPSHOT_MD5);
    });

    it('covers all 24 orders', () => {
      expect(ORDERS).toHaveLength(24);
      expect(new Set(ORDERS.map((o) => o.join())).size).toBe(24);
    });

    let reference: string[] | null = null;
    for (const order of ORDERS) {
      it(`applies ${order.join(' -> ')} with no guard abort, expected counts, no double-live key, the same end state, re-runs no-op`, async () => {
        let c = await counts(db);
        for (const k of order) {
          await run(db, sql[k]);
          const next = await counts(db);
          expect({ k, total: next.total - c.total, active: next.active - c.active }).toEqual({
            k,
            ...DELTA[k],
          });
          expect(await doubleLiveKeys(db)).toBe(0);
          c = next;
        }
        expect(c).toEqual({ total: 85, active: 43 });
        const pic = await picture(db);
        if (reference === null) reference = pic;
        else expect(pic).toEqual(reference);
        for (const k of order) await run(db, sql[k]);
        expect(await picture(db)).toEqual(pic);
      });
    }

    it('no row is touched by two scripts: tags and supersede reasons are disjoint per row', async () => {
      for (const k of ORDERS[0]!) await run(db, sql[k]);
      const r = await db.query<{ ws: string; div: string; n_active: number }>(
        `SELECT workspace_id AS ws, division_id AS div, count(*) FILTER (WHERE superseded_at IS NULL)::int AS n_active
         FROM stats GROUP BY 1, 2 HAVING count(*) FILTER (WHERE superseded_at IS NULL) > 0 ORDER BY 1, 2`
      );
      const active = Object.fromEntries(r.rows.map((x) => [`${x.ws} ${x.div}`, x.n_active]));
      // W30: Div1 2 untouched; Div2 2 + Div4 2 reposts; Div5/Div7 none (Dept14).
      // W31/W40-W43: Div1 1 (#49), Div2 2 + Div4 2 (#51); Div5/Div7 none (Dept14).
      // W32-W39: Div1 1 (#49) only. W44: Div1 1 (#49), Div4 2 (this PR), Div5 1 (#54), no Div7.
      for (const w of [30, 31, 40, 41, 42, 43]) {
        const ws = `div-live-2026-W${w}`;
        expect([active[`${ws} Div1`], active[`${ws} Div2`], active[`${ws} Div4`]]).toEqual([
          w === 30 ? 2 : 1,
          2,
          2,
        ]);
        expect(active[`${ws} Div5`]).toBeUndefined();
        expect(active[`${ws} Div7`]).toBeUndefined();
      }
      expect(
        Object.keys(active)
          .filter((k) => k.startsWith('div-live-2026-W44'))
          .map((k) => [k, active[k]])
          .sort()
      ).toEqual([
        ['div-live-2026-W44 Div1', 1],
        ['div-live-2026-W44 Div4', 2],
        ['div-live-2026-W44 Div5', 1],
      ]);
      const reasons = await db.query<{ reason: string; n: number }>(
        `SELECT superseded_reason AS reason, count(*)::int AS n FROM stats
          WHERE superseded_reason LIKE 'Dept14 2026-10-31:%' GROUP BY 1 ORDER BY 1`
      );
      expect(reasons.rows).toEqual([
        { reason: 'Dept14 2026-10-31: all-time value, weekly count has no closed verdicts', n: 6 },
        { reason: 'Dept14 2026-10-31: void basis per Logan 4 Oct ruling', n: 6 },
      ]);
      expect(await doubleLiveKeys(db)).toBe(0); // never two active rows for one workspace/division/department/metric
    });
  }
);

describe('div-live corrections order check (file presence)', () => {
  it("this PR's SQL is present; #49/#51 files are checked when merged", () => {
    expect(fs.existsSync(path.join(repoRoot, FILES.w44w30))).toBe(true);
  });
});

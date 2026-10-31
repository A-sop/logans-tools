// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { recordedAtForClosedOrgWeek, statWeekWindow } from '@/lib/dabos/org-week';
import { createDabosTestDb, readRepoFile } from '@/test/pglite-dabos';

/**
 * Guards of scripts/dabos/sql/2026-10-31_void_div1_artifacts_indexed_w24_w28_w30.sql (Dept14 ruling
 * 31 Oct 2026 17:45 Berlin) on an in-process Postgres. The 7 target rows mirror DABOS Neon
 * (read-only SELECT 31 Oct 17:42 CET); the other rows are made up. Nothing here connects to any
 * network database.
 */
const SQL_PATH = 'scripts/dabos/sql/2026-10-31_void_div1_artifacts_indexed_w24_w28_w30.sql';
const SQL = readRepoFile(SQL_PATH);
const TAG = '2026-10-31_void_div1_artifacts_indexed_w24_w28_w30';
const R1 =
  'Dept14 2026-10-31: void basis per Logan 21 Oct ruling (7 Jul backfill of registry and log counts, not wiki pages added per stat week)';
const R2 = 'Dept14 2026-10-31: void basis per Logan 21 Oct ruling (artifact-index register count)';
const W30 = 'div-live-2026-W30';
const W30_CLOSE = '2026-07-23T11:59:59.999Z';
const OLD_W30 = '2026-07-26T21:59:59.999Z';
/** GitHub main at the W29 and W30 closes (fresh read-only clone of A-sop/DABOS, 31 Oct). */
const MAIN_W29 = '697c0095014529a4453a7eae0cd5ae76842109d7';
const MAIN_W30 = '697c0095014529a4453a7eae0cd5ae76842109d7';

/** Part 1: workspace-less Div1 artifacts_indexed rows (7 Jul backfill), [id, value, recorded_at]. */
const P1: [string, number, string][] = [
  ['e764a5dd-1244-4cae-82b7-dc1a9b731627', 2277, '2026-06-11T12:00:00.000Z'],
  ['eb1e15a5-96ca-4c05-ab37-87559c4fbdf3', 592, '2026-06-18T12:00:00.000Z'],
  ['acadbebe-01ce-4ac7-8ad5-085cc68809a2', 89, '2026-06-25T12:00:00.000Z'],
  ['6fdac124-4488-44c9-a974-b0144a58458d', 128, '2026-07-02T12:00:00.000Z'],
  ['73a818d5-0e87-4515-8975-62a5341edb68', 393, '2026-07-09T12:00:00.000Z'],
];
/** W30 Div1 basis as on prod (old artifact-index register basis). */
const W30_BASIS = (note: string) => ({
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
const W30_DIV = '252780ef-4988-428a-ad3b-5eb6a6cf43db';
const W30_DEPT3 = 'dd2b66e2-1390-44b2-b2a4-d1829ff09400';
const IDS = [...P1.map((r) => r[0]), W30_DEPT3, W30_DIV];

async function seed(db: PGlite) {
  await db.query(
    `INSERT INTO divisions (id, operational_name) VALUES ('Div1','x'), ('Div2','x'), ('Div4','x')`
  );
  await db.query(
    `INSERT INTO departments (id, division_id, legacy_name, operational_name) VALUES ('Dept3','Div1','x','x'), ('Dept4','Div2','x','x')`
  );
  for (const [id, v, at] of P1) {
    await db.query(
      `INSERT INTO stats (id, workspace_id, division_id, department_id, metric_key, value, recorded_at)
       VALUES ($1, NULL, 'Div1', NULL, 'artifacts_indexed', $2, $3)`,
      [id, v, at]
    );
  }
  for (const [id, dept, note] of [
    [W30_DIV, null, 'artifact-index.md counting basis (division primary)'],
    [W30_DEPT3, 'Dept3', 'artifact-index.md counting basis'],
  ] as const) {
    await db.query(
      `INSERT INTO stats (id, workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by)
       VALUES ($1, $2, 'Div1', $3, 'artifacts_indexed', 75, $4, $5, 'week-close-poster')`,
      [id, W30, dept, OLD_W30, JSON.stringify(W30_BASIS(note))]
    );
  }
  // Rows that must not change: W30 non-Div1 (active + superseded), W31 Div1, a workspace-less
  // non-Div1 row, another workspace.
  await db.query(
    `INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by, superseded_at, superseded_reason) VALUES
       ('div-live-2026-W30', 'Div2', NULL, 'leads_or_touchpoints_created', 0, '2026-07-23T11:59:59.999Z', '{"correction":"x"}', 'div-live-correction-2026-10-31', NULL, NULL),
       ('div-live-2026-W30', 'Div2', 'Dept4', 'content_pieces_shipped', 0, '2026-07-26T21:59:59.999Z', NULL, NULL, '2026-10-31T16:31:48.353Z', 'Div7 2026-10-31: x'),
       ('div-live-2026-W31', 'Div1', NULL, 'artifacts_indexed', 0, '2026-07-30T11:59:59.999Z', '{"correction":"2026-10-31_backfill_div1_artifacts_indexed_w31_w44"}', 'week-close-poster', NULL, NULL),
       (NULL, 'Div4', NULL, 'shipped_outputs', 1, '2026-07-09T12:00:00.000Z', NULL, NULL, NULL, NULL),
       ('gfp-live-2026-W30', 'Div2', NULL, 'leads_or_touchpoints_created', 4, '2026-07-23T11:59:59.999Z', NULL, NULL, NULL, NULL)`
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

/** Every column of every row, ordered by id. */
async function allRows(db: PGlite) {
  return (await db.query(`SELECT * FROM stats ORDER BY id`)).rows;
}
async function counts(db: PGlite) {
  const r = await db.query<{ total: number; active: number }>(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE superseded_at IS NULL)::int AS active FROM stats`
  );
  return r.rows[0]!;
}
const UNDO = `BEGIN;
DELETE FROM stats WHERE basis->>'correction' = '${TAG}';
UPDATE stats SET superseded_at = NULL, superseded_reason = NULL
 WHERE id IN (${IDS.map((i) => `'${i}'`).join(', ')})
   AND superseded_reason IN ('${R1}', '${R2}');
COMMIT;`;

describe('2026-10-31 Div1 artifacts_indexed void W24-W28 + W30 repost SQL', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await createDabosTestDb();
    await seed(db);
  });
  afterEach(async () => {
    await db.close();
  });

  it('W30 close and window are org-week.ts statWeekWindow(2026, 30)', () => {
    const w = statWeekWindow(2026, 30);
    expect(recordedAtForClosedOrgWeek(w)).toBe(W30_CLOSE);
    expect([w.start.toISOString(), w.end.toISOString()]).toEqual([
      '2026-07-16T12:00:00.000Z',
      '2026-07-23T12:00:00.000Z',
    ]);
    expect(SQL).toContain(`w30_close constant timestamptz := '${W30_CLOSE}';`);
    expect(SQL).toContain(
      `'window', jsonb_build_object('start', '2026-07-16T12:00:00.000Z', 'end', '2026-07-23T12:00:00.000Z')`
    );
  });

  it('is one transaction, not a migration, and its undo lists the 7 real ids (no placeholder)', () => {
    expect(SQL.trimEnd().endsWith('COMMIT;')).toBe(true);
    expect(SQL.match(/^BEGIN;$/gm)).toHaveLength(1);
    const undo = SQL.slice(SQL.indexOf('-- Undo'), SQL.indexOf('\nBEGIN;'));
    for (const id of IDS) expect(undo).toContain(id);
    expect(undo).not.toMatch(/<[^>]*ids?[^>]*>/);
    expect(undo).toContain(R1);
    expect(undo).toContain(R2);
    expect(undo).toContain(`basis->>'correction' = '${TAG}'`);
  });

  it('supersedes the 7 rows with their exact reasons, posts one W30 Div1 row = 0, total +1, active -6, nothing else changes', async () => {
    const before = await allRows(db);
    const c0 = await counts(db);
    await run(db, SQL);
    const c1 = await counts(db);
    expect({ total: c1.total - c0.total, active: c1.active - c0.active }).toEqual({
      total: 1,
      active: -6,
    });

    const after = await allRows(db);
    const byId = new Map(
      after.map((r) => [String((r as { id: string }).id), r as Record<string, unknown>])
    );
    for (const b of before as Record<string, unknown>[]) {
      const a = byId.get(String(b.id))!;
      if (IDS.includes(String(b.id))) {
        expect(a.superseded_at).not.toBeNull();
        expect(a.superseded_reason).toBe(P1.some((p) => p[0] === b.id) ? R1 : R2);
        expect({ ...a, superseded_at: null, superseded_reason: null }).toEqual(b);
      } else {
        expect(a).toEqual(b);
      }
    }

    const live = await db.query<Record<string, unknown>>(
      `SELECT workspace_id, department_id, value::text AS value, recorded_at, recorded_by, basis FROM stats
        WHERE workspace_id = $1 AND division_id = 'Div1' AND metric_key = 'artifacts_indexed' AND superseded_at IS NULL`,
      [W30]
    );
    expect(live.rows).toHaveLength(1);
    const r = live.rows[0]!;
    expect([
      r.department_id,
      r.value,
      (r.recorded_at as Date).toISOString(),
      r.recorded_by,
    ]).toEqual([null, '0', W30_CLOSE, 'week-close-poster']);
    expect(r.basis).toEqual({
      ssot: 'DABOS/docs/wiki/index.md',
      rule: 'unique link targets (Logan ruling 2026-10-21)',
      note: 'Div1 basis: link targets added to docs/wiki/index.md during the stat week as a set difference (Thu 14:00 -> Thu 14:00 Europe/Berlin; event-week rule); removals not subtracted, a re-pointed link counts as added',
      method:
        'set difference: targets at the W30 close not in the targets at the W29 close, on DABOS main as published on GitHub at each close (parent 2 at sync merges)',
      year: 2026,
      week: 30,
      window: { start: '2026-07-16T12:00:00.000Z', end: '2026-07-23T12:00:00.000Z' },
      index_unique_before: 218,
      index_unique_after: 218,
      index_targets_removed: 0,
      dabos_main_at_close: MAIN_W30.slice(0, 8),
      git_start_commit: MAIN_W29,
      git_end_commit: MAIN_W30,
      supersedes: [W30_DIV, W30_DEPT3],
      ruling: 'Dept14 ruling 2026-10-31 17:45',
      correction: TAG,
    });
    const nullWs = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM stats WHERE workspace_id IS NULL AND division_id = 'Div1' AND superseded_at IS NULL`
    );
    expect(nullWs.rows[0]!.n).toBe(0);
    const dept3 = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM stats WHERE workspace_id = $1 AND department_id = 'Dept3' AND superseded_at IS NULL`,
      [W30]
    );
    expect(dept3.rows[0]!.n).toBe(0);
  });

  it('re-running after success is a no-op', async () => {
    await run(db, SQL);
    const once = await allRows(db);
    await run(db, SQL);
    expect(await allRows(db)).toEqual(once);
  });

  it('a re-run aborts unchanged (guard 5b) if a new workspace-less Div1 artifacts_indexed row appeared after success', async () => {
    await run(db, SQL);
    await db.query(
      `INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at) VALUES (NULL, 'Div1', 'artifacts_indexed', 7, '2026-07-16T12:00:00.000Z')`
    );
    const before = await allRows(db);
    await expect(run(db, SQL)).rejects.toThrow(/guard 5b/);
    expect(await allRows(db)).toEqual(before);
  });

  it('the header undo restores the table exactly and touches no other row', async () => {
    const before = await allRows(db);
    await run(db, SQL);
    await run(db, UNDO);
    expect(await allRows(db)).toEqual(before);
  });

  const abortsUnchanged = async (sql: string, re: RegExp) => {
    const before = await allRows(db);
    await expect(run(db, sql)).rejects.toThrow(re);
    expect(await allRows(db)).toEqual(before);
  };

  // State mutations: the prod rows are not as read.
  for (const [label, mutate, re] of [
    [
      'W24 value 2277 -> 2278',
      `UPDATE stats SET value = 2278 WHERE id = '${P1[0]![0]}'`,
      /guard 1:/,
    ],
    [
      'W28 recorded_at moved',
      `UPDATE stats SET recorded_at = '2026-07-09T12:00:00.001Z' WHERE id = '${P1[4]![0]}'`,
      /guard 1:/,
    ],
    [
      'W26 given a workspace',
      `UPDATE stats SET workspace_id = 'div-live-2026-W26' WHERE id = '${P1[2]![0]}'`,
      /guard 1:/,
    ],
    ['W27 given a basis', `UPDATE stats SET basis = '{}' WHERE id = '${P1[3]![0]}'`, /guard 1:/],
    [
      'W30 division value 75 -> 74',
      `UPDATE stats SET value = 74 WHERE id = '${W30_DIV}'`,
      /guard 1:/,
    ],
    [
      'W30 Dept3 basis changed',
      `UPDATE stats SET basis = basis || '{"x":1}' WHERE id = '${W30_DEPT3}'`,
      /guard 1:/,
    ],
    [
      'W30 Dept3 recorded_by changed',
      `UPDATE stats SET recorded_by = NULL WHERE id = '${W30_DEPT3}'`,
      /guard 1:/,
    ],
    [
      'W25 already superseded (partial state)',
      `UPDATE stats SET superseded_at = now(), superseded_reason = 'x' WHERE id = '${P1[1]![0]}'`,
      /guard 1: unexpected state/,
    ],
    [
      'W30 row already superseded with the ruling reason',
      `UPDATE stats SET superseded_at = now(), superseded_reason = '${R2}' WHERE id = '${W30_DIV}'`,
      /guard 1: unexpected state/,
    ],
    [
      'a tagged row already exists',
      `INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at, basis) VALUES ('${W30}', 'Div1', 'artifacts_indexed', 0, '${W30_CLOSE}', '{"correction":"${TAG}"}')`,
      /guard 1: unexpected state/,
    ],
    [
      'an unlisted workspace-less Div1 artifacts_indexed row',
      `INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at) VALUES (NULL, 'Div1', 'artifacts_indexed', 5, '2026-06-04T12:00:00.000Z')`,
      /guard 1b/,
    ],
    [
      'an unlisted Div1 W30 row',
      `INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at) VALUES ('${W30}', 'Div1', 'wiki_pages', 1, '${W30_CLOSE}')`,
      /guard 1c/,
    ],
    [
      'a listed row deleted',
      `DELETE FROM stats WHERE id = '${P1[0]![0]}'`,
      /guard 1: unexpected state/,
    ],
  ] as const) {
    it(`aborts unchanged when ${label}`, async () => {
      await db.query(mutate);
      await abortsUnchanged(SQL, re);
    });
  }

  // Script mutations: each guard catches its own fault.
  const mutated = (from: string, to: string, count = 1) => {
    expect(SQL.split(from).length - 1).toBe(count);
    return SQL.split(from).join(to);
  };
  for (const [label, from, to, count, re] of [
    [
      'a part 1 reason differs',
      `NULL, NULL, 1, '${R1}'),\n  ('eb1e15a5`,
      `NULL, NULL, 1, '${R1}.'),\n  ('eb1e15a5`,
      1,
      /guard 0c/,
    ],
    [
      'a W30 reason differs',
      `'6f6139ecf5cbfb94289272c706d9fe9d', 2, '${R2}'`,
      `'6f6139ecf5cbfb94289272c706d9fe9d', 2, 'Dept14 2026-10-31: x'`,
      1,
      /guard 0c/,
    ],
    [
      'the W30 value is 1',
      'w30_val constant numeric := 0;',
      'w30_val constant numeric := 1;',
      1,
      /guard 0d/,
    ],
    [
      'a removal is assumed',
      'removed constant integer := 0;',
      'removed constant integer := 1;',
      1,
      /guard 0d/,
    ],
    [
      'the W30 basis md5 is wrong',
      "'6f6139ecf5cbfb94289272c706d9fe9d'",
      "'6f6139ecf5cbfb94289272c706d9fe9e'",
      1,
      /guard 1:/,
    ],
    [
      'another row is changed',
      '    -- Guard 4: nothing else changed',
      "    UPDATE stats SET value = value + 1 WHERE workspace_id = 'gfp-live-2026-W30';\n    -- Guard 4: nothing else changed",
      1,
      /guard 4:/,
    ],
    [
      'a listed row value is changed',
      '    UPDATE stats s SET superseded_at = now(), superseded_reason = f.reason',
      '    UPDATE stats s SET value = s.value + 0.5, superseded_at = now(), superseded_reason = f.reason',
      1,
      /guard 4b/,
    ],
    [
      'the repost is inserted twice',
      "           'week-close-poster';\n    GET DIAGNOSTICS n = ROW_COUNT;",
      "           'week-close-poster'\n      FROM generate_series(1, 2);\n    GET DIAGNOSTICS n = ROW_COUNT;",
      1,
      /guard 3/,
    ],
    [
      'an unrelated row is posted',
      '    -- Guard 4: nothing else changed',
      `    INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at) VALUES ('x', 'Div1', 'x', 1, now());\n    -- Guard 4: nothing else changed`,
      1,
      /guard 4:/,
    ],
    [
      'a second tagged row is posted',
      '    -- Guard 4: nothing else changed',
      `    INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at, basis) VALUES ('x', 'Div1', 'x', 1, now(), '{"correction":"${TAG}"}');\n    -- Guard 4: nothing else changed`,
      1,
      /guard 4c/,
    ],
    [
      'the repost goes to Dept3',
      "    SELECT w30, 'Div1', NULL, 'artifacts_indexed', w30_val, w30_close,",
      "    SELECT w30, 'Div1', 'Dept3', 'artifacts_indexed', w30_val, w30_close,",
      1,
      /guard 5c/,
    ],
    [
      'the repost is at the old Sunday end',
      "    SELECT w30, 'Div1', NULL, 'artifacts_indexed', w30_val, w30_close,",
      `    SELECT w30, 'Div1', NULL, 'artifacts_indexed', w30_val, '${OLD_W30}'::timestamptz,`,
      1,
      /guard 5c/,
    ],
  ] as const) {
    it(`aborts unchanged when ${label} (mutation)`, async () => {
      await abortsUnchanged(mutated(from, to, count), re);
    });
  }
});

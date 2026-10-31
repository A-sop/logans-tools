// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { postGfpWeeklyStats } from '@/lib/dabos/gfp-weekly-stats';
import {
  isInClosedOrgWeek,
  recordedAtForClosedOrgWeek,
  statWeekFromWorkspaceId,
  statWeekWindow,
} from '@/lib/dabos/org-week';
import { createDabosTestDb, pgliteSql, readRepoFile } from '@/test/pglite-dabos';

/**
 * Guards of scripts/dabos/sql/2026-10-31_supersede_gfp_live_w27_w42.sql, on made-up data in an
 * in-process Postgres. Ids, departments and old recorded_at match the script (and DABOS Neon,
 * read-only 2026-10-31); nothing here connects to any network database.
 */
const SQL_PATH = 'scripts/dabos/sql/2026-10-31_supersede_gfp_live_w27_w42.sql';
const CORRECTION_SQL = readRepoFile(SQL_PATH);
const W43_W44_SQL = readRepoFile('scripts/dabos/sql/2026-10-31_supersede_gfp_live_w43_w44.sql');
const TAG = '2026-10-31_supersede_gfp_live_w27_w42';
const TAG_45 = '2026-10-31_supersede_gfp_live_w43_w44';
const REASON =
  'Dept13 2026-10-31: old gfp poster ISO Mon-Sun window, W27-W42 (not Thu 14:00 Berlin close)';
const WEEKS = Array.from({ length: 16 }, (_, i) => 27 + i);
const ws = (week: number) => `gfp-live-2026-W${String(week).padStart(2, '0')}`;
const W27_W42 = WEEKS.map(ws);

/** [id, week, department, metric, old recorded_at, old recorded_by] read-only from DABOS Neon. */
const OLD: [string, number, string | null, string, string, string | null][] = [
  [
    '60949ad3-e4ce-47ff-8802-7003b623f320',
    27,
    'Dept16',
    'lead_magnets_shipped',
    '2026-07-05T21:59:59.999Z',
    null,
  ],
  [
    'e6dd6c10-8205-41af-8096-5796f3ddefc5',
    27,
    'Dept17',
    'termin_clicks',
    '2026-07-05T21:59:59.999Z',
    null,
  ],
  [
    'f7af684f-6cba-4549-9baa-9ea374c3c034',
    27,
    null,
    'conversions',
    '2026-07-05T21:59:59.999Z',
    null,
  ],
  [
    'be47600c-9496-455a-8de6-6cac22254314',
    28,
    'Dept16',
    'lead_magnets_shipped',
    '2026-07-12T21:59:59.999Z',
    null,
  ],
  [
    '834ebf7b-2cb4-4281-a9a3-00eafe0ea43b',
    28,
    'Dept17',
    'termin_clicks',
    '2026-07-12T21:59:59.999Z',
    null,
  ],
  [
    '04ab5f75-5325-4ad6-b6b0-1a1cd651ae8d',
    28,
    null,
    'conversions',
    '2026-07-12T21:59:59.999Z',
    null,
  ],
  [
    '51a4f55a-27e8-46ef-a1f5-f0125f38f552',
    29,
    'Dept16',
    'lead_magnets_shipped',
    '2026-07-19T21:59:59.999Z',
    null,
  ],
  [
    'f51b24df-ee4d-412c-9470-a3be0d95bf08',
    29,
    'Dept17',
    'termin_clicks',
    '2026-07-19T21:59:59.999Z',
    null,
  ],
  [
    'a03cbc3c-55aa-4c86-8ff6-94b155a349ef',
    29,
    null,
    'conversions',
    '2026-07-19T21:59:59.999Z',
    null,
  ],
  [
    '94670beb-d3d2-4109-95f3-3332e9b4e74f',
    30,
    'Dept16',
    'lead_magnets_shipped',
    '2026-07-26T21:59:59.999Z',
    null,
  ],
  [
    'c3436f01-621a-4343-bc16-d1058b661cad',
    30,
    'Dept17',
    'termin_clicks',
    '2026-07-26T21:59:59.999Z',
    null,
  ],
  [
    '45082101-9af2-470d-a3ff-5fe8ef57a3f4',
    30,
    null,
    'conversions',
    '2026-07-26T21:59:59.999Z',
    null,
  ],
  [
    '7b41a49f-07cc-4b67-a429-6952d4d7fd8d',
    31,
    'Dept16',
    'lead_magnets_shipped',
    '2026-08-02T21:59:59.999Z',
    'gfp-poster',
  ],
  [
    '42fc5ebd-2648-477b-bdbd-0564556e8c72',
    31,
    'Dept17',
    'termin_clicks',
    '2026-08-02T21:59:59.999Z',
    'gfp-poster',
  ],
  [
    'b35e14ff-b2b9-4d68-bea5-81f97884c701',
    31,
    null,
    'conversions',
    '2026-08-02T21:59:59.999Z',
    'gfp-poster',
  ],
  [
    'ae15c767-85ac-41b4-b561-3a9bae8aef61',
    32,
    'Dept16',
    'lead_magnets_shipped',
    '2026-08-09T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '0a65aeb6-0832-4e82-972c-7e6d5093bb83',
    32,
    'Dept17',
    'termin_clicks',
    '2026-08-09T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '0659b1c9-76f8-4c07-96d4-9809210e6d03',
    32,
    null,
    'conversions',
    '2026-08-09T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '6250263b-9548-4ae9-a99e-2eff71ad5915',
    33,
    'Dept16',
    'lead_magnets_shipped',
    '2026-08-16T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    'e710604e-6a65-4ab3-a8f3-07cc1c68c5bc',
    33,
    'Dept17',
    'termin_clicks',
    '2026-08-16T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    'e2fdb7fe-c996-41b6-9c67-4228dc1197aa',
    33,
    null,
    'conversions',
    '2026-08-16T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    'c3bade55-fe5b-44de-8ef2-6d36aca6c191',
    34,
    'Dept16',
    'lead_magnets_shipped',
    '2026-08-23T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '0736217d-a330-4fd8-87eb-42d1c5c14293',
    34,
    'Dept17',
    'termin_clicks',
    '2026-08-23T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '80ef9a7a-d605-42ad-80ef-148553b83e70',
    34,
    null,
    'conversions',
    '2026-08-23T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '9746cd31-dac0-4d80-b185-661015c7e081',
    35,
    'Dept16',
    'lead_magnets_shipped',
    '2026-08-30T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '76b145a5-957b-4028-acac-1779565c28ab',
    35,
    'Dept17',
    'termin_clicks',
    '2026-08-30T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '957bc095-4f6c-4fe1-9666-6b7eff43fcf4',
    35,
    null,
    'conversions',
    '2026-08-30T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '3037e6a7-0e3f-4af8-a649-82e138f9eea3',
    36,
    'Dept16',
    'lead_magnets_shipped',
    '2026-09-06T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    'af888689-75a5-43f5-a661-b2cae0a21b43',
    36,
    'Dept17',
    'termin_clicks',
    '2026-09-06T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    'e9299d8b-65bf-4a9c-98d5-738cffcd0bde',
    36,
    null,
    'conversions',
    '2026-09-06T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '4dbb8b49-db96-49cf-a443-cabce3c1725e',
    37,
    'Dept16',
    'lead_magnets_shipped',
    '2026-09-13T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '553feb61-469f-4be5-aa0f-e6ef5891e9f1',
    37,
    'Dept17',
    'termin_clicks',
    '2026-09-13T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    'a2dde6b7-d537-4333-8f7a-6b95a7505fae',
    37,
    null,
    'conversions',
    '2026-09-13T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '3d9131f3-ec97-44ad-80c4-7749f353074f',
    38,
    'Dept16',
    'lead_magnets_shipped',
    '2026-09-20T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '78b5818f-edfe-4c4e-9a59-ca3e42b1941e',
    38,
    'Dept17',
    'termin_clicks',
    '2026-09-20T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    'a36708aa-6c24-4000-b078-1bfb05049a6f',
    38,
    null,
    'conversions',
    '2026-09-20T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '1fde379d-59e9-4bdf-af8f-473ded8c8aa2',
    39,
    'Dept16',
    'lead_magnets_shipped',
    '2026-09-27T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '261047d7-9762-479e-843b-5fb3b5c25a9f',
    39,
    'Dept17',
    'termin_clicks',
    '2026-09-27T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '4e87e1ba-fff1-42be-9056-e28eb3c2821d',
    39,
    null,
    'conversions',
    '2026-09-27T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '40e71d7f-c8b5-4fd0-ae63-5478ca0cbdea',
    40,
    'Dept16',
    'lead_magnets_shipped',
    '2026-10-04T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    'cca02b36-16ea-4507-82f3-31a63e827596',
    40,
    'Dept17',
    'termin_clicks',
    '2026-10-04T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '516ede1f-514d-49c6-9ec8-538ef1af41b2',
    40,
    null,
    'conversions',
    '2026-10-04T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '2459c204-bba3-4066-a083-94f15918a0b0',
    41,
    'Dept16',
    'lead_magnets_shipped',
    '2026-10-11T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '79dc6738-8fbb-48a3-b023-e525cc8ee39c',
    41,
    'Dept17',
    'termin_clicks',
    '2026-10-11T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    'aed59ccb-d7d3-4a3c-8e98-fe1b0f925b9a',
    41,
    null,
    'conversions',
    '2026-10-11T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '72d5a743-8f16-45df-8f81-ed8e9dc36567',
    42,
    'Dept16',
    'lead_magnets_shipped',
    '2026-10-18T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    '38c60e4d-9a4c-4586-a3a6-1bf325b9361e',
    42,
    'Dept17',
    'termin_clicks',
    '2026-10-18T23:59:59.999Z',
    'gfp-poster',
  ],
  [
    'ae283f25-5dd2-4aa0-9970-76198791b08f',
    42,
    null,
    'conversions',
    '2026-10-18T23:59:59.999Z',
    'gfp-poster',
  ],
];

/** The 6 W43/W44 rows handled by #45 (same ids/recorded_at as that script). */
const OLD_45: [string, number, string | null, string, string][] = [
  ['d85a538c-c244-4f21-b732-5c38d342e0cd', 43, null, 'conversions', '2026-10-25T23:59:59.999Z'],
  [
    '07033c3c-bb9e-4221-bfe2-2c78112e3350',
    43,
    'Dept16',
    'lead_magnets_shipped',
    '2026-10-25T23:59:59.999Z',
  ],
  [
    'ff6e2032-f293-4faf-b753-448fffdb99a2',
    43,
    'Dept17',
    'termin_clicks',
    '2026-10-25T23:59:59.999Z',
  ],
  ['c5ceb4c5-0adc-49a3-a4f4-44a0c305e0ea', 44, null, 'conversions', '2026-11-01T23:59:59.999Z'],
  [
    '3d48f1b2-b2e7-4823-8633-b442698cbb0c',
    44,
    'Dept16',
    'lead_magnets_shipped',
    '2026-11-01T23:59:59.999Z',
  ],
  [
    '22611c50-fc80-432b-b518-1b2705ec55e0',
    44,
    'Dept17',
    'termin_clicks',
    '2026-11-01T23:59:59.999Z',
  ],
];

type SeedOpts = {
  skip?: string;
  value?: { id: string; value: number };
  oldAt?: { id: string; at: string };
  apply45?: boolean;
};

async function seed(db: PGlite, opts: SeedOpts = {}) {
  await db.query(`INSERT INTO divisions (id, operational_name) VALUES ('Div6', 'Div6')`);
  await db.query(
    `INSERT INTO departments (id, division_id, legacy_name, operational_name) VALUES ('Dept16','Div6','x','x'), ('Dept17','Div6','x','x')`
  );
  for (const [id, week, dept, metric, at, by] of OLD) {
    if (id === opts.skip) continue;
    // W27..W30 were written without basis/recorded_by; later weeks by the old gfp-poster.
    await db.query(
      `INSERT INTO stats (id, workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by)
       VALUES ($1, $2, 'Div6', $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        id,
        ws(week),
        dept,
        metric,
        opts.value?.id === id ? opts.value.value : 0,
        opts.oldAt?.id === id ? opts.oldAt.at : at,
        by === null ? null : JSON.stringify({ note: 'old', week, year: 2026 }),
        by,
      ]
    );
  }
  for (const [id, week, dept, metric, at] of OLD_45) {
    await db.query(
      `INSERT INTO stats (id, workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by)
       VALUES ($1, $2, 'Div6', $3, $4, 0, $5, '{"note":"old"}'::jsonb, 'gfp-poster')`,
      [id, ws(week), dept, metric, at]
    );
  }
  // Out of scope: the div-live workspace. Must never be touched.
  await db.query(
    `INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at) VALUES
       ('div-live-2026-W42', 'Div6', 'conversions', 5, '2026-10-18T23:59:59.999Z')`
  );
  if (opts.apply45 !== false) await runSql(db, W43_W44_SQL);
}

/** Run like `psql -v ON_ERROR_STOP=1`: on error the session ends, so roll back. */
async function runSql(db: PGlite, sql: string): Promise<void> {
  try {
    await db.exec(sql);
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}
const runCorrection = (db: PGlite) => runSql(db, CORRECTION_SQL);

/** The commented undo block between the UNDO markers, uncommented. */
const UNDO_SQL = CORRECTION_SQL.split(/-- UNDO-BEGIN\r?\n/)[1]!
  .split('-- UNDO-END')[0]!
  .split(/\r?\n/)
  .map((l) => l.replace(/^-- ?/, ''))
  .join('\n');

async function counts(db: PGlite) {
  const r = await db.query<{ superseded: number; total: number; active: number }>(
    `SELECT
      (SELECT count(*)::int FROM stats WHERE superseded_at IS NOT NULL) AS superseded,
      (SELECT count(*)::int FROM stats) AS total,
      (SELECT count(*)::int FROM stats WHERE workspace_id = ANY($1::text[]) AND superseded_at IS NULL) AS active`,
    [W27_W42]
  );
  return r.rows[0]!;
}

type Row = {
  id: string;
  workspace_id: string;
  department_id: string | null;
  metric_key: string;
  value: string;
  recorded_at: Date;
  basis: Record<string, unknown>;
  recorded_by: string | null;
};

async function activeRows(db: PGlite, workspaces = W27_W42): Promise<Row[]> {
  const r = await db.query<Row>(
    `SELECT id, workspace_id, department_id, metric_key, value::text AS value, recorded_at, basis, recorded_by
       FROM stats WHERE workspace_id = ANY($1::text[]) AND superseded_at IS NULL
      ORDER BY workspace_id, metric_key`,
    [workspaces]
  );
  return r.rows;
}

/** Acceptance check: every active gfp-live row is inside its own week and in no later week's window. */
async function overlaps(db: PGlite): Promise<string[]> {
  const r = await db.query<{ workspace_id: string; recorded_at: Date }>(
    `SELECT workspace_id, recorded_at FROM stats WHERE workspace_id LIKE 'gfp-live-%' AND superseded_at IS NULL`
  );
  const bad: string[] = [];
  for (const row of r.rows) {
    const w = statWeekFromWorkspaceId(row.workspace_id)!;
    if (!isInClosedOrgWeek(row.recorded_at, statWeekWindow(w.year, w.week))) {
      bad.push(`${row.workspace_id} outside own window`);
    }
    for (let later = w.week + 1; later <= 45; later += 1) {
      if (isInClosedOrgWeek(row.recorded_at, statWeekWindow(w.year, later))) {
        bad.push(`${row.workspace_id} inside W${later}`);
      }
    }
  }
  return bad;
}

// PGlite cold start is slow on Windows (see #44); give each test headroom.
describe('2026-10-31 gfp-live W27..W42 correction SQL', { timeout: 60_000 }, () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await createDabosTestDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('inline weeks match org-week.ts: windows, recorded_at = Thu 14:00 Berlin close - 1 ms, DST-aware, contiguous', () => {
    for (let week = 27; week <= 44; week += 1) {
      const w = statWeekWindow(2026, week);
      expect(CORRECTION_SQL).toContain(
        `(${week}, '${w.start.toISOString()}', '${w.end.toISOString()}', '${recordedAtForClosedOrgWeek(w)}')`
      );
      if (week < 44) {
        // CEST: the close is 12:00Z, so recorded_at is 11:59:59.999Z.
        expect(recordedAtForClosedOrgWeek(w)).toMatch(/T11:59:59\.999Z$/);
        expect(w.end.getTime()).toBe(statWeekWindow(2026, week + 1).start.getTime());
      }
    }
    // First week after the switch to CET (25 Oct) closes at 13:00Z.
    expect(recordedAtForClosedOrgWeek(statWeekWindow(2026, 44))).toBe('2026-10-29T12:59:59.999Z');
    expect(recordedAtForClosedOrgWeek(statWeekWindow(2026, 27))).toBe('2026-07-02T11:59:59.999Z');
    expect(recordedAtForClosedOrgWeek(statWeekWindow(2026, 42))).toBe('2026-10-15T11:59:59.999Z');
    expect(OLD).toHaveLength(48);
    for (const [id] of OLD) expect(CORRECTION_SQL).toContain(`'${id}'`);
  });

  it('before: W42 old recorded_at sits inside the W43 window (the overlap being removed)', async () => {
    await seed(db);
    expect(await overlaps(db)).toContain('gfp-live-2026-W42 inside W43');
  });

  it('supersedes the 48 old rows (not deleted), one active row per metric per week at the close, same values, no overlap', async () => {
    await seed(db);
    expect(await counts(db)).toEqual({ superseded: 6, total: 61, active: 48 });
    const before = await activeRows(db);
    await runCorrection(db);
    // 48 old + 48 new + 6/6 W43/W44 + 1 unrelated: nothing deleted.
    expect(await counts(db)).toEqual({ superseded: 54, total: 109, active: 48 });

    const old = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM stats WHERE id = ANY($1::uuid[]) AND superseded_reason = $2 AND superseded_at IS NOT NULL`,
      [OLD.map((o) => o[0]), REASON]
    );
    expect(old.rows[0]!.n).toBe(48);

    const after = await activeRows(db);
    expect(after).toHaveLength(48);
    for (const row of after) {
      const w = statWeekFromWorkspaceId(row.workspace_id)!;
      const prev = before.find(
        (b) => b.workspace_id === row.workspace_id && b.metric_key === row.metric_key
      )!;
      expect(row.value).toBe(prev.value);
      expect(row.department_id).toBe(prev.department_id);
      expect(row.recorded_at.toISOString()).toBe(
        recordedAtForClosedOrgWeek(statWeekWindow(2026, w.week))
      );
      expect(row.recorded_by).toBe('gfp-poster');
      expect(row.basis.correction).toBe(TAG);
    }
    const perPair = new Set(after.map((r) => `${r.workspace_id}/${r.metric_key}`));
    expect(perPair.size).toBe(48);
    expect(await overlaps(db)).toEqual([]);

    const untouched = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM stats WHERE (workspace_id = 'div-live-2026-W42' OR basis->>'correction' = $1) AND superseded_at IS NULL`,
      [TAG_45]
    );
    expect(untouched.rows[0]!.n).toBe(7);
  });

  it('corrected rows equal what the current poster writes for W27..W42 (values, recorded_at, basis wording)', async () => {
    await seed(db);
    await runCorrection(db);
    const corrected = await activeRows(db);

    // Fresh DABOS db + GFP campaign_leads shaped like GFP Neon (read-only counts 2026-10-31): no guide
    // lead created and nothing booked in any W27..W42 window; one non-guide lead in W28, older leads.
    const fresh = await createDabosTestDb();
    const gfp = new PGlite();
    await gfp.exec(
      `CREATE TABLE campaign_leads (campaign_slug text, created_at timestamptz, status text, booked_at timestamptz)`
    );
    await gfp.exec(
      `INSERT INTO campaign_leads VALUES
         ('guide-get-set-up-en', '2026-06-01T10:00:00Z', 'new', NULL),
         ('kontakt', '2026-07-05T10:00:00Z', 'new', NULL)`
    );
    try {
      await fresh.query(`INSERT INTO divisions (id, operational_name) VALUES ('Div6', 'Div6')`);
      await fresh.query(
        `INSERT INTO departments (id, division_id, legacy_name, operational_name) VALUES ('Dept16','Div6','x','x'), ('Dept17','Div6','x','x')`
      );
      for (const week of WEEKS) {
        const r = await postGfpWeeklyStats({
          dabosSql: pgliteSql(fresh),
          gfpSql: pgliteSql(gfp),
          year: 2026,
          week,
        });
        expect(r.inserted).toEqual(['lead_magnets_shipped', 'termin_clicks', 'conversions']);
      }
      const posted = await activeRows(fresh);
      const strip = (rows: Row[]) =>
        rows.map(({ basis, id, ...rest }) => {
          void id;
          const { correction, ...b } = basis;
          void correction;
          return { ...rest, recorded_at: rest.recorded_at.toISOString(), basis: b };
        });
      expect(strip(corrected)).toEqual(strip(posted));
    } finally {
      await fresh.close();
      await gfp.close();
    }
  });

  it('after the correction the poster is a no-op for W27..W42 (insert_if_absent sees the rows)', async () => {
    await seed(db);
    await runCorrection(db);
    const gfp = new PGlite();
    await gfp.exec(
      `CREATE TABLE campaign_leads (campaign_slug text, created_at timestamptz, status text, booked_at timestamptz)`
    );
    try {
      for (const week of [27, 31, 42]) {
        const r = await postGfpWeeklyStats({
          dabosSql: pgliteSql(db),
          gfpSql: pgliteSql(gfp),
          year: 2026,
          week,
        });
        expect(r.inserted).toEqual([]);
      }
    } finally {
      await gfp.close();
    }
    expect(await counts(db)).toEqual({ superseded: 54, total: 109, active: 48 });
  });

  it('aborts on re-run and changes nothing', async () => {
    await seed(db);
    await runCorrection(db);
    await expect(runCorrection(db)).rejects.toThrow(/guard 1:/);
    expect(await counts(db)).toEqual({ superseded: 54, total: 109, active: 48 });
  });

  it('aborts when #45 (W43/W44) has not been applied first', async () => {
    await seed(db, { apply45: false });
    await expect(runCorrection(db)).rejects.toThrow(
      /guard 0c: apply 2026-10-31_supersede_gfp_live_w43_w44\.sql first/
    );
    expect(await counts(db)).toEqual({ superseded: 0, total: 55, active: 48 });
  });

  it('aborts and rolls back when an expected row is missing', async () => {
    await seed(db, { skip: OLD[20]![0] });
    await expect(runCorrection(db)).rejects.toThrow(/guard 1: expected 48 active old rows/);
    expect(await counts(db)).toEqual({ superseded: 6, total: 60, active: 47 });
  });

  it('aborts when an old row value differs (values must stay the same)', async () => {
    await seed(db, { value: { id: OLD[0]![0], value: 3 } });
    await expect(runCorrection(db)).rejects.toThrow(/guard 1:/);
    expect(await counts(db)).toEqual({ superseded: 6, total: 61, active: 48 });
  });

  it('aborts when an old row is not at its exact old recorded_at (W31 Berlin-local vs UTC Sunday end)', async () => {
    const w31 = OLD.find((o) => o[1] === 31)!;
    await seed(db, { oldAt: { id: w31[0], at: '2026-08-02T23:59:59.999Z' } });
    await expect(runCorrection(db)).rejects.toThrow(/guard 1:/);
    expect(await counts(db)).toEqual({ superseded: 6, total: 61, active: 48 });
  });

  it('aborts when an unlisted row exists in any of the 16 workspaces', async () => {
    await seed(db);
    await db.query(
      `INSERT INTO stats (workspace_id, division_id, metric_key, value, superseded_at) VALUES ('gfp-live-2026-W35', 'Div6', 'conversions', 0, now())`
    );
    await expect(runCorrection(db)).rejects.toThrow(/guard 1b/);
    expect(await counts(db)).toEqual({ superseded: 7, total: 62, active: 48 });
  });

  it('aborts when migration 021 has not been applied', async () => {
    await db.close();
    db = await createDabosTestDb({ withSupersede: false });
    await seed(db, { apply45: false });
    await expect(runCorrection(db)).rejects.toThrow(/guard 0: migration 021 not applied/);
  });

  it('undo (from the file) is scoped to the exact ids, row-count checked, and supersedes instead of deleting', async () => {
    await seed(db);
    // Before the correction the undo finds nothing to supersede and aborts.
    await expect(runSql(db, UNDO_SQL)).rejects.toThrow(
      /undo: superseded 0 corrected rows, expected 48/
    );

    await runCorrection(db);
    await runSql(db, UNDO_SQL);
    // Nothing deleted: same total; the 48 corrected rows are now superseded, the old ones active.
    expect(await counts(db)).toEqual({ superseded: 54, total: 109, active: 48 });
    const active = await activeRows(db);
    expect(active.map((r) => r.id).sort()).toEqual(OLD.map((o) => o[0]).sort());
    const undone = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM stats WHERE basis->>'correction' = $1 AND superseded_reason = $2`,
      [TAG, `Undo of ${TAG}`]
    );
    expect(undone.rows[0]!.n).toBe(48);
    // #45's W43/W44 rows are untouched by this undo.
    expect(await activeRows(db, [ws(43), ws(44)])).toHaveLength(6);
    expect(
      (await activeRows(db, [ws(43), ws(44)])).every((r) => r.basis.correction === TAG_45)
    ).toBe(true);

    // Running the undo twice aborts and changes nothing.
    await expect(runSql(db, UNDO_SQL)).rejects.toThrow(/undo: superseded 0/);
    expect(await counts(db)).toEqual({ superseded: 54, total: 109, active: 48 });
  });
});

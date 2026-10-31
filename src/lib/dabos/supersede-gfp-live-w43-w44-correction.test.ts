// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { postGfpWeeklyStats } from '@/lib/dabos/gfp-weekly-stats';
import { recordedAtForClosedOrgWeek, statWeekWindow } from '@/lib/dabos/org-week';
import { createDabosTestDb, pgliteSql, readRepoFile } from '@/test/pglite-dabos';

/**
 * Guards of scripts/dabos/sql/2026-10-31_supersede_gfp_live_w43_w44.sql, on made-up data in an
 * in-process Postgres. Ids and old recorded_at match the script (and DABOS Neon, read-only
 * 2026-10-31); nothing here connects to any network database.
 */
const SQL_PATH = 'scripts/dabos/sql/2026-10-31_supersede_gfp_live_w43_w44.sql';
const CORRECTION_SQL = readRepoFile(SQL_PATH);
const REASON = 'Dept13 2026-10-31: old gfp poster ISO Mon-Sun window (not Thu 14:00 Berlin close)';
const WS43 = 'gfp-live-2026-W43';
const WS44 = 'gfp-live-2026-W44';
const OLD_AT: Record<string, string> = {
  [WS43]: '2026-10-25T23:59:59.999Z',
  [WS44]: '2026-11-01T23:59:59.999Z',
};
const OLD: [string, string, string | null, string][] = [
  ['d85a538c-c244-4f21-b732-5c38d342e0cd', WS43, null, 'conversions'],
  ['07033c3c-bb9e-4221-bfe2-2c78112e3350', WS43, 'Dept16', 'lead_magnets_shipped'],
  ['ff6e2032-f293-4faf-b753-448fffdb99a2', WS43, 'Dept17', 'termin_clicks'],
  ['c5ceb4c5-0adc-49a3-a4f4-44a0c305e0ea', WS44, null, 'conversions'],
  ['3d48f1b2-b2e7-4823-8633-b442698cbb0c', WS44, 'Dept16', 'lead_magnets_shipped'],
  ['22611c50-fc80-432b-b518-1b2705ec55e0', WS44, 'Dept17', 'termin_clicks'],
];

async function seed(db: PGlite, opts: { skip?: string; value?: number; oldAt44?: string } = {}) {
  await db.query(`INSERT INTO divisions (id, operational_name) VALUES ('Div6', 'Div6')`);
  await db.query(
    `INSERT INTO departments (id, division_id, legacy_name, operational_name) VALUES ('Dept16','Div6','x','x'), ('Dept17','Div6','x','x')`
  );
  for (const [id, ws, dept, metric] of OLD) {
    if (id === opts.skip) continue;
    const at = ws === WS44 && opts.oldAt44 ? opts.oldAt44 : OLD_AT[ws];
    await db.query(
      `INSERT INTO stats (id, workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by)
       VALUES ($1, $2, 'Div6', $3, $4, $5, $6, '{"note":"old"}'::jsonb, 'gfp-poster')`,
      [id, ws, dept, metric, id === OLD[0]![0] ? (opts.value ?? 0) : 0, at]
    );
  }
  // Out of scope: an older gfp week and the div-live W44 workspace. Must never be touched.
  await db.query(
    `INSERT INTO stats (workspace_id, division_id, metric_key, value, recorded_at) VALUES
       ('gfp-live-2026-W42', 'Div6', 'conversions', 0, '2026-10-18T23:59:59.999Z'),
       ('div-live-2026-W44', 'Div6', 'conversions', 5, '2026-11-01T23:59:59.999Z')`
  );
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
  const r = await db.query<{ superseded: number; total: number; active: number }>(`
    SELECT
      (SELECT count(*)::int FROM stats WHERE superseded_at IS NOT NULL) AS superseded,
      (SELECT count(*)::int FROM stats) AS total,
      (SELECT count(*)::int FROM stats WHERE workspace_id IN ('${WS43}','${WS44}') AND superseded_at IS NULL) AS active
  `);
  return r.rows[0]!;
}

type Row = {
  workspace_id: string;
  department_id: string | null;
  metric_key: string;
  value: string;
  recorded_at: Date;
  basis: Record<string, unknown>;
  recorded_by: string;
};

async function activeRows(db: PGlite): Promise<Row[]> {
  const r = await db.query<Row>(`
    SELECT workspace_id, department_id, metric_key, value::text AS value, recorded_at, basis, recorded_by
      FROM stats WHERE workspace_id IN ('${WS43}','${WS44}') AND superseded_at IS NULL
     ORDER BY workspace_id, metric_key`);
  return r.rows;
}

// PGlite cold start is slow on Windows (see #44); give each test headroom.
describe('2026-10-31 gfp-live W43/W44 correction SQL', { timeout: 30_000 }, () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await createDabosTestDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('recorded_at and windows in the script match org-week.ts (Thu 14:00 Berlin close - 1 ms)', () => {
    for (const week of [43, 44]) {
      const w = statWeekWindow(2026, week);
      expect(CORRECTION_SQL).toContain(`'${recordedAtForClosedOrgWeek(w)}'`);
      expect(CORRECTION_SQL).toContain(`'${w.start.toISOString()}', '${w.end.toISOString()}'`);
    }
    expect(recordedAtForClosedOrgWeek(statWeekWindow(2026, 44))).toBe('2026-10-29T12:59:59.999Z');
    expect(recordedAtForClosedOrgWeek(statWeekWindow(2026, 43))).toBe('2026-10-22T11:59:59.999Z');
  });

  it('supersedes the 6 old rows (not deleted) and leaves exactly one active row per metric at the close, same values', async () => {
    await seed(db);
    await runCorrection(db);
    // 6 old + 6 new + 2 unrelated: nothing deleted.
    expect(await counts(db)).toEqual({ superseded: 6, total: 14, active: 6 });

    const old = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM stats WHERE id = ANY($1::uuid[]) AND superseded_reason = $2`,
      [OLD.map((o) => o[0]), REASON]
    );
    expect(old.rows[0]!.n).toBe(6);

    const rows = await activeRows(db);
    expect(
      rows.map((r) => [
        r.workspace_id,
        r.department_id,
        r.metric_key,
        r.value,
        r.recorded_at.toISOString(),
        r.recorded_by,
      ])
    ).toEqual([
      [WS43, null, 'conversions', '0', '2026-10-22T11:59:59.999Z', 'gfp-poster'],
      [WS43, 'Dept16', 'lead_magnets_shipped', '0', '2026-10-22T11:59:59.999Z', 'gfp-poster'],
      [WS43, 'Dept17', 'termin_clicks', '0', '2026-10-22T11:59:59.999Z', 'gfp-poster'],
      [WS44, null, 'conversions', '0', '2026-10-29T12:59:59.999Z', 'gfp-poster'],
      [WS44, 'Dept16', 'lead_magnets_shipped', '0', '2026-10-29T12:59:59.999Z', 'gfp-poster'],
      [WS44, 'Dept17', 'termin_clicks', '0', '2026-10-29T12:59:59.999Z', 'gfp-poster'],
    ]);

    const untouched = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM stats WHERE workspace_id IN ('gfp-live-2026-W42','div-live-2026-W44') AND superseded_at IS NULL`
    );
    expect(untouched.rows[0]!.n).toBe(2);
  });

  it('corrected rows equal what the current poster writes for those weeks (values, recorded_at, basis wording)', async () => {
    await seed(db);
    await runCorrection(db);
    const corrected = await activeRows(db);

    // Fresh DABOS db + a GFP campaign_leads with zero leads/bookings in W43/W44 (read-only counts on
    // GFP Neon 2026-10-31: 0 guide leads and 0 booked_at in both windows, 0 booked without booked_at).
    const fresh = await createDabosTestDb();
    const gfp = new PGlite();
    await gfp.exec(
      `CREATE TABLE campaign_leads (campaign_slug text, created_at timestamptz, status text, booked_at timestamptz)`
    );
    await gfp.exec(
      `INSERT INTO campaign_leads VALUES ('guide-get-set-up-en', '2026-06-01T10:00:00Z', 'new', NULL)`
    );
    try {
      await fresh.query(`INSERT INTO divisions (id, operational_name) VALUES ('Div6', 'Div6')`);
      await fresh.query(
        `INSERT INTO departments (id, division_id, legacy_name, operational_name) VALUES ('Dept16','Div6','x','x'), ('Dept17','Div6','x','x')`
      );
      for (const week of [43, 44]) {
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
        rows.map(({ basis, ...rest }) => {
          const { correction, ...b } = basis;
          void correction;
          return { ...rest, recorded_at: rest.recorded_at.toISOString(), basis: b };
        });
      expect(strip(corrected)).toEqual(strip(posted));
      expect(
        corrected.every((r) => r.basis.correction === '2026-10-31_supersede_gfp_live_w43_w44')
      ).toBe(true);
    } finally {
      await fresh.close();
      await gfp.close();
    }
  });

  it('after the correction the poster is a no-op for W43/W44 (insert_if_absent sees the rows)', async () => {
    await seed(db);
    await runCorrection(db);
    const gfp = new PGlite();
    await gfp.exec(
      `CREATE TABLE campaign_leads (campaign_slug text, created_at timestamptz, status text, booked_at timestamptz)`
    );
    try {
      for (const week of [43, 44]) {
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
    expect(await counts(db)).toEqual({ superseded: 6, total: 14, active: 6 });
  });

  it('aborts on re-run and changes nothing', async () => {
    await seed(db);
    await runCorrection(db);
    await expect(runCorrection(db)).rejects.toThrow(/guard 1:/);
    expect(await counts(db)).toEqual({ superseded: 6, total: 14, active: 6 });
  });

  it('aborts and rolls back when an expected row is missing', async () => {
    await seed(db, { skip: '22611c50-fc80-432b-b518-1b2705ec55e0' });
    await expect(runCorrection(db)).rejects.toThrow(/guard 1: expected 6 active old-poster rows/);
    expect(await counts(db)).toEqual({ superseded: 0, total: 7, active: 5 });
  });

  it('aborts when an old row value is not 0 (values must stay the same)', async () => {
    await seed(db, { value: 3 });
    await expect(runCorrection(db)).rejects.toThrow(/guard 1:/);
    expect(await counts(db)).toEqual({ superseded: 0, total: 8, active: 6 });
  });

  it('aborts when an old W44 row is not at the ISO-window recorded_at', async () => {
    await seed(db, { oldAt44: '2026-10-29T12:59:59.999Z' });
    await expect(runCorrection(db)).rejects.toThrow(/guard 1:/);
    expect(await counts(db)).toEqual({ superseded: 0, total: 8, active: 6 });
  });

  it('aborts when an unlisted row exists in either workspace', async () => {
    await seed(db);
    await db.query(
      `INSERT INTO stats (workspace_id, division_id, metric_key, value) VALUES ('${WS43}', 'Div6', 'conversions', 0)`
    );
    await expect(runCorrection(db)).rejects.toThrow(/guard 1b/);
    expect(await counts(db)).toEqual({ superseded: 0, total: 9, active: 7 });
  });

  it('aborts when migration 021 has not been applied', async () => {
    await db.close();
    db = await createDabosTestDb({ withSupersede: false });
    await seed(db);
    await expect(runCorrection(db)).rejects.toThrow(/guard 0: migration 021 not applied/);
  });
});

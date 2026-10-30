// @vitest-environment node
/**
 * GFP poster bucketing (founder ruling 2026-10-30): the stat week is Thu -> Thu with the close at
 * Thu 14:00 Europe/Berlin, and leads always count in the week they arrived (`created_at`).
 * Bookings (ruling 2026-10-30 23:41): bookings count in the week they were booked (`booked_at`).
 * In-process PGlite only — never connects to GFP or DABOS Neon.
 */
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';

import type { DabosSql } from '@/lib/dabos/dabos-connection';
import {
  gfpLeadStatWeek,
  gfpWorkspaceId,
  postGfpWeeklyStats,
  resolveGfpStatWeek,
} from '@/lib/dabos/gfp-weekly-stats';
import { statWeekWindow } from '@/lib/dabos/org-week';
import { createDabosTestDb, pgliteSql } from '@/test/pglite-dabos';

const GUIDE = 'guide-get-set-up-en';

async function seedOrg(db: PGlite): Promise<void> {
  await db.exec(`
    INSERT INTO divisions (id, operational_name) VALUES ('Div6', 'Div6');
    INSERT INTO departments (id, division_id, legacy_name, operational_name) VALUES
      ('Dept16', 'Div6', 'x', 'x'),
      ('Dept17', 'Div6', 'x', 'x');
  `);
}

/** Minimal `campaign_leads` shape the poster reads (no personal fields). */
async function createGfpTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE campaign_leads (
      id SERIAL PRIMARY KEY,
      campaign_slug TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      booked_at TIMESTAMPTZ
    );
  `);
  return db;
}

async function addLead(
  db: PGlite,
  createdAt: string,
  opts: { slug?: string; status?: string; updatedAt?: string; bookedAt?: string | null } = {}
): Promise<void> {
  await db.query(
    'INSERT INTO campaign_leads (campaign_slug, status, created_at, updated_at, booked_at) VALUES ($1, $2, $3, $4, $5)',
    [
      opts.slug ?? GUIDE,
      opts.status ?? 'new',
      createdAt,
      opts.updatedAt ?? createdAt,
      opts.bookedAt === undefined ? (opts.status === 'booked' ? createdAt : null) : opts.bookedAt,
    ]
  );
}

async function statValue(db: PGlite, workspaceId: string, metric: string): Promise<number | null> {
  const r = await db.query<{ value: string }>(
    'SELECT value FROM stats WHERE workspace_id = $1 AND metric_key = $2',
    [workspaceId, metric]
  );
  return r.rows[0] ? Number(r.rows[0].value) : null;
}

describe('GFP poster: leads count in the stat week they arrived', () => {
  let dabos: PGlite;
  let gfp: PGlite;
  let dabosSql: DabosSql;
  let gfpSql: DabosSql;

  beforeEach(async () => {
    dabos = await createDabosTestDb();
    await seedOrg(dabos);
    gfp = await createGfpTestDb();
    dabosSql = pgliteSql(dabos);
    gfpSql = pgliteSql(gfp);
  });

  const cases = [
    {
      name: 'CET: Thu 29 Oct 2026 (close 14:00 CET = 13:00Z)',
      before: '2026-10-29T12:59:00.000Z', // 13:59 Berlin
      at: '2026-10-29T13:00:00.000Z', // 14:00 Berlin
      closing: { year: 2026, week: 44, id: '2026-W44' },
      next: { year: 2026, week: 45, id: '2026-W45' },
    },
    {
      name: 'CEST: Thu 9 Jul 2026 (close 14:00 CEST = 12:00Z)',
      before: '2026-07-09T11:59:00.000Z', // 13:59 Berlin
      at: '2026-07-09T12:00:00.000Z', // 14:00 Berlin
      closing: { year: 2026, week: 28, id: '2026-W28' },
      next: { year: 2026, week: 29, id: '2026-W29' },
    },
  ] as const;

  for (const c of cases) {
    it(`${c.name}: 13:59 lead -> closing week, 14:00 lead -> next week`, async () => {
      // Labels: the week a lead arrived in, from org-week.ts.
      expect(gfpLeadStatWeek(new Date(c.before)).id).toBe(c.closing.id);
      expect(gfpLeadStatWeek(new Date(c.at)).id).toBe(c.next.id);
      expect(gfpWorkspaceId(c.closing.year, c.closing.week)).toBe(`gfp-live-${c.closing.id}`);

      // Two guide leads (one booked at the same instant), plus a non-guide lead that never counts.
      await addLead(gfp, c.before, { status: 'booked' });
      await addLead(gfp, c.at, { status: 'booked' });
      await addLead(gfp, c.before, { slug: 'other-campaign' });

      const closing = await postGfpWeeklyStats({ dabosSql, gfpSql, ...pick(c.closing) });
      const next = await postGfpWeeklyStats({ dabosSql, gfpSql, ...pick(c.next) });

      expect(closing.workspaceId).toBe(`gfp-live-${c.closing.id}`);
      expect(next.workspaceId).toBe(`gfp-live-${c.next.id}`);
      expect(closing.leadMagnetsShipped).toBe(1);
      expect(next.leadMagnetsShipped).toBe(1);
      expect(closing.terminClicksBookedProxy).toBe(1);
      expect(next.terminClicksBookedProxy).toBe(1);

      // recorded_at sits 1 ms before the close, so boards bucket the row into the labelled week.
      const w = statWeekWindow(c.closing.year, c.closing.week);
      expect(closing.recordedAt).toBe(new Date(w.end.getTime() - 1).toISOString());
      expect(w.end.toISOString()).toBe(c.at);
      expect(gfpLeadStatWeek(new Date(closing.recordedAt)).id).toBe(c.closing.id);

      expect(await statValue(dabos, closing.workspaceId, 'lead_magnets_shipped')).toBe(1);
      expect(await statValue(dabos, next.workspaceId, 'lead_magnets_shipped')).toBe(1);
      expect(await statValue(dabos, closing.workspaceId, 'termin_clicks')).toBe(1);
      expect(await statValue(dabos, closing.workspaceId, 'conversions')).toBe(1);
    });
  }

  for (const c of cases) {
    it(`${c.name}: bookings split on booked_at (13:59 -> closing week, 14:00 -> next week)`, async () => {
      // Both leads ARRIVED two weeks earlier, and updated_at is later still: only booked_at decides.
      const arrived = new Date(new Date(c.before).getTime() - 14 * 86_400_000).toISOString();
      const touched = new Date(new Date(c.at).getTime() + 10 * 86_400_000).toISOString();
      await addLead(gfp, arrived, { status: 'booked', bookedAt: c.before, updatedAt: touched });
      // Booked then closed: still a booking in the week it was booked.
      await addLead(gfp, arrived, { status: 'closed', bookedAt: c.at, updatedAt: touched });

      const closing = await postGfpWeeklyStats({ dabosSql, gfpSql, ...pick(c.closing) });
      const next = await postGfpWeeklyStats({ dabosSql, gfpSql, ...pick(c.next) });

      expect(gfpLeadStatWeek(new Date(c.before)).id).toBe(c.closing.id);
      expect(gfpLeadStatWeek(new Date(c.at)).id).toBe(c.next.id);
      expect(closing.terminClicksBookedProxy).toBe(1);
      expect(next.terminClicksBookedProxy).toBe(1);
      expect(closing.leadMagnetsShipped).toBe(0);
      expect(next.leadMagnetsShipped).toBe(0);
      expect(closing.bookedWithoutBookedAt).toBe(0);
      expect(closing.bookingsSkipped).toBeNull();
      for (const r of [closing, next]) {
        expect(await statValue(dabos, r.workspaceId, 'termin_clicks')).toBe(1);
        expect(await statValue(dabos, r.workspaceId, 'conversions')).toBe(1);
      }
    });
  }

  it('booked rows with null booked_at are counted in no week and reported explicitly', async () => {
    // Booked before GFP migration 004: booking instant unknown.
    await addLead(gfp, '2026-10-29T12:00:00.000Z', {
      status: 'booked',
      bookedAt: null,
      updatedAt: '2026-10-29T12:30:00.000Z',
    });
    await addLead(gfp, '2026-10-29T12:10:00.000Z', { status: 'booked' });

    const res = await postGfpWeeklyStats({ dabosSql, gfpSql, year: 2026, week: 44 });

    expect(res.terminClicksBookedProxy).toBe(1);
    expect(res.bookedWithoutBookedAt).toBe(1);
    const basis = await dabos.query<{ basis: Record<string, unknown> }>(
      `SELECT basis FROM stats WHERE workspace_id = 'gfp-live-2026-W44' AND metric_key = 'termin_clicks'`
    );
    expect(basis.rows[0]?.basis).toMatchObject({ booked_without_booked_at: 1 });
  });

  it('before GFP migration 004: bookings are skipped (not posted), lead magnets still post; a later run fills them without rewriting', async () => {
    const legacy = new PGlite();
    await legacy.exec(`
      CREATE TABLE campaign_leads (
        id SERIAL PRIMARY KEY, campaign_slug TEXT NOT NULL, status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
      );
      INSERT INTO campaign_leads (campaign_slug, status, created_at, updated_at)
      VALUES ('${GUIDE}', 'booked', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z');
    `);
    const first = await postGfpWeeklyStats({ dabosSql, gfpSql: pgliteSql(legacy), year: 2026, week: 44 });

    expect(first.bookingsSkipped).toBe('booked_at_column_missing');
    expect(first.terminClicksBookedProxy).toBeNull();
    expect(first.inserted).toEqual(['lead_magnets_shipped']);
    expect(await statValue(dabos, 'gfp-live-2026-W44', 'termin_clicks')).toBeNull();

    // 004 applied (+ a new booking with a known instant): the next run inserts only the missing rows.
    await legacy.exec(`ALTER TABLE campaign_leads ADD COLUMN booked_at TIMESTAMPTZ;`);
    await legacy.query(
      `INSERT INTO campaign_leads (campaign_slug, status, created_at, updated_at, booked_at)
       VALUES ('other-campaign', 'booked', '2026-10-27T09:00:00Z', '2026-10-27T09:00:00Z', '2026-10-27T09:00:00Z')`
    );
    const second = await postGfpWeeklyStats({ dabosSql, gfpSql: pgliteSql(legacy), year: 2026, week: 44 });
    expect(second.inserted).toEqual(['termin_clicks', 'conversions']);
    expect(second.bookedWithoutBookedAt).toBe(1);
    expect(await statValue(dabos, 'gfp-live-2026-W44', 'termin_clicks')).toBe(1);
    expect(await statValue(dabos, 'gfp-live-2026-W44', 'lead_magnets_shipped')).toBe(1);
  });

  it('never rewrites existing termin_clicks / conversions rows', async () => {
    for (const metric of ['termin_clicks', 'conversions']) {
      await dabos.query(
        `INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at, recorded_by)
         VALUES ('gfp-live-2026-W44', 'Div6', $1, $2, 0, '2026-11-01T23:59:59.999Z', 'gfp-poster')`,
        [metric === 'termin_clicks' ? 'Dept17' : null, metric]
      );
    }
    await addLead(gfp, '2026-10-20T09:00:00.000Z', { status: 'booked', bookedAt: '2026-10-29T12:59:00.000Z' });

    const res = await postGfpWeeklyStats({ dabosSql, gfpSql, year: 2026, week: 44 });

    expect(res.terminClicksBookedProxy).toBe(1);
    expect(res.inserted).toEqual(['lead_magnets_shipped']);
    expect(await statValue(dabos, 'gfp-live-2026-W44', 'termin_clicks')).toBe(0);
    expect(await statValue(dabos, 'gfp-live-2026-W44', 'conversions')).toBe(0);
  });

  it('resolveGfpStatWeek posts the week that closed at the last Thu 14:00 Berlin (label matches)', () => {
    expect(resolveGfpStatWeek(new Date('2026-10-29T13:30:00.000Z'))).toEqual({ year: 2026, week: 44 });
    expect(resolveGfpStatWeek(new Date('2026-10-29T12:59:00.000Z'))).toEqual({ year: 2026, week: 43 });
    expect(resolveGfpStatWeek(new Date('2026-07-09T12:30:00.000Z'))).toEqual({ year: 2026, week: 28 });
  });

  it('never rewrites an existing gfp-live row (insert_if_absent; history untouched)', async () => {
    await dabos.query(
      `INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at, recorded_by)
       VALUES ('gfp-live-2026-W44', 'Div6', 'Dept16', 'lead_magnets_shipped', 0, '2026-11-01T23:59:59.999Z', 'gfp-poster')`
    );
    await addLead(gfp, '2026-10-29T12:59:00.000Z');

    const res = await postGfpWeeklyStats({ dabosSql, gfpSql, year: 2026, week: 44 });

    expect(res.leadMagnetsShipped).toBe(1);
    expect(res.inserted).not.toContain('lead_magnets_shipped');
    expect(await statValue(dabos, 'gfp-live-2026-W44', 'lead_magnets_shipped')).toBe(0);
    const r = await dabos.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM stats WHERE workspace_id = 'gfp-live-2026-W44' AND metric_key = 'lead_magnets_shipped'`
    );
    expect(r.rows[0]?.n).toBe(1);
  });

  it('requires a GFP connection', async () => {
    await expect(postGfpWeeklyStats({ dabosSql, year: 2026, week: 44 })).rejects.toThrow(
      /gfpDatabaseUrl or gfpSql/
    );
  });
});

function pick(w: { year: number; week: number }): { year: number; week: number } {
  return { year: w.year, week: w.week };
}

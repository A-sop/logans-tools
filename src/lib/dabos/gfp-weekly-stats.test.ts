// @vitest-environment node
/**
 * GFP poster bucketing (founder ruling 2026-10-30): the stat week is Thu -> Thu with the close at
 * Thu 14:00 Europe/Berlin, and leads always count in the week they arrived (`created_at`).
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
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);
  return db;
}

async function addLead(
  db: PGlite,
  createdAt: string,
  opts: { slug?: string; status?: string; updatedAt?: string } = {}
): Promise<void> {
  await db.query(
    'INSERT INTO campaign_leads (campaign_slug, status, created_at, updated_at) VALUES ($1, $2, $3, $4)',
    [opts.slug ?? GUIDE, opts.status ?? 'new', createdAt, opts.updatedAt ?? createdAt]
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

/**
 * GFP funnel weekly stats → DABOS Neon `stats` (Dept16/17 + Div6).
 * termin_clicks uses Cal booked count as labelled proxy until PostHog ingest.
 *
 * Bookings (founder ruling 2026-10-30 23:41, via Div7): bookings count in the week they were
 * BOOKED. termin_clicks and conversions count `campaign_leads.booked_at` (GFP migration
 * 004_campaign_leads_booked_at) in the same org-week window. Rows with status='booked' and
 * booked_at null (booked before 004, unknown instant) are NOT bucketed into any week; they are
 * counted and reported as `bookedWithoutBookedAt` instead. If the column does not exist yet,
 * termin_clicks/conversions are skipped (not posted), so a re-run after 004 can still insert them.
 *
 * Week bucketing (founder ruling 2026-10-30, relayed by Div7): the stat week is Thu -> Thu with the
 * close at Thu 14:00 Europe/Berlin, and a lead counts in the week it ARRIVED. All week maths comes
 * from org-week.ts (single source): a lead with `created_at` t belongs to `statWeekOf(t)`, and the
 * `gfp-live-YYYY-Www` row for a week counts `created_at` in that week's [start, end) window.
 */
import type { DabosSql } from '@/lib/dabos/dabos-connection';
import { emitStat } from '@/lib/dabos/stats-emit';
import {
  closedOrgWeek,
  formatStatWeekId,
  recordedAtForClosedOrgWeek,
  statWeekOf,
  statWeekWindow,
  type OrgStatWeek,
} from '@/lib/dabos/org-week';
import postgres from 'postgres';

export const GUIDE_CAMPAIGN_SLUGS = ['guide-get-set-up-en', 'guide-finanzleben-de'] as const;

export type GfpWeeklyStatsResult = {
  workspaceId: string;
  recordedAt: string;
  leadMagnetsShipped: number;
  /**
   * Bookings with `booked_at` in the week (Cal booking proxy for termin_clicks until PostHog CTA
   * ingest). Null when bookings were skipped (`bookingsSkipped`).
   */
  terminClicksBookedProxy: number | null;
  /** status='booked' rows with no booked_at (all time): excluded from every week, reported here. */
  bookedWithoutBookedAt: number | null;
  /** Set when termin_clicks/conversions were not posted. */
  bookingsSkipped: 'booked_at_column_missing' | null;
  inserted: string[];
};

/** Postgres undefined_column for booked_at: GFP migration 004 not applied yet. */
function isMissingBookedAtColumn(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return e?.code === '42703' && /booked_at/.test(e.message ?? '');
}

/**
 * Stat week to post at `now`: the week that CLOSED at the most recent Thu 14:00 Berlin
 * (org-week.ts), labelled with the ISO week of its closing Thursday. Before Dept11 2026-10-30 this
 * was the ISO week of `now` (Mon-Sun, still running when the Thursday cron fired).
 */
export function resolveGfpStatWeek(now = new Date()): { year: number; week: number } {
  const w = closedOrgWeek(now);
  return { year: w.isoYear, week: w.isoWeek };
}

/** @deprecated Old name kept for callers; same as resolveGfpStatWeek (closed stat week, not ISO week of now). */
export const resolveGfpIsoWeek = resolveGfpStatWeek;

/** Stat week a lead counts in: the org week containing its arrival (`campaign_leads.created_at`). */
export function gfpLeadStatWeek(arrivedAt: Date): OrgStatWeek {
  return statWeekOf(arrivedAt);
}

/** `gfp-live-YYYY-Www` workspace id for a stat week (label from org-week.ts). */
export function gfpWorkspaceId(year: number, week: number): string {
  return `gfp-live-${formatStatWeekId(year, week)}`;
}

export async function postGfpWeeklyStats(opts: {
  dabosSql: DabosSql;
  /** GFP Neon URL. Ignored when `gfpSql` is given. */
  gfpDatabaseUrl?: string;
  /** Injected GFP connection (tests). The caller owns it; it is not closed here. */
  gfpSql?: DabosSql;
  year: number;
  week: number;
}): Promise<GfpWeeklyStatsResult> {
  const { dabosSql, gfpDatabaseUrl, year, week } = opts;
  const workspaceId = gfpWorkspaceId(year, week);
  // Stat week window [Thu 14:00, next Thu 14:00) Berlin; rows recorded 1 ms before the close.
  const window = statWeekWindow(year, week);
  const recordedAt = recordedAtForClosedOrgWeek(window);
  const weekStart = window.start;
  const weekEndExclusive = window.end.toISOString();

  if (!opts.gfpSql && !gfpDatabaseUrl) {
    throw new Error('postGfpWeeklyStats: gfpDatabaseUrl or gfpSql is required');
  }
  const ownSql = opts.gfpSql ? null : postgres(gfpDatabaseUrl!, { max: 1 });
  const gfpSql = (opts.gfpSql ?? ownSql) as unknown as DabosSql;
  try {
    const guideSlugs = [...GUIDE_CAMPAIGN_SLUGS];

    let magnetRows: Array<{ n: number }>;
    try {
      magnetRows = (await gfpSql`
        select count(*)::int as n
        from campaign_leads
        where campaign_slug = any(${guideSlugs})
          and created_at >= ${weekStart.toISOString()}::timestamptz
          and created_at < ${weekEndExclusive}::timestamptz
      `) as Array<{ n: number }>;
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === '42P01') {
        throw new Error(
          'campaign_leads not found. Set GFP_DATABASE_URL to the german-financial-planning Neon URL.'
        );
      }
      throw e;
    }

    // Bookings count in the week they were booked (booked_at), whatever the lead's status is now
    // (a booked lead later marked 'closed' still booked in that week). Null booked_at never matches
    // a window; those rows are counted separately below.
    let terminClicksBookedProxy: number | null = null;
    let bookedWithoutBookedAt: number | null = null;
    let bookingsSkipped: GfpWeeklyStatsResult['bookingsSkipped'] = null;
    try {
      const [bookedRows] = (await gfpSql`
        select count(*)::int as n
        from campaign_leads
        where booked_at >= ${weekStart.toISOString()}::timestamptz
          and booked_at < ${weekEndExclusive}::timestamptz
      `) as Array<{ n: number }>;
      const [unknownRows] = (await gfpSql`
        select count(*)::int as n
        from campaign_leads
        where status = 'booked' and booked_at is null
      `) as Array<{ n: number }>;
      terminClicksBookedProxy = Number(bookedRows?.n ?? 0);
      bookedWithoutBookedAt = Number(unknownRows?.n ?? 0);
    } catch (e) {
      if (!isMissingBookedAtColumn(e)) throw e;
      bookingsSkipped = 'booked_at_column_missing';
    }

    // (Before this change `[magnetRows] = rows` took the first ROW, so `magnetRows[0]?.n` was always
    // undefined and lead_magnets_shipped was always posted as 0.)
    const leadMagnetsShipped = Number(magnetRows[0]?.n ?? 0);

    const bookingNote =
      'Cal booked proxy until PostHog CTA ingest; bucketed by campaign_leads.booked_at (week booked)';
    const inserts = [
      {
        division_id: 'Div6',
        department_id: 'Dept16',
        metric_key: 'lead_magnets_shipped',
        value: leadMagnetsShipped,
      },
      {
        division_id: 'Div6',
        department_id: 'Dept17',
        metric_key: 'termin_clicks',
        value: terminClicksBookedProxy,
      },
      {
        division_id: 'Div6',
        department_id: null as string | null,
        metric_key: 'conversions',
        value: terminClicksBookedProxy,
      },
    ] as const;

    const inserted: string[] = [];
    for (const row of inserts) {
      // Never post a booking metric on a basis other than booked_at.
      if (row.value === null) continue;
      const result = await emitStat(dabosSql, {
        workspaceId,
        divisionId: row.division_id,
        departmentId: row.department_id,
        metricKey: row.metric_key,
        value: row.value,
        recordedAt,
        basis: {
          source: 'gfp-campaign_leads',
          note:
            row.metric_key === 'termin_clicks' || row.metric_key === 'conversions'
              ? bookingNote
              : 'guide campaign_leads week rollup',
          year,
          week,
          window: { start: window.start.toISOString(), end: window.end.toISOString() },
          ...(row.metric_key === 'termin_clicks' || row.metric_key === 'conversions'
            ? { booked_without_booked_at: bookedWithoutBookedAt }
            : {}),
        },
        recordedBy: 'gfp-poster',
        mode: 'insert_if_absent',
      });
      if (result.inserted) inserted.push(row.metric_key);
    }

    return {
      workspaceId,
      recordedAt,
      leadMagnetsShipped,
      terminClicksBookedProxy,
      bookedWithoutBookedAt,
      bookingsSkipped,
      inserted,
    };
  } finally {
    if (ownSql) await ownSql.end({ timeout: 5 });
  }
}

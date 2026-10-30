/**
 * GFP funnel weekly stats → DABOS Neon `stats` (Dept16/17 + Div6).
 * termin_clicks uses Cal booked count as labelled proxy until PostHog ingest.
 */
import type { DabosSql } from '@/lib/dabos/dabos-connection';
import { emitStat } from '@/lib/dabos/stats-emit';
import { closedOrgWeek, recordedAtForClosedOrgWeek, statWeekWindow } from '@/lib/dabos/org-week';
import postgres from 'postgres';

export const GUIDE_CAMPAIGN_SLUGS = ['guide-get-set-up-en', 'guide-finanzleben-de'] as const;

export type GfpWeeklyStatsResult = {
  workspaceId: string;
  recordedAt: string;
  leadMagnetsShipped: number;
  /** Cal `status=booked` count — proxy for termin_clicks until PostHog CTA ingest */
  terminClicksBookedProxy: number;
  inserted: string[];
};

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

export async function postGfpWeeklyStats(opts: {
  dabosSql: DabosSql;
  gfpDatabaseUrl: string;
  year: number;
  week: number;
}): Promise<GfpWeeklyStatsResult> {
  const { dabosSql, gfpDatabaseUrl, year, week } = opts;
  const workspaceId = `gfp-live-${year}-W${String(week).padStart(2, '0')}`;
  // Stat week window [Thu 14:00, next Thu 14:00) Berlin; rows recorded 1 ms before the close.
  const window = statWeekWindow(year, week);
  const recordedAt = recordedAtForClosedOrgWeek(window);
  const weekStart = window.start;
  const weekEndExclusive = window.end.toISOString();

  const gfpSql = postgres(gfpDatabaseUrl, { max: 1 });
  try {
    const guideSlugs = [...GUIDE_CAMPAIGN_SLUGS];

    let magnetRows: { n: number }[];
    try {
      [magnetRows] = await gfpSql`
        select count(*)::int as n
        from campaign_leads
        where campaign_slug = any(${guideSlugs})
          and created_at >= ${weekStart.toISOString()}::timestamptz
          and created_at < ${weekEndExclusive}::timestamptz
      `;
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === '42P01') {
        throw new Error(
          'campaign_leads not found. Set GFP_DATABASE_URL to the german-financial-planning Neon URL.'
        );
      }
      throw e;
    }

    const [bookedRows] = await gfpSql`
      select count(*)::int as n
      from campaign_leads
      where status = 'booked'
        and updated_at >= ${weekStart.toISOString()}::timestamptz
        and updated_at < ${weekEndExclusive}::timestamptz
    `;

    const leadMagnetsShipped = magnetRows[0]?.n ?? 0;
    const terminClicksBookedProxy = bookedRows?.n ?? 0;

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
              ? 'Cal booked proxy until PostHog CTA ingest'
              : 'guide campaign_leads week rollup',
          year,
          week,
          window: { start: window.start.toISOString(), end: window.end.toISOString() },
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
      inserted,
    };
  } finally {
    await gfpSql.end({ timeout: 5 });
  }
}

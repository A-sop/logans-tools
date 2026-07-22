/**
 * GFP funnel weekly stats → DABOS Neon `stats` (Dept16/17 + Div6).
 * termin_clicks uses Cal booked count as labelled proxy until PostHog ingest.
 */
import type { DabosSql } from '@/lib/dabos/dabos-connection';
import { endOfISOWeek, getISOWeek, getISOWeekYear, setISOWeek, startOfYear } from 'date-fns';
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

function weekEndIso(year: number, week: number): Date {
  return endOfISOWeek(setISOWeek(startOfYear(new Date(year, 0, 4)), week));
}

export function resolveGfpIsoWeek(now = new Date()): { year: number; week: number } {
  return { year: getISOWeekYear(now), week: getISOWeek(now) };
}

export async function postGfpWeeklyStats(opts: {
  dabosSql: DabosSql;
  gfpDatabaseUrl: string;
  year: number;
  week: number;
}): Promise<GfpWeeklyStatsResult> {
  const { dabosSql, gfpDatabaseUrl, year, week } = opts;
  const workspaceId = `gfp-live-${year}-W${String(week).padStart(2, '0')}`;
  const recordedAt = weekEndIso(year, week).toISOString();
  const weekStart = new Date(weekEndIso(year, week));
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);

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
          and created_at <= ${recordedAt}::timestamptz
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
        and updated_at <= ${recordedAt}::timestamptz
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
      const res = await dabosSql`
        insert into stats (workspace_id, division_id, department_id, metric_key, value, recorded_at)
        select ${workspaceId}, ${row.division_id}, ${row.department_id}, ${row.metric_key}, ${row.value}, ${recordedAt}::timestamptz
        where not exists (
          select 1 from stats s
          where s.workspace_id = ${workspaceId}
            and s.division_id = ${row.division_id}
            and s.department_id is not distinct from ${row.department_id}
            and s.metric_key = ${row.metric_key}
        )
        returning metric_key
      `;
      if (res[0]?.metric_key) inserted.push(String(res[0].metric_key));
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

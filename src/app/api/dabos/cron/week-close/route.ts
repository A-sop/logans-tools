import { NextResponse } from 'next/server';

import { refreshAllConditionsFromBoardWithSql } from '@/lib/dabos/board-conditions-query';
import { authorizeDabosCron } from '@/lib/dabos/cron-auth';
import { createDabosSql } from '@/lib/dabos/dabos-connection';
import { postDivisionWeeklyStats } from '@/lib/dabos/division-weekly-stats';
import {
  postGfpWeeklyStats,
  resolveGfpIsoWeek,
} from '@/lib/dabos/gfp-weekly-stats';
import {
  getStatCutoffSnapshot,
  isPastStatsDeadline,
  orgWeekLabel,
  weekBoundaryStart,
} from '@/lib/dabos/org-week';
import { closedOrgWeek } from '@/lib/dabos/org-week-window';
import { runStatCrawl } from '@/lib/dabos/stat-crawl';
import { loadReportedDivisionConditions } from '@/lib/dabos/week-close-conditions';
import { conditionRefreshEnabled, runOptInConditionRefresh } from '@/lib/dabos/week-close-refresh';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Cloud-only is INTENTIONAL on Vercel (default when VERCEL is set): the Div2/3/4/5/7 sources
 * (ship-log, Dept13 checklist register, establishment checklist, Proviso SQLite) are local
 * files on the office machine / ln02 and do not exist in the Vercel sandbox. Posting from
 * here would at best skip every metric and, because inserts are idempotent (first row per
 * workspace+division+metric wins), could pre-empt the ln02 poster with wrong values. The ln02
 * timer (Thu 14:30 Berlin, scripts/dabos/week-close.ts) owns division stats; this route
 * posts the GFP stats, runs the stat crawl and reports conditions. Set
 * DABOS_WEEK_CLOSE_CLOUD_ONLY=0 only on a host that has the local registers.
 */
function cloudOnly(): boolean {
  if (process.env.DABOS_WEEK_CLOSE_CLOUD_ONLY === '1') return true;
  if (process.env.DABOS_WEEK_CLOSE_CLOUD_ONLY === '0') return false;
  return Boolean(process.env.VERCEL);
}

export async function GET(request: Request) {
  const denied = authorizeDabosCron(request);
  if (denied) return denied;

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 503 });
  }

  const now = new Date();
  const weekStart = weekBoundaryStart(now);
  const sql = createDabosSql(url);
  const skipLocal = cloudOnly();

  const gfpUrl = process.env.GFP_DATABASE_URL?.trim() || url;
  const { year, week } = resolveGfpIsoWeek(now);
  let gfpPoster: Record<string, unknown> | null = null;
  try {
    const gfp = await postGfpWeeklyStats({
      dabosSql: sql,
      gfpDatabaseUrl: gfpUrl,
      year,
      week,
    });
    gfpPoster = {
      workspace_id: gfp.workspaceId,
      lead_magnets_shipped: gfp.leadMagnetsShipped,
      termin_clicks_booked_proxy: gfp.terminClicksBookedProxy,
      inserted: gfp.inserted,
      note: 'termin_clicks is Cal booked proxy until PostHog CTA ingest',
    };
  } catch (err) {
    gfpPoster = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  let divisionPoster: Record<string, unknown> | null = null;
  if (skipLocal) {
    divisionPoster = {
      skipped: true,
      reason:
        'cloud-only (intended): division stats need local registers; the ln02 week-close timer posts them',
      owner: 'ln02 dabos-week-close-ln02.timer',
    };
  } else {
    try {
      const div = await postDivisionWeeklyStats({
        dabosSql: sql,
        window: closedOrgWeek(now),
        includeProvisoMonths: 12,
      });
      divisionPoster = {
        workspace_id: div.workspaceId,
        window: div.window,
        inserted: div.inserted,
        notes: div.notes,
      };
    } catch (err) {
      divisionPoster = {
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Week-close reports recorded conditions; it does not assign them (Dept13 FAIL W44).
  let reportedConditions: Awaited<ReturnType<typeof loadReportedDivisionConditions>> = [];
  try {
    reportedConditions = await loadReportedDivisionConditions(sql);
  } catch {
    /* reported as empty */
  }
  // Opt-in only; a failure is captured and must not abort the crawl / role_run / response.
  const conditionRefresh = await runOptInConditionRefresh(conditionRefreshEnabled(), () =>
    refreshAllConditionsFromBoardWithSql(sql)
  );

  let crawl: Record<string, unknown> | null = null;
  try {
    const c = await runStatCrawl({ dabosSql: sql, now });
    crawl = {
      missing: c.missing,
      tasks_created: c.tasks_created,
      reported_pct: c.reported_pct,
    };
  } catch (err) {
    crawl = { error: err instanceof Error ? err.message : String(err) };
  }

  try {
    await sql`
      INSERT INTO role_runs (role_id, role_type, summary_json)
      VALUES (
        'week_close',
        'cadence',
        ${JSON.stringify({
          org_week: orgWeekLabel(weekStart),
          past_stats_deadline: isPastStatsDeadline(now),
          cloud_only: skipLocal,
          cutoff: getStatCutoffSnapshot(now),
          conditions: reportedConditions,
          conditions_assigned: false,
          condition_refresh: conditionRefresh,
          gfp_poster: gfpPoster,
          division_poster: divisionPoster,
          stat_crawl: crawl,
        })}::jsonb
      )
    `;
  } catch {
    /* */
  }

  if ('end' in sql && typeof sql.end === 'function') {
    await sql.end({ timeout: 5 });
  }

  return NextResponse.json({
    ok: true,
    job: 'week_close',
    cloud_only: skipLocal,
    org_week: orgWeekLabel(weekStart),
    conditions: reportedConditions,
    conditions_assigned: false,
    condition_refresh: conditionRefresh,
    gfp_poster: gfpPoster,
    division_poster: divisionPoster,
    stat_crawl: crawl,
  });
}

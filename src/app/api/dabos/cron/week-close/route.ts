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

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

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
  try {
    const div = await postDivisionWeeklyStats({
      dabosSql: sql,
      year,
      week,
      includeProvisoMonths: 12,
    });
    divisionPoster = {
      workspace_id: div.workspaceId,
      inserted: div.inserted,
      notes: div.notes,
    };
  } catch (err) {
    divisionPoster = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const result = await refreshAllConditionsFromBoardWithSql(sql);

  try {
    await sql`
      INSERT INTO role_runs (role_id, role_type, summary_json)
      VALUES (
        'week_close',
        'cadence',
        ${JSON.stringify({
          org_week: orgWeekLabel(weekStart),
          past_stats_deadline: isPastStatsDeadline(now),
          cutoff: getStatCutoffSnapshot(now),
          conditions: result.samples,
          gfp_poster: gfpPoster,
          division_poster: divisionPoster,
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
    org_week: orgWeekLabel(weekStart),
    week: result.week.label,
    persisted: result.persisted,
    gfp_poster: gfpPoster,
    division_poster: divisionPoster,
  });
}

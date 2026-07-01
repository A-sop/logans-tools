import { NextResponse } from 'next/server';

import { refreshAllConditionsFromBoardWithSql } from '@/lib/dabos/board-conditions-query';
import { authorizeDabosCron } from '@/lib/dabos/cron-auth';
import { createDabosSql } from '@/lib/dabos/dabos-connection';
import {
  getStatCutoffSnapshot,
  isPastStatsDeadline,
  orgWeekLabel,
  weekBoundaryStart,
} from '@/lib/dabos/org-week';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  });
}

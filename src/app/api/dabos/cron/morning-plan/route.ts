import { NextResponse } from 'next/server';

import { authorizeDabosCron } from '@/lib/dabos/cron-auth';
import { createDabosSql } from '@/lib/dabos/dabos-connection';
import { getStatCutoffSnapshot } from '@/lib/dabos/org-week';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
  const denied = authorizeDabosCron(request);
  if (denied) return denied;

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 503 });
  }

  const sql = createDabosSql(url);
  const cutoff = getStatCutoffSnapshot();

  const conditions = await sql`
    SELECT DISTINCT ON (entity_id) entity_id, condition
    FROM conditions
    WHERE entity_type = 'division'
    ORDER BY entity_id, created_at DESC
  `;

  const tasks = await sql`
    SELECT id, division_id, title, status, priority
    FROM tasks
    WHERE status IN ('todo', 'doing', 'blocked')
    ORDER BY priority ASC, created_at ASC
    LIMIT 15
  `;

  try {
    await sql`
      INSERT INTO role_runs (role_id, role_type, summary_json)
      VALUES (
        'morning_plan',
        'cadence',
        ${JSON.stringify({
          open_tasks: tasks.length,
          divisions_reported: conditions.length,
          cutoff,
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
    job: 'morning_plan',
    cutoff,
    divisions: conditions,
    open_tasks: tasks.length,
  });
}

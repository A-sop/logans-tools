import { NextResponse } from 'next/server';

import { authorizeDabosCron } from '@/lib/dabos/cron-auth';
import { createDabosSql } from '@/lib/dabos/dabos-connection';
import { runNextQueuedAgentTask } from '@/lib/dabos/task-runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: Request) {
  const denied = authorizeDabosCron(request);
  if (denied) return denied;

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 503 });
  }

  const sql = createDabosSql(url);
  const outcome = await runNextQueuedAgentTask(sql);

  if (!outcome.ran) {
    return NextResponse.json({ ok: true, ran: false, reason: outcome.reason });
  }

  if (!outcome.result.ok) {
    return NextResponse.json(
      {
        ok: false,
        ran: true,
        capability: outcome.capability,
        task_id: outcome.result.task_id,
        error: outcome.result.error,
      },
      { status: 502 }
    );
  }

  try {
    await sql`
      INSERT INTO role_runs (role_id, role_type, summary_json)
      VALUES (
        'run_queued_tasks',
        'worker',
        ${JSON.stringify({
          task_id: outcome.result.task_id,
          capability: outcome.capability,
          provider: outcome.result.provider,
        })}::jsonb
      )
    `;
  } catch {
    /* role_runs optional */
  }

  return NextResponse.json({
    ok: true,
    ran: true,
    capability: outcome.capability,
    task_id: outcome.result.task_id,
    artifact_id: outcome.result.artifact_id,
    cost_event_id: outcome.result.cost_event_id,
    provider: outcome.result.provider,
  });
}

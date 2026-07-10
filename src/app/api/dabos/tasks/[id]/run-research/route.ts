import { NextResponse } from 'next/server';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { requireDabosAuth } from '@/lib/dabos/clerk-auth';
import { getDabosSql } from '@/lib/dabos/db';
import { executeResearchTask } from '@/lib/dabos/task-runner';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const authResult = await requireDabosAuth();
  if ('error' in authResult) return authResult.error;

  if (!requireDabosDb()) return dabosDbUnavailable();

  const { id } = await context.params;
  const sql = getDabosSql();

  const tasks = await sql`SELECT id FROM tasks WHERE id = ${id}::uuid`;
  if (!tasks[0]) return jsonError('Task not found', 404);

  const result = await executeResearchTask(sql, id);
  if (!result.ok) {
    return jsonError(result.error, 502);
  }

  const artifactRows = await sql`SELECT * FROM artifacts WHERE id = ${result.artifact_id}::uuid`;
  const costRows = await sql`SELECT * FROM cost_events WHERE id = ${result.cost_event_id}::uuid`;
  const updatedTasks = await sql`SELECT * FROM tasks WHERE id = ${id}::uuid`;

  return NextResponse.json({
    task: updatedTasks[0],
    artifact: artifactRows[0],
    cost_event: costRows[0],
  });
}

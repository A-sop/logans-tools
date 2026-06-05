import { NextResponse } from 'next/server';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { getDabosSql } from '@/lib/dabos/db';
import { evaluateAndPersistCondition, getLatestStatValue } from '@/lib/dabos/queries';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  if (!requireDabosDb()) return dabosDbUnavailable();

  const { id } = await context.params;
  const sql = getDabosSql();

  const divisions = await sql`
    SELECT id, operational_name, description, primary_metric_key, created_at
    FROM divisions WHERE id = ${id}
  `;
  const division = divisions[0];
  if (!division) return jsonError('Division not found', 404);

  const departments = await sql`
    SELECT id, division_id, legacy_name, operational_name, policy_text, created_at
    FROM departments WHERE division_id = ${id}
    ORDER BY id
  `;

  const tasks = await sql`
    SELECT id, title, status, priority, department_id, assigned_agent, created_at, updated_at
    FROM tasks
    WHERE division_id = ${id}
      AND status IN ('todo', 'doing', 'blocked')
    ORDER BY priority ASC, created_at DESC
    LIMIT 50
  `;

  const metricKey = (division.primary_metric_key as string | null) ?? 'tasks_completed';
  const latestCondition = metricKey
    ? await evaluateAndPersistCondition({
        entity_type: 'division',
        entity_id: id,
        metric_key: metricKey,
        window_days: 7,
      })
    : null;
  const latestStat = metricKey ? await getLatestStatValue(id, metricKey) : null;

  return NextResponse.json({
    division,
    departments,
    open_tasks: tasks,
    latest_condition: latestCondition,
    primary_stat: latestStat
      ? { metric_key: metricKey, value: latestStat.value, recorded_at: latestStat.recorded_at }
      : null,
  });
}

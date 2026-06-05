import { NextResponse } from 'next/server';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { getDabosSql } from '@/lib/dabos/db';

type RouteContext = { params: Promise<{ id: string; deptId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  if (!requireDabosDb()) return dabosDbUnavailable();

  const { id, deptId } = await context.params;
  const sql = getDabosSql();

  const departments = await sql`
    SELECT id, division_id, legacy_name, operational_name, policy_text, created_at
    FROM departments
    WHERE id = ${deptId} AND division_id = ${id}
  `;
  const department = departments[0];
  if (!department) return jsonError('Department not found', 404);

  const tasks = await sql`
    SELECT id, title, status, priority, type, assigned_agent, created_at, updated_at
    FROM tasks
    WHERE division_id = ${id} AND department_id = ${deptId}
    ORDER BY created_at DESC
    LIMIT 100
  `;

  const stats = await sql`
    SELECT id, metric_key, value, recorded_at
    FROM stats
    WHERE department_id = ${deptId}
    ORDER BY recorded_at DESC
    LIMIT 20
  `;

  return NextResponse.json({ department, tasks, stats });
}

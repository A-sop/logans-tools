import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { requireDabosAuth } from '@/lib/dabos/clerk-auth';
import { authorizeDabosCron } from '@/lib/dabos/cron-auth';
import { getDabosSql } from '@/lib/dabos/db';
import { emitStat } from '@/lib/dabos/stats-emit';

const createStatSchema = z.object({
  workspace_id: z.string().min(1),
  division_id: z.string().min(1),
  department_id: z.string().optional().nullable(),
  metric_key: z.string().min(1),
  value: z.number(),
  recorded_at: z.string().datetime().optional(),
  basis: z.union([z.string().min(1), z.record(z.unknown())]),
  recorded_by: z.string().min(1),
  mode: z.enum(['insert_if_absent', 'insert_always']).optional(),
});

function isCronAuthorized(request: Request): boolean {
  const denied = authorizeDabosCron(request);
  return denied === null;
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    const authResult = await requireDabosAuth();
    if ('error' in authResult) return authResult.error;
  }

  if (!requireDabosDb()) return dabosDbUnavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const parsed = createStatSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors.map((e) => e.message).join('; '));
  }

  const input = parsed.data;
  const sql = getDabosSql();

  const divCheck = await sql`SELECT id FROM divisions WHERE id = ${input.division_id}`;
  if (!divCheck[0]) return jsonError('Invalid division_id', 404);

  if (input.department_id) {
    const deptCheck = await sql`
      SELECT id FROM departments
      WHERE id = ${input.department_id} AND division_id = ${input.division_id}
    `;
    if (!deptCheck[0]) return jsonError('Invalid department_id for division', 404);
  }

  const result = await emitStat(sql, {
    workspaceId: input.workspace_id,
    divisionId: input.division_id,
    departmentId: input.department_id,
    metricKey: input.metric_key,
    value: input.value,
    recordedAt: input.recorded_at,
    basis: input.basis,
    recordedBy: input.recorded_by,
    mode: input.mode ?? 'insert_always',
  });

  if (!result.inserted) {
    return NextResponse.json(
      {
        ok: true,
        inserted: false,
        note: 'idempotent skip — row already exists for workspace+metric',
      },
      { status: 200 }
    );
  }

  const rows = await sql`SELECT * FROM stats WHERE id = ${result.id!} LIMIT 1`;
  return NextResponse.json({ ok: true, inserted: true, stat: rows[0] }, { status: 201 });
}

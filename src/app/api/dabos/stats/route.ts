import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { requireDabosAuth } from '@/lib/dabos/clerk-auth';
import { getDabosSql } from '@/lib/dabos/db';

const createStatSchema = z.object({
  division_id: z.string().min(1),
  department_id: z.string().optional().nullable(),
  metric_key: z.string().min(1),
  value: z.number(),
  recorded_at: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  const authResult = await requireDabosAuth();
  if ('error' in authResult) return authResult.error;

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

  const recordedAt = input.recorded_at ?? new Date().toISOString();

  const rows = await sql`
    INSERT INTO stats (division_id, department_id, metric_key, value, recorded_at)
    VALUES (
      ${input.division_id},
      ${input.department_id ?? null},
      ${input.metric_key},
      ${input.value},
      ${recordedAt}::timestamptz
    )
    RETURNING *
  `;

  return NextResponse.json({ stat: rows[0] }, { status: 201 });
}

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { getDabosSql } from '@/lib/dabos/db';
import { authorizeTier0 } from '@/lib/dabos/tier0-auth';
import { fetchPendingApprovals, formatTier0Approvals } from '@/lib/dabos/tier0';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = await authorizeTier0(request);
  if (denied) return denied;
  if (!requireDabosDb()) return dabosDbUnavailable();

  const sql = getDabosSql();
  const format = new URL(request.url).searchParams.get('format');
  if (format === 'json') {
    const pending = await fetchPendingApprovals(sql, 20);
    return NextResponse.json({ tier: 0, command: 'approvals', pending });
  }

  const text = await formatTier0Approvals(sql);
  return new NextResponse(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

const createSchema = z.object({
  kind: z.enum(['send_message', 'spend', 'exec_capture', 'external_commit', 'other']),
  title: z.string().min(1).max(500),
  body: z.string().optional().nullable(),
  payload: z.record(z.unknown()).optional(),
  division_id: z.string().optional().nullable(),
  department_id: z.string().optional().nullable(),
  task_id: z.string().uuid().optional().nullable(),
  requested_by: z.string().optional(),
});

export async function POST(request: Request) {
  const denied = await authorizeTier0(request);
  if (denied) return denied;
  if (!requireDabosDb()) return dabosDbUnavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors.map((e) => e.message).join('; '));
  }

  const input = parsed.data;
  const sql = getDabosSql();
  const rows = await sql`
    INSERT INTO approval_queue (
      kind, title, body, payload, division_id, department_id, task_id, requested_by
    ) VALUES (
      ${input.kind},
      ${input.title},
      ${input.body ?? null},
      ${JSON.stringify(input.payload ?? {})}::jsonb,
      ${input.division_id ?? null},
      ${input.department_id ?? null},
      ${input.task_id ?? null},
      ${input.requested_by ?? 'founder'}
    )
    RETURNING *
  `;

  return NextResponse.json({ approval: rows[0] }, { status: 201 });
}

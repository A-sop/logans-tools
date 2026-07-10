import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { getDabosSql } from '@/lib/dabos/db';
import { authorizeTier0 } from '@/lib/dabos/tier0-auth';
import { decideApproval } from '@/lib/dabos/tier0';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

const decideSchema = z.object({
  action: z.enum(['approve', 'reject']),
  decided_by: z.string().optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const denied = await authorizeTier0(request);
  if (denied) return denied;
  if (!requireDabosDb()) return dabosDbUnavailable();

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const parsed = decideSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors.map((e) => e.message).join('; '));
  }

  const sql = getDabosSql();
  const result = await decideApproval(
    sql,
    id,
    parsed.data.action,
    parsed.data.decided_by ?? 'founder'
  );

  if (!result.ok) {
    return jsonError(result.error, 404);
  }

  return NextResponse.json({
    tier: 0,
    action: parsed.data.action,
    approval: result.row,
    message: `${parsed.data.action === 'approve' ? 'Approved' : 'Rejected'}: ${result.row.title}`,
  });
}

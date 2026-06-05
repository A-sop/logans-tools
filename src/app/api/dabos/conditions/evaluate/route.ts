import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { evaluateAndPersistCondition } from '@/lib/dabos/queries';

const evaluateSchema = z.object({
  entity_type: z.enum(['division', 'department', 'workspace', 'project']),
  entity_id: z.string().min(1),
  metric_key: z.string().min(1),
  window_days: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  if (!requireDabosDb()) return dabosDbUnavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const parsed = evaluateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors.map((e) => e.message).join('; '));
  }

  const result = await evaluateAndPersistCondition(parsed.data);
  return NextResponse.json(result);
}

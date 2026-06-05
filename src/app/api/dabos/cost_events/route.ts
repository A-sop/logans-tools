import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { getDabosSql } from '@/lib/dabos/db';

const createCostSchema = z.object({
  task_id: z.string().uuid().optional().nullable(),
  agent_name: z.string().min(1),
  provider: z.string().min(1),
  tokens_input: z.number().int().nonnegative().optional().nullable(),
  tokens_output: z.number().int().nonnegative().optional().nullable(),
  cost_eur: z.number().nonnegative().optional().nullable(),
  category: z.enum(['llm', 'saas', 'other']).optional(),
});

export async function POST(request: Request) {
  if (!requireDabosDb()) return dabosDbUnavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const parsed = createCostSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors.map((e) => e.message).join('; '));
  }

  const input = parsed.data;
  const sql = getDabosSql();

  const rows = await sql`
    INSERT INTO cost_events (
      task_id, agent_name, provider, tokens_input, tokens_output, cost_eur, category
    ) VALUES (
      ${input.task_id ?? null},
      ${input.agent_name},
      ${input.provider},
      ${input.tokens_input ?? null},
      ${input.tokens_output ?? null},
      ${input.cost_eur ?? null},
      ${input.category ?? 'llm'}
    )
    RETURNING *
  `;

  return NextResponse.json({ cost_event: rows[0] }, { status: 201 });
}

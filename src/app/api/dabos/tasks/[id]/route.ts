import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { requireDabosAuth } from '@/lib/dabos/clerk-auth';
import { getDabosSql } from '@/lib/dabos/db';

type RouteContext = { params: Promise<{ id: string }> };

const patchTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['todo', 'doing', 'blocked', 'done', 'cancelled']).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  assigned_to: z.string().optional().nullable(),
  assigned_agent: z.string().optional().nullable(),
  research_tier: z.number().int().min(1).max(2).optional(),
  budget_tokens: z.number().int().positive().optional().nullable(),
});

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireDabosAuth();
  if ('error' in authResult) return authResult.error;

  if (!requireDabosDb()) return dabosDbUnavailable();

  const { id } = await context.params;
  const sql = getDabosSql();

  const tasks = await sql`SELECT * FROM tasks WHERE id = ${id}::uuid`;
  const task = tasks[0];
  if (!task) return jsonError('Task not found', 404);

  const artifacts = await sql`
    SELECT id, type, summary, created_by, created_at
    FROM artifacts WHERE task_id = ${id}::uuid
    ORDER BY created_at DESC
  `;

  const costs = await sql`
    SELECT id, agent_name, provider, tokens_input, tokens_output, cost_eur, created_at
    FROM cost_events WHERE task_id = ${id}::uuid
    ORDER BY created_at DESC
  `;

  return NextResponse.json({ task, artifacts, cost_events: costs });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireDabosAuth();
  if ('error' in authResult) return authResult.error;

  if (!requireDabosDb()) return dabosDbUnavailable();

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const parsed = patchTaskSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors.map((e) => e.message).join('; '));
  }

  const input = parsed.data;
  const sql = getDabosSql();
  const existing = await sql`SELECT id FROM tasks WHERE id = ${id}::uuid`;
  if (!existing[0]) return jsonError('Task not found', 404);

  const rows = await sql`
    UPDATE tasks SET
      title = COALESCE(${input.title ?? null}, title),
      description = COALESCE(${input.description ?? null}, description),
      status = COALESCE(${input.status ?? null}, status),
      priority = COALESCE(${input.priority ?? null}, priority),
      assigned_to = COALESCE(${input.assigned_to ?? null}, assigned_to),
      assigned_agent = COALESCE(${input.assigned_agent ?? null}, assigned_agent),
      research_tier = COALESCE(${input.research_tier ?? null}, research_tier),
      budget_tokens = COALESCE(${input.budget_tokens ?? null}, budget_tokens),
      updated_at = NOW(),
      completed_at = CASE
        WHEN ${input.status ?? null} = 'done' THEN NOW()
        WHEN ${input.status ?? null} IS NOT NULL AND ${input.status ?? null} <> 'done' THEN NULL
        ELSE completed_at
      END
    WHERE id = ${id}::uuid
    RETURNING *
  `;

  return NextResponse.json({ task: rows[0] });
}

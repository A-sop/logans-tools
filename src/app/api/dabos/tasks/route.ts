import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { requireDabosAuth } from '@/lib/dabos/clerk-auth';
import { getDabosSql } from '@/lib/dabos/db';

const createTaskSchema = z.object({
  division_id: z.string().min(1),
  department_id: z.string().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  type: z.enum(['human', 'agent', 'approval']).optional(),
  status: z.enum(['todo', 'doing', 'blocked', 'done', 'cancelled']).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  assigned_to: z.string().optional().nullable(),
  assigned_agent: z.string().optional().nullable(),
  research_tier: z.number().int().min(1).max(2).optional(),
  budget_tokens: z.number().int().positive().optional().nullable(),
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

  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors.map((e) => e.message).join('; '));
  }

  const input = parsed.data;
  const sql = getDabosSql();

  const divCheck = await sql`SELECT id FROM divisions WHERE id = ${input.division_id}`;
  if (!divCheck[0]) return jsonError('Invalid division_id', 404);

  if (input.department_id) {
    const deptCheck = await sql`
      SELECT id FROM departments WHERE id = ${input.department_id} AND division_id = ${input.division_id}
    `;
    if (!deptCheck[0]) return jsonError('Invalid department_id for division', 404);
  }

  const rows = await sql`
    INSERT INTO tasks (
      division_id, department_id, title, description, type, status, priority,
      assigned_to, assigned_agent, research_tier, budget_tokens
    ) VALUES (
      ${input.division_id},
      ${input.department_id ?? null},
      ${input.title},
      ${input.description ?? null},
      ${input.type ?? 'human'},
      ${input.status ?? 'todo'},
      ${input.priority ?? 3},
      ${input.assigned_to ?? null},
      ${input.assigned_agent ?? null},
      ${input.research_tier ?? 1},
      ${input.budget_tokens ?? null}
    )
    RETURNING *
  `;

  return NextResponse.json({ task: rows[0] }, { status: 201 });
}

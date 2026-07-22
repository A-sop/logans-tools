import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { getDabosSql } from '@/lib/dabos/db';
import { authorizeTier0 } from '@/lib/dabos/tier0-auth';

export const dynamic = 'force-dynamic';

const DEPT_IDS = [
  'Dept1', 'Dept2', 'Dept3', 'Dept4', 'Dept5', 'Dept6', 'Dept7', 'Dept8', 'Dept9',
  'Dept10', 'Dept11', 'Dept12', 'Dept13', 'Dept14', 'Dept15', 'Dept16', 'Dept17',
  'Dept18', 'Dept19', 'Dept20', 'Dept21',
] as const;

const createSchema = z.object({
  division_id: z
    .enum(['Div1', 'Div2', 'Div3', 'Div4', 'Div5', 'Div6', 'Div7'])
    .default('Div7'),
  department_id: z.enum(DEPT_IDS).optional().nullable(),
  title: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  type: z.enum(['human', 'agent', 'approval']).default('agent'),
  priority: z.number().int().min(1).max(5).optional(),
  assigned_agent: z.string().optional().nullable(),
  research_tier: z.number().int().min(1).max(2).optional(),
  requested_by: z.string().optional(),
});

/** Tier 0 — create a task from Comm bot / boss chat (Bearer auth). */
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

  if (input.department_id) {
    const deptCheck = await sql`
      SELECT id FROM departments
      WHERE id = ${input.department_id} AND division_id = ${input.division_id}
    `;
    if (!deptCheck[0]) return jsonError('Invalid department_id for division', 404);
  }

  const rows = await sql`
    INSERT INTO tasks (
      division_id, department_id, title, description, type, status, priority,
      assigned_agent, research_tier
    ) VALUES (
      ${input.division_id},
      ${input.department_id ?? null},
      ${input.title},
      ${input.description ?? null},
      ${input.type},
      'todo',
      ${input.priority ?? 3},
      ${input.assigned_agent ?? (input.type === 'agent' ? 'research' : null)},
      ${input.research_tier ?? 1}
    )
    RETURNING id, division_id, department_id, title, type, status, priority, created_at
  `;

  return NextResponse.json(
    {
      task: rows[0],
      receipt: `Queued task ${String(rows[0].id).slice(0, 8)} · ${input.type} · ${input.division_id}`,
    },
    { status: 201 }
  );
}

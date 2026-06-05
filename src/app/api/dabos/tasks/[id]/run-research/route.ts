import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { getDabosSql } from '@/lib/dabos/db';
import { runResearchAgent } from '@/lib/dabos/research';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  if (!requireDabosDb()) return dabosDbUnavailable();

  const { id } = await context.params;
  const sql = getDabosSql();

  const tasks = await sql`SELECT * FROM tasks WHERE id = ${id}::uuid`;
  const task = tasks[0];
  if (!task) return jsonError('Task not found', 404);

  await sql`
    UPDATE tasks SET status = 'doing', assigned_agent = 'research', updated_at = NOW()
    WHERE id = ${id}::uuid
  `;

  const result = await runResearchAgent({
    title: task.title as string,
    description: (task.description as string | null) ?? null,
    tier: Number(task.research_tier ?? 1),
    budgetTokens: task.budget_tokens as number | null,
  });

  if (!result.ok) {
    await sql`
      UPDATE tasks SET status = 'blocked', updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
    return jsonError(result.error, 502);
  }

  const artifactRows = await sql`
    INSERT INTO artifacts (
      division_id, department_id, task_id, type, summary, storage_uri, tags, created_by
    ) VALUES (
      ${task.division_id as string},
      ${(task.department_id as string | null) ?? null},
      ${id}::uuid,
      'document',
      ${result.summary},
      NULL,
      ${JSON.stringify(['research'])}::jsonb,
      'research'
    )
    RETURNING *
  `;

  const costRows = await sql`
    INSERT INTO cost_events (
      task_id, agent_name, provider, tokens_input, tokens_output, cost_eur, category
    ) VALUES (
      ${id}::uuid,
      'research',
      ${result.provider},
      ${result.tokensInput},
      ${result.tokensOutput},
      ${result.costEur},
      'llm'
    )
    RETURNING *
  `;

  const updatedTasks = await sql`
    UPDATE tasks SET status = 'done', completed_at = NOW(), updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING *
  `;

  return NextResponse.json({
    task: updatedTasks[0],
    artifact: artifactRows[0],
    cost_event: costRows[0],
  });
}

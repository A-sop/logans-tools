import type { Sql } from '@/lib/dabos/db';

import { runResearchAgent } from '@/lib/dabos/research';

export type ResearchTaskResult =
  | {
      ok: true;
      task_id: string;
      artifact_id: string;
      cost_event_id: string;
      provider: 'ollama' | 'openai';
    }
  | { ok: false; task_id: string; error: string };

export async function executeResearchTask(sql: Sql, taskId: string): Promise<ResearchTaskResult> {
  const tasks = await sql`SELECT * FROM tasks WHERE id = ${taskId}::uuid`;
  const task = tasks[0];
  if (!task) {
    return { ok: false, task_id: taskId, error: 'Task not found' };
  }

  await sql`
    UPDATE tasks SET status = 'doing', assigned_agent = 'research', updated_at = NOW()
    WHERE id = ${taskId}::uuid
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
      WHERE id = ${taskId}::uuid
    `;
    return { ok: false, task_id: taskId, error: result.error };
  }

  const artifactRows = await sql`
    INSERT INTO artifacts (
      division_id, department_id, task_id, type, summary, storage_uri, tags, created_by
    ) VALUES (
      ${task.division_id as string},
      ${(task.department_id as string | null) ?? null},
      ${taskId}::uuid,
      'document',
      ${result.summary},
      NULL,
      ${JSON.stringify(['research'])}::jsonb,
      'research'
    )
    RETURNING id
  `;

  const costRows = await sql`
    INSERT INTO cost_events (
      task_id, agent_name, provider, tokens_input, tokens_output, cost_eur, category
    ) VALUES (
      ${taskId}::uuid,
      'research',
      ${result.provider},
      ${result.tokensInput},
      ${result.tokensOutput},
      ${result.costEur},
      'llm'
    )
    RETURNING id
  `;

  await sql`
    UPDATE tasks SET status = 'done', completed_at = NOW(), updated_at = NOW()
    WHERE id = ${taskId}::uuid
  `;

  return {
    ok: true,
    task_id: taskId,
    artifact_id: artifactRows[0].id as string,
    cost_event_id: costRows[0].id as string,
    provider: result.provider,
  };
}

export type QueuedTaskPick = {
  id: string;
  title: string;
  assigned_agent: string | null;
};

/** Oldest agent task ready to run (research capability first). */
export async function pickNextAgentTask(sql: Sql): Promise<QueuedTaskPick | null> {
  const rows = await sql`
    SELECT id, title, assigned_agent
    FROM tasks
    WHERE type = 'agent'
      AND status = 'todo'
      AND (assigned_agent IS NULL OR assigned_agent = 'research')
    ORDER BY priority ASC, created_at ASC
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id as string,
    title: row.title as string,
    assigned_agent: (row.assigned_agent as string | null) ?? null,
  };
}

export async function runNextQueuedAgentTask(sql: Sql): Promise<
  | { ran: false; reason: string }
  | { ran: true; capability: string; result: ResearchTaskResult }
> {
  const next = await pickNextAgentTask(sql);
  if (!next) {
    return { ran: false, reason: 'no_agent_tasks' };
  }

  const capability = next.assigned_agent ?? 'research';
  if (capability !== 'research') {
    return { ran: false, reason: `unsupported_capability:${capability}` };
  }

  const result = await executeResearchTask(sql, next.id);
  return { ran: true, capability, result };
}

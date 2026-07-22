import type { Sql } from '@/lib/dabos/db';

import {
  postGfpWeeklyStats,
  resolveGfpIsoWeek,
} from '@/lib/dabos/gfp-weekly-stats';
import { runResearchAgent } from '@/lib/dabos/research';

export const GFP_WEEKLY_STATS_CAPABILITY = 'gfp-weekly-stats';
export const RESEARCH_CAPABILITY = 'research';

const SUPPORTED_CAPABILITIES = new Set([RESEARCH_CAPABILITY, GFP_WEEKLY_STATS_CAPABILITY]);

export type ResearchTaskResult =
  | {
      ok: true;
      task_id: string;
      artifact_id: string;
      cost_event_id: string;
      provider: 'ollama' | 'openai' | 'openrouter';
    }
  | { ok: false; task_id: string; error: string };

export type GfpWeeklyStatsTaskResult =
  | {
      ok: true;
      task_id: string;
      artifact_id: string;
      cost_event_id: string;
      provider: 'script';
      workspace_id: string;
    }
  | { ok: false; task_id: string; error: string };

export type AgentTaskResult = ResearchTaskResult | GfpWeeklyStatsTaskResult;

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

export async function executeGfpWeeklyStatsTask(
  sql: Sql,
  taskId: string
): Promise<GfpWeeklyStatsTaskResult> {
  const tasks = await sql`SELECT * FROM tasks WHERE id = ${taskId}::uuid`;
  const task = tasks[0];
  if (!task) {
    return { ok: false, task_id: taskId, error: 'Task not found' };
  }

  await sql`
    UPDATE tasks SET status = 'doing', assigned_agent = ${GFP_WEEKLY_STATS_CAPABILITY}, updated_at = NOW()
    WHERE id = ${taskId}::uuid
  `;

  const dabosUrl = process.env.DATABASE_URL?.trim();
  const gfpUrl = process.env.GFP_DATABASE_URL?.trim() || dabosUrl;
  if (!gfpUrl) {
    await sql`
      UPDATE tasks SET status = 'blocked', updated_at = NOW()
      WHERE id = ${taskId}::uuid
    `;
    return { ok: false, task_id: taskId, error: 'GFP_DATABASE_URL or DATABASE_URL required' };
  }

  const { year, week } = resolveGfpIsoWeek();
  try {
    const posted = await postGfpWeeklyStats({
      dabosSql: sql,
      gfpDatabaseUrl: gfpUrl,
      year,
      week,
    });

    const summary = [
      `GFP weekly stats ${posted.workspaceId}`,
      `lead_magnets_shipped=${posted.leadMagnetsShipped}`,
      `termin_clicks(booked_proxy)=${posted.terminClicksBookedProxy}`,
      posted.inserted.length
        ? `inserted=${posted.inserted.join(',')}`
        : 'idempotent_skip',
    ].join('; ');

    const artifactRows = await sql`
      INSERT INTO artifacts (
        division_id, department_id, task_id, type, summary, storage_uri, tags, created_by
      ) VALUES (
        ${'Div6'},
        ${'Dept16'},
        ${taskId}::uuid,
        'document',
        ${summary},
        NULL,
        ${JSON.stringify(['gfp-weekly-stats', 'booked-proxy-termin-clicks', posted.workspaceId])}::jsonb,
        ${GFP_WEEKLY_STATS_CAPABILITY}
      )
      RETURNING id
    `;

    const costRows = await sql`
      INSERT INTO cost_events (
        task_id, agent_name, provider, tokens_input, tokens_output, cost_eur, category
      ) VALUES (
        ${taskId}::uuid,
        ${GFP_WEEKLY_STATS_CAPABILITY},
        'script',
        0,
        0,
        0,
        'automation'
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
      provider: 'script',
      workspace_id: posted.workspaceId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sql`
      UPDATE tasks SET status = 'blocked', updated_at = NOW()
      WHERE id = ${taskId}::uuid
    `;
    return { ok: false, task_id: taskId, error: message };
  }
}

export type QueuedTaskPick = {
  id: string;
  title: string;
  assigned_agent: string | null;
};

/** Oldest agent task ready to run (research or gfp-weekly-stats). */
export async function pickNextAgentTask(sql: Sql): Promise<QueuedTaskPick | null> {
  const rows = await sql`
    SELECT id, title, assigned_agent
    FROM tasks
    WHERE type = 'agent'
      AND status = 'todo'
      AND (
        assigned_agent IS NULL
        OR assigned_agent = ${RESEARCH_CAPABILITY}
        OR assigned_agent = ${GFP_WEEKLY_STATS_CAPABILITY}
      )
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
  | { ran: true; capability: string; result: AgentTaskResult }
> {
  const next = await pickNextAgentTask(sql);
  if (!next) {
    return { ran: false, reason: 'no_agent_tasks' };
  }

  const capability = next.assigned_agent ?? RESEARCH_CAPABILITY;
  if (!SUPPORTED_CAPABILITIES.has(capability)) {
    return { ran: false, reason: `unsupported_capability:${capability}` };
  }

  if (capability === GFP_WEEKLY_STATS_CAPABILITY) {
    const result = await executeGfpWeeklyStatsTask(sql, next.id);
    return { ran: true, capability, result };
  }

  const result = await executeResearchTask(sql, next.id);
  return { ran: true, capability, result };
}

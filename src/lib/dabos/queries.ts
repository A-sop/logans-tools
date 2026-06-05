import { evaluateConditionFromPoints } from '@/lib/dabos/conditions';
import { formatConditionTooltip } from '@/lib/dabos/condition-display';
import {
  evaluateBoardConditionsWithSql,
  refreshAllConditionsFromBoardWithSql,
  type BoardConditionsResult,
  type BoardWeekContext,
} from '@/lib/dabos/board-conditions-query';
import { getDabosSql } from '@/lib/dabos/db';
import type { ConditionEvaluation } from '@/lib/dabos/types';

export type { BoardConditionsResult, BoardWeekContext };
export { formatConditionTooltip };

export async function evaluateBoardConditions(input?: {
  year?: number;
  calendarWeek?: number;
}): Promise<BoardConditionsResult> {
  return evaluateBoardConditionsWithSql(getDabosSql(), input);
}

export async function refreshAllConditionsFromBoard(): Promise<{
  week: BoardWeekContext;
  persisted: { divisions: number; departments: number };
  samples: { entity_id: string; condition: string }[];
}> {
  return refreshAllConditionsFromBoardWithSql(getDabosSql());
}

async function persistConditionEvaluation(
  entityType: 'division' | 'department' | 'workspace' | 'project',
  entityId: string,
  evaluation: ConditionEvaluation
): Promise<boolean> {
  if (!evaluation.condition) return false;
  const sql = getDabosSql();
  await sql`
    INSERT INTO conditions (entity_type, entity_id, condition, confidence, basis)
    VALUES (
      ${entityType},
      ${entityId},
      ${evaluation.condition},
      ${evaluation.confidence},
      ${JSON.stringify(evaluation.basis)}::jsonb
    )
  `;
  return true;
}

export async function evaluateAndPersistCondition(input: {
  entity_type: 'division' | 'department' | 'workspace' | 'project';
  entity_id: string;
  metric_key: string;
  window_days?: number;
}): Promise<ConditionEvaluation> {
  const sql = getDabosSql();
  const windowDays = input.window_days ?? 7;
  const since = new Date(Date.now() - windowDays * 86400000).toISOString();

  const rows =
    input.entity_type === 'department'
      ? await sql`
          SELECT value::float8 AS value
          FROM stats
          WHERE department_id = ${input.entity_id}
            AND metric_key = ${input.metric_key}
            AND recorded_at >= ${since}::timestamptz
          ORDER BY recorded_at ASC
        `
      : await sql`
          SELECT value::float8 AS value
          FROM stats
          WHERE division_id = ${input.entity_id}
            AND department_id IS NULL
            AND metric_key = ${input.metric_key}
            AND recorded_at >= ${since}::timestamptz
          ORDER BY recorded_at ASC
        `;

  const values = rows.map((r) => Number(r.value)).filter((v) => Number.isFinite(v));
  const evaluation = evaluateConditionFromPoints(values, {
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    metric_key: input.metric_key,
    window_days: windowDays,
  });

  if (evaluation.condition) {
    await persistConditionEvaluation(input.entity_type, input.entity_id, evaluation);
  }

  return evaluation;
}

export async function getLatestCondition(
  entityType: 'division' | 'department' | 'workspace' | 'project',
  entityId: string
) {
  const sql = getDabosSql();
  const rows = await sql`
    SELECT condition, confidence, basis, created_at
    FROM conditions
    WHERE entity_type = ${entityType} AND entity_id = ${entityId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getLatestStatValue(divisionId: string, metricKey: string) {
  const sql = getDabosSql();
  const rows = await sql`
    SELECT value::float8 AS value, recorded_at
    FROM stats
    WHERE division_id = ${divisionId}
      AND department_id IS NULL
      AND metric_key = ${metricKey}
    ORDER BY recorded_at DESC
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return { value: Number(row.value), recorded_at: row.recorded_at as string };
}

export async function countOpenTasks(divisionId: string): Promise<number> {
  const sql = getDabosSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS n
    FROM tasks
    WHERE division_id = ${divisionId}
      AND status IN ('todo', 'doing', 'blocked')
  `;
  return (rows[0]?.n as number) ?? 0;
}

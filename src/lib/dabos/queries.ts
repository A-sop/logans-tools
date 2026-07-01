import { evaluateConditionFromPoints } from '@/lib/dabos/conditions';
import { formatConditionTooltip } from '@/lib/dabos/condition-display';
import {
  advanceEntityWorkingCondition,
  getEntityConditionState,
  recordFormulaCompletion,
  syncEntityConditionFromEvaluation,
  upsertEntityConditionState,
} from '@/lib/dabos/condition-state-queries';
import type { DangerWhyBasis, FormulaStepNote } from '@/lib/dabos/condition-state';
import {
  evaluateBoardConditionsWithSql,
  refreshAllConditionsFromBoardWithSql,
  type BoardConditionsResult,
  type BoardWeekContext,
} from '@/lib/dabos/board-conditions-query';
import { getDabosSql } from '@/lib/dabos/db';
import type { EntityType } from '@/lib/dabos/condition-state';
import type { ConditionEvaluation } from '@/lib/dabos/types';

export type { BoardConditionsResult, BoardWeekContext };
export { formatConditionTooltip };

export {
  advanceEntityWorkingCondition,
  getEntityConditionState,
  recordFormulaCompletion,
} from '@/lib/dabos/condition-state-queries';

export async function completeFormulaForEntity(input: {
  entity_type: EntityType;
  entity_id: string;
  condition_label: NonNullable<ConditionEvaluation['condition']>;
  steps_completed: FormulaStepNote[];
  probable_why?: string;
  danger_why_basis?: DangerWhyBasis;
  attested_by?: string;
  verified_by?: string;
  advance?: boolean;
}) {
  const sql = getDabosSql();
  const completion = await recordFormulaCompletion(sql, input);

  if (input.danger_why_basis && input.condition_label === 'Danger') {
    const state = await getEntityConditionState(sql, input.entity_type, input.entity_id);
    if (state?.working_condition) {
      await upsertEntityConditionState(sql, {
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        working_condition: state.working_condition,
        stat_indicated_condition: state.stat_indicated_condition,
        danger_why: input.danger_why_basis,
      });
    }
  }

  let advance: { advanced: boolean; working_condition: ConditionEvaluation['condition'] } = {
    advanced: false,
    working_condition: null,
  };
  if (input.advance && input.verified_by) {
    advance = await advanceEntityWorkingCondition(sql, input.entity_type, input.entity_id);
  }

  const state = await getEntityConditionState(sql, input.entity_type, input.entity_id);
  return {
    completion,
    entity_state: state,
    advance,
  };
}

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
  const label = evaluation.working_condition ?? evaluation.stat_indicated_condition;
  if (!label) return false;
  const sql = getDabosSql();
  await sql`
    INSERT INTO conditions (entity_type, entity_id, condition, confidence, basis)
    VALUES (
      ${entityType},
      ${entityId},
      ${label},
      ${evaluation.confidence},
      ${JSON.stringify(evaluation.basis)}::jsonb
    )
  `;
  return true;
}

async function evaluatePersistAndSync(
  entityType: EntityType,
  entityId: string,
  evaluation: ConditionEvaluation
): Promise<ConditionEvaluation> {
  const sql = getDabosSql();
  let merged = evaluation;
  try {
    merged = await syncEntityConditionFromEvaluation(sql, entityType, entityId, evaluation);
  } catch {
    /* entity_condition_state table may be missing before migration 008 */
    if (evaluation.stat_indicated_condition) {
      merged = {
        ...evaluation,
        working_condition: evaluation.stat_indicated_condition,
        condition: evaluation.stat_indicated_condition,
      };
    }
  }
  if (merged.working_condition ?? merged.stat_indicated_condition) {
    await persistConditionEvaluation(entityType, entityId, merged);
  }
  return merged;
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

  return evaluatePersistAndSync(input.entity_type, input.entity_id, evaluation);
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

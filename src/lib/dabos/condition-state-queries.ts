import {
  advanceWorkingOneRung,
  canAdvanceWorking,
  hasClimbLag,
  syncWorkingCondition,
  type DangerWhyBasis,
  type EntityType,
  type FormulaStepNote,
} from '@/lib/dabos/condition-state';
import type { ConditionEvaluation } from '@/lib/dabos/types';
import type { DabosSql } from '@/lib/dabos/dabos-connection';

export type { EntityType } from '@/lib/dabos/condition-state';

export function mergeEvaluationWithWorking(
  evaluation: ConditionEvaluation,
  workingCondition: ReturnType<typeof syncWorkingCondition>
): ConditionEvaluation {
  const stat = evaluation.stat_indicated_condition;
  return {
    ...evaluation,
    working_condition: workingCondition,
    condition: workingCondition,
    climb_lag: hasClimbLag(workingCondition, stat),
    basis: {
      ...evaluation.basis,
      working_condition: workingCondition,
      stat_indicated_condition: stat,
      climb_lag: hasClimbLag(workingCondition, stat),
    },
  };
}

export async function getEntityConditionState(
  sql: DabosSql,
  entityType: EntityType,
  entityId: string
) {
  const rows = await sql`
    SELECT entity_type, entity_id, working_condition, stat_indicated_condition,
           stat_indicated_at, danger_why, updated_at
    FROM entity_condition_state
    WHERE entity_type = ${entityType} AND entity_id = ${entityId}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    entity_type: row.entity_type as EntityType,
    entity_id: row.entity_id as string,
    working_condition: row.working_condition as ConditionEvaluation['condition'],
    stat_indicated_condition: (row.stat_indicated_condition as ConditionEvaluation['condition']) ?? null,
    stat_indicated_at: row.stat_indicated_at
      ? (row.stat_indicated_at as Date).toISOString()
      : null,
    danger_why: (row.danger_why as DangerWhyBasis | null) ?? null,
    updated_at: (row.updated_at as Date).toISOString(),
  };
}

export async function upsertEntityConditionState(
  sql: DabosSql,
  input: {
    entity_type: EntityType;
    entity_id: string;
    working_condition: NonNullable<ConditionEvaluation['working_condition']>;
    stat_indicated_condition: ConditionEvaluation['stat_indicated_condition'];
    danger_why?: DangerWhyBasis | null;
  }
): Promise<void> {
  const statAt = input.stat_indicated_condition ? new Date() : null;
  await sql`
    INSERT INTO entity_condition_state (
      entity_type, entity_id, working_condition,
      stat_indicated_condition, stat_indicated_at, danger_why, updated_at
    )
    VALUES (
      ${input.entity_type},
      ${input.entity_id},
      ${input.working_condition},
      ${input.stat_indicated_condition},
      ${statAt},
      ${input.danger_why ? JSON.stringify(input.danger_why) : null}::jsonb,
      NOW()
    )
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
      working_condition = EXCLUDED.working_condition,
      stat_indicated_condition = EXCLUDED.stat_indicated_condition,
      stat_indicated_at = EXCLUDED.stat_indicated_at,
      danger_why = COALESCE(EXCLUDED.danger_why, entity_condition_state.danger_why),
      updated_at = NOW()
  `;
}

export async function syncEntityConditionFromEvaluation(
  sql: DabosSql,
  entityType: EntityType,
  entityId: string,
  evaluation: ConditionEvaluation
): Promise<ConditionEvaluation> {
  const existing = await getEntityConditionState(sql, entityType, entityId);
  const working = syncWorkingCondition(
    existing?.working_condition ?? null,
    evaluation.stat_indicated_condition
  );
  await upsertEntityConditionState(sql, {
    entity_type: entityType,
    entity_id: entityId,
    working_condition: working,
    stat_indicated_condition: evaluation.stat_indicated_condition,
    danger_why:
      (evaluation.basis.danger_why as DangerWhyBasis | undefined) ?? existing?.danger_why ?? null,
  });
  return mergeEvaluationWithWorking(evaluation, working);
}

export async function getLatestFormulaCompletion(
  sql: DabosSql,
  entityType: EntityType,
  entityId: string
) {
  const rows = await sql`
    SELECT condition_label, verified_at, created_at
    FROM condition_formula_completions
    WHERE entity_type = ${entityType} AND entity_id = ${entityId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    condition_label: row.condition_label as NonNullable<ConditionEvaluation['condition']>,
    verified_at: row.verified_at ? (row.verified_at as Date).toISOString() : null,
    created_at: (row.created_at as Date).toISOString(),
  };
}

export async function recordFormulaCompletion(
  sql: DabosSql,
  input: {
    entity_type: EntityType;
    entity_id: string;
    condition_label: NonNullable<ConditionEvaluation['condition']>;
    steps_completed: FormulaStepNote[];
    probable_why?: string;
    danger_why_basis?: DangerWhyBasis;
    attested_by?: string;
    verified_by?: string;
  }
) {
  const verified = input.verified_by ? new Date().toISOString() : null;
  const rows = await sql`
    INSERT INTO condition_formula_completions (
      entity_type, entity_id, condition_label, steps_completed,
      probable_why, danger_why_basis, attested_by, verified_by, verified_at
    )
    VALUES (
      ${input.entity_type},
      ${input.entity_id},
      ${input.condition_label},
      ${JSON.stringify(input.steps_completed)}::jsonb,
      ${input.probable_why ?? null},
      ${input.danger_why_basis ? JSON.stringify(input.danger_why_basis) : null}::jsonb,
      ${input.attested_by ?? 'human'},
      ${input.verified_by ?? null},
      ${verified}::timestamptz
    )
    RETURNING id, created_at
  `;
  return rows[0];
}

export async function advanceEntityWorkingCondition(
  sql: DabosSql,
  entityType: EntityType,
  entityId: string
): Promise<{ advanced: boolean; working_condition: ConditionEvaluation['condition'] }> {
  const state = await getEntityConditionState(sql, entityType, entityId);
  if (!state?.working_condition) {
    return { advanced: false, working_condition: null };
  }
  const latest = await getLatestFormulaCompletion(sql, entityType, entityId);
  if (!canAdvanceWorking(state.working_condition, latest)) {
    return { advanced: false, working_condition: state.working_condition };
  }
  const next = advanceWorkingOneRung(state.working_condition);
  if (!next) {
    return { advanced: false, working_condition: state.working_condition };
  }
  await sql`
    UPDATE entity_condition_state
    SET working_condition = ${next}, updated_at = NOW()
    WHERE entity_type = ${entityType} AND entity_id = ${entityId}
  `;
  return { advanced: true, working_condition: next };
}

/**
 * PRD-004 v2 — working condition vs stat-indicated; sequential formula climb.
 * @see DABOS/docs/PRD-004-conditions-memory-governance.md § Sequential formula completion
 */
import {
  conditionSeverity,
  nextBetterCondition,
  type ConditionLabel,
} from '@/lib/dabos/condition-ladder';

export type EntityType = 'division' | 'department' | 'workspace' | 'project';

export type DangerWhyBasis = {
  scope: 'person' | 'post' | 'division' | 'department' | 'project';
  entity_id: string;
  metric_key?: string;
  stat_values?: number[];
  ideal_scene?: string;
  situation?: string;
  out_points?: string[];
  draft_why?: string;
  probable_why?: string;
  opens_door_to_handling?: boolean;
  surprised?: boolean;
  track: 'org' | 'individual';
  excluded?: string[];
};

export type FormulaStepNote = {
  step: number;
  note: string;
};

export type EntityConditionState = {
  entity_type: EntityType;
  entity_id: string;
  working_condition: ConditionLabel;
  stat_indicated_condition: ConditionLabel | null;
  stat_indicated_at: string | null;
  danger_why: DangerWhyBasis | null;
  updated_at: string;
};

/** Default working rung for entities with no state row. */
export const DEFAULT_WORKING_CONDITION: ConditionLabel = 'Non-Existence';

/**
 * On stat refresh: drop working if stats got worse; never auto-improve from stats alone.
 */
export function syncWorkingCondition(
  currentWorking: ConditionLabel | null,
  statIndicated: ConditionLabel | null
): ConditionLabel {
  const working = currentWorking ?? DEFAULT_WORKING_CONDITION;
  if (!statIndicated) return working;
  if (conditionSeverity(statIndicated) > conditionSeverity(working)) {
    return statIndicated;
  }
  return working;
}

/** True when stat suggests a healthier rung than working (formulas still required). */
export function hasClimbLag(
  working: ConditionLabel,
  statIndicated: ConditionLabel | null
): boolean {
  if (!statIndicated) return false;
  return conditionSeverity(statIndicated) < conditionSeverity(working);
}

/** Rung gap: how many EP advances needed if stat jumped ahead (never skip). */
export function rungsToClimb(
  working: ConditionLabel,
  statIndicated: ConditionLabel | null
): number {
  if (!statIndicated) return 0;
  const gap = conditionSeverity(working) - conditionSeverity(statIndicated);
  return Math.max(0, gap);
}

/**
 * After verified formula EP at `working`, advance exactly one rung (never skip).
 */
export function advanceWorkingOneRung(working: ConditionLabel): ConditionLabel | null {
  return nextBetterCondition(working);
}

export function canAdvanceWorking(
  working: ConditionLabel,
  latestCompletion: { condition_label: ConditionLabel; verified_at: string | null } | null
): boolean {
  if (!latestCompletion?.verified_at) return false;
  return latestCompletion.condition_label === working;
}

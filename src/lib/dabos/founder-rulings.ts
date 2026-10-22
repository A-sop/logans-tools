/**
 * Condition assignment (founder ruling 2026-10-22 22:31, one rule):
 * Dept19 Conditions together with Dept3 Ethics assign conditions across the
 * whole ladder (Confusion..Power Change) on stat evidence (default path,
 * source 'dept19_ethics'). The founder may override any condition at any time
 * (source 'founder_ruling'). Both are assigned rows: they take precedence over
 * computed (stat-indicated/default) working conditions until a verified formula
 * advance or a newer assignment replaces them. The upgrade gate is unchanged:
 * only a founder_ruling authorises a raise.
 * @see DABOS docs/reference/conditions-ethics-ssot.md
 */
import { conditionSeverity, type ConditionLabel } from '@/lib/dabos/condition-ladder';
import type { ConditionEvaluation } from '@/lib/dabos/types';

export const CONDITION_SOURCES = ['computed', 'formula', 'founder_ruling', 'dept19_ethics'] as const;
export type ConditionSource = (typeof CONDITION_SOURCES)[number];

/** Assigned (not computed) sources: stat refresh never overwrites these. */
export const ASSIGNED_CONDITION_SOURCES = ['founder_ruling', 'dept19_ethics'] as const;

export function isAssignedSource(source: ConditionSource | null | undefined): boolean {
  return source === 'founder_ruling' || source === 'dept19_ethics';
}

export type FounderRulingPreset = {
  entity_type: 'division' | 'department';
  entity_ids: string[];
  condition: ConditionLabel;
  ruling_date: string;
  ruling_ref: string;
  ruling_note?: string;
};

const ALL_DEPTS = Array.from({ length: 21 }, (_, i) => `Dept${i + 1}`);

export const FOUNDER_RULING_PRESETS: Record<string, FounderRulingPreset> = {
  '2026-10-16-confusion': {
    entity_type: 'department',
    entity_ids: ALL_DEPTS,
    condition: 'Confusion',
    ruling_date: '2026-10-16',
    ruling_ref: 'DABOS:docs/reference/staff-status/receipts/founder-decision-treason-2026-10-16.md',
    ruling_note: 'Founder rejected Treason claims; all Dept1-21 assigned Confusion.',
  },
};

/** An assigned condition (founder ruling or Dept19 + Dept3 Ethics) wins over the computed working condition. */
export function resolveWorkingWithOverride(
  computed: ConditionLabel,
  existing: { working_condition: ConditionLabel; condition_source?: ConditionSource | null } | null
): ConditionLabel {
  if (existing && isAssignedSource(existing.condition_source)) return existing.working_condition;
  return computed;
}

/**
 * Upgrade gate (founder ruling 2026-10-22, DABOS receipt
 * staff-status/receipts/founder-decision-upgrade-gate-2026-10-22.md):
 * automated paths (week close, condition sync) may never RAISE the working
 * condition. A higher rung than the stored one is only kept when the stored
 * row is a founder ruling authorising it. Downgrades pass through unchanged.
 */
export function guardNoUnauthorisedUpgrade(
  previous: ConditionLabel | null,
  proposed: ConditionLabel,
  previousSource?: ConditionSource | null
): ConditionLabel {
  if (!previous) return proposed;
  const isUpgrade = conditionSeverity(proposed) < conditionSeverity(previous);
  if (!isUpgrade) return proposed;
  if (previousSource === 'founder_ruling') return proposed;
  return previous;
}

/**
 * Upgrade gate for the raw-stat fallback (used when entity_condition_state cannot
 * be read, e.g. before migration 008). With no stored row there is no way to see
 * a founder ruling, so the stat stays a suggestion: working_condition and
 * condition are cleared and nothing is persisted as the entity's condition.
 */
export function rawStatFallbackEvaluation(evaluation: ConditionEvaluation): ConditionEvaluation {
  return {
    ...evaluation,
    working_condition: null,
    condition: null,
    basis: {
      ...evaluation.basis,
      upgrade_gate: 'working_state_unavailable_stat_is_suggestion_only',
    },
  };
}
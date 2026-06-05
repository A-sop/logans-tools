import type { ConditionEvaluation, ConditionLabel } from '@/lib/dabos/types';
import { conditionSeverity } from '@/lib/dabos/condition-ladder';

export type ExecutiveRollup = {
  condition: ConditionEvaluation;
  /** Bottleneck percentile among child divisions (min = worst). */
  percentile: number | null;
  child_ids: string[];
};

function worstCondition(a: ConditionEvaluation, b: ConditionEvaluation): ConditionEvaluation {
  if (!a.condition) return b;
  if (!b.condition) return a;
  return conditionSeverity(a.condition) >= conditionSeverity(b.condition) ? a : b;
}

export function worstWinsRollup(
  childIds: string[],
  conditions: Map<string, ConditionEvaluation>,
  percentiles: Map<string, number | null>,
  meta: { rollup_id: string; rollup_label: string }
): ExecutiveRollup {
  let merged: ConditionEvaluation = {
    condition: null,
    confidence: null,
    point_count: 0,
    basis: { rollup_id: meta.rollup_id, child_ids: childIds },
    reason: 'insufficient_data',
  };

  const childPercentiles: number[] = [];
  const childConditions: ConditionEvaluation[] = [];

  for (const id of childIds) {
    const ev = conditions.get(id);
    if (ev) {
      childConditions.push(ev);
      if (ev.condition) {
        merged = merged.condition ? worstCondition(merged, ev) : ev;
      }
    }
    const pct = percentiles.get(id);
    if (pct != null && Number.isFinite(pct)) {
      childPercentiles.push(pct);
    }
  }

  const bottleneckPct =
    childPercentiles.length > 0 ? Math.min(...childPercentiles) : null;

  if (!merged.condition && childConditions.some((c) => c.point_count >= 3)) {
    merged = {
      ...merged,
      reason: 'insufficient_data',
      point_count: Math.max(...childConditions.map((c) => c.point_count)),
    };
  } else if (merged.condition) {
    merged = {
      ...merged,
      basis: {
        ...merged.basis,
        rollup_id: meta.rollup_id,
        rollup_label: meta.rollup_label,
        rule: 'worst-wins among child division conditions',
        child_conditions: Object.fromEntries(
          childIds.map((id) => [id, conditions.get(id)?.condition ?? null])
        ),
        bottleneck_percentile: bottleneckPct,
      },
    };
  }

  return {
    condition: merged,
    percentile: bottleneckPct,
    child_ids: childIds,
  };
}

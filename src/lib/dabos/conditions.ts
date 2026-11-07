import type { ConditionEvaluation } from '@/lib/dabos/types';
import {
  CONDITION_RULE_SUMMARY,
  conditionFromStatTrend,
} from '@/lib/dabos/condition-ladder';

export function evaluateConditionFromPoints(
  values: number[],
  meta: { entity_type: string; entity_id: string; metric_key: string; window_days: number }
): ConditionEvaluation {
  if (values.length < 3) {
    // Honest indicated rung when there is no trend yet: Non-Existence
    // (blank/null is not allowed — founder 2026-11-06). Working rung is separate.
    return {
      condition: 'Non-Existence',
      stat_indicated_condition: 'Non-Existence',
      working_condition: null,
      confidence: 0.2,
      point_count: values.length,
      basis: {
        ...meta,
        values,
        rule: 'insufficient_data → stat_indicated Non-Existence (no 3-period series)',
        kind: 'stat_indicated',
      },
      reason: 'insufficient_data',
    };
  }

  const statIndicated = conditionFromStatTrend(values);
  const confidence = Math.min(0.95, 0.5 + values.length * 0.08);

  return {
    condition: statIndicated,
    stat_indicated_condition: statIndicated,
    working_condition: null,
    confidence,
    point_count: values.length,
    basis: {
      ...meta,
      values,
      rule: CONDITION_RULE_SUMMARY,
      kind: 'stat_indicated',
      ladder: 'Power Change → Power → Affluence → Normal → Emergency → Danger → Non-Existence',
    },
  };
}

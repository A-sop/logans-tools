import type { ConditionEvaluation, ConditionLabel } from '@/lib/dabos/types';

type Trend = 'up' | 'flat' | 'down';

function trendFromValues(values: number[]): Trend {
  if (values.length < 2) return 'flat';
  const mid = Math.floor(values.length / 2);
  const first = values.slice(0, mid);
  const second = values.slice(mid);
  const avg = (arr: number[]) => arr.reduce((sum, v) => sum + v, 0) / arr.length;
  const avgFirst = avg(first);
  const avgSecond = avg(second);
  const delta = avgSecond - avgFirst;
  const threshold = Math.max(Math.abs(avgFirst) * 0.05, 0.01);
  if (delta > threshold) return 'up';
  if (delta < -threshold) return 'down';
  return 'flat';
}

function conditionFromTrend(trend: Trend): ConditionLabel {
  if (trend === 'up') return 'Normal';
  if (trend === 'down') return 'Danger';
  return 'Emergency';
}

export function evaluateConditionFromPoints(
  values: number[],
  meta: { entity_type: string; entity_id: string; metric_key: string; window_days: number }
): ConditionEvaluation {
  if (values.length < 3) {
    return {
      condition: null,
      confidence: null,
      point_count: values.length,
      basis: { ...meta, values },
      reason: 'insufficient_data',
    };
  }

  const trend = trendFromValues(values);
  const condition = conditionFromTrend(trend);
  const confidence = Math.min(0.95, 0.5 + values.length * 0.08);

  return {
    condition,
    confidence,
    point_count: values.length,
    basis: {
      ...meta,
      trend,
      values,
      rule: 'up=Normal, flat=Emergency, down=Danger',
    },
  };
}

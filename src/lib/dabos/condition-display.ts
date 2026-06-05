import type { ConditionEvaluation, ConditionLabel } from '@/lib/dabos/types';
import { conditionSlug } from '@/lib/dabos/condition-ladder';

export type BoardStatSnapshot = {
  metric_key: string;
  value: number;
  calendar_week: number;
  point_count: number;
};

export function conditionCssClass(condition: ConditionLabel | null | undefined): string {
  if (!condition) return 'dabos-org-board__condition--unknown';
  return `dabos-org-board__condition--${conditionSlug(condition)}`;
}

export function conditionDataAttr(condition: ConditionLabel | null | undefined): string {
  if (!condition) return 'none';
  return conditionSlug(condition);
}

/** Short label shown on hover (replaces tooltips on the org board). */
export function conditionHoverLabel(
  condition: ConditionLabel | null,
  stat?: BoardStatSnapshot | null
): string {
  if (condition) return condition;
  if (stat && stat.point_count > 0) return 'Insufficient data';
  return 'No data';
}

/** Legacy string formatter (API / detail pages). */
export function formatBoardTooltip(
  ev: ConditionEvaluation,
  stat?: BoardStatSnapshot | null
): string {
  if (ev.reason === 'insufficient_data' || ev.point_count < 3) {
    if (stat) {
      return `Condition: Insufficient trend (${stat.point_count} of 3 weeks)\nLatest: ${stat.metric_key} = ${formatStatValue(stat.value)} (CW ${stat.calendar_week})`;
    }
    return `Condition: No data yet (${ev.point_count} of 3 weekly points)`;
  }
  if (!ev.condition) {
    return 'Condition: Unknown';
  }

  const lines = [`Condition: ${ev.condition}`];
  if (stat) {
    lines.push(
      `Latest: ${stat.metric_key} = ${formatStatValue(stat.value)} (CW ${stat.calendar_week})`
    );
    lines.push(`${stat.point_count} weekly points`);
  }
  return lines.join('\n');
}

function formatStatValue(value: number): string {
  if (Math.abs(value) >= 1000) return value.toLocaleString('en-DE', { maximumFractionDigits: 0 });
  if (Math.abs(value) < 10 && value % 1 !== 0) return value.toFixed(2);
  return String(Math.round(value * 100) / 100);
}

/** @deprecated use formatBoardTooltip */
export function formatConditionTooltip(
  ev: ConditionEvaluation,
  extras?: { percentile?: number | null; weekLabel?: string }
): string {
  return formatBoardTooltip(ev);
}

export function emptyCondition(entityId: string, metricKey: string): ConditionEvaluation {
  return {
    condition: null,
    confidence: null,
    point_count: 0,
    basis: { entity_id: entityId, metric_key: metricKey, window_days: 7 },
    reason: 'insufficient_data',
  };
}

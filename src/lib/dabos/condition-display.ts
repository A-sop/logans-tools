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
  stat?: BoardStatSnapshot | null,
  extras?: { statIndicated?: ConditionLabel | null; climbLag?: boolean }
): string {
  const n = stat?.point_count ?? 0;
  if (condition) {
    const base =
      extras?.climbLag && extras.statIndicated && extras.statIndicated !== condition
        ? `${condition} · stat ${extras.statIndicated}`
        : condition;
    if (n > 0 && n < 3) return `${base} · ${n}/3 toward condition`;
    if (stat && n >= 3) {
      const zeroNote = stat.value === 0 ? ' · 0 (honest)' : '';
      return `${base}${zeroNote}`;
    }
    return base;
  }
  if (n > 0) return `Non-Existence · ${n}/3 toward condition`;
  return 'Missing · no emit this series';
}

/** Legacy string formatter (API / detail pages). */
export function formatBoardTooltip(
  ev: ConditionEvaluation,
  stat?: BoardStatSnapshot | null
): string {
  const n = Math.max(ev.point_count, stat?.point_count ?? 0);
  const working = ev.working_condition ?? ev.condition ?? 'Non-Existence';

  if (ev.reason === 'insufficient_data' || n < 3) {
    const lines = [`Working: ${working}`, `${n} of 3 weekly points toward condition`];
    if (stat) {
      lines.push(
        `Latest: ${stat.metric_key} = ${formatStatValue(stat.value)} (CW ${stat.calendar_week})`
      );
      if (stat.value === 0) lines.push('Value 0 with provenance = honest empty (not Missing)');
    } else {
      lines.push('Missing emit — Dept3 crawl should open a reason task');
    }
    return lines.join('\n');
  }
  if (!ev.condition && !ev.working_condition) {
    return 'Working: Non-Existence';
  }

  const lines = [`Working: ${working}`];
  if (ev.stat_indicated_condition && ev.stat_indicated_condition !== working) {
    lines.push(`Stat suggests: ${ev.stat_indicated_condition}`);
    if (ev.climb_lag) {
      lines.push('Complete working formula before climbing (no rung skips).');
    }
  }
  if (stat) {
    lines.push(
      `Latest: ${stat.metric_key} = ${formatStatValue(stat.value)} (CW ${stat.calendar_week})`
    );
    lines.push(`${stat.point_count} weekly points`);
    if (stat.value === 0) lines.push('Honest zero');
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
  void extras;
  return formatBoardTooltip(ev);
}

export function emptyCondition(entityId: string, metricKey: string): ConditionEvaluation {
  return {
    condition: null,
    stat_indicated_condition: null,
    working_condition: null,
    confidence: null,
    point_count: 0,
    basis: { entity_id: entityId, metric_key: metricKey, window_days: 7 },
    reason: 'insufficient_data',
  };
}

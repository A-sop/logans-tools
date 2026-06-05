/**
 * PRD-004 upper condition ladder (best → worst).
 * @see DABOS/docs/PRD-004-conditions-memory-governance.md
 */
export const UPPER_CONDITION_LADDER = [
  'Power Change',
  'Power',
  'Affluence',
  'Normal',
  'Emergency',
  'Danger',
  'Non-Existence',
] as const;

export type ConditionLabel = (typeof UPPER_CONDITION_LADDER)[number];

/** Ladder index: 0 = best (Power Change), 6 = worst (Non-Existence). Higher = worse. */
export function conditionSeverity(label: ConditionLabel): number {
  return UPPER_CONDITION_LADDER.indexOf(label);
}

export function isConditionLabel(value: string): value is ConditionLabel {
  return (UPPER_CONDITION_LADDER as readonly string[]).includes(value);
}

/** CSS / data-attribute slug (e.g. Power Change → power-change). */
export function conditionSlug(label: ConditionLabel): string {
  return label.toLowerCase().replace(/\s+/g, '-');
}

const RELATIVE_THRESHOLDS: { minRelativeDelta: number; condition: ConditionLabel }[] = [
  { minRelativeDelta: 0.2, condition: 'Power Change' },
  { minRelativeDelta: 0.12, condition: 'Power' },
  { minRelativeDelta: 0.06, condition: 'Affluence' },
  { minRelativeDelta: -0.04, condition: 'Normal' },
  { minRelativeDelta: -0.1, condition: 'Emergency' },
  { minRelativeDelta: -0.18, condition: 'Danger' },
];

/**
 * Map weekly stat trend to PRD-004 upper ladder (3+ points required by caller).
 * Uses relative change between first/second half averages.
 */
export function conditionFromStatTrend(values: number[]): ConditionLabel {
  const mid = Math.floor(values.length / 2);
  const first = values.slice(0, mid);
  const second = values.slice(mid);
  const avg = (arr: number[]) => arr.reduce((sum, v) => sum + v, 0) / arr.length;
  const avgFirst = avg(first);
  const avgSecond = avg(second);
  const delta = avgSecond - avgFirst;
  const relativeDelta = delta / Math.max(Math.abs(avgFirst), 0.01);

  for (const step of RELATIVE_THRESHOLDS) {
    if (relativeDelta >= step.minRelativeDelta) {
      return step.condition;
    }
  }

  return 'Non-Existence';
}

export const CONDITION_RULE_SUMMARY =
  'PRD-004 upper ladder from relative weekly trend (Power Change … Non-Existence)';

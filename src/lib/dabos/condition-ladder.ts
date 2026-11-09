/**
 * PRD-004 full condition scale incl. lower conditions below Non-Existence (ruling 21 Oct 2026).
 * SSOT: DABOS docs/reference/conditions-ethics-ssot.md
 * (best → worst).
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
  'Liability',
  'Doubt',
  'Enemy',
  'Treason',
  'Confusion',
] as const;

export type ConditionLabel = (typeof UPPER_CONDITION_LADDER)[number];

/** Ladder index: 0 = best (Power Change), 11 = worst (Confusion). Higher = worse. Lower conditions (Liability..Confusion) are assigned, never stat-indicated. */
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

/** Next rung toward Power Change (one step better). Null if already at top. */
export function nextBetterCondition(label: ConditionLabel): ConditionLabel | null {
  const idx = conditionSeverity(label);
  if (idx <= 0) return null;
  return UPPER_CONDITION_LADDER[idx - 1]!;
}

/** Absolute production floor: a flat series at/near zero is not Normal (founder 2026-11-06). */
export const FLAT_ZERO_ABS_EPSILON = 1e-9;

/**
 * Map weekly stat trend to PRD-004 **stat-indicated** upper ladder (3+ points required by caller).
 * Does not set working condition — see condition-state.ts.
 *
 * Flat non-zero bands → Normal. Flat **zero / near-zero absolute** → Non-Existence
 * (doing nothing is not Normal — founder audit Dept4 2026-11-06).
 */
export function conditionFromStatTrend(values: number[]): ConditionLabel {
  const absMax = Math.max(...values.map((v) => Math.abs(v)));
  if (absMax <= FLAT_ZERO_ABS_EPSILON) {
    return 'Non-Existence';
  }

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
  'PRD-004 stat-indicated ladder from relative weekly trend (Power Change … Non-Existence); flat absolute-zero series → Non-Existence (not Normal)';

/**
 * One-line next climb hint for founder UI (PRD-014 Phase C).
 * Not a substitute for the ethics handbook — just the first move.
 */
const CLIMB_HINTS: Partial<Record<ConditionLabel, string>> = {
  Confusion: 'Get orientation — find who is on post and what the product is.',
  Treason: 'Deliver the product you agreed to; stop covert opposition.',
  Enemy: 'Cease hostilities; open an honest line with the org.',
  Doubt: 'Pick a side — this project or leave cleanly.',
  Liability: 'Repair known damage; stop the harm you were warned about.',
  'Non-Existence': 'New Post: find a line → make yourself known → learn what is needed → produce it.',
  Danger: 'Handle the out-point first (Probable WHY); then resume production.',
  Emergency: 'Ignore distractions; push the one vital action that changes the stat.',
  Normal: 'Keep exchanging; raise quality without inventing crises.',
  Affluence: 'Protect the channels that are working; do not over-expand.',
  Power: 'Take responsibility for the whole product; hand down authority cleanly.',
  'Power Change': 'Complete the handoff formula — leave the post in Power for the next holder.',
};

/** Short climb cue for the working condition (or null if unknown). */
export function climbHintForCondition(label: string | null | undefined): string | null {
  if (!label || !isConditionLabel(label)) return null;
  return CLIMB_HINTS[label] ?? `Complete the ${label} formula to EP, then improve one rung.`;
}

'use client';

import { cn } from '@/lib/utils';
import type { ConditionLabel } from '@/lib/dabos/types';

const tone: Record<ConditionLabel, string> = {
  'Power Change': 'bg-teal-500/20 text-teal-900 dark:text-teal-300',
  Power: 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-300',
  Affluence: 'bg-lime-500/15 text-lime-900 dark:text-lime-400',
  Normal: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-400',
  Emergency: 'bg-amber-500/15 text-amber-800 dark:text-amber-400',
  Danger: 'bg-destructive/15 text-destructive',
  'Non-Existence': 'bg-neutral-800/15 text-neutral-700 dark:text-neutral-300',
  Liability: 'bg-rose-500/15 text-rose-800 dark:text-rose-300',
  Doubt: 'bg-rose-600/20 text-rose-900 dark:text-rose-300',
  Enemy: 'bg-red-700/20 text-red-900 dark:text-red-300',
  Treason: 'bg-red-900/25 text-red-950 dark:text-red-200',
  Confusion: 'bg-purple-900/25 text-purple-950 dark:text-purple-200',
};

export function ConditionBadge({
  condition,
  confidence,
  reason,
  statIndicated,
  climbLag,
  pointCount,
}: {
  condition: ConditionLabel | null;
  confidence?: number | null;
  reason?: string;
  statIndicated?: ConditionLabel | null;
  climbLag?: boolean;
  /** Weekly points toward the ≥3 condition gate */
  pointCount?: number | null;
}) {
  if (!condition) {
    const n = pointCount ?? 0;
    const thinSeries = reason === 'insufficient_data' || n > 0;
    const label = thinSeries
      ? n > 0
        ? `Non-Existence · ${n}/3`
        : 'Missing'
      : 'Unknown';
    return (
      <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {label}
      </span>
    );
  }

  const n = pointCount;
  const showProgress = n != null && n > 0 && n < 3;

  return (
    <span className="inline-flex flex-col gap-0.5">
      <span
        className={cn(
          'inline-flex rounded-md px-2 py-0.5 text-xs font-medium tabular-nums',
          tone[condition]
        )}
      >
        {condition}
        {confidence != null ? ` · ${Math.round(confidence * 100)}%` : ''}
        {showProgress ? ` · ${n}/3` : ''}
      </span>
      {climbLag && statIndicated && statIndicated !== condition ? (
        <span className="text-[10px] text-muted-foreground">Stat: {statIndicated}</span>
      ) : null}
    </span>
  );
}

export function ActivityBadge({
  activity,
}: {
  activity: 'active' | 'idle' | 'issue' | 'investigating';
}) {
  const label =
    activity === 'investigating'
      ? 'Investigating'
      : activity === 'active'
        ? 'Active'
        : activity === 'issue'
          ? 'Issue'
          : 'Idle';
  const cls =
    activity === 'investigating'
      ? 'bg-violet-500/15 text-violet-900 dark:text-violet-300'
      : activity === 'active'
        ? 'bg-primary/10 text-primary'
        : activity === 'issue'
          ? 'bg-destructive/15 text-destructive'
          : 'bg-muted text-muted-foreground';

  return (
    <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', cls)}>
      {label}
    </span>
  );
}

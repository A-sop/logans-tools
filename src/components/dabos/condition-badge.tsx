'use client';

import { cn } from '@/lib/utils';
import type { ConditionLabel } from '@/lib/dabos/types';

const tone: Record<string, string> = {
  Normal: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-400',
  Emergency: 'bg-amber-500/15 text-amber-800 dark:text-amber-400',
  Danger: 'bg-destructive/15 text-destructive',
};

export function ConditionBadge({
  condition,
  confidence,
  reason,
}: {
  condition: ConditionLabel | null;
  confidence?: number | null;
  reason?: string;
}) {
  if (!condition) {
    return (
      <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {reason === 'insufficient_data' ? 'No data yet' : 'Unknown'}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-xs font-medium tabular-nums',
        tone[condition] ?? 'bg-muted text-muted-foreground'
      )}
    >
      {condition}
      {confidence != null ? ` · ${Math.round(confidence * 100)}%` : ''}
    </span>
  );
}

export function ActivityBadge({ activity }: { activity: 'active' | 'idle' | 'issue' }) {
  const label = activity === 'active' ? 'Active' : activity === 'issue' ? 'Issue' : 'Idle';
  const cls =
    activity === 'active'
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

'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

type StatCutoffCountdownProps = {
  deadlineIso: string;
  weekLabel: string;
  timezone: string;
  pastCurrentDeadline: boolean;
  /** PRD-014 Phase A: compact chip instead of billboard */
  compact?: boolean;
  className?: string;
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) {
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function StatCutoffCountdown({
  deadlineIso,
  weekLabel,
  timezone,
  pastCurrentDeadline,
  compact = false,
  className,
}: StatCutoffCountdownProps) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(deadlineIso).getTime() - Date.now())
  );

  useEffect(() => {
    const tick = () => {
      setRemaining(Math.max(0, new Date(deadlineIso).getTime() - Date.now()));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [deadlineIso]);

  const urgent = remaining > 0 && remaining < 4 * 60 * 60 * 1000;

  if (compact) {
    return (
      <div
        className={cn(
          'inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border border-white/25 bg-black/30 px-2.5 py-1 text-[color:var(--dabos-on-canvas)] shadow-sm',
          urgent && 'border-amber-300/60 bg-amber-950/50',
          className
        )}
        title={`${weekLabel} · Thu 14:00 ${timezone}${pastCurrentDeadline ? ' · next deadline' : ''}`}
      >
        <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">Cutoff</span>
        <span
          className={cn(
            'font-mono text-sm font-semibold tabular-nums tracking-tight',
            urgent ? 'text-amber-200' : 'text-[color:var(--dabos-on-canvas)]'
          )}
        >
          {formatCountdown(remaining)}
        </span>
        <span className="hidden text-[10px] opacity-75 sm:inline">
          Thu 14:00{pastCurrentDeadline ? ' · next' : ''}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-card px-3 py-2 shadow-sm',
        urgent && 'border-amber-500/50 bg-amber-500/5',
        className
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Stat cutoff
        </span>
        <span
          className={cn(
            'font-mono text-lg font-semibold tabular-nums tracking-tight',
            urgent ? 'text-amber-800 dark:text-amber-300' : 'text-foreground'
          )}
        >
          {formatCountdown(remaining)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Thu 14:00 {timezone}
        {pastCurrentDeadline ? ' · next deadline' : ''}
      </p>
      <p className="hidden max-w-md truncate text-[10px] text-muted-foreground/80 sm:block" title={weekLabel}>
        {weekLabel}
      </p>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { StatCutoffCountdown } from '@/components/dabos/stat-cutoff-countdown';
import { UserButton } from '@clerk/nextjs';
import type { DabosShellData } from '@/lib/dabos/server-data';
import { cn } from '@/lib/utils';

import { ActivityBadge } from './condition-badge';

type DabosChromeProps = {
  shell: DabosShellData | null;
};

/** Cloud DABOS surfaces (Neon). Phase A keeps current labels; Phase B shrinks IA. */
const DABOS_CHROME_LINKS = [
  { href: '/dabos', label: 'Board', match: (p: string) => p === '/dabos' },
  { href: '/dabos/digest', label: 'Status', match: (p: string) => p.startsWith('/dabos/digest') || p.startsWith('/dabos/status') },
  { href: '/dabos/conditions', label: 'Conditions', match: (p: string) => p.startsWith('/dabos/conditions') },
  { href: '/dabos/open', label: 'Open', match: (p: string) => p.startsWith('/dabos/open') },
  { href: '/dabos/comm', label: 'Comm', match: (p: string) => p.startsWith('/dabos/comm') },
  { href: '/dabos/prompts', label: 'Prompts', match: (p: string) => p.startsWith('/dabos/prompts') },
  { href: '/dabos/sipgate', label: 'sipgate', match: (p: string) => p.startsWith('/dabos/sipgate') },
] as const;

/** Cadence pills: Board + Status only (PRD-014 Phase A — not on empty Systems pages). */
function showCadencePills(pathname: string): boolean {
  return pathname === '/dabos' || pathname.startsWith('/dabos/digest') || pathname.startsWith('/dabos/status');
}

function formatLastRun(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function DabosChrome({ shell }: DabosChromeProps) {
  const pathname = usePathname() ?? '/dabos';
  const cadenceOk = showCadencePills(pathname);

  return (
    <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {shell ? (
          <>
            <StatCutoffCountdown
              deadlineIso={shell.cutoff.deadline_iso}
              weekLabel={shell.cutoff.week_label}
              timezone={shell.cutoff.timezone}
              pastCurrentDeadline={shell.cutoff.past_current_deadline}
              compact
            />
            {cadenceOk && shell.role_runs.length > 0 ? (
              <div className="flex flex-wrap gap-2 text-xs text-[color:var(--dabos-on-canvas)]/85">
                {shell.role_runs.map((run) => (
                  <span
                    key={run.role_id}
                    className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/25 px-2 py-0.5"
                  >
                    <span className="font-medium text-[color:var(--dabos-on-canvas)]">
                      {run.role_id.replace(/_/g, ' ')}
                    </span>
                    <span className="opacity-80">{formatLastRun(run.ran_at)}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <Link
            href="/dabos"
            className="text-sm font-medium text-[color:var(--dabos-on-canvas)]/80 hover:text-[color:var(--dabos-on-canvas)]"
          >
            DABOS — configure DATABASE_URL to enable cadence
          </Link>
        )}
      </div>
      <nav
        aria-label="DABOS"
        className="flex shrink-0 flex-wrap items-center gap-1 self-end sm:self-start"
      >
        {DABOS_CHROME_LINKS.map((link) => {
          const active = link.match(pathname);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-white/15 text-[color:var(--dabos-on-canvas)] ring-1 ring-white/35'
                  : 'text-[color:var(--dabos-on-canvas)]/75 hover:bg-white/10 hover:text-[color:var(--dabos-on-canvas)]'
              )}
            >
              {link.label}
            </Link>
          );
        })}
        <UserButton />
      </nav>
    </header>
  );
}

export function BoardCadenceStrip({
  openTasksTotal,
  divisionsActive,
  departmentsWorking = 0,
}: {
  openTasksTotal: number;
  divisionsActive: number;
  departmentsWorking?: number;
}) {
  return (
    <div className="dabos-org-board__cadence-strip mb-3 flex flex-wrap items-center gap-2 font-sans text-xs">
      <ActivityBadge
        activity={
          departmentsWorking > 0 ? 'investigating' : openTasksTotal > 0 ? 'active' : 'idle'
        }
      />
      <span className="text-muted-foreground">
        {departmentsWorking > 0
          ? `${departmentsWorking} department${departmentsWorking === 1 ? '' : 's'} working now · `
          : null}
        {openTasksTotal} open task{openTasksTotal === 1 ? '' : 's'} · {divisionsActive} division
        {divisionsActive === 1 ? '' : 's'} with work
      </span>
    </div>
  );
}

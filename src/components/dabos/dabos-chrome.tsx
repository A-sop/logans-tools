import Link from 'next/link';

import { StatCutoffCountdown } from '@/components/dabos/stat-cutoff-countdown';
import { UserButton } from '@clerk/nextjs';
import type { DabosShellData } from '@/lib/dabos/server-data';

import { ActivityBadge } from './condition-badge';

type DabosChromeProps = {
  shell: DabosShellData | null;
};

/** Cloud DABOS surfaces (Neon). Local-office pages (Status, Triage, DIL, Debt) stay at their URLs. */
const DABOS_CHROME_LINKS = [
  { href: '/dabos', label: 'Board' },
  { href: '/dabos/open', label: 'Open' },
  { href: '/dabos/sipgate', label: 'sipgate' },
] as const;

function formatLastRun(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function DabosChrome({ shell }: DabosChromeProps) {
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
            />
            {shell.role_runs.length > 0 ? (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {shell.role_runs.map((run) => (
                  <span
                    key={run.role_id}
                    className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5"
                  >
                    <span className="font-medium text-foreground">{run.role_id.replace(/_/g, ' ')}</span>
                    <span>{formatLastRun(run.ran_at)}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <Link
            href="/dabos"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            DABOS — configure DATABASE_URL to enable cadence
          </Link>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 self-end sm:self-start">
        {DABOS_CHROME_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
        <UserButton />
      </div>
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

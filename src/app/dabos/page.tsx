import Link from 'next/link';

import { DigestNeedRows } from '@/components/dabos/digest-need-rows';
import { getDabosSql, hasDabosDb } from '@/lib/dabos/db';
import { getStatCutoffSnapshot } from '@/lib/dabos/org-week';
import {
  partitionMachineAlerts,
  readLatestStatusDigest,
  readPendingApprovals,
} from '@/lib/dabos/status-digest';

export const metadata = {
  title: 'Home — DABOS',
  description: 'What needs you, what is on fire, and the next deadline',
};

export const dynamic = 'force-dynamic';

const NEEDS_YOU_CAP = 5;

function berlinDeadlineLine(deadlineIso: string, past: boolean): string {
  const when = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(deadlineIso));
  return past ? `Stat cutoff was ${when} Berlin — late` : `Next deadline: ${when} Berlin`;
}

export default async function DabosHomePage() {
  const cutoff = getStatCutoffSnapshot();
  const deadlineLine = berlinDeadlineLine(cutoff.deadline_iso, cutoff.past_current_deadline);

  if (!hasDabosDb()) {
    return (
      <main className="mx-auto max-w-2xl space-y-6 font-[family-name:var(--font-dabos-body)]">
        <header className="space-y-2">
          <p className="font-[family-name:var(--font-dabos-display)] text-3xl font-semibold tracking-tight text-[color:var(--dabos-on-canvas)] sm:text-4xl">
            DABOS
          </p>
          <p className="text-sm text-[color:var(--dabos-on-canvas)]/85">{deadlineLine}</p>
        </header>
        <p className="rounded-lg border border-dashed border-border bg-card px-3 py-3 text-sm text-muted-foreground">
          Database is not configured on this host. Add <code>DATABASE_URL</code>, then reload.
        </p>
      </main>
    );
  }

  let latest: Awaited<ReturnType<typeof readLatestStatusDigest>> = null;
  let pendingApprovals: Awaited<ReturnType<typeof readPendingApprovals>> = [];
  let loadError: string | null = null;
  try {
    const sql = getDabosSql();
    latest = await readLatestStatusDigest(sql);
    pendingApprovals = await readPendingApprovals(sql);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  const needs = (latest?.needsLogan ?? []).slice(0, NEEDS_YOU_CAP);
  const needsTotal = latest?.needsLogan.length ?? 0;
  const { actionable: machineAlerts } = partitionMachineAlerts(latest?.machineAlerts ?? []);
  const failCount = latest?.failAtHead.length ?? 0;
  const onFireCount = machineAlerts.length + failCount;

  return (
    <main className="mx-auto max-w-2xl space-y-6 font-[family-name:var(--font-dabos-body)]">
      <header className="space-y-2">
        <p className="font-[family-name:var(--font-dabos-display)] text-3xl font-semibold tracking-tight text-[color:var(--dabos-on-canvas)] sm:text-4xl">
          DABOS
        </p>
        <p
          className={
            cutoff.past_current_deadline
              ? 'text-sm font-medium text-[color:var(--dabos-danger)]'
              : 'text-sm text-[color:var(--dabos-on-canvas)]/85'
          }
        >
          {deadlineLine}
          {cutoff.week_label ? (
            <span className="ml-2 text-[color:var(--dabos-on-canvas)]/65">· {cutoff.week_label}</span>
          ) : null}
        </p>
        <p className="text-xs text-[color:var(--dabos-on-canvas)]/70">
          <Link
            href="/dabos/conditions"
            className="underline-offset-2 hover:text-[color:var(--dabos-on-canvas)] hover:underline"
          >
            Conditions pulse
          </Link>
          <span aria-hidden> · </span>
          <Link
            href="/dabos/board"
            className="underline-offset-2 hover:text-[color:var(--dabos-on-canvas)] hover:underline"
          >
            Full org board
          </Link>
        </p>
      </header>

      {loadError ? (
        <p className="text-sm text-destructive" role="alert">
          Could not load status: {loadError.slice(0, 200)}
        </p>
      ) : null}

      {!loadError && !latest ? (
        <p className="rounded-lg border border-border bg-card px-3 py-3 text-sm text-[color:var(--dabos-muted-on-surface)]">
          No status digest yet. The ln02 timer writes it about every two hours.
        </p>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-base font-semibold tracking-tight text-[color:var(--dabos-on-canvas)]">
            Needs you
          </h1>
          {needsTotal > NEEDS_YOU_CAP ? (
            <span className="text-xs tabular-nums text-[color:var(--dabos-on-canvas)]/70">
              showing {NEEDS_YOU_CAP} of {needsTotal}
            </span>
          ) : null}
        </div>
        <DigestNeedRows
          items={needs}
          pendingApprovals={pendingApprovals}
          empty="Nothing needs you right now."
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold tracking-tight text-[color:var(--dabos-on-canvas)]">
          On fire
        </h2>
        {onFireCount === 0 ? (
          <p className="rounded-lg border border-border bg-card px-3 py-3 text-sm text-[color:var(--dabos-muted-on-surface)]">
            Nothing on fire.
          </p>
        ) : (
          <details className="rounded-lg border border-destructive/35 bg-card open:shadow-sm">
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-destructive">
              {onFireCount} alert{onFireCount === 1 ? '' : 's'} — expand
            </summary>
            <ul className="space-y-1 border-t border-border/80 px-3 py-2.5 text-sm text-[color:var(--dabos-on-surface)]">
              {failCount ? (
                <li>
                  <Link href="/dabos/digest" className="font-medium text-destructive underline-offset-2 hover:underline">
                    {failCount} failed review{failCount === 1 ? '' : 's'}
                  </Link>
                </li>
              ) : null}
              {machineAlerts.map((a, i) => (
                <li key={`fire-${i}-${a.slice(0, 40)}`}>{a}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <div className="flex flex-wrap gap-2 pt-1">
        <Link
          href="/dabos/open"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Open all needs
        </Link>
        <Link
          href="/dabos/digest"
          className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
        >
          Pull full Status
        </Link>
      </div>
    </main>
  );
}

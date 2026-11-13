import { DigestNeedRows } from '@/components/dabos/digest-need-rows';
import { getDabosSql, hasDabosDb } from '@/lib/dabos/db';
import {
  partitionMachineAlerts,
  readLatestStatusDigest,
  readPendingApprovals,
  type DivisionSummary,
} from '@/lib/dabos/status-digest';

export const metadata = {
  title: 'Status — DABOS',
  description: 'What needs you, what is waiting on review, and division health',
};

export const dynamic = 'force-dynamic';

function berlinWhen(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function StatsCell({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  if (value) return <span className="text-foreground">posted</span>;
  return <span className="font-medium text-destructive">missing</span>;
}

function DivisionsTable({ rows, week }: { rows: DivisionSummary[]; week: string | null }) {
  const visible = rows.filter(
    (d) =>
      d.division !== 'Unassigned' ||
      d.openPrs ||
      d.mergedLast24h ||
      d.openTasks ||
      d.reassessTasks ||
      d.pendingApprovals
  );
  if (!visible.length) {
    return <p className="text-sm text-muted-foreground">No division rows in this digest.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Div</th>
            <th className="px-3 py-2 font-medium tabular-nums">Open PRs</th>
            <th className="px-3 py-2 font-medium tabular-nums">Need review</th>
            <th className="px-3 py-2 font-medium tabular-nums">Ready for you</th>
            <th className="px-3 py-2 font-medium tabular-nums">Merged 24h</th>
            <th className="px-3 py-2 font-medium tabular-nums">Open tasks</th>
            <th className="px-3 py-2 font-medium">{week ? `Stats ${week}` : 'Stats'}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((d) => (
            <tr key={d.division} className="border-t border-border/80">
              <td className="px-3 py-2 font-medium">{d.division}</td>
              <td className="px-3 py-2 tabular-nums">{d.openPrs}</td>
              <td className="px-3 py-2 tabular-nums">{d.needsDept13}</td>
              <td className="px-3 py-2 tabular-nums">{d.readyForLogan}</td>
              <td className="px-3 py-2 tabular-nums">{d.mergedLast24h}</td>
              <td className="px-3 py-2 tabular-nums">{d.openTasks}</td>
              <td className="px-3 py-2">
                <StatsCell value={d.statsPostedLastWeek} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CountChip({
  label,
  count,
  tone = 'default',
}: {
  label: string;
  count: number;
  tone?: 'default' | 'warn' | 'danger';
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-destructive/40 bg-destructive/10 text-destructive'
      : tone === 'warn'
        ? 'border-border bg-muted/60 text-foreground'
        : 'border-border bg-card text-foreground';
  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <div className="text-xs text-[color:var(--dabos-muted-on-surface)]">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight">{count}</div>
    </div>
  );
}

export default async function DabosDigestPage() {
  if (!hasDabosDb()) {
    return (
      <main className="max-w-3xl font-[family-name:var(--font-dabos-body)] text-sm">
        <h1 className="font-[family-name:var(--font-dabos-display)] text-2xl font-semibold tracking-tight">
          Status
        </h1>
        <p className="mt-2 text-muted-foreground">Database is not configured on this host.</p>
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

  if (loadError) {
    return (
      <main className="max-w-3xl font-[family-name:var(--font-dabos-body)] text-sm">
        <h1 className="font-[family-name:var(--font-dabos-display)] text-2xl font-semibold tracking-tight">
          Status
        </h1>
        <p className="mt-2 text-destructive" role="alert">
          Could not load status: {loadError.slice(0, 200)}
        </p>
      </main>
    );
  }

  if (!latest) {
    return (
      <main className="max-w-3xl font-[family-name:var(--font-dabos-body)] text-sm">
        <h1 className="font-[family-name:var(--font-dabos-display)] text-2xl font-semibold tracking-tight">
          Status
        </h1>
        <p className="mt-2 text-muted-foreground">
          No status digest yet. The ln02 timer writes it about every two hours.
        </p>
      </main>
    );
  }

  const ageMin = Math.max(0, Math.floor((Date.now() - new Date(latest.ranAt).getTime()) / 60_000));
  const stale = ageMin > 150;
  const ageLabel =
    ageMin < 60 ? `${ageMin}m ago` : `${Math.floor(ageMin / 60)}h ${ageMin % 60}m ago`;
  const { actionable: machineAlerts, noise: noiseAlerts } = partitionMachineAlerts(
    latest.machineAlerts
  );

  return (
    <main className="mx-auto max-w-4xl space-y-8 font-[family-name:var(--font-dabos-body)] text-sm">
      <header className="space-y-3">
        <div>
          <h1 className="font-[family-name:var(--font-dabos-display)] text-2xl font-semibold tracking-tight text-[color:var(--dabos-on-canvas)] sm:text-3xl">
            Status
          </h1>
          <p className="mt-1 text-[color:var(--dabos-on-canvas)]/80">
            What needs you, what is waiting on review, and how the divisions look.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md border border-border bg-card px-2 py-1 tabular-nums text-[color:var(--dabos-muted-on-surface)]">
            {berlinWhen(latest.ranAt)} Berlin
          </span>
          <span className="rounded-md border border-border bg-card px-2 py-1 text-[color:var(--dabos-muted-on-surface)]">
            {ageLabel}
          </span>
          {latest.host ? (
            <span className="rounded-md border border-border bg-card px-2 py-1 text-[color:var(--dabos-muted-on-surface)]">
              {latest.host}
            </span>
          ) : null}
          {latest.week ? (
            <span className="rounded-md border border-border bg-card px-2 py-1 text-[color:var(--dabos-muted-on-surface)]">
              week {latest.week}
            </span>
          ) : null}
          {stale ? (
            <span className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-destructive">
              Stale — chase {latest.ownerPost ?? 'Dept12'}
            </span>
          ) : (
            <span className="rounded-md border border-border bg-card px-2 py-1 text-[color:var(--dabos-on-surface)]">
              Fresh
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <CountChip label="Needs you" count={latest.needsLogan.length} tone="warn" />
          <CountChip label="Need review" count={latest.needsDept13.length} />
          <CountChip
            label="Failed review"
            count={latest.failAtHead.length}
            tone={latest.failAtHead.length ? 'danger' : 'default'}
          />
          <CountChip
            label="Alerts"
            count={machineAlerts.length}
            tone={machineAlerts.length ? 'danger' : 'default'}
          />
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="text-base font-semibold tracking-tight text-[color:var(--dabos-on-canvas)]">
          Needs you
        </h2>
        <DigestNeedRows
          items={latest.needsLogan}
          pendingApprovals={pendingApprovals}
          empty="Nothing needs you right now."
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold tracking-tight text-[color:var(--dabos-on-canvas)]">
          Waiting on review
        </h2>
        <DigestNeedRows items={latest.needsDept13} empty="Nothing is waiting on review." />
      </section>

      {latest.failAtHead.length ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold tracking-tight text-[color:var(--dabos-on-canvas)]">
            Failed review
          </h2>
          <DigestNeedRows items={latest.failAtHead} empty="None." />
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-base font-semibold tracking-tight text-[color:var(--dabos-on-canvas)]">
          Machine alerts
        </h2>
        {machineAlerts.length ? (
          <ul className="list-disc space-y-1 rounded-lg border border-border bg-card px-3 py-2.5 pl-8 text-sm text-[color:var(--dabos-on-surface)]">
            {machineAlerts.map((a, i) => (
              <li key={`${i}-${a.slice(0, 40)}`}>{a}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[color:var(--dabos-on-canvas)]/75">No machine alerts.</p>
        )}
        {noiseAlerts.length ? (
          <details className="rounded-lg border border-border/60 bg-card/80 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-[color:var(--dabos-muted-on-surface)]">
              Noise alerts ({noiseAlerts.length}) — desktop portals / session helpers
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[color:var(--dabos-muted-on-surface)]">
              {noiseAlerts.map((a, i) => (
                <li key={`noise-${i}-${a.slice(0, 40)}`}>{a}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold tracking-tight">Divisions</h2>
        <DivisionsTable rows={latest.divisions} week={latest.week} />
      </section>

      {latest.sourceErrors.length ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold tracking-tight text-destructive">Source errors</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
            {latest.sourceErrors.map((e) => (
              <li key={e.source}>
                {e.source}: {e.error}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="rounded-lg border border-border bg-muted/20 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
          Full text dump (for agents / archive)
        </summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
          {latest.markdown || '(empty)'}
        </pre>
      </details>
    </main>
  );
}

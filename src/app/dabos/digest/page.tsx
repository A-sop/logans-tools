import { getDabosSql, hasDabosDb } from '@/lib/dabos/db';
import {
  parseDigestNeedLine,
  readLatestStatusDigest,
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

function NeedRows({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-border/80 rounded-lg border border-border bg-card">
      {items.map((item, i) => {
        const parts = parseDigestNeedLine(item);
        return (
          <li key={`${i}-${item.slice(0, 48)}`} className="px-3 py-2.5 sm:px-4">
            <div className="text-sm font-medium leading-snug text-foreground">{parts.title}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {parts.ref ? <span className="font-mono tabular-nums">{parts.ref}</span> : null}
              {parts.note ? <span>{parts.note}</span> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
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
      <div className="text-xs text-muted-foreground">{label}</div>
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
  let loadError: string | null = null;
  try {
    latest = await readLatestStatusDigest(getDabosSql());
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

  return (
    <main className="mx-auto max-w-4xl space-y-8 font-[family-name:var(--font-dabos-body)] text-sm">
      <header className="space-y-3">
        <div>
          <h1 className="font-[family-name:var(--font-dabos-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
            Status
          </h1>
          <p className="mt-1 text-muted-foreground">
            What needs you, what is waiting on review, and how the divisions look.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-md border border-border bg-muted/40 px-2 py-1 tabular-nums">
            {berlinWhen(latest.ranAt)} Berlin
          </span>
          <span className="rounded-md border border-border bg-muted/40 px-2 py-1">{ageLabel}</span>
          {latest.host ? (
            <span className="rounded-md border border-border bg-muted/40 px-2 py-1">
              {latest.host}
            </span>
          ) : null}
          {latest.week ? (
            <span className="rounded-md border border-border bg-muted/40 px-2 py-1">
              week {latest.week}
            </span>
          ) : null}
          {stale ? (
            <span className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-destructive">
              Stale — chase {latest.ownerPost ?? 'Dept12'}
            </span>
          ) : (
            <span className="rounded-md border border-border bg-muted/40 px-2 py-1 text-foreground">
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
            count={latest.machineAlerts.length}
            tone={latest.machineAlerts.length ? 'danger' : 'default'}
          />
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="text-base font-semibold tracking-tight">Needs you</h2>
        <NeedRows items={latest.needsLogan} empty="Nothing needs you right now." />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold tracking-tight">Waiting on Dept13 review</h2>
        <NeedRows
          items={latest.needsDept13}
          empty="Nothing is waiting on a Dept13 verdict."
        />
      </section>

      {latest.failAtHead.length ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold tracking-tight">Failed review at current head</h2>
          <NeedRows items={latest.failAtHead} empty="None." />
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-base font-semibold tracking-tight">Machine alerts</h2>
        {latest.machineAlerts.length ? (
          <ul className="list-disc space-y-1 rounded-lg border border-border bg-card px-3 py-2.5 pl-8 text-sm">
            {latest.machineAlerts.map((a, i) => (
              <li key={`${i}-${a.slice(0, 40)}`}>{a}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No machine alerts.</p>
        )}
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

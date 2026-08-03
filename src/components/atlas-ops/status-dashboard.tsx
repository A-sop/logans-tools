import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type {
  AtlasDashboardData,
  LinearIssue,
  StatusTone,
} from '@/lib/atlas-ops/status-dashboard';

function toneClasses(tone: StatusTone): string {
  switch (tone) {
    case 'ok':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
    case 'warn':
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-400';
    case 'error':
      return 'bg-destructive/15 text-destructive';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tabular-nums',
        toneClasses(tone)
      )}
    >
      {label}
    </span>
  );
}

function DashboardCard({
  title,
  badge,
  children,
  footer,
}: {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold leading-tight text-card-foreground">{title}</h2>
        {badge}
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
      {footer ? <div className="mt-4 border-t border-border pt-3 text-xs">{footer}</div> : null}
    </section>
  );
}

function IssueList({ issues }: { issues: LinearIssue[] }) {
  if (issues.length === 0) {
    return <p>No open issues in Todo / In Progress.</p>;
  }
  return (
    <ul className="space-y-2">
      {issues.map((issue) => (
        <li key={issue.identifier}>
          <a
            href={issue.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground hover:text-primary"
          >
            {issue.identifier}
          </a>
          <span className="text-muted-foreground"> — {issue.title}</span>
          <span className="ml-1 text-xs text-muted-foreground">({issue.state})</span>
        </li>
      ))}
    </ul>
  );
}

export function StatusDashboard({ data }: { data: AtlasDashboardData }) {
  const hermesLabel =
    data.hermes.healthy === true ? 'Healthy' : data.hermes.healthy === false ? 'Down' : 'Unknown';

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium tracking-wide text-muted-foreground">Operations</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Atlas status</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Local system snapshot — backup, document pipelines, and Linear at a glance.{' '}
          <a href="/triage" className="font-medium text-primary hover:underline">
            Daily triage hub →
          </a>
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardCard
          title="Backup"
          badge={
            <StatusBadge
              label={data.backup.exitStatus ?? 'unknown'}
              tone={data.backup.tone}
            />
          }
        >
          <p>
            <span className="font-medium text-foreground">Last run: </span>
            {data.backup.lastRun ?? 'Not recorded'}
          </p>
          <p>{data.backup.detail}</p>
        </DashboardCard>

        <DashboardCard title="Document intake">
          <p className="text-3xl font-bold tabular-nums text-foreground">
            {data.documentIntake.available ? data.documentIntake.count : 'N/A'}
          </p>
          <p>Files in <code className="text-xs">C:\DATA\00_INBOX</code></p>
          <p className="text-xs">Run: <code>npm run intake:run</code></p>
        </DashboardCard>

        <DashboardCard title="Scan inbox">
          <p className="text-3xl font-bold tabular-nums text-foreground">
            {data.scanInbox.available ? data.scanInbox.count : 'N/A'}
          </p>
          <p>Files in <code className="text-xs">C:\LDW_Scan</code></p>
          <p className="text-xs">Run: <code>npm run scan-inbox</code></p>
          {data.scanWatcher.lastRun ? (
            <p className="text-xs">Last watcher run: {data.scanWatcher.lastRun}</p>
          ) : null}
        </DashboardCard>

        <DashboardCard
          title="Hermes"
          badge={
            <StatusBadge
              label={hermesLabel}
              tone={data.hermes.tone}
            />
          }
        >
          <p>{data.hermes.detail}</p>
          <p className="text-xs">Checked {new Date(data.hermes.checkedAt).toLocaleString()}</p>
        </DashboardCard>

        <DashboardCard
          title="Linear"
          badge={
            data.linear.configured && data.linear.openCount !== null ? (
              <StatusBadge label={`${data.linear.openCount} open`} tone="muted" />
            ) : undefined
          }
          footer={
            !data.linear.configured ? (
              <p className="text-muted-foreground">
                Connect Linear — add <code>LINEAR_API_KEY</code> to <code>.env.local</code>.
              </p>
            ) : undefined
          }
        >
          {data.linear.configured ? (
            <>
              <p>{data.linear.detail}</p>
              <IssueList issues={data.linear.issues} />
            </>
          ) : (
            <p>Placeholder until Linear API key is configured.</p>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}

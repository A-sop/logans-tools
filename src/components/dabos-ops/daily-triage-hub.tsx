import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { DailyTriageData, PipeStatus } from '@/lib/dabos-ops/daily-triage-status';

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-primary' : 'bg-primary/80')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PipeCard({ pipe, href }: { pipe: PipeStatus; href?: string }) {
  const body = (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-base font-semibold leading-tight">{pipe.label}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{pipe.detail}</p>
      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Ready for you</span>
            <span className="tabular-nums">
              {pipe.reviewCount} / {pipe.reviewTargetMin}â€“{pipe.reviewTargetMax}
            </span>
          </div>
          <ProgressBar value={pipe.reviewCount} max={pipe.reviewTargetMin} />
        </div>
        <p className="text-sm">
          <span className="font-medium text-foreground">{pipe.rawCount}</span>
          <span className="text-muted-foreground"> raw waiting in pipe</span>
        </p>
        <p className="text-xs text-muted-foreground">{pipe.action}</p>
      </div>
    </section>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {body}
      </Link>
    );
  }
  return body;
}

export function DailyTriageHub({ data }: { data: DailyTriageData }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium tracking-wide text-muted-foreground">Daily habit</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Triage hub</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Morning coffee or afternoon lull â€” confirm prepared items, don&apos;t guilt-schedule weekly
          inbox days. Automation refills the queue; you approve and file.
        </p>
        {!data.ranToday ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            Pipeline has not run today. Task Scheduler should sync overnight captures â€” or run{' '}
            <code className="text-xs">Run-DailyTriage.ps1</code> now.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Last pipeline: {data.lastPipelineRun ? new Date(data.lastPipelineRun).toLocaleString() : 'â€”'}
          </p>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 sm:col-span-2">
          <p className="text-lg font-semibold text-foreground">{data.dailyNudge}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{data.totals.readyForHuman}</span> prepared
            Â· <span className="font-medium text-foreground">{data.totals.rawBacklog}</span> raw backlog
          </p>
        </div>

        <PipeCard pipe={data.dataInbox} href="/dil/review" />
        <PipeCard pipe={data.wikiCapture} />
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">What to do (10â€“20 min)</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            <Link href="/dil/review" className="font-medium text-primary hover:underline">
              DIL review
            </Link>{' '}
            â€” approve renames/folders for DATA inbox ({data.dilReview.todo} todo)
          </li>
          <li>
            Open <code>DABOS/docs/wiki/needs_review/</code> â€” confirm{' '}
            <code>triage.md</code> per Telegram capture ({data.wikiCapture.reviewCount} items)
          </li>
          <li>Say in Cursor: &quot;triage daily queue&quot; â€” agent knows the workflow</li>
        </ol>
      </section>

      <section className="text-xs text-muted-foreground">
        <p>
          Agents: <code>Atlas/docs/admin/daily-triage.md</code> Â· rule{' '}
          <code>.cursor/rules/daily-triage.mdc</code>
        </p>
      </section>
    </div>
  );
}

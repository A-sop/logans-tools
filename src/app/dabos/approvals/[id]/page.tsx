import Link from 'next/link';
import { notFound } from 'next/navigation';

import { decideApprovalAction } from '@/app/dabos/approvals/actions';
import { readApprovalById } from '@/lib/dabos/approval-detail';
import { resolveApprovalContext } from '@/lib/dabos/approval-human-context';
import { getDabosSql, hasDabosDb } from '@/lib/dabos/db';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

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

export default async function ApprovalDetailPage({ params }: PageProps) {
  const { id } = await params;

  if (!hasDabosDb()) {
    return (
      <main className="max-w-2xl font-[family-name:var(--font-dabos-body)] text-sm">
        <h1 className="font-[family-name:var(--font-dabos-display)] text-2xl font-semibold tracking-tight">
          Approval
        </h1>
        <p className="mt-2 text-muted-foreground">Database is not configured on this host.</p>
      </main>
    );
  }

  const row = await readApprovalById(getDabosSql(), id);
  if (!row) notFound();

  const context = resolveApprovalContext({
    humanContext: row.humanContext,
    body: row.body,
    payload: row.payload,
  });
  const pending = row.status === 'pending';
  const payloadPretty = JSON.stringify(row.payload, null, 2);
  const showingHuman = Boolean(row.humanContext?.trim());

  return (
    <main className="mx-auto max-w-2xl space-y-6 font-[family-name:var(--font-dabos-body)] text-sm">
      <header className="space-y-2">
        <p className="text-xs text-[color:var(--dabos-muted-on-surface)]">
          <Link href="/dabos/digest" className="underline-offset-2 hover:underline">
            Status
          </Link>
          <span aria-hidden> · </span>
          <Link href="/dabos/approvals" className="underline-offset-2 hover:underline">
            Approvals
          </Link>
        </p>
        <h1 className="font-[family-name:var(--font-dabos-display)] text-2xl font-semibold tracking-tight text-[color:var(--dabos-on-canvas)]">
          {row.title}
        </h1>
        <div className="flex flex-wrap gap-2 text-xs text-[color:var(--dabos-muted-on-surface)]">
          <span className="rounded-md border border-border bg-card px-2 py-1">{row.status}</span>
          <span className="rounded-md border border-border bg-card px-2 py-1">{row.kind}</span>
          <span className="rounded-md border border-border bg-card px-2 py-1 tabular-nums">
            {berlinWhen(row.createdAt)} Berlin
          </span>
          {row.departmentId ? (
            <span className="rounded-md border border-border bg-card px-2 py-1">{row.departmentId}</span>
          ) : null}
        </div>
      </header>

      {context ? (
        <section className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">Context</h2>
          <p
            className={`whitespace-pre-wrap rounded-lg border border-border bg-card px-3 py-2.5 text-[color:var(--dabos-on-surface)] ${
              showingHuman ? 'text-sm' : 'font-mono text-xs'
            }`}
          >
            {context}
          </p>
        </section>
      ) : null}

      {row.body && showingHuman ? (
        <section className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">Prompt</h2>
          <p className="whitespace-pre-wrap rounded-lg border border-border bg-card px-3 py-2.5 text-[color:var(--dabos-on-surface)]">
            {row.body}
          </p>
        </section>
      ) : null}

      {!row.body && !context ? (
        <p className="text-sm text-muted-foreground">No context on this row — see payload below.</p>
      ) : null}

      {row.taskId ? (
        <p className="text-xs text-muted-foreground">
          Task id: <span className="font-mono">{row.taskId}</span>
        </p>
      ) : null}

      {pending ? (
        <section className="flex flex-wrap gap-2">
          <form action={decideApprovalAction}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="action" value="approve" />
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Yes
            </button>
          </form>
          <form action={decideApprovalAction}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="action" value="reject" />
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
            >
              No
            </button>
          </form>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Already {row.status}
          {row.decidedBy ? ` by ${row.decidedBy}` : ''}
          {row.decidedAt ? ` · ${berlinWhen(row.decidedAt)}` : ''}.
        </p>
      )}

      <details className="rounded-lg border border-border bg-muted/20 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
          Payload (no secrets)
        </summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
          {payloadPretty}
        </pre>
      </details>
    </main>
  );
}

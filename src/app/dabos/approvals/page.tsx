import Link from 'next/link';

import { listPendingApprovalsDetailed } from '@/lib/dabos/approval-detail';
import { resolveApprovalContext } from '@/lib/dabos/approval-human-context';
import { getDabosSql, hasDabosDb } from '@/lib/dabos/db';

export const metadata = {
  title: 'Approvals — DABOS',
  description: 'Pending founder yes/no from approval_queue',
};

export const dynamic = 'force-dynamic';

type PageProps = { searchParams: Promise<{ decided?: string }> };

function berlinWhen(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export default async function ApprovalsListPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  if (!hasDabosDb()) {
    return (
      <main className="max-w-2xl font-[family-name:var(--font-dabos-body)] text-sm">
        <h1 className="font-[family-name:var(--font-dabos-display)] text-2xl font-semibold tracking-tight">
          Approvals
        </h1>
        <p className="mt-2 text-muted-foreground">Database is not configured on this host.</p>
      </main>
    );
  }

  const rows = await listPendingApprovalsDetailed(getDabosSql());

  return (
    <main className="mx-auto max-w-2xl space-y-6 font-[family-name:var(--font-dabos-body)] text-sm">
      <header className="space-y-2">
        <p className="text-xs text-[color:var(--dabos-muted-on-surface)]">
          <Link href="/dabos/digest" className="underline-offset-2 hover:underline">
            Status
          </Link>
          <span aria-hidden> · </span>
          <Link href="/dabos" className="underline-offset-2 hover:underline">
            Home
          </Link>
        </p>
        <h1 className="font-[family-name:var(--font-dabos-display)] text-2xl font-semibold tracking-tight text-[color:var(--dabos-on-canvas)]">
          Approvals
        </h1>
        <p className="text-[color:var(--dabos-on-canvas)]/80">
          Pending yes/no from Neon <code className="text-xs">approval_queue</code>.
        </p>
        {sp.decided === '1' ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm" role="status">
            Decision saved.
          </p>
        ) : null}
      </header>

      {!rows.length ? (
        <p className="text-sm text-muted-foreground">Nothing pending.</p>
      ) : (
        <ul className="divide-y divide-border/80 rounded-lg border border-border bg-card">
          {rows.map((row) => {
            const context = resolveApprovalContext({
              humanContext: row.humanContext,
              body: row.body,
              payload: row.payload,
            });
            const preview =
              context && context.length > 140 ? `${context.slice(0, 137).trimEnd()}…` : context;
            return (
              <li key={row.id} className="px-3 py-2.5 sm:px-4">
                <Link
                  href={`/dabos/approvals/${row.id}`}
                  className="text-sm font-medium leading-snug text-foreground underline-offset-2 hover:underline"
                >
                  {row.title}
                </Link>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[color:var(--dabos-muted-on-surface)]">
                  <span>{row.kind}</span>
                  <span className="tabular-nums">{berlinWhen(row.createdAt)}</span>
                </div>
                {preview ? (
                  <p className="mt-1 line-clamp-2 text-xs text-[color:var(--dabos-muted-on-surface)]">
                    {preview}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

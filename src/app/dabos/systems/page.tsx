import Link from 'next/link';

import { dabosConfigured, fetchDabosShell } from '@/lib/dabos/server-data';

export const metadata = {
  title: 'Systems — DABOS',
  description: 'Prompts, sipgate, Comm routing, cadence, and deep tools',
};

export const dynamic = 'force-dynamic';

const LINKS = [
  {
    href: '/dabos/prompts',
    title: 'Prompts',
    blurb: 'Cursor prompt register mirror (metadata only).',
  },
  {
    href: '/dabos/sipgate',
    title: 'sipgate',
    blurb: 'Assist mailbox — consume or chase events.',
  },
  {
    href: '/dabos/comm',
    title: 'Comm',
    blurb: 'Dept2 routing table — horizontal / command / conference.',
  },
  {
    href: '/dabos/conditions',
    title: 'Conditions',
    blurb: 'Working condition + climb (parked from primary chrome).',
  },
  {
    href: '/dabos/digest',
    title: 'Status dump',
    blurb: 'Full pull digest including agent text dump.',
  },
] as const;

function formatLastRun(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function DabosSystemsPage() {
  const shell = dabosConfigured() ? await fetchDabosShell() : null;

  return (
    <main className="mx-auto max-w-2xl space-y-6 font-[family-name:var(--font-dabos-body)]">
      <header className="space-y-1">
        <h1 className="font-[family-name:var(--font-dabos-display)] text-2xl font-semibold tracking-tight text-[color:var(--dabos-on-canvas)]">
          Systems
        </h1>
        <p className="text-sm text-[color:var(--dabos-on-canvas)]/80">
          Deep tools and setup — not the noon pull.
        </p>
      </header>

      <section className="space-y-2" aria-label="Cadence">
        <h2 className="text-sm font-semibold text-[color:var(--dabos-on-canvas)]">Cadence last run</h2>
        {shell && shell.role_runs.length > 0 ? (
          <ul className="divide-y divide-border/80 rounded-lg border border-border bg-card text-sm">
            {shell.role_runs.map((run) => (
              <li
                key={run.role_id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4"
              >
                <span className="font-medium text-foreground">
                  {run.role_id.replace(/_/g, ' ')}
                </span>
                <span className="tabular-nums text-[color:var(--dabos-muted-on-surface)]">
                  {formatLastRun(run.ran_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-border bg-card px-3 py-3 text-sm text-[color:var(--dabos-muted-on-surface)]">
            {shell
              ? 'No cadence runs recorded yet.'
              : 'Database not configured — cadence unavailable.'}
          </p>
        )}
      </section>

      <section className="space-y-2" aria-label="Deep tools">
        <h2 className="text-sm font-semibold text-[color:var(--dabos-on-canvas)]">Tools</h2>
        <ul className="divide-y divide-border/80 rounded-lg border border-border bg-card">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
              >
                <div className="text-sm font-medium text-foreground">{link.title}</div>
                <div className="mt-0.5 text-xs text-[color:var(--dabos-muted-on-surface)]">
                  {link.blurb}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

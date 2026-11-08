import { getDabosSql, hasDabosDb } from '@/lib/dabos/db';
import { readLatestStatusDigest } from '@/lib/dabos/status-digest';

export const metadata = {
  title: 'Status digest — DABOS',
  description: 'Pull the latest Div1–7 status digest from Neon (ln02 cadence)',
};

export const dynamic = 'force-dynamic';

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((item, i) => (
        <li key={`${i}-${item.slice(0, 40)}`} className="text-foreground">
          {item}
        </li>
      ))}
    </ul>
  );
}

export default async function DabosDigestPage() {
  if (!hasDabosDb()) {
    return (
      <main className="max-w-3xl font-sans text-sm">
        <h1 className="text-xl font-semibold tracking-tight">Status digest</h1>
        <p className="mt-2 text-muted-foreground">DATABASE_URL not configured on this host.</p>
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
      <main className="max-w-3xl font-sans text-sm">
        <h1 className="text-xl font-semibold tracking-tight">Status digest</h1>
        <p className="mt-2 text-destructive" role="alert">
          Could not read Neon: {loadError.slice(0, 200)}
        </p>
      </main>
    );
  }

  if (!latest) {
    return (
      <main className="max-w-3xl font-sans text-sm">
        <h1 className="text-xl font-semibold tracking-tight">Status digest</h1>
        <p className="mt-2 text-muted-foreground">
          No <code className="rounded bg-muted/50 px-1 font-mono text-xs">status_digest</code> row
          yet. ln02 timer writes it; full file also lives at{' '}
          <code className="rounded bg-muted/50 px-1 font-mono text-xs">
            ~/.local/state/dabos-status-digest/latest.md
          </code>
          .
        </p>
      </main>
    );
  }

  const ran = new Date(latest.ranAt);
  const ageMin = Math.max(0, Math.floor((Date.now() - ran.getTime()) / 60_000));
  const stale = ageMin > 150;

  return (
    <main className="max-w-4xl space-y-6 font-sans text-sm">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Status digest</h1>
        <p className="mt-1 text-muted-foreground">
          Pull-only full digest from Neon. Telegram tip (if enabled on ln02) is ≤5 lines and points
          here — not a Grok essay.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Last run {ran.toISOString()}
          {latest.host ? ` · host ${latest.host}` : ''} · {ageMin}m ago
          {stale ? (
            <span className="ml-2 text-destructive">stale (&gt;2h30) — chase Dept12</span>
          ) : null}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Needs you ({latest.needsLogan.length})</h2>
        <BulletList items={latest.needsLogan} empty="Nothing needs you." />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Needs Dept13 ({latest.needsDept13.length})</h2>
        <BulletList items={latest.needsDept13} empty="Nothing waiting on Dept13." />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Machine alerts ({latest.machineAlerts.length})</h2>
        <BulletList items={latest.machineAlerts} empty="No machine alerts." />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Full markdown</h2>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed text-foreground">
          {latest.markdown || '(empty markdown in summary_json)'}
        </pre>
      </section>
    </main>
  );
}

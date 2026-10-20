import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { isHwwClerkUserAllowed } from '@/lib/hww/auth';
import { getHwwDataDir } from '@/lib/hww/paths';
import { resolveHwwRecords, resolveHwwSummary, type HwwRecord } from '@/lib/hww/load';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

type Search = {
  stat?: string;
  week?: string;
  area?: string;
  kind?: string;
  date?: string;
  level?: string;
};

function BarRow({ label, value, max, href }: { label: string; value: number; max: number; href: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <Link href={href} className="block space-y-1 rounded-md px-1 py-1 hover:bg-muted/50">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-muted">
        <div className="h-full bg-foreground/70" style={{ width: `${pct}%` }} />
      </div>
    </Link>
  );
}

function filterRecords(rows: HwwRecord[], q: Search): HwwRecord[] {
  return rows.filter((r) => {
    if (q.stat && r.stat !== q.stat) return false;
    if (q.week && r.stat_week !== q.week) return false;
    if (q.area && r.area !== q.area) return false;
    if (q.kind && r.kind !== q.kind) return false;
    if (q.date && r.date !== q.date) return false;
    return true;
  });
}

export default async function HwwPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in?redirect_url=%2Fhww');
  }
  // Logan-only by Clerk user id (404 for signed-in non-Logan, including other allowlisted DABOS emails).
  if (!isHwwClerkUserAllowed(userId)) {
    notFound();
  }

  const q = await searchParams;
  const summary = await resolveHwwSummary();
  if (!summary) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">HWW</h1>
        <p className="text-sm text-muted-foreground">
          No summary yet. Run <code className="text-foreground">npm run hww:build && npm run hww:sync</code>.
        </p>
      </div>
    );
  }

  const records = await resolveHwwRecords(summary);
  const drilled = filterRecords(records, q);
  const wisdomWeeks = (summary.wisdom as { weeks?: { week_ending: string; student_points: number; words_cleared: number; units: number; in_progress?: boolean }[] })
    ?.weeks ?? [];
  const maxPts = Math.max(1, ...wisdomWeeks.map((w) => w.student_points));
  const health = summary.health as Record<string, unknown>;
  const wealth = summary.wealth as Record<string, unknown>;
  const sourceLabel = getHwwDataDir() ? 'local DATA' : 'Neon';
  const exportQs = new URLSearchParams();
  if (q.stat) exportQs.set('stat', q.stat);
  if (q.week) exportQs.set('week', q.week);
  if (q.area) exportQs.set('area', q.area);
  if (q.kind) exportQs.set('kind', q.kind);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">HWW</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Health · Wealth · Wisdom — {sourceLabel}. Built {String(summary.built_at)}.
          </p>
        </div>
        <Link
          href={`/hww/export?${exportQs.toString()}`}
          className="text-xs text-primary hover:underline"
        >
          Export CSV (current filter)
        </Link>
      </div>

      {(summary.flags?.length ?? 0) > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Flags</CardTitle>
            <CardDescription>Client-free notices from the last build</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc text-xs text-muted-foreground">
              {summary.flags.slice(0, 40).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Health</CardTitle>
            <CardDescription>
              {health.renpho_stale ? 'Renpho stale · ' : ''}
              series days {String(health.weight_series_days ?? '—')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href="/hww?stat=weight_kg" className="block hover:underline">
              Weight series →
            </Link>
            <Link href="/hww?stat=steps" className="block hover:underline">
              Steps →
            </Link>
            <Link href="/hww?stat=sleep_score" className="block hover:underline">
              Sleep score →
            </Link>
            <Link href="/hww?stat=skeletal_muscle_pct" className="block hover:underline">
              Skeletal muscle % →
            </Link>
            <p className="text-xs text-muted-foreground">
              Screenshot discrepancy flags: {Array.isArray(health.screenshot_discrepancy_flags) ? (health.screenshot_discrepancy_flags as string[]).length : 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Wealth</CardTitle>
            <CardDescription>Provisional — books correction in progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href="/hww?stat=asset_account" className="block hover:underline">
              Assets (accounts) →
            </Link>
            <Link href="/hww?stat=liability_account" className="block hover:underline">
              Liabilities (accounts) →
            </Link>
            <Link href="/hww?stat=debts_csv_total" className="block hover:underline">
              Debts.csv cross-check →
            </Link>
            <p className="text-xs text-muted-foreground">
              GnuCash ok: {String(wealth.gnucash_ok)} · education gauge omitted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Wisdom</CardTitle>
            <CardDescription>Student points per stat week (Thu 14:00 Berlin)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(summary.wisdom as { empty?: boolean })?.empty ? (
              <p className="text-xs text-muted-foreground">No entries yet</p>
            ) : (
              wisdomWeeks.map((w) => (
                <BarRow
                  key={w.week_ending}
                  label={`${w.week_ending}${w.in_progress ? ' · in progress' : ''}`}
                  value={w.student_points}
                  max={maxPts}
                  href={`/hww?stat=student_points&week=${w.week_ending}`}
                />
              ))
            )}
            <Link href="/hww?stat=words_cleared" className="block text-xs text-primary hover:underline">
              Words cleared →
            </Link>
          </CardContent>
        </Card>
      </div>

      {q.stat ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Drill-down · {q.stat}
              {q.week ? ` · week ${q.week}` : ''}
              {q.date ? ` · ${q.date}` : ''}
            </CardTitle>
            <CardDescription>
              {drilled.length} records ·{' '}
              <Link href="/hww" className="text-primary hover:underline">
                clear
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-1 pr-2">Date</th>
                    <th className="py-1 pr-2">Value</th>
                    <th className="py-1 pr-2">Kind/Area</th>
                    <th className="py-1 pr-2">Source</th>
                    <th className="py-1">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {drilled.slice(0, 200).map((r) => {
                    const ev = r.meta && typeof r.meta.path === 'string' ? r.meta.path : '';
                    return (
                      <tr key={`${r.stat}-${r.source_key}-${r.date}`} className="border-b border-border/40">
                        <td className="py-1 pr-2">
                          <Link href={`/hww?stat=${r.stat}&date=${r.date}`} className="hover:underline">
                            {r.date}
                          </Link>
                        </td>
                        <td className="py-1 pr-2 tabular-nums">
                          {r.value ?? '—'} {r.unit ?? ''}
                        </td>
                        <td className="py-1 pr-2">
                          {[r.kind, r.area].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="py-1 pr-2 font-mono text-[10px]">
                          {r.source_file}#{r.source_key}
                        </td>
                        <td className="py-1">
                          {ev ? (
                            <Link
                              href={`/hww/evidence/${ev.replace(/^evidence[\\/]/, '').replace(/\\/g, '/')}`}
                              className="text-primary hover:underline"
                            >
                              open
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

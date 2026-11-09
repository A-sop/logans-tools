import Link from 'next/link';

import { ConditionBadge } from '@/components/dabos/condition-badge';
import { StatTrendChart } from '@/components/dabos/stat-trend-chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AllTimeSeries, AllTimeStatsBundle } from '@/lib/dabos/all-time-stats';
import { climbHintForCondition } from '@/lib/dabos/condition-ladder';
import { dabosDeptHref } from '@/lib/dabos/dabos-paths';
import { BOARD_DIVISION_ORDER, deptNumberLabel, deptRoleLabel } from '@/lib/dabos/org-board-config';
import type { ConditionLabel } from '@/lib/dabos/types';

type ConditionsHistoryProps = {
  bundle: AllTimeStatsBundle;
};

function creditLine(series: AllTimeSeries): string | null {
  if (series.posters.length === 0) return null;
  return series.posters.join(', ');
}

function rangeLine(series: AllTimeSeries): string {
  if (!series.oldest) return '';
  if (series.oldest === series.newest) return series.oldest;
  return `${series.oldest} → ${series.newest}`;
}

function SeriesCard({ series }: { series: AllTimeSeries }) {
  return (
    <StatTrendChart
      points={series.points}
      metricKey={series.metricKey}
      label={`${series.entityId} ${series.metricKey}`}
      height={120}
      svgClassName="h-[120px] w-full"
      credit={creditLine(series)}
      rangeLabel={rangeLine(series)}
    />
  );
}

export function ConditionsHistory({ bundle }: ConditionsHistoryProps) {
  const { series, activeCount, supersededCount, working, divisions, departments } = bundle;
  const divMeta = new Map(divisions.map((d) => [d.id, d]));
  const deptsByDiv = new Map<string, typeof departments>();
  for (const d of departments) {
    const list = deptsByDiv.get(d.division_id) ?? [];
    list.push(d);
    deptsByDiv.set(d.division_id, list);
  }

  const seriesByEntity = new Map<string, AllTimeSeries[]>();
  for (const s of series) {
    const list = seriesByEntity.get(s.entityId) ?? [];
    list.push(s);
    seriesByEntity.set(s.entityId, list);
  }

  const entitiesWithSeries = new Set(series.map((s) => s.entityId));
  const deptsWithoutSeries = departments.filter((d) => !entitiesWithSeries.has(d.id));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 font-sans">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--dabos-on-canvas)] sm:text-3xl">
          Conditions
        </h1>
        <p className="max-w-3xl text-sm text-[color:var(--dabos-on-canvas)]/80">
          Working condition per division — what to climb this week. Stat-indicated is advisory only.
          Series archive is below the fold.
        </p>
        <p className="text-xs text-[color:var(--dabos-on-canvas)]/70">
          <Link
            href="/dabos"
            className="underline underline-offset-2 hover:text-[color:var(--dabos-on-canvas)]"
          >
            ← Home
          </Link>
          {' · '}
          <Link
            href="/dabos/board"
            className="underline underline-offset-2 hover:text-[color:var(--dabos-on-canvas)]"
          >
            Board
          </Link>
          {' · '}
          <Link
            href="/dabos/systems"
            className="underline underline-offset-2 hover:text-[color:var(--dabos-on-canvas)]"
          >
            Systems
          </Link>
        </p>
      </header>

      <section className="space-y-3" aria-label="Current working conditions">
        <h2 className="text-base font-semibold tracking-tight text-[color:var(--dabos-on-canvas)]">
          Current by division
        </h2>
        <ul className="divide-y divide-border/80 overflow-hidden rounded-lg border border-border bg-card">
          {BOARD_DIVISION_ORDER.map((divId) => {
            const div = divMeta.get(divId);
            if (!div) return null;
            const w = working.get(divId);
            const workingLabel = (w?.working as ConditionLabel | null) ?? null;
            const indicated = (w?.indicated as ConditionLabel | null) ?? null;
            const hint = climbHintForCondition(workingLabel);
            const depts = (deptsByDiv.get(divId) ?? []).sort((a, b) =>
              a.id.localeCompare(b.id, undefined, { numeric: true })
            );
            const lagCount = depts.filter((d) => {
              const dw = working.get(d.id);
              return dw?.working && dw.working !== 'Normal' && dw.working !== 'Affluence' && dw.working !== 'Power';
            }).length;

            return (
              <li key={divId} className="px-3 py-3 sm:px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {divId} — {div.operational_name}
                  </span>
                  <ConditionBadge
                    condition={workingLabel}
                    statIndicated={indicated}
                    climbLag={Boolean(indicated && workingLabel && indicated !== workingLabel)}
                  />
                </div>
                {hint ? (
                  <p className="mt-1.5 text-sm text-[color:var(--dabos-on-surface)]">
                    <span className="font-medium">Next climb: </span>
                    {hint}
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm text-[color:var(--dabos-muted-on-surface)]">
                    No working condition on file — treat as Non-Existence until Neon has a ruling.
                  </p>
                )}
                <p className="mt-1 text-xs text-[color:var(--dabos-muted-on-surface)]">
                  {depts.length} depts
                  {lagCount ? ` · ${lagCount} below Normal` : ''}
                  {' · '}
                  <Link
                    href={`/dabos/board`}
                    className="underline-offset-2 hover:underline"
                  >
                    Open board
                  </Link>
                  {depts[0] ? (
                    <>
                      {' · '}
                      <Link
                        href={dabosDeptHref(depts[0].id)}
                        className="underline-offset-2 hover:underline"
                      >
                        First dept
                      </Link>
                    </>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <details className="rounded-lg border border-border bg-card/90 open:shadow-sm">
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-[color:var(--dabos-muted-on-surface)] sm:px-4">
          All-time Neon series (archive) — {activeCount} active points · {series.length} series ·{' '}
          {supersededCount} superseded
        </summary>
        <div className="space-y-6 border-t border-border/80 px-3 py-4 sm:px-4">
          <p className="max-w-3xl text-sm text-[color:var(--dabos-muted-on-surface)]">
            Every active posted point (not the org-board sparkline). Poster credit stays on the
            series. Working condition above is Neon working; indicated is the engine ladder on the
            primary.
          </p>

          {BOARD_DIVISION_ORDER.map((divId) => {
            const div = divMeta.get(divId);
            if (!div) return null;
            const w = working.get(divId);
            const divSeries = seriesByEntity.get(divId) ?? [];
            const depts = (deptsByDiv.get(divId) ?? []).sort((a, b) =>
              a.id.localeCompare(b.id, undefined, { numeric: true })
            );

            return (
              <section key={divId} className="space-y-4 border-t border-border/60 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">
                    {divId} — {div.operational_name}
                  </h3>
                  <ConditionBadge
                    condition={(w?.working as ConditionLabel | null) ?? null}
                    statIndicated={(w?.indicated as ConditionLabel | null) ?? null}
                  />
                  {div.primary_metric_key ? (
                    <span className="text-xs text-muted-foreground">
                      primary {div.primary_metric_key}
                    </span>
                  ) : null}
                </div>

                {divSeries.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {divSeries.map((s) => (
                      <SeriesCard key={`${s.entityId}-${s.metricKey}`} series={s} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No active division-level series yet.</p>
                )}

                <div className="space-y-4">
                  {depts.map((dept) => {
                    const dw = working.get(dept.id);
                    const deptSeries = seriesByEntity.get(dept.id) ?? [];
                    return (
                      <Card key={dept.id} className="rounded-xl">
                        <CardHeader className="pb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-base">
                              <Link
                                href={dabosDeptHref(dept.id)}
                                className="hover:underline hover:underline-offset-2"
                              >
                                {deptNumberLabel(dept.id)} —{' '}
                                {deptRoleLabel({
                                  id: dept.id,
                                  legacy_name: dept.legacy_name,
                                  operational_name: dept.operational_name,
                                })}
                              </Link>
                            </CardTitle>
                            <ConditionBadge
                              condition={(dw?.working as ConditionLabel | null) ?? null}
                              statIndicated={(dw?.indicated as ConditionLabel | null) ?? null}
                            />
                          </div>
                          <CardDescription>
                            {deptSeries.length === 0
                              ? 'No department-owned series — inherits division primary for board indicated (until a dept primary is posted).'
                              : `${deptSeries.length} series · all active Neon points`}
                          </CardDescription>
                        </CardHeader>
                        {deptSeries.length > 0 ? (
                          <CardContent className="grid gap-3 sm:grid-cols-2">
                            {deptSeries.map((s) => (
                              <SeriesCard key={`${s.entityId}-${s.metricKey}`} series={s} />
                            ))}
                          </CardContent>
                        ) : null}
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {deptsWithoutSeries.length > 0 ? (
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Departments with no own Neon series yet</CardTitle>
                <CardDescription>
                  Still on the board via division primary / working ruling. Posting a dept primary
                  earns credit and deepens honesty.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {deptsWithoutSeries.map((d) => (
                  <Link
                    key={d.id}
                    href={dabosDeptHref(d.id)}
                    className="rounded-md bg-muted/50 px-2 py-1 hover:text-foreground"
                  >
                    {d.id}
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </details>
    </div>
  );
}

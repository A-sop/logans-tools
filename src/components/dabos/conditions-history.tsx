import Link from 'next/link';

import { ConditionBadge } from '@/components/dabos/condition-badge';
import { StatTrendChart } from '@/components/dabos/stat-trend-chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AllTimeSeries, AllTimeStatsBundle } from '@/lib/dabos/all-time-stats';
import { BOARD_DIVISION_ORDER, deptNumberLabel, deptRoleLabel } from '@/lib/dabos/org-board-config';
import { dabosDeptHref } from '@/lib/dabos/dabos-paths';
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
        <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--dabos-on-canvas)]/75">
          Dept19 Conditions · all-time Neon series
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--dabos-on-canvas)] sm:text-3xl">
          Conditions history
        </h1>
        <p className="max-w-3xl text-sm text-[color:var(--dabos-on-canvas)]/80">
          Every active posted point (not the org-board sparkline). Poster credit stays on the series.
          More history = more honest present-time reading. Working condition is still Neon working
          (often Non-Existence until Handle climb); indicated is the engine ladder on the primary.
        </p>
        <p className="text-xs text-[color:var(--dabos-on-canvas)]/70">
          <Link
            href="/dabos"
            className="underline underline-offset-2 hover:text-[color:var(--dabos-on-canvas)]"
          >
            ← Organizing board
          </Link>
          {' · '}
          {activeCount} active points · {series.length} series · {supersededCount} superseded
          (hidden — corrections, not erased credit on live rows)
        </p>
      </header>

      {BOARD_DIVISION_ORDER.map((divId) => {
        const div = divMeta.get(divId);
        if (!div) return null;
        const w = working.get(divId);
        const divSeries = seriesByEntity.get(divId) ?? [];
        const depts = (deptsByDiv.get(divId) ?? []).sort((a, b) =>
          a.id.localeCompare(b.id, undefined, { numeric: true })
        );

        return (
          <section key={divId} className="space-y-4 border-t border-white/20 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[color:var(--dabos-on-canvas)]">
                {divId} — {div.operational_name}
              </h2>
              <ConditionBadge
                condition={(w?.working as ConditionLabel | null) ?? null}
                statIndicated={(w?.indicated as ConditionLabel | null) ?? null}
              />
              {div.primary_metric_key ? (
                <span className="text-xs text-[color:var(--dabos-on-canvas)]/70">
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
              <p className="text-sm text-[color:var(--dabos-on-canvas)]/75">
                No active division-level series yet.
              </p>
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
              Still on the board via division primary / working ruling. Posting a dept primary earns
              credit and deepens honesty.
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
  );
}

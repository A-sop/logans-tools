/**
 * All-time active Neon stats series for the Conditions History surface.
 * Active rows only (superseded_at IS NULL) — corrections stay credited via recorded_by on the live series.
 */
import type { BoardChartPoint } from '@/lib/dabos/board-charts';
import { BOARD_DIVISION_ORDER } from '@/lib/dabos/org-board-config';
import type { DabosSql } from '@/lib/dabos/dabos-connection';

export type AllTimeStatPoint = BoardChartPoint & {
  recordedAt: string;
  recordedBy: string | null;
  workspaceId: string | null;
};

export type AllTimeSeries = {
  entityType: 'division' | 'department';
  entityId: string;
  divisionId: string | null;
  metricKey: string;
  points: AllTimeStatPoint[];
  posters: string[];
  oldest: string;
  newest: string;
};

export type AllTimeStatsBundle = {
  series: AllTimeSeries[];
  supersededCount: number;
  activeCount: number;
  working: Map<string, { working: string | null; indicated: string | null }>;
  divisions: Array<{
    id: string;
    operational_name: string;
    primary_metric_key: string | null;
    secondary_metric_key?: string | null;
  }>;
  departments: Array<{
    id: string;
    division_id: string;
    legacy_name: string;
    operational_name: string;
    primary_metric_key?: string | null;
  }>;
};

type RawStatRow = {
  division_id: string | null;
  department_id: string | null;
  metric_key: string;
  value: string | number;
  recorded_at: Date | string;
  recorded_by: string | null;
  workspace_id: string | null;
};

function isoDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toISOString().slice(0, 10);
}

function seriesKey(entityId: string, metricKey: string): string {
  return `${entityId}::${metricKey}`;
}

/** Pure: group active rows into entity+metric series (dept preferred when set). */
export function groupAllTimeSeries(rows: RawStatRow[]): AllTimeSeries[] {
  const buckets = new Map<
    string,
    {
      entityType: 'division' | 'department';
      entityId: string;
      divisionId: string | null;
      metricKey: string;
      points: AllTimeStatPoint[];
      posterSet: Set<string>;
    }
  >();

  for (const row of rows) {
    const entityType = row.department_id ? 'department' : 'division';
    const entityId = row.department_id ?? row.division_id;
    if (!entityId || !row.metric_key) continue;

    const key = seriesKey(entityId, row.metric_key);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        entityType,
        entityId,
        divisionId: row.division_id,
        metricKey: row.metric_key,
        points: [],
        posterSet: new Set(),
      };
      buckets.set(key, bucket);
    }

    const recordedAt = isoDate(row.recorded_at);
    bucket.points.push({
      label: recordedAt,
      value: Number(row.value),
      week: 0,
      recordedAt,
      recordedBy: row.recorded_by,
      workspaceId: row.workspace_id,
    });
    if (row.recorded_by?.trim()) bucket.posterSet.add(row.recorded_by.trim());
  }

  const out: AllTimeSeries[] = [];
  for (const bucket of buckets.values()) {
    bucket.points.sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
    bucket.points.forEach((p, i) => {
      p.week = i + 1;
    });
    const oldest = bucket.points[0]?.recordedAt ?? '';
    const newest = bucket.points[bucket.points.length - 1]?.recordedAt ?? '';
    out.push({
      entityType: bucket.entityType,
      entityId: bucket.entityId,
      divisionId: bucket.divisionId,
      metricKey: bucket.metricKey,
      points: bucket.points,
      posters: [...bucket.posterSet].sort(),
      oldest,
      newest,
    });
  }

  out.sort((a, b) => {
    const divA = a.divisionId ?? (a.entityType === 'division' ? a.entityId : '');
    const divB = b.divisionId ?? (b.entityType === 'division' ? b.entityId : '');
    const oi = BOARD_DIVISION_ORDER.indexOf(divA as (typeof BOARD_DIVISION_ORDER)[number]);
    const oj = BOARD_DIVISION_ORDER.indexOf(divB as (typeof BOARD_DIVISION_ORDER)[number]);
    const rankA = oi >= 0 ? oi : 99;
    const rankB = oj >= 0 ? oj : 99;
    if (rankA !== rankB) return rankA - rankB;
    if (a.entityType !== b.entityType) return a.entityType === 'division' ? -1 : 1;
    const idCmp = a.entityId.localeCompare(b.entityId, undefined, { numeric: true });
    if (idCmp !== 0) return idCmp;
    return a.metricKey.localeCompare(b.metricKey);
  });

  return out;
}

export async function fetchAllTimeStatsBundle(sql: DabosSql): Promise<AllTimeStatsBundle> {
  const [activeRows, superseded, divisions, departments, workingRows] = await Promise.all([
    sql`
      SELECT division_id, department_id, metric_key, value, recorded_at, recorded_by, workspace_id
      FROM stats
      WHERE superseded_at IS NULL
      ORDER BY recorded_at ASC
    ` as Promise<RawStatRow[]>,
    sql`SELECT COUNT(*)::int AS n FROM stats WHERE superseded_at IS NOT NULL` as Promise<
      Array<{ n: number }>
    >,
    sql`
      SELECT id, operational_name, primary_metric_key, secondary_metric_key FROM divisions ORDER BY id
    ` as Promise<
      Array<{
        id: string;
        operational_name: string;
        primary_metric_key: string | null;
        secondary_metric_key: string | null;
      }>
    >,
    sql`
      SELECT id, division_id, legacy_name, operational_name, primary_metric_key FROM departments ORDER BY id
    ` as Promise<
      Array<{
        id: string;
        division_id: string;
        legacy_name: string;
        operational_name: string;
        primary_metric_key: string | null;
      }>
    >,
    sql`
      SELECT entity_type, entity_id, working_condition, stat_indicated_condition
      FROM entity_condition_state
      WHERE entity_type IN ('division', 'department')
    ` as Promise<
      Array<{
        entity_type: string;
        entity_id: string;
        working_condition: string | null;
        stat_indicated_condition: string | null;
      }>
    >,
  ]);

  const working = new Map<string, { working: string | null; indicated: string | null }>();
  for (const row of workingRows) {
    working.set(row.entity_id, {
      working: row.working_condition,
      indicated: row.stat_indicated_condition,
    });
  }

  const series = groupAllTimeSeries(activeRows);

  return {
    series,
    supersededCount: Number(superseded[0]?.n ?? 0),
    activeCount: activeRows.length,
    working,
    divisions,
    departments,
  };
}

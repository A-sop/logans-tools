// RUNTIME REQUIREMENT: readers below filter `superseded_at IS NULL`; migration
// 021_stats_conditions_superseded.sql must be applied before this code is deployed (README > Deploy).
import {
  buildDivisionChartBundle,
  type DivisionChartBundle,
} from '@/lib/dabos/board-charts';
import {
  BOARD_STAT_YEAR,
  currentCalendarWeek,
  weekLabel,
  ytdRangeThroughWeek,
} from '@/lib/dabos/calendar-week';
import { evaluateConditionFromPoints } from '@/lib/dabos/conditions';
import { statWeekFromWorkspaceId, statWeekOf } from '@/lib/dabos/org-week';
import {
  getEntityConditionState,
  mergeEvaluationWithWorking,
  syncEntityConditionFromEvaluation,
} from '@/lib/dabos/condition-state-queries';
import { syncWorkingCondition } from '@/lib/dabos/condition-state';
import {
  emptyCondition,
  type BoardStatSnapshot,
} from '@/lib/dabos/condition-display';
import type { DabosSql } from '@/lib/dabos/dabos-connection';
import { worstWinsRollup, type ExecutiveRollup } from '@/lib/dabos/executive-rollup';
import {
  DCO_DIVISION_IDS,
  ORG_DIVISION_IDS,
} from '@/lib/dabos/org-board-config';
import { percentileRank, percentileSeries, roundPercentile } from '@/lib/dabos/percentile';
import type { ConditionEvaluation } from '@/lib/dabos/types';

export type BoardWeekContext = {
  year: number;
  calendarWeek: number;
  label: string;
};

export type BoardConditionsResult = {
  week: BoardWeekContext;
  divisions: Map<string, ConditionEvaluation>;
  departments: Map<string, ConditionEvaluation>;
  divisionPercentiles: Map<string, number | null>;
  divisionStats: Map<string, BoardStatSnapshot | null>;
  departmentStats: Map<string, BoardStatSnapshot | null>;
  divisionCharts: Map<string, DivisionChartBundle>;
  executive: {
    director: ExecutiveRollup;
    dco: ExecutiveRollup;
    org: ExecutiveRollup;
  };
};

type StatPoint = {
  division_id: string;
  department_id: string | null;
  metric_key: string;
  value: number;
  recorded_at: Date;
  iso_week: number;
};

/**
 * Stat week (org-week.ts: Thu 14:00 Berlin close) a stats row belongs to. A row whose
 * workspace_id carries a week label (div-live-/gfp-live-/...-YYYY-Www) keeps that label, so rows
 * written before Dept11 2026-10-30 (e.g. gfp-live rows recorded at the ISO Sunday end) stay in
 * the week they were posted for. Otherwise the week containing recorded_at.
 */
export function bucketStatWeek(
  year: number,
  recordedAt: Date,
  workspaceId?: string | null
): number | null {
  const labelled = statWeekFromWorkspaceId(workspaceId);
  if (labelled) return labelled.year === year ? labelled.week : null;
  const w = statWeekOf(recordedAt);
  return w.isoYear === year ? w.isoWeek : null;
}

/** Labelled rows may be recorded up to a week after their label's close (old ISO-Sunday rows). */
const LABELLED_ROW_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

function weeklyValuesFromPoints(
  points: StatPoint[],
  filter: (p: StatPoint) => boolean,
  throughWeek: number
): { values: number[]; weeks: number[]; snapshot: BoardStatSnapshot | null } {
  const byWeek = new Map<number, number>();
  let metricKey = 'tasks_completed';
  for (const p of points) {
    if (!filter(p) || p.iso_week > throughWeek || p.iso_week < 1) continue;
    metricKey = p.metric_key;
    byWeek.set(p.iso_week, p.value);
  }
  const weeks = [...byWeek.keys()].sort((a, b) => a - b);
  const values = weeks.map((w) => byWeek.get(w)!);
  if (weeks.length === 0) {
    return { values, weeks, snapshot: null };
  }
  const lastWeek = weeks[weeks.length - 1]!;
  return {
    values,
    weeks,
    snapshot: {
      metric_key: metricKey,
      value: byWeek.get(lastWeek)!,
      calendar_week: lastWeek,
      point_count: values.length,
    },
  };
}

function evaluateDivisionFromWeeklyRaw(
  weeklyValues: number[],
  meta: { entity_id: string; metric_key: string; year: number; calendar_week: number }
): { evaluation: ConditionEvaluation; currentPercentile: number | null } {
  if (weeklyValues.length < 3) {
    return {
      evaluation: {
        condition: null,
        stat_indicated_condition: null,
        working_condition: null,
        confidence: null,
        point_count: weeklyValues.length,
        basis: {
          entity_type: 'division',
          entity_id: meta.entity_id,
          metric_key: meta.metric_key,
          year: meta.year,
          calendar_week: meta.calendar_week,
          weekly_values: weeklyValues,
        },
        reason: 'insufficient_data',
      },
      currentPercentile: weeklyValues.length
        ? roundPercentile(
            percentileRank(weeklyValues[weeklyValues.length - 1]!, weeklyValues)
          )
        : null,
    };
  }

  const pctSeries = percentileSeries(weeklyValues);
  const evaluation = evaluateConditionFromPoints(pctSeries, {
    entity_type: 'division',
    entity_id: meta.entity_id,
    metric_key: meta.metric_key,
    window_days: meta.calendar_week * 7,
  });

  evaluation.basis = {
    ...evaluation.basis,
    year: meta.year,
    calendar_week: meta.calendar_week,
    weekly_values: weeklyValues,
    percentile_series: pctSeries,
    normalization: 'YTD percentile (2 dp) per division metric',
  };

  return {
    evaluation,
    currentPercentile: pctSeries[pctSeries.length - 1] ?? null,
  };
}

async function mergeBoardEvaluation(
  sql: DabosSql,
  entityType: 'division' | 'department',
  entityId: string,
  evaluation: ConditionEvaluation
): Promise<ConditionEvaluation> {
  try {
    const existing = await getEntityConditionState(sql, entityType, entityId);
    const working = syncWorkingCondition(
      existing?.working_condition ?? null,
      evaluation.stat_indicated_condition
    );
    return mergeEvaluationWithWorking(evaluation, working);
  } catch {
    // Never render "No data yet" for a seeded org: fall back to the default
    // working condition (Non-Existence) so the board shows the honest baseline
    // even if the condition-state read fails or a stat series is < 3 points.
    const working = syncWorkingCondition(null, evaluation.stat_indicated_condition);
    return mergeEvaluationWithWorking(evaluation, working);
  }
}

export async function evaluateBoardConditionsWithSql(
  sql: DabosSql,
  input?: { year?: number; calendarWeek?: number }
): Promise<BoardConditionsResult> {
  const year = input?.year ?? BOARD_STAT_YEAR;
  const calendarWeek = input?.calendarWeek ?? currentCalendarWeek(year);
  const { start, end, week } = ytdRangeThroughWeek(year, calendarWeek);
  const weekCtx: BoardWeekContext = {
    year,
    calendarWeek: week,
    label: weekLabel(year, week),
  };

  const divisions = await sql`SELECT id, primary_metric_key FROM divisions ORDER BY id`;
  const departments = await sql`SELECT id, division_id FROM departments ORDER BY id`;
  const statRows = await sql`
    SELECT workspace_id, division_id, department_id, metric_key, value::float8 AS value, recorded_at
    FROM stats
    WHERE recorded_at >= ${start.toISOString()}::timestamptz
      AND recorded_at <= ${new Date(end.getTime() + LABELLED_ROW_GRACE_MS).toISOString()}::timestamptz
      AND superseded_at IS NULL
    ORDER BY recorded_at ASC
  `;

  const points: StatPoint[] = statRows.map((s) => {
    const recordedAt = new Date(s.recorded_at as string);
    return {
      division_id: s.division_id as string,
      department_id: (s.department_id as string | null) ?? null,
      metric_key: s.metric_key as string,
      value: Number(s.value),
      recorded_at: recordedAt,
      // bucketed stat week; rows after the selected week are dropped by weeklyValuesFromPoints
      iso_week: bucketStatWeek(year, recordedAt, (s.workspace_id as string | null) ?? null) ?? 0,
    };
  });

  const metricByDivision = new Map<string, string>(
    divisions.map((d) => [
      d.id as string,
      (d.primary_metric_key as string | null) ?? 'tasks_completed',
    ])
  );

  const divisionConditions = new Map<string, ConditionEvaluation>();
  const divisionPercentiles = new Map<string, number | null>();
  const divisionStats = new Map<string, BoardStatSnapshot | null>();
  const divisionCharts = new Map<string, DivisionChartBundle>();

  for (const div of divisions) {
    const id = div.id as string;
    const metricKey = metricByDivision.get(id) ?? 'tasks_completed';
    const { values: weeklyValues, weeks: weeklyWeeks, snapshot } = weeklyValuesFromPoints(
      points,
      (p) => p.division_id === id && p.department_id == null && p.metric_key === metricKey,
      week
    );
    const { evaluation, currentPercentile } = evaluateDivisionFromWeeklyRaw(weeklyValues, {
      entity_id: id,
      metric_key: metricKey,
      year,
      calendar_week: week,
    });
    divisionConditions.set(id, evaluation);
    divisionPercentiles.set(id, currentPercentile);
    divisionStats.set(id, snapshot);
    divisionCharts.set(
      id,
      buildDivisionChartBundle(
        weeklyWeeks.map((w, i) => ({ week: w, value: weeklyValues[i]! })),
        year,
        week
      )
    );
  }

  for (const [id, evaluation] of divisionConditions) {
    divisionConditions.set(id, await mergeBoardEvaluation(sql, 'division', id, evaluation));
  }

  const departmentConditions = new Map<string, ConditionEvaluation>();
  const departmentStats = new Map<string, BoardStatSnapshot | null>();

  for (const dept of departments) {
    const id = dept.id as string;
    const divisionId = dept.division_id as string;
    const metricKey = metricByDivision.get(divisionId) ?? 'tasks_completed';
    const { values, snapshot } = weeklyValuesFromPoints(
      points,
      (p) => p.department_id === id && p.metric_key === metricKey,
      week
    );

    if (values.length >= 3) {
      departmentConditions.set(
        id,
        evaluateConditionFromPoints(percentileSeries(values), {
          entity_type: 'department',
          entity_id: id,
          metric_key: metricKey,
          window_days: week * 7,
        })
      );
      departmentStats.set(id, snapshot);
    } else {
      const divCondition = divisionConditions.get(divisionId) ?? emptyCondition(id, metricKey);
      departmentConditions.set(id, divCondition);
      departmentStats.set(id, divisionStats.get(divisionId) ?? snapshot);
    }
  }

  for (const [id, evaluation] of departmentConditions) {
    departmentConditions.set(id, await mergeBoardEvaluation(sql, 'department', id, evaluation));
  }

  const allDivisionIds = divisions.map((d) => d.id as string);

  return {
    week: weekCtx,
    divisions: divisionConditions,
    departments: departmentConditions,
    divisionPercentiles,
    divisionStats,
    departmentStats,
    divisionCharts,
    executive: {
      director: worstWinsRollup(allDivisionIds, divisionConditions, divisionPercentiles, {
        rollup_id: 'executive_director',
        rollup_label: 'Executive Director',
      }),
      dco: worstWinsRollup([...DCO_DIVISION_IDS], divisionConditions, divisionPercentiles, {
        rollup_id: 'dco_secretary',
        rollup_label: 'DCO Executive Secretary',
      }),
      org: worstWinsRollup([...ORG_DIVISION_IDS], divisionConditions, divisionPercentiles, {
        rollup_id: 'org_secretary',
        rollup_label: 'Organization Executive Secretary',
      }),
    },
  };
}

async function persistConditionEvaluation(
  sql: DabosSql,
  entityType: 'division' | 'department' | 'workspace' | 'project',
  entityId: string,
  evaluation: ConditionEvaluation
): Promise<string | null> {
  let merged = evaluation;
  try {
    merged = await syncEntityConditionFromEvaluation(sql, entityType, entityId, evaluation);
  } catch (err) {
    // Never fall back to the stat-indicated condition: that would override a founder
    // ruling. Skip the write and surface the error instead.
    console.warn(`condition sync failed for ${entityType} ${entityId}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
  const label = merged.working_condition ?? merged.stat_indicated_condition;
  if (!label) return null;
  await sql`
    INSERT INTO conditions (entity_type, entity_id, condition, confidence, basis)
    VALUES (
      ${entityType},
      ${entityId},
      ${label},
      ${merged.confidence},
      ${JSON.stringify(merged.basis)}::jsonb
    )
  `;
  return label;
}

export async function refreshAllConditionsFromBoardWithSql(sql: DabosSql): Promise<{
  week: BoardWeekContext;
  persisted: { divisions: number; departments: number };
  samples: { entity_id: string; condition: string }[];
}> {
  const board = await evaluateBoardConditionsWithSql(sql);
  let divisions = 0;
  let departments = 0;
  const samples: { entity_id: string; condition: string }[] = [];

  for (const [id, evaluation] of board.divisions) {
    const persisted = await persistConditionEvaluation(sql, 'division', id, evaluation);
    if (persisted) {
      divisions += 1;
      if (samples.length < 7) {
        samples.push({ entity_id: id, condition: persisted });
      }
    }
  }

  for (const [id, evaluation] of board.departments) {
    if (await persistConditionEvaluation(sql, 'department', id, evaluation)) {
      departments += 1;
    }
  }

  return { week: board.week, persisted: { divisions, departments }, samples };
}

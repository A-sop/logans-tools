import { getISOWeek, getISOWeekYear } from 'date-fns';

import {
  buildDivisionChartBundle,
  type DivisionChartBundle,
} from '@/lib/dabos/board-charts';
import {
  BOARD_STAT_YEAR,
  currentCalendarWeek,
  ytdRangeThroughWeek,
} from '@/lib/dabos/calendar-week';
import { evaluateConditionFromPoints } from '@/lib/dabos/conditions';
import {
  emptyCondition,
  formatConditionTooltip,
  type BoardStatSnapshot,
} from '@/lib/dabos/condition-display';
import { worstWinsRollup, type ExecutiveRollup } from '@/lib/dabos/executive-rollup';
import {
  DCO_DIVISION_IDS,
  ORG_DIVISION_IDS,
} from '@/lib/dabos/org-board-config';
import { percentileRank, percentileSeries, roundPercentile } from '@/lib/dabos/percentile';
import { getDabosSql } from '@/lib/dabos/db';
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

function bucketIsoWeek(isoYear: number, recordedAt: Date): number | null {
  if (getISOWeekYear(recordedAt) !== isoYear) return null;
  return getISOWeek(recordedAt);
}

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

export async function evaluateBoardConditions(input?: {
  year?: number;
  calendarWeek?: number;
}): Promise<BoardConditionsResult> {
  const year = input?.year ?? BOARD_STAT_YEAR;
  const calendarWeek = input?.calendarWeek ?? currentCalendarWeek(year);
  const { start, end, week } = ytdRangeThroughWeek(year, calendarWeek);
  const weekCtx: BoardWeekContext = {
    year,
    calendarWeek: week,
    label: `Calendar week ${week}, ${year}`,
  };

  const sql = getDabosSql();
  const divisions = await sql`SELECT id, primary_metric_key FROM divisions ORDER BY id`;
  const departments = await sql`SELECT id, division_id FROM departments ORDER BY id`;
  const statRows = await sql`
    SELECT division_id, department_id, metric_key, value::float8 AS value, recorded_at
    FROM stats
    WHERE recorded_at >= ${start.toISOString()}::timestamptz
      AND recorded_at <= ${end.toISOString()}::timestamptz
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
      iso_week: bucketIsoWeek(year, recordedAt) ?? 0,
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

export { formatConditionTooltip };

export async function evaluateAndPersistCondition(input: {
  entity_type: 'division' | 'department' | 'workspace' | 'project';
  entity_id: string;
  metric_key: string;
  window_days?: number;
}): Promise<ConditionEvaluation> {
  const sql = getDabosSql();
  const windowDays = input.window_days ?? 7;
  const since = new Date(Date.now() - windowDays * 86400000).toISOString();

  const rows =
    input.entity_type === 'department'
      ? await sql`
          SELECT value::float8 AS value
          FROM stats
          WHERE department_id = ${input.entity_id}
            AND metric_key = ${input.metric_key}
            AND recorded_at >= ${since}::timestamptz
          ORDER BY recorded_at ASC
        `
      : await sql`
          SELECT value::float8 AS value
          FROM stats
          WHERE division_id = ${input.entity_id}
            AND department_id IS NULL
            AND metric_key = ${input.metric_key}
            AND recorded_at >= ${since}::timestamptz
          ORDER BY recorded_at ASC
        `;

  const values = rows.map((r) => Number(r.value)).filter((v) => Number.isFinite(v));
  const evaluation = evaluateConditionFromPoints(values, {
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    metric_key: input.metric_key,
    window_days: windowDays,
  });

  if (evaluation.condition) {
    await sql`
      INSERT INTO conditions (entity_type, entity_id, condition, confidence, basis)
      VALUES (
        ${input.entity_type},
        ${input.entity_id},
        ${evaluation.condition},
        ${evaluation.confidence},
        ${JSON.stringify(evaluation.basis)}::jsonb
      )
    `;
  }

  return evaluation;
}

export async function getLatestCondition(
  entityType: 'division' | 'department' | 'workspace' | 'project',
  entityId: string
) {
  const sql = getDabosSql();
  const rows = await sql`
    SELECT condition, confidence, basis, created_at
    FROM conditions
    WHERE entity_type = ${entityType} AND entity_id = ${entityId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getLatestStatValue(divisionId: string, metricKey: string) {
  const sql = getDabosSql();
  const rows = await sql`
    SELECT value::float8 AS value, recorded_at
    FROM stats
    WHERE division_id = ${divisionId}
      AND department_id IS NULL
      AND metric_key = ${metricKey}
    ORDER BY recorded_at DESC
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return { value: Number(row.value), recorded_at: row.recorded_at as string };
}

export async function countOpenTasks(divisionId: string): Promise<number> {
  const sql = getDabosSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS n
    FROM tasks
    WHERE division_id = ${divisionId}
      AND status IN ('todo', 'doing', 'blocked')
  `;
  return (rows[0]?.n as number) ?? 0;
}

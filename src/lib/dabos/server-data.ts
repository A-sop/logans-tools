import {
  parseBoardChartPeriod,
  pickChartSeries,
  type DivisionChartBundle,
} from '@/lib/dabos/board-charts';
import { hasDabosDb, getDabosSql } from '@/lib/dabos/db';
import {
  evaluateAndPersistCondition,
  evaluateBoardConditions,
  getLatestStatValue,
  countOpenTasks,
} from '@/lib/dabos/queries';
import type { ConditionEvaluation } from '@/lib/dabos/types';

export function dabosConfigured() {
  return hasDabosDb();
}

export async function fetchOrgMap() {
  const sql = getDabosSql();
  const divisions = await sql`
    SELECT id, operational_name, description, primary_metric_key
    FROM divisions ORDER BY id
  `;

  return Promise.all(
    divisions.map(async (div) => {
      const metricKey = (div.primary_metric_key as string | null) ?? 'tasks_completed';
      const latestCondition = await evaluateAndPersistCondition({
        entity_type: 'division',
        entity_id: div.id as string,
        metric_key: metricKey,
        window_days: 7,
      });
      const latestStat = await getLatestStatValue(div.id as string, metricKey);
      const openTasks = await countOpenTasks(div.id as string);

      return {
        id: div.id as string,
        operational_name: div.operational_name as string,
        description: div.description as string | null,
        primary_metric_key: metricKey,
        latest_condition: latestCondition,
        primary_stat: latestStat
          ? { value: latestStat.value, recorded_at: latestStat.recorded_at }
          : null,
        activity: openTasks > 0 ? ('active' as const) : ('idle' as const),
        open_task_count: openTasks,
      };
    })
  );
}

export async function fetchDivision(id: string) {
  const sql = getDabosSql();
  const divisions = await sql`
    SELECT id, operational_name, description, primary_metric_key
    FROM divisions WHERE id = ${id}
  `;
  const division = divisions[0];
  if (!division) return null;

  const departments = await sql`
    SELECT id, legacy_name, operational_name, policy_text
    FROM departments WHERE division_id = ${id} ORDER BY id
  `;

  const tasks = await sql`
    SELECT id, title, status, priority, department_id, assigned_agent, created_at
    FROM tasks
    WHERE division_id = ${id}
    ORDER BY CASE status WHEN 'doing' THEN 0 WHEN 'todo' THEN 1 WHEN 'blocked' THEN 2 ELSE 3 END,
      priority ASC, created_at DESC
    LIMIT 100
  `;

  const metricKey = (division.primary_metric_key as string | null) ?? 'tasks_completed';
  const latestCondition = await evaluateAndPersistCondition({
    entity_type: 'division',
    entity_id: id,
    metric_key: metricKey,
    window_days: 7,
  });

  return { division, departments, tasks, latest_condition: latestCondition };
}

export async function fetchDepartment(divisionId: string, deptId: string) {
  const sql = getDabosSql();
  const departments = await sql`
    SELECT id, division_id, legacy_name, operational_name, policy_text
    FROM departments WHERE id = ${deptId} AND division_id = ${divisionId}
  `;
  const department = departments[0];
  if (!department) return null;

  const divisionRows = await sql`
    SELECT operational_name FROM divisions WHERE id = ${divisionId}
  `;

  const tasks = await sql`
    SELECT id, title, status, priority, type, assigned_agent, created_at
    FROM tasks
    WHERE division_id = ${divisionId} AND department_id = ${deptId}
    ORDER BY created_at DESC
  `;

  const stats = await sql`
    SELECT metric_key, value, recorded_at
    FROM stats
    WHERE department_id = ${deptId}
    ORDER BY recorded_at DESC
    LIMIT 20
  `;

  return {
    division: { id: divisionId, operational_name: divisionRows[0]?.operational_name as string },
    department,
    tasks,
    stats,
  };
}

export async function fetchTask(id: string) {
  const sql = getDabosSql();
  const tasks = await sql`SELECT * FROM tasks WHERE id = ${id}::uuid`;
  const task = tasks[0];
  if (!task) return null;

  const artifacts = await sql`
    SELECT id, type, summary, created_by, created_at
    FROM artifacts WHERE task_id = ${id}::uuid ORDER BY created_at DESC
  `;

  const costEvents = await sql`
    SELECT id, agent_name, provider, tokens_input, tokens_output, cost_eur, created_at
    FROM cost_events WHERE task_id = ${id}::uuid ORDER BY created_at DESC
  `;

  const divisionRows = await sql`
    SELECT operational_name FROM divisions WHERE id = ${task.division_id as string}
  `;

  let department = null;
  if (task.department_id) {
    const deptRows = await sql`
      SELECT legacy_name, operational_name FROM departments WHERE id = ${task.department_id as string}
    `;
    department = deptRows[0] ?? null;
  }

  return { task, artifacts, cost_events: costEvents, division: divisionRows[0], department };
}

export async function fetchArtifact(id: string) {
  const sql = getDabosSql();
  const rows = await sql`SELECT * FROM artifacts WHERE id = ${id}::uuid`;
  return rows[0] ?? null;
}

export async function fetchDepartmentsForSelect() {
  const sql = getDabosSql();
  return sql`
    SELECT id, division_id, legacy_name, operational_name
    FROM departments ORDER BY id
  `;
}

export async function fetchOrgBoardData(input?: {
  year?: number;
  calendarWeek?: number;
  period?: string;
}) {
  const period = parseBoardChartPeriod(input?.period);
  const sql = getDabosSql();
  const divisions = await sql`
    SELECT id, operational_name, description, primary_metric_key
    FROM divisions ORDER BY id
  `;
  const departments = await sql`
    SELECT id, division_id, legacy_name, operational_name, policy_text
    FROM departments ORDER BY id
  `;

  const conditions = await evaluateBoardConditions(input);
  const { week, executive, divisionStats, departmentStats, divisionCharts } = conditions;

  const emptyCharts: DivisionChartBundle = {
    week: [],
    month: [],
    quarter: [],
    year: [],
  };

  const deptsByDiv = new Map<string, typeof departments>();
  for (const dept of departments) {
    const divId = dept.division_id as string;
    const list = deptsByDiv.get(divId) ?? [];
    list.push(dept);
    deptsByDiv.set(divId, list);
  }
  for (const [divId, list] of deptsByDiv) {
    list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    deptsByDiv.set(divId, list);
  }

  const boardDivisions = divisions.map((div) => {
    const divId = div.id as string;
    const divCondition =
      conditions.divisions.get(divId) ??
      ({
        condition: null,
        confidence: null,
        point_count: 0,
        basis: {},
        reason: 'insufficient_data',
      } satisfies ConditionEvaluation);
    const divStat = divisionStats.get(divId) ?? null;
    const metricKey =
      (div.primary_metric_key as string | null) ??
      divStat?.metric_key ??
      'tasks_completed';
    const chartBundle = divisionCharts.get(divId) ?? emptyCharts;

    return {
      id: divId,
      operational_name: div.operational_name as string,
      description: div.description as string | null,
      condition: divCondition.condition,
      stat: divStat,
      metric_key: metricKey,
      chart_points: pickChartSeries(chartBundle, period),
      departments: (deptsByDiv.get(divId) ?? []).map((d) => {
        const deptId = d.id as string;
        const deptCondition =
          conditions.departments.get(deptId) ??
          ({
            condition: null,
            confidence: null,
            point_count: 0,
            basis: {},
            reason: 'insufficient_data',
          } satisfies ConditionEvaluation);
        const deptStat = departmentStats.get(deptId) ?? null;

        return {
          id: deptId,
          legacy_name: d.legacy_name as string,
          operational_name: d.operational_name as string,
          policy_text: (d.policy_text as string | null) ?? null,
          condition: deptCondition.condition,
          stat: deptStat,
        };
      }),
    };
  });

  return {
    week,
    period,
    executive: {
      director: { condition: executive.director.condition.condition },
      dco: { condition: executive.dco.condition.condition },
      org: { condition: executive.org.condition.condition },
    },
    divisions: boardDivisions,
  };
}

import {
  parseBoardChartPeriod,
  pickChartSeries,
  type DivisionChartBundle,
} from '@/lib/dabos/board-charts';
import { battlePlanForDept, DIVISION_BATTLE_PLAN_WEEKLY } from '@/lib/dabos/battle-plans';
import {
  neighborsInBrowseChain,
  orderDepartmentsForBrowse,
} from '@/lib/dabos/dabos-paths';
import {
  fetchDeptEstablishment,
  fetchDeptEstablishmentMap,
} from '@/lib/dabos/establishment';
import { hasDabosDb, getDabosSql } from '@/lib/dabos/db';
import { getStatCutoffSnapshot, type StatCutoffSnapshot } from '@/lib/dabos/org-week';
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

export type DabosShellData = {
  cutoff: StatCutoffSnapshot;
  role_runs: { role_id: string; ran_at: string }[];
};

export async function fetchDabosShell(): Promise<DabosShellData> {
  const cutoff = getStatCutoffSnapshot();
  const sql = getDabosSql();
  let role_runs: { role_id: string; ran_at: string }[] = [];
  try {
    const rows = await sql`
      SELECT DISTINCT ON (role_id) role_id, ran_at
      FROM role_runs
      WHERE role_id IN ('morning_plan', 'week_close', 'refresh_conditions')
      ORDER BY role_id, ran_at DESC
    `;
    role_runs = rows.map((r) => ({
      role_id: r.role_id as string,
      ran_at: (r.ran_at as Date).toISOString(),
    }));
  } catch {
    /* role_runs table may be missing on old DB */
  }
  return { cutoff, role_runs };
}

export type DeptActivity = {
  open_count: number;
  doing_count: number;
  doing_agent_count: number;
  activity: 'active' | 'idle' | 'investigating';
};

/** Departments with at least one task in status `doing` right now. */
export type WorkingNowEntry = {
  department_id: string;
  division_id: string;
  operational_name: string;
  doing_count: number;
  sample_title: string | null;
  sample_task_id: string | null;
  sample_type: string | null;
  sample_assigned_agent: string | null;
};

export async function fetchDeptActivityMap(): Promise<Map<string, DeptActivity>> {
  const sql = getDabosSql();
  const map = new Map<string, DeptActivity>();
  try {
    const rows = await sql`
      SELECT
        department_id,
        COUNT(*) FILTER (WHERE status IN ('todo', 'doing', 'blocked'))::int AS open_count,
        COUNT(*) FILTER (WHERE status = 'doing')::int AS doing_count,
        COUNT(*) FILTER (WHERE status = 'doing' AND assigned_agent IS NOT NULL)::int AS doing_agent_count
      FROM tasks
      WHERE department_id IS NOT NULL
      GROUP BY department_id
    `;
    for (const row of rows) {
      const deptId = row.department_id as string;
      const open = Number(row.open_count) || 0;
      const doing = Number(row.doing_count) || 0;
      const doingAgent = Number(row.doing_agent_count) || 0;
      map.set(deptId, {
        open_count: open,
        doing_count: doing,
        doing_agent_count: doingAgent,
        activity: doing > 0 ? 'investigating' : open > 0 ? 'active' : 'idle',
      });
    }
  } catch {
    /* tasks table */
  }
  return map;
}

export async function fetchWorkingNow(): Promise<WorkingNowEntry[]> {
  const sql = getDabosSql();
  try {
    const rows = await sql`
      WITH ranked AS (
        SELECT
          t.department_id,
          t.division_id,
          d.operational_name,
          t.id::text AS task_id,
          t.title,
          t.type,
          t.assigned_agent,
          ROW_NUMBER() OVER (
            PARTITION BY t.department_id
            ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC
          ) AS rn,
          COUNT(*) OVER (PARTITION BY t.department_id) AS doing_count
        FROM tasks t
        INNER JOIN departments d ON d.id = t.department_id
        WHERE t.status = 'doing'
          AND t.department_id IS NOT NULL
      )
      SELECT
        department_id,
        division_id,
        operational_name,
        doing_count,
        title AS sample_title,
        task_id AS sample_task_id,
        type AS sample_type,
        assigned_agent AS sample_assigned_agent
      FROM ranked
      WHERE rn = 1
      ORDER BY division_id, department_id
    `;
    return rows.map((row) => ({
      department_id: row.department_id as string,
      division_id: row.division_id as string,
      operational_name: row.operational_name as string,
      doing_count: Number(row.doing_count) || 0,
      sample_title: (row.sample_title as string | null) ?? null,
      sample_task_id: (row.sample_task_id as string | null) ?? null,
      sample_type: (row.sample_type as string | null) ?? null,
      sample_assigned_agent: (row.sample_assigned_agent as string | null) ?? null,
    }));
  } catch {
    return [];
  }
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

  const siblingRows = await sql`
    SELECT id, operational_name
    FROM divisions
    ORDER BY id ASC
  `;

  const departments = await sql`
    SELECT id, legacy_name, operational_name, policy_text
    FROM departments WHERE division_id = ${id} ORDER BY id
  `;
  const establishment = await fetchDeptEstablishmentMap(sql);

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

  return {
    division,
    siblings: siblingRows.map((row) => ({
      id: row.id as string,
      operational_name: row.operational_name as string,
    })),
    departments,
    tasks,
    latest_condition: latestCondition,
    establishment,
  };
}

export async function fetchDepartment(divisionId: string, deptId: string) {
  return fetchDepartmentDashboard(divisionId, deptId);
}

export async function fetchDepartmentDashboardById(deptId: string) {
  const sql = getDabosSql();
  const rows = await sql`
    SELECT division_id FROM departments WHERE id = ${deptId} LIMIT 1
  `;
  const divisionId = rows[0]?.division_id as string | undefined;
  if (!divisionId) return null;
  return fetchDepartmentDashboard(divisionId, deptId);
}

export async function fetchDepartmentDashboard(divisionId: string, deptId: string) {
  const sql = getDabosSql();
  const departments = await sql`
    SELECT id, division_id, legacy_name, operational_name, policy_text
    FROM departments WHERE id = ${deptId} AND division_id = ${divisionId}
  `;
  const department = departments[0];
  if (!department) return null;

  const siblingRows = await sql`
    SELECT id, legacy_name, operational_name
    FROM departments
    WHERE division_id = ${divisionId}
    ORDER BY id ASC
  `;

  const browseRows = await sql`
    SELECT id, division_id, legacy_name, operational_name
    FROM departments
  `;
  const browseChain = orderDepartmentsForBrowse(
    browseRows.map((row) => ({
      id: row.id as string,
      division_id: row.division_id as string,
      legacy_name: row.legacy_name as string,
      operational_name: row.operational_name as string,
    }))
  );
  const { index: browseIndex, prev: browsePrev, next: browseNext } =
    neighborsInBrowseChain(browseChain, deptId);

  const divisionRows = await sql`
    SELECT id, operational_name, description, primary_metric_key
    FROM divisions WHERE id = ${divisionId}
  `;
  const division = divisionRows[0];
  if (!division) return null;

  const tasks = await sql`
    SELECT id, title, status, priority, type, assigned_agent, created_at, updated_at, completed_at
    FROM tasks
    WHERE division_id = ${divisionId} AND department_id = ${deptId}
    ORDER BY
      CASE status WHEN 'doing' THEN 0 WHEN 'todo' THEN 1 WHEN 'blocked' THEN 2 WHEN 'approval' THEN 3 ELSE 4 END,
      priority ASC,
      created_at DESC
    LIMIT 100
  `;

  const stats = await sql`
    SELECT metric_key, value, recorded_at, workspace_id
    FROM stats
    WHERE department_id = ${deptId}
    ORDER BY recorded_at DESC
    LIMIT 20
  `;

  const artifacts = await sql`
    SELECT id, type, summary, task_id, created_by, created_at
    FROM artifacts
    WHERE department_id = ${deptId}
    ORDER BY created_at DESC
    LIMIT 30
  `;

  const investigationArtifacts = await sql`
    SELECT a.id, a.type, a.summary, a.task_id, a.created_at
    FROM artifacts a
    INNER JOIN tasks t ON t.id = a.task_id
    WHERE t.department_id = ${deptId}
      AND (t.type = 'agent' OR t.assigned_agent IS NOT NULL)
    ORDER BY a.created_at DESC
    LIMIT 20
  `;

  const receipts = await sql`
    SELECT ce.id, ce.agent_name, ce.cost_eur, ce.tokens_input, ce.tokens_output, ce.created_at, t.title AS task_title
    FROM cost_events ce
    INNER JOIN tasks t ON t.id = ce.task_id
    WHERE t.department_id = ${deptId}
    ORDER BY ce.created_at DESC
    LIMIT 15
  `;

  let last_role_run: string | null = null;
  try {
    const runs = await sql`
      SELECT ran_at FROM role_runs
      WHERE role_id = ${deptId}
      ORDER BY ran_at DESC
      LIMIT 1
    `;
    if (runs[0]?.ran_at) {
      last_role_run = (runs[0].ran_at as Date).toISOString();
    }
  } catch {
    /* optional */
  }

  const metricKey =
    (division.primary_metric_key as string | null) ?? 'tasks_completed';
  const latestCondition = await evaluateAndPersistCondition({
    entity_type: 'department',
    entity_id: deptId,
    metric_key: metricKey,
    window_days: 7,
  });

  const battle_plan = battlePlanForDept(deptId, latestCondition.condition);
  const establishment = await fetchDeptEstablishment(sql, deptId);

  let lastActive: string | null = null;
  for (const t of tasks) {
    const candidates = [t.updated_at, t.completed_at, t.created_at].filter(Boolean);
    for (const c of candidates) {
      const iso = new Date(c as string).toISOString();
      if (!lastActive || iso > lastActive) lastActive = iso;
    }
  }
  if (stats[0]?.recorded_at) {
    const iso = new Date(stats[0].recorded_at as string).toISOString();
    if (!lastActive || iso > lastActive) lastActive = iso;
  }

  const workQueue = tasks.filter((t) =>
    ['todo', 'doing', 'blocked', 'approval'].includes(t.status as string)
  );
  const investigations = tasks.filter(
    (t) => t.type === 'agent' || (t.assigned_agent as string | null)
  );

  return {
    division,
    department,
    siblings: siblingRows.map((row) => ({
      id: row.id as string,
      legacy_name: row.legacy_name as string,
      operational_name: row.operational_name as string,
    })),
    browse: {
      index: browseIndex,
      total: browseChain.length,
      prev: browsePrev,
      next: browseNext,
    },
    tasks,
    workQueue,
    investigations,
    stats,
    artifacts,
    investigationArtifacts,
    receipts,
    latest_condition: latestCondition,
    battle_plan,
    establishment,
    last_role_run,
    last_active: lastActive,
    metric_key: metricKey,
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
  const [deptActivity, workingNow, establishmentMap] = await Promise.all([
    fetchDeptActivityMap(),
    fetchWorkingNow(),
    fetchDeptEstablishmentMap(sql),
  ]);

  let openTasksTotal = 0;
  try {
    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count FROM tasks
      WHERE status IN ('todo', 'doing', 'blocked', 'approval')
    `;
    openTasksTotal = Number(count) || 0;
  } catch {
    /* */
  }

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
        stat_indicated_condition: null,
        working_condition: null,
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
      statIndicated: divCondition.stat_indicated_condition,
      climbLag: divCondition.climb_lag,
      stat: divStat,
      metric_key: metricKey,
      chart_points: pickChartSeries(chartBundle, period),
      departments: (deptsByDiv.get(divId) ?? []).map((d) => {
        const deptId = d.id as string;
        const deptCondition =
          conditions.departments.get(deptId) ??
          ({
            condition: null,
            stat_indicated_condition: null,
            working_condition: null,
            confidence: null,
            point_count: 0,
            basis: {},
            reason: 'insufficient_data',
          } satisfies ConditionEvaluation);
        const deptStat = departmentStats.get(deptId) ?? null;
        const activity = deptActivity.get(deptId) ?? {
          open_count: 0,
          doing_count: 0,
          doing_agent_count: 0,
          activity: 'idle' as const,
        };

        return {
          id: deptId,
          legacy_name: d.legacy_name as string,
          operational_name: d.operational_name as string,
          policy_text: (d.policy_text as string | null) ?? null,
          condition: deptCondition.condition,
          statIndicated: deptCondition.stat_indicated_condition,
          climbLag: deptCondition.climb_lag,
          stat: deptStat,
          open_task_count: activity.open_count,
          doing_count: activity.doing_count,
          activity: activity.activity,
          establishment: establishmentMap.get(deptId) ?? null,
        };
      }),
    };
  });

  let roleRuns: { role_id: string; ran_at: string }[] = [];
  try {
    const rows = await sql`
      SELECT DISTINCT ON (role_id) role_id, ran_at
      FROM role_runs
      WHERE role_id IN ('morning_plan', 'week_close')
      ORDER BY role_id, ran_at DESC
    `;
    roleRuns = rows.map((r) => ({
      role_id: r.role_id as string,
      ran_at: (r.ran_at as Date).toISOString(),
    }));
  } catch {
    /* */
  }

  const divisionsWithWork = boardDivisions.filter((d) =>
    d.departments.some((dept) => (dept.open_task_count ?? 0) > 0)
  ).length;

  return {
    week,
    period,
    executive: {
      director: {
        condition: executive.director.condition.condition,
        last_run: roleRuns.find((r) => r.role_id === 'morning_plan')?.ran_at ?? null,
      },
      dco: { condition: executive.dco.condition.condition },
      org: { condition: executive.org.condition.condition },
      week_close_at: roleRuns.find((r) => r.role_id === 'week_close')?.ran_at ?? null,
    },
    cadence: {
      open_tasks_total: openTasksTotal,
      divisions_with_work: divisionsWithWork,
      departments_working: workingNow.length,
      working_now: workingNow,
    },
    divisions: boardDivisions,
  };
}

export async function fetchDivisionBattlePlan(divisionId: string): Promise<string> {
  return DIVISION_BATTLE_PLAN_WEEKLY[divisionId] ?? 'Execute division weekly promotion checklist.';
}

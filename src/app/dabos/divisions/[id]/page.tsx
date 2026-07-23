import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppendStatForm } from '@/components/dabos/append-stat-form';
import { CreateTaskForm } from '@/components/dabos/create-task-form';
import { DivSiblingNav } from '@/components/dabos/div-sibling-nav';
import { DrilldownShell, DivisionDrilldownHeader } from '@/components/dabos/division-drilldown';
import { BOARD_PAGE_TITLE, type BoardDivisionId } from '@/lib/dabos/org-board-config';
import { evaluateBoardConditions } from '@/lib/dabos/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  dabosConfigured,
  fetchDepartmentsForSelect,
  fetchDeptActivityMap,
  fetchDivision,
  fetchDivisionBattlePlan,
} from '@/lib/dabos/server-data';

type PageProps = { params: Promise<{ id: string }> };

export default async function DivisionPage({ params }: PageProps) {
  if (!dabosConfigured()) notFound();

  const { id } = await params;
  const data = await fetchDivision(id);
  if (!data) notFound();

  const { division, siblings, departments, tasks, latest_condition, establishment } = data;
  const metricKey = (division.primary_metric_key as string | null) ?? 'tasks_completed';
  const boardConditions = await evaluateBoardConditions();
  const deptActivity = await fetchDeptActivityMap();
  const departmentsForForm = (await fetchDepartmentsForSelect()).map((d) => ({
    id: d.id as string,
    division_id: d.division_id as string,
    label: `${d.id} — ${d.legacy_name as string} (${d.operational_name as string})`,
  }));

  const boardDepts = departments.map((d) => {
    const deptId = d.id as string;
    const deptCondition = boardConditions.departments.get(deptId);
    const ev =
      deptCondition ?? {
        condition: null,
        confidence: null,
        point_count: 0,
        basis: {},
        reason: 'insufficient_data' as const,
      };
    const activity = deptActivity.get(deptId) ?? {
      open_count: 0,
      doing_agent_count: 0,
      activity: 'idle' as const,
    };
    return {
      id: deptId,
      legacy_name: d.legacy_name as string,
      operational_name: d.operational_name as string,
      policy_text: (d.policy_text as string | null) ?? null,
      condition: ev.condition,
      stat: boardConditions.departmentStats.get(deptId) ?? null,
      open_task_count: activity.open_count,
      activity: activity.activity,
      establishment: establishment.get(deptId) ?? null,
    };
  });

  const divCondition = boardConditions.divisions.get(id);
  const battlePlan = await fetchDivisionBattlePlan(id);

  return (
    <DrilldownShell backHref="/dabos" backLabel={BOARD_PAGE_TITLE}>
      <DivSiblingNav currentDivisionId={id} siblings={siblings} />

      <DivisionDrilldownHeader
        divisionId={id}
        operationalName={division.operational_name as string}
        description={(division.description as string | null) ?? null}
        condition={divCondition?.condition ?? latest_condition.condition}
        metricKey={metricKey}
        departments={boardDepts}
      />

      <div className="mt-8 space-y-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Division battle plan</CardTitle>
            <CardDescription>This week — secretary supervision</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{battlePlan}</CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Tasks</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dept</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        No tasks yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    tasks.map((task) => (
                      <TableRow key={task.id as string}>
                        <TableCell>
                          <Link
                            href={`/dabos/tasks/${task.id}`}
                            className="font-medium hover:text-primary"
                          >
                            {task.title as string}
                          </Link>
                        </TableCell>
                        <TableCell>{task.status as string}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {(task.department_id as string | null) ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <AppendStatForm divisionId={id as BoardDivisionId} metricKey={metricKey} />
        <CreateTaskForm defaultDivisionId={id} departments={departmentsForForm} />
      </div>
    </DrilldownShell>
  );
}

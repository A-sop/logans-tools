import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppendStatForm } from '@/components/dabos/append-stat-form';
import { CreateTaskForm } from '@/components/dabos/create-task-form';
import { ConditionBadge } from '@/components/dabos/condition-badge';
import { DivisionColumn } from '@/components/dabos/org-board/division-column';
import '@/components/dabos/org-board/org-board.css';
import { BOARD_PAGE_TITLE, type BoardDivisionId } from '@/lib/dabos/org-board-config';
import { evaluateBoardConditions } from '@/lib/dabos/queries';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { dabosConfigured, fetchDepartmentsForSelect, fetchDivision } from '@/lib/dabos/server-data';

type PageProps = { params: Promise<{ id: string }> };

export default async function DivisionPage({ params }: PageProps) {
  if (!dabosConfigured()) notFound();

  const { id } = await params;
  const data = await fetchDivision(id);
  if (!data) notFound();

  const { division, departments, tasks, latest_condition } = data;
  const metricKey = (division.primary_metric_key as string | null) ?? 'tasks_completed';
  const boardConditions = await evaluateBoardConditions();
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
    return {
      id: deptId,
      legacy_name: d.legacy_name as string,
      operational_name: d.operational_name as string,
      policy_text: (d.policy_text as string | null) ?? null,
      condition: ev.condition,
      stat: boardConditions.departmentStats.get(deptId) ?? null,
    };
  });

  const divCondition = boardConditions.divisions.get(id);
  const divStat = boardConditions.divisionStats.get(id) ?? null;

  return (
    <div className="dabos-org-board dabos-org-board--single">
      <Link href="/dabos" className="dabos-org-board__back">
        ← {BOARD_PAGE_TITLE}
      </Link>

      <DivisionColumn
        divisionId={id as BoardDivisionId}
        operationalName={division.operational_name as string}
        description={(division.description as string | null) ?? null}
        condition={divCondition?.condition ?? latest_condition.condition}
        stat={divStat}
        departments={boardDepts}
        single
      />

      <div className="mt-10 space-y-6 border-t border-border pt-8 font-sans">
        <div className="flex flex-wrap items-center gap-2 font-sans text-sm">
          <span className="text-muted-foreground">{division.operational_name as string}</span>
          <ConditionBadge
            condition={latest_condition.condition}
            confidence={latest_condition.confidence}
            reason={latest_condition.reason}
          />
          <Badge variant="secondary">{metricKey}</Badge>
        </div>

        <section className="space-y-3 font-sans">
          <h3 className="text-lg font-semibold">Tasks</h3>
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

        <AppendStatForm divisionId={id} metricKey={metricKey} />
        <CreateTaskForm defaultDivisionId={id} departments={departmentsForForm} />
      </div>
    </div>
  );
}

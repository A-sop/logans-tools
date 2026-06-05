import Link from 'next/link';
import { notFound } from 'next/navigation';

import '@/components/dabos/org-board/org-board.css';
import {
  deptBridgeLabel,
  deptNumberLabel,
  deptRoleLabel,
  divisionSecretaryLabel,
} from '@/lib/dabos/org-board-config';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { dabosConfigured, fetchDepartment } from '@/lib/dabos/server-data';

type PageProps = { params: Promise<{ id: string; deptId: string }> };

export default async function DepartmentPage({ params }: PageProps) {
  if (!dabosConfigured()) notFound();

  const { id, deptId } = await params;
  const data = await fetchDepartment(id, deptId);
  if (!data) notFound();

  const { division, department, tasks, stats } = data;
  const dept = {
    id: department.id as string,
    legacy_name: department.legacy_name as string,
    operational_name: department.operational_name as string,
  };
  const policy = (department.policy_text as string | null)?.trim();

  return (
    <div className="dabos-org-board dabos-org-board--single">
      <Link href={`/dabos/divisions/${id}`} className="dabos-org-board__back">
        ← {division.operational_name as string}
      </Link>

      <article className="dabos-org-board__column">
        <div className="dabos-org-board__column-head">
          <div className="dabos-org-board__secretary-label">
            {divisionSecretaryLabel(division.operational_name as string)}
          </div>
          <div className="dabos-org-board__division-title">{deptBridgeLabel(dept)}</div>
          <div className="dabos-org-board__division-subtitle">{deptNumberLabel(deptId)}</div>
        </div>

        <div className="dabos-org-board__body" style={{ fontSize: '0.65rem', padding: '0.75rem' }}>
          <p className="dabos-org-board__dept-block-title">{deptRoleLabel(dept)}</p>
          {policy ? <p className="mt-2">{policy}</p> : null}
        </div>
      </article>

      <div className="mt-10 space-y-6 border-t border-border pt-8 font-sans">
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Tasks</h3>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Agent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        No tasks
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
                          {(task.assigned_agent as string | null) ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Recent stats</h3>
          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
              {stats.length === 0 ? (
                <p className="text-muted-foreground">No stats logged</p>
              ) : (
                stats.map((s, i) => (
                  <p key={`${s.metric_key}-${i}`} className="tabular-nums">
                    {s.metric_key as string}: {s.value as string}{' '}
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.recorded_at as string).toLocaleString()}
                    </span>
                  </p>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

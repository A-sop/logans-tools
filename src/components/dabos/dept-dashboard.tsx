import Link from 'next/link';

import { ActivityBadge, ConditionBadge } from '@/components/dabos/condition-badge';
import {
  EstablishmentFlags,
  EstablishmentStatLine,
} from '@/components/dabos/establishment-badges';
import type { DeptEstablishment } from '@/lib/dabos/establishment';
import { Badge } from '@/components/ui/badge';
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
  deptBridgeLabel,
  deptNumberLabel,
  deptRoleLabel,
  divisionSecretaryLabel,
} from '@/lib/dabos/org-board-config';
import {
  isDemoStat,
  statSourceDescription,
  statSourceLabel,
} from '@/lib/dabos/stat-provenance';
import type { ConditionEvaluation } from '@/lib/dabos/types';

type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: number;
  type: string;
  assigned_agent: string | null;
  created_at: string;
};

type ArtifactRow = {
  id: string;
  type: string;
  summary: string;
  task_id: string | null;
  created_by: string;
  created_at: string;
};

type ReceiptRow = {
  id: string;
  agent_name: string;
  cost_eur: string | number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  created_at: string;
  task_title: string;
};

export type DeptDashboardProps = {
  divisionId: string;
  divisionName: string;
  department: {
    id: string;
    legacy_name: string;
    operational_name: string;
    policy_text: string | null;
  };
  latest_condition: ConditionEvaluation;
  battle_plan: string;
  establishment: DeptEstablishment | null;
  metric_key: string;
  last_active: string | null;
  last_role_run: string | null;
  workQueue: TaskRow[];
  investigations: TaskRow[];
  stats: {
    metric_key: string;
    value: string | number;
    recorded_at: string;
    workspace_id: string | null;
  }[];
  artifacts: ArtifactRow[];
  investigationArtifacts: ArtifactRow[];
  receipts: ReceiptRow[];
};

function TaskTable({ tasks, emptyMessage }: { tasks: TaskRow[]; emptyMessage: string }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Agent</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell>
              <Link href={`/dabos/tasks/${task.id}`} className="font-medium hover:text-primary">
                {task.title}
              </Link>
              {task.type === 'agent' ? (
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  agent
                </Badge>
              ) : null}
            </TableCell>
            <TableCell>{task.status}</TableCell>
            <TableCell className="text-muted-foreground">{task.assigned_agent ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function DeptDashboard({
  divisionId,
  divisionName,
  department,
  latest_condition,
  battle_plan,
  establishment,
  metric_key,
  last_active,
  last_role_run,
  workQueue,
  investigations,
  stats,
  artifacts,
  investigationArtifacts,
  receipts,
}: DeptDashboardProps) {
  const dept = department;
  const policy = dept.policy_text?.trim();
  const activity =
    investigations.some((t) => t.status === 'doing') ? 'investigating' : workQueue.length > 0 ? 'active' : 'idle';

  const hasDemoStats = stats.some((s) => isDemoStat(s.workspace_id));

  return (
    <div className="mt-10 space-y-6 border-t border-border pt-8 font-sans">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">
          {deptNumberLabel(dept.id)} — {deptRoleLabel(dept)}
        </h2>
        <ConditionBadge
          condition={latest_condition.working_condition ?? latest_condition.condition}
          confidence={latest_condition.confidence}
          reason={latest_condition.reason}
          statIndicated={latest_condition.stat_indicated_condition}
          climbLag={latest_condition.climb_lag}
        />
        <ActivityBadge activity={activity} />
        <Badge variant="outline">{metric_key}</Badge>
      </div>

      {hasDemoStats ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-3 text-sm text-muted-foreground">
            <strong className="text-foreground">Demo data present.</strong> Weekly{' '}
            <code className="text-xs">net_eur</code> points are synthetic from{' '}
            <code className="text-xs">npm run dabos:seed-stats</code> — not Proviso and not your bank
            account. Clear with <code className="text-xs">npm run dabos:clear-seed-stats</code>.
            Real GFP income will use <code className="text-xs">workspace_id=proviso</code> after
            monthly import.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Establishment</CardTitle>
          <CardDescription>
            E3 checklist{establishment?.checked_at ? ` — as of ${establishment.checked_at}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <EstablishmentFlags establishment={establishment} />
          <div>
            <EstablishmentStatLine establishment={establishment} />
          </div>
          {establishment?.comm_line ? (
            <p className="text-xs text-muted-foreground">
              Comm line: {establishment.comm_line}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Battle plan</CardTitle>
            <CardDescription>This week</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{battle_plan}</CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Primary stats</CardTitle>
            <CardDescription>Source labeled per row</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {stats.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No stats logged</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.slice(0, 8).map((s, i) => (
                    <TableRow key={`${s.metric_key}-${i}`}>
                      <TableCell className="text-xs font-medium">{s.metric_key}</TableCell>
                      <TableCell className="tabular-nums text-xs">{s.value}</TableCell>
                      <TableCell className="text-xs text-muted-foreground" title={statSourceDescription(s.workspace_id)}>
                        {statSourceLabel(s.workspace_id)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hat</CardTitle>
            <CardDescription>{divisionSecretaryLabel(divisionName)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{deptBridgeLabel(dept)}</span>
            </p>
            {policy ? <p>{policy}</p> : <p>No policy_text seeded.</p>}
            <p className="text-xs">
              Last active: {formatWhen(last_active)}
              {last_role_run ? ` · Hat run: ${formatWhen(last_role_run)}` : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h3 className="text-base font-semibold">Work queue</h3>
          <Card>
            <CardContent className="p-0 pt-0">
              <TaskTable tasks={workQueue} emptyMessage="No open tasks — hat idle until work assigned." />
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold">Investigations</h3>
          <Card>
            <CardContent className="space-y-4 p-4">
              <TaskTable
                tasks={investigations.filter((t) => ['todo', 'doing', 'blocked'].includes(t.status))}
                emptyMessage="No active agent investigations."
              />
              {investigationArtifacts.length > 0 ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Artifacts</p>
                  <ul className="space-y-2 text-sm">
                    {investigationArtifacts.slice(0, 8).map((a) => (
                      <li key={a.id}>
                        <Link
                          href={`/dabos/artifacts/${a.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {a.type}
                        </Link>
                        <span className="text-muted-foreground"> — {a.summary}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>

      {artifacts.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-base font-semibold">Department artifacts</h3>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {artifacts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Link href={`/dabos/artifacts/${a.id}`} className="hover:text-primary">
                          {a.type}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-md truncate">{a.summary}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {receipts.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-base font-semibold">Recent receipts</h3>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.agent_name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.task_title}</TableCell>
                      <TableCell className="tabular-nums">
                        {r.cost_eur != null ? `€${r.cost_eur}` : '—'}
                        {r.tokens_input != null ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({r.tokens_input}+{r.tokens_output ?? 0} tok)
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Division:{' '}
        <Link href={`/dabos/divisions/${divisionId}`} className="hover:text-primary">
          {divisionName}
        </Link>
      </p>
    </div>
  );
}

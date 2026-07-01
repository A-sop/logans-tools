import { notFound } from 'next/navigation';

import { DeptDashboard } from '@/components/dabos/dept-dashboard';
import { DrilldownShell } from '@/components/dabos/division-drilldown';
import { deptRoleLabel } from '@/lib/dabos/org-board-config';
import { dabosConfigured, fetchDepartmentDashboard } from '@/lib/dabos/server-data';

type PageProps = { params: Promise<{ id: string; deptId: string }> };

export default async function DepartmentPage({ params }: PageProps) {
  if (!dabosConfigured()) notFound();

  const { id, deptId } = await params;
  const data = await fetchDepartmentDashboard(id, deptId);
  if (!data) notFound();

  const { division, department } = data;
  const dept = {
    id: department.id as string,
    legacy_name: department.legacy_name as string,
    operational_name: department.operational_name as string,
    policy_text: (department.policy_text as string | null) ?? null,
  };

  return (
    <DrilldownShell
      backHref={`/dabos/divisions/${id}`}
      backLabel={division.operational_name as string}
    >
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {dept.id}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{deptRoleLabel(dept)}</h1>
        <p className="text-sm text-muted-foreground">{dept.legacy_name}</p>
      </header>

      <DeptDashboard
        divisionId={id}
        divisionName={division.operational_name as string}
        department={dept}
        latest_condition={data.latest_condition}
        battle_plan={data.battle_plan}
        metric_key={data.metric_key}
        last_active={data.last_active}
        last_role_run={data.last_role_run}
        workQueue={data.workQueue.map((t) => ({
          id: t.id as string,
          title: t.title as string,
          status: t.status as string,
          priority: t.priority as number,
          type: t.type as string,
          assigned_agent: (t.assigned_agent as string | null) ?? null,
          created_at: (t.created_at as Date).toISOString(),
        }))}
        investigations={data.investigations.map((t) => ({
          id: t.id as string,
          title: t.title as string,
          status: t.status as string,
          priority: t.priority as number,
          type: t.type as string,
          assigned_agent: (t.assigned_agent as string | null) ?? null,
          created_at: (t.created_at as Date).toISOString(),
        }))}
        stats={data.stats.map((s) => ({
          metric_key: s.metric_key as string,
          value: s.value as string | number,
          recorded_at: (s.recorded_at as Date).toISOString(),
          workspace_id: (s.workspace_id as string | null) ?? null,
        }))}
        artifacts={data.artifacts.map((a) => ({
          id: a.id as string,
          type: a.type as string,
          summary: a.summary as string,
          task_id: (a.task_id as string | null) ?? null,
          created_by: a.created_by as string,
          created_at: (a.created_at as Date).toISOString(),
        }))}
        investigationArtifacts={data.investigationArtifacts.map((a) => ({
          id: a.id as string,
          type: a.type as string,
          summary: a.summary as string,
          task_id: (a.task_id as string | null) ?? null,
          created_by: 'agent',
          created_at: (a.created_at as Date).toISOString(),
        }))}
        receipts={data.receipts.map((r) => ({
          id: r.id as string,
          agent_name: r.agent_name as string,
          cost_eur: r.cost_eur as string | number | null,
          tokens_input: r.tokens_input as number | null,
          tokens_output: r.tokens_output as number | null,
          created_at: (r.created_at as Date).toISOString(),
          task_title: r.task_title as string,
        }))}
      />
    </DrilldownShell>
  );
}

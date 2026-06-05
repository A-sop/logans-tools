import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DeepJsonBlock } from '@/components/dabos/deep-json-block';
import { TaskActions } from '@/components/dabos/task-actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dabosConfigured, fetchTask } from '@/lib/dabos/server-data';

type PageProps = { params: Promise<{ id: string }> };

export default async function TaskPage({ params }: PageProps) {
  if (!dabosConfigured()) notFound();

  const { id } = await params;
  const data = await fetchTask(id);
  if (!data) notFound();

  const { task, artifacts, cost_events, division, department } = data;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/dabos/divisions/${task.division_id as string}`}
          className="text-sm text-muted-foreground hover:text-primary"
        >
          ← {division?.operational_name as string}
        </Link>
        <h2 className="mt-2 text-xl font-semibold">{task.title as string}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge>{task.status as string}</Badge>
          {task.assigned_agent ? <Badge variant="secondary">{task.assigned_agent as string}</Badge> : null}
        </div>
        {task.description ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
            {task.description as string}
          </p>
        ) : null}
        {department ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {task.department_id as string} — {department.legacy_name as string}
          </p>
        ) : null}
      </div>

      <TaskActions taskId={id} status={task.status as string} />

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Artifacts</h3>
        {artifacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No artifacts yet — run Research to create one.</p>
        ) : (
          <div className="space-y-3">
            {artifacts.map((a) => (
              <Card key={a.id as string}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    <Link href={`/dabos/artifacts/${a.id}`} className="hover:text-primary">
                      {a.type as string} — {new Date(a.created_at as string).toLocaleString()}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-6 whitespace-pre-wrap text-sm">{a.summary as string}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Cost events</h3>
        {cost_events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cost events</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {cost_events.map((c) => (
              <li key={c.id as string} className="rounded-md border border-border px-3 py-2">
                {c.provider as string} · in {c.tokens_input ?? 0} / out {c.tokens_output ?? 0}
                {c.cost_eur != null ? ` · €${c.cost_eur}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <DeepJsonBlock label="Task" data={task} />
    </div>
  );
}

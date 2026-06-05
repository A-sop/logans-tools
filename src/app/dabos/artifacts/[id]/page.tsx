import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DeepJsonBlock } from '@/components/dabos/deep-json-block';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dabosConfigured, fetchArtifact, fetchTask } from '@/lib/dabos/server-data';

type PageProps = { params: Promise<{ id: string }> };

export default async function ArtifactPage({ params }: PageProps) {
  if (!dabosConfigured()) notFound();

  const { id } = await params;
  const artifact = await fetchArtifact(id);
  if (!artifact) notFound();

  let taskLink = null;
  if (artifact.task_id) {
    const taskData = await fetchTask(artifact.task_id as string);
    if (taskData) {
      taskLink = {
        id: artifact.task_id as string,
        title: taskData.task.title as string,
      };
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dabos" className="text-sm text-muted-foreground hover:text-primary">
          ← DABOS
        </Link>
        <h2 className="mt-2 text-xl font-semibold">{artifact.type as string} artifact</h2>
        <p className="text-xs text-muted-foreground">
          {new Date(artifact.created_at as string).toLocaleString()} · by{' '}
          {artifact.created_by as string}
        </p>
        {taskLink ? (
          <p className="mt-2 text-sm">
            Task:{' '}
            <Link href={`/dabos/tasks/${taskLink.id}`} className="font-medium hover:text-primary">
              {taskLink.title}
            </Link>
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap dark:prose-invert">
            {artifact.summary as string}
          </div>
        </CardContent>
      </Card>

      <DeepJsonBlock label="Artifact" data={artifact} />
    </div>
  );
}

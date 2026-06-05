'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

export function TaskActions({ taskId, status }: { taskId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patchStatus(next: string) {
    setLoading(next);
    setError(null);
    try {
      const res = await fetch(`/api/dabos/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Update failed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(null);
    }
  }

  async function runResearch() {
    setLoading('research');
    setError(null);
    try {
      const res = await fetch(`/api/dabos/tasks/${taskId}/run-research`, { method: 'POST' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Research failed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== 'doing' && status !== 'done' ? (
        <Button
          type="button"
          size="sm"
          disabled={!!loading}
          onClick={() => patchStatus('doing')}
        >
          Start
        </Button>
      ) : null}
      {status !== 'done' ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!!loading}
          onClick={runResearch}
        >
          {loading === 'research' ? 'Running research…' : 'Run Research'}
        </Button>
      ) : null}
      {status !== 'done' && status !== 'cancelled' ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!!loading}
          onClick={() => patchStatus('done')}
        >
          Mark done
        </Button>
      ) : null}
      {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

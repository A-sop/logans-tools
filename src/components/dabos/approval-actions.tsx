'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

export function ApprovalActions({
  approvalId,
  status,
}: {
  approvalId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status !== 'pending') return null;

  async function decide(action: 'approve' | 'reject') {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/dabos/tier0/approvals/${approvalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, decided_by: 'founder' }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? 'Decision failed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decision failed');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!!loading}
          onClick={() => decide('approve')}
        >
          {loading === 'approve' ? 'Saving…' : 'Yes — approve'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!!loading}
          onClick={() => decide('reject')}
        >
          {loading === 'reject' ? 'Saving…' : 'No — reject'}
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AppendStatForm({
  divisionId,
  metricKey,
}: {
  divisionId: string;
  metricKey: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number.parseFloat(value);
    if (!Number.isFinite(num)) return;
    setLoading(true);
    setMessage(null);
    try {
      const day = new Date().toISOString().slice(0, 10);
      const res = await fetch('/api/dabos/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: `manual-${day}-${divisionId}-${metricKey}`,
          division_id: divisionId,
          metric_key: metricKey,
          value: num,
          basis: note.trim() || 'manual board append',
          recorded_by: 'board-ui',
          mode: 'insert_always',
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setValue('');
      setNote('');
      setMessage('Stat recorded');
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor={`stat-${divisionId}`} className="text-xs">
          Append {metricKey}
        </Label>
        <Input
          id={`stat-${divisionId}`}
          type="number"
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 w-32"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`stat-note-${divisionId}`} className="text-xs">
          Basis note
        </Label>
        <Input
          id={`stat-note-${divisionId}`}
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="source / why"
          className="h-9 w-48"
        />
      </div>
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? 'Saving…' : 'Add stat'}
      </Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </form>
  );
}

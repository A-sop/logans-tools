'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type DeptOption = {
  id: string;
  division_id: string;
  label: string;
};

export function CreateTaskForm({
  defaultDivisionId,
  departments,
}: {
  defaultDivisionId?: string;
  departments: DeptOption[];
}) {
  const router = useRouter();
  const [divisionId, setDivisionId] = useState(defaultDivisionId ?? 'Div1');
  const [departmentId, setDepartmentId] = useState<string>('none');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredDepts = departments.filter((d) => d.division_id === divisionId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dabos/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          division_id: divisionId,
          department_id: departmentId === 'none' ? null : departmentId,
          title,
          description: description || null,
          type: 'agent',
          assigned_agent: 'research',
        }),
      });
      const data = (await res.json()) as { task?: { id: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to create task');
      router.push(`/dabos/tasks/${data.task!.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6">
      <h2 className="text-base font-semibold">New task</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="division">Division</Label>
          <Select value={divisionId} onValueChange={setDivisionId}>
            <SelectTrigger id="division">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['Div1', 'Div2', 'Div3', 'Div4', 'Div5', 'Div6', 'Div7'].map((id) => (
                <SelectItem key={id} value={id}>
                  {id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="department">Department</Label>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger id="department">
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {filteredDepts.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={loading || !title.trim()}>
        {loading ? 'Creating…' : 'Create task'}
      </Button>
    </form>
  );
}

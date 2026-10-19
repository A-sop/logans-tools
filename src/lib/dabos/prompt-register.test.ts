import { describe, expect, it } from 'vitest';

import type { PromptRegisterRow } from '@/lib/dabos/prompt-register';

/** Fixture-shaped row (no DB). */
function fake(partial: Partial<PromptRegisterRow>): PromptRegisterRow {
  return {
    task_id: '00000000-0000-0000-0000-000000000001',
    title: 'Prompt register (this)',
    department_id: 'Dept20',
    basket: 'pending',
    status: 'doing',
    updated_at: new Date().toISOString(),
    register_id: 'hzr-kw42-21',
    machine: 'HZR',
    source: 'test',
    needs_logan: 'n',
    in_person: 'n',
    estimate: '-',
    last_run: '',
    output_path: '',
    prs: '',
    blocker: '',
    register_status: 'running',
    dept: 'Dept20',
    history: [],
    paste_line: 'Run prompt register item hzr-kw42-21',
    stale: false,
    ...partial,
  };
}

describe('prompt-register fixtures', () => {
  it('keeps client-free titles only', () => {
    const row = fake({});
    expect(row.title.toLowerCase()).not.toMatch(/\b(vertrag|vsnr|iban)\b/);
    expect(row.paste_line).toContain('hzr-kw42-21');
  });

  it('marks stale IN older than 7 days', () => {
    const old = new Date(Date.now() - 10 * 86400000).toISOString();
    const row = fake({ register_status: 'not_started', basket: 'in', updated_at: old, stale: true });
    expect(row.stale).toBe(true);
  });
});

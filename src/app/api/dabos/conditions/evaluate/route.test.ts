import { beforeEach, describe, expect, it, vi } from 'vitest';

import { conditionSeverity, type ConditionLabel } from '@/lib/dabos/condition-ladder';
import type { ConditionSource } from '@/lib/dabos/founder-rulings';

/** Route-level tests for the upgrade gate on POST /api/dabos/conditions/evaluate. */

type Existing = { working_condition: ConditionLabel; condition_source: ConditionSource } | 'missing-table' | null;

const db: {
  existing: Existing;
  stats: number[];
  stateWrites: { working_condition: ConditionLabel }[];
  conditionWrites: string[];
} = { existing: null, stats: [], stateWrites: [], conditionWrites: [] };

function fakeSql(strings: TemplateStringsArray, ...values: unknown[]) {
  const q = strings.join('?').replace(/\s+/g, ' ');
  if (q.includes('FROM stats')) return Promise.resolve(db.stats.map((value) => ({ value })));
  if (q.includes('FROM entity_condition_state')) {
    if (db.existing === 'missing-table') {
      return Promise.reject(new Error('relation "entity_condition_state" does not exist'));
    }
    if (!db.existing) return Promise.resolve([]);
    return Promise.resolve([
      {
        entity_type: 'department',
        entity_id: 'Dept10',
        working_condition: db.existing.working_condition,
        stat_indicated_condition: null,
        stat_indicated_at: null,
        danger_why: null,
        updated_at: new Date(),
        condition_source: db.existing.condition_source,
      },
    ]);
  }
  if (q.includes('INSERT INTO entity_condition_state')) {
    db.stateWrites.push({ working_condition: values[2] as ConditionLabel });
    return Promise.resolve([]);
  }
  if (q.includes('INSERT INTO conditions')) {
    db.conditionWrites.push(values[2] as string);
    return Promise.resolve([]);
  }
  return Promise.resolve([]);
}

vi.mock('@/lib/dabos/clerk-auth', () => ({
  requireDabosAuth: vi.fn().mockResolvedValue({ userId: 'test-user' }),
}));
vi.mock('@/lib/dabos/db', () => ({
  getDabosSql: vi.fn(() => fakeSql),
  hasDabosDb: vi.fn(() => true),
}));

import { POST } from './route';

const RISING = [1, 2, 4, 8, 16, 32];
const FALLING = [32, 16, 8, 4, 2, 1];

async function evaluate() {
  const res = await POST(
    new Request('http://localhost/api/dabos/conditions/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: 'department', entity_id: 'Dept10', metric_key: 'x' }),
    })
  );
  expect(res.status).toBe(200);
  return (await res.json()) as {
    working_condition: ConditionLabel | null;
    condition: ConditionLabel | null;
    stat_indicated_condition: ConditionLabel | null;
  };
}

describe('POST /api/dabos/conditions/evaluate - upgrade gate', () => {
  beforeEach(() => {
    db.existing = null;
    db.stats = [];
    db.stateWrites = [];
    db.conditionWrites = [];
  });

  it('blocks a raise when the stored condition is computed (no founder ruling)', async () => {
    db.existing = { working_condition: 'Danger', condition_source: 'computed' };
    db.stats = RISING;
    const body = await evaluate();
    expect(conditionSeverity(body.stat_indicated_condition!)).toBeLessThan(conditionSeverity('Danger'));
    expect(body.working_condition).toBe('Danger');
    expect(db.stateWrites).toEqual([{ working_condition: 'Danger' }]);
    expect(db.conditionWrites).toEqual(['Danger']);
  });

  it('blocks a raise from a formula row too', async () => {
    db.existing = { working_condition: 'Emergency', condition_source: 'formula' };
    db.stats = RISING;
    const body = await evaluate();
    expect(body.working_condition).toBe('Emergency');
    expect(db.conditionWrites).toEqual(['Emergency']);
  });

  it('keeps a founder-ruled Confusion when the stat jumps', async () => {
    db.existing = { working_condition: 'Confusion', condition_source: 'founder_ruling' };
    db.stats = RISING;
    const body = await evaluate();
    expect(body.working_condition).toBe('Confusion');
  });

  it('lets a downgrade through', async () => {
    db.existing = { working_condition: 'Normal', condition_source: 'computed' };
    db.stats = FALLING;
    const body = await evaluate();
    const stat = body.stat_indicated_condition!;
    expect(conditionSeverity(stat)).toBeGreaterThan(conditionSeverity('Normal'));
    expect(body.working_condition).toBe(stat);
    expect(db.stateWrites).toEqual([{ working_condition: stat }]);
    expect(db.conditionWrites).toEqual([stat]);
  });

  it('raw-stat fallback (state table unreadable) never sets or persists a condition', async () => {
    db.existing = 'missing-table';
    db.stats = RISING;
    const body = await evaluate();
    expect(body.stat_indicated_condition).not.toBeNull();
    expect(body.working_condition).toBeNull();
    expect(body.condition).toBeNull();
    expect(db.conditionWrites).toEqual([]);
  });

  it('raw-stat fallback does not persist a worse stat either (suggestion only)', async () => {
    db.existing = 'missing-table';
    db.stats = FALLING;
    const body = await evaluate();
    expect(body.working_condition).toBeNull();
    expect(db.conditionWrites).toEqual([]);
  });
});
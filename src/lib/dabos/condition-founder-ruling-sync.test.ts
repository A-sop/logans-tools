import { describe, expect, it } from 'vitest';

import { syncEntityConditionFromEvaluation } from '@/lib/dabos/condition-state-queries';
import type { ConditionEvaluation } from '@/lib/dabos/types';
import type { DabosSql } from '@/lib/dabos/dabos-connection';

function fakeSql(existing: Record<string, unknown> | null) {
  const writes: { text: string; values: unknown[] }[] = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?');
    if (/^\s*SELECT/i.test(text)) return Promise.resolve(existing ? [existing] : []);
    writes.push({ text, values });
    return Promise.resolve([]);
  }) as unknown as DabosSql;
  return { sql, writes };
}

const evaluation = {
  condition: 'Non-Existence',
  working_condition: 'Non-Existence',
  stat_indicated_condition: 'Non-Existence',
  confidence: 'high',
  basis: {},
} as unknown as ConditionEvaluation;

describe('week-close condition sync respects founder rulings', () => {
  it('keeps and reports a founder-ruled Confusion when the stat suggests Non-Existence', async () => {
    const { sql, writes } = fakeSql({
      entity_type: 'division',
      entity_id: 'Div2',
      working_condition: 'Confusion',
      stat_indicated_condition: null,
      stat_indicated_at: null,
      danger_why: null,
      updated_at: new Date(),
      condition_source: 'founder_ruling',
    });
    const merged = await syncEntityConditionFromEvaluation(sql, 'division', 'Div2', evaluation);
    expect(merged.working_condition).toBe('Confusion');
    expect(merged.condition).toBe('Confusion');
    expect(merged.stat_indicated_condition).toBe('Non-Existence');

    // The condition_source upsert must keep founder_ruling: it writes the ruled
    // condition, never sets condition_source, and guards working_condition on conflict.
    expect(writes).toHaveLength(1);
    const [upsert] = writes;
    expect(upsert.values).toContain('Confusion');
    expect(upsert.text).not.toMatch(/(SET|,)\s*condition_source\s*=/i);
    expect(upsert.text).not.toMatch(/INSERT INTO entity_condition_state \([^)]*condition_source/i);
    expect(upsert.text).toMatch(/CASE WHEN entity_condition_state\.condition_source = 'founder_ruling'\s+THEN entity_condition_state\.working_condition/);
  });

  it('still lowers a computed condition when the stat is worse', async () => {
    const { sql } = fakeSql({
      entity_type: 'division',
      entity_id: 'Div2',
      working_condition: 'Normal',
      stat_indicated_condition: null,
      stat_indicated_at: null,
      danger_why: null,
      updated_at: new Date(),
      condition_source: 'computed',
    });
    const merged = await syncEntityConditionFromEvaluation(sql, 'division', 'Div2', evaluation);
    expect(merged.working_condition).toBe('Non-Existence');
  });
});

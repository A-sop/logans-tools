import { describe, expect, it } from 'vitest';

import { conditionFromStatTrend, conditionSeverity } from '@/lib/dabos/condition-ladder';
import { evaluateConditionFromPoints } from '@/lib/dabos/conditions';

describe('conditionFromStatTrend', () => {
  it('maps strong growth to Power Change', () => {
    expect(conditionFromStatTrend([10, 11, 12, 18, 20, 22])).toBe('Power Change');
  });

  it('maps flat band to Normal', () => {
    expect(conditionFromStatTrend([10, 10.2, 9.9, 10.1, 10, 10.05])).toBe('Normal');
  });

  it('maps sharp decline to Non-Existence', () => {
    expect(conditionFromStatTrend([100, 95, 90, 40, 35, 30])).toBe('Non-Existence');
  });
});

describe('evaluateConditionFromPoints', () => {
  it('requires at least 3 points', () => {
    const ev = evaluateConditionFromPoints([1, 2], {
      entity_type: 'division',
      entity_id: 'Div1',
      metric_key: 'test',
      window_days: 7,
    });
    expect(ev.condition).toBeNull();
    expect(ev.reason).toBe('insufficient_data');
  });

  it('records PRD-004 rule in basis', () => {
    const ev = evaluateConditionFromPoints([10, 10, 10, 10, 10, 10], {
      entity_type: 'division',
      entity_id: 'Div1',
      metric_key: 'test',
      window_days: 7,
    });
    expect(ev.condition).toBe('Normal');
    expect(ev.basis.rule).toContain('PRD-004');
  });
});

describe('conditionSeverity', () => {
  it('orders worst-wins correctly', () => {
    expect(conditionSeverity('Non-Existence')).toBeGreaterThan(conditionSeverity('Normal'));
    expect(conditionSeverity('Power Change')).toBeLessThan(conditionSeverity('Danger'));
  });
});

import { describe, expect, it } from 'vitest';

import { conditionFromStatTrend, conditionSeverity } from '@/lib/dabos/condition-ladder';
import { evaluateConditionFromPoints } from '@/lib/dabos/conditions';

describe('conditionFromStatTrend', () => {
  it('maps strong growth to Power Change', () => {
    expect(conditionFromStatTrend([10, 11, 12, 18, 20, 22])).toBe('Power Change');
  });

  it('maps flat non-zero band to Normal', () => {
    expect(conditionFromStatTrend([10, 10.2, 9.9, 10.1, 10, 10.05])).toBe('Normal');
  });

  it('maps flat absolute-zero series to Non-Existence (not Normal)', () => {
    expect(conditionFromStatTrend([0, 0, 0, 0, 0, 0])).toBe('Non-Existence');
  });

  it('maps sharp decline to Non-Existence', () => {
    expect(conditionFromStatTrend([100, 95, 90, 40, 35, 30])).toBe('Non-Existence');
  });
});


describe('evaluateConditionFromPoints', () => {
  it('maps fewer than 3 points to indicated Non-Existence (no blanks)', () => {
    const ev = evaluateConditionFromPoints([1, 2], {
      entity_type: 'division',
      entity_id: 'Div1',
      metric_key: 'test',
      window_days: 7,
    });
    expect(ev.stat_indicated_condition).toBe('Non-Existence');
    expect(ev.condition).toBe('Non-Existence');
    expect(ev.reason).toBe('insufficient_data');
  });

  it('records PRD-004 rule in basis for flat non-zero', () => {
    const ev = evaluateConditionFromPoints([10, 10, 10, 10, 10, 10], {
      entity_type: 'division',
      entity_id: 'Div1',
      metric_key: 'test',
      window_days: 7,
    });
    expect(ev.stat_indicated_condition).toBe('Normal');
    expect(ev.condition).toBe('Normal');
    expect(ev.basis.rule).toContain('PRD-004');
  });

  it('indicates Non-Existence for flat absolute-zero production', () => {
    const ev = evaluateConditionFromPoints([0, 0, 0, 0, 0, 0], {
      entity_type: 'division',
      entity_id: 'Div2',
      metric_key: 'content_pieces_shipped',
      window_days: 7,
    });
    expect(ev.stat_indicated_condition).toBe('Non-Existence');
    expect(ev.condition).toBe('Non-Existence');
    expect(String(ev.basis.rule)).toMatch(/flat absolute-zero/i);
  });
});


describe('conditionSeverity', () => {
  it('orders worst-wins correctly', () => {
    expect(conditionSeverity('Non-Existence')).toBeGreaterThan(conditionSeverity('Normal'));
    expect(conditionSeverity('Power Change')).toBeLessThan(conditionSeverity('Danger'));
  });
});

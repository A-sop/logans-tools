import { describe, expect, it } from 'vitest';

import { worstWinsRollup } from '@/lib/dabos/executive-rollup';
import { percentileRank, percentileSeries } from '@/lib/dabos/percentile';
import type { ConditionEvaluation } from '@/lib/dabos/types';

describe('percentile', () => {
  it('returns two decimal places', () => {
    expect(percentileRank(5, [1, 2, 3, 4, 5, 6, 7])).toBe(64.29);
  });

  it('builds cumulative percentile series', () => {
    expect(percentileSeries([10, 20, 30])).toEqual([50, 75, 83.33]);
  });
});

describe('executive rollup', () => {
  const normal: ConditionEvaluation = {
    condition: 'Normal',
    confidence: 0.9,
    point_count: 5,
    basis: {},
  };
  const danger: ConditionEvaluation = {
    condition: 'Danger',
    confidence: 0.9,
    point_count: 5,
    basis: {},
  };

  it('worst-wins among child conditions', () => {
    const map = new Map([
      ['Div1', normal],
      ['Div2', danger],
    ]);
    const pct = new Map([
      ['Div1', 80],
      ['Div2', 22.5],
    ]);
    const rollup = worstWinsRollup(['Div1', 'Div2'], map, pct, {
      rollup_id: 'test',
      rollup_label: 'Test',
    });
    expect(rollup.condition.condition).toBe('Danger');
    expect(rollup.percentile).toBe(22.5);
  });
});

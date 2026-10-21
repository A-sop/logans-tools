import { describe, expect, it } from 'vitest';

import { conditionSeverity, isConditionLabel, nextBetterCondition } from '@/lib/dabos/condition-ladder';
import { syncWorkingCondition } from '@/lib/dabos/condition-state';
import { FOUNDER_RULING_PRESETS, resolveWorkingWithOverride } from '@/lib/dabos/founder-rulings';

describe('lower conditions + founder ruling', () => {
  it('orders lower conditions below Non-Existence', () => {
    expect(conditionSeverity('Confusion')).toBeGreaterThan(conditionSeverity('Treason'));
    expect(conditionSeverity('Liability')).toBeGreaterThan(conditionSeverity('Non-Existence'));
    expect(nextBetterCondition('Confusion')).toBe('Treason');
    expect(nextBetterCondition('Liability')).toBe('Non-Existence');
    expect(isConditionLabel('Doubt')).toBe(true);
  });
  it('stat refresh never lifts a ruled Confusion', () => {
    expect(syncWorkingCondition('Confusion', 'Power')).toBe('Confusion');
  });
  it('founder ruling takes precedence over computed', () => {
    expect(
      resolveWorkingWithOverride('Normal', { working_condition: 'Confusion', condition_source: 'founder_ruling' })
    ).toBe('Confusion');
    expect(resolveWorkingWithOverride('Normal', { working_condition: 'Danger', condition_source: 'computed' })).toBe('Normal');
  });
  it('16 Oct preset covers Dept1-21 in Confusion', () => {
    const p = FOUNDER_RULING_PRESETS['2026-10-16-confusion']!;
    expect(p.entity_ids).toHaveLength(21);
    expect(p.condition).toBe('Confusion');
  });
});

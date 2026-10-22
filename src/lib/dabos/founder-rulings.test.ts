import { describe, expect, it } from 'vitest';

import { conditionSeverity, isConditionLabel, nextBetterCondition } from '@/lib/dabos/condition-ladder';
import { syncWorkingCondition } from '@/lib/dabos/condition-state';
import {
  FOUNDER_RULING_PRESETS,
  FounderGoAheadRequiredError,
  guardNoUnauthorisedUpgrade,
  requireFounderGoAhead,
  resolveWorkingWithOverride,
} from '@/lib/dabos/founder-rulings';

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

describe('upgrade gate (founder ruling 2026-10-22)', () => {
  it('blocks a raise from a computed or formula row', () => {
    expect(guardNoUnauthorisedUpgrade('Confusion', 'Non-Existence', 'computed')).toBe('Confusion');
    expect(guardNoUnauthorisedUpgrade('Emergency', 'Normal', 'formula')).toBe('Emergency');
    expect(guardNoUnauthorisedUpgrade('Danger', 'Power', null)).toBe('Danger');
  });
  it('lets downgrades and same-rung writes through', () => {
    expect(guardNoUnauthorisedUpgrade('Normal', 'Danger', 'computed')).toBe('Danger');
    expect(guardNoUnauthorisedUpgrade('Confusion', 'Confusion', 'founder_ruling')).toBe('Confusion');
  });
  it('allows a raise only when a founder_ruling row authorises it', () => {
    expect(guardNoUnauthorisedUpgrade('Emergency', 'Normal', 'founder_ruling')).toBe('Normal');
  });
  it('a stat jump cannot lift a founder-ruled Confusion through sync', () => {
    const existing = { working_condition: 'Confusion' as const, condition_source: 'founder_ruling' as const };
    const resolved = resolveWorkingWithOverride(syncWorkingCondition('Confusion', 'Power'), existing);
    expect(guardNoUnauthorisedUpgrade('Confusion', resolved, 'founder_ruling')).toBe('Confusion');
  });
  it('no prior row: proposed passes (default path)', () => {
    expect(guardNoUnauthorisedUpgrade(null, 'Non-Existence')).toBe('Non-Existence');
  });
});

describe('formula advance needs founder go-ahead (upgrade gate)', () => {
  it('refuses with a clear error when no go-ahead exists', () => {
    expect(() => requireFounderGoAhead('department', 'Dept8', 'Treason', [])).toThrow(
      FounderGoAheadRequiredError
    );
    expect(() => requireFounderGoAhead('department', 'Dept8', 'Treason', [])).toThrow(
      /cannot move up to Treason without a written founder go-ahead/
    );
  });
  it('refuses a go-ahead for a different rung or without a reference', () => {
    expect(() =>
      requireFounderGoAhead('department', 'Dept8', 'Treason', [
        { condition_label: 'Enemy', ruling_ref: 'receipt.md' },
        { condition_label: 'Treason', ruling_ref: '  ' },
      ])
    ).toThrow(FounderGoAheadRequiredError);
  });
  it('returns the ruling reference when the go-ahead matches the rung', () => {
    expect(
      requireFounderGoAhead('department', 'Dept8', 'Treason', [
        { condition_label: 'Treason', ruling_ref: 'DABOS:receipts/go-ahead-dept8.md' },
      ])
    ).toBe('DABOS:receipts/go-ahead-dept8.md');
  });
});

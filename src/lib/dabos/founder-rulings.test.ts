import { describe, expect, it } from 'vitest';

import { conditionSeverity, isConditionLabel, nextBetterCondition } from '@/lib/dabos/condition-ladder';
import { syncWorkingCondition } from '@/lib/dabos/condition-state';
import {
  FOUNDER_RULING_PRESETS,
  guardNoUnauthorisedUpgrade,
  isAssignedSource,
  resolveWorkingWithOverride,
} from '@/lib/dabos/founder-rulings';
import { planAssignment } from '../../../scripts/dabos/apply-founder-ruling';

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

describe('one assignment rule (founder ruling 2026-10-22 22:31)', () => {
  it('a Dept19 + Ethics assignment overrides computed on any rung', () => {
    expect(isAssignedSource('dept19_ethics')).toBe(true);
    expect(isAssignedSource('computed')).toBe(false);
    expect(resolveWorkingWithOverride('Normal', { working_condition: 'Doubt', condition_source: 'dept19_ethics' })).toBe('Doubt');
    expect(resolveWorkingWithOverride('Normal', { working_condition: 'Power Change', condition_source: 'dept19_ethics' })).toBe('Power Change');
  });
  it('stat sync cannot lift a Dept19 + Ethics assignment, and the gate still blocks the raise', () => {
    const existing = { working_condition: 'Enemy' as const, condition_source: 'dept19_ethics' as const };
    const resolved = resolveWorkingWithOverride(syncWorkingCondition('Enemy', 'Power'), existing);
    expect(guardNoUnauthorisedUpgrade('Enemy', resolved, 'dept19_ethics')).toBe('Enemy');
    expect(guardNoUnauthorisedUpgrade('Enemy', 'Normal', 'dept19_ethics')).toBe('Enemy');
  });
});

describe('planAssignment (apply script)', () => {
  it('founder override always applies', () => {
    expect(planAssignment('founder', 'Confusion', 'Power', null)).toEqual({ ok: true, source: 'founder_ruling' });
  });
  it('Dept19 + Ethics: downgrade or same rung applies on any rung', () => {
    expect(planAssignment('dept19_ethics', 'Normal', 'Treason', null)).toEqual({ ok: true, source: 'dept19_ethics' });
    expect(planAssignment('dept19_ethics', null, 'Liability', null)).toEqual({ ok: true, source: 'dept19_ethics' });
  });
  it('Dept19 + Ethics: upgrade refused without the founder go-ahead, recorded as founder_ruling with it', () => {
    expect(planAssignment('dept19_ethics', 'Confusion', 'Treason', null).ok).toBe(false);
    expect(planAssignment('dept19_ethics', 'Confusion', 'Treason', 'receipt.md')).toEqual({ ok: true, source: 'founder_ruling' });
  });
});
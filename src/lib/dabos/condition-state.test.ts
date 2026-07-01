import { describe, expect, it } from 'vitest';

import {
  advanceWorkingOneRung,
  canAdvanceWorking,
  DEFAULT_WORKING_CONDITION,
  hasClimbLag,
  rungsToClimb,
  syncWorkingCondition,
} from '@/lib/dabos/condition-state';

describe('syncWorkingCondition', () => {
  it('defaults to Non-Existence when no prior working', () => {
    expect(syncWorkingCondition(null, 'Normal')).toBe(DEFAULT_WORKING_CONDITION);
  });

  it('drops working when stat gets worse', () => {
    expect(syncWorkingCondition('Normal', 'Emergency')).toBe('Emergency');
    expect(syncWorkingCondition('Emergency', 'Danger')).toBe('Danger');
  });

  it('never auto-improves working when stat gets better', () => {
    expect(syncWorkingCondition('Emergency', 'Affluence')).toBe('Emergency');
    expect(syncWorkingCondition('Non-Existence', 'Power')).toBe('Non-Existence');
  });
});

describe('hasClimbLag / rungsToClimb', () => {
  it('detects stat ahead of working', () => {
    expect(hasClimbLag('Emergency', 'Normal')).toBe(true);
    expect(hasClimbLag('Emergency', 'Emergency')).toBe(false);
    expect(rungsToClimb('Emergency', 'Normal')).toBe(1);
    expect(rungsToClimb('Emergency', 'Affluence')).toBe(2);
  });
});

describe('advanceWorkingOneRung', () => {
  it('climbs one rung at a time', () => {
    expect(advanceWorkingOneRung('Danger')).toBe('Emergency');
    expect(advanceWorkingOneRung('Emergency')).toBe('Normal');
    expect(advanceWorkingOneRung('Power Change')).toBeNull();
  });
});

describe('canAdvanceWorking', () => {
  it('requires verified completion at current working rung', () => {
    expect(
      canAdvanceWorking('Emergency', {
        condition_label: 'Emergency',
        verified_at: '2026-07-01T00:00:00Z',
      })
    ).toBe(true);
    expect(
      canAdvanceWorking('Emergency', {
        condition_label: 'Danger',
        verified_at: '2026-07-01T00:00:00Z',
      })
    ).toBe(false);
    expect(canAdvanceWorking('Emergency', null)).toBe(false);
  });
});

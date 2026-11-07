// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  assertAdCouncilDecisionAllowed,
  sessionKeyFor,
} from '@/lib/dabos/ad-council';

describe('ad-council', () => {
  it('builds session keys', () => {
    expect(sessionKeyFor('2026-W45', 'week_close')).toBe('2026-W45-close');
    expect(sessionKeyFor('2026-W46', 'week_plan')).toBe('2026-W46-plan');
  });

  it('blocks council_decide without secretary recommends (founder Q4)', () => {
    expect(() =>
      assertAdCouncilDecisionAllowed(
        { decisionKind: 'council_decide', actorKind: 'div7_chair', actorId: 'Div7' },
        0
      )
    ).toThrow(/no live condition_recommend/);
  });

  it('allows council_decide after recommends', () => {
    expect(() =>
      assertAdCouncilDecisionAllowed(
        { decisionKind: 'council_decide', actorKind: 'div7_chair', actorId: 'Div7' },
        3
      )
    ).not.toThrow();
  });

  it('requires secretary actor for condition_recommend', () => {
    expect(() =>
      assertAdCouncilDecisionAllowed(
        { decisionKind: 'condition_recommend', actorKind: 'div7_chair', actorId: 'Div7' },
        0
      )
    ).toThrow(/division_secretary/);
  });
});

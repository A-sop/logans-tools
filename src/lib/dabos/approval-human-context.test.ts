import { describe, expect, it } from 'vitest';

import {
  HUMAN_CONTEXT_MAX,
  approvalContextPathHints,
  clampHumanContext,
  resolveApprovalContext,
} from '@/lib/dabos/approval-human-context';

describe('resolveApprovalContext', () => {
  it('prefers human_context', () => {
    expect(
      resolveApprovalContext({
        humanContext: 'What: send pack.\nYes: send.\nNo: hold.',
        body: 'brief paths only',
        payload: { decision: 'other' },
      })
    ).toBe('What: send pack.\nYes: send.\nNo: hold.');
  });

  it('falls back to body when human_context empty — not decision:other alone', () => {
    expect(
      resolveApprovalContext({
        humanContext: null,
        body: 'W47 P1. Agents build; you send.',
        payload: { decision: 'other' },
      })
    ).toBe('W47 P1. Agents build; you send.');
  });

  it('returns null when only decision:other in payload', () => {
    expect(
      resolveApprovalContext({
        humanContext: '  ',
        body: null,
        payload: { decision: 'other' },
      })
    ).toBeNull();
  });

  it('includes path hints with typed decisions', () => {
    expect(
      resolveApprovalContext({
        body: null,
        payload: { decision: 'merge', repo: 'A-sop/logans-tools', pr: 99 },
      })
    ).toBe('A-sop/logans-tools#99 · decision:merge');
  });
});

describe('approvalContextPathHints', () => {
  it('omits bare decision:other', () => {
    expect(approvalContextPathHints({ decision: 'other' })).toBeNull();
  });
});

describe('clampHumanContext', () => {
  it('caps at HUMAN_CONTEXT_MAX', () => {
    const long = 'x'.repeat(HUMAN_CONTEXT_MAX + 50);
    expect(clampHumanContext(long).length).toBe(HUMAN_CONTEXT_MAX);
  });
});

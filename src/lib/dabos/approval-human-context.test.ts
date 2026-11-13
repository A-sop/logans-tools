import { describe, expect, it } from 'vitest';

import {
  HUMAN_CONTEXT_MAX,
  approvalContextPathHints,
  bodyAddsBeyondHumanContext,
  clampHumanContext,
  resolveApprovalContext,
  scrubApprovalOpenSelfLinks,
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

  it('strips open-wall self-links before cap', () => {
    expect(clampHumanContext('Links: https://dabos.logans.tools/open · brief.md')).toBe(
      'Links: brief.md'
    );
  });
});

describe('scrubApprovalOpenSelfLinks', () => {
  it('removes dabos open wall URL and keeps brief paths', () => {
    const scrubbed = scrubApprovalOpenSelfLinks(
      'Links: docs/a.md · https://dabos.logans.tools/open · docs/b.md'
    );
    expect(scrubbed).toContain('docs/a.md');
    expect(scrubbed).toContain('docs/b.md');
    expect(scrubbed).not.toMatch(/logans\.tools\/open/i);
  });
});

describe('bodyAddsBeyondHumanContext', () => {
  it('hides near-duplicate body when human_context covers it', () => {
    expect(
      bodyAddsBeyondHumanContext(
        'W47 ED P1. Agents build pack; you send. Brief: priorities-W47-2026-11-13.md',
        'What: Pre-approve A5 send.\nWhy now: W47 ED P1 — agents build the pack, you send.\nLinks: priorities-W47-2026-11-13.md'
      )
    ).toBe(false);
  });

  it('shows body when it adds distinct info', () => {
    expect(
      bodyAddsBeyondHumanContext(
        'Apply SQL on prod with method neon-psql after merge.',
        'What: Merge PR #99.\nYes: merge only.\nNo: leave open.'
      )
    ).toBe(true);
  });
});

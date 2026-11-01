import { describe, expect, it } from 'vitest';

import { buildCommCenterDigestSection } from '@/lib/dabos/comm-center/digest-section';

describe('comm-center digest section', () => {
  it('renders station table and approvals', () => {
    const md = buildCommCenterDigestSection({
      stations: [
        {
          post: 'Div4',
          in_count: 2,
          pending_count: 1,
          out_count: 0,
          pending_cleared_count: 0,
          pending_past_clear_by: 0,
          oldest_in_age: '3:00:00',
          oldest_pending_since: '2026-10-28T10:00:00Z',
          never_reviewed_count: 0,
        },
      ],
      approvals: [{ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', title: 'Apply SQL', kind: 'prod_apply' }],
      dept13Lines: [{ repo: 'A-sop/logans-tools', number: 70, line: 'Dept13 PASS @' + 'a'.repeat(40) }],
      wakesWithoutReceipt: [{ post: 'Div5', woke_at: '2026-11-01T10:30:00Z' }],
    });
    expect(md).toContain('## Comm center');
    expect(md).toContain('| Div4 | 2 | 1 |');
    expect(md).toContain('Pending approval_queue');
    expect(md).toContain('Apply SQL');
    expect(md).toContain('Dept13 PASS');
    expect(md).toContain('Woke without hat receipt');
    expect(md).toContain('Div5');
  });

  it('returns empty when nothing provided', () => {
    expect(
      buildCommCenterDigestSection({
        stations: null,
        approvals: null,
        dept13Lines: null,
        wakesWithoutReceipt: null,
      })
    ).toBe('');
  });
});

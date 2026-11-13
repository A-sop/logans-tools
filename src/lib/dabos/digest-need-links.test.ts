import { describe, expect, it } from 'vitest';

import {
  enrichDigestNeedItems,
  githubPullUrlFromRef,
  parseDigestNeedItem,
} from '@/lib/dabos/digest-need-links';

describe('digest need links', () => {
  it('maps PR refs to GitHub pulls', () => {
    expect(githubPullUrlFromRef('logans-tools#12')).toBe(
      'https://github.com/A-sop/logans-tools/pull/12'
    );
  });

  it('parses ready-to-merge PR lines', () => {
    const item = parseDigestNeedItem(
      'Ready to merge: logans-tools#12 @abcdef12: Ship digest — Dept13 passed'
    );
    expect(item.kind).toBe('pr');
    expect(item.href).toBe('https://github.com/A-sop/logans-tools/pull/12');
    expect(item.title).toBe('Ship digest');
  });

  it('parses approval lines with aq tag', () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const item = parseDigestNeedItem(
      `Approval waiting [aq:${id}] (other, since Fri 13 Nov, 12:00): Merge yes for #60`
    );
    expect(item.kind).toBe('approval');
    expect(item.approvalId).toBe(id);
    expect(item.href).toBe(`/dabos/approvals/${id}`);
    expect(item.title).toBe('Merge yes for #60');
  });

  it('enriches legacy approval lines from live pending rows', () => {
    const id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const lines = ['Approval waiting (other, since Fri): Merge yes for #60'];
    const enriched = enrichDigestNeedItems(lines, [
      {
        id,
        kind: 'other',
        title: 'Merge yes for #60',
        createdAt: '2026-11-13T12:00:00Z',
        division: 'Div4',
      },
    ]);
    expect(enriched[0]!.href).toBe(`/dabos/approvals/${id}`);
  });
});

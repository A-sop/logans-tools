import { describe, expect, it } from 'vitest';

import {
  mapRebasketStatus,
  parseWaitingOn,
  validateAndStampPending,
} from '@/lib/dabos/comm-center/pending';

describe('PENDING P1 validation', () => {
  it('refuses missing reason', () => {
    const r = validateAndStampPending({ waiting_on: { kind: 'post', post: 'Div1/Dept1' } });
    expect(r.ok).toBe(false);
  });

  it('refuses missing waiting_on', () => {
    const r = validateAndStampPending({ reason: 'blocked' });
    expect(r.ok).toBe(false);
  });

  it('stamps since and last_reviewed', () => {
    const now = new Date('2026-11-01T18:00:00.000Z');
    const r = validateAndStampPending(
      { reason: 'reassess', waiting_on: { kind: 'post', post: 'Div1/Dept1' } },
      now
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pending.since).toBe(now.toISOString());
    expect(r.pending.last_reviewed).toBe(now.toISOString());
    expect(r.pending.reason).toBe('reassess');
  });

  it('accepts bare waiting_on string as post', () => {
    expect(parseWaitingOn('Div1/Dept1')).toEqual({ kind: 'post', post: 'Div1/Dept1' });
  });

  it('maps reassess → pending', () => {
    expect(mapRebasketStatus('reassess')).toEqual({
      basket: 'pending',
      file: false,
      pendingReason: 'reassess',
    });
  });

  it('returns null for unmapped status', () => {
    expect(mapRebasketStatus('doing')).toBeNull();
  });
});

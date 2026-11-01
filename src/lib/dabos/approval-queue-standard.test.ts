import { describe, expect, it } from 'vitest';

import {
  decisionKey,
  decisionPayloadSchema,
  decisionState,
  isValidDedupeKey,
} from '@/lib/dabos/approval-queue-standard';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const OTHER = 'f'.repeat(40);

describe('decisionKey', () => {
  it('builds merge and apply keys from repo, PR and the head sha', () => {
    expect(decisionKey({ decision: 'merge', repo: 'A-sop/DABOS', pr: 202, headSha: SHA })).toBe(
      'merge:A-sop/DABOS#202@0123456789ab'
    );
    expect(
      decisionKey({
        decision: 'prod_apply',
        repo: 'A-sop/logans-tools',
        pr: 61,
        headSha: SHA.toUpperCase(),
      })
    ).toBe('prod_apply:A-sop/logans-tools#61@0123456789ab');
  });

  it('builds host and slug keys', () => {
    expect(
      decisionKey({ decision: 'machine_change', host: 'ln02', slug: 'status-digest-timer' })
    ).toBe('machine_change:ln02:status-digest-timer');
    expect(decisionKey({ decision: 'policy', slug: 'wake-rules' })).toBe('policy:wake-rules');
  });

  it('rejects short shas, bad repos and spaces', () => {
    expect(() =>
      decisionKey({ decision: 'merge', repo: 'A-sop/DABOS', pr: 1, headSha: 'abc123' })
    ).toThrow();
    expect(() => decisionKey({ decision: 'merge', repo: 'DABOS', pr: 1, headSha: SHA })).toThrow();
    expect(() => decisionKey({ decision: 'policy', slug: 'two words' })).toThrow();
    expect(() => decisionKey({ decision: 'machine_change', host: 'LN02', slug: 'x' })).toThrow();
  });

  it('matches the SQL format check', () => {
    expect(isValidDedupeKey('merge:A-sop/DABOS#1@abc')).toBe(true);
    expect(isValidDedupeKey('deploy:x')).toBe(false);
    expect(isValidDedupeKey('merge: x')).toBe(false);
    expect(isValidDedupeKey(`policy:${'x'.repeat(200)}`)).toBe(false);
  });
});

describe('decisionPayloadSchema', () => {
  const merge = {
    decision: 'merge',
    repo: 'A-sop/logans-tools',
    pr: 61,
    head_sha: SHA,
    dept13_verdict: `PASS @${SHA}`,
  };

  it('accepts a merge row filed after a PASS at the head sha', () => {
    expect(decisionPayloadSchema.safeParse(merge).success).toBe(true);
  });

  it('refuses a merge row whose PASS is at another sha, or a FAIL', () => {
    expect(
      decisionPayloadSchema.safeParse({ ...merge, dept13_verdict: `PASS @${OTHER}` }).success
    ).toBe(false);
    expect(
      decisionPayloadSchema.safeParse({ ...merge, dept13_verdict: `FAIL @${SHA}` }).success
    ).toBe(false);
    // PASS or FAIL only: no third verdict, no short sha, nothing after the sha.
    expect(
      decisionPayloadSchema.safeParse({ ...merge, dept13_verdict: `CONDITIONAL @${SHA}` }).success
    ).toBe(false);
    expect(
      decisionPayloadSchema.safeParse({ ...merge, dept13_verdict: `PASS @${SHA.slice(0, 12)}` })
        .success
    ).toBe(false);
    expect(
      decisionPayloadSchema.safeParse({ ...merge, dept13_verdict: `PASS @${SHA}0` }).success
    ).toBe(false);
  });

  it('needs apply_method for prod_apply and host for machine changes', () => {
    expect(decisionPayloadSchema.safeParse({ ...merge, decision: 'prod_apply' }).success).toBe(
      false
    );
    expect(
      decisionPayloadSchema.safeParse({
        ...merge,
        decision: 'prod_apply',
        apply_method: 'psql -1 -f',
      }).success
    ).toBe(true);
    expect(decisionPayloadSchema.safeParse({ decision: 'machine_change' }).success).toBe(false);
    expect(
      decisionPayloadSchema.safeParse({ decision: 'machine_change', host: 'ln02' }).success
    ).toBe(true);
  });
});

describe('decisionState', () => {
  it('acts only on an approved row at the current head', () => {
    expect(decisionState({ status: 'approved', payload: { head_sha: SHA } }, SHA)).toBe('act');
    expect(decisionState({ status: 'approved', payload: { head_sha: SHA } }, OTHER)).toBe(
      'stale_sha'
    );
    expect(decisionState({ status: 'pending', payload: null })).toBe('wait');
    expect(decisionState({ status: 'rejected', payload: null })).toBe('rejected');
    expect(decisionState({ status: 'expired', payload: null })).toBe('expired');
  });

  it('never acts when either sha is missing', () => {
    expect(decisionState({ status: 'approved', payload: { head_sha: SHA } })).toBe('stale_sha');
    expect(decisionState({ status: 'approved', payload: { head_sha: SHA } }, '')).toBe('stale_sha');
    expect(decisionState({ status: 'approved', payload: {} }, SHA)).toBe('stale_sha');
    expect(decisionState({ status: 'approved', payload: null }, SHA)).toBe('stale_sha');
    expect(decisionState({ status: 'approved', payload: null })).toBe('stale_sha');
  });

  it('never acts on a short, long or non-hex sha, even as a prefix of the other', () => {
    const short = SHA.slice(0, 7);
    expect(decisionState({ status: 'approved', payload: { head_sha: short } }, SHA)).toBe('stale_sha');
    expect(decisionState({ status: 'approved', payload: { head_sha: SHA } }, short)).toBe('stale_sha');
    expect(decisionState({ status: 'approved', payload: { head_sha: short } }, short)).toBe('stale_sha');
    expect(decisionState({ status: 'approved', payload: { head_sha: `${SHA}0` } }, `${SHA}0`)).toBe(
      'stale_sha'
    );
    const nonHex = `${SHA.slice(0, 39)}g`;
    expect(decisionState({ status: 'approved', payload: { head_sha: nonHex } }, nonHex)).toBe(
      'stale_sha'
    );
  });

  it('acts on equal full shas regardless of case', () => {
    expect(
      decisionState({ status: 'approved', payload: { head_sha: SHA.toUpperCase() } }, SHA)
    ).toBe('act');
  });

  it('a pending or rejected row never acts even at the current head', () => {
    expect(decisionState({ status: 'pending', payload: { head_sha: SHA } }, SHA)).toBe('wait');
    expect(decisionState({ status: 'rejected', payload: { head_sha: SHA } }, SHA)).toBe('rejected');
  });
});

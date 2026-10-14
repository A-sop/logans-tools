import { describe, expect, it } from 'vitest';

import { computeQaPassRate } from '@/lib/dabos/division-weekly-stats';

const SAMPLE = `
## Template — ignore me

**Verdict: PASS** — template line should not count when Instance blocks exist.

## Instance 1 — old fail

- [x] 1. LIVE

**Verdict: FAIL** — office-PC clause open.
**Validated on:** 2026-07-05 · **Turnaround:** same day

## Instance 2 — old pass

**Verdict: PASS** — Neon seed closed.
**Validated on:** 2026-07-05 · **Turnaround:** same day

## Instance 3 — later week pass

**Verdict: PASS**
**Validated on:** 2026-07-11 · **Turnaround:** founder walk

## Instance 4 — same later week fail

**Verdict: FAIL** — criterion miss.
**Validated on:** 2026-07-11
`;

describe('computeQaPassRate', () => {
  it('returns all-time rate when no week scope is passed', () => {
    // 1 FAIL + 2 PASS + 1 FAIL among Instance blocks = 50%
    expect(computeQaPassRate(SAMPLE)).toBe(50);
  });

  it('scopes to ISO week Validated-on dates (not all-time)', () => {
    // 2026-07-05 is ISO week 27; Instance 1 FAIL + Instance 2 PASS → 50%
    expect(computeQaPassRate(SAMPLE, { year: 2026, week: 27 })).toBe(50);
    // 2026-07-11 is ISO week 28; Instance 3 PASS + Instance 4 FAIL → 50%
    expect(computeQaPassRate(SAMPLE, { year: 2026, week: 28 })).toBe(50);
  });

  it('returns null when the week has no validated verdicts', () => {
    expect(computeQaPassRate(SAMPLE, { year: 2026, week: 42 })).toBeNull();
  });

  it('returns null for empty / missing markdown', () => {
    expect(computeQaPassRate(null)).toBeNull();
    expect(computeQaPassRate('')).toBeNull();
    expect(computeQaPassRate('## Notes\nno verdicts')).toBeNull();
  });
});

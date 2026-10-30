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

  it('scopes to stat-week Validated-on dates (not all-time)', () => {
    // Stat weeks close Thu 14:00 Berlin (Dept11 2026-10-30); date-only rule = opening Thu..Wed.
    // 2026-07-05 (Sun) is stat week 28 (Thu 2 Jul..Wed 8 Jul); Instance 1 FAIL + Instance 2 PASS -> 50%
    expect(computeQaPassRate(SAMPLE, { year: 2026, week: 28 })).toBe(50);
    // 2026-07-11 (Sat) is stat week 29 (Thu 9 Jul..Wed 15 Jul); Instance 3 PASS + Instance 4 FAIL -> 50%
    expect(computeQaPassRate(SAMPLE, { year: 2026, week: 29 })).toBe(50);
    // ISO W27 (Mon 29 Jun - Sun 5 Jul) no longer applies: stat week 27 closes Thu 2 Jul
    expect(computeQaPassRate(SAMPLE, { year: 2026, week: 27 })).toBeNull();
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

describe('computeQaPassRate weekly regression (W43 all-time 4/5 bug)', () => {
  const JULY = [1, 2, 3, 4, 5]
    .map((n) => `## Instance ${n}\n\n**Verdict: ${n === 5 ? 'FAIL' : 'PASS'}**\n**Validated on:** 2026-07-0${n + 1}\n`)
    .join('\n');
  it('does not post the all-time July 4/5 in CW43; returns null (to-report)', () => {
    expect(computeQaPassRate(JULY)).toBe(80);
    expect(computeQaPassRate(JULY, { year: 2026, week: 43 })).toBeNull();
  });
  it('counts only verdicts closed inside the CW43 window', () => {
    const md = `${JULY}\n## Instance 6\n\n**Verdict: PASS**\n**Validated on:** 2026-10-20\n`;
    expect(computeQaPassRate(md, { year: 2026, week: 43 })).toBe(100);
  });
});

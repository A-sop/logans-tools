import { describe, expect, it } from 'vitest';

import { computeQaPassRate, countShippedOutputs } from '@/lib/dabos/division-weekly-stats';
import { closedOrgWeek } from '@/lib/dabos/org-week-window';

// Synthetic registers only.
const W44 = closedOrgWeek(new Date('2026-10-29T13:30:00Z')); // Thu 22 Oct 14:00 -> Thu 29 Oct 14:00 Berlin

const SHIP_LOG = `
# Ship log

| # | Date | What shipped | Acceptance line (pre-written) | Venture | Validated (Dept13) | Counts |
|---|------|--------------|-------------------------------|---------|--------------------|--------|
| 1 | 2026-07-05 | old thing A | a | X | PASS | yes |
| 2 | 2026-10-22 | opening-Thursday thing | a | X | PASS | yes |
| 3 | 2026-10-23 | fri thing | a | X | PASS | yes |
| 4 | 2026-10-26 | mon thing | a | X | PASS | **yes** |
| 5 | 2026-10-27 | not counted | a | X | FAIL | no |
| 6 | 2026-10-29 | closing-Thursday thing | a | X | PASS | yes (validated) |
| 7 | 2026-10-30 | next week thing | a | X | PASS | yes |
`;

describe('countShippedOutputs closed-week window', () => {
  it('all-time without a window (ship-gate path unchanged)', () => {
    expect(countShippedOutputs(SHIP_LOG)).toBe(6);
  });
  it('counts only Counts=yes rows dated Fri..closing Thu of the closed week', () => {
    // rows 3, 4, 6
    expect(countShippedOutputs(SHIP_LOG, W44)).toBe(3);
  });
  it('0 when nothing shipped in the window', () => {
    const w = closedOrgWeek(new Date('2026-09-10T13:30:00Z'));
    expect(countShippedOutputs(SHIP_LOG, w)).toBe(0);
  });
});

const VALIDATION = `
## Instance 1 - July pass
**Verdict: PASS**
**Validated on:** 2026-07-05

## Instance 2 - July pass
**Verdict: PASS**
**Validated on:** 2026-07-06

## Instance 3 - July fail
**Verdict: FAIL**
**Validated on:** 2026-07-07

## Instance 4 - opening Thursday (belongs to W43)
**Verdict: PASS**
**Validated on:** 2026-10-22

## Instance 5 - inside W44
**Verdict: PASS**
**Validated on:** 2026-10-27

## Instance 6 - inside W44
**Verdict: FAIL**
**Validated on:** 2026-10-29

## Instance 7 - ISO W44 Friday = next org week
**Verdict: FAIL**
**Validated on:** 2026-10-30

## Instance 8 - undated verdict never counts weekly
**Verdict: PASS**
`;

describe('computeQaPassRate closed-week window', () => {
  it('counts only verdicts validated inside the closed week (not all-time)', () => {
    // all-time: PASS 1,2,4,5,8 / 8 = 62.5
    expect(computeQaPassRate(VALIDATION)).toBe(62.5);
    // W44: Instance 5 PASS + Instance 6 FAIL = 50
    expect(computeQaPassRate(VALIDATION, { window: W44 })).toBe(50);
  });
  it('returns null (to-report) when the closed week has 0 verdicts', () => {
    const w = closedOrgWeek(new Date('2026-09-10T13:30:00Z'));
    expect(computeQaPassRate(VALIDATION, { window: w })).toBeNull();
  });
  it('W44 regression: an all-time-only register yields to-report, not the all-time rate', () => {
    const allOld = VALIDATION.split('## Instance 4')[0]!; // July only: 2/3 = 66.7 all-time
    expect(computeQaPassRate(allOld)).toBe(66.7);
    expect(computeQaPassRate(allOld, { window: W44 })).toBeNull();
  });
});
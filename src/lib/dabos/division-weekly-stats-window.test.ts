import { readFileSync } from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import {
  computeQaPassRate,
  countShippedOutputs,
  instanceVerdict,
  shipLogPassDate,
} from '@/lib/dabos/division-weekly-stats';
import { closedOrgWeek } from '@/lib/dabos/org-week-window';

// Synthetic registers only.
const W44 = closedOrgWeek(new Date('2026-10-29T13:30:00Z')); // Thu 22 Oct 14:00 -> Thu 29 Oct 14:00 Berlin
const W45 = closedOrgWeek(new Date('2026-11-05T13:30:00Z'));
const EMPTY = closedOrgWeek(new Date('2026-09-10T13:30:00Z'));

const SHIP_LOG = `
# Ship log

| # | Date | What shipped | Acceptance line (pre-written) | Venture | Validated (Dept13) | Counts |
|---|------|--------------|-------------------------------|---------|--------------------|--------|
| 1 | 2026-07-05 | old thing | a | X | **PASS 2026-07-05** (instance 1) | **yes** |
| 2 | 2026-10-20 | shipped W43, passed opening Thu | a | X | **PASS 2026-10-22** (instance 2) | **yes** |
| 3 | 2026-10-23 | fri thing | a | X | **PASS 2026-10-23** | yes |
| 4 | 2026-10-26 | shipped W44, passed W45 | a | X | **PASS 2026-10-30** | **yes** |
| 5 | 2026-10-27 | failed | a | X | **FAIL 2026-10-27** (instance 5) | no |
| 6 | 2026-10-27 | failed but Counts=yes typo | a | X | **FAIL 2026-10-28** | yes |
| 7 | 2026-10-27 | awaiting Dept13 | a | X | pending | yes |
| 8 | 2026-10-27 | pending PASS | a | X | **PASS** (pending formal Dept13 sign-off) | yes |
| 9 | 2026-10-28 | passed closing Thu, date-only | a | X | **PASS 2026-10-29** | yes (validated) |
| 10 | 2026-10-28 | passed closing Thu 13:30 | a | X | **PASS 2026-10-29 13:30** | yes |
| 11 | 2026-10-28 | conditional | a | X | **CONDITIONAL 2026-10-28** | no |
| 12 | 2026-10-28 | pass but not counted | a | X | PASS 2026-10-27 | no |
`;

describe('shipLogPassDate (Validated (Dept13) cell)', () => {
  it('returns the PASS date only for a decided PASS', () => {
    expect(shipLogPassDate('**PASS 2026-07-11** (Dept13 checklist instance 3)')).toBe('2026-07-11');
    expect(shipLogPassDate('PASS 2026-10-29 13:30')).toBe('2026-10-29 13:30');
    expect(shipLogPassDate('**FAIL 2026-07-05** (instance 1)')).toBeNull();
    expect(shipLogPassDate('**CONDITIONAL 2026-10-15** (earlier PASS 2026-07-11 superseded)')).toBeNull();
    expect(shipLogPassDate('pending')).toBeNull();
    expect(shipLogPassDate('**PASS** (pending formal Dept13 sign-off)')).toBeNull();
    expect(shipLogPassDate('pending PASS 2026-10-27')).toBeNull();
    expect(shipLogPassDate('PASS 2026-10-27 (pending founder walk)')).toBeNull();
    expect(shipLogPassDate('PASS')).toBeNull(); // no date -> cannot bucket
  });
});

describe('countShippedOutputs: requires Validated (Dept13) PASS, buckets by PASS date', () => {
  it('all-time (ship-gate) counts only PASS + Counts=yes rows', () => {
    // 1, 2, 3, 4, 9, 10 (FAIL / pending / CONDITIONAL / Counts=no excluded)
    expect(countShippedOutputs(SHIP_LOG)).toBe(6);
  });
  it('W44 buckets by the PASS date, not the ship Date column', () => {
    // 2 (ship W43, PASS opening Thu), 3, 10 (PASS closing Thu 13:30 < 14:00)
    expect(countShippedOutputs(SHIP_LOG, W44)).toBe(3);
  });
  it('W45 gets rows passed after the W44 close (incl. date-only closing-Thursday PASS)', () => {
    // 4 (PASS Fri 30 Oct, shipped 26 Oct), 9 (PASS 2026-10-29 date-only -> next week)
    expect(countShippedOutputs(SHIP_LOG, W45)).toBe(2);
  });
  it('pending and FAIL rows never count, even with Counts=yes', () => {
    const only = SHIP_LOG.split('\n')
      .filter((l) => !/^\| (1|2|3|4|9|10) \|/.test(l))
      .join('\n');
    expect(countShippedOutputs(only)).toBe(0);
    expect(countShippedOutputs(only, W44)).toBe(0);
  });
  it('0 when nothing passed in the window', () => {
    expect(countShippedOutputs(SHIP_LOG, EMPTY)).toBe(0);
  });
});

const VALIDATION = `
## Instance 1 - July pass
**Verdict: PASS**
**Validated on:** 2026-07-05 · **Turnaround:** n/a

## Instance 2 - July pass
**Verdict: PASS**
**Validated on:** 2026-07-06

## Instance 3 - July fail
**Verdict: FAIL** — item 2 fails
**Validated on:** 2026-07-07

## Instance 4 - opening Thursday (date-only -> W44 under the provisional rule)
**Verdict: PASS**
**Validated on:** 2026-10-22

## Instance 5 - PR #90 at sha aaa, inside W44
**Verdict: PASS**
**Validated on:** 2026-10-27

## Instance 6 - closing Thursday date-only -> W45
**Verdict: FAIL**
**Validated on:** 2026-10-29

## Instance 7 - ISO W44 Friday = next org week
**Verdict: FAIL**
**Validated on:** 2026-10-30

## Instance 8 - undated verdict never counts weekly
**Verdict: PASS**

## Instance 9 - bold label, verdict outside the bold
**Verdict:** FAIL
**Validated on:** 2026-10-28

## Instance 10 - unbolded, timestamped before the cutoff
Verdict: FAIL
Validated on: 2026-10-29 13:59

## Instance 11 - pending PASS
**Verdict: PASS** (pending formal Dept13 sign-off)
**Validated on:** 2026-10-26

## Instance 12 - timestamped at the cutoff -> W45
Verdict: PASS
Validated on: 2026-10-29 14:00

## Instance 13 - conditional
**Verdict: CONDITIONAL** (was PASS 2026-10-20)
**Validated on:** 2026-10-27

## Instance 14 - template
Verdict: <empty until validation — PASS or FAIL>
Validated on: <date>

## Instance 15 - re-review of the same PR #90 at the same sha aaa
**Verdict: PASS**
**Validated on:** 2026-10-27
`;

describe('instanceVerdict', () => {
  it('accepts bold, bold-label and unbolded verdicts; rejects pending / conditional / template', () => {
    expect(instanceVerdict('**Verdict: PASS**')).toBe('PASS');
    expect(instanceVerdict('**Verdict: FAIL** — item 3')).toBe('FAIL');
    expect(instanceVerdict('**Verdict:** FAIL')).toBe('FAIL');
    expect(instanceVerdict('**Verdict:** **PASS**')).toBe('PASS');
    expect(instanceVerdict('Verdict: FAIL')).toBe('FAIL');
    expect(instanceVerdict('- Verdict: fail')).toBe('FAIL');
    expect(instanceVerdict('**Verdict: PASS** (pending formal Dept13 sign-off)')).toBeNull();
    expect(instanceVerdict('Verdict: PASS - pending founder walk')).toBeNull();
    expect(instanceVerdict('**Verdict: CONDITIONAL** (was PASS)')).toBeNull();
    expect(instanceVerdict('Verdict: <empty until validation — PASS or FAIL>')).toBeNull();
    expect(instanceVerdict('no verdict here')).toBeNull();
  });
});

describe('computeQaPassRate counts PER VERDICT INSTANCE (not per PR or SHA), closed-week window', () => {
  it('all-time: every decided instance is one verdict', () => {
    // PASS 1,2,4,5,8,12,15 = 7; FAIL 3,6,7,9,10 = 5 -> 7/12
    expect(computeQaPassRate(VALIDATION)).toBe(58.3);
  });
  it('W44: only instances validated inside the closed week', () => {
    // 4 PASS (opening Thu), 5 PASS, 9 FAIL, 10 FAIL (13:59), 15 PASS -> 3/5
    expect(computeQaPassRate(VALIDATION, { window: W44 })).toBe(60);
  });
  it('two instances for the same PR and SHA are two verdicts (instances 5 and 15)', () => {
    const md = VALIDATION.split('## Instance')
      .filter((b) => /^ (5|15) /.test(b))
      .map((b) => '## Instance' + b)
      .join('');
    expect(computeQaPassRate(md, { window: W44 })).toBe(100);
    const withFail = md + '\n## Instance 16 - same PR #90 sha aaa, third review\n**Verdict:** FAIL\n**Validated on:** 2026-10-27\n';
    expect(computeQaPassRate(withFail, { window: W44 })).toBe(66.7);
  });
  it('W45 gets the closing-Thursday date-only and >= 14:00 timestamped verdicts', () => {
    // 6 FAIL, 7 FAIL, 12 PASS -> 1/3
    expect(computeQaPassRate(VALIDATION, { window: W45 })).toBe(33.3);
  });
  it('returns null (to-report) when the closed week has 0 verdicts', () => {
    expect(computeQaPassRate(VALIDATION, { window: EMPTY })).toBeNull();
  });
  it('W44 regression: an all-time-only register yields to-report, not the all-time rate', () => {
    const allOld = VALIDATION.split('## Instance 4')[0]!; // July only: 2/3 = 66.7 all-time
    expect(computeQaPassRate(allOld)).toBe(66.7);
    expect(computeQaPassRate(allOld, { window: W44 })).toBeNull();
  });
});
// Exact lines from the real Dept13 register (see fixture header); no client data.
const REAL_REGISTER_SHAPE = readFileSync(
  path.join(__dirname, '__fixtures__', 'dept13-register-shape.md'),
  'utf8'
);
const REAL_INSTANCE_1_VERDICT = REAL_REGISTER_SHAPE.split('\n').find((l) =>
  l.startsWith('**Verdict: FAIL**')
)!;

describe('real register regression (Dept13 FAIL on 8bc8291f: pending in a FAIL reason)', () => {
  it('Instance 1 is a FAIL even though its reason text mentions "pending"', () => {
    expect(REAL_INSTANCE_1_VERDICT).toContain('"pending"');
    expect(instanceVerdict(REAL_INSTANCE_1_VERDICT)).toBe('FAIL');
  });
  it('all-time qa on the real register shape is 66.7 (I1 FAIL, I2+I3 PASS; I4 pending PASS, I5 CONDITIONAL, template excluded)', () => {
    expect(computeQaPassRate(REAL_REGISTER_SHAPE)).toBe(66.7);
  });
  it('FAIL is never dropped for "pending" anywhere on the line', () => {
    expect(instanceVerdict('**Verdict: FAIL** — acceptance evidence still pending')).toBe('FAIL');
    expect(instanceVerdict('**Verdict: FAIL** (pending founder re-check)')).toBe('FAIL');
    expect(instanceVerdict('Verdict: FAIL - pending')).toBe('FAIL');
  });
  it('pending only drops a PASS when it qualifies the token immediately', () => {
    expect(instanceVerdict('**Verdict: PASS** (pending formal Dept13 hat re-sign-off)')).toBeNull();
    expect(instanceVerdict('Verdict: PASS (pending founder walk)')).toBeNull();
    expect(instanceVerdict('**Verdict:** PASS — pending sign-off')).toBeNull();
    expect(instanceVerdict('**Verdict: PASS** — item 4 was pending, now evidenced 2026-10-27')).toBe('PASS');
  });
});

describe('qualified tokens and case', () => {
  it('PASS-conditional and similar PASS-/FAIL- qualifiers are not a decided verdict', () => {
    expect(instanceVerdict('**Verdict: PASS-conditional** (needs redeploy)')).toBeNull();
    expect(instanceVerdict('Verdict: PASS-provisional')).toBeNull();
    expect(instanceVerdict('Verdict: PASS/FAIL')).toBeNull();
    expect(instanceVerdict('Verdict: PASSED')).toBeNull();
    expect(instanceVerdict('Verdict: FAIL-soft')).toBeNull();
    expect(shipLogPassDate('**PASS-conditional 2026-10-27**')).toBeNull();
  });
  it('lowercase counts only inside a Verdict: line', () => {
    expect(instanceVerdict('Verdict: pass')).toBe('PASS');
    expect(instanceVerdict('**verdict:** Fail')).toBe('FAIL');
    expect(instanceVerdict('Item 3: pass\nnotes: fail')).toBeNull(); // no Verdict: line
    expect(shipLogPassDate('pass 2026-10-27')).toBeNull(); // ship cell: uppercase PASS required
    expect(shipLogPassDate('Pass 2026-10-27')).toBeNull();
  });
  it('reads the FIRST Verdict: line only (a later PASS in notes does not rescue a CONDITIONAL)', () => {
    expect(instanceVerdict('**Verdict: CONDITIONAL**\nnotes\nVerdict: PASS once redeployed')).toBeNull();
  });
  it('ship-log cell: a later "pending" in the PASS reason does not drop the row', () => {
    expect(shipLogPassDate('**PASS 2026-10-27** (instance 9; earlier pending note resolved)')).toBe('2026-10-27');
    expect(shipLogPassDate('**PASS 2026-10-27** (pending founder walk)')).toBeNull();
    expect(shipLogPassDate('PASS (pending) 2026-10-27')).toBeNull();
  });
});
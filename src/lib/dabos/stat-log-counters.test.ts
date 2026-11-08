import { describe, expect, it } from 'vitest';
import { closedOrgWeekForIsoWeek } from '@/lib/dabos/org-week-window';
import { countCommsUnits, countEnrollments, sumEurLog } from '@/lib/dabos/stat-log-counters';

const WEEK = closedOrgWeekForIsoWeek(2026, 45); // closed week labelled 2026-W45

describe('stat-log-counters', () => {
  it('counts comms units by direction inside the week', () => {
    const md = `
| Date | Direction | Channel | Units | Note |
|------|-----------|---------|-------|------|
| 2026-10-30 | out | email | 2 | a |
| 2026-10-30 | in | call | 1 | b |
| 2026-10-01 | out | email | 9 | outside |
`;
    expect(countCommsUnits(md, WEEK, 'out')).toBe(2);
    expect(countCommsUnits(md, WEEK, 'in')).toBe(1);
  });

  it('returns null when log file content is null (to-report)', () => {
    expect(countCommsUnits(null, WEEK, 'out')).toBeNull();
    expect(countEnrollments(null, WEEK)).toBeNull();
  });

  it('returns 0 for empty present log', () => {
    const md = `| Date | Direction | Channel | Units | Note |\n|------|-----------|---------|-------|------|\n`;
    expect(countCommsUnits(md, WEEK, 'out')).toBe(0);
  });

  it('sums EUR bills in window', () => {
    const md = `
| Date | Payee | EUR | Note |
| 2026-11-02 | Vendor | 12.5 | ok |
| 2026-09-01 | Old | 100 | out |
`;
    expect(sumEurLog(md, WEEK, 2)).toBe(12.5);
  });
});

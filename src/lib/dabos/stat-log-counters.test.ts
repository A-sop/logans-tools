import { describe, expect, it } from 'vitest';
import { closedOrgWeekForIsoWeek } from '@/lib/dabos/org-week-window';
import {
  countCommsUnits,
  countEnrollments,
  countPublishLogRows,
  sumAeEingereicht,
  sumEurLog,
  sumMarketResearchUnits,
  sumTradingResearchUnits,
} from '@/lib/dabos/stat-log-counters';
import {
  countContentPiecesProduced,
  countContentPiecesShipped,
} from '@/lib/dabos/division-weekly-stats';

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

  it('counts publish-log rows in window and ignores em-dash placeholders', () => {
    const md = `
| Date | Item | Channel | Venture | Approved-by | Pointer |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
| 2026-10-30 | GFP post | Postiz | gfp | Logan | path |
| 2026-09-01 | old | X | gfp | Logan | path |
`;
    expect(countPublishLogRows(md, WEEK)).toBe(1);
    expect(countPublishLogRows(null, WEEK)).toBeNull();
  });

  it('splits trading research vs paper_test units', () => {
    const md = `
| Date | Venture | Kind | Units | Note |
|------|---------|------|-------|------|
| 2026-10-30 | trading | journal | 2 | study |
| 2026-10-30 | trading | paper_test | 3 | EA |
| 2026-09-01 | trading | journal | 9 | out |
`;
    expect(sumTradingResearchUnits(md, WEEK, false)).toBe(2);
    expect(sumTradingResearchUnits(md, WEEK, true)).toBe(3);
  });

  it('sums market research with blank Units as 1', () => {
    const md = `
| Date | Venture | Topic | Units | Note |
|------|---------|-------|-------|------|
| 2026-10-30 | gfp | ICP |  | note |
| 2026-10-30 | trading | channels | 2 | ok |
`;
    expect(sumMarketResearchUnits(md, WEEK)).toBe(3);
  });

  it('sums ae_eingereicht EH in window and returns 0 for empty present log', () => {
    const empty = `| Date | Venture | Case-ref | EH | Note |\n|------|---------|----------|----|------|\n`;
    expect(sumAeEingereicht(empty, WEEK)).toBe(0);
    expect(sumAeEingereicht(null, WEEK)).toBeNull();
    const md = `
| Date | Venture | Case-ref | EH | Note |
|------|---------|----------|----|------|
| 2026-10-30 | DVAG_Praxis | AB | 2.5 | eingereicht |
| 2026-09-01 | DVAG_Praxis | CD | 9 | outside |
`;
    expect(sumAeEingereicht(md, WEEK)).toBe(2.5);
  });

  it('counts content produced vs shipped from status table', () => {
    const md = `
| piece_id | venture | type | produced | submitted_validation | quality_ok | tc_ok | scheduled | published | notes |
|----------|---------|------|----------|-------------------|------------|-------|-----------|-----------|-------|
| a | gfp | post | 2026-10-01 | — | PENDING | n/a | — | — | draft |
| b | gfp | video | 2026-10-02 | 2026-10-03 | PASS | n/a | — | — | shipped |
| *(none yet — honest empty)* | | | | | | | | | |
`;
    expect(countContentPiecesProduced(md)).toBe(2);
    expect(countContentPiecesShipped(md)).toBe(1);
    expect(countContentPiecesProduced(null)).toBe(0);
  });
});

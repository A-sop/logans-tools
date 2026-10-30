import { describe, expect, it } from 'vitest';

import { buildDivisionChartBundle } from '@/lib/dabos/board-charts';
import { bucketStatWeek } from '@/lib/dabos/board-conditions-query';
import {
  boardDateInputValue,
  calendarWeekInYear,
  currentCalendarWeek,
  weekContextFromDateInput,
  weeksInYear,
  ytdRangeThroughWeek,
} from '@/lib/dabos/calendar-week';
import { resolveGfpIsoWeek, resolveGfpStatWeek } from '@/lib/dabos/gfp-weekly-stats';
import {
  closedOrgWeek,
  isoWeekOfCalendarDate,
  parseStatWeekId,
  statWeekFromWorkspaceId,
  statWeekOf,
  statWeeksInYear,
  statWeekWindow,
} from '@/lib/dabos/org-week';

/**
 * Acceptance (Dept11 2026-10-30, founder ruling "stat week closes Thursday, Friday starts the
 * new week"; boundary = org-week.ts Thu 14:00 Europe/Berlin): a timestamp of Thu 13:59 Berlin
 * falls in week N, Thu 14:00 in week N+1, and Fri in N+1; existing W44 labels unchanged.
 */
describe('stat week single source (org-week.ts)', () => {
  it('acceptance: Thu 13:59 -> W44, Thu 14:00 -> W45, Fri -> W45 (Berlin, CET)', () => {
    expect(statWeekOf(new Date('2026-10-29T12:59:00Z')).id).toBe('2026-W44'); // Thu 13:59 CET
    expect(statWeekOf(new Date('2026-10-29T13:00:00Z')).id).toBe('2026-W45'); // Thu 14:00 CET
    expect(statWeekOf(new Date('2026-10-30T09:00:00Z')).id).toBe('2026-W45'); // Fri
    expect(statWeekOf(new Date('2026-11-01T22:30:00Z')).id).toBe('2026-W45'); // Sun 23:30 (ISO W44!)
    expect(statWeekOf(new Date('2026-11-02T08:00:00Z')).id).toBe('2026-W45'); // Mon
    expect(statWeekOf(new Date('2026-11-05T12:59:59Z')).id).toBe('2026-W45'); // next Thu 13:59:59
  });

  it('acceptance: same boundary in summer time (CEST)', () => {
    expect(statWeekOf(new Date('2026-07-02T11:59:00Z')).id).toBe('2026-W27'); // Thu 13:59 CEST
    expect(statWeekOf(new Date('2026-07-02T12:00:00Z')).id).toBe('2026-W28'); // Thu 14:00 CEST
    expect(statWeekOf(new Date('2026-07-03T08:00:00Z')).id).toBe('2026-W28'); // Fri
  });

  it('existing W44 label unchanged: W44 = Thu 22 Oct 14:00 -> Thu 29 Oct 14:00 Berlin (div-live-2026-W44)', () => {
    const w = statWeekWindow(2026, 44);
    expect(w.start.toISOString()).toBe('2026-10-22T12:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-10-29T13:00:00.000Z');
    expect(w.id).toBe('2026-W44');
    // poster run Thu 29 Oct 14:30 Berlin posts W44, as it did before this change
    expect(closedOrgWeek(new Date('2026-10-29T13:30:00Z')).id).toBe('2026-W44');
    expect(resolveGfpStatWeek(new Date('2026-10-29T13:30:00Z'))).toEqual({ year: 2026, week: 44 });
    expect(resolveGfpIsoWeek).toBe(resolveGfpStatWeek);
  });

  it('GFP poster no longer posts the running ISO week mid-week', () => {
    // Mon 2 Nov: old code -> ISO 2026-W45 (running, recorded_at in the future); now last closed W44
    expect(resolveGfpStatWeek(new Date('2026-11-02T10:00:00Z'))).toEqual({ year: 2026, week: 44 });
    // Fri 30 Oct: old code -> ISO W44 (still running); now W44 (closed Thu 14:00)
    expect(resolveGfpStatWeek(new Date('2026-10-30T10:00:00Z'))).toEqual({ year: 2026, week: 44 });
  });

  it('year edges: 2026 has 53 weeks; Thu 31 Dec 2026 14:00 starts 2027-W01', () => {
    expect(statWeeksInYear(2025)).toBe(52);
    expect(statWeeksInYear(2026)).toBe(53);
    expect(weeksInYear(2026)).toBe(53);
    expect(statWeekWindow(2026, 1).endDate).toBe('2026-01-01');
    expect(statWeekWindow(2026, 1).startDate).toBe('2025-12-25');
    expect(statWeekWindow(2026, 53).endDate).toBe('2026-12-31');
    expect(statWeekOf(new Date('2026-12-31T12:59:00Z')).id).toBe('2026-W53');
    expect(statWeekOf(new Date('2026-12-31T13:00:00Z')).id).toBe('2027-W01');
    expect(statWeekOf(new Date('2027-01-01T10:00:00Z')).id).toBe('2027-W01');
    // invalid week 53 in a 52-week year resolves to next year's W01 (callers reject the mismatch)
    expect(statWeekWindow(2025, 53).id).toBe('2026-W01');
  });

  it('isoWeekOfCalendarDate matches ISO 8601', () => {
    expect(isoWeekOfCalendarDate(2026, 10, 29)).toEqual({ year: 2026, week: 44 });
    expect(isoWeekOfCalendarDate(2027, 1, 1)).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOfCalendarDate(2024, 12, 30)).toEqual({ year: 2025, week: 1 });
  });

  it('week ids parse from flags and workspace ids', () => {
    expect(parseStatWeekId('2026-W44')).toEqual({ year: 2026, week: 44 });
    expect(statWeekFromWorkspaceId('div-live-2026-W44')).toEqual({ year: 2026, week: 44 });
    expect(statWeekFromWorkspaceId('gfp-live-2026-W09')).toEqual({ year: 2026, week: 9 });
    expect(statWeekFromWorkspaceId('seed-ytd-2026')).toBeNull();
  });
});

describe('board on stat weeks (calendar-week.ts / board-conditions-query.ts)', () => {
  it('buckets by stat week; labelled workspace ids keep their label', () => {
    expect(bucketStatWeek(2026, new Date('2026-10-30T10:00:00Z'))).toBe(45); // Fri
    expect(bucketStatWeek(2026, new Date('2026-10-29T12:59:59.999Z'))).toBe(44); // poster recorded_at
    // pre-change gfp-live row recorded at the ISO Sunday end stays in W44
    expect(bucketStatWeek(2026, new Date('2026-11-01T23:59:59.999Z'), 'gfp-live-2026-W44')).toBe(44);
    expect(bucketStatWeek(2026, new Date('2026-11-01T23:59:59.999Z'))).toBe(45);
    expect(bucketStatWeek(2025, new Date('2026-10-30T10:00:00Z'), 'div-live-2026-W44')).toBeNull();
  });

  it('calendar helpers use stat weeks', () => {
    expect(calendarWeekInYear(new Date('2026-10-30T10:00:00Z'), 2026)).toBe(45);
    expect(currentCalendarWeek(2026, new Date('2026-10-29T12:59:00Z'))).toBe(44);
    expect(currentCalendarWeek(2026, new Date('2026-10-29T13:00:00Z'))).toBe(45);
    const ytd = ytdRangeThroughWeek(2026, 44);
    expect(ytd.start.toISOString()).toBe('2025-12-25T13:00:00.000Z');
    expect(ytd.end.toISOString()).toBe('2026-10-29T12:59:59.999Z');
  });

  it('date input round-trips on the closing Thursday, Friday is the next week', () => {
    expect(boardDateInputValue(2026, 44)).toBe('2026-10-29');
    expect(weekContextFromDateInput('2026-10-29')).toEqual({ year: 2026, calendarWeek: 44 });
    expect(weekContextFromDateInput('2026-10-30')).toEqual({ year: 2026, calendarWeek: 45 });
    expect(weekContextFromDateInput('2026-10-26')).toEqual({ year: 2026, calendarWeek: 44 }); // Mon
    expect(weekContextFromDateInput('nope')).toBeNull();
  });

  it('charts anchor a week to the month of its closing Thursday', () => {
    const entries = Array.from({ length: 44 }, (_, i) => ({ week: i + 1, value: i }));
    const bundle = buildDivisionChartBundle(entries, 2026, 44);
    // W40 closes Thu 1 Oct (opens 24 Sep): overlaps October; W39 closes 24 Sep: does not
    expect(bundle.month.map((p) => p.week)).toEqual([40, 41, 42, 43, 44]);
    expect(bundle.year.find((p) => p.week === 40)?.label).toBe('Oct');
  });
});

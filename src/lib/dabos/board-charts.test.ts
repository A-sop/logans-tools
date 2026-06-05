import { describe, expect, it } from 'vitest';

import { buildDivisionChartBundle, weekOverlapsCalendarMonth } from '@/lib/dabos/board-charts';

describe('weekOverlapsCalendarMonth', () => {
  it('includes ISO weeks that span a calendar month boundary', () => {
    expect(weekOverlapsCalendarMonth(2026, 23, 5, 2026)).toBe(true);
    expect(weekOverlapsCalendarMonth(2026, 22, 5, 2026)).toBe(false);
    expect(weekOverlapsCalendarMonth(2026, 22, 4, 2026)).toBe(true);
  });
});

describe('buildDivisionChartBundle', () => {
  const weeklyEntries = Array.from({ length: 22 }, (_, index) => ({
    week: index + 1,
    value: 10 + index,
  }));

  it('includes May weeks when the reference week is in May', () => {
    const bundle = buildDivisionChartBundle(weeklyEntries, 2026, 22);
    expect(bundle.month.map((point) => point.week)).toEqual([18, 19, 20, 21, 22]);
  });

  it('falls back to trailing weeks when the calendar month has no stats yet', () => {
    const bundle = buildDivisionChartBundle(weeklyEntries, 2026, 23);
    expect(bundle.month.map((point) => point.week)).toEqual([19, 20, 21, 22]);
  });

  it('pads early-month stats so the current month still renders a visible trend', () => {
    const withJune = [
      ...weeklyEntries,
      { week: 23, value: 32 },
    ];
    const bundle = buildDivisionChartBundle(withJune, 2026, 23);
    expect(bundle.month.map((point) => point.week)).toEqual([20, 21, 22, 23]);
  });
});

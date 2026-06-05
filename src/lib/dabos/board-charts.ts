import { format } from 'date-fns';

import { isoWeekEnd, isoWeekStart, weeksInYear } from '@/lib/dabos/calendar-week';

export type BoardChartPeriod = 'week' | 'month' | 'quarter' | 'year';

export type BoardChartPoint = {
  label: string;
  value: number;
  week: number;
};

export type DivisionChartBundle = Record<BoardChartPeriod, BoardChartPoint[]>;

export const BOARD_CHART_PERIODS: { id: BoardChartPeriod; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'year', label: 'Year' },
];

export function parseBoardChartPeriod(raw: string | undefined): BoardChartPeriod {
  if (raw === 'week' || raw === 'month' || raw === 'quarter' || raw === 'year') {
    return raw;
  }
  return 'month';
}

function weekEndDate(year: number, week: number): Date {
  return isoWeekEnd(year, week);
}

function calendarQuarter(monthIndex: number): number {
  return Math.floor(monthIndex / 3);
}

/** True when any day of the ISO week falls inside the calendar month. */
export function weekOverlapsCalendarMonth(
  year: number,
  week: number,
  monthIndex: number,
  calendarYear: number
): boolean {
  const start = isoWeekStart(year, week);
  const end = isoWeekEnd(year, week);
  const monthStart = new Date(calendarYear, monthIndex, 1);
  const monthEnd = new Date(calendarYear, monthIndex + 1, 0, 23, 59, 59, 999);
  return start <= monthEnd && end >= monthStart;
}

function firstWeekOverlappingMonth(
  year: number,
  monthIndex: number,
  calendarYear: number
): number {
  for (let week = 1; week <= weeksInYear(year); week += 1) {
    if (weekOverlapsCalendarMonth(year, week, monthIndex, calendarYear)) {
      return week;
    }
  }
  return 1;
}

function padMonthSliceForChart(
  monthSlice: { week: number; value: number }[],
  sorted: { week: number; value: number }[]
): { week: number; value: number }[] {
  if (monthSlice.length >= 2) {
    return monthSlice;
  }
  if (monthSlice.length === 0) {
    return monthSlice;
  }

  const firstMonthWeek = monthSlice[0]!.week;
  const prior = sorted.filter((entry) => entry.week < firstMonthWeek).slice(-3);
  return [...prior, ...monthSlice];
}

function monthChartEntries(
  sorted: { week: number; value: number }[],
  year: number,
  referenceWeek: number
): { week: number; value: number }[] {
  const refWeekStart = isoWeekStart(year, referenceWeek);
  const refMonth = refWeekStart.getMonth();
  const refCalYear = refWeekStart.getFullYear();
  const firstMonthWeek = firstWeekOverlappingMonth(year, refMonth, refCalYear);

  let monthSlice = sorted.filter(
    (entry) =>
      entry.week >= firstMonthWeek &&
      entry.week <= referenceWeek &&
      weekOverlapsCalendarMonth(year, entry.week, refMonth, refCalYear)
  );

  if (monthSlice.length === 0) {
    const trailingWeeks = Math.min(5, referenceWeek);
    monthSlice = sorted.filter(
      (entry) => entry.week >= referenceWeek - trailingWeeks + 1 && entry.week <= referenceWeek
    );
  }

  return padMonthSliceForChart(monthSlice, sorted);
}

function toChartPoints(
  entries: { week: number; value: number }[],
  labelFn: (week: number, date: Date) => string,
  year: number
): BoardChartPoint[] {
  return entries.map(({ week, value }) => ({
    week,
    value,
    label: labelFn(week, weekEndDate(year, week)),
  }));
}

/** Build all four period views from weekly division-level stats (YTD through reference week). */
export function buildDivisionChartBundle(
  weeklyEntries: { week: number; value: number }[],
  year: number,
  referenceWeek: number
): DivisionChartBundle {
  const sorted = [...weeklyEntries]
    .filter((e) => e.week >= 1 && e.week <= referenceWeek)
    .sort((a, b) => a.week - b.week);

  const refDate = weekEndDate(year, referenceWeek);
  const refMonth = refDate.getMonth();
  const refQuarter = calendarQuarter(refMonth);

  const weekSlice = sorted.filter((e) => e.week >= referenceWeek - 7 && e.week <= referenceWeek);
  const monthSlice = monthChartEntries(sorted, year, referenceWeek);
  const quarterSlice = sorted.filter(
    (e) => calendarQuarter(weekEndDate(year, e.week).getMonth()) === refQuarter
  );
  const yearSlice = sorted;

  return {
    week: toChartPoints(weekSlice, (w) => `W${w}`, year),
    month: toChartPoints(monthSlice, (w) => `W${w}`, year),
    quarter: toChartPoints(quarterSlice, (w) => `W${w}`, year),
    year: toChartPoints(yearSlice, (w, d) => format(d, 'MMM'), year),
  };
}

export function pickChartSeries(
  bundle: DivisionChartBundle,
  period: BoardChartPeriod
): BoardChartPoint[] {
  return bundle[period];
}

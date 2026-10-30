import { weeksInYear } from '@/lib/dabos/calendar-week';
import { berlinLocalToUtc, statWeekWindow } from '@/lib/dabos/org-week';

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

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseBoardChartPeriod(raw: string | undefined): BoardChartPeriod {
  if (raw === 'week' || raw === 'month' || raw === 'quarter' || raw === 'year') {
    return raw;
  }
  return 'month';
}

/**
 * Berlin calendar month of a stat week's CLOSING Thursday (org-week.ts: Thu 14:00 Berlin close).
 * A stat week is anchored to the month / quarter / year its closing Thursday falls in, the same
 * way its `YYYY-Www` label is the ISO week of that Thursday.
 */
function closingMonth(year: number, week: number): { calendarYear: number; monthIndex: number } {
  const [y, m] = statWeekWindow(year, week).endDate.split('-').map(Number) as [number, number];
  return { calendarYear: y, monthIndex: m - 1 };
}

function calendarQuarter(monthIndex: number): number {
  return Math.floor(monthIndex / 3);
}

/** True when any part of the stat week [Thu 14:00, Thu 14:00) Berlin falls inside the Berlin calendar month. */
export function weekOverlapsCalendarMonth(
  year: number,
  week: number,
  monthIndex: number,
  calendarYear: number
): boolean {
  const { start, end } = statWeekWindow(year, week);
  const monthStart = berlinLocalToUtc(calendarYear, monthIndex + 1, 1, 0);
  const next = new Date(Date.UTC(calendarYear, monthIndex + 1, 1));
  const monthEnd = berlinLocalToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, 1, 0);
  return start < monthEnd && end > monthStart;
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
  const { monthIndex: refMonth, calendarYear: refCalYear } = closingMonth(year, referenceWeek);
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
  labelFn: (week: number, monthIndex: number) => string,
  year: number
): BoardChartPoint[] {
  return entries.map(({ week, value }) => ({
    week,
    value,
    label: labelFn(week, closingMonth(year, week).monthIndex),
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

  const refQuarter = calendarQuarter(closingMonth(year, referenceWeek).monthIndex);

  const weekSlice = sorted.filter((e) => e.week >= referenceWeek - 7 && e.week <= referenceWeek);
  const monthSlice = monthChartEntries(sorted, year, referenceWeek);
  const quarterSlice = sorted.filter(
    (e) => calendarQuarter(closingMonth(year, e.week).monthIndex) === refQuarter
  );
  const yearSlice = sorted;

  return {
    week: toChartPoints(weekSlice, (w) => `W${w}`, year),
    month: toChartPoints(monthSlice, (w) => `W${w}`, year),
    quarter: toChartPoints(quarterSlice, (w) => `W${w}`, year),
    year: toChartPoints(yearSlice, (_w, month) => MONTH_SHORT[month]!, year),
  };
}

export function pickChartSeries(
  bundle: DivisionChartBundle,
  period: BoardChartPeriod
): BoardChartPoint[] {
  return bundle[period];
}

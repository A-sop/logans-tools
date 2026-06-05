import {
  endOfISOWeek,
  format,
  getISOWeek,
  getISOWeeksInYear,
  getISOWeekYear,
  setISOWeek,
  startOfISOWeek,
  startOfYear,
} from 'date-fns';

/** Board default stat year (YTD window). */
export const BOARD_STAT_YEAR = 2026;

export function weeksInYear(year: number): number {
  return getISOWeeksInYear(new Date(year, 6, 1));
}

export function clampCalendarWeek(year: number, week: number): number {
  const max = weeksInYear(year);
  if (!Number.isFinite(week) || week < 1) return 1;
  if (week > max) return max;
  return Math.floor(week);
}

/** ISO calendar week for `date` when its ISO week-year matches `year`, else null. */
export function calendarWeekInYear(date: Date, year: number): number | null {
  if (getISOWeekYear(date) !== year) return null;
  return getISOWeek(date);
}

export function currentCalendarWeek(year: number = BOARD_STAT_YEAR): number {
  const now = new Date();
  if (getISOWeekYear(now) === year) {
    return getISOWeek(now);
  }
  if (getISOWeekYear(now) > year) {
    return weeksInYear(year);
  }
  return 1;
}

/** Inclusive YTD window: Jan 1 00:00 through end of ISO week `week`. */
export function ytdRangeThroughWeek(
  year: number,
  week: number
): { start: Date; end: Date; week: number } {
  const clamped = clampCalendarWeek(year, week);
  const anchor = setISOWeek(startOfYear(new Date(year, 0, 4)), clamped);
  const end = endOfISOWeek(anchor);
  const start = startOfYear(new Date(year, 0, 1));
  return { start, end, week: clamped };
}

export function weekLabel(year: number, week: number): string {
  return `Calendar week ${week}, ${year}`;
}

/** First ISO week of each month — for slider tick marks (~monthly). */
export function monthWeekTicks(
  year: number,
  maxWeek: number
): { week: number; label: string }[] {
  const ticks: { week: number; label: string }[] = [];
  for (let month = 0; month < 12; month += 1) {
    const d = new Date(year, month, 1);
    const cw = getISOWeek(d);
    const isoYear = getISOWeekYear(d);
    if (isoYear === year && cw >= 1 && cw <= maxWeek) {
      ticks.push({ week: cw, label: format(d, 'MMM') });
    }
  }
  if (ticks.length === 0 || ticks[0]!.week > 1) {
    ticks.unshift({ week: 1, label: 'Jan' });
  }
  const last = ticks[ticks.length - 1];
  if (!last || last.week < maxWeek) {
    ticks.push({ week: maxWeek, label: format(new Date(year, 11, 1), 'MMM') });
  }
  return ticks;
}

export function isoWeekStart(year: number, week: number): Date {
  return startOfISOWeek(setISOWeek(startOfYear(new Date(year, 0, 4)), week));
}

export function isoWeekEnd(year: number, week: number): Date {
  return endOfISOWeek(setISOWeek(startOfYear(new Date(year, 0, 4)), week));
}

/** Date input value (YYYY-MM-DD) for the end of the selected ISO week. */
export function boardDateInputValue(year: number, week: number): string {
  return format(isoWeekEnd(year, clampCalendarWeek(year, week)), 'yyyy-MM-dd');
}

/** Map a calendar date to board year + ISO week (week-year aware). */
export function weekContextFromDate(date: Date): { year: number; calendarWeek: number } {
  const isoYear = getISOWeekYear(date);
  return {
    year: isoYear,
    calendarWeek: clampCalendarWeek(isoYear, getISOWeek(date)),
  };
}

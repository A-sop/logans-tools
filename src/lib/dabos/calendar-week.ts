/**
 * Board week helpers. Since Dept11 2026-10-30 a board "week" is the DABOS STAT week from
 * `org-week.ts` (Thu 14:00 Europe/Berlin close; Friday is already the new week), labelled with
 * the ISO week of its closing Thursday - not the ISO Monday-Sunday calendar week. The
 * `calendarWeek` / `?cw=` names are kept for URL and API compatibility; the numbers keep the
 * same 1..52/53 range per year (2026-W44 = Thu 2026-10-22 14:00 -> Thu 2026-10-29 14:00 Berlin).
 */
import {
  berlinLocalToUtc,
  statWeekOf,
  statWeeksInYear,
  statWeekWindow,
} from '@/lib/dabos/org-week';

/** Board default stat year (YTD window). */
export const BOARD_STAT_YEAR = 2026;

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function weeksInYear(year: number): number {
  return statWeeksInYear(year);
}

export function clampCalendarWeek(year: number, week: number): number {
  const max = weeksInYear(year);
  if (!Number.isFinite(week) || week < 1) return 1;
  if (week > max) return max;
  return Math.floor(week);
}

/** Stat week containing `date` when its label year matches `year`, else null. */
export function calendarWeekInYear(date: Date, year: number): number | null {
  const w = statWeekOf(date);
  if (w.isoYear !== year) return null;
  return w.isoWeek;
}

/** Running stat week (the one containing `now`), clamped to `year`. */
export function currentCalendarWeek(year: number = BOARD_STAT_YEAR, now: Date = new Date()): number {
  const w = statWeekOf(now);
  if (w.isoYear === year) return w.isoWeek;
  if (w.isoYear > year) return weeksInYear(year);
  return 1;
}

/**
 * Inclusive YTD window: start of stat week 1 of `year` (Thu 14:00 Berlin before the first
 * closing Thursday) through the last millisecond before the close of stat week `week`.
 */
export function ytdRangeThroughWeek(
  year: number,
  week: number
): { start: Date; end: Date; week: number } {
  const clamped = clampCalendarWeek(year, week);
  const start = statWeekWindow(year, 1).start;
  const end = new Date(statWeekWindow(year, clamped).end.getTime() - 1);
  return { start, end, week: clamped };
}

export function weekLabel(year: number, week: number): string {
  return `Stat week ${week}, ${year}`;
}

/** Stat week containing the 1st of each month - for slider tick marks (~monthly). */
export function monthWeekTicks(
  year: number,
  maxWeek: number
): { week: number; label: string }[] {
  const ticks: { week: number; label: string }[] = [];
  for (let month = 0; month < 12; month += 1) {
    const w = statWeekOf(berlinLocalToUtc(year, month + 1, 1, 12));
    if (w.isoYear === year && w.isoWeek >= 1 && w.isoWeek <= maxWeek) {
      ticks.push({ week: w.isoWeek, label: MONTH_SHORT[month]! });
    }
  }
  if (ticks.length === 0 || ticks[0]!.week > 1) {
    ticks.unshift({ week: 1, label: 'Jan' });
  }
  const last = ticks[ticks.length - 1];
  if (!last || last.week < maxWeek) {
    ticks.push({ week: maxWeek, label: 'Dec' });
  }
  return ticks;
}

/** Opening Thursday 14:00 Berlin of stat week `year`-W`week` (inclusive). */
export function statWeekStart(year: number, week: number): Date {
  return statWeekWindow(year, week).start;
}

/** Closing Thursday 14:00 Berlin of stat week `year`-W`week` (exclusive). */
export function statWeekEnd(year: number, week: number): Date {
  return statWeekWindow(year, week).end;
}

/** Date input value (YYYY-MM-DD): the closing Thursday of the selected stat week (Berlin). */
export function boardDateInputValue(year: number, week: number): string {
  return statWeekWindow(year, clampCalendarWeek(year, week)).endDate;
}

/** Map an instant to board year + stat week (the week containing it). */
export function weekContextFromDate(date: Date): { year: number; calendarWeek: number } {
  const w = statWeekOf(date);
  return {
    year: w.isoYear,
    calendarWeek: clampCalendarWeek(w.isoYear, w.isoWeek),
  };
}

/**
 * Map a date-input value (YYYY-MM-DD, read as a Berlin calendar day at 12:00) to board year +
 * stat week. A Thursday maps to the week closing that Thursday (12:00 is before the 14:00 close);
 * Friday..Wednesday map to the week closing the following Thursday. Browser-TZ independent.
 */
export function weekContextFromDateInput(
  value: string
): { year: number; calendarWeek: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  return weekContextFromDate(berlinLocalToUtc(Number(m[1]), Number(m[2]), Number(m[3]), 12));
}

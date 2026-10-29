/**
 * Closed org-week window for the Thursday week-close poster (Dept11 fix, 2026-10-29).
 *
 * Definition (DABOS `.agents/roles/_standing-orders.md` line 47 at A-sop/DABOS main 37aff075:
 * "Stat week: Thursday 14:00 Europe/Berlin close"; `org-week.ts`: stat period 14:00 Thu -> 14:00 Thu):
 *   a week runs from Thursday 14:00 Europe/Berlin (inclusive) to the next Thursday
 *   14:00 Europe/Berlin (exclusive).
 *
 * The poster runs just after the boundary (ln02 timer Thu 14:30 Berlin), so the week it
 * reports is the one that ENDED at the most recent boundary - not the week that just
 * started and not the ISO Monday-Sunday week. The `div-live-YYYY-Www` label is the ISO
 * week of the closing Thursday (W44 = the week closing Thu 2026-10-29 14:00 Berlin).
 *
 * Register entries - PROVISIONAL rule, proposed by Dept11 2026-10-29, pending a Dept14 ruling:
 *  - Timestamped entries (date + HH:MM, optional zone; no zone = Europe/Berlin wall time) use
 *    the exact cutoff: start <= t < end (Thu 14:00 inclusive -> next Thu 14:00 exclusive).
 *  - Date-only entries (YYYY-MM-DD) count when startDate <= date < endDate, i.e. a date-only
 *    week runs opening Thursday..Wednesday. A date-only row cannot prove it was made before the
 *    Thu 14:00 close, and the poster runs at 14:30 with insert-if-not-exists, so a row dated
 *    the closing Thursday is deferred to the NEXT week (whose poster still counts it) instead
 *    of being lost or landing in a week that has already been posted.
 *  Residual gap (any rule with a one-shot poster has one): an entry back-dated into an
 *  already-posted week (e.g. dated Wed but written after the Thu 14:30 run) is not re-posted.
 */
import { getISOWeek, getISOWeekYear } from 'date-fns';

import {
  berlinLocalToUtc,
  ORG_WEEK_TIMEZONE,
  WEEK_BOUNDARY_HOUR,
  weekBoundaryStart,
} from './org-week';

export type ClosedOrgWeek = {
  /** Opening Thursday 14:00 Europe/Berlin (inclusive). */
  start: Date;
  /** Closing Thursday 14:00 Europe/Berlin (exclusive). */
  end: Date;
  /** Berlin calendar date of the opening Thursday (YYYY-MM-DD). */
  startDate: string;
  /** Berlin calendar date of the closing Thursday (YYYY-MM-DD). */
  endDate: string;
  /** ISO week-year / week of the closing Thursday (used for workspace labels). */
  isoYear: number;
  isoWeek: number;
  label: string;
};

function berlinDate(d: Date): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ORG_WEEK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** The org week that closed at the most recent Thursday 14:00 Berlin at or before `now`. */
export function closedOrgWeek(now: Date = new Date()): ClosedOrgWeek {
  const end = weekBoundaryStart(now);
  const endDate = berlinDate(end);
  const [y, m, d] = endDate.split('-').map(Number) as [number, number, number];
  const startCal = new Date(Date.UTC(y, m - 1, d - 7));
  const start = berlinLocalToUtc(
    startCal.getUTCFullYear(),
    startCal.getUTCMonth() + 1,
    startCal.getUTCDate(),
    WEEK_BOUNDARY_HOUR,
    0
  );
  const startDate = berlinDate(start);
  // Noon UTC on the closing Thursday's calendar date: same calendar day in any host TZ
  // within +/-11h, so date-fns (host-local) ISO week maths is stable on ln02 (UTC) and HZR52.
  const isoRef = new Date(Date.UTC(y, m - 1, d, 12));
  const isoYear = getISOWeekYear(isoRef);
  const isoWeek = getISOWeek(isoRef);
  return {
    start,
    end,
    startDate,
    endDate,
    isoYear,
    isoWeek,
    label: `Closed org week ${startDate} 14:00 -> ${endDate} 14:00 (${ORG_WEEK_TIMEZONE}), ISO ${isoYear}-W${String(isoWeek).padStart(2, '0')}`,
  };
}

/** Closed org week whose closing Thursday falls in ISO week `year`-W`week`. */
export function closedOrgWeekForIsoWeek(year: number, week: number): ClosedOrgWeek {
  // ISO week 1 contains Jan 4. Thursday of week 1 = Jan 4 shifted to Thursday.
  const jan4 = new Date(Date.UTC(year, 0, 4, 12));
  const isoDow = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay(); // Mon=1..Sun=7
  const thursday = new Date(jan4);
  thursday.setUTCDate(jan4.getUTCDate() + (4 - isoDow) + 7 * (week - 1));
  const close = berlinLocalToUtc(
    thursday.getUTCFullYear(),
    thursday.getUTCMonth() + 1,
    thursday.getUTCDate(),
    WEEK_BOUNDARY_HOUR,
    0
  );
  return closedOrgWeek(close);
}

/** Timestamp inside the window: start <= t < end. */
export function isInClosedOrgWeek(t: Date, w: Pick<ClosedOrgWeek, 'start' | 'end'>): boolean {
  const ms = t.getTime();
  return ms >= w.start.getTime() && ms < w.end.getTime();
}

/**
 * Date-only entry (YYYY-MM-DD): PROVISIONAL (pending Dept14) - counts when
 * startDate <= date < endDate (opening Thu..Wed). A closing-Thursday date belongs to the next week.
 */
export function isDateInClosedOrgWeek(
  date: string,
  w: Pick<ClosedOrgWeek, 'startDate' | 'endDate'>
): boolean {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(date.trim());
  if (!m?.[1]) return false;
  return m[1] >= w.startDate && m[1] < w.endDate;
}

/** Regex source for a register date with optional time + zone (for embedding in extractors). */
export const REGISTER_DATE_TIME_SOURCE =
  '\\d{4}-\\d{2}-\\d{2}(?:[T ]\\d{2}:\\d{2}(?::\\d{2})?(?:\\.\\d+)?(?:\\s?(?:Z|[+-]\\d{2}:?\\d{2}))?)?';

export type RegisterEntryTime = { kind: 'date'; date: string } | { kind: 'instant'; at: Date };

/** Parse a register value: 'YYYY-MM-DD' (date-only) or 'YYYY-MM-DD HH:MM[:SS][Z|+hh:mm]'. */
export function parseRegisterEntryTime(value: string): RegisterEntryTime | null {
  const m =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:\s?(Z|[+-]\d{2}:?\d{2}))?)?/.exec(
      value.trim()
    );
  if (!m) return null;
  const [, y, mo, d, hh, mi, ss, zone] = m;
  const date = `${y}-${mo}-${d}`;
  if (hh == null || mi == null) return { kind: 'date', date };
  if (zone) {
    const z = zone === 'Z' ? 'Z' : zone.includes(':') ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
    const at = new Date(`${date}T${hh}:${mi}:${ss ?? '00'}${z}`);
    return Number.isNaN(at.getTime()) ? null : { kind: 'instant', at };
  }
  const at = berlinLocalToUtc(Number(y), Number(mo), Number(d), Number(hh), Number(mi));
  if (ss) at.setUTCSeconds(Number(ss));
  return { kind: 'instant', at };
}

/** Timestamped entries: exact Thu 14:00 cutoff. Date-only: provisional Thu..Wed rule. */
export function isEntryInClosedOrgWeek(
  value: string,
  w: Pick<ClosedOrgWeek, 'start' | 'end' | 'startDate' | 'endDate'>
): boolean {
  const parsed = parseRegisterEntryTime(value);
  if (!parsed) return false;
  return parsed.kind === 'instant' ? isInClosedOrgWeek(parsed.at, w) : isDateInClosedOrgWeek(parsed.date, w);
}

/** recorded_at for a closed week's stat rows: 1 ms before the close (stays inside the window). */
export function recordedAtForClosedOrgWeek(w: Pick<ClosedOrgWeek, 'end'>): string {
  return new Date(w.end.getTime() - 1).toISOString();
}
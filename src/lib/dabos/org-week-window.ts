/**
 * Closed org-week window for the Thursday week-close poster (Dept11 fix, 2026-10-29) plus the
 * register-entry rules. The week boundary, windows and labels themselves live in `org-week.ts`
 * (single source since Dept11 2026-10-30); they are re-exported here for existing imports.
 *
 * Definition (DABOS `.agents/roles/_standing-orders.md` line 47 at A-sop/DABOS main 37aff075:
 * "Stat week: Thursday 14:00 Europe/Berlin close"; founder ruling 2026-10-30: the stat week
 * closes Thursday, Friday starts the new week):
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
import {
  berlinLocalToUtc,
  type ClosedOrgWeek,
  closedOrgWeek,
  closedOrgWeekForIsoWeek,
  isInClosedOrgWeek,
  recordedAtForClosedOrgWeek,
} from './org-week';

export type { ClosedOrgWeek };
export { closedOrgWeek, closedOrgWeekForIsoWeek, isInClosedOrgWeek, recordedAtForClosedOrgWeek };

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

/**
 * Org stat week: SINGLE SOURCE for the DABOS stat-week boundary and week labels.
 *
 * Boundary: Thursday 14:00 Europe/Berlin (WEEK_BOUNDARY_WEEKDAY / WEEK_BOUNDARY_HOUR), which is
 * also the stats cutoff. Green Volumes: stat period 14:00 Thu -> 14:00 Thu.
 * Founder ruling 2026-10-30 (relayed by LDW Communicator / Div7): "the stat week closes on
 * Thursday and Friday starts the new week". The ruling does not state an hour; this module
 * keeps the existing Thu 14:00 boundary (OPEN QUESTION for Dept13 / Logan: 14:00 vs end of
 * Thursday). Change WEEK_BOUNDARY_HOUR here and every stat-week consumer follows.
 *
 * Week = [Thu 14:00, next Thu 14:00) Berlin. Label `YYYY-Www` = ISO week-year / week of the
 * CLOSING Thursday (2026-W44 = Thu 2026-10-22 14:00 -> Thu 2026-10-29 14:00 Berlin). Every ISO
 * week has exactly one Thursday, so a year has the same number of stat weeks (52/53) as ISO
 * weeks and the existing `div-live-` / `gfp-live-` / `stat-crawl-YYYY-Www` ids keep their format.
 *
 * All week maths here is Berlin wall time + pure UTC arithmetic (no host-TZ date-fns), so the
 * result is the same on Vercel (UTC), ln02 (UTC) and HZR52 (Europe/Berlin).
 */
export const ORG_WEEK_TIMEZONE = 'Europe/Berlin';
export const WEEK_BOUNDARY_HOUR = 14;
export const STATS_DEADLINE_HOUR = 14;
export const WEEK_BOUNDARY_WEEKDAY = 4; // Thursday (0=Sun)

type BerlinParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

function berlinParts(date: Date): BerlinParts {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: ORG_WEEK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '0';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday: weekdayMap[get('weekday')] ?? 0,
  };
}

/** UTC instant for Berlin local wall time. */
export function berlinLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0
): Date {
  const target = { year, month, day, hour, minute };
  let t = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 48; i += 1) {
    const p = berlinParts(new Date(t));
    if (
      p.year === target.year &&
      p.month === target.month &&
      p.day === target.day &&
      p.hour === target.hour &&
      p.minute === target.minute
    ) {
      return new Date(t);
    }
    const pMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const tMs = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute);
    t += tMs - pMs;
  }
  return new Date(t);
}

/** Berlin calendar date of an instant (YYYY-MM-DD). */
export function berlinDateString(d: Date): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ORG_WEEK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Most recent Thursday 14:00 Berlin at or before `date`. */
export function weekBoundaryStart(date: Date = new Date()): Date {
  const p = berlinParts(date);
  let daysBack = (p.weekday - WEEK_BOUNDARY_WEEKDAY + 7) % 7;
  if (daysBack === 0 && p.hour < WEEK_BOUNDARY_HOUR) {
    daysBack = 7;
  }
  const cal = new Date(Date.UTC(p.year, p.month - 1, p.day));
  cal.setUTCDate(cal.getUTCDate() - daysBack);
  return berlinLocalToUtc(
    cal.getUTCFullYear(),
    cal.getUTCMonth() + 1,
    cal.getUTCDate(),
    WEEK_BOUNDARY_HOUR,
    0
  );
}

export function weekBoundaryEnd(start: Date): Date {
  const p = berlinParts(start);
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 7));
  return berlinLocalToUtc(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    WEEK_BOUNDARY_HOUR,
    0
  );
}

export function statsDeadlineForWeek(start: Date): Date {
  const p = berlinParts(start);
  return berlinLocalToUtc(p.year, p.month, p.day, STATS_DEADLINE_HOUR, 0);
}

export function orgWeekLabel(start: Date): string {
  const p = berlinParts(start);
  const end = weekBoundaryEnd(start);
  const ep = berlinParts(end);
  return `Org week ${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')} 14:00 -> ${ep.year}-${String(ep.month).padStart(2, '0')}-${String(ep.day).padStart(2, '0')} 14:00 (${ORG_WEEK_TIMEZONE})`;
}

export function isPastStatsDeadline(now: Date = new Date()): boolean {
  const start = weekBoundaryStart(now);
  const deadline = statsDeadlineForWeek(start);
  return now.getTime() >= deadline.getTime();
}

export function hoursUntilStatsDeadline(now: Date = new Date()): number {
  const deadline = nextStatsDeadline(now);
  return (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
}

/** Next Thursday 14:00 Berlin stats cutoff (rolls forward after it passes). */
export function nextStatsDeadline(now: Date = new Date()): Date {
  const start = weekBoundaryStart(now);
  let deadline = statsDeadlineForWeek(start);
  if (now.getTime() >= deadline.getTime()) {
    const nextStart = weekBoundaryEnd(start);
    deadline = statsDeadlineForWeek(nextStart);
  }
  return deadline;
}

export type StatCutoffSnapshot = {
  deadline_iso: string;
  week_label: string;
  boundary_iso: string;
  timezone: string;
  past_current_deadline: boolean;
};

export function getStatCutoffSnapshot(now: Date = new Date()): StatCutoffSnapshot {
  const start = weekBoundaryStart(now);
  const currentDeadline = statsDeadlineForWeek(start);
  return {
    deadline_iso: nextStatsDeadline(now).toISOString(),
    week_label: orgWeekLabel(start),
    boundary_iso: start.toISOString(),
    timezone: ORG_WEEK_TIMEZONE,
    past_current_deadline: now.getTime() >= currentDeadline.getTime(),
  };
}

// ---------------------------------------------------------------------------
// Stat week labels / windows (Dept11 2026-10-30: single source for every stat-week consumer).
// ---------------------------------------------------------------------------

/** ISO week-year / week of a calendar date (pure UTC arithmetic, host-TZ independent). */
export function isoWeekOfCalendarDate(
  year: number,
  month: number,
  day: number
): { year: number; week: number } {
  const date = Date.UTC(year, month - 1, day);
  const dow = (new Date(date).getUTCDay() + 6) % 7; // Mon=0..Sun=6
  const thursday = new Date(date + (3 - dow) * 86_400_000);
  const isoYear = thursday.getUTCFullYear();
  const dayOfYear = Math.floor((thursday.getTime() - Date.UTC(isoYear, 0, 1)) / 86_400_000);
  return { year: isoYear, week: Math.floor(dayOfYear / 7) + 1 };
}

/** Number of stat weeks labelled in `year` (= ISO weeks in that ISO year: 52 or 53). */
export function statWeeksInYear(year: number): number {
  return isoWeekOfCalendarDate(year, 12, 28).week;
}

export function formatStatWeekId(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Parse `YYYY-Www` (also accepts `YYYY-Ww`). */
export function parseStatWeekId(raw: string): { year: number; week: number } | null {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(raw.trim());
  if (!m) return null;
  return { year: Number(m[1]), week: Number(m[2]) };
}

/** Week label carried by a stats workspace id such as `div-live-2026-W44` / `gfp-live-2026-W44`. */
export function statWeekFromWorkspaceId(
  workspaceId: string | null | undefined
): { year: number; week: number } | null {
  if (!workspaceId) return null;
  const m = /-(\d{4})-W(\d{2})$/.exec(workspaceId);
  if (!m) return null;
  return { year: Number(m[1]), week: Number(m[2]) };
}

export type OrgStatWeek = {
  /** Opening Thursday 14:00 Europe/Berlin (inclusive). */
  start: Date;
  /** Closing Thursday 14:00 Europe/Berlin (exclusive). */
  end: Date;
  /** Berlin calendar date of the opening Thursday (YYYY-MM-DD). */
  startDate: string;
  /** Berlin calendar date of the closing Thursday (YYYY-MM-DD). */
  endDate: string;
  /** ISO week-year / week of the closing Thursday (the stat-week label). */
  isoYear: number;
  isoWeek: number;
  /** `YYYY-Www` */
  id: string;
  label: string;
};

/** Alias kept for org-week-window consumers. */
export type ClosedOrgWeek = OrgStatWeek;

function statWeekEndingAt(end: Date): OrgStatWeek {
  const endDate = berlinDateString(end);
  const [y, m, d] = endDate.split('-').map(Number) as [number, number, number];
  const startCal = new Date(Date.UTC(y, m - 1, d - 7));
  const start = berlinLocalToUtc(
    startCal.getUTCFullYear(),
    startCal.getUTCMonth() + 1,
    startCal.getUTCDate(),
    WEEK_BOUNDARY_HOUR,
    0
  );
  const startDate = berlinDateString(start);
  const iso = isoWeekOfCalendarDate(y, m, d);
  const id = formatStatWeekId(iso.year, iso.week);
  return {
    start,
    end,
    startDate,
    endDate,
    isoYear: iso.year,
    isoWeek: iso.week,
    id,
    label: `Closed org week ${startDate} 14:00 -> ${endDate} 14:00 (${ORG_WEEK_TIMEZONE}), ISO ${id}`,
  };
}

/** The stat week CONTAINING instant `t` (start <= t < end), i.e. the running week at `t`. */
export function statWeekOf(t: Date): OrgStatWeek {
  return statWeekEndingAt(weekBoundaryEnd(weekBoundaryStart(t)));
}

/** The stat week that CLOSED at the most recent Thursday 14:00 Berlin at or before `now`. */
export function closedOrgWeek(now: Date = new Date()): OrgStatWeek {
  return statWeekEndingAt(weekBoundaryStart(now));
}

/** Stat week labelled `year`-W`week` (closing Thursday in that ISO week). */
export function statWeekWindow(year: number, week: number): OrgStatWeek {
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
  return statWeekEndingAt(close);
}

/** Closed org week whose closing Thursday falls in ISO week `year`-W`week` (= statWeekWindow). */
export function closedOrgWeekForIsoWeek(year: number, week: number): OrgStatWeek {
  return statWeekWindow(year, week);
}

/** Timestamp inside the window: start <= t < end. */
export function isInClosedOrgWeek(t: Date, w: Pick<OrgStatWeek, 'start' | 'end'>): boolean {
  const ms = t.getTime();
  return ms >= w.start.getTime() && ms < w.end.getTime();
}

/** recorded_at for a closed week's stat rows: 1 ms before the close (stays inside the window). */
export function recordedAtForClosedOrgWeek(w: Pick<OrgStatWeek, 'end'>): string {
  return new Date(w.end.getTime() - 1).toISOString();
}

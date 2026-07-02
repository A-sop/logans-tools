/**
 * Org week: Thursday 14:00 Europe/Berlin boundary and stats cutoff (same instant).
 * Green Volumes: stat period 14:00 Thu → 14:00 Thu.
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
  return `Org week ${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')} 14:00 → ${ep.year}-${String(ep.month).padStart(2, '0')}-${String(ep.day).padStart(2, '0')} 14:00 (${ORG_WEEK_TIMEZONE})`;
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

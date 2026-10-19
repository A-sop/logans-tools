/** DABOS stat week: [Thu 14:00, next Thu 14:00) Europe/Berlin, labelled by ending Thursday. */

const BERLIN = 'Europe/Berlin';

function berlinParts(d: Date): { y: number; m: number; day: number; h: number; mi: number; wd: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: BERLIN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    day: Number(parts.day),
    h: Number(parts.hour),
    mi: Number(parts.minute),
    wd: wdMap[parts.weekday ?? ''] ?? 0,
  };
}

/** Instant for y-m-d h:mi in Berlin (handles DST via search). */
export function berlinLocalToUtc(y: number, m: number, day: number, h: number, mi: number): Date {
  let lo = Date.UTC(y, m - 1, day, h - 3, mi);
  let hi = Date.UTC(y, m - 1, day, h + 3, mi);
  for (let i = 0; i < 48; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const p = berlinParts(new Date(mid));
    const cmp =
      p.y !== y
        ? p.y - y
        : p.m !== m
          ? p.m - m
          : p.day !== day
            ? p.day - day
            : p.h !== h
              ? p.h - h
              : p.mi - mi;
    if (cmp === 0) return new Date(mid);
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return new Date(Math.floor((lo + hi) / 2));
}

function isoDay(y: number, m: number, day: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Most recent Thursday 14:00 Berlin that is <= instant; week ends 7d later. */
export function statWeekEndingThursday(instant: Date): string {
  const p = berlinParts(instant);
  // Walk back to Thursday calendar date in Berlin
  const daysFromThu = (p.wd - 4 + 7) % 7;
  const thuMs = Date.UTC(p.y, p.m - 1, p.day) - daysFromThu * 86400_000;
  const thuProbe = new Date(thuMs + 12 * 3600_000);
  const tp = berlinParts(thuProbe);
  let start = berlinLocalToUtc(tp.y, tp.m, tp.day, 14, 0);
  if (instant.getTime() < start.getTime()) {
    start = new Date(start.getTime() - 7 * 86400_000);
  }
  const end = new Date(start.getTime() + 7 * 86400_000);
  const ep = berlinParts(end);
  return isoDay(ep.y, ep.m, ep.day);
}

/** Calendar date (yyyy-mm-dd) as 12:00 Berlin. */
export function statWeekForDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return statWeekEndingThursday(berlinLocalToUtc(y, m, d, 12, 0));
}

export function lastNStatWeeks(n: number, from: Date = new Date()): string[] {
  const out: string[] = [];
  let cursor = from;
  for (let i = 0; i < n; i++) {
    const w = statWeekEndingThursday(cursor);
    out.push(w);
    const [y, m, d] = w.split('-').map(Number);
    const end = berlinLocalToUtc(y, m, d, 14, 0);
    cursor = new Date(end.getTime() - 7 * 86400_000 - 60_000);
  }
  return out;
}

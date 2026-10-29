import { describe, expect, it } from 'vitest';

import {
  closedOrgWeek,
  closedOrgWeekForIsoWeek,
  isDateInClosedOrgWeek,
  isInClosedOrgWeek,
  recordedAtForClosedOrgWeek,
} from '@/lib/dabos/org-week-window';

describe('closedOrgWeek (Thu 14:00 -> Thu 14:00 Europe/Berlin)', () => {
  it('at the ln02 run time (Thu 2026-10-29 14:30 Berlin = 13:30Z) closes W44 ending that Thursday', () => {
    const w = closedOrgWeek(new Date('2026-10-29T13:30:00Z'));
    // Oct 22 is CEST (UTC+2), Oct 29 is CET (UTC+1, DST ended Oct 25)
    expect(w.start.toISOString()).toBe('2026-10-22T12:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-10-29T13:00:00.000Z');
    expect(w.startDate).toBe('2026-10-22');
    expect(w.endDate).toBe('2026-10-29');
    expect(w.isoYear).toBe(2026);
    expect(w.isoWeek).toBe(44);
  });

  it('before the Thursday 14:00 boundary still reports the previous closed week (W43)', () => {
    const w = closedOrgWeek(new Date('2026-10-29T12:59:00Z')); // 13:59 Berlin
    expect(w.endDate).toBe('2026-10-22');
    expect(w.isoWeek).toBe(43);
  });

  it('mid-week (Tue) reports the last closed week, not the running or ISO week', () => {
    const w = closedOrgWeek(new Date('2026-11-03T10:00:00Z'));
    expect(w.endDate).toBe('2026-10-29');
    expect(w.isoWeek).toBe(44);
  });

  it('closedOrgWeekForIsoWeek(2026, 44) is the same window', () => {
    const a = closedOrgWeekForIsoWeek(2026, 44);
    const b = closedOrgWeek(new Date('2026-10-29T13:30:00Z'));
    expect(a.start.toISOString()).toBe(b.start.toISOString());
    expect(a.end.toISOString()).toBe(b.end.toISOString());
    expect(closedOrgWeekForIsoWeek(2026, 1).endDate).toBe('2026-01-01');
  });

  it('window membership: start inclusive, end exclusive; recorded_at stays inside', () => {
    const w = closedOrgWeek(new Date('2026-10-29T13:30:00Z'));
    expect(isInClosedOrgWeek(new Date('2026-10-22T12:00:00Z'), w)).toBe(true);
    expect(isInClosedOrgWeek(new Date('2026-10-29T13:00:00Z'), w)).toBe(false);
    expect(isInClosedOrgWeek(new Date(recordedAtForClosedOrgWeek(w)), w)).toBe(true);
    expect(recordedAtForClosedOrgWeek(w)).toBe('2026-10-29T12:59:59.999Z');
  });

  it('date-only entries count Fri..closing Thu', () => {
    const w = closedOrgWeek(new Date('2026-10-29T13:30:00Z'));
    expect(isDateInClosedOrgWeek('2026-10-22', w)).toBe(false); // opening Thu = previous week
    expect(isDateInClosedOrgWeek('2026-10-23', w)).toBe(true);
    expect(isDateInClosedOrgWeek('2026-10-26', w)).toBe(true); // ISO W44 Monday
    expect(isDateInClosedOrgWeek('2026-10-29', w)).toBe(true); // closing Thu
    expect(isDateInClosedOrgWeek('2026-10-30', w)).toBe(false); // ISO W44 Friday, next org week
    expect(isDateInClosedOrgWeek('not a date', w)).toBe(false);
  });
});
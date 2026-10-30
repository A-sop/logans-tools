import { describe, expect, it } from 'vitest';

import {
  closedOrgWeek,
  closedOrgWeekForIsoWeek,
  isDateInClosedOrgWeek,
  isEntryInClosedOrgWeek,
  isInClosedOrgWeek,
  parseRegisterEntryTime,
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

  it('date-only entries (PROVISIONAL, pending Dept14) count opening Thu..Wed', () => {
    const w = closedOrgWeek(new Date('2026-10-29T13:30:00Z'));
    expect(isDateInClosedOrgWeek('2026-10-22', w)).toBe(true); // opening Thu
    expect(isDateInClosedOrgWeek('2026-10-23', w)).toBe(true);
    expect(isDateInClosedOrgWeek('2026-10-26', w)).toBe(true); // ISO W44 Monday
    expect(isDateInClosedOrgWeek('2026-10-28', w)).toBe(true); // Wednesday
    expect(isDateInClosedOrgWeek('2026-10-29', w)).toBe(false); // closing Thu -> next week
    expect(isDateInClosedOrgWeek('2026-10-30', w)).toBe(false);
    expect(isDateInClosedOrgWeek('not a date', w)).toBe(false);
  });

  it('a date-only closing-Thursday row is not lost: the next poster (W45) counts it', () => {
    const w44 = closedOrgWeek(new Date('2026-10-29T13:30:00Z'));
    const w45 = closedOrgWeek(new Date('2026-11-05T13:30:00Z'));
    expect(isEntryInClosedOrgWeek('2026-10-29', w44)).toBe(false);
    expect(isEntryInClosedOrgWeek('2026-10-29', w45)).toBe(true);
    // every calendar day lands in exactly one week
    for (const d of ['2026-10-21', '2026-10-22', '2026-10-28', '2026-10-29', '2026-11-04', '2026-11-05']) {
      const w43 = closedOrgWeek(new Date('2026-10-22T12:30:00Z'));
      const hits = [w43, w44, w45, closedOrgWeek(new Date('2026-11-12T13:30:00Z'))].filter((w) =>
        isEntryInClosedOrgWeek(d, w)
      );
      expect(hits).toHaveLength(1);
    }
  });

  it('timestamped entries use the exact Thu 14:00 Berlin cutoff', () => {
    const w = closedOrgWeek(new Date('2026-10-29T13:30:00Z'));
    expect(isEntryInClosedOrgWeek('2026-10-29 13:59', w)).toBe(true); // Berlin wall time
    expect(isEntryInClosedOrgWeek('2026-10-29 14:00', w)).toBe(false);
    expect(isEntryInClosedOrgWeek('2026-10-29T14:15', w)).toBe(false); // between 14:00 and the 14:30 run
    expect(isEntryInClosedOrgWeek('2026-10-22 13:59', w)).toBe(false); // opening Thu before 14:00 (CEST)
    expect(isEntryInClosedOrgWeek('2026-10-22 14:00', w)).toBe(true);
    expect(isEntryInClosedOrgWeek('2026-10-29T12:59:59Z', w)).toBe(true); // explicit zone
    expect(isEntryInClosedOrgWeek('2026-10-29T14:00:00+01:00', w)).toBe(false);
  });

  it('parseRegisterEntryTime distinguishes date-only from timestamps', () => {
    expect(parseRegisterEntryTime('2026-10-29')).toEqual({ kind: 'date', date: '2026-10-29' });
    expect(parseRegisterEntryTime('2026-10-29 · Turnaround')).toEqual({ kind: 'date', date: '2026-10-29' });
    const ts = parseRegisterEntryTime('2026-10-29 13:59');
    expect(ts?.kind === 'instant' && ts.at.toISOString()).toBe('2026-10-29T12:59:00.000Z');
    expect(parseRegisterEntryTime('pending')).toBeNull();
  });
});
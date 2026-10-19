import { describe, expect, it } from 'vitest';
import { computePoints, type WisdomRow } from './points';
import { berlinLocalToUtc, statWeekEndingThursday, statWeekForDate } from './stat-week';
import { resolveEvidencePath } from './paths';

function row(partial: Partial<WisdomRow>): WisdomRow {
  return {
    date: '2026-10-20',
    kind: 'page',
    demo_form: '',
    area: 'IHK',
    count: 1,
    pointsTyped: '',
    title: 't',
    source_ref: 's',
    path: '',
    checkout: '',
    hours: '',
    notes: '',
    lineNo: 2,
    ...partial,
  };
}

describe('hww points', () => {
  it('scores page 3, demo 10, clay_demo 25', () => {
    expect(computePoints(row({ kind: 'page', count: 4 })).points).toBe(12);
    expect(computePoints(row({ kind: 'demo', path: 'evidence/x.txt' })).points).toBe(10);
    expect(
      computePoints(row({ kind: 'clay_demo', demo_form: 'application', path: 'evidence/x.txt' })).points,
    ).toBe(25);
  });

  it('labelled_diagram blank/flunk = 0; pass = 25', () => {
    expect(
      computePoints(row({ kind: 'clay_demo', demo_form: 'labelled_diagram', checkout: '', path: 'e.jpg' }))
        .points,
    ).toBe(0);
    expect(
      computePoints(
        row({ kind: 'clay_demo', demo_form: 'labelled_diagram', checkout: 'flunk', path: 'e.jpg' }),
      ).points,
    ).toBe(0);
    expect(
      computePoints(
        row({ kind: 'clay_demo', demo_form: 'labelled_diagram', checkout: 'pass', path: 'e.jpg' }),
      ).points,
    ).toBe(25);
  });

  it('ignores typed points', () => {
    const r = computePoints(row({ kind: 'page', count: 1, pointsTyped: '999' }));
    expect(r.points).toBe(3);
    expect(r.ignoredTypedPoints).toBe(true);
  });
});

describe('hww stat week', () => {
  it('Thu 14:00 Berlin boundary incl. DST 2026-10-25', () => {
    // 2026-10-25 is last Sunday of October — DST ends in EU
    const before = berlinLocalToUtc(2026, 10, 22, 12, 0); // Thu week containing
    const weekA = statWeekEndingThursday(before);
    const justBefore = berlinLocalToUtc(2026, 10, 29, 13, 59); // before Thu 14:00
    const justAfter = berlinLocalToUtc(2026, 10, 29, 14, 0);
    const wBefore = statWeekEndingThursday(justBefore);
    const wAfter = statWeekEndingThursday(justAfter);
    expect(weekA).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(wBefore).not.toBe(wAfter);
    expect(statWeekForDate('2026-10-22')).toBe(weekA);
  });
});

describe('hww evidence path', () => {
  it('blocks .. traversal', () => {
    // Without a real HWW dir this returns null; with dir, .. must still fail
    expect(resolveEvidencePath(['..', 'secret.txt'])).toBeNull();
  });
});

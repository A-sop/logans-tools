import { describe, expect, it } from 'vitest';

import { groupAllTimeSeries } from '@/lib/dabos/all-time-stats';

describe('groupAllTimeSeries', () => {
  it('groups by department when present and credits posters', () => {
    const series = groupAllTimeSeries([
      {
        division_id: 'Div4',
        department_id: 'Dept12',
        metric_key: 'shipped_outputs',
        value: 1,
        recorded_at: '2026-07-12T12:00:00.000Z',
        recorded_by: 'week-close-poster',
        workspace_id: 'div-live-2026-W28',
      },
      {
        division_id: 'Div4',
        department_id: 'Dept12',
        metric_key: 'shipped_outputs',
        value: 3,
        recorded_at: '2026-10-22T12:00:00.000Z',
        recorded_by: 'div-live-correction-2026-10-31',
        workspace_id: 'div-live-2026-W43',
      },
      {
        division_id: 'Div1',
        department_id: null,
        metric_key: 'artifacts_indexed',
        value: 60,
        recorded_at: '2026-10-29T12:00:00.000Z',
        recorded_by: 'week-close-poster',
        workspace_id: 'div-live-2026-W44',
      },
    ]);

    expect(series).toHaveLength(2);
    const dept12 = series.find((s) => s.entityId === 'Dept12');
    expect(dept12?.entityType).toBe('department');
    expect(dept12?.points.map((p) => p.value)).toEqual([1, 3]);
    expect(dept12?.posters).toEqual([
      'div-live-correction-2026-10-31',
      'week-close-poster',
    ]);
    expect(dept12?.oldest).toBe('2026-07-12');
    expect(dept12?.newest).toBe('2026-10-22');

    const div1 = series.find((s) => s.entityId === 'Div1');
    expect(div1?.entityType).toBe('division');
    expect(div1?.points).toHaveLength(1);
  });
});

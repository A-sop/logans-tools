// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DIV_LIVE_PRIMARY,
  formatWeekStatsRegisterMarkdown,
  type WeekStatsLiveSnapshot,
} from '@/lib/dabos/week-stats-live';

describe('week-stats-live', () => {
  it('maps every division to a div-live primary metric', () => {
    expect(DIV_LIVE_PRIMARY.Div6).toBe('conversions');
    expect(Object.keys(DIV_LIVE_PRIMARY)).toHaveLength(7);
  });

  it('formats a register that marks missing vs reported zero', () => {
    const snap: WeekStatsLiveSnapshot = {
      weekId: '2026-W45',
      divLiveWorkspace: 'div-live-2026-W45',
      gfpLiveWorkspace: 'gfp-live-2026-W45',
      week: {
        start: '2026-10-29T12:00:00.000Z',
        end: '2026-11-05T13:00:00.000Z',
        label: 'test',
      },
      divLiveRows: [
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          workspace_id: 'div-live-2026-W45',
          division_id: 'Div1',
          department_id: null,
          metric_key: 'artifacts_indexed',
          value: 0,
          recorded_at: '2026-11-05T12:59:59.999Z',
          recorded_by: 'week-close-poster',
          basis: null,
        },
      ],
      gfpLiveRows: [],
      provisoLatest: [],
      primaryCoverage: [
        {
          division_id: 'Div1',
          metric_key: 'artifacts_indexed',
          status: 'reported',
          value: 0,
          stats_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          workspace_id: 'div-live-2026-W45',
        },
        {
          division_id: 'Div5',
          metric_key: 'qa_pass_rate',
          status: 'missing',
          value: null,
          stats_id: null,
          workspace_id: null,
        },
      ],
      missingPrimaries: ['Div5'],
    };
    const md = formatWeekStatsRegisterMarkdown(snap);
    expect(md).toContain('**reported**');
    expect(md).toContain('**missing**');
    expect(md).toContain('| Div1 |');
    expect(md).toContain('- Div5');
    expect(md).not.toContain('invent');
  });
});

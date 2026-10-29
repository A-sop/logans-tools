import { describe, expect, it, vi } from 'vitest';

import { conditionRefreshEnabled, runOptInConditionRefresh } from '@/lib/dabos/week-close-refresh';

describe('runOptInConditionRefresh (week-close script + route)', () => {
  it('is off unless DABOS_WEEK_CLOSE_REFRESH_CONDITIONS=1, and does not call refresh', async () => {
    expect(conditionRefreshEnabled({})).toBe(false);
    expect(conditionRefreshEnabled({ DABOS_WEEK_CLOSE_REFRESH_CONDITIONS: 'true' })).toBe(false);
    expect(conditionRefreshEnabled({ DABOS_WEEK_CLOSE_REFRESH_CONDITIONS: '1' })).toBe(true);
    const refresh = vi.fn();
    const out = await runOptInConditionRefresh(false, refresh);
    expect(out).toMatchObject({ skipped: true });
    expect(refresh).not.toHaveBeenCalled();
  });
  it('summarises a successful refresh', async () => {
    const out = await runOptInConditionRefresh(true, async () => ({
      week: { label: 'W44' },
      persisted: { divisions: 7, departments: 21 },
    }));
    expect(out).toEqual({ week: 'W44', persisted: { divisions: 7, departments: 21 } });
  });
  it('captures a refresh error instead of throwing (crawl + role_run still run)', async () => {
    const out = await runOptInConditionRefresh(true, async () => {
      throw new Error('board query failed');
    });
    expect(out).toEqual({ error: 'board query failed' });
  });
});
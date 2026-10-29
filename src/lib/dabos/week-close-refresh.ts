/**
 * Opt-in condition refresh for week-close (script + cron route share this).
 * Off by default: week-close reports conditions, it does not assign them (Dept13 FAIL W44).
 * When enabled, a refresh failure is captured in the summary and never aborts the
 * stat crawl / role_run that follow.
 */
export const REFRESH_CONDITIONS_ENV = 'DABOS_WEEK_CLOSE_REFRESH_CONDITIONS';

export type ConditionRefreshResult = {
  week: { label: string };
  persisted: { divisions: number; departments: number };
};

export type ConditionRefreshSummary =
  | { week: string; persisted: { divisions: number; departments: number } }
  | { error: string }
  | { skipped: true; reason: string };

export function conditionRefreshEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env[REFRESH_CONDITIONS_ENV] === '1';
}

export async function runOptInConditionRefresh(
  enabled: boolean,
  refresh: () => Promise<ConditionRefreshResult>
): Promise<ConditionRefreshSummary> {
  if (!enabled) {
    return {
      skipped: true,
      reason: `week-close reports conditions only; set ${REFRESH_CONDITIONS_ENV}=1 to refresh`,
    };
  }
  try {
    const r = await refresh();
    return { week: r.week.label, persisted: r.persisted };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
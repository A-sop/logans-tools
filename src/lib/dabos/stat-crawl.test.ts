import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { DabosSql } from '@/lib/dabos/dabos-connection';
import { closedOrgWeek, statWeekOf } from '@/lib/dabos/org-week';
import { runStatCrawl, statCrawlEarliest } from '@/lib/dabos/stat-crawl';

/** Minimal tagged-template fake: one division with no stats -> missing_emit; records task inserts. */
function fakeSql() {
  const inserts: Array<{ workspaceId: unknown; title: unknown }> = [];
  const roleRuns: unknown[] = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const q = strings.join('?');
    if (q.includes('FROM divisions')) return Promise.resolve([{ id: 'Div2', primary_metric_key: 'leads' }]);
    if (q.includes('FROM stats')) return Promise.resolve([]);
    if (q.includes('SELECT id FROM tasks')) return Promise.resolve([]);
    if (q.includes('INSERT INTO tasks')) {
      inserts.push({ workspaceId: values[0], title: values[1] });
      return Promise.resolve([{ id: `t${inserts.length}` }]);
    }
    if (q.includes('INSERT INTO role_runs')) {
      roleRuns.push(JSON.parse(String(values[0])));
      return Promise.resolve([]);
    }
    throw new Error(`unexpected query: ${q}`);
  }) as unknown as DabosSql;
  return { sql, inserts, roleRuns };
}

/** Next UTC instant matching a weekly "m h * * dow" cron on or after `from` (Vercel crons are UTC). */
function nextCronRun(schedule: string, from: Date): Date {
  const [m, h, dom, mon, dow] = schedule.split(' ');
  expect([dom, mon]).toEqual(['*', '*']);
  const t = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), Number(h), Number(m)));
  while (t.getUTCDay() !== Number(dow) || t < from) t.setUTCDate(t.getUTCDate() + 1);
  return t;
}

const vercel = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
  crons: Array<{ path: string; schedule: string }>;
};
const crawlSchedule = vercel.crons.find((c) => c.path === '/api/dabos/cron/stat-crawl')!.schedule;
const berlin = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);

describe('stat-crawl run time (stats posted by Thu 16:00 Berlin, standing orders Rhythm)', () => {
  it('cron is 15:15 UTC Thursday', () => {
    expect(crawlSchedule).toBe('15 15 * * 4');
  });

  it.each([
    ['CET (winter)', '2026-11-02T00:00:00Z', 'Thu 16:15', '2026-W45'],
    ['CEST (summer)', '2026-07-06T00:00:00Z', 'Thu 17:15', '2026-W28'],
  ])('%s: the cron fires after Thu 16:00 Berlin and crawls the week that closed that day', (_n, from, local, id) => {
    const run = nextCronRun(crawlSchedule, new Date(from));
    expect(berlin(run)).toBe(local);
    const closed = closedOrgWeek(run);
    expect(closed.id).toBe(id);
    expect(run.getTime()).toBeGreaterThanOrEqual(statCrawlEarliest(closed).getTime());
    expect(berlin(statCrawlEarliest(closed))).toBe('Thu 16:00');
    // Same Thursday: the closed week ended at 14:00 Berlin that day.
    expect(run.getTime() - closed.end.getTime()).toBeLessThan(24 * 3600e3);
  });

  it('before 16:00 Berlin it reports missing but opens no tasks (inline week-close at 14:30)', async () => {
    const f = fakeSql();
    const now = new Date('2026-10-29T13:30:00Z'); // Thu 14:30 CET
    const res = await runStatCrawl({ dabosSql: f.sql, now });
    expect(res.missing).toHaveLength(1);
    expect(res.tasks_created).toEqual([]);
    expect(f.inserts).toEqual([]);
    expect(res.tasks_deferred_until).toBe('2026-10-29T15:00:00.000Z');
    expect(f.roleRuns[0]).toMatchObject({ tasks_deferred_until: '2026-10-29T15:00:00.000Z' });
  });

  it('at/after 16:00 Berlin it opens tasks', async () => {
    const f = fakeSql();
    const res = await runStatCrawl({ dabosSql: f.sql, now: new Date('2026-10-29T15:15:00Z') });
    expect(res.tasks_created).toEqual(['t1']);
    expect(res.tasks_deferred_until).toBeUndefined();
  });
});

describe('stat-crawl week label = the closed week it checks', () => {
  it('titles, org_week and workspace use closed W44, not the running W45', async () => {
    const f = fakeSql();
    const now = new Date('2026-10-29T15:15:00Z'); // Thu 16:15 CET, W44 closed at 14:00, W45 running
    const closed = closedOrgWeek(now);
    expect(closed.id).toBe('2026-W44');
    expect(statWeekOf(now).id).toBe('2026-W45');

    const res = await runStatCrawl({ dabosSql: f.sql, now });
    expect(res.org_week).toBe(closed.label);
    expect(res.org_week).toContain('2026-10-22 14:00 -> 2026-10-29 14:00');
    expect(res.org_week).toContain('ISO 2026-W44');
    expect(res.org_week).not.toContain('2026-11-05');
    expect([res.iso_year, res.iso_week]).toEqual([2026, 44]);
    expect(f.inserts).toHaveLength(1);
    expect(f.inserts[0]!.workspaceId).toBe('stat-crawl-2026-W44');
    expect(String(f.inserts[0]!.title)).toBe(
      `[Dept3 crawl] Missing Div2 primary leads for ${closed.label}`
    );
    expect(f.roleRuns[0]).toMatchObject({ org_week: closed.label, iso_week: 44 });
  });
});

// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closedOrgWeek } from '@/lib/dabos/org-week';
import {
  SERVICE_PROPS,
  TIMER_PROPS,
  berlinStamp,
  buildDigest,
  buildTelegramTip,
  collectDigestInput,
  DEFAULT_DIGEST_PULL_URL,
  divisionForDepartment,
  divisionFromTitle,
  errorText,
  fetchRepoPulls,
  insertDigestRow,
  latestVerdict,
  normaliseDivision,
  parseDept13Verdict,
  parseDigestNeedLine,
  parseShowBlocks,
  parseUnitNames,
  readLatestCadenceRuns,
  readLatestStatusDigest,
  readPendingApprovals,
  readStatsPosted,
  readSystemdUserState,
  readTaskCounts,
  sendTelegramTip,
  shaMatches,
  VERDICT_LINE_RE,
  OWNER_POST,
  readCheckoutSyncState,
  checkoutSyncAlerts,
  type CheckoutSyncState,
  type DigestInput,
  type FetchLike,
  type PrSummary,
  type RunCommand,
} from '@/lib/dabos/status-digest';
import { createDabosTestDb, pgliteSql, readRepoFile } from '@/test/pglite-dabos';

const NOW = new Date('2026-11-01T14:00:00Z');
const HEAD = 'abcdef1234567890abcdef1234567890abcdef12';
const OLD = '1111111234567890abcdef1234567890abcdef12';

describe('division mapping', () => {
  it('maps departments to divisions in threes', () => {
    expect(divisionForDepartment(1)).toBe('Div1');
    expect(divisionForDepartment(3)).toBe('Div1');
    expect(divisionForDepartment(10)).toBe('Div4');
    expect(divisionForDepartment(13)).toBe('Div5');
    expect(divisionForDepartment(21)).toBe('Div7');
    expect(divisionForDepartment(22)).toBeNull();
    expect(divisionForDepartment(0)).toBeNull();
  });
  it('normalises case and Dept ids (prod has a lowercase div4 row)', () => {
    expect(normaliseDivision('div4')).toBe('Div4');
    expect(normaliseDivision('DIV 7')).toBe('Div7');
    expect(normaliseDivision('Dept13')).toBe('Div5');
    expect(normaliseDivision(null)).toBe('Unassigned');
    expect(normaliseDivision('Div9')).toBe('Unassigned');
  });
  it('reads the division from a PR title', () => {
    expect(divisionFromTitle('Div4: agent wake rules (RR-010 step 1)')).toBe('Div4');
    expect(divisionFromTitle('Dept14 ruling: void W30')).toBe('Div5');
    expect(divisionFromTitle('fix typo')).toBe('Unassigned');
  });
});

describe('Dept13 verdicts', () => {
  it('parses only an exact first line `Dept13 PASS|FAIL @<40hex>`', () => {
    expect(parseDept13Verdict(`Dept13 PASS @${HEAD}\n\nnotes`)).toEqual({
      verdict: 'PASS',
      sha: HEAD,
    });
    expect(parseDept13Verdict(`Dept13 FAIL @${OLD}\r\n1. reasons`)).toEqual({
      verdict: 'FAIL',
      sha: OLD,
    });
    expect(parseDept13Verdict(`Dept13 FAIL @${OLD}`)).toEqual({ verdict: 'FAIL', sha: OLD });
  });
  it('has no third verdict', () => {
    expect(parseDept13Verdict(`Dept13 CONDITIONAL @${HEAD}`)).toBeNull();
    expect(VERDICT_LINE_RE.source).not.toMatch(/COND/i);
  });
  it('rejects free text, markdown or spacing variants on the first line', () => {
    for (const body of [
      `Dept13 PASS (conditional on #171) @${HEAD}`,
      `Dept13 PASS, items below @${HEAD}`,
      `**Dept13 PASS @${HEAD}**`,
      `Dept 13 PASS @${HEAD}`,
      `dept13 pass @${HEAD}`,
      ` Dept13 PASS @${HEAD}`,
      `Dept13 PASS @${HEAD} thanks`,
      `Dept13 PASS @\`${HEAD}\``,
      `Dept13  PASS @${HEAD}`,
      `Dept13 PASS ${HEAD}`,
    ])
      expect(parseDept13Verdict(body), body).toBeNull();
  });
  it('rejects short, long, uppercase or non-hex shas without truncating', () => {
    expect(parseDept13Verdict(`Dept13 PASS @${HEAD.slice(0, 7)}`)).toBeNull();
    expect(parseDept13Verdict(`Dept13 PASS @${HEAD.slice(0, 39)}`)).toBeNull();
    expect(parseDept13Verdict(`Dept13 PASS @${HEAD}ab`)).toBeNull();
    expect(parseDept13Verdict(`Dept13 PASS @${HEAD}0`)).toBeNull();
    expect(parseDept13Verdict(`Dept13 PASS @${HEAD.toUpperCase()}`)).toBeNull();
    expect(parseDept13Verdict(`Dept13 PASS @${HEAD.slice(0, 39)}g`)).toBeNull();
  });
  it('reads the first line only', () => {
    expect(parseDept13Verdict(`intro\nDept13 PASS @${HEAD}`)).toBeNull();
    expect(parseDept13Verdict(`\nDept13 PASS @${HEAD}`)).toBeNull();
    expect(parseDept13Verdict(`FYI\r\nDept13 FAIL @${HEAD}`)).toBeNull();
  });
  it('ignores bodies without a verdict line or sha', () => {
    expect(parseDept13Verdict('looks good to me')).toBeNull();
    expect(parseDept13Verdict('Dept13 PASS')).toBeNull();
    expect(parseDept13Verdict(null)).toBeNull();
  });
  it('takes the latest valid verdict; a short-sha line is not a verdict', () => {
    const v = latestVerdict([
      { body: `Dept13 FAIL @${OLD}`, at: '2026-11-01T10:00:00Z' },
      { body: `Dept13 PASS @${HEAD.slice(0, 12)}`, at: '2026-11-01T12:00:00Z' },
      { body: 'thanks', at: '2026-11-01T13:00:00Z' },
    ]);
    expect(v).toEqual({ verdict: 'FAIL', sha: OLD, at: '2026-11-01T10:00:00Z' });
  });
  it('counts a verdict as current only for the full equal 40-hex head', () => {
    expect(shaMatches(HEAD, HEAD)).toBe(true);
    expect(shaMatches(HEAD, HEAD.toUpperCase())).toBe(true);
    expect(shaMatches(OLD, HEAD)).toBe(false);
    expect(shaMatches(HEAD.slice(0, 7), HEAD)).toBe(false);
    expect(shaMatches(HEAD.slice(0, 39), HEAD)).toBe(false);
    expect(shaMatches(`${HEAD}00`, HEAD)).toBe(false);
    expect(shaMatches(HEAD, `${HEAD}00`)).toBe(false);
    expect(shaMatches(HEAD.slice(0, 12), HEAD.slice(0, 12))).toBe(false);
    expect(shaMatches('', '')).toBe(false);
  });
});

function fakeGithub(routes: Record<string, unknown>): { fetchFn: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const fetchFn: FetchLike = async (url, init) => {
    calls.push(url);
    expect(init?.headers?.Authorization).toBe('Bearer test-token');
    const path = url.replace('https://api.github.com', '');
    const key = Object.keys(routes).find((k) => path.startsWith(k));
    if (!key) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => routes[key] };
  };
  return { fetchFn, calls };
}

describe('fetchRepoPulls', () => {
  it('marks stale verdicts and keeps only merges from the last 24 h', async () => {
    const { fetchFn } = fakeGithub({
      '/repos/A-sop/DABOS/pulls?state=open': [
        {
          number: 7,
          title: 'Div4: wake rules',
          html_url: 'u7',
          draft: false,
          updated_at: 'x',
          head: { sha: HEAD },
        },
        {
          number: 8,
          title: 'Dept13 ruling',
          html_url: 'u8',
          draft: false,
          updated_at: 'x',
          head: { sha: HEAD },
        },
      ],
      '/repos/A-sop/DABOS/pulls?state=closed': [
        {
          number: 5,
          title: 'Div1: old',
          html_url: 'u5',
          merged_at: '2026-10-30T10:00:00Z',
          updated_at: 'x',
          head: { sha: OLD },
        },
        {
          number: 6,
          title: 'Div2: new',
          html_url: 'u6',
          merged_at: '2026-11-01T09:00:00Z',
          updated_at: 'x',
          head: { sha: OLD },
        },
        {
          number: 4,
          title: 'closed unmerged',
          html_url: 'u4',
          merged_at: null,
          updated_at: 'x',
          head: { sha: OLD },
        },
      ],
      '/repos/A-sop/DABOS/pulls/7/reviews': [
        { body: `Dept13 PASS @${OLD}`, submitted_at: '2026-11-01T10:00:00Z' },
      ],
      '/repos/A-sop/DABOS/issues/7/comments': [
        { body: `Dept13 PASS @${HEAD.slice(0, 7)}`, created_at: '2026-11-01T12:00:00Z' },
        { body: `Dept13 PASS (conditional) @${HEAD}`, created_at: '2026-11-01T12:30:00Z' },
      ],
      '/repos/A-sop/DABOS/pulls/8/reviews': [],
      '/repos/A-sop/DABOS/issues/8/comments': [
        { body: `Dept13 PASS @${HEAD}`, created_at: '2026-11-01T11:00:00Z' },
      ],
    });
    const prs = await fetchRepoPulls({
      fetchFn,
      token: 'test-token',
      repo: 'A-sop/DABOS',
      now: NOW,
    });
    const p7 = prs.find((p) => p.number === 7)!;
    const p8 = prs.find((p) => p.number === 8)!;
    expect(p7.dept13).toMatchObject({ verdict: 'PASS', sha: OLD, current: false });
    expect(p8.dept13).toMatchObject({ verdict: 'PASS', current: true });
    expect(p8.division).toBe('Div5');
    expect(prs.filter((p) => p.state === 'merged').map((p) => p.number)).toEqual([6]);
  });
  it('reports HTTP status without leaking the token', async () => {
    const { fetchFn } = fakeGithub({});
    await expect(
      fetchRepoPulls({ fetchFn, token: 'test-token', repo: 'A-sop/DABOS', now: NOW })
    ).rejects.toThrow(/HTTP 404/);
  });
});

describe('systemd parsing', () => {
  it('parses unit names and show blocks', () => {
    expect(
      parseUnitNames(
        '● dabos-a.timer loaded active waiting x\nchrome-guard.timer loaded active waiting y\n\n'
      )
    ).toEqual(['dabos-a.timer', 'chrome-guard.timer']);
    expect(parseShowBlocks('Id=a.timer\nResult=success\n\nId=b.timer\nResult=failed\n')).toEqual([
      { Id: 'a.timer', Result: 'success' },
      { Id: 'b.timer', Result: 'failed' },
    ]);
  });
  it('never asks systemd for ExecStart or process lists', async () => {
    expect(
      [...TIMER_PROPS, ...SERVICE_PROPS].some((p) => /exec(start|stop)|command/i.test(p))
    ).toBe(false);
    const seen: string[][] = [];
    const run: RunCommand = async (cmd, args) => {
      expect(cmd).toBe('systemctl');
      seen.push(args);
      if (args.includes('--type=timer'))
        return 'dabos-x.timer loaded active waiting X\nother.timer loaded active waiting\n';
      if (args.includes('--state=failed')) return '● dabos-y.service loaded failed failed Y\n';
      if (args.includes('show') && args.includes('dabos-x.timer'))
        return 'Id=dabos-x.timer\nActiveState=active\nSubState=waiting\nResult=success\nLastTriggerUSec=Sun 2026-11-01 14:00:00 CET\nNextElapseUSecRealtime=Sun 2026-11-01 16:00:00 CET\nUnit=dabos-x.service\n';
      if (args.includes('show') && args.includes('dabos-x.service'))
        return 'Id=dabos-x.service\nActiveState=inactive\nSubState=dead\nResult=exit-code\nExecMainStatus=1\n';
      return '';
    };
    const state = await readSystemdUserState(run, /^dabos-/);
    expect(state.timers).toHaveLength(1);
    expect(state.timers[0]).toMatchObject({
      id: 'dabos-x.timer',
      serviceResult: 'exit-code',
      serviceExitStatus: '1',
    });
    expect(state.failedUnits).toEqual(['dabos-y.service']);
    for (const args of seen) {
      expect(args).toContain('--user');
      expect(['list-units', 'show']).toContain(args[2]);
      expect(args.join(' ')).not.toMatch(/ExecStart|ExecStop|cmdline|MainPID/i);
    }
  });
});

function pr(over: Partial<PrSummary>): PrSummary {
  return {
    repo: 'A-sop/logans-tools',
    number: 1,
    title: 'Div4: x',
    url: 'u',
    state: 'open',
    draft: false,
    headSha: HEAD,
    updatedAt: NOW.toISOString(),
    mergedAt: null,
    division: 'Div4',
    dept13: null,
    ...over,
  };
}

function baseInput(over: Partial<DigestInput> = {}): DigestInput {
  return {
    now: NOW,
    host: 'ln02',
    week: closedOrgWeek(NOW),
    prs: [],
    tasks: [],
    approvals: [],
    stats: { Div1: 1, Div2: 1, Div3: 0, Div4: 2, Div5: 1, Div6: 3, Div7: 1 },
    cadence: [],
    systemd: { timers: [], failedUnits: [] },
    checkoutSync: null,
    openOrders: [],
    sourceErrors: [],
    ...over,
  };
}

describe('buildDigest', () => {
  it('puts current-head PASS under Needs Logan and stale or missing verdicts under Needs Dept13', () => {
    const d = buildDigest(
      baseInput({
        prs: [
          pr({ number: 1, dept13: { verdict: 'PASS', sha: HEAD, at: 'x', current: true } }),
          pr({ number: 2, dept13: { verdict: 'PASS', sha: OLD, at: 'x', current: false } }),
          pr({ number: 3 }),
          pr({ number: 4, draft: true }),
          pr({
            number: 5,
            dept13: { verdict: 'FAIL', sha: HEAD, at: 'x', current: true },
            division: 'Div1',
          }),
          pr({ number: 9, state: 'merged', mergedAt: NOW.toISOString(), division: 'Div2' }),
        ],
      })
    );
    expect(d.json.needsLogan).toHaveLength(1);
    expect(d.json.needsLogan[0]).toMatch(/^Ready to merge: logans-tools#1 .*passed this version/);
    expect(d.json.failAtHead).toHaveLength(1);
    expect(d.json.needsDept13.map((s) => s.split(' ')[0])).toEqual([
      'logans-tools#2',
      'logans-tools#3',
    ]);
    expect(d.markdown).toMatch(/reviewed an older commit/);
    expect(d.markdown).toMatch(/^## Failed review at current head \(1\)$/m);
    expect(d.markdown).toMatch(/^## Needs you \(1\)$/m);
    expect(d.markdown).toMatch(/^## Waiting on Dept13 review \(2\)$/m);
    expect(d.markdown).not.toMatch(/CONDITIONAL/);
    expect(d.json.divisions.find((x) => x.division === 'Div1')!.failedAtHead).toBe(1);
    const div4 = d.json.divisions.find((x) => x.division === 'Div4')!;
    expect(div4).toMatchObject({ openPrs: 4, needsDept13: 2, readyForLogan: 1 });
    expect(d.json.divisions.find((x) => x.division === 'Div2')!.mergedLast24h).toBe(1);
  });
  it('covers all seven divisions, flags missing stats, and counts tasks without titles', () => {
    const d = buildDigest(
      baseInput({
        tasks: [
          { division: 'Div4', status: 'todo', basket: 'in', n: 3 },
          { division: 'Div4', status: 'reassess', basket: 'in', n: 2 },
        ],
      })
    );
    for (const div of ['Div1', 'Div2', 'Div3', 'Div4', 'Div5', 'Div6', 'Div7'])
      expect(d.markdown).toContain(`| ${div} |`);
    expect(d.markdown).not.toContain('| Unassigned |');
    expect(d.markdown).toMatch(/\| Div3 \|.*NOT posted \|/);
    expect(d.json.divisions.find((x) => x.division === 'Div4')).toMatchObject({
      openTasks: 3,
      reassessTasks: 2,
    });
  });
  it('lists pending approvals for Logan and machine alerts', () => {
    const d = buildDigest(
      baseInput({
        approvals: [
          {
            id: 'a',
            kind: 'other',
            title: 'Merge yes for logans-tools#60',
            createdAt: NOW.toISOString(),
            division: 'Div4',
          },
        ],
        systemd: {
          timers: [
            {
              id: 'dabos-a.timer',
              activeState: 'active',
              subState: 'waiting',
              result: 'success',
              lastTrigger: 'l',
              next: 'n',
              unit: 'dabos-a.service',
              serviceResult: 'exit-code',
              serviceExitStatus: '1',
            },
          ],
          failedUnits: ['dabos-b.service'],
        },
      })
    );
    expect(d.json.needsLogan[0]).toMatch(/Approval waiting \(other/);
    expect(d.json.machineAlerts).toEqual([
      'dabos-a.service last result exit-code (exit 1)',
      'failed unit dabos-b.service',
    ]);
    expect(d.markdown).toContain('Sun 01 Nov, 15:00 Berlin');
  });
});

describe('ln02 checkout sync (logans-tools #59) in the digest', () => {
  const DIR = '/home/u/.local/state/dabos';
  const files = (m: Record<string, string>) => {
    const read: string[] = [];
    const readText = async (p: string) => {
      read.push(p);
      return p in m ? m[p]! : null;
    };
    return { readText, read };
  };
  const status = (repos: Array<{ repo: string; state: string; message?: string }>) =>
    JSON.stringify({ state: 'ok', ended_at_utc: '2026-11-01T14:07:30Z', repos });

  it('reads only the FAIL flag and the status file', async () => {
    const { readText, read } = files({});
    const c = await readCheckoutSyncState(DIR, readText);
    expect(read).toEqual([`${DIR}/checkout-sync.FAIL`, `${DIR}/checkout-sync.status.json`]);
    expect(c).toMatchObject({ failFlag: false, statusError: 'no status file' });
    expect(checkoutSyncAlerts(c)).toEqual([]);
  });

  it('FAIL flag -> machine alert naming the failing repo and the owner post', async () => {
    const { readText } = files({
      [`${DIR}/checkout-sync.FAIL`]: '2026-11-01T13:52:01Z see status\n',
      [`${DIR}/checkout-sync.status.json`]: status([
        { repo: '/home/u/Dev/logans-tools', state: 'diverged', message: 'left untouched' },
        { repo: '/home/u/Dev/DABOS-weekclose', state: 'up_to_date' },
      ]),
    });
    const c = await readCheckoutSyncState(DIR, readText);
    expect(c.failFlag).toBe(true);
    expect(c.failingRepos.map((r) => r.repo)).toEqual(['logans-tools']);
    const d = buildDigest(baseInput({ checkoutSync: c }));
    expect(OWNER_POST).toBe('Dept12 Production (Div4)');
    expect(d.json.machineAlerts).toEqual([
      'checkout-sync.FAIL present (logans-tools diverged); owner Dept12 Production (Div4)',
    ]);
    expect(d.markdown).toContain('## ln02 checkout sync (owner Dept12 Production (Div4))');
    expect(d.markdown).toContain('- ALERT checkout-sync.FAIL present: 2026-11-01T13:52:01Z see status');
    expect(d.markdown).toContain('- logans-tools: diverged (left untouched)');
    expect(d.json.checkoutSync?.failFlag).toBe(true);
  });

  it('no flag and clean repos -> no alert; the section still renders', async () => {
    const { readText } = files({
      [`${DIR}/checkout-sync.status.json`]: status([
        { repo: '/home/u/Dev/logans-tools', state: 'ok' },
      ]),
    });
    const c = await readCheckoutSyncState(DIR, readText);
    const d = buildDigest(baseInput({ checkoutSync: c }));
    expect(d.json.machineAlerts).toEqual([]);
    expect(d.markdown).toContain('- no checkout-sync.FAIL');
    expect(d.markdown).toContain('- logans-tools: ok');
  });

  it('flag without a readable status still alerts; broken JSON alerts too', async () => {
    const c1 = await readCheckoutSyncState(
      DIR,
      files({ [`${DIR}/checkout-sync.FAIL`]: 'x' }).readText
    );
    expect(checkoutSyncAlerts(c1)).toEqual([
      'checkout-sync.FAIL present (see checkout-sync.status.json); owner Dept12 Production (Div4)',
    ]);
    const c2 = await readCheckoutSyncState(
      DIR,
      files({ [`${DIR}/checkout-sync.status.json`]: '{not json' }).readText
    );
    expect(checkoutSyncAlerts(c2)).toEqual([
      'checkout-sync.status.json unreadable; owner Dept12 Production (Div4)',
    ]);
  });

  it('collectDigestInput reads it when configured', async () => {
    const { readText } = files({ [`${DIR}/checkout-sync.FAIL`]: 'x' });
    const input = await collectDigestInput({
      now: NOW,
      host: 'ln02',
      sql: null,
      github: null,
      run: null,
      checkoutSync: { dir: DIR, readText },
    });
    expect((input.checkoutSync as CheckoutSyncState).failFlag).toBe(true);
    expect(input.sourceErrors.map((e) => e.source)).not.toContain('checkout-sync');
  });

  it('the digest header names the owner post for a failed, missing or stale digest', () => {
    const d = buildDigest(baseInput());
    expect(d.markdown).toContain(
      'If this page is stale (>2h30) or missing: Dept12 Production (Div4).'
    );
    expect(d.json.ownerPost).toBe('Dept12 Production (Div4)');
  });
});

describe('collectDigestInput', () => {
  it('records failing or missing sources instead of crashing', async () => {
    const brokenSql = (() =>
      Promise.reject(new Error('connect failed postgresql://u:p@host/db'))) as never;
    const input = await collectDigestInput({
      now: NOW,
      host: 'ln02',
      sql: brokenSql,
      github: null,
      run: null,
    });
    const d = buildDigest(input);
    expect(input.sourceErrors.map((e) => e.source)).toEqual([
      'github',
      'neon tasks',
      'neon approval_queue',
      'neon stats',
      'neon role_runs',
      'neon open-orders',
      'systemd',
      'checkout-sync',
    ]);
    expect(d.markdown).toContain('## Source errors');
    expect(d.markdown).not.toContain('u:p@host');
    expect(d.markdown).toContain('<connection string>');
  });
  it('redacts tokens in error text', () => {
    expect(errorText(new Error('bad github_pat_ABC123_x and ghp_abc'))).toBe(
      'bad <token> and <token>'
    );
  });
});

describe('Neon readers on PGlite', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await createDabosTestDb();
    await db.exec(readRepoFile('migrations/004_role_runs.sql'));
    await db.exec(readRepoFile('migrations/018_task_ingest_basket.sql'));
    await db.exec(
      `CREATE TABLE IF NOT EXISTS department_establishment (department_id TEXT, comm_line_named BOOLEAN, comm_line TEXT, updated_at TIMESTAMPTZ);`
    );
    await db.exec(readRepoFile('migrations/012_approval_queue.sql'));
    await db.exec(`
      INSERT INTO divisions (id, operational_name) VALUES
        ('Div1','a'),('Div2','b'),('Div3','c'),('Div4','d'),('Div5','e'),('Div6','f'),('Div7','g'),('div4','legacy lowercase');
      INSERT INTO departments (id, division_id, legacy_name, operational_name) VALUES ('Dept13','Div5','x','y');
      INSERT INTO tasks (division_id, title, status, basket) VALUES
        ('Div4','made-up a','todo','in'), ('div4','made-up b','todo','in'), ('Div4','made-up c','done','out'),
        ('Div5','made-up d','blocked','pending');
      INSERT INTO approval_queue (kind, title, status, division_id) VALUES
        ('other','made-up pending','pending','Div4'), ('other','made-up done','approved','Div4');
      INSERT INTO role_runs (role_id, role_type, ran_at) VALUES
        ('morning_plan','cadence','2026-11-01T05:35:00Z'), ('morning_plan','cadence','2026-10-31T05:35:00Z'),
        ('week_close','cadence','2026-10-29T13:30:00Z');
    `);
  });
  afterEach(async () => {
    await db.close();
  });

  it('counts open tasks by normalised division and never returns titles', async () => {
    const rows = await readTaskCounts(pgliteSql(db));
    expect(rows).toEqual(
      expect.arrayContaining([
        { division: 'Div4', status: 'todo', basket: 'in', n: 2 },
        { division: 'Div5', status: 'blocked', basket: 'pending', n: 1 },
      ])
    );
    expect(rows).toHaveLength(2);
    expect(JSON.stringify(rows)).not.toContain('made-up');
  });

  it('reads pending approvals, stats for the closed week, and latest cadence runs', async () => {
    const sql = pgliteSql(db);
    const week = closedOrgWeek(NOW);
    await db.query(
      `INSERT INTO stats (workspace_id, division_id, metric_key, value) VALUES ($1,'Div1','m',1), ($1,'Div2','m',1), ('div-live-2026-W40','Div3','m',1)`,
      [`div-live-${week.id}`]
    );
    await db.query(
      `INSERT INTO stats (workspace_id, division_id, metric_key, value, superseded_at) VALUES ($1,'Div7','m',1, now())`,
      [`div-live-${week.id}`]
    );
    const approvals = await readPendingApprovals(sql);
    expect(approvals.map((a) => a.title)).toEqual(['made-up pending']);
    const stats = await readStatsPosted(sql, week);
    expect(stats).toMatchObject({ Div1: 1, Div2: 1, Div3: 0, Div7: 0 });
    const cad = await readLatestCadenceRuns(sql);
    expect(cad).toEqual([
      { roleId: 'morning_plan', ranAt: '2026-11-01T05:35:00.000Z' },
      { roleId: 'week_close', ranAt: '2026-10-29T13:30:00.000Z' },
    ]);
  });

  it('writes one role_runs row with the markdown', async () => {
    const sql = pgliteSql(db);
    const digest = buildDigest(baseInput());
    await insertDigestRow(sql, digest);
    const r = await db.query<{ role_type: string; md: string; week: string }>(
      `SELECT role_type, summary_json->>'markdown' AS md, summary_json->>'week' AS week FROM role_runs WHERE role_id = 'status_digest'`
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.role_type).toBe('cadence');
    expect(r.rows[0]!.md).toContain('# DABOS status —');
  });
});

describe('grants SQL (not applied by this PR) on PGlite', () => {
  const GRANTS = readRepoFile('scripts/dabos/sql/2026-11-01_status_digest_role_grants.sql');
  const UNDO = readRepoFile('scripts/dabos/sql/2026-11-01_status_digest_role_grants.UNDO.sql');
  let db: PGlite;
  beforeEach(async () => {
    db = await createDabosTestDb();
    await db.exec(readRepoFile('migrations/004_role_runs.sql'));
    await db.exec(
      `CREATE TABLE IF NOT EXISTS department_establishment (department_id TEXT, comm_line_named BOOLEAN, comm_line TEXT, updated_at TIMESTAMPTZ);`
    );
    await db.exec(readRepoFile('migrations/012_approval_queue.sql'));
  });
  afterEach(async () => {
    await db.close();
  });
  const priv = async (t: string, p: string) =>
    (
      await db.query<{ ok: boolean }>(
        `SELECT has_table_privilege('dabos_status_digest', $1, $2) AS ok`,
        [`public.${t}`, p]
      )
    ).rows[0]!.ok;

  it('refuses when the role is missing', async () => {
    await expect(db.exec(GRANTS)).rejects.toThrow(/guard 0/);
    await db.exec('ROLLBACK');
  });
  it('refuses a superuser role', async () => {
    await db.exec('CREATE ROLE dabos_status_digest SUPERUSER');
    await expect(db.exec(GRANTS)).rejects.toThrow(/guard 1/);
    await db.exec('ROLLBACK');
  });
  it('grants read + role_runs insert only, re-runs cleanly, and undoes', async () => {
    await db.exec('CREATE ROLE dabos_status_digest NOLOGIN');
    await db.exec(GRANTS);
    await db.exec(GRANTS);
    for (const t of ['tasks', 'approval_queue', 'stats', 'role_runs', 'divisions', 'departments']) {
      expect(await priv(t, 'SELECT')).toBe(true);
      expect(await priv(t, 'UPDATE')).toBe(false);
      expect(await priv(t, 'DELETE')).toBe(false);
    }
    expect(await priv('role_runs', 'INSERT')).toBe(true);
    expect(await priv('approval_queue', 'INSERT')).toBe(false);
    expect(await priv('conditions', 'SELECT')).toBe(false);
    await db.exec(UNDO);
    await db.exec(UNDO);
    expect(await priv('tasks', 'SELECT')).toBe(false);
    expect(await priv('role_runs', 'INSERT')).toBe(false);
  });

  // Guard 3: no privilege beyond the intended ones on ANY object, and no role memberships.
  const refusesWith = async (setup: string, re: RegExp) => {
    await db.exec('CREATE ROLE dabos_status_digest NOLOGIN');
    await db.exec(setup);
    await expect(db.exec(GRANTS)).rejects.toThrow(re);
    await db.exec('ROLLBACK');
  };
  it('guard 3 refuses a table grant beyond the six', async () => {
    await refusesWith('GRANT SELECT ON public.conditions TO dabos_status_digest', /guard 3d/);
  });
  it('guard 3 refuses a write grant on an intended table', async () => {
    await refusesWith('GRANT UPDATE ON public.tasks TO dabos_status_digest', /guard 3d/);
  });
  it('guard 3 refuses a column grant', async () => {
    await refusesWith('GRANT UPDATE (summary_json) ON public.role_runs TO dabos_status_digest', /guard 3d/);
  });
  it('guard 3 refuses a sequence grant', async () => {
    await refusesWith(
      'CREATE SEQUENCE public.digest_probe_seq; GRANT USAGE ON SEQUENCE public.digest_probe_seq TO dabos_status_digest',
      /guard 3d/
    );
  });
  it('guard 3 refuses a function grant', async () => {
    await refusesWith(
      'CREATE FUNCTION public.digest_probe() RETURNS int LANGUAGE sql AS $f$ SELECT 1 $f$; GRANT EXECUTE ON FUNCTION public.digest_probe() TO dabos_status_digest',
      /guard 3d/
    );
  });
  it('guard 3 refuses CREATE on schema public', async () => {
    await refusesWith('GRANT CREATE ON SCHEMA public TO dabos_status_digest', /guard 3d/);
  });
  it('guard 3 refuses USAGE on another schema', async () => {
    await refusesWith(
      'CREATE SCHEMA digest_probe; GRANT USAGE ON SCHEMA digest_probe TO dabos_status_digest',
      /guard 3d/
    );
  });
  it('guard 3 refuses a database grant', async () => {
    const dbName = (await db.query<{ d: string }>('SELECT current_database() AS d')).rows[0]!.d;
    await refusesWith(`GRANT CREATE ON DATABASE "${dbName}" TO dabos_status_digest`, /guard 3d/);
  });
  it('guard 3 refuses membership in another role', async () => {
    await refusesWith(
      'CREATE ROLE digest_probe_parent NOLOGIN; GRANT digest_probe_parent TO dabos_status_digest',
      /guard 3b/
    );
  });
  it('guard 3 refuses another role being a member of it (beyond the CREATEROLE creator grant)', async () => {
    await refusesWith(
      'CREATE ROLE digest_probe_child NOLOGIN; GRANT dabos_status_digest TO digest_probe_child',
      /guard 3b/
    );
  });
  it('grants succeed when the role was created by a non-superuser CREATEROLE owner (PG16+ implicit admin grant)', async () => {
    await db.exec('CREATE ROLE digest_createrole_owner NOLOGIN CREATEROLE');
    await db.exec('SET ROLE digest_createrole_owner');
    await db.exec('CREATE ROLE dabos_status_digest NOLOGIN');
    await db.exec('RESET ROLE');
    const mem = await db.query<{ member: string; grantor: string; admin_option: boolean }>(
      `SELECT mem.rolname AS member, g.rolname AS grantor, a.admin_option
         FROM pg_auth_members a
         JOIN pg_roles r ON r.oid = a.roleid
         JOIN pg_roles mem ON mem.oid = a.member
         JOIN pg_roles g ON g.oid = a.grantor
        WHERE r.rolname = 'dabos_status_digest'`
    );
    expect(mem.rows).toEqual([
      { member: 'digest_createrole_owner', grantor: 'postgres', admin_option: true },
    ]);
    await db.exec(GRANTS);
    expect(await priv('tasks', 'SELECT')).toBe(true);
    expect(await priv('role_runs', 'INSERT')).toBe(true);
  });
  it('guard 3 still refuses an extra real membership on top of the CREATEROLE creator grant', async () => {
    await db.exec('CREATE ROLE digest_createrole_owner NOLOGIN CREATEROLE');
    await db.exec('SET ROLE digest_createrole_owner');
    await db.exec('CREATE ROLE dabos_status_digest NOLOGIN');
    await db.exec('RESET ROLE');
    await db.exec('CREATE ROLE digest_probe_child NOLOGIN; GRANT dabos_status_digest TO digest_probe_child');
    await expect(db.exec(GRANTS)).rejects.toThrow(/guard 3b/);
    await db.exec('ROLLBACK');
  });
  it('guard 3 refuses an object owned by the role', async () => {
    await refusesWith(
      'CREATE TABLE public.digest_probe_owned (x int); ALTER TABLE public.digest_probe_owned OWNER TO dabos_status_digest',
      /guard 3c/
    );
  });
  it('guard 3 refuses default privileges for the role', async () => {
    await refusesWith(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO dabos_status_digest',
      /guard 3e/
    );
  });
  it('guard 3 refuses a PUBLIC write grant that reaches the role', async () => {
    await refusesWith('GRANT INSERT ON public.conditions TO PUBLIC', /guard 3f/);
  });
  it('guard 3 refuses a PUBLIC sequence grant that reaches the role', async () => {
    await refusesWith(
      'CREATE SEQUENCE public.digest_probe_seq2; GRANT USAGE ON SEQUENCE public.digest_probe_seq2 TO PUBLIC',
      /guard 3f/
    );
  });
  it('a refused run leaves no grant behind (one transaction)', async () => {
    await refusesWith('GRANT SELECT ON public.conditions TO dabos_status_digest', /guard 3d/);
    // The setup ran outside the file's transaction; the file's own GRANTs were rolled back.
    expect(await priv('tasks', 'SELECT')).toBe(false);
    expect(await priv('role_runs', 'INSERT')).toBe(false);
  });
});

describe('ln02 files and runner hygiene', () => {
  const service = readRepoFile('scripts/dabos/ln02/dabos-status-digest.service');
  const timer = readRepoFile('scripts/dabos/ln02/dabos-status-digest.timer');
  const install = readRepoFile('scripts/dabos/ln02/install-status-digest.sh');
  const runner = readRepoFile('scripts/dabos/status-digest.ts');

  it('service loads secrets only from the env file and holds none inline', () => {
    expect(service).toMatch(/^EnvironmentFile=%h\/\.config\/dabos\/status-digest\.env$/m);
    const envLines = service.split(/\r?\n/).filter((l) => l.startsWith('Environment='));
    for (const l of envLines)
      expect(l).not.toMatch(/DATABASE_URL|TOKEN|PASSWORD|postgres(ql)?:\/\//i);
    expect(service).not.toMatch(/ghp_|github_pat_|postgres(ql)?:\/\//);
    expect(service).toMatch(/^ExecStart=@NODE_BIN@\/npm run --silent dabos:status-digest$/m);
  });
  it('timer runs every 2 h plus 12:25 and 20:40 Berlin, persistent', () => {
    const cal = timer.split(/\r?\n/).filter((l) => l.startsWith('OnCalendar='));
    expect(cal).toEqual([
      'OnCalendar=*-*-* 00/2:00:00 Europe/Berlin',
      'OnCalendar=*-*-* 12:25:00 Europe/Berlin',
      'OnCalendar=*-*-* 20:40:00 Europe/Berlin',
    ]);
    expect(timer).toMatch(/^Persistent=true$/m);
    expect(timer).toMatch(/^Unit=dabos-status-digest\.service$/m);
  });
  it('install script changes nothing without --apply and never prints the env file', () => {
    expect(install).toMatch(/^APPLY=0$/m);
    const gate = install.indexOf('if [ "$APPLY" -ne 1 ]; then');
    expect(gate).toBeGreaterThan(0);
    for (const action of [
      'install -m 644',
      'systemctl --user daemon-reload',
      'systemctl --user enable',
    ]) {
      expect(install.indexOf(action)).toBeGreaterThan(gate);
    }
    expect(install).not.toMatch(
      /cat\s+"?\$ENV_FILE|source\s+"?\$ENV_FILE|\.\s+"?\$ENV_FILE|echo\s+"?\$DABOS_DIGEST/
    );
    expect(install).toMatch(/grep -qE "\^\$\{name\}=\.\+" "\$ENV_FILE"/);
  });
  it('runner never loads .env.local and only reads DABOS_DIGEST_* names', () => {
    expect(runner).not.toMatch(/load-env|loadEnvLocal|\.env\.local'|dotenv/);
    const names = [...runner.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]);
    for (const n of names) expect(n).toMatch(/^DABOS_DIGEST_/);
    expect(new Set(names)).toEqual(
      new Set([
        'DABOS_DIGEST_DATABASE_URL',
        'DABOS_DIGEST_GITHUB_TOKEN',
        'DABOS_DIGEST_DRY_RUN',
        'DABOS_DIGEST_SYSTEMD',
        'DABOS_DIGEST_OUT_DIR',
        'DABOS_DIGEST_UNIT_FILTER',
        'DABOS_DIGEST_HOST',
        'DABOS_DIGEST_CHECKOUT_SYNC_DIR',
        'DABOS_DIGEST_TELEGRAM_TIP',
        'DABOS_DIGEST_PULL_URL',
        'DABOS_DIGEST_TELEGRAM_BOT_TOKEN',
        'DABOS_DIGEST_TELEGRAM_CHAT_ID',
      ])
    );
  });
  it('service points the digest at the checkout-sync state dir', () => {
    expect(service).toMatch(/^Environment=DABOS_DIGEST_CHECKOUT_SYNC_DIR=%h\/\.local\/state\/dabos$/m);
  });
  it('doc names the owner post, the exact verdict line, and has no third verdict', () => {
    const doc = readRepoFile('src/docs/dabos/status-digest.md');
    expect(doc).toContain('Owner: **Dept12 Production (Div4)**');
    expect(doc).toContain('checkout-sync.FAIL');
    expect(doc).toContain('`Dept13 PASS @<sha>` or `Dept13 FAIL @<sha>`');
    expect(doc).toContain('https://dabos.logans.tools/digest');
    expect(doc).toContain('DABOS_DIGEST_TELEGRAM_TIP');
    expect(doc).not.toMatch(/CONDITIONAL/);
  });
  it('package.json wires the npm script', () => {
    expect(readRepoFile('package.json')).toContain(
      '"dabos:status-digest": "tsx scripts/dabos/status-digest.ts"'
    );
  });
  it('chrome nav includes Status pull link', () => {
    const chrome = readRepoFile('src/components/dabos/dabos-chrome.tsx');
    expect(chrome).toContain("href: '/dabos/digest'");
    expect(chrome).toContain("label: 'Status'");
  });
});

describe('Telegram tip (ruling 2026-11-08)', () => {
  it('buildTelegramTip is ≤5 lines with counts, needs, and pull URL', () => {
    const dig = buildDigest(baseInput());
    dig.json.needsLogan = [
      'first need',
      'second need that is quite long '.repeat(10).trim(),
      'third',
      'fourth should be dropped',
    ];
    const tip = buildTelegramTip(dig);
    const lines = tip.split('\n');
    expect(lines.length).toBe(5);
    expect(lines[0]).toBe(
      `DABOS status ${berlinStamp(new Date(dig.json.generatedAt))} · needs you:4 · review:0 · alerts:0`
    );
    expect(lines[1]).toBe('• first need');
    expect(lines[2]?.startsWith('• second need')).toBe(true);
    expect(lines[3]).toBe('• third');
    expect(lines[4]).toBe(`Open: ${DEFAULT_DIGEST_PULL_URL}`);
    expect(tip).not.toContain('# DABOS status digest');
    expect(tip).not.toContain('fourth should be dropped');
  });

  it('buildTelegramTip says nothing needs you when empty', () => {
    const dig = buildDigest(baseInput());
    dig.json.needsLogan = [];
    const tip = buildTelegramTip(dig, { pullUrl: 'https://example.test/digest' });
    expect(tip.split('\n')).toEqual([
      `DABOS status ${berlinStamp(new Date(dig.json.generatedAt))} · needs you:0 · review:0 · alerts:0`,
      'Nothing needs you.',
      'Open: https://example.test/digest',
    ]);
  });

  it('buildTelegramTip shortens Ready-to-merge PR lines to ref + title', () => {
    const dig = buildDigest(baseInput());
    dig.json.needsLogan = [
      'Ready to merge: logans-tools#12 @abcdef12: Ship the digest UI — Dept13 passed this version',
    ];
    const tip = buildTelegramTip(dig);
    expect(tip.split('\n')[1]).toBe('• Ready to merge — logans-tools#12: Ship the digest UI');
  });

  it('sendTelegramTip is silent when disabled or missing env', async () => {
    expect(
      await sendTelegramTip({
        text: 'hi',
        enabled: false,
        botToken: 't',
        chatId: '1',
      })
    ).toEqual({ sent: false, reason: 'disabled' });
    expect(
      await sendTelegramTip({
        text: 'hi',
        enabled: true,
        botToken: '',
        chatId: '1',
      })
    ).toEqual({ sent: false, reason: 'missing_env' });
  });

  it('sendTelegramTip POSTs tip text and redacts token on HTTP error', async () => {
    const secret = '123456:ABC-SECRET';
    const calls: Array<{ url: string; body: string }> = [];
    const fetchFn: FetchLike = async (url, init) => {
      calls.push({ url: String(url), body: String(init?.body ?? '') });
      return {
        ok: false,
        status: 401,
        json: async () => ({}),
        text: async () => `unauthorized ${secret}`,
      };
    };
    const r = await sendTelegramTip({
      text: 'tip body',
      enabled: true,
      botToken: secret,
      chatId: '-1001',
      fetchFn,
    });
    expect(r).toEqual({
      sent: false,
      reason: 'http',
      status: 401,
      detail: 'unauthorized <token>',
    });
    expect(calls[0]?.url).toContain(`/bot${secret}/sendMessage`);
    expect(JSON.parse(calls[0]!.body)).toMatchObject({
      chat_id: '-1001',
      text: 'tip body',
      disable_web_page_preview: true,
    });
  });

  it(
    'readLatestStatusDigest returns newest markdown from role_runs',
    async () => {
      const db = await createDabosTestDb();
      await db.exec(readRepoFile('migrations/004_role_runs.sql'));
      const sql = pgliteSql(db);
      await db.exec(`
      INSERT INTO role_runs (role_id, role_type, ran_at, summary_json)
      VALUES (
        'status_digest',
        'cadence',
        '2026-11-01T10:00:00Z',
        '{"host":"ln02","needsLogan":["A"],"needsDept13":[],"machineAlerts":[],"markdown":"# old"}'::jsonb
      );
      INSERT INTO role_runs (role_id, role_type, ran_at, summary_json)
      VALUES (
        'status_digest',
        'cadence',
        '2026-11-01T12:00:00Z',
        '{"host":"ln02","needsLogan":["B"],"needsDept13":["C"],"machineAlerts":["x"],"markdown":"# latest"}'::jsonb
      );
    `);
      const latest = await readLatestStatusDigest(sql);
      expect(latest?.markdown).toBe('# latest');
      expect(latest?.needsLogan).toEqual(['B']);
      expect(latest?.needsDept13).toEqual(['C']);
      expect(latest?.failAtHead).toEqual([]);
      expect(latest?.machineAlerts).toEqual(['x']);
      expect(latest?.host).toBe('ln02');
      await db.close();
    },
    20_000
  );
});

describe('parseDigestNeedLine', () => {
  it('splits ref, title, and note from a PR line', () => {
    expect(
      parseDigestNeedLine(
        'Ready to merge: logans-tools#12 @abcdef12: Ship the digest UI — Dept13 passed this version'
      )
    ).toEqual({
      ref: 'logans-tools#12',
      title: 'Ship the digest UI',
      note: 'Dept13 passed this version',
    });
  });

  it('returns the whole line as title when shape is unknown', () => {
    expect(parseDigestNeedLine('Approval waiting (spend): laptop')).toEqual({
      ref: null,
      title: 'Approval waiting (spend): laptop',
      note: null,
    });
  });
});



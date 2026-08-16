import snapshotJson from '@/data/dabos-open-loops.json';

export type OpenLoopHeat = 'hot' | 'open' | 'ship';
export type OpenLoopSource = 'chat-backlog' | 'ship-board';

export type OpenLoopSegment =
  | 'treasury'
  | 'assets'
  | 'mail'
  | 'esto'
  | 'gfp'
  | 'consulting'
  | 'legal'
  | 'data'
  | 'platform'
  | 'growth'
  | 'other';

/** All 21 org-board departments (cylinder faces). */
export type OpenLoopDept =
  | 'Dept1'
  | 'Dept2'
  | 'Dept3'
  | 'Dept4'
  | 'Dept5'
  | 'Dept6'
  | 'Dept7'
  | 'Dept8'
  | 'Dept9'
  | 'Dept10'
  | 'Dept11'
  | 'Dept12'
  | 'Dept13'
  | 'Dept14'
  | 'Dept15'
  | 'Dept16'
  | 'Dept17'
  | 'Dept18'
  | 'Dept19'
  | 'Dept20'
  | 'Dept21';

export const DEPT_ORDER: OpenLoopDept[] = [
  'Dept1',
  'Dept2',
  'Dept3',
  'Dept4',
  'Dept5',
  'Dept6',
  'Dept7',
  'Dept8',
  'Dept9',
  'Dept10',
  'Dept11',
  'Dept12',
  'Dept13',
  'Dept14',
  'Dept15',
  'Dept16',
  'Dept17',
  'Dept18',
  'Dept19',
  'Dept20',
  'Dept21',
];

/** Short face titles — aligned with org seed operational names. */
export const DEPT_LABELS: Record<OpenLoopDept, string> = {
  Dept1: 'Intake',
  Dept2: 'Coordination',
  Dept3: 'Stats',
  Dept4: 'Content',
  Dept5: 'Channels',
  Dept6: 'Audience',
  Dept7: 'Capital',
  Dept8: 'Ledger',
  Dept9: 'Assets',
  Dept10: 'Systems',
  Dept11: 'Engineering',
  Dept12: 'Production',
  Dept13: 'Validation',
  Dept14: 'Quality',
  Dept15: 'Compliance',
  Dept16: 'Market',
  Dept17: 'Sales',
  Dept18: 'Success',
  Dept19: 'Conditions',
  Dept20: 'Organizing',
  Dept21: 'Executive',
};

export const DEPT_SHORT: Record<OpenLoopDept, string> = {
  Dept1: 'Dept. 1',
  Dept2: 'Dept. 2',
  Dept3: 'Dept. 3',
  Dept4: 'Dept. 4',
  Dept5: 'Dept. 5',
  Dept6: 'Dept. 6',
  Dept7: 'Dept. 7',
  Dept8: 'Dept. 8',
  Dept9: 'Dept. 9',
  Dept10: 'Dept. 10',
  Dept11: 'Dept. 11',
  Dept12: 'Dept. 12',
  Dept13: 'Dept. 13',
  Dept14: 'Dept. 14',
  Dept15: 'Dept. 15',
  Dept16: 'Dept. 16',
  Dept17: 'Dept. 17',
  Dept18: 'Dept. 18',
  Dept19: 'Dept. 19',
  Dept20: 'Dept. 20',
  Dept21: 'Dept. 21',
};

/** Soft lane → owning department (for the drum). */
export const SEGMENT_TO_DEPT: Record<OpenLoopSegment, OpenLoopDept> = {
  mail: 'Dept1',
  data: 'Dept1',
  growth: 'Dept4',
  gfp: 'Dept6',
  treasury: 'Dept8',
  assets: 'Dept9',
  platform: 'Dept11',
  esto: 'Dept20',
  consulting: 'Dept21',
  legal: 'Dept21',
  other: 'Dept21',
};

export const SEGMENT_ORDER: OpenLoopSegment[] = [
  'treasury',
  'assets',
  'mail',
  'esto',
  'gfp',
  'consulting',
  'legal',
  'data',
  'platform',
  'growth',
  'other',
];

export const SEGMENT_LABELS: Record<OpenLoopSegment, string> = {
  treasury: 'Treasury',
  assets: 'Assets / homelab',
  mail: 'Mail',
  esto: 'ESTO / Proviso',
  gfp: 'GFP',
  consulting: 'Consulting',
  legal: 'Legal',
  data: 'DATA / files',
  platform: 'Platform / CI',
  growth: 'Growth / research',
  other: 'Other',
};

export type OpenLoopItem = {
  id: string;
  why: string;
  canonical: string;
  resume: string;
  heat: OpenLoopHeat;
  segment: OpenLoopSegment;
  dept: OpenLoopDept;
  source: OpenLoopSource;
};

export type OpenLoopsGoals = {
  closed_share_target: number;
  hot_max: number;
  open_max: number;
};

export type LastWeekDeptStat = {
  closed: number;
  still_open: number;
};

export type OpenLoopsSnapshot = {
  generated_at: string;
  sources: { backlog: string; shipBoard: string; archive?: string };
  counts: {
    hot: number;
    open: number;
    ship: number;
    still_open?: number;
    closed?: number;
    total: number;
    by_segment: Record<string, number>;
    by_dept?: Record<string, number>;
  };
  /** Rolling 7d from YYMMDD drain ids — closed (archive) vs still open. */
  last_week?: {
    window_days: number;
    since: string;
    closed: number;
    still_open: number;
    by_dept: Record<string, LastWeekDeptStat>;
  };
  goals?: OpenLoopsGoals;
  segments: OpenLoopSegment[];
  depts?: OpenLoopDept[];
  hot: OpenLoopItem[];
  open: OpenLoopItem[];
  ship: OpenLoopItem[];
};

export function lastWeekForDept(
  data: OpenLoopsSnapshot,
  dept: OpenLoopDept
): LastWeekDeptStat {
  return data.last_week?.by_dept?.[dept] ?? { closed: 0, still_open: 0 };
}

const DEFAULT_GOALS: OpenLoopsGoals = {
  closed_share_target: 0.55,
  hot_max: 5,
  open_max: 12,
};

export function getOpenLoopsSnapshot(): OpenLoopsSnapshot {
  return snapshotJson as OpenLoopsSnapshot;
}

export function resolveGoals(data: OpenLoopsSnapshot): OpenLoopsGoals {
  return { ...DEFAULT_GOALS, ...data.goals };
}

export function itemDept(item: OpenLoopItem): OpenLoopDept {
  return item.dept ?? SEGMENT_TO_DEPT[item.segment] ?? 'Dept21';
}

/** Closed share of (closed + still-open drains). Ship board excluded — curated next, not “open debt”. */
export function closedShare(data: OpenLoopsSnapshot): number {
  const closed = data.counts.closed ?? 0;
  const still = data.counts.still_open ?? data.counts.hot + data.counts.open;
  const denom = closed + still;
  if (denom <= 0) return 1;
  return closed / denom;
}

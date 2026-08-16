/**
 * Sync founder-desk open loops → src/data/dabos-open-loops.json
 *
 * Reads DABOS OPEN-CHAT-BACKLOG + SHIP-BOARD (local paths).
 * Run before deploy so Vercel has a fresh snapshot (no DABOS mount on Vercel).
 *
 *   npm run dabos:sync-open-loops
 *   DABOS_ROOT=C:\Dev\DABOS npm run dabos:sync-open-loops
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export type OpenLoopHeat = 'hot' | 'open' | 'ship';
export type OpenLoopSource = 'chat-backlog' | 'ship-board';

/** Founder-desk segment (lane), orthogonal to heat. */
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

/** Soft aims — work is never done; these are pressure gauges, not OKRs. */
export type OpenLoopsGoals = {
  /** closed / (closed + still_open) — aim at or above this */
  closed_share_target: number;
  /** Soft cap on HOT index rows */
  hot_max: number;
  /** Soft cap on non-hot backlog detail sections */
  open_max: number;
};

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

export type LastWeekDeptStat = {
  /** Archive sections whose YYMMDD id falls in the last 7 days. */
  closed: number;
  /** Still-open drains whose YYMMDD id falls in the last 7 days. */
  still_open: number;
};

export type OpenLoopsSnapshot = {
  generated_at: string;
  sources: { backlog: string; shipBoard: string; archive: string };
  counts: {
    hot: number;
    open: number;
    ship: number;
    /** hot + open (still on the wall) */
    still_open: number;
    /** Archived drain sections (closed enough) */
    closed: number;
    total: number;
    by_segment: Record<OpenLoopSegment, number>;
    by_dept: Record<OpenLoopDept, number>;
  };
  /** Rolling 7 days from generated_at — against what was written (YYMMDD ids). */
  last_week: {
    window_days: number;
    since: string;
    closed: number;
    still_open: number;
    by_dept: Record<OpenLoopDept, LastWeekDeptStat>;
  };
  goals: OpenLoopsGoals;
  segments: OpenLoopSegment[];
  depts: OpenLoopDept[];
  hot: OpenLoopItem[];
  open: OpenLoopItem[];
  ship: OpenLoopItem[];
};

/** Count ## YYMMDD_… sections in the archive = closed loops. */
function countArchiveClosed(md: string): number {
  const matches = md.match(/^##\s+\d{6}_[\w-]+/gm);
  return matches?.length ?? 0;
}

/** Parse YYMMDD prefix from drain ids → UTC date at midnight. */
function idDate(id: string): Date | null {
  const m = id.match(/^(\d{2})(\d{2})(\d{2})_/);
  if (!m) return null;
  const y = 2000 + Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (!Number.isFinite(y) || mo < 0 || mo > 11 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mo, d));
}

function emptyLastWeekByDept(): Record<OpenLoopDept, LastWeekDeptStat> {
  return Object.fromEntries(DEPT_ORDER.map((d) => [d, { closed: 0, still_open: 0 }])) as Record<
    OpenLoopDept,
    LastWeekDeptStat
  >;
}

function inLastWeek(id: string, sinceMs: number, untilMs: number): boolean {
  const dt = idDate(id);
  if (!dt) return false;
  const t = dt.getTime();
  return t >= sinceMs && t <= untilMs;
}

/** Archive sections → soft dept via same infer as open loops. */
function parseArchiveSections(md: string): OpenLoopItem[] {
  const sections = md.split(/\r?\n(?=## )/);
  const out: OpenLoopItem[] = [];
  for (const block of sections) {
    const m = block.match(/^##\s+(\d{6}_[\w-]+)\s*\n([\s\S]*)$/);
    if (!m) continue;
    const id = m[1]!;
    const body = m[2] ?? '';
    const why =
      body.match(/\*\*Why open:\*\*\s*(.+)/)?.[1] ??
      body.match(/\*\*Status[^*]*:\*\*\s*(.+)/)?.[1] ??
      body.match(/\*\*Verdict:\*\*\s*(.+)/)?.[1] ??
      body.match(/\*\*Done[^*]*:\*\*\s*(.+)/)?.[1] ??
      body.match(/\*\*Goal:\*\*\s*(.+)/)?.[1] ??
      body
        .split('\n')
        .find((l) => l.startsWith('- ') && !l.includes('**Resume'))
        ?.replace(/^-\s*/, '') ??
      'Archived';
    const canonical =
      body.match(/\*\*SSOT:\*\*\s*(.+)/)?.[1] ??
      body.match(/\*\*Handoff:\*\*\s*(.+)/)?.[1] ??
      body.match(/\*\*Handover:\*\*\s*(.+)/)?.[1] ??
      '';
    out.push(
      withSegment({
        id,
        why: stripMd(why),
        canonical: stripMd(canonical),
        resume: '',
        heat: 'open',
        source: 'chat-backlog',
      })
    );
  }
  return out;
}

function stripMd(s: string): string {
  return s
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferSegment(id: string, why: string, canonical: string, resume: string): OpenLoopSegment {
  const blob = `${id} ${why} ${canonical} ${resume}`.toLowerCase();

  if (/gnucash|treasury|profit.?first|fints|dept08|euer|eür|imbalance|dkb/.test(blob)) return 'treasury';
  if (/vaultwarden|reza|backup|paperless|hermes|media|40_media|jellyfin|immich|ln02|ln01|hzr|homelab|dept09/.test(blob))
    return 'assets';
  if (/watch.?grind|mail.?triage|migadu|inbox|dept01-mail/.test(blob)) return 'mail';
  if (/esto|proviso|zoho.?books|onenote|temp.?logan|dept.?sandbox|a-274|tier-1/.test(blob)) return 'esto';
  if (/gfp|neon|supabase|gabc|cookie|consent|meta.?compliance|c15t/.test(blob)) return 'gfp';
  if (/invoice.?factory|consulting|ronix|cm-inv|fiku|bav/.test(blob)) return 'consulting';
  if (/drsmile|legal|a-294|inkasso/.test(blob)) return 'legal';
  if (/data.?retail|x_tax|00_inbox|onedrive|dil|registry|phantoms/.test(blob)) return 'data';
  if (/dabos.?ci|proper.?ci|ci\/|typecheck|vercel|logans-tools.?ci|open.?loops.?ci|platform/.test(blob))
    return 'platform';
  if (
    /ahrefs|substack|pirate.?lab|immocation|nexxt|idea.?browser|two.?clock|insights|appsumo|experteer|vendor|roi.?allfinanz|jono/.test(
      blob
    )
  )
    return 'growth';

  return 'other';
}

function withSegment(
  partial: Omit<OpenLoopItem, 'segment' | 'dept'>
): OpenLoopItem {
  const segment = inferSegment(partial.id, partial.why, partial.canonical, partial.resume);
  return {
    ...partial,
    segment,
    dept: SEGMENT_TO_DEPT[segment],
  };
}

function emptySegmentCounts(): Record<OpenLoopSegment, number> {
  return Object.fromEntries(SEGMENT_ORDER.map((s) => [s, 0])) as Record<OpenLoopSegment, number>;
}

function emptyDeptCounts(): Record<OpenLoopDept, number> {
  return Object.fromEntries(DEPT_ORDER.map((d) => [d, 0])) as Record<OpenLoopDept, number>;
}

function parseActiveIndexTable(md: string): OpenLoopItem[] {
  const lines = md.split(/\r?\n/);
  const out: OpenLoopItem[] = [];
  let inTable = false;
  for (const line of lines) {
    if (line.startsWith('## Active index')) {
      inTable = true;
      continue;
    }
    if (inTable && line.startsWith('## ')) break;
    if (!inTable) continue;
    if (!line.startsWith('|')) continue;
    if (/^\|\s*-+/.test(line) || /^\|\s*Id\s*\|/i.test(line)) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 4) continue;
    const id = stripMd(cells[0] ?? '').replace(/^`|`$/g, '');
    if (!id || id === 'Id') continue;
    out.push(
      withSegment({
        id,
        why: stripMd(cells[1] ?? ''),
        canonical: stripMd(cells[2] ?? ''),
        resume: stripMd(cells[3] ?? ''),
        heat: 'hot',
        source: 'chat-backlog',
      })
    );
  }
  return out;
}

function parseDetailSections(md: string, hotIds: Set<string>): OpenLoopItem[] {
  const sections = md.split(/\r?\n(?=## )/);
  const out: OpenLoopItem[] = [];
  for (const block of sections) {
    const m = block.match(/^##\s+(\d{6}_[\w-]+)\s*\n([\s\S]*)$/);
    if (!m) continue;
    const id = m[1]!;
    if (hotIds.has(id)) continue;
    const body = m[2] ?? '';
    const why =
      body.match(/\*\*Why open:\*\*\s*(.+)/)?.[1] ??
      body.match(/\*\*Status[^*]*:\*\*\s*(.+)/)?.[1] ??
      body.match(/\*\*In progress:\*\*\s*(.+)/)?.[1] ??
      body.match(/\*\*Goal:\*\*\s*(.+)/)?.[1] ??
      body.match(/\*\*Opened:\*\*\s*(.+)/)?.[1] ??
      body
        .split('\n')
        .find((l) => l.startsWith('- ') && !l.includes('**Resume'))
        ?.replace(/^-\s*/, '') ??
      'See backlog section';
    const canonical =
      body.match(/\*\*SSOT:\*\*\s*(.+)/)?.[1] ??
      body.match(/\*\*Canonical:\*\*\s*(.+)/)?.[1] ??
      body.match(/\*\*Handoff SSOT:\*\*\s*(.+)/)?.[1] ??
      body.match(/\*\*Handover:\*\*\s*(.+)/)?.[1] ??
      body.match(/\*\*Plan SSOT:\*\*\s*(.+)/)?.[1] ??
      body.match(/\*\*Note:\*\*\s*(.+)/)?.[1] ??
      '';
    const resume =
      body.match(/\*\*Resume:\*\*\s*(.+)/)?.[1] ??
      body.match(/\*\*Resume \([^)]*\):\*\*\s*(.+)/)?.[1] ??
      '';
    out.push(
      withSegment({
        id,
        why: stripMd(why),
        canonical: stripMd(canonical),
        resume: stripMd(resume),
        heat: 'open',
        source: 'chat-backlog',
      })
    );
  }
  return out;
}

function parseShipBoard(md: string): OpenLoopItem[] {
  const out: OpenLoopItem[] = [];
  const active = md.split(/## Active/)[1]?.split(/## Strategic/)[0] ?? '';
  for (const line of active.split(/\r?\n/)) {
    const bullet = line.match(/^-\s+\*\*(.+?)\*\*\s*[—–-]\s*(.+)$/);
    if (!bullet) continue;
    const title = stripMd(bullet[1] ?? '');
    const rest = stripMd(bullet[2] ?? '');
    const id = `ship_${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48)}`;
    out.push(
      withSegment({
        id,
        why: rest.slice(0, 280),
        canonical: rest.match(/[\w./\\-]+\.md/)?.[0] ?? '',
        resume: title,
        heat: 'ship',
        source: 'ship-board',
      })
    );
  }
  const tablePart = active.split(/\| # \|/)[1];
  if (tablePart) {
    for (const line of tablePart.split(/\r?\n/)) {
      if (!line.startsWith('|')) continue;
      if (/^\|\s*-+/.test(line)) continue;
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      if (cells.length < 4) continue;
      const num = cells[0];
      if (!/^\d+$/.test(num ?? '')) continue;
      const ship = stripMd(cells[1] ?? '');
      const why = stripMd(cells[2] ?? '');
      const id = `ship_t${num}_${ship
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 40)}`;
      out.push(
        withSegment({
          id,
          why,
          canonical: stripMd(cells[4] ?? ''),
          resume: ship,
          heat: 'ship',
          source: 'ship-board',
        })
      );
    }
  }
  return out;
}

function main() {
  const dabosRoot = resolve(process.env.DABOS_ROOT || join(process.cwd(), '..', 'DABOS'));
  const backlogPath = join(
    dabosRoot,
    'docs/reference/dept21-executive-director/founder-desk/OPEN-CHAT-BACKLOG.md'
  );
  const shipPath = join(
    dabosRoot,
    'docs/reference/dept21-executive-director/founder-desk/SHIP-BOARD.md'
  );
  const archivePath = join(
    dabosRoot,
    'docs/reference/dept21-executive-director/founder-desk/OPEN-CHAT-BACKLOG-ARCHIVE.md'
  );

  if (!existsSync(backlogPath)) {
    console.error(`Missing backlog: ${backlogPath}`);
    process.exit(1);
  }

  const backlogMd = readFileSync(backlogPath, 'utf8');
  const shipMd = existsSync(shipPath) ? readFileSync(shipPath, 'utf8') : '';
  const archiveMd = existsSync(archivePath) ? readFileSync(archivePath, 'utf8') : '';

  const hot = parseActiveIndexTable(backlogMd);
  const hotIds = new Set(hot.map((h) => h.id));
  const open = parseDetailSections(backlogMd, hotIds);
  const ship = shipMd ? parseShipBoard(shipMd) : [];
  const closed = countArchiveClosed(archiveMd);
  const still_open = hot.length + open.length;
  const all = [...hot, ...open, ...ship];

  const by_segment = emptySegmentCounts();
  const by_dept = emptyDeptCounts();
  for (const item of all) {
    by_segment[item.segment] += 1;
    by_dept[item.dept] += 1;
  }

  const generatedAt = new Date();
  const windowDays = 7;
  const untilMs = Date.UTC(
    generatedAt.getUTCFullYear(),
    generatedAt.getUTCMonth(),
    generatedAt.getUTCDate()
  );
  const sinceMs = untilMs - (windowDays - 1) * 24 * 60 * 60 * 1000;
  const sinceIso = new Date(sinceMs).toISOString().slice(0, 10);

  const lastWeekByDept = emptyLastWeekByDept();
  let lwClosed = 0;
  let lwStill = 0;
  for (const item of parseArchiveSections(archiveMd)) {
    if (!inLastWeek(item.id, sinceMs, untilMs)) continue;
    lastWeekByDept[item.dept].closed += 1;
    lwClosed += 1;
  }
  for (const item of [...hot, ...open]) {
    if (!inLastWeek(item.id, sinceMs, untilMs)) continue;
    lastWeekByDept[item.dept].still_open += 1;
    lwStill += 1;
  }

  const goals: OpenLoopsGoals = {
    closed_share_target: 0.55,
    hot_max: 5,
    open_max: 12,
  };

  const snapshot: OpenLoopsSnapshot = {
    generated_at: generatedAt.toISOString(),
    sources: {
      backlog: 'docs/reference/dept21-executive-director/founder-desk/OPEN-CHAT-BACKLOG.md',
      shipBoard: 'docs/reference/dept21-executive-director/founder-desk/SHIP-BOARD.md',
      archive: 'docs/reference/dept21-executive-director/founder-desk/OPEN-CHAT-BACKLOG-ARCHIVE.md',
    },
    counts: {
      hot: hot.length,
      open: open.length,
      ship: ship.length,
      still_open,
      closed,
      total: all.length,
      by_segment,
      by_dept,
    },
    last_week: {
      window_days: windowDays,
      since: sinceIso,
      closed: lwClosed,
      still_open: lwStill,
      by_dept: lastWeekByDept,
    },
    goals,
    segments: SEGMENT_ORDER.filter((s) => by_segment[s] > 0),
    depts: DEPT_ORDER,
    hot,
    open,
    ship,
  };

  const outPath = join(process.cwd(), 'src/data/dabos-open-loops.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  const share =
    closed + still_open > 0 ? Math.round((100 * closed) / (closed + still_open)) : 0;
  const loaded = DEPT_ORDER.filter((d) => by_dept[d] > 0);
  console.log(
    `Wrote ${outPath} — hot=${hot.length} open=${open.length} ship=${ship.length} closed=${closed} closedShare=${share}% lastWeek ↓${lwClosed} open${lwStill} faces=21 loaded=${loaded.join(',')} total=${all.length}`
  );
}

main();

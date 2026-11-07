import fs from 'fs';
import path from 'path';

const APP_ROOT = process.cwd();
const DABOS_ROOT = process.env.DABOS_ROOT?.trim() || 'C:\\Dev\\DABOS';
const DATA_INBOX = path.join('C:', 'DATA', '00_INBOX');
const TRIAGE_MARKER = path.join(APP_ROOT, 'logs', 'daily-triage-last-run.txt');
const WIKI_REVIEW_TARGET_MIN = Number(process.env.INBOX_TARGET_MIN || 75);
const WIKI_REVIEW_TARGET_MAX = Number(process.env.INBOX_TARGET_MAX || 125);

export type PipeStatus = {
  label: string;
  rawCount: number;
  reviewCount: number;
  reviewTargetMin: number;
  reviewTargetMax: number;
  detail: string;
  action: string;
};

export type DailyTriageData = {
  checkedAt: string;
  lastPipelineRun: string | null;
  ranToday: boolean;
  dailyNudge: string;
  dataInbox: PipeStatus;
  wikiCapture: PipeStatus;
  totals: {
    readyForHuman: number;
    rawBacklog: number;
  };
};

function countDirEntries(dir: string, exclude: string[] = []): number {
  try {
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => {
      if (e.name.startsWith('.')) return false;
      if (exclude.includes(e.name)) return false;
      return true;
    }).length;
  } catch {
    return 0;
  }
}

function countWikiReview(): { raw: number; review: number } {
  const inbox = path.join(DABOS_ROOT, 'docs', 'wiki', 'inbox');
  const needsReview = path.join(DABOS_ROOT, 'docs', 'wiki', 'needs_review');
  return {
    raw: countDirEntries(inbox, ['processed', 'README.md']),
    review: countDirEntries(needsReview, ['README.md']),
  };
}

function readLastPipelineRun(): string | null {
  try {
    if (!fs.existsSync(TRIAGE_MARKER)) return null;
    const raw = fs.readFileSync(TRIAGE_MARKER, 'utf8').trim();
    const json = JSON.parse(raw) as { ranAt?: string };
    return json.ranAt ?? raw;
  } catch {
    return null;
  }
}

function ranToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function getDailyTriageData(): DailyTriageData {
  const wiki = countWikiReview();

  let dataInboxFiles = 0;
  try {
    if (fs.existsSync(DATA_INBOX)) {
      const walk = (dir: string, depth: number): number => {
        if (depth > 2) return 0;
        let n = 0;
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          if (ent.name.startsWith('.')) continue;
          if (ent.name.includes('..') || ent.name.includes('/') || ent.name.includes('\\')) continue;
          const full = path.join(dir, ent.name);
          if (ent.isFile()) n += 1;
          else if (ent.isDirectory()) n += walk(full, depth + 1);
        }
        return n;
      };
      dataInboxFiles = walk(DATA_INBOX, 0);
    }
  } catch {
    dataInboxFiles = 0;
  }

  const lastPipelineRun = readLastPipelineRun();
  const readyForHuman = wiki.review;
  const rawBacklog = wiki.raw + dataInboxFiles;

  return {
    checkedAt: new Date().toISOString(),
    lastPipelineRun,
    ranToday: ranToday(lastPipelineRun),
    dailyNudge:
      readyForHuman > 0
        ? `Coffee triage: ${readyForHuman} items ready for you to confirm.`
        : 'Pipeline can refill queues — run daily triage when you have 10 minutes.',
    dataInbox: {
      label: 'C:\\DATA\\00_INBOX',
      rawCount: dataInboxFiles,
      reviewCount: 0,
      reviewTargetMin: WIKI_REVIEW_TARGET_MIN,
      reviewTargetMax: WIKI_REVIEW_TARGET_MAX,
      detail: 'Documents awaiting Paperless consume / Bridge filing to a real DATA home.',
      action: 'File via Paperless + Bridge (or Cursor Dept1). DIL retired 2026-11-06.',
    },
    wikiCapture: {
      label: 'Telegram → wiki',
      rawCount: wiki.raw,
      reviewCount: wiki.review,
      reviewTargetMin: WIKI_REVIEW_TARGET_MIN,
      reviewTargetMax: WIKI_REVIEW_TARGET_MAX,
      detail: 'Ideas, links, photos from Telegram (priority capture).',
      action: 'Confirm triage.md → wiki or DATA.',
    },
    totals: {
      readyForHuman,
      rawBacklog,
    },
  };
}

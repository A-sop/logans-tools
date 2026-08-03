import type { ReviewApproval, ReviewStats } from '@/lib/atlas-ops/document-intake/review-types';

const SESSION_STORAGE_KEY = 'dil-review-session';
const DAY_BASELINE_PREFIX = 'dil-review-day-';

export interface ReviewSessionSnapshot {
  id: string;
  startedAt: string;
  startTodo: number;
  startDecided: number;
  decisions: number;
}

export interface ReviewDayBaseline {
  date: string;
  startTodo: number;
  startDecided: number;
}

export interface MotivationalProgress {
  remaining: number;
  reviewScope: number;
  projectDecided: number;
  projectPercent: number;
  sessionDecisions: number;
  sessionPercent: number;
  dayDecisions: number;
  dayPercent: number;
  message: string;
}

function localDateKey(date = new Date()): string {
  return date.toLocaleDateString('en-CA');
}

function readJson<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(storage: Storage, key: string, value: unknown): void {
  storage.setItem(key, JSON.stringify(value));
}

function projectDecided(stats: ReviewStats): number {
  return stats.yes + stats.no + stats.flag;
}

function reviewScope(stats: ReviewStats): number {
  return stats.todo + stats.later + projectDecided(stats);
}

function isDecision(approved: ReviewApproval): boolean {
  return approved === 'Y' || approved === 'N' || approved === 'L' || approved === 'flag';
}

function percent(part: number, whole: number): number {
  if (whole <= 0) return part > 0 ? 100 : 0;
  return Math.min(100, Math.round((part / whole) * 100));
}

function motivationalMessage(input: {
  remaining: number;
  sessionDecisions: number;
  dayDecisions: number;
  projectPercent: number;
}): string {
  if (input.remaining === 0) return 'Queue clear — nice work.';
  if (input.sessionDecisions >= 50) return 'Deep focus mode — you are flying.';
  if (input.sessionDecisions >= 10) return 'Strong session — keep the rhythm.';
  if (input.dayDecisions >= 25) return 'Solid day — inbox is shrinking.';
  if (input.projectPercent >= 75) return 'Final stretch on this pilot batch.';
  if (input.projectPercent >= 50) return 'Past halfway — momentum is building.';
  if (input.projectPercent >= 25) return 'Good progress — every file counts.';
  if (input.sessionDecisions > 0) return 'Session started — one file at a time.';
  return 'Ready when you are.';
}

export function ensureDayBaseline(stats: ReviewStats): ReviewDayBaseline {
  const date = localDateKey();
  const key = `${DAY_BASELINE_PREFIX}${date}`;
  const existing = readJson<ReviewDayBaseline>(localStorage, key);
  if (existing?.date === date) return existing;

  const baseline: ReviewDayBaseline = {
    date,
    startTodo: stats.todo,
    startDecided: projectDecided(stats),
  };
  writeJson(localStorage, key, baseline);
  return baseline;
}

export function ensureReviewSession(stats: ReviewStats): ReviewSessionSnapshot {
  const existing = readJson<ReviewSessionSnapshot>(sessionStorage, SESSION_STORAGE_KEY);
  if (existing?.id) return existing;

  const session: ReviewSessionSnapshot = {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    startTodo: stats.todo,
    startDecided: projectDecided(stats),
    decisions: 0,
  };
  writeJson(sessionStorage, SESSION_STORAGE_KEY, session);
  return session;
}

export function recordReviewSessionDecision(
  session: ReviewSessionSnapshot,
  approved: ReviewApproval
): ReviewSessionSnapshot {
  if (!isDecision(approved)) return session;
  const next = { ...session, decisions: session.decisions + 1 };
  writeJson(sessionStorage, SESSION_STORAGE_KEY, next);
  return next;
}

export function resetReviewSession(stats: ReviewStats): ReviewSessionSnapshot {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  return ensureReviewSession(stats);
}

export function buildMotivationalProgress(
  stats: ReviewStats,
  session: ReviewSessionSnapshot,
  dayBaseline: ReviewDayBaseline
): MotivationalProgress {
  const remaining = stats.todo;
  const scope = reviewScope(stats);
  const decided = projectDecided(stats);
  const projectPercent = percent(decided, scope);

  const sessionDenominator = Math.max(session.startTodo, 1);
  const sessionPercent = percent(session.decisions, sessionDenominator);

  const dayDecisions = Math.max(0, decided - dayBaseline.startDecided);
  const dayDenominator = Math.max(dayBaseline.startTodo, dayBaseline.startDecided + dayBaseline.startTodo, 1);
  const dayPercent = percent(dayDecisions, dayDenominator);

  return {
    remaining,
    reviewScope: scope,
    projectDecided: decided,
    projectPercent,
    sessionDecisions: session.decisions,
    sessionPercent,
    dayDecisions,
    dayPercent,
    message: motivationalMessage({
      remaining,
      sessionDecisions: session.decisions,
      dayDecisions,
      projectPercent,
    }),
  };
}

export function mergeDayProgress(
  progress: MotivationalProgress,
  serverDayDecisions: number,
  dayBaseline: ReviewDayBaseline
): MotivationalProgress {
  const dayDecisions = Math.max(progress.dayDecisions, serverDayDecisions);
  const dayDenominator = Math.max(dayBaseline.startTodo, dayBaseline.startDecided + dayBaseline.startTodo, 1);
  return {
    ...progress,
    dayDecisions,
    dayPercent: percent(dayDecisions, dayDenominator),
    message: motivationalMessage({
      remaining: progress.remaining,
      sessionDecisions: progress.sessionDecisions,
      dayDecisions,
      projectPercent: progress.projectPercent,
    }),
  };
}

/**
 * PENDING basket rules (Dept2 spec v3 P1–P5). Fields live in ingest_meta.pending.
 * No schema CHECK — validation is in writers.
 */

export type PendingWaitingOn =
  | { kind: 'task'; task_id: string; post?: string; event?: string }
  | { kind: 'post'; post: string; task_id?: string; event?: string }
  | { kind: 'person'; post: string; task_id?: string; event?: string }
  | { kind: 'event'; event: string; task_id?: string; post?: string };

export type PendingMeta = {
  reason: string;
  waiting_on: PendingWaitingOn;
  clear_by?: string | null;
  last_reviewed?: string | null;
  last_checked?: string | null;
  since?: string | null;
  cleared?: boolean;
};

export type PendingValidationOk = { ok: true; pending: PendingMeta };
export type PendingValidationErr = { ok: false; error: string };
export type PendingValidation = PendingValidationOk | PendingValidationErr;

const WAITING_KINDS = new Set(['task', 'post', 'person', 'event']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

/** Parse / validate waiting_on (object form, or legacy bare post string → kind post). */
export function parseWaitingOn(raw: unknown): PendingWaitingOn | null {
  if (typeof raw === 'string') {
    const post = asNonEmptyString(raw);
    return post ? { kind: 'post', post } : null;
  }
  if (!isRecord(raw)) return null;
  const kind = asNonEmptyString(raw.kind);
  if (!kind || !WAITING_KINDS.has(kind)) return null;
  const task_id = asNonEmptyString(raw.task_id) ?? undefined;
  const post = asNonEmptyString(raw.post) ?? undefined;
  const event = asNonEmptyString(raw.event) ?? undefined;
  if (kind === 'task' && !task_id) return null;
  if (kind === 'post' && !post) return null;
  if (kind === 'person' && !post) return null;
  if (kind === 'event' && !event) return null;
  return { kind, task_id, post, event } as PendingWaitingOn;
}

/**
 * P1: refuse pending without reason + waiting_on; stamp since + last_reviewed when missing.
 * Writers call this before INSERT/UPDATE that sets basket='pending'.
 */
export function validateAndStampPending(
  raw: unknown,
  now: Date = new Date()
): PendingValidation {
  if (!isRecord(raw)) {
    return { ok: false, error: 'ingest_meta.pending must be an object with reason and waiting_on' };
  }
  const reason = asNonEmptyString(raw.reason);
  if (!reason) {
    return { ok: false, error: 'pending.reason is required' };
  }
  const waiting_on = parseWaitingOn(raw.waiting_on);
  if (!waiting_on) {
    return {
      ok: false,
      error: 'pending.waiting_on is required (kind task|post|person|event with matching id/post/event)',
    };
  }
  const iso = now.toISOString();
  const pending: PendingMeta = {
    reason,
    waiting_on,
    clear_by: asNonEmptyString(raw.clear_by),
    last_reviewed: asNonEmptyString(raw.last_reviewed) ?? iso,
    last_checked: asNonEmptyString(raw.last_checked),
    since: asNonEmptyString(raw.since) ?? iso,
    cleared: raw.cleared === true,
  };
  return { ok: true, pending };
}

/** Merge stamped pending into ingest_meta for a writer. */
export function withPendingMeta(
  ingestMeta: Record<string, unknown>,
  pending: PendingMeta
): Record<string, unknown> {
  return { ...ingestMeta, pending };
}

/** Explicit one-off re-basket status map (abort if status not listed). */
export const REBASKET_STATUS_MAP = {
  done: { basket: 'out' as const, file: true },
  cancelled: { basket: 'out' as const, file: true },
  todo: { basket: 'in' as const, file: false },
  reassess: { basket: 'pending' as const, file: false, pendingReason: 'reassess' },
} as const;

export type RebasketStatus = keyof typeof REBASKET_STATUS_MAP;

export function mapRebasketStatus(status: string): (typeof REBASKET_STATUS_MAP)[RebasketStatus] | null {
  if (status in REBASKET_STATUS_MAP) {
    return REBASKET_STATUS_MAP[status as RebasketStatus];
  }
  return null;
}

export const PENDING_REVIEW_MAX_HOURS = 72;
export const STALL_PENDING_DAYS = 7;
export const STALL_CLEAR_BY_GRACE_HOURS = 24;
export const STALL_BLOCKER_PENDING_HOURS = 72;
export const STALL_BLOCKER_IN_HOURS = 24;
export const STALL_IN_AFTER_WAKES = 2;

/**
 * P1 writer helper: only way application code should set basket='pending'.
 */
import type { DabosSql } from '@/lib/dabos/dabos-connection';
import {
  validateAndStampPending,
  withPendingMeta,
  type PendingMeta,
} from '@/lib/dabos/comm-center/pending';

export class PendingWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PendingWriteError';
  }
}

/** Validate pending fields and return the ingest_meta object to store. */
export function preparePendingIngestMeta(
  ingestMeta: Record<string, unknown>,
  pendingRaw: unknown,
  now: Date = new Date()
): { ingestMeta: Record<string, unknown>; pending: PendingMeta } {
  const result = validateAndStampPending(pendingRaw, now);
  if (!result.ok) {
    throw new PendingWriteError(result.error);
  }
  return { ingestMeta: withPendingMeta(ingestMeta, result.pending), pending: result.pending };
}

/** Move a task to PENDING with required reason + waiting_on (P1). */
export async function moveTaskToPending(
  sql: DabosSql,
  taskId: string,
  pendingRaw: unknown,
  now: Date = new Date()
): Promise<PendingMeta> {
  const { ingestMeta, pending } = preparePendingIngestMeta({}, pendingRaw, now);
  const updated = await sql`
    UPDATE tasks
       SET basket = 'pending',
           ingest_meta = coalesce(ingest_meta, '{}'::jsonb) || ${JSON.stringify(ingestMeta)}::jsonb,
           updated_at = NOW()
     WHERE id = ${taskId}::uuid
     RETURNING id::text AS id
  `;
  if (updated.length !== 1) {
    throw new PendingWriteError(`task ${taskId} not found`);
  }
  return pending;
}

/** Agent stamp: last_reviewed = now on a pending row (P5). */
export async function stampPendingReviewed(
  sql: DabosSql,
  taskId: string,
  now: Date = new Date()
): Promise<void> {
  const iso = now.toISOString();
  await sql`
    UPDATE tasks
       SET ingest_meta = jsonb_set(
             coalesce(ingest_meta, '{}'::jsonb),
             '{pending,last_reviewed}',
             to_jsonb(${iso}::text),
             true
           ),
           updated_at = NOW()
     WHERE id = ${taskId}::uuid
       AND basket = 'pending'
  `;
}

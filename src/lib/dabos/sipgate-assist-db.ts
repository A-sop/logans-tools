import 'server-only';

import { getDabosSql } from '@/lib/dabos/db';
import type { NormalizedSipgateAssist } from '@/lib/dabos/sipgate-assist';

export type SipgateAssistRow = {
  id: string;
  received_at: string;
  consumed_at: string | null;
  call_id: string | null;
  direction: string | null;
  remote_number: string | null;
  local_number: string | null;
  channel_name: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  headline: string | null;
  summary: string | null;
  action_items: { text: string }[] | null;
  has_transcript: boolean;
};

export async function insertSipgateAssistEvent(
  event: NormalizedSipgateAssist,
  sourceIp: string | null
): Promise<{ id: string; duplicate: boolean }> {
  const sql = getDabosSql();
  const callId = event.callId;
  const startedAt = event.startedAt?.toISOString() ?? null;

  if (callId) {
    const existing = await sql`
      SELECT id FROM sipgate_assist_events WHERE call_id = ${callId} LIMIT 1
    `;
    if (existing[0]?.id) {
      return { id: String(existing[0].id), duplicate: true };
    }
  }

  try {
    const rows = await sql`
      INSERT INTO sipgate_assist_events (
        call_id, direction, remote_number, local_number, channel_name,
        started_at, duration_seconds, headline, summary, action_items,
        has_transcript, payload, source_ip
      ) VALUES (
        ${callId},
        ${event.direction},
        ${event.remoteNumber},
        ${event.localNumber},
        ${event.channelName},
        ${startedAt},
        ${event.durationSeconds},
        ${event.headline},
        ${event.summary},
        ${JSON.stringify(event.actionItems)}::jsonb,
        ${event.hasTranscript},
        ${JSON.stringify(event.payload)}::jsonb,
        ${sourceIp}
      )
      RETURNING id
    `;
    return { id: String(rows[0].id), duplicate: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (callId && /unique|duplicate/i.test(message)) {
      const existing = await sql`
        SELECT id FROM sipgate_assist_events WHERE call_id = ${callId} LIMIT 1
      `;
      if (existing[0]?.id) return { id: String(existing[0].id), duplicate: true };
    }
    throw err;
  }
}

export async function pruneExpiredSipgateAssistEvents(): Promise<void> {
  const sql = getDabosSql();
  await sql`
    DELETE FROM sipgate_assist_events
    WHERE received_at < NOW() - INTERVAL '30 days'
  `;
}

export async function listSipgateAssistEvents(limit = 50): Promise<SipgateAssistRow[]> {
  const sql = getDabosSql();
  const rows = await sql`
    SELECT
      id, received_at, consumed_at, call_id, direction, remote_number, local_number,
      channel_name, started_at, duration_seconds, headline, summary, action_items,
      has_transcript
    FROM sipgate_assist_events
    ORDER BY received_at DESC
    LIMIT ${limit}
  `;
  return rows as SipgateAssistRow[];
}

export async function markSipgateAssistConsumed(
  id: string,
  consumed: boolean
): Promise<boolean> {
  const sql = getDabosSql();
  const rows = consumed
    ? await sql`
        UPDATE sipgate_assist_events
        SET consumed_at = NOW()
        WHERE id = ${id}::uuid
        RETURNING id
      `
    : await sql`
        UPDATE sipgate_assist_events
        SET consumed_at = NULL
        WHERE id = ${id}::uuid
        RETURNING id
      `;
  return Boolean(rows[0]);
}

-- sipgate AI Assist / CI webhook mailbox (logans.tools).
-- Queue only: summaries + numbers. Full Mitschriften are stripped unless SIPGATE_STORE_TRANSCRIPT=1.
-- Retention: app deletes rows older than 30 days on ingest.

CREATE TABLE IF NOT EXISTS sipgate_assist_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  call_id TEXT,
  direction TEXT,
  remote_number TEXT,
  local_number TEXT,
  channel_name TEXT,
  started_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  headline TEXT,
  summary TEXT,
  action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  has_transcript BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_ip TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sipgate_assist_events_call_id
  ON sipgate_assist_events (call_id)
  WHERE call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sipgate_assist_events_pending
  ON sipgate_assist_events (received_at DESC)
  WHERE consumed_at IS NULL;

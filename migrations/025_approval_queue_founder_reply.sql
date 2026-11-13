-- Founder reply on decide (2026-11-13).
-- Short human text for agents to batch-process — not a second messaging system.
-- SSOT: src/docs/dabos/approval-queue.md

ALTER TABLE approval_queue
  ADD COLUMN IF NOT EXISTS founder_reply TEXT,
  ADD COLUMN IF NOT EXISTS reply_processed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.approval_queue'::regclass
      AND conname = 'approval_queue_founder_reply_len'
  ) THEN
    ALTER TABLE public.approval_queue
      ADD CONSTRAINT approval_queue_founder_reply_len
      CHECK (founder_reply IS NULL OR char_length(founder_reply) <= 800);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_approval_queue_unprocessed_replies
  ON approval_queue (status, decided_at DESC)
  WHERE founder_reply IS NOT NULL AND reply_processed_at IS NULL;

COMMENT ON COLUMN public.approval_queue.founder_reply IS
  'Founder text on Yes/No (≤800 chars, no secrets). Agents batch-read unprocessed replies.';
COMMENT ON COLUMN public.approval_queue.reply_processed_at IS
  'Set when an agent has consumed founder_reply. NULL = still in the wake batch.';

-- Founder-readable CONTEXT for approval_queue (2026-11-13).
-- Short plain English for the UI CONTEXT panel — not full briefs/PRDs.
-- Limit: ≤800 chars (enforced). Creators should aim 500–800.
-- Standard: src/docs/dabos/approval-queue.md · DABOS founder-approval-queue.md

ALTER TABLE approval_queue
  ADD COLUMN IF NOT EXISTS human_context TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.approval_queue'::regclass
      AND conname = 'approval_queue_human_context_len'
  ) THEN
    ALTER TABLE public.approval_queue
      ADD CONSTRAINT approval_queue_human_context_len
      CHECK (human_context IS NULL OR char_length(human_context) <= 800);
  END IF;
END
$$;

COMMENT ON COLUMN public.approval_queue.human_context IS
  'Founder-facing CONTEXT (≤800 chars): what / why now / Yes / No / 1–3 paths. Not PRD dumps. UI only.';

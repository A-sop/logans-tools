-- I0 shared ingest: Comm Office baskets + mouth idempotency (ESTO flap §F)

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS basket TEXT NOT NULL DEFAULT 'in';

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS ingest_source TEXT;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS ingest_external_id TEXT;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS ingest_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_basket_check'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_basket_check
      CHECK (basket IN ('in', 'pending', 'out'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_ingest_idempotent
  ON tasks (ingest_source, ingest_external_id)
  WHERE ingest_source IS NOT NULL AND ingest_external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_basket_status
  ON tasks (basket, status, created_at DESC);

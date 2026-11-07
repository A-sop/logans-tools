-- UNDO for 2026-11-01_comm_center_rebasket.sql
-- Restore basket/status/ingest_meta from the pre-apply rollback CSV (see normalise UNDO).
-- Refuses a blind reverse (filed_at / pending stamps are not invertible without the CSV).

DO $$
BEGIN
  RAISE EXCEPTION
    'UNDO is CSV restore only: load the pre-apply rollback CSV into comm_center_rollback_stage, then UPDATE tasks from it. Refusing a blind reverse.';
END $$;

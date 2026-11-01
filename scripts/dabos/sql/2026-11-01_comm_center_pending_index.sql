-- P6 optional: partial index on tasks WHERE basket='pending'.
-- Acceptance: docs/acceptance/2026-11-01_comm-center-baskets-v3.ACCEPTANCE.md
-- NOT a migration. Apply later, whole file in one transaction, after Dept13 PASS + Logan's yes.
--
-- Apply: psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -1 -f scripts/dabos/sql/2026-11-01_comm_center_pending_index.sql
-- Undo:  scripts/dabos/sql/2026-11-01_comm_center_pending_index.UNDO.sql

BEGIN;

CREATE INDEX IF NOT EXISTS idx_tasks_pending_division
  ON public.tasks (division_id)
  WHERE basket = 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'idx_tasks_pending_division'
  ) THEN
    RAISE EXCEPTION 'guard: idx_tasks_pending_division missing after CREATE';
  END IF;
  RAISE NOTICE 'comm-center: idx_tasks_pending_division present';
END $$;

COMMIT;

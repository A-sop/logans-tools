-- UNDO for 2026-11-01_comm_center_pending_index.sql

BEGIN;
DROP INDEX IF EXISTS public.idx_tasks_pending_division;
COMMIT;

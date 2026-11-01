-- Undo for scripts/dabos/sql/2026-11-01_approval_queue_decision_keys.sql (RR-010 step 2).
-- Removes only that file's objects: the unique partial index, the format check and the
-- dedupe_key column. REFUSES if any row already carries a dedupe_key (those keys would be lost;
-- clear or export them first, with Logan's yes). No other row or column is touched.
-- Run (Logan's yes only): psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -1 -f scripts/dabos/sql/2026-11-01_approval_queue_decision_keys.UNDO.sql
-- A re-run after success is a no-op.

BEGIN;

DO $$
DECLARE
  has_col integer;
  n integer;
BEGIN
  IF to_regclass('public.approval_queue') IS NULL THEN
    RAISE EXCEPTION 'undo guard 0: table public.approval_queue not found';
  END IF;
  SELECT count(*) INTO has_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'approval_queue' AND column_name = 'dedupe_key';
  IF has_col = 1 THEN
    EXECUTE 'SELECT count(*) FROM public.approval_queue WHERE dedupe_key IS NOT NULL' INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'undo guard 1: % row(s) carry a dedupe_key; refusing to drop it', n;
    END IF;
  END IF;
  EXECUTE 'DROP INDEX IF EXISTS public.uq_approval_queue_dedupe_key';
  EXECUTE 'ALTER TABLE public.approval_queue DROP CONSTRAINT IF EXISTS approval_queue_dedupe_key_format';
  EXECUTE 'ALTER TABLE public.approval_queue DROP COLUMN IF EXISTS dedupe_key';
  RAISE NOTICE 'approval_queue decision keys removed (or were absent)';
END
$$;

COMMIT;

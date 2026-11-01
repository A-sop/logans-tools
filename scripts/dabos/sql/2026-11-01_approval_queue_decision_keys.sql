-- RR-010 step 2 (Logan, 1 Nov 2026 14:54 Berlin, relayed by LDW Communicator: "Build the wake
-- rules, the approval queue and one status digest on ln02? Yes to steps 1–3").
-- approval_queue becomes the one place for Logan's yes/no; this adds an idempotent filing key.
-- Usage standard: src/docs/dabos/approval-queue.md
-- Acceptance: docs/acceptance/2026-11-01_approval_queue_logan_decisions.ACCEPTANCE.md
-- NOT a migration (lives outside ./migrations so `npm run dabos:migrate` never runs it).
-- NOT EXECUTED by this PR. Runs only after Dept13 PASS and Logan's own yes to merge and apply.
--
-- Adds (and nothing else):
--   approval_queue.dedupe_key text NULL
--   CHECK approval_queue_dedupe_key_format: NULL, or '<decision>:<non-space>' with decision in
--     merge | prod_apply | machine_change | secret_placement | policy | other, length <= 200
--   UNIQUE INDEX uq_approval_queue_dedupe_key ON approval_queue (dedupe_key) WHERE dedupe_key IS NOT NULL
-- No existing row is written; existing rows get dedupe_key NULL. No route or code path changes.
--
-- Prod as read on 1 Nov 2026 ~15:00 CET (read-only): approval_queue has the 14 columns of
-- migration 012 and NO check or FK constraints (only NOT NULLs + pk); indexes approval_queue_pkey
-- and idx_approval_queue_status; 2 rows (kind 'other', status 'approved').
-- Row digest (format below, the 14 columns, nullable columns coalesced to '<null>'):
--   2 rows, md5 1c4c62ad34bf8cdd51e67f40396b0c25 (PostgreSQL 18.6 on Neon, 1 Nov 2026 ~15:05 CET)
--   SELECT count(*), md5(string_agg(concat_ws('|', id::text, coalesce(workspace_id, '<null>'), kind,
--     title, coalesce(body, '<null>'), payload::text, status, requested_by,
--     coalesce(decided_by, '<null>'), coalesce(division_id, '<null>'),
--     coalesce(department_id, '<null>'), coalesce(task_id::text, '<null>'),
--     to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
--     coalesce(to_char(decided_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), '<null>')),
--     E'\n' ORDER BY id)) FROM approval_queue;
--   Rows may legitimately be added before the apply; guard 3 proves the rows present at apply
--   time are unchanged (same digest before and after, same count), so the pin is for the
--   preflight receipt only.
--
-- Apply (one transaction, whole file): psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -1 -f scripts/dabos/sql/2026-11-01_approval_queue_decision_keys.sql
--   The file's work is ONE statement (a single DO block) between BEGIN and COMMIT, so a single
--   run_sql / run_sql_transaction call with the DO block alone is the same transaction.
--   Every guard RAISEs, so any mismatch aborts and nothing changes. A re-run after success is a
--   no-op (end state re-verified, nothing written). A partial state aborts.
-- Undo: scripts/dabos/sql/2026-11-01_approval_queue_decision_keys.UNDO.sql (refuses if any row
--   already carries a dedupe_key).

BEGIN;

DO $$
DECLARE
  expected_cols constant text :=
    'body:text:YES|created_at:timestamp with time zone:NO|decided_at:timestamp with time zone:YES|'
    'decided_by:text:YES|department_id:text:YES|division_id:text:YES|id:uuid:NO|kind:text:NO|'
    'payload:jsonb:NO|requested_by:text:NO|status:text:NO|task_id:uuid:YES|title:text:NO|'
    'workspace_id:text:YES';
  check_def constant text :=
    'CHECK (((dedupe_key IS NULL) OR ((length(dedupe_key) <= 200) AND (dedupe_key ~ ''^(merge|prod_apply|machine_change|secret_placement|policy|other):\S+$''::text))))';
  index_def constant text :=
    'CREATE UNIQUE INDEX uq_approval_queue_dedupe_key ON public.approval_queue USING btree (dedupe_key) WHERE (dedupe_key IS NOT NULL)';
  base_cols text;
  has_col integer;
  col_ok integer;
  has_check integer;
  has_index integer;
  n_before bigint;
  n_after bigint;
  d_before text;
  d_after text;
  d_sql constant text :=
    $q$SELECT coalesce(md5(string_agg(concat_ws('|', id::text, coalesce(workspace_id, '<null>'), kind,
        title, coalesce(body, '<null>'), payload::text, status, requested_by,
        coalesce(decided_by, '<null>'), coalesce(division_id, '<null>'),
        coalesce(department_id, '<null>'), coalesce(task_id::text, '<null>'),
        to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
        coalesce(to_char(decided_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), '<null>')),
        E'\n' ORDER BY id)), 'empty') FROM public.approval_queue$q$;
BEGIN
  -- Guard 0: the table is migration 012's 14 columns (plus dedupe_key only if this ran before).
  IF to_regclass('public.approval_queue') IS NULL THEN
    RAISE EXCEPTION 'guard 0: table public.approval_queue not found';
  END IF;
  SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable, '|' ORDER BY column_name)
    INTO base_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'approval_queue' AND column_name <> 'dedupe_key';
  IF base_cols IS DISTINCT FROM expected_cols THEN
    RAISE EXCEPTION 'guard 0b: approval_queue columns differ from migration 012 as read on prod: %', base_cols;
  END IF;

  SELECT count(*) INTO has_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'approval_queue' AND column_name = 'dedupe_key';
  SELECT count(*) INTO col_ok FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'approval_queue' AND column_name = 'dedupe_key'
     AND data_type = 'text' AND is_nullable = 'YES' AND column_default IS NULL;
  SELECT count(*) INTO has_check FROM pg_constraint
   WHERE conrelid = 'public.approval_queue'::regclass AND conname = 'approval_queue_dedupe_key_format';
  SELECT count(*) INTO has_index FROM pg_indexes
   WHERE schemaname = 'public' AND tablename = 'approval_queue' AND indexname = 'uq_approval_queue_dedupe_key';

  EXECUTE d_sql INTO d_before;
  SELECT count(*) INTO n_before FROM public.approval_queue;

  IF has_col = 0 AND has_check = 0 AND has_index = 0 THEN
    -- Guard 1: no other object already uses the names.
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_approval_queue_dedupe_key') THEN
      RAISE EXCEPTION 'guard 1: a relation named uq_approval_queue_dedupe_key already exists elsewhere';
    END IF;

    EXECUTE 'ALTER TABLE public.approval_queue ADD COLUMN dedupe_key text';
    EXECUTE $c$ALTER TABLE public.approval_queue ADD CONSTRAINT approval_queue_dedupe_key_format
      CHECK (dedupe_key IS NULL OR (length(dedupe_key) <= 200
        AND dedupe_key ~ '^(merge|prod_apply|machine_change|secret_placement|policy|other):\S+$'))$c$;
    EXECUTE 'CREATE UNIQUE INDEX uq_approval_queue_dedupe_key ON public.approval_queue (dedupe_key) WHERE dedupe_key IS NOT NULL';
    EXECUTE $c$COMMENT ON COLUMN public.approval_queue.dedupe_key IS
      'RR-010 step 2 filing key, <decision>:<subject>; see logans-tools src/docs/dabos/approval-queue.md'$c$;
    RAISE NOTICE 'approval_queue.dedupe_key added (column, format check, unique partial index)';
  ELSIF has_col = 1 AND has_check = 1 AND has_index = 1 THEN
    RAISE NOTICE 'approval_queue.dedupe_key already present; verifying end state, writing nothing';
  ELSE
    RAISE EXCEPTION 'guard 1: partial state (column %, check %, index %); expected 0/0/0 or 1/1/1',
      has_col, has_check, has_index;
  END IF;

  -- Guard 2: end state is exactly what this file creates.
  SELECT count(*) INTO col_ok FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'approval_queue' AND column_name = 'dedupe_key'
     AND data_type = 'text' AND is_nullable = 'YES' AND column_default IS NULL;
  IF col_ok <> 1 THEN
    RAISE EXCEPTION 'guard 2: dedupe_key is not a nullable text column without default';
  END IF;
  IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint
       WHERE conrelid = 'public.approval_queue'::regclass AND conname = 'approval_queue_dedupe_key_format')
     IS DISTINCT FROM check_def THEN
    RAISE EXCEPTION 'guard 2b: approval_queue_dedupe_key_format is not the expected check';
  END IF;
  IF (SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'approval_queue'
        AND indexname = 'uq_approval_queue_dedupe_key') IS DISTINCT FROM index_def THEN
    RAISE EXCEPTION 'guard 2c: uq_approval_queue_dedupe_key is not the expected unique partial index';
  END IF;
  IF (SELECT count(*) FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
       WHERE i.indrelid = 'public.approval_queue'::regclass AND a.attname = 'dedupe_key') <> 1 THEN
    RAISE EXCEPTION 'guard 2d: dedupe_key is in an index other than uq_approval_queue_dedupe_key';
  END IF;

  -- Guard 3: no existing row changed (14-column digest and count equal before and after).
  EXECUTE d_sql INTO d_after;
  SELECT count(*) INTO n_after FROM public.approval_queue;
  IF d_after <> d_before OR n_after <> n_before THEN
    RAISE EXCEPTION 'guard 3: approval_queue rows changed (count % -> %, digest % -> %)', n_before, n_after, d_before, d_after;
  END IF;

  RAISE NOTICE 'approval_queue decision keys ok: % rows unchanged, digest %', n_after, d_after;
END
$$;

COMMIT;

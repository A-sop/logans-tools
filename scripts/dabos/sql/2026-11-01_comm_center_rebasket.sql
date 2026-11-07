-- Three-basket comm center v3: one-off re-basketing (~1,250 rows).
-- Acceptance: docs/acceptance/2026-11-01_comm-center-baskets-v3.ACCEPTANCE.md
-- NOT a migration. NOT EXECUTED by this PR. Apply only after:
--   1) rollback CSV export (scripts/dabos/comm-center-rollback-export.ts)
--   2) normalisation SQL
--   3) Dept13 PASS + Logan's yes
--
-- Status map (explicit; any other status on basket='in' aborts):
--   done, cancelled → out + ingest_meta.filed_at
--   todo            → stays in
--   reassess        → pending with pending.reason='reassess', waiting_on post Div1/Dept1,
--                     since=now(), last_reviewed=now() (no clear_by → no mass wakes / stalls)
--
-- Apply: psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -1 -f scripts/dabos/sql/2026-11-01_comm_center_rebasket.sql
-- Undo:  scripts/dabos/sql/2026-11-01_comm_center_rebasket.UNDO.sql (CSV restore).

BEGIN;

DO $$
DECLARE
  unmapped text;
  n_in_before bigint;
  n_out_before bigint;
  n_pending_before bigint;
  n_in_after bigint;
  n_out_after bigint;
  n_pending_after bigint;
  n_done_out bigint;
  n_cancelled_out bigint;
  n_reassess_pending bigint;
  n_todo_in bigint;
  d_before text;
  d_after text;
  d_sql constant text :=
    $q$SELECT coalesce(md5(string_agg(concat_ws('|',
        id::text,
        coalesce(workspace_id, '<null>'),
        division_id,
        coalesce(department_id, '<null>'),
        title,
        coalesce(description, '<null>'),
        type, status, priority::text,
        coalesce(assigned_to, '<null>'),
        coalesce(assigned_agent, '<null>'),
        basket,
        coalesce(ingest_source, '<null>'),
        coalesce(ingest_external_id, '<null>'),
        ingest_meta::text,
        to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
        to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
        coalesce(to_char(completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), '<null>')
      ), E'\n' ORDER BY id)), 'empty') FROM public.tasks$q$;
BEGIN
  IF to_regclass('public.tasks') IS NULL THEN
    RAISE EXCEPTION 'guard 0: public.tasks missing';
  END IF;

  -- Explicit status map only for rows currently in the IN basket.
  SELECT string_agg(DISTINCT status, ', ' ORDER BY status) INTO unmapped
    FROM tasks
   WHERE basket = 'in'
     AND status NOT IN ('done', 'cancelled', 'todo', 'reassess');
  IF unmapped IS NOT NULL THEN
    RAISE EXCEPTION 'unmapped status on basket=in (refusing): %', unmapped;
  END IF;

  SELECT count(*) FILTER (WHERE basket = 'in'),
         count(*) FILTER (WHERE basket = 'out'),
         count(*) FILTER (WHERE basket = 'pending')
    INTO n_in_before, n_out_before, n_pending_before
    FROM tasks;

  EXECUTE d_sql INTO d_before;

  UPDATE tasks
     SET basket = 'out',
         ingest_meta = coalesce(ingest_meta, '{}'::jsonb)
           || jsonb_build_object('filed_at', to_jsonb(NOW())),
         updated_at = NOW()
   WHERE basket = 'in' AND status = 'done';
  GET DIAGNOSTICS n_done_out = ROW_COUNT;

  UPDATE tasks
     SET basket = 'out',
         ingest_meta = coalesce(ingest_meta, '{}'::jsonb)
           || jsonb_build_object('filed_at', to_jsonb(NOW())),
         updated_at = NOW()
   WHERE basket = 'in' AND status = 'cancelled';
  GET DIAGNOSTICS n_cancelled_out = ROW_COUNT;

  UPDATE tasks
     SET basket = 'pending',
         ingest_meta = coalesce(ingest_meta, '{}'::jsonb)
           || jsonb_build_object(
                'pending', jsonb_build_object(
                  'reason', 'reassess',
                  'waiting_on', jsonb_build_object(
                    'kind', 'post',
                    'post', 'Div1/Dept1'
                  ),
                  'since', to_jsonb(NOW()),
                  'last_reviewed', to_jsonb(NOW())
                )
              ),
         updated_at = NOW()
   WHERE basket = 'in' AND status = 'reassess';
  GET DIAGNOSTICS n_reassess_pending = ROW_COUNT;

  SELECT count(*) INTO n_todo_in
    FROM tasks WHERE basket = 'in' AND status = 'todo';

  SELECT count(*) FILTER (WHERE basket = 'in'),
         count(*) FILTER (WHERE basket = 'out'),
         count(*) FILTER (WHERE basket = 'pending')
    INTO n_in_after, n_out_after, n_pending_after
    FROM tasks;

  EXECUTE d_sql INTO d_after;

  RAISE NOTICE 'comm-center rebasket before: in=% out=% pending=% digest=%',
    n_in_before, n_out_before, n_pending_before, d_before;
  RAISE NOTICE 'comm-center rebasket moved: done→out=% cancelled→out=% reassess→pending=% todo stays in=%',
    n_done_out, n_cancelled_out, n_reassess_pending, n_todo_in;
  RAISE NOTICE 'comm-center rebasket after: in=% out=% pending=% digest=%',
    n_in_after, n_out_after, n_pending_after, d_after;
END $$;

COMMIT;

-- RR-010 step 1 UNDO: removes only what 2026-11-01_watchman_agent_inbox.sql added.
-- Drops public.agent_inbox (its indexes, constraints and column grants go with it) and revokes the grants that
-- file gave dabos_watchman. The role itself stays; Logan drops it if he wants (DROP ROLE dabos_watchman).
--
-- Guard: refuses while agent_inbox holds rows, unless the session sets
--   dabos.watchman_undo_drop_rows = 'on'
-- Run whole, as one transaction:
--   psql "<owner DATABASE_URL>" -v ON_ERROR_STOP=1 -1 -f scripts/dabos/sql/2026-11-01_watchman_agent_inbox.UNDO.sql
-- With rows present (they are lost):
--   psql "<owner DATABASE_URL>" -v ON_ERROR_STOP=1 -1 -c "SET dabos.watchman_undo_drop_rows = 'on'" -f scripts/dabos/sql/2026-11-01_watchman_agent_inbox.UNDO.sql
-- Re-run: safe (each step checks first). Stop the ln02 timer first (install-watchman.sh --undo --apply).

BEGIN;

DO $$
DECLARE
  n bigint;
BEGIN
  IF to_regclass('public.agent_inbox') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.agent_inbox' INTO n;
    IF n > 0 AND coalesce(current_setting('dabos.watchman_undo_drop_rows', true), '') <> 'on' THEN
      RAISE EXCEPTION 'guard: public.agent_inbox has % rows; set dabos.watchman_undo_drop_rows = ''on'' to drop them', n;
    END IF;
    DROP TABLE public.agent_inbox;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dabos_watchman') THEN
    IF to_regclass('public.role_runs') IS NOT NULL THEN
      REVOKE SELECT, INSERT ON public.role_runs FROM dabos_watchman;
    END IF;
    REVOKE USAGE ON SCHEMA public FROM dabos_watchman;
  END IF;

  RAISE NOTICE 'watchman agent_inbox removed';
END $$;

COMMIT;

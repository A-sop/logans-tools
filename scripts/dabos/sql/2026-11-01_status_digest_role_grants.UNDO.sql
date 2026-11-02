-- UNDO for 2026-11-01_status_digest_role_grants.sql (RR-010 step 3). NOT EXECUTED by this PR.
-- Revokes exactly what that file granted. Re-runnable; a missing role is a no-op notice.
-- Stop the ln02 timer first: systemctl --user disable --now dabos-status-digest.timer
-- The role itself is left for Logan to drop (DROP ROLE dabos_status_digest;) once nothing uses it.
--   psql "<owner DATABASE_URL>" -v ON_ERROR_STOP=1 -1 -f scripts/dabos/sql/2026-11-01_status_digest_role_grants.UNDO.sql

BEGIN;

DO $$
DECLARE
  r constant text := 'dabos_status_digest';
  read_tables constant text[] := ARRAY['tasks', 'approval_queue', 'stats', 'role_runs', 'divisions', 'departments'];
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
    RAISE NOTICE 'role % does not exist; nothing to revoke', r;
    RETURN;
  END IF;
  EXECUTE format('REVOKE INSERT ON public.role_runs FROM %I', r);
  FOREACH t IN ARRAY read_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE SELECT ON public.%I FROM %I', t, r);
    END IF;
  END LOOP;
  EXECUTE format('REVOKE USAGE ON SCHEMA public FROM %I', r);
  RAISE NOTICE 'status digest grants revoked for %', r;
END $$;

COMMIT;

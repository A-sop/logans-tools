-- UNDO for 2026-11-01_v_comm_station.sql
-- Revokes SELECT on the view from digest/watch roles (if present) and drops the view.

BEGIN;

DO $$
DECLARE
  roles text[] := ARRAY['dabos_status_digest', 'dabos_watchman'];
  r text;
BEGIN
  FOREACH r IN ARRAY roles LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r)
       AND to_regclass('public.v_comm_station') IS NOT NULL THEN
      EXECUTE format('REVOKE SELECT ON public.v_comm_station FROM %I', r);
      RAISE NOTICE 'revoked SELECT on v_comm_station from %', r;
    END IF;
  END LOOP;
END $$;

DROP VIEW IF EXISTS public.v_comm_station;

COMMIT;

-- RR-010 step 3: least-privilege grants for the ln02 status digest role.
-- Acceptance: docs/acceptance/2026-11-01_status_digest_ln02.ACCEPTANCE.md
-- NOT a migration. NOT EXECUTED by this PR. Apply only after Dept13 PASS and Logan's yes.
--
-- Before this file: Logan creates the role himself in the Neon SQL editor (a role created in the
-- Neon console UI is made a member of neon_superuser, which guard 1 refuses):
--   CREATE ROLE dabos_status_digest LOGIN PASSWORD '<chosen by Logan, never pasted into chat>';
-- Then puts the role's connection string in ln02 ~/.config/dabos/status-digest.env as
-- DABOS_DIGEST_DATABASE_URL (mode 600).
--
-- Run whole, as one transaction:
--   psql "<owner DATABASE_URL>" -v ON_ERROR_STOP=1 -1 -f scripts/dabos/sql/2026-11-01_status_digest_role_grants.sql
-- Re-run: safe (GRANT is idempotent; the checks run again).
-- Undo:  scripts/dabos/sql/2026-11-01_status_digest_role_grants.UNDO.sql
--
-- Grants: USAGE on schema public; SELECT on tasks, approval_queue, stats, role_runs, divisions,
-- departments; INSERT on role_runs. Nothing else. No UPDATE/DELETE/TRUNCATE anywhere.

BEGIN;

DO $$
DECLARE
  r constant text := 'dabos_status_digest';
  read_tables constant text[] := ARRAY['tasks', 'approval_queue', 'stats', 'role_runs', 'divisions', 'departments'];
  t text;
  is_super boolean;
BEGIN
  -- Guard 0: role exists.
  SELECT rolsuper INTO is_super FROM pg_roles WHERE rolname = r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'guard 0: role % does not exist; create it first (see header)', r;
  END IF;

  -- Guard 1: not a superuser, not in neon_superuser, no CREATEROLE/CREATEDB/BYPASSRLS.
  IF is_super THEN
    RAISE EXCEPTION 'guard 1: role % is a superuser', r;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'neon_superuser')
     AND pg_has_role(r, 'neon_superuser', 'MEMBER') THEN
    RAISE EXCEPTION 'guard 1: role % is a member of neon_superuser; recreate it with CREATE ROLE in SQL', r;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r AND (rolcreaterole OR rolcreatedb OR rolbypassrls)) THEN
    RAISE EXCEPTION 'guard 1: role % has CREATEROLE, CREATEDB or BYPASSRLS', r;
  END IF;

  -- Guard 2: all tables exist in public.
  FOREACH t IN ARRAY read_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'guard 2: table public.% missing', t;
    END IF;
  END LOOP;

  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', r);
  FOREACH t IN ARRAY read_tables LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO %I', t, r);
  END LOOP;
  EXECUTE format('GRANT INSERT ON public.role_runs TO %I', r);

  -- Guard 3: resulting privileges are exactly what this file intends on these tables.
  FOREACH t IN ARRAY read_tables LOOP
    IF NOT has_table_privilege(r, 'public.' || t, 'SELECT') THEN
      RAISE EXCEPTION 'guard 3: % lacks SELECT on %', r, t;
    END IF;
    IF has_table_privilege(r, 'public.' || t, 'UPDATE')
       OR has_table_privilege(r, 'public.' || t, 'DELETE')
       OR has_table_privilege(r, 'public.' || t, 'TRUNCATE') THEN
      RAISE EXCEPTION 'guard 3: % can UPDATE/DELETE/TRUNCATE %; refusing', r, t;
    END IF;
    IF t <> 'role_runs' AND has_table_privilege(r, 'public.' || t, 'INSERT') THEN
      RAISE EXCEPTION 'guard 3: % can INSERT into %; refusing', r, t;
    END IF;
  END LOOP;
  IF NOT has_table_privilege(r, 'public.role_runs', 'INSERT') THEN
    RAISE EXCEPTION 'guard 3: % lacks INSERT on role_runs', r;
  END IF;

  RAISE NOTICE 'status digest grants in place for %', r;
END $$;

COMMIT;

-- Undo: scripts/dabos/sql/2026-11-01_build_receipt_role_grants.sql
-- Does not DROP the role (Logan may still hold the LOGIN). Revokes only what that file grants.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dabos_build_receipt') THEN
    REVOKE SELECT, INSERT ON public.tasks FROM dabos_build_receipt;
    REVOKE USAGE ON SCHEMA public FROM dabos_build_receipt;
  END IF;
END $$;

COMMIT;

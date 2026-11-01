-- Div4 build-receipt + stall-route role grants (files only; not applied by this PR).
-- Acceptance: docs/acceptance/2026-11-01_build_receipts_open_orders_stall.ACCEPTANCE.md
--
-- Before this file: Logan creates the role in the Neon SQL editor:
--   CREATE ROLE dabos_build_receipt LOGIN PASSWORD '<chosen by Logan, never pasted into chat>';
-- Then puts the role's connection string where the HZR52 / digest stall-route runner can read it
-- (mode 600). Never commit secrets.
--
-- Run whole, as one transaction:
--   psql "<owner DATABASE_URL>" -v ON_ERROR_STOP=1 -1 -f scripts/dabos/sql/2026-11-01_build_receipt_role_grants.sql
-- Undo:  scripts/dabos/sql/2026-11-01_build_receipt_role_grants.UNDO.sql
--
-- Grants: USAGE on schema public; SELECT + INSERT on public.tasks. Nothing else.
-- Guards refuse PUBLIC CREATE on the database but NOT PUBLIC TEMPORARY (prod datacl
-- `=Tc/neondb_owner`). Membership uses member = role; PG16+ CREATEROLE creator ADMIN allowed.

BEGIN;

DO $$
DECLARE
  r constant text := 'dabos_build_receipt';
  is_super boolean;
  roid oid;
  tasks_oid oid;
  n bigint;
  rel record;
  p text;
  table_privs text[] := ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
BEGIN
  SELECT rolsuper INTO is_super FROM pg_roles WHERE rolname = r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'guard 0: role % does not exist; create it first (see header)', r;
  END IF;
  IF is_super THEN
    RAISE EXCEPTION 'guard 1: role % is a superuser', r;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'neon_superuser')
     AND pg_has_role(r, 'neon_superuser', 'MEMBER') THEN
    RAISE EXCEPTION 'guard 1: role % is a member of neon_superuser; recreate it with CREATE ROLE in SQL', r;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r AND (rolcreaterole OR rolcreatedb OR rolbypassrls OR rolreplication)) THEN
    RAISE EXCEPTION 'guard 1: role % has CREATEROLE, CREATEDB, BYPASSRLS or REPLICATION', r;
  END IF;
  IF current_setting('server_version_num')::int >= 170000 THEN
    table_privs := array_append(table_privs, 'MAINTAIN'::text);
  END IF;
  IF to_regclass('public.tasks') IS NULL THEN
    RAISE EXCEPTION 'guard 2: table public.tasks missing';
  END IF;

  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', r);
  EXECUTE format('GRANT SELECT, INSERT ON public.tasks TO %I', r);

  SELECT oid INTO roid FROM pg_roles WHERE rolname = r;
  tasks_oid := 'public.tasks'::regclass::oid;

  IF NOT has_table_privilege(r, 'public.tasks', 'SELECT')
     OR NOT has_table_privilege(r, 'public.tasks', 'INSERT') THEN
    RAISE EXCEPTION 'guard 3a: % lacks SELECT+INSERT on tasks', r;
  END IF;
  IF NOT has_schema_privilege(r, 'public', 'USAGE') THEN
    RAISE EXCEPTION 'guard 3a: % lacks USAGE on schema public', r;
  END IF;

  -- member = role (PG16+ CREATEROLE creator ADMIN grant exception)
  SELECT count(*) INTO n FROM pg_auth_members WHERE member = roid;
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 3b: % is a member of % other role(s); refusing', r, n;
  END IF;
  SELECT count(*) INTO n
    FROM pg_auth_members m
    JOIN pg_roles cr ON cr.oid = m.member
   WHERE m.roleid = roid
     AND NOT (
       m.admin_option
       AND (m.grantor = 10 OR m.grantor = m.member)
       AND cr.rolcreaterole
       AND NOT cr.rolsuper
     );
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 3b: % has % unexpected member role(s); refusing', r, n;
  END IF;
  SELECT count(*) INTO n FROM pg_auth_members WHERE roleid = roid;
  IF n > 1 THEN
    RAISE EXCEPTION 'guard 3b: % has % member roles (only the CREATEROLE creator grant is allowed); refusing', r, n;
  END IF;

  SELECT (SELECT count(*) FROM pg_class WHERE relowner = roid)
       + (SELECT count(*) FROM pg_namespace WHERE nspowner = roid)
       + (SELECT count(*) FROM pg_proc WHERE proowner = roid)
       + (SELECT count(*) FROM pg_type WHERE typowner = roid)
       + (SELECT count(*) FROM pg_database WHERE datdba = roid)
    INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 3c: % owns % object(s); refusing', r, n;
  END IF;

  SELECT count(*) INTO n
    FROM pg_class c, aclexplode(c.relacl) a
   WHERE a.grantee = roid
     AND NOT (c.oid = tasks_oid AND a.privilege_type IN ('SELECT', 'INSERT'));
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 3d: % has % unintended table/view/sequence grant(s)', r, n;
  END IF;
  SELECT count(*) INTO n
    FROM pg_namespace ns, aclexplode(ns.nspacl) a
   WHERE a.grantee = roid AND NOT (ns.nspname = 'public' AND a.privilege_type = 'USAGE');
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 3d: % has % unintended schema grant(s)', r, n;
  END IF;
  SELECT (SELECT count(*) FROM pg_proc p, aclexplode(p.proacl) a WHERE a.grantee = roid)
       + (SELECT count(*) FROM pg_type ty, aclexplode(ty.typacl) a WHERE a.grantee = roid)
       + (SELECT count(*) FROM pg_language l, aclexplode(l.lanacl) a WHERE a.grantee = roid)
       + (SELECT count(*) FROM pg_database d, aclexplode(d.datacl) a WHERE a.grantee = roid)
       + (SELECT count(*) FROM pg_tablespace sp, aclexplode(sp.spcacl) a WHERE a.grantee = roid)
    INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 3d: % has % grant(s) on functions/types/languages/databases/tablespaces', r, n;
  END IF;

  SELECT count(*) INTO n
    FROM pg_default_acl da
   WHERE da.defaclrole = roid
      OR EXISTS (SELECT 1 FROM aclexplode(da.defaclacl) a WHERE a.grantee = roid);
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 3e: % has % default privilege entr(ies); refusing', r, n;
  END IF;

  FOR rel IN
    SELECT c.oid, c.relkind, c.oid::regclass::text AS name
      FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
       AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
       AND ns.nspname NOT LIKE 'pg\_toast%'
       AND ns.nspname NOT LIKE 'pg\_temp\_%'
  LOOP
    IF rel.relkind = 'S' THEN
      FOREACH p IN ARRAY ARRAY['USAGE', 'SELECT', 'UPDATE'] LOOP
        IF has_sequence_privilege(r, rel.oid, p) THEN
          RAISE EXCEPTION 'guard 3f: % has % on sequence %; refusing', r, p, rel.name;
        END IF;
      END LOOP;
    ELSE
      FOREACH p IN ARRAY table_privs LOOP
        IF has_table_privilege(r, rel.oid, p)
           AND NOT (rel.oid = tasks_oid AND p IN ('SELECT', 'INSERT')) THEN
          RAISE EXCEPTION 'guard 3f: % has % on %; refusing', r, p, rel.name;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  -- Refuse CREATE on schemas / database / PUBLIC CREATE ACL. Do NOT refuse PUBLIC TEMPORARY.
  SELECT count(*) INTO n FROM pg_namespace ns WHERE has_schema_privilege(r, ns.oid, 'CREATE');
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 3g: % can CREATE in % schema(s); refusing', r, n;
  END IF;
  IF has_database_privilege(r, current_database(), 'CREATE') THEN
    RAISE EXCEPTION 'guard 3g: % can CREATE in database %; refusing', r, current_database();
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_database d, LATERAL aclexplode(d.datacl) a
     WHERE d.datname = current_database()
       AND a.grantee = 0
       AND a.privilege_type = 'CREATE'
  ) THEN
    RAISE EXCEPTION 'guard 3g: PUBLIC has CREATE on database %; refusing', current_database();
  END IF;

  RAISE NOTICE 'build-receipt grants in place for %', r;
END $$;

COMMIT;

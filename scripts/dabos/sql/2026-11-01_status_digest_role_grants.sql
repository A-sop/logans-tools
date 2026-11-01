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
-- Guard 3 then refuses (and rolls everything back) if the role has ANY other privilege on any
-- object in the database (tables, views, sequences, columns, functions, schemas, types, languages,
-- databases, tablespaces, foreign wrappers/servers, large objects, parameters), any role
-- membership, owns any object, or has default privileges. An extra privilege found here is
-- revoked by hand (by Logan, after reading the guard message), never by this file.

BEGIN;

DO $$
DECLARE
  r constant text := 'dabos_status_digest';
  read_tables constant text[] := ARRAY['tasks', 'approval_queue', 'stats', 'role_runs', 'divisions', 'departments'];
  t text;
  p text;
  n bigint;
  is_super boolean;
  roid oid;
  rr_oid oid;
  read_oids oid[];
  rel record;
  table_privs text[] := ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
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
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r AND (rolcreaterole OR rolcreatedb OR rolbypassrls OR rolreplication)) THEN
    RAISE EXCEPTION 'guard 1: role % has CREATEROLE, CREATEDB, BYPASSRLS or REPLICATION', r;
  END IF;
  IF current_setting('server_version_num')::int >= 170000 THEN
    table_privs := array_append(table_privs, 'MAINTAIN'::text);
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

  -- Guard 3: after the GRANTs, the role holds exactly the intended privileges and nothing else on
  -- ANY object in the database. Intended: USAGE on schema public; SELECT on the six read tables;
  -- INSERT on public.role_runs. Every check below RAISEs, so the whole file rolls back.
  SELECT oid INTO roid FROM pg_roles WHERE rolname = r;
  SELECT array_agg(('public.' || x)::regclass::oid) INTO read_oids FROM unnest(read_tables) AS x;
  rr_oid := 'public.role_runs'::regclass::oid;

  -- 3a: the intended privileges are present.
  FOREACH t IN ARRAY read_tables LOOP
    IF NOT has_table_privilege(r, 'public.' || t, 'SELECT') THEN
      RAISE EXCEPTION 'guard 3a: % lacks SELECT on %', r, t;
    END IF;
  END LOOP;
  IF NOT has_table_privilege(r, 'public.role_runs', 'INSERT') THEN
    RAISE EXCEPTION 'guard 3a: % lacks INSERT on role_runs', r;
  END IF;
  IF NOT has_schema_privilege(r, 'public', 'USAGE') THEN
    RAISE EXCEPTION 'guard 3a: % lacks USAGE on schema public', r;
  END IF;

  -- 3b: the role must not be a member of any other role (no inherited / SET ROLE privileges).
  -- Other roles must not be members of it either, except the single PG16+ CREATEROLE implicit
  -- ADMIN OPTION grant to the non-superuser creator (grantor = bootstrap superuser oid 10 or the
  -- creator itself). Without that exception, apply always aborts on Neon when neondb_owner
  -- (CREATEROLE, not superuser) creates the role.
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

  -- 3c: the role owns nothing (an owner has every privilege on its object).
  SELECT (SELECT count(*) FROM pg_class WHERE relowner = roid)
       + (SELECT count(*) FROM pg_namespace WHERE nspowner = roid)
       + (SELECT count(*) FROM pg_proc WHERE proowner = roid)
       + (SELECT count(*) FROM pg_type WHERE typowner = roid)
       + (SELECT count(*) FROM pg_database WHERE datdba = roid)
    INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 3c: % owns % object(s); refusing', r, n;
  END IF;

  -- 3d: direct grants to the role on every object class carrying an ACL are exactly the intended ones.
  SELECT count(*) INTO n
    FROM pg_class c, aclexplode(c.relacl) a
   WHERE a.grantee = roid
     AND NOT ((c.oid = ANY (read_oids) AND a.privilege_type = 'SELECT')
              OR (c.oid = rr_oid AND a.privilege_type = 'INSERT'));
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 3d: % has % unintended table/view/sequence grant(s)', r, n;
  END IF;
  SELECT count(*) INTO n
    FROM pg_attribute att, aclexplode(att.attacl) a WHERE a.grantee = roid;
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 3d: % has % column grant(s)', r, n;
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
       + (SELECT count(*) FROM pg_foreign_data_wrapper w, aclexplode(w.fdwacl) a WHERE a.grantee = roid)
       + (SELECT count(*) FROM pg_foreign_server fs, aclexplode(fs.srvacl) a WHERE a.grantee = roid)
       + (SELECT count(*) FROM pg_largeobject_metadata lo, aclexplode(lo.lomacl) a WHERE a.grantee = roid)
    INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 3d: % has % grant(s) on functions, types, languages, databases, tablespaces, foreign wrappers/servers or large objects', r, n;
  END IF;
  IF to_regclass('pg_catalog.pg_parameter_acl') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM pg_catalog.pg_parameter_acl pa, aclexplode(pa.paracl) a WHERE a.grantee = $1'
      INTO n USING roid;
    IF n > 0 THEN
      RAISE EXCEPTION 'guard 3d: % has % parameter grant(s)', r, n;
    END IF;
  END IF;

  -- 3e: no default privileges set for or by the role (future objects would grant it more).
  SELECT count(*) INTO n
    FROM pg_default_acl da
   WHERE da.defaclrole = roid
      OR EXISTS (SELECT 1 FROM aclexplode(da.defaclacl) a WHERE a.grantee = roid);
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 3e: % has % default privilege entr(ies); refusing', r, n;
  END IF;

  -- 3f: effective privileges (direct, PUBLIC or any other path) on every non-system relation.
  -- PUBLIC's PostgreSQL defaults (EXECUTE on functions, CONNECT/TEMP on the database, USAGE on the
  -- system schemas) are not grants to this role and are not refused here.
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
           AND NOT ((rel.oid = ANY (read_oids) AND p = 'SELECT') OR (rel.oid = rr_oid AND p = 'INSERT')) THEN
          RAISE EXCEPTION 'guard 3f: % has % on %; refusing', r, p, rel.name;
        END IF;
      END LOOP;
      FOREACH p IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
        IF NOT has_table_privilege(r, rel.oid, p) AND has_any_column_privilege(r, rel.oid, p) THEN
          RAISE EXCEPTION 'guard 3f: % has column % on %; refusing', r, p, rel.name;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  -- 3g: no CREATE anywhere: on any schema or on the database.
  SELECT count(*) INTO n FROM pg_namespace ns WHERE has_schema_privilege(r, ns.oid, 'CREATE');
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 3g: % can CREATE in % schema(s); refusing', r, n;
  END IF;
  IF has_database_privilege(r, current_database(), 'CREATE') THEN
    RAISE EXCEPTION 'guard 3g: % can CREATE in database %; refusing', r, current_database();
  END IF;

  RAISE NOTICE 'status digest grants in place for %', r;
END $$;

COMMIT;

-- RR-010 step 1: watchman (agent inbox gatekeeper on ln02).
-- Acceptance: docs/acceptance/2026-11-01_watchman.ACCEPTANCE.md (AC1) + AMENDMENT-1.md (A1, A2, A4)
-- + AMENDMENT-2.md (A6, A7).
-- NOT applied by the build session. Apply only after Dept13 PASS and Logan's yes.
--
-- Why a new table and not `tasks`: tasks rows are work items (division_id and title NOT NULL, a
-- basket CHECK, idempotency only on ingest_source + ingest_external_id). They have no sender,
-- recipient, urgency, deadline, batch or delivery fields, and the board and the status digest
-- count every open task, so messages there would inflate the task counts. See the PR.
--
-- Before this file: Logan creates the watchman's login himself in the Neon SQL editor (a role
-- made in the Neon console UI joins neon_superuser, which guard 1 refuses):
--   CREATE ROLE dabos_watchman LOGIN PASSWORD '<chosen by Logan, never pasted into chat>';
-- and puts that role's connection string in ln02 ~/.config/dabos/watchman.env as
-- WATCHMAN_DATABASE_URL (mode 600).
--
-- Run whole, as one transaction:
--   psql "<owner DATABASE_URL>" -v ON_ERROR_STOP=1 -1 -f scripts/dabos/sql/2026-11-01_watchman_agent_inbox.sql
-- Re-run: safe (CREATE ... IF NOT EXISTS, GRANT is idempotent, the guards run again).
-- Undo:  scripts/dabos/sql/2026-11-01_watchman_agent_inbox.UNDO.sql
--
-- Objects: table public.agent_inbox (+ 2 indexes, its checks and unique key). Grants to
-- dabos_watchman: USAGE on schema public; SELECT on agent_inbox; UPDATE on agent_inbox columns
-- status, batch_id, dispatched_at, gate_decision, gated_at; INSERT on the sender columns
-- from_agent, to_agent, subject, body, urgency_claim, urgency_reason, dedupe_key (failure alerts to
-- div4, Amendment 1 A5); SELECT, INSERT on role_runs. Nothing else, checked across the whole role.

BEGIN;

DO $$
DECLARE
  r constant text := 'dabos_watchman';
  expected constant text := 'batch_id,blocks,body,content_md5,created_at,deadline_at,dedupe_key,delivered_at,dispatched_at,from_agent,gate_decision,gated_at,id,status,subject,to_agent,urgency_claim,urgency_reason';
  actual text;
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
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r
              AND (rolcreaterole OR rolcreatedb OR rolbypassrls OR rolreplication)) THEN
    RAISE EXCEPTION 'guard 1: role % has CREATEROLE, CREATEDB, BYPASSRLS or REPLICATION', r;
  END IF;
  -- Guard 1b: member of no role at all, and owns nothing (Dept13 rule 6: whole footprint).
  IF EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles x ON x.oid = m.member WHERE x.rolname = r) THEN
    RAISE EXCEPTION 'guard 1b: role % is a member of another role; refusing', r;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_roles x ON x.oid = c.relowner WHERE x.rolname = r)
     OR EXISTS (SELECT 1 FROM pg_namespace n JOIN pg_roles x ON x.oid = n.nspowner WHERE x.rolname = r)
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_roles x ON x.oid = p.proowner WHERE x.rolname = r) THEN
    RAISE EXCEPTION 'guard 1b: role % owns objects; refusing', r;
  END IF;

  -- Guard 2: role_runs exists (metrics, AC7).
  IF to_regclass('public.role_runs') IS NULL THEN
    RAISE EXCEPTION 'guard 2: table public.role_runs missing';
  END IF;

  -- Guard 3: if agent_inbox already exists (re-run), it must have exactly this file's columns.
  IF to_regclass('public.agent_inbox') IS NOT NULL THEN
    SELECT string_agg(column_name::text, ',' ORDER BY column_name::text COLLATE "C") INTO actual
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'agent_inbox';
    IF actual IS DISTINCT FROM expected THEN
      RAISE EXCEPTION 'guard 3: public.agent_inbox exists with other columns (%); refusing', actual;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.agent_inbox (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  from_agent     text NOT NULL,
  to_agent       text NOT NULL,
  subject        text NOT NULL,
  body           text NOT NULL DEFAULT '',
  urgency_claim  text NOT NULL DEFAULT 'none',
  urgency_reason text,
  deadline_at    timestamptz,
  blocks         text,
  dedupe_key     text NOT NULL,
  content_md5    text GENERATED ALWAYS AS (md5(subject || E'\n' || body)) STORED,
  status         text NOT NULL DEFAULT 'queued',
  batch_id       text,
  dispatched_at  timestamptz,
  delivered_at   timestamptz,
  gate_decision  text,
  gated_at       timestamptz,
  CONSTRAINT agent_inbox_from_format CHECK (from_agent ~ '^[a-z][a-z0-9_]{1,31}$' AND from_agent <> 'logan'),
  CONSTRAINT agent_inbox_to_format CHECK (to_agent ~ '^[a-z][a-z0-9_]{1,31}$' AND to_agent <> 'logan'),
  CONSTRAINT agent_inbox_subject_len CHECK (length(subject) BETWEEN 1 AND 200),
  CONSTRAINT agent_inbox_body_len CHECK (length(body) <= 8000),
  CONSTRAINT agent_inbox_dedupe_len CHECK (length(dedupe_key) BETWEEN 3 AND 200),
  CONSTRAINT agent_inbox_urgency_claim CHECK (urgency_claim IN ('none', 'urgent', 'blocking', 'deadline_today')),
  CONSTRAINT agent_inbox_status CHECK (status IN ('queued', 'delivered', 'superseded', 'suppressed')),
  CONSTRAINT agent_inbox_dedupe_content_uq UNIQUE (dedupe_key, content_md5)
);

CREATE INDEX IF NOT EXISTS idx_agent_inbox_to_status ON public.agent_inbox (to_agent, status, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_inbox_dedupe_created ON public.agent_inbox (dedupe_key, created_at DESC);

-- Amendment 2 A7: re-assert from_agent <> 'logan' on re-run (CREATE TABLE IF NOT EXISTS keeps an old CHECK).
ALTER TABLE public.agent_inbox DROP CONSTRAINT IF EXISTS agent_inbox_from_format;
ALTER TABLE public.agent_inbox ADD CONSTRAINT agent_inbox_from_format
  CHECK (from_agent ~ '^[a-z][a-z0-9_]{1,31}$' AND from_agent <> 'logan');

GRANT USAGE ON SCHEMA public TO dabos_watchman;
GRANT SELECT ON public.agent_inbox TO dabos_watchman;
GRANT UPDATE (status, batch_id, dispatched_at, gate_decision, gated_at) ON public.agent_inbox TO dabos_watchman;
GRANT INSERT (from_agent, to_agent, subject, body, urgency_claim, urgency_reason, dedupe_key) ON public.agent_inbox TO dabos_watchman;
GRANT SELECT, INSERT ON public.role_runs TO dabos_watchman;

DO $$
DECLARE
  r constant text := 'dabos_watchman';
  rid oid;
  n bigint;
  got text;
  p text;
  rel record;
  ai_oid oid;
  rr_oid oid;
  table_privs text[] := ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
  want_rel constant text := 'public.agent_inbox:SELECT,public.role_runs:INSERT,public.role_runs:SELECT';
  want_col constant text := 'public.agent_inbox.batch_id:UPDATE,public.agent_inbox.body:INSERT,'
    || 'public.agent_inbox.dedupe_key:INSERT,public.agent_inbox.dispatched_at:UPDATE,'
    || 'public.agent_inbox.from_agent:INSERT,public.agent_inbox.gate_decision:UPDATE,'
    || 'public.agent_inbox.gated_at:UPDATE,public.agent_inbox.status:UPDATE,'
    || 'public.agent_inbox.subject:INSERT,public.agent_inbox.to_agent:INSERT,'
    || 'public.agent_inbox.urgency_claim:INSERT,public.agent_inbox.urgency_reason:INSERT';
  want_upd_cols constant text[] := ARRAY['status', 'batch_id', 'dispatched_at', 'gate_decision', 'gated_at'];
  want_ins_cols constant text[] := ARRAY['from_agent', 'to_agent', 'subject', 'body', 'urgency_claim', 'urgency_reason', 'dedupe_key'];
BEGIN
  SELECT oid INTO rid FROM pg_roles WHERE rolname = r;
  ai_oid := 'public.agent_inbox'::regclass::oid;
  rr_oid := 'public.role_runs'::regclass::oid;
  IF current_setting('server_version_num')::int >= 170000 THEN
    table_privs := array_append(table_privs, 'MAINTAIN'::text);
  END IF;

  -- Guard 4a: table-level privileges granted to the role, across every relation in the database.
  SELECT coalesce(string_agg(x, ',' ORDER BY x COLLATE "C"), '') INTO got FROM (
    SELECT n.nspname || '.' || c.relname || ':' || a.privilege_type AS x
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace,
           LATERAL aclexplode(c.relacl) a
     WHERE c.relacl IS NOT NULL AND a.grantee = rid) t;
  IF got <> want_rel THEN
    RAISE EXCEPTION 'guard 4a: % table privileges are [%], expected [%]', r, got, want_rel;
  END IF;

  -- Guard 4b: column-level privileges, across every relation.
  SELECT coalesce(string_agg(x, ',' ORDER BY x COLLATE "C"), '') INTO got FROM (
    SELECT n.nspname || '.' || c.relname || '.' || at.attname || ':' || a.privilege_type AS x
      FROM pg_attribute at
      JOIN pg_class c ON c.oid = at.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace,
           LATERAL aclexplode(at.attacl) a
     WHERE at.attacl IS NOT NULL AND a.grantee = rid) t;
  IF got <> want_col THEN
    RAISE EXCEPTION 'guard 4b: % column privileges are [%], expected [%]', r, got, want_col;
  END IF;

  -- Guard 4c: schema privileges: exactly USAGE on public, nothing on any other schema.
  SELECT coalesce(string_agg(x, ',' ORDER BY x COLLATE "C"), '') INTO got FROM (
    SELECT n.nspname || ':' || a.privilege_type AS x
      FROM pg_namespace n, LATERAL aclexplode(n.nspacl) a
     WHERE n.nspacl IS NOT NULL AND a.grantee = rid) t;
  IF got <> 'public:USAGE' THEN
    RAISE EXCEPTION 'guard 4c: % schema privileges are [%], expected [public:USAGE]', r, got;
  END IF;

  -- Guard 4d: memberships — none OF the role; at most the PG16+ CREATEROLE creator ADMIN grant IN it.
  SELECT count(*) INTO n FROM pg_auth_members WHERE member = rid;
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 4d: % is a member of % other role(s); refusing', r, n;
  END IF;
  SELECT count(*) INTO n
    FROM pg_auth_members m
    JOIN pg_roles cr ON cr.oid = m.member
   WHERE m.roleid = rid
     AND NOT (
       m.admin_option
       AND (m.grantor = 10 OR m.grantor = m.member)
       AND cr.rolcreaterole
       AND NOT cr.rolsuper
     );
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 4d: % has % unexpected member role(s); refusing', r, n;
  END IF;
  SELECT count(*) INTO n FROM pg_auth_members WHERE roleid = rid;
  IF n > 1 THEN
    RAISE EXCEPTION 'guard 4d: % has % member roles (only the CREATEROLE creator grant is allowed); refusing', r, n;
  END IF;

  -- Guard 4e: the role owns nothing (Amendment 2 / #61 guard 3c).
  SELECT (SELECT count(*) FROM pg_class WHERE relowner = rid)
       + (SELECT count(*) FROM pg_namespace WHERE nspowner = rid)
       + (SELECT count(*) FROM pg_proc WHERE proowner = rid)
       + (SELECT count(*) FROM pg_type WHERE typowner = rid)
       + (SELECT count(*) FROM pg_database WHERE datdba = rid)
    INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 4e: % owns % object(s); refusing', r, n;
  END IF;

  -- Guard 4f: no grants on functions/types/languages/databases/tablespaces/foreign/large objects/parameters.
  SELECT (SELECT count(*) FROM pg_proc p, aclexplode(p.proacl) a WHERE a.grantee = rid)
       + (SELECT count(*) FROM pg_type ty, aclexplode(ty.typacl) a WHERE a.grantee = rid)
       + (SELECT count(*) FROM pg_language l, aclexplode(l.lanacl) a WHERE a.grantee = rid)
       + (SELECT count(*) FROM pg_database d, aclexplode(d.datacl) a WHERE a.grantee = rid)
       + (SELECT count(*) FROM pg_tablespace sp, aclexplode(sp.spcacl) a WHERE a.grantee = rid)
       + (SELECT count(*) FROM pg_foreign_data_wrapper w, aclexplode(w.fdwacl) a WHERE a.grantee = rid)
       + (SELECT count(*) FROM pg_foreign_server fs, aclexplode(fs.srvacl) a WHERE a.grantee = rid)
       + (SELECT count(*) FROM pg_largeobject_metadata lo, aclexplode(lo.lomacl) a WHERE a.grantee = rid)
    INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 4f: % has % grant(s) on functions, types, languages, databases, tablespaces, foreign wrappers/servers or large objects', r, n;
  END IF;
  IF to_regclass('pg_catalog.pg_parameter_acl') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM pg_catalog.pg_parameter_acl pa, aclexplode(pa.paracl) a WHERE a.grantee = $1'
      INTO n USING rid;
    IF n > 0 THEN
      RAISE EXCEPTION 'guard 4f: % has % parameter grant(s)', r, n;
    END IF;
  END IF;

  -- Guard 4g: no default privileges for or by the role (#61 guard 3e).
  SELECT count(*) INTO n
    FROM pg_default_acl da
   WHERE da.defaclrole = rid
      OR EXISTS (SELECT 1 FROM aclexplode(da.defaclacl) a WHERE a.grantee = rid);
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 4g: % has % default privilege entr(ies); refusing', r, n;
  END IF;

  -- Guard 4h: effective privileges via PUBLIC (or any path) on every non-system relation (#61 3f).
  -- Intended: SELECT on agent_inbox; SELECT+INSERT on role_runs; the column UPDATE/INSERT set above.
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
          RAISE EXCEPTION 'guard 4h: % has % on sequence %; refusing', r, p, rel.name;
        END IF;
      END LOOP;
    ELSE
      FOREACH p IN ARRAY table_privs LOOP
        IF has_table_privilege(r, rel.oid, p)
           AND NOT ((rel.oid = ai_oid AND p = 'SELECT')
                    OR (rel.oid = rr_oid AND p IN ('SELECT', 'INSERT'))) THEN
          RAISE EXCEPTION 'guard 4h: % has % on %; refusing', r, p, rel.name;
        END IF;
      END LOOP;
      -- Column privileges: only the intended agent_inbox UPDATE/INSERT columns are allowed;
      -- anything else (including via PUBLIC) is refused. 4b already pins direct ACLs.
      IF rel.oid = ai_oid THEN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'agent_inbox'
             AND has_column_privilege(r, ai_oid, c.column_name, 'UPDATE')
             AND NOT (c.column_name = ANY (want_upd_cols))
        ) OR EXISTS (
          SELECT 1 FROM unnest(want_upd_cols) AS c(column_name)
           WHERE NOT has_column_privilege(r, ai_oid, c.column_name, 'UPDATE')
        ) THEN
          RAISE EXCEPTION 'guard 4h: % has unexpected column UPDATE on agent_inbox; refusing', r;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'agent_inbox'
             AND has_column_privilege(r, ai_oid, c.column_name, 'INSERT')
             AND NOT (c.column_name = ANY (want_ins_cols))
        ) OR EXISTS (
          SELECT 1 FROM unnest(want_ins_cols) AS c(column_name)
           WHERE NOT has_column_privilege(r, ai_oid, c.column_name, 'INSERT')
        ) THEN
          RAISE EXCEPTION 'guard 4h: % has unexpected column INSERT on agent_inbox; refusing', r;
        END IF;
      ELSIF NOT has_table_privilege(r, rel.oid, 'SELECT') AND has_any_column_privilege(r, rel.oid, 'SELECT') THEN
        RAISE EXCEPTION 'guard 4h: % has column SELECT on %; refusing', r, rel.name;
      ELSIF NOT has_table_privilege(r, rel.oid, 'INSERT') AND has_any_column_privilege(r, rel.oid, 'INSERT') THEN
        RAISE EXCEPTION 'guard 4h: % has column INSERT on %; refusing', r, rel.name;
      ELSIF NOT has_table_privilege(r, rel.oid, 'UPDATE') AND has_any_column_privilege(r, rel.oid, 'UPDATE') THEN
        RAISE EXCEPTION 'guard 4h: % has column UPDATE on %; refusing', r, rel.name;
      ELSIF NOT has_table_privilege(r, rel.oid, 'REFERENCES') AND has_any_column_privilege(r, rel.oid, 'REFERENCES') THEN
        RAISE EXCEPTION 'guard 4h: % has column REFERENCES on %; refusing', r, rel.name;
      END IF;
    END IF;
  END LOOP;

  -- Guard 4i: no CREATE on any schema; no CREATE on the database; refuse PUBLIC CREATE/TEMP ACL on DB.
  SELECT count(*) INTO n FROM pg_namespace ns WHERE has_schema_privilege(r, ns.oid, 'CREATE');
  IF n > 0 THEN
    RAISE EXCEPTION 'guard 4i: % can CREATE in % schema(s); refusing', r, n;
  END IF;
  IF has_database_privilege(r, current_database(), 'CREATE') THEN
    RAISE EXCEPTION 'guard 4i: % can CREATE in database %; refusing', r, current_database();
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_database d, LATERAL aclexplode(d.datacl) a
     WHERE d.datname = current_database()
       AND a.grantee = 0
       AND a.privilege_type IN ('CREATE', 'TEMPORARY')
  ) THEN
    RAISE EXCEPTION 'guard 4i: PUBLIC has CREATE or TEMPORARY on database %; refusing', current_database();
  END IF;

  RAISE NOTICE 'agent_inbox and watchman grants in place for %', r;
END $$;

COMMIT;

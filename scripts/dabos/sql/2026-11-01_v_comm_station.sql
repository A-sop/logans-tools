-- Three-basket comm center v3: read-only view v_comm_station + optional grants.
-- Acceptance: docs/acceptance/2026-11-01_comm-center-baskets-v3.ACCEPTANCE.md
-- NOT a migration. NOT EXECUTED by this PR.
--
-- Per post (Div1..Div7, LDW): in_count, pending_count, out_count, pending_cleared_count,
-- pending_past_clear_by, oldest_in_age, oldest_pending_since, never_reviewed_count.
--
-- Grants: if role dabos_status_digest or dabos_watchman exists, GRANT SELECT on the view only,
-- with the #61 guard style (PG16+ CREATEROLE creator-admin nuance). Roles that do not exist
-- are skipped (no CREATE ROLE here).
--
-- Apply: psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -1 -f scripts/dabos/sql/2026-11-01_v_comm_station.sql
-- Undo:  scripts/dabos/sql/2026-11-01_v_comm_station.UNDO.sql

BEGIN;

CREATE OR REPLACE VIEW public.v_comm_station AS
WITH posts AS (
  SELECT * FROM (VALUES
    ('Div1'),('Div2'),('Div3'),('Div4'),('Div5'),('Div6'),('Div7'),('LDW')
  ) AS p(post)
),
task_posts AS (
  SELECT
    t.*,
    CASE
      WHEN t.assigned_agent IN ('LDW','ldw','Ldw') THEN 'LDW'
      WHEN t.assigned_agent IN (
        'Div1','Div2','Div3','Div4','Div5','Div6','Div7',
        'div1','div2','div3','div4','div5','div6','div7',
        'DIV1','DIV2','DIV3','DIV4','DIV5','DIV6','DIV7'
      ) THEN 'Div' || right(upper(t.assigned_agent), 1)
      WHEN t.division_id IN (
        'Div1','Div2','Div3','Div4','Div5','Div6','Div7',
        'div1','div2','div3','div4','div5','div6','div7',
        'DIV1','DIV2','DIV3','DIV4','DIV5','DIV6','DIV7'
      ) THEN 'Div' || right(upper(t.division_id), 1)
      ELSE NULL
    END AS post
  FROM public.tasks t
)
SELECT
  p.post,
  count(*) FILTER (WHERE tp.basket = 'in')::int AS in_count,
  count(*) FILTER (WHERE tp.basket = 'pending')::int AS pending_count,
  count(*) FILTER (WHERE tp.basket = 'out')::int AS out_count,
  count(*) FILTER (
    WHERE tp.basket = 'pending'
      AND coalesce((tp.ingest_meta->'pending'->>'cleared')::boolean, false)
  )::int AS pending_cleared_count,
  count(*) FILTER (
    WHERE tp.basket = 'pending'
      AND (tp.ingest_meta->'pending'->>'clear_by') IS NOT NULL
      AND (tp.ingest_meta->'pending'->>'clear_by')::timestamptz < NOW()
  )::int AS pending_past_clear_by,
  MIN(tp.created_at) FILTER (WHERE tp.basket = 'in') AS oldest_in_at,
  CASE
    WHEN MIN(tp.created_at) FILTER (WHERE tp.basket = 'in') IS NULL THEN NULL
    ELSE (NOW() - MIN(tp.created_at) FILTER (WHERE tp.basket = 'in'))::text
  END AS oldest_in_age,
  MIN( (tp.ingest_meta->'pending'->>'since')::timestamptz )
    FILTER (WHERE tp.basket = 'pending') AS oldest_pending_since,
  count(*) FILTER (
    WHERE tp.basket = 'pending'
      AND (tp.ingest_meta->'pending'->>'last_reviewed') IS NULL
  )::int AS never_reviewed_count
FROM posts p
LEFT JOIN task_posts tp ON tp.post = p.post
GROUP BY p.post
ORDER BY p.post;

DO $$
DECLARE
  roles text[] := ARRAY['dabos_status_digest', 'dabos_watchman'];
  r text;
  is_super boolean;
  roid oid;
  n bigint;
  view_oid oid;
BEGIN
  IF to_regclass('public.v_comm_station') IS NULL THEN
    RAISE EXCEPTION 'guard 0: view public.v_comm_station missing after CREATE';
  END IF;
  view_oid := 'public.v_comm_station'::regclass::oid;

  FOREACH r IN ARRAY roles LOOP
    SELECT rolsuper INTO is_super FROM pg_roles WHERE rolname = r;
    IF NOT FOUND THEN
      RAISE NOTICE 'comm-center view grants: role % absent — skip', r;
      CONTINUE;
    END IF;

    IF is_super THEN
      RAISE EXCEPTION 'guard 1: role % is a superuser; refusing grant', r;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'neon_superuser')
       AND pg_has_role(r, 'neon_superuser', 'MEMBER') THEN
      RAISE EXCEPTION 'guard 1: role % is a member of neon_superuser; refusing', r;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_roles
       WHERE rolname = r AND (rolcreaterole OR rolcreatedb OR rolbypassrls OR rolreplication)
    ) THEN
      RAISE EXCEPTION 'guard 1: role % has CREATEROLE/CREATEDB/BYPASSRLS/REPLICATION; refusing', r;
    END IF;

    EXECUTE format('GRANT SELECT ON public.v_comm_station TO %I', r);

    -- Guard 3a: SELECT present on the view
    IF NOT has_table_privilege(r, 'public.v_comm_station', 'SELECT') THEN
      RAISE EXCEPTION 'guard 3a: % lacks SELECT on v_comm_station', r;
    END IF;

    SELECT oid INTO roid FROM pg_roles WHERE rolname = r;

    -- 3b: role must not be a member of others; others may only be the PG16+ CREATEROLE creator admin
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
      RAISE EXCEPTION 'guard 3b: % has % member roles (only CREATEROLE creator grant allowed); refusing', r, n;
    END IF;

    -- 3d (narrow): no unintended direct privileges on this view beyond SELECT
    SELECT count(*) INTO n
      FROM pg_class c, aclexplode(c.relacl) a
     WHERE c.oid = view_oid
       AND a.grantee = roid
       AND a.privilege_type <> 'SELECT';
    IF n > 0 THEN
      RAISE EXCEPTION 'guard 3d: % has % non-SELECT grant(s) on v_comm_station', r, n;
    END IF;

    RAISE NOTICE 'comm-center view grants: SELECT on v_comm_station → %', r;
  END LOOP;
END $$;

COMMIT;

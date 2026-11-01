-- Three-basket comm center v3: normalise assigned_agent / division_id / department_id.
-- Acceptance: docs/acceptance/2026-11-01_comm-center-baskets-v3.ACCEPTANCE.md
-- NOT a migration. NOT EXECUTED by this PR. Apply only after Dept13 PASS and Logan's yes,
-- and after the rollback CSV export has been written.
--
-- Explicit mapping tables only. Any distinct value present that is not mapped → RAISE with list.
-- Capability assigned_agent values (research, gfp-weekly-stats, …) that are not post/dept-like
-- stay unchanged (they are in the allow-list below).
--
-- Apply (one transaction): psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -1 -f scripts/dabos/sql/2026-11-01_comm_center_normalise_addressees.sql
-- Undo: scripts/dabos/sql/2026-11-01_comm_center_normalise_addressees.UNDO.sql (restore from rollback CSV).

BEGIN;

DO $$
DECLARE
  unmapped text;
  n_div bigint;
  n_agent bigint;
  n_dept bigint;
BEGIN
  IF to_regclass('public.tasks') IS NULL THEN
    RAISE EXCEPTION 'guard 0: public.tasks missing';
  END IF;

  CREATE TEMP TABLE _div_map (src text PRIMARY KEY, dst text NOT NULL) ON COMMIT DROP;
  INSERT INTO _div_map (src, dst) VALUES
    ('Div1','Div1'),('Div2','Div2'),('Div3','Div3'),('Div4','Div4'),
    ('Div5','Div5'),('Div6','Div6'),('Div7','Div7'),
    ('div1','Div1'),('div2','Div2'),('div3','Div3'),('div4','Div4'),
    ('div5','Div5'),('div6','Div6'),('div7','Div7'),
    ('DIV1','Div1'),('DIV2','Div2'),('DIV3','Div3'),('DIV4','Div4'),
    ('DIV5','Div5'),('DIV6','Div6'),('DIV7','Div7'),
    ('Div 1','Div1'),('Div 2','Div2'),('Div 3','Div3'),('Div 4','Div4'),
    ('Div 5','Div5'),('Div 6','Div6'),('Div 7','Div7');

  CREATE TEMP TABLE _agent_map (src text PRIMARY KEY, dst text NOT NULL) ON COMMIT DROP;
  INSERT INTO _agent_map (src, dst)
  SELECT src, dst FROM _div_map
  UNION ALL
  SELECT * FROM (VALUES
    ('LDW','LDW'),('ldw','LDW'),('Ldw','LDW'),
    -- capability agents: identity map (unchanged)
    ('research','research'),
    ('gfp-weekly-stats','gfp-weekly-stats')
  ) AS v(src, dst);

  CREATE TEMP TABLE _dept_map (src text PRIMARY KEY, dst text NOT NULL) ON COMMIT DROP;
  INSERT INTO _dept_map (src, dst)
  SELECT d, d FROM (VALUES
    ('Dept1'),('Dept2'),('Dept3'),('Dept4'),('Dept5'),('Dept6'),('Dept7'),
    ('Dept8'),('Dept9'),('Dept10'),('Dept11'),('Dept12'),('Dept13'),('Dept14'),
    ('Dept15'),('Dept16'),('Dept17'),('Dept18'),('Dept19'),('Dept20'),('Dept21')
  ) AS x(d);
  INSERT INTO _dept_map (src, dst)
  SELECT lower(dst), dst FROM _dept_map
  ON CONFLICT DO NOTHING;
  INSERT INTO _dept_map (src, dst)
  SELECT upper(dst), dst FROM _dept_map WHERE dst LIKE 'Dept%'
  ON CONFLICT DO NOTHING;
  INSERT INTO _dept_map (src, dst)
  SELECT 'Dept ' || substr(dst, 5), dst FROM _dept_map WHERE src = dst
  ON CONFLICT DO NOTHING;
  INSERT INTO _dept_map (src, dst)
  SELECT 'dept ' || substr(dst, 5), dst FROM _dept_map WHERE src = dst
  ON CONFLICT DO NOTHING;
  INSERT INTO _dept_map (src, dst)
  SELECT 'dept' || substr(dst, 5), dst FROM _dept_map WHERE src = dst
  ON CONFLICT DO NOTHING;

  -- Unmapped division_id
  SELECT string_agg(DISTINCT division_id, ', ' ORDER BY division_id) INTO unmapped
    FROM tasks t
   WHERE NOT EXISTS (SELECT 1 FROM _div_map m WHERE m.src = t.division_id);
  IF unmapped IS NOT NULL THEN
    RAISE EXCEPTION 'unmapped division_id values (refusing to guess): %', unmapped;
  END IF;

  -- Unmapped assigned_agent (NULL ok; empty string treated as unmapped if present)
  SELECT string_agg(DISTINCT assigned_agent, ', ' ORDER BY assigned_agent) INTO unmapped
    FROM tasks t
   WHERE assigned_agent IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM _agent_map m WHERE m.src = t.assigned_agent);
  IF unmapped IS NOT NULL THEN
    RAISE EXCEPTION 'unmapped assigned_agent values (refusing to guess): %', unmapped;
  END IF;

  -- Unmapped department_id (NULL ok)
  SELECT string_agg(DISTINCT department_id, ', ' ORDER BY department_id) INTO unmapped
    FROM tasks t
   WHERE department_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM _dept_map m WHERE m.src = t.department_id);
  IF unmapped IS NOT NULL THEN
    RAISE EXCEPTION 'unmapped department_id values (refusing to guess): %', unmapped;
  END IF;

  UPDATE tasks t
     SET division_id = m.dst,
         updated_at = NOW()
    FROM _div_map m
   WHERE t.division_id = m.src
     AND t.division_id IS DISTINCT FROM m.dst;
  GET DIAGNOSTICS n_div = ROW_COUNT;

  UPDATE tasks t
     SET assigned_agent = m.dst,
         updated_at = NOW()
    FROM _agent_map m
   WHERE t.assigned_agent = m.src
     AND t.assigned_agent IS DISTINCT FROM m.dst;
  GET DIAGNOSTICS n_agent = ROW_COUNT;

  UPDATE tasks t
     SET department_id = m.dst,
         updated_at = NOW()
    FROM _dept_map m
   WHERE t.department_id = m.src
     AND t.department_id IS DISTINCT FROM m.dst;
  GET DIAGNOSTICS n_dept = ROW_COUNT;

  RAISE NOTICE 'comm-center normalise: division_id rows=% assigned_agent rows=% department_id rows=%',
    n_div, n_agent, n_dept;
END $$;

COMMIT;

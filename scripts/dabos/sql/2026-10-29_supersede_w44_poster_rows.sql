-- One-off data correction: W44 week-close poster rows (Dept13 FAIL 2026-10-29).
-- NOT a migration (lives outside ./migrations so `npm run dabos:migrate` never runs it).
-- NOT EXECUTED by this PR. Runs only after Dept13 PASS and Logan's explicit OK, and only
-- after migration 021_stats_conditions_superseded.sql is applied.
--
-- Run (Logan): psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -f scripts/dabos/sql/2026-10-29_supersede_w44_poster_rows.sql
--   Every guard RAISEs inside one DO block inside one transaction: any mismatch aborts
--   and nothing is changed. Re-running after success aborts (rows already superseded).
--
-- What it does:
--   1. Marks the 6 stats rows in workspace div-live-2026-W44 superseded
--      (ln02 poster @2474654: ISO Mon-Sun window, all-time qa).
--   2. Marks the 28 conditions rows created 2026-10-29T13:30:00Z..13:30:20Z
--      (7 divisions + 21 departments; poster default, not an assignment) superseded.
--   No corrected rows of any kind: every W44 division stat is to-report, Div4 included.
--   The Div4 W44 = 6 mark was withdrawn by Dept13 on 29 Oct: four of the six PASS dates can't be pinned to a day
--   (#171/#177/#178/#179 ph1: bounded within W44, not sourced to the day).
--   No Div4/Div5/Dept12 row, no corrected condition rows.
--   End state (guard 5): 0 active stats rows in div-live-2026-W44.
--
-- Undo (manual, if ever needed):
--   BEGIN;
--   UPDATE stats SET superseded_at = NULL, superseded_reason = NULL
--     WHERE superseded_reason = 'Dept13 FAIL 2026-10-29: ln02 poster @2474654 (ISO window, all-time qa)';
--   UPDATE conditions SET superseded_at = NULL, superseded_reason = NULL
--     WHERE superseded_reason = 'Dept13 FAIL 2026-10-29: poster default, not an assignment';
--   COMMIT;

BEGIN;

DO $$
DECLARE
  stat_ids uuid[] := ARRAY[
    '2683a636-bb19-46f4-a800-1f73d5ba16ed', -- Div5  qa_pass_rate
    'e2f0c13c-bc2f-420a-80cc-47539d40aedf', -- Div2  leads_or_touchpoints_created
    '4e3ec69c-dfef-4ba4-9a89-1dffd4114623', -- Div2/Dept4 content_pieces_shipped
    '01741053-8340-4b45-a2da-6bc707647cdf', -- Div4  shipped_outputs (to-report: =6 mark withdrawn by Dept13 on 29 Oct)
    'd9e75ecc-6b37-44f2-8929-786198cf47f0', -- Div4/Dept12 shipped_outputs
    'b258a7bb-d67a-4ef7-9288-900e6d871e61'  -- Div7  plan_completion_rate
  ]::uuid[];
  condition_ids uuid[] := ARRAY[
    -- divisions (7)
    '30ca4afd-3824-4897-93c6-ff494c275f58', -- Div1
    '92dfb7b3-7bd5-4959-9c8a-6bb0721cf9fc', -- Div2
    '18c914b8-9c7f-40ea-8865-5bcf9ea41163', -- Div3
    '060a7997-255b-4870-84b2-38640dd1b34c', -- Div4
    '1a60d12e-2f31-4ccc-9c9a-5612a80b526a', -- Div5
    '6469092d-2e8b-4d75-85e4-5343586f7662', -- Div6
    'be025a0d-efca-4eb7-9933-054430a1dfe9', -- Div7
    -- departments (21)
    'a078de50-9007-4cd3-b8a0-93074b3ba7bd', -- Dept1
    '9ea92055-8c29-4ae9-b0d2-07c122d0d74b', -- Dept2
    'f0fe4fc1-c440-4c36-969f-c77873af0232', -- Dept3
    '6984afe8-cfe6-42e8-93d2-54643ea886ec', -- Dept4
    'e23d9ec4-39f3-437e-a8f2-44cff39c33f9', -- Dept5
    '6d664f97-4e72-4bbe-aa3c-9535b342ca82', -- Dept6
    '448d849f-4bae-4d1b-8142-5d84d9d136f6', -- Dept7
    'ac3c58c7-5e4a-4214-8b62-ce580dd151bc', -- Dept8
    '5f9fb7d0-f4cd-4822-8f27-5033e0414329', -- Dept9
    '0cab3bcf-6bb8-4122-a547-6b0a9c45de0b', -- Dept10
    'dd1da962-91c4-4d02-ae1e-8d1bcf9127b2', -- Dept11
    'e20e54b0-280b-4189-a2d5-28cd6ec3400a', -- Dept12
    '1c42a603-47b6-44e4-8287-aaa5512ed186', -- Dept13
    '298628fc-d39e-4982-ab2b-1961f2713d13', -- Dept14
    'c450fc2d-7167-42a5-aaa3-fabb5cfa3e10', -- Dept15
    'f894de47-4471-41ba-83dc-c9924f595407', -- Dept16
    '32094da4-a0c5-43a2-8813-72b5e831d723', -- Dept17
    '4d471b91-7f28-4ffa-97ff-2e757b4c8b8c', -- Dept18
    'c232dcfb-4eae-4eae-a2be-65ebe7fb421d', -- Dept19
    '0ae910ae-5023-4173-995e-64c385f18f29', -- Dept20
    '451a216b-fee4-4601-b202-c6d64e342456'  -- Dept21
  ]::uuid[];
  ws constant text := 'div-live-2026-W44';
  window_start constant timestamptz := '2026-10-29T13:30:00Z';
  window_end constant timestamptz := '2026-10-29T13:30:20Z';
  stats_reason constant text := 'Dept13 FAIL 2026-10-29: ln02 poster @2474654 (ISO window, all-time qa)';
  cond_reason constant text := 'Dept13 FAIL 2026-10-29: poster default, not an assignment';
  n integer;
BEGIN
  -- Guard 0: migration 021 applied.
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = current_schema()
     AND table_name IN ('stats', 'conditions')
     AND column_name IN ('superseded_at', 'superseded_reason');
  IF n <> 4 THEN
    RAISE EXCEPTION 'guard 0: migration 021 not applied (found % of 4 supersede columns)', n;
  END IF;

  -- Guard 1: exactly the 6 expected, not-yet-superseded stats rows, and they are the only
  -- active rows in the workspace.
  SELECT count(*) INTO n FROM stats
   WHERE id = ANY(stat_ids) AND workspace_id = ws AND superseded_at IS NULL;
  IF n <> 6 THEN
    RAISE EXCEPTION 'guard 1: expected 6 active stats rows in %, found %', ws, n;
  END IF;
  SELECT count(*) INTO n FROM stats WHERE workspace_id = ws AND superseded_at IS NULL;
  IF n <> 6 THEN
    RAISE EXCEPTION 'guard 1b: expected 6 active stats rows in workspace %, found % (unlisted rows present)', ws, n;
  END IF;
  SELECT count(*) INTO n FROM stats
   WHERE id = '01741053-8340-4b45-a2da-6bc707647cdf' AND division_id = 'Div4'
     AND department_id IS NULL AND metric_key = 'shipped_outputs' AND value = 2;
  IF n <> 1 THEN
    RAISE EXCEPTION 'guard 1c: 01741053-... is not the Div4 division-level shipped_outputs row with value 2';
  END IF;

  -- Guard 2: exactly the 28 listed, not-yet-superseded conditions rows in the window,
  -- and no unlisted rows in that window.
  SELECT count(*) INTO n FROM conditions
   WHERE id = ANY(condition_ids) AND created_at >= window_start AND created_at <= window_end
     AND superseded_at IS NULL;
  IF n <> 28 THEN
    RAISE EXCEPTION 'guard 2: expected 28 active conditions rows in window, found %', n;
  END IF;
  SELECT count(*) INTO n FROM conditions WHERE created_at >= window_start AND created_at <= window_end;
  IF n <> 28 THEN
    RAISE EXCEPTION 'guard 2b: expected 28 conditions rows in window total, found %', n;
  END IF;

  -- 1. Supersede stats.
  UPDATE stats SET superseded_at = now(), superseded_reason = stats_reason
   WHERE id = ANY(stat_ids) AND workspace_id = ws AND superseded_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 6 THEN
    RAISE EXCEPTION 'guard 3: stats update touched % rows, expected 6', n;
  END IF;

  -- 2. Supersede conditions.
  UPDATE conditions SET superseded_at = now(), superseded_reason = cond_reason
   WHERE id = ANY(condition_ids) AND created_at >= window_start AND created_at <= window_end
     AND superseded_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 28 THEN
    RAISE EXCEPTION 'guard 4: conditions update touched % rows, expected 28', n;
  END IF;

  -- Guard 5: end state. Nothing active remains in the workspace (all to-report, no inserts).
  SELECT count(*) INTO n FROM stats WHERE workspace_id = ws AND superseded_at IS NULL;
  IF n <> 0 THEN
    RAISE EXCEPTION 'guard 5: expected 0 active stats rows in % after correction, found %', ws, n;
  END IF;

  RAISE NOTICE 'W44 correction ok: 6 stats + 28 conditions superseded, 0 active W44 rows (all to-report)';
END
$$;

COMMIT;

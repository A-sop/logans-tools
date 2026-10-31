-- One-off data correction (Div7 2026-10-31, applying existing rulings: stat week closes Thu 14:00
-- Europe/Berlin; a stat counts in the week the event happened):
--   Part 1: repost the W44 division values the DABOS W44 stat register validated
--           (docs/registers/stats/2026-W44.md on DABOS main, Dept13-passed via DABOS #186).
--   Part 2: fold the 6 non-Div1 div-live-2026-W30 rows (old ISO-Sunday end) onto the W30 close.
-- Acceptance: docs/acceptance/2026-10-31_repost_div_live_w44_and_w30_close.ACCEPTANCE.md
-- NOT a migration (lives outside ./migrations so `npm run dabos:migrate` never runs it).
-- NOT EXECUTED by this PR. Runs only after Dept13 PASS and Logan's own yes to merge and apply,
-- and only on a DB where migration 021_stats_conditions_superseded.sql is applied.
-- Pattern: scripts/dabos/sql/2026-10-31_supersede_div_live_w31_w43.sql (#51), supersede never delete.
--
-- Run (Logan): psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -f scripts/dabos/sql/2026-10-31_repost_div_live_w44_and_w30_close.sql
--   One transaction; every guard RAISEs, so any mismatch aborts and nothing is changed.
--   Re-running after success is a no-op (end state re-verified, nothing written). A partial
--   state aborts.
--
-- Part 1 (insert only), recorded_at 2026-10-29T12:59:59.999Z (W44 close Thu 29 Oct 14:00 CET - 1 ms):
--   Div4 / NULL   shipped_outputs 0   (register: Dept13 FAIL on posted 6 -> 0 validated, DABOS #196 PASS)
--   Div4 / Dept12 shipped_outputs 0   (division + Dept12 pair kept as the poster writes it; Div7 ruling)
--   Not posted: every to-report value (Div1 secondary metrics, Div2 0/0, Div3, Div5, Div6) and Div7
--   (register stat pct_hats_with_policy_text_and_battle_plan_current 100% is not the div-live Div7
--   metric plan_completion_rate; flagged for Dept14/Div7). Div1 artifacts_indexed W44 = 60 is
--   posted by #49, never here: this script writes no Div1 row in any week.
--   The 6 W44 rows superseded by #38 (2026-10-29_supersede_w44_poster_rows.sql) stay as they are.
-- Part 2 (supersede-and-repost): the 6 non-Div1 W30 rows at 2026-07-26T21:59:59.999Z (Sun 26 Jul
--   23:59:59.999 Berlin) are superseded and reposted, same value, at 2026-07-23T11:59:59.999Z
--   (org-week.ts recordedAtForClosedOrgWeek(statWeekWindow(2026, 30)); CEST week). Both W30 Div1
--   rows (artifacts_indexed 75, division + Dept3) are untouched. Values are not recomputed.
--
-- Undo (manual, if ever needed):
--   BEGIN;
--   DELETE FROM stats WHERE basis->>'correction' = '2026-10-31_repost_div_live_w44_and_w30_close' AND superseded_at IS NULL;
--   UPDATE stats SET superseded_at = NULL, superseded_reason = NULL
--     WHERE superseded_reason = 'Div7 2026-10-31: W30 old poster ISO-week-end recorded_at (not Thu 14:00 Berlin close)';
--   COMMIT;

BEGIN;

CREATE TEMP TABLE div_live_w30_fix (
  id uuid PRIMARY KEY,
  ws text NOT NULL,
  division text NOT NULL,
  dept text,
  metric text NOT NULL,
  val numeric NOT NULL,
  old_rec text NOT NULL,
  new_rec text NOT NULL
) ON COMMIT DROP;

INSERT INTO div_live_w30_fix (id, ws, division, dept, metric, val, old_rec, new_rec) VALUES
  ('a8ac8685-1795-4720-be9c-215396160c82', 'div-live-2026-W30', 'Div2', NULL, 'leads_or_touchpoints_created', 0, '2026-07-26T21:59:59.999Z', '2026-07-23T11:59:59.999Z'),
  ('498ca334-3a11-426c-9524-3da7fb29e9bf', 'div-live-2026-W30', 'Div2', 'Dept4', 'content_pieces_shipped', 0, '2026-07-26T21:59:59.999Z', '2026-07-23T11:59:59.999Z'),
  ('77d44bda-75df-4941-b0f3-f9d1f9084607', 'div-live-2026-W30', 'Div4', NULL, 'shipped_outputs', 1, '2026-07-26T21:59:59.999Z', '2026-07-23T11:59:59.999Z'),
  ('6a9c4322-63c6-4907-9c12-a96ee8869139', 'div-live-2026-W30', 'Div4', 'Dept12', 'shipped_outputs', 1, '2026-07-26T21:59:59.999Z', '2026-07-23T11:59:59.999Z'),
  ('ddb587d9-08e9-4f53-9112-957df3ebf1f7', 'div-live-2026-W30', 'Div5', NULL, 'qa_pass_rate', 80, '2026-07-26T21:59:59.999Z', '2026-07-23T11:59:59.999Z'),
  ('47cee040-8a64-44d3-8a1b-64cf6d9931c4', 'div-live-2026-W30', 'Div7', NULL, 'plan_completion_rate', 28.6, '2026-07-26T21:59:59.999Z', '2026-07-23T11:59:59.999Z');

CREATE TEMP TABLE div_live_w30_div1_keep (
  id uuid PRIMARY KEY,
  dept text
) ON COMMIT DROP;

INSERT INTO div_live_w30_div1_keep (id, dept) VALUES
  ('252780ef-4988-428a-ad3b-5eb6a6cf43db', NULL),
  ('dd2b66e2-1390-44b2-b2a4-d1829ff09400', 'Dept3');

CREATE TEMP TABLE div_live_w44_post (
  division text NOT NULL,
  dept text,
  metric text NOT NULL,
  val numeric NOT NULL,
  rec text NOT NULL,
  register_check text NOT NULL
) ON COMMIT DROP;

INSERT INTO div_live_w44_post (division, dept, metric, val, rec, register_check) VALUES
  ('Div4', NULL, 'shipped_outputs', 0, '2026-10-29T12:59:59.999Z', 'FAIL (posted 6) -> 0 validated; Dept13 PASS on DABOS #196 @ 878be41b'),
  ('Div4', 'Dept12', 'shipped_outputs', 0, '2026-10-29T12:59:59.999Z', 'FAIL (posted 6) -> 0 validated; Dept13 PASS on DABOS #196 @ 878be41b');

DO $$
DECLARE
  tag constant text := '2026-10-31_repost_div_live_w44_and_w30_close';
  reason constant text := 'Div7 2026-10-31: W30 old poster ISO-week-end recorded_at (not Thu 14:00 Berlin close)';
  reason_38 constant text := 'Dept13 FAIL 2026-10-29: ln02 poster @2474654 (ISO window, all-time qa)';
  by_tag constant text := 'div-live-correction-2026-10-31';
  w30 constant text := 'div-live-2026-W30';
  w44 constant text := 'div-live-2026-W44';
  w30_close constant timestamptz := '2026-07-23T11:59:59.999Z';
  w44_close constant timestamptz := '2026-10-29T12:59:59.999Z';
  w30_old constant timestamptz := '2026-07-26T21:59:59.999Z';
  w44_38_ids constant uuid[] := ARRAY[
    '2683a636-bb19-46f4-a800-1f73d5ba16ed', -- Div5  qa_pass_rate 75
    'e2f0c13c-bc2f-420a-80cc-47539d40aedf', -- Div2  leads_or_touchpoints_created 0
    '4e3ec69c-dfef-4ba4-9a89-1dffd4114623', -- Div2/Dept4 content_pieces_shipped 0
    '01741053-8340-4b45-a2da-6bc707647cdf', -- Div4  shipped_outputs 2
    'd9e75ecc-6b37-44f2-8929-786198cf47f0', -- Div4/Dept12 shipped_outputs 2
    'b258a7bb-d67a-4ef7-9288-900e6d871e61'  -- Div7  plan_completion_rate 28.6
  ]::uuid[];
  n integer;
  active_old integer;
  done_old integer;
  w30_reposts integer;
  w44_posts integer;
  other_before text;
  other_after text;
  listed_before text;
  listed_after text;
  keep_before text;
  keep_after text;
  w44_38_before text;
  w44_38_after text;
BEGIN
  -- Guard 0: migration 021 applied; fix sets have the expected shape.
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = current_schema()
     AND table_name = 'stats'
     AND column_name IN ('superseded_at', 'superseded_reason');
  IF n <> 2 THEN
    RAISE EXCEPTION 'guard 0: migration 021 not applied (found % of 2 stats supersede columns)', n;
  END IF;
  IF (SELECT count(*) FROM div_live_w30_fix) <> 6
     OR EXISTS (SELECT 1 FROM div_live_w30_fix WHERE ws <> w30 OR division = 'Div1'
                  OR old_rec::timestamptz <> w30_old OR new_rec::timestamptz <> w30_close)
     OR (SELECT count(*) FROM div_live_w30_div1_keep) <> 2
     OR (SELECT count(*) FROM div_live_w44_post) <> 2
     OR EXISTS (SELECT 1 FROM div_live_w44_post WHERE division = 'Div1' OR rec::timestamptz <> w44_close) THEN
    RAISE EXCEPTION 'guard 0b: fix sets are not 6 non-Div1 W30 rows + 2 kept Div1 W30 rows + 2 non-Div1 W44 posts';
  END IF;

  -- State: before (6 active W30 rows at the old recorded_at, nothing tagged) or after (all done).
  SELECT count(*) INTO active_old FROM stats s JOIN div_live_w30_fix f ON f.id = s.id
   WHERE s.superseded_at IS NULL AND s.workspace_id = f.ws AND s.division_id = f.division
     AND s.department_id IS NOT DISTINCT FROM f.dept AND s.metric_key = f.metric
     AND s.value = f.val AND s.recorded_at = f.old_rec::timestamptz;
  SELECT count(*) INTO done_old FROM stats s JOIN div_live_w30_fix f ON f.id = s.id
   WHERE s.superseded_at IS NOT NULL AND s.superseded_reason = reason;
  SELECT count(*) INTO w30_reposts FROM stats WHERE basis->>'correction' = tag AND workspace_id = w30;
  SELECT count(*) INTO w44_posts FROM stats WHERE basis->>'correction' = tag AND workspace_id = w44;

  IF active_old = 6 AND done_old = 0 AND w30_reposts = 0 AND w44_posts = 0
     AND NOT EXISTS (SELECT 1 FROM stats WHERE basis->>'correction' = tag) THEN
    -- Guard 1: the 6 listed rows are the only non-Div1 rows in div-live-2026-W30 (active or not).
    SELECT count(*) INTO n FROM stats WHERE workspace_id = w30 AND division_id <> 'Div1';
    IF n <> 6 THEN
      RAISE EXCEPTION 'guard 1: expected 6 non-Div1 rows in div-live-2026-W30, found % (unlisted rows present)', n;
    END IF;
    SELECT count(DISTINCT (workspace_id, division_id, department_id, metric_key)) INTO n
      FROM stats WHERE id IN (SELECT id FROM div_live_w30_fix);
    IF n <> 6 THEN
      RAISE EXCEPTION 'guard 1b: expected 6 distinct workspace/division/department/metric keys, found %', n;
    END IF;
    -- Guard 1c: both W30 Div1 rows present, active, 75 at the old recorded_at; no other Div1 W30 row.
    SELECT count(*) INTO n FROM stats s JOIN div_live_w30_div1_keep k ON k.id = s.id
     WHERE s.workspace_id = w30 AND s.division_id = 'Div1' AND s.department_id IS NOT DISTINCT FROM k.dept
       AND s.metric_key = 'artifacts_indexed' AND s.value = 75 AND s.recorded_at = w30_old
       AND s.superseded_at IS NULL;
    IF n <> 2 OR (SELECT count(*) FROM stats WHERE workspace_id = w30 AND division_id = 'Div1') <> 2 THEN
      RAISE EXCEPTION 'guard 1c: the two W30 Div1 artifacts_indexed rows (75) are not as expected';
    END IF;
    -- Guard 1d: W44 holds exactly the 6 #38-superseded non-Div1 rows and no active non-Div1 row.
    SELECT count(*) INTO n FROM stats
     WHERE id = ANY(w44_38_ids) AND workspace_id = w44 AND superseded_at IS NOT NULL AND superseded_reason = reason_38;
    IF n <> 6 THEN
      RAISE EXCEPTION 'guard 1d: expected the 6 #38-superseded W44 rows, found %', n;
    END IF;
    SELECT count(*) INTO n FROM stats WHERE workspace_id = w44 AND division_id <> 'Div1';
    IF n <> 6 THEN
      RAISE EXCEPTION 'guard 1d: expected 6 non-Div1 rows in div-live-2026-W44 (all #38-superseded), found %', n;
    END IF;
    -- Guard 1e: no active row already holds a W44 key this script posts.
    SELECT count(*) INTO n FROM stats s JOIN div_live_w44_post p
        ON s.workspace_id = w44 AND s.division_id = p.division
       AND s.department_id IS NOT DISTINCT FROM p.dept AND s.metric_key = p.metric
     WHERE s.superseded_at IS NULL;
    IF n <> 0 THEN
      RAISE EXCEPTION 'guard 1e: % active W44 row(s) already hold a key this script posts', n;
    END IF;

    SELECT coalesce(md5(string_agg(t::text, '|' ORDER BY t.id)), 'none') INTO other_before
      FROM (SELECT * FROM stats WHERE id NOT IN (SELECT id FROM div_live_w30_fix)) t;
    SELECT md5(string_agg(t::text, '|' ORDER BY t.id)) INTO listed_before
      FROM (SELECT id, workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by
              FROM stats WHERE id IN (SELECT id FROM div_live_w30_fix)) t;

    -- Part 2, step 1. Supersede the 6 W30 rows (never delete, never change the value).
    UPDATE stats SET superseded_at = now(), superseded_reason = reason
     WHERE id IN (SELECT id FROM div_live_w30_fix) AND superseded_at IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 6 THEN
      RAISE EXCEPTION 'guard 2: supersede touched % rows, expected 6', n;
    END IF;

    -- Part 2, step 2. Repost each at the W30 Thursday close, same value.
    INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by)
    SELECT s.workspace_id, s.division_id, s.department_id, s.metric_key, s.value, f.new_rec::timestamptz,
           coalesce(s.basis, '{}'::jsonb) || jsonb_build_object(
             'correction', tag,
             'part', 'w30_close',
             'supersedes', s.id::text,
             'old_recorded_at', f.old_rec,
             'note', 'reposted at the Thu 14:00 Europe/Berlin close of the labelled week (org-week.ts); value unchanged, not recomputed'
           ),
           by_tag
      FROM stats s JOIN div_live_w30_fix f ON f.id = s.id;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 6 THEN
      RAISE EXCEPTION 'guard 3: reposted % W30 rows, expected 6', n;
    END IF;

    -- Part 1. Post the validated W44 values (insert only; same key as emitStat insert_if_absent,
    -- counted against active rows only, since #38's superseded rows share the key).
    INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by)
    SELECT w44, p.division, p.dept, p.metric, p.val, p.rec::timestamptz,
           jsonb_build_object(
             'correction', tag,
             'part', 'w44_repost',
             'source', 'DABOS docs/registers/stats/2026-W44.md (Dept13-passed via DABOS #186)',
             'register_check', p.register_check,
             'year', 2026,
             'week', 44,
             'window', jsonb_build_object('start', '2026-10-22T12:00:00.000Z', 'end', '2026-10-29T13:00:00.000Z'),
             'note', 'W44 repost after #38 superseded the ln02 poster rows. Only register values with a Dept13 pass/validated check are posted'
           ),
           by_tag
      FROM div_live_w44_post p
     WHERE NOT EXISTS (
       SELECT 1 FROM stats s
        WHERE s.workspace_id = w44 AND s.division_id = p.division
          AND s.department_id IS NOT DISTINCT FROM p.dept AND s.metric_key = p.metric
          AND s.superseded_at IS NULL
     );
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 2 THEN
      RAISE EXCEPTION 'guard 3b: posted % W44 rows, expected 2', n;
    END IF;

    -- Guard 4: nothing outside the 6 + 6 + 2 changed; the 6 old rows changed only in the supersede columns.
    SELECT coalesce(md5(string_agg(t::text, '|' ORDER BY t.id)), 'none') INTO other_after
      FROM (SELECT * FROM stats WHERE id NOT IN (SELECT id FROM div_live_w30_fix)
                                  AND (basis->>'correction' IS DISTINCT FROM tag)) t;
    IF other_after <> other_before THEN
      RAISE EXCEPTION 'guard 4: rows outside the correction changed';
    END IF;
    SELECT md5(string_agg(t::text, '|' ORDER BY t.id)) INTO listed_after
      FROM (SELECT id, workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by
              FROM stats WHERE id IN (SELECT id FROM div_live_w30_fix)) t;
    IF listed_after <> listed_before THEN
      RAISE EXCEPTION 'guard 4b: a superseded row changed beyond superseded_at/superseded_reason';
    END IF;
  ELSIF active_old = 0 AND done_old = 6 AND w30_reposts = 6 AND w44_posts = 2 THEN
    RAISE NOTICE 'div-live W44 repost + W30 close correction already applied; verifying end state, writing nothing';
  ELSE
    RAISE EXCEPTION 'guard 1: unexpected state (active old W30 rows %, superseded by this correction %, W30 reposts %, W44 posts %); expected 6/0/0/0 or 0/6/6/2',
      active_old, done_old, w30_reposts, w44_posts;
  END IF;

  -- Guard 5: W30 end state. 6 old rows superseded with the reason, each with exactly one active
  -- matching repost at the close; 6 active non-Div1 rows in W30, all at the close.
  SELECT count(*) INTO n FROM stats s JOIN div_live_w30_fix f ON f.id = s.id
   WHERE s.superseded_at IS NOT NULL AND s.superseded_reason = reason;
  IF n <> 6 THEN
    RAISE EXCEPTION 'guard 5: expected 6 superseded old W30 rows, found %', n;
  END IF;
  SELECT count(*) INTO n FROM (
    SELECT f.id FROM div_live_w30_fix f
      JOIN stats r ON r.basis->>'supersedes' = f.id::text AND r.basis->>'correction' = tag
                  AND r.superseded_at IS NULL AND r.workspace_id = f.ws AND r.division_id = f.division
                  AND r.department_id IS NOT DISTINCT FROM f.dept AND r.metric_key = f.metric
                  AND r.value = f.val AND r.recorded_at = f.new_rec::timestamptz AND r.recorded_by = by_tag
     GROUP BY f.id HAVING count(*) = 1
  ) t;
  IF n <> 6 THEN
    RAISE EXCEPTION 'guard 5b: expected 6 old W30 rows with exactly one matching repost at the close, found %', n;
  END IF;
  SELECT count(*) INTO n FROM stats
   WHERE workspace_id = w30 AND division_id <> 'Div1' AND superseded_at IS NULL AND recorded_at = w30_close;
  IF n <> 6 OR (SELECT count(*) FROM stats WHERE workspace_id = w30 AND division_id <> 'Div1' AND superseded_at IS NULL) <> 6 THEN
    RAISE EXCEPTION 'guard 5c: expected exactly 6 active non-Div1 W30 rows, all at the close';
  END IF;
  -- Guard 5d: both W30 Div1 rows still active, 75, at the old recorded_at.
  SELECT count(*) INTO n FROM stats s JOIN div_live_w30_div1_keep k ON k.id = s.id
   WHERE s.workspace_id = w30 AND s.division_id = 'Div1' AND s.department_id IS NOT DISTINCT FROM k.dept
     AND s.metric_key = 'artifacts_indexed' AND s.value = 75 AND s.recorded_at = w30_old
     AND s.superseded_at IS NULL;
  IF n <> 2 THEN
    RAISE EXCEPTION 'guard 5d: the two W30 Div1 rows changed';
  END IF;

  -- Guard 6: W44 end state. Exactly the 2 posted active non-Div1 rows, at the close; the 6 #38
  -- rows still superseded with #38's reason; this script wrote no Div1 row.
  SELECT count(*) INTO n FROM stats s JOIN div_live_w44_post p
      ON s.workspace_id = w44 AND s.division_id = p.division
     AND s.department_id IS NOT DISTINCT FROM p.dept AND s.metric_key = p.metric
   WHERE s.superseded_at IS NULL AND s.value = p.val AND s.recorded_at = w44_close
     AND s.recorded_by = by_tag AND s.basis->>'correction' = tag;
  IF n <> 2 OR (SELECT count(*) FROM stats WHERE workspace_id = w44 AND division_id <> 'Div1' AND superseded_at IS NULL) <> 2 THEN
    RAISE EXCEPTION 'guard 6: expected exactly 2 active non-Div1 W44 rows (the posted ones, at the close)';
  END IF;
  SELECT count(*) INTO n FROM stats
   WHERE id = ANY(w44_38_ids) AND superseded_at IS NOT NULL AND superseded_reason = reason_38;
  IF n <> 6 THEN
    RAISE EXCEPTION 'guard 6b: the 6 #38-superseded W44 rows changed';
  END IF;
  SELECT count(*) INTO n FROM stats WHERE basis->>'correction' = tag;
  IF n <> 8 OR EXISTS (SELECT 1 FROM stats WHERE basis->>'correction' = tag AND division_id = 'Div1') THEN
    RAISE EXCEPTION 'guard 6c: expected 8 non-Div1 rows tagged %, found %', tag, n;
  END IF;

  RAISE NOTICE 'div-live W44 repost + W30 close correction ok: 2 W44 rows posted, 6 W30 rows superseded and reposted at the Thu 14:00 Berlin close';
END
$$;

COMMIT;

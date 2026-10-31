-- One-off data correction: non-Div1 div-live W31-W43 stat rows onto the Thursday-close basis
-- (Div7 2026-10-31, applying existing rulings: stat week closes Thu 14:00 Europe/Berlin; a stat
-- counts in the week the event happened).
-- Acceptance: docs/acceptance/2026-10-31_supersede_div_live_w31_w43.ACCEPTANCE.md
-- NOT a migration (lives outside ./migrations so `npm run dabos:migrate` never runs it).
-- NOT EXECUTED by this PR. Runs only after Dept13 PASS and Logan's own yes to merge and apply,
-- and only on a DB where migration 021_stats_conditions_superseded.sql is applied.
-- Pattern: scripts/dabos/sql/2026-10-31_supersede_gfp_live_w43_w44.sql (#45), supersede never delete.
--
-- Run (Logan): psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -f scripts/dabos/sql/2026-10-31_supersede_div_live_w31_w43.sql
--   One transaction; every guard RAISEs, so any mismatch aborts and nothing is changed.
--   Re-running after success is a no-op (end state re-verified, nothing written). A partial
--   state aborts.
--
-- What it does:
--   1. Marks the 30 listed rows (6 per workspace in div-live-2026-W31, W40, W41, W42, W43;
--      Div2/Dept4, Div2, Div4, Div4/Dept12, Div5, Div7) superseded. They sit at the old ISO-week
--      end: W31 2026-08-02T21:59:59.999Z, W40 2026-10-04T21:59:59.999Z (Sun 23:59:59.999 Berlin),
--      W41-W43 Sun 23:59:59.999Z UTC (= Mon 01:59:59.999 Berlin). recorded_by and basis are NULL.
--   2. Reposts each with the same workspace, division, department, metric and value, keeping the
--      workspace label's week (as board-conditions-query.ts bucketStatWeek does), recorded_at =
--      that week's Thu 14:00 Berlin close - 1 ms (org-week.ts recordedAtForClosedOrgWeek):
--        W31 2026-07-30T11:59:59.999Z   W40 2026-10-01T11:59:59.999Z   W41 2026-10-08T11:59:59.999Z
--        W42 2026-10-15T11:59:59.999Z   W43 2026-10-22T11:59:59.999Z
--      recorded_by 'div-live-correction-2026-10-31'; basis = old basis (NULL -> {}) + correction
--      tag, superseded row id and old recorded_at.
--   Values are NOT recomputed. W32-W39 have no div-live rows. W44 is out of scope (its 6 rows were
--   superseded with no replacement by 2026-10-29_supersede_w44_poster_rows.sql, #38: to-report).
--   Untouched: every row outside the 30 (Div1 incl. #49's backfill, W30, W44, gfp-live #45/#47).
--
-- Undo (manual, if ever needed):
--   BEGIN;
--   DELETE FROM stats WHERE basis->>'correction' = '2026-10-31_supersede_div_live_w31_w43' AND superseded_at IS NULL;
--   UPDATE stats SET superseded_at = NULL, superseded_reason = NULL
--     WHERE superseded_reason = 'Div7 2026-10-31: old poster ISO-week-end recorded_at (not Thu 14:00 Berlin close)';
--   COMMIT;

BEGIN;

CREATE TEMP TABLE div_live_w31_w43_fix (
  id uuid PRIMARY KEY,
  ws text NOT NULL,
  division text NOT NULL,
  dept text,
  metric text NOT NULL,
  val numeric NOT NULL,
  old_rec text NOT NULL,
  new_rec text NOT NULL
) ON COMMIT DROP;

INSERT INTO div_live_w31_w43_fix (id, ws, division, dept, metric, val, old_rec, new_rec)
SELECT v.id::uuid, v.ws, v.division, v.dept, v.metric, v.val, v.old_rec, c.new_rec
  FROM (VALUES
    ('56b705f1-90fe-497f-9323-66ac9e6439a5', 'div-live-2026-W31', 'Div2', 'Dept4', 'content_pieces_shipped', 0, '2026-08-02T21:59:59.999Z'),
    ('1a8c8673-e138-4e2e-a1f4-94297890a897', 'div-live-2026-W31', 'Div2', NULL, 'leads_or_touchpoints_created', 0, '2026-08-02T21:59:59.999Z'),
    ('f48a9b7c-a48a-460d-bd49-99cd40ffa313', 'div-live-2026-W31', 'Div4', 'Dept12', 'shipped_outputs', 1, '2026-08-02T21:59:59.999Z'),
    ('640ca807-05ba-4f53-9e58-5c67350ae52f', 'div-live-2026-W31', 'Div4', NULL, 'shipped_outputs', 1, '2026-08-02T21:59:59.999Z'),
    ('b312891e-5735-4e40-8a5e-66a054e62ac4', 'div-live-2026-W31', 'Div5', NULL, 'qa_pass_rate', 80, '2026-08-02T21:59:59.999Z'),
    ('8c2598a7-9dd6-48da-8532-e3fa2aa59a66', 'div-live-2026-W31', 'Div7', NULL, 'plan_completion_rate', 28.6, '2026-08-02T21:59:59.999Z'),
    ('04aba747-f32e-4941-89cc-e9021500e184', 'div-live-2026-W40', 'Div2', 'Dept4', 'content_pieces_shipped', 0, '2026-10-04T21:59:59.999Z'),
    ('08fbe9d5-c006-41af-a0ed-df6303fe71b8', 'div-live-2026-W40', 'Div2', NULL, 'leads_or_touchpoints_created', 0, '2026-10-04T21:59:59.999Z'),
    ('797f9653-02d3-455b-8b29-169ace294bff', 'div-live-2026-W40', 'Div4', NULL, 'shipped_outputs', 1, '2026-10-04T21:59:59.999Z'),
    ('a4d2447e-6b8d-49c7-b924-dab9e2543d07', 'div-live-2026-W40', 'Div4', 'Dept12', 'shipped_outputs', 1, '2026-10-04T21:59:59.999Z'),
    ('9a1ccdf4-7f37-45d0-89d8-ced170267147', 'div-live-2026-W40', 'Div5', NULL, 'qa_pass_rate', 80, '2026-10-04T21:59:59.999Z'),
    ('95a6ea9d-c030-44d4-b043-92e36064350d', 'div-live-2026-W40', 'Div7', NULL, 'plan_completion_rate', 28.6, '2026-10-04T21:59:59.999Z'),
    ('f573e36e-369f-4488-b6fe-e93ddb3ee23e', 'div-live-2026-W41', 'Div2', 'Dept4', 'content_pieces_shipped', 0, '2026-10-11T23:59:59.999Z'),
    ('eb3a9a94-d82c-4460-9d55-dd2e473e91c8', 'div-live-2026-W41', 'Div2', NULL, 'leads_or_touchpoints_created', 0, '2026-10-11T23:59:59.999Z'),
    ('1621436d-50bf-4cda-b03e-38c080e3212c', 'div-live-2026-W41', 'Div4', NULL, 'shipped_outputs', 1, '2026-10-11T23:59:59.999Z'),
    ('0d95644d-6bee-42b9-906d-2315e27aed86', 'div-live-2026-W41', 'Div4', 'Dept12', 'shipped_outputs', 1, '2026-10-11T23:59:59.999Z'),
    ('d15efd9b-4e55-4bd1-a549-a6497d5077d6', 'div-live-2026-W41', 'Div5', NULL, 'qa_pass_rate', 80, '2026-10-11T23:59:59.999Z'),
    ('2aba1b75-1d92-460a-ab4e-553fa5e259b2', 'div-live-2026-W41', 'Div7', NULL, 'plan_completion_rate', 28.6, '2026-10-11T23:59:59.999Z'),
    ('4308f369-69ea-46b9-839a-685ce0911db1', 'div-live-2026-W42', 'Div2', 'Dept4', 'content_pieces_shipped', 0, '2026-10-18T23:59:59.999Z'),
    ('122385f6-b1cb-49bc-913f-cec9e19e08a5', 'div-live-2026-W42', 'Div2', NULL, 'leads_or_touchpoints_created', 0, '2026-10-18T23:59:59.999Z'),
    ('f87fe984-421a-42e4-91aa-4bb654df55d5', 'div-live-2026-W42', 'Div4', NULL, 'shipped_outputs', 3, '2026-10-18T23:59:59.999Z'),
    ('5b490646-d8c0-44ba-b65b-08d86d508d22', 'div-live-2026-W42', 'Div4', 'Dept12', 'shipped_outputs', 3, '2026-10-18T23:59:59.999Z'),
    ('bc8cea02-b519-4044-8bee-6000b2f03c94', 'div-live-2026-W42', 'Div5', NULL, 'qa_pass_rate', 80, '2026-10-18T23:59:59.999Z'),
    ('45c29d6e-9b82-4250-8a30-c67c1813ec1c', 'div-live-2026-W42', 'Div7', NULL, 'plan_completion_rate', 28.6, '2026-10-18T23:59:59.999Z'),
    ('77fd22e8-8afd-49e7-be08-f67c265c1363', 'div-live-2026-W43', 'Div2', 'Dept4', 'content_pieces_shipped', 0, '2026-10-25T23:59:59.999Z'),
    ('a555e075-64ff-43fc-b0f8-d55e00f8cb12', 'div-live-2026-W43', 'Div2', NULL, 'leads_or_touchpoints_created', 0, '2026-10-25T23:59:59.999Z'),
    ('b952846c-78d6-4c27-ac86-530398bb9a45', 'div-live-2026-W43', 'Div4', NULL, 'shipped_outputs', 3, '2026-10-25T23:59:59.999Z'),
    ('cb2c172f-5171-414f-b7d9-25bbd72ef2ef', 'div-live-2026-W43', 'Div4', 'Dept12', 'shipped_outputs', 3, '2026-10-25T23:59:59.999Z'),
    ('6f0b4f31-828c-4656-9b9d-4e2787fc0472', 'div-live-2026-W43', 'Div5', NULL, 'qa_pass_rate', 80, '2026-10-25T23:59:59.999Z'),
    ('31340bab-e56e-43de-b2cf-6c0af3fe8c3e', 'div-live-2026-W43', 'Div7', NULL, 'plan_completion_rate', 28.6, '2026-10-25T23:59:59.999Z')
  ) AS v(id, ws, division, dept, metric, val, old_rec)
  JOIN (VALUES
    ('div-live-2026-W31', '2026-07-30T11:59:59.999Z'),
    ('div-live-2026-W40', '2026-10-01T11:59:59.999Z'),
    ('div-live-2026-W41', '2026-10-08T11:59:59.999Z'),
    ('div-live-2026-W42', '2026-10-15T11:59:59.999Z'),
    ('div-live-2026-W43', '2026-10-22T11:59:59.999Z')
  ) AS c(ws, new_rec) ON c.ws = v.ws;

DO $$
DECLARE
  tag constant text := '2026-10-31_supersede_div_live_w31_w43';
  reason constant text := 'Div7 2026-10-31: old poster ISO-week-end recorded_at (not Thu 14:00 Berlin close)';
  by_tag constant text := 'div-live-correction-2026-10-31';
  wss constant text[] := ARRAY['div-live-2026-W31', 'div-live-2026-W40', 'div-live-2026-W41',
                               'div-live-2026-W42', 'div-live-2026-W43'];
  n integer;
  active_old integer;
  done_old integer;
  reposts integer;
  other_before text;
  other_after text;
  listed_before text;
  listed_after text;
BEGIN
  -- Guard 0: migration 021 applied; the fix set is 30 rows, 6 per workspace.
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = current_schema()
     AND table_name = 'stats'
     AND column_name IN ('superseded_at', 'superseded_reason');
  IF n <> 2 THEN
    RAISE EXCEPTION 'guard 0: migration 021 not applied (found % of 2 stats supersede columns)', n;
  END IF;
  SELECT count(*) INTO n FROM (
    SELECT ws FROM div_live_w31_w43_fix GROUP BY ws HAVING count(*) = 6
  ) t;
  IF n <> 5 OR (SELECT count(*) FROM div_live_w31_w43_fix) <> 30 THEN
    RAISE EXCEPTION 'guard 0b: fix set is not 30 rows, 6 in each of 5 workspaces';
  END IF;

  -- State: before (30 active old rows at the old recorded_at, nothing tagged) or after (all done).
  SELECT count(*) INTO active_old FROM stats s JOIN div_live_w31_w43_fix f ON f.id = s.id
   WHERE s.superseded_at IS NULL AND s.workspace_id = f.ws AND s.division_id = f.division
     AND s.department_id IS NOT DISTINCT FROM f.dept AND s.metric_key = f.metric
     AND s.value = f.val AND s.recorded_at = f.old_rec::timestamptz;
  SELECT count(*) INTO done_old FROM stats s JOIN div_live_w31_w43_fix f ON f.id = s.id
   WHERE s.superseded_at IS NOT NULL AND s.superseded_reason = reason;
  SELECT count(*) INTO reposts FROM stats WHERE basis->>'correction' = tag;

  IF active_old = 30 AND done_old = 0 AND reposts = 0 THEN
    -- Guard 1: the listed rows are the only non-Div1 rows in div-live W31..W43 (active or not).
    SELECT count(*) INTO n FROM stats
     WHERE division_id <> 'Div1' AND workspace_id ~ '^div-live-2026-W(3[1-9]|4[0-3])$';
    IF n <> 30 THEN
      RAISE EXCEPTION 'guard 1: expected 30 non-Div1 rows in div-live W31..W43, found % (unlisted rows present)', n;
    END IF;
    SELECT count(DISTINCT (workspace_id, division_id, department_id, metric_key)) INTO n
      FROM stats WHERE id IN (SELECT id FROM div_live_w31_w43_fix);
    IF n <> 30 THEN
      RAISE EXCEPTION 'guard 1b: expected 30 distinct workspace/division/department/metric keys, found %', n;
    END IF;

    SELECT coalesce(md5(string_agg(t::text, '|' ORDER BY t.id)), 'none') INTO other_before
      FROM (SELECT * FROM stats WHERE id NOT IN (SELECT id FROM div_live_w31_w43_fix)) t;
    SELECT md5(string_agg(t::text, '|' ORDER BY t.id)) INTO listed_before
      FROM (SELECT id, workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by
              FROM stats WHERE id IN (SELECT id FROM div_live_w31_w43_fix)) t;

    -- 1. Supersede (never delete, never change the value).
    UPDATE stats SET superseded_at = now(), superseded_reason = reason
     WHERE id IN (SELECT id FROM div_live_w31_w43_fix) AND superseded_at IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 30 THEN
      RAISE EXCEPTION 'guard 2: supersede touched % rows, expected 30', n;
    END IF;

    -- 2. Repost at the Thursday close of the same labelled week.
    INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by)
    SELECT s.workspace_id, s.division_id, s.department_id, s.metric_key, s.value, f.new_rec::timestamptz,
           coalesce(s.basis, '{}'::jsonb) || jsonb_build_object(
             'correction', tag,
             'supersedes', s.id::text,
             'old_recorded_at', f.old_rec,
             'note', 'reposted at the Thu 14:00 Europe/Berlin close of the labelled week (org-week.ts); value unchanged, not recomputed'
           ),
           by_tag
      FROM stats s JOIN div_live_w31_w43_fix f ON f.id = s.id;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 30 THEN
      RAISE EXCEPTION 'guard 3: reposted % rows, expected 30', n;
    END IF;

    -- Guard 4: nothing outside the 30 + 30 changed; the 30 old rows changed only in the supersede columns.
    SELECT coalesce(md5(string_agg(t::text, '|' ORDER BY t.id)), 'none') INTO other_after
      FROM (SELECT * FROM stats WHERE id NOT IN (SELECT id FROM div_live_w31_w43_fix)
                                  AND (basis->>'correction' IS DISTINCT FROM tag)) t;
    IF other_after <> other_before THEN
      RAISE EXCEPTION 'guard 4: rows outside the correction changed';
    END IF;
    SELECT md5(string_agg(t::text, '|' ORDER BY t.id)) INTO listed_after
      FROM (SELECT id, workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by
              FROM stats WHERE id IN (SELECT id FROM div_live_w31_w43_fix)) t;
    IF listed_after <> listed_before THEN
      RAISE EXCEPTION 'guard 4b: a superseded row changed beyond superseded_at/superseded_reason';
    END IF;
  ELSIF active_old = 0 AND done_old = 30 AND reposts = 30 THEN
    RAISE NOTICE 'div-live W31-W43 correction already applied; verifying end state, writing nothing';
  ELSE
    RAISE EXCEPTION 'guard 1: unexpected state (active old rows %, superseded by this correction %, reposts %); expected 30/0/0 or 0/30/30',
      active_old, done_old, reposts;
  END IF;

  -- Guard 5: end state. 30 old rows superseded with the reason, each with exactly one active repost
  -- that matches it and sits at the close.
  SELECT count(*) INTO n FROM stats s JOIN div_live_w31_w43_fix f ON f.id = s.id
   WHERE s.superseded_at IS NOT NULL AND s.superseded_reason = reason;
  IF n <> 30 THEN
    RAISE EXCEPTION 'guard 5: expected 30 superseded old rows, found %', n;
  END IF;
  SELECT count(*) INTO n FROM (
    SELECT f.id FROM div_live_w31_w43_fix f
      JOIN stats r ON r.basis->>'supersedes' = f.id::text AND r.basis->>'correction' = tag
                  AND r.superseded_at IS NULL AND r.workspace_id = f.ws AND r.division_id = f.division
                  AND r.department_id IS NOT DISTINCT FROM f.dept AND r.metric_key = f.metric
                  AND r.value = f.val AND r.recorded_at = f.new_rec::timestamptz AND r.recorded_by = by_tag
     GROUP BY f.id HAVING count(*) = 1
  ) t;
  IF n <> 30 THEN
    RAISE EXCEPTION 'guard 5b: expected 30 old rows with exactly one matching repost at the close, found %', n;
  END IF;
  -- Guard 6: each workspace holds exactly 6 active non-Div1 rows, all at its close.
  SELECT count(*) INTO n FROM (
    SELECT s.workspace_id FROM stats s
     WHERE s.workspace_id = ANY(wss) AND s.division_id <> 'Div1' AND s.superseded_at IS NULL
     GROUP BY s.workspace_id
    HAVING count(*) = 6
       AND bool_and(s.recorded_at = (SELECT min(f.new_rec)::timestamptz FROM div_live_w31_w43_fix f WHERE f.ws = s.workspace_id))
  ) t;
  IF n <> 5 THEN
    RAISE EXCEPTION 'guard 6: expected 5 workspaces with exactly 6 active non-Div1 rows at the close, found %', n;
  END IF;
  SELECT count(*) INTO n FROM stats WHERE basis->>'correction' = tag;
  IF n <> 30 THEN
    RAISE EXCEPTION 'guard 6b: expected 30 rows tagged %, found %', tag, n;
  END IF;

  RAISE NOTICE 'div-live W31-W43 correction ok: 30 rows superseded, 30 reposted at the Thu 14:00 Berlin close';
END
$$;

COMMIT;
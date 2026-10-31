-- One-off data correction: Div5 qa_pass_rate for div-live-2026-W44 = 71.0 (22/31), per the Dept14
-- ruling of 2026-10-31 (item 3) and its Amendment 1 (31 Oct 17:40). One guarded insert.
-- Acceptance: docs/acceptance/2026-10-31_post_div5_qa_pass_rate_w44.ACCEPTANCE.md
-- NOT a migration (lives outside ./migrations so `npm run dabos:migrate` never runs it).
-- NOT EXECUTED by this PR. Runs only after Dept13 PASS and Logan's own yes to merge and apply,
-- and only on a DB where migration 021_stats_conditions_superseded.sql is applied.
-- Pattern: scripts/dabos/sql/2026-10-31_repost_div_live_w44_and_w30_close.sql (#53).
--
-- Run (Logan): psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -f scripts/dabos/sql/2026-10-31_post_div5_qa_pass_rate_w44.sql
--   One transaction; every guard RAISEs, so any mismatch aborts and nothing is changed.
--   Re-running after success is a no-op (end state re-verified, nothing written).
--
-- Value: closed Dept13 verdicts (PASS or FAIL) in stat week W44, one per verdict event (one verdict
--   on one PR at one SHA), dated by when Div5 sent the verdict, from all 47 W44 events in the Dept13
--   validation register W44 rebuild (Instances 6-26 and 36-61; DABOS #201 @da6ed2f3, on DABOS
--   main 248056df).
--   PASS 6, 8, 9, 10, 11, 12, 14, 16, 19, 20, 21, 23, 25, 26, 39, 44, 49, 54, 58, 59, 60, 61 (22);
--   FAIL 7, 13, 17, 18, 22, 24, 40, 42, 51 (9).
--   Excluded as not closed: 15 (#172 @921c9fe6, PASS conditional on merging #171 first);
--   CONDITIONAL 36, 37, 38, 41, 43, 45, 46, 47, 48, 50, 52, 53, 55, 56, 57.
--   #61 (#179 @89141e1e) counts: items on deployment, not on the verdict, do not make it conditional
--   (Dept14 Amendment 1, 31 Oct 17:40).
--   #25 (#180 @389600c8) counts: PASS sent before the 21:50 merge from that head.
--   22 / 31 = 71.0 (poster rounding, one decimal).
-- Row: div-live-2026-W44 / Div5 / NULL / qa_pass_rate = 71.0 at 2026-10-29T12:59:59.999Z (W44 close
--   Thu 29 Oct 14:00 CET - 1 ms, org-week.ts), recorded_by 'div-live-correction-2026-10-31'.
-- Reads and writes only the Div5 / NULL / qa_pass_rate key in div-live-2026-W44. The #38-superseded
--   row 2683a636 (75) stays as it is. #49, #51 and #53 are not read, so order does not matter.
--
-- Undo (manual, if ever needed):
--   BEGIN;
--   DELETE FROM stats WHERE basis->>'correction' = '2026-10-31_post_div5_qa_pass_rate_w44';
--   COMMIT;

BEGIN;

DO $$
DECLARE
  tag constant text := '2026-10-31_post_div5_qa_pass_rate_w44';
  by_tag constant text := 'div-live-correction-2026-10-31';
  w44 constant text := 'div-live-2026-W44';
  w44_close constant timestamptz := '2026-10-29T12:59:59.999Z';
  id_38 constant uuid := '2683a636-bb19-46f4-a800-1f73d5ba16ed';
  reason_38 constant text := 'Dept13 FAIL 2026-10-29: ln02 poster @2474654 (ISO window, all-time qa)';
  num constant integer := 22;
  den constant integer := 31;
  val constant numeric := 71.0;
  n integer;
  posts integer;
  other_before text;
  other_after text;
BEGIN
  -- Guard 0: migration 021 applied; the value is num/den with the poster's one-decimal rounding.
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = current_schema()
     AND table_name = 'stats'
     AND column_name IN ('superseded_at', 'superseded_reason');
  IF n <> 2 THEN
    RAISE EXCEPTION 'guard 0: migration 021 not applied (found % of 2 stats supersede columns)', n;
  END IF;
  IF round(num::numeric * 1000 / den) / 10 <> val THEN
    RAISE EXCEPTION 'guard 0b: value % is not round(%/% * 1000) / 10', val, num, den;
  END IF;

  SELECT count(*) INTO posts FROM stats WHERE basis->>'correction' = tag;

  IF posts = 0 THEN
    -- Guard 1: no active Div5 qa_pass_rate row in W44.
    SELECT count(*) INTO n FROM stats
     WHERE workspace_id = w44 AND division_id = 'Div5' AND department_id IS NULL
       AND metric_key = 'qa_pass_rate' AND superseded_at IS NULL;
    IF n <> 0 THEN
      RAISE EXCEPTION 'guard 1: % active Div5 qa_pass_rate row(s) already in div-live-2026-W44', n;
    END IF;
    -- Guard 1b: the only Div5 qa_pass_rate W44 row is #38's superseded 2683a636 (75).
    SELECT count(*) INTO n FROM stats
     WHERE id = id_38 AND workspace_id = w44 AND division_id = 'Div5' AND department_id IS NULL
       AND metric_key = 'qa_pass_rate' AND value = 75
       AND superseded_at IS NOT NULL AND superseded_reason = reason_38;
    IF n <> 1 OR (SELECT count(*) FROM stats
                   WHERE workspace_id = w44 AND division_id = 'Div5' AND department_id IS NULL
                     AND metric_key = 'qa_pass_rate') <> 1 THEN
      RAISE EXCEPTION 'guard 1b: expected only the #38-superseded Div5 qa_pass_rate W44 row 2683a636 (75)';
    END IF;

    SELECT coalesce(md5(string_agg(t::text, '|' ORDER BY t.id)), 'none') INTO other_before
      FROM (SELECT * FROM stats) t;

    INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by)
    VALUES (w44, 'Div5', NULL, 'qa_pass_rate', val, w44_close,
            jsonb_build_object(
              'correction', tag,
              'numerator', num,
              'denominator', den,
              'rule', 'closed Dept13 verdicts (PASS or FAIL) in stat week W44, one per verdict event (one verdict on one PR at one SHA), dated by when Div5 sent the verdict, from all 47 W44 events in the Dept13 validation register W44 rebuild (Instances 6-26 and 36-61). Not-closed verdicts (CONDITIONAL, and Instance 15 whose PASS was made conditional on merging #171) excluded; items addressed to deployment or operation do not make a verdict conditional (Dept14 Amendment 1)',
              'register', 'Dept13 validation register W44 rebuild, DABOS #201 @da6ed2f3ce2ed52e4592059ea740a19cdc2205a2 (on DABOS main 248056df)',
              'pass_instances', jsonb_build_array(6, 8, 9, 10, 11, 12, 14, 16, 19, 20, 21, 23, 25, 26, 39, 44, 49, 54, 58, 59, 60, 61),
              'fail_instances', jsonb_build_array(7, 13, 17, 18, 22, 24, 40, 42, 51),
              'excluded_instances', jsonb_build_array(
                jsonb_build_object('instance', 15, 'why', 'not closed (PASS conditional: merge #171 first)'),
                jsonb_build_object('instances', jsonb_build_array(36, 37, 38, 41, 43, 45, 46, 47, 48, 50, 52, 53, 55, 56, 57), 'why', 'not closed (CONDITIONAL)')
              ),
              'ruling', 'Dept14 ruling 2026-10-31',
              'year', 2026,
              'week', 44,
              'window', jsonb_build_object('start', '2026-10-22T12:00:00.000Z', 'end', '2026-10-29T13:00:00.000Z')
            ),
            by_tag);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN
      RAISE EXCEPTION 'guard 2: inserted % rows, expected 1', n;
    END IF;

    -- Guard 3: every row that existed before is byte-identical.
    SELECT coalesce(md5(string_agg(t::text, '|' ORDER BY t.id)), 'none') INTO other_after
      FROM (SELECT * FROM stats WHERE basis->>'correction' IS DISTINCT FROM tag) t;
    IF other_after <> other_before THEN
      RAISE EXCEPTION 'guard 3: rows outside the correction changed';
    END IF;
  ELSIF posts = 1 THEN
    RAISE NOTICE 'Div5 W44 qa_pass_rate already posted; verifying end state, writing nothing';
  ELSE
    RAISE EXCEPTION 'guard 1: unexpected state (% rows tagged %); expected 0 or 1', posts, tag;
  END IF;

  -- Guard 4: end state. Exactly one active Div5 qa_pass_rate W44 row, and it is this script's.
  SELECT count(*) INTO n FROM stats
   WHERE basis->>'correction' = tag AND workspace_id = w44 AND division_id = 'Div5'
     AND department_id IS NULL AND metric_key = 'qa_pass_rate' AND value = val
     AND recorded_at = w44_close AND recorded_by = by_tag AND superseded_at IS NULL
     AND (basis->>'numerator')::int = num AND (basis->>'denominator')::int = den
     AND basis->>'ruling' = 'Dept14 ruling 2026-10-31';
  IF n <> 1 OR (SELECT count(*) FROM stats
                 WHERE workspace_id = w44 AND division_id = 'Div5' AND department_id IS NULL
                   AND metric_key = 'qa_pass_rate' AND superseded_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'guard 4: expected exactly one active Div5 qa_pass_rate W44 row (this script''s, 71.0 at the close)';
  END IF;
  -- Guard 4b: #38's row still superseded with #38's reason.
  SELECT count(*) INTO n FROM stats
   WHERE id = id_38 AND value = 75 AND superseded_at IS NOT NULL AND superseded_reason = reason_38;
  IF n <> 1 THEN
    RAISE EXCEPTION 'guard 4b: the #38-superseded Div5 W44 row 2683a636 changed';
  END IF;

  RAISE NOTICE 'Div5 W44 qa_pass_rate ok: 71.0 (22/31) at the Thu 29 Oct 14:00 CET close';
END
$$;

COMMIT;

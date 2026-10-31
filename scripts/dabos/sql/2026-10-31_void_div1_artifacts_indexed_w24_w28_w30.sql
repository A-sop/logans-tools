-- One-off data correction (Dept14 ruling 2026-10-31 17:45 Berlin): Div1 artifacts_indexed rows on
-- a void basis (Logan 21 Oct ruling: the stat is unique link targets added to the wiki index per
-- stat week).
--   Part 1: supersede the 5 active workspace-less (workspace_id NULL) Div1 artifacts_indexed rows of
--           2026-W24..W28 (the 7 Jul backfill of registry and log counts). NO repost.
--   Part 2: supersede both active div-live-2026-W30 Div1 artifacts_indexed rows (75, artifact-index
--           register count; division row + Dept3 row) and repost ONE Div1 division row (department
--           NULL) for W30 = 0 on the current rule, exactly as #49 posts W31-W44. No Dept3 repost:
--           #49's rule posts Div1 division rows only and W31-W44 have no Dept3 rows (Dept3 is a Div1
--           department; dd2b66e2 is a Div1 Dept3 row, superseded here and not reposted).
-- Acceptance: docs/acceptance/2026-10-31_void_div1_artifacts_indexed_w24_w28_w30.ACCEPTANCE.md
-- NOT a migration (lives outside ./migrations so `npm run dabos:migrate` never runs it).
-- NOT EXECUTED by this PR. Runs only after Dept13 PASS and Logan's own yes to merge and apply,
-- and only on a DB where migration 021_stats_conditions_superseded.sql is applied.
-- Pattern: #49 (Div1 row shape and basis) and #51/#53 (supersede in place, never delete).
-- Order: run after #53 (applied 31 Oct 17:30-17:32). #53's guards pin both W30 Div1 rows active
-- at 75 (guard 1c before, 5d on a re-run), so #53 run or re-run after this script aborts without
-- changing anything. #49, #51 and #54 are independent of it in either order.
--
-- Run (Logan): psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -f scripts/dabos/sql/2026-10-31_void_div1_artifacts_indexed_w24_w28_w30.sql
--   One transaction; every guard RAISEs, so any mismatch aborts and nothing is changed.
--   Re-running after success is a no-op (end state re-verified, nothing written). A partial
--   state aborts.
--
-- Deltas (supersede is an in-place UPDATE of superseded_at/superseded_reason, as #51/#53 do, so
-- superseding adds no row): stats total +1 (the W30 repost), active -6 (7 superseded, 1 posted).
-- On prod as of 31 Oct 17:42 CET: 186 -> 187 rows, 138 -> 132 active; div-live 84 -> 85, 42 -> 41.
--
-- Part 1 rows (Div1 / NULL / artifacts_indexed, workspace_id NULL, basis NULL, recorded_by NULL):
--   e764a5dd-1244-4cae-82b7-dc1a9b731627  2277  2026-06-11T12:00:00.000Z  (W24)
--   eb1e15a5-96ca-4c05-ab37-87559c4fbdf3   592  2026-06-18T12:00:00.000Z  (W25)
--   acadbebe-01ce-4ac7-8ad5-085cc68809a2    89  2026-06-25T12:00:00.000Z  (W26)
--   6fdac124-4488-44c9-a974-b0144a58458d   128  2026-07-02T12:00:00.000Z  (W27)
--   73a818d5-0e87-4515-8975-62a5341edb68   393  2026-07-09T12:00:00.000Z  (W28)
--   reason 'Dept14 2026-10-31: void basis per Logan 21 Oct ruling (7 Jul backfill of registry and log counts, not wiki pages added per stat week)'
-- Part 2 rows (div-live-2026-W30, Div1 artifacts_indexed 75 at 2026-07-26T21:59:59.999Z, week-close-poster):
--   dd2b66e2-1390-44b2-b2a4-d1829ff09400  Dept3
--   252780ef-4988-428a-ad3b-5eb6a6cf43db  division (department NULL)
--   reason 'Dept14 2026-10-31: void basis per Logan 21 Oct ruling (artifact-index register count)'
-- W30 repost: div-live-2026-W30 / Div1 / NULL / artifacts_indexed = 0 at 2026-07-23T11:59:59.999Z
--   (org-week.ts recordedAtForClosedOrgWeek(statWeekWindow(2026, 30)); Thu 23 Jul 14:00 CEST - 1 ms).
--   Verified 2026-10-31 on a fresh read-only clone of A-sop/DABOS, GitHub main at each close
--   (parent 2 at sync merges, as #49; no merge on the main line in July):
--     W29 close (Thu 16 Jul 14:00 CEST) main 697c0095014529a4453a7eae0cd5ae76842109d7, 218 unique targets
--     W30 close (Thu 23 Jul 14:00 CEST) main 697c0095014529a4453a7eae0cd5ae76842109d7, 218 unique targets
--     added = |end \ start| = 0, removed 0. No commit touched the index between 8 and 31 Jul; the
--     newest index commit before both closes is 353fd4b04892991d86aaa7850c5281dd904027ca (1 Jul).
--     W31 close main 5bd5a00b (218), as #49's W31 start.
--
-- Undo (manual, if ever needed; reverses only this script's rows):
--   BEGIN;
--   DELETE FROM stats WHERE basis->>'correction' = '2026-10-31_void_div1_artifacts_indexed_w24_w28_w30';
--   UPDATE stats SET superseded_at = NULL, superseded_reason = NULL
--    WHERE id IN ('e764a5dd-1244-4cae-82b7-dc1a9b731627', 'eb1e15a5-96ca-4c05-ab37-87559c4fbdf3',
--                 'acadbebe-01ce-4ac7-8ad5-085cc68809a2', '6fdac124-4488-44c9-a974-b0144a58458d',
--                 '73a818d5-0e87-4515-8975-62a5341edb68', 'dd2b66e2-1390-44b2-b2a4-d1829ff09400',
--                 '252780ef-4988-428a-ad3b-5eb6a6cf43db')
--      AND superseded_reason IN (
--        'Dept14 2026-10-31: void basis per Logan 21 Oct ruling (7 Jul backfill of registry and log counts, not wiki pages added per stat week)',
--        'Dept14 2026-10-31: void basis per Logan 21 Oct ruling (artifact-index register count)');
--   COMMIT;

BEGIN;

CREATE TEMP TABLE div1_void_fix (
  id uuid PRIMARY KEY,
  ws text,
  dept text,
  val numeric NOT NULL,
  rec text NOT NULL,
  by_old text,
  basis_md5 text,
  part integer NOT NULL,
  reason text NOT NULL
) ON COMMIT DROP;

INSERT INTO div1_void_fix (id, ws, dept, val, rec, by_old, basis_md5, part, reason) VALUES
  ('e764a5dd-1244-4cae-82b7-dc1a9b731627', NULL, NULL, 2277, '2026-06-11T12:00:00.000Z', NULL, NULL, 1, 'Dept14 2026-10-31: void basis per Logan 21 Oct ruling (7 Jul backfill of registry and log counts, not wiki pages added per stat week)'),
  ('eb1e15a5-96ca-4c05-ab37-87559c4fbdf3', NULL, NULL, 592, '2026-06-18T12:00:00.000Z', NULL, NULL, 1, 'Dept14 2026-10-31: void basis per Logan 21 Oct ruling (7 Jul backfill of registry and log counts, not wiki pages added per stat week)'),
  ('acadbebe-01ce-4ac7-8ad5-085cc68809a2', NULL, NULL, 89, '2026-06-25T12:00:00.000Z', NULL, NULL, 1, 'Dept14 2026-10-31: void basis per Logan 21 Oct ruling (7 Jul backfill of registry and log counts, not wiki pages added per stat week)'),
  ('6fdac124-4488-44c9-a974-b0144a58458d', NULL, NULL, 128, '2026-07-02T12:00:00.000Z', NULL, NULL, 1, 'Dept14 2026-10-31: void basis per Logan 21 Oct ruling (7 Jul backfill of registry and log counts, not wiki pages added per stat week)'),
  ('73a818d5-0e87-4515-8975-62a5341edb68', NULL, NULL, 393, '2026-07-09T12:00:00.000Z', NULL, NULL, 1, 'Dept14 2026-10-31: void basis per Logan 21 Oct ruling (7 Jul backfill of registry and log counts, not wiki pages added per stat week)'),
  ('dd2b66e2-1390-44b2-b2a4-d1829ff09400', 'div-live-2026-W30', 'Dept3', 75, '2026-07-26T21:59:59.999Z', 'week-close-poster', '425fe92f322d67bf1f810cfb29b1328e', 2, 'Dept14 2026-10-31: void basis per Logan 21 Oct ruling (artifact-index register count)'),
  ('252780ef-4988-428a-ad3b-5eb6a6cf43db', 'div-live-2026-W30', NULL, 75, '2026-07-26T21:59:59.999Z', 'week-close-poster', '6f6139ecf5cbfb94289272c706d9fe9d', 2, 'Dept14 2026-10-31: void basis per Logan 21 Oct ruling (artifact-index register count)');

DO $$
DECLARE
  tag constant text := '2026-10-31_void_div1_artifacts_indexed_w24_w28_w30';
  reason_p1 constant text := 'Dept14 2026-10-31: void basis per Logan 21 Oct ruling (7 Jul backfill of registry and log counts, not wiki pages added per stat week)';
  reason_p2 constant text := 'Dept14 2026-10-31: void basis per Logan 21 Oct ruling (artifact-index register count)';
  w30 constant text := 'div-live-2026-W30';
  w30_close constant timestamptz := '2026-07-23T11:59:59.999Z';
  w30_val constant numeric := 0;
  unique_start constant integer := 218;
  unique_end constant integer := 218;
  removed constant integer := 0;
  main_start constant text := '697c0095014529a4453a7eae0cd5ae76842109d7';
  main_end constant text := '697c0095014529a4453a7eae0cd5ae76842109d7';
  n integer;
  active_old integer;
  done_old integer;
  reposts integer;
  total_before bigint;
  active_before bigint;
  other_before text;
  other_after text;
  listed_before text;
  listed_after text;
BEGIN
  -- Guard 0: migration 021 applied; Div1 exists; the fix set is 5 workspace-less W24-W28 rows +
  -- the 2 W30 rows, each with its part's exact reason; the W30 value is end - start with 0 removed.
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = current_schema()
     AND table_name = 'stats'
     AND column_name IN ('superseded_at', 'superseded_reason');
  IF n <> 2 THEN
    RAISE EXCEPTION 'guard 0: migration 021 not applied (found % of 2 stats supersede columns)', n;
  END IF;
  IF (SELECT count(*) FROM divisions WHERE id = 'Div1') <> 1 THEN
    RAISE EXCEPTION 'guard 0b: division Div1 not found';
  END IF;
  IF (SELECT count(*) FROM div1_void_fix) <> 7
     OR (SELECT count(*) FROM div1_void_fix WHERE part = 1 AND ws IS NULL AND dept IS NULL
           AND by_old IS NULL AND basis_md5 IS NULL AND reason = reason_p1) <> 5
     OR (SELECT sum(val) FROM div1_void_fix WHERE part = 1) <> 3479
     OR (SELECT count(*) FROM div1_void_fix WHERE part = 2 AND ws = w30 AND val = 75
           AND rec::timestamptz = '2026-07-26T21:59:59.999Z' AND by_old = 'week-close-poster'
           AND reason = reason_p2) <> 2
     OR (SELECT count(*) FROM div1_void_fix WHERE part = 2 AND dept IS NULL) <> 1
     OR (SELECT count(*) FROM div1_void_fix WHERE part = 2 AND dept = 'Dept3') <> 1 THEN
    RAISE EXCEPTION 'guard 0c: fix set is not the 5 workspace-less W24-W28 rows + the 2 W30 rows with their reasons';
  END IF;
  IF w30_val <> unique_end - unique_start + removed OR removed <> 0 THEN
    RAISE EXCEPTION 'guard 0d: W30 value % is not |end \ start| (% -> %, % removed)', w30_val, unique_start, unique_end, removed;
  END IF;

  -- State: before (7 active listed rows, nothing tagged) or after (all done).
  SELECT count(*) INTO active_old FROM stats s JOIN div1_void_fix f ON f.id = s.id
   WHERE s.superseded_at IS NULL;
  SELECT count(*) INTO done_old FROM stats s JOIN div1_void_fix f ON f.id = s.id
   WHERE s.superseded_at IS NOT NULL AND s.superseded_reason = f.reason;
  SELECT count(*) INTO reposts FROM stats WHERE basis->>'correction' = tag;

  IF active_old = 7 AND done_old = 0 AND reposts = 0 THEN
    -- Guard 1: each listed row is exactly as read on prod (id, workspace, division, department,
    -- metric, value, recorded_at, recorded_by; W24-W28 basis NULL, W30 basis md5 as read on prod).
    SELECT count(*) INTO n FROM stats s JOIN div1_void_fix f ON f.id = s.id
     WHERE s.workspace_id IS NOT DISTINCT FROM f.ws AND s.division_id = 'Div1'
       AND s.department_id IS NOT DISTINCT FROM f.dept AND s.metric_key = 'artifacts_indexed'
       AND s.value = f.val AND s.recorded_at = f.rec::timestamptz
       AND s.recorded_by IS NOT DISTINCT FROM f.by_old AND s.superseded_reason IS NULL
       AND ((f.part = 1 AND s.basis IS NULL AND f.basis_md5 IS NULL) OR (f.part = 2 AND md5(s.basis::text) = f.basis_md5));
    IF n <> 7 THEN
      RAISE EXCEPTION 'guard 1: only % of the 7 listed rows match their prod id/key/value/recorded_at/basis', n;
    END IF;
    -- Guard 1b: no other Div1 artifacts_indexed row without a workspace; no other Div1 row in W30.
    SELECT count(*) INTO n FROM stats
     WHERE workspace_id IS NULL AND division_id = 'Div1' AND metric_key = 'artifacts_indexed'
       AND id NOT IN (SELECT id FROM div1_void_fix);
    IF n <> 0 THEN
      RAISE EXCEPTION 'guard 1b: % unlisted workspace-less Div1 artifacts_indexed row(s)', n;
    END IF;
    SELECT count(*) INTO n FROM stats
     WHERE workspace_id = w30 AND division_id = 'Div1' AND id NOT IN (SELECT id FROM div1_void_fix);
    IF n <> 0 THEN
      RAISE EXCEPTION 'guard 1c: % unlisted Div1 row(s) in div-live-2026-W30', n;
    END IF;

    SELECT count(*), count(*) FILTER (WHERE superseded_at IS NULL) INTO total_before, active_before FROM stats;
    SELECT coalesce(md5(string_agg(t::text, '|' ORDER BY t.id)), 'none') INTO other_before
      FROM (SELECT * FROM stats WHERE id NOT IN (SELECT id FROM div1_void_fix)) t;
    SELECT md5(string_agg(t::text, '|' ORDER BY t.id)) INTO listed_before
      FROM (SELECT id, workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by
              FROM stats WHERE id IN (SELECT id FROM div1_void_fix)) t;

    -- Step 1. Supersede the 7 rows (never delete, never change the value).
    UPDATE stats s SET superseded_at = now(), superseded_reason = f.reason
      FROM div1_void_fix f
     WHERE s.id = f.id AND s.superseded_at IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 7 THEN
      RAISE EXCEPTION 'guard 2: supersede touched % rows, expected 7', n;
    END IF;

    -- Step 2. Repost W30 for the Div1 division only, on #49's rule and row shape.
    INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by)
    SELECT w30, 'Div1', NULL, 'artifacts_indexed', w30_val, w30_close,
           jsonb_build_object(
             'ssot', 'DABOS/docs/wiki/index.md',
             'rule', 'unique link targets (Logan ruling 2026-10-21)',
             'note', 'Div1 basis: link targets added to docs/wiki/index.md during the stat week as a set difference (Thu 14:00 -> Thu 14:00 Europe/Berlin; event-week rule); removals not subtracted, a re-pointed link counts as added',
             'method', 'set difference: targets at the W30 close not in the targets at the W29 close, on DABOS main as published on GitHub at each close (parent 2 at sync merges)',
             'year', 2026,
             'week', 30,
             'window', jsonb_build_object('start', '2026-07-16T12:00:00.000Z', 'end', '2026-07-23T12:00:00.000Z'),
             'index_unique_before', unique_start,
             'index_unique_after', unique_end,
             'index_targets_removed', removed,
             'dabos_main_at_close', left(main_end, 8),
             'git_start_commit', main_start,
             'git_end_commit', main_end,
             'supersedes', jsonb_build_array('252780ef-4988-428a-ad3b-5eb6a6cf43db', 'dd2b66e2-1390-44b2-b2a4-d1829ff09400'),
             'ruling', 'Dept14 ruling 2026-10-31 17:45',
             'correction', tag
           ),
           'week-close-poster';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN
      RAISE EXCEPTION 'guard 3: inserted % W30 rows, expected 1', n;
    END IF;

    -- Guard 4: nothing else changed; the 7 rows changed only in the supersede columns; exact deltas.
    SELECT coalesce(md5(string_agg(t::text, '|' ORDER BY t.id)), 'none') INTO other_after
      FROM (SELECT * FROM stats WHERE id NOT IN (SELECT id FROM div1_void_fix)
                                  AND basis->>'correction' IS DISTINCT FROM tag) t;
    IF other_after <> other_before THEN
      RAISE EXCEPTION 'guard 4: rows outside the correction changed';
    END IF;
    SELECT md5(string_agg(t::text, '|' ORDER BY t.id)) INTO listed_after
      FROM (SELECT id, workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by
              FROM stats WHERE id IN (SELECT id FROM div1_void_fix)) t;
    IF listed_after <> listed_before THEN
      RAISE EXCEPTION 'guard 4b: a superseded row changed beyond superseded_at/superseded_reason';
    END IF;
    IF (SELECT count(*) FROM stats) <> total_before + 1
       OR (SELECT count(*) FROM stats WHERE superseded_at IS NULL) <> active_before - 6 THEN
      RAISE EXCEPTION 'guard 4c: row deltas are not total +1, active -6';
    END IF;
  ELSIF active_old = 0 AND done_old = 7 AND reposts = 1 THEN
    RAISE NOTICE 'Div1 void + W30 repost already applied; verifying end state, writing nothing';
  ELSE
    RAISE EXCEPTION 'guard 1: unexpected state (active listed rows %, superseded by this correction %, tagged rows %); expected 7/0/0 or 0/7/1',
      active_old, done_old, reposts;
  END IF;

  -- Guard 5: end state. The 7 rows superseded with their part's reason; no active workspace-less
  -- Div1 artifacts_indexed row; exactly one active Div1 W30 artifacts_indexed row (any department),
  -- the division row = 0 at the W30 close, tagged; no active Div1 Dept3 row in W30.
  SELECT count(*) INTO n FROM stats s JOIN div1_void_fix f ON f.id = s.id
   WHERE s.superseded_at IS NOT NULL AND s.superseded_reason = f.reason;
  IF n <> 7 THEN
    RAISE EXCEPTION 'guard 5: expected 7 superseded listed rows, found %', n;
  END IF;
  SELECT count(*) INTO n FROM stats
   WHERE workspace_id IS NULL AND division_id = 'Div1' AND metric_key = 'artifacts_indexed' AND superseded_at IS NULL;
  IF n <> 0 THEN
    RAISE EXCEPTION 'guard 5b: % active workspace-less Div1 artifacts_indexed row(s) remain', n;
  END IF;
  SELECT count(*) INTO n FROM stats
   WHERE workspace_id = w30 AND division_id = 'Div1' AND metric_key = 'artifacts_indexed' AND superseded_at IS NULL;
  IF n <> 1 OR NOT EXISTS (
    SELECT 1 FROM stats
     WHERE workspace_id = w30 AND division_id = 'Div1' AND department_id IS NULL AND metric_key = 'artifacts_indexed'
       AND superseded_at IS NULL AND value = 0 AND recorded_at = w30_close AND recorded_by = 'week-close-poster'
       AND basis->>'correction' = tag AND basis->>'git_end_commit' = main_end
       AND (basis->>'index_unique_after')::int = unique_end
  ) THEN
    RAISE EXCEPTION 'guard 5c: expected exactly one active Div1 W30 artifacts_indexed row, the division row = 0 at the close';
  END IF;
  IF (SELECT count(*) FROM stats WHERE basis->>'correction' = tag) <> 1 THEN
    RAISE EXCEPTION 'guard 5d: expected exactly 1 row tagged %', tag;
  END IF;

  RAISE NOTICE 'Div1 void ok: 5 workspace-less W24-W28 rows and 2 W30 rows superseded; W30 Div1 artifacts_indexed = 0 posted at the Thu 14:00 Berlin close';
END
$$;

COMMIT;

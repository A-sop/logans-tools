-- One-off data backfill: Div1 artifacts_indexed division rows for div-live-2026-W31 .. W44
-- (Div7 2026-10-31: the ln02 week-close poster never emitted Div1; the emitter fix is a separate PR).
-- Acceptance: docs/acceptance/2026-10-31_backfill_div1_artifacts_indexed_w31_w44.ACCEPTANCE.md
-- NOT a migration (lives outside ./migrations so `npm run dabos:migrate` never runs it).
-- NOT EXECUTED by this PR. Runs only after Dept13 PASS and Logan's own yes to merge and apply.
-- Pattern: scripts/dabos/sql/2026-10-31_supersede_gfp_live_w43_w44.sql (#45). Separate from #47.
--
-- Run (Logan): psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -f scripts/dabos/sql/2026-10-31_backfill_div1_artifacts_indexed_w31_w44.sql
--   One transaction; every guard RAISEs, so any mismatch aborts and nothing is changed.
--   Re-running after success inserts nothing and succeeds (WHERE NOT EXISTS, same key as
--   emitStat insert_if_absent: workspace + division + department IS NOT DISTINCT FROM + metric).
--
-- Basis (existing rules, no new ruling): Div1 artifacts_indexed = unique pages linked from
-- DABOS docs/wiki/index.md (Logan ruling 2026-10-21; #32 countUniqueWikiPages normalisation).
-- Weekly value = pages ADDED during the stat week (Thu 14:00 -> Thu 14:00 Europe/Berlin,
-- event-week rule) = unique count at the close minus unique count at the previous close, on
-- DABOS main as published on GitHub at each close. A re-pointed link adds no page.
-- History is not read first-parent-only: at sync merges of GitHub main into a stale local copy
-- (abf625a1, 133ea3be, 1025d6c7, 72baf3c7) GitHub main is parent 2.
-- recorded_at = close - 1 ms (org-week.ts recordedAtForClosedOrgWeek): 11:59:59.999Z for
-- W31-W43 (CEST), 12:59:59.999Z for W44 (CET).
--
-- Values (verified 2026-10-31, fresh read-only clone of A-sop/DABOS):
--   W31 0 (218->218)  W32 9 (218->227)  W33 0  W34 2 (227->229)  W35-W37 0 (229)
--   W38 3 (229->232; 2e1696fe, Fri 11 Sep 00:19 Berlin, on GitHub main from then)
--   W39 0 (232)  W40 0 (232->232)  W41 0
--   Dept13 FAIL v1 fixed: v1 had W38 0 / W40 3 from a first-parent read. 133ea3be (29 Sep) merged
--   GitHub main (parent 2, already containing 2e1696fe) into a stale local copy (parent 1); it did
--   not bring the 3 pages to main.
--   W42 0 (232->232; dea83ac1 only re-pointed one link, no page added)  W43 0
--   W44 60 (232->292, 19190099 via DABOS #112; Dept13-passed in 2026-W44.md via #186)
--
-- Untouched: both div-live-2026-W30 Div1 artifacts_indexed rows (75, old artifact-index.md basis,
-- division row + Dept3 row), any Dept3 rows, any row outside the 14 inserted ones.
--
-- Undo (manual, if ever needed):
--   DELETE FROM stats WHERE basis->>'correction' = '2026-10-31_backfill_div1_artifacts_indexed_w31_w44';

BEGIN;

CREATE TEMP TABLE div1_backfill_w31_w44 (
  week integer PRIMARY KEY,
  ws text NOT NULL,
  val numeric NOT NULL,
  rec timestamptz NOT NULL,
  win_start text NOT NULL,
  win_end text NOT NULL,
  unique_before integer NOT NULL,
  unique_after integer NOT NULL,
  dabos_main_at_close text NOT NULL
) ON COMMIT DROP;

INSERT INTO div1_backfill_w31_w44 VALUES
  (31, 'div-live-2026-W31',  0, '2026-07-30T11:59:59.999Z', '2026-07-23T12:00:00.000Z', '2026-07-30T12:00:00.000Z', 218, 218, '5bd5a00b'),
  (32, 'div-live-2026-W32',  9, '2026-08-06T11:59:59.999Z', '2026-07-30T12:00:00.000Z', '2026-08-06T12:00:00.000Z', 218, 227, 'd2fb4bfb'),
  (33, 'div-live-2026-W33',  0, '2026-08-13T11:59:59.999Z', '2026-08-06T12:00:00.000Z', '2026-08-13T12:00:00.000Z', 227, 227, '72baf3c7'),
  (34, 'div-live-2026-W34',  2, '2026-08-20T11:59:59.999Z', '2026-08-13T12:00:00.000Z', '2026-08-20T12:00:00.000Z', 227, 229, 'f7cb1800'),
  (35, 'div-live-2026-W35',  0, '2026-08-27T11:59:59.999Z', '2026-08-20T12:00:00.000Z', '2026-08-27T12:00:00.000Z', 229, 229, '000d2f2e'),
  (36, 'div-live-2026-W36',  0, '2026-09-03T11:59:59.999Z', '2026-08-27T12:00:00.000Z', '2026-09-03T12:00:00.000Z', 229, 229, 'b92b8e64'),
  (37, 'div-live-2026-W37',  0, '2026-09-10T11:59:59.999Z', '2026-09-03T12:00:00.000Z', '2026-09-10T12:00:00.000Z', 229, 229, 'a21c2dda'),
  (38, 'div-live-2026-W38',  3, '2026-09-17T11:59:59.999Z', '2026-09-10T12:00:00.000Z', '2026-09-17T12:00:00.000Z', 229, 232, 'eef8b6e5'),
  (39, 'div-live-2026-W39',  0, '2026-09-24T11:59:59.999Z', '2026-09-17T12:00:00.000Z', '2026-09-24T12:00:00.000Z', 232, 232, 'f85b987f'),
  (40, 'div-live-2026-W40',  0, '2026-10-01T11:59:59.999Z', '2026-09-24T12:00:00.000Z', '2026-10-01T12:00:00.000Z', 232, 232, 'a49b6d10'),
  (41, 'div-live-2026-W41',  0, '2026-10-08T11:59:59.999Z', '2026-10-01T12:00:00.000Z', '2026-10-08T12:00:00.000Z', 232, 232, '6dc58670'),
  (42, 'div-live-2026-W42',  0, '2026-10-15T11:59:59.999Z', '2026-10-08T12:00:00.000Z', '2026-10-15T12:00:00.000Z', 232, 232, '7814e757'),
  (43, 'div-live-2026-W43',  0, '2026-10-22T11:59:59.999Z', '2026-10-15T12:00:00.000Z', '2026-10-22T12:00:00.000Z', 232, 232, '368cfd9e'),
  (44, 'div-live-2026-W44', 60, '2026-10-29T12:59:59.999Z', '2026-10-22T12:00:00.000Z', '2026-10-29T13:00:00.000Z', 232, 292, '37aff075');

DO $$
DECLARE
  tag constant text := '2026-10-31_backfill_div1_artifacts_indexed_w31_w44';
  w30_before text;
  w30_after text;
  other_before bigint;
  other_after bigint;
  n integer;
  inserted integer;
BEGIN
  -- Guard 0: the backfill set is the 14 weeks W31..W44, values sum 74, Div1 exists (FK).
  SELECT count(*) INTO n FROM div1_backfill_w31_w44
   WHERE week BETWEEN 31 AND 44 AND ws = 'div-live-2026-W' || week;
  IF n <> 14 OR (SELECT sum(val) FROM div1_backfill_w31_w44) <> 74 THEN
    RAISE EXCEPTION 'guard 0: backfill set is not the 14 weeks W31..W44 summing to 74';
  END IF;
  SELECT count(*) INTO n FROM divisions WHERE id = 'Div1';
  IF n <> 1 THEN
    RAISE EXCEPTION 'guard 0b: division Div1 not found';
  END IF;

  -- Guard 1: an existing Div1 artifacts_indexed division row in W31..W44 must already equal the
  -- backfill (same value and recorded_at); otherwise abort rather than skip a conflicting row.
  SELECT count(*) INTO n FROM stats s JOIN div1_backfill_w31_w44 b ON s.workspace_id = b.ws
   WHERE s.division_id = 'Div1' AND s.department_id IS NULL AND s.metric_key = 'artifacts_indexed'
     AND (s.value <> b.val OR s.recorded_at <> b.rec);
  IF n <> 0 THEN
    RAISE EXCEPTION 'guard 1: % existing Div1 artifacts_indexed row(s) in W31..W44 differ from the backfill (value or recorded_at)', n;
  END IF;
  -- Guard 1b: never more than one such row per week already.
  SELECT count(*) INTO n FROM (
    SELECT s.workspace_id FROM stats s JOIN div1_backfill_w31_w44 b ON s.workspace_id = b.ws
     WHERE s.division_id = 'Div1' AND s.department_id IS NULL AND s.metric_key = 'artifacts_indexed'
     GROUP BY 1 HAVING count(*) > 1
  ) t;
  IF n <> 0 THEN
    RAISE EXCEPTION 'guard 1b: % week(s) already hold more than one Div1 artifacts_indexed division row', n;
  END IF;

  -- Snapshots: the W30 rows (exact content) and the count of every row this script must not touch.
  SELECT coalesce(md5(string_agg(t::text, '|' ORDER BY t.id)), 'none') INTO w30_before
    FROM (SELECT * FROM stats WHERE workspace_id = 'div-live-2026-W30') t;
  SELECT count(*) INTO other_before FROM stats;

  -- Insert (same row shape as postDivisionWeeklyStats / emitStat insert_if_absent).
  INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by)
  SELECT b.ws, 'Div1', NULL, 'artifacts_indexed', b.val, b.rec,
         jsonb_build_object(
           'ssot', 'DABOS/docs/wiki/index.md',
           'rule', 'unique link targets (Logan ruling 2026-10-21)',
           'note', 'Div1 basis: pages added to docs/wiki/index.md during the stat week (Thu 14:00 -> Thu 14:00 Europe/Berlin; event-week rule); a re-pointed link adds no page',
           'year', 2026,
           'week', b.week,
           'window', jsonb_build_object('start', b.win_start, 'end', b.win_end),
           'index_unique_before', b.unique_before,
           'index_unique_after', b.unique_after,
           'dabos_main_at_close', b.dabos_main_at_close,
           'correction', tag
         ),
         'week-close-poster'
    FROM div1_backfill_w31_w44 b
   WHERE NOT EXISTS (
     SELECT 1 FROM stats s
      WHERE s.workspace_id = b.ws
        AND s.division_id = 'Div1'
        AND s.department_id IS NOT DISTINCT FROM NULL
        AND s.metric_key = 'artifacts_indexed'
   );
  GET DIAGNOSTICS inserted = ROW_COUNT;

  -- Guard 2: nothing else changed. Row count grew by exactly the inserts; W30 rows identical.
  SELECT count(*) INTO other_after FROM stats;
  IF other_after <> other_before + inserted THEN
    RAISE EXCEPTION 'guard 2: stats row count % -> %, expected +%', other_before, other_after, inserted;
  END IF;
  SELECT coalesce(md5(string_agg(t::text, '|' ORDER BY t.id)), 'none') INTO w30_after
    FROM (SELECT * FROM stats WHERE workspace_id = 'div-live-2026-W30') t;
  IF w30_after <> w30_before THEN
    RAISE EXCEPTION 'guard 2b: div-live-2026-W30 rows changed';
  END IF;

  -- Guard 3: end state. Exactly one Div1 artifacts_indexed division row per week W31..W44, with
  -- the backfill value and recorded_at (14 rows).
  SELECT count(*) INTO n FROM (
    SELECT b.week FROM div1_backfill_w31_w44 b
      JOIN stats s ON s.workspace_id = b.ws AND s.division_id = 'Div1' AND s.department_id IS NULL
                  AND s.metric_key = 'artifacts_indexed' AND s.value = b.val AND s.recorded_at = b.rec
     GROUP BY b.week HAVING count(*) = 1
  ) t;
  IF n <> 14 THEN
    RAISE EXCEPTION 'guard 3: expected 14 weeks with exactly one matching Div1 row, found %', n;
  END IF;
  SELECT count(*) INTO n FROM stats s JOIN div1_backfill_w31_w44 b ON s.workspace_id = b.ws
   WHERE s.division_id = 'Div1' AND s.department_id IS NULL AND s.metric_key = 'artifacts_indexed';
  IF n <> 14 THEN
    RAISE EXCEPTION 'guard 3b: expected 14 Div1 artifacts_indexed division rows in W31..W44, found %', n;
  END IF;

  RAISE NOTICE 'Div1 artifacts_indexed backfill ok: % row(s) inserted, 14 present (W31..W44), W30 untouched', inserted;
END
$$;

COMMIT;
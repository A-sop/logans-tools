-- One-off data correction: gfp-live W43 + W44 stat rows onto the Thursday-close basis
-- (Dept13 2026-10-31; founder rulings 2026-10-30: stat week closes Thu 14:00 Berlin, leads count
-- in the week they arrived, bookings in the week they were booked).
-- NOT a migration (lives outside ./migrations so `npm run dabos:migrate` never runs it).
-- NOT EXECUTED by this PR. Runs only after Dept13 PASS and Logan's (or Div7's) explicit OK to apply,
-- and only on a DB where migration 021_stats_conditions_superseded.sql is applied.
-- Pattern: scripts/dabos/sql/2026-10-29_supersede_w44_poster_rows.sql (supersede, never delete).
--
-- Run (Logan): psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -f scripts/dabos/sql/2026-10-31_supersede_gfp_live_w43_w44.sql
--   Every guard RAISEs inside one DO block inside one transaction: any mismatch aborts
--   and nothing is changed. Re-running after success aborts (rows already superseded).
--
-- Why SQL inserts and not "supersede + npm run dabos:post-gfp-weekly-stats --week=...":
--   emitStat insert_if_absent checks workspace+division+department+metric WITHOUT filtering
--   superseded_at, so after superseding, the poster would see the old rows and insert nothing.
--   This script therefore inserts the corrected rows itself, with exactly the values, recorded_at
--   and basis the current poster (src/lib/dabos/gfp-weekly-stats.ts @ e8d1599) produces for those
--   weeks. After it runs, the poster stays a no-op for W43/W44 (rows present).
--
-- What it does:
--   1. Marks the 6 old-poster rows in gfp-live-2026-W43 / gfp-live-2026-W44 superseded.
--      Their recorded_at is the end of the ISO Mon-Sun week (W43 2026-10-25T23:59:59.999Z,
--      W44 2026-11-01T23:59:59.999Z = 2 Nov 00:59:59.999 Berlin, a future date when posted).
--   2. Inserts 6 corrected rows (3 per week), recorded_at = org-week close - 1 ms (org-week.ts):
--        W43 window [2026-10-15T12:00:00Z, 2026-10-22T12:00:00Z) -> recorded_at 2026-10-22T11:59:59.999Z
--        W44 window [2026-10-22T12:00:00Z, 2026-10-29T13:00:00Z) -> recorded_at 2026-10-29T12:59:59.999Z
--      Values recomputed read-only on GFP Neon 2026-10-31 (counts only, no lead data):
--        lead_magnets_shipped (guide campaign_leads by created_at in window) W43 0, W44 0
--        termin_clicks / conversions (campaign_leads by booked_at in window)  W43 0, W44 0
--        booked without booked_at (status='booked', booked_at null, all time) 0
--      Values equal the old rows (all 0); only recorded_at and basis change.
--   End state (guard 6): exactly one active row per metric per workspace, at the close, value 0.
--   Out of scope: older gfp-live weeks (W27..W42) also carry ISO-window recorded_at; not touched.
--
-- Undo (manual, if ever needed):
--   BEGIN;
--   DELETE FROM stats
--     WHERE workspace_id IN ('gfp-live-2026-W43', 'gfp-live-2026-W44') AND superseded_at IS NULL
--       AND basis->>'correction' = '2026-10-31_supersede_gfp_live_w43_w44';
--   UPDATE stats SET superseded_at = NULL, superseded_reason = NULL
--     WHERE superseded_reason = 'Dept13 2026-10-31: old gfp poster ISO Mon-Sun window (not Thu 14:00 Berlin close)';
--   COMMIT;

BEGIN;

DO $$
DECLARE
  old_ids uuid[] := ARRAY[
    'd85a538c-c244-4f21-b732-5c38d342e0cd', -- W43 Div6        conversions          0
    '07033c3c-bb9e-4221-bfe2-2c78112e3350', -- W43 Div6/Dept16 lead_magnets_shipped 0
    'ff6e2032-f293-4faf-b753-448fffdb99a2', -- W43 Div6/Dept17 termin_clicks        0
    'c5ceb4c5-0adc-49a3-a4f4-44a0c305e0ea', -- W44 Div6        conversions          0
    '3d48f1b2-b2e7-4823-8633-b442698cbb0c', -- W44 Div6/Dept16 lead_magnets_shipped 0
    '22611c50-fc80-432b-b518-1b2705ec55e0'  -- W44 Div6/Dept17 termin_clicks        0
  ]::uuid[];
  ws43 constant text := 'gfp-live-2026-W43';
  ws44 constant text := 'gfp-live-2026-W44';
  old43 constant timestamptz := '2026-10-25T23:59:59.999Z';
  old44 constant timestamptz := '2026-11-01T23:59:59.999Z';
  rec43 constant timestamptz := '2026-10-22T11:59:59.999Z';
  rec44 constant timestamptz := '2026-10-29T12:59:59.999Z';
  reason constant text := 'Dept13 2026-10-31: old gfp poster ISO Mon-Sun window (not Thu 14:00 Berlin close)';
  tag constant text := '2026-10-31_supersede_gfp_live_w43_w44';
  booking_note constant text := 'Cal booked proxy until PostHog CTA ingest; bucketed by campaign_leads.booked_at (week booked)';
  lead_note constant text := 'guide campaign_leads week rollup';
  n integer;
BEGIN
  -- Guard 0: migration 021 applied.
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = current_schema()
     AND table_name = 'stats'
     AND column_name IN ('superseded_at', 'superseded_reason');
  IF n <> 2 THEN
    RAISE EXCEPTION 'guard 0: migration 021 not applied (found % of 2 stats supersede columns)', n;
  END IF;

  -- Guard 1: exactly the 6 expected, not-yet-superseded rows, each with the expected shape,
  -- value 0 and the old ISO-window recorded_at.
  SELECT count(*) INTO n FROM stats
   WHERE id = ANY(old_ids) AND superseded_at IS NULL AND division_id = 'Div6' AND value = 0
     AND (
       (workspace_id = ws43 AND recorded_at = old43) OR
       (workspace_id = ws44 AND recorded_at = old44)
     )
     AND (
       (department_id IS NULL AND metric_key = 'conversions') OR
       (department_id = 'Dept16' AND metric_key = 'lead_magnets_shipped') OR
       (department_id = 'Dept17' AND metric_key = 'termin_clicks')
     );
  IF n <> 6 THEN
    RAISE EXCEPTION 'guard 1: expected 6 active old-poster rows (value 0, ISO recorded_at) in %/%, found %', ws43, ws44, n;
  END IF;
  -- Guard 1b: they are the only rows (active or not) in the two workspaces.
  SELECT count(*) INTO n FROM stats WHERE workspace_id IN (ws43, ws44);
  IF n <> 6 THEN
    RAISE EXCEPTION 'guard 1b: expected 6 rows total in %/%, found % (unlisted rows present)', ws43, ws44, n;
  END IF;
  -- Guard 1c: one row per (workspace, metric).
  SELECT count(DISTINCT (workspace_id, metric_key)) INTO n FROM stats WHERE id = ANY(old_ids);
  IF n <> 6 THEN
    RAISE EXCEPTION 'guard 1c: expected 6 distinct workspace/metric pairs, found %', n;
  END IF;

  -- 1. Supersede the old rows.
  UPDATE stats SET superseded_at = now(), superseded_reason = reason
   WHERE id = ANY(old_ids) AND superseded_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 6 THEN
    RAISE EXCEPTION 'guard 2: supersede touched % rows, expected 6', n;
  END IF;

  -- 2. Insert the corrected rows (same shape as postGfpWeeklyStats / emitStat).
  INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by)
  SELECT w.ws, 'Div6', m.dept, m.metric, 0, w.rec,
         jsonb_build_object(
           'source', 'gfp-campaign_leads',
           'note', CASE WHEN m.metric = 'lead_magnets_shipped' THEN lead_note ELSE booking_note END,
           'year', 2026,
           'week', w.week,
           'window', jsonb_build_object('start', w.win_start, 'end', w.win_end),
           'correction', tag
         ) || CASE WHEN m.metric = 'lead_magnets_shipped' THEN '{}'::jsonb
                   ELSE jsonb_build_object('booked_without_booked_at', 0) END,
         'gfp-poster'
    FROM (VALUES
           (ws43, 43, rec43, '2026-10-15T12:00:00.000Z', '2026-10-22T12:00:00.000Z'),
           (ws44, 44, rec44, '2026-10-22T12:00:00.000Z', '2026-10-29T13:00:00.000Z')
         ) AS w(ws, week, rec, win_start, win_end)
   CROSS JOIN (VALUES
           ('Dept16'::text, 'lead_magnets_shipped'),
           ('Dept17'::text, 'termin_clicks'),
           (NULL::text, 'conversions')
         ) AS m(dept, metric);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 6 THEN
    RAISE EXCEPTION 'guard 3: inserted % rows, expected 6', n;
  END IF;

  -- Guard 4: the old rows are still there (superseded, not deleted).
  SELECT count(*) INTO n FROM stats WHERE id = ANY(old_ids) AND superseded_reason = reason;
  IF n <> 6 THEN
    RAISE EXCEPTION 'guard 4: expected 6 superseded old rows, found %', n;
  END IF;

  -- Guard 5: exactly one active row per (workspace, metric), 3 per workspace.
  SELECT count(*) INTO n FROM (
    SELECT workspace_id, metric_key FROM stats
     WHERE workspace_id IN (ws43, ws44) AND superseded_at IS NULL
     GROUP BY 1, 2 HAVING count(*) = 1
  ) t;
  IF n <> 6 THEN
    RAISE EXCEPTION 'guard 5: expected 6 workspace/metric pairs with exactly one active row, found %', n;
  END IF;

  -- Guard 6: end state. 6 active rows, all value 0 at the Thursday-close recorded_at.
  SELECT count(*) INTO n FROM stats
   WHERE workspace_id IN (ws43, ws44) AND superseded_at IS NULL AND value = 0
     AND ((workspace_id = ws43 AND recorded_at = rec43) OR (workspace_id = ws44 AND recorded_at = rec44));
  IF n <> 6 THEN
    RAISE EXCEPTION 'guard 6: expected 6 active corrected rows at the Thu 14:00 close, found %', n;
  END IF;
  SELECT count(*) INTO n FROM stats WHERE workspace_id IN (ws43, ws44) AND superseded_at IS NULL;
  IF n <> 6 THEN
    RAISE EXCEPTION 'guard 6b: expected 6 active rows in %/%, found %', ws43, ws44, n;
  END IF;

  RAISE NOTICE 'gfp-live W43/W44 correction ok: 6 old rows superseded, 6 rows inserted at the Thu 14:00 Berlin close (all 0)';
END
$$;

COMMIT;

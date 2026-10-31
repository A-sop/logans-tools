-- One-off data correction: gfp-live W27..W42 (2026) stat rows onto the Thursday-close basis
-- (Div7 2026-10-31; founder rulings 2026-10-30: stat week closes Thu 14:00 Berlin, leads count in
-- the week they arrived, bookings in the week they were booked; no new ruling needed per Div7).
-- Acceptance (committed before this file): scripts/dabos/sql/2026-10-31_supersede_gfp_live_w27_w42.ACCEPTANCE.md
-- NOT a migration (lives outside ./migrations so `npm run dabos:migrate` never runs it).
-- NOT EXECUTED by this PR. Runs only after Dept13 PASS and Logan's explicit yes to the merge,
-- only on a DB where migration 021_stats_conditions_superseded.sql is applied, and only AFTER
-- scripts/dabos/sql/2026-10-31_supersede_gfp_live_w43_w44.sql (#45) has been applied (guard 0c).
-- Pattern: scripts/dabos/sql/2026-10-31_supersede_gfp_live_w43_w44.sql (supersede, never delete).
--
-- Run (Logan): psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -f scripts/dabos/sql/2026-10-31_supersede_gfp_live_w27_w42.sql
--   One transaction; every guard RAISEs inside one DO block, so any mismatch aborts and nothing is
--   changed. Re-running after success aborts (guard 1: the old rows are already superseded).
--
-- Why SQL inserts and not "supersede + npm run dabos:post-gfp-weekly-stats --week=...": emitStat
-- insert_if_absent does not filter superseded_at, so the poster would see the old rows and insert
-- nothing (Dept11 issue raised by Dept13 on #45). This script inserts the corrected rows itself with
-- the shape the current poster (src/lib/dabos/gfp-weekly-stats.ts) writes.
--
-- What it does:
--   1. Marks the 48 old rows (16 weeks x 3 metrics) in gfp-live-2026-W27..W42 superseded. Their
--      recorded_at is the end of the ISO Mon-Sun week, read-only from DABOS Neon 2026-10-31:
--        W27..W31 Sun 21:59:59.999Z (= Sun 23:59:59.999 Berlin CEST; W27..W30 have no basis and
--        recorded_by NULL, W31 recorded_by gfp-poster), W32..W42 Sun 23:59:59.999Z (UTC midnight).
--      W42's old recorded_at (2026-10-18T23:59:59.999Z) lies inside W43's window
--      [2026-10-15T12:00Z, 2026-10-22T12:00Z): this correction removes that overlap.
--   2. Inserts 48 corrected rows with the SAME values (all 0), recorded_at = org-week close - 1 ms
--      (org-week.ts statWeekWindow + recordedAtForClosedOrgWeek). All of W27..W42 close in CEST, so
--      every close is Thu 11:59:59.999Z; the switch to CET (25 Oct) first affects W44 (12:59:59.999Z).
--      recorded_by 'gfp-poster', basis as the poster writes it plus correction tag.
--   Values cross-checked read-only on GFP Neon 2026-10-31 (counts only, no lead data): for every
--   W27..W42 Thursday-close window, guide campaign_leads by created_at = 0 and campaign_leads by
--   booked_at = 0; booked without booked_at (all time) = 0. Every value equals the old row's value.
--   End state (guards 5-7): exactly one active row per metric per week at the close, same value;
--   48 old rows superseded, not deleted; no active gfp-live-2026 row (W27..W44) is off its own
--   week's close, and none lies inside a later week's window.
--   Out of scope: W43/W44 (#45), the poster's insert_if_absent superseded filter (separate issue).
--
-- Undo (manual, if ever needed): scoped to the exact 48 old ids, row-count checked, and it
-- SUPERSEDES the corrected rows instead of deleting them. Copy the lines between the markers and
-- strip the leading "-- ".
-- UNDO-BEGIN
-- BEGIN;
-- DO $undo$
-- DECLARE
--   old_ids uuid[] := ARRAY[
--     '60949ad3-e4ce-47ff-8802-7003b623f320', 'e6dd6c10-8205-41af-8096-5796f3ddefc5', 'f7af684f-6cba-4549-9baa-9ea374c3c034', -- gfp-live-2026-W27
--     'be47600c-9496-455a-8de6-6cac22254314', '834ebf7b-2cb4-4281-a9a3-00eafe0ea43b', '04ab5f75-5325-4ad6-b6b0-1a1cd651ae8d', -- gfp-live-2026-W28
--     '51a4f55a-27e8-46ef-a1f5-f0125f38f552', 'f51b24df-ee4d-412c-9470-a3be0d95bf08', 'a03cbc3c-55aa-4c86-8ff6-94b155a349ef', -- gfp-live-2026-W29
--     '94670beb-d3d2-4109-95f3-3332e9b4e74f', 'c3436f01-621a-4343-bc16-d1058b661cad', '45082101-9af2-470d-a3ff-5fe8ef57a3f4', -- gfp-live-2026-W30
--     '7b41a49f-07cc-4b67-a429-6952d4d7fd8d', '42fc5ebd-2648-477b-bdbd-0564556e8c72', 'b35e14ff-b2b9-4d68-bea5-81f97884c701', -- gfp-live-2026-W31
--     'ae15c767-85ac-41b4-b561-3a9bae8aef61', '0a65aeb6-0832-4e82-972c-7e6d5093bb83', '0659b1c9-76f8-4c07-96d4-9809210e6d03', -- gfp-live-2026-W32
--     '6250263b-9548-4ae9-a99e-2eff71ad5915', 'e710604e-6a65-4ab3-a8f3-07cc1c68c5bc', 'e2fdb7fe-c996-41b6-9c67-4228dc1197aa', -- gfp-live-2026-W33
--     'c3bade55-fe5b-44de-8ef2-6d36aca6c191', '0736217d-a330-4fd8-87eb-42d1c5c14293', '80ef9a7a-d605-42ad-80ef-148553b83e70', -- gfp-live-2026-W34
--     '9746cd31-dac0-4d80-b185-661015c7e081', '76b145a5-957b-4028-acac-1779565c28ab', '957bc095-4f6c-4fe1-9666-6b7eff43fcf4', -- gfp-live-2026-W35
--     '3037e6a7-0e3f-4af8-a649-82e138f9eea3', 'af888689-75a5-43f5-a661-b2cae0a21b43', 'e9299d8b-65bf-4a9c-98d5-738cffcd0bde', -- gfp-live-2026-W36
--     '4dbb8b49-db96-49cf-a443-cabce3c1725e', '553feb61-469f-4be5-aa0f-e6ef5891e9f1', 'a2dde6b7-d537-4333-8f7a-6b95a7505fae', -- gfp-live-2026-W37
--     '3d9131f3-ec97-44ad-80c4-7749f353074f', '78b5818f-edfe-4c4e-9a59-ca3e42b1941e', 'a36708aa-6c24-4000-b078-1bfb05049a6f', -- gfp-live-2026-W38
--     '1fde379d-59e9-4bdf-af8f-473ded8c8aa2', '261047d7-9762-479e-843b-5fb3b5c25a9f', '4e87e1ba-fff1-42be-9056-e28eb3c2821d', -- gfp-live-2026-W39
--     '40e71d7f-c8b5-4fd0-ae63-5478ca0cbdea', 'cca02b36-16ea-4507-82f3-31a63e827596', '516ede1f-514d-49c6-9ec8-538ef1af41b2', -- gfp-live-2026-W40
--     '2459c204-bba3-4066-a083-94f15918a0b0', '79dc6738-8fbb-48a3-b023-e525cc8ee39c', 'aed59ccb-d7d3-4a3c-8e98-fe1b0f925b9a', -- gfp-live-2026-W41
--     '72d5a743-8f16-45df-8f81-ed8e9dc36567', '38c60e4d-9a4c-4586-a3a6-1bf325b9361e', 'ae283f25-5dd2-4aa0-9970-76198791b08f' -- gfp-live-2026-W42
--   ]::uuid[];
--   n integer;
-- BEGIN
--   IF cardinality(old_ids) <> 48 THEN
--     RAISE EXCEPTION 'undo: expected 48 old ids, got %', cardinality(old_ids);
--   END IF;
--   UPDATE stats SET superseded_at = now(), superseded_reason = 'Undo of 2026-10-31_supersede_gfp_live_w27_w42'
--    WHERE workspace_id LIKE 'gfp-live-2026-W%' AND superseded_at IS NULL
--      AND basis->>'correction' = '2026-10-31_supersede_gfp_live_w27_w42';
--   GET DIAGNOSTICS n = ROW_COUNT;
--   IF n <> 48 THEN
--     RAISE EXCEPTION 'undo: superseded % corrected rows, expected 48', n;
--   END IF;
--   UPDATE stats SET superseded_at = NULL, superseded_reason = NULL
--    WHERE id = ANY(old_ids)
--      AND superseded_reason = 'Dept13 2026-10-31: old gfp poster ISO Mon-Sun window, W27-W42 (not Thu 14:00 Berlin close)';
--   GET DIAGNOSTICS n = ROW_COUNT;
--   IF n <> 48 THEN
--     RAISE EXCEPTION 'undo: restored % old rows, expected 48', n;
--   END IF;
--   SELECT count(*) INTO n FROM stats
--    WHERE workspace_id IN (SELECT workspace_id FROM stats WHERE id = ANY(old_ids))
--      AND superseded_at IS NULL;
--   IF n <> 48 THEN
--     RAISE EXCEPTION 'undo: expected 48 active rows in W27..W42 after undo, found %', n;
--   END IF;
--   RAISE NOTICE 'undo ok: 48 corrected rows superseded, 48 old rows active again';
-- END
-- $undo$;
-- COMMIT;
-- UNDO-END

BEGIN;

-- The 48 old rows, exactly as read (read-only) from DABOS Neon 2026-10-31.
CREATE TEMP TABLE _gfp_w27_w42_old (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL,
  week integer NOT NULL,
  department_id text,
  metric_key text NOT NULL,
  value numeric NOT NULL,
  old_recorded_at timestamptz NOT NULL
) ON COMMIT DROP;
INSERT INTO _gfp_w27_w42_old (id, workspace_id, week, department_id, metric_key, value, old_recorded_at) VALUES
  ('60949ad3-e4ce-47ff-8802-7003b623f320', 'gfp-live-2026-W27', 27, 'Dept16', 'lead_magnets_shipped', 0, '2026-07-05T21:59:59.999Z'),
  ('e6dd6c10-8205-41af-8096-5796f3ddefc5', 'gfp-live-2026-W27', 27, 'Dept17', 'termin_clicks', 0, '2026-07-05T21:59:59.999Z'),
  ('f7af684f-6cba-4549-9baa-9ea374c3c034', 'gfp-live-2026-W27', 27, NULL, 'conversions', 0, '2026-07-05T21:59:59.999Z'),
  ('be47600c-9496-455a-8de6-6cac22254314', 'gfp-live-2026-W28', 28, 'Dept16', 'lead_magnets_shipped', 0, '2026-07-12T21:59:59.999Z'),
  ('834ebf7b-2cb4-4281-a9a3-00eafe0ea43b', 'gfp-live-2026-W28', 28, 'Dept17', 'termin_clicks', 0, '2026-07-12T21:59:59.999Z'),
  ('04ab5f75-5325-4ad6-b6b0-1a1cd651ae8d', 'gfp-live-2026-W28', 28, NULL, 'conversions', 0, '2026-07-12T21:59:59.999Z'),
  ('51a4f55a-27e8-46ef-a1f5-f0125f38f552', 'gfp-live-2026-W29', 29, 'Dept16', 'lead_magnets_shipped', 0, '2026-07-19T21:59:59.999Z'),
  ('f51b24df-ee4d-412c-9470-a3be0d95bf08', 'gfp-live-2026-W29', 29, 'Dept17', 'termin_clicks', 0, '2026-07-19T21:59:59.999Z'),
  ('a03cbc3c-55aa-4c86-8ff6-94b155a349ef', 'gfp-live-2026-W29', 29, NULL, 'conversions', 0, '2026-07-19T21:59:59.999Z'),
  ('94670beb-d3d2-4109-95f3-3332e9b4e74f', 'gfp-live-2026-W30', 30, 'Dept16', 'lead_magnets_shipped', 0, '2026-07-26T21:59:59.999Z'),
  ('c3436f01-621a-4343-bc16-d1058b661cad', 'gfp-live-2026-W30', 30, 'Dept17', 'termin_clicks', 0, '2026-07-26T21:59:59.999Z'),
  ('45082101-9af2-470d-a3ff-5fe8ef57a3f4', 'gfp-live-2026-W30', 30, NULL, 'conversions', 0, '2026-07-26T21:59:59.999Z'),
  ('7b41a49f-07cc-4b67-a429-6952d4d7fd8d', 'gfp-live-2026-W31', 31, 'Dept16', 'lead_magnets_shipped', 0, '2026-08-02T21:59:59.999Z'),
  ('42fc5ebd-2648-477b-bdbd-0564556e8c72', 'gfp-live-2026-W31', 31, 'Dept17', 'termin_clicks', 0, '2026-08-02T21:59:59.999Z'),
  ('b35e14ff-b2b9-4d68-bea5-81f97884c701', 'gfp-live-2026-W31', 31, NULL, 'conversions', 0, '2026-08-02T21:59:59.999Z'),
  ('ae15c767-85ac-41b4-b561-3a9bae8aef61', 'gfp-live-2026-W32', 32, 'Dept16', 'lead_magnets_shipped', 0, '2026-08-09T23:59:59.999Z'),
  ('0a65aeb6-0832-4e82-972c-7e6d5093bb83', 'gfp-live-2026-W32', 32, 'Dept17', 'termin_clicks', 0, '2026-08-09T23:59:59.999Z'),
  ('0659b1c9-76f8-4c07-96d4-9809210e6d03', 'gfp-live-2026-W32', 32, NULL, 'conversions', 0, '2026-08-09T23:59:59.999Z'),
  ('6250263b-9548-4ae9-a99e-2eff71ad5915', 'gfp-live-2026-W33', 33, 'Dept16', 'lead_magnets_shipped', 0, '2026-08-16T23:59:59.999Z'),
  ('e710604e-6a65-4ab3-a8f3-07cc1c68c5bc', 'gfp-live-2026-W33', 33, 'Dept17', 'termin_clicks', 0, '2026-08-16T23:59:59.999Z'),
  ('e2fdb7fe-c996-41b6-9c67-4228dc1197aa', 'gfp-live-2026-W33', 33, NULL, 'conversions', 0, '2026-08-16T23:59:59.999Z'),
  ('c3bade55-fe5b-44de-8ef2-6d36aca6c191', 'gfp-live-2026-W34', 34, 'Dept16', 'lead_magnets_shipped', 0, '2026-08-23T23:59:59.999Z'),
  ('0736217d-a330-4fd8-87eb-42d1c5c14293', 'gfp-live-2026-W34', 34, 'Dept17', 'termin_clicks', 0, '2026-08-23T23:59:59.999Z'),
  ('80ef9a7a-d605-42ad-80ef-148553b83e70', 'gfp-live-2026-W34', 34, NULL, 'conversions', 0, '2026-08-23T23:59:59.999Z'),
  ('9746cd31-dac0-4d80-b185-661015c7e081', 'gfp-live-2026-W35', 35, 'Dept16', 'lead_magnets_shipped', 0, '2026-08-30T23:59:59.999Z'),
  ('76b145a5-957b-4028-acac-1779565c28ab', 'gfp-live-2026-W35', 35, 'Dept17', 'termin_clicks', 0, '2026-08-30T23:59:59.999Z'),
  ('957bc095-4f6c-4fe1-9666-6b7eff43fcf4', 'gfp-live-2026-W35', 35, NULL, 'conversions', 0, '2026-08-30T23:59:59.999Z'),
  ('3037e6a7-0e3f-4af8-a649-82e138f9eea3', 'gfp-live-2026-W36', 36, 'Dept16', 'lead_magnets_shipped', 0, '2026-09-06T23:59:59.999Z'),
  ('af888689-75a5-43f5-a661-b2cae0a21b43', 'gfp-live-2026-W36', 36, 'Dept17', 'termin_clicks', 0, '2026-09-06T23:59:59.999Z'),
  ('e9299d8b-65bf-4a9c-98d5-738cffcd0bde', 'gfp-live-2026-W36', 36, NULL, 'conversions', 0, '2026-09-06T23:59:59.999Z'),
  ('4dbb8b49-db96-49cf-a443-cabce3c1725e', 'gfp-live-2026-W37', 37, 'Dept16', 'lead_magnets_shipped', 0, '2026-09-13T23:59:59.999Z'),
  ('553feb61-469f-4be5-aa0f-e6ef5891e9f1', 'gfp-live-2026-W37', 37, 'Dept17', 'termin_clicks', 0, '2026-09-13T23:59:59.999Z'),
  ('a2dde6b7-d537-4333-8f7a-6b95a7505fae', 'gfp-live-2026-W37', 37, NULL, 'conversions', 0, '2026-09-13T23:59:59.999Z'),
  ('3d9131f3-ec97-44ad-80c4-7749f353074f', 'gfp-live-2026-W38', 38, 'Dept16', 'lead_magnets_shipped', 0, '2026-09-20T23:59:59.999Z'),
  ('78b5818f-edfe-4c4e-9a59-ca3e42b1941e', 'gfp-live-2026-W38', 38, 'Dept17', 'termin_clicks', 0, '2026-09-20T23:59:59.999Z'),
  ('a36708aa-6c24-4000-b078-1bfb05049a6f', 'gfp-live-2026-W38', 38, NULL, 'conversions', 0, '2026-09-20T23:59:59.999Z'),
  ('1fde379d-59e9-4bdf-af8f-473ded8c8aa2', 'gfp-live-2026-W39', 39, 'Dept16', 'lead_magnets_shipped', 0, '2026-09-27T23:59:59.999Z'),
  ('261047d7-9762-479e-843b-5fb3b5c25a9f', 'gfp-live-2026-W39', 39, 'Dept17', 'termin_clicks', 0, '2026-09-27T23:59:59.999Z'),
  ('4e87e1ba-fff1-42be-9056-e28eb3c2821d', 'gfp-live-2026-W39', 39, NULL, 'conversions', 0, '2026-09-27T23:59:59.999Z'),
  ('40e71d7f-c8b5-4fd0-ae63-5478ca0cbdea', 'gfp-live-2026-W40', 40, 'Dept16', 'lead_magnets_shipped', 0, '2026-10-04T23:59:59.999Z'),
  ('cca02b36-16ea-4507-82f3-31a63e827596', 'gfp-live-2026-W40', 40, 'Dept17', 'termin_clicks', 0, '2026-10-04T23:59:59.999Z'),
  ('516ede1f-514d-49c6-9ec8-538ef1af41b2', 'gfp-live-2026-W40', 40, NULL, 'conversions', 0, '2026-10-04T23:59:59.999Z'),
  ('2459c204-bba3-4066-a083-94f15918a0b0', 'gfp-live-2026-W41', 41, 'Dept16', 'lead_magnets_shipped', 0, '2026-10-11T23:59:59.999Z'),
  ('79dc6738-8fbb-48a3-b023-e525cc8ee39c', 'gfp-live-2026-W41', 41, 'Dept17', 'termin_clicks', 0, '2026-10-11T23:59:59.999Z'),
  ('aed59ccb-d7d3-4a3c-8e98-fe1b0f925b9a', 'gfp-live-2026-W41', 41, NULL, 'conversions', 0, '2026-10-11T23:59:59.999Z'),
  ('72d5a743-8f16-45df-8f81-ed8e9dc36567', 'gfp-live-2026-W42', 42, 'Dept16', 'lead_magnets_shipped', 0, '2026-10-18T23:59:59.999Z'),
  ('38c60e4d-9a4c-4586-a3a6-1bf325b9361e', 'gfp-live-2026-W42', 42, 'Dept17', 'termin_clicks', 0, '2026-10-18T23:59:59.999Z'),
  ('ae283f25-5dd2-4aa0-9970-76198791b08f', 'gfp-live-2026-W42', 42, NULL, 'conversions', 0, '2026-10-18T23:59:59.999Z');

-- Stat weeks 2026-W27..W44 from org-week.ts: (week, window start, window end, recorded_at = end - 1 ms).
CREATE TEMP TABLE _gfp_stat_weeks (
  week integer PRIMARY KEY,
  win_start text NOT NULL,
  win_end text NOT NULL,
  rec text NOT NULL
) ON COMMIT DROP;
INSERT INTO _gfp_stat_weeks (week, win_start, win_end, rec) VALUES
  (27, '2026-06-25T12:00:00.000Z', '2026-07-02T12:00:00.000Z', '2026-07-02T11:59:59.999Z'),
  (28, '2026-07-02T12:00:00.000Z', '2026-07-09T12:00:00.000Z', '2026-07-09T11:59:59.999Z'),
  (29, '2026-07-09T12:00:00.000Z', '2026-07-16T12:00:00.000Z', '2026-07-16T11:59:59.999Z'),
  (30, '2026-07-16T12:00:00.000Z', '2026-07-23T12:00:00.000Z', '2026-07-23T11:59:59.999Z'),
  (31, '2026-07-23T12:00:00.000Z', '2026-07-30T12:00:00.000Z', '2026-07-30T11:59:59.999Z'),
  (32, '2026-07-30T12:00:00.000Z', '2026-08-06T12:00:00.000Z', '2026-08-06T11:59:59.999Z'),
  (33, '2026-08-06T12:00:00.000Z', '2026-08-13T12:00:00.000Z', '2026-08-13T11:59:59.999Z'),
  (34, '2026-08-13T12:00:00.000Z', '2026-08-20T12:00:00.000Z', '2026-08-20T11:59:59.999Z'),
  (35, '2026-08-20T12:00:00.000Z', '2026-08-27T12:00:00.000Z', '2026-08-27T11:59:59.999Z'),
  (36, '2026-08-27T12:00:00.000Z', '2026-09-03T12:00:00.000Z', '2026-09-03T11:59:59.999Z'),
  (37, '2026-09-03T12:00:00.000Z', '2026-09-10T12:00:00.000Z', '2026-09-10T11:59:59.999Z'),
  (38, '2026-09-10T12:00:00.000Z', '2026-09-17T12:00:00.000Z', '2026-09-17T11:59:59.999Z'),
  (39, '2026-09-17T12:00:00.000Z', '2026-09-24T12:00:00.000Z', '2026-09-24T11:59:59.999Z'),
  (40, '2026-09-24T12:00:00.000Z', '2026-10-01T12:00:00.000Z', '2026-10-01T11:59:59.999Z'),
  (41, '2026-10-01T12:00:00.000Z', '2026-10-08T12:00:00.000Z', '2026-10-08T11:59:59.999Z'),
  (42, '2026-10-08T12:00:00.000Z', '2026-10-15T12:00:00.000Z', '2026-10-15T11:59:59.999Z'),
  (43, '2026-10-15T12:00:00.000Z', '2026-10-22T12:00:00.000Z', '2026-10-22T11:59:59.999Z'),
  (44, '2026-10-22T12:00:00.000Z', '2026-10-29T13:00:00.000Z', '2026-10-29T12:59:59.999Z');

DO $$
DECLARE
  reason constant text := 'Dept13 2026-10-31: old gfp poster ISO Mon-Sun window, W27-W42 (not Thu 14:00 Berlin close)';
  tag constant text := '2026-10-31_supersede_gfp_live_w27_w42';
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

  -- Guard 0a: the inline tables are complete: 48 old rows (16 weeks x 3 metrics, all value 0) and
  -- 18 contiguous stat weeks with recorded_at = close - 1 ms.
  SELECT count(*) INTO n FROM _gfp_w27_w42_old WHERE value = 0 AND week BETWEEN 27 AND 42
     AND workspace_id = 'gfp-live-2026-W' || lpad(week::text, 2, '0');
  IF n <> 48 THEN
    RAISE EXCEPTION 'guard 0a: expected 48 inline old rows (W27..W42, value 0), found %', n;
  END IF;
  SELECT count(DISTINCT (week, metric_key)) INTO n FROM _gfp_w27_w42_old;
  IF n <> 48 THEN
    RAISE EXCEPTION 'guard 0a: expected 48 distinct week/metric pairs, found %', n;
  END IF;
  SELECT count(*) INTO n FROM _gfp_stat_weeks
   WHERE rec::timestamptz = win_end::timestamptz - interval '1 millisecond'
     AND win_end::timestamptz - win_start::timestamptz BETWEEN interval '167 hours' AND interval '169 hours';
  IF n <> 18 THEN
    RAISE EXCEPTION 'guard 0a: expected 18 stat weeks with recorded_at = close - 1 ms, found %', n;
  END IF;
  SELECT count(*) INTO n FROM _gfp_stat_weeks a JOIN _gfp_stat_weeks b ON b.week = a.week + 1
   WHERE b.win_start::timestamptz = a.win_end::timestamptz;
  IF n <> 17 THEN
    RAISE EXCEPTION 'guard 0a: stat weeks not contiguous (% of 17 joins)', n;
  END IF;

  -- Guard 0c: #45 (W43/W44) already applied: exactly 6 active W43/W44 rows, all tagged by it and at
  -- their Thursday close. Without it the end-state overlap check (guard 7) cannot hold.
  SELECT count(*) INTO n FROM stats s JOIN _gfp_stat_weeks w
       ON s.workspace_id = 'gfp-live-2026-W' || w.week::text
   WHERE w.week IN (43, 44) AND s.superseded_at IS NULL
     AND s.basis->>'correction' = '2026-10-31_supersede_gfp_live_w43_w44'
     AND s.recorded_at = w.rec::timestamptz;
  IF n <> 6 THEN
    RAISE EXCEPTION 'guard 0c: apply 2026-10-31_supersede_gfp_live_w43_w44.sql first (found % of 6 corrected W43/W44 rows)', n;
  END IF;
  SELECT count(*) INTO n FROM stats
   WHERE workspace_id IN ('gfp-live-2026-W43', 'gfp-live-2026-W44') AND superseded_at IS NULL;
  IF n <> 6 THEN
    RAISE EXCEPTION 'guard 0c: expected 6 active W43/W44 rows, found %', n;
  END IF;

  -- Guard 1: exactly the 48 expected rows, active, each with its exact workspace, department,
  -- metric, value and old ISO-window recorded_at.
  SELECT count(*) INTO n FROM stats s JOIN _gfp_w27_w42_old o ON o.id = s.id
   WHERE s.superseded_at IS NULL
     AND s.workspace_id = o.workspace_id
     AND s.division_id = 'Div6'
     AND s.department_id IS NOT DISTINCT FROM o.department_id
     AND s.metric_key = o.metric_key
     AND s.value = o.value
     AND s.recorded_at = o.old_recorded_at;
  IF n <> 48 THEN
    RAISE EXCEPTION 'guard 1: expected 48 active old rows (exact id, value, ISO recorded_at) in W27..W42, found %', n;
  END IF;
  -- Guard 1b: they are the only rows (active or not) in the 16 workspaces.
  SELECT count(*) INTO n FROM stats WHERE workspace_id IN (SELECT workspace_id FROM _gfp_w27_w42_old);
  IF n <> 48 THEN
    RAISE EXCEPTION 'guard 1b: expected 48 rows total in gfp-live-2026-W27..W42, found % (unlisted rows present)', n;
  END IF;
  -- Guard 1c: one row per (workspace, metric).
  SELECT count(DISTINCT (s.workspace_id, s.metric_key)) INTO n FROM stats s JOIN _gfp_w27_w42_old o ON o.id = s.id;
  IF n <> 48 THEN
    RAISE EXCEPTION 'guard 1c: expected 48 distinct workspace/metric pairs, found %', n;
  END IF;

  -- 1. Supersede the old rows (never delete).
  UPDATE stats SET superseded_at = now(), superseded_reason = reason
   WHERE id IN (SELECT id FROM _gfp_w27_w42_old) AND superseded_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 48 THEN
    RAISE EXCEPTION 'guard 2: supersede touched % rows, expected 48', n;
  END IF;

  -- 2. Insert the corrected rows: same value, recorded_at at the close (same shape as postGfpWeeklyStats).
  INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by)
  SELECT o.workspace_id, 'Div6', o.department_id, o.metric_key, o.value, w.rec::timestamptz,
         jsonb_build_object(
           'source', 'gfp-campaign_leads',
           'note', CASE WHEN o.metric_key = 'lead_magnets_shipped' THEN lead_note ELSE booking_note END,
           'year', 2026,
           'week', o.week,
           'window', jsonb_build_object('start', w.win_start, 'end', w.win_end),
           'correction', tag
         ) || CASE WHEN o.metric_key = 'lead_magnets_shipped' THEN '{}'::jsonb
                   ELSE jsonb_build_object('booked_without_booked_at', 0) END,
         'gfp-poster'
    FROM _gfp_w27_w42_old o JOIN _gfp_stat_weeks w ON w.week = o.week;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 48 THEN
    RAISE EXCEPTION 'guard 3: inserted % rows, expected 48', n;
  END IF;

  -- Guard 4: the old rows are still there (superseded, not deleted).
  SELECT count(*) INTO n FROM stats WHERE id IN (SELECT id FROM _gfp_w27_w42_old) AND superseded_reason = reason;
  IF n <> 48 THEN
    RAISE EXCEPTION 'guard 4: expected 48 superseded old rows, found %', n;
  END IF;

  -- Guard 5: exactly one active row per (workspace, metric), 48 pairs.
  SELECT count(*) INTO n FROM (
    SELECT workspace_id, metric_key FROM stats
     WHERE workspace_id IN (SELECT workspace_id FROM _gfp_w27_w42_old) AND superseded_at IS NULL
     GROUP BY 1, 2 HAVING count(*) = 1
  ) t;
  IF n <> 48 THEN
    RAISE EXCEPTION 'guard 5: expected 48 workspace/metric pairs with exactly one active row, found %', n;
  END IF;

  -- Guard 6: the active rows are the corrected ones: same value as the old row, at the close.
  SELECT count(*) INTO n FROM stats s
    JOIN _gfp_w27_w42_old o ON o.workspace_id = s.workspace_id AND o.metric_key = s.metric_key
    JOIN _gfp_stat_weeks w ON w.week = o.week
   WHERE s.superseded_at IS NULL AND s.basis->>'correction' = tag
     AND s.value = o.value AND s.recorded_at = w.rec::timestamptz
     AND s.department_id IS NOT DISTINCT FROM o.department_id;
  IF n <> 48 THEN
    RAISE EXCEPTION 'guard 6: expected 48 active corrected rows at the Thu 14:00 close with unchanged values, found %', n;
  END IF;
  SELECT count(*) INTO n FROM stats
   WHERE workspace_id IN (SELECT workspace_id FROM _gfp_w27_w42_old) AND superseded_at IS NULL;
  IF n <> 48 THEN
    RAISE EXCEPTION 'guard 6b: expected 48 active rows in W27..W42, found %', n;
  END IF;

  -- Guard 7 (acceptance): every active gfp-live-2026 row for W27..W44 sits at its own week's close,
  -- and no active gfp-live row's recorded_at falls inside a later week's window.
  SELECT count(*) INTO n FROM stats s JOIN _gfp_stat_weeks w
       ON s.workspace_id = 'gfp-live-2026-W' || lpad(w.week::text, 2, '0')
   WHERE s.superseded_at IS NULL AND s.recorded_at <> w.rec::timestamptz;
  IF n <> 0 THEN
    RAISE EXCEPTION 'guard 7: % active gfp-live W27..W44 rows not at their Thursday close', n;
  END IF;
  SELECT count(*) INTO n FROM stats s JOIN _gfp_stat_weeks w
       ON s.recorded_at >= w.win_start::timestamptz AND s.recorded_at < w.win_end::timestamptz
   WHERE s.superseded_at IS NULL
     AND s.workspace_id ~ '^gfp-live-2026-W[0-9]{2}$'
     AND w.week > substring(s.workspace_id from '([0-9]{2})$')::int;
  IF n <> 0 THEN
    RAISE EXCEPTION 'guard 7b: % active gfp-live rows have recorded_at inside a later week''s window', n;
  END IF;

  RAISE NOTICE 'gfp-live W27..W42 correction ok: 48 old rows superseded, 48 rows inserted at the Thu 14:00 Berlin close (values unchanged)';
END
$$;

COMMIT;

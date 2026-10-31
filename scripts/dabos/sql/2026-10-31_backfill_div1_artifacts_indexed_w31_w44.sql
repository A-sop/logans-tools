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
--   W44 basis also carries page_fingerprints (292), fingerprint_rule and git_end_commit
--   679c7de07be913bfd3f607bb9f250864370d11f5 in #50's final format (a20da8a), the W45 start point.
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
  dabos_main_at_close text NOT NULL,
  -- W44 only (#50 final spec, a20da8a): end-of-week page fingerprints and the close commit, the
  -- W45 start point. NULL otherwise.
  page_fingerprints jsonb,
  git_end_commit text
) ON COMMIT DROP;

INSERT INTO div1_backfill_w31_w44 VALUES
  (31, 'div-live-2026-W31',  0, '2026-07-30T11:59:59.999Z', '2026-07-23T12:00:00.000Z', '2026-07-30T12:00:00.000Z', 218, 218, '5bd5a00b', NULL, NULL),
  (32, 'div-live-2026-W32',  9, '2026-08-06T11:59:59.999Z', '2026-07-30T12:00:00.000Z', '2026-08-06T12:00:00.000Z', 218, 227, 'd2fb4bfb', NULL, NULL),
  (33, 'div-live-2026-W33',  0, '2026-08-13T11:59:59.999Z', '2026-08-06T12:00:00.000Z', '2026-08-13T12:00:00.000Z', 227, 227, '72baf3c7', NULL, NULL),
  (34, 'div-live-2026-W34',  2, '2026-08-20T11:59:59.999Z', '2026-08-13T12:00:00.000Z', '2026-08-20T12:00:00.000Z', 227, 229, 'f7cb1800', NULL, NULL),
  (35, 'div-live-2026-W35',  0, '2026-08-27T11:59:59.999Z', '2026-08-20T12:00:00.000Z', '2026-08-27T12:00:00.000Z', 229, 229, '000d2f2e', NULL, NULL),
  (36, 'div-live-2026-W36',  0, '2026-09-03T11:59:59.999Z', '2026-08-27T12:00:00.000Z', '2026-09-03T12:00:00.000Z', 229, 229, 'b92b8e64', NULL, NULL),
  (37, 'div-live-2026-W37',  0, '2026-09-10T11:59:59.999Z', '2026-09-03T12:00:00.000Z', '2026-09-10T12:00:00.000Z', 229, 229, 'a21c2dda', NULL, NULL),
  (38, 'div-live-2026-W38',  3, '2026-09-17T11:59:59.999Z', '2026-09-10T12:00:00.000Z', '2026-09-17T12:00:00.000Z', 229, 232, 'eef8b6e5', NULL, NULL),
  (39, 'div-live-2026-W39',  0, '2026-09-24T11:59:59.999Z', '2026-09-17T12:00:00.000Z', '2026-09-24T12:00:00.000Z', 232, 232, 'f85b987f', NULL, NULL),
  (40, 'div-live-2026-W40',  0, '2026-10-01T11:59:59.999Z', '2026-09-24T12:00:00.000Z', '2026-10-01T12:00:00.000Z', 232, 232, 'a49b6d10', NULL, NULL),
  (41, 'div-live-2026-W41',  0, '2026-10-08T11:59:59.999Z', '2026-10-01T12:00:00.000Z', '2026-10-08T12:00:00.000Z', 232, 232, '6dc58670', NULL, NULL),
  (42, 'div-live-2026-W42',  0, '2026-10-15T11:59:59.999Z', '2026-10-08T12:00:00.000Z', '2026-10-15T12:00:00.000Z', 232, 232, '7814e757', NULL, NULL),
  (43, 'div-live-2026-W43',  0, '2026-10-22T11:59:59.999Z', '2026-10-15T12:00:00.000Z', '2026-10-22T12:00:00.000Z', 232, 232, '368cfd9e', NULL, NULL),
  (44, 'div-live-2026-W44', 60, '2026-10-29T12:59:59.999Z', '2026-10-22T12:00:00.000Z', '2026-10-29T13:00:00.000Z', 232, 292, '37aff075',
   '[
    "0006b81567e02432", "0014015ebf9a8ca1", "0108832c50780998", "014a6841fae904be", "01737aaee926a474", "01a039640e762c62",
    "01b413a4fe0d9970", "05551775ea5919e6", "056d8fa9d4c26fe9", "07260adda6526f91", "08eb7bfb93b7d618", "0921e87a32dca891",
    "0a5e94aa5e497d43", "0bc4bee47cb0edfa", "0c5f56c34151d501", "0c84124021651dfc", "0d5867248bd34117", "0d8a0aad32312f72",
    "0e899090539bb421", "0e9329018da069c0", "0f93d6522796d472", "0f99167189c1c8df", "1067101fe288a540", "12b4f8be07f92c6e",
    "12cb59f12dda7689", "13b16573a6789dbe", "1499f41dd1e11c74", "15ef97b8bf3c9f79", "1601d6cdc785d5bf", "166f896ad3ab23c5",
    "19b259694e0d4941", "19e78306b1ac6bb2", "1af37c0be41f8a80", "1be9a6f9ff6ffb15", "1c1214df26468cd6", "1d27356d803c0462",
    "1d619d7a259b1b1c", "1df51204671b2312", "1e6728496e4996be", "1e94eae7a347647a", "1f0013a7618fe90f", "1fdb369765bc9ed9",
    "1ff9ba12195f972e", "2052728b63453a61", "22a67113fd9184d0", "23263b916c4bc024", "255e158df1a5458e", "2577a5c95ae627b3",
    "271243cf38f67f78", "272829a87ba2a348", "27ee573b548c4d81", "281ba9b973240d7b", "2831cbb70c98b59a", "285fbff7c2afd89f",
    "296628eeb00900a4", "29c135563bab346a", "29c6da53d726f233", "2d6e997fde3abcf2", "2fae5fcde4ba0d79", "2fee1f525316b998",
    "302c700b0a9a67fc", "30e0f5205d2b22da", "3169b069e7c6b0d9", "33c60bbdcb54391a", "33c75b0a6194e846", "34c94397f5368523",
    "3624c95f99c11f4f", "36773102d09e08d0", "37a467add2224ec4", "37ab0389e8664421", "381f55edaa94d557", "38b873fcd54bcc03",
    "38feddcdd7904210", "3abe090e36b233d3", "3b6b169c4e73d1b3", "3bf14fb646c2304c", "3c14c0c98eeba77c", "3d40ed9bc7f27113",
    "3d94f59402a3dbd4", "3da5c4c9b25bcde9", "3de2183c326c5391", "3f119754469ab952", "3f6a1af15b9c68ef", "3f8a2f2ba4924b02",
    "401a92d5021a30f6", "4066558be755d956", "4143e6415d677b85", "43340ab14e6a270d", "43e45f40ad37417d", "45605ad5436fa753",
    "457a68d46997a02a", "46412cd91f341b7c", "46e0459b2d092528", "4716f1fe07e3c88c", "47de1c3ce8f55f08", "47e499b9f9f1d29a",
    "4837349574cda25e", "48df8a73b9216a97", "49062a9eb4b48b87", "4b5d744b4461b909", "4d9a74e7996623cc", "4e340da07f87f501",
    "4e95a26ee0dc69b3", "51b376ff620fdbe6", "52285189482bf058", "53c2b28bc8b3a7be", "54324f39b0a5bbad", "546fb2d4c80ea445",
    "54f73353f3864591", "579f06cf8330a8f4", "57e952d452cccb34", "5813afe011e93ed7", "58e9680e1bbc53f7", "59d9f43befdf463b",
    "5a24346c775db04b", "5b20f69027b2af0f", "5c8a67a1cc92e171", "5cf12f79a300c55d", "5da8038d24b0a315", "606c3bd46c3b57f0",
    "60aaa3c94dab8d14", "62b276149a8b5602", "6303d049b5354dd5", "63956c143994d974", "64d1ab8a97d96d52", "6732d9e67c488104",
    "679d8c2ee9d2a86a", "681bd4ba5a019ed9", "68b2fddbc3e64f71", "693c4b5c067c8bc3", "6a5bfe2c4888c658", "6aa47fbb532707ef",
    "6b6316d912a98918", "6fa5dccb379a4d66", "706a4f4515b7bfb8", "70bad571d317a2c4", "7135685556899831", "7204c0a4f935b256",
    "7254529449e5d59c", "7422f4456da83d48", "74d0b30b72468a08", "7630eb93eb615bab", "76cbbd1e34c0607c", "77c6065dfa922358",
    "7932d6c79bb9db9f", "7af54eb7f32dd0b2", "7b42543cd6542b2f", "7c6a99ade8b7f75d", "7d208132a584ee31", "7deaec8c27c93a89",
    "7e25acc335ce0aa1", "7edbbf2a3b9089a3", "7f4c847ef16a42da", "8180f859a1db606e", "81daf7a7258b4eb6", "848b5d78754b86a1",
    "852da1e1101ef8c6", "857db3cce6645103", "86cc76a421bc6686", "8742742134cfecd5", "877c59dfc16ca31a", "87d22744584a9e0b",
    "87e6916dd417ea99", "889ae0de22bd123b", "89fa91a0b9acd4e7", "8a381e1d7f13c0cd", "8b5f7562cac08237", "8c1ee850184404e4",
    "8cd87e240efa7fd4", "8d09d85188534347", "8dcc84188c25cd5c", "8fb4401d8fef778c", "92f572eb9958be15", "9306145071863e15",
    "93623ca6cde6bf78", "957676f7a3d2c334", "96e6fe549ba1733b", "98a742a339fb1574", "99242623f49e74cd", "994137727e393bc9",
    "99520647108d8acd", "9acd261b2ba8a130", "9b689de760745e1c", "9c02b1e5b5402176", "9d5997cc33d371ee", "9db024a563fde809",
    "9e5f91134f0476a1", "9e6c32713e665b84", "9f3174dcabf4b8ee", "9f73e7ed68e7def2", "a14b064d4b01e751", "a27a219fe7da1a2c",
    "a32287cf2bde187f", "a4399ab15a65c77d", "a47c6df6344d1ab1", "a56e68cfa954e618", "a5c283dd098f3574", "a7ee882ebcc4d6b8",
    "a8ad00c783ebe548", "a9bb6b0c423b600e", "aa4649912a0789d2", "ab3f5abc2900546b", "accdcfe90ed78e50", "adaeea760732b9fa",
    "aff9dea33dcc2129", "b067e79b1c3e7a9f", "b41b451532714247", "b4ae53c6ba25d116", "b63cea60ed9d5476", "b6c2532cfdb551d1",
    "b7454ae57ee7c6e6", "b7877fbcb701df7f", "b84d5ce8db763dc1", "b8cdf4e90df6aa26", "b965381d454777a8", "b9b980a63f7333f1",
    "bb1a00cb9c531dca", "bc8ed3051ac6c3da", "bd8af4896d5a069b", "bf02e5147dafec55", "bf79ed98685e04e1", "c006e463bbdb64cb",
    "c2bd8c7c69045a29", "c348e23e846a5063", "c3665a67dc13f991", "c505c80ae8b4257d", "c681808dd592c025", "c71f8b19c633d7d6",
    "c8541d205038393f", "c9a7d4cabf9e5fe5", "caadbcffec903811", "cb59998855a90362", "cbd417a421922401", "cc970af76bcac57d",
    "ccebbcbc0380e699", "cd1d3c3e1b9e84f6", "cf0dec9006317839", "cf91a1fd05b4d8fa", "d0f4041713c6b114", "d2ed9c2fae60d65e",
    "d38e6b7ede406fb9", "d3d30064b1b086eb", "d40775ac59dc7ba5", "d4d662bc18110c49", "d5aeee6dddd794b0", "d68fd9af049d213a",
    "d89e47c297050dbe", "d8b9dcae80e4617e", "da48e3fa04a97b61", "da4f1df0f25a877f", "dac165fe07edc66e", "db7f9d66127126ee",
    "dc4a8e373ee9f3cd", "dc4f4dbd591ce19a", "dcfcda8a3afbc410", "dda41361d275eb82", "ddfb1e239382fbde", "de5e56104ac58dfb",
    "deab155f36f1b7da", "deb8bf4458dc6a66", "df4daddd645ef596", "df67b94560c2e879", "e025df623b95041b", "e100f633959b9dcc",
    "e1afd5ed35e6db11", "e1b04eb871b1d217", "e59ee7c86673aaef", "e86e15ead4eef00d", "e8fa2e4b763bc640", "e94d8316a677adcf",
    "e95ba991d7c006ba", "e9baad81e324dd1d", "ec393c66c194d17a", "ed54d3e4747077fa", "edc571915965dab3", "ee02033a2c89f676",
    "ee1ef4d50c3035e8", "f295204854686675", "f38381e1f93cfb6e", "f3dbe323a806d232", "f4b3791b63c71899", "f52e28bb16f63c2f",
    "f625f13f640bb5e6", "f67e1bbf4659522d", "f6971139ad07d96f", "f85fde4a2e2f3ff8", "f9064048b1557c56", "fa553eac74816d00",
    "fc19c68857edfebc", "fc2d4e897f200854", "fc7cd706466dbffd", "fd4c7da9e76d8ab5"
   ]'::jsonb,
   '679c7de07be913bfd3f607bb9f250864370d11f5');

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

  -- Guard 0c: only W44 carries fingerprints: 292 distinct 16-hex strings, sorted, one per page at the close.
  IF (SELECT count(*) FROM div1_backfill_w31_w44 WHERE page_fingerprints IS NOT NULL) <> 1
     OR (SELECT page_fingerprints IS NULL FROM div1_backfill_w31_w44 WHERE week = 44) THEN
    RAISE EXCEPTION 'guard 0c: page_fingerprints must be set on W44 only';
  END IF;
  SELECT count(*) INTO n FROM (
    SELECT DISTINCT e FROM div1_backfill_w31_w44 b, jsonb_array_elements_text(b.page_fingerprints) e
     WHERE b.week = 44 AND e ~ '^[0-9a-f]{16}$'
  ) t;
  IF n <> 292 OR n <> (SELECT jsonb_array_length(page_fingerprints) FROM div1_backfill_w31_w44 WHERE week = 44)
     OR n <> (SELECT unique_after FROM div1_backfill_w31_w44 WHERE week = 44) THEN
    RAISE EXCEPTION 'guard 0c: W44 page_fingerprints are not 292 distinct 16-hex fingerprints (= unique_after)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (
      SELECT e, o, lag(e) OVER (ORDER BY o) AS prev
        FROM div1_backfill_w31_w44 b, jsonb_array_elements_text(b.page_fingerprints) WITH ORDINALITY x(e, o)
       WHERE b.week = 44
    ) t WHERE prev IS NOT NULL AND prev COLLATE "C" >= e COLLATE "C"
  ) THEN
    RAISE EXCEPTION 'guard 0c: W44 page_fingerprints not sorted ascending';
  END IF;
  IF (SELECT count(*) FROM div1_backfill_w31_w44 WHERE git_end_commit IS NOT NULL) <> 1
     OR NOT EXISTS (SELECT 1 FROM div1_backfill_w31_w44 WHERE week = 44 AND git_end_commit ~ '^[0-9a-f]{40}$') THEN
    RAISE EXCEPTION 'guard 0c: git_end_commit must be a 40-hex sha on W44 only';
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
         ) || CASE WHEN b.page_fingerprints IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
           'page_fingerprints', b.page_fingerprints,
           'fingerprint_rule', 'sha256(utf8 normalised target), no salt, first 16 lowercase hex; unique, sorted; added = end - start',
           'git_end_commit', b.git_end_commit
         ) END,
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

  -- Guard 3c: the live W44 row carries exactly the W44 fingerprints (the W45 snapshot start).
  IF NOT EXISTS (
    SELECT 1 FROM stats s JOIN div1_backfill_w31_w44 b ON b.week = 44 AND s.workspace_id = b.ws
     WHERE s.division_id = 'Div1' AND s.department_id IS NULL AND s.metric_key = 'artifacts_indexed'
       AND s.superseded_at IS NULL AND s.basis->'page_fingerprints' = b.page_fingerprints
       AND s.basis->>'git_end_commit' = b.git_end_commit
       AND s.basis->>'fingerprint_rule' = 'sha256(utf8 normalised target), no salt, first 16 lowercase hex; unique, sorted; added = end - start'
  ) THEN
    RAISE EXCEPTION 'guard 3c: live W44 Div1 row does not carry the W44 page_fingerprints, rule and git_end_commit';
  END IF;

  RAISE NOTICE 'Div1 artifacts_indexed backfill ok: % row(s) inserted, 14 present (W31..W44), W30 untouched', inserted;
END
$$;

COMMIT;
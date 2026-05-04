-- pavilion-app/sql/SCORECARD_25apr_1xi.sql
-- HTCC 1st XI vs Rickmansworth CC — Saturday 25 April 2026
-- Result: HTCC Won (122-7 in 15 overs vs 97 all out in 28 overs)
-- Run in Supabase SQL Editor (service role)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── STEP 0: Verify fixture + players exist before inserting ──────────────────
-- Run this SELECT block first to confirm all IDs resolve correctly.
-- Any NULLs = name mismatch in profiles → fix the name below before proceeding.

SELECT
  'fixture'        AS type,
  id::text         AS id,
  match_date::text AS label
FROM fixtures
WHERE match_date = '2026-04-25'
  AND team_id = (SELECT id FROM teams WHERE name = '1st XI' LIMIT 1)

UNION ALL

SELECT 'player', id::text, full_name
FROM profiles
WHERE LOWER(full_name) IN (
  'jenson singarajah','akhilesh ramesh','harpreet singh','kishan patel',
  'shenal daniel','prayash singh','jay patel','akash menon',
  'aravinth nagarajan','pratham shah','naveen sarma','rushil shah'
)
ORDER BY type, label;


-- ── STEP 1: Declare reusable IDs via CTE ─────────────────────────────────────
-- Paste and run everything from here down once STEP 0 confirms all rows found.

WITH
  fix AS (
    SELECT id FROM fixtures
    WHERE  match_date = '2026-04-25'
      AND  team_id = (SELECT id FROM teams WHERE name = '1st XI' LIMIT 1)
    LIMIT 1
  ),
  p_jenson    AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%jenson singarajah%'   LIMIT 1),
  p_akhilesh  AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%akhilesh ramesh%'     LIMIT 1),
  p_harpreet  AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%harpreet singh%'      LIMIT 1),
  p_kishan    AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%kishan patel%'        LIMIT 1),
  p_shenal    AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%shenal daniel%'       LIMIT 1),
  p_prayash   AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%prayash singh%'       LIMIT 1),
  p_jay       AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%jay patel%'           LIMIT 1),
  p_akash     AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%akash menon%'         LIMIT 1),
  p_aravinth  AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%aravinth nagarajan%'  LIMIT 1),
  p_pratham   AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%pratham shah%'        LIMIT 1),
  p_naveen    AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%naveen sarma%'        LIMIT 1),
  p_rushil    AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%rushil shah%'         LIMIT 1)

-- ── STEP 2: Match result ──────────────────────────────────────────────────────
INSERT INTO match_results (fixture_id, winner, submitted_at)
SELECT (SELECT id FROM fix), 'htcc', NOW()
ON CONFLICT (fixture_id) DO UPDATE SET winner = 'htcc', submitted_at = NOW();


-- ── STEP 3: HTCC Batting ──────────────────────────────────────────────────────
-- position, runs, balls, fours, sixes, not_out
WITH
  fix        AS (SELECT id FROM fixtures WHERE match_date='2026-04-25' AND team_id=(SELECT id FROM teams WHERE name='1st XI' LIMIT 1) LIMIT 1),
  p_jenson   AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%jenson singarajah%'  LIMIT 1),
  p_akhilesh AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%akhilesh ramesh%'    LIMIT 1),
  p_harpreet AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%harpreet singh%'     LIMIT 1),
  p_kishan   AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%kishan patel%'       LIMIT 1),
  p_shenal   AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%shenal daniel%'      LIMIT 1),
  p_prayash  AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%prayash singh%'      LIMIT 1),
  p_jay      AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%jay patel%'          LIMIT 1),
  p_akash    AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%akash menon%'        LIMIT 1),
  p_aravinth AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%aravinth nagarajan%' LIMIT 1)
INSERT INTO match_batting (fixture_id, player_id, position, runs, balls, fours, sixes, not_out)
VALUES
  ((SELECT id FROM fix),(SELECT id FROM p_jenson),   1,  2,  3, 0, 0, false),
  ((SELECT id FROM fix),(SELECT id FROM p_akhilesh),  2,  6, 10, 1, 0, false),
  ((SELECT id FROM fix),(SELECT id FROM p_harpreet),  3,  0,  3, 0, 0, false),
  ((SELECT id FROM fix),(SELECT id FROM p_kishan),    4, 20, 15, 2, 1, false),
  ((SELECT id FROM fix),(SELECT id FROM p_shenal),    5,  4,  6, 1, 0, false),
  ((SELECT id FROM fix),(SELECT id FROM p_prayash),   6, 48, 31, 5, 3, true),
  ((SELECT id FROM fix),(SELECT id FROM p_jay),       7,  7, 10, 1, 0, false),
  ((SELECT id FROM fix),(SELECT id FROM p_akash),     8,  7, 12, 0, 1, false),
  ((SELECT id FROM fix),(SELECT id FROM p_aravinth),  9,  8,  6, 0, 2, true)
ON CONFLICT (fixture_id, player_id) DO UPDATE SET
  runs = EXCLUDED.runs, balls = EXCLUDED.balls,
  fours = EXCLUDED.fours, sixes = EXCLUDED.sixes, not_out = EXCLUDED.not_out;


-- ── STEP 4: HTCC Bowling ──────────────────────────────────────────────────────
-- overs, maidens, runs, wickets, no_balls, wides
WITH
  fix        AS (SELECT id FROM fixtures WHERE match_date='2026-04-25' AND team_id=(SELECT id FROM teams WHERE name='1st XI' LIMIT 1) LIMIT 1),
  p_akash    AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%akash menon%'        LIMIT 1),
  p_prayash  AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%prayash singh%'      LIMIT 1),
  p_naveen   AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%naveen sarma%'       LIMIT 1),
  p_pratham  AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%pratham shah%'       LIMIT 1),
  p_rushil   AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%rushil shah%'        LIMIT 1),
  p_aravinth AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%aravinth nagarajan%' LIMIT 1)
INSERT INTO match_bowling (fixture_id, player_id, overs, maidens, runs, wickets, no_balls, wides)
VALUES
  ((SELECT id FROM fix),(SELECT id FROM p_akash),    5.0, 2, 13, 0, 0, 0),
  ((SELECT id FROM fix),(SELECT id FROM p_prayash),  4.0, 0, 22, 1, 0, 0),
  ((SELECT id FROM fix),(SELECT id FROM p_naveen),   4.0, 0, 15, 2, 0, 0),
  ((SELECT id FROM fix),(SELECT id FROM p_pratham),  6.0, 2, 25, 3, 0, 0),
  ((SELECT id FROM fix),(SELECT id FROM p_rushil),   7.0, 2, 10, 2, 0, 0),
  ((SELECT id FROM fix),(SELECT id FROM p_aravinth), 2.0, 0,  9, 2, 0, 0)
ON CONFLICT (fixture_id, player_id) DO UPDATE SET
  overs=EXCLUDED.overs, maidens=EXCLUDED.maidens, runs=EXCLUDED.runs,
  wickets=EXCLUDED.wickets, no_balls=EXCLUDED.no_balls, wides=EXCLUDED.wides;


-- ── STEP 5: Fielding ──────────────────────────────────────────────────────────
-- Catches: Jay Patel (2), Aravinth Nagarajan (1), Pratham Shah (ct&b 1),
--          Prayash Singh (ct&b 1), Akash Menon (1)
-- Stumpings: Akhilesh Ramesh (1)
WITH
  fix        AS (SELECT id FROM fixtures WHERE match_date='2026-04-25' AND team_id=(SELECT id FROM teams WHERE name='1st XI' LIMIT 1) LIMIT 1),
  p_jay      AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%jay patel%'          LIMIT 1),
  p_aravinth AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%aravinth nagarajan%' LIMIT 1),
  p_pratham  AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%pratham shah%'       LIMIT 1),
  p_prayash  AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%prayash singh%'      LIMIT 1),
  p_akash    AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%akash menon%'        LIMIT 1),
  p_akhilesh AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%akhilesh ramesh%'    LIMIT 1)
INSERT INTO match_fielding (fixture_id, player_id, catches, stumpings)
VALUES
  ((SELECT id FROM fix),(SELECT id FROM p_jay),      2, 0),
  ((SELECT id FROM fix),(SELECT id FROM p_aravinth), 1, 0),
  ((SELECT id FROM fix),(SELECT id FROM p_pratham),  1, 0),
  ((SELECT id FROM fix),(SELECT id FROM p_prayash),  1, 0),
  ((SELECT id FROM fix),(SELECT id FROM p_akash),    1, 0),
  ((SELECT id FROM fix),(SELECT id FROM p_akhilesh), 0, 1)
ON CONFLICT (fixture_id, player_id) DO UPDATE SET
  catches=EXCLUDED.catches, stumpings=EXCLUDED.stumpings;


-- ── STEP 6: POTM ─────────────────────────────────────────────────────────────
-- Prayash Singh wins: bat(48*,5f,3s)+bowl(1wkt)+field(1c) = 120 pts
-- Full breakdown:
--   Bat : 48+10(5f×2)+12(3s×4)+10(25+milestone)+5(not out ≥30) = 85
--   Bowl: 25(1wkt) = 25
--   Field: 10(1 catch) = 10
--   Total: 120
WITH
  fix       AS (SELECT id FROM fixtures WHERE match_date='2026-04-25' AND team_id=(SELECT id FROM teams WHERE name='1st XI' LIMIT 1) LIMIT 1),
  p_prayash AS (SELECT id FROM profiles WHERE LOWER(full_name) LIKE '%prayash singh%' LIMIT 1)
INSERT INTO match_potm (fixture_id, player_id, points, calculated_at)
SELECT (SELECT id FROM fix), (SELECT id FROM p_prayash), 120.00, NOW()
ON CONFLICT (fixture_id) DO UPDATE SET
  player_id = EXCLUDED.player_id,
  points = EXCLUDED.points,
  calculated_at = NOW();


-- ── STEP 7: Final verify ─────────────────────────────────────────────────────
SELECT 'result' AS tbl, COUNT(*) FROM match_results  WHERE fixture_id=(SELECT id FROM fixtures WHERE match_date='2026-04-25' AND team_id=(SELECT id FROM teams WHERE name='1st XI' LIMIT 1) LIMIT 1)
UNION ALL
SELECT 'batting', COUNT(*) FROM match_batting  WHERE fixture_id=(SELECT id FROM fixtures WHERE match_date='2026-04-25' AND team_id=(SELECT id FROM teams WHERE name='1st XI' LIMIT 1) LIMIT 1)
UNION ALL
SELECT 'bowling', COUNT(*) FROM match_bowling  WHERE fixture_id=(SELECT id FROM fixtures WHERE match_date='2026-04-25' AND team_id=(SELECT id FROM teams WHERE name='1st XI' LIMIT 1) LIMIT 1)
UNION ALL
SELECT 'fielding',COUNT(*) FROM match_fielding WHERE fixture_id=(SELECT id FROM fixtures WHERE match_date='2026-04-25' AND team_id=(SELECT id FROM teams WHERE name='1st XI' LIMIT 1) LIMIT 1)
UNION ALL
SELECT 'potm',    COUNT(*) FROM match_potm     WHERE fixture_id=(SELECT id FROM fixtures WHERE match_date='2026-04-25' AND team_id=(SELECT id FROM teams WHERE name='1st XI' LIMIT 1) LIMIT 1);

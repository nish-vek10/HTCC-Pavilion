-- pavilion-app/sql/TEST_3_scores.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — Run AFTER you have picked your XI on Expo Go
-- Inserts match results + batting/bowling/fielding for all 15 test players
-- App will auto-calculate fantasy points when you reopen the Fantasy screen
--
-- Expected fantasy points per player (before C/VC multipliers):
--   P01  James Anderson   1st XI  bat:67r,2f,1s + field:1c    → 115 pts
--   P02  Ben Stokes       1st XI  bat:50r,4f    + bowl:2wkt    → 142 pts
--   P03  Joe Root         1st XI  bat:18r,1f    + bowl:3wkt    → 105 pts
--   P04  Jonny Bairstow   1st XI  bat:0r(duck)  + field:1st    →   5 pts
--   P05  Stuart Broad     2nd XI  bat:8r        + bowl:3wkt    → 103 pts
--   P06  Chris Woakes     2nd XI  bat:55r,4f,2s + bowl:2wkt    → 150 pts
--   P07  Mark Wood        2nd XI  bat:3r        + field:2c     →  23 pts
--   P08  Jos Buttler      2nd XI  bat:88r,6f,3s + field:1c     → 152 pts
--   P09  Harry Brook      3rd XI  bat:45r,3f,1s + bowl:1wkt    →  85 pts
--   P10  Zak Crawley      3rd XI  bat:34r,2f,1s(not out) +f:1c →  67 pts
--   P11  Ollie Pope       3rd XI  bat:22r,1f    + bowl:0wkt    →  19 pts
--   P12  Liam Livingstone 3rd XI  bat:0r(no ball) + bowl:4wkt  → 115 pts
--   P13  Moeen Ali        4th XI  bat:31r(not out)+bowl:5wkt   → 214 pts ★
--   P14  Jack Leach       4th XI  bat:1r        + bowl:2wkt    →  61 pts
--   P15  Sam Curran       4th XI  bat:15r,1f    + field:1c     →  27 pts
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Match results — triggers scorecardIn=true on frontend ─────────────────
INSERT INTO match_results (fixture_id, winner, submitted_at)
VALUES
  ('ffffffff-ffff-ffff-ffff-000000000001', 'htcc',     NOW()),
  ('ffffffff-ffff-ffff-ffff-000000000002', 'htcc',     NOW()),
  ('ffffffff-ffff-ffff-ffff-000000000003', 'opponent', NOW()),
  ('ffffffff-ffff-ffff-ffff-000000000004', 'htcc',     NOW())
ON CONFLICT (fixture_id) DO NOTHING;

-- ── 2. Batting ────────────────────────────────────────────────────────────────
-- Cols: fixture_id, player_id, position, runs, balls, fours, sixes, not_out
INSERT INTO match_batting (fixture_id, player_id, position, runs, balls, fours, sixes, not_out)
VALUES
  -- 1st XI
  ('ffffffff-ffff-ffff-ffff-000000000001','cccccccc-cccc-cccc-cccc-000000000001',1,67,45,2,1,false),
  ('ffffffff-ffff-ffff-ffff-000000000001','cccccccc-cccc-cccc-cccc-000000000002',2,50,55,4,0,false),
  ('ffffffff-ffff-ffff-ffff-000000000001','cccccccc-cccc-cccc-cccc-000000000003',3,18,22,1,0,false),
  ('ffffffff-ffff-ffff-ffff-000000000001','cccccccc-cccc-cccc-cccc-000000000004',4, 0, 4,0,0,false),
  -- 2nd XI
  ('ffffffff-ffff-ffff-ffff-000000000002','cccccccc-cccc-cccc-cccc-000000000005',1, 8,12,0,0,false),
  ('ffffffff-ffff-ffff-ffff-000000000002','cccccccc-cccc-cccc-cccc-000000000006',2,55,50,4,2,false),
  ('ffffffff-ffff-ffff-ffff-000000000002','cccccccc-cccc-cccc-cccc-000000000007',3, 3, 5,0,0,false),
  ('ffffffff-ffff-ffff-ffff-000000000002','cccccccc-cccc-cccc-cccc-000000000008',4,88,65,6,3,false),
  -- 3rd XI
  ('ffffffff-ffff-ffff-ffff-000000000003','cccccccc-cccc-cccc-cccc-000000000009',1,45,40,3,1,false),
  ('ffffffff-ffff-ffff-ffff-000000000003','cccccccc-cccc-cccc-cccc-000000000010',2,34,30,2,1,true),
  ('ffffffff-ffff-ffff-ffff-000000000003','cccccccc-cccc-cccc-cccc-000000000011',3,22,25,1,0,false),
  ('ffffffff-ffff-ffff-ffff-000000000003','cccccccc-cccc-cccc-cccc-000000000012',4, 0, 0,0,0,false),
  -- 4th XI
  ('ffffffff-ffff-ffff-ffff-000000000004','cccccccc-cccc-cccc-cccc-000000000013',1,31,28,2,0,true),
  ('ffffffff-ffff-ffff-ffff-000000000004','cccccccc-cccc-cccc-cccc-000000000014',2, 1, 3,0,0,false),
  ('ffffffff-ffff-ffff-ffff-000000000004','cccccccc-cccc-cccc-cccc-000000000015',3,15,18,1,0,false)
ON CONFLICT (fixture_id, player_id) DO NOTHING;

-- ── 3. Bowling ────────────────────────────────────────────────────────────────
-- Cols: fixture_id, player_id, overs, maidens, runs, wickets, no_balls, wides
INSERT INTO match_bowling (fixture_id, player_id, overs, maidens, runs, wickets, no_balls, wides)
VALUES
  -- 1st XI
  ('ffffffff-ffff-ffff-ffff-000000000001','cccccccc-cccc-cccc-cccc-000000000002',7.0,1,40,2,0,1),
  ('ffffffff-ffff-ffff-ffff-000000000001','cccccccc-cccc-cccc-cccc-000000000003',4.0,0,20,3,0,0),
  -- 2nd XI
  ('ffffffff-ffff-ffff-ffff-000000000002','cccccccc-cccc-cccc-cccc-000000000005',6.0,2,22,3,0,0),
  ('ffffffff-ffff-ffff-ffff-000000000002','cccccccc-cccc-cccc-cccc-000000000006',3.0,0,18,2,0,1),
  -- 3rd XI
  ('ffffffff-ffff-ffff-ffff-000000000003','cccccccc-cccc-cccc-cccc-000000000009',3.0,0,24,1,0,2),
  ('ffffffff-ffff-ffff-ffff-000000000003','cccccccc-cccc-cccc-cccc-000000000011',2.0,0,16,0,1,0),
  ('ffffffff-ffff-ffff-ffff-000000000003','cccccccc-cccc-cccc-cccc-000000000012',5.0,1,20,4,0,0),
  -- 4th XI
  ('ffffffff-ffff-ffff-ffff-000000000004','cccccccc-cccc-cccc-cccc-000000000013',8.0,1,40,5,0,1),
  ('ffffffff-ffff-ffff-ffff-000000000004','cccccccc-cccc-cccc-cccc-000000000014',6.0,2,28,2,0,0)
ON CONFLICT (fixture_id, player_id) DO NOTHING;

-- ── 4. Fielding ───────────────────────────────────────────────────────────────
-- Cols: fixture_id, player_id, catches, stumpings
INSERT INTO match_fielding (fixture_id, player_id, catches, stumpings)
VALUES
  -- 1st XI
  ('ffffffff-ffff-ffff-ffff-000000000001','cccccccc-cccc-cccc-cccc-000000000001',1,0),
  ('ffffffff-ffff-ffff-ffff-000000000001','cccccccc-cccc-cccc-cccc-000000000004',0,1),
  -- 2nd XI
  ('ffffffff-ffff-ffff-ffff-000000000002','cccccccc-cccc-cccc-cccc-000000000007',2,0),
  ('ffffffff-ffff-ffff-ffff-000000000002','cccccccc-cccc-cccc-cccc-000000000008',1,0),
  -- 3rd XI
  ('ffffffff-ffff-ffff-ffff-000000000003','cccccccc-cccc-cccc-cccc-000000000010',1,0),
  -- 4th XI
  ('ffffffff-ffff-ffff-ffff-000000000004','cccccccc-cccc-cccc-cccc-000000000015',1,0)
ON CONFLICT (fixture_id, player_id) DO NOTHING;

-- ── Verify inserted ───────────────────────────────────────────────────────────
SELECT
  p.full_name,
  b.runs, b.fours, b.sixes, b.not_out,
  bw.wickets, bw.overs, bw.maidens,
  f.catches, f.stumpings
FROM   profiles p
LEFT   JOIN match_batting  b  ON b.player_id  = p.id AND b.fixture_id  LIKE 'ffffffff%'
LEFT   JOIN match_bowling  bw ON bw.player_id = p.id AND bw.fixture_id LIKE 'ffffffff%'
LEFT   JOIN match_fielding f  ON f.player_id  = p.id AND f.fixture_id  LIKE 'ffffffff%'
WHERE  p.id LIKE 'cccccccc%'
ORDER  BY p.full_name;

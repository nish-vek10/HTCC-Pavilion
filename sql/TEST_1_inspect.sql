-- pavilion-app/sql/TEST_1_inspect.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Run this FIRST in Supabase SQL Editor
-- Checks current DB state before seeding any test data
-- ─────────────────────────────────────────────────────────────────────────────

-- All HTCC teams
SELECT id, name FROM teams ORDER BY name;

-- Existing fixtures around May 9 2026
SELECT id, match_date, match_type, team_id, opponent, home_away
FROM   fixtures
WHERE  match_date BETWEEN '2026-04-25' AND '2026-05-20'
ORDER  BY match_date;

-- member_full_name column exists on fantasy_teams?
SELECT column_name
FROM   information_schema.columns
WHERE  table_name = 'fantasy_teams'
  AND  column_name = 'member_full_name';

-- All Stars XI — confirm Nish's team exists
SELECT id, team_name, member_id, member_full_name
FROM   fantasy_teams
WHERE  team_name = 'All Stars XI';

-- Current member count (non-pending)
SELECT COUNT(*) AS member_count
FROM   profiles
WHERE  role != 'pending';

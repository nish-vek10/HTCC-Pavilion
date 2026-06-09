-- pavilion-app/sql/013_beanie_xi_matchday3_patch.sql
-- Patch: Anish Vekaria "Beanie XI" — matchday 3
--
-- Changes:
--   1. Replace Shaktisinh Zala   → Chandraprasad Arumugam
--   2. Remove captain Prayash Singh → set Chandraprasad as captain
--   3. Remove VC from previous holder → set Anish Vekaria as VC
--
-- IDs:
--   team_id          : b60b1aa5-a249-4ae8-97f3-f6245ced64a7  (Beanie XI)
--   Shaktisinh Zala  : bcb8bf6f-c400-4dc1-b326-72bec75f4741
--   Chandraprasad    : d90840c1-dff9-4839-8ba0-1a83c46211a6
--   Prayash Singh    : c1ace176-9009-4406-ae76-4d68c1ec0d7c
--   Anish Vekaria    : fa17410f-5228-4f75-8217-4cf4caaa6329
--   (fixture_id for Chandraprasad resolved from matchday 3 scorecard)
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Replace Shaktisinh with Chandraprasad
-- Chandraprasad inherits the same fixture_id Shaktisinh had (4th XI fixture)
UPDATE fantasy_picks
SET player_id = 'd90840c1-dff9-4839-8ba0-1a83c46211a6'
WHERE team_id  = 'b60b1aa5-a249-4ae8-97f3-f6245ced64a7'
  AND matchday = 3
  AND player_id = 'bcb8bf6f-c400-4dc1-b326-72bec75f4741';

-- Step 2: Clear captain from Prayash Singh
UPDATE fantasy_picks
SET is_captain = false
WHERE team_id  = 'b60b1aa5-a249-4ae8-97f3-f6245ced64a7'
  AND matchday = 3
  AND player_id = 'c1ace176-9009-4406-ae76-4d68c1ec0d7c';

-- Step 3: Set Chandraprasad as captain
UPDATE fantasy_picks
SET is_captain = true
WHERE team_id  = 'b60b1aa5-a249-4ae8-97f3-f6245ced64a7'
  AND matchday = 3
  AND player_id = 'd90840c1-dff9-4839-8ba0-1a83c46211a6';

-- Step 4: Clear VC from all picks in this team/matchday (safety)
UPDATE fantasy_picks
SET is_vc = false
WHERE team_id  = 'b60b1aa5-a249-4ae8-97f3-f6245ced64a7'
  AND matchday = 3;

-- Step 5: Set Anish Vekaria as VC
UPDATE fantasy_picks
SET is_vc = true
WHERE team_id  = 'b60b1aa5-a249-4ae8-97f3-f6245ced64a7'
  AND matchday = 3
  AND player_id = 'fa17410f-5228-4f75-8217-4cf4caaa6329';

-- ── Verify final picks ─────────────────────────────────────────────────────────
SELECT
  pr.full_name,
  fp.fixture_id,
  fp.is_captain AS cap,
  fp.is_vc      AS vc
FROM  fantasy_picks fp
JOIN  profiles pr ON pr.id = fp.player_id
WHERE fp.team_id  = 'b60b1aa5-a249-4ae8-97f3-f6245ced64a7'
  AND fp.matchday = 3
ORDER BY fp.is_captain DESC, fp.is_vc DESC, pr.full_name;

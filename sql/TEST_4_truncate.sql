-- pavilion-app/sql/TEST_4_truncate.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4 — Cleanup: remove ALL test data after testing is done
-- Targets only records with test UUIDs (cccccccc / ffffffff / dddddddd prefix)
-- Does NOT touch real member data
-- ─────────────────────────────────────────────────────────────────────────────

-- Fantasy scores for test teams (cascades from fantasy_picks if needed)
DELETE FROM fantasy_scores
WHERE  team_id IN (
  SELECT id FROM fantasy_teams
  WHERE  member_id LIKE 'cccccccc%'
);

-- Fantasy picks for test players
DELETE FROM fantasy_picks
WHERE  player_id LIKE 'cccccccc%';

-- Scorecard data
DELETE FROM match_fielding WHERE fixture_id LIKE 'ffffffff%';
DELETE FROM match_bowling  WHERE fixture_id LIKE 'ffffffff%';
DELETE FROM match_batting  WHERE fixture_id LIKE 'ffffffff%';
DELETE FROM match_results  WHERE fixture_id LIKE 'ffffffff%';

-- Squad members + squads
DELETE FROM squad_members WHERE squad_id  LIKE 'dddddddd%';
DELETE FROM squads        WHERE id        LIKE 'dddddddd%';

-- Fixtures
DELETE FROM fixtures WHERE id LIKE 'ffffffff%';

-- Profiles (must go before auth.users due to FK)
DELETE FROM profiles WHERE id LIKE 'cccccccc%';

-- Auth users
DELETE FROM auth.users WHERE id::text LIKE 'cccccccc%';

-- ── Optional: also wipe Nish's own fantasy picks + team (uncomment to use) ────
-- DELETE FROM fantasy_scores WHERE team_id = (SELECT id FROM fantasy_teams WHERE team_name = 'All Stars XI');
-- DELETE FROM fantasy_picks  WHERE team_id = (SELECT id FROM fantasy_teams WHERE team_name = 'All Stars XI');
-- DELETE FROM fantasy_teams  WHERE team_name = 'All Stars XI';

-- ── Verify clean ──────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM auth.users    WHERE id::text LIKE 'cccccccc%') AS auth_users_remaining,
  (SELECT COUNT(*) FROM profiles      WHERE id::text LIKE 'cccccccc%') AS profiles_remaining,
  (SELECT COUNT(*) FROM fixtures      WHERE id::text LIKE 'ffffffff%') AS fixtures_remaining,
  (SELECT COUNT(*) FROM squads        WHERE id::text LIKE 'dddddddd%') AS squads_remaining,
  (SELECT COUNT(*) FROM match_batting WHERE fixture_id::text LIKE 'ffffffff%') AS batting_remaining;

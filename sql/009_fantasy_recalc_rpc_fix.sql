-- pavilion-app/sql/009_fantasy_recalc_rpc_fix.sql
-- FIX: recalculate_fantasy_scores_for_fixture
-- Bug: old RPC filtered by p_fixture_id AND overwrote stored total.
--      Multi-fixture matchdays (e.g. matchday 2 = 4 fixtures) lost all but
--      the last submitted fixture's points.
-- Fix: recalculate ALL picks in the same matchday (each pick joins its own
--      fixture's scorecard), so result is idempotent on re-submit too.
-- Run in Supabase SQL Editor — safe to re-run (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION recalculate_fantasy_scores_for_fixture(p_fixture_id uuid)
RETURNS int    -- number of fantasy_scores rows upserted
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH

  -- ── Step 1: find the matchday tied to this fixture ─────────────────────────
  target_matchday AS (
    SELECT matchday
    FROM   fantasy_picks
    WHERE  fixture_id = p_fixture_id
    LIMIT  1
  ),

  -- ── Step 2: all picks in that matchday (every fixture) ────────────────────
  -- Each pick references its own fixture via fp.fixture_id
  pick_points AS (
    SELECT
      fp.team_id,
      fp.matchday,
      fp.is_captain,
      fp.is_vc,

      -- ── Batting ─────────────────────────────────────────────────────────────
      COALESCE(mb.runs,  0) * 1 +
      COALESCE(mb.fours, 0) * 2 +
      COALESCE(mb.sixes, 0) * 4 +
      CASE WHEN mb.not_out AND COALESCE(mb.runs, 0) >= 30 THEN 5 ELSE 0 END +
      CASE
        WHEN COALESCE(mb.runs, 0) >= 100 THEN 70
        WHEN COALESCE(mb.runs, 0) >= 50  THEN 30
        WHEN COALESCE(mb.runs, 0) >= 25  THEN 10
        ELSE 0
      END +
      CASE
        WHEN COALESCE(mb.runs, 0) = 0
         AND NOT COALESCE(mb.not_out, false)
         AND (COALESCE(mb.balls, 0) > 0 OR COALESCE(mb.run_out, false))
        THEN -5 ELSE 0
      END +
      CASE
        WHEN COALESCE(mb.run_out, false)
         AND NOT COALESCE(mb.not_out, false)
        THEN -8 ELSE 0
      END +

      -- ── Bowling ─────────────────────────────────────────────────────────────
      COALESCE(mbo.wickets,  0) * 25 +
      COALESCE(mbo.maidens,  0) *  5 +
      COALESCE(mbo.wides,    0) * -1 +
      COALESCE(mbo.no_balls, 0) * -2 +
      CASE
        WHEN COALESCE(mbo.wickets, 0) >= 5 THEN 35
        WHEN COALESCE(mbo.wickets, 0) >= 3 THEN 10
        ELSE 0
      END +
      CASE WHEN COALESCE(mbo.overs, 0) > 0 THEN
        CASE
          WHEN COALESCE(mbo.runs, 0)::numeric
               / NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs - FLOOR(mbo.overs))*10)) / 6.0, 0)
               >= 10 THEN -8
          WHEN COALESCE(mbo.runs, 0)::numeric
               / NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs - FLOOR(mbo.overs))*10)) / 6.0, 0)
               >= 9  THEN -5
          WHEN COALESCE(mbo.runs, 0)::numeric
               / NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs - FLOOR(mbo.overs))*10)) / 6.0, 0)
               >= 8  THEN -3
          WHEN COALESCE(mbo.runs, 0)::numeric
               / NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs - FLOOR(mbo.overs))*10)) / 6.0, 0)
               >= 7  THEN -2
          ELSE 0
        END
      ELSE 0 END +

      -- ── Fielding ────────────────────────────────────────────────────────────
      COALESCE(mf.catches,   0) * 10 +
      COALESCE(mf.stumpings, 0) * 10

      AS raw_pts

    FROM   fantasy_picks  fp
    -- ── Each pick joins its OWN fixture's scorecard ──────────────────────────
    LEFT JOIN match_batting  mb  ON mb.fixture_id  = fp.fixture_id AND mb.player_id  = fp.player_id
    LEFT JOIN match_bowling  mbo ON mbo.fixture_id = fp.fixture_id AND mbo.player_id = fp.player_id
    LEFT JOIN match_fielding mf  ON mf.fixture_id  = fp.fixture_id AND mf.player_id  = fp.player_id
    -- ── Only picks in the same matchday as the submitted fixture ─────────────
    WHERE fp.matchday = (SELECT matchday FROM target_matchday)
  ),

  -- ── Step 3: apply captain (×3) / VC (×2) multipliers ─────────────────────
  multiplied AS (
    SELECT
      team_id,
      matchday,
      CASE
        WHEN is_captain THEN raw_pts * 3
        WHEN is_vc      THEN raw_pts * 2
        ELSE                 raw_pts
      END AS final_pts
    FROM pick_points
  ),

  -- ── Step 4: sum all picks per team ────────────────────────────────────────
  team_totals AS (
    SELECT team_id, matchday, SUM(final_pts) AS total_points
    FROM   multiplied
    GROUP  BY team_id, matchday
  ),

  -- ── Step 5: upsert — always replace with full recalculated total ──────────
  upserted AS (
    INSERT INTO fantasy_scores (team_id, matchday, total_points, calculated_at)
    SELECT team_id, matchday, total_points, now()
    FROM   team_totals
    ON CONFLICT (team_id, matchday) DO UPDATE
      SET total_points  = EXCLUDED.total_points,
          calculated_at = now()
    RETURNING team_id
  )

  SELECT COUNT(*)::int FROM upserted;
$$;

GRANT EXECUTE ON FUNCTION recalculate_fantasy_scores_for_fixture(uuid) TO authenticated;

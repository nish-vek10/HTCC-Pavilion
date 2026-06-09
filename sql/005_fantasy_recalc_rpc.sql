-- pavilion-app/sql/005_fantasy_recalc_rpc.sql
-- RPC: recalculate_fantasy_scores_for_fixture(p_fixture_id)
-- SECURITY DEFINER — bypasses RLS so admin scorecard submit can update all members' fantasy scores.
-- Run once in Supabase SQL editor (safe to re-run — CREATE OR REPLACE).
-- Called by MatchScorecardScreen.handleSubmit after successful scorecard save.
-- Formula mirrors fantasyPoints.js exactly — keep both in sync if points change.

CREATE OR REPLACE FUNCTION recalculate_fantasy_scores_for_fixture(p_fixture_id uuid)
RETURNS int    -- number of fantasy_scores rows upserted
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pick_points AS (
    -- ── Raw points per pick (player × matchday × team) ───────────────────────
    SELECT
      fp.team_id,
      fp.matchday,
      fp.is_captain,
      fp.is_vc,
      -- ── Batting ────────────────────────────────────────────────────────────
      COALESCE(mb.runs,  0) * 1 +
      COALESCE(mb.fours, 0) * 2 +
      COALESCE(mb.sixes, 0) * 4 +
      -- Not-out bonus (≥30 runs required)
      CASE WHEN mb.not_out AND COALESCE(mb.runs, 0) >= 30 THEN 5 ELSE 0 END +
      -- Run milestones (stack: 100→70pts total bonus, 50→30, 25→10)
      CASE
        WHEN COALESCE(mb.runs, 0) >= 100 THEN 70
        WHEN COALESCE(mb.runs, 0) >= 50  THEN 30
        WHEN COALESCE(mb.runs, 0) >= 25  THEN 10
        ELSE 0
      END +
      -- Duck penalty (must have faced ≥1 ball)
      CASE
        WHEN COALESCE(mb.runs, 0) = 0
         AND NOT COALESCE(mb.not_out, false)
         AND COALESCE(mb.balls, 0) > 0
        THEN -5 ELSE 0
      END +
      -- Run-out additional penalty
      CASE
        WHEN COALESCE(mb.run_out, false)
         AND NOT COALESCE(mb.not_out, false)
        THEN -8 ELSE 0
      END +
      -- ── Bowling ────────────────────────────────────────────────────────────
      COALESCE(mbo.wickets,  0) * 25 +
      COALESCE(mbo.maidens,  0) *  5 +
      COALESCE(mbo.wides,    0) * -1 +
      COALESCE(mbo.no_balls, 0) * -2 +
      -- Wicket bonuses (stack: 5wkt→35pts total bonus, 3wkt→10)
      CASE
        WHEN COALESCE(mbo.wickets, 0) >= 5 THEN 35
        WHEN COALESCE(mbo.wickets, 0) >= 3 THEN 10
        ELSE 0
      END +
      -- Economy rate penalty (only when overs bowled > 0)
      -- Overs stored as decimal e.g. 4.3 = 4 overs 3 balls → convert to actual overs
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
    FROM fantasy_picks fp
    LEFT JOIN match_batting  mb  ON mb.fixture_id  = p_fixture_id AND mb.player_id  = fp.player_id
    LEFT JOIN match_bowling  mbo ON mbo.fixture_id = p_fixture_id AND mbo.player_id = fp.player_id
    LEFT JOIN match_fielding mf  ON mf.fixture_id  = p_fixture_id AND mf.player_id  = fp.player_id
    WHERE fp.fixture_id = p_fixture_id
  ),

  multiplied AS (
    -- ── Apply captain (×3) / VC (×2) multipliers ─────────────────────────────
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

  team_totals AS (
    -- ── Sum all 11 picks into one score per (team, matchday) ──────────────────
    SELECT team_id, matchday, SUM(final_pts) AS total_points
    FROM   multiplied
    GROUP  BY team_id, matchday
  ),

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

-- ─── Grant execute to authenticated users (admin calls it client-side) ─────────
GRANT EXECUTE ON FUNCTION recalculate_fantasy_scores_for_fixture(uuid) TO authenticated;

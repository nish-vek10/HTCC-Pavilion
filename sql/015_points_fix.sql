-- pavilion-app/sql/016_points_rebalance.sql
-- Corrected stacked milestone + haul bonuses.
-- Batting:  25+=+10 | 50+=+30 | 100+=+70
-- Bowling:  3W=+10  | 4W=+30  | 5W=+65
-- Steps: 1) Fix RPC  2) Recompute match_potm.points  3) Recalc all fantasy_scores

-- ── 1. Fix recalculate_fantasy_scores_for_fixture ─────────────────────────────
CREATE OR REPLACE FUNCTION recalculate_fantasy_scores_for_fixture(p_fixture_id uuid)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  target_matchday AS (
    SELECT matchday FROM fantasy_picks
    WHERE  fixture_id = p_fixture_id
    LIMIT  1
  ),
  pick_points AS (
    SELECT
      fp.team_id,
      fp.matchday,
      fp.is_captain,
      fp.is_vc,

      -- ── Batting ───────────────────────────────────────────────────────────
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

      -- ── Bowling ───────────────────────────────────────────────────────────
      COALESCE(mbo.wickets,  0) * 25 +
      COALESCE(mbo.maidens,  0) *  5 +
      COALESCE(mbo.wides,    0) * -1 +
      COALESCE(mbo.no_balls, 0) * -2 +
      CASE
        WHEN COALESCE(mbo.wickets, 0) >= 5 THEN 55
        WHEN COALESCE(mbo.wickets, 0) >= 4 THEN 25
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

      -- ── Fielding ──────────────────────────────────────────────────────────
      COALESCE(mf.catches,   0) * 10 +
      COALESCE(mf.stumpings, 0) * 10

      AS raw_pts

    FROM   fantasy_picks  fp
    LEFT JOIN match_batting  mb  ON mb.fixture_id  = fp.fixture_id AND mb.player_id  = fp.player_id
    LEFT JOIN match_bowling  mbo ON mbo.fixture_id = fp.fixture_id AND mbo.player_id = fp.player_id
    LEFT JOIN match_fielding mf  ON mf.fixture_id  = fp.fixture_id AND mf.player_id  = fp.player_id
    WHERE fp.matchday = (SELECT matchday FROM target_matchday)
  ),
  multiplied AS (
    SELECT
      team_id, matchday,
      CASE
        WHEN is_captain THEN raw_pts * 3
        WHEN is_vc      THEN raw_pts * 2
        ELSE                 raw_pts
      END AS final_pts
    FROM pick_points
  ),
  team_totals AS (
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

GRANT EXECUTE ON FUNCTION recalculate_fantasy_scores_for_fixture(uuid) TO authenticated;


-- ── 2. Recompute all stored match_potm.points ─────────────────────────────────
UPDATE match_potm mp
SET    points = computed.pts
FROM (
  SELECT
    mp2.id,
    GREATEST(0,
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
      COALESCE(mbo.wickets,  0) * 25 +
      COALESCE(mbo.maidens,  0) *  5 +
      COALESCE(mbo.wides,    0) * -1 +
      COALESCE(mbo.no_balls, 0) * -2 +
      CASE
        WHEN COALESCE(mbo.wickets, 0) >= 5 THEN 55
        WHEN COALESCE(mbo.wickets, 0) >= 4 THEN 25
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
      COALESCE(mf.catches,   0) * 10 +
      COALESCE(mf.stumpings, 0) * 10
    ) AS pts
  FROM match_potm mp2
  LEFT JOIN match_batting  mb  ON mb.fixture_id  = mp2.fixture_id AND mb.player_id  = mp2.player_id
  LEFT JOIN match_bowling  mbo ON mbo.fixture_id = mp2.fixture_id AND mbo.player_id = mp2.player_id
  LEFT JOIN match_fielding mf  ON mf.fixture_id  = mp2.fixture_id AND mf.player_id  = mp2.player_id
) computed
WHERE mp.id = computed.id;


-- ── 3. Recalculate all fantasy_scores ─────────────────────────────────────────
DO $$
DECLARE
  r             RECORD;
  updated_count int;
BEGIN
  FOR r IN
    SELECT DISTINCT fixture_id FROM fantasy_picks
  LOOP
    SELECT recalculate_fantasy_scores_for_fixture(r.fixture_id) INTO updated_count;
    RAISE NOTICE 'fixture % → % team scores recalculated', r.fixture_id, updated_count;
  END LOOP;
END $$;
-- pavilion-app/sql/matchday2_fix_scores_now.sql
-- One-shot fix: recalculate and overwrite ALL fantasy_scores for matchday 2.
-- Run directly in Supabase SQL editor — no fixture_id needed.
-- Safe to run multiple times (idempotent upsert).
-- ─────────────────────────────────────────────────────────────────────────────

WITH

pick_points AS (
  SELECT
    fp.team_id,
    fp.matchday,
    fp.is_captain,
    fp.is_vc,

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
       AND COALESCE(mb.balls, 0) > 0
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
    COALESCE(mf.catches,   0) * 10 +
    COALESCE(mf.stumpings, 0) * 10
    AS raw_pts

  FROM   fantasy_picks  fp
  LEFT JOIN match_batting  mb  ON mb.fixture_id  = fp.fixture_id AND mb.player_id  = fp.player_id
  LEFT JOIN match_bowling  mbo ON mbo.fixture_id = fp.fixture_id AND mbo.player_id = fp.player_id
  LEFT JOIN match_fielding mf  ON mf.fixture_id  = fp.fixture_id AND mf.player_id  = fp.player_id
  WHERE  fp.matchday = 2   -- ← change if fixing another matchday
),

team_totals AS (
  SELECT
    team_id,
    matchday,
    SUM(
      CASE
        WHEN is_captain THEN raw_pts * 3
        WHEN is_vc      THEN raw_pts * 2
        ELSE                 raw_pts
      END
    ) AS total_points
  FROM   pick_points
  GROUP  BY team_id, matchday
)

INSERT INTO fantasy_scores (team_id, matchday, total_points, calculated_at)
SELECT team_id, matchday, total_points, now()
FROM   team_totals
ON CONFLICT (team_id, matchday) DO UPDATE
  SET total_points  = EXCLUDED.total_points,
      calculated_at = now();

-- ── Verify after fix ──────────────────────────────────────────────────────────
SELECT
  ft.team_name,
  fs.total_points,
  fs.calculated_at
FROM   fantasy_scores fs
JOIN   fantasy_teams  ft ON ft.id = fs.team_id
WHERE  fs.matchday = 2
ORDER  BY fs.total_points DESC;

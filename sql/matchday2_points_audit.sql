-- pavilion-app/sql/matchday2_points_audit.sql
-- Compare stored fantasy_scores vs correctly calculated totals for matchday 2.
-- Run AFTER deploying 009_fantasy_recalc_rpc_fix.sql to confirm who needs fixing.
-- Change matchday = 2 at bottom if checking other matchdays.
-- ─────────────────────────────────────────────────────────────────────────────

WITH

-- ── All picks for matchday 2 with points calculated per pick ─────────────────
pick_points AS (
  SELECT
    fp.team_id,
    fp.matchday,
    fp.is_captain,
    fp.is_vc,
    fp.fixture_id,
    fp.player_id,

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
  WHERE  fp.matchday = 2   -- ← CHANGE MATCHDAY HERE
),

-- ── Apply captain / VC multipliers then sum per team ─────────────────────────
calc AS (
  SELECT
    team_id,
    matchday,
    SUM(
      CASE
        WHEN is_captain THEN raw_pts * 3
        WHEN is_vc      THEN raw_pts * 2
        ELSE                 raw_pts
      END
    ) AS calc_pts
  FROM   pick_points
  GROUP  BY team_id, matchday
),

-- ── Stored fantasy_scores for same matchday ───────────────────────────────────
stored AS (
  SELECT team_id, total_points AS stored_pts, calculated_at
  FROM   fantasy_scores
  WHERE  matchday = 2   -- ← CHANGE MATCHDAY HERE
)

-- ── Side-by-side comparison ───────────────────────────────────────────────────
SELECT
  ft.team_name,
  p.full_name                               AS manager,
  COALESCE(s.stored_pts, 0)                 AS stored_pts,
  COALESCE(c.calc_pts,   0)                 AS calc_pts,
  COALESCE(c.calc_pts, 0) - COALESCE(s.stored_pts, 0) AS diff,
  CASE
    WHEN s.stored_pts IS NULL             THEN '⚠ NOT IN fantasy_scores'
    WHEN ABS(COALESCE(c.calc_pts,0) - s.stored_pts) < 0.01 THEN '✓ CORRECT'
    ELSE                                       '✗ WRONG'
  END                                         AS status,
  s.calculated_at

FROM calc c
JOIN fantasy_teams ft ON ft.id = c.team_id
JOIN profiles       p  ON p.id = ft.member_id
LEFT JOIN stored    s  ON s.team_id = c.team_id

ORDER BY ABS(COALESCE(c.calc_pts,0) - COALESCE(s.stored_pts,0)) DESC, ft.team_name;

-- pavilion-app/sql/fantasy_picks_performance.sql
-- All fantasy members + their 11 picks + full scorecard stats + points
-- Handles ALL fixtures on the target date in one shot.
-- Change date at top only.
-- ─────────────────────────────────────────────────────────────────────────────

WITH

-- ── Config: all fixtures on target date ───────────────────────────────────────
target_fixtures AS (
  SELECT id AS fixture_id, opponent
  FROM fixtures
  WHERE match_date::date = '2026-05-16'   -- ← CHANGE DATE HERE
),

-- ── Batting points across all target fixtures ──────────────────────────────────
batting_pts AS (
  SELECT
    mb.fixture_id,
    mb.player_id,
    mb.runs, mb.balls, mb.fours, mb.sixes, mb.not_out, mb.run_out,
    mb.runs*1 + mb.fours*2 + mb.sixes*4
    + CASE WHEN mb.not_out AND mb.runs >= 30 THEN 5 ELSE 0 END
    + CASE WHEN mb.runs >= 100 THEN 70 WHEN mb.runs >= 50 THEN 30 WHEN mb.runs >= 25 THEN 10 ELSE 0 END
    + CASE WHEN mb.runs = 0 AND NOT mb.not_out AND (mb.balls > 0 OR mb.run_out) THEN -5 ELSE 0 END
    + CASE WHEN mb.run_out AND NOT mb.not_out THEN -8 ELSE 0 END
    AS bat_pts
  FROM match_batting mb
  WHERE mb.fixture_id IN (SELECT fixture_id FROM target_fixtures)
),

-- ── Bowling points across all target fixtures ──────────────────────────────────
bowling_pts AS (
  SELECT
    mbo.fixture_id,
    mbo.player_id,
    mbo.overs, mbo.maidens, mbo.runs, mbo.wickets, mbo.wides, mbo.no_balls,
    CASE WHEN mbo.overs > 0 THEN
      ROUND(mbo.runs::numeric /
        NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs-FLOOR(mbo.overs))*10)) / 6.0, 0), 2)
    ELSE NULL END AS economy,
    mbo.wickets*25 + mbo.maidens*5 + mbo.wides*-1 + mbo.no_balls*-2
    + CASE WHEN mbo.wickets >= 5 THEN 35 WHEN mbo.wickets >= 3 THEN 10 ELSE 0 END
    + CASE WHEN mbo.overs > 0 THEN
        CASE
          WHEN mbo.runs::numeric / NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs-FLOOR(mbo.overs))*10))/6.0,0) >= 10 THEN -8
          WHEN mbo.runs::numeric / NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs-FLOOR(mbo.overs))*10))/6.0,0) >= 9  THEN -5
          WHEN mbo.runs::numeric / NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs-FLOOR(mbo.overs))*10))/6.0,0) >= 8  THEN -3
          WHEN mbo.runs::numeric / NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs-FLOOR(mbo.overs))*10))/6.0,0) >= 7  THEN -2
          ELSE 0
        END
      ELSE 0 END
    AS bowl_pts
  FROM match_bowling mbo
  WHERE mbo.fixture_id IN (SELECT fixture_id FROM target_fixtures)
),

-- ── Fielding points across all target fixtures ─────────────────────────────────
fielding_pts AS (
  SELECT
    mf.fixture_id,
    mf.player_id,
    mf.catches, mf.stumpings,
    mf.catches*10 + mf.stumpings*10 AS field_pts
  FROM match_fielding mf
  WHERE mf.fixture_id IN (SELECT fixture_id FROM target_fixtures)
)

-- ── Final output ───────────────────────────────────────────────────────────────
SELECT
  -- Fantasy team
  ft.team_name,
  mgr.full_name                       AS manager,

  -- Which fixture this pick was for
  tf.opponent                         AS fixture,

  -- Pick
  pp.full_name                        AS player_picked,
  fp.is_captain                       AS captain,
  fp.is_vc                            AS vice_captain,

  -- Batting
  COALESCE(b.runs,    0)              AS runs,
  COALESCE(b.balls,   0)              AS balls,
  COALESCE(b.fours,   0)             AS fours,
  COALESCE(b.sixes,   0)              AS sixes,
  COALESCE(b.not_out, false)          AS not_out,
  COALESCE(b.run_out, false)          AS run_out,

  -- Bowling
  COALESCE(bw.overs,    0)            AS overs,
  COALESCE(bw.maidens,  0)            AS maidens,
  COALESCE(bw.runs,     0)            AS runs_conceded,
  COALESCE(bw.wickets,  0)            AS wickets,
  COALESCE(bw.wides,    0)            AS wides,
  COALESCE(bw.no_balls, 0)            AS no_balls,
  bw.economy,

  -- Fielding
  COALESCE(f.catches,   0)            AS catches,
  COALESCE(f.stumpings, 0)            AS stumpings,

  -- Points breakdown
  COALESCE(b.bat_pts,   0)            AS bat_pts,
  COALESCE(bw.bowl_pts, 0)            AS bowl_pts,
  COALESCE(f.field_pts, 0)            AS field_pts,
  COALESCE(b.bat_pts,0) + COALESCE(bw.bowl_pts,0) + COALESCE(f.field_pts,0)
                                      AS raw_pts,
  (COALESCE(b.bat_pts,0) + COALESCE(bw.bowl_pts,0) + COALESCE(f.field_pts,0))
  * CASE WHEN fp.is_captain THEN 3 WHEN fp.is_vc THEN 2 ELSE 1 END
                                      AS final_pts,

  -- Flag picked but missing from scorecard
  CASE
    WHEN b.player_id IS NULL AND bw.player_id IS NULL AND f.player_id IS NULL
    THEN '⚠ NOT IN SCORECARD' ELSE ''
  END                                 AS warning

FROM fantasy_picks fp
JOIN target_fixtures tf  ON tf.fixture_id  = fp.fixture_id
JOIN fantasy_teams   ft  ON ft.id          = fp.team_id
JOIN profiles        mgr ON mgr.id         = ft.member_id
JOIN profiles        pp  ON pp.id          = fp.player_id
LEFT JOIN batting_pts  b  ON b.fixture_id  = fp.fixture_id AND b.player_id  = fp.player_id
LEFT JOIN bowling_pts  bw ON bw.fixture_id = fp.fixture_id AND bw.player_id = fp.player_id
LEFT JOIN fielding_pts f  ON f.fixture_id  = fp.fixture_id AND f.player_id  = fp.player_id

ORDER BY
  ft.team_name,
  tf.opponent,
  fp.is_captain DESC,
  fp.is_vc      DESC,
  final_pts     DESC;

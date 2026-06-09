-- pavilion-app/sql/fantasy_points_audit.sql
-- Fantasy points audit — run each query block separately, paste results back.
-- Change TARGET_DATE to audit any matchday. Format: 'YYYY-MM-DD'
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- QUERY 1 — Find fixtures on target date + matchday number
-- ══════════════════════════════════════════════════════════════════════════════
SELECT
  f.id                              AS fixture_id,
  f.opponent,
  f.match_date::date                AS match_date,
  mr.winner,
  (SELECT COUNT(*) FROM match_batting  mb WHERE mb.fixture_id = f.id) AS batting_rows,
  (SELECT COUNT(*) FROM match_bowling  mbo WHERE mbo.fixture_id = f.id) AS bowling_rows,
  (SELECT COUNT(*) FROM match_fielding mf WHERE mf.fixture_id = f.id) AS fielding_rows
FROM fixtures f
LEFT JOIN match_results mr ON mr.fixture_id = f.id
WHERE f.match_date::date = '2026-05-16'   -- ← CHANGE DATE HERE
ORDER BY f.match_date;


-- ══════════════════════════════════════════════════════════════════════════════
-- QUERY 2 — Raw batting scorecard (paste fixture_id from Query 1)
-- ══════════════════════════════════════════════════════════════════════════════
SELECT
  p.full_name,
  mb.position,
  mb.runs,
  mb.balls,
  mb.fours,
  mb.sixes,
  mb.not_out
FROM match_batting mb
JOIN profiles p ON p.id = mb.player_id
WHERE mb.fixture_id = 'PASTE-FIXTURE-ID-HERE'   -- ← paste from Query 1
ORDER BY mb.position;


-- ══════════════════════════════════════════════════════════════════════════════
-- QUERY 3 — Raw bowling scorecard
-- ══════════════════════════════════════════════════════════════════════════════
SELECT
  p.full_name,
  mbo.overs,
  mbo.maidens,
  mbo.runs,
  mbo.wickets,
  mbo.wides,
  mbo.no_balls,
  CASE WHEN mbo.overs > 0 THEN
    ROUND(
      mbo.runs::numeric /
      NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs - FLOOR(mbo.overs))*10)) / 6.0, 0),
    2)
  ELSE NULL END                     AS economy
FROM match_bowling mbo
JOIN profiles p ON p.id = mbo.player_id
WHERE mbo.fixture_id = 'PASTE-FIXTURE-ID-HERE'   -- ← paste from Query 1
ORDER BY mbo.overs DESC;


-- ══════════════════════════════════════════════════════════════════════════════
-- QUERY 4 — Raw fielding scorecard
-- ══════════════════════════════════════════════════════════════════════════════
SELECT
  p.full_name,
  mf.catches,
  mf.stumpings
FROM match_fielding mf
JOIN profiles p ON p.id = mf.player_id
WHERE mf.fixture_id = 'PASTE-FIXTURE-ID-HERE'   -- ← paste from Query 1
ORDER BY p.full_name;


-- ══════════════════════════════════════════════════════════════════════════════
-- QUERY 5 — Points breakdown per player (what RPC calculates)
-- Shows batting_pts / bowling_pts / fielding_pts / raw_total side by side
-- ══════════════════════════════════════════════════════════════════════════════
WITH fixture AS (
  SELECT id AS fixture_id FROM fixtures
  WHERE match_date::date = '2026-05-16'  -- ← CHANGE DATE HERE
),
players AS (
  SELECT DISTINCT player_id FROM (
    SELECT player_id FROM match_batting  WHERE fixture_id = (SELECT fixture_id FROM fixture)
    UNION
    SELECT player_id FROM match_bowling  WHERE fixture_id = (SELECT fixture_id FROM fixture)
    UNION
    SELECT player_id FROM match_fielding WHERE fixture_id = (SELECT fixture_id FROM fixture)
  ) x
),
batting_pts AS (
  SELECT
    mb.player_id,
    mb.runs,
    mb.balls,
    mb.fours,
    mb.sixes,
    mb.not_out,
    -- base
    mb.runs  * 1                                                                AS run_pts,
    mb.fours * 2                                                                AS four_pts,
    mb.sixes * 4                                                                AS six_pts,
    -- not-out bonus
    CASE WHEN mb.not_out AND mb.runs >= 30 THEN 5 ELSE 0 END                   AS notout_bonus,
    -- milestones (stacking)
    CASE
      WHEN mb.runs >= 100 THEN 70
      WHEN mb.runs >= 50  THEN 30
      WHEN mb.runs >= 25  THEN 10
      ELSE 0
    END                                                                         AS milestone_pts,
    -- duck penalty
    CASE
      WHEN mb.runs = 0 AND NOT mb.not_out AND mb.balls > 0 THEN -5
      ELSE 0
    END                                                                         AS duck_pen,
    -- TOTAL batting
    mb.runs * 1 + mb.fours * 2 + mb.sixes * 4
    + CASE WHEN mb.not_out AND mb.runs >= 30 THEN 5 ELSE 0 END
    + CASE WHEN mb.runs >= 100 THEN 70 WHEN mb.runs >= 50 THEN 30 WHEN mb.runs >= 25 THEN 10 ELSE 0 END
    + CASE WHEN mb.runs = 0 AND NOT mb.not_out AND mb.balls > 0 THEN -5 ELSE 0 END
                                                                                AS batting_total
  FROM match_batting mb
  WHERE mb.fixture_id = (SELECT fixture_id FROM fixture)
),
bowling_pts AS (
  SELECT
    mbo.player_id,
    mbo.overs,
    mbo.wickets,
    mbo.maidens,
    mbo.runs,
    mbo.wides,
    mbo.no_balls,
    -- economy
    CASE WHEN mbo.overs > 0 THEN
      ROUND(mbo.runs::numeric / NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs - FLOOR(mbo.overs))*10)) / 6.0, 0), 2)
    ELSE NULL END                                                               AS economy,
    -- wicket pts
    mbo.wickets * 25                                                            AS wicket_pts,
    mbo.maidens * 5                                                             AS maiden_pts,
    mbo.wides    * -1                                                           AS wide_pen,
    mbo.no_balls * -2                                                           AS nb_pen,
    -- wicket bonus
    CASE WHEN mbo.wickets >= 5 THEN 35 WHEN mbo.wickets >= 3 THEN 10 ELSE 0 END AS wkt_bonus,
    -- economy penalty
    CASE WHEN mbo.overs > 0 THEN
      CASE
        WHEN mbo.runs::numeric / NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs - FLOOR(mbo.overs))*10)) / 6.0, 0) >= 10 THEN -8
        WHEN mbo.runs::numeric / NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs - FLOOR(mbo.overs))*10)) / 6.0, 0) >= 9  THEN -5
        WHEN mbo.runs::numeric / NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs - FLOOR(mbo.overs))*10)) / 6.0, 0) >= 8  THEN -3
        WHEN mbo.runs::numeric / NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs - FLOOR(mbo.overs))*10)) / 6.0, 0) >= 7  THEN -2
        ELSE 0
      END
    ELSE 0 END                                                                  AS eco_pen,
    -- TOTAL bowling
    mbo.wickets * 25 + mbo.maidens * 5 + mbo.wides * -1 + mbo.no_balls * -2
    + CASE WHEN mbo.wickets >= 5 THEN 35 WHEN mbo.wickets >= 3 THEN 10 ELSE 0 END
    + CASE WHEN mbo.overs > 0 THEN
        CASE
          WHEN mbo.runs::numeric / NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs - FLOOR(mbo.overs))*10)) / 6.0, 0) >= 10 THEN -8
          WHEN mbo.runs::numeric / NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs - FLOOR(mbo.overs))*10)) / 6.0, 0) >= 9  THEN -5
          WHEN mbo.runs::numeric / NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs - FLOOR(mbo.overs))*10)) / 6.0, 0) >= 8  THEN -3
          WHEN mbo.runs::numeric / NULLIF((FLOOR(mbo.overs)*6 + ROUND((mbo.overs - FLOOR(mbo.overs))*10)) / 6.0, 0) >= 7  THEN -2
          ELSE 0
        END
      ELSE 0 END                                                                AS bowling_total
  FROM match_bowling mbo
  WHERE mbo.fixture_id = (SELECT fixture_id FROM fixture)
),
fielding_pts AS (
  SELECT
    mf.player_id,
    mf.catches,
    mf.stumpings,
    mf.catches * 10 + mf.stumpings * 10                                        AS fielding_total
  FROM match_fielding mf
  WHERE mf.fixture_id = (SELECT fixture_id FROM fixture)
)
SELECT
  p.full_name,
  -- batting
  COALESCE(b.runs, 0)              AS runs,
  COALESCE(b.fours, 0)             AS fours,
  COALESCE(b.sixes, 0)             AS sixes,
  COALESCE(b.not_out, false)       AS not_out,
  COALESCE(b.run_pts, 0)           AS run_pts,
  COALESCE(b.four_pts, 0)          AS four_pts,
  COALESCE(b.six_pts, 0)           AS six_pts,
  COALESCE(b.notout_bonus, 0)      AS notout_bonus,
  COALESCE(b.milestone_pts, 0)     AS milestone_pts,
  COALESCE(b.duck_pen, 0)          AS duck_pen,
  COALESCE(b.batting_total, 0)     AS batting_pts,
  -- bowling
  COALESCE(bw.overs, 0)            AS overs,
  COALESCE(bw.wickets, 0)          AS wickets,
  COALESCE(bw.maidens, 0)          AS maidens,
  bw.economy,
  COALESCE(bw.wicket_pts, 0)       AS wicket_pts,
  COALESCE(bw.maiden_pts, 0)       AS maiden_pts,
  COALESCE(bw.wide_pen, 0)         AS wide_pen,
  COALESCE(bw.nb_pen, 0)           AS nb_pen,
  COALESCE(bw.wkt_bonus, 0)        AS wkt_bonus,
  COALESCE(bw.eco_pen, 0)          AS eco_pen,
  COALESCE(bw.bowling_total, 0)    AS bowling_pts,
  -- fielding
  COALESCE(f.catches, 0)           AS catches,
  COALESCE(f.stumpings, 0)         AS stumpings,
  COALESCE(f.fielding_total, 0)    AS fielding_pts,
  -- grand total
  COALESCE(b.batting_total, 0) + COALESCE(bw.bowling_total, 0) + COALESCE(f.fielding_total, 0) AS raw_total
FROM players pl
JOIN profiles p ON p.id = pl.player_id
LEFT JOIN batting_pts  b  ON b.player_id  = pl.player_id
LEFT JOIN bowling_pts  bw ON bw.player_id = pl.player_id
LEFT JOIN fielding_pts f  ON f.player_id  = pl.player_id
ORDER BY raw_total DESC;


-- ══════════════════════════════════════════════════════════════════════════════
-- QUERY 6 — Fantasy picks for this matchday with captain/VC multipliers applied
-- Shows: which team picked which player, raw pts, multiplier, final pts
-- ══════════════════════════════════════════════════════════════════════════════
WITH fixture AS (
  SELECT id AS fixture_id FROM fixtures
  WHERE match_date::date = '2026-05-16'  -- ← CHANGE DATE HERE
),
player_raw AS (
  -- reuse same points calc
  SELECT
    pl.player_id,
    COALESCE(b.bat_total, 0) + COALESCE(bw.bowl_total, 0) + COALESCE(f.field_total, 0) AS raw_pts
  FROM (
    SELECT DISTINCT player_id FROM (
      SELECT player_id FROM match_batting  WHERE fixture_id = (SELECT fixture_id FROM fixture)
      UNION
      SELECT player_id FROM match_bowling  WHERE fixture_id = (SELECT fixture_id FROM fixture)
      UNION
      SELECT player_id FROM match_fielding WHERE fixture_id = (SELECT fixture_id FROM fixture)
    ) x
  ) pl
  LEFT JOIN (
    SELECT player_id,
      runs*1 + fours*2 + sixes*4
      + CASE WHEN not_out AND runs >= 30 THEN 5 ELSE 0 END
      + CASE WHEN runs >= 100 THEN 70 WHEN runs >= 50 THEN 30 WHEN runs >= 25 THEN 10 ELSE 0 END
      + CASE WHEN runs = 0 AND NOT not_out AND balls > 0 THEN -5 ELSE 0 END
      AS bat_total
    FROM match_batting WHERE fixture_id = (SELECT fixture_id FROM fixture)
  ) b ON b.player_id = pl.player_id
  LEFT JOIN (
    SELECT player_id,
      wickets*25 + maidens*5 + wides*-1 + no_balls*-2
      + CASE WHEN wickets >= 5 THEN 35 WHEN wickets >= 3 THEN 10 ELSE 0 END
      + CASE WHEN overs > 0 THEN
          CASE
            WHEN runs::numeric / NULLIF((FLOOR(overs)*6 + ROUND((overs-FLOOR(overs))*10))/6.0,0) >= 10 THEN -8
            WHEN runs::numeric / NULLIF((FLOOR(overs)*6 + ROUND((overs-FLOOR(overs))*10))/6.0,0) >= 9  THEN -5
            WHEN runs::numeric / NULLIF((FLOOR(overs)*6 + ROUND((overs-FLOOR(overs))*10))/6.0,0) >= 8  THEN -3
            WHEN runs::numeric / NULLIF((FLOOR(overs)*6 + ROUND((overs-FLOOR(overs))*10))/6.0,0) >= 7  THEN -2
            ELSE 0
          END
        ELSE 0 END
      AS bowl_total
    FROM match_bowling WHERE fixture_id = (SELECT fixture_id FROM fixture)
  ) bw ON bw.player_id = pl.player_id
  LEFT JOIN (
    SELECT player_id, catches*10 + stumpings*10 AS field_total
    FROM match_fielding WHERE fixture_id = (SELECT fixture_id FROM fixture)
  ) f ON f.player_id = pl.player_id
)
SELECT
  ft.team_name,
  pm.full_name                      AS manager,
  pp.full_name                      AS player,
  CASE WHEN fp.is_captain THEN '(C)' WHEN fp.is_vc THEN '(VC)' ELSE '' END AS role,
  COALESCE(pr.raw_pts, 0)           AS raw_pts,
  CASE WHEN fp.is_captain THEN 3 WHEN fp.is_vc THEN 2 ELSE 1 END           AS multiplier,
  COALESCE(pr.raw_pts, 0) *
    CASE WHEN fp.is_captain THEN 3 WHEN fp.is_vc THEN 2 ELSE 1 END         AS final_pts,
  -- flag if player not in scorecard (picked but didn't play)
  CASE WHEN pr.raw_pts IS NULL THEN '⚠ NOT IN SCORECARD' ELSE '' END        AS warning
FROM fantasy_picks fp
JOIN fantasy_teams ft   ON ft.id = fp.team_id
JOIN profiles pm        ON pm.id = ft.member_id
JOIN profiles pp        ON pp.id = fp.player_id
LEFT JOIN player_raw pr ON pr.player_id = fp.player_id
WHERE fp.fixture_id = (SELECT fixture_id FROM fixture)
ORDER BY ft.team_name, final_pts DESC;


-- ══════════════════════════════════════════════════════════════════════════════
-- QUERY 7 — Team totals: calculated vs stored in fantasy_scores
-- Flag any mismatch
-- ══════════════════════════════════════════════════════════════════════════════
WITH fixture AS (
  SELECT id AS fixture_id FROM fixtures
  WHERE match_date::date = '2026-05-16'  -- ← CHANGE DATE HERE
),
player_raw AS (
  SELECT pl.player_id,
    COALESCE(b.bat_total, 0) + COALESCE(bw.bowl_total, 0) + COALESCE(f.field_total, 0) AS raw_pts
  FROM (
    SELECT DISTINCT player_id FROM (
      SELECT player_id FROM match_batting  WHERE fixture_id = (SELECT fixture_id FROM fixture)
      UNION SELECT player_id FROM match_bowling  WHERE fixture_id = (SELECT fixture_id FROM fixture)
      UNION SELECT player_id FROM match_fielding WHERE fixture_id = (SELECT fixture_id FROM fixture)
    ) x
  ) pl
  LEFT JOIN (SELECT player_id, runs*1+fours*2+sixes*4+CASE WHEN not_out AND runs>=30 THEN 5 ELSE 0 END+CASE WHEN runs>=100 THEN 70 WHEN runs>=50 THEN 30 WHEN runs>=25 THEN 10 ELSE 0 END+CASE WHEN runs=0 AND NOT not_out AND balls>0 THEN -5 ELSE 0 END AS bat_total FROM match_batting WHERE fixture_id=(SELECT fixture_id FROM fixture)) b ON b.player_id=pl.player_id
  LEFT JOIN (SELECT player_id, wickets*25+maidens*5+wides*-1+no_balls*-2+CASE WHEN wickets>=5 THEN 35 WHEN wickets>=3 THEN 10 ELSE 0 END+CASE WHEN overs>0 THEN CASE WHEN runs::numeric/NULLIF((FLOOR(overs)*6+ROUND((overs-FLOOR(overs))*10))/6.0,0)>=10 THEN -8 WHEN runs::numeric/NULLIF((FLOOR(overs)*6+ROUND((overs-FLOOR(overs))*10))/6.0,0)>=9 THEN -5 WHEN runs::numeric/NULLIF((FLOOR(overs)*6+ROUND((overs-FLOOR(overs))*10))/6.0,0)>=8 THEN -3 WHEN runs::numeric/NULLIF((FLOOR(overs)*6+ROUND((overs-FLOOR(overs))*10))/6.0,0)>=7 THEN -2 ELSE 0 END ELSE 0 END AS bowl_total FROM match_bowling WHERE fixture_id=(SELECT fixture_id FROM fixture)) bw ON bw.player_id=pl.player_id
  LEFT JOIN (SELECT player_id, catches*10+stumpings*10 AS field_total FROM match_fielding WHERE fixture_id=(SELECT fixture_id FROM fixture)) f ON f.player_id=pl.player_id
),
calc_totals AS (
  SELECT
    fp.team_id,
    SUM(COALESCE(pr.raw_pts,0) * CASE WHEN fp.is_captain THEN 3 WHEN fp.is_vc THEN 2 ELSE 1 END) AS calc_total
  FROM fantasy_picks fp
  LEFT JOIN player_raw pr ON pr.player_id = fp.player_id
  WHERE fp.fixture_id = (SELECT fixture_id FROM fixture)
  GROUP BY fp.team_id
)
SELECT
  ft.team_name,
  p.full_name                       AS manager,
  ROUND(ct.calc_total, 2)           AS calculated_pts,
  ROUND(fs.total_points, 2)         AS stored_pts,
  ROUND(ct.calc_total - COALESCE(fs.total_points, 0), 2) AS diff,
  CASE WHEN ABS(ct.calc_total - COALESCE(fs.total_points, 0)) > 0.01
       THEN '⚠ MISMATCH' ELSE '✓ OK' END                AS status
FROM calc_totals ct
JOIN fantasy_teams ft ON ft.id = ct.team_id
JOIN profiles p       ON p.id  = ft.member_id
LEFT JOIN fantasy_scores fs
  ON fs.team_id = ct.team_id
  AND fs.matchday = fp.matchday
ORDER BY ABS(ct.calc_total - COALESCE(fs.total_points, 0)) DESC;

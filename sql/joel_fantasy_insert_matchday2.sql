-- pavilion-app/sql/joel_fantasy_insert_matchday2.sql
-- Insert Joel Biju's fantasy picks for matchday 2 + calculate score.
-- Team: Say less | team_id: d52e866b-f8b8-4a15-8570-936e7d0555f8
-- Picks: Jebin(C=Joel, VC=KD), see below. Run in Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

WITH

-- ── Step 1: resolve fixture_id for each pick from matchday 2 scorecards ───────
-- Uses scorecard tables (batting ∪ bowling ∪ fielding) to find which fixture
-- each player actually played in on 2026-05-16. DISTINCT ON ensures one row.
player_fixtures AS (
  SELECT DISTINCT ON (player_id) player_id, fixture_id
  FROM (
    SELECT player_id, fixture_id FROM match_batting
      WHERE fixture_id IN (SELECT id FROM fixtures WHERE match_date::date = '2026-05-16')
    UNION ALL
    SELECT player_id, fixture_id FROM match_bowling
      WHERE fixture_id IN (SELECT id FROM fixtures WHERE match_date::date = '2026-05-16')
    UNION ALL
    SELECT player_id, fixture_id FROM match_fielding
      WHERE fixture_id IN (SELECT id FROM fixtures WHERE match_date::date = '2026-05-16')
  ) src
  WHERE player_id IN (
    'd36dcbcc-28f7-41ee-8759-7913604edaa4',  -- Jebin Raja
    '791ca95e-0ad3-4463-898a-2b8b856d4b9b',  -- Sagar Goswami
    '804ada76-e457-465c-9db2-5fbf6eaa0a4e',  -- Akhilesh Ramesh
    '93e332a8-9f1c-466d-96d4-d34c79dd51ba',  -- Arya Makwana
    'fa17410f-5228-4f75-8217-4cf4caaa6329',  -- Anish Vekaria
    'b93e4d26-6dea-4540-b4fa-4df49cae0132',  -- Nadeem Dandool
    'ac1bfec5-8bc0-47a3-b979-32f769202e23',  -- Mohsin Shafi
    '818c2798-2f35-45bf-abca-3126e0933ad0',  -- Muhamamd Usman Ali
    '2c79dcbc-d75f-4779-84b1-22407cf7c540',  -- Joel Biju       (C)
    'eb5e8f4d-d042-4ee3-9ca2-24f12cee9213',  -- Krishen Daniel  (VC)
    'c1ace176-9009-4406-ae76-4d68c1ec0d7c'   -- Prayash Singh
  )
  ORDER BY player_id
),

-- ── Step 2: build the 11 pick rows with captain / VC flags ────────────────────
joel_picks AS (
  SELECT
    'd52e866b-f8b8-4a15-8570-936e7d0555f8'::uuid AS team_id,
    2                                              AS matchday,
    pf.fixture_id,
    pf.player_id,
    (pf.player_id = '2c79dcbc-d75f-4779-84b1-22407cf7c540') AS is_captain,  -- Joel
    (pf.player_id = 'eb5e8f4d-d042-4ee3-9ca2-24f12cee9213') AS is_vc        -- KD
  FROM player_fixtures pf
),

-- ── Step 3: insert fantasy_picks (safe re-run via ON CONFLICT) ────────────────
inserted_picks AS (
  INSERT INTO fantasy_picks (team_id, matchday, fixture_id, player_id, is_captain, is_vc)
  SELECT team_id, matchday, fixture_id, player_id, is_captain, is_vc
  FROM joel_picks
  ON CONFLICT (team_id, matchday, player_id) DO UPDATE
    SET fixture_id = EXCLUDED.fixture_id,
        is_captain = EXCLUDED.is_captain,
        is_vc      = EXCLUDED.is_vc
  RETURNING player_id, fixture_id, is_captain, is_vc
),

-- ── Step 4: calculate points for each inserted pick ───────────────────────────
pick_points AS (
  SELECT
    ip.is_captain,
    ip.is_vc,

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

  FROM inserted_picks ip
  LEFT JOIN match_batting  mb  ON mb.fixture_id  = ip.fixture_id AND mb.player_id  = ip.player_id
  LEFT JOIN match_bowling  mbo ON mbo.fixture_id = ip.fixture_id AND mbo.player_id = ip.player_id
  LEFT JOIN match_fielding mf  ON mf.fixture_id  = ip.fixture_id AND mf.player_id  = ip.player_id
),

-- ── Step 5: apply multipliers + sum ───────────────────────────────────────────
team_total AS (
  SELECT
    SUM(
      CASE
        WHEN is_captain THEN raw_pts * 3
        WHEN is_vc      THEN raw_pts * 2
        ELSE                 raw_pts
      END
    ) AS total_points
  FROM pick_points
),

-- ── Step 6: upsert into fantasy_scores ────────────────────────────────────────
score_upsert AS (
  INSERT INTO fantasy_scores (team_id, matchday, total_points, calculated_at)
  SELECT
    'd52e866b-f8b8-4a15-8570-936e7d0555f8'::uuid,
    2,
    total_points,
    now()
  FROM team_total
  ON CONFLICT (team_id, matchday) DO UPDATE
    SET total_points  = EXCLUDED.total_points,
        calculated_at = now()
  RETURNING total_points
)

-- ── Result: confirm what was stored ───────────────────────────────────────────
SELECT
  'Say less' AS team_name,
  'Joel Biju' AS manager,
  total_points,
  'Joel(C) × KD(VC) — matchday 2' AS note
FROM score_upsert;

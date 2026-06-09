-- pavilion-app/sql/fantasy_comparison_lw_tw.sql
-- Fantasy picks: Last Week vs This Week — side-by-side per fantasy team
-- Over-3 check uses squad_members → squads (THIS week fixture only, published squads)
-- Adjust LW_MD / TW_MD constants at top as matchdays progress

WITH

-- ── CONFIG: set matchday numbers here ─────────────────────────────────────────
params AS (
  SELECT
    1 AS lw_md,   -- last week matchday
    2 AS tw_md    -- this week matchday
),

-- ── Last week picks ────────────────────────────────────────────────────────────
lw AS (
  SELECT
    fp.team_id,
    fp.player_id                          AS lw_player_id,
    p.full_name                           AS lw_name,
    fp.is_captain                         AS lw_captain,
    fp.is_vc                              AS lw_vc
  FROM fantasy_picks fp
  JOIN profiles p ON p.id = fp.player_id
  CROSS JOIN params
  WHERE fp.matchday = params.lw_md
),

-- ── This week picks ────────────────────────────────────────────────────────────
tw AS (
  SELECT
    fp.team_id,
    fp.player_id                          AS tw_player_id,
    p.full_name                           AS tw_name,
    fp.is_captain                         AS tw_captain,
    fp.is_vc                              AS tw_vc,
    fp.fixture_id                         AS tw_fixture_id
  FROM fantasy_picks fp
  JOIN profiles p ON p.id = fp.player_id
  CROSS JOIN params
  WHERE fp.matchday = params.tw_md
),

-- ── Side-by-side: same player = same row ──────────────────────────────────────
-- FULL OUTER JOIN on (team_id + player_id match)
-- Same player both weeks → one row, same_player = true
-- Only LW → tw cols null
-- Only TW → lw cols null
sbs AS (
  SELECT
    COALESCE(lw.team_id,    tw.team_id)    AS team_id,
    lw.lw_player_id,
    lw.lw_name,
    lw.lw_captain,
    lw.lw_vc,
    tw.tw_player_id,
    tw.tw_name,
    tw.tw_captain,
    tw.tw_vc,
    tw.tw_fixture_id,
    (lw.lw_player_id IS NOT NULL AND tw.tw_player_id IS NOT NULL) AS same_player
  FROM lw
  FULL OUTER JOIN tw
    ON lw.team_id      = tw.team_id
   AND lw.lw_player_id = tw.tw_player_id
),

-- ── TW squad assignment: which published squad is each TW pick in? ─────────────
-- squad_members.player_id = tw pick's player
-- squads.id = squad_members.squad_id
-- squads.fixture_id = tw pick's fixture_id  ← links to THIS week's fixture
-- squads.published = true                   ← only finalised squads count
tw_squad AS (
  SELECT
    tw.team_id,
    tw.tw_player_id,
    sm.squad_id
  FROM tw
  JOIN squad_members sm ON sm.player_id = tw.tw_player_id
  JOIN squads        sq ON sq.id        = sm.squad_id
                       AND sq.fixture_id = tw.tw_fixture_id
                       AND sq.published  = true
),

-- ── Count players per (fantasy_team, HTCC squad) for TW ───────────────────────
tw_squad_counts AS (
  SELECT
    team_id,
    squad_id,
    COUNT(*)          AS squad_pick_count,
    COUNT(*) > 3      AS squad_violation
  FROM tw_squad
  GROUP BY team_id, squad_id
),

-- ── Roll up: does ANY squad exceed 3 for this fantasy team? ───────────────────
team_violation AS (
  SELECT
    team_id,
    bool_or(squad_violation)            AS over_3_violation,
    STRING_AGG(
      squad_id::text || '×' || squad_pick_count::text,
      ', '
      ORDER BY squad_pick_count DESC
    )                                   AS squad_breakdown
  FROM tw_squad_counts
  GROUP BY team_id
),

-- ── Fantasy team + manager name ───────────────────────────────────────────────
teams AS (
  SELECT
    ft.id         AS team_id,
    ft.team_name,
    p.full_name   AS manager
  FROM fantasy_teams ft
  JOIN profiles p ON p.id = ft.member_id
)

-- ── FINAL OUTPUT ──────────────────────────────────────────────────────────────
SELECT
  t.team_name,
  t.manager,

  -- Last week pick
  COALESCE(sbs.lw_name, '—')                                     AS lw_pick,
  CASE
    WHEN sbs.lw_captain THEN '(C)'
    WHEN sbs.lw_vc      THEN '(VC)'
    ELSE ''
  END                                                             AS lw_role,

  -- This week pick
  COALESCE(sbs.tw_name, '—')                                     AS tw_pick,
  CASE
    WHEN sbs.tw_captain THEN '(C)'
    WHEN sbs.tw_vc      THEN '(VC)'
    ELSE ''
  END                                                             AS tw_role,

  -- Flags
  CASE WHEN sbs.same_player           THEN '✓ KEPT'  ELSE '' END AS kept_same_player,
  CASE WHEN tv.over_3_violation       THEN '⚠ OVER 3' ELSE '' END AS squad_rule,
  COALESCE(tv.squad_breakdown, '')                                AS squad_detail

FROM sbs
JOIN teams t  ON t.team_id = sbs.team_id
LEFT JOIN team_violation tv ON tv.team_id = sbs.team_id

ORDER BY
  t.team_name,
  sbs.same_player DESC,          -- kept players first in each team block
  sbs.lw_name    NULLS LAST,
  sbs.tw_name    NULLS LAST;

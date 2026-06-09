-- pavilion-app/sql/003_fantasy_schema.sql
-- Fantasy League schema for Pavilion
-- Run in Supabase SQL editor. Safe to run multiple times (IF NOT EXISTS).

-- ─── fantasy_teams — one row per member ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS fantasy_teams (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_name        text NOT NULL,
  member_full_name text,                         -- denormalised for leaderboard display
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE(team_name)
);

-- ─── fantasy_picks — 11 rows per (team, matchday) ─────────────────────────────
-- Each row = one player selected for that matchday.
-- fixture_id tells us which scorecard to fetch points from.
-- Picks are PRIVATE — only the owner can read via RLS.
CREATE TABLE IF NOT EXISTS fantasy_picks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  matchday    int  NOT NULL,                             -- 1–18
  fixture_id  uuid REFERENCES fixtures(id)   ON DELETE CASCADE,
  player_id   uuid REFERENCES profiles(id)   ON DELETE CASCADE,
  is_captain  bool NOT NULL DEFAULT false,
  is_vc       bool NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(team_id, matchday, player_id)
);

-- ─── fantasy_scores — cached totals per team per matchday ─────────────────────
-- Updated client-side when member views their fantasy page after scores are in.
-- PUBLIC readable — leaderboard aggregates these without ever exposing picks.
CREATE TABLE IF NOT EXISTS fantasy_scores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  matchday      int  NOT NULL,
  total_points  numeric(8,2) NOT NULL DEFAULT 0,
  calculated_at timestamptz  DEFAULT now(),
  UNIQUE(team_id, matchday)
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE fantasy_teams  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_picks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_scores ENABLE ROW LEVEL SECURITY;

-- fantasy_teams: all authenticated read; owner write
CREATE POLICY "read_fantasy_teams"      ON fantasy_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_own_fantasy_team"  ON fantasy_teams FOR ALL    TO authenticated
  USING (member_id = auth.uid()) WITH CHECK (member_id = auth.uid());

-- fantasy_picks: only owner read/write (picks stay private)
CREATE POLICY "read_own_picks"  ON fantasy_picks FOR SELECT TO authenticated
  USING (team_id IN (SELECT id FROM fantasy_teams WHERE member_id = auth.uid()));
CREATE POLICY "write_own_picks" ON fantasy_picks FOR ALL    TO authenticated
  USING   (team_id IN (SELECT id FROM fantasy_teams WHERE member_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM fantasy_teams WHERE member_id = auth.uid()));

-- fantasy_scores: all authenticated read; owner write
CREATE POLICY "read_fantasy_scores"  ON fantasy_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_own_scores"     ON fantasy_scores FOR ALL    TO authenticated
  USING   (team_id IN (SELECT id FROM fantasy_teams WHERE member_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM fantasy_teams WHERE member_id = auth.uid()));

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fantasy_picks_team_matchday ON fantasy_picks  (team_id, matchday);
CREATE INDEX IF NOT EXISTS idx_fantasy_scores_team         ON fantasy_scores (team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_scores_matchday     ON fantasy_scores (matchday);

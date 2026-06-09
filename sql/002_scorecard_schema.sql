-- pavilion-app/sql/002_scorecard_schema.sql
-- Run in Supabase SQL editor — creates all tables for in-app scorecard submission
-- Safe to run multiple times (IF NOT EXISTS on all tables)

-- ─── Match result ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_results (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id   uuid REFERENCES fixtures(id) ON DELETE CASCADE,
  winner       text NOT NULL,  -- 'htcc' | 'opponent' | 'draw' | 'no_result'
  submitted_by uuid REFERENCES profiles(id),
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(fixture_id)
);

-- ─── Batting scorecard ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_batting (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id   uuid REFERENCES fixtures(id) ON DELETE CASCADE,
  player_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  position     int  NOT NULL DEFAULT 0,   -- batting order 1-11
  runs         int  NOT NULL DEFAULT 0,
  balls        int  NOT NULL DEFAULT 0,
  fours        int  NOT NULL DEFAULT 0,
  sixes        int  NOT NULL DEFAULT 0,
  not_out      bool NOT NULL DEFAULT false,
  run_out      bool NOT NULL DEFAULT false,
  UNIQUE(fixture_id, player_id)
);

-- ─── Bowling scorecard ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_bowling (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id   uuid REFERENCES fixtures(id) ON DELETE CASCADE,
  player_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  overs        numeric(5,1) NOT NULL DEFAULT 0,  -- e.g. 4.3 = 4 overs 3 balls
  maidens      int          NOT NULL DEFAULT 0,
  runs         int          NOT NULL DEFAULT 0,
  wickets      int          NOT NULL DEFAULT 0,
  no_balls     int          NOT NULL DEFAULT 0,
  wides        int          NOT NULL DEFAULT 0,
  UNIQUE(fixture_id, player_id)
);

-- ─── Fielding scorecard ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_fielding (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id   uuid REFERENCES fixtures(id) ON DELETE CASCADE,
  player_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  catches      int NOT NULL DEFAULT 0,
  stumpings    int NOT NULL DEFAULT 0,
  UNIQUE(fixture_id, player_id)
);

-- ─── Player of the Match ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_potm (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id      uuid REFERENCES fixtures(id) ON DELETE CASCADE,
  player_id       uuid REFERENCES profiles(id),
  points          numeric(8,2) NOT NULL DEFAULT 0,
  calculated_at   timestamptz DEFAULT now(),
  UNIQUE(fixture_id)
);

-- ─── RLS policies — admin/superadmin can write, all authenticated can read ────
ALTER TABLE match_results  ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_batting  ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_bowling  ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_fielding ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_potm     ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user
CREATE POLICY "read_match_results"  ON match_results  FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_match_batting"  ON match_batting  FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_match_bowling"  ON match_bowling  FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_match_fielding" ON match_fielding FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_match_potm"     ON match_potm     FOR SELECT TO authenticated USING (true);

-- Write: admin or superadmin only
CREATE POLICY "write_match_results"  ON match_results  FOR ALL TO authenticated
  USING   ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','superadmin'))
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','superadmin'));

CREATE POLICY "write_match_batting"  ON match_batting  FOR ALL TO authenticated
  USING   ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','superadmin'))
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','superadmin'));

CREATE POLICY "write_match_bowling"  ON match_bowling  FOR ALL TO authenticated
  USING   ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','superadmin'))
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','superadmin'));

CREATE POLICY "write_match_fielding" ON match_fielding FOR ALL TO authenticated
  USING   ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','superadmin'))
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','superadmin'));

CREATE POLICY "write_match_potm"     ON match_potm     FOR ALL TO authenticated
  USING   ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','superadmin'))
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','superadmin'));

-- ─── Clear 2025 PlayCricket data — 2026 season starts fresh ──────────────────
-- Run these separately once you are ready to wipe 2025 stats:
-- TRUNCATE pc_batting, pc_bowling, pc_match_players, pc_match_points, pc_season_stats, pc_innings, pc_matches CASCADE;

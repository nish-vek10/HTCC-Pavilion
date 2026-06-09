-- pavilion-app/sql/007_availability_rls.sql
-- Fix RLS: allow admins + captains to override any player's availability
-- Run in Supabase SQL Editor

-- ── 1. Admins / superadmins — full access to all availability rows ────────────
CREATE POLICY "Admins can manage all availability"
ON availability
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'superadmin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'superadmin')
  )
);

-- ── 2. Captains — manage availability for players in their team ───────────────
CREATE POLICY "Captains can manage team availability"
ON availability
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN team_members tm ON tm.player_id = p.id
    JOIN fixtures f ON f.team_id = tm.team_id
    WHERE p.id = auth.uid()
    AND p.role = 'captain'
    AND tm.status = 'active'
    AND f.id = availability.fixture_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN team_members tm ON tm.player_id = p.id
    JOIN fixtures f ON f.team_id = tm.team_id
    WHERE p.id = auth.uid()
    AND p.role = 'captain'
    AND tm.status = 'active'
    AND f.id = availability.fixture_id
  )
);

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'availability'
ORDER BY policyname;

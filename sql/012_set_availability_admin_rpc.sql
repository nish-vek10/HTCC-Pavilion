-- pavilion-app/sql/012_set_availability_admin_rpc.sql
-- SECURITY DEFINER RPC so admins, superadmins, and captains can override
-- any player's availability, bypassing the RLS policy that restricts
-- direct table writes to player_id = auth.uid().
--
-- Replaces the broken direct .upsert() / .delete() calls in:
--   AdminMatchdayScreen.jsx
--   CaptainMatchdayScreen.jsx
--   SquadSelectionScreen.jsx
--
-- Run once in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_availability_as_admin(
  p_fixture_id  uuid,
  p_player_id   uuid,
  p_status      text    -- 'available' | 'tentative' | 'unavailable' | NULL (clears row)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  -- ── Auth guard: only admin / superadmin / captain ─────────────────────────
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Unauthorised: admin role required';
  END IF;

  -- ── Apply change ──────────────────────────────────────────────────────────
  IF p_status IS NULL THEN
    -- "Not Set" — delete row so player shows as no reply
    DELETE FROM availability
    WHERE fixture_id = p_fixture_id
      AND player_id  = p_player_id;
  ELSE
    INSERT INTO availability (fixture_id, player_id, status, set_by_admin)
    VALUES (p_fixture_id, p_player_id, p_status::availability_status, true)
    ON CONFLICT (fixture_id, player_id)
    DO UPDATE SET
      status       = EXCLUDED.status,
      set_by_admin = true;
  END IF;
END;
$$;

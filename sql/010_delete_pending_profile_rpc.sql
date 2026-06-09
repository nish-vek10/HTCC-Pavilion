-- pavilion-app/sql/010_delete_pending_profile_rpc.sql
-- RPC: delete_pending_profile(p_member_id uuid)
-- SECURITY DEFINER — bypasses RLS so admin can hard-delete a pending profile.
-- Only deletes rows where role = 'pending' (safety guard).
-- Run in Supabase SQL Editor — safe to re-run (CREATE OR REPLACE).
-- Called by AdminDashboardScreen and AdminMembersScreen on reject.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION delete_pending_profile(p_member_id uuid)
RETURNS boolean    -- true = deleted, false = not found / not pending
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_deleted int;
BEGIN
  DELETE FROM profiles
  WHERE  id   = p_member_id
    AND  role = 'pending'
  ;
  GET DIAGNOSTICS rows_deleted = ROW_COUNT;
  RETURN rows_deleted > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_pending_profile(uuid) TO authenticated;

-- pavilion-app/sql/014_notify_admins_rpc.sql
-- SECURITY DEFINER RPC: notify_admins_new_member
--
-- Problem: when a pending/regular user triggers an admin notification
--   (new signup, join request), calling sendPushToRole('admin', ...) from
--   the client fails silently — RLS blocks the pending user from reading
--   other users' expo_push_token or inserting notifications for others.
--
-- Fix: SECURITY DEFINER runs as the function owner (bypasses RLS).
--   - Inserts in-app notifications for all admin/superadmin profiles
--   - Returns their expo_push_tokens so the client can send the Expo push
--
-- Usage (client side):
--   const { data: tokens } = await supabase.rpc('notify_admins_new_member', {
--     p_title: 'New Member Application',
--     p_body:  'Nish has registered and is awaiting approval.',
--     p_type:  'approval',
--   })
--   // tokens = ['ExponentPushToken[xxx]', ...]
--   // client then sends push via Expo API (see notifyAdmins in pushNotifications.js)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_admins_new_member(
  p_title text,
  p_body  text,
  p_type  text DEFAULT 'approval'
)
RETURNS text[]   -- expo_push_tokens for all admin/superadmin users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_ids uuid[];
  v_tokens    text[];
BEGIN
  -- Collect all admin + superadmin IDs and push tokens in one pass
  SELECT
    ARRAY_AGG(id),
    ARRAY_AGG(expo_push_token) FILTER (
      WHERE expo_push_token IS NOT NULL
        AND expo_push_token <> ''
    )
  INTO v_admin_ids, v_tokens
  FROM profiles
  WHERE role IN ('admin', 'superadmin');

  -- Insert in-app notifications for each admin (bypasses RLS)
  IF v_admin_ids IS NOT NULL AND array_length(v_admin_ids, 1) > 0 THEN
    INSERT INTO notifications (user_id, type, title, body, read)
    SELECT unnest(v_admin_ids), p_type, p_title, p_body, false;
  END IF;

  RETURN COALESCE(v_tokens, '{}');
END;
$$;

-- Allow any authenticated user (including pending role) to call this
GRANT EXECUTE ON FUNCTION notify_admins_new_member(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION notify_admins_new_member(text, text, text) TO anon;

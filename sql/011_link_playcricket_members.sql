-- pavilion-app/sql/011_link_playcricket_members.sql
-- One-time setup: link profiles.pc_member_id to Play Cricket player IDs.
-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 (run once): view current link status
-- STEP 2: manually update pc_member_id per player using their PC member ID
-- STEP 3: verify all active players are linked
--
-- To find PC member IDs:
--   GET https://play-cricket.com/api/v2/sites/{SITE_ID}/players?api_token=aec28d28822cddd54b8849e1db27180e
--   Replace {SITE_ID} with HTCC's Play Cricket site ID (found in PC admin or from any match_detail response
--   as home_club_id / away_club_id when HTCC is involved).
--
-- pc_member_id also visible in any match_detail response under:
--   innings[].bat[].batsman_id  OR  innings[].bowl[].bowler_id
-- ─────────────────────────────────────────────────────────────────────────────

-- ── STEP 1: Review all active players and current link status ─────────────────
SELECT
  p.id                                           AS profile_id,
  p.full_name,
  p.role,
  p.pc_member_id,
  CASE WHEN p.pc_member_id IS NULL THEN '⚠ NOT LINKED' ELSE '✓ LINKED' END AS status
FROM profiles p
WHERE p.role IN ('member', 'captain', 'admin', 'superadmin')
ORDER BY p.role, p.full_name;


-- ── STEP 2: Update pc_member_id per player ────────────────────────────────────
-- Run one UPDATE per player. Replace the name match and pc_member_id value.
-- Example:
-- UPDATE profiles SET pc_member_id = 3778631 WHERE full_name ILIKE '%anish vekaria%';
-- UPDATE profiles SET pc_member_id = 3778630 WHERE full_name ILIKE '%jebin raja%';
-- ... etc for each player

-- Template — copy and fill in for each squad member:
/*
UPDATE profiles SET pc_member_id = <PC_MEMBER_ID_HERE>
WHERE full_name ILIKE '%<PLAYER_NAME_HERE>%'
  AND role IN ('member', 'captain', 'admin', 'superadmin');
*/


-- ── STEP 3: Verify after linking ──────────────────────────────────────────────
SELECT
  p.full_name,
  p.role,
  p.pc_member_id,
  CASE WHEN p.pc_member_id IS NULL THEN '⚠ NOT LINKED' ELSE '✓ LINKED' END AS status
FROM profiles p
WHERE p.role IN ('member', 'captain', 'admin', 'superadmin')
ORDER BY status DESC, p.full_name;

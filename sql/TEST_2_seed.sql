-- pavilion-app/sql/TEST_2_seed.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Seed test data for May 9 2026 fantasy test
-- Run in Supabase SQL Editor (service role / full access)
--
-- Creates:
--   • member_full_name column on fantasy_teams (if missing)
--   • 15 test player auth.users + profiles
--   • 4 league fixtures on 2026-05-09 (one per HTCC team)
--   • 4 squads (published = true), 15 squad_members distributed across them
--
-- Fixed UUID prefixes used so cleanup script can target them precisely:
--   Players  : cccccccc-cccc-cccc-cccc-0000000000XX  (01-15)
--   Fixtures : ffffffff-ffff-ffff-ffff-00000000000X  (1-4)
--   Squads   : dddddddd-dddd-dddd-dddd-00000000000X  (1-4)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. Ensure member_full_name column exists ──────────────────────────────────
ALTER TABLE fantasy_teams
  ADD COLUMN IF NOT EXISTS member_full_name text;

-- ── 1. Test player auth.users (bypasses RLS — service role required) ──────────
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change,
  phone_change, phone_change_token,
  email_change_token_current, reauthentication_token,
  is_super_admin, is_sso_user
) VALUES
-- 1st XI players
('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-000000000001','authenticated','authenticated','test_p01@htcc-test.local',crypt('TestPass123!',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"James Anderson"}','','','','','','','','',false,false),
('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-000000000002','authenticated','authenticated','test_p02@htcc-test.local',crypt('TestPass123!',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Ben Stokes"}','','','','','','','','',false,false),
('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-000000000003','authenticated','authenticated','test_p03@htcc-test.local',crypt('TestPass123!',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Joe Root"}','','','','','','','','',false,false),
('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-000000000004','authenticated','authenticated','test_p04@htcc-test.local',crypt('TestPass123!',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Jonny Bairstow"}','','','','','','','','',false,false),
-- 2nd XI players
('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-000000000005','authenticated','authenticated','test_p05@htcc-test.local',crypt('TestPass123!',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Stuart Broad"}','','','','','','','','',false,false),
('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-000000000006','authenticated','authenticated','test_p06@htcc-test.local',crypt('TestPass123!',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Chris Woakes"}','','','','','','','','',false,false),
('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-000000000007','authenticated','authenticated','test_p07@htcc-test.local',crypt('TestPass123!',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Mark Wood"}','','','','','','','','',false,false),
('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-000000000008','authenticated','authenticated','test_p08@htcc-test.local',crypt('TestPass123!',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Jos Buttler"}','','','','','','','','',false,false),
-- 3rd XI players
('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-000000000009','authenticated','authenticated','test_p09@htcc-test.local',crypt('TestPass123!',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Harry Brook"}','','','','','','','','',false,false),
('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-000000000010','authenticated','authenticated','test_p10@htcc-test.local',crypt('TestPass123!',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Zak Crawley"}','','','','','','','','',false,false),
('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-000000000011','authenticated','authenticated','test_p11@htcc-test.local',crypt('TestPass123!',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Ollie Pope"}','','','','','','','','',false,false),
('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-000000000012','authenticated','authenticated','test_p12@htcc-test.local',crypt('TestPass123!',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Liam Livingstone"}','','','','','','','','',false,false),
-- 4th XI players
('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-000000000013','authenticated','authenticated','test_p13@htcc-test.local',crypt('TestPass123!',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Moeen Ali"}','','','','','','','','',false,false),
('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-000000000014','authenticated','authenticated','test_p14@htcc-test.local',crypt('TestPass123!',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Jack Leach"}','','','','','','','','',false,false),
('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-000000000015','authenticated','authenticated','test_p15@htcc-test.local',crypt('TestPass123!',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Sam Curran"}','','','','','','','','',false,false)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Profiles — one per test player ────────────────────────────────────────
-- Supabase trigger may auto-create these; UPSERT is safe either way
INSERT INTO profiles (id, full_name, role, avatar_color, created_at)
VALUES
  ('cccccccc-cccc-cccc-cccc-000000000001', 'James Anderson',   'member', '#F5C518', NOW()),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'Ben Stokes',        'member', '#22C55E', NOW()),
  ('cccccccc-cccc-cccc-cccc-000000000003', 'Joe Root',          'member', '#60A5FA', NOW()),
  ('cccccccc-cccc-cccc-cccc-000000000004', 'Jonny Bairstow',    'member', '#F97316', NOW()),
  ('cccccccc-cccc-cccc-cccc-000000000005', 'Stuart Broad',      'member', '#A78BFA', NOW()),
  ('cccccccc-cccc-cccc-cccc-000000000006', 'Chris Woakes',      'member', '#F5C518', NOW()),
  ('cccccccc-cccc-cccc-cccc-000000000007', 'Mark Wood',         'member', '#EF4444', NOW()),
  ('cccccccc-cccc-cccc-cccc-000000000008', 'Jos Buttler',       'member', '#22C55E', NOW()),
  ('cccccccc-cccc-cccc-cccc-000000000009', 'Harry Brook',       'member', '#60A5FA', NOW()),
  ('cccccccc-cccc-cccc-cccc-000000000010', 'Zak Crawley',       'member', '#F97316', NOW()),
  ('cccccccc-cccc-cccc-cccc-000000000011', 'Ollie Pope',        'member', '#A78BFA', NOW()),
  ('cccccccc-cccc-cccc-cccc-000000000012', 'Liam Livingstone',  'member', '#F5C518', NOW()),
  ('cccccccc-cccc-cccc-cccc-000000000013', 'Moeen Ali',         'member', '#EF4444', NOW()),
  ('cccccccc-cccc-cccc-cccc-000000000014', 'Jack Leach',        'member', '#22C55E', NOW()),
  ('cccccccc-cccc-cccc-cccc-000000000015', 'Sam Curran',        'member', '#60A5FA', NOW())
ON CONFLICT (id) DO UPDATE SET
  full_name    = EXCLUDED.full_name,
  role         = EXCLUDED.role,
  avatar_color = EXCLUDED.avatar_color;

-- ── 3. Fixtures — 4 league games on May 9 2026 ───────────────────────────────
-- Uses subquery to get team_id by name — works regardless of UUID
INSERT INTO fixtures (id, team_id, opponent, venue, match_date, match_time, match_type, home_away, day_type)
VALUES
  ('ffffffff-ffff-ffff-ffff-000000000001',
    (SELECT id FROM teams WHERE name = '1st XI' LIMIT 1),
    'Test FC 1st XI', 'Harrow Recreation Ground', '2026-05-09', '12:30', 'league', 'home', 'saturday'),
  ('ffffffff-ffff-ffff-ffff-000000000002',
    (SELECT id FROM teams WHERE name = '2nd XI' LIMIT 1),
    'Test FC 2nd XI', 'Harrow Recreation Ground', '2026-05-09', '12:30', 'league', 'home', 'saturday'),
  ('ffffffff-ffff-ffff-ffff-000000000003',
    (SELECT id FROM teams WHERE name = '3rd XI' LIMIT 1),
    'Test FC 3rd XI', 'Harrow Recreation Ground', '2026-05-09', '12:30', 'league', 'home', 'saturday'),
  ('ffffffff-ffff-ffff-ffff-000000000004',
    (SELECT id FROM teams WHERE name = '4th XI' LIMIT 1),
    'Test FC 4th XI', 'Harrow Recreation Ground', '2026-05-09', '12:30', 'league', 'home', 'saturday')
ON CONFLICT (id) DO NOTHING;

-- ── 4. Squads — one per fixture, all published ────────────────────────────────
INSERT INTO squads (id, fixture_id, published)
VALUES
  ('dddddddd-dddd-dddd-dddd-000000000001', 'ffffffff-ffff-ffff-ffff-000000000001', true),
  ('dddddddd-dddd-dddd-dddd-000000000002', 'ffffffff-ffff-ffff-ffff-000000000002', true),
  ('dddddddd-dddd-dddd-dddd-000000000003', 'ffffffff-ffff-ffff-ffff-000000000003', true),
  ('dddddddd-dddd-dddd-dddd-000000000004', 'ffffffff-ffff-ffff-ffff-000000000004', true)
ON CONFLICT (id) DO NOTHING;

-- ── 5. Squad members — 4 per 1st/2nd/3rd XI, 3 for 4th XI ───────────────────
INSERT INTO squad_members (squad_id, player_id, position_order, is_captain, is_wicketkeeper)
VALUES
  -- 1st XI squad
  ('dddddddd-dddd-dddd-dddd-000000000001','cccccccc-cccc-cccc-cccc-000000000001',1,true, false),
  ('dddddddd-dddd-dddd-dddd-000000000001','cccccccc-cccc-cccc-cccc-000000000002',2,false,false),
  ('dddddddd-dddd-dddd-dddd-000000000001','cccccccc-cccc-cccc-cccc-000000000003',3,false,false),
  ('dddddddd-dddd-dddd-dddd-000000000001','cccccccc-cccc-cccc-cccc-000000000004',4,false,true),
  -- 2nd XI squad
  ('dddddddd-dddd-dddd-dddd-000000000002','cccccccc-cccc-cccc-cccc-000000000005',1,true, false),
  ('dddddddd-dddd-dddd-dddd-000000000002','cccccccc-cccc-cccc-cccc-000000000006',2,false,false),
  ('dddddddd-dddd-dddd-dddd-000000000002','cccccccc-cccc-cccc-cccc-000000000007',3,false,false),
  ('dddddddd-dddd-dddd-dddd-000000000002','cccccccc-cccc-cccc-cccc-000000000008',4,false,true),
  -- 3rd XI squad
  ('dddddddd-dddd-dddd-dddd-000000000003','cccccccc-cccc-cccc-cccc-000000000009',1,true, false),
  ('dddddddd-dddd-dddd-dddd-000000000003','cccccccc-cccc-cccc-cccc-000000000010',2,false,false),
  ('dddddddd-dddd-dddd-dddd-000000000003','cccccccc-cccc-cccc-cccc-000000000011',3,false,false),
  ('dddddddd-dddd-dddd-dddd-000000000003','cccccccc-cccc-cccc-cccc-000000000012',4,false,true),
  -- 4th XI squad
  ('dddddddd-dddd-dddd-dddd-000000000004','cccccccc-cccc-cccc-cccc-000000000013',1,true, false),
  ('dddddddd-dddd-dddd-dddd-000000000004','cccccccc-cccc-cccc-cccc-000000000014',2,false,false),
  ('dddddddd-dddd-dddd-dddd-000000000004','cccccccc-cccc-cccc-cccc-000000000015',3,false,true)
ON CONFLICT DO NOTHING;

-- ── 6. Patch All Stars XI with member_full_name ───────────────────────────────
-- Update Nish's existing team so leaderboard shows name correctly
UPDATE fantasy_teams
SET    member_full_name = (
         SELECT full_name FROM profiles WHERE id = fantasy_teams.member_id
       )
WHERE  team_name = 'All Stars XI';

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT
  f.id          AS fixture_id,
  t.name        AS team,
  f.match_date,
  sq.published,
  COUNT(sm.player_id) AS squad_size
FROM   fixtures f
JOIN   teams t ON t.id = f.team_id
JOIN   squads sq ON sq.fixture_id = f.id
JOIN   squad_members sm ON sm.squad_id = sq.id
WHERE  f.id LIKE 'ffffffff%'
GROUP  BY f.id, t.name, f.match_date, sq.published
ORDER  BY t.name;

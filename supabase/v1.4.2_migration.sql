-- pavilion-app/supabase/v1.4.2_migration.sql
-- v1.4.2 DB migrations — run in Supabase SQL editor

-- 1. Track which team a captain is captain of (one row per team_member)
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_captain BOOLEAN NOT NULL DEFAULT false;

-- 2. Track if availability was set by admin/captain (yellow highlight)
ALTER TABLE availability ADD COLUMN IF NOT EXISTS set_by_admin BOOLEAN NOT NULL DEFAULT false;

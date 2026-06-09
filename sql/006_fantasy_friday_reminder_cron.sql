-- pavilion-app/sql/006_fantasy_friday_reminder_cron.sql
-- Friday 7pm fantasy pick reminder — via Supabase Edge Function + pg_cron
--
-- PREREQUISITES:
--   1. Enable pg_cron extension in Supabase: Database → Extensions → pg_cron
--   2. Enable pg_net  extension in Supabase: Database → Extensions → pg_net
--   3. Deploy Edge Function: supabase/functions/fantasy-reminder/index.ts (see companion file)
--
-- HOW IT WORKS:
--   pg_cron fires every Friday at 19:00 UTC (= 7pm UTC, adjust if BST offset needed)
--   → calls the Edge Function via HTTP
--   → Edge Function fetches all member push tokens from Supabase
--   → sends push via Expo Push API
--   → inserts in-app notifications for Alerts tab
--   → notification type 'fantasy_reminder' → tapping opens Fantasy League screen
--
-- RUN ONCE in Supabase SQL editor after deploying the Edge Function.

-- ─── Enable required extensions (safe if already enabled) ─────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── Schedule: every Friday at 19:00 UTC ──────────────────────────────────────
-- Cron syntax: minute hour day-of-month month day-of-week
-- '0 19 * * 5'  = 7pm every Friday (UTC)
-- If UK clocks are BST (+1), this fires at 8pm BST — adjust to '0 18 * * 5' for 7pm BST
-- For 7pm BST: use '0 18 * * 5' during summer, '0 19 * * 5' during winter (GMT)
-- Simplest: use '0 18 * * 5' (fires 6pm UTC = 7pm BST in summer, 6pm in winter)
-- Use '0 19 * * 5' for a pure 7pm GMT target — pick one and stick with it.

SELECT cron.schedule(
  'fantasy-friday-reminder',           -- job name (unique)
  '0 18 * * 5',                        -- 6pm UTC = 7pm BST (summer)
  $$
    SELECT net.http_post(
      url     := 'https://nqhhvataxjaecctvrrzc.supabase.co/functions/v1/fantasy-reminder',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xaGh2YXRheGphZWNjdHZycnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjQzMTUsImV4cCI6MjA4ODY0MDMxNX0.x6J_Ky43GdCpbrm9NeYqbJ3tKjWLr0vxHAkCgJqPQ0g'
      ),
      body    := '{}'::jsonb
    )
  $$
);

-- ─── Verify job created ────────────────────────────────────────────────────────
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'fantasy-friday-reminder';

-- ─── To remove/update the cron job later ──────────────────────────────────────
-- SELECT cron.unschedule('fantasy-friday-reminder');

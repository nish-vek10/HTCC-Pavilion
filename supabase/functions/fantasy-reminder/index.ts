// pavilion-app/supabase/functions/fantasy-reminder/index.ts
// Edge Function — sends Friday 7pm fantasy pick reminder to all members.
// Triggered by pg_cron (see sql/006_fantasy_friday_reminder_cron.sql).
//
// Deploy: supabase functions deploy fantasy-reminder
//
// Behaviour:
//   - Fetches all active members (role != 'pending') with push tokens
//   - Sends push via Expo Push API with type: 'fantasy_reminder'
//   - Inserts in-app notification row for each member (Alerts tab)
//   - Notification tap routes to Fantasy League (handled in App.jsx)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL  = 'https://exp.host/--/api/v2/push/send'
const ANDROID_CHANNEL = 'pavilion-default'

const NOTIF_TITLE = '⏰ Fantasy Deadline Reminder'
const NOTIF_BODY  = 'Picks lock tomorrow at 9:00 AM. Finalise your Fantasy XI before it\'s too late!'

serve(async (_req) => {
  try {
    // Use service role key — bypasses RLS to read all push tokens
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── Fetch all active members with push tokens ──────────────────────────────
    const { data: profiles, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, expo_push_token')
      .neq('role', 'pending')
      .not('expo_push_token', 'is', null)

    if (fetchErr) {
      console.error('[reminder] fetch profiles error:', fetchErr.message)
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 })
    }

    // Accept any non-null token — Expo handles invalid/stale tokens gracefully
    const tokens  = (profiles?.map(p => p.expo_push_token) || []).filter(t => t && t.trim().length > 0)
    const userIds = profiles?.map(p => p.id) || []

    console.log(`[reminder] ${profiles?.length ?? 0} profiles, ${tokens.length} push tokens`)

    // ── Send push to all ───────────────────────────────────────────────────────
    if (tokens.length > 0) {
      // Batch in chunks of 100 (Expo limit)
      for (let i = 0; i < tokens.length; i += 100) {
        const chunk = tokens.slice(i, i + 100).map(to => ({
          to,
          sound:     'default',
          title:     NOTIF_TITLE,
          body:      NOTIF_BODY,
          data:      { type: 'fantasy_reminder' },
          priority:  'high',
          channelId: ANDROID_CHANNEL,
          badge:     1,
          ttl:       86400,
        }))

        console.log(`[reminder] Sending chunk of ${chunk.length} pushes`)
        const res = await fetch(EXPO_PUSH_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body:    JSON.stringify(chunk),
        })

        const resText = await res.text()
        if (!res.ok) {
          console.warn('[reminder] Expo push HTTP error:', res.status, resText)
        } else {
          try {
            const result = JSON.parse(resText)
            const tickets = result?.data || []
            const errors  = tickets.filter((t: any) => t.status === 'error')
            console.log(`[reminder] Expo tickets: ${tickets.length} sent, ${errors.length} errors`)
            errors.forEach((t: any) => console.warn('[reminder] Ticket error:', t.message, t.details))
          } catch {
            console.log('[reminder] Expo response (raw):', resText)
          }
        }
      }
    } else {
      console.warn('[reminder] No push tokens found — skipping push send')
    }

    // ── Insert in-app notifications (Alerts tab) ───────────────────────────────
    if (userIds.length > 0) {
      const rows = userIds.map(userId => ({
        user_id: userId,
        type:    'fantasy_reminder',
        title:   NOTIF_TITLE,
        body:    NOTIF_BODY,
        read:    false,
      }))

      const { error: insertErr } = await supabase.from('notifications').insert(rows)
      if (insertErr) {
        console.warn('[reminder] insertNotifications error:', insertErr.message)
      }
    }

    console.log(`[reminder] Done — ${tokens.length} pushes sent, ${userIds.length} in-app notifications inserted`)
    return new Response(
      JSON.stringify({ success: true, pushed: tokens.length, notified: userIds.length }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[reminder] Unhandled error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})

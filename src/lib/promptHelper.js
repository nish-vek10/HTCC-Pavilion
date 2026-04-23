// pavilion-app/src/lib/promptHelper.js
// Shared prompt logic — persisted in availability_prompts table

import { supabase }       from './supabase'
import { sendPushToUser } from './pushNotifications'

// ── Fetch all prompted player IDs for a fixture ───────────────────────────
export const fetchPromptedPlayers = async (fixtureId) => {
  const { data, error } = await supabase
    .from('availability_prompts')
    .select('player_id')
    .eq('fixture_id', fixtureId)

  if (error) { console.warn('[promptHelper] fetch error:', error.message); return {} }

  const set = {}
  data?.forEach(r => { set[`${fixtureId}_${r.player_id}`] = true })
  return set
}

// ── Upsert prompt record + send in-app and push notification ─────────────
export const sendPromptNotification = async (fixtureId, playerId, promptedBy) => {
  // Upsert so re-prompting updates the timestamp
  const { error } = await supabase
    .from('availability_prompts')
    .upsert(
      { fixture_id: fixtureId, player_id: playerId, prompted_by: promptedBy },
      { onConflict: 'fixture_id,player_id' }
    )
  if (error) console.warn('[promptHelper] upsert error:', error.message)

  const notifTitle = 'Availability Reminder'
  const notifBody  = 'Your captain needs your availability response for the upcoming match.'

  // Insert in-app notification — fixture_id saved so tapping navigates to fixture detail
  const { error: notifErr } = await supabase.from('notifications').insert({
    user_id:    playerId,
    type:       'availability_reminder',
    title:      notifTitle,
    body:       notifBody,
    fixture_id: fixtureId,
    read:       false,
  })
  if (notifErr) console.warn('[promptHelper] notification insert error:', notifErr.message)

  // Send device push notification
  sendPushToUser(playerId, notifTitle, notifBody, { type: 'availability_reminder', fixture_id: fixtureId })
}
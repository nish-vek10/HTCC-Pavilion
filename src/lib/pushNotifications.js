// pavilion-app/src/lib/pushNotifications.js
// Central push notification helper — Expo Push API (no server needed)
// Handles: device token registration, push sending, in-app notification insertion
//
// Architecture:
//   Every alert fires TWO things:
//     1. sendPush*()         → device push (works when app is closed/backgrounded)
//     2. insertNotification*() → row in Supabase notifications table (Alerts tab)
//   Both must always be called together for consistency.

import * as Notifications from 'expo-notifications'
import * as Device       from 'expo-device'
import Constants          from 'expo-constants'
import { Platform }       from 'react-native'
import { supabase }       from './supabase'

// ─── Configurable ─────────────────────────────────────────────────────────────
const EXPO_PUSH_URL    = 'https://exp.host/--/api/v2/push/send'
const ANDROID_CHANNEL  = 'pavilion-default'
// ─────────────────────────────────────────────────────────────────────────────

// ─── Foreground notification handler ─────────────────────────────────────────
// Called when a push arrives while the app is OPEN.
// shouldShowAlert: true  → banner shown even in foreground
// shouldPlaySound: true  → sound plays in foreground
// shouldSetBadge:  true  → iOS badge updates in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
})

// ─── Android channel setup — exported so App.jsx can call this at startup ─────
// Must run BEFORE any push arrives. Called independently of registerPushToken
// so the channel exists even when the app is backgrounded / user denies permission.
// On iOS: no-op. On Android: idempotent — safe to call multiple times.
export const setupAndroidChannel = async () => {
  if (Platform.OS !== 'android') return
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name:             'Pavilion',
      importance:       Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       '#F5C518',
      sound:            'default',
      enableLights:     true,
      enableVibrate:    true,
      showBadge:        true,
    })
    console.log('[Push] Android channel ready:', ANDROID_CHANNEL)
  } catch (err) {
    console.warn('[Push] setupAndroidChannel error:', err.message)
  }
}

// ─── Register device push token and persist to profiles table ─────────────────
export const registerPushToken = async (userId) => {
  try {
    // Push tokens only exist on real physical devices
    if (!Device.isDevice) {
      console.log('[Push] Skipping — not a real device (simulator/emulator)')
      return
    }

    // Request permission if not already granted
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') {
      console.log('[Push] Permission denied — push notifications disabled')
      return
    }

    // Ensure Android channel exists before fetching token
    await setupAndroidChannel()

    // Expo project ID — hardcoded fallback ensures this never fails in production
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      '839c48f3-c7a2-4fbd-a9c8-98e76daef60e'

    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId })
    const token = tokenResult.data
    console.log('[Push] Token registered:', token)

    // Persist token to Supabase — used by all sendPush* functions
    await supabase
      .from('profiles')
      .update({ expo_push_token: token })
      .eq('id', userId)
  } catch (err) {
    console.warn('[Push] registerPushToken error:', err.message)
  }
}

// ─── Internal: clear a stale/invalid token from Supabase ─────────────────────
// Called when Expo returns DeviceNotRegistered — prevents silent failures forever.
const _clearStaleToken = async (token) => {
  try {
    await supabase
      .from('profiles')
      .update({ expo_push_token: null })
      .eq('expo_push_token', token)
    console.log('[Push] Cleared stale token:', token)
  } catch (err) {
    console.warn('[Push] _clearStaleToken error:', err.message)
  }
}

// ─── Internal: send to an array of Expo push token strings ───────────────────
// Batches up to 100 per request (Expo limit). Filters invalid tokens.
// priority: 'high' ensures immediate delivery on iOS and Android.
// channelId: ensures Android uses the correct notification channel.
const _sendToTokens = async (tokens, title, body, data = {}) => {
  const valid = (tokens || []).filter(t => t && t.startsWith('ExponentPushToken'))
  if (valid.length === 0) {
    console.log('[Push] No valid tokens — skipping send')
    return
  }

  const messages = valid.map(to => ({
    to,
    sound:     'default',
    title,
    body,
    data,
    priority:  'high',          // iOS: critical delivery, Android: heads-up notification
    channelId: ANDROID_CHANNEL, // Android: must match channel created in setupAndroidChannel
    badge:     1,               // iOS: badge count on app icon when closed/backgrounded
    ttl:       86400,           // 24-hour delivery window — don't drop if device offline
  }))

  try {
    // Expo recommends max 100 per batch — chunk for large clubs
    for (let i = 0; i < messages.length; i += 100) {
      const chunk  = messages.slice(i, i + 100)
      const res    = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body:    JSON.stringify(chunk),
      })

      if (!res.ok) {
        console.warn('[Push] Expo API HTTP error:', res.status, await res.text())
        continue
      }

      const result = await res.json()
      const tickets = result?.data || []

      // Log all ticket outcomes — ok tickets = accepted by Expo, not yet delivered
      tickets.forEach((ticket, idx) => {
        if (ticket.status === 'error') {
          const token = chunk[idx]?.to
          console.warn('[Push] Ticket error:', ticket.message, ticket.details, 'token:', token)

          // DeviceNotRegistered = token is permanently dead — clear from Supabase
          if (ticket.details?.error === 'DeviceNotRegistered' && token) {
            _clearStaleToken(token)
          }
        } else {
          console.log('[Push] Ticket ok — id:', ticket.id, 'to:', chunk[idx]?.to)
        }
      })
    }
  } catch (err) {
    console.warn('[Push] _sendToTokens error:', err.message)
  }
}

// ─── Send push to a single user by Supabase user ID ──────────────────────────
export const sendPushToUser = async (userId, title, body, data = {}) => {
  if (!userId) return
  // maybeSingle() returns null (not an error) when row not found — safe with RLS
  const { data: profile } = await supabase
    .from('profiles')
    .select('expo_push_token')
    .eq('id', userId)
    .maybeSingle()
  if (profile?.expo_push_token) {
    await _sendToTokens([profile.expo_push_token], title, body, data)
  }
}

// ─── Send push to multiple users by Supabase user IDs ────────────────────────
export const sendPushToUsers = async (userIds, title, body, data = {}) => {
  if (!userIds?.length) return
  const { data: profiles } = await supabase
    .from('profiles')
    .select('expo_push_token')
    .in('id', userIds)
  const tokens = profiles?.map(p => p.expo_push_token).filter(Boolean) || []
  await _sendToTokens(tokens, title, body, data)
}

// ─── Send push to all members of a given role ─────────────────────────────────
// targetRole: 'all' | 'member' | 'captain' | 'admin'
// Role hierarchy for notifications:
//   'admin'   → admin + superadmin
//   'captain' → captain + admin + superadmin (admins manage captains, should receive)
//   'member'  → member only
//   'all'     → everyone (excludes pending — they can't log in yet)
export const sendPushToRole = async (targetRole, title, body, data = {}) => {
  let query = supabase.from('profiles').select('expo_push_token').neq('role', 'pending')

  if (targetRole === 'admin') {
    // Admin announcements go to admin + superadmin
    query = query.in('role', ['admin', 'superadmin'])
  } else if (targetRole === 'captain') {
    // Captain-targeted notifications also go to admins who oversee captains
    query = query.in('role', ['captain', 'admin', 'superadmin'])
  } else if (targetRole !== 'all') {
    // 'member' or any other specific role
    query = query.eq('role', targetRole)
  }
  // 'all' — no role filter, includes everyone except pending

  const { data: profiles, error } = await query
  if (error) {
    console.warn('[Push] sendPushToRole query error:', error.message)
    return
  }
  const tokens = profiles?.map(p => p.expo_push_token).filter(Boolean) || []
  console.log(`[Push] sendPushToRole(${targetRole}) — ${tokens.length} valid tokens`)
  await _sendToTokens(tokens, title, body, data)
}

// ─── Insert a single in-app notification row into Supabase ───────────────────
// Always call alongside sendPushToUser to keep the Alerts tab in sync.
// fixture_id is optional — when set, tapping the notification navigates to that fixture.
export const insertNotification = async (userId, type, title, body, extra = {}) => {
  if (!userId) return
  const { error } = await supabase.from('notifications').insert({
    user_id: userId, type, title, body, read: false, ...extra,
  })
  if (error) console.warn('[Push] insertNotification error:', error.message)
}

// ─── Insert in-app notifications for multiple user IDs ───────────────────────
export const insertNotifications = async (userIds, type, title, body, extra = {}) => {
  if (!userIds?.length) return
  const rows = userIds.map(userId => ({
    user_id: userId, type, title, body, read: false, ...extra,
  }))
  const { error } = await supabase.from('notifications').insert(rows)
  if (error) console.warn('[Push] insertNotifications error:', error.message)
}

// ─── Insert in-app notifications for all members of a role ───────────────────
// Mirrors the same role hierarchy as sendPushToRole for consistency.
export const insertNotificationsForRole = async (targetRole, type, title, body, extra = {}) => {
  let query = supabase.from('profiles').select('id').neq('role', 'pending')

  if (targetRole === 'admin') {
    query = query.in('role', ['admin', 'superadmin'])
  } else if (targetRole === 'captain') {
    query = query.in('role', ['captain', 'admin', 'superadmin'])
  } else if (targetRole !== 'all') {
    query = query.eq('role', targetRole)
  }

  const { data: profiles } = await query
  const userIds = profiles?.map(p => p.id) || []
  await insertNotifications(userIds, type, title, body, extra)
}

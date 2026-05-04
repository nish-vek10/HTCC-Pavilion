// pavilion-app/src/store/authStore.js
// Mirrors pavilion-web/src/store/authStore.js — signIn + signUp methods included

import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { ROLES } from '../lib/constants'

const useAuthStore = create((set, get) => ({
  // ─── State ──────────────────────────────────────────────────────────────────
  session:            null,
  profile:            null,
  loading:            true,
  isPasswordRecovery: false,

  // ─── Setters ────────────────────────────────────────────────────────────────
  setSession:            (session)  => set({ session }),
  setProfile:            (profile)  => set({ profile }),
  setLoading:            (loading)  => set({ loading }),
  setPasswordRecovery:   (val)      => set({ isPasswordRecovery: val }),

  // ─── Fetch profile row from Supabase after login ──────────────────────────
  fetchProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()   // returns null (not an error) when no row found yet

    if (error) {
      console.error('fetchProfile error:', error.message)
      return null
    }
    if (!data) return null  // profile row not ready yet — auth listener will retry
    set({ profile: data })
    return data
  },

  // ─── Sign in — mirrors web signIn ─────────────────────────────────────────
  signIn: async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email:    email.trim().toLowerCase(),
      password,
    })
    if (error) throw error

    const profile = await get().fetchProfile(data.user.id)
    set({ session: data.session })
    return { session: data.session, profile }
  },

  // ─── Sign up — mirrors web signUp ─────────────────────────────────────────
  signUp: async ({ email, password, fullName, phone, phoneCode }) => {
    const { data, error } = await supabase.auth.signUp({
      email:    email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: 'pavilion://login',
        data: {
          full_name:  fullName.trim(),
          phone_code: phoneCode || '+44',
          phone:      phone?.trim() || null,
        },
      },
    })
    if (error) throw error

    // ── Notify all admins that a new member is awaiting approval ─────────────
    try {
      const { sendPushToRole, insertNotificationsForRole } = await import('../lib/pushNotifications')
      const notifTitle = 'New Member Application'
      const notifBody  = `${fullName.trim()} has registered and is awaiting approval.`
      sendPushToRole('admin', notifTitle, notifBody, { type: 'approval' })
      insertNotificationsForRole('admin', 'approval', notifTitle, notifBody)
    } catch (err) {
      console.warn('[Auth] Admin notify error:', err.message)
    }

    return data
  },

  // ─── Save Expo push token ─────────────────────────────────────────────────
  savePushToken: async (token) => {
    const { profile } = get()
    if (!profile?.id || !token) return
    await supabase
      .from('profiles')
      .update({ expo_push_token: token })
      .eq('id', profile.id)
  },

  // ─── Sign out ─────────────────────────────────────────────────────────────
  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, profile: null })
  },

  // ─── Notification badge count ─────────────────────────────────────────────
  unreadCount:     0,
  setUnreadCount:  (n) => set({ unreadCount: n }),

  // ─── Role helpers — identical to web ─────────────────────────────────────
  isAdmin:      () => ['admin', 'superadmin'].includes(get().profile?.role),
  isCaptain:    () => get().profile?.role === ROLES.CAPTAIN,
  isSuperAdmin: () => get().profile?.role === ROLES.SUPERADMIN,
  isPending:    () => get().profile?.role === ROLES.PENDING,
}))

export default useAuthStore
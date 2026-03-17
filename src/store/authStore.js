// pavilion-web/src/store/authStore.js

import { create } from 'zustand'
import { supabase } from '../lib/supabase.js'
import { ROLES } from '../lib/constants.js'

// ─────────────────────────────────────────────────
// Zustand auth store — single source of truth for
// the current user's session, profile, and role.
// ─────────────────────────────────────────────────

export const useAuthStore = create((set, get) => ({

  // ── State ──────────────────────────────────────
  user:        null,   // Supabase auth user object
  profile:     null,   // Row from public.profiles
  session:     null,   // Supabase session
  loading:     true,   // True while checking session on mount
  initialized: false,  // True once first session check is done

  // ── Computed helpers ───────────────────────────
  isAuthenticated: () => !!get().user,
  isPending:    () => get().profile?.role === ROLES.PENDING,
  isMember:     () => ['member','captain','admin','superadmin'].includes(get().profile?.role),
  isCaptain:    () => ['captain','admin','superadmin'].includes(get().profile?.role),
  isAdmin:      () => ['admin','superadmin'].includes(get().profile?.role),
  isSuperAdmin: () => get().profile?.role === ROLES.SUPERADMIN,

  // ── Fetch profile from public.profiles ─────────
  fetchProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('[AuthStore] Failed to fetch profile:', error.message)
      return null
    }
    return data
  },

  // ── Initialise: called once on app mount ───────
  // Checks for existing session and subscribes to auth changes
  init: async () => {
    // Check current session
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      const profile = await get().fetchProfile(session.user.id)
      set({ user: session.user, session, profile, loading: false, initialized: true })
    } else {
      set({ user: null, session: null, profile: null, loading: false, initialized: true })
    }

    // Subscribe to future auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await get().fetchProfile(session.user.id)
        set({ user: session.user, session, profile, loading: false })
      }
      if (event === 'SIGNED_OUT') {
        set({ user: null, session: null, profile: null, loading: false })
      }
      if (event === 'USER_UPDATED') {
        const profile = await get().fetchProfile(session.user.id)
        set({ profile })
      }
    })
  },

  // ── Sign up ────────────────────────────────────
  signUp: async ({ email, password, fullName, phone }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // After email confirmation, redirect directly to /pending
        emailRedirectTo: window.location.origin + '/pending',
        data: {
          full_name: fullName,
          phone:     phone || null,
        },
      },
    })
    if (error) throw error
    return data
  },

  // ── Sign in ────────────────────────────────────
  signIn: async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error

    // Fetch profile immediately after sign in
    const profile = await get().fetchProfile(data.user.id)
    set({ user: data.user, session: data.session, profile })
    return { user: data.user, profile }
  },

  // ── Sign out ───────────────────────────────────
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, profile: null })
  },

  // ── Update profile fields ──────────────────────
  updateProfile: async (fields) => {
    const userId = get().user?.id
    if (!userId) return

    const { data, error } = await supabase
      .from('profiles')
      .update(fields)
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    set({ profile: data })
    return data
  },
}))
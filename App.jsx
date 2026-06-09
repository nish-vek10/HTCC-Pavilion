// pavilion-app/App.jsx

import 'react-native-url-polyfill/auto'
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { AppState } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue'
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans'

import { supabase }            from './src/lib/supabase'
import useAuthStore            from './src/store/authStore'
import RootNavigator           from './src/navigation/RootNavigator'
import SplashScreen            from './src/components/SplashV2_Fusion'
import ForceUpdateScreen       from './src/components/ForceUpdateScreen'
import ErrorBoundary           from './src/components/ErrorBoundary'
import { registerPushToken, setupAndroidChannel } from './src/lib/pushNotifications'
import * as Notifications      from 'expo-notifications'
import * as Linking            from 'expo-linking'
import * as Application        from 'expo-application'
import { SCREENS }             from './src/lib/constants'

// ─── CONFIGURABLE ──────────────────────────────────────────────────────────────
// Minimum time splash screen is shown in ms — 2200 covers animation + font load
const MIN_SPLASH_MS = 5000
// ───────────────────────────────────────────────────────────────────────────────

// ─── Deep link config — maps pavilion:// URLs to navigator screens ────────────
// Linking.createURL('/') resolves to exp:// in Expo Go and pavilion:// in production
// Both prefixes listed so email confirmation links work in both environments
const linking = {
  prefixes: [Linking.createURL('/'), 'pavilion://'],
  config: {
    screens: {
      // Maps pavilion://login → Auth stack → Login screen
      // Maps pavilion://reset-password → handled via PASSWORD_RECOVERY onAuthStateChange
      Auth: {
        screens: {
          Login:         'login',
          ForgotPassword: 'forgot-password',
        },
      },
    },
  },
}

export default function App() {
  const { setSession, fetchProfile, setLoading, setPasswordRecovery } = useAuthStore()

  // ─── Navigation ref — used for imperative navigation from push handlers ────
  const navigationRef = useRef(null)

  // ─── Force update gate ────────────────────────────────────────────────────
  const [updateRequired, setUpdateRequired] = useState(false)

  // ─── Track minimum splash display time ───────────────────────────────────
  const [splashDone, setSplashDone] = useState(false)

  // ─── Load brand fonts ─────────────────────────────────────────────────────
  const [fontsLoaded] = useFonts({
    BebasNeue:       BebasNeue_400Regular,
    DMSans:          DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-Bold':   DMSans_700Bold,
  })

  // ─── Android notification channel — must be created before any push arrives ──
  // Runs at app startup independently of registerPushToken and permission status.
  // Ensures the OS-level channel 'pavilion-default' exists for background delivery.
  // No-op on iOS. Idempotent on Android — safe to call every launch.
  useEffect(() => { setupAndroidChannel() }, [])

  // ─── Splash timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), MIN_SPLASH_MS)
    return () => clearTimeout(timer)
  }, [])

  // ─── Force update check — compare app version against Supabase min_required_version ──
  // Runs once on mount. If current version < min_required_version, blocks the entire app.
  // To enforce a new minimum: update app_config set value = '1.x.x' where key = 'min_required_version'
  useEffect(() => {
    const checkVersion = async () => {
      try {
        const { data } = await supabase
          .from('app_config')
          .select('value')
          .eq('key', 'min_required_version')
          .single()
        if (!data?.value) return
        const current  = Application.nativeApplicationVersion || '0.0.0'
        const required = data.value
        // Compare semver segments: [major, minor, patch]
        const toNum = (v) => v.split('.').map(Number)
        const [cM, cm, cp] = toNum(current)
        const [rM, rm, rp] = toNum(required)
        const outdated =
          cM < rM ||
          (cM === rM && cm < rm) ||
          (cM === rM && cm === rm && cp < rp)
        if (outdated) setUpdateRequired(true)
      } catch (_) {
        // Network failure — fail open, never block on connectivity issues
      }
    }
    checkVersion()
  }, [])

  // ─── AppState — freeze prevention on background/foreground transition ─────
  // On older iOS/Android devices, returning from background can freeze the JS
  // thread. Supabase's auto token refresh fires TOKEN_REFRESHED which is safe,
  // but if the session somehow becomes null briefly, loading=true shows a blank
  // screen. This listener ensures loading is never stuck on foreground return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        // App just foregrounded — ensure loading gate is cleared.
        // Auth state is handled by onAuthStateChange (TOKEN_REFRESHED).
        // Only force-clear loading if it was stuck from a previous cycle.
        const { loading, session } = useAuthStore.getState()
        if (loading) setLoading(false)
        // Re-register push token on every foreground — OS can rotate tokens
        // after OS updates, app reinstalls, or long background periods.
        if (session?.user?.id) registerPushToken(session.user.id)
      }
    })
    return () => sub.remove()
  }, [])

  // ─── Auth resolution ──────────────────────────────────────────────────────
  useEffect(() => {
    // Fast-path: read persisted session from SecureStore (~50ms, local read).
    // Resolves loading=false well before the splash timer ends — guarantees
    // RootNavigator never renders with loading=true after splash dismisses,
    // even on slow networks or when Supabase is under concurrent load.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        await fetchProfile(session.user.id)
        registerPushToken(session.user.id)
      }
      setLoading(false)
    })

    // Long-lived listener for subsequent auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // INITIAL_SESSION: already handled by getSession() above.
        // Skip to avoid double fetchProfile call on cold start.
        if (event === 'INITIAL_SESSION') return

        // TOKEN_REFRESHED: JWT auto-renewed in background (~hourly).
        // Update session only — no profile re-fetch needed.
        // Prevents unnecessary Supabase query + re-render chain on foreground return.
        if (event === 'TOKEN_REFRESHED') {
          setSession(session)
          return
        }

        // PASSWORD_RECOVERY — user tapped reset link in email
        // Flag recovery mode so RootNavigator shows ResetPasswordScreen
        if (event === 'PASSWORD_RECOVERY') {
          setSession(session)
          setPasswordRecovery(true)
          setLoading(false)
          return
        }

        // All other events: SIGNED_IN, SIGNED_OUT, USER_UPDATED
        setSession(session)
        if (session?.user) {
          await fetchProfile(session.user.id)
          registerPushToken(session.user.id)
        }
        setLoading(false)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  // ─── Real-time profile listener — pending → member auto-advance ────────────
  // When an admin approves a pending user, the profile.role changes in Supabase.
  // Without this, the user must kill and restart the app to get past PendingScreen.
  // This subscription fires immediately on role change and re-fetches the profile,
  // which causes RootNavigator to re-evaluate and advance to MemberNavigator.
  useEffect(() => {
    const { session } = useAuthStore.getState()
    const userId = session?.user?.id
    if (!userId) return

    const channel = supabase
      .channel(`profile-role-watch-${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles',
        filter: `id=eq.${userId}`,
      }, async (payload) => {
        const newRole = payload.new?.role
        if (newRole && newRole !== 'pending') {
          // Role changed — refresh full profile so RootNavigator re-renders
          await fetchProfile(userId)
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  // ─── Deep link URL handler ────────────────────────────────────────────────
  // Supabase processes auth tokens in incoming URLs via onAuthStateChange.
  // This listener captures both cold-start and warm-start deep links.
  const handleDeepLink = useCallback((url) => {
    if (!url) return
    console.log('[DeepLink] Received URL:', url)
  }, [])

  useEffect(() => {
    Linking.getInitialURL().then(url => { if (url) handleDeepLink(url) })
    const urlSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url))
    return () => urlSub.remove()
  }, [handleDeepLink])

  // ─── Push notification routing ────────────────────────────────────────────
  // Routes notification taps to correct screen based on data payload.
  // Shared between backgrounded tap and cold-start tap.
  const handleNotificationResponse = useCallback((response) => {
    const data = response?.notification?.request?.content?.data
    if (!data || !navigationRef.current) return
    console.log('[Push] Routing notification:', data)

    // Training reminder → open session modal in Fixtures tab
    if (data.type === 'training_reminder' && data.session_id) {
      navigationRef.current.navigate(SCREENS.FIXTURES, { openSessionId: data.session_id })
      return
    }
    // Fantasy notifications → Fantasy League
    if (
      data.type === 'fantasy_unlocked'     ||
      data.type === 'fantasy_reminder'     ||
      data.type === 'fantasy_pick_removed' ||
      data.type === 'fantasy_points_updated'
    ) {
      navigationRef.current.navigate(SCREENS.FANTASY_LEAGUE)
      return
    }
    // Admin approval notifications → Admin Dashboard
    if (data.type === 'approval') {
      navigationRef.current.navigate(SCREENS.ADMIN_DASHBOARD)
      return
    }
    // Fixture-linked notifications → go straight to fixture detail
    if (data.fixture_id) {
      navigationRef.current.navigate(SCREENS.FIXTURE_DETAIL, { fixtureId: data.fixture_id })
      return
    }
    // All other types → open notifications inbox
    navigationRef.current.navigate(SCREENS.NOTIFICATIONS)
  }, [])

  // ─── Push notification listeners — must live here for full lifecycle ──────
  useEffect(() => {
    // Listener 1: user TAPS a notification (from backgrounded or cold-start state)
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    )

    // Listener 2: notification ARRIVES while app is open (foreground)
    // setNotificationHandler already shows the banner — this listener updates
    // the in-app unread badge count immediately without waiting for Supabase real-time.
    const receiveSub = Notifications.addNotificationReceivedListener(() => {
      // Increment the Zustand badge count directly — avoids a round-trip to Supabase
      const current = useAuthStore.getState().unreadCount
      useAuthStore.getState().setUnreadCount(current + 1)
    })

    // Listener 3: tap from cold-start (app was fully closed)
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) handleNotificationResponse(response)
    })

    return () => {
      responseSub.remove()
      receiveSub.remove()
    }
  }, [handleNotificationResponse])

  // ─── Show splash until fonts loaded AND minimum time elapsed ─────────────
  // After this gate, loading=false is guaranteed (getSession resolves in ~50ms)
  // RootNavigator handles any remaining transitional states via AppLoader
  if (!fontsLoaded || !splashDone) return <SplashScreen />

  // ─── Force update gate — blocks entire app if version is outdated ─────────
  if (updateRequired) return <ForceUpdateScreen />

  return (
    <ErrorBoundary>
      <NavigationContainer ref={navigationRef} linking={linking}>
        <RootNavigator />
      </NavigationContainer>
    </ErrorBoundary>
  )
}
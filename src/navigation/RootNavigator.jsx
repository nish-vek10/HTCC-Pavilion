// pavilion-app/src/navigation/RootNavigator.jsx
// Root navigator — auth gate + role-based navigator

import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import useAuthStore          from '../store/authStore'
import { ROLES }             from '../lib/constants'
import AppLoader             from '../components/AppLoader'

import AuthNavigator          from './AuthNavigator'
import MemberNavigator        from './MemberNavigator'
import AdminNavigator         from './AdminNavigator'
import CaptainNavigator       from './CaptainNavigator'
import ResetPasswordScreen    from '../screens/public/ResetPasswordScreen'

const Stack = createNativeStackNavigator()
const NO_HEADER = { headerShown: false }

export default function RootNavigator() {
  const session            = useAuthStore(s => s.session)
  const profile            = useAuthStore(s => s.profile)
  const loading            = useAuthStore(s => s.loading)
  const isPasswordRecovery = useAuthStore(s => s.isPasswordRecovery)

  // Auth state still resolving — show branded loader, never null/black
  if (loading) return <AppLoader />

  // PASSWORD_RECOVERY deep link — show reset screen regardless of auth state
  if (isPasswordRecovery) {
    return (
      <Stack.Navigator key="password-recovery" screenOptions={NO_HEADER}>
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      </Stack.Navigator>
    )
  }

  // No session — unauthenticated flow
  if (!session) {
    return (
      <Stack.Navigator key="no-session" screenOptions={NO_HEADER}>
        <Stack.Screen name="Auth" component={AuthNavigator} />
      </Stack.Navigator>
    )
  }

  // Session exists but profile not yet loaded from Supabase.
  // Can happen under load (many concurrent users) or slow network.
  // Show branded loader — never show auth screens to an authenticated user.
  if (!profile) return <AppLoader />

  // Pending approval — show auth navigator (PendingScreen)
  if (profile.role === ROLES.PENDING) {
    return (
      <Stack.Navigator key="pending" screenOptions={NO_HEADER}>
        <Stack.Screen name="Auth" component={AuthNavigator} />
      </Stack.Navigator>
    )
  }

  // Authenticated + profile loaded — render role-based navigator
  return (
    <Stack.Navigator screenOptions={NO_HEADER}>
      {/* Member tabs — always the base layer */}
      <Stack.Screen name="Member" component={MemberNavigator} />

      {/* Admin panel — pushed over member view */}
      <Stack.Screen
        name="AdminPanel"
        component={AdminNavigator}
        options={{ animation: 'slide_from_right' }}
      />

      {/* Captain panel — pushed over member view */}
      <Stack.Screen
        name="CaptainPanel"
        component={CaptainNavigator}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  )
}
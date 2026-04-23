// pavilion-app/src/screens/public/LoginScreen.jsx
// Mirrors pavilion-web/src/pages/public/LoginPage.jsx

import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import useAuthStore from '../../store/authStore'
import { SCREENS, APP_NAME, CLUB_SHORT, ROLES } from '../../lib/constants'
import { colors, fonts, spacing, radius } from '../../theme'

export default function LoginScreen({ navigation }) {
  // ─── Form state ───────────────────────────────────────────────────────────
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const { signIn } = useAuthStore()

  // ─── Submit ───────────────────────────────────────────────────────────────
  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }
    setError('')
    setLoading(true)

    try {
      const { profile } = await signIn({ email, password })

      // Pending users → PendingScreen (RootNavigator handles this automatically
      // via onAuthStateChange, but we handle it here too for clarity)
      if (profile?.role === ROLES.PENDING) {
        navigation.navigate(SCREENS.PENDING)
      }
      // All other roles → RootNavigator reroutes automatically
    } catch (err) {
      if (err.message?.includes('Invalid login')) {
        setError('Incorrect email or password. Please try again.')
      } else if (err.message?.includes('Email not confirmed')) {
        setError('Please verify your email before signing in.')
      } else {
        setError(err.message || 'Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── HTCC Crest ── */}
          <View style={styles.crestWrap}>
            <Image
              source={require('../../../assets/htcc-logo.png')}
              style={styles.crestImage}
              resizeMode="cover"
            />
          </View>

          {/* ── Heading ── */}
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.subHeading}>Sign in to your {CLUB_SHORT} account</Text>

          {/* ── Error banner ── */}
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── Form card ── */}
          <View style={styles.card}>

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!loading}
            />

            {/* Password */}
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity onPress={() => setShowPw(p => !p)}>
                <Text style={styles.showHide}>{showPw ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              editable={!loading}
            />

            {/* Sign In button */}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>
                {loading ? 'Signing in…' : 'Sign In →'}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Sign up link */}
            <Text style={styles.switchText}>
              Not a member yet?{' '}
              <Text
                style={styles.switchLink}
                onPress={() => navigation.navigate(SCREENS.SIGNUP)}
              >
                Join HTCC
              </Text>
            </Text>
          </View>

          {/* Back to Welcome */}
          <TouchableOpacity
            onPress={() => navigation.navigate(SCREENS.WELCOME)}
            style={styles.backLink}
          >
            <Text style={styles.backLinkText}>← Back to home</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.navy },
  scroll: { flexGrow: 1, alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl },

  crestWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.navy,
    borderWidth: 2, borderColor: colors.gold,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
    marginBottom: spacing.md,
  },
  crestImage:  { width: '100%', height: '100%' },
  appName:     { fontFamily: fonts.display, fontSize: 28, letterSpacing: 2, color: colors.white, marginBottom: 4 },
  subHeading:  { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginBottom: spacing.xl },

  errorBanner: {
    width: '100%', backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: radius.md, padding: 12,
    marginBottom: spacing.md,
  },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.red },

  card: {
    width: '100%',
    backgroundColor: colors.navyLight,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg,
  },

  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, marginTop: spacing.sm },
  label:    { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginBottom: 6, marginTop: spacing.sm },
  showHide: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },

  input: {
    backgroundColor: colors.navy,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: 14,
    color: colors.white, fontFamily: fonts.body, fontSize: 15,
    marginBottom: spacing.sm,
  },

  btn: {
    width: '100%', backgroundColor: colors.gold,
    padding: 15, borderRadius: radius.md,
    alignItems: 'center', marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { fontFamily: fonts.body, fontWeight: '700', fontSize: 15, color: colors.navy },

  divider: {
    height: 1, backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  switchText: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  switchLink: { color: colors.gold, fontWeight: '600' },

  backLink:     { marginTop: spacing.lg },
  backLinkText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
})
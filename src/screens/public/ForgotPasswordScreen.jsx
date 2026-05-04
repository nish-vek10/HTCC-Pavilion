// pavilion-app/src/screens/public/ForgotPasswordScreen.jsx
// Forgot password — user enters email, Supabase sends reset link

import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase }     from '../../lib/supabase'
import { SCREENS }      from '../../lib/constants'
import { colors, fonts, spacing, radius } from '../../theme'

export default function ForgotPasswordScreen({ navigation }) {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [sent,    setSent]    = useState(false)

  async function handleSend() {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setError('Please enter your email address.')
      return
    }
    setError('')
    setLoading(true)

    try {
      const { error: supaErr } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: 'pavilion://reset-password',
      })
      if (supaErr) throw supaErr
      setSent(true)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
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
          <Text style={styles.appName}>RESET PASSWORD</Text>
          <Text style={styles.subHeading}>
            {sent
              ? 'Check your inbox for a reset link'
              : "Enter your email and we'll send you a reset link"
            }
          </Text>

          {/* ── Error banner ── */}
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── Success state ── */}
          {sent ? (
            <View style={styles.card}>
              <View style={styles.successBanner}>
                <Text style={styles.successText}>
                  Reset link sent to {email.trim().toLowerCase()}
                </Text>
                <Text style={styles.successSub}>
                  Tap the link in the email to set a new password. Check your spam folder if you don't see it.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.btn}
                onPress={() => navigation.navigate(SCREENS.LOGIN)}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>Back to Sign In →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ── Form card ── */
            <View style={styles.card}>
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

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleSend}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>
                  {loading ? 'Sending…' : 'Send Reset Link →'}
                </Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <Text style={styles.switchText}>
                Remember your password?{' '}
                <Text
                  style={styles.switchLink}
                  onPress={() => navigation.navigate(SCREENS.LOGIN)}
                >
                  Sign In
                </Text>
              </Text>
            </View>
          )}

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
  subHeading:  { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginBottom: spacing.xl, textAlign: 'center', paddingHorizontal: spacing.md },

  errorBanner: {
    width: '100%', backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: radius.md, padding: 12,
    marginBottom: spacing.md,
  },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.red },

  successBanner: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: radius.md, padding: 14,
    marginBottom: spacing.lg, gap: 8,
  },
  successText: { fontFamily: fonts.bold, fontSize: 14, color: '#4ADE80' },
  successSub:  { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, lineHeight: 18 },

  card: {
    width: '100%',
    backgroundColor: colors.navyLight,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg,
  },

  label: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginBottom: 6, marginTop: spacing.sm },

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
})

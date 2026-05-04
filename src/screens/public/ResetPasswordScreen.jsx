// pavilion-app/src/screens/public/ResetPasswordScreen.jsx
// Set new password — reached via deep link from Supabase reset email
// Supabase PASSWORD_RECOVERY event establishes temp session before this screen renders

import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Image, Alert,
} from 'react-native'
import { SafeAreaView }    from 'react-native-safe-area-context'
import { supabase }        from '../../lib/supabase'
import useAuthStore        from '../../store/authStore'
import { SCREENS }         from '../../lib/constants'
import { colors, fonts, spacing, radius } from '../../theme'

export default function ResetPasswordScreen({ navigation }) {
  const setPasswordRecovery = useAuthStore(s => s.setPasswordRecovery)

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [showCf,    setShowCf]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  async function handleReset() {
    if (!password || !confirm) {
      setError('Please fill in both fields.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setError('')
    setLoading(true)

    try {
      const { error: supaErr } = await supabase.auth.updateUser({ password })
      if (supaErr) throw supaErr

      // Clear recovery mode — RootNavigator will route normally
      setPasswordRecovery(false)
      await supabase.auth.signOut()

      Alert.alert(
        'Password Updated',
        'Your password has been reset. Please sign in with your new password.',
        [{ text: 'Sign In', onPress: () => {} }]
      )
    } catch (err) {
      setError(err.message || 'Failed to update password. Please try again.')
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
          <Text style={styles.appName}>NEW PASSWORD</Text>
          <Text style={styles.subHeading}>Choose a strong password for your account</Text>

          {/* ── Error banner ── */}
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── Form card ── */}
          <View style={styles.card}>

            {/* New password */}
            <View style={styles.labelRow}>
              <Text style={styles.label}>New Password</Text>
              <TouchableOpacity onPress={() => setShowPw(p => !p)}>
                <Text style={styles.showHide}>{showPw ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Min. 8 characters"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              editable={!loading}
            />

            {/* Confirm password */}
            <View style={styles.labelRow}>
              <Text style={styles.label}>Confirm Password</Text>
              <TouchableOpacity onPress={() => setShowCf(p => !p)}>
                <Text style={styles.showHide}>{showCf ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showCf}
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleReset}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>
                {loading ? 'Updating…' : 'Set New Password →'}
              </Text>
            </TouchableOpacity>
          </View>

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
  subHeading:  { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginBottom: spacing.xl, textAlign: 'center' },

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
  label:    { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
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
})

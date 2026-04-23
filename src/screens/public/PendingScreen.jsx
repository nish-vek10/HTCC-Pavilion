// pavilion-app/src/screens/public/PendingScreen.jsx
// Mirrors pavilion-web/src/pages/public/PendingPage.jsx
// Shows 4-step progress list identical to the web version

import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import useAuthStore from '../../store/authStore'
import { APP_NAME, CLUB_NAME, SCREENS } from '../../lib/constants'
import { colors, fonts, spacing, radius } from '../../theme'
import AppIcon from '../../components/AppIcon'

// ─── Configurable: mirrors PendingPage steps exactly ─────────────────────────
// icon field maps to AppIcon names from icons.js
const STEPS = [
  { icon: 'approve',    title: 'Account Created',    desc: 'Your details have been submitted.',        done: true,  active: false },
  { icon: 'pending',    title: 'Admin Review',        desc: 'Awaiting approval from HTCC committee.',  done: false, active: true  },
  { icon: 'alerts',     title: 'You\'ll be notified', desc: 'Push notification sent once approved.',   done: false, active: false },
  { icon: 'cricketBat', title: 'Full Access',         desc: 'Set availability and view your squad.',   done: false, active: false },
]

export default function PendingScreen({ navigation }) {
  const { signOut, session } = useAuthStore()

  // ─── Reactively navigate to Welcome when session clears ──────────────────
  // Watching session in useEffect is more reliable than navigating
  // imperatively in the button handler — fires after state settles
  useEffect(() => {
    if (!session) {
      navigation.reset({ index: 0, routes: [{ name: SCREENS.WELCOME }] })
    }
  }, [session])

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
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
        <Text style={styles.heading}>AWAITING APPROVAL</Text>
        <Text style={styles.subHeading}>
          Your registration for{' '}
          <Text style={{ color: colors.white, fontWeight: '700' }}>{CLUB_NAME}</Text>{' '}
          has been received. An admin will review and approve your account shortly.
        </Text>

        {/* ── Steps card — mirrors web step list ── */}
        <View style={styles.card}>
          {STEPS.map((step, i) => {
            // Icon tint: done = green, active = gold, inactive = textMuted
            const iconTint = step.done ? colors.green : step.active ? colors.gold : colors.textMuted
            return (
              <View
                key={step.title}
                style={[
                  styles.stepRow,
                  step.done   && styles.stepRowDone,
                  step.active && styles.stepRowActive,
                  i < STEPS.length - 1 && styles.stepRowBorder,
                ]}
              >
                {/* AppIcon replaces emoji — tinted by step state */}
                <AppIcon name={step.icon} size={20} tint={iconTint} />
                <View style={styles.stepContent}>
                  <Text style={[
                    styles.stepTitle,
                    !step.done && !step.active && styles.stepTitleMuted,
                    step.active && styles.stepTitleActive,
                  ]}>
                    {step.title}
                  </Text>
                  <Text style={[
                    styles.stepDesc,
                    step.active && styles.stepDescActive,
                  ]}>
                    {step.desc}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>

        {/* ── Footer note ── */}
        <Text style={styles.note}>
          Questions? Contact your HTCC admin directly.
        </Text>

        {/* ── Sign out ── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* ── Powered by ── */}
        <Text style={styles.powered}>
          {APP_NAME} · {CLUB_NAME}
        </Text>

      </ScrollView>
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
    shadowOpacity: 0.35, shadowRadius: 18, elevation: 12,
    marginBottom: spacing.lg,
  },
  crestImage:  { width: '100%', height: '100%' },
  heading:     { fontFamily: fonts.display, fontSize: 26, letterSpacing: 3, color: colors.white, marginBottom: spacing.sm, textAlign: 'center' },
  subHeading:  { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },

  // ── Steps card ───────────────────────────────────────────────────────────────
  card: {
    width: '100%',
    backgroundColor: colors.navyLight,
    borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)',
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, opacity: 0.5,
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  stepRowDone:   { opacity: 1, backgroundColor: 'rgba(34,197,94,0.04)' },
  stepRowActive: { opacity: 1, backgroundColor: 'rgba(245,197,24,0.04)' },
  stepTitleActive: { color: colors.gold },
  stepDescActive:  { color: colors.textMuted },
  stepRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  stepContent:   { flex: 1 },
  stepTitle:     { fontFamily: fonts.body, fontWeight: '700', fontSize: 14, color: colors.white, marginBottom: 2 },
  stepTitleMuted:{ color: colors.textMuted },
  stepDesc:      { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },

  note: {
    fontFamily: fonts.body, fontSize: 13, color: colors.textMuted,
    textAlign: 'center', marginBottom: spacing.lg,
  },

  signOutBtn: {
    backgroundColor: colors.navyLight,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: radius.md, padding: 16,
    alignItems: 'center', marginBottom: spacing.xl,
    width: '100%',
  },
  signOutText: { fontFamily: fonts.body, fontWeight: '600', fontSize: 15, color: colors.red },

  powered: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, opacity: 0.5 },
})

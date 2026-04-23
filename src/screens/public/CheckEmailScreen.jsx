// pavilion-app/src/screens/public/CheckEmailScreen.jsx
// Mirrors pavilion-web/src/pages/public/CheckEmailPage.jsx
// Shown immediately after signup — prompts user to verify their email

import React from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SCREENS } from '../../lib/constants'
import { colors, fonts, spacing, radius } from '../../theme'
import AppIcon from '../../components/AppIcon'

export default function CheckEmailScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* ── HTCC Crest ── */}
        <View style={styles.crestWrap}>
          <Image
            source={require('../../../assets/htcc-logo.png')}
            style={styles.crestImage}
            resizeMode="cover"
          />
        </View>

        {/* ── Mail icon ── */}
        <View style={styles.iconWrap}>
          <AppIcon name="send" size={32} tint={colors.gold} />
        </View>

        <Text style={styles.heading}>Check Your Email</Text>
        <Text style={styles.body}>
          We've sent a confirmation link to your email address.{'\n\n'}
          Please click the link to verify your account before signing in.
        </Text>

        {/* ── Spam warning tip ── */}
        <View style={styles.tipCard}>
          <View style={styles.tipTitleRow}>
            <AppIcon name="search" size={13} tint={colors.gold} />
            <Text style={styles.tipTitle}>Can't find it?</Text>
          </View>
          <Text style={styles.tipBody}>
            Check your spam or junk folder — confirmation emails sometimes land there.
          </Text>
        </View>

        {/* ── Back to sign in ── */}
        <TouchableOpacity
          style={styles.btn}
          onPress={() => navigation.navigate(SCREENS.LOGIN)}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>Back to Sign In →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate(SCREENS.WELCOME)}
          style={styles.backLink}
        >
          <Text style={styles.backLinkText}>← Back to home</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.navy },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },

  crestWrap: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: colors.navy,
    borderWidth: 2, borderColor: colors.gold,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
    marginBottom: spacing.lg,
  },
  crestImage: { width: '100%', height: '100%' },

  iconWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: 'rgba(245,197,24,0.1)',
    borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heading: {
    fontFamily: fonts.display, fontSize: 26, letterSpacing: 2,
    color: colors.white, marginBottom: spacing.sm, textAlign: 'center',
  },
  body: {
    fontFamily: fonts.body, fontSize: 14, color: colors.textMuted,
    textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl,
  },

  tipCard: {
    width: '100%',
    backgroundColor: colors.navyLight,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.xl,
  },
  tipTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  tipTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  tipBody:  { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, lineHeight: 20 },

  btn: {
    width: '100%', backgroundColor: colors.gold,
    padding: 15, borderRadius: radius.md,
    alignItems: 'center', marginBottom: spacing.md,
  },
  btnText: { fontFamily: fonts.body, fontWeight: '700', fontSize: 15, color: colors.navy },

  backLink:     { marginTop: spacing.sm },
  backLinkText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
})
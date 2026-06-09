// pavilion-app/src/components/ForceUpdateScreen.jsx
// Blocking screen shown when app version is below min_required_version.
// User cannot dismiss — must update via App Store / Play Store.

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Linking from 'expo-linking'
import { colors, fonts, spacing, radius } from '../theme'

const IOS_URL     = 'https://apps.apple.com/app/id6761196439'
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.htcc.pavilion'

export default function ForceUpdateScreen() {
  const handleUpdate = () => {
    const url = Platform.OS === 'ios' ? IOS_URL : ANDROID_URL
    Linking.openURL(url)
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>

        <View style={s.iconRing}>
          <Image
            source={require('../../assets/pavilion-icon-1024.png')}
            style={s.icon}
            resizeMode="contain"
          />
        </View>

        <Text style={s.title}>UPDATE REQUIRED</Text>
        <Text style={s.subtitle}>Pavilion</Text>

        <Text style={s.body}>
          A new version of Pavilion is available with important updates.
          Please update to continue.
        </Text>

        <TouchableOpacity style={s.btn} onPress={handleUpdate} activeOpacity={0.85}>
          <Text style={s.btnText}>UPDATE NOW</Text>
        </TouchableOpacity>

        <Text style={s.hint}>
          {Platform.OS === 'ios' ? 'Opens App Store' : 'Opens Google Play'}
        </Text>

      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    backgroundColor: colors.navyLight,
  },
  icon: {
    width: 68,
    height: 68,
    borderRadius: 16,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.gold,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.xl,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl * 1.5,
    opacity: 0.85,
  },
  btn: {
    backgroundColor: colors.gold,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl * 2,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  btnText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.navy,
    letterSpacing: 1,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
})

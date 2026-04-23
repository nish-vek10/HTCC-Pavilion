// pavilion-app/src/components/layout/TopHeader.jsx
// Sticky top header — all authenticated screens
//
// Layout:
//   LEFT  → Pavilion icon  |  PAVILION / HTCC text stack
//   RIGHT → HTCC crest  |  gold divider  |  Profile avatar (tappable → role-correct ProfileScreen)
//
// Avatar tap navigation — role-based:
//   member     → 'Profile'           (stack screen in MemberNavigator)
//   admin      → 'AdminPanelProfile' (tab in AdminNavigator)
//   captain    → 'CaptainPanelProfile' (tab in CaptainNavigator)
//
// When already on the profile screen, avatar tap = go back (member) or no-op (admin/captain — already on tab).

import React, { useCallback } from 'react'
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import { colors, fonts } from '../../theme'
import useAuthStore from '../../store/authStore'
import { SCREENS } from '../../lib/constants'

// ─── Profile navigation per role ──────────────────────────────────────────────
// FULL ROOT PATH required for admin/captain:
//   AdminPanelProfile lives under RootNavigator > AdminPanel > AdminTabs
//   CaptainPanelProfile lives under RootNavigator > CaptainPanel > CaptainTabs
//   Using the partial path ('AdminTabs') fails when called from member screens
//   because AdminTabs is in a sibling branch, not visible from MemberNavigator.
//   The full 3-level path works from ANY context in the app — React Navigation
//   will navigate to AdminPanel (pushing it if not active), then switch the tab.
//
// Member Profile is a Stack.Screen in MemberNavigator — direct name works fine.
const PROFILE_NAV = {
  member:     (nav) => nav.navigate(SCREENS.PROFILE),
  captain:    (nav) => nav.navigate('CaptainPanel', {
                         screen: 'CaptainTabs',
                         params: { screen: 'CaptainPanelProfile' },
                       }),
  admin:      (nav) => nav.navigate('AdminPanel',   {
                         screen: 'AdminTabs',
                         params: { screen: 'AdminPanelProfile' },
                       }),
  superadmin: (nav) => nav.navigate('AdminPanel',   {
                         screen: 'AdminTabs',
                         params: { screen: 'AdminPanelProfile' },
                       }),
  pending:    null,
}

// All screen names that ARE a profile screen — used for isOnProfile active state
const PROFILE_SCREEN_NAMES = new Set([
  SCREENS.PROFILE,
  'AdminPanelProfile',
  'CaptainPanelProfile',
])

// ─── CONFIGURABLE ─────────────────────────────────────────────────────────────
const PAVILION_ICON_SIZE = 34   // Pavilion icon diameter (round)
const CREST_SIZE         = 42   // HTCC crest size — matches original
const CREST_BORDER_R     = 11   // crest border radius — matches original square-ish style
const DIVIDER_HEIGHT     = 26   // gold vertical line height
const AVATAR_SIZE        = 34   // profile avatar circle diameter
// ─────────────────────────────────────────────────────────────────────────────

// Role → ring colour for avatar border
const ROLE_RING = {
  superadmin: '#A78BFA',   // purple
  admin:      '#F5C518',   // gold
  captain:    '#22C55E',   // green
  member:     '#60A5FA',   // blue
  pending:    '#F97316',   // orange
}

// First two initials from full name
function getInitials(fullName) {
  if (!fullName) return '?'
  return fullName
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function TopHeader() {
  const navigation = useNavigation()
  const route      = useRoute()
  const profile    = useAuthStore(s => s.profile)

  const ringColor   = ROLE_RING[profile?.role] || colors.textMuted
  const initials    = getInitials(profile?.full_name)

  // nav function for this role — null for pending (no profile yet)
  const profileNav  = PROFILE_NAV[profile?.role] || null

  // True when any profile screen variant is currently the active route
  const isOnProfile = PROFILE_SCREEN_NAMES.has(route.name)

  const handleAvatarPress = useCallback(() => {
    if (!profileNav) return   // pending users have no profile to navigate to

    if (isOnProfile) {
      // Member: profile is a pushed stack screen — goBack dismisses it cleanly
      // Admin/Captain: profile is a tab — goBack if there's stack history, otherwise no-op
      if (navigation.canGoBack()) navigation.goBack()
      return
    }

    // Navigate using the role-correct path (handles nested navigators correctly)
    profileNav(navigation)
  }, [navigation, isOnProfile, profileNav])

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.bar}>

        {/* ── LEFT: Pavilion icon + text ── */}
        <View style={styles.left}>
          {/* Pavilion icon */}
          <View style={styles.pavilionIconWrap}>
            <Image
              source={require('../../../assets/pavilion-icon.png')}
              style={styles.pavilionIconImg}
              resizeMode="contain"
            />
          </View>
          {/* Text stack: PAVILION / HTCC */}
          <View>
            <Text style={styles.pavilionText}>PAVILION</Text>
            <Text style={styles.pavilionSub}>HTCC</Text>
          </View>
        </View>

        {/* ── RIGHT: HTCC crest | gold divider | avatar ── */}
        <View style={styles.right}>

          {/* HTCC crest — original style (no gold ring, square-ish radius) */}
          <View style={styles.crestWrap}>
            <Image
              source={require('../../../assets/htcc-logo.png')}
              style={styles.crestImage}
              resizeMode="cover"
            />
          </View>

          {/* Gold vertical divider */}
          <View style={styles.divider} />

          {/* Profile avatar — tappable, initials + role-colour ring.
              When on ProfileScreen, ring brightens to signal "tap to close". */}
          <TouchableOpacity
            onPress={handleAvatarPress}
            activeOpacity={0.75}
            style={[
              styles.avatar,
              { borderColor: ringColor },
              isOnProfile && styles.avatarActive,
            ]}
          >
            <View style={[styles.avatarInner, { backgroundColor: `${ringColor}${isOnProfile ? '35' : '20'}` }]}>
              <Text style={[styles.avatarText, { color: ringColor }]}>{initials}</Text>
            </View>
          </TouchableOpacity>

        </View>

      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: 'rgba(13,27,42,0.98)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,197,24,0.15)',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    height: 56,
  },

  // ── Left ──────────────────────────────────────────────────────────────────
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pavilionIconWrap: {
    width:        PAVILION_ICON_SIZE,
    height:       PAVILION_ICON_SIZE,
    borderRadius: 9,
    overflow:     'hidden',
  },
  pavilionIconImg: {
    width: '100%',
    height: '100%',
  },
  pavilionText: {
    fontFamily:    fonts.display,
    fontSize:      18,
    letterSpacing: 2,
    color:         colors.white,
    lineHeight:    20,
  },
  pavilionSub: {
    fontFamily:    fonts.body,
    fontSize:      10,
    letterSpacing: 3,
    color:         colors.gold,
    lineHeight:    13,
  },

  // ── Right ─────────────────────────────────────────────────────────────────
  right: {
    flexDirection: 'row',
    alignItems:   'center',
    gap:           10,
  },

  // HTCC crest — original square-ish style, no border ring
  crestWrap: {
    width:        CREST_SIZE,
    height:       CREST_SIZE,
    borderRadius: CREST_BORDER_R,
    overflow:     'hidden',
  },
  crestImage: { width: '100%', height: '100%' },

  // Gold vertical divider
  divider: {
    width:           1.5,
    height:          DIVIDER_HEIGHT,
    backgroundColor: colors.gold,
    opacity:         0.55,
    borderRadius:    1,
  },

  // Profile avatar — circle, role-colour border, tappable
  avatar: {
    width:        AVATAR_SIZE,
    height:       AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth:  2,
    overflow:     'hidden',
  },
  // Active state when on ProfileScreen — slightly brighter border
  avatarActive: {
    borderWidth: 2.5,
    shadowColor:   '#fff',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius:  4,
    elevation:     3,
  },
  avatarInner: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily:    fonts.bold,
    fontSize:      12,
    letterSpacing: 0.5,
  },
})

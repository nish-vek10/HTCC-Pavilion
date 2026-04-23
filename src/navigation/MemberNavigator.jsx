// pavilion-app/src/navigation/MemberNavigator.jsx
// Nested navigator: root stack (handles FixtureDetail + Profile above tabs) +
// bottom tab bar for main member screens
// Profile is accessed via TopHeader avatar tap — not a bottom tab

import React, { useState, useEffect } from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Image, Text, View } from 'react-native'
import { SCREENS } from '../lib/constants'
import { colors, fonts } from '../theme'
import icons from '../lib/icons'

import DashboardScreen       from '../screens/member/DashboardScreen'
import FixturesScreen        from '../screens/member/FixturesScreen'
import TeamsScreen           from '../screens/member/TeamsScreen'
import NotificationsScreen   from '../screens/member/NotificationsScreen'
import ProfileScreen         from '../screens/member/ProfileScreen'
import FixtureDetailScreen   from '../screens/member/FixtureDetailScreen'
import StatsScreen           from '../screens/member/StatsScreen'
import FantasyLeagueScreen   from '../screens/member/FantasyLeagueScreen'

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase }          from '../lib/supabase'
import useAuthStore          from '../store/authStore'

const Stack = createNativeStackNavigator()
const Tab   = createBottomTabNavigator()

// ─── Alerts tab icon with real-time unread badge ──────────────────────────
const AlertsTabIcon = React.memo(function AlertsTabIcon({ focused }) {
  const profile      = useAuthStore(s => s.profile)
  const unread       = useAuthStore(s => s.unreadCount)
  const setUnread    = useAuthStore(s => s.setUnreadCount)
  const profileRef   = React.useRef(profile?.id)
  profileRef.current = profile?.id

  const fetchUnread = React.useCallback(async () => {
    const uid = profileRef.current
    if (!uid) return
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('read', false)
    setUnread(count || 0)
  }, [])

  useEffect(() => {
    if (!profile?.id) return
    fetchUnread()
    const channel = supabase
      .channel(`notif-badge-${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, () => fetchUnread())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile?.id])

  const displayCount = unread > 9 ? '9+' : String(unread)

  return (
    <View style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}>
      {/* Gold ring + icon — same style as TabIcon */}
      <View style={{
        width: 32, height: 32, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: focused ? 'rgba(245,197,24,0.1)' : 'transparent',
        borderWidth: focused ? 1.5 : 0,
        borderColor: focused ? colors.gold : 'transparent',
      }}>
        <Image
          source={icons.alerts}
          style={{
            width: 28, height: 28,
            tintColor: focused ? colors.gold : 'rgba(255,255,255,0.45)',
          }}
          resizeMode="contain"
        />
      </View>
      {/* Unread badge — sits above the ring */}
      {unread > 0 && (
        <View style={{
          position: 'absolute', top: 0, right: 0,
          backgroundColor: colors.red, borderRadius: 8,
          minWidth: 16, height: 16,
          alignItems: 'center', justifyContent: 'center',
          paddingHorizontal: 3,
          borderWidth: 1.5, borderColor: 'rgba(13,27,42,0.97)',
        }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: colors.white, lineHeight: 14 }}>
            {displayCount}
          </Text>
        </View>
      )}
    </View>
  )
})

// ─── Fantasy League tab icon — trophy has own colours so no tint applied ─────
const FantasyTabIcon = React.memo(function FantasyTabIcon({ focused }) {
  return (
    <View style={{
      width: 32, height: 32, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: focused ? 'rgba(245,197,24,0.1)' : 'transparent',
      borderWidth: focused ? 1.5 : 0,
      borderColor: focused ? colors.gold : 'transparent',
      opacity: focused ? 1 : 0.45,
    }}>
      {/* Trophy has baked-in colours — do NOT apply tintColor */}
      <Image
        source={icons.trophy}
        style={{ width: 28, height: 28 }}
        resizeMode="contain"
      />
    </View>
  )
})

// ─── HTCC crest tab icon — used for Teams tab ──────────────────────────────
const HTCCTabIcon = React.memo(function HTCCTabIcon({ focused }) {
  return (
    <View style={{
      width: 26, height: 26, borderRadius: 13,
      backgroundColor: colors.navy,
      borderWidth: 1.5,
      borderColor: focused ? colors.gold : 'rgba(139,155,180,0.4)',
      overflow: 'hidden',
      shadowColor: focused ? colors.gold : 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: focused ? 0.6 : 0,
      shadowRadius: 6,
    }}>
      <Image
        source={require('../../assets/htcc-logo.png')}
        style={{ width: '100%', height: '100%', opacity: focused ? 1 : 0.5 }}
        resizeMode="cover"
      />
    </View>
  )
})

// ─── Tab icon helper — PNG icon with gold ring when focused ────────────────
const TabIcon = React.memo(function TabIcon({ source, focused }) {
  return (
    <View style={{
      width: 32, height: 32, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: focused ? 'rgba(245,197,24,0.1)' : 'transparent',
      borderWidth: focused ? 1.5 : 0,
      borderColor: focused ? colors.gold : 'transparent',
    }}>
      <Image
        source={source}
        style={{
          width: 28, height: 28,
          tintColor: focused ? colors.gold : 'rgba(255,255,255,0.45)',
        }}
        resizeMode="contain"
      />
    </View>
  )
})


// ─── Bottom tab bar (member) ───────────────────────────────────────────────
function MemberTabs() {
  const insets = useSafeAreaInsets()
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(13,27,42,0.97)',
          borderTopColor: 'rgba(245,197,24,0.15)',
          borderTopWidth: 1,
          height: 80 + insets.bottom,
          paddingBottom: 16 + insets.bottom,
          paddingTop: 6,
        },
        tabBarActiveTintColor:   colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: fonts.body,
          fontSize: 10,
          letterSpacing: 0.3,
        },
        // Active indicator dot
        tabBarIndicatorStyle: { display: 'none' },
      }}
    >
      <Tab.Screen
        name={SCREENS.DASHBOARD}
        component={DashboardScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon source={icons.home} focused={focused} />,
        }}
      />
      <Tab.Screen
        name={SCREENS.FIXTURES}
        component={FixturesScreen}
        options={{
          title: 'Fixtures',
          tabBarIcon: ({ focused }) => <TabIcon source={icons.fixtures} focused={focused} />,
        }}
      />
      <Tab.Screen
        name={SCREENS.TEAMS}
        component={TeamsScreen}
        options={{
          title: 'Teams',
          tabBarIcon: ({ focused }) => <HTCCTabIcon focused={focused} />,
        }}
      />
      <Tab.Screen
        name={SCREENS.STATS}
        component={StatsScreen}
        options={{
          title: 'Stats',
          tabBarIcon: ({ focused }) => <TabIcon source={icons.stats} focused={focused} />,
        }}
      />
      <Tab.Screen
        name={SCREENS.NOTIFICATIONS}
        component={NotificationsScreen}
        options={{
          title: 'Alerts',
          tabBarIcon: ({ focused }) => <AlertsTabIcon focused={focused} />,
        }}
      />
      {/* Fantasy League — Coming Soon tab — 6th tab, Profile moved to TopHeader */}
      <Tab.Screen
        name={SCREENS.FANTASY_LEAGUE}
        component={FantasyLeagueScreen}
        options={{
          title: 'Fantasy',
          tabBarIcon: ({ focused }) => <FantasyTabIcon focused={focused} />,
        }}
      />
    </Tab.Navigator>
  )
}

// ─── Root member stack ────────────────────────────────────────────────────
// FixtureDetail and Profile slide above tabs — Profile reached via TopHeader avatar
export default function MemberNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.navy },
      }}
    >
      <Stack.Screen name="MemberTabs" component={MemberTabs} />
      <Stack.Screen
        name={SCREENS.FIXTURE_DETAIL}
        component={FixtureDetailScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      {/* Profile — accessed via TopHeader avatar tap, slides up from bottom */}
      <Stack.Screen
        name={SCREENS.PROFILE}
        component={ProfileScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  )
}
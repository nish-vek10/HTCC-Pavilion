// pavilion-app/src/navigation/AdminNavigator.jsx
// Admin panel navigator — matches member nav style
// Profile accessed via TopHeader avatar (not a tab)

import React from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs'
import { Text, View, Image }          from 'react-native'
import { SCREENS }                    from '../lib/constants'
import { colors, fonts }              from '../theme'
import icons                          from '../lib/icons'

import AdminDashboardScreen     from '../screens/admin/AdminDashboardScreen'
import AdminMatchdayScreen      from '../screens/admin/AdminMatchdayScreen'
import AdminFixturesScreen      from '../screens/admin/AdminFixturesScreen'
import AdminMembersScreen       from '../screens/admin/AdminMembersScreen'
import AdminTrainingAnnouncementsScreen from '../screens/admin/AdminTrainingAnnouncementsScreen'
import TrainingDetailScreen     from '../screens/admin/TrainingDetailScreen'
import SquadSelectionScreen     from '../screens/captain/SquadSelectionScreen'
import MatchScorecardScreen     from '../screens/admin/MatchScorecardScreen'
import ProfileScreen            from '../screens/member/ProfileScreen'

const Tab   = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

// ─── Shared tab icon — PNG icon with gold ring when focused ────────────────
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

// ─── HTCC crest icon for dashboard tab ────────────────────────────────────
const CrestIcon = React.memo(function CrestIcon({ focused }) {
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

// ─── Admin bottom tabs ─────────────────────────────────────────────────────
function AdminTabs() {
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
      }}
    >
      <Tab.Screen
        name={SCREENS.ADMIN_DASHBOARD}
        component={AdminDashboardScreen}
        options={{
          title: 'Overview',
          tabBarIcon: ({ focused }) => <CrestIcon focused={focused} />,
        }}
      />
      <Tab.Screen
        name={SCREENS.ADMIN_MATCHDAY}
        component={AdminMatchdayScreen}
        options={{
          title: 'Matchday',
          tabBarIcon: ({ focused }) => <TabIcon source={icons.matchday} focused={focused} />,
        }}
      />
      <Tab.Screen
        name={SCREENS.ADMIN_FIXTURES}
        component={AdminFixturesScreen}
        options={{
          title: 'Fixtures',
          tabBarIcon: ({ focused }) => <TabIcon source={icons.fixtures} focused={focused} />,
        }}
      />
      <Tab.Screen
        name={SCREENS.ADMIN_MEMBERS}
        component={AdminMembersScreen}
        options={{
          title: 'Members',
          tabBarIcon: ({ focused }) => <TabIcon source={icons.members} focused={focused} />,
        }}
      />
      <Tab.Screen
        name={SCREENS.ADMIN_TRAINING}
        component={AdminTrainingAnnouncementsScreen}
        options={{
          title: 'Sessions',
          tabBarIcon: ({ focused }) => <TabIcon source={icons.training} focused={focused} />,
        }}
      />
    </Tab.Navigator>
  )
}

// ─── Admin root stack — Squad Selection slides above tabs ──────────────────
export default function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.navy } }}>
      <Stack.Screen name="AdminTabs" component={AdminTabs} />
      <Stack.Screen
        name={SCREENS.SQUAD_SELECTION}
        component={SquadSelectionScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name={SCREENS.TRAINING_DETAIL}
        component={TrainingDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name={SCREENS.MATCH_SCORECARD}
        component={MatchScorecardScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name={SCREENS.PROFILE}
        component={ProfileScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  )
}
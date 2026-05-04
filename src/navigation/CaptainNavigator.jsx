// pavilion-app/src/navigation/CaptainNavigator.jsx
// Captain panel navigator — fixtures, squad selection, profile
// Profile accessed via TopHeader avatar (not a tab)

import React from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs'
import { Text, View, Image }          from 'react-native'
import { SCREENS }                    from '../lib/constants'
import { colors, fonts }              from '../theme'
import icons                          from '../lib/icons'

import CaptainFixturesScreen from '../screens/captain/CaptainFixturesScreen'
import SquadSelectionScreen  from '../screens/captain/SquadSelectionScreen'
import MatchScorecardScreen  from '../screens/admin/MatchScorecardScreen'
import ProfileScreen         from '../screens/member/ProfileScreen'

const Tab   = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

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

function CaptainTabs() {
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
        name={SCREENS.CAPTAIN_FIXTURES}
        component={CaptainFixturesScreen}
        options={{
          title: 'Fixtures',
          tabBarIcon: ({ focused }) => <TabIcon source={icons.fixtures} focused={focused} />,
        }}
      />
    </Tab.Navigator>
  )
}

export default function CaptainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.navy } }}>
      <Stack.Screen name="CaptainTabs" component={CaptainTabs} />
      <Stack.Screen
        name={SCREENS.SQUAD_SELECTION}
        component={SquadSelectionScreen}
        options={{ animation: 'slide_from_bottom' }}
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
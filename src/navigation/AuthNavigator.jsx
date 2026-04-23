// pavilion-app/src/navigation/AuthNavigator.jsx

import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SCREENS } from '../lib/constants'
import { colors } from '../theme'

import WelcomeScreen from '../screens/public/WelcomeScreen'
import LoginScreen   from '../screens/public/LoginScreen'
import SignupScreen  from '../screens/public/SignupScreen'
import PendingScreen    from '../screens/public/PendingScreen'
import CheckEmailScreen from '../screens/public/CheckEmailScreen'

const Stack = createNativeStackNavigator()

export default function AuthNavigator({ initialRoute = SCREENS.WELCOME }) {
  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.navy },
        animation: 'fade_from_bottom',
      }}
    >
      <Stack.Screen name={SCREENS.WELCOME} component={WelcomeScreen} />
      <Stack.Screen name={SCREENS.LOGIN}   component={LoginScreen} />
      <Stack.Screen name={SCREENS.SIGNUP}  component={SignupScreen} />
      <Stack.Screen name={SCREENS.PENDING}     component={PendingScreen} />
      <Stack.Screen name={SCREENS.CHECK_EMAIL} component={CheckEmailScreen} />
    </Stack.Navigator>
  )
}
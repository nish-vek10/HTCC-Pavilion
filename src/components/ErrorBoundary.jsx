// pavilion-app/src/components/ErrorBoundary.jsx
// Catches unexpected JS errors — prevents full white screen crashes
// Wraps the entire NavigationContainer in App.jsx

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, fonts, spacing, radius } from '../theme'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            An unexpected error occurred. Please restart the app.
          </Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => this.setState({ hasError: false })}
          >
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl,
  },
  icon:    { fontSize: 48, marginBottom: spacing.md },
  title:   { fontFamily: fonts.display, fontSize: 24, letterSpacing: 1, color: colors.white, marginBottom: spacing.sm, textAlign: 'center' },
  message: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  btn:     { backgroundColor: colors.gold, paddingHorizontal: 32, paddingVertical: 14, borderRadius: radius.md },
  btnText: { fontFamily: fonts.bold, fontSize: 15, color: colors.navy },
})
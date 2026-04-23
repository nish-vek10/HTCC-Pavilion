// pavilion-app/src/components/AppLoader.jsx
// Branded loading screen shown post-splash during auth/profile resolution.
// Prevents blank/black screens when Supabase is slow or under load.

import React, { useEffect, useRef } from 'react'
import { View, Image, StyleSheet, Animated, Easing } from 'react-native'
import { colors } from '../theme'

// ─── CONFIGURABLE ──────────────────────────────────────────────────────────────
const ICON_SIZE   = 72    // pavilion icon diameter
const RING_SIZE   = 96    // outer ring diameter
const PULSE_MIN   = 0.4   // minimum ring opacity during pulse
const PULSE_MS    = 900   // one pulse cycle duration in ms
// ───────────────────────────────────────────────────────────────────────────────

export default function AppLoader() {
  const ringOp    = useRef(new Animated.Value(PULSE_MIN)).current
  const loopRef   = useRef(null)

  useEffect(() => {
    // Gentle gold ring pulse — signals activity without being distracting
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(ringOp, {
          toValue:  1,
          duration: PULSE_MS,
          easing:   Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ringOp, {
          toValue:  PULSE_MIN,
          duration: PULSE_MS,
          easing:   Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    )
    loopRef.current.start()

    // Stop animation on unmount — prevents native thread leak
    return () => loopRef.current?.stop()
  }, [])

  return (
    <View style={styles.container}>
      {/* Pulsing gold ring around Pavilion icon */}
      <Animated.View style={[styles.ring, { opacity: ringOp }]}>
        <View style={styles.iconCircle}>
          <Image
            source={require('../../assets/pavilion-icon.png')}
            style={styles.icon}
            resizeMode="contain"
          />
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ring: {
    width:        RING_SIZE,
    height:       RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth:  1.5,
    borderColor:  colors.gold,
    alignItems:   'center',
    justifyContent: 'center',
  },

  iconCircle: {
    width:           ICON_SIZE,
    height:          ICON_SIZE,
    borderRadius:    ICON_SIZE / 2,
    backgroundColor: colors.navy,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },

  icon: {
    width:  '78%',
    height: '78%',
  },
})
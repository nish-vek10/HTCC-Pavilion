// pavilion-app/src/components/ClubLoader.jsx
// Full-screen loader: spinning gold arc + HTCC crest — mirrors web ClubLoader

import React, { useEffect, useRef } from 'react'
import { View, Image, Animated, Easing, StyleSheet } from 'react-native'
import { colors } from '../theme'

export default function ClubLoader() {
  const rotation = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Continuous clockwise spin
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start()
  }, [])

  const spin = rotation.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <View style={styles.container}>
      {/* Spinning gold ring */}
      <Animated.View style={[styles.ring, { transform: [{ rotate: spin }] }]} />

      {/* HTCC crest centred inside the ring */}
      <View style={styles.crestWrap}>
        <Image
          source={require('../../assets/htcc-logo.png')}
          style={styles.crestImage}
          resizeMode="cover"
        />
      </View>
    </View>
  )
}

const RING_SIZE   = 72
const CREST_SIZE  = 52
const BORDER_W    = 3

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    width:  RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: BORDER_W,
    borderColor: colors.gold,
    // Break the ring to look like an arc (transparent on one side)
    borderBottomColor: 'transparent',
  },
  crestWrap: {
    width:  CREST_SIZE,
    height: CREST_SIZE,
    borderRadius: CREST_SIZE / 2,
    backgroundColor: colors.navy,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crestImage: {
    width: '100%',
    height: '100%',
  },
})
// pavilion-app/src/components/SplashV3_Assemble.jsx
// Style: Elements fly in from all directions and assemble

import React, { useEffect, useRef } from 'react'
import { View, Text, Image, StyleSheet, Animated, Easing, Dimensions } from 'react-native'
import { colors, fonts } from '../theme'

const { width: SW } = Dimensions.get('window')

export default function SplashV3_Assemble() {
  // Each element flies in from a different direction
  const crestX      = useRef(new Animated.Value(-SW)).current
  const crestOp     = useRef(new Animated.Value(0)).current
  const titleX      = useRef(new Animated.Value(SW)).current
  const titleOp     = useRef(new Animated.Value(0)).current
  const divY        = useRef(new Animated.Value(-60)).current
  const divOp       = useRef(new Animated.Value(0)).current
  const clubY       = useRef(new Animated.Value(60)).current
  const clubOp      = useRef(new Animated.Value(0)).current
  const poweredOp   = useRef(new Animated.Value(0)).current
  const dotsOp      = useRef(new Animated.Value(0)).current
  const lockFlash   = useRef(new Animated.Value(0)).current

  const spring = (anim, val, delay, tension = 65, friction = 8) => {
    setTimeout(() => {
      Animated.spring(anim, { toValue: val, tension, friction, useNativeDriver: true }).start()
    }, delay)
  }

  const fade = (anim, val, delay, duration = 400) => {
    setTimeout(() => {
      Animated.timing(anim, { toValue: val, duration, useNativeDriver: true }).start()
    }, delay)
  }

  useEffect(() => {
    // Crest flies in from left
    spring(crestX, 0, 0)
    fade(crestOp, 1, 0, 300)

    // Title flies in from right
    spring(titleX, 0, 150)
    fade(titleOp, 1, 150, 300)

    // Divider drops from top
    spring(divY, 0, 300)
    fade(divOp, 1, 300, 300)

    // Club name rises from bottom
    spring(clubY, 0, 450)
    fade(clubOp, 1, 450, 300)

    // Lock flash — golden pulse when everything assembles
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(lockFlash, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(lockFlash, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start()
    }, 700)

    fade(poweredOp, 1, 900)
    fade(dotsOp, 1, 1200)
  }, [])

  const flashOp = lockFlash.interpolate({ inputRange: [0,1], outputRange: [0, 0.25] })

  return (
    <View style={styles.container}>

      {/* Flash overlay on lock */}
      <Animated.View style={[styles.flash, { opacity: flashOp }]} />

      {/* Crest from left */}
      <Animated.View style={[styles.crestWrap, {
        opacity: crestOp,
        transform: [{ translateX: crestX }],
      }]}>
        <Image source={require('../../assets/htcc-logo.png')} style={styles.crestImage} resizeMode="cover" />
      </Animated.View>

      {/* Title from right */}
      <Animated.Text style={[styles.title, {
        opacity: titleOp,
        transform: [{ translateX: titleX }],
      }]}>
        PAVILION
      </Animated.Text>

      {/* Divider from top */}
      <Animated.View style={[styles.divider, {
        opacity: divOp,
        transform: [{ translateY: divY }],
      }]} />

      {/* Club name from bottom */}
      <Animated.View style={[styles.clubWrap, {
        opacity: clubOp,
        transform: [{ translateY: clubY }],
      }]}>
        <Text style={styles.clubTop}>HARROW TOWN</Text>
        <Text style={styles.clubSub}>CRICKET CLUB</Text>
      </Animated.View>

      <Animated.Text style={[styles.poweredBy, { opacity: poweredOp }]}>
        powered by pavilion
      </Animated.Text>

      <Animated.View style={[styles.dotsRow, { opacity: dotsOp }]}>
        {[0, 200, 400].map(d => <PulseDot key={d} delay={d} />)}
      </Animated.View>
    </View>
  )
}

function PulseDot({ delay }) {
  const a = useRef(new Animated.Value(0.2)).current
  useEffect(() => {
    setTimeout(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(a, { toValue: 1,   duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.2, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])).start()
    }, delay + 1200)
  }, [])
  return <Animated.View style={[styles.dot, { opacity: a }]} />
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', gap: 14, overflow: 'hidden' },
  flash:      { position: 'absolute', inset: 0, backgroundColor: colors.gold, width: '100%', height: '100%' },
  crestWrap:  { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.navy, borderWidth: 2.5, borderColor: colors.gold, overflow: 'hidden' },
  crestImage: { width: '100%', height: '100%' },
  title:      { fontFamily: fonts.display, fontSize: 58, letterSpacing: 10, color: colors.white },
  divider:    { width: 72, height: 1.5, backgroundColor: colors.gold, opacity: 0.55 },
  clubWrap:   { alignItems: 'center', gap: 4 },
  clubTop:    { fontFamily: fonts.display, fontSize: 19, letterSpacing: 5, color: colors.gold },
  clubSub:    { fontFamily: fonts.display, fontSize: 11, letterSpacing: 5, color: colors.textMuted },
  poweredBy:  { fontFamily: fonts.body, fontSize: 11, letterSpacing: 3, color: colors.textMuted, marginTop: 4 },
  dotsRow:    { position: 'absolute', bottom: 52, flexDirection: 'row', gap: 10 },
  dot:        { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.gold },
})
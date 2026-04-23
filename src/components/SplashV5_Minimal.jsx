// pavilion-app/src/components/SplashV5_Minimal.jsx
// Style: Ultra minimal — single expanding line, clean fade sequence

import React, { useEffect, useRef } from 'react'
import { View, Text, Image, StyleSheet, Animated, Easing, Dimensions } from 'react-native'
import { colors, fonts } from '../theme'

const { width: SW } = Dimensions.get('window')

export default function SplashV5_Minimal() {
  const topLine    = useRef(new Animated.Value(0)).current
  const botLine    = useRef(new Animated.Value(0)).current
  const crestOp    = useRef(new Animated.Value(0)).current
  const crestScale = useRef(new Animated.Value(0.85)).current
  const titleOp    = useRef(new Animated.Value(0)).current
  const subOp      = useRef(new Animated.Value(0)).current
  const dotsOp     = useRef(new Animated.Value(0)).current
  const breathe    = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // Top and bottom gold lines expand outward from centre simultaneously
    Animated.parallel([
      Animated.timing(topLine, { toValue: SW * 0.75, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(botLine, { toValue: SW * 0.75, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start()

    // Crest cross-fades in
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(crestOp,    { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(crestScale, { toValue: 1, tension: 45, friction: 9, useNativeDriver: true }),
      ]).start()
    }, 400)

    // Title fades in
    setTimeout(() => {
      Animated.timing(titleOp, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
    }, 750)

    // Sub fades in
    setTimeout(() => {
      Animated.timing(subOp, { toValue: 1, duration: 600, useNativeDriver: true }).start()
    }, 1150)

    // Dots
    setTimeout(() => {
      Animated.timing(dotsOp, { toValue: 1, duration: 400, useNativeDriver: true }).start()
    }, 1500)

    // Gentle breathe on crest
    setTimeout(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(breathe, { toValue: 1.05, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1,    duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])).start()
    }, 1200)
  }, [])

  return (
    <View style={styles.container}>

      {/* Top gold line */}
      <Animated.View style={[styles.topLineWrap]}>
        <Animated.View style={[styles.goldLine, { width: topLine }]} />
      </Animated.View>

      {/* Crest */}
      <Animated.View style={[styles.crestWrap, {
        opacity: crestOp,
        transform: [{ scale: Animated.multiply(crestScale, breathe) }],
      }]}>
        <Image source={require('../../assets/htcc-logo.png')} style={styles.crestImage} resizeMode="cover" />
      </Animated.View>

      {/* PAVILION */}
      <Animated.Text style={[styles.title, { opacity: titleOp }]}>
        PAVILION
      </Animated.Text>

      {/* Sub content */}
      <Animated.View style={[styles.subWrap, { opacity: subOp }]}>
        <Text style={styles.poweredBy}>powered by</Text>
        <Text style={styles.clubTop}>HARROW TOWN</Text>
        <Text style={styles.clubSub}>CRICKET CLUB</Text>
      </Animated.View>

      {/* Bottom gold line */}
      <Animated.View style={[styles.botLineWrap]}>
        <Animated.View style={[styles.goldLine, { width: botLine }]} />
      </Animated.View>

      {/* Dots */}
      <Animated.View style={[styles.dotsRow, { opacity: dotsOp }]}>
        {[0, 220, 440].map(d => <PulseDot key={d} delay={d} />)}
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
    }, delay + 1500)
  }, [])
  return <Animated.View style={[styles.dot, { opacity: a }]} />
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', gap: 18 },
  topLineWrap:  { position: 'absolute', top: '28%', alignItems: 'center' },
  botLineWrap:  { position: 'absolute', bottom: '28%', alignItems: 'center' },
  goldLine:     { height: 1, backgroundColor: colors.gold, opacity: 0.45 },
  crestWrap:    { width: 116, height: 116, borderRadius: 58, backgroundColor: colors.navy, borderWidth: 2.5, borderColor: colors.gold, overflow: 'hidden' },
  crestImage:   { width: '100%', height: '100%' },
  title:        { fontFamily: fonts.display, fontSize: 60, letterSpacing: 11, color: colors.white },
  subWrap:      { alignItems: 'center', gap: 3 },
  poweredBy:    { fontFamily: fonts.body, fontSize: 11, letterSpacing: 3, color: colors.textMuted, marginBottom: 4 },
  clubTop:      { fontFamily: fonts.display, fontSize: 19, letterSpacing: 5, color: colors.gold },
  clubSub:      { fontFamily: fonts.display, fontSize: 11, letterSpacing: 5, color: colors.textMuted },
  dotsRow:      { position: 'absolute', bottom: 52, flexDirection: 'row', gap: 10 },
  dot:          { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.gold },
})
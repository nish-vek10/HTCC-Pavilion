// pavilion-app/src/components/SplashV2_Cinematic.jsx
// Style: Cinematic curtain reveal + slam entrance

import React, { useEffect, useRef } from 'react'
import { View, Text, Image, StyleSheet, Animated, Easing, Dimensions } from 'react-native'
import { colors, fonts } from '../theme'

const { width: SW, height: SH } = Dimensions.get('window')

export default function SplashV2_Cinematic() {
  const curtainTop    = useRef(new Animated.Value(0)).current
  const curtainBot    = useRef(new Animated.Value(0)).current
  const logoY         = useRef(new Animated.Value(-120)).current
  const logoOpacity   = useRef(new Animated.Value(0)).current
  const lineWidth     = useRef(new Animated.Value(0)).current
  const titleOpacity  = useRef(new Animated.Value(0)).current
  const titleScale    = useRef(new Animated.Value(1.4)).current
  const subOpacity    = useRef(new Animated.Value(0)).current
  const dotsOpacity   = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Curtains split open
    Animated.parallel([
      Animated.timing(curtainTop, { toValue: -SH * 0.5, duration: 700, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(curtainBot, { toValue:  SH * 0.5, duration: 700, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    ]).start()

    // Logo slams in
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(logoY, { toValue: 0, tension: 80, friction: 6, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start()
    }, 500)

    // Gold line sweeps
    setTimeout(() => {
      Animated.timing(lineWidth, { toValue: SW * 0.7, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
    }, 900)

    // Title zooms in
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(titleScale,   { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      ]).start()
    }, 1100)

    setTimeout(() => {
      Animated.timing(subOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start()
    }, 1400)

    setTimeout(() => {
      Animated.timing(dotsOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start()
    }, 1700)
  }, [])

  return (
    <View style={styles.container}>

      {/* Top curtain */}
      <Animated.View style={[styles.curtain, styles.curtainTop, { transform: [{ translateY: curtainTop }] }]} />
      {/* Bottom curtain */}
      <Animated.View style={[styles.curtain, styles.curtainBot, { transform: [{ translateY: curtainBot }] }]} />

      {/* Logo */}
      <Animated.View style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ translateY: logoY }] }]}>
        <Image source={require('../../assets/pavilion-icon.png')} style={styles.logo} resizeMode="contain" />
      </Animated.View>

      {/* Gold sweep line */}
      <Animated.View style={[styles.goldLine, { width: lineWidth }]} />

      {/* Title */}
      <Animated.Text style={[styles.title, { opacity: titleOpacity, transform: [{ scale: titleScale }] }]}>
        PAVILION
      </Animated.Text>

      <Animated.View style={{ opacity: subOpacity, alignItems: 'center', gap: 4 }}>
        <Text style={styles.poweredBy}>powered by</Text>
        <View style={styles.crestRow}>
          <View style={styles.crestSmall}>
            <Image source={require('../../assets/htcc-logo.png')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </View>
          <View>
            <Text style={styles.clubTop}>HARROW TOWN</Text>
            <Text style={styles.clubSub}>CRICKET CLUB</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View style={[styles.dotsRow, { opacity: dotsOpacity }]}>
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
    }, delay + 1700)
  }, [])
  return <Animated.View style={[styles.dot, { opacity: a }]} />
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', gap: 16 },
  curtain:     { position: 'absolute', left: 0, right: 0, height: SH * 0.5, backgroundColor: '#060E18' },
  curtainTop:  { top: 0 },
  curtainBot:  { bottom: 0 },
  logoWrap:    { marginBottom: 8 },
  logo:        { width: 88, height: 88, borderRadius: 20 },
  goldLine:    { height: 1.5, backgroundColor: colors.gold, opacity: 0.6, marginVertical: 8 },
  title:       { fontFamily: fonts.display, fontSize: 60, letterSpacing: 10, color: colors.white },
  poweredBy:   { fontFamily: fonts.body, fontSize: 11, letterSpacing: 4, color: colors.textMuted, marginBottom: 8 },
  crestRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  crestSmall:  { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.navy, borderWidth: 2, borderColor: colors.gold, overflow: 'hidden' },
  clubTop:     { fontFamily: fonts.display, fontSize: 17, letterSpacing: 4, color: colors.gold },
  clubSub:     { fontFamily: fonts.display, fontSize: 10, letterSpacing: 4, color: colors.textMuted, marginTop: 2 },
  dotsRow:     { position: 'absolute', bottom: 52, flexDirection: 'row', gap: 10 },
  dot:         { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.gold },
})
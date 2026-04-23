// pavilion-app/src/components/SplashV1_Orbit.jsx
// Style: Expanding orbit rings + crest materialise

import React, { useEffect, useRef } from 'react'
import { View, Text, Image, StyleSheet, Animated, Easing, Dimensions } from 'react-native'
import { colors, fonts } from '../theme'

const { width: SW } = Dimensions.get('window')

function Ring({ size, delay, duration, opacity }) {
  const scale  = useRef(new Animated.Value(0.2)).current
  const fadeOp = useRef(new Animated.Value(0)).current

  useEffect(() => {
    setTimeout(() => {
      // Loop continuously for the entire splash duration
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 1, duration,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 0.2, duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(fadeOp, { toValue: opacity, duration: duration * 0.3, useNativeDriver: true }),
            Animated.timing(fadeOp, { toValue: 0,       duration: duration * 0.7, useNativeDriver: true }),
            Animated.timing(fadeOp, { toValue: 0,       duration: 0,              useNativeDriver: true }),
          ]),
        ])
      ).start()
    }, delay)
  }, [])

  return (
    <Animated.View style={[styles.ring, {
      width: size, height: size, borderRadius: size / 2,
      opacity: fadeOp,
      transform: [{ scale }],
    }]} />
  )
}

export default function SplashV1_Orbit() {
  const crestScale   = useRef(new Animated.Value(0)).current
  const crestOpacity = useRef(new Animated.Value(0)).current
  const spinAnim     = useRef(new Animated.Value(0)).current
  const titleOpacity = useRef(new Animated.Value(0)).current
  const titleY       = useRef(new Animated.Value(20)).current
  const subOpacity   = useRef(new Animated.Value(0)).current
  const dotsOpacity  = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Continuous spin on orbit ring
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    ).start()

    setTimeout(() => {
      Animated.parallel([
        Animated.spring(crestScale,   { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        Animated.timing(crestOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start()
    }, 400)

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(titleY,       { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start()
    }, 800)

    setTimeout(() => {
      Animated.timing(subOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start()
    }, 1200)

    setTimeout(() => {
      Animated.timing(dotsOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start()
    }, 1600)
  }, [])

  const spin = spinAnim.interpolate({ inputRange: [0,1], outputRange: ['0deg','360deg'] })

  return (
    <View style={styles.container}>

      {/* Expanding pulse rings */}
      <View style={styles.ringWrap}>
        <Ring size={320} delay={0}   duration={2000} opacity={0.15} />
        <Ring size={440} delay={400} duration={2000} opacity={0.1} />
        <Ring size={560} delay={800} duration={2000} opacity={0.06} />

        {/* Spinning dashed orbit */}
        <Animated.View style={[styles.orbitRing, { transform: [{ rotate: spin }] }]} />

        {/* Crest */}
        <Animated.View style={[styles.crestWrap, {
          opacity: crestOpacity,
          transform: [{ scale: crestScale }],
        }]}>
          <Image source={require('../../assets/htcc-logo.png')} style={styles.crestImage} resizeMode="cover" />
        </Animated.View>
      </View>

      <Animated.Text style={[styles.title, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
        PAVILION
      </Animated.Text>

      <Animated.View style={[styles.divider, { opacity: subOpacity }]} />

      <Animated.View style={[styles.clubWrap, { opacity: subOpacity }]}>
        <Text style={styles.clubTop}>HARROW TOWN</Text>
        <Text style={styles.clubSub}>CRICKET CLUB</Text>
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
    }, delay + 1600)
  }, [])
  return <Animated.View style={[styles.dot, { opacity: a }]} />
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', width: '100%' },
  ringWrap:   { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 36 },
  ring:       { position: 'absolute', borderWidth: 1.5, borderColor: colors.gold },
  orbitRing:  {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    borderWidth: 1.5, borderColor: colors.gold,
    borderStyle: 'dashed', borderTopColor: 'transparent',
  },
  crestWrap:  { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.navy, borderWidth: 2.5, borderColor: colors.gold, overflow: 'hidden' },
  crestImage: { width: '100%', height: '100%' },
  title:      { fontFamily: fonts.display, fontSize: 56, letterSpacing: 10, color: colors.white, marginBottom: 14, textAlign: 'center', alignSelf: 'stretch' },
  divider:    { width: 70, height: 1.5, backgroundColor: colors.gold, opacity: 0.5, marginBottom: 14 },
  clubWrap:   { alignItems: 'center', gap: 4 },
  clubTop:    { fontFamily: fonts.display, fontSize: 28, letterSpacing: 5, color: colors.gold, textAlign: 'center' },
  clubSub:    { fontFamily: fonts.display, fontSize: 20, letterSpacing: 5, color: colors.textMuted, textAlign: 'center' },
  dotsRow:    { position: 'absolute', bottom: 52, flexDirection: 'row', gap: 10 },
  dot:        { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.gold },
})
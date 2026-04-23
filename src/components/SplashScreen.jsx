// pavilion-app/src/components/SplashScreen.jsx

import React, { useEffect, useRef } from 'react'
import {
  View, Text, Image, StyleSheet,
  Animated, Easing, Dimensions,
} from 'react-native'
import { colors, fonts } from '../theme'

const { width: SW, height: SH } = Dimensions.get('window')

// ─── Single pulsing dot ────────────────────────────────────────────────────
function Dot({ delay }) {
  const anim = useRef(new Animated.Value(0.25)).current
  useEffect(() => {
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1,    duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.25, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start()
    }, delay)
  }, [])
  return <Animated.View style={[styles.dot, { opacity: anim }]} />
}

export default function SplashScreen() {

  // ── Animation refs ─────────────────────────────────────────────────────
  const ringRotate   = useRef(new Animated.Value(0)).current
  const ringOpacity  = useRef(new Animated.Value(0)).current
  const crestScale   = useRef(new Animated.Value(0.4)).current
  const crestOpacity = useRef(new Animated.Value(0)).current
  const crestGlow    = useRef(new Animated.Value(0)).current
  const iconOpacity  = useRef(new Animated.Value(0)).current
  const iconScale    = useRef(new Animated.Value(0.8)).current
  const titleOpacity = useRef(new Animated.Value(0)).current
  const titleY       = useRef(new Animated.Value(16)).current
  const divOpacity   = useRef(new Animated.Value(0)).current
  const divScale     = useRef(new Animated.Value(0)).current
  const poweredOp    = useRef(new Animated.Value(0)).current
  const clubOp       = useRef(new Animated.Value(0)).current
  const clubY        = useRef(new Animated.Value(14)).current
  const dotsOp       = useRef(new Animated.Value(0)).current
  const bgGlow       = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // ── 1. Background glow blooms ──
    Animated.timing(bgGlow, { toValue: 1, duration: 600, useNativeDriver: true }).start()

    // ── 2. Ring fades in ──
    Animated.timing(ringOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start()

    // ── 3. Ring spins continuously ──
    Animated.loop(
      Animated.timing(ringRotate, {
        toValue: 1, duration: 1600,
        easing: Easing.linear, useNativeDriver: true,
      })
    ).start()

    // ── 4. Crest springs in ──
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(crestScale,   { toValue: 1, tension: 65, friction: 7, useNativeDriver: true }),
        Animated.timing(crestOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start()
    }, 250)

    // ── 5. Icon (full pavilion-icon.png) fades in above crest ──
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(iconScale,   { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }),
        Animated.timing(iconOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start()
    }, 480)

    // ── 6. PAVILION title slides up ──
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(titleY,       { toValue: 0, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start()
    }, 700)

    // ── 7. Gold divider expands ──
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(divOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(divScale,   { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start()
    }, 920)

    // ── 8. "Powered by" fades in ──
    setTimeout(() => {
      Animated.timing(poweredOp, { toValue: 1, duration: 400, useNativeDriver: true }).start()
    }, 1050)

    // ── 9. Club name slides up ──
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(clubOp, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(clubY,  { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start()
    }, 1200)

    // ── 10. Loading dots appear ──
    setTimeout(() => {
      Animated.timing(dotsOp, { toValue: 1, duration: 400, useNativeDriver: true }).start()
    }, 1500)

    // ── 11. Crest gentle breathe ──
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(crestGlow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(crestGlow, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start()
    }, 1000)

  }, [])

  const spinDeg = ringRotate.interpolate({ inputRange: [0,1], outputRange: ['0deg','360deg'] })
  const crestPulse = crestGlow.interpolate({ inputRange: [0,1], outputRange: [1, 1.06] })
  const bgGlowOp   = bgGlow.interpolate({ inputRange: [0,1], outputRange: [0, 0.18] })

  const RING  = 130
  const CREST = 104

  return (
    <View style={styles.container}>

      {/* ── Ambient gold glow behind crest ── */}
      <Animated.View style={[styles.ambientGlow, { opacity: bgGlowOp }]} />

      {/* ── App icon (pavilion-icon.png) ── */}
      <Animated.View style={[
        styles.appIconWrap,
        { opacity: iconOpacity, transform: [{ scale: iconScale }] },
      ]}>
        <Image
          source={require('../../assets/pavilion-icon.png')}
          style={styles.appIcon}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ── Spinning ring + HTCC crest ── */}
      <View style={[styles.ringWrap, { width: RING + 20, height: RING + 20 }]}>

        {/* Spinning arc */}
        <Animated.View style={[
          styles.spinArc,
          {
            width: RING + 20, height: RING + 20,
            borderRadius: (RING + 20) / 2,
            opacity: ringOpacity,
            transform: [{ rotate: spinDeg }],
          },
        ]} />

        {/* Static inner ring */}
        <Animated.View style={[
          styles.staticRing,
          {
            width: RING, height: RING,
            borderRadius: RING / 2,
            opacity: ringOpacity,
          },
        ]} />

        {/* HTCC Crest */}
        <Animated.View style={[
          styles.crestBadge,
          {
            width: CREST, height: CREST, borderRadius: CREST / 2,
            opacity: crestOpacity,
            transform: [{ scale: Animated.multiply(crestScale, crestPulse) }],
          },
        ]}>
          <Image
            source={require('../../assets/htcc-logo.png')}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        </Animated.View>

      </View>

      {/* ── PAVILION ── */}
      <Animated.Text style={[
        styles.pavilionText,
        { opacity: titleOpacity, transform: [{ translateY: titleY }] },
      ]}>
        PAVILION
      </Animated.Text>

      {/* ── Gold divider ── */}
      <Animated.View style={[
        styles.divider,
        { opacity: divOpacity, transform: [{ scaleX: divScale }] },
      ]} />

      {/* ── Powered by ── */}
      <Animated.Text style={[styles.poweredText, { opacity: poweredOp }]}>
        powered by
      </Animated.Text>

      {/* ── Club name ── */}
      <Animated.View style={[
        styles.clubWrap,
        { opacity: clubOp, transform: [{ translateY: clubY }] },
      ]}>
        <Text style={styles.clubTop}>HARROW TOWN</Text>
        <Text style={styles.clubSub}>CRICKET CLUB</Text>
      </Animated.View>

      {/* ── Loading dots ── */}
      <Animated.View style={[styles.dotsRow, { opacity: dotsOp }]}>
        <Dot delay={0} />
        <Dot delay={220} />
        <Dot delay={440} />
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
    gap: 0,
  },

  // ── Ambient glow ──────────────────────────────────────────────────────────
  ambientGlow: {
    position: 'absolute',
    width: 320, height: 320,
    borderRadius: 160,
    backgroundColor: colors.gold,
    top: SH * 0.28,
  },

  // ── App icon ──────────────────────────────────────────────────────────────
  appIconWrap: { marginBottom: 20 },
  appIcon:     { width: 72, height: 72, borderRadius: 18 },

  // ── Ring + crest ──────────────────────────────────────────────────────────
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  spinArc: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: colors.gold,
    borderBottomColor: 'transparent',
    borderLeftColor: 'rgba(245,197,24,0.25)',
  },
  staticRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(245,197,24,0.2)',
  },
  crestBadge: {
    backgroundColor: colors.navy,
    borderWidth: 2.5,
    borderColor: colors.gold,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },

  // ── Text ──────────────────────────────────────────────────────────────────
  pavilionText: {
    fontFamily: fonts.display,
    fontSize:   58,
    letterSpacing: 10,
    color: colors.white,
    lineHeight: 64,
    marginBottom: 14,
  },
  divider: {
    width: 80, height: 1.5,
    backgroundColor: colors.gold,
    opacity: 0.55,
    marginBottom: 14,
  },
  poweredText: {
    fontFamily: fonts.body,
    fontSize:   11,
    letterSpacing: 4,
    color: colors.textMuted,
    textTransform: 'lowercase',
    marginBottom: 10,
  },
  clubWrap:  { alignItems: 'center', marginBottom: 0 },
  clubTop: {
    fontFamily:    fonts.display,
    fontSize:      20,
    letterSpacing: 6,
    color:         colors.gold,
    lineHeight:    24,
  },
  clubSub: {
    fontFamily:    fonts.display,
    fontSize:      12,
    letterSpacing: 5,
    color:         colors.textMuted,
    lineHeight:    18,
    marginTop:     4,
  },

  // ── Loading dots ──────────────────────────────────────────────────────────
  dotsRow: {
    position:      'absolute',
    bottom:        52,
    flexDirection: 'row',
    gap:           10,
  },
  dot: {
    width: 7, height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.gold,
  },
})
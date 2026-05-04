// pavilion-app/src/components/SplashV2_Fusion.jsx
// Splash: Pavilion + HTCC fuse → separate → dual orbit rings spin
// → typewriter PAVILION → divider → HARROW TOWN → CRICKET CLUB → dots

import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, Image, StyleSheet,
  Animated, Easing, Dimensions,
} from 'react-native'
import { colors, fonts } from '../theme'

const { width: SW } = Dimensions.get('window')

// ─── CONFIGURABLE ─────────────────────────────────────────────────────────────
const LOGO_SIZE    = 80     // each logo circle diameter
const SEPARATE_X   = 64     // how far each logo moves outward
const OUTER_RING   = 200    // outer orbit ring diameter
const INNER_RING   = 170    // inner orbit ring diameter
const CHAR_MS      = 55    // ms per typewriter character
// ──────────────────────────────────────────────────────────────────────────────

function PulseDot({ delay }) {
  const a = useRef(new Animated.Value(0.15)).current
  useEffect(() => {
    const id = setTimeout(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(a, { toValue: 1,    duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.15, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])).start()
    }, delay)
    return () => clearTimeout(id)
  }, [])
  return <Animated.View style={[styles.dot, { opacity: a }]} />
}

function useTypewriter(text, charMs, enabled) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) { setCount(0); return }
    let i = 0
    const iv = setInterval(() => {
      i++
      setCount(i)
      if (i >= text.length) clearInterval(iv)
    }, charMs)
    return () => clearInterval(iv)
  }, [enabled])
  return count
}

export default function SplashV2_Fusion() {
  // ── Cleanup refs — all setTimeout IDs collected here, cleared on unmount ───
  const timerRefs    = useRef([])
  // ── Animated loop handles — stored so .stop() can be called on unmount ─────
  const outerLoopRef = useRef(null)
  const innerLoopRef = useRef(null)

  // ── Logo animations ───────────────────────────────────────────────────────
  const pavilionX = useRef(new Animated.Value(0)).current
  const crestX    = useRef(new Animated.Value(0)).current
  const logoScale = useRef(new Animated.Value(0.4)).current
  const logoOp    = useRef(new Animated.Value(0)).current

  // ── Gold centre line ──────────────────────────────────────────────────────
  const lineOp     = useRef(new Animated.Value(0)).current
  const lineScaleY = useRef(new Animated.Value(0)).current

  // ── Orbit rings ───────────────────────────────────────────────────────────
  const outerSpin = useRef(new Animated.Value(0)).current
  const innerSpin = useRef(new Animated.Value(0)).current
  const ringsOp   = useRef(new Animated.Value(0)).current

  // ── Text phase ────────────────────────────────────────────────────────────
  const [typePav,    setTypePav]    = useState(false)
  const [typeHT,     setTypeHT]     = useState(false)
  const [typeCC,     setTypeCC]     = useState(false)
  const [showDiv,    setShowDiv]    = useState(false)
  const [showDots,   setShowDots]   = useState(false)
  const [showCursor, setShowCursor] = useState(true)

  const PAVILION     = 'PAVILION'
  const HARROW_TOWN  = 'HARROW TOWN'
  const CRICKET_CLUB = 'CRICKET CLUB'

  const pavCount = useTypewriter(PAVILION,     CHAR_MS, typePav)
  const htCount  = useTypewriter(HARROW_TOWN,  CHAR_MS, typeHT)
  const ccCount  = useTypewriter(CRICKET_CLUB, CHAR_MS, typeCC)

  // Animated values for text containers
  const titleOp = useRef(new Animated.Value(0)).current
  const titleY  = useRef(new Animated.Value(24)).current
  const clubOp  = useRef(new Animated.Value(0)).current
  const clubY   = useRef(new Animated.Value(14)).current
  const subOp   = useRef(new Animated.Value(0)).current
  const subY    = useRef(new Animated.Value(10)).current
  const dotsOp  = useRef(new Animated.Value(0)).current
  const divOp   = useRef(new Animated.Value(0)).current

  const pavMs = PAVILION.length     * CHAR_MS
  const htMs  = HARROW_TOWN.length  * CHAR_MS
  const ccMs  = CRICKET_CLUB.length * CHAR_MS

  useEffect(() => {
    // ── Helper: schedule setTimeout, track ID for cleanup on unmount ─────────
    const after = (ms, fn) => {
      const id = setTimeout(fn, ms)
      timerRefs.current.push(id)
    }

    // Phase 1 — logos spring in
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.timing(logoOp,    { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start()

    // Phase 2 — gold line grows (500ms)
    after(500, () => {
      Animated.parallel([
        Animated.timing(lineOp,     { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(lineScaleY, { toValue: 1, duration: 340, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
      ]).start()
    })

    // Phase 3 — logos separate + rings appear (850ms)
    after(850, () => {
      Animated.parallel([
        Animated.spring(pavilionX, { toValue: -SEPARATE_X, tension: 36, friction: 7, useNativeDriver: true }),
        Animated.spring(crestX,    { toValue:  SEPARATE_X, tension: 36, friction: 7, useNativeDriver: true }),
        Animated.timing(ringsOp,   { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start()
    })

    // Orbits spin continuously — store refs so loops can be stopped on unmount
    outerLoopRef.current = Animated.loop(
      Animated.timing(outerSpin, { toValue: 1, duration: 3400, easing: Easing.linear, useNativeDriver: true })
    )
    innerLoopRef.current = Animated.loop(
      Animated.timing(innerSpin, { toValue: 1, duration: 2100, easing: Easing.linear, useNativeDriver: true })
    )
    outerLoopRef.current.start()
    innerLoopRef.current.start()

    // Phase 4 — PAVILION title + typewriter (1350ms)
    after(1350, () => {
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(titleY,  { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start()
      setTypePav(true)
    })

    // Cursor blink then hide
    after(1350 + pavMs + 60, () => {
      let b = 0
      const blink = setInterval(() => {
        setShowCursor(c => !c)
        b++
        if (b >= 5) { clearInterval(blink); setShowCursor(false) }
      }, 280)
      timerRefs.current.push(blink)
    })

    // Phase 5 — divider (after PAVILION done)
    const divAt = 1350 + pavMs + 260
    after(divAt, () => {
      setShowDiv(true)
      Animated.timing(divOp, { toValue: 1, duration: 300, useNativeDriver: true }).start()
    })

    // Phase 6 — HARROW TOWN
    const htAt = divAt + 320
    after(htAt, () => {
      Animated.parallel([
        Animated.timing(clubOp, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(clubY,  { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start()
      setTypeHT(true)
    })

    // Phase 7 — CRICKET CLUB
    const ccAt = htAt + htMs + 150
    after(ccAt, () => {
      Animated.parallel([
        Animated.timing(subOp, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(subY,  { toValue: 0, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start()
      setTypeCC(true)
    })

    // Phase 8 — dots
    after(ccAt + ccMs + 700, () => {
      setShowDots(true)
      Animated.timing(dotsOp, { toValue: 1, duration: 400, useNativeDriver: true }).start()
    })

    // ── Cleanup: cancel all pending timers + stop animation loops on unmount ──
    return () => {
      timerRefs.current.forEach(id => clearTimeout(id))
      timerRefs.current = []
      outerLoopRef.current?.stop()
      innerLoopRef.current?.stop()
    }
  }, [])

  const outerRot = outerSpin.interpolate({ inputRange: [0,1], outputRange: ['0deg','360deg'] })
  const innerRot = innerSpin.interpolate({ inputRange: [0,1], outputRange: ['360deg','0deg'] })

  return (
    <View style={styles.container}>

      {/* ── Fusion area ── */}
      <View style={styles.fusionWrap}>

        {/* Outer orbit ring — clockwise */}
        <Animated.View style={[styles.orbitOuter, { opacity: ringsOp, transform: [{ rotate: outerRot }] }]} />

        {/* Inner orbit ring — counter-clockwise */}
        <Animated.View style={[styles.orbitInner, { opacity: ringsOp, transform: [{ rotate: innerRot }] }]} />

        {/* Pavilion icon — slightly smaller inside the ring */}
        <Animated.View style={[styles.logoAbs, { opacity: logoOp, transform: [{ scale: logoScale }, { translateX: pavilionX }] }]}>
          <View style={styles.logoCircle}>
            <Image source={require('../../assets/pavilion-icon.png')} style={styles.logoImgSmall} resizeMode="contain" />
          </View>
        </Animated.View>

        {/* Gold centre line */}
        <Animated.View style={[styles.centreLine, { opacity: lineOp, transform: [{ scaleY: lineScaleY }] }]} />

        {/* HTCC crest — larger inside the ring for clarity */}
        <Animated.View style={[styles.logoAbs, { opacity: logoOp, transform: [{ scale: logoScale }, { translateX: crestX }] }]}>
          <View style={styles.logoCircle}>
            <Image source={require('../../assets/htcc-logo.png')} style={styles.logoImgLarge} resizeMode="cover" />
          </View>
        </Animated.View>
      </View>

      {/* ── PAVILION ── */}
      <Animated.View style={[styles.titleRow, { opacity: titleOp, transform: [{ translateY: titleY }] }]}>
        <Text style={styles.title}>{PAVILION.slice(0, pavCount)}</Text>
        {showCursor && typePav && !showDiv && <View style={styles.cursor} />}
      </Animated.View>

      {/* ── Divider ── */}
      <Animated.View style={[styles.textDivider, { opacity: divOp }]} />

      {/* ── HARROW TOWN ── */}
      <Animated.View style={[{ opacity: clubOp, transform: [{ translateY: clubY }] }]}>
        <Text style={styles.clubTop}>{HARROW_TOWN.slice(0, htCount)}</Text>
      </Animated.View>

      {/* ── CRICKET CLUB ── */}
      <Animated.View style={[{ opacity: subOp, transform: [{ translateY: subY }], marginTop: 4 }]}>
        <Text style={styles.clubSub}>{CRICKET_CLUB.slice(0, ccCount)}</Text>
      </Animated.View>

      {/* ── Dots ── */}
      {showDots && (
        <Animated.View style={[styles.dotsRow, { opacity: dotsOp }]}>
          <PulseDot delay={0} />
          <PulseDot delay={180} />
          <PulseDot delay={360} />
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center',
  },

  fusionWrap: {
    width: OUTER_RING + 20, height: OUTER_RING + 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 40,
  },

  orbitOuter: {
    position: 'absolute',
    width: OUTER_RING, height: OUTER_RING, borderRadius: OUTER_RING / 2,
    borderWidth: 1.5,
    borderTopColor: colors.gold,
    borderRightColor: `${colors.gold}50`,
    borderBottomColor: 'transparent',
    borderLeftColor: `${colors.gold}18`,
  },

  orbitInner: {
    position: 'absolute',
    width: INNER_RING, height: INNER_RING, borderRadius: INNER_RING / 2,
    borderWidth: 1,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: `${colors.gold}65`,
    borderLeftColor: `${colors.gold}28`,
  },

  logoAbs: {
    position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
  },

  logoCircle: {
    width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: LOGO_SIZE / 2,
    backgroundColor: '#0D1B2A',
    overflow: 'hidden',
    borderWidth: 2, borderColor: colors.gold,
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45, shadowRadius: 12, elevation: 10,
  },

  logoImgSmall: { width: '78%', height: '78%', alignSelf: 'center', marginTop: '11%' },
  logoImgLarge: { width: '108%', height: '108%', marginLeft: '-4%', marginTop: '-4%' },

  centreLine: {
    position: 'absolute',
    width: 1.5, height: 44,
    backgroundColor: colors.gold,
  },

  titleRow: {
    flexDirection: 'row', alignItems: 'center',
    height: 68, marginBottom: 10,
  },

  title: {
    fontFamily: fonts.display, fontSize: 52,
    letterSpacing: 10, color: colors.white, lineHeight: 60,
  },

  cursor: {
    width: 3, height: 48, backgroundColor: colors.gold,
    borderRadius: 2, marginLeft: 4,
  },

  textDivider: {
    width: 60, height: 1.5, backgroundColor: colors.gold,
    opacity: 0.55, marginBottom: 12,
  },

  clubTop: {
    fontFamily: fonts.display, fontSize: 24,
    letterSpacing: 5, color: colors.gold, textAlign: 'center',
  },

  clubSub: {
    fontFamily: fonts.display, fontSize: 15,
    letterSpacing: 5, color: colors.textMuted, textAlign: 'center',
  },

  dotsRow: {
    position: 'absolute', bottom: 52,
    flexDirection: 'row', gap: 10,
  },

  dot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: colors.gold,
  },
})
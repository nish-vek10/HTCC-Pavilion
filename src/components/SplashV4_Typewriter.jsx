// pavilion-app/src/components/SplashV4_Typewriter.jsx
// Style: Typewriter letter-by-letter reveal with cursor blink

import React, { useEffect, useRef, useState } from 'react'
import { View, Text, Image, StyleSheet, Animated, Easing } from 'react-native'
import { colors, fonts } from '../theme'

const WORD    = 'PAVILION'
const CHAR_MS = 110   // ms per character

export default function SplashV4_Typewriter() {
  const [visibleChars, setVisibleChars] = useState(0)
  const [showCursor,   setShowCursor]   = useState(true)
  const crestOp    = useRef(new Animated.Value(0)).current
  const crestScale = useRef(new Animated.Value(0.7)).current
  const subOp      = useRef(new Animated.Value(0)).current
  const divOp      = useRef(new Animated.Value(0)).current
  const dotsOp     = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Crest fades up first
    Animated.parallel([
      Animated.timing(crestOp,    { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(crestScale, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start()

    // Typewriter starts after crest settles
    let i = 0
    const interval = setInterval(() => {
      i++
      setVisibleChars(i)
      if (i >= WORD.length) clearInterval(interval)
    }, CHAR_MS)
    const typeStartDelay = 600
    const timer = setTimeout(() => {
      let j = 0
      const iv = setInterval(() => {
        j++
        setVisibleChars(j)
        if (j >= WORD.length) {
          clearInterval(iv)
          // Cursor blinks a few times then hides
          setTimeout(() => {
            let blinks = 0
            const blink = setInterval(() => {
              setShowCursor(c => !c)
              blinks++
              if (blinks >= 6) { clearInterval(blink); setShowCursor(false) }
            }, 300)
          }, 200)
        }
      }, CHAR_MS)
    }, typeStartDelay)

    // Sub-elements appear after typing done
    const fullTime = typeStartDelay + WORD.length * CHAR_MS
    setTimeout(() => {
      Animated.timing(divOp, { toValue: 1, duration: 400, useNativeDriver: true }).start()
    }, fullTime + 200)
    setTimeout(() => {
      Animated.timing(subOp, { toValue: 1, duration: 500, useNativeDriver: true }).start()
    }, fullTime + 500)
    setTimeout(() => {
      Animated.timing(dotsOp, { toValue: 1, duration: 400, useNativeDriver: true }).start()
    }, fullTime + 900)

    return () => clearTimeout(timer)
  }, [])

  const displayed = WORD.slice(0, visibleChars)

  return (
    <View style={styles.container}>

      {/* Crest */}
      <Animated.View style={[styles.crestWrap, {
        opacity: crestOp,
        transform: [{ scale: crestScale }],
      }]}>
        <Image source={require('../../assets/htcc-logo.png')} style={styles.crestImage} resizeMode="cover" />
      </Animated.View>

      {/* Typewriter title */}
      <View style={styles.typeRow}>
        <Text style={styles.title}>{displayed}</Text>
        {showCursor && <View style={styles.cursor} />}
      </View>

      {/* Divider */}
      <Animated.View style={[styles.divider, { opacity: divOp }]} />

      {/* Club name */}
      <Animated.View style={[styles.clubWrap, { opacity: subOp }]}>
        <Text style={styles.poweredBy}>powered by</Text>
        <Text style={styles.clubTop}>HARROW TOWN</Text>
        <Text style={styles.clubSub}>CRICKET CLUB</Text>
      </Animated.View>

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
    }, delay)
  }, [])
  return <Animated.View style={[styles.dot, { opacity: a }]} />
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', gap: 16 },
  crestWrap:  { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.navy, borderWidth: 2.5, borderColor: colors.gold, overflow: 'hidden', marginBottom: 8 },
  crestImage: { width: '100%', height: '100%' },
  typeRow:    { flexDirection: 'row', alignItems: 'center', height: 72 },
  title:      { fontFamily: fonts.display, fontSize: 58, letterSpacing: 10, color: colors.white },
  cursor:     { width: 4, height: 52, backgroundColor: colors.gold, marginLeft: 4, borderRadius: 2 },
  divider:    { width: 72, height: 1.5, backgroundColor: colors.gold, opacity: 0.5 },
  clubWrap:   { alignItems: 'center', gap: 4 },
  poweredBy:  { fontFamily: fonts.body, fontSize: 11, letterSpacing: 3, color: colors.textMuted, marginBottom: 6 },
  clubTop:    { fontFamily: fonts.display, fontSize: 19, letterSpacing: 5, color: colors.gold },
  clubSub:    { fontFamily: fonts.display, fontSize: 11, letterSpacing: 5, color: colors.textMuted },
  dotsRow:    { position: 'absolute', bottom: 52, flexDirection: 'row', gap: 10 },
  dot:        { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.gold },
})
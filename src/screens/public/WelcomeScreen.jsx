// pavilion-app/src/screens/public/WelcomeScreen.jsx
// Landing screen — dual logos, animated stats, feature grid, CTA buttons

import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, Image, TouchableOpacity,
  StyleSheet, Animated, Dimensions, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SCREENS, APP_NAME, CLUB_NAME, CLUB_FOUNDED } from '../../lib/constants'
import { colors, fonts, spacing, radius } from '../../theme'
import AppIcon from '../../components/AppIcon'

const { width: SW } = Dimensions.get('window')

// ─── CONFIGURABLE ─────────────────────────────────────────────────────────────
// Feature grid — 6 cards, 2 columns, reflects all current v1.3.0 features
const FEATURES = [
  {
    icon:  'date',
    title: 'Live Fixtures',
    desc:  'Full schedule for all 5 teams. Team-coloured cards, venues, home/away and match type.',
    color: '#60A5FA',
  },
  {
    icon:  'cricketBat',
    title: 'Playing XI',
    desc:  'Get notified the moment your captain publishes the squad for your next match.',
    color: '#F5C518',
  },
  {
    icon:  'approve',
    title: 'Set Availability',
    desc:  'One tap to confirm for Saturdays and Sundays. Captains see your response instantly.',
    color: '#22C55E',
  },
  {
    icon:  'stats',
    title: 'Season Stats',
    desc:  'Batting, bowling, fielding and awards tabs. Tap any player for a full stat breakdown.',
    color: '#F97316',
  },
  {
    icon:  'trophy',
    title: 'Player of the Match',
    desc:  'Instant POTM calculation from submitted scorecards — no waiting for weekly sync.',
    color: '#F5C518',
    noTint: true,  // trophy has baked-in colours
  },
  {
    icon:  'cricketField',
    title: 'Fantasy League',
    desc:  'Pick your Best XI, assign captain and vice-captain, earn points and top the leaderboard. Coming soon.',
    color: '#A78BFA',
  },
]

// Animated count-up stats
const STATS = [
  { target: 5,  label: 'TEAMS',     duration: 800  },
  { target: 55, label: 'MEMBERS',   duration: 1200 },
  { target: 44, label: 'SAT. SLOTS',duration: 1000 },
  { target: 1,  label: 'PLATFORM',  duration: 600  },
]
// ──────────────────────────────────────────────────────────────────────────────

function CountUp({ target, duration, trigger }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!trigger) return
    const steps   = Math.min(target, 40)
    const stepMs  = Math.max(duration / steps, 16)
    const stepVal = target / steps
    let current   = 0
    const iv = setInterval(() => {
      current += stepVal
      if (current >= target) { setVal(target); clearInterval(iv) }
      else setVal(Math.round(current))
    }, stepMs)
    return () => clearInterval(iv)
  }, [trigger])

  return <Text style={styles.statNum}>{target > 50 ? `${val}+` : String(val)}</Text>
}

export default function WelcomeScreen({ navigation }) {
  const headerAnim = useRef(new Animated.Value(0)).current
  const heroAnim   = useRef(new Animated.Value(0)).current
  const statsAnim  = useRef(new Animated.Value(0)).current
  const btnsAnim   = useRef(new Animated.Value(0)).current
  const [statsTriggered, setStatsTriggered] = useState(false)

  const fade = (anim, toY = 20) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [toY, 0] }) }],
  })

  useEffect(() => {
    Animated.stagger(130, [
      Animated.spring(headerAnim, { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }),
      Animated.spring(heroAnim,   { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }),
      Animated.spring(statsAnim,  { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }),
      Animated.spring(btnsAnim,   { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }),
    ]).start()
    setTimeout(() => setStatsTriggered(true), 520)
  }, [])

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Gold top accent bar ── */}
        <View style={styles.topBar} />

        {/* ── Header: dual logos + badge ── */}
        <Animated.View style={[styles.headerWrap, fade(headerAnim)]}>
          <View style={styles.logosRow}>
            <View style={[styles.logoCircle, styles.pavilionCircle]}>
              <Image source={require('../../../assets/pavilion-icon.png')} style={styles.logoImg} resizeMode="contain" />
            </View>
            <View style={styles.logoSep} />
            <View style={[styles.logoCircle, styles.crestCircle]}>
              <Image source={require('../../../assets/htcc-logo.png')} style={styles.logoImg} resizeMode="cover" />
            </View>
          </View>
          <View style={styles.estBadge}>
            <Text style={styles.estText}>Est. {CLUB_FOUNDED} · {CLUB_NAME}</Text>
          </View>
        </Animated.View>

        {/* ── Hero text ── */}
        <Animated.View style={[styles.heroWrap, fade(heroAnim)]}>
          <Text style={styles.appName}>PAVILION</Text>
          <View style={styles.heroDivider} />
          <Text style={styles.heroHeadline}>
            <Text style={styles.heroWhite}>YOUR SQUAD.{'\n'}YOUR </Text>
            <Text style={styles.heroGold}>PAVILION.</Text>
          </Text>
          <Text style={styles.heroSub}>
            One platform for all five HTCC teams. Set availability, track
            selections, view live stats and know your squad — before matchday.
          </Text>
        </Animated.View>

        {/* ── Animated stats row ── */}
        <Animated.View style={[styles.statsRow, fade(statsAnim)]}>
          {STATS.map((s, i) => (
            <View key={s.label} style={[styles.statItem, i < STATS.length - 1 && styles.statDivider]}>
              <CountUp target={s.target} duration={s.duration} trigger={statsTriggered} />
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── CTA Buttons ── */}
        <Animated.View style={[styles.btnsWrap, fade(btnsAnim)]}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate(SCREENS.LOGIN)}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Member Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate(SCREENS.SIGNUP)}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>Join HTCC →</Text>
          </TouchableOpacity>

          <Text style={styles.approvalNote}>New accounts require admin approval</Text>
        </Animated.View>

        {/* ── Feature grid ── */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionLabel}>WHAT'S INSIDE</Text>
          <Text style={styles.sectionTitle}>Built for HTCC</Text>

          <View style={styles.featuresGrid}>
            {FEATURES.map(f => (
              <View key={f.title} style={[styles.featureCard, { borderTopColor: f.color }]}>
                <View style={[styles.featureIconWrap, { backgroundColor: `${f.color}12` }]}>
                  {/* Trophy has baked-in colours — never apply tint */}
                  {f.noTint
                    ? <AppIcon name={f.icon} size={20} />
                    : <AppIcon name={f.icon} size={20} tint={f.color} />
                  }
                </View>
                <Text style={[styles.featureTitle, { color: f.color }]}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Stats banner ── */}
        <View style={styles.seasonBanner}>
          <View style={styles.seasonIconWrap}>
            <AppIcon name="stats" size={28} tint="#60A5FA" />
          </View>
          <View style={styles.seasonLeft}>
            <Text style={styles.seasonLabel}>LIVE STATS</Text>
            <Text style={styles.seasonTitle}>Every Season, Every Team</Text>
            <Text style={styles.seasonSub}>
              Batting, bowling, fielding and awards — synced from PlayCricket
              and updated after every submitted scorecard.
            </Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <View style={styles.footerCrest}>
              <Image source={require('../../../assets/htcc-logo.png')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </View>
            <Text style={styles.footerMid}>
              Powered by <Text style={{ color: colors.gold }}>{APP_NAME}</Text>
            </Text>
          </View>
          <Text style={styles.footerCopy}>© {new Date().getFullYear()} {CLUB_NAME}</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.navy },
  scroll: { alignItems: 'center', paddingBottom: 48 },

  topBar: { width: '100%', height: 3, backgroundColor: colors.gold, opacity: 0.85, marginBottom: spacing.xl },

  // ── Header ────────────────────────────────────────────────────────────────
  headerWrap: { alignItems: 'center', marginBottom: spacing.lg },
  logosRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  logoCircle: {
    width: 58, height: 58, borderRadius: 29,
    overflow: 'hidden', borderWidth: 2, borderColor: colors.gold,
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  pavilionCircle: { backgroundColor: '#0D1B2A' },
  crestCircle:    { backgroundColor: colors.navy },
  logoImg:        { width: '100%', height: '100%' },
  logoSep: {
    width: 1.5, height: 30, backgroundColor: colors.gold,
    opacity: 0.65, marginHorizontal: 12,
  },
  estBadge: {
    backgroundColor: 'rgba(245,197,24,0.1)',
    borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
  },
  estText: {
    fontFamily: fonts.bold, fontSize: 11,
    color: colors.gold, letterSpacing: 1.5, textTransform: 'uppercase',
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroWrap: { alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  appName: {
    fontFamily: fonts.display, fontSize: 58,
    letterSpacing: 10, color: colors.white, textAlign: 'center', lineHeight: 66,
  },
  heroDivider: {
    width: 56, height: 1.5, backgroundColor: colors.gold,
    opacity: 0.5, marginVertical: spacing.md,
  },
  heroHeadline:  { textAlign: 'center', marginBottom: spacing.md },
  heroWhite:     { fontFamily: fonts.display, fontSize: 26, letterSpacing: 2, color: colors.white, lineHeight: 32 },
  heroGold:      { fontFamily: fonts.display, fontSize: 26, letterSpacing: 2, color: colors.gold,  lineHeight: 32 },
  heroSub: {
    fontFamily: fonts.body, fontSize: 14, color: colors.textMuted,
    textAlign: 'center', lineHeight: 22, paddingHorizontal: spacing.sm,
  },

  // ── Stats ─────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row', width: SW - spacing.md * 2,
    backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, marginBottom: spacing.lg, paddingVertical: 16,
  },
  statItem:    { flex: 1, alignItems: 'center' },
  statDivider: { borderRightWidth: 1, borderRightColor: colors.border },
  statNum:     { fontFamily: fonts.display, fontSize: 26, color: colors.gold, letterSpacing: 1 },
  statLabel:   { fontFamily: fonts.body, fontSize: 9, color: colors.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 3 },

  // ── Buttons ───────────────────────────────────────────────────────────────
  btnsWrap: { width: SW - spacing.md * 2, gap: 10, marginBottom: spacing.xl },
  primaryBtn: {
    width: '100%', backgroundColor: colors.gold,
    paddingVertical: 16, borderRadius: radius.md, alignItems: 'center',
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  primaryBtnText:   { fontFamily: fonts.bold, fontSize: 16, color: colors.navy, letterSpacing: 0.5 },
  secondaryBtn: {
    width: '100%', paddingVertical: 16, borderRadius: radius.md, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  secondaryBtnText: { fontFamily: fonts.bold, fontSize: 16, color: colors.textLight, letterSpacing: 0.5 },
  approvalNote:     { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 2 },

  // ── Features ──────────────────────────────────────────────────────────────
  featuresSection: {
    width: '100%', paddingHorizontal: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: spacing.xl, marginBottom: spacing.lg, alignItems: 'center',
  },
  sectionLabel: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 2, color: colors.gold, textTransform: 'uppercase', marginBottom: 6 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 1, color: colors.white, marginBottom: spacing.lg, textAlign: 'center' },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', width: '100%' },
  featureCard: {
    width: '47%', backgroundColor: colors.navyLight,
    borderWidth: 1, borderColor: colors.border,
    borderTopWidth: 2, borderRadius: radius.md, padding: 14,
  },
  featureIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  featureTitle:    { fontFamily: fonts.bold, fontSize: 12, marginBottom: 5, letterSpacing: 0.3 },
  featureDesc:     { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, lineHeight: 17 },

  // ── Stats banner ──────────────────────────────────────────────────────────
  seasonBanner: {
    width: SW - spacing.md * 2,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(96,165,250,0.06)',
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)',
    borderRadius: radius.md, padding: 16, marginBottom: spacing.xl,
  },
  seasonIconWrap: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: 'rgba(96,165,250,0.12)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  seasonLeft:  { flex: 1 },
  seasonLabel: { fontFamily: fonts.bold, fontSize: 9, color: '#60A5FA', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  seasonTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.white, letterSpacing: 1, marginBottom: 4 },
  seasonSub:   { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, lineHeight: 18 },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer:     { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, width: '100%', alignItems: 'center', gap: 6 },
  footerRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerCrest:{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.navy, borderWidth: 1, borderColor: colors.gold, overflow: 'hidden' },
  footerMid:  { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  footerCopy: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, opacity: 0.6 },
})

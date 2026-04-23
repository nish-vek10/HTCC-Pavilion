// pavilion-app/src/screens/member/FantasyLeagueScreen.jsx
// Fantasy League — Coming Soon placeholder screen
// Full FPL-style feature planned for v1.4.0:
//   - Pick Best XI from all HTCC players across any team
//   - Assign captain (3x points) and vice-captain (2x points)
//   - Points calculated using POTM constants from MatchScorecardScreen.jsx (POTM object)
//   - Unique team name per member — no duplicates
//   - Season leaderboard showing total points across all fantasy teams

import React, { useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, Animated, Easing, ScrollView,
} from 'react-native'
import { colors, fonts, spacing, radius } from '../../theme'
import AppIcon from '../../components/AppIcon'
import TopHeader from '../../components/layout/TopHeader'
import { CLUB_NAME } from '../../lib/constants'

// ─── Feature preview cards — shown as teaser content ─────────────────────────
const FEATURES = [
  {
    icon:  'cricketBat',
    title: 'Pick Your Best XI',
    desc:  'Choose any 11 players across all HTCC teams and build your ultimate squad.',
    color: colors.gold,
  },
  {
    icon:  'captainBadge',
    title: 'Captain & Vice-Captain',
    desc:  'Assign your captain for triple points and vice-captain for double points on their performance.',
    color: '#60A5FA',
  },
  {
    icon:  'trophy',
    title: 'POTM-Based Points',
    desc:  'Points calculated using the same formula as Player of the Match — runs, wickets, fielding and more.',
    color: '#F97316',
  },
  {
    icon:  'stats',
    title: 'Season Leaderboard',
    desc:  'Compete across the season. Your total points update every match week.',
    color: colors.green,
  },
  {
    icon:  'profile',
    title: 'Name Your Team',
    desc:  'Give your squad a unique name — no two managers can share the same team name.',
    color: '#A78BFA',
  },
]

// ─── Pulse dot component for the "coming soon" animation ─────────────────────
function PulseDot({ delay }) {
  const a = useRef(new Animated.Value(0.2)).current
  useEffect(() => {
    const id = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(a, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(a, { toValue: 0.2, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start()
    }, delay)
    return () => clearTimeout(id)
  }, [])
  return <Animated.View style={[styles.dot, { opacity: a }]} />
}

export default function FantasyLeagueScreen() {
  // ── Shimmer animation for the Coming Soon badge ────────────────────────
  const shimmer = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, {
        toValue:  1,
        duration: 2000,
        easing:   Easing.linear,
        useNativeDriver: true,
      })
    ).start()
  }, [])

  const shimmerTranslate = shimmer.interpolate({
    inputRange:  [0, 1],
    outputRange: [-120, 120],
  })

  return (
    <View style={styles.container}>
      <TopHeader />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Page label ── */}
        <View style={styles.labelRow}>
          <Text style={styles.sectionLabel}>MEMBER</Text>
          <Text style={styles.pageTitle}>FANTASY LEAGUE</Text>
        </View>

        {/* ── Coming Soon hero card ── */}
        <View style={styles.heroCard}>
          {/* Shimmer badge */}
          <View style={styles.comingSoonBadge}>
            <Animated.View
              style={[
                styles.shimmerOverlay,
                { transform: [{ translateX: shimmerTranslate }] },
              ]}
            />
            <Text style={styles.comingSoonText}>COMING SOON</Text>
          </View>

          {/* Trophy icon */}
          <View style={styles.trophyWrap}>
            <AppIcon name="trophy" size={56} />
          </View>

          {/* Headline */}
          <Text style={styles.heroTitle}>PAVILION FANTASY</Text>
          <Text style={styles.heroSub}>
            Build your dream HTCC XI. Earn points. Top the leaderboard.
          </Text>

          {/* Pulse dots */}
          <View style={styles.dotsRow}>
            <PulseDot delay={0} />
            <PulseDot delay={200} />
            <PulseDot delay={400} />
          </View>
        </View>

        {/* ── How it works label ── */}
        <View style={styles.howRow}>
          <View style={styles.howDivider} />
          <Text style={styles.howLabel}>HOW IT WORKS</Text>
          <View style={styles.howDivider} />
        </View>

        {/* ── Feature preview cards ── */}
        {FEATURES.map(feat => (
          <View key={feat.title} style={[styles.featureCard, { borderLeftColor: feat.color }]}>
            <View style={[styles.featureIconWrap, { backgroundColor: `${feat.color}15` }]}>
              {/* Medal/trophy icons have own colours — no tint; others get feature colour */}
              {feat.icon === 'trophy' || feat.icon === 'captainBadge'
                ? <AppIcon name={feat.icon} size={22} />
                : <AppIcon name={feat.icon} size={22} tint={feat.color} />
              }
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureTitle, { color: feat.color }]}>{feat.title}</Text>
              <Text style={styles.featureDesc}>{feat.desc}</Text>
            </View>
          </View>
        ))}

        {/* ── Points system — mirrors MatchScorecardScreen POTM constants exactly ── */}
        <View style={styles.pointsCard}>
          <View style={styles.pointsHeader}>
            <AppIcon name="cricketBat" size={16} tint={colors.gold} />
            <Text style={styles.pointsTitle}>POINTS SYSTEM</Text>
          </View>
          <Text style={styles.pointsSubtitle}>
            Identical to the Player of the Match formula used in every submitted scorecard.
          </Text>

          {/* Batting */}
          <Text style={styles.pointsSection}>BATTING</Text>
          <View style={styles.pointsGrid}>
            {[
              { action: 'Per run',               pts: '+1'  },
              { action: 'Four bonus',            pts: '+2'  },
              { action: 'Six bonus',             pts: '+4'  },
              { action: 'Reach 25 runs',         pts: '+10' },
              { action: 'Reach 50 runs',         pts: '+20' },
              { action: 'Century (100+)',         pts: '+40' },
              { action: 'Not out (30+ runs)',     pts: '+5',  neg: false },
              { action: 'Duck (dismissed 0)',     pts: '−5',  neg: true  },
              { action: 'Run out (batting)',       pts: '−8',  neg: true  },
            ].map(({ action, pts, neg }) => (
              <View key={action} style={styles.pointsRow}>
                <Text style={styles.pointsAction}>{action}</Text>
                <Text style={[styles.pointsValue, neg && { color: '#EF4444' }]}>{pts}</Text>
              </View>
            ))}
          </View>

          {/* Bowling */}
          <Text style={styles.pointsSection}>BOWLING</Text>
          <View style={styles.pointsGrid}>
            {[
              { action: 'Per wicket',            pts: '+25', neg: false },
              { action: 'Per maiden',            pts: '+5',  neg: false },
              { action: '3-wicket haul',         pts: '+10', neg: false },
              { action: '5-wicket haul',         pts: '+25', neg: false },
              { action: 'Per wide',              pts: '−1',  neg: true  },
              { action: 'Per no-ball',           pts: '−2',  neg: true  },
              { action: 'Economy 7.00–7.99',     pts: '−2',  neg: true  },
              { action: 'Economy 8.00–8.99',     pts: '−3',  neg: true  },
              { action: 'Economy 9.00–9.99',     pts: '−5',  neg: true  },
              { action: 'Economy ≥ 10',          pts: '−8',  neg: true  },
            ].map(({ action, pts, neg }) => (
              <View key={action} style={styles.pointsRow}>
                <Text style={styles.pointsAction}>{action}</Text>
                <Text style={[styles.pointsValue, neg && { color: '#EF4444' }]}>{pts}</Text>
              </View>
            ))}
          </View>

          {/* Fielding */}
          <Text style={styles.pointsSection}>FIELDING</Text>
          <View style={styles.pointsGrid}>
            {[
              { action: 'Catch',             pts: '+10' },
              { action: 'Stumping',          pts: '+10' },
            ].map(({ action, pts }) => (
              <View key={action} style={styles.pointsRow}>
                <Text style={styles.pointsAction}>{action}</Text>
                <Text style={styles.pointsValue}>{pts}</Text>
              </View>
            ))}
          </View>

          {/* Fantasy multipliers */}
          <Text style={styles.pointsSection}>FANTASY MULTIPLIERS</Text>
          <View style={styles.pointsGrid}>
            {[
              { action: 'Captain (C)',       pts: '3×' },
              { action: 'Vice-captain (VC)', pts: '2×' },
            ].map(({ action, pts }) => (
              <View key={action} style={styles.pointsRow}>
                <Text style={styles.pointsAction}>{action}</Text>
                <Text style={[styles.pointsValue, { color: colors.gold }]}>{pts}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Footer note ── */}
        <Text style={styles.footerNote}>
          {CLUB_NAME} · Pavilion Fantasy League · v1.4.0
        </Text>

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  scroll:    { padding: spacing.md, paddingBottom: 60 },

  labelRow:     { marginBottom: spacing.lg },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.gold, marginBottom: 4 },
  pageTitle:    { fontFamily: fonts.display, fontSize: 36, letterSpacing: 2, color: colors.white, lineHeight: 40, textTransform: 'uppercase' },

  // ── Hero card ─────────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: colors.navyLight,
    borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)',
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },

  comingSoonBadge: {
    backgroundColor: 'rgba(245,197,24,0.12)',
    borderWidth: 1, borderColor: 'rgba(245,197,24,0.35)',
    borderRadius: radius.full,
    paddingHorizontal: 16, paddingVertical: 6,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  // Animated shimmer overlay — slides across the badge
  shimmerOverlay: {
    position: 'absolute', top: 0, bottom: 0, width: 80,
    backgroundColor: 'rgba(245,197,24,0.18)',
    transform: [{ skewX: '-20deg' }],
  },
  comingSoonText: {
    fontFamily: fonts.bold, fontSize: 11, letterSpacing: 3, color: colors.gold,
  },

  trophyWrap: {
    marginBottom: spacing.md,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
  },

  heroTitle: {
    fontFamily: fonts.display, fontSize: 30, letterSpacing: 4,
    color: colors.white, textAlign: 'center', marginBottom: 8,
  },
  heroSub: {
    fontFamily: fonts.body, fontSize: 13, color: colors.textMuted,
    textAlign: 'center', lineHeight: 20, maxWidth: 260, marginBottom: spacing.md,
  },

  dotsRow: { flexDirection: 'row', gap: 8 },
  dot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold,
  },

  // ── How it works divider ──────────────────────────────────────────────────
  howRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: spacing.md,
  },
  howDivider: { flex: 1, height: 1, backgroundColor: 'rgba(245,197,24,0.15)' },
  howLabel: {
    fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.gold,
  },

  // ── Feature cards ─────────────────────────────────────────────────────────
  featureCard: {
    backgroundColor: colors.navyLight,
    borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 3,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    marginBottom: 10,
  },
  featureIconWrap: {
    width: 44, height: 44, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: { flex: 1 },
  featureTitle: {
    fontFamily: fonts.bold, fontSize: 13, letterSpacing: 0.3, marginBottom: 4,
  },
  featureDesc: {
    fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, lineHeight: 18,
  },

  // ── Points card ───────────────────────────────────────────────────────────
  pointsCard: {
    backgroundColor: colors.navyLight,
    borderWidth: 1, borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.lg,
  },
  pointsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 6,
  },
  pointsTitle: {
    fontFamily: fonts.bold, fontSize: 11, letterSpacing: 2, color: colors.gold,
  },
  pointsSubtitle: {
    fontFamily: fonts.body, fontSize: 12, color: colors.textMuted,
    marginBottom: spacing.sm, lineHeight: 18,
  },
  // Sub-section header inside the points card
  pointsSection: {
    fontFamily: fonts.bold, fontSize: 9, letterSpacing: 2,
    color: colors.textMuted, marginTop: spacing.sm, marginBottom: 4,
    textTransform: 'uppercase',
  },
  pointsGrid: { gap: 2 },
  pointsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  pointsAction: { fontFamily: fonts.body, fontSize: 13, color: colors.textLight },
  pointsValue:  { fontFamily: fonts.bold, fontSize: 13, color: colors.gold },

  footerNote: {
    fontFamily: fonts.body, fontSize: 11, color: colors.textMuted,
    textAlign: 'center', opacity: 0.5, paddingBottom: spacing.lg,
  },
})

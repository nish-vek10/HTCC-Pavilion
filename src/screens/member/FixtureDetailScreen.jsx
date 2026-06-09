// pavilion-app/src/screens/member/FixtureDetailScreen.jsx
// Shows fixture info, availability toggle (upcoming), squad (upcoming),
// result banner + POTM card + full scorecard (past fixtures with results)

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Animated, Easing, Modal, Linking, Alert,
  TextInput, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { supabase }     from '../../lib/supabase'
import useAuthStore     from '../../store/authStore'
import { AVAILABILITY_CONFIG, MATCH_TYPE_LABELS, teamColor, toTitleCase } from '../../lib/constants'
import { colors, fonts, spacing, radius } from '../../theme'
import AppIcon from '../../components/AppIcon'
import { calcPlayerPoints } from '../../lib/fantasyPoints'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateFull(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(t) {
  if (!t) return '12:30'
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function getInitials(name) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

function toLocalISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2,'0')
  const day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}

// ─── Client-side POTM points — delegates to shared fantasyPoints.js ──────────
function calculatePoints(bat, bowl, field) {
  return calcPlayerPoints(bat, bowl, field).total
}

// ─── Build performance stat lines per player ───────────────────────────────────
// Returns array of { label, value, color } — shown in player card
// All recorded stats shown, zero values omitted cleanly
function buildStatLines(bat, bowl, field) {
  const lines = []

  // Batting — DND if no contribution recorded (all zeros, not not-out)
  if (bat) {
    const runs  = bat.runs  || 0
    const balls = bat.balls || 0
    const fours = bat.fours || 0
    const sixes = bat.sixes || 0
    const didNotBat = runs === 0 && balls === 0 && fours === 0 && sixes === 0 && !bat.not_out
    if (didNotBat) {
      lines.push({ label: 'Bat', value: 'DNB', color: colors.gold })
    } else {
      const sr       = balls > 0 ? ((runs / balls) * 100).toFixed(1) : null
      const notOut   = bat.not_out ? '*' : ''
      let v = balls > 0 ? `${runs}${notOut}(${balls})` : `${runs}${notOut}`
      if (fours > 0) v += ` · ${fours}×4`
      if (sixes > 0) v += ` · ${sixes}×6`
      if (sr)        v += ` · SR ${sr}`
      lines.push({ label: 'Bat', value: v, color: colors.gold })
    }
  }

  // Bowling — only if overs > 0
  if (bowl && (bowl.overs > 0 || bowl.wickets > 0)) {
    const overs    = bowl.overs    || 0
    const maidens  = bowl.maidens  || 0
    const runs     = bowl.runs     || 0
    const wickets  = bowl.wickets  || 0
    const noBalls  = bowl.no_balls || 0
    const wides    = bowl.wides    || 0
    const eco      = overs > 0 ? (runs / overs).toFixed(2) : null
    let v = `${overs} Ov`
    if (maidens > 0) v += ` · ${maidens}M`
    v += ` · ${runs}R · ${wickets}W`
    if (noBalls > 0) v += ` · ${noBalls}nb`
    if (wides   > 0) v += ` · ${wides}wd`
    if (eco)         v += ` · Eco ${eco}`
    lines.push({ label: 'Bowl', value: v, color: '#60A5FA' })
  }

  // Fielding — only if took a catch or stumping
  if (field && (field.catches > 0 || field.stumpings > 0)) {
    const parts = []
    if (field.catches   > 0) parts.push(`${field.catches} ct`)
    if (field.stumpings > 0) parts.push(`${field.stumpings} st`)
    lines.push({ label: 'Field', value: parts.join(' · '), color: colors.green })
  }

  return lines
}

// ─── Result config ─────────────────────────────────────────────────────────────
function getResultCfg(winner, opponent) {
  switch (winner) {
    case 'htcc':      return { label: 'HTCC WIN',  sub: `vs ${opponent}`, color: colors.green, bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.35)' }
    case 'opponent':  return { label: 'LOSS',       sub: `vs ${opponent}`, color: '#EF4444',    bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.35)' }
    case 'draw':      return { label: 'DRAW',       sub: `vs ${opponent}`, color: colors.gold,  bg: 'rgba(245,197,24,0.08)', border: 'rgba(245,197,24,0.3)' }
    default:          return { label: 'NO RESULT',  sub: `vs ${opponent}`, color: colors.textMuted, bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' }
  }
}

// ─── Points breakdown reference (shown in modal) ───────────────────────────────
const POINTS_REF = {
  batting: [
    { action: 'Per run',             pts: '+1' },
    { action: 'Per four (bonus)',    pts: '+2' },
    { action: 'Per six (bonus)',     pts: '+4' },
    { action: 'Not out (≥30r)',      pts: '+5' },
    { action: '25+ runs',            pts: '+10' },
    { action: '50+ runs',            pts: '+20' },
    { action: '100+ runs',           pts: '+40' },
    { action: 'Duck (dismissed 0)',  pts: '−5' },
    { action: 'Run out (batting)',   pts: '−8' },
  ],
  bowling: [
    { action: 'Per wicket',          pts: '+25' },
    { action: 'Per maiden',          pts: '+5' },
    { action: '3+ wickets bonus',    pts: '+10' },
    { action: '4+ wickets bonus',    pts: '+15' },
    { action: '5+ wickets bonus',    pts: '+30' },
    { action: 'Per wide',            pts: '−1' },
    { action: 'Per no-ball',         pts: '−2' },
    { action: 'Economy 7–8',         pts: '−2' },
    { action: 'Economy 8–9',         pts: '−3' },
    { action: 'Economy 9–10',        pts: '−5' },
    { action: 'Economy ≥10',         pts: '−8' },
  ],
  fielding: [
    { action: 'Per catch',           pts: '+10' },
    { action: 'Per stumping',        pts: '+10' },
  ],
}

// ─── Points breakdown modal ────────────────────────────────────────────────────
function PointsModal({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.modalBackdrop}>
        <View style={st.modalBox}>
          <View style={st.modalHeader}>
            <Text style={st.modalTitle}>POINTS SYSTEM</Text>
            <TouchableOpacity onPress={onClose} style={st.modalClose}>
              <Text style={st.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {[['Batting', POINTS_REF.batting, colors.gold], ['Bowling', POINTS_REF.bowling, '#60A5FA'], ['Fielding', POINTS_REF.fielding, colors.green]].map(([section, rows, color]) => (
              <View key={section} style={st.ptSection}>
                <Text style={[st.ptSectionTitle, { color }]}>{section.toUpperCase()}</Text>
                {rows.map(row => (
                  <View key={row.action} style={st.ptRow}>
                    <Text style={st.ptAction}>{row.action}</Text>
                    <Text style={[st.ptValue, { color }]}>{row.pts}</Text>
                  </View>
                ))}
              </View>
            ))}
            <View style={{ height: 16 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

// ─── POTM animated card ────────────────────────────────────────────────────────
function POTMCard({ player, points, statLines }) {
  const cardScale = useRef(new Animated.Value(0.85)).current
  const cardOp    = useRef(new Animated.Value(0)).current
  const glowOp    = useRef(new Animated.Value(0.3)).current
  const glowLoop  = useRef(null)

  useEffect(() => {
    // Slight delay so screen content renders first
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.spring(cardScale, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
        Animated.timing(cardOp,    { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start()
      // Pulsing gold glow starts after card appears
      setTimeout(() => {
        glowLoop.current = Animated.loop(Animated.sequence([
          Animated.timing(glowOp, { toValue: 1,   duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glowOp, { toValue: 0.3, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]))
        glowLoop.current.start()
      }, 400)
    }, 300)

    return () => { clearTimeout(t); glowLoop.current?.stop() }
  }, [])

  return (
    <Animated.View style={[st.potmCard, { opacity: cardOp, transform: [{ scale: cardScale }] }]}>
      {/* Pulsing border */}
      <Animated.View style={[StyleSheet.absoluteFill, st.potmGlowBorder, { opacity: glowOp }]} />

      {/* Gold top bar */}
      <View style={st.potmTopBar}>
        <AppIcon name="trophy" size={14} />
        <Text style={st.potmTopLabel}>PLAYER OF THE MATCH</Text>
        <Text style={st.potmTopPts}>{Math.round(points)} PTS</Text>
      </View>

      {/* Player identity */}
      <View style={st.potmBody}>
        <View style={st.potmAvatar}>
          <Text style={st.potmInitials}>{getInitials(player.full_name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <AppIcon name="trophy" size={22} />
            <Text style={st.potmName}>{player.full_name?.toUpperCase()}</Text>
          </View>
          {/* Full performance summary */}
          {statLines.map((line, i) => (
            <View key={i} style={st.potmStatLine}>
              <Text style={[st.potmStatLabel, { color: line.color }]}>{line.label}</Text>
              <Text style={st.potmStatValue}>{line.value}</Text>
            </View>
          ))}
          {statLines.length === 0 && (
            <Text style={st.potmStatValue}>Performance recorded</Text>
          )}
        </View>
      </View>
    </Animated.View>
  )
}

// ─── Single player performance card ───────────────────────────────────────────
function PlayerCard({ player, rank, statLines, pts }) {
  return (
    <View style={st.playerCard}>
      {/* Rank badge */}
      <View style={st.rankBadge}>
        <Text style={st.rankText}>{rank}</Text>
      </View>

      <View style={{ flex: 1 }}>
        {/* Name row — name left, pts badge right */}
        <View style={st.playerNameRow}>
          <Text style={st.playerCardName} numberOfLines={1}>{player.full_name}</Text>
          {pts !== undefined && (
            <View style={st.ptsBadge}>
              <Text style={st.ptsBadgeText}>{Math.round(pts)} pts</Text>
            </View>
          )}
        </View>

        {/* Stat lines */}
        {statLines.length > 0 ? statLines.map((line, i) => (
          <View key={i} style={st.statLine}>
            <Text style={[st.statLabel, { color: line.color }]}>{line.label}</Text>
            <Text style={st.statValue} numberOfLines={1}>{line.value}</Text>
          </View>
        )) : (
          <Text style={st.statNone}>No contribution recorded</Text>
        )}
      </View>
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function FixtureDetailScreen({ route, navigation }) {
  const { fixtureId, readOnly = false } = route.params
  const { profile }   = useAuthStore()

  // ── Fixture + squad ─────────────────────────────────────────────────────────
  const [fixture,      setFixture]      = useState(null)
  const [squad,        setSquad]        = useState(null)
  const [squadMembers, setSquadMembers] = useState([])
  const [myStatus,     setMyStatus]     = useState(null)
  const [submitting,   setSubmitting]   = useState(false)

  // ── Result data ─────────────────────────────────────────────────────────────
  const [result,       setResult]       = useState(null)   // match_results row
  const [potm,         setPotm]         = useState(null)   // match_potm row + profile
  const [batData,      setBatData]      = useState([])
  const [bowlData,     setBowlData]     = useState([])
  const [fieldData,    setFieldData]    = useState([])

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [loading,      setLoading]      = useState(true)
  const [showPoints,   setShowPoints]   = useState(false)

  // ── PlayCricket URL inline edit (admin/captain only) ─────────────────────────
  const [urlModal,     setUrlModal]     = useState(false)
  const [urlInput,     setUrlInput]     = useState('')
  const [savingUrl,    setSavingUrl]    = useState(false)

  // useFocusEffect ensures re-fetch whenever screen gains focus (e.g. navigating
  // back from MatchScorecardScreen after submitting a result).
  useFocusEffect(
    useCallback(() => {
      if (profile?.id && fixtureId) loadAll()
    }, [profile?.id, fixtureId])
  )

  const loadAll = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchFixture(),
        fetchSquad(),
        fetchMyAvailability(),
        fetchResult(),
      ])
    } finally {
      setLoading(false)
    }
  }

  const fetchFixture = async () => {
    const { data } = await supabase
      .from('fixtures')
      .select('*, teams(name)')
      .eq('id', fixtureId)
      .single()
    if (data) setFixture(data)
  }

  const fetchSquad = async () => {
    const { data } = await supabase
      .from('squads')
      .select(`
        id, published, published_at,
        squad_members (
          player_id, position_order, is_captain, is_wicketkeeper,
          profiles ( full_name, avatar_color )
        )
      `)
      .eq('fixture_id', fixtureId)
      .eq('published', true)
      .maybeSingle()

    if (data) {
      setSquad(data)
      const sorted = [...(data.squad_members || [])]
        .sort((a, b) => (a.position_order || 0) - (b.position_order || 0))
      setSquadMembers(sorted)
    }
  }

  const fetchMyAvailability = async () => {
    const { data } = await supabase
      .from('availability')
      .select('status')
      .eq('fixture_id', fixtureId)
      .eq('player_id', profile.id)
      .maybeSingle()
    if (data) setMyStatus(data.status)
  }

  const fetchResult = async () => {
    // Match result
    const { data: res } = await supabase
      .from('match_results')
      .select('winner, submitted_at, playcricket_url')
      .eq('fixture_id', fixtureId)
      .maybeSingle()
    if (!res) return
    setResult(res)

    // POTM
    const { data: potmRow } = await supabase
      .from('match_potm')
      .select('player_id, points, profiles!player_id(id, full_name, avatar_color)')
      .eq('fixture_id', fixtureId)
      .maybeSingle()
    if (potmRow) setPotm(potmRow)

    // Batting — all squad members
    const { data: bat } = await supabase
      .from('match_batting')
      .select('*, profiles!player_id(id, full_name, avatar_color)')
      .eq('fixture_id', fixtureId)
      .order('runs', { ascending: false })
    if (bat) setBatData(bat)

    // Bowling
    const { data: bowl } = await supabase
      .from('match_bowling')
      .select('*, profiles!player_id(id, full_name, avatar_color)')
      .eq('fixture_id', fixtureId)
      .order('wickets', { ascending: false })
    if (bowl) setBowlData(bowl)

    // Fielding
    const { data: field } = await supabase
      .from('match_fielding')
      .select('*, profiles!player_id(id, full_name, avatar_color)')
      .eq('fixture_id', fixtureId)
    if (field) setFieldData(field)
  }

  const handleAvailability = async (status) => {
    setSubmitting(true)
    try {
      if (myStatus === status) {
        const { error: delErr } = await supabase.from('availability').delete()
          .eq('fixture_id', fixtureId).eq('player_id', profile.id)
        if (delErr) throw new Error(delErr.message)
        setMyStatus(null)
      } else {
        const { error: upsertErr } = await supabase.from('availability').upsert(
          { fixture_id: fixtureId, player_id: profile.id, status, set_by_admin: false },
          { onConflict: 'fixture_id,player_id' }
        )
        if (upsertErr) throw new Error(upsertErr.message)
        setMyStatus(status)
      }
    } catch (err) {
      console.error('handleAvailability error:', err.message)
      Alert.alert('Error', 'Failed to update availability. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Save PlayCricket URL (admin/captain) ─────────────────────────────────────
  const handleSaveUrl = async () => {
    const url = urlInput.trim()
    if (!url) { Alert.alert('No URL', 'Paste PlayCricket URL first.'); return }
    setSavingUrl(true)
    try {
      const { error } = await supabase.from('match_results')
        .update({ playcricket_url: url })
        .eq('fixture_id', fixtureId)
      if (error) throw error
      setResult(prev => ({ ...prev, playcricket_url: url }))
      setUrlModal(false)
      setUrlInput('')
    } catch (err) {
      Alert.alert('Save Failed', err.message)
    } finally {
      setSavingUrl(false)
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const today              = toLocalISO(new Date())
  const hasResult          = !!result
  const isPast             = fixture?.match_date <= today || hasResult
  const isAdminOrCaptain   = ['admin', 'superadmin'].includes(profile?.role)
  const isInSquad    = squadMembers.some(sm => sm.player_id === profile?.id)
  const captain      = squadMembers.find(sm => sm.is_captain)
  const wk           = squadMembers.find(sm => sm.is_wicketkeeper)

  // Build lookup maps for scorecards
  const batMap   = useMemo(() => Object.fromEntries(batData.map(r => [r.player_id, r])),   [batData])
  const bowlMap  = useMemo(() => Object.fromEntries(bowlData.map(r => [r.player_id, r])),  [bowlData])
  const fieldMap = useMemo(() => Object.fromEntries(fieldData.map(r => [r.player_id, r])), [fieldData])

  // Build ranked player list: POTM first, then by runs desc
  const rankedPlayers = useMemo(() => {
    if (!hasResult || batData.length === 0) return []
    return [...batData]
      .map(p => ({
        player_id:    p.player_id,
        full_name:    toTitleCase(p.profiles?.full_name) || 'Unknown',
        avatar_color: p.profiles?.avatar_color || colors.gold,
        // Calculate points for sorting — same formula as MatchScorecardScreen
        _pts: calculatePoints(
          batMap[p.player_id],
          bowlMap[p.player_id],
          fieldMap[p.player_id]
        ),
      }))
      .sort((a, b) => b._pts - a._pts)
  }, [batData, batMap, bowlMap, fieldMap, hasResult])

  if (loading) {
    return (
      <View style={st.loadingContainer}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    )
  }

  const resCfg = result ? getResultCfg(result.winner, fixture?.opponent) : null

  return (
    <SafeAreaView style={st.safe} edges={['top', 'bottom']}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn} activeOpacity={0.7}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AppIcon name="back" size={13} tint={colors.textMuted} />
          <Text style={st.backText}>Back</Text>
        </View>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Fixture header ── */}
        <View style={st.fixtureHeader}>
          <View style={st.badgesRow}>
            {/* Team badge — colour driven by canonical teamColor palette */}
            <View style={[st.teamBadge, {
              backgroundColor: `${teamColor(fixture?.teams?.name)}18`,
              borderColor: `${teamColor(fixture?.teams?.name)}44`,
            }]}>
              <Text style={[st.teamBadgeText, { color: teamColor(fixture?.teams?.name) }]}>
                {fixture?.teams?.name}
              </Text>
            </View>
            {(() => {
              const hwCfg = fixture?.home_away === 'home'
                ? { icon: 'homeFixture', label: 'HOME',    color: colors.green, bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)' }
                : fixture?.home_away === 'away'
                ? { icon: 'awayFixture', label: 'AWAY',    color: colors.gold,  bg: 'rgba(245,197,24,0.08)', border: 'rgba(245,197,24,0.2)' }
                : { icon: 'neutral',     label: 'NEUTRAL', color: colors.textMuted, bg: 'rgba(255,255,255,0.04)', border: colors.border }
              return (
                <View style={[st.hwBadge, { backgroundColor: hwCfg.bg, borderColor: hwCfg.border }]}>
                  <AppIcon name={hwCfg.icon} size={10} tint={hwCfg.color} />
                  <Text style={[st.hwBadgeText, { color: hwCfg.color }]}>{hwCfg.label}</Text>
                </View>
              )
            })()}
            <View style={st.typeBadge}>
              <Text style={st.typeBadgeText}>{MATCH_TYPE_LABELS[fixture?.match_type] || fixture?.match_type}</Text>
            </View>
          </View>

          <Text style={st.fixtureTitle}>
            HTCC <Text style={st.vsText}>vs</Text> {fixture?.opponent?.toUpperCase()}
          </Text>

          <View style={st.fixtureMetaWrap}>
            <View style={st.fixtureMetas}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <AppIcon name="date"  size={13} tint={colors.textLight} />
                <Text style={st.fixtureMetaBold}>{fixture && formatDateFull(fixture.match_date)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <AppIcon name="time"  size={13} tint={colors.textLight} />
                <Text style={st.fixtureMetaBold}>{formatTime(fixture?.match_time)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <AppIcon name="venue" size={13} tint={colors.textLight} />
                <Text style={st.fixtureMetaBold}>{fixture?.venue}</Text>
              </View>
            </View>
            <View style={st.dateBlock}>
              <Text style={st.dateDay}>{fixture && new Date(fixture.match_date + 'T00:00:00').getDate()}</Text>
              <Text style={st.dateMonth}>{fixture && new Date(fixture.match_date + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* PAST FIXTURE WITH RESULT                                            */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {isPast && hasResult ? (
          <>
            {/* Result banner */}
            <View style={[st.resultBanner, { backgroundColor: resCfg.bg, borderColor: resCfg.border }]}>
              <Text style={[st.resultLabel, { color: resCfg.color }]}>{resCfg.label}</Text>
              <Text style={st.resultSub}>{resCfg.sub}</Text>
            </View>

            {/* POTM animated card */}
            {potm && (() => {
              const potmProfile = { full_name: toTitleCase(potm.profiles?.full_name), player_id: potm.player_id }
              const potmStatLines = buildStatLines(batMap[potm.player_id], bowlMap[potm.player_id], fieldMap[potm.player_id])
              return (
                <POTMCard
                  player={potmProfile}
                  points={potm.points}
                  statLines={potmStatLines}
                />
              )
            })()}

            {/* Scorecard section header */}
            <View style={st.scorecardHeader}>
              <Text style={st.scorecardTitle}>SCORECARD</Text>
              <TouchableOpacity
                style={st.pointsInfoBtn}
                onPress={() => setShowPoints(true)}
                activeOpacity={0.7}
              >
                <Text style={st.pointsInfoText}>? Points</Text>
              </TouchableOpacity>
            </View>

            {/* Player performance cards — POTM first, then ranked */}
            {rankedPlayers.map((player, idx) => {
              const isPotmPlayer = player.player_id === potm?.player_id
              if (isPotmPlayer) return null  // POTM already shown above
              const statLines = buildStatLines(batMap[player.player_id], bowlMap[player.player_id], fieldMap[player.player_id])
              return (
                <PlayerCard
                  key={player.player_id}
                  player={player}
                  rank={idx + 1}
                  statLines={statLines}
                  pts={player._pts}
                />
              )
            })}

            {/* PlayCricket full scorecard link + admin/captain edit */}
            <View style={st.playcricketRow}>
              {result?.playcricket_url ? (
                <TouchableOpacity
                  style={[st.playcricketBtn, { flex: 1 }]}
                  onPress={() => {
                    const raw   = result.playcricket_url.trim()
                    const match = raw.match(/https?:\/\/\S+/)
                    const url   = match ? match[0] : `https://${raw}`
                    Linking.openURL(url).catch(() =>
                      Alert.alert('Cannot Open', 'Unable to open PlayCricket link.')
                    )
                  }}
                  activeOpacity={0.75}
                >
                  <AppIcon name="send" size={14} tint={colors.gold} />
                  <Text style={st.playcricketBtnText}>View Full Scorecard on PlayCricket</Text>
                  <Text style={st.playcricketArrow}>›</Text>
                </TouchableOpacity>
              ) : (
                <View style={[st.playcricketBtn, { flex: 1, opacity: 0.4 }]} pointerEvents="none">
                  <AppIcon name="send" size={14} tint={colors.textMuted} />
                  <Text style={[st.playcricketBtnText, { color: colors.textMuted }]}>No PlayCricket URL yet</Text>
                </View>
              )}
              {isAdminOrCaptain && (
                <TouchableOpacity
                  style={st.editUrlBtn}
                  onPress={() => { setUrlInput(result?.playcricket_url || ''); setUrlModal(true) }}
                  activeOpacity={0.7}
                >
                  <AppIcon name="edit" size={13} tint={colors.gold} />
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          <>
            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* UPCOMING FIXTURE — availability + squad                         */}
            {/* ═══════════════════════════════════════════════════════════════ */}

            {/* Availability — upcoming fixtures, own-team members only */}
            {!isPast && !readOnly && (
              <View style={st.card}>
                <Text style={st.cardTitle}>My Availability</Text>
                <View style={st.availButtons}>
                  {Object.entries(AVAILABILITY_CONFIG).map(([status, cfg]) => {
                    const isActive = myStatus === status
                    return (
                      <TouchableOpacity
                        key={status}
                        onPress={() => !submitting && handleAvailability(status)}
                        disabled={submitting}
                        activeOpacity={0.75}
                        style={[
                          st.availBtn,
                          {
                            borderColor:     isActive ? cfg.color : colors.border,
                            borderWidth:     isActive ? 2 : 1,
                            backgroundColor: isActive ? cfg.fillColor : 'transparent',
                          },
                        ]}
                      >
                        <View style={[st.availDot, {
                          backgroundColor: cfg.color,
                          shadowColor:     isActive ? cfg.color : 'transparent',
                          shadowOpacity:   isActive ? 0.6 : 0,
                          shadowRadius:    4,
                        }]} />
                        <Text style={[st.availBtnText, {
                          fontFamily: isActive ? fonts.bold : fonts.body,
                          color:      isActive ? cfg.color : colors.textMuted,
                        }]}>
                          {cfg.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                {isInSquad && (
                  <View style={st.inSquadBanner}>
                    <Text style={st.inSquadText}>★ You are in the Playing XI for this match</Text>
                  </View>
                )}
              </View>
            )}

            {/* Published squad */}
            {squad ? (
              <View style={st.card}>
                <View style={st.squadHeader}>
                  <View>
                    <Text style={st.squadTitle}>PLAYING XI</Text>
                    <Text style={st.squadPublished}>
                      ✓ Published {squad.published_at && new Date(squad.published_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View style={st.squadCount}>
                    <Text style={st.squadCountNum}>{squadMembers.length}</Text>
                    <Text style={st.squadCountLabel}>players</Text>
                  </View>
                </View>

                {(captain || wk) && (
                  <View style={st.rolesSummaryRow}>
                    {captain && (
                      <View style={st.roleSummaryItem}>
                        <AppIcon name="captainBadge" size={16} tint={colors.gold} />
                        <Text style={st.roleSummaryName} numberOfLines={1}>{toTitleCase(captain.profiles?.full_name)}</Text>
                      </View>
                    )}
                    {wk && (
                      <View style={st.roleSummaryItem}>
                        <AppIcon name="wkBadge" size={16} tint="#60A5FA" />
                        <Text style={st.roleSummaryName} numberOfLines={1}>{toTitleCase(wk.profiles?.full_name)}</Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={st.squadDivider} />

                {squadMembers.map((sm, index) => {
                  const isMe  = sm.player_id === profile?.id
                  const color = sm.profiles?.avatar_color || colors.gold
                  const name  = toTitleCase(sm.profiles?.full_name) || 'Unknown'
                  return (
                    <View
                      key={sm.player_id}
                      style={[
                        st.squadRow,
                        index < squadMembers.length - 1 && st.squadRowBorder,
                        isMe && st.squadRowMe,
                      ]}
                    >
                      <View style={[st.squadNum, isMe && st.squadNumMe]}>
                        <Text style={[st.squadNumText, isMe && st.squadNumTextMe]}>{index + 1}</Text>
                      </View>
                      <View style={[st.squadAvatar, { backgroundColor: `${color}22`, borderColor: `${color}44` }]}>
                        <Text style={[st.squadAvatarText, { color }]}>{getInitials(name)}</Text>
                      </View>
                      <View style={st.squadNameWrap}>
                        <Text style={[st.squadName, isMe && st.squadNameMe]} numberOfLines={1}>{name}</Text>
                        {isMe && (
                          <View style={st.youTag}>
                            <Text style={st.youTagText}>YOU</Text>
                          </View>
                        )}
                      </View>
                      <View style={st.roleTagsRow}>
                        {sm.is_captain    && <AppIcon name="captainBadge" size={16} tint={colors.gold} />}
                        {sm.is_wicketkeeper && <AppIcon name="wkBadge"    size={16} tint="#60A5FA" />}
                      </View>
                    </View>
                  )
                })}
              </View>
            ) : (
              <View style={st.noSquadCard}>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <AppIcon name="cricketBat"  size={28} tint={colors.textMuted} />
                  <AppIcon name="cricketBowl" size={28} tint={colors.textMuted} />
                </View>
                <Text style={st.noSquadTitle}>Squad Not Yet Announced</Text>
                <Text style={st.noSquadText}>The captain will publish the squad before matchday.</Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Points breakdown modal */}
      <PointsModal visible={showPoints} onClose={() => setShowPoints(false)} />

      {/* ── PlayCricket URL edit modal ── */}
      <Modal visible={urlModal} transparent animationType="fade" onRequestClose={() => setUrlModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={st.urlModalBackdrop} onPress={() => setUrlModal(false)}>
            <Pressable style={st.urlModalBox} onPress={() => {}}>
              <Text style={st.urlModalTitle}>PLAYCRICKET URL</Text>
              <Text style={st.urlModalSub}>Paste full PlayCricket scorecard link. Updates immediately for all members.</Text>
              <TextInput
                style={st.urlModalInput}
                value={urlInput}
                onChangeText={setUrlInput}
                placeholder="https://harrowtown.play-cricket.com/…"
                placeholderTextColor="rgba(139,155,180,0.4)"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                onSubmitEditing={handleSaveUrl}
                autoFocus
              />
              <View style={st.urlModalBtns}>
                <TouchableOpacity style={st.urlModalCancelBtn} onPress={() => setUrlModal(false)} activeOpacity={0.7}>
                  <Text style={st.urlModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.urlModalSaveBtn, (savingUrl || !urlInput.trim()) && { opacity: 0.4 }]}
                  onPress={handleSaveUrl}
                  disabled={savingUrl || !urlInput.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={st.urlModalSaveText}>{savingUrl ? 'Saving…' : 'Save URL'}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: colors.navy },
  loadingContainer: { flex: 1, backgroundColor: colors.navy, justifyContent: 'center', alignItems: 'center' },
  backBtn:          { padding: 16, paddingBottom: 0 },
  backText:         { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  scrollContent:    { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },

  // ── Fixture header ──
  fixtureHeader:   { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md },
  badgesRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: spacing.md, alignItems: 'center' },
  teamBadge:       { backgroundColor: 'rgba(245,197,24,0.1)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 3 },
  teamBadgeText:   { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.gold },
  typeBadge:       { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 3 },
  typeBadgeText:   { fontFamily: fonts.bold, fontSize: 11, color: colors.textMuted },
  hwBadge:         { borderWidth: 1, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 },
  hwBadgeText:     { fontFamily: fonts.bold, fontSize: 11 },
  fixtureTitle:    { fontFamily: fonts.display, fontSize: 28, letterSpacing: 2, color: colors.white, lineHeight: 34, marginBottom: spacing.md },
  vsText:          { color: colors.gold },
  fixtureMetaWrap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  fixtureMetas:    { flex: 1, gap: 5 },
  fixtureMetaBold: { fontFamily: fonts.bold, fontSize: 13, color: colors.textLight, lineHeight: 22 },
  dateBlock:       { alignItems: 'center', flexShrink: 0 },
  dateDay:         { fontFamily: fonts.display, fontSize: 52, color: colors.gold, letterSpacing: 2, lineHeight: 56 },
  dateMonth:       { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, letterSpacing: 2 },

  // ── Result banner ──
  resultBanner: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultLabel: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 3 },
  resultSub:   { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  // ── POTM card ──
  potmCard: {
    backgroundColor: '#0F1E30',
    borderWidth: 1.5,
    borderColor: 'rgba(245,197,24,0.5)',
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  potmGlowBorder: {
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  potmTopBar: {
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  potmTopLabel: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2.5, color: colors.navy, flex: 1 },
  potmTopPts:   { fontFamily: fonts.display, fontSize: 18, color: colors.navy, letterSpacing: 1 },
  potmBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 14,
  },
  potmAvatar: {
    width: 52, height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(245,197,24,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(245,197,24,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  potmInitials: { fontFamily: fonts.display, fontSize: 20, color: colors.gold, letterSpacing: 1 },
  potmName:     { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1.5, color: colors.white, marginBottom: 6 },
  potmStatLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  potmStatLabel:{ fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5, width: 34 },
  potmStatValue:{ fontFamily: fonts.body, fontSize: 11, color: colors.textLight, flex: 1, flexWrap: 'wrap' },

  // ── Scorecard section ──
  scorecardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  scorecardTitle:  { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.textMuted },
  pointsInfoBtn:   { backgroundColor: 'rgba(245,197,24,0.1)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  pointsInfoText:  { fontFamily: fonts.bold, fontSize: 10, color: colors.gold, letterSpacing: 0.5 },

  // ── Player performance card ──
  playerCard: {
    backgroundColor: colors.navyLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 7,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  playerNameRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  ptsBadge:       { backgroundColor: 'rgba(245,197,24,0.1)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, flexShrink: 0 },
  ptsBadgeText:   { fontFamily: fonts.bold, fontSize: 10, color: colors.gold, letterSpacing: 0.3 },
  rankBadge: {
    width: 26, height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  rankText:         { fontFamily: fonts.bold, fontSize: 11, color: colors.textMuted },
  playerCardName:   { fontFamily: fonts.bold, fontSize: 13, color: colors.white, flex: 1, marginRight: 8 },
  statLine:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statLabel:        { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5, width: 34 },
  statValue:        { fontFamily: fonts.body, fontSize: 11, color: colors.textLight, flex: 1 },
  statNone:         { fontFamily: fonts.body, fontSize: 11, color: 'rgba(139,155,180,0.5)', marginTop: 2 },

  // ── PlayCricket link ──
  playcricketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    backgroundColor: 'rgba(245,197,24,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.2)',
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  playcricketBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.gold,
    flex: 1,
  },
  playcricketArrow: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.gold,
    lineHeight: 20,
  },

  // ── Points modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    width: 320,
    maxHeight: '80%',
    backgroundColor: '#0F1E30',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.2)',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,197,24,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,197,24,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalTitle:     { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 2, color: colors.gold, flex: 1 },
  modalClose:     { padding: 4 },
  modalCloseText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },
  ptSection:      { paddingHorizontal: 16, paddingTop: 14 },
  ptSectionTitle: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, marginBottom: 8 },
  ptRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  ptAction:       { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  ptValue:        { fontFamily: fonts.bold, fontSize: 12 },

  // ── Availability ──
  card:         { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  cardTitle:    { fontFamily: fonts.bold, fontSize: 14, color: colors.white, marginBottom: spacing.md, letterSpacing: 0.5 },
  availButtons: { flexDirection: 'row', gap: 8 },
  availBtn:     { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: radius.md, gap: 6 },
  availDot:     { width: 10, height: 10, borderRadius: 5 },
  availBtnText: { fontSize: 12 },
  inSquadBanner:{ marginTop: spacing.md, backgroundColor: 'rgba(245,197,24,0.06)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)', borderRadius: radius.md, padding: 12, alignItems: 'center' },
  inSquadText:  { fontFamily: fonts.bold, fontSize: 13, color: colors.gold, textAlign: 'center' },

  // ── Squad ──
  squadHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  squadTitle:      { fontFamily: fonts.display, fontSize: 20, letterSpacing: 2, color: colors.white, marginBottom: 3 },
  squadPublished:  { fontFamily: fonts.body, fontSize: 11, color: colors.green, fontWeight: '600' },
  squadCount:      { alignItems: 'center', backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 6 },
  squadCountNum:   { fontFamily: fonts.display, fontSize: 22, color: colors.gold, letterSpacing: 1 },
  squadCountLabel: { fontFamily: fonts.body, fontSize: 9, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  rolesSummaryRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  roleSummaryItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8 },
  roleSummaryName: { fontFamily: fonts.bold, fontSize: 12, color: colors.white, flex: 1 },
  squadDivider:    { height: 1, backgroundColor: colors.border, marginBottom: spacing.sm },
  squadRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  squadRowBorder:  { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  squadRowMe:      { backgroundColor: 'rgba(245,197,24,0.04)', marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg },
  squadNum:        { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  squadNumMe:      { backgroundColor: colors.gold },
  squadNumText:    { fontFamily: fonts.bold, fontSize: 11, color: colors.textMuted },
  squadNumTextMe:  { color: colors.navy },
  squadAvatar:     { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  squadAvatarText: { fontFamily: fonts.bold, fontSize: 11 },
  squadNameWrap:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  squadName:       { fontFamily: fonts.body, fontWeight: '500', fontSize: 14, color: colors.white },
  squadNameMe:     { fontFamily: fonts.bold, color: colors.gold },
  youTag:          { backgroundColor: 'rgba(245,197,24,0.1)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.3)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  youTagText:      { fontFamily: fonts.bold, fontSize: 9, color: colors.gold, letterSpacing: 1 },
  roleTagsRow:     { flexDirection: 'row', gap: 4, flexShrink: 0 },
  noSquadCard:     { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.md },
  noSquadTitle:    { fontFamily: fonts.bold, fontSize: 15, color: colors.white, marginBottom: 6 },
  noSquadText:     { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  // ── PlayCricket URL row + edit ──
  playcricketRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  editUrlBtn:          { width: 42, height: 42, borderRadius: radius.md, backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', alignItems: 'center', justifyContent: 'center' },

  // ── URL edit modal ──
  urlModalBackdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  urlModalBox:         { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, width: '100%' },
  urlModalTitle:       { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1, color: colors.white, marginBottom: 6 },
  urlModalSub:         { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.md },
  urlModalInput:       { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, fontFamily: fonts.body, fontSize: 13, color: colors.white, marginBottom: spacing.md },
  urlModalBtns:        { flexDirection: 'row', gap: 10 },
  urlModalCancelBtn:   { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  urlModalCancelText:  { fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },
  urlModalSaveBtn:     { flex: 1, backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  urlModalSaveText:    { fontFamily: fonts.bold, fontSize: 14, color: colors.navy },
})
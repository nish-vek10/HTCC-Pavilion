// pavilion-app/src/screens/member/FixturesScreen.jsx
// Mirrors pavilion-web/src/pages/member/FixturesPage.jsx
// Grouped by month, filters, availability badges

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  StyleSheet, Animated, ActivityIndicator, Pressable, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../../lib/supabase'
import useAuthStore from '../../store/authStore'
import TopHeader from '../../components/layout/TopHeader'
import { SCREENS, AVAILABILITY_CONFIG, MATCH_TYPE_LABELS, teamColor } from '../../lib/constants'
import { colors, fonts, spacing, radius } from '../../theme'
import AppIcon from '../../components/AppIcon'

// ─── Configurable ─────────────────────────────────────────────────────────────
const ALL       = 'all'
const MY_TEAMS  = 'my_teams'

// Returns YYYY-MM-DD using local date parts — avoids UTC/BST off-by-one
function toLocalISO(d) {
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Monday 00:00 of the current week — fixtures before this date are "past"
// Saturday + Sunday fixtures remain visible all weekend, archive together on Monday
function getThisMondayISO() {
  const today = new Date()
  const day   = today.getDay()                // 0=Sun, 1=Mon … 6=Sat
  const diff  = day === 0 ? -6 : 1 - day     // days back to Monday
  const mon   = new Date(today)
  mon.setDate(today.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return toLocalISO(mon)
}

// A fixture is past if its match_date is before this Monday
function isPast(dateStr) {
  return dateStr < getThisMondayISO()
}

// ─── Canonical team sort order ────────────────────────────────────────────────
const FIXTURE_TEAM_ORDER = ['1st', '2nd', '3rd', '4th', 'Sunday', 'sunday']
function fixtureTeamIndex(name) {
  if (!name) return 99
  for (let i = 0; i < FIXTURE_TEAM_ORDER.length; i++) {
    if (name.toLowerCase().includes(FIXTURE_TEAM_ORDER[i].toLowerCase())) return i
  }
  return 99
}

function groupByMonth(fixtures) {
  // Sort by date ASC, then by canonical team order within the same date
  const sorted = [...fixtures].sort((a, b) => {
    if (a.match_date < b.match_date) return -1
    if (a.match_date > b.match_date) return  1
    return fixtureTeamIndex(a.teams?.name) - fixtureTeamIndex(b.teams?.name)
  })
  return sorted.reduce((acc, f) => {
    const d     = new Date(f.match_date + 'T00:00:00')
    const month = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    if (!acc[month]) acc[month] = []
    acc[month].push(f)
    return acc
  }, {})
}

function formatDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return { day: d.getDate(), dow: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()] }
}

export default function FixturesScreen({ navigation, route }) {
  const { profile } = useAuthStore()

  const [fixtures,         setFixtures]         = useState([])
  const [availability,     setAvailability]     = useState({})
  const [squads,           setSquads]           = useState({})
  const [myTeams,          setMyTeams]          = useState([])
  const [allTeamsForFilter,setAllTeamsForFilter] = useState([])
  const [loading,          setLoading]          = useState(true)

  // ── Training state ─────────────────────────────────────────────────────────
  const [trainingSessions,   setTrainingSessions]   = useState([])
  const [trainingAvail,      setTrainingAvail]      = useState({})
  const [trainingSubmitting, setTrainingSubmitting] = useState(null)
  const [trainingModal,      setTrainingModal]      = useState(null) // session object or null

  // ── Filters ────────────────────────────────────────────────────────────────
  const [periodFilter,   setPeriodFilter]   = useState('upcoming')
  const [teamFilter,     setTeamFilter]     = useState(MY_TEAMS)
  const [homeAwayFilter, setHomeAwayFilter] = useState(ALL)
  const [typeFilter,     setTypeFilter]     = useState(ALL)
  const [filterModalOpen, setFilterModalOpen] = useState(false)

  // ── Fade-in ────────────────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start()
  }, [])

  // ── Open training modal when navigated from notification ──────────────────
  useEffect(() => {
    const openSessionId = route?.params?.openSessionId
    if (!openSessionId || trainingSessions.length === 0) return
    const session = trainingSessions.find(s => s.id === openSessionId)
    if (session) {
      setTrainingModal(session)
      navigation.setParams({ openSessionId: undefined })
    }
  }, [route?.params?.openSessionId, trainingSessions])

  // Re-fetch every time the screen is focused — ensures deletes/edits from
  // admin screens are immediately reflected without needing a full app reload
  useFocusEffect(
    useCallback(() => {
      if (profile?.id) loadAll()
    }, [])
  )

  // ── Real-time: re-fetch when fixtures or squads change ───────────────────
  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase
      .channel('fixtures-screen-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'fixtures',
      }, () => fetchFixtures())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'squads',
      }, () => fetchFixtures())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile?.id])

  const loadAll = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchFixtures(), fetchMyAvailability(), fetchUpcomingTraining()])
    } finally {
      setLoading(false)
    }
  }

  const fetchUpcomingTraining = async () => {
    const today = toLocalISO(new Date())
    const { data: sessions } = await supabase
      .from('training_sessions')
      .select('*')
      .gte('session_date', today)
      .order('session_date', { ascending: true })
      .limit(8)
    if (!sessions) return
    setTrainingSessions(sessions)

    // Fetch this player's availability for all returned sessions
    if (sessions.length > 0) {
      const { data: avail } = await supabase
        .from('training_availability')
        .select('session_id, status')
        .eq('player_id', profile.id)
        .in('session_id', sessions.map(s => s.id))
      const map = {}
      avail?.forEach(a => { map[a.session_id] = a.status })
      setTrainingAvail(map)
    }
  }

  // ── Set or toggle off training availability ────────────────────────────────
  const setTrainingStatus = async (sessionId, status) => {
    setTrainingSubmitting(sessionId)
    try {
      const existing = trainingAvail[sessionId]
      if (existing === status) {
        // Tap same status → toggle off
        await supabase.from('training_availability')
          .delete().eq('session_id', sessionId).eq('player_id', profile.id)
        setTrainingAvail(prev => { const n = { ...prev }; delete n[sessionId]; return n })
      } else if (existing) {
        await supabase.from('training_availability')
          .update({ status }).eq('session_id', sessionId).eq('player_id', profile.id)
        setTrainingAvail(prev => ({ ...prev, [sessionId]: status }))
      } else {
        await supabase.from('training_availability')
          .insert({ session_id: sessionId, player_id: profile.id, status })
        setTrainingAvail(prev => ({ ...prev, [sessionId]: status }))
      }
    } catch (err) {
      console.error('[FixturesScreen] training avail error:', err.message)
    } finally {
      setTrainingSubmitting(null)
      setTrainingModal(null)
    }
  }

  const fetchFixtures = async () => {
    const TEAM_ORDER = ['1st XI', '2nd XI', '3rd XI', '4th XI', 'Sunday XI']

    // Fetch user's active team memberships
    const { data: teamRows } = await supabase
      .from('team_members')
      .select('team_id, teams(id, name)')
      .eq('player_id', profile.id)
      .eq('status', 'active')

    const myTeamArr = (teamRows?.map(t => t.teams).filter(Boolean) || [])
      .sort((a, b) => {
        const ai = TEAM_ORDER.indexOf(a.name), bi = TEAM_ORDER.indexOf(b.name)
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      })
    setMyTeams(myTeamArr)

    // Fetch ALL fixtures — members can view any team's fixtures
    const { data: allFixtures } = await supabase
      .from('fixtures')
      .select('*, teams(id, name), squads(id, published)')
      .order('match_date', { ascending: true })

    const unique = allFixtures || []
    setFixtures(unique)

    const sq = {}
    unique.forEach(f => { sq[f.id] = f.squads?.published || false })
    setSquads(sq)

    // Build sorted unique teams list for filter modal
    const teamsMap = {}
    unique.forEach(f => { if (f.teams) teamsMap[f.teams.id] = f.teams })
    setAllTeamsForFilter(
      Object.values(teamsMap).sort((a, b) => {
        const ai = TEAM_ORDER.indexOf(a.name), bi = TEAM_ORDER.indexOf(b.name)
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      })
    )
  }

  const fetchMyAvailability = async () => {
    const { data } = await supabase
      .from('availability')
      .select('fixture_id, status')
      .eq('player_id', profile.id)
    if (data) {
      const map = {}
      data.forEach(a => { map[a.fixture_id] = a.status })
      setAvailability(map)
    }
  }

  // ── Cache this Monday's ISO date — avoids creating new Date on every isPast() call ──
  const thisMondayISO = useMemo(() => getThisMondayISO(), [])

  // ── Own team IDs — O(1) lookup for availability gating ────────────────────
  const myTeamIdsSet = useMemo(() => new Set(myTeams.map(t => t.id)), [myTeams])

  // ── Filtered fixtures ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return fixtures.filter(f => {
      const past = f.match_date < thisMondayISO
      if (periodFilter === 'upcoming' && past)  return false
      if (periodFilter === 'past'     && !past) return false
      // MY_TEAMS (default): own teams + all friendlies
      if (teamFilter === MY_TEAMS && !myTeamIdsSet.has(f.team_id) && f.match_type !== 'friendly') return false
      // Specific team filter
      if (teamFilter !== ALL && teamFilter !== MY_TEAMS && f.team_id !== teamFilter) return false
      if (homeAwayFilter !== ALL && f.home_away  !== homeAwayFilter) return false
      if (typeFilter     !== ALL && f.match_type !== typeFilter)     return false
      return true
    })
  }, [fixtures, periodFilter, teamFilter, homeAwayFilter, typeFilter, thisMondayISO, myTeamIdsSet])

  // ── Stats — based on own-team fixtures only ────────────────────────────────
  const { totalUpcoming, totalPast, totalResponded, totalAvailable } = useMemo(() => {
    const ownFixtures = fixtures.filter(f => myTeamIdsSet.has(f.team_id) || f.match_type === 'friendly')
    return {
      totalUpcoming:  ownFixtures.filter(f => f.match_date >= thisMondayISO).length,
      totalPast:      ownFixtures.filter(f => f.match_date <  thisMondayISO).length,
      totalResponded: Object.keys(availability).length,
      totalAvailable: Object.values(availability).filter(s => s === 'available').length,
    }
  }, [fixtures, availability, thisMondayISO, myTeamIdsSet])

  const hasFilters = teamFilter !== MY_TEAMS || homeAwayFilter !== ALL || typeFilter !== ALL
  const activeFilterCount = [
    teamFilter     !== MY_TEAMS,
    homeAwayFilter !== ALL,
    typeFilter     !== ALL,
  ].filter(Boolean).length

  // ── Sections and sticky indices — memoised to avoid re-grouping on every render ──
  const sections = useMemo(
    () => Object.entries(groupByMonth(filtered)).map(([month, data]) => ({
      title: month, count: data.length, data,
    })),
    [filtered]
  )
  const stickyIndices = useMemo(
    () => loading ? [] : sections.map((_, i) => 1 + i * 2),
    [loading, sections]
  )

  const PERIOD_OPTS = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past',     label: 'Past' },
    { key: 'all',      label: 'All' },
  ]

  const HA_OPTS = [
    { key: ALL,       label: 'All' },
    { key: 'home',    label: 'Home' },
    { key: 'away',    label: 'Away' },
    { key: 'neutral', label: 'Neutral' },
  ]

  return (
    <View style={styles.container}>
      <TopHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={stickyIndices}
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.sectionLabel}>YOUR SCHEDULE</Text>
            <Text style={styles.pageTitle}>FIXTURES</Text>
            <Text style={styles.pageSub}>All matches across your teams</Text>
          </View>

          {/* ── Stats row ── */}
          <View style={styles.statsRow}>
            {[
              { label: 'Upcoming',  value: totalUpcoming,  color: colors.gold       },
              { label: 'Played',    value: totalPast,      color: colors.textMuted  },
              { label: 'Responded', value: totalResponded, color: colors.green      },
              { label: 'Available', value: totalAvailable, color: colors.green      },
            ].map(s => (
              <View key={s.label} style={styles.statCard}>
                <Text style={[styles.statValue, { color: s.color }]}>
                  {loading ? '—' : s.value}
                </Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Training sessions — compact horizontal strip with availability ── */}
          {!loading && trainingSessions.length > 0 && (
            <View style={styles.trainingStrip}>
              {/* Header row — label left, hint right */}
              <View style={styles.trainingStripHeaderRow}>
                <Text style={styles.trainingStripLabel}>UPCOMING TRAINING</Text>
                <Text style={styles.trainingStripHint}>Tap to add availability</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.trainingStripContent}>
                {trainingSessions.map(session => {
                  const myStatus = trainingAvail[session.id] || null
                  const d        = new Date(session.session_date + 'T00:00:00')
                  const days     = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
                  const months   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                  const dotColor = myStatus === 'available'
                    ? '#22C55E'
                    : myStatus === 'unavailable'
                    ? '#EF4444'
                    : null
                  return (
                    <TouchableOpacity
                      key={session.id}
                      style={styles.trainingStripCard}
                      onPress={() => setTrainingModal(session)}
                      activeOpacity={0.75}>
                      {/* Date block */}
                      <View style={styles.trainingStripDateBlock}>
                        <Text style={styles.trainingStripDateNum}>{d.getDate()}</Text>
                        <Text style={styles.trainingStripDateDow}>{days[d.getDay()].toUpperCase()}</Text>
                      </View>
                      {/* Divider */}
                      <View style={styles.trainingStripDivider} />
                      {/* Info */}
                      <View style={styles.trainingStripInfo}>
                        <Text style={styles.trainingStripDate}>
                          {days[d.getDay()].toUpperCase()} {d.getDate()} {months[d.getMonth()].toUpperCase()}
                        </Text>
                        <Text style={styles.trainingStripTitle} numberOfLines={1}>
                          {session.title?.toUpperCase()}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <AppIcon name="time" size={10} tint={colors.textLight} />
                          <Text style={styles.trainingStripMeta}>{session.session_time?.slice(0,5)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <AppIcon name="venue" size={10} tint={colors.textLight} />
                          <Text style={styles.trainingStripMeta} numberOfLines={1}>{session.venue}</Text>
                        </View>
                      </View>
                      {/* Status dot */}
                      <View style={[
                        styles.trainingStripDot,
                        dotColor
                          ? { backgroundColor: dotColor, shadowColor: dotColor, shadowOpacity: 0.7, shadowRadius: 4, elevation: 3 }
                          : styles.trainingStripDotEmpty,
                      ]} />
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>
          )}

          {/* ── Training availability modal ── */}
          <Modal
            visible={!!trainingModal}
            transparent
            animationType="slide"
            onRequestClose={() => setTrainingModal(null)}>
            <Pressable style={styles.trainingModalBackdrop} onPress={() => setTrainingModal(null)}>
              <Pressable style={styles.trainingModalSheet} onPress={() => {}}>
                <View style={styles.trainingModalHandle} />
                <Text style={styles.trainingModalLabel}>TRAINING SESSION</Text>
                <Text style={styles.trainingModalTitle}>{trainingModal?.title?.toUpperCase()}</Text>
                {trainingModal && (() => {
                  const d      = new Date(trainingModal.session_date + 'T00:00:00')
                  const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
                  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                  return (
                    <View style={styles.trainingModalMetaWrap}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                        <AppIcon name="date" size={13} tint={colors.textLight} />
                        <Text style={styles.trainingModalMetaLine}>
                          {days[d.getDay()]} {d.getDate()} {months[d.getMonth()]}
                        </Text>
                        <AppIcon name="time" size={13} tint={colors.textLight} style={{ marginLeft: 10 }} />
                        <Text style={styles.trainingModalMetaLine}>{trainingModal.session_time?.slice(0,5)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <AppIcon name="venue" size={13} tint={colors.textLight} />
                        <Text style={styles.trainingModalMetaLine}>{trainingModal.venue}</Text>
                      </View>
                    </View>
                  )
                })()}
                <View style={styles.trainingModalBtns}>
                  {[
                    { status: 'available',   label: 'Available',   color: '#22C55E', fill: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)' },
                    { status: 'unavailable', label: 'Unavailable', color: '#EF4444', fill: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)'  },
                  ].map(opt => {
                    const isActive     = trainingAvail[trainingModal?.id] === opt.status
                    const isSubmitting = trainingSubmitting === trainingModal?.id
                    return (
                      <TouchableOpacity
                        key={opt.status}
                        style={[
                          styles.trainingModalBtn,
                          { borderColor: isActive ? opt.border : colors.border,
                            backgroundColor: isActive ? opt.fill : 'transparent' },
                        ]}
                        onPress={() => trainingModal && setTrainingStatus(trainingModal.id, opt.status)}
                        disabled={isSubmitting}
                        activeOpacity={0.8}>
                        <View style={styles.trainingModalBtnInner}>
                          <View style={[
                            styles.trainingModalBtnDot,
                            { backgroundColor: isActive ? opt.color : 'rgba(255,255,255,0.2)' },
                          ]} />
                          <Text style={[styles.trainingModalBtnText, { color: isActive ? opt.color : colors.textMuted }]}>
                            {opt.label}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                {trainingModal && trainingAvail[trainingModal.id] && (
                  <Text style={[styles.trainingModalStatus, {
                    color: trainingAvail[trainingModal.id] === 'available' ? '#22C55E' : '#EF4444'
                  }]}>
                    ✓ You are {trainingAvail[trainingModal.id] === 'available' ? 'attending' : 'unavailable for'} this session
                  </Text>
                )}
                <TouchableOpacity style={styles.trainingModalClose} onPress={() => setTrainingModal(null)} activeOpacity={0.7}>
                  <Text style={styles.trainingModalCloseText}>Close</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>

          {/* ── Period toggle + Filters button ── */}
          <View style={styles.filterRow}>
            {/* Period toggle */}
            <View style={styles.toggleGroup}>
              {PERIOD_OPTS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setPeriodFilter(opt.key)}
                  style={[styles.toggleBtn, periodFilter === opt.key && styles.toggleBtnActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.toggleBtnText, periodFilter === opt.key && { fontFamily: fonts.bold, color: colors.gold }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Filters button */}
            <TouchableOpacity
              onPress={() => setFilterModalOpen(true)}
              activeOpacity={0.8}
              style={[styles.filtersBtn, activeFilterCount > 0 && styles.filtersBtnActive]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <AppIcon name="filter" size={12} tint={activeFilterCount > 0 ? colors.gold : colors.textMuted} />
                <Text style={[styles.filtersBtnText, activeFilterCount > 0 && { color: colors.gold }]}>
                  Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Clear */}
            {hasFilters && (
              <TouchableOpacity
                onPress={() => { setTeamFilter(MY_TEAMS); setHomeAwayFilter(ALL); setTypeFilter(ALL) }}
                style={styles.clearBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Filter Modal ── */}
          <Modal
            visible={filterModalOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setFilterModalOpen(false)}
          >
            <Pressable style={styles.modalBackdrop} onPress={() => setFilterModalOpen(false)}>
              <Pressable style={styles.modalSheet} onPress={() => {}}>

                {/* Handle bar */}
                <View style={styles.modalHandle} />

                {/* Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>FILTERS</Text>
                  {hasFilters && (
                    <TouchableOpacity
                      onPress={() => { setTeamFilter(MY_TEAMS); setHomeAwayFilter(ALL); setTypeFilter(ALL) }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.modalClearText}>Clear all</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Three columns */}
                <View style={styles.modalColumns}>

                  {/* Column 1: Home / Away */}
                  <View style={styles.modalColumn}>
                    <Text style={styles.modalColTitle}>VENUE</Text>
                    {[
                      { key: ALL,       label: 'ALL' },
                      { key: 'home',    label: 'HOME' },
                      { key: 'away',    label: 'AWAY' },
                      { key: 'neutral', label: 'NEUTRAL' },
                    ].map(opt => (
                      <TouchableOpacity
                        key={opt.key}
                        onPress={() => setHomeAwayFilter(opt.key)}
                        style={[styles.modalOption, homeAwayFilter === opt.key && styles.modalOptionActive]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.modalOptionText, homeAwayFilter === opt.key && styles.modalOptionTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Column 2: Teams */}
                  <View style={styles.modalColumn}>
                    <Text style={styles.modalColTitle}>TEAM</Text>
                    {[
                      { id: MY_TEAMS, name: 'MY TEAMS' },
                      { id: ALL,      name: 'ALL' },
                      ...allTeamsForFilter,
                    ].map(t => (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => setTeamFilter(t.id)}
                        style={[styles.modalOption, teamFilter === t.id && styles.modalOptionActive]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.modalOptionText, teamFilter === t.id && styles.modalOptionTextActive]}>
                          {t.name.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Column 3: Match type */}
                  <View style={styles.modalColumn}>
                    <Text style={styles.modalColTitle}>TYPE</Text>
                    {[
                      { key: ALL,        label: 'ALL' },
                      { key: 'league',   label: 'MCCL' },
                      { key: 'cup',      label: 'CUP' },
                      { key: 'friendly', label: 'FRIENDLY' },
                      { key: 'sunday_comp', label: 'CVSL' },
                    ].map(opt => (
                      <TouchableOpacity
                        key={opt.key}
                        onPress={() => setTypeFilter(opt.key)}
                        style={[styles.modalOption, typeFilter === opt.key && styles.modalOptionActive]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.modalOptionText, typeFilter === opt.key && styles.modalOptionTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                </View>

                {/* Apply button */}
                <TouchableOpacity
                  onPress={() => setFilterModalOpen(false)}
                  style={styles.applyBtn}
                  activeOpacity={0.85}
                >
                  <Text style={styles.applyBtnText}>Apply Filters</Text>
                </TouchableOpacity>

              </Pressable>
            </Pressable>
          </Modal>

          {/* ── Loading ── */}
          {loading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.gold} size="large" />
            </View>
          )}

          {/* ── Empty state ── */}
          {!loading && filtered.length === 0 && (
            <View style={styles.emptyCard}>
              <AppIcon name="date" size={36} tint={colors.textMuted} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>NO FIXTURES FOUND</Text>
              <Text style={styles.emptyText}>
                {hasFilters ? 'Try adjusting your filters' : 'No fixtures scheduled yet'}
              </Text>
            </View>
          )}

          </Animated.View>

          {/* ── Grouped fixtures — month headers are sticky direct ScrollView children ── */}
          {!loading && sections.flatMap(section => [
            // Sticky month header — direct child of ScrollView (picked up by stickyHeaderIndices)
            <View key={`mh-${section.title}`} style={styles.monthHeaderRow}>
              <Text style={styles.monthTitle}>{section.title.toUpperCase()}</Text>
              <Text style={styles.monthCount}>{section.count} match{section.count !== 1 ? 'es' : ''}</Text>
            </View>,
            // Fixture items — grouped in a single direct child of ScrollView
            <View key={`mi-${section.title}`} style={styles.monthItemsGroup}>
              {section.data.map(fixture => {
                const past        = isPast(fixture.match_date)
                const myStatus    = availability[fixture.id] || null
                const isPublished = squads[fixture.id] || false
                const cfg         = myStatus ? AVAILABILITY_CONFIG[myStatus] : null
                const { day, dow }= formatDay(fixture.match_date)
                const canAvail    = myTeamIdsSet.has(fixture.team_id) || fixture.match_type === 'friendly'

                return (
                  <TouchableOpacity
                    key={fixture.id}
                    onPress={() => navigation.navigate(SCREENS.FIXTURE_DETAIL, { fixtureId: fixture.id, readOnly: !canAvail })}
                    activeOpacity={0.75}
                    style={[
                      styles.fixtureRow,
                      past && { opacity: 0.65 },
                      cfg && { borderLeftColor: cfg.color },
                    ]}
                  >
                    {/* Date block */}
                    <View style={styles.dateBlock}>
                      <Text style={[styles.dateDay, { color: past ? colors.textMuted : colors.gold }]}>{day}</Text>
                      <Text style={styles.dateDow}>{dow}</Text>
                    </View>

                    {/* Match info */}
                    <View style={styles.matchInfo}>
                      <View style={styles.tagRow}>
                        {/* Team badge — canonical colour per team */}
                        <View style={[styles.teamTag, {
                          backgroundColor: `${teamColor(fixture.teams?.name)}15`,
                          borderColor:     `${teamColor(fixture.teams?.name)}40`,
                        }]}>
                          <Text style={[styles.teamTagText, { color: teamColor(fixture.teams?.name) }]}>
                            {fixture.teams?.name}
                          </Text>
                        </View>
                        {(() => {
                          const hwCfg = fixture.home_away === 'home'
                            ? { icon: 'homeFixture',  label: 'HOME',    color: colors.green, bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.25)' }
                            : fixture.home_away === 'away'
                            ? { icon: 'awayFixture',  label: 'AWAY',    color: '#60A5FA',    bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)' }
                            : { icon: 'neutral',      label: 'NEUTRAL', color: colors.textMuted, bg: 'rgba(255,255,255,0.04)', border: colors.border }
                          return (
                            <View style={[styles.hwTag, { backgroundColor: hwCfg.bg, borderColor: hwCfg.border, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                              <AppIcon name={hwCfg.icon} size={10} tint={hwCfg.color} />
                              <Text style={[styles.hwTagText, { color: hwCfg.color }]}>{hwCfg.label}</Text>
                            </View>
                          )
                        })()}
                        {isPublished && (
                          <View style={styles.squadTag}>
                            <Text style={styles.squadTagText}>✓ Squad Out</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.fixtureTitle}>
                        <Text style={styles.vsText}>VS</Text> {fixture.opponent?.toUpperCase()}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                        <AppIcon name="venue" size={11} tint={colors.textLight} />
                        <Text style={[styles.metaVenue, { marginBottom: 0 }]}>{fixture.venue}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <AppIcon name="time" size={11} tint={colors.textLight} />
                        <Text style={[styles.metaTime, { marginBottom: 0 }]}>{fixture.match_time?.slice(0,5)}</Text>
                      </View>
                    </View>

                    {/* Availability dot + arrow */}
                    <View style={styles.availBadgeWrap}>
                      {canAvail && (cfg ? (
                        <View style={[styles.availDotOnly, { backgroundColor: cfg.fillColor, borderColor: `${cfg.color}55` }]}>
                          <View style={[styles.availDotOnlyInner, { backgroundColor: cfg.color, shadowColor: cfg.color }]} />
                        </View>
                      ) : !past ? (
                        <View style={styles.availDotOnly}>
                          <View style={styles.availDotOnlySilver} />
                        </View>
                      ) : null)}
                      <Text style={styles.viewDetails}>›</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>,
          ])}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.navy },
  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: spacing.md },

  header:       { paddingTop: spacing.lg, marginBottom: spacing.lg },
  sectionLabel: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 2, color: colors.gold, textTransform: 'uppercase', marginBottom: 4 },
  pageTitle:    { fontFamily: fonts.display, fontSize: 36, letterSpacing: 2, color: colors.white, lineHeight: 40 },
  pageSub:      { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 4 },

  statsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.lg },
  statCard:  { width: '47%', backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16 },
  statValue: { fontFamily: fonts.display, fontSize: 32, letterSpacing: 1, lineHeight: 36 },
  statLabel: { fontFamily: fonts.body, fontWeight: '700', fontSize: 12, color: colors.textMuted, marginTop: 4 },

  // ── Filter row ────────────────────────────────────────────────────────────
  filterRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  toggleGroup:    { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, overflow: 'hidden' },
  toggleBtn:      { paddingHorizontal: 14, paddingVertical: 9 },
  toggleBtnActive:{ backgroundColor: 'rgba(245,197,24,0.12)' },
  toggleBtnText:  { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  filtersBtn:     { flex: 1, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  filtersBtnActive:{ borderColor: 'rgba(245,197,24,0.4)', backgroundColor: 'rgba(245,197,24,0.06)' },
  filtersBtnText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  clearBtn:       { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.06)', alignItems: 'center', justifyContent: 'center' },
  clearBtnText:   { fontFamily: fonts.bold, fontSize: 13, color: colors.red },
  resultCount:    { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: 'right', marginBottom: spacing.md },

  // ── Filter modal ──────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.navyLight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(245,197,24,0.15)',
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    paddingTop: 12,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing.lg,
  },
  modalTitle:     { fontFamily: fonts.display, fontSize: 22, letterSpacing: 3, color: colors.white },
  modalClearText: { fontFamily: fonts.medium, fontSize: 13, color: colors.red },
  modalColumns:   { flexDirection: 'row', gap: 12, marginBottom: spacing.xl },
  modalColumn:    { flex: 1 },
  modalColTitle:  { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.gold, marginBottom: spacing.sm, textTransform: 'uppercase' },
  modalOption: {
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: 8,
    alignItems: 'center',
  },
  modalOptionActive: {
    borderColor: 'rgba(245,197,24,0.4)',
    backgroundColor: 'rgba(245,197,24,0.08)',
  },
  modalOptionText:       { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  modalOptionTextActive: { fontFamily: fonts.bold, color: colors.gold },
  applyBtn: {
    backgroundColor: colors.gold,
    paddingVertical: 15,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  applyBtnText: { fontFamily: fonts.bold, fontSize: 15, color: colors.navy },

  loadingWrap: { alignItems: 'center', padding: spacing.xxl },
  emptyCard:   { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', marginTop: spacing.md },
  emptyIcon:   { fontSize: 40, marginBottom: 12 },
  emptyTitle:  { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1, color: colors.white, marginBottom: 8 },
  emptyText:   { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  monthGroup:      { marginBottom: spacing.xl },
  monthHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 10 },
  // Sticky month header — negative margin cancels contentContainerStyle padding so bg spans full width
  monthHeaderRow:  {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: spacing.lg,
    marginHorizontal: -spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.navy,
    zIndex: 1,
  },
  monthItemsGroup: { paddingTop: 8, marginBottom: spacing.xl },
  monthTitle:  { fontFamily: fonts.body, fontWeight: '700', fontSize: 12, letterSpacing: 2, color: colors.gold },
  monthCount:  { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },

  fixtureRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.navyLight,
    borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 3, borderLeftColor: 'transparent',
    borderRadius: radius.md, padding: 14,
    marginBottom: 8, gap: 14,
  },
  dateBlock:  { alignItems: 'center', width: 48, borderRightWidth: 1, borderRightColor: colors.border, paddingRight: 14 },
  dateDay:    { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, color: colors.gold },
  dateDow:    { fontFamily: fonts.bold, fontSize: 10, color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  matchInfo:   { flex: 1 },
  tagRow:      { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' },
  teamTag:     { backgroundColor: 'rgba(245,197,24,0.1)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, alignItems: 'center', justifyContent: 'center' },
  teamTagText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.gold },
  hwTag:       { borderWidth: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  hwTagText:   { fontFamily: fonts.bold, fontSize: 11 },
  squadTag:    { backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  squadTagText:{ fontFamily: fonts.bold, fontSize: 11, color: colors.green },
  fixtureTitle:{ fontFamily: fonts.bold, fontSize: 15, color: colors.white, marginBottom: 4, letterSpacing: 0.3 },
  vsText:      { fontFamily: fonts.display, color: colors.gold, fontSize: 16, letterSpacing: 1 },
  metaVenue:   { fontFamily: fonts.bold, fontSize: 12, color: colors.textLight, marginBottom: 3 },
  metaTime:    { fontFamily: fonts.bold, fontSize: 12, color: colors.textLight },
  availBadgeWrap: { alignItems: 'center', gap: 6 },
  availDotOnly:       { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  availDotOnlyInner:  { width: 12, height: 12, borderRadius: 6, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4, elevation: 3 },
  availDotOnlySilver: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(139,155,180,0.4)' },
  viewDetails: { fontFamily: fonts.bold, fontSize: 20, color: colors.textMuted, lineHeight: 20 },

  // ── Training sessions strip ────────────────────────────────────────────────
  trainingStrip:          { marginBottom: spacing.lg },
  trainingStripHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  trainingStripLabel:     { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: '#60A5FA', textTransform: 'uppercase' },
  trainingStripHint:      { fontFamily: fonts.bold, fontSize: 11, color: colors.gold, opacity: 0.7 },
  // paddingRight = just enough to show the next card's date block as a peek
  trainingStripContent:   { gap: 10, paddingBottom: 4, paddingRight: 8 },
  trainingStripCard:      {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.navyLight,
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)',
    borderLeftWidth: 3, borderLeftColor: '#60A5FA',
    borderRadius: radius.md, padding: 12,
    // Wide enough to show all content, narrow enough that next card peeks at ~60px
    width: Dimensions.get('window').width - 96,
  },
  trainingStripDateBlock: { alignItems: 'center', minWidth: 36 },
  trainingStripDateNum:   { fontFamily: fonts.display, fontSize: 26, color: '#60A5FA', lineHeight: 28 },
  trainingStripDateDow:   { fontFamily: fonts.bold, fontSize: 9, color: colors.textMuted, letterSpacing: 1 },
  trainingStripDivider:   { width: 1, height: '100%', backgroundColor: 'rgba(96,165,250,0.15)', alignSelf: 'stretch' },
  trainingStripInfo:      { flex: 1 },
  trainingStripDate:      { fontFamily: fonts.bold, fontSize: 10, color: '#60A5FA', letterSpacing: 0.5, marginBottom: 3 },
  trainingStripTitle:     { fontFamily: fonts.bold, fontSize: 13, color: colors.white, marginBottom: 3 },
  trainingStripMeta:      { fontFamily: fonts.bold, fontSize: 11, color: colors.textLight, marginBottom: 1 },
  trainingStripDot:       { width: 12, height: 12, borderRadius: 6, flexShrink: 0, marginLeft: 4 },
  trainingStripDotEmpty:  { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'transparent' },

  // ── Training availability modal ────────────────────────────────────────────
  trainingModalBackdrop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  trainingModalSheet:     { backgroundColor: colors.navyLight, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(96,165,250,0.2)', paddingHorizontal: spacing.lg, paddingBottom: 40, paddingTop: 12 },
  trainingModalHandle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  trainingModalLabel:     { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: '#60A5FA', marginBottom: 6 },
  trainingModalTitle:     { fontFamily: fonts.display, fontSize: 22, letterSpacing: 1, color: colors.white, marginBottom: 6 },
  trainingModalMetaLine:  { fontFamily: fonts.bold, fontSize: 13, color: colors.textLight, marginBottom: 6 },
  trainingModalMetaWrap:  { marginBottom: spacing.lg },
  trainingModalBtns:      { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  trainingModalBtn:       { flex: 1, paddingVertical: 14, borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },
  trainingModalBtnInner:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trainingModalBtnDot:    { width: 10, height: 10, borderRadius: 5 },
  trainingModalBtnText:   { fontFamily: fonts.bold, fontSize: 14 },
  trainingModalStatus:    { fontFamily: fonts.bold, fontSize: 13, textAlign: 'center', marginBottom: spacing.md },
  trainingModalClose:     { paddingVertical: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  trainingModalCloseText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },
})
// pavilion-app/src/screens/member/DashboardScreen.jsx
// Faithful native replica of pavilion-web/src/pages/member/DashboardPage.jsx
// Features: week navigator, Saturday/Sunday fixture cards, availability toggle,
// stats grid, announcements, join team section, pull-to-refresh

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, Image,
  StyleSheet, RefreshControl, Animated, Dimensions,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import useAuthStore from '../../store/authStore'
import TopHeader from '../../components/layout/TopHeader'
import { SCREENS, AVAILABILITY_CONFIG, MATCH_TYPE_LABELS, teamColor, shortTeam, toTitleCase } from '../../lib/constants'
import { colors, fonts, spacing, radius, shadow } from '../../theme'
import AppIcon from '../../components/AppIcon'

// ─── Configurable ─────────────────────────────────────────────────────────────
const SUNDAY_BLUE = '#60A5FA'
const SCREEN_W    = Dimensions.get('window').width

// Monday 00:00 local time — weekends before this are considered past
// Saturday + Sunday fixtures archive together on the following Monday
function getThisMonday() {
  const today = new Date()
  const day   = today.getDay()            // 0=Sun, 1=Mon … 6=Sat
  const diff  = day === 0 ? -6 : 1 - day // days back to Monday
  const mon   = new Date(today)
  mon.setDate(today.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return toLocalISO(mon)                  // toLocalISO already defined above
}

// ─── Week helpers (mirrors DashboardPage.jsx) ─────────────────────────────────

// Use local date parts to avoid UTC/BST timezone shifting date back by 1 day
// e.g. midnight BST (UTC+1) = 23:00 previous day in UTC → toISOString() gives wrong date
function toLocalISO(d) {
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWeekDates(offset) {
  const today = new Date()
  const day   = today.getDay()
  const diffToSat = day === 6 ? 0 : (6 - day)
  const sat = new Date(today)
  sat.setDate(today.getDate() + diffToSat + offset * 7)
  sat.setHours(0, 0, 0, 0)
  const sun = new Date(sat)
  sun.setDate(sat.getDate() + 1)
  return { saturday: toLocalISO(sat), sunday: toLocalISO(sun) }
}

function getWeekLabel(offset) {
  if (offset === 0)  return 'This Weekend'
  if (offset === 1)  return 'Next Weekend'
  if (offset === -1) return 'Last Weekend'
  if (offset > 1)    return `In ${offset} weekends`
  return `${Math.abs(offset)} weekends ago`
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

function formatDateLong(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

function formatTime(timeStr) {
  if (!timeStr) return '12:30'
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${suffix}`
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }) {
  return (
    <View style={[styles.statCard, { borderTopColor: accent || colors.gold }]}>
      <Text style={[styles.statValue, { color: accent || colors.gold }]}>
        {value ?? '—'}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  )
}

function HomeAwayBadge({ homeAway, isSunday }) {
  const cfg = {
    home:    { icon: 'homeFixture',  label: 'HOME',    color: colors.green,     bg: 'rgba(34,197,94,0.12)',      border: 'rgba(34,197,94,0.3)' },
    away:    { icon: 'awayFixture',  label: 'AWAY',    color: SUNDAY_BLUE,      bg: 'rgba(96,165,250,0.12)',     border: 'rgba(96,165,250,0.3)' },
    neutral: { icon: 'neutral',      label: 'NEUTRAL', color: colors.textMuted, bg: 'rgba(255,255,255,0.04)',    border: colors.border },
  }[homeAway] || { icon: 'neutral', label: homeAway, color: colors.textMuted, bg: 'transparent', border: colors.border }

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border, flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
      <AppIcon name={cfg.icon} size={11} tint={cfg.color} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  )
}

// Simple single-colour bar reflecting only the current user's status
// Grey = not responded, Green = available, Orange = tentative, Red = unavailable
function AvailabilityBar({ myStatus }) {
  const barColor = myStatus === 'available'
    ? colors.green
    : myStatus === 'unavailable'
    ? colors.red
    : myStatus === 'tentative'
    ? '#F97316'
    : 'rgba(255,255,255,0.08)'

  return (
    <View style={styles.availBar}>
      <View style={styles.availBarTrack}>
        <View style={[styles.availBarFill, { flex: 1, backgroundColor: barColor }]} />
      </View>
    </View>
  )
}

// ─── Fixture Card ─────────────────────────────────────────────────────────────
function FixtureCard({ fixture, myStatus, submitting, onSetStatus, onViewDetail, isSunday }) {
  // Canonical team colour — 1st=gold 2nd=blue 3rd=green 4th=purple Sunday=orange
  const accent    = teamColor(fixture.teams?.name)
  const isLoading = submitting === fixture.id

  return (
    <View style={[styles.fixtureCard, isLoading && { opacity: 0.7 }]}>

      {/* Gold/Blue top border */}
      <View style={[styles.fixtureCardTopBorder, { backgroundColor: accent }]} />

      {/* Card header */}
      <View style={[styles.fixtureCardHeader, { borderBottomColor: `${accent}20` }]}>
        <View style={styles.fixtureCardHeaderLeft}>
          {/* Team badge */}
          <View style={[styles.badge, { backgroundColor: `${accent}15`, borderColor: `${accent}40` }]}>
            <Text style={[styles.badgeText, { color: accent }]}>
              {fixture.teams?.name}
            </Text>
          </View>
          <HomeAwayBadge homeAway={fixture.home_away} isSunday={isSunday} />
        </View>
        <Text style={styles.matchTypeText}>
          {MATCH_TYPE_LABELS[fixture.match_type] || fixture.match_type}
        </Text>
      </View>

      {/* Card body */}
      <View style={styles.fixtureCardBody}>
        {/* HTCC VS OPPONENT */}
        <Text style={styles.fixtureTitle}>
          HTCC{' '}
          <Text style={[styles.vsText, { color: accent }]}>VS</Text>
          {' '}{fixture.opponent?.toUpperCase()}
        </Text>

        {/* Date + time */}
        <View style={styles.fixtureMetaRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <AppIcon name="date" size={13} tint={colors.white} />
            <Text style={styles.fixtureMeta}>{formatDateShort(fixture.match_date).toUpperCase()}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <AppIcon name="time" size={13} tint={colors.white} />
            <Text style={styles.fixtureMeta}>{formatTime(fixture.match_time)}</Text>
          </View>
        </View>

        {/* Venue */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 16 }}>
          <AppIcon name="venue" size={13} tint={colors.textLight} />
          <Text style={[styles.fixtureVenue, { marginBottom: 0 }]}>{fixture.venue}</Text>
        </View>

        {/* Availability bar — reflects user's own status only */}
        <AvailabilityBar myStatus={myStatus} />

        {/* Availability buttons */}
        <View style={styles.availButtons}>
          {['available', 'unavailable', 'tentative'].map(status => {
            const cfg      = AVAILABILITY_CONFIG[status]
            const isActive = myStatus === status
            return (
              <TouchableOpacity
                key={status}
                onPress={() => onSetStatus(fixture.id, status)}
                disabled={isLoading}
                activeOpacity={0.75}
                style={[
                  styles.availBtn,
                  {
                    borderColor: isActive ? cfg.color : colors.border,
                    backgroundColor: isActive ? cfg.fillColor : 'transparent',
                    shadowColor: isActive ? cfg.color : 'transparent',
                    shadowOpacity: isActive ? 0.3 : 0,
                    shadowRadius: 8,
                    elevation: isActive ? 4 : 0,
                  },
                ]}
              >
                <View style={[
                  styles.availDot,
                  { backgroundColor: isActive ? cfg.color : colors.textMuted },
                ]} />
                <Text style={[
                  styles.availBtnText,
                  { fontFamily: isActive ? fonts.bold : fonts.body, color: isActive ? cfg.color : colors.textMuted },
                ]}>
                  {status === 'available' ? 'Available' : status === 'unavailable' ? 'Unavailable' : 'Tentative'}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Status confirmation */}
        {myStatus && (
          <Text style={[styles.statusConfirm, { color: AVAILABILITY_CONFIG[myStatus]?.color }]}>
            ✓ You're marked as {myStatus} for this match
          </Text>
        )}
      </View>

      {/* Card footer */}
      <View style={styles.fixtureCardFooter}>
        <TouchableOpacity onPress={() => onViewDetail(fixture.id)} activeOpacity={0.7}>
          <Text style={[styles.viewDetailsText, { color: accent }]}>View Details →</Text>
        </TouchableOpacity>
        {fixture.availability_deadline && (
          <View style={styles.deadlineBadge}>
            <Text style={styles.deadlineText}>
              Deadline: {formatDateShort(fixture.availability_deadline)}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ─── Announcement Card ────────────────────────────────────────────────────────
function AnnouncementCard({ ann }) {
  const dateStr = new Date(ann.created_at).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
  return (
    <View style={styles.announcementCard}>
      <Text style={styles.announcementDate}>{dateStr}</Text>
      <Text style={styles.announcementTitle}>{ann.title}</Text>
      <Text style={styles.announcementBody}>{ann.body}</Text>
    </View>
  )
}

// ─── Join Team Card ───────────────────────────────────────────────────────────
function JoinTeamCard({ team, isPending, isLoading, onJoin, onCancel }) {
  return (
    <View style={[styles.joinCard, isPending && styles.joinCardPending]}>
      {/* HTCC crest */}
      <View style={styles.joinCrestRing}>
        <Image
          source={require('../../../assets/htcc-logo.png')}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </View>

      <Text style={styles.joinTeamName}>{team.name.toUpperCase()}</Text>
      <Text style={styles.joinDayType}>{team.day_type} fixture</Text>

      {isPending ? (
        <TouchableOpacity
          onPress={onCancel}
          disabled={isLoading}
          activeOpacity={0.75}
          style={styles.pendingBtn}
        >
          <Text style={styles.pendingBtnText}>
            {isLoading ? 'Cancelling…' : 'Requested'}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onJoin}
          disabled={isLoading}
          activeOpacity={0.75}
          style={styles.joinBtn}
        >
          <Text style={styles.joinBtnText}>
            {isLoading ? 'Sending…' : '+ Request to Join'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const { profile } = useAuthStore()

  // ── State ──────────────────────────────────────────────────────────────────
  const [fixtures,      setFixtures]      = useState([])
  const [availability,  setAvailability]  = useState({})
  const [announcements, setAnnouncements] = useState([])
  const [allTeams,      setAllTeams]      = useState([])
  const [joinRequests,  setJoinRequests]  = useState([])
  const [memberTeamIds, setMemberTeamIds] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [submitting,    setSubmitting]    = useState(null)
  const [joinLoading,   setJoinLoading]   = useState(null)
  const [weekOffset,      setWeekOffset]      = useState(0)
  const [satCarouselIdx,      setSatCarouselIdx]      = useState(0)
  const [sunCarouselIdx,      setSunCarouselIdx]      = useState(0)
  const [annCarouselIdx,      setAnnCarouselIdx]      = useState(0)
  const [trainingSessions,    setTrainingSessions]    = useState([])
  const [trainingCarouselIdx, setTrainingCarouselIdx] = useState(0)
  const [latestResults,       setLatestResults]       = useState([])  // all-time results carousel
  const [latestResultsIdx,    setLatestResultsIdx]    = useState(0)
  const [trainingAvail,    setTrainingAvail]    = useState({})
  const [trainingSubmitting, setTrainingSubmitting] = useState(null)

  // ── Refs ───────────────────────────────────────────────────────────────────
  const fadeAnim  = useRef(new Animated.Value(0)).current
  const scrollRef = useRef(null)
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 400,
      useNativeDriver: true,
    }).start()
  }, [])

  // ── Load data on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    if (profile) loadData()
  }, [profile])

  // ── Re-fetch on focus — picks up join request changes + admin approvals ────
  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        fetchTrainingSessions()
        fetchJoinRequests()
        // Re-fetch team IDs so "Join a Team" section updates when admin approves
        supabase
          .from('team_members')
          .select('team_id')
          .eq('player_id', profile.id)
          .eq('status', 'active')
          .then(({ data }) => {
            if (data) setMemberTeamIds(data.map(t => t.team_id))
          })
      }
    }, [profile?.id])
  )

  // ── Fetch upcoming training sessions ──────────────────────────────────
  const fetchTrainingSessions = async () => {
    const today = toLocalISO(new Date())
    const { data: sessions } = await supabase
      .from('training_sessions')
      .select('*')
      .gte('session_date', today)
      .order('session_date', { ascending: true })
      .limit(5)
    if (sessions) setTrainingSessions(sessions)

    if (sessions?.length > 0) {
      const sessionIds = sessions.map(s => s.id)
      const { data: avail } = await supabase
        .from('training_availability')
        .select('session_id, status')
        .eq('player_id', profile.id)
        .in('session_id', sessionIds)
      const map = {}
      avail?.forEach(a => { map[a.session_id] = a.status })
      setTrainingAvail(map)
    }
  }

  // ── Canonical team order ──────────────────────────────────────────────────
  const TEAM_ORDER = ['1st XI', '2nd XI', '3rd XI', '4th XI', 'Sunday XI']

  // ── Fetch ALL past results — permanent carousel, newest date first,
  //    canonical team order within same date (1st → 2nd → 3rd → 4th → Sunday)
  const fetchLatestResults = async () => {
    try {
      const { data: results } = await supabase
        .from('match_results')
        .select('winner, submitted_at, fixture_id, fixtures!fixture_id(id, opponent, match_date, match_type, teams!team_id(name))')
        .order('submitted_at', { ascending: false })
        .limit(30)

      if (!results?.length) { setLatestResults([]); return }

      // Sort: newest match_date first; within same date → canonical team order
      const sorted = [...results]
        .filter(r => r.fixtures)
        .sort((a, b) => {
          const dA = a.fixtures?.match_date || ''
          const dB = b.fixtures?.match_date || ''
          if (dB !== dA) return dB.localeCompare(dA)
          const idx = name => {
            const i = TEAM_ORDER.findIndex(t => (name || '').includes(t.split(' ')[0]))
            return i === -1 ? 99 : i
          }
          return idx(a.fixtures?.teams?.name) - idx(b.fixtures?.teams?.name)
        })

      // Batch fetch all POTM rows — single query instead of N+1
      const fixtureIds = sorted.map(r => r.fixture_id)
      const { data: potmRows } = await supabase
        .from('match_potm')
        .select('fixture_id, points, profiles!player_id(full_name)')
        .in('fixture_id', fixtureIds)
      const potmMap = {}
      potmRows?.forEach(p => { potmMap[p.fixture_id] = p })
      const withPotm = sorted.map(res => ({ ...res, match_potm: potmMap[res.fixture_id] || null }))

      setLatestResults(withPotm)
    } catch (err) {
      console.warn('[Dashboard] fetchLatestResults:', err.message)
    }
  }

  // ── Set training availability ──────────────────────────────────────────
  const setTrainingStatus = async (sessionId, status) => {
    setTrainingSubmitting(sessionId)
    try {
      const existing = trainingAvail[sessionId]
      if (existing === status) {
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
      console.error('[Training] Failed to set status:', err)
    } finally {
      setTrainingSubmitting(null)
    }
  }

  // ── Re-fetch fixtures when week changes ────────────────────────────────────
  useEffect(() => {
    if (profile) fetchFixtures(weekOffset)
  }, [weekOffset])

  // ── Find first upcoming weekend that has fixtures for this player's teams ──
  // Scans up to 16 weeks ahead — sets weekOffset so the navigator starts there
  const findSmartOffset = async (teamIds) => {
    const thisMonday = getThisMonday()
    for (let offset = 0; offset <= 16; offset++) {
      const { saturday, sunday } = getWeekDates(offset)
      // Skip fully past weekends (both days before this Monday)
      if (saturday < thisMonday && sunday < thisMonday) continue

      // Include: player's team fixtures OR friendly fixtures (visible to all members)
      let query = supabase
        .from('fixtures')
        .select('id')
        .in('match_date', [saturday, sunday])
        .limit(1)

      if (teamIds?.length > 0) {
        // OR: team fixture OR friendly
        query = query.or(`team_id.in.(${teamIds.join(',')}),match_type.eq.friendly`)
      } else {
        // No teams — only see friendlies
        query = query.eq('match_type', 'friendly')
      }

      const { data } = await query
      if (data?.length > 0) return offset
    }
    return 0
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // Step 1 — get team IDs first so we can scan for the smart offset
      const { data: myTeams } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('player_id', profile.id)
        .eq('status', 'active')
      const teamIds = myTeams?.map(t => t.team_id) || []
      setMemberTeamIds(teamIds)

      // Step 2 — find first upcoming weekend with fixtures and jump straight there
      const smartOffset = await findSmartOffset(teamIds)
      if (smartOffset !== weekOffset) {
        setWeekOffset(smartOffset)
        // useEffect([weekOffset]) will call fetchFixtures automatically — skip it in Promise.all
        // to prevent the double network call that was occurring on every initial mount
      }

      // Step 3 — load everything else in parallel
      // fetchFixtures only runs here when the offset didn't change (offset change is handled by useEffect)
      await Promise.all([
        smartOffset === weekOffset ? fetchFixtures(smartOffset) : Promise.resolve(),
        fetchMyAvailability(),
        fetchAnnouncements(),
        fetchAllTeams(),
        fetchJoinRequests(),
        fetchTrainingSessions(),
        fetchLatestResults(),
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try { await loadData() } finally { setRefreshing(false) }
  }

  // ── Fetch fixtures for current week ───────────────────────────────────────
  const fetchFixtures = async (offset = 0) => {
    const { saturday, sunday } = getWeekDates(offset)

    // Step 1: get player's team IDs
    const { data: myTeams } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('player_id', profile.id)
      .eq('status', 'active')

    const teamIds = myTeams?.map(t => t.team_id) || []
    setMemberTeamIds(teamIds)

    // Step 2: friendly fixtures — ALL members can see + add availability
    const { data: friendlyData } = await supabase
      .from('fixtures')
      .select('*, teams(id, name, day_type)')
      .eq('match_type', 'friendly')
      .in('match_date', [saturday, sunday])
      .order('match_date', { ascending: true })

    // Step 3: MCCL / Cup / CVSL — only members of that specific team
    let teamData = []
    if (teamIds.length > 0) {
      const { data } = await supabase
        .from('fixtures')
        .select('*, teams(id, name, day_type)')
        .in('team_id', teamIds)
        .neq('match_type', 'friendly')
        .in('match_date', [saturday, sunday])
        .order('match_date', { ascending: true })
      teamData = data || []
    }

    // Step 4: merge + deduplicate (player in a team with a friendly = only one card)
    const merged = [...(friendlyData || []), ...teamData]
    const unique  = Array.from(new Map(merged.map(f => [f.id, f])).values())
    setFixtures(unique)
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

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, body, target_role, created_at')
      .in('target_role', ['all', profile.role])
      .order('created_at', { ascending: false })
      .limit(3)
    if (data) setAnnouncements(data)
  }

  const fetchAllTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name, day_type')
      .order('name')
    if (data) setAllTeams(data)
  }

  const fetchJoinRequests = async () => {
    const { data } = await supabase
      .from('join_requests')
      .select('id, team_id, status')
      .eq('player_id', profile.id)
      .eq('status', 'pending')
    if (data) setJoinRequests(data)
  }

  // ── Availability toggle (mirrors web setStatus exactly) ───────────────────
  const setStatus = useCallback(async (fixtureId, status) => {
    setSubmitting(fixtureId)
    try {
      const existing = availability[fixtureId]

      if (existing === status) {
        // Clicking active status → DELETE (toggle off)
        await supabase.from('availability').delete()
          .eq('fixture_id', fixtureId).eq('player_id', profile.id)
        setAvailability(prev => { const next = { ...prev }; delete next[fixtureId]; return next })
      } else if (existing) {
        // Switch status → UPDATE
        await supabase.from('availability').update({ status })
          .eq('fixture_id', fixtureId).eq('player_id', profile.id)
        setAvailability(prev => ({ ...prev, [fixtureId]: status }))
      } else {
        // New response → INSERT
        await supabase.from('availability').insert({ fixture_id: fixtureId, player_id: profile.id, status })
        setAvailability(prev => ({ ...prev, [fixtureId]: status }))
      }
    } catch (err) {
      console.error('setStatus error:', err.message)
    } finally {
      setSubmitting(null)
    }
  }, [availability, profile?.id])

  const handleJoinRequest = useCallback(async (team) => {
    setJoinLoading(team.id)
    try {
      await supabase.from('join_requests').insert({ player_id: profile.id, team_id: team.id })
      await fetchJoinRequests()

      // ── Notify all admins of the new join request ─────────────────────────
      const { sendPushToRole, insertNotificationsForRole } = await import('../../lib/pushNotifications')
      const notifTitle = 'New Team Join Request'
      const notifBody  = `${profile.full_name} has requested to join ${team.name}.`
      sendPushToRole('admin', notifTitle, notifBody, { type: 'approval' })
      insertNotificationsForRole('admin', 'approval', notifTitle, notifBody)
    } catch (err) {
      console.error('join request error:', err.message)
    } finally {
      setJoinLoading(null)
    }
  }, [profile?.id, profile?.full_name])

  const handleCancelJoin = useCallback(async (team) => {
    setJoinLoading(team.id)
    try {
      await supabase.from('join_requests').delete()
        .eq('player_id', profile.id).eq('team_id', team.id).eq('status', 'pending')
      await fetchJoinRequests()
    } catch (err) {
      console.error('cancel join error:', err.message)
    } finally {
      setJoinLoading(null)
    }
  }, [profile?.id])

  // ── Derived values — memoised to avoid recalculation on every render ────────
  const { saturday: satDate, sunday: sunDate } = useMemo(
    () => getWeekDates(weekOffset),
    [weekOffset]
  )
// Canonical team sort order for fixture carousels — 1st → 2nd → 3rd → 4th → Sunday
const CANONICAL_TEAM_ORDER = ['1st XI', '2nd XI', '3rd XI', '4th XI', 'Sunday XI']
const teamSortIndex = (name) => {
  if (!name) return 99
  const idx = CANONICAL_TEAM_ORDER.findIndex(t => name.includes(t.split(' ')[0]))
  return idx === -1 ? 99 : idx
}

  const satFixtures = useMemo(
    () => fixtures
      .filter(f => f.match_date === satDate)
      .sort((a, b) => teamSortIndex(a.teams?.name) - teamSortIndex(b.teams?.name)),
    [fixtures, satDate]
  )
  const sunFixtures = useMemo(
    () => fixtures
      .filter(f => f.match_date === sunDate)
      .sort((a, b) => teamSortIndex(a.teams?.name) - teamSortIndex(b.teams?.name)),
    [fixtures, sunDate]
  )
  const thisWeekend = useMemo(
    () => weekOffset === 0 ? fixtures : [],
    [weekOffset, fixtures]
  )
  const pendingIds = useMemo(
    () => new Set(joinRequests.map(r => r.team_id)),
    [joinRequests]
  )
  const teamsToShow = useMemo(
    () => allTeams.filter(t => !memberTeamIds.includes(t.id)),
    [allTeams, memberTeamIds]
  )
  const totalAvailable = useMemo(
    () => Object.values(availability).filter(s => s === 'available').length,
    [availability]
  )
  const totalResponded = useMemo(
    () => Object.keys(availability).length,
    [availability]
  )

  return (
    <View style={styles.container}>
      <TopHeader />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        // Prevents scroll position jumping when content above current position
        // changes height (e.g. fixture cards swapping in/out on week change)
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.gold}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── Greeting ── */}
          <View style={styles.greetingSection}>
            <Text style={styles.greetingLine}>{getGreeting()},</Text>
            <Text style={styles.greetingName}>
              {(() => {
                if (!profile?.full_name) return 'PLAYER'
                const parts = profile.full_name.trim().split(/\s+/)
                const first = parts[0].toUpperCase()
                const lastInitial = parts.length > 1 ? ` ${parts[parts.length - 1][0].toUpperCase()}.` : ''
                return `${first}${lastInitial}`
              })()}
            </Text>
            <Text style={styles.greetingSub}>
              {thisWeekend.length > 0
                ? `You have ${thisWeekend.length} fixture${thisWeekend.length > 1 ? 's' : ''} this weekend — set your availability below.`
                : 'No fixtures this weekend. Check upcoming fixtures below.'}
            </Text>
          </View>

          {/* ── Stats grid (2×2) ── */}
          <View style={styles.statsGrid}>
            <StatCard label="This Weekend" value={thisWeekend.length}  sub="fixtures"       accent={colors.gold}      />
            <StatCard label="Responded"    value={totalResponded}       sub="this season"    accent={colors.green}     />
            <StatCard label="Available"    value={totalAvailable}       sub="confirmed"      accent={colors.green}     />
            <StatCard label="Upcoming"     value={fixtures.length}      sub="total fixtures" accent={colors.textMuted} />
          </View>

          {/* ── Latest Results — permanent horizontal carousel, newest first ── */}
          {!loading && latestResults.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionLabel}>LAST MATCH</Text>
                  <Text style={styles.sectionTitle}>LATEST RESULTS</Text>
                </View>
                {latestResults.length > 1 && (
                  <Text style={styles.swipeHint}>Swipe for more ›</Text>
                )}
              </View>

              <FlatList
                data={latestResults}
                keyExtractor={r => r.fixture_id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={e => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - spacing.md * 2))
                  setLatestResultsIdx(Math.max(0, Math.min(idx, latestResults.length - 1)))
                }}
                renderItem={({ item: res }) => {
                  const fix            = res.fixtures
                  const potm           = res.match_potm
                  const tc             = teamColor(fix?.teams?.name)
                  const resCfg         = res.winner === 'htcc'
                    ? { label: 'WIN',       color: colors.green }
                    : res.winner === 'opponent'
                    ? { label: 'LOSS',      color: '#EF4444' }
                    : res.winner === 'draw'
                    ? { label: 'DRAW',      color: colors.gold }
                    : { label: 'NO RESULT', color: colors.textMuted }
                  const matchTypeLabel = MATCH_TYPE_LABELS[fix?.match_type] || (fix?.match_type || '').toUpperCase()

                  return (
                    <View style={{ width: SCREEN_W - spacing.md * 2 }}>
                      <TouchableOpacity
                        style={[styles.latestResultCard, { borderLeftColor: tc }]}
                        onPress={() => fix?.id && navigation.navigate(SCREENS.FIXTURE_DETAIL, { fixtureId: fix.id })}
                        activeOpacity={0.8}
                      >
                        {/* Team + opponent + WIN/LOSS badge */}
                        <View style={styles.latestResultTop}>
                          <View style={[styles.latestResultTeamBadge, { backgroundColor: `${tc}18`, borderColor: `${tc}44` }]}>
                            <Text style={[styles.latestResultTeamText, { color: tc }]}>
                              {shortTeam(fix?.teams?.name) || fix?.teams?.name}
                            </Text>
                          </View>
                          <Text style={styles.latestResultMatch} numberOfLines={1}>
                            vs {fix?.opponent?.toUpperCase()}
                          </Text>
                          <View style={[styles.latestResultBadge, { backgroundColor: `${resCfg.color}18`, borderColor: `${resCfg.color}40` }]}>
                            <Text style={[styles.latestResultBadgeText, { color: resCfg.color }]}>{resCfg.label}</Text>
                          </View>
                        </View>

                        {/* Date + match type */}
                        <View style={styles.latestResultMetaRow}>
                          <Text style={styles.latestResultMeta}>
                            {fix?.match_date
                              ? new Date(fix.match_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                              : ''}
                          </Text>
                          {matchTypeLabel ? (
                            <View style={styles.latestResultTypeBadge}>
                              <Text style={styles.latestResultTypeText}>{matchTypeLabel}</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* POTM row */}
                        {potm?.profiles?.full_name && (
                          <View style={styles.latestResultPotm}>
                            <AppIcon name="trophy" size={20} />
                            <Text style={styles.latestResultPotmName}>{toTitleCase(potm.profiles.full_name)}</Text>
                            <Text style={styles.latestResultPotmPts}>{Math.round(potm.points || 0)} pts</Text>
                          </View>
                        )}

                        <Text style={styles.latestResultViewMore}>View scorecard ›</Text>
                      </TouchableOpacity>
                    </View>
                  )
                }}
              />

              {latestResults.length > 1 && (
                <View style={styles.carouselDots}>
                  {latestResults.map((_, i) => (
                    <View key={i} style={[styles.carouselDot, latestResultsIdx === i && styles.carouselDotActive]} />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── Training Sessions ── */}
          {!loading && trainingSessions.length > 0 && (
            <View style={styles.trainingSection}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionLabel}>UPCOMING TRAINING</Text>
                  <Text style={styles.sectionTitle}>SESSIONS</Text>
                </View>
                {trainingSessions.length > 1 && (
                  <Text style={styles.swipeHint}>Swipe for more ›</Text>
                )}
              </View>
              <FlatList
                data={trainingSessions}
                keyExtractor={s => s.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={e => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - spacing.md * 2))
                  setTrainingCarouselIdx(Math.max(0, Math.min(idx, trainingSessions.length - 1)))
                }}
                renderItem={({ item: session }) => {
                  const myStatus  = trainingAvail[session.id] || null
                  const isLoading = trainingSubmitting === session.id
                  const d    = new Date(session.session_date + 'T00:00:00')
                  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
                  return (
                    <View style={{ width: SCREEN_W - spacing.md * 2 }}>
                      <View style={styles.trainingCard}>
                        <View style={styles.trainingCardTop}>
                          <View style={styles.trainingDateBlock}>
                            <Text style={styles.trainingDateNum}>{d.getDate()}</Text>
                            <Text style={styles.trainingDateDow}>{days[d.getDay()]}</Text>
                          </View>
                          <View style={styles.trainingInfo}>
                            <Text style={styles.trainingTitle}>{session.title}</Text>
                            <View style={styles.trainingMetaRow}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <AppIcon name="date" size={11} tint={colors.textLight} />
                                <Text style={styles.trainingMeta}>
                                  {days[d.getDay()].toUpperCase()} {d.getDate()} {['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()]}
                                </Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <AppIcon name="time" size={11} tint={colors.textLight} />
                                <Text style={styles.trainingMeta}>{session.session_time?.slice(0,5)}</Text>
                              </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <AppIcon name="venue" size={11} tint={colors.textLight} />
                              <Text style={styles.trainingMeta}>{session.venue}</Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.trainingAvailRow}>
                          {[
                            { status: 'available',   label: 'Available',   color: colors.green, fill: 'rgba(34,197,94,0.12)' },
                            { status: 'unavailable', label: 'Unavailable', color: colors.red,   fill: 'rgba(239,68,68,0.1)'  },
                          ].map(opt => {
                            const isActive = myStatus === opt.status
                            return (
                              <TouchableOpacity
                                key={opt.status}
                                style={[styles.trainingAvailBtn, isActive && { borderColor: opt.color, backgroundColor: opt.fill }]}
                                onPress={() => !isLoading && setTrainingStatus(session.id, opt.status)}
                                activeOpacity={0.7}
                                disabled={isLoading}>
                                <View style={[styles.trainingAvailDot, { backgroundColor: isActive ? opt.color : 'rgba(255,255,255,0.2)' }]} />
                                <Text style={[styles.trainingAvailText, isActive && { fontFamily: fonts.bold, color: opt.color }]}>
                                  {opt.label}
                                </Text>
                              </TouchableOpacity>
                            )
                          })}
                        </View>
                        {myStatus && (
                          <Text style={[styles.trainingStatusText, { color: myStatus === 'available' ? colors.green : colors.red }]}>
                            ✓ {myStatus === 'available' ? 'You are attending this session' : 'You are unavailable for this session'}
                          </Text>
                        )}
                      </View>
                    </View>
                  )
                }}
              />
              {trainingSessions.length > 1 && (
                <View style={styles.carouselDots}>
                  {trainingSessions.map((_, i) => (
                    <View key={i} style={[styles.carouselDot, trainingCarouselIdx === i && styles.carouselDotActive]} />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── Fixtures header + week navigator ── */}
          <View style={styles.section}>
            <View style={styles.fixturesHeader}>
              <View>
                <Text style={styles.sectionLabel}>YOUR FIXTURES</Text>
                <Text style={styles.sectionTitle}>Set Availability</Text>
              </View>
            </View>

            {/* Week navigator */}
            <View style={styles.weekNav}>
              <TouchableOpacity
                onPress={() => {
                  // Save current scroll Y before week changes so we can restore after fetch
                  setWeekOffset(w => w - 1)
                }}
                style={styles.weekNavArrowBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.weekNavArrowText}>‹</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setWeekOffset(0)}
                style={[
                  styles.weekNavPill,
                  weekOffset === 0 && styles.weekNavPillActive,
                ]}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.weekNavPillText,
                  weekOffset === 0 && { color: colors.gold, fontFamily: fonts.bold },
                ]}>
                  {getWeekLabel(weekOffset)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  // Save current scroll Y before week changes so we can restore after fetch
                  setWeekOffset(w => w + 1)
                }}
                style={styles.weekNavArrowBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.weekNavArrowText}>›</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Loading state */}
          {loading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.gold} size="large" />
              <Text style={styles.loadingText}>Loading your fixtures…</Text>
            </View>
          )}

          {/* Empty state */}
          {!loading && fixtures.length === 0 && (
            <View style={styles.emptyCard}>
              <AppIcon name="cricketBat" size={36} tint={colors.textMuted} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>NO FIXTURES YET</Text>
              <Text style={styles.emptyText}>
                You haven't been added to any teams yet, or no fixtures are scheduled for this weekend.
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate(SCREENS.TEAMS)}
                style={styles.emptyBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyBtnText}>View My Teams</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && (
            <>
              {/* ── Saturday section — only rendered if fixtures exist ── */}
              {satFixtures.length > 0 && (
                <View style={styles.daySection}>
                  <View style={styles.daySectionHeader}>
                    <View style={styles.datePill}>
                      <Text style={styles.datePillText}>
                        {formatDateLong(satDate).toUpperCase()}
                      </Text>
                      {weekOffset === 0 && (
                        <View style={styles.thisWeekendBadge}>
                          <Text style={styles.thisWeekendText}>THIS WEEKEND</Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.daySectionLine, { backgroundColor: 'rgba(245,197,24,0.2)' }]} />
                    <Text style={styles.fixtureCountText}>
                      {satFixtures.length} fixture{satFixtures.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <FlatList
                    data={satFixtures}
                    keyExtractor={f => f.id}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={e => {
                      const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - spacing.md * 2))
                      setSatCarouselIdx(Math.max(0, Math.min(idx, satFixtures.length - 1)))
                    }}
                    renderItem={({ item: fixture }) => (
                      <View style={{ width: SCREEN_W - spacing.md * 2 }}>
                        <FixtureCard
                          fixture={fixture}
                          myStatus={availability[fixture.id] || null}
                          submitting={submitting}
                          onSetStatus={setStatus}
                          onViewDetail={(id) => navigation.navigate(SCREENS.FIXTURE_DETAIL, { fixtureId: id })}
                          isSunday={false}
                        />
                      </View>
                    )}
                  />
                  {satFixtures.length > 1 && (
                    <View style={styles.carouselDots}>
                      {satFixtures.map((_, i) => (
                        <View key={i} style={[styles.carouselDot, satCarouselIdx === i && styles.carouselDotActive]} />
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* ── Sunday section — only rendered if fixtures exist ── */}
              {sunFixtures.length > 0 && (
                <View style={styles.daySection}>
                  <View style={styles.daySectionHeader}>
                    <View style={[styles.datePill, styles.datePillSun]}>
                      <Text style={[styles.datePillText, { color: SUNDAY_BLUE }]}>
                        {formatDateLong(sunDate).toUpperCase()}
                      </Text>
                      {weekOffset === 0 && (
                        <View style={styles.thisWeekendBadge}>
                          <Text style={styles.thisWeekendText}>THIS WEEKEND</Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.daySectionLine, { backgroundColor: `${teamColor('Sunday XI')}30` }]} />
                    <Text style={styles.fixtureCountText}>
                      {sunFixtures.length} fixture{sunFixtures.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <FlatList
                    data={sunFixtures}
                    keyExtractor={f => f.id}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={e => {
                      const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - spacing.md * 2))
                      setSunCarouselIdx(Math.max(0, Math.min(idx, sunFixtures.length - 1)))
                    }}
                    renderItem={({ item: fixture }) => (
                      <View style={{ width: SCREEN_W - spacing.md * 2 }}>
                        <FixtureCard
                          fixture={fixture}
                          myStatus={availability[fixture.id] || null}
                          submitting={submitting}
                          onSetStatus={setStatus}
                          onViewDetail={(id) => navigation.navigate(SCREENS.FIXTURE_DETAIL, { fixtureId: id })}
                          isSunday={true}
                        />
                      </View>
                    )}
                  />
                  {sunFixtures.length > 1 && (
                    <View style={styles.carouselDots}>
                      {sunFixtures.map((_, i) => (
                        <View key={i} style={[styles.carouselDot, sunCarouselIdx === i && styles.carouselDotActive]} />
                      ))}
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {/* ── Announcements — shown after weekend fixtures ── */}
          {!loading && announcements.length > 0 && (
            <View style={[styles.section, { marginTop: spacing.sm }]}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionLabel}>CLUB NEWS</Text>
                  <Text style={styles.sectionTitle}>ANNOUNCEMENTS</Text>
                </View>
                {announcements.length > 1 && (
                  <Text style={styles.swipeHint}>Swipe for more ›</Text>
                )}
              </View>
              <FlatList
                data={announcements}
                keyExtractor={ann => ann.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={e => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - spacing.md * 2))
                  setAnnCarouselIdx(Math.max(0, Math.min(idx, announcements.length - 1)))
                }}
                renderItem={({ item: ann }) => (
                  <View style={{ width: SCREEN_W - spacing.md * 2 }}>
                    <AnnouncementCard ann={ann} />
                  </View>
                )}
              />
              {announcements.length > 1 && (
                <View style={styles.carouselDots}>
                  {announcements.map((_, i) => (
                    <View key={i} style={[styles.carouselDot, annCarouselIdx === i && styles.carouselDotActive]} />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── Join a Team section ── */}
          {!loading && teamsToShow.length > 0 && (
            <View style={[styles.section, { marginTop: spacing.xl }]}>
              <Text style={styles.sectionLabel}>CLUB TEAMS</Text>
              <Text style={styles.sectionTitle}>Join a Team</Text>
              <Text style={styles.sectionSub}>
                Request to join a squad — your captain or admin will approve it.
              </Text>

              {joinRequests.length > 0 && (
                <View style={styles.pendingBanner}>
                  <Text style={styles.pendingBannerText}>
                    You have {joinRequests.length} pending join request{joinRequests.length > 1 ? 's' : ''}
                  </Text>
                </View>
              )}

              {/* 2×2 grid for Saturday + Sunday below */}
              <View style={styles.joinGrid}>
                {teamsToShow.map(team => (
                  <JoinTeamCard
                    key={team.id}
                    team={team}
                    isPending={pendingIds.has(team.id)}
                    isLoading={joinLoading === team.id}
                    onJoin={() => handleJoinRequest(team)}
                    onCancel={() => handleCancelJoin(team)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Bottom padding */}
          <View style={{ height: 32 }} />

        </Animated.View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  scroll:    { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.md },

  // ── Greeting ─────────────────────────────────────────────────────────────
  greetingSection: { paddingTop: spacing.lg, marginBottom: spacing.lg },
  greetingLine: { fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  greetingName: { fontFamily: fonts.display, fontSize: 36, letterSpacing: 2, color: colors.gold, lineHeight: 40, marginBottom: 8 },
  greetingSub:  { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, lineHeight: 20 },

  // ── Stats grid ────────────────────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 12, marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: colors.navyLight,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
    borderTopWidth: 3,
  },
  statValue: { fontFamily: fonts.display, fontSize: 36, letterSpacing: 1, lineHeight: 40 },
  statLabel: { fontFamily: fonts.body, fontWeight: '600', fontSize: 13, color: colors.white, marginTop: 4 },
  statSub:   { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },

  // ── Section ───────────────────────────────────────────────────────────────
  section:      { marginBottom: spacing.lg },
  sectionLabel: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 2, color: colors.gold, textTransform: 'uppercase', marginBottom: 4 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 1, color: colors.white, marginBottom: 4, textTransform: 'uppercase' },
  sectionSub:   { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },

  latestResultCard: {
    backgroundColor: colors.navyLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6,
  },
  latestResultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Team badge — colour driven inline via teamColor()
  latestResultTeamBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  latestResultTeamText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  latestResultMatch: {
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 0.3,
    color: colors.white,
    flex: 1,
  },
  latestResultBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    flexShrink: 0,
  },
  latestResultBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
  },
  // Date + match type on same row
  latestResultMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  latestResultMeta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
  },
  // Match type badge — always caps
  latestResultTypeBadge: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  latestResultTypeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.textMuted,
  },
  latestResultPotm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    backgroundColor: 'rgba(245,197,24,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.2)',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  latestResultPotmName: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.white,
    flex: 1,
  },
  latestResultPotmPts: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.gold,
  },
  latestResultViewMore: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'right',
  },

  // ── Announcements ─────────────────────────────────────────────────────────
  announcementCard: {
    backgroundColor: colors.navyLight,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: 16, marginTop: 10,
  },
  announcementDate:  { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  announcementTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.white, marginBottom: 6, textTransform: 'uppercase' },
  announcementBody:  { fontFamily: fonts.body, fontSize: 13, color: colors.textLight, lineHeight: 20 },

  // ── Fixtures section header ───────────────────────────────────────────────
  fixturesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.md },

  // ── Week navigator ────────────────────────────────────────────────────────
  weekNav: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: spacing.lg,
  },
  weekNavArrowBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center', justifyContent: 'center',
  },
  weekNavArrowText: { fontFamily: fonts.bold, fontSize: 26, color: colors.textMuted, lineHeight: 30 },

  // ── Section header row (title + swipe hint) ───────────────────────────────
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', marginBottom: spacing.sm,
  },
  swipeHint: { fontFamily: fonts.bold, fontSize: 11, color: colors.gold, opacity: 0.7, marginBottom: 6 },
  weekNavPill: {
    flex: 1, paddingVertical: 9,
    borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
  },
  weekNavPillActive: {
    borderColor: 'rgba(245,197,24,0.3)',
    backgroundColor: 'rgba(245,197,24,0.06)',
  },
  weekNavPillText: {
    fontFamily: fonts.body, fontWeight: '700',
    fontSize: 13, color: colors.textMuted,
  },

  // ── Day section ───────────────────────────────────────────────────────────
  daySection: { marginBottom: spacing.xl },
  daySectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 12,
  },
  datePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(245,197,24,0.08)',
    borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)',
    borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  datePillSun: {
    backgroundColor: `${SUNDAY_BLUE}12`,
    borderColor: `${SUNDAY_BLUE}30`,
  },
  datePillText: {
    fontFamily: fonts.display, fontSize: 13,
    letterSpacing: 2, color: colors.gold,
  },
  thisWeekendBadge: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
    borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2,
  },
  thisWeekendText: { fontFamily: fonts.body, fontSize: 9, fontWeight: '700', color: colors.green, letterSpacing: 1 },
  daySectionLine:  { flex: 1, height: 1 },
  fixtureCountText:{ fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, whiteSpace: 'nowrap' },

  // ── Fixture card ──────────────────────────────────────────────────────────
  fixtureCard: {
    backgroundColor: colors.navyLight,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: 14,
    ...shadow.card,
  },
  fixtureCardTopBorder: { height: 3, width: '100%' },
  fixtureCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 14,
    borderBottomWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  fixtureCardHeaderLeft: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  fixtureCardBody:   { padding: 16 },
  fixtureCardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  badge: {
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1 },
  matchTypeText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  fixtureTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.white, marginBottom: 12, letterSpacing: 0.3 },
  vsText: { fontFamily: fonts.display, fontSize: 17, letterSpacing: 2 },
  fixtureMetaRow: { flexDirection: 'row', gap: 16, marginBottom: 6 },
  fixtureMeta:   { fontFamily: fonts.bold, fontSize: 13, color: colors.white, letterSpacing: 0.3 },
  fixtureVenue:  { fontFamily: fonts.bold, fontSize: 13, color: colors.textLight, marginBottom: 16 },

  // ── Availability bar ──────────────────────────────────────────────────────
  availBar:      { marginBottom: 14 },
  availBarTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, flexDirection: 'row', overflow: 'hidden', marginBottom: 8 },
  availBarFill:  { height: '100%', borderRadius: 3 },

  // ── Availability buttons ──────────────────────────────────────────────────
  availButtons: { flexDirection: 'row', gap: 8 },
  availBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 11,
    borderRadius: radius.md, borderWidth: 2,
  },
  availDot:     { width: 8, height: 8, borderRadius: 4 },
  availBtnText: { fontSize: 12, letterSpacing: 0.3 },
  statusConfirm:{ fontFamily: fonts.body, fontWeight: '600', fontSize: 12, textAlign: 'center', marginTop: 10 },
  viewDetailsText: { fontFamily: fonts.body, fontWeight: '600', fontSize: 13 },
  deadlineBadge: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4,
  },
  deadlineText: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },

  // ── Empty / loading ───────────────────────────────────────────────────────
  loadingWrap:  { alignItems: 'center', padding: spacing.xxl, gap: 16 },
  loadingText:  { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  emptyCard:    { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.lg },
  emptyIcon:    { fontSize: 48, marginBottom: spacing.md },
  emptyTitle:   { fontFamily: fonts.display, fontSize: 22, letterSpacing: 1, color: colors.white, marginBottom: 8 },
  emptyText:    { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: spacing.lg },
  emptyBtn:     { backgroundColor: colors.gold, paddingHorizontal: 28, paddingVertical: 12, borderRadius: radius.md },
  emptyBtnText: { fontFamily: fonts.body, fontWeight: '700', fontSize: 14, color: colors.navy },
  noFixtureCard: { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginBottom: 8 },
  noFixtureText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  carouselDots:      { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10, marginBottom: 4 },
  carouselDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  carouselDotActive: { width: 20, height: 6, borderRadius: 3, backgroundColor: colors.gold },
  // ── Training ────────────────────────────────────────────────────────────
  trainingSection:    { marginBottom: spacing.xl },
  trainingCard:       { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)', borderRadius: radius.md, padding: spacing.md, marginBottom: 10 },
  trainingCardTop:    { flexDirection: 'row', gap: 14, marginBottom: spacing.md },
  trainingDateBlock:  { alignItems: 'center', paddingRight: 14, borderRightWidth: 1, borderRightColor: colors.border, minWidth: 44 },
  trainingDateNum:    { fontFamily: fonts.display, fontSize: 26, color: '#60A5FA', lineHeight: 28 },
  trainingDateDow:    { fontFamily: fonts.bold, fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  trainingMetaRow:    { flexDirection: 'row', gap: 12, marginBottom: 2 },
  trainingInfo:       { flex: 1 },
  trainingTitle:      { fontFamily: fonts.bold, fontSize: 15, color: colors.white, marginBottom: 4, textTransform: 'uppercase' },
  trainingMeta:       { fontFamily: fonts.bold, fontSize: 12, color: colors.textLight, marginBottom: 2 },
  trainingAvailRow:   { flexDirection: 'row', gap: 8, marginBottom: 8 },
  trainingAvailBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  trainingAvailDot:   { width: 8, height: 8, borderRadius: 4 },
  trainingAvailText:  { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  trainingStatusText: { fontFamily: fonts.bold, fontSize: 12, textAlign: 'center' },

  // ── Join a team ───────────────────────────────────────────────────────────
  pendingBanner: {
    backgroundColor: 'rgba(245,197,24,0.06)',
    borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)',
    borderRadius: radius.md, padding: 12, marginBottom: 14,
  },
  pendingBannerText: { fontFamily: fonts.body, fontSize: 13, color: colors.gold },
  joinGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  joinCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: colors.navyLight,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: 18,
    alignItems: 'center',
  },
  joinCardPending: { borderColor: 'rgba(245,197,24,0.25)', backgroundColor: 'rgba(245,197,24,0.02)' },
  joinCrestRing: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.navy,
    borderWidth: 2, borderColor: colors.gold,
    overflow: 'hidden',
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    marginBottom: 12,
  },
  joinTeamName: { fontFamily: fonts.display, fontSize: 15, letterSpacing: 1, color: colors.white, textAlign: 'center', marginBottom: 4 },
  joinDayType:  { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginBottom: 14, textTransform: 'capitalize' },
  pendingBtn: {
    width: '100%', paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: 'rgba(245,197,24,0.08)',
    borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)',
    alignItems: 'center',
  },
  pendingBtnText: { fontFamily: fonts.body, fontWeight: '700', fontSize: 12, color: colors.gold },
  joinBtn: {
    width: '100%', paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  joinBtnText: { fontFamily: fonts.body, fontWeight: '600', fontSize: 12, color: colors.textMuted },
})
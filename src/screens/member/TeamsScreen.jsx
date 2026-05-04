// pavilion-app/src/screens/member/TeamsScreen.jsx
// Mirrors pavilion-web/src/pages/member/TeamsPage.jsx
// My teams with fixture carousel per team + join section

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, FlatList, Dimensions, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../../lib/supabase'
import useAuthStore from '../../store/authStore'
import TopHeader from '../../components/layout/TopHeader'
import ConfirmModal from '../../components/ConfirmModal'
import { SCREENS, AVAILABILITY_CONFIG, MATCH_TYPE_LABELS } from '../../lib/constants'
import { colors, fonts, spacing, radius, shadow } from '../../theme'
import AppIcon from '../../components/AppIcon'

const SCREEN_W = Dimensions.get('window').width

// ─── Configurable: canonical team order ───────────────────────────────────────
const TEAM_ORDER = ['1st XI', '2nd XI', '3rd XI', '4th XI', 'Sunday XI']

// ─── toLocalISO — always use this, never .toISOString().split('T')[0] ─────────
// .toISOString() returns UTC — in BST (UTC+1) this shifts dates back by 1 day
function toLocalISO(d) {
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function sortTeams(teams) {
  return [...teams].sort((a, b) => {
    const getIdx = (name) => {
      const i = TEAM_ORDER.findIndex(t => name === t || name.includes(t.split(' ')[0]))
      return i === -1 ? 999 : i
    }
    return getIdx(a.name) - getIdx(b.name)
  })
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d.getDate()} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

function formatTime(t) {
  if (!t) return '12:30'
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
}

// ─── Fixture carousel card ─────────────────────────────────────────────────
function FixtureCarouselCard({ fixture, myStatus, onSetStatus, onViewDetail, isMember }) {
  return (
    <View style={styles.carouselCard}>
      {/* Header badges */}
      <View style={styles.carouselCardHeader}>
        <Text style={styles.carouselDate}>{formatDateShort(fixture.match_date).toUpperCase()}</Text>
        {(() => {
          const hwCfg = fixture.home_away === 'home'
            ? { icon: 'homeFixture', label: 'HOME',    color: colors.green, bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)' }
            : fixture.home_away === 'away'
            ? { icon: 'awayFixture', label: 'AWAY',    color: '#60A5FA',    bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.3)' }
            : { icon: 'neutral',     label: 'NEUTRAL', color: colors.textMuted, bg: 'rgba(255,255,255,0.04)', border: colors.border }
          return (
            <View style={[styles.hwBadge, { backgroundColor: hwCfg.bg, borderColor: hwCfg.border, flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
              <AppIcon name={hwCfg.icon} size={10} tint={hwCfg.color} />
              <Text style={[styles.hwBadgeText, { color: hwCfg.color }]}>{hwCfg.label}</Text>
            </View>
          )
        })()}
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{MATCH_TYPE_LABELS[fixture.match_type] || fixture.match_type}</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.carouselTitle}>
        HTCC <Text style={styles.vsText}>VS</Text> {fixture.opponent?.toUpperCase()}
      </Text>

      {/* Meta */}
      <View style={styles.carouselMeta}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <AppIcon name="time" size={11} tint={colors.textLight} />
          <Text style={styles.carouselMetaText}>{formatTime(fixture.match_time)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <AppIcon name="venue" size={11} tint={colors.textLight} />
          <Text style={styles.carouselMetaText}>{fixture.venue}</Text>
        </View>
      </View>

      {/* Availability buttons — only for own team members */}
      {isMember ? (
        <View style={styles.carouselAvailRow}>
          {['available', 'unavailable', 'tentative'].map(status => {
            const cfg      = AVAILABILITY_CONFIG[status]
            const isActive = myStatus === status
            return (
              <TouchableOpacity
                key={status}
                onPress={() => onSetStatus(fixture.id, status)}
                activeOpacity={0.75}
                style={[styles.carouselAvailBtn, {
                  borderColor: isActive ? cfg.color : colors.border,
                  backgroundColor: isActive ? cfg.fillColor : 'transparent',
                }]}
              >
                <View style={[styles.carouselAvailDot, { backgroundColor: isActive ? cfg.color : colors.textMuted }]} />
                <Text style={[styles.carouselAvailText, { fontFamily: isActive ? fonts.bold : fonts.body, color: isActive ? cfg.color : colors.textMuted }]}>
                  {cfg.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      ) : (
        <View style={styles.viewOnlyRow}>
          <AppIcon name="stats" size={11} tint={colors.textMuted} />
          <Text style={styles.viewOnlyText}>View only — join to set availability</Text>
        </View>
      )}

      {/* View detail link — members only */}
      {isMember && (
        <TouchableOpacity onPress={() => onViewDetail(fixture.id)} activeOpacity={0.7} style={styles.carouselViewDetail}>
          <Text style={styles.carouselViewDetailText}>View Details →</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default function TeamsScreen({ navigation }) {
  const { profile } = useAuthStore()

  const [myTeams,      setMyTeams]      = useState([])
  const [allTeams,     setAllTeams]     = useState([])
  const [fixtures,     setFixtures]     = useState([])
  const [availability, setAvailability] = useState({})
  const [joinRequests, setJoinRequests] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [carouselIdx,  setCarouselIdx]  = useState({})
  const [joinModal,    setJoinModal]    = useState({ open: false, team: null })

  const fadeAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start()
  }, [])

  useEffect(() => { if (profile?.id) loadAll() }, [profile?.id])

  // ── Re-fetch on focus — syncs join requests + membership from other screens ─
  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        fetchJoinRequests()
        fetchMyTeams()
        fetchAllTeams()
        fetchFixturesAndAvailability()
      }
    }, [profile?.id])
  )

  const loadAll = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchMyTeams(), fetchAllTeams(), fetchJoinRequests(), fetchFixturesAndAvailability()])
    } finally {
      setLoading(false)
    }
  }

  const fetchMyTeams = async () => {
    const { data } = await supabase
      .from('team_members')
      .select('teams(id, name, day_type, captain_id)')
      .eq('player_id', profile.id)
      .eq('status', 'active')
    if (data) {
      const teams = sortTeams(data.map(t => t.teams).filter(Boolean))
      setMyTeams(teams)
    }
  }

  const fetchFixturesAndAvailability = async () => {
    // toLocalISO — never .toISOString().split('T')[0] (BST shifts date back 1 day)
    const today = toLocalISO(new Date())
    // Fetch ALL teams' upcoming fixtures — gating is done in renderItem via isMember
    const { data: fixtureData } = await supabase
      .from('fixtures')
      .select('*, teams(id, name)')
      .gte('match_date', today)
      .order('match_date', { ascending: true })
      .limit(80)

    if (fixtureData) {
      setFixtures(fixtureData)
      const ids = fixtureData.map(f => f.id)
      if (ids.length > 0) {
        const { data: availData } = await supabase
          .from('availability')
          .select('fixture_id, status')
          .eq('player_id', profile.id)
          .in('fixture_id', ids)
        if (availData) {
          const map = {}
          availData.forEach(a => { map[a.fixture_id] = a.status })
          setAvailability(map)
        }
      }
    }
  }

  const fetchAllTeams = async () => {
    const { data } = await supabase.from('teams').select('id, name, day_type').order('name')
    if (data) setAllTeams(sortTeams(data))
  }

  const fetchJoinRequests = async () => {
    const { data } = await supabase
      .from('join_requests')
      .select('id, team_id, status')
      .eq('player_id', profile.id)
      .eq('status', 'pending')
    if (data) setJoinRequests(data)
  }

  // ── Availability toggle ────────────────────────────────────────────────────
  const setStatus = async (fixtureId, status) => {
    try {
      const existing = availability[fixtureId]
      if (existing === status) {
        await supabase.from('availability').delete()
          .eq('fixture_id', fixtureId).eq('player_id', profile.id)
        setAvailability(prev => { const next = { ...prev }; delete next[fixtureId]; return next })
      } else if (existing) {
        await supabase.from('availability').update({ status })
          .eq('fixture_id', fixtureId).eq('player_id', profile.id)
        setAvailability(prev => ({ ...prev, [fixtureId]: status }))
      } else {
        await supabase.from('availability').insert({ fixture_id: fixtureId, player_id: profile.id, status })
        setAvailability(prev => ({ ...prev, [fixtureId]: status }))
      }
    } catch (err) { console.error('setStatus error:', err.message) }
  }

  const handleJoinRequest = async () => {
    const team = joinModal.team
    setJoinModal({ open: false, team: null })
    try {
      await supabase.from('join_requests').insert({ player_id: profile.id, team_id: team.id })
      await fetchJoinRequests()

      // ── Notify all admins of the new join request ─────────────────────────
      const { sendPushToRole, insertNotificationsForRole } = await import('../../lib/pushNotifications')
      const notifTitle = 'New Team Join Request'
      const notifBody  = `${profile.full_name} has requested to join ${team.name}.`
      sendPushToRole('admin', notifTitle, notifBody, { type: 'approval' })
      insertNotificationsForRole('admin', 'approval', notifTitle, notifBody)
    } catch (err) { console.error('join request error:', err.message) }
  }

  const handleCancelJoin = async (teamId) => {
    try {
      await supabase.from('join_requests').delete()
        .eq('player_id', profile.id).eq('team_id', teamId).eq('status', 'pending')
      await fetchJoinRequests()
    } catch (err) { console.error('cancel join error:', err.message) }
  }

  // ── Derived values — memoised to avoid recomputing per-team on every render ──
  // Sets for O(1) membership lookup instead of .some() called for each team row
  const myTeamIds     = useMemo(() => new Set(myTeams.map(t => t.id)),          [myTeams])
  const pendingTeamIds= useMemo(() => new Set(joinRequests.map(r => r.team_id)),[joinRequests])

  // Pre-group fixtures by team_id so each team card does a single lookup, not a filter
  const fixturesByTeam = useMemo(() => {
    const map = {}
    fixtures.forEach(f => {
      if (!map[f.team_id]) map[f.team_id] = []
      map[f.team_id].push(f)
    })
    // Cap at 8 upcoming fixtures per team — shows full near-term schedule
    // without overwhelming the carousel. Remaining fixtures visible in Fixtures tab.
    Object.keys(map).forEach(id => { map[id] = map[id].slice(0, 8) })
    return map
  }, [fixtures])

  // satTeams / sunTeams removed — all teams now rendered in unified list

  return (
    <View style={styles.container}>
      <TopHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.sectionLabel}>MY CLUB</Text>
            <Text style={styles.pageTitle}>MY TEAMS</Text>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.loadingText}>Loading…</Text>
            </View>
          ) : (
            <>
              {/* ── Not-in-any-teams banner ── */}
              {myTeams.length === 0 && (
                <View style={styles.notInTeamsBanner}>
                  <AppIcon name="cricketBat" size={18} tint={colors.textMuted} />
                  <Text style={styles.notInTeamsBannerText}>
                    Not in any teams yet — request to join below.
                  </Text>
                </View>
              )}

              {/* ── Pending requests banner ── */}
              {joinRequests.length > 0 && (
                <View style={styles.pendingBanner}>
                  <Text style={styles.pendingBannerText}>
                    {joinRequests.length} pending join request{joinRequests.length > 1 ? 's' : ''}
                  </Text>
                </View>
              )}

              {/* ── All teams — unified list ── */}
              {allTeams.map(team => {
                const isMember  = myTeamIds.has(team.id)
                const isPending = pendingTeamIds.has(team.id)
                const tFixtures = fixturesByTeam[team.id] || []
                const currentIdx = carouselIdx[team.id] || 0

                return (
                  <View key={team.id} style={styles.teamCard}>
                    {/* Top accent border — gold for members, subtle for others */}
                    <View style={[styles.teamCardTopBorder, !isMember && { backgroundColor: 'rgba(255,255,255,0.07)' }]} />

                    {/* Team header */}
                    <View style={styles.teamCardHeader}>
                      <View style={styles.teamCardHeaderLeft}>
                        <View style={[styles.teamCrestRing, !isMember && { borderColor: colors.border }]}>
                          <Image
                            source={require('../../../assets/htcc-logo.png')}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                          />
                        </View>
                        <View>
                          <Text style={[styles.teamName, !isMember && { color: colors.white }]}>
                            {team.name.toUpperCase()}
                          </Text>
                          <Text style={styles.teamDayType}>{team.day_type} fixture team</Text>
                        </View>
                      </View>

                      {/* Membership badge / action */}
                      {isMember ? (
                        <View style={styles.memberBadge}>
                          <Text style={styles.memberBadgeText}>✓ MEMBER</Text>
                        </View>
                      ) : isPending ? (
                        <TouchableOpacity
                          onPress={() => handleCancelJoin(team.id)}
                          activeOpacity={0.75}
                          style={styles.pendingBtnSm}
                        >
                          <Text style={styles.pendingBtnText}>Requested</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => setJoinModal({ open: true, team })}
                          activeOpacity={0.75}
                          style={styles.joinBtnSm}
                        >
                          <Text style={styles.joinBtnText}>+ Join</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Fixtures carousel */}
                    <View style={styles.carouselSection}>
                      <Text style={styles.upcomingLabel}>UPCOMING FIXTURES</Text>

                      {tFixtures.length === 0 ? (
                        <Text style={styles.noFixturesText}>No upcoming fixtures for this team.</Text>
                      ) : (
                        <>
                          <FlatList
                            data={tFixtures}
                            keyExtractor={f => f.id}
                            horizontal
                            snapToInterval={CARD_W + SNAP_GAP}
                            snapToAlignment="start"
                            decelerationRate="fast"
                            showsHorizontalScrollIndicator={false}
                            onMomentumScrollEnd={e => {
                              const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + SNAP_GAP))
                              setCarouselIdx(prev => ({ ...prev, [team.id]: Math.max(0, Math.min(idx, tFixtures.length - 1)) }))
                            }}
                            renderItem={({ item }) => (
                              <View style={{ width: CARD_W, marginRight: SNAP_GAP }}>
                                <FixtureCarouselCard
                                  fixture={item}
                                  myStatus={availability[item.id] || null}
                                  onSetStatus={setStatus}
                                  onViewDetail={(id) => navigation.navigate(SCREENS.FIXTURE_DETAIL, { fixtureId: id })}
                                  isMember={isMember}
                                />
                              </View>
                            )}
                          />

                          {/* Carousel dots + arrows */}
                          {tFixtures.length > 1 && (
                            <View style={styles.dotsRow}>
                              <TouchableOpacity
                                onPress={() => {
                                  const newIdx = Math.max(0, currentIdx - 1)
                                  setCarouselIdx(prev => ({ ...prev, [team.id]: newIdx }))
                                }}
                                style={styles.carouselArrow}
                                disabled={currentIdx === 0}
                              >
                                <Text style={[styles.carouselArrowText, currentIdx === 0 && { opacity: 0.3 }]}>‹</Text>
                              </TouchableOpacity>

                              {tFixtures.map((_, i) => (
                                <View key={i} style={[styles.dot, currentIdx === i && styles.dotActive]} />
                              ))}

                              <TouchableOpacity
                                onPress={() => {
                                  const newIdx = Math.min(tFixtures.length - 1, currentIdx + 1)
                                  setCarouselIdx(prev => ({ ...prev, [team.id]: newIdx }))
                                }}
                                style={styles.carouselArrow}
                                disabled={currentIdx === tFixtures.length - 1}
                              >
                                <Text style={[styles.carouselArrowText, currentIdx === tFixtures.length - 1 && { opacity: 0.3 }]}>›</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                )
              })}

              <View style={{ height: 32 }} />
            </>
          )}
        </Animated.View>
      </ScrollView>

      <ConfirmModal
        visible={joinModal.open}
        title="Request to Join"
        message={`Send a join request to ${joinModal.team?.name}? Your captain or admin will review it.`}
        confirmText="Send Request"
        cancelText="Cancel"
        danger={false}
        onConfirm={handleJoinRequest}
        onCancel={() => setJoinModal({ open: false, team: null })}
      />
    </View>
  )
}

const CARD_W   = SCREEN_W - spacing.md * 2 - 36  // card width — accounts for outer padding
const SNAP_GAP = 12                                // gap between cards

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.navy },
  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: spacing.md },
  header:       { paddingTop: spacing.lg, marginBottom: spacing.lg },
  sectionLabel: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 2, color: colors.gold, textTransform: 'uppercase', marginBottom: 4 },
  pageTitle:    { fontFamily: fonts.display, fontSize: 36, letterSpacing: 2, color: colors.white, lineHeight: 40 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 24, letterSpacing: 1, color: colors.white, marginBottom: 4 },
  sectionSub:   { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  loadingWrap:  { alignItems: 'center', padding: spacing.xxl },
  loadingText:  { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  emptyCard:    { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.lg },
  emptyIcon:    { fontSize: 40, marginBottom: 12 },
  emptyTitle:   { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1, color: colors.white, marginBottom: 8 },
  emptyText:    { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // ── Team card ─────────────────────────────────────────────────────────────
  teamCard:           { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.lg, ...shadow.card },
  teamCardTopBorder:  { height: 3, backgroundColor: 'rgba(245,197,24,0.5)' },
  teamCardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(245,197,24,0.15)', backgroundColor: 'rgba(245,197,24,0.03)' },
  teamCardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  teamCrestRing:      { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.navy, borderWidth: 2, borderColor: colors.gold, overflow: 'hidden', shadowColor: colors.gold, shadowOffset:{width:0,height:0}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  teamName:           { fontFamily: fonts.display, fontSize: 22, letterSpacing: 2, color: colors.gold },
  teamDayType:        { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  memberBadge:        { backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)', borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  memberBadgeText:    { fontFamily: fonts.bold, fontSize: 11, color: colors.green, letterSpacing: 1 },

  // ── Carousel ──────────────────────────────────────────────────────────────
  carouselSection:  { padding: 18 },
  upcomingLabel:    { fontFamily: fonts.body, fontWeight: '700', fontSize: 11, letterSpacing: 1.5, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 12 },
  noFixturesText:   { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, paddingVertical: 8 },
  carouselCard:     { backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16, marginRight: 12 },
  carouselCardHeader: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 },
  carouselDate:     { fontFamily: fonts.bold, fontSize: 13, color: colors.white, letterSpacing: 0.5 },
  hwBadge:          { borderWidth: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 },
  hwBadgeText:      { fontFamily: fonts.bold, fontSize: 11 },
  typeBadge:        { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText:    { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  carouselTitle:    { fontFamily: fonts.bold, fontSize: 16, color: colors.white, marginBottom: 8, letterSpacing: 0.3 },
  vsText:           { fontFamily: fonts.display, color: colors.gold, fontSize: 17, letterSpacing: 1 },
  carouselMeta:     { flexDirection: 'column', gap: 5, marginBottom: 14 },
  carouselMetaText: { fontFamily: fonts.bold, fontSize: 13, color: colors.textLight },
  carouselAvailRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  carouselAvailBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: radius.md, borderWidth: 2 },
  carouselAvailDot: { width: 7, height: 7, borderRadius: 4 },
  carouselAvailText:{ fontSize: 11 },
  carouselViewDetail:    { alignItems: 'flex-end' },
  carouselViewDetailText:{ fontFamily: fonts.body, fontWeight: '600', fontSize: 12, color: colors.gold },

  dotsRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
  dot:             { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  dotActive:       { width: 18, height: 6, borderRadius: 3, backgroundColor: colors.gold },
  carouselArrow:   { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  carouselArrowText:{ fontFamily: fonts.body, fontSize: 16, color: colors.textMuted },

  // ── Join section ──────────────────────────────────────────────────────────
  joinSection:     { marginTop: spacing.xl, marginBottom: spacing.lg },
  pendingBanner:   { backgroundColor: 'rgba(245,197,24,0.06)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: radius.md, padding: 12, marginBottom: 14 },
  pendingBannerText:{ fontFamily: fonts.body, fontSize: 13, color: colors.gold },
  joinGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  joinCard:        { flex: 1, minWidth: '45%', backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 18, alignItems: 'center' },
  joinCardPending: { borderColor: 'rgba(245,197,24,0.25)' },
  joinCardWide:    { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  joinCardWideLeft:{ flexDirection: 'row', alignItems: 'center', gap: 12 },
  joinCrestRing:   { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.navy, borderWidth: 2, borderColor: colors.gold, overflow: 'hidden', marginBottom: 10 },
  joinTeamName:    { fontFamily: fonts.display, fontSize: 15, letterSpacing: 1, color: colors.white, textAlign: 'center', marginBottom: 4 },
  joinDayType:     { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginBottom: 12, textTransform: 'capitalize', textAlign: 'center' },
  memberTag:       { backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  memberTagText:   { fontFamily: fonts.bold, fontSize: 12, color: colors.green },
  pendingBtn:      { width: '100%', paddingVertical: 9, borderRadius: radius.md, backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)', alignItems: 'center' },
  pendingBtnSm:    { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md, backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)', alignItems: 'center' },
  pendingBtnText:  { fontFamily: fonts.bold, fontSize: 12, color: colors.gold },
  joinBtn:         { width: '100%', paddingVertical: 9, borderRadius: radius.md, backgroundColor: 'rgba(96,165,250,0.08)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)', alignItems: 'center' },
  joinBtnSm:       { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md, backgroundColor: 'rgba(96,165,250,0.08)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)', alignItems: 'center' },
  joinBtnText:     { fontFamily: fonts.bold, fontSize: 12, color: '#60A5FA' },

  // ── Not-in-any-teams banner ───────────────────────────────────────────────
  notInTeamsBanner:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, marginBottom: spacing.md },
  notInTeamsBannerText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, flex: 1 },

  // ── View-only row (non-member fixture carousel) ───────────────────────────
  viewOnlyRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, marginBottom: 10 },
  viewOnlyText: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
})
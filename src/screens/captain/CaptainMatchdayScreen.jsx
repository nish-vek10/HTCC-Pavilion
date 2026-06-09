// pavilion-app/src/screens/captain/CaptainMatchdayScreen.jsx
// Captain matchday view — availability overview for their team, date navigation,
// long-press 3s on player to override availability on their behalf

import React, { useState, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  StyleSheet, Alert, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { fetchPromptedPlayers, sendPromptNotification } from '../../lib/promptHelper'
import useAuthStore from '../../store/authStore'
import TopHeader from '../../components/layout/TopHeader'
import { colors, fonts, spacing, radius } from '../../theme'
import { SCREENS, toTitleCase } from '../../lib/constants'
import AppIcon from '../../components/AppIcon'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toLocalISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getNextMatchDate(dayOfWeek) {
  const today = new Date()
  const todayDay = today.getDay()
  let diff
  if (todayDay === dayOfWeek) {
    diff = 0                                   // today is match day
  } else if (todayDay === (dayOfWeek + 1) % 7) {
    diff = -1                                  // day after match — show yesterday's match
  } else {
    diff = (dayOfWeek - todayDay + 7) % 7     // upcoming match day
  }
  const d = new Date(today)
  d.setDate(today.getDate() + diff)
  return toLocalISO(d)
}

function getInitials(name) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

function formatAvailTS(ts) {
  if (!ts) return null
  try { return format(parseISO(ts), 'EEE dd MMM, HH:mm') } catch { return null }
}

const STATUS_DOT_COLOR = { available: colors.green, unavailable: colors.red, tentative: '#F97316' }

export default function CaptainMatchdayScreen({ navigation }) {
  const profile = useAuthStore(s => s.profile)

  const [myTeam,      setMyTeam]      = useState(null)
  const [fixture,     setFixture]     = useState(null)
  const [players,     setPlayers]     = useState([])
  const [squad,       setSquad]       = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [matchDate,   setMatchDate]   = useState(null)
  const [prompted,    setPrompted]    = useState({})

  // Re-prompt modal
  const [promptModal, setPromptModal] = useState({ open: false, playerId: null, playerName: '' })

  useFocusEffect(useCallback(() => { loadTeam() }, []))
  useFocusEffect(useCallback(() => { if (myTeam && matchDate) fetchMatchday() }, [myTeam, matchDate]))

  const loadTeam = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      // Fetch the team this captain is captain of (is_captain = true)
      const { data: tm } = await supabase
        .from('team_members')
        .select('teams(id, name, day_type)')
        .eq('player_id', profile.id)
        .eq('status', 'active')
        .eq('is_captain', true)
        .maybeSingle()

      // Fallback: if is_captain not set yet, take first active team
      const { data: fallback } = !tm
        ? await supabase.from('team_members')
            .select('teams(id, name, day_type)')
            .eq('player_id', profile.id).eq('status', 'active').limit(1).maybeSingle()
        : { data: null }

      const team = tm?.teams || fallback?.teams || null
      if (team) {
        setMyTeam(team)
        const dayOfWeek = team.name === 'Sunday XI' ? 0 : 6
        setMatchDate(getNextMatchDate(dayOfWeek))
      }
    } finally {
      if (!isRefresh) setLoading(false)
    }
  }

  const fetchMatchday = async (isRefresh = false) => {
    if (!myTeam || !matchDate) return
    if (isRefresh) setRefreshing(true)
    try {
      // Fixture for this team on this date
      const { data: fix } = await supabase
        .from('fixtures')
        .select('*, teams(id, name)')
        .eq('team_id', myTeam.id)
        .eq('match_date', matchDate)
        .maybeSingle()

      setFixture(fix || null)

      if (fix) {
        // Squad
        const { data: sq } = await supabase
          .from('squads')
          .select('id, published, squad_members(player_id, position_order)')
          .eq('fixture_id', fix.id)
          .maybeSingle()
        setSquad(sq || null)

        // Cross-team draft check — players published in another team's squad today
        const { data: sameDayFix } = await supabase
          .from('fixtures')
          .select('id, teams(name)')
          .eq('match_date', matchDate)
          .neq('id', fix.id)
        let crossTeamMap = {}
        if (sameDayFix?.length > 0) {
          const { data: otherSquads } = await supabase
            .from('squads')
            .select('fixture_id, squad_members(player_id)')
            .in('fixture_id', sameDayFix.map(f => f.id))
          const fidTeam = {}
          sameDayFix.forEach(f => { fidTeam[f.id] = f.teams?.name || 'Another Team' })
          otherSquads?.forEach(sq => {
            sq.squad_members?.forEach(sm => {
              if (!crossTeamMap[sm.player_id]) crossTeamMap[sm.player_id] = fidTeam[sq.fixture_id]
            })
          })
        }

        // Members + availability
        const [{ data: members }, { data: avail, error: availErr }] = await Promise.all([
          supabase.from('team_members')
            .select('player_id, profiles(id, full_name, avatar_color)')
            .eq('team_id', myTeam.id).eq('status', 'active'),
          supabase.from('availability')
            .select('player_id, status, updated_at, set_by_admin')
            .eq('fixture_id', fix.id),
        ])
        if (availErr) console.warn('[CaptainMatchday] avail fetch error:', availErr.message)

        const availMap = {}
        avail?.forEach(a => { availMap[a.player_id] = a })

        const posMap = {}
        sq?.squad_members?.forEach(sm => { posMap[sm.player_id] = sm.position_order })

        const list = (members || []).map(m => {
          const av       = availMap[m.player_id]
          const inSquad  = m.player_id in posMap
          const locked   = !inSquad && crossTeamMap[m.player_id] ? crossTeamMap[m.player_id] : null
          return {
            id:           m.player_id,
            name:         toTitleCase(m.profiles?.full_name) || 'Unknown',
            color:        m.profiles?.avatar_color || colors.gold,
            status:       av?.status || null,
            updatedAt:    av?.updated_at || null,
            setByAdmin:   av?.set_by_admin || false,
            inSquad,
            position:     posMap[m.player_id] || 999,
            lockedByTeam: locked,
          }
        }).sort((a, b) => {
          if (a.inSquad && b.inSquad) return a.position - b.position
          if (a.inSquad) return -1
          if (b.inSquad) return 1
          const grp = p => {
            if (p.status === 'available' && !p.lockedByTeam) return 0
            if (p.lockedByTeam)                               return 1
            if (p.status === 'tentative')                     return 2
            if (p.status === 'unavailable')                   return 3
            return 4
          }
          const ga = grp(a), gb = grp(b)
          if (ga !== gb) return ga - gb
          return a.name.localeCompare(b.name)
        })

        setPlayers(list)

        // Prompted state
        const pm = await fetchPromptedPlayers(fix.id)
        setPrompted(pm)
      } else {
        setPlayers([])
        setSquad(null)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const shiftDate = (dir) => {
    const d = new Date(matchDate + 'T12:00:00')
    d.setDate(d.getDate() + dir * 7)
    setMatchDate(toLocalISO(d))
  }

  // ── Prompt handlers ───────────────────────────────────────────────────────
  const handlePrompt = (playerId, playerName) => {
    if (!fixture) return
    const key = `${fixture.id}_${playerId}`
    if (prompted[key]) { setPromptModal({ open: true, playerId, playerName }); return }
    sendPrompt(playerId, playerName)
  }

  const sendPrompt = async (playerId, playerName) => {
    await sendPromptNotification(fixture.id, playerId, profile?.id)
    const fresh = await fetchPromptedPlayers(fixture.id)
    setPrompted(fresh)
    setPromptModal({ open: false, playerId: null, playerName: '' })
  }

  // ── Counts ────────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const avail   = players.filter(p => p.status === 'available').length
    const tent    = players.filter(p => p.status === 'tentative').length
    const unavail = players.filter(p => p.status === 'unavailable').length
    const noReply = players.filter(p => !p.status).length
    return { avail, tent, unavail, noReply, total: players.length }
  }, [players])

  const isPublished = squad?.published || false

  if (loading) return (
    <View style={styles.container}><TopHeader />
      <View style={styles.centred}><ActivityIndicator color={colors.gold} size="large" /></View>
    </View>
  )

  return (
    <View style={styles.container}>
      <TopHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { loadTeam(true); }} tintColor={colors.gold} />}
        showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <Text style={styles.sectionLabel}>CAPTAIN</Text>
          <Text style={styles.pageTitle}>MATCHDAY</Text>
          {myTeam && <Text style={styles.teamName}>{myTeam.name}</Text>}
        </View>

        {/* ── Date navigator ── */}
        {matchDate && (
          <View style={styles.dateNav}>
            <TouchableOpacity style={styles.dateNavArrowBtn} onPress={() => shiftDate(-1)} activeOpacity={0.7}>
              <Text style={styles.dateNavArrowText}>‹</Text>
            </TouchableOpacity>
            <View style={styles.datePill}>
              <Text style={styles.datePillText}>{format(parseISO(matchDate), 'EEE d MMM yyyy').toUpperCase()}</Text>
            </View>
            <TouchableOpacity style={styles.dateNavArrowBtn} onPress={() => shiftDate(1)} activeOpacity={0.7}>
              <Text style={styles.dateNavArrowText}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── No fixture ── */}
        {!myTeam ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>NO TEAM ASSIGNED</Text>
            <Text style={styles.emptyText}>Contact admin to be set as captain</Text>
          </View>
        ) : !fixture ? (
          <View style={styles.emptyCard}>
            <AppIcon name="fixtures" size={36} tint={colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>NO FIXTURE</Text>
            <Text style={styles.emptyText}>No {myTeam.name} fixture on this date</Text>
          </View>
        ) : (
          <>
            {/* ── Fixture card ── */}
            <View style={styles.fixtureCard}>
              <View style={styles.fixtureHeader}>
                <View>
                  <Text style={styles.fixtureTitle}>HTCC <Text style={styles.vsText}>vs</Text> {fixture.opponent?.toUpperCase()}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <AppIcon name="venue" size={11} tint={colors.textLight} />
                    <Text style={styles.fixtureMeta}>{fixture.venue}</Text>
                    <AppIcon name="time" size={11} tint={colors.textLight} />
                    <Text style={styles.fixtureMeta}>{fixture.match_time?.slice(0,5)}</Text>
                  </View>
                </View>
                <View style={[styles.statusPill, isPublished && styles.statusPillPublished]}>
                  <Text style={[styles.statusPillText, isPublished && styles.statusPillTextPublished]}>
                    {isPublished ? '✓ SQUAD OUT' : 'PENDING'}
                  </Text>
                </View>
              </View>

              {/* ── Availability counts ── */}
              <View style={styles.availRow}>
                {counts.avail   > 0 && <View style={styles.availItem}><View style={[styles.availDot,{backgroundColor:colors.green}]}/><Text style={[styles.availCount,{color:colors.green}]}>{counts.avail}</Text><Text style={styles.availLabel}>Available</Text></View>}
                {counts.tent    > 0 && <View style={styles.availItem}><View style={[styles.availDot,{backgroundColor:'#F97316'}]}/><Text style={[styles.availCount,{color:'#F97316'}]}>{counts.tent}</Text><Text style={styles.availLabel}>Tentative</Text></View>}
                {counts.unavail > 0 && <View style={styles.availItem}><View style={[styles.availDot,{backgroundColor:colors.red}]}/><Text style={[styles.availCount,{color:colors.red}]}>{counts.unavail}</Text><Text style={styles.availLabel}>Unavailable</Text></View>}
                {counts.noReply > 0 && <View style={styles.availItem}><View style={[styles.availDot,{backgroundColor:'rgba(255,255,255,0.18)'}]}/><Text style={[styles.availCount,{color:colors.textMuted}]}>{counts.noReply}</Text><Text style={styles.availLabel}>No reply</Text></View>}
              </View>

              {/* Progress bar */}
              {counts.total > 0 && (
                <View style={styles.progressBar}>
                  {counts.avail   > 0 && <View style={{width:`${(counts.avail/counts.total)*100}%`,   backgroundColor:colors.green, height:'100%'}}/>}
                  {counts.tent    > 0 && <View style={{width:`${(counts.tent/counts.total)*100}%`,    backgroundColor:'#F97316',    height:'100%'}}/>}
                  {counts.unavail > 0 && <View style={{width:`${(counts.unavail/counts.total)*100}%`, backgroundColor:colors.red,   height:'100%'}}/>}
                </View>
              )}
            </View>

            {/* ── Hint ── */}
            <Text style={styles.longPressHint}>Hold player 3s to set availability on their behalf</Text>

            {/* ── Player list ── */}
            <View style={styles.playerList}>
              {players.map((player, i) => (
                <TouchableOpacity
                  key={player.id}
                  style={[styles.playerRow, i < players.length - 1 && styles.playerRowBorder,
                    (player.status === 'unavailable' || player.lockedByTeam) && { opacity: 0.45 }]}
                  activeOpacity={0.9}
                >
                  {player.inSquad ? (
                    <View style={styles.squadNumBadge}>
                      <Text style={styles.squadNum}>{player.position}</Text>
                    </View>
                  ) : player.lockedByTeam ? (
                    <View style={styles.lockedBadge}>
                      <Text style={styles.lockedIcon}>⊘</Text>
                    </View>
                  ) : (
                    <View style={[styles.playerAvatar, { backgroundColor: player.color + '22', borderColor: player.color + '44' }]}>
                      <Text style={[styles.playerAvatarText, { color: player.color }]}>{getInitials(player.name)}</Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.playerName, player.inSquad && styles.playerNameSquad]} numberOfLines={1}>
                      {player.name}
                    </Text>
                    {player.lockedByTeam && (
                      <Text style={styles.lockedTeamLabel}>{player.lockedByTeam}</Text>
                    )}
                    {formatAvailTS(player.updatedAt) && (
                      <Text style={[styles.availTimestamp, player.setByAdmin && styles.availTimestampAdmin]}>
                        Last Updated: {formatAvailTS(player.updatedAt)}
                        {player.setByAdmin ? ' (set by admin)' : ''}
                      </Text>
                    )}
                  </View>

                  {player.inSquad && <Text style={styles.squadStar}>★</Text>}

                  {/* Prompt button — only for no-reply players */}
                  {!player.status && !player.lockedByTeam && (() => {
                    const key = `${fixture.id}_${player.id}`
                    const isPrompted = prompted[key]
                    return (
                      <TouchableOpacity
                        style={[styles.promptBtn, isPrompted && styles.promptBtnDone]}
                        onPress={() => handlePrompt(player.id, player.name)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.promptBtnText, isPrompted && styles.promptBtnTextDone]}>
                          {isPrompted ? 'Prompted' : 'Prompt'}
                        </Text>
                      </TouchableOpacity>
                    )
                  })()}

                  <View style={[styles.statusDot, {
                    backgroundColor: player.status ? STATUS_DOT_COLOR[player.status] : 'rgba(255,255,255,0.1)',
                    shadowColor:     player.status ? STATUS_DOT_COLOR[player.status] : 'transparent',
                    shadowOpacity:   player.status ? 0.7 : 0, shadowRadius: 4,
                  }]} />
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Squad button ── */}
            <TouchableOpacity style={styles.squadBtn}
              onPress={() => navigation.navigate(SCREENS.SQUAD_SELECTION, { fixtureId: fixture.id })}
              activeOpacity={0.8}>
              <Text style={styles.squadBtnText}>{isPublished ? 'View Squad' : 'Select Squad'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* ── Re-prompt confirmation modal ── */}
      <Modal visible={promptModal.open} transparent animationType="fade"
        onRequestClose={() => setPromptModal({ open: false, playerId: null, playerName: '' })}>
        <View style={styles.promptModalBackdrop}>
          <View style={styles.promptModalBox}>
            <Text style={styles.promptModalTitle}>Prompt Again?</Text>
            <Text style={styles.promptModalBody}>
              Send another reminder to <Text style={{ fontFamily: fonts.bold, color: colors.white }}>{promptModal.playerName}</Text>?
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.promptCancelBtn}
                onPress={() => setPromptModal({ open: false, playerId: null, playerName: '' })} activeOpacity={0.8}>
                <Text style={styles.promptCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.promptConfirmBtn}
                onPress={() => sendPrompt(promptModal.playerId, promptModal.playerName)} activeOpacity={0.8}>
                <Text style={styles.promptConfirmText}>Prompt Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.navy },
  scroll:           { flex: 1 },
  content:          { padding: spacing.md, paddingBottom: 60 },
  centred:          { flex: 1, justifyContent: 'center', alignItems: 'center' },

  pageHeader:       { marginBottom: spacing.lg },
  sectionLabel:     { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.green, marginBottom: 4 },
  pageTitle:        { fontFamily: fonts.display, fontSize: 36, letterSpacing: 2, color: colors.white, lineHeight: 40 },
  teamName:         { fontFamily: fonts.bold, fontSize: 13, color: colors.green, marginTop: 4 },

  dateNav:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.lg },
  dateNavArrowBtn:  { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,197,24,0.4)', backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center' },
  dateNavArrowText: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 30, color: colors.gold },
  datePill:         { flex: 1, borderWidth: 1, borderColor: 'rgba(245,197,24,0.5)', backgroundColor: 'rgba(245,197,24,0.12)', borderRadius: radius.md, paddingVertical: 9, alignItems: 'center' },
  datePillText:     { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.gold },

  emptyCard:        { backgroundColor: colors.navyLight, borderRadius: radius.md, padding: 48, alignItems: 'center' },
  emptyTitle:       { fontFamily: fonts.display, fontSize: 22, letterSpacing: 1, color: colors.white, marginBottom: 6 },
  emptyText:        { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  fixtureCard:      { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: spacing.md, overflow: 'hidden' },
  fixtureHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.md },
  fixtureTitle:     { fontFamily: fonts.bold, fontSize: 15, color: colors.white, marginBottom: 4 },
  vsText:           { color: colors.gold },
  fixtureMeta:      { fontFamily: fonts.bold, fontSize: 11, color: colors.textLight },
  statusPill:       { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  statusPillPublished: { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.25)' },
  statusPillText:   { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1, color: colors.textMuted },
  statusPillTextPublished: { color: colors.green },

  availRow:         { flexDirection: 'row', gap: 12, flexWrap: 'wrap', padding: spacing.sm, paddingHorizontal: spacing.md },
  availItem:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  availDot:         { width: 8, height: 8, borderRadius: 4 },
  availCount:       { fontFamily: fonts.bold, fontSize: 12 },
  availLabel:       { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  progressBar:      { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', overflow: 'hidden', marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: 2 },

  longPressHint:    { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm, opacity: 0.7 },

  playerList:       { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: spacing.md, overflow: 'hidden' },
  playerRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.md, paddingVertical: 11 },
  playerRowBorder:  { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  squadNumBadge:    { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  squadNum:         { fontFamily: fonts.bold, fontSize: 10, color: colors.navy },
  playerAvatar:     { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  playerAvatarText: { fontFamily: fonts.bold, fontSize: 9 },
  lockedBadge:      { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.08)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  lockedIcon:       { fontSize: 13, color: colors.red },
  lockedTeamLabel:  { fontFamily: fonts.bold, fontSize: 9, color: colors.red, letterSpacing: 0.5, marginTop: 1 },
  playerName:       { fontFamily: fonts.body, fontSize: 13, color: colors.textLight },
  playerNameSquad:  { fontFamily: fonts.bold, color: colors.white },
  availTimestamp:   { fontFamily: fonts.body, fontSize: 9, color: colors.textMuted, marginTop: 1, opacity: 0.75 },
  availTimestampAdmin: { color: '#F5C518', opacity: 1 },  // yellow when admin-set
  squadStar:        { fontFamily: fonts.bold, fontSize: 11, color: colors.gold, marginRight: 4 },
  statusDot:        { width: 8, height: 8, borderRadius: 4, flexShrink: 0, elevation: 2 },

  promptBtn:         { backgroundColor: 'rgba(96,165,250,0.12)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.35)', borderRadius: radius.sm, paddingHorizontal: 9, paddingVertical: 4 },
  promptBtnDone:     { backgroundColor: 'rgba(139,155,180,0.1)', borderColor: 'rgba(139,155,180,0.25)' },
  promptBtnText:     { fontFamily: fonts.bold, fontSize: 10, color: '#60A5FA' },
  promptBtnTextDone: { color: colors.textMuted },

  squadBtn:         { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  squadBtnText:     { fontFamily: fonts.bold, fontSize: 14, color: colors.navy },

  modalBackdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:       { backgroundColor: colors.navyLight, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(34,197,94,0.15)', padding: spacing.lg, paddingBottom: 40 },
  modalHandle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  modalTitle:       { fontFamily: fonts.display, fontSize: 22, letterSpacing: 2, color: colors.white, marginBottom: 4 },
  modalSub:         { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginBottom: spacing.lg },
  availOption:      { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: radius.md, padding: 14, marginBottom: 8 },
  availOptionDot:   { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  availOptionText:  { fontFamily: fonts.bold, fontSize: 14, flex: 1 },

  promptModalBackdrop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  promptModalBox:       { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, width: '100%' },
  promptModalTitle:     { fontFamily: fonts.display, fontSize: 22, letterSpacing: 1, color: colors.white, marginBottom: 10 },
  promptModalBody:      { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.lg },
  promptCancelBtn:      { flex: 1, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  promptCancelText:     { fontFamily: fonts.bold, fontSize: 14, color: colors.red },
  promptConfirmBtn:     { flex: 1, backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  promptConfirmText:    { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
})

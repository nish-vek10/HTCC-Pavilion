// pavilion-app/src/screens/admin/AdminMatchdayScreen.jsx
// Matchday availability overview across all teams

import React, { useState, useCallback } from 'react'
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
import { SCREENS } from '../../lib/constants'
import AppIcon from '../../components/AppIcon'

// ─── Configurable ─────────────────────────────────────────────────────────────
const SATURDAY_TEAMS = ['1st XI', '2nd XI', '3rd XI', '4th XI']
const SUNDAY_TEAMS   = ['Sunday XI']

// Use local date formatting to avoid UTC/BST timezone shifting the date back by 1
function toLocalISO(d) {
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getNextSaturday() {
  const today = new Date()
  const diff  = today.getDay() === 6 ? 0 : (6 - today.getDay())
  const sat   = new Date(today)
  sat.setDate(today.getDate() + diff)
  return toLocalISO(sat)
}

function getNextSunday() {
  const today = new Date()
  const diff  = today.getDay() === 0 ? 0 : (7 - today.getDay())
  const sun   = new Date(today)
  sun.setDate(today.getDate() + diff)
  return toLocalISO(sun)
}

function getInitials(name) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

export default function AdminMatchdayScreen({ navigation }) {
  const profile = useAuthStore(s => s.profile)
  const [activeTab,  setActiveTab]  = useState('saturday')
  const [matchDate,  setMatchDate]  = useState(getNextSaturday())
  const [fixtures,   setFixtures]   = useState([])
  const [playerData, setPlayerData] = useState({})
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  // { [fixtureId_playerId]: true } — tracks who has been prompted
  const [prompted,    setPrompted]    = useState({})
  const [promptModal, setPromptModal] = useState({ open: false, fixtureId: null, playerId: null, playerName: '' })

  useFocusEffect(useCallback(() => { loadMatchday() }, [matchDate, activeTab]))

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setMatchDate(tab === 'saturday' ? getNextSaturday() : getNextSunday())
  }

  // Parse at noon local time to prevent DST edge cases shifting the date back by 1 day
  // Always jumps exactly 7 days — stays on same day of week (Sat→Sat, Sun→Sun)
  const shiftDate = (direction) => {
    const d = new Date(matchDate + 'T12:00:00')
    d.setDate(d.getDate() + direction * 7)
    setMatchDate(toLocalISO(d))
  }

  const loadMatchday = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setFixtures([])
    setPlayerData({})

    const teamNames = activeTab === 'saturday' ? SATURDAY_TEAMS : SUNDAY_TEAMS
    const { data: teamRows } = await supabase.from('teams').select('id, name').in('name', teamNames)
    if (!teamRows || teamRows.length === 0) { setLoading(false); setRefreshing(false); return }

    const teamIds = teamRows.map(t => t.id)
    const { data: fixtureRows } = await supabase.from('fixtures')
      .select('*, teams(id, name)').eq('match_date', matchDate).in('team_id', teamIds)
    setFixtures(fixtureRows || [])

    await Promise.all((fixtureRows || []).map(f => fetchFixtureDetail(f.id, f.team_id)))

    // Load prompted state for all fixtures
    const promptedMaps = await Promise.all(
      (fixtureRows || []).map(f => fetchPromptedPlayers(f.id))
    )
    const merged = Object.assign({}, ...promptedMaps)
    setPrompted(merged)

    setLoading(false)
    setRefreshing(false)
  }

  const fetchFixtureDetail = async (fixtureId, teamId) => {
    const [{ data: members }, { data: avail }, { data: squadData }] = await Promise.all([
      supabase.from('team_members').select('player_id, profiles(id, full_name, avatar_color)').eq('team_id', teamId).eq('status', 'active'),
      supabase.from('availability').select('player_id, status').eq('fixture_id', fixtureId),
      supabase.from('squads').select('id, published, squad_members(player_id, position_order)').eq('fixture_id', fixtureId).single(),
    ])

    const availMap = {}
    avail?.forEach(a => { availMap[a.player_id] = a.status })
    const squadIds = new Set(squadData?.squad_members?.map(sm => sm.player_id) || [])

    const players = (members || []).map(m => ({
      id:      m.player_id,
      name:    m.profiles?.full_name || 'Unknown',
      color:   m.profiles?.avatar_color || colors.gold,
      status:  availMap[m.player_id] || null,
      inSquad: squadIds.has(m.player_id),
    })).sort((a, b) => {
      const order = { available: 0, tentative: 1, unavailable: 2 }
      return (order[a.status] ?? 3) - (order[b.status] ?? 3)
    })

    setPlayerData(prev => ({ ...prev, [fixtureId]: { players, squad: squadData } }))
  }

  // ── Prompt a player to set their availability ──────────────────────────
  const handlePrompt = async (fixtureId, playerId, playerName) => {
    const key = `${fixtureId}_${playerId}`
    const alreadyPrompted = prompted[key]

    if (alreadyPrompted) {
      // Show confirmation modal to prompt again
      setPromptModal({ open: true, fixtureId, playerId, playerName })
      return
    }

    await sendPrompt(fixtureId, playerId, playerName)
  }

  const sendPrompt = async (fixtureId, playerId, playerName) => {
    const key = `${fixtureId}_${playerId}`
    await sendPromptNotification(fixtureId, playerId, profile?.id)
    setPrompted(prev => ({ ...prev, [key]: true }))
    setPromptModal({ open: false, fixtureId: null, playerId: null, playerName: '' })
  }

  const countStatus = (fixtureId, status) =>
    playerData[fixtureId]?.players?.filter(p => p.status === status).length || 0

  const statusDot = { available: colors.green, unavailable: colors.red, tentative: '#F97316' }

  return (
    <View style={styles.container}>
      <TopHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadMatchday(true)} tintColor={colors.gold} />}
        showsVerticalScrollIndicator={false}>

        <View style={styles.pageHeader}>
          <Text style={styles.sectionLabel}>ADMINISTRATION</Text>
          <Text style={styles.pageTitle}>MATCHDAY</Text>
        </View>

        {/* ── Tabs — Saturday gold, Sunday blue ── */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, styles.tabSat, activeTab === 'saturday' && styles.tabSatActive]}
            onPress={() => handleTabChange('saturday')}
            activeOpacity={0.7}>
            <Text style={[styles.tabText, activeTab === 'saturday' && styles.tabSatTextActive]}>
              SATURDAY XIs
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, styles.tabSun, activeTab === 'sunday' && styles.tabSunActive]}
            onPress={() => handleTabChange('sunday')}
            activeOpacity={0.7}>
            <Text style={[styles.tabText, activeTab === 'sunday' && styles.tabSunTextActive]}>
              SUNDAY XI
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Date navigator — circular arrows, accent colour matches active tab ── */}
        {(() => {
          const accent = activeTab === 'saturday' ? colors.gold : '#60A5FA'
          return (
            <View style={styles.dateNav}>
              <TouchableOpacity
                style={[styles.dateNavArrowBtn, { borderColor: accent + '40' }]}
                onPress={() => shiftDate(-1)}
                activeOpacity={0.7}>
                <Text style={[styles.dateNavArrowText, { color: accent }]}>‹</Text>
              </TouchableOpacity>
              <View style={[styles.datePill, { borderColor: accent + '50', backgroundColor: accent + '12' }]}>
                <Text style={[styles.datePillText, { color: accent }]}>
                  {format(parseISO(matchDate), 'EEE d MMM yyyy').toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.dateNavArrowBtn, { borderColor: accent + '40' }]}
                onPress={() => shiftDate(1)}
                activeOpacity={0.7}>
                <Text style={[styles.dateNavArrowText, { color: accent }]}>›</Text>
              </TouchableOpacity>
            </View>
          )
        })()}

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
        ) : fixtures.length === 0 ? (
          <View style={styles.emptyCard}>
            <AppIcon name="fixtures" size={36} tint={colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>NO FIXTURES</Text>
            <Text style={styles.emptyText}>No {activeTab === 'saturday' ? 'Saturday' : 'Sunday'} fixtures on this date</Text>
            <TouchableOpacity style={styles.addFixtureBtn} onPress={() => navigation.navigate(SCREENS.ADMIN_FIXTURES)} activeOpacity={0.8}>
              <Text style={styles.addFixtureBtnText}>+ Add Fixture</Text>
            </TouchableOpacity>
          </View>
        ) : (
          fixtures.map(fixture => {
            const data        = playerData[fixture.id]
            const players     = data?.players || []
            const isPublished = data?.squad?.published || false
            const avail  = countStatus(fixture.id, 'available')
            const tent   = countStatus(fixture.id, 'tentative')
            const unavail= countStatus(fixture.id, 'unavailable')
            const noReply= players.filter(p => !p.status).length

            return (
              <View key={fixture.id} style={[styles.fixtureCard, isPublished && styles.fixtureCardPublished]}>
                {/* Header */}
                <View style={styles.fixtureHeader}>
                  <View>
                    <View style={styles.tagRow}>
                      <View style={styles.teamBadge}><Text style={styles.teamBadgeText}>{fixture.teams?.name?.toUpperCase()}</Text></View>
                      {(() => {
                        const hwCfg = fixture.home_away === 'home'
                          ? { icon: 'homeFixture', label: 'HOME', color: colors.green, bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)' }
                          : { icon: 'awayFixture', label: 'AWAY', color: '#60A5FA',    bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)' }
                        return (
                          <View style={[styles.hwBadge, { backgroundColor: hwCfg.bg, borderColor: hwCfg.border, flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
                            <AppIcon name={hwCfg.icon} size={10} tint={hwCfg.color} />
                            <Text style={[styles.hwBadgeText, { color: hwCfg.color }]}>{hwCfg.label}</Text>
                          </View>
                        )
                      })()}
                    </View>
                    <Text style={styles.fixtureTitle}>HTCC <Text style={styles.vsText}>vs</Text> {fixture.opponent?.toUpperCase()}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                      <AppIcon name="venue" size={11} tint={colors.textLight} />
                      <Text style={styles.fixtureMeta}>{fixture.venue}</Text>
                    </View>
                    {fixture.match_time && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <AppIcon name="time" size={11} tint={colors.textLight} />
                        <Text style={styles.fixtureMeta}>{fixture.match_time.slice(0,5)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.statusPill, isPublished && styles.statusPillPublished]}>
                    <Text style={[styles.statusPillText, isPublished && styles.statusPillTextPublished]}>
                      {isPublished ? '✓ SQUAD OUT' : 'PENDING'}
                    </Text>
                  </View>
                </View>

                {/* Availability counts */}
                <View style={styles.availRow}>
                  {[{ count: avail, color: colors.green, label: 'Available' },
                    { count: tent,  color: '#F97316', label: 'Tentative' },
                    { count: unavail, color: colors.red, label: 'No' },
                    { count: noReply, color: 'rgba(255,255,255,0.2)', label: 'No reply' }].map(item => item.count > 0 && (
                    <View key={item.label} style={styles.availItem}>
                      <View style={[styles.availDot, { backgroundColor: item.color }]} />
                      <Text style={[styles.availCount, { color: item.color }]}>{item.count}</Text>
                      <Text style={styles.availLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Progress bar */}
                {players.length > 0 && (
                  <View style={styles.progressBar}>
                    {['available','tentative','unavailable'].map(s => {
                      const count = countStatus(fixture.id, s)
                      const pct = (count / players.length) * 100
                      const col = s === 'available' ? colors.green : s === 'tentative' ? '#F97316' : colors.red
                      return pct > 0 ? <View key={s} style={{ width: pct + '%', backgroundColor: col, height: '100%' }} /> : null
                    })}
                  </View>
                )}

                {/* Player list */}
                <View style={styles.playerList}>
                  {!data ? (
                    <ActivityIndicator color={colors.gold} size="small" style={{ padding: 16 }} />
                  ) : players.length === 0 ? (
                    <Text style={styles.noPlayers}>No players assigned to this team</Text>
                  ) : players.map((player, i) => (
                    <View key={player.id} style={[styles.playerRow, i < players.length - 1 && styles.playerRowBorder,
                      player.status === 'unavailable' && { opacity: 0.5 }]}>
                      {player.inSquad ? (
                        <View style={styles.squadNumBadge}>
                          <Text style={styles.squadNum}>
                            {(() => {
                              const sorted = [...(data?.squad?.squad_members || [])]
                                .sort((a, b) => (a.position_order || 0) - (b.position_order || 0))
                              const idx = sorted.findIndex(sm => sm.player_id === player.id)
                              return idx >= 0 ? idx + 1 : '•'
                            })()}
                          </Text>
                        </View>
                      ) : (
                        <View style={[styles.playerAvatar, { backgroundColor: player.color + '22', borderColor: player.color + '44' }]}>
                          <Text style={[styles.playerAvatarText, { color: player.color }]}>{getInitials(player.name)}</Text>
                        </View>
                      )}
                      <Text style={[styles.playerName, player.inSquad && styles.playerNameSquad]}>{player.name}</Text>
                      {player.inSquad && <Text style={styles.squadStar}>★</Text>}
                      {/* Prompt button — only for no-reply players */}
                      {!player.status && (() => {
                        const key = `${fixture.id}_${player.id}`
                        const isPrompted = prompted[key]
                        return (
                          <TouchableOpacity
                            style={[styles.promptBtn, isPrompted && styles.promptBtnDone]}
                            onPress={() => handlePrompt(fixture.id, player.id, player.name)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.promptBtnText, isPrompted && styles.promptBtnTextDone]}>
                              {isPrompted ? 'Prompted' : 'Prompt'}
                            </Text>
                          </TouchableOpacity>
                        )
                      })()}
                      <View style={[styles.statusDot, { backgroundColor: player.status ? statusDot[player.status] : 'rgba(255,255,255,0.1)',
                        shadowColor: player.status ? statusDot[player.status] : 'transparent',
                        shadowOpacity: player.status ? 0.7 : 0, shadowRadius: 4 }]} />
                    </View>
                  ))}
                </View>

                {/* Footer */}
                <TouchableOpacity style={styles.squadBtn}
                  onPress={() => navigation.navigate(SCREENS.SQUAD_SELECTION, { fixtureId: fixture.id })}
                  activeOpacity={0.8}>
                  <Text style={styles.squadBtnText}>{isPublished ? 'View Squad' : 'Select Squad'}</Text>
                </TouchableOpacity>
                {isPublished && (
                  <TouchableOpacity
                    style={[styles.squadBtn, { marginTop: 8, backgroundColor: 'rgba(245,197,24,0.12)', borderColor: 'rgba(245,197,24,0.35)', borderWidth: 1 }]}
                    onPress={() => navigation.navigate(SCREENS.MATCH_SCORECARD, { fixtureId: fixture.id })}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.squadBtnText, { color: colors.gold }]}>Submit Result</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          })
        )}
      </ScrollView>

      {/* ── Re-prompt confirmation modal ── */}
      <Modal
        visible={promptModal.open}
        transparent
        animationType="fade"
        onRequestClose={() => setPromptModal({ open: false, fixtureId: null, playerId: null, playerName: '' })}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Prompt Again?</Text>
            <Text style={styles.modalBody}>
              Send another availability reminder to{' '}
              <Text style={styles.modalPlayerName}>{promptModal.playerName}</Text>?
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPromptModal({ open: false, fixtureId: null, playerId: null, playerName: '' })}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => sendPrompt(promptModal.fixtureId, promptModal.playerId, promptModal.playerName)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalConfirmBtnText}>Prompt Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  )
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: colors.navy },
  scroll:            { flex: 1 },
  content:           { padding: spacing.md, paddingBottom: 60 },
  backBtn:           { marginBottom: spacing.sm },
  backText:          { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  pageHeader:        { marginBottom: spacing.lg },
  sectionLabel:      { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.gold, marginBottom: 4 },
  pageTitle:         { fontFamily: fonts.display, fontSize: 36, letterSpacing: 2, color: colors.white, lineHeight: 40 },
  pageSub:           { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 4 },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabRow:            { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  tab:               { flex: 1, paddingVertical: 10, borderRadius: radius.full, borderWidth: 1, alignItems: 'center' },
  // Saturday tab — gold
  tabSat:            { borderColor: 'rgba(245,197,24,0.25)' },
  tabSatActive:      { borderColor: 'rgba(245,197,24,0.6)', backgroundColor: 'rgba(245,197,24,0.12)' },
  tabSatTextActive:  { fontFamily: fonts.bold, color: colors.gold },
  // Sunday tab — blue
  tabSun:            { borderColor: 'rgba(96,165,250,0.25)' },
  tabSunActive:      { borderColor: 'rgba(96,165,250,0.6)', backgroundColor: 'rgba(96,165,250,0.12)' },
  tabSunTextActive:  { fontFamily: fonts.bold, color: '#60A5FA' },
  tabText:           { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  // ── Date navigator ────────────────────────────────────────────────────────
  dateNav:           { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.lg },
  dateNavArrowBtn:   { width: 40, height: 40, borderRadius: 20, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center' },
  dateNavArrowText:  { fontFamily: fonts.bold, fontSize: 26, lineHeight: 30 },
  datePill:          { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingVertical: 9, alignItems: 'center' },
  datePillText:      { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1 },

  emptyCard:         { backgroundColor: colors.navyLight, borderRadius: radius.md, padding: 48, alignItems: 'center' },
  emptyIcon:         { fontSize: 40, marginBottom: 12 },
  emptyTitle:        { fontFamily: fonts.display, fontSize: 22, letterSpacing: 1, color: colors.white, marginBottom: 6 },
  emptyText:         { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginBottom: 16 },
  addFixtureBtn:     { backgroundColor: colors.gold, borderRadius: radius.md, paddingHorizontal: 20, paddingVertical: 11 },
  addFixtureBtnText: { fontFamily: fonts.bold, fontSize: 13, color: colors.navy },

  fixtureCard:       { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 16, overflow: 'hidden' },
  fixtureCardPublished: { borderColor: 'rgba(34,197,94,0.25)' },
  fixtureHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tagRow:            { flexDirection: 'row', gap: 6, marginBottom: 6, alignItems: 'center' },
  teamBadge:         { backgroundColor: 'rgba(245,197,24,0.1)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, alignItems: 'center', justifyContent: 'center' },
  teamBadgeText:     { fontFamily: fonts.bold, fontSize: 10, color: colors.gold, letterSpacing: 1 },
  hwBadge:           { borderWidth: 1, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 },
  hwBadgeText:       { fontFamily: fonts.bold, fontSize: 10 },
  fixtureTitle:      { fontFamily: fonts.bold, fontSize: 15, color: colors.white, marginBottom: 3 },
  vsText:            { fontFamily: fonts.display, fontSize: 15, color: colors.gold },
  fixtureMeta:       { fontFamily: fonts.bold, fontSize: 11, color: colors.textLight, marginBottom: 2 },
  statusPill:        { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  statusPillPublished: { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.25)' },
  statusPillText:    { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1, color: colors.textMuted },
  statusPillTextPublished: { color: colors.green },

  availRow:          { flexDirection: 'row', gap: 12, flexWrap: 'wrap', padding: spacing.sm, paddingHorizontal: spacing.md },
  availItem:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  availDot:          { width: 8, height: 8, borderRadius: 4 },
  availCount:        { fontFamily: fonts.bold, fontSize: 12 },
  availLabel:        { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },

  progressBar:       { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', overflow: 'hidden', marginHorizontal: spacing.md, borderRadius: 2 },

  playerList:        { paddingVertical: 4 },
  noPlayers:         { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', padding: 20 },
  playerRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.md, paddingVertical: 9 },
  playerRowBorder:   { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  squadNumBadge:     { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  squadNum:          { fontFamily: fonts.bold, fontSize: 10, color: colors.navy },
  playerAvatar:      { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  playerAvatarText:  { fontFamily: fonts.bold, fontSize: 9 },
  playerName:        { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textLight },
  playerNameSquad:   { fontFamily: fonts.bold, color: colors.white },
  squadStar:         { fontFamily: fonts.bold, fontSize: 11, color: colors.gold, marginRight: 4 },
  statusDot:         { width: 8, height: 8, borderRadius: 4, flexShrink: 0, elevation: 2 },

  squadBtn:          { backgroundColor: colors.gold, margin: spacing.sm, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  squadBtnText:      { fontFamily: fonts.bold, fontSize: 13, color: colors.navy },

  // ── Prompt button ───────────────────────────────────────────────────────
  promptBtn:         { backgroundColor: 'rgba(96,165,250,0.12)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.35)', borderRadius: radius.sm, paddingHorizontal: 9, paddingVertical: 4 },
  promptBtnDone:     { backgroundColor: 'rgba(139,155,180,0.1)', borderColor: 'rgba(139,155,180,0.25)' },
  promptBtnText:     { fontFamily: fonts.bold, fontSize: 10, color: '#60A5FA' },
  promptBtnTextDone: { color: colors.textMuted },

  // ── Re-prompt modal ─────────────────────────────────────────────────────
  modalBackdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalBox:          { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, width: '100%' },
  modalTitle:        { fontFamily: fonts.display, fontSize: 22, letterSpacing: 1, color: colors.white, marginBottom: 10 },
  modalBody:         { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.lg },
  modalPlayerName:   { fontFamily: fonts.bold, color: colors.white },
  modalBtns:         { flexDirection: 'row', gap: 10 },
  modalCancelBtn:    { flex: 1, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  modalCancelBtnText:{ fontFamily: fonts.bold, fontSize: 14, color: colors.red },
  modalConfirmBtn:   { flex: 1, backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  modalConfirmBtnText: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
})
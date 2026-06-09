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
import { SCREENS, toTitleCase, teamColor } from '../../lib/constants'
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

function xiRank(name = '') {
  if (name.includes('1st')) return 0
  if (name.includes('2nd')) return 1
  if (name.includes('3rd')) return 2
  if (name.includes('4th')) return 3
  return 4
}

function getInitials(name) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

// Format availability timestamp → "Mon 09 May, 14:32" (null-safe)
function formatAvailTS(ts) {
  if (!ts) return null
  try { return format(parseISO(ts), 'EEE dd MMM, HH:mm') } catch { return null }
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
  // Availability override (long-press 3s)
  const [availModal,  setAvailModal]  = useState({ open: false, fixtureId: null, player: null })
  const [savingAvail, setSavingAvail] = useState(false)

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
    try {
    const teamNames = activeTab === 'saturday' ? SATURDAY_TEAMS : SUNDAY_TEAMS
    const { data: teamRows } = await supabase.from('teams').select('id, name').in('name', teamNames)
    if (!teamRows || teamRows.length === 0) { return }

    const teamIds = teamRows.map(t => t.id)
    const { data: fixtureRows } = await supabase.from('fixtures')
      .select('*, teams(id, name)').eq('match_date', matchDate).in('team_id', teamIds)
    setFixtures(fixtureRows || [])

    // ── Fetch ALL squad data upfront so we can build cross-team map ──────────
    const squadResults = await Promise.all(
      (fixtureRows || []).map(f =>
        supabase.from('squads')
          .select('id, published, fixture_id, squad_members(player_id, position_order)')
          .eq('fixture_id', f.id)
          .maybeSingle()
      )
    )

    // cross-team map: player_id → { teamName, fixtureId } of first team they're drafted for
    const crossTeamMap = {}
    squadResults.forEach(({ data: squadData }, idx) => {
      if (!squadData?.squad_members?.length) return
      const teamName  = fixtureRows[idx].teams?.name
      const fixtureId = fixtureRows[idx].id
      squadData.squad_members.forEach(sm => {
        if (!crossTeamMap[sm.player_id]) {
          crossTeamMap[sm.player_id] = { teamName, fixtureId }
        }
      })
    })

    // squad lookup by fixtureId
    const squadMap = {}
    squadResults.forEach(({ data: squadData }, idx) => {
      if (squadData) squadMap[fixtureRows[idx].id] = squadData
    })

    await Promise.all(
      (fixtureRows || []).map(f => fetchFixtureDetail(f.id, f.team_id, squadMap[f.id], crossTeamMap))
    )

    // Load prompted state for all fixtures
    const promptedMaps = await Promise.all(
      (fixtureRows || []).map(f => fetchPromptedPlayers(f.id))
    )
    const merged = Object.assign({}, ...promptedMaps)
    setPrompted(merged)

    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // ── Availability override ────────────────────────────────────────────────
  const AVAIL_OPTIONS = [
    { key: 'available',   label: 'Available',   color: colors.green,     bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)'  },
    { key: 'tentative',   label: 'Tentative',   color: '#F97316',        bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
    { key: 'unavailable', label: 'Unavailable', color: colors.red,       bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)' },
    { key: null,          label: 'Not Set',     color: colors.textMuted, bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' },
  ]

  const handleSetAvail = async (status) => {
    const { fixtureId, player } = availModal
    if (!fixtureId || !player) return
    setSavingAvail(true)
    try {
      // RPC bypasses RLS (availability only allows player_id = auth.uid() for direct writes)
      const { error: rpcErr } = await supabase.rpc('set_availability_as_admin', {
        p_fixture_id: fixtureId,
        p_player_id:  player.id,
        p_status:     status,
      })
      if (rpcErr) throw new Error(rpcErr.message)
      // Optimistic local patch — update only this player's status in playerData,
      // no full reload so scroll position is preserved and screen doesn't jump.
      setPlayerData(prev => {
        const fixture = prev[fixtureId]
        if (!fixture) return prev
        const now = new Date().toISOString()
        const updatedPlayers = fixture.players.map(p =>
          p.id === player.id
            ? { ...p, status: status, availUpdatedAt: status ? now : null, setByAdmin: status ? true : false }
            : p
        )
        return { ...prev, [fixtureId]: { ...fixture, players: updatedPlayers } }
      })
      setAvailModal({ open: false, fixtureId: null, player: null })
    } catch (err) { Alert.alert('Error', err.message) }
    finally { setSavingAvail(false) }
  }

  const fetchFixtureDetail = async (fixtureId, teamId, squadData, crossTeamMap = {}) => {
    const [{ data: members }, { data: avail, error: availErr }] = await Promise.all([
      supabase.from('team_members').select('player_id, profiles(id, full_name, avatar_color)').eq('team_id', teamId).eq('status', 'active'),
      supabase.from('availability').select('player_id, status, updated_at, set_by_admin').eq('fixture_id', fixtureId),
    ])
    if (availErr) console.warn('[AdminMatchday] avail fetch error:', availErr.message)

    const availMap = {}
    avail?.forEach(a => { availMap[a.player_id] = { status: a.status, updatedAt: a.updated_at, setByAdmin: a.set_by_admin || false } })

    // position map: player_id → position_order for THIS fixture's squad
    const positionMap = {}
    squadData?.squad_members?.forEach(sm => { positionMap[sm.player_id] = sm.position_order })

    const players = (members || []).map(m => {
      const inSquad     = m.player_id in positionMap
      const crossEntry  = crossTeamMap[m.player_id]
      // locked = in another team's draft, NOT this team's squad
      const lockedByTeam = (!inSquad && crossEntry) ? crossEntry.teamName : null
      const availEntry   = availMap[m.player_id] || null
      return {
        id:             m.player_id,
        name:           toTitleCase(m.profiles?.full_name) || 'Unknown',
        color:          m.profiles?.avatar_color || colors.gold,
        status:         availEntry?.status || null,
        availUpdatedAt: availEntry?.updatedAt || null,
        setByAdmin:     availEntry?.setByAdmin || false,
        inSquad,
        position:       positionMap[m.player_id] || 999,
        lockedByTeam,
      }
    }).sort((a, b) => {
      // Squad members first — sorted by position_order (batting order)
      if (a.inSquad && b.inSquad) return a.position - b.position
      if (a.inSquad)  return -1
      if (b.inSquad)  return  1
      // Non-squad: available → locked → tentative → unavailable → no reply, A-Z within each
      const grp = p => {
        if (p.status === 'available'   && !p.lockedByTeam) return 0
        if (p.lockedByTeam)                                return 1
        if (p.status === 'tentative')                      return 2
        if (p.status === 'unavailable')                    return 3
        return 4  // no reply
      }
      const ga = grp(a), gb = grp(b)
      if (ga !== gb) return ga - gb
      return a.name.localeCompare(b.name)
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
          [...fixtures].sort((a, b) => xiRank(a.teams?.name) - xiRank(b.teams?.name)).map(fixture => {
            const data        = playerData[fixture.id]
            const players     = data?.players || []
            const isPublished = data?.squad?.published || false
            const avail  = countStatus(fixture.id, 'available')
            const tent   = countStatus(fixture.id, 'tentative')
            const unavail= countStatus(fixture.id, 'unavailable')
            const noReply= players.filter(p => !p.status).length
            const tCol   = teamColor(fixture.teams?.name)

            return (
              <View key={fixture.id} style={[styles.fixtureCard, isPublished && styles.fixtureCardPublished, { borderLeftColor: tCol, borderLeftWidth: 3 }]}>
                {/* Header */}
                <View style={styles.fixtureHeader}>
                  <View>
                    <View style={styles.tagRow}>
                      <View style={[styles.teamBadge, { backgroundColor: tCol + '18', borderColor: tCol + '44' }]}>
                        <Text style={[styles.teamBadgeText, { color: tCol }]}>{fixture.teams?.name?.toUpperCase()}</Text>
                      </View>
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
                    <TouchableOpacity key={player.id}
                      style={[styles.playerRow, i < players.length - 1 && styles.playerRowBorder,
                        (player.status === 'unavailable' || player.lockedByTeam) && { opacity: 0.45 }]}
                      onPress={() => setAvailModal({ open: true, fixtureId: fixture.id, player })}
                      activeOpacity={0.75}
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
                        {formatAvailTS(player.availUpdatedAt) && (
                          <Text style={[styles.availTimestamp, player.setByAdmin && styles.availTimestampAdmin]}>
                            Last Updated: {formatAvailTS(player.availUpdatedAt)}
                            {player.setByAdmin ? ' (admin)' : ''}
                          </Text>
                        )}
                      </View>
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
                    </TouchableOpacity>
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

      {/* ── Availability override modal (long-press) ── */}
      <Modal visible={availModal.open} transparent animationType="slide"
        onRequestClose={() => setAvailModal({ open: false, fixtureId: null, player: null })}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1}
          onPress={() => setAvailModal({ open: false, fixtureId: null, player: null })}>
          <View style={[styles.modalBox, { borderRadius: 24, padding: 24, paddingBottom: 40 }]}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={styles.modalTitle}>Set Availability</Text>
            <Text style={styles.modalBody}>{availModal.player?.name}</Text>
            {AVAIL_OPTIONS.map(opt => (
              <TouchableOpacity key={String(opt.key)}
                style={[styles.availOptionBtn, { backgroundColor: opt.bg, borderColor: opt.border }]}
                onPress={() => handleSetAvail(opt.key)}
                disabled={savingAvail} activeOpacity={0.7}>
                <View style={[styles.availOptionDot, { backgroundColor: opt.color }]} />
                <Text style={[styles.availOptionText, { color: opt.color }]}>{opt.label}</Text>
                {savingAvail && <ActivityIndicator size="small" color={opt.color} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

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
  playerName:        { fontFamily: fonts.body, fontSize: 13, color: colors.textLight },
  lockedBadge:       { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.08)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  lockedIcon:        { fontSize: 13, color: colors.red },
  lockedTeamLabel:   { fontFamily: fonts.bold, fontSize: 9, color: colors.red, letterSpacing: 0.5, marginTop: 1 },
  availTimestamp:      { fontFamily: fonts.body, fontSize: 9, color: colors.textMuted, marginTop: 2, opacity: 0.75 },
  availTimestampAdmin: { color: '#F5C518', opacity: 1 },  // yellow when set by admin
  playerNameSquad:   { fontFamily: fonts.bold, color: colors.white },
  squadStar:         { fontFamily: fonts.bold, fontSize: 11, color: colors.gold, marginRight: 4 },
  statusDot:         { width: 8, height: 8, borderRadius: 4, flexShrink: 0, elevation: 2 },

  squadBtn:          { backgroundColor: colors.gold, margin: spacing.sm, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  squadBtnText:      { fontFamily: fonts.bold, fontSize: 13, color: colors.navy },

  // ── Availability override modal ─────────────────────────────────────────
  availOptionBtn:    { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: radius.md, padding: 14, marginBottom: 8 },
  availOptionDot:    { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  availOptionText:   { fontFamily: fonts.bold, fontSize: 14, flex: 1 },

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

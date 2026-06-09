// pavilion-app/src/screens/captain/SquadSelectionScreen.jsx
// Squad selection — alphabetical pool, flexible squad size,
// role assignment via modal, drag-to-reorder with PanResponder

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Modal, Pressable,
  TextInput, StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { fetchPromptedPlayers, sendPromptNotification } from '../../lib/promptHelper'
import useAuthStore                       from '../../store/authStore'
import TopHeader                          from '../../components/layout/TopHeader'
import { colors, fonts, spacing, radius } from '../../theme'
import { AVAILABILITY_CONFIG, SCREENS, toTitleCase } from '../../lib/constants'
import { sendPushToUsers, insertNotifications, sendPushToRole, insertNotificationsForRole } from '../../lib/pushNotifications'
import AppIcon from '../../components/AppIcon'

// ─── Configurable ─────────────────────────────────────────────────────────────
const ITEM_HEIGHT = 54   // height of each squad row in px

function getInitials(name) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

// Format availability timestamp → "Mon 09 May, 14:32" (null-safe)
function formatAvailTS(ts) {
  if (!ts) return null
  try { return format(parseISO(ts), 'EEE dd MMM, HH:mm') } catch { return null }
}

// ─── Draggable Squad List ─────────────────────────────────────────────────────
function DraggableSquadList({ selected, setSelected, isPublished, onOpenRoleModal }) {
  const [pickedIndex, setPickedIndex] = useState(-1)

  const handleLongPress = (index) => {
    if (isPublished) return
    setPickedIndex(index)
  }

  const handleTapRow = (index) => {
    if (isPublished) return
    if (pickedIndex === -1) {
      onOpenRoleModal(selected[index])
      return
    }
    if (pickedIndex === index) {
      setPickedIndex(-1)
      return
    }
    setSelected(prev => {
      const arr = [...prev]
      const [item] = arr.splice(pickedIndex, 1)
      arr.splice(index, 0, item)
      return arr
    })
    setPickedIndex(-1)
  }

  return (
    <View>
      {pickedIndex !== -1 && (
        <View style={styles.dragInstructions}>
          <Text style={styles.dragInstructionsText}>
            Moving <Text style={{ color: colors.gold }}>{selected[pickedIndex]?.name}</Text> — tap a position to place
          </Text>
          <TouchableOpacity onPress={() => setPickedIndex(-1)} activeOpacity={0.7}>
            <Text style={styles.dragCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
      {selected.map((item, index) => {
        const cfg      = item.status ? AVAILABILITY_CONFIG[item.status] : null
        const isPicked = index === pickedIndex
        const isTarget = pickedIndex !== -1 && index !== pickedIndex
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => handleTapRow(index)}
            onLongPress={() => handleLongPress(index)}
            delayLongPress={300}
            activeOpacity={0.7}
            style={[
              styles.squadRow,
              index < selected.length - 1 && styles.squadRowBorder,
              isPicked && styles.squadRowPicked,
              isTarget && styles.squadRowTarget,
            ]}
          >
            <View style={[styles.posNum, isPicked && styles.posNumPicked]}>
              <Text style={[styles.posNumText, isPicked && { color: colors.white }]}>{index + 1}</Text>
            </View>
            {!isPublished && (
              <View style={styles.dragHandle}>
                <Text style={[styles.dragHandleText, isPicked && { color: colors.gold }]}>⠿</Text>
              </View>
            )}
            <View style={styles.squadPlayerBtn}>
              <Text style={[styles.squadPlayerName, isPicked && { color: colors.gold, fontFamily: fonts.bold }]}>
                {item.name}
              </Text>
              {isTarget && <Text style={styles.dropHint}>tap to place here</Text>}
            </View>
            <View style={styles.squadTagsRow}>
              {item.isCaptain && (
                <View style={styles.roleTagCaptain}>
                  <AppIcon name="captainBadge" size={14} tint={colors.gold} />
                </View>
              )}
              {item.isWK && (
                <View style={styles.roleTagWK}>
                  <AppIcon name="wkBadge" size={14} tint="#60A5FA" />
                </View>
              )}
              {cfg ? (
                <View style={[styles.statusDot, { backgroundColor: cfg.color, shadowColor: cfg.color, shadowOpacity: 0.7, shadowRadius: 3 }]} />
              ) : (
                <View style={[styles.statusDot, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
              )}
              {!isPublished && pickedIndex === -1 && (
                <TouchableOpacity
                  onPress={() => setSelected(prev => prev.filter(s => s.id !== item.id))}
                  style={styles.removeBtn} activeOpacity={0.7}>
                  <Text style={styles.removeBtnText}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SquadSelectionScreen({ navigation, route }) {
  const { fixtureId } = route.params
  const profile = useAuthStore(s => s.profile)

  const [fixture,   setFixture]   = useState(null)
  const [players,   setPlayers]   = useState([])
  const [squad,     setSquad]     = useState(null)
  const [selected,  setSelected]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)

  const [searchQuery,  setSearchQuery]  = useState('')

  // ── Role modal state ──────────────────────────────────────────────────────
  const [roleModal,   setRoleModal]   = useState({ open: false, player: null })
  const [prompted,    setPrompted]    = useState({})
  const [promptModal, setPromptModal] = useState({ open: false, playerId: null, playerName: '' })
  // Availability override (long-press 3s on pool player)
  const [availModal,  setAvailModal]  = useState({ open: false, player: null })
  const [savingAvail, setSavingAvail] = useState(false)

  useEffect(() => { loadAll() }, [])

  // Load prompted state from Supabase so it syncs with Matchday
  useEffect(() => {
    if (!fixtureId) return
    fetchPromptedPlayers(fixtureId).then(setPrompted)
  }, [fixtureId])

  // Re-sync prompted state every time screen is focused
  useFocusEffect(
    useCallback(() => {
      if (fixtureId) fetchPromptedPlayers(fixtureId).then(setPrompted)
    }, [fixtureId])
  )

  const loadAll = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchFixture(), fetchSquad()])
    } finally {
      setLoading(false)
    }
  }

  const fetchFixture = async () => {
    const { data, error } = await supabase
      .from('fixtures').select('*, teams(id, name)').eq('id', fixtureId).single()
    if (error || !data) { Alert.alert('Error', 'Fixture not found'); navigation.goBack(); return }
    setFixture(data)
    await fetchPlayers(data.team_id, data.match_date)
  }

  const fetchPlayers = async (teamId, matchDate) => {
    const { data: members } = await supabase
      .from('team_members')
      .select('player_id, profiles(id, full_name, avatar_color)')
      .eq('team_id', teamId).eq('status', 'active')
    if (!members) return

    const { data: avail, error: availErr } = await supabase
      .from('availability').select('player_id, status, updated_at, set_by_admin').eq('fixture_id', fixtureId)
    if (availErr) console.warn('[SquadSelection] avail fetch error:', availErr.message)
    const availMap = {}
    avail?.forEach(a => { availMap[a.player_id] = { status: a.status, updatedAt: a.updated_at, setByAdmin: a.set_by_admin || false } })

    const { data: sameDay } = await supabase
      .from('fixtures').select('id, teams(name)').eq('match_date', matchDate).neq('id', fixtureId)
    let conflictIds = []
    const conflictTeamMap = {}  // { [player_id]: teamName }
    if (sameDay?.length > 0) {
      const { data: squadRows } = await supabase
        .from('squads').select('fixture_id, squad_members(player_id)')
        .in('fixture_id', sameDay.map(f => f.id))
      // Build fixture_id → team name lookup
      const fixtureTeamMap = {}
      sameDay.forEach(f => { fixtureTeamMap[f.id] = f.teams?.name || 'Another Team' })
      squadRows?.forEach(sq => {
        const teamName = fixtureTeamMap[sq.fixture_id] || 'Another Team'
        sq.squad_members?.forEach(sm => {
          conflictIds.push(sm.player_id)
          conflictTeamMap[sm.player_id] = teamName
        })
      })
    }

    // Sort A–Z
    const list = (members || []).map(m => ({
      id:             m.player_id,
      name:           toTitleCase(m.profiles?.full_name) || 'Unknown',
      color:          m.profiles?.avatar_color || colors.gold,
      status:         availMap[m.player_id]?.status || null,
      availUpdatedAt: availMap[m.player_id]?.updatedAt || null,
      setByAdmin:     availMap[m.player_id]?.setByAdmin || false,
      conflict:       conflictIds.includes(m.player_id),
      conflictTeam:   conflictTeamMap[m.player_id] || null,
    })).sort((a, b) => {
      // available → conflict/locked → tentative → unavailable → no reply, A-Z within each
      const grp = p => {
        if (p.status === 'available'   && !p.conflict) return 0
        if (p.conflict)                                return 1
        if (p.status === 'tentative')                  return 2
        if (p.status === 'unavailable')                return 3
        return 4  // no reply
      }
      const ga = grp(a), gb = grp(b)
      if (ga !== gb) return ga - gb
      return a.name.localeCompare(b.name)
    })

    setPlayers(list)
  }

  const fetchSquad = async () => {
    const { data } = await supabase
      .from('squads')
      .select('*, squad_members(player_id, position_order, is_captain, is_wicketkeeper)')
      .eq('fixture_id', fixtureId).maybeSingle()

    if (data) {
      setSquad(data)
      const sorted = [...(data.squad_members || [])]
        .sort((a, b) => (a.position_order || 0) - (b.position_order || 0))
      setSelected(sorted.map(sm => ({
        id:        sm.player_id,
        name:      '',
        color:     colors.gold,
        status:    null,
        isCaptain: sm.is_captain || false,
        isWK:      sm.is_wicketkeeper || false,
      })))
    }
  }

  // Merge player info after both load — also re-fires when fetchSquad resets
  // selected with empty names (e.g. after Save Draft), since players won't change
  useEffect(() => {
    if (players.length === 0 || selected.length === 0) return
    if (selected[0]?.name) return   // already merged — guard prevents infinite loop
    setSelected(prev => prev.map(s => {
      const p = players.find(pl => pl.id === s.id)
      return p ? { ...s, name: p.name, color: p.color, status: p.status } : s
    }).filter(s => s.name))
  }, [players, selected])

  // ── Toggle player in pool ────────────────────────────────────────────────
  const togglePlayer = useCallback((player) => {
    if (squad?.published) return
    const isSelected = selected.some(s => s.id === player.id)
    if (isSelected) {
      setSelected(prev => prev.filter(s => s.id !== player.id))
    } else {
      if (player.conflict) { Alert.alert('Conflict', `${player.name} is already in the ${player.conflictTeam || 'another team'}\'s squad today`); return }
      setSelected(prev => [...prev, {
        id: player.id, name: player.name, color: player.color,
        status: player.status, isCaptain: false, isWK: false,
      }])
    }
  }, [squad?.published, selected])

  // ── Role assignment from modal ────────────────────────────────────────────
  const assignRole = useCallback((role) => {
    const playerId = roleModal.player?.id
    if (!playerId) return

    setSelected(prev => prev.map(s => {
      if (role === 'captain') {
        // Remove captain from everyone, set on this player
        return { ...s, isCaptain: s.id === playerId ? !s.isCaptain : false }
      } else if (role === 'wk') {
        // Remove WK from everyone, set on this player
        return { ...s, isWK: s.id === playerId ? !s.isWK : false }
      } else if (role === 'none') {
        // Remove both roles from this player
        return s.id === playerId ? { ...s, isCaptain: false, isWK: false } : s
      }
      return s
    }))
    setRoleModal({ open: false, player: null })
  }, [roleModal.player?.id])

  // ── Prompt handlers ────────────────────────────────────────────────────
  const handlePrompt = (playerId, playerName) => {
    const key = `${fixtureId}_${playerId}`
    if (prompted[key]) {
      setPromptModal({ open: true, playerId, playerName })
    } else {
      sendPrompt(playerId, playerName)
    }
  }

  const sendPrompt = async (playerId, playerName) => {
    const key = `${fixtureId}_${playerId}`
    await sendPromptNotification(fixtureId, playerId, profile?.id)
    // Re-fetch from DB to confirm it saved
    const fresh = await fetchPromptedPlayers(fixtureId)
    setPrompted(fresh)
    setPromptModal({ open: false, playerId: null, playerName: '' })
  }

  // ── Availability override (long-press 3s on pool player) ─────────────────
  const AVAIL_OPTIONS = [
    { key: 'available',   label: 'Available',   color: colors.green,     bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)'   },
    { key: 'tentative',   label: 'Tentative',   color: '#F97316',        bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)'  },
    { key: 'unavailable', label: 'Unavailable', color: colors.red,       bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.25)'  },
    { key: null,          label: 'Not Set',     color: colors.textMuted, bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' },
  ]

  const handleSetAvail = async (status) => {
    const { player } = availModal
    if (!player) return
    setSavingAvail(true)
    try {
      // RPC bypasses RLS (availability only allows player_id = auth.uid() for direct writes)
      const { error: rpcErr } = await supabase.rpc('set_availability_as_admin', {
        p_fixture_id: fixtureId,
        p_player_id:  player.id,
        p_status:     status,
      })
      if (rpcErr) throw new Error(rpcErr.message)
      // Optimistic local patch — update only this player in place, no full reload
      const now = new Date().toISOString()
      setPlayers(prev => prev.map(p =>
        p.id === player.id
          ? { ...p, status: status, availUpdatedAt: status ? now : null, setByAdmin: status ? true : false }
          : p
      ))
      setAvailModal({ open: false, player: null })
    } catch (err) { Alert.alert('Error', err.message) }
    finally { setSavingAvail(false) }
  }

  const openRoleModal = (player) => setRoleModal({ open: true, player })

  // ── Derived role info — memoised to avoid re-scanning selected on every render ──
  const captain     = useMemo(() => selected.find(s => s.isCaptain),                      [selected])
  const wicketkeeper= useMemo(() => selected.find(s => s.isWK),                           [selected])
  const currentPlayerInModal = useMemo(() => selected.find(s => s.id === roleModal.player?.id), [selected, roleModal.player?.id])

  // Filter player pool by search query
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return players
    const q = searchQuery.trim().toLowerCase()
    return players.filter(p => p.name.toLowerCase().includes(q))
  }, [players, searchQuery])

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async (silent = false) => {
    setSaving(true)
    try {
      let squadId = squad?.id
      if (squadId) {
        await supabase.from('squad_members').delete().eq('squad_id', squadId)
      } else {
        const { data: newSquad, error } = await supabase
          .from('squads').insert({ fixture_id: fixtureId }).select().single()
        if (error) throw error
        squadId = newSquad.id
        setSquad(newSquad)
      }
      if (selected.length > 0) {
        await supabase.from('squad_members').insert(
          selected.map((p, i) => ({
            squad_id:         squadId,
            player_id:        p.id,
            position_order:   i + 1,
            is_captain:       p.isCaptain || false,
            is_wicketkeeper:  p.isWK || false,
          }))
        )
      }
      await fetchSquad()
      if (!silent) {
        Alert.alert('Saved', 'Squad draft saved successfully', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ])
      }
      return squadId
    } catch (err) {
      Alert.alert('Error', 'Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Publish ───────────────────────────────────────────────────────────────
  const handlePublish = () => {
    if (selected.length === 0) { Alert.alert('Empty Squad', 'Add at least one player before publishing'); return }

    // C and WK are required before publishing
    const missingRoles = []
    if (!captain)      missingRoles.push('Captain (C)')
    if (!wicketkeeper) missingRoles.push('Wicketkeeper (WK)')
    if (missingRoles.length > 0) {
      Alert.alert(
        'Roles Required',
        `Please assign the following before publishing:\n\n• ${missingRoles.join('\n• ')}\n\nTap a player name in the squad to assign roles.`
      )
      return
    }

    Alert.alert(
      'Publish Squad',
      `Publish squad of ${selected.length} player${selected.length !== 1 ? 's' : ''} vs ${fixture?.opponent}?\n\nCaptain: ${captain.name}\nWicketkeeper: ${wicketkeeper.name}`,
      [
        { text: 'Not Yet', style: 'cancel' },
        { text: 'Publish', onPress: async () => {
          setSaving(true)
          try {
            // ── Capture old squad members BEFORE handleSave overwrites them ──
            // Used below to detect removed players and auto-clear their fantasy picks.
            let oldMemberIds = []
            if (squad?.id) {
              const { data: oldMembers } = await supabase
                .from('squad_members')
                .select('player_id')
                .eq('squad_id', squad.id)
              oldMemberIds = (oldMembers || []).map(m => m.player_id)
            }

            const squadId = await handleSave(true)
            if (!squadId) return

            // Mark squad as published in Supabase
            await supabase.from('squads').update({
              published: true, published_at: new Date().toISOString(), published_by: profile.id,
            }).eq('id', squadId)

            // Build notification content for selected players
            const fixtureLabel = fixture?.opponent
              ? `vs ${fixture.opponent}`
              : 'upcoming fixture'
            const matchDate = fixture?.match_date
              ? new Date(fixture.match_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
              : ''
            const notifTitle = 'You\'ve Been Selected'
            const notifBody  = `You have been selected in the Playing XI for ${fixtureLabel}${matchDate ? ` on ${matchDate}` : ''}. Check the Fixtures tab for details.`
            const selectedIds = selected.map(p => p.id)

            // Send device push to all selected players
            sendPushToUsers(selectedIds, notifTitle, notifBody, {
              type:       'squad_published',
              fixture_id: fixtureId,
            })

            // Insert in-app notification for each selected player (visible in Alerts tab)
            insertNotifications(selectedIds, 'squad_published', notifTitle, notifBody, {
              fixture_id: fixtureId,
            })

            // ── Auto-remove fantasy picks for players dropped from the squad ──
            // When a squad is edited and republished, any player who was in the old
            // squad but NOT in the new squad must be removed from all fantasy teams
            // for this fixture — freeing up a slot so pickers can choose a replacement.
            // Only runs before the matchday cutoff (11:00 on match day).
            try {
              const newSelectedIds = selected.map(p => p.id)
              const removedPlayerIds = oldMemberIds.filter(id => !newSelectedIds.includes(id))
              const cutoff      = new Date(fixture.match_date + 'T11:00:00')
              const isPastCutoff = new Date() >= cutoff

              if (removedPlayerIds.length > 0 && !isPastCutoff) {
                // Query affected managers BEFORE deleting (rows gone after delete)
                const { data: affectedPicks } = await supabase
                  .from('fantasy_picks')
                  .select('team_id, fantasy_teams!team_id(member_id)')
                  .eq('fixture_id', fixtureId)
                  .in('player_id', removedPlayerIds)

                // Delete fantasy picks for removed players tied to this fixture
                await supabase.from('fantasy_picks')
                  .delete()
                  .eq('fixture_id', fixtureId)
                  .in('player_id', removedPlayerIds)

                const affectedManagerIds = [
                  ...new Set(
                    (affectedPicks || [])
                      .map(p => p.fantasy_teams?.member_id)
                      .filter(Boolean)
                  )
                ]
                if (affectedManagerIds.length > 0) {
                  const dropTitle = '⚠️ Squad Update'
                  const dropBody  = `A player in your fantasy XI was removed from the ${fixture?.teams?.name || 'squad'}. You have an open slot — pick a replacement!`
                  sendPushToUsers(affectedManagerIds, dropTitle, dropBody, {
                    type: 'fantasy_pick_removed', screen: SCREENS.FANTASY_LEAGUE,
                  })
                  insertNotifications(affectedManagerIds, 'fantasy_pick_removed', dropTitle, dropBody, {
                    fixture_id: fixtureId,
                  })
                }
              }
            } catch (autoRemoveErr) {
              console.warn('[SquadPublish] Auto-remove fantasy picks failed:', autoRemoveErr.message)
            }

            // ── Fantasy Unlocked check ──────────────────────────────────────
            // After every squad publish, check if ALL MCCL fixtures on this matchday
            // now have a published squad. If so, notify ALL members to pick fantasy.
            // Friendly and CSVL (sunday_comp) publishes never trigger fantasy unlock.
            try {
              const matchDate = fixture?.match_date
              const matchType = fixture?.match_type
              if (matchDate && matchType === 'league') {
                // Get all MCCL fixtures for this matchday only
                const { data: sameDayFixtures } = await supabase
                  .from('fixtures')
                  .select('id')
                  .eq('match_date', matchDate)
                  .eq('match_type', 'league')

                if (sameDayFixtures?.length > 0) {
                  const allFixtureIds = sameDayFixtures.map(f => f.id)

                  // Count how many have a published squad
                  const { data: publishedSquads } = await supabase
                    .from('squads')
                    .select('fixture_id')
                    .in('fixture_id', allFixtureIds)
                    .eq('published', true)

                  const publishedCount = publishedSquads?.length || 0

                  // All fixtures on this matchday have published squads → fantasy unlocked
                  if (publishedCount >= allFixtureIds.length) {
                    const fantasyTitle = '🏏 Fantasy Unlocked!'
                    const fantasyBody  = `All squads are set for ${matchDate}. Pick your fantasy XI now!`
                    const fantasyData  = { type: 'fantasy_unlocked', screen: SCREENS.FANTASY_LEAGUE }

                    // Fire-and-forget — don't block the publish success alert
                    sendPushToRole('all', fantasyTitle, fantasyBody, fantasyData)
                    insertNotificationsForRole('all', 'fantasy_unlocked', fantasyTitle, fantasyBody)
                  }
                }
              }
            } catch (fantasyErr) {
              // Non-critical — log but don't surface to user
              console.warn('[SquadPublish] Fantasy unlock check failed:', fantasyErr.message)
            }
            // ───────────────────────────────────────────────────────────────

            await loadAll()
            Alert.alert('Published!', 'Squad has been published and all selected players have been notified.', [
              { text: 'OK', onPress: () => navigation.goBack() }
            ])
          } catch (err) {
            Alert.alert('Error', 'Failed to publish: ' + err.message)
          } finally {
            setSaving(false)
          }
        }},
      ]
    )
  }

  const handleUnlock = () => {
    Alert.alert('Unlock Squad', `Unpublish squad for vs ${fixture?.opponent} to make changes?`, [
      { text: 'Keep Published', style: 'cancel' },
      { text: 'Unlock', onPress: async () => {
        setSaving(true)
        await supabase.from('squads')
          .update({ published: false, published_at: null, published_by: null })
          .eq('id', squad.id)
        await loadAll()
        setSaving(false)
      }},
    ])
  }

  const isPublished     = squad?.published || false
  const squadCountColor = selected.length >= 11 ? colors.green
    : selected.length >= 8 ? '#F97316'
    : selected.length >= 1 ? colors.gold
    : colors.textMuted

  if (loading) {
    return (
      <View style={styles.container}>
        <TopHeader />
        <View style={styles.centred}><ActivityIndicator color={colors.gold} size="large" /></View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <TopHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AppIcon name="back" size={13} tint={colors.textMuted} />
            <Text style={styles.backText}>Back</Text>
          </View>
        </TouchableOpacity>

        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <Text style={styles.sectionLabel}>SQUAD SELECTION</Text>
          <Text style={styles.pageTitle}>
            HTCC <Text style={styles.vsText}>vs</Text> {fixture?.opponent?.toUpperCase()}
          </Text>
          <View style={styles.fixtureMetaRow}>
            <AppIcon name="date" size={13} tint={colors.gold} />
            <Text style={styles.fixtureMeta}>{fixture && format(parseISO(fixture.match_date), 'EEEE d MMMM yyyy')}</Text>
          </View>
          <View style={styles.fixtureMetaRow}>
            <AppIcon name="time" size={13} tint={colors.gold} />
            <Text style={styles.fixtureMeta}>{fixture?.match_time?.slice(0,5)}</Text>
            <AppIcon name="venue" size={13} tint={colors.blue} style={{ marginLeft: 10 }} />
            <Text style={styles.fixtureMeta}>{fixture?.venue}</Text>
          </View>
          <View style={styles.fixtureMetaRow}>
            <AppIcon name="cricketBat" size={13} tint={colors.textMuted} />
            <Text style={styles.teamText}>{fixture?.teams?.name}</Text>
          </View>
          {isPublished && (
            <View style={styles.publishedBanner}>
              <Text style={styles.publishedBannerText}>✓ SQUAD PUBLISHED</Text>
            </View>
          )}
        </View>

        {/* ── Squad counter ── */}
        <View style={styles.counterCard}>
          <View style={styles.counterRow}>
            <Text style={styles.counterLabel}>SQUAD</Text>
            <Text style={[styles.counterNum, { color: squadCountColor }]}>{selected.length}</Text>
          </View>
          <View style={styles.progressWrap}>
            <View style={[styles.progressFill, {
              width: Math.min((selected.length / 11) * 100, 100) + '%',
              backgroundColor: selected.length >= 11 ? colors.green : selected.length >= 8 ? '#F97316' : colors.gold,
            }]} />
          </View>
          {/* Role status */}
          <View style={styles.roleStatus}>
            <View style={[styles.roleStatusItem, captain && styles.roleStatusItemSet]}>
              <Text style={[styles.roleStatusText, captain && { color: colors.gold }]}>
                {captain ? `C: ${captain.name}` : 'Captain not set'}
              </Text>
            </View>
            <View style={[styles.roleStatusItem, wicketkeeper && styles.roleStatusItemSet]}>
              <Text style={[styles.roleStatusText, wicketkeeper && { color: '#60A5FA' }]}>
                {wicketkeeper ? `WK: ${wicketkeeper.name}` : 'Wicketkeeper not set'}
              </Text>
            </View>
          </View>
          <Text style={styles.counterHint}>
            {isPublished
              ? 'Squad is published and locked'
              : 'Tap a player in the squad to assign Captain or WK role'}
          </Text>
        </View>

        {/* ── Player pool A–Z ── */}
        <View style={styles.poolHeader}>
          <Text style={styles.poolTitle}>TEAM PLAYERS ({filteredPlayers.length}{searchQuery ? `/${players.length}` : ''})</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search player..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
        {filteredPlayers.map(player => {
          const isSelected = selected.some(s => s.id === player.id)
          const cfg        = player.status ? AVAILABILITY_CONFIG[player.status] : null
          const canSelect  = !isPublished && !player.conflict

          return (
            <TouchableOpacity
              key={player.id}
              style={[
                styles.playerRow,
                isSelected    && styles.playerRowSelected,
                player.conflict && styles.playerRowConflict,
              ]}
              onPress={() => canSelect && togglePlayer(player)}
              onLongPress={() => {
                if (['admin','superadmin'].includes(profile?.role)) {
                  setAvailModal({ open: true, player })
                }
              }}
              delayLongPress={400}
              activeOpacity={canSelect ? 0.7 : 1}
              disabled={!canSelect && !isSelected}
            >
              <View style={[styles.tickCircle, isSelected && styles.tickCircleActive]}>
                {isSelected && <Text style={styles.tickMark}>✓</Text>}
              </View>
              {player.conflictTeam ? (
                <View style={styles.conflictBadge}>
                  <Text style={styles.conflictBadgeText}>⊘</Text>
                </View>
              ) : (
                <View style={[styles.avatar, { backgroundColor: player.color + '22', borderColor: player.color + '44' }]}>
                  <Text style={[styles.avatarText, { color: player.color }]}>{getInitials(player.name)}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.playerName, isSelected && styles.playerNameSelected]}>{player.name}</Text>
                {player.conflictTeam && (
                  <Text style={styles.conflictTeamLabel}>{player.conflictTeam}</Text>
                )}
                {formatAvailTS(player.availUpdatedAt) && (
                  <Text style={[styles.availTimestamp, player.setByAdmin && styles.availTimestampAdmin]}>
                    Last Updated: {formatAvailTS(player.availUpdatedAt)}
                  </Text>
                )}
              </View>
              {cfg ? (
                <View style={[styles.availBadge, { backgroundColor: cfg.fillColor, borderColor: cfg.color + '44' }]}>
                  <View style={[styles.availDot, { backgroundColor: cfg.color }]} />
                  <Text style={[styles.availText, { color: cfg.color }]}>
                    {player.status === 'available' ? 'Available' : player.status === 'unavailable' ? 'Unavailable' : 'Tentative'}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.promptBtn, prompted[`${fixtureId}_${player.id}`] && styles.promptBtnDone]}
                  onPress={() => handlePrompt(player.id, player.name)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.promptBtnText, prompted[`${fixtureId}_${player.id}`] && styles.promptBtnTextDone]}>
                    {prompted[`${fixtureId}_${player.id}`] ? 'Prompted' : 'Prompt'}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )
        })}

        {/* ── Squad list — draggable ── */}
        {selected.length > 0 && (
          <View style={styles.squadCard}>
            <Text style={styles.squadTitle}>
              SQUAD · {selected.length} PLAYER{selected.length !== 1 ? 'S' : ''}
              {!isPublished && <Text style={styles.squadHint}>  · hold to move · tap for roles</Text>}
            </Text>
            <DraggableSquadList
              selected={selected}
              setSelected={setSelected}
              isPublished={isPublished}
              onOpenRoleModal={openRoleModal}
            />
          </View>
        )}

        {/* ── Action buttons ── */}
        <View style={styles.actionBtns}>
          {!isPublished ? (
            <>
              <TouchableOpacity
                style={[styles.saveBtn, (saving || selected.length === 0) && styles.btnDisabled]}
                onPress={handleSave} disabled={saving || selected.length === 0} activeOpacity={0.8}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Draft'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.publishBtn, (saving || selected.length === 0) && styles.btnDisabled]}
                onPress={handlePublish} disabled={saving || selected.length === 0} activeOpacity={0.8}>
                <Text style={[styles.publishBtnText, selected.length === 0 && { color: colors.textMuted }]}>
                  Publish Squad
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {squad?.published_at && (
                <Text style={styles.publishedAt}>
                  ✓ Published {format(parseISO(squad.published_at), 'EEE d MMM, HH:mm')}
                </Text>
              )}
              <TouchableOpacity style={styles.unlockBtn} onPress={handleUnlock} activeOpacity={0.8}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AppIcon name="edit" size={13} tint={colors.white} />
                  <Text style={styles.unlockBtnText}>Edit and Re-publish Squad</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Re-prompt confirmation modal ── */}
      <Modal
        visible={promptModal.open}
        transparent
        animationType="fade"
        onRequestClose={() => setPromptModal({ open: false, playerId: null, playerName: '' })}
      >
        <View style={styles.promptModalBackdrop}>
          <View style={styles.promptModalBox}>
            <Text style={styles.promptModalTitle}>Prompt Again?</Text>
            <Text style={styles.promptModalBody}>
              Send another availability reminder to{' '}
              <Text style={{ fontFamily: fonts.bold, color: colors.white }}>{promptModal.playerName}</Text>?
            </Text>
            <View style={styles.promptModalBtns}>
              <TouchableOpacity
                style={styles.promptModalCancelBtn}
                onPress={() => setPromptModal({ open: false, playerId: null, playerName: '' })}
                activeOpacity={0.8}
              >
                <Text style={styles.promptModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.promptModalConfirmBtn}
                onPress={() => sendPrompt(promptModal.playerId, promptModal.playerName)}
                activeOpacity={0.8}
              >
                <Text style={styles.promptModalConfirmText}>Prompt Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Availability override modal ── */}
      <Modal
        visible={availModal.open}
        transparent
        animationType="slide"
        onRequestClose={() => setAvailModal({ open: false, player: null })}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAvailModal({ open: false, player: null })}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{availModal.player?.name}</Text>
            <Text style={styles.modalSub}>Set availability on their behalf</Text>
            {AVAIL_OPTIONS.map(opt => (
              <TouchableOpacity
                key={String(opt.key)}
                style={[styles.availOptionBtn, { borderColor: opt.border, backgroundColor: opt.bg }]}
                onPress={() => handleSetAvail(opt.key)}
                disabled={savingAvail}
                activeOpacity={0.7}
              >
                <View style={[styles.availOptionDot, { backgroundColor: opt.color }]} />
                <Text style={[styles.availOptionText, { color: opt.color }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setAvailModal({ open: false, player: null })}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Role assignment modal ── */}
      <Modal
        visible={roleModal.open}
        transparent
        animationType="slide"
        onRequestClose={() => setRoleModal({ open: false, player: null })}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setRoleModal({ open: false, player: null })}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>{roleModal.player?.name}</Text>
            <Text style={styles.modalSub}>Assign a role for this match</Text>

            {/* Captain */}
            <TouchableOpacity
              style={[styles.roleOption, currentPlayerInModal?.isCaptain && styles.roleOptionActive]}
              onPress={() => assignRole('captain')} activeOpacity={0.7}>
              <View style={styles.roleOptionLeft}>
                <View style={[styles.roleOptionBadge, styles.roleOptionBadgeC]}>
                  <Text style={styles.roleOptionBadgeText}>C</Text>
                </View>
                <View>
                  <Text style={[styles.roleOptionName, currentPlayerInModal?.isCaptain && { color: colors.gold }]}>
                    Captain
                  </Text>
                  {captain && captain.id !== roleModal.player?.id && (
                    <Text style={styles.roleOptionNote}>Will replace {captain.name}</Text>
                  )}
                </View>
              </View>
              {currentPlayerInModal?.isCaptain && <Text style={styles.roleOptionCheck}>✓</Text>}
            </TouchableOpacity>

            {/* Wicketkeeper */}
            <TouchableOpacity
              style={[styles.roleOption, currentPlayerInModal?.isWK && styles.roleOptionActiveWK]}
              onPress={() => assignRole('wk')} activeOpacity={0.7}>
              <View style={styles.roleOptionLeft}>
                <View style={[styles.roleOptionBadge, styles.roleOptionBadgeWK]}>
                  <Text style={styles.roleOptionBadgeText}>WK</Text>
                </View>
                <View>
                  <Text style={[styles.roleOptionName, currentPlayerInModal?.isWK && { color: '#60A5FA' }]}>
                    Wicketkeeper
                  </Text>
                  {wicketkeeper && wicketkeeper.id !== roleModal.player?.id && (
                    <Text style={styles.roleOptionNote}>Will replace {wicketkeeper.name}</Text>
                  )}
                </View>
              </View>
              {currentPlayerInModal?.isWK && <Text style={[styles.roleOptionCheck, { color: '#60A5FA' }]}>✓</Text>}
            </TouchableOpacity>

            {/* Clear roles */}
            {(currentPlayerInModal?.isCaptain || currentPlayerInModal?.isWK) && (
              <TouchableOpacity style={styles.roleOptionClear} onPress={() => assignRole('none')} activeOpacity={0.7}>
                <Text style={styles.roleOptionClearText}>✕ Remove roles from this player</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.modalClose} onPress={() => setRoleModal({ open: false, player: null })} activeOpacity={0.7}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.navy },
  scroll:       { flex: 1 },
  content:      { padding: spacing.md },
  centred:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn:      { marginBottom: spacing.sm },
  backText:     { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },

  pageHeader:   { marginBottom: spacing.lg },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.green, marginBottom: 4 },
  pageTitle:    { fontFamily: fonts.display, fontSize: 26, letterSpacing: 2, color: colors.white, lineHeight: 30, marginBottom: 8 },
  vsText:       { color: colors.gold },
  fixtureMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  fixtureMeta:  { fontFamily: fonts.bold, fontSize: 12, color: colors.textLight, marginBottom: 3 },
  teamText:     { fontFamily: fonts.bold, fontSize: 13, color: colors.green, marginTop: 4 },
  publishedBanner: { backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 14, marginTop: 10, alignSelf: 'flex-start' },
  publishedBannerText: { fontFamily: fonts.bold, fontSize: 12, color: colors.green, letterSpacing: 1 },

  counterCard:  { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  counterRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  counterLabel: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.textMuted },
  counterNum:   { fontFamily: fonts.display, fontSize: 32, letterSpacing: 2 },
  progressWrap: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', borderRadius: 3 },
  roleStatus:   { flexDirection: 'row', gap: 8, marginBottom: 8 },
  roleStatusItem:   { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 8 },
  roleStatusItemSet:{ borderColor: 'rgba(245,197,24,0.2)', backgroundColor: 'rgba(245,197,24,0.04)' },
  roleStatusText:   { fontFamily: fonts.bold, fontSize: 10, color: colors.textMuted, letterSpacing: 0.5 },
  counterHint:  { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },

  poolHeader:   { marginBottom: spacing.sm },
  poolTitle:    { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.textMuted, marginBottom: 8 },
  searchInput:  { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontFamily: fonts.medium, fontSize: 13, color: colors.white },

  playerRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 7, backgroundColor: colors.navyLight },
  playerRowSelected: { borderColor: 'rgba(245,197,24,0.5)', backgroundColor: 'rgba(245,197,24,0.05)' },
  playerRowConflict: { borderColor: 'rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.04)', opacity: 0.55 },
  tickCircle:        { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tickCircleActive:  { backgroundColor: colors.gold, borderColor: colors.gold },
  tickMark:          { fontFamily: fonts.bold, fontSize: 11, color: colors.navy },
  avatar:            { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:        { fontFamily: fonts.bold, fontSize: 11 },
  playerName:        { fontFamily: fonts.medium, fontSize: 13, color: colors.textLight },
  playerNameSelected:{ fontFamily: fonts.bold, color: colors.white },
  conflictTeamLabel: { fontFamily: fonts.bold, fontSize: 10, color: '#EF4444', marginTop: 1, letterSpacing: 0.3 },
  availTimestamp:    { fontFamily: fonts.body, fontSize: 9, color: colors.textMuted, marginTop: 2, opacity: 0.75 },
  availTimestampAdmin: { color: '#F5C518', opacity: 1 },
  conflictBadge:     { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  conflictBadgeText: { fontFamily: fonts.bold, fontSize: 16, color: '#EF4444', lineHeight: 20 },
  availBadge:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  availDot:          { width: 6, height: 6, borderRadius: 3 },
  availText:         { fontFamily: fonts.bold, fontSize: 10 },
  noReplyBadge:          { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  noReplyText:           { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  promptBtn:             { backgroundColor: 'rgba(96,165,250,0.12)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.35)', borderRadius: radius.sm, paddingHorizontal: 9, paddingVertical: 4 },
  promptBtnDone:         { backgroundColor: 'rgba(139,155,180,0.1)', borderColor: 'rgba(139,155,180,0.25)' },
  promptBtnText:         { fontFamily: fonts.bold, fontSize: 10, color: '#60A5FA' },
  promptBtnTextDone:     { color: colors.textMuted },
  promptModalBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  promptModalBox:        { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, width: '100%' },
  promptModalTitle:      { fontFamily: fonts.display, fontSize: 22, letterSpacing: 1, color: colors.white, marginBottom: 10 },
  promptModalBody:       { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.lg },
  promptModalBtns:       { flexDirection: 'row', gap: 10 },
  promptModalCancelBtn:  { flex: 1, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  promptModalCancelText: { fontFamily: fonts.bold, fontSize: 14, color: colors.red },
  promptModalConfirmBtn: { flex: 1, backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  promptModalConfirmText:{ fontFamily: fonts.bold, fontSize: 14, color: colors.green },

  // ── Squad list ─────────────────────────────────────────────────────────
  squadCard:         { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: radius.md, marginTop: spacing.lg, marginBottom: spacing.md, overflow: 'hidden' },
  squadTitle:        { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.5, color: colors.gold, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  squadHint:         { fontFamily: fonts.body, fontSize: 9, color: colors.textMuted, letterSpacing: 0 },

  squadRow:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, height: ITEM_HEIGHT },
  squadRowBorder:    { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  squadRowPicked:    { backgroundColor: 'rgba(245,197,24,0.12)', borderRadius: radius.sm },
  squadRowTarget:    { backgroundColor: 'rgba(96,165,250,0.06)', borderRadius: radius.sm },

  posNum:            { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 8 },
  posNumText:        { fontFamily: fonts.bold, fontSize: 11, color: colors.navy },

  dragHandle:        { marginRight: 6, paddingHorizontal: 2 },
  dragHandleText:    { fontSize: 16, color: 'rgba(255,255,255,0.2)', lineHeight: 20 },

  squadPlayerBtn:    { flex: 1 },
  squadPlayerName:   { fontFamily: fonts.medium, fontSize: 13, color: colors.textLight },
  dropHint:          { fontFamily: fonts.bold, fontSize: 9, color: '#60A5FA', marginTop: 1 },
  posNumPicked:      { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.gold },
  dragInstructions:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(245,197,24,0.06)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4 },
  dragInstructionsText: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, flex: 1 },
  dragCancelText:    { fontFamily: fonts.bold, fontSize: 12, color: colors.red, marginLeft: 8 },

  squadTagsRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },

  roleTagCaptain:    { minWidth: 24, height: 22, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(245,197,24,0.6)', backgroundColor: 'rgba(245,197,24,0.15)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  roleTagWK:         { minWidth: 28, height: 22, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(96,165,250,0.6)', backgroundColor: 'rgba(96,165,250,0.15)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  roleTagTextC:      { fontFamily: fonts.bold, fontSize: 10, color: colors.gold },
  roleTagTextWK:     { fontFamily: fonts.bold, fontSize: 10, color: '#60A5FA' },

  statusDot:         { width: 8, height: 8, borderRadius: 4, flexShrink: 0, elevation: 2 },
  removeBtn:         { padding: 4 },
  removeBtnText:     { fontFamily: fonts.bold, fontSize: 18, color: colors.textMuted, lineHeight: 18 },

  // ── Actions ────────────────────────────────────────────────────────────
  actionBtns:        { gap: 10, marginTop: spacing.md },
  saveBtn:           { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  btnDisabled:       { opacity: 0.4 },
  saveBtnText:       { fontFamily: fonts.bold, fontSize: 14, color: colors.textLight },
  publishBtn:        { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center' },
  publishBtnText:    { fontFamily: fonts.bold, fontSize: 15, color: colors.navy },
  publishedAt:       { fontFamily: fonts.bold, fontSize: 12, color: colors.green, textAlign: 'center', marginBottom: 4 },
  unlockBtn:         { backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)', borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  unlockBtnText:     { fontFamily: fonts.bold, fontSize: 14, color: colors.gold },

  // ── Role modal ─────────────────────────────────────────────────────────
  modalBackdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:        { backgroundColor: colors.navyLight, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(245,197,24,0.15)', paddingHorizontal: spacing.lg, paddingBottom: 40, paddingTop: 12 },
  modalHandle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  modalTitle:        { fontFamily: fonts.display, fontSize: 22, letterSpacing: 2, color: colors.white, marginBottom: 4 },
  modalSub:          { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginBottom: spacing.lg },

  roleOption:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 8 },
  roleOptionActive:  { borderColor: 'rgba(245,197,24,0.4)', backgroundColor: 'rgba(245,197,24,0.06)' },
  roleOptionActiveWK:{ borderColor: 'rgba(96,165,250,0.4)', backgroundColor: 'rgba(96,165,250,0.06)' },
  roleOptionLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roleOptionBadge:   { width: 32, height: 28, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  roleOptionBadgeC:  { backgroundColor: 'rgba(245,197,24,0.15)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.4)' },
  roleOptionBadgeWK: { backgroundColor: 'rgba(96,165,250,0.15)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.4)' },
  roleOptionBadgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  roleOptionName:    { fontFamily: fonts.bold, fontSize: 15, color: colors.textLight },
  roleOptionNote:    { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  roleOptionCheck:   { fontFamily: fonts.bold, fontSize: 18, color: colors.gold },

  roleOptionClear:   { paddingVertical: 12, alignItems: 'center', marginBottom: 4 },
  roleOptionClearText: { fontFamily: fonts.bold, fontSize: 13, color: colors.red },
  modalClose:        { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  modalCloseText:    { fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },

  // ── Avail override modal ────────────────────────────────────────────────
  availOptionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.md, marginBottom: 8 },
  availOptionDot:  { width: 10, height: 10, borderRadius: 5 },
  availOptionText: { fontFamily: fonts.bold, fontSize: 14 },
})
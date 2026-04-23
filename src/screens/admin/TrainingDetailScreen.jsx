// pavilion-app/src/screens/admin/TrainingDetailScreen.jsx
// Admin view of a training session — 2x2 stats, player list, prompt all

import React, { useState, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { format, parseISO } from 'date-fns'
import { supabase }        from '../../lib/supabase'
import useAuthStore        from '../../store/authStore'
import TopHeader           from '../../components/layout/TopHeader'
import { colors, fonts, spacing, radius } from '../../theme'
import AppIcon from '../../components/AppIcon'
import { sendPushToUser }  from '../../lib/pushNotifications'

function getInitials(name) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || '?'
}

export default function TrainingDetailScreen({ navigation, route }) {
  const { sessionId } = route.params
  const profile = useAuthStore(s => s.profile)

  const [session,    setSession]    = useState(null)
  const [players,    setPlayers]    = useState([])
  const [avail,      setAvail]      = useState({})
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [prompting,  setPrompting]  = useState(false)

  useFocusEffect(useCallback(() => { loadAll() }, []))

  const loadAll = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    await Promise.all([fetchSession(), fetchPlayers()])
    setLoading(false)
    setRefreshing(false)
  }

  const fetchSession = async () => {
    const { data } = await supabase
      .from('training_sessions').select('*').eq('id', sessionId).single()
    if (data) setSession(data)
  }

  const fetchPlayers = async () => {
    // All active club members — exclude pending and rejected accounts
    // Note: PostgREST 'in' filter uses plain comma-separated values, no quotes around each item
    // Only exclude 'pending' — 'rejected' is not a valid user_role enum value in Supabase
    const { data: members, error: membersErr } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_color, role')
      .neq('role', 'pending')
      .order('full_name')

    if (membersErr) console.error('[TrainingDetail] profiles fetch error:', membersErr.message)

    // Fetch all availability responses for this session
    const { data: availability, error: availErr } = await supabase
      .from('training_availability')
      .select('player_id, status')
      .eq('session_id', sessionId)

    if (availErr) console.error('[TrainingDetail] availability fetch error:', availErr.message)

    const availMap = {}
    availability?.forEach(a => { availMap[a.player_id] = a.status })

    setPlayers(members || [])
    setAvail(availMap)
  }

  // ── Prompt all non-responders ─────────────────────────────────────────
  const handlePromptAll = async () => {
    const noReply = players.filter(p => !avail[p.id])
    if (noReply.length === 0) {
      Alert.alert('All Responded', 'All members have set their availability')
      return
    }

    Alert.alert(
      'Prompt All',
      `Send availability reminder to ${noReply.length} member${noReply.length !== 1 ? 's' : ''} who haven't responded?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Prompt All',
          onPress: async () => {
            setPrompting(true)
            try {
              // Insert in-app notification + send device push for each non-responder
              const notifTitle = 'Training Availability'
              const notifBody  = `Please update your availability for ${session?.title} on ${
                session?.session_date
                  ? format(parseISO(session.session_date), 'EEE d MMM')
                  : 'upcoming session'
              }.`

              await Promise.all(
                noReply.map(async p => {
                  try {
                    // In-app notification (Alerts tab)
                    const { error } = await supabase.from('notifications').insert({
                      user_id: p.id,
                      type:    'training_reminder',
                      title:   notifTitle,
                      body:    notifBody,
                      read:    false,
                    })
                    if (error) console.warn('[Prompt] In-app notif failed for', p.id, error.message)

                    // Device push notification
                    sendPushToUser(p.id, notifTitle, notifBody, { type: 'training_reminder' })
                  } catch (err) {
                    console.warn('[Prompt] Exception for player', p.id, err.message)
                  }
                })
              )
              Alert.alert('Done', `Reminder sent to ${noReply.length} player${noReply.length !== 1 ? 's' : ''}`)
            } catch (err) {
              // Catches any unexpected top-level failure
              console.error('[Prompt All] Unexpected error:', err.message)
              Alert.alert('Error', 'Something went wrong sending reminders. Please try again.')
            } finally {
              // Always resets the button — no more stuck "Sending reminders…"
              setPrompting(false)
            }
          },
        },
      ]
    )
  }

  // ── Derived stats — memoised to avoid re-filtering + re-sorting on every render ──
  // Section display order: Available → Unavailable → Not Responded
  const { totalPlayers, availableList, unavailList, notSetList } = useMemo(() => {
    const sortAZ = (a, b) => (a.full_name || '').localeCompare(b.full_name || '')
    return {
      totalPlayers:  players.length,
      availableList: players.filter(p => avail[p.id] === 'available').sort(sortAZ),
      unavailList:   players.filter(p => avail[p.id] === 'unavailable').sort(sortAZ),
      notSetList:    players.filter(p => !avail[p.id]).sort(sortAZ),
    }
  }, [players, avail])

  const STATUS_COLOR = { available: colors.green, unavailable: colors.red }

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
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor={colors.gold} />}
        showsVerticalScrollIndicator={false}>

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AppIcon name="back" size={14} tint={colors.textMuted} />
            <Text style={styles.backText}>Back to Training</Text>
          </View>
        </TouchableOpacity>

        {/* ── Session header ── */}
        <View style={styles.sessionHeader}>
          <Text style={styles.sectionLabel}>TRAINING SESSION</Text>
          <Text style={styles.sessionTitle}>{session?.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 3 }}>
            <AppIcon name="date" size={13} tint={colors.textLight} />
            <Text style={styles.sessionMeta}>{session && format(parseISO(session.session_date), 'EEEE d MMMM yyyy')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 3 }}>
            <AppIcon name="time" size={13} tint={colors.textLight} />
            <Text style={styles.sessionMeta}>{session?.session_time?.slice(0,5)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 3 }}>
            <AppIcon name="venue" size={13} tint={colors.textLight} />
            <Text style={styles.sessionMeta}>{session?.venue}</Text>
          </View>
        </View>

        {/* ── 2x2 stats ── */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Total Players',  value: totalPlayers,          color: colors.textMuted },
            { label: 'Available',      value: availableList.length,  color: colors.green },
            { label: 'Unavailable',    value: unavailList.length,    color: colors.red },
            { label: 'Not Responded',  value: notSetList.length,     color: '#F97316' },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Progress bar ── */}
        {totalPlayers > 0 && (
          <View style={styles.progressBar}>
            {availableList.length > 0 && (
              <View style={{ flex: availableList.length, backgroundColor: colors.green, height: '100%' }} />
            )}
            {unavailList.length > 0 && (
              <View style={{ flex: unavailList.length, backgroundColor: colors.red, height: '100%' }} />
            )}
            {notSetList.length > 0 && (
              <View style={{ flex: notSetList.length, backgroundColor: 'rgba(255,255,255,0.08)', height: '100%' }} />
            )}
          </View>
        )}

        {/* ── Prompt all button ── */}
        {notSetList.length > 0 && (
          <TouchableOpacity
            style={[styles.promptAllBtn, prompting && { opacity: 0.6 }]}
            onPress={handlePromptAll}
            disabled={prompting}
            activeOpacity={0.8}>
            <Text style={styles.promptAllBtnText}>
              {prompting ? 'Sending reminders…' : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AppIcon name="alerts" size={14} tint="#60A5FA" />
                  <Text style={styles.promptAllBtnText}>{`Prompt ${notSetList.length} Non-Responder${notSetList.length !== 1 ? 's' : ''}`}</Text>
                </View>
              )}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Player sections ── */}
        {[
          { list: availableList,  label: 'AVAILABLE',     dot: colors.green,               count: availableList.length },
          { list: unavailList,    label: 'UNAVAILABLE',   dot: colors.red,                 count: unavailList.length },
          { list: notSetList,     label: 'NOT RESPONDED', dot: 'rgba(255,255,255,0.2)',     count: notSetList.length },
        ].filter(section => section.count > 0).map(section => (
          <View key={section.label} style={styles.playerSection}>
            <View style={styles.playerSectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: section.dot }]} />
              <Text style={styles.playerSectionLabel}>{section.label} · {section.count}</Text>
            </View>
            {section.list.map((player, i) => (
              <View key={player.id} style={[styles.playerRow, i < section.list.length - 1 && styles.playerRowBorder]}>
                <View style={[styles.avatar, { backgroundColor: (player.avatar_color || colors.gold) + '22', borderColor: (player.avatar_color || colors.gold) + '44' }]}>
                  <Text style={[styles.avatarText, { color: player.avatar_color || colors.gold }]}>{getInitials(player.full_name)}</Text>
                </View>
                <Text style={styles.playerName}>{player.full_name}</Text>
                <View style={[styles.statusDot, { backgroundColor: section.dot }]} />
              </View>
            ))}
          </View>
        ))}

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: colors.navy },
  scroll:             { flex: 1 },
  content:            { padding: spacing.md, paddingBottom: 60 },
  centred:            { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn:            { marginBottom: spacing.sm },
  backText:           { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },

  sessionHeader:      { marginBottom: spacing.lg },
  sectionLabel:       { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.gold, marginBottom: 6 },
  sessionTitle:       { fontFamily: fonts.display, fontSize: 28, letterSpacing: 1, color: colors.white, lineHeight: 32, marginBottom: 8 },
  sessionMeta:        { fontFamily: fonts.bold, fontSize: 13, color: colors.textLight, marginBottom: 3 },

  statsGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.md },
  statCard:           { width: '47%', backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  statValue:          { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, letterSpacing: 1 },
  statLabel:          { fontFamily: fonts.bold, fontSize: 11, color: colors.textMuted, marginTop: 4 },

  progressBar:        { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', flexDirection: 'row', marginBottom: spacing.lg },

  promptAllBtn:       { backgroundColor: 'rgba(96,165,250,0.1)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)', borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginBottom: spacing.lg },
  promptAllBtnText:   { fontFamily: fonts.bold, fontSize: 14, color: '#60A5FA' },

  playerSection:      { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 12, overflow: 'hidden' },
  playerSectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  sectionDot:         { width: 8, height: 8, borderRadius: 4 },
  playerSectionLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.5, color: colors.textMuted },

  playerRow:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md, paddingVertical: 11 },
  playerRowBorder:    { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  avatar:             { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:         { fontFamily: fonts.bold, fontSize: 10 },
  playerName:         { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textLight },
  statusDot:          { width: 8, height: 8, borderRadius: 4 },
})
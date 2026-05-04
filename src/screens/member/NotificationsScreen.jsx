// pavilion-app/src/screens/member/NotificationsScreen.jsx
// Mirrors pavilion-web/src/pages/member/NotificationsPage.jsx
// Grouped by date: Today / Yesterday / This Week / Month Year

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import useAuthStore from '../../store/authStore'
import TopHeader from '../../components/layout/TopHeader'
import { SCREENS, NOTIF_TYPE_ICON } from '../../lib/constants'
import { colors, fonts, spacing, radius } from '../../theme'
import AppIcon from '../../components/AppIcon'

// ─── Configurable ─────────────────────────────────────────────────────────────
const TYPE_COLOR = {
  availability_reminder: colors.gold,      // gold — fixture prompt
  training_reminder:     '#60A5FA',        // blue — matches training section
  squad_published:       colors.green,     // green — selected in XI
  approval:              colors.green,     // green — membership approved
  role_change:           '#A78BFA',        // purple — captain/admin promotion
  team_added:            colors.green,     // green — added to a team
  announcement:          colors.gold,      // gold — club announcement
  welcome:               '#60A5FA',        // blue
  join_approved:         colors.green,
  join_rejected:         colors.red,
  potm:                  colors.gold,      // gold — player of the match
  custom:                colors.textMuted,
}

// ─── POTM body renderer — bolds player name and points ────────────────────────
// Parses: "{name} is POTM vs {opponent} with {pts} pts!"
function renderPotmBody(body, bodyStyle) {
  const match = body?.match(/^(.+?) is POTM (.+) with (\d+) pts!$/)
  if (!match) return <Text style={bodyStyle} numberOfLines={2}>{body}</Text>
  const [, name, middle, pts] = match
  return (
    <Text style={bodyStyle} numberOfLines={2}>
      <Text style={{ fontFamily: 'DMSans-Bold', color: '#FFFFFF' }}>{name}</Text>
      {` is POTM ${middle} with `}
      <Text style={{ fontFamily: 'DMSans-Bold', color: '#FFFFFF' }}>{pts} pts!</Text>
    </Text>
  )
}

function isToday(dateStr) {
  const d = new Date(dateStr)
  const t = new Date()
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
}

function isYesterday(dateStr) {
  const d = new Date(dateStr)
  const y = new Date(); y.setDate(y.getDate() - 1)
  return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate()
}

function isThisWeek(dateStr) {
  const d    = new Date(dateStr)
  const now  = new Date()
  const diff = (now - d) / (1000 * 60 * 60 * 24)
  return diff < 7
}

function getDateLabel(dateStr) {
  if (isToday(dateStr))     return 'Today'
  if (isYesterday(dateStr)) return 'Yesterday'
  if (isThisWeek(dateStr))  return 'This Week'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function groupByDate(notifications) {
  const groups = {}
  notifications.forEach(n => {
    const label = getDateLabel(n.created_at)
    if (!groups[label]) groups[label] = []
    groups[label].push(n)
  })
  return groups
}

function formatTime(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function NotificationsScreen({ navigation }) {
  const { profile, setUnreadCount } = useAuthStore()

  const [notifications, setNotifications] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState('all') // all | unread

  const fadeAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start()
  }, [])

  useEffect(() => { if (profile?.id) fetchNotifications() }, [profile?.id])

  // ── Real-time: prepend new notifications as they arrive ───────────────────
  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase
      .channel(`notif-screen-${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, (payload) => {
        // Prepend new row — no full refetch needed
        setNotifications(prev => [payload.new, ...prev])
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, (payload) => {
        // Update read status from other clients/sessions
        setNotifications(prev =>
          prev.map(n => n.id === payload.new.id ? { ...n, ...payload.new } : n)
        )
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile?.id])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
      if (data) setNotifications(data)
    } finally {
      setLoading(false)
    }
  }

  const markAllRead = useCallback(async () => {
    const ids = notifications.filter(n => !n.read).map(n => n.id)
    if (ids.length === 0) return
    await supabase.from('notifications').update({ read: true }).in('id', ids)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [notifications])

  const handleClick = useCallback(async (notif) => {
    if (!notif.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', notif.id)
      // Update local state — unreadCount useMemo recalculates, then useEffect syncs badge
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
    }
    // Navigate to fixture detail if fixture_id is present
    if (notif.fixture_id) {
      navigation.navigate(SCREENS.FIXTURE_DETAIL, { fixtureId: notif.fixture_id })
    }
    // Navigate to Fixtures tab and open training modal if session_id is present
    if (notif.type === 'training_reminder' && notif.session_id) {
      navigation.navigate(SCREENS.FIXTURES, { openSessionId: notif.session_id })
    }
  }, [navigation])

  const handleDelete = useCallback(async (id) => {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  // ── Derived values — memoised to avoid recalculation on every render ────────
  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  )
  const filtered = useMemo(
    () => filter === 'unread' ? notifications.filter(n => !n.read) : notifications,
    [filter, notifications]
  )
  const grouped = useMemo(() => groupByDate(filtered), [filtered])

  // ── Sync local unread count → authStore badge whenever notifications change ─
  // Fixes bug where setUnreadCount was called with a function (not a value)
  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length)
  }, [notifications])

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
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.sectionLabel}>YOUR ACCOUNT</Text>
                <Text style={styles.pageTitle}>NOTIFICATIONS</Text>
              </View>
              <TouchableOpacity
                onPress={markAllRead}
                style={[styles.markReadBtn, unreadCount === 0 && styles.markReadBtnDisabled]}
                activeOpacity={unreadCount > 0 ? 0.7 : 1}
                disabled={unreadCount === 0}
              >
                <Text style={[styles.markReadText, unreadCount === 0 && styles.markReadTextDisabled]}>
                  ✓ Mark all read
                </Text>
              </TouchableOpacity>
            </View>

            {/* Stats + filter */}
            <View style={styles.statsRow}>
              <View style={styles.statsLeft}>
                <Text style={styles.statsText}>
                  <Text style={styles.statsNum}>{notifications.length}</Text> total
                </Text>
                {unreadCount > 0 && (
                  <Text style={styles.statsText}>
                    <Text style={[styles.statsNum, { color: colors.gold }]}>{unreadCount}</Text> unread
                  </Text>
                )}
              </View>
              <View style={styles.filterToggle}>
                {[{ key: 'all', label: 'All' }, { key: 'unread', label: 'Unread' }].map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setFilter(opt.key)}
                    style={[styles.filterBtn, filter === opt.key && styles.filterBtnActive]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterBtnText, filter === opt.key && { color: colors.gold, fontWeight: '700' }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Loading */}
          {loading && <Text style={styles.loadingText}>Loading…</Text>}

          {/* Empty */}
          {!loading && filtered.length === 0 && (
            <View style={styles.emptyCard}>
              <AppIcon name="alerts" size={36} tint={colors.textMuted} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>
                {filter === 'unread' ? 'ALL CAUGHT UP' : 'NO NOTIFICATIONS YET'}
              </Text>
              <Text style={styles.emptyText}>
                {filter === 'unread'
                  ? 'No unread notifications'
                  : 'Availability reminders and squad announcements will appear here'}
              </Text>
            </View>
          )}

          {/* Grouped notifications */}
          {!loading && Object.entries(grouped).map(([label, items]) => (
            <View key={label} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupLabel}>{label.toUpperCase()}</Text>
                <Text style={styles.groupCount}>{items.length} notification{items.length !== 1 ? 's' : ''}</Text>
              </View>

              {items.map(notif => {
                const accentColor = TYPE_COLOR[notif.type] || colors.textMuted
                return (
                  <TouchableOpacity
                    key={notif.id}
                    onPress={() => handleClick(notif)}
                    activeOpacity={notif.fixture_id ? 0.7 : 1}
                    style={[
                      styles.notifCard,
                      { borderLeftColor: notif.read ? 'transparent' : accentColor },
                      !notif.read && styles.notifCardUnread,
                    ]}
                  >
                    {/* Notification type icon badge */}
                    <View style={[styles.notifIconWrap, { backgroundColor: `${accentColor}15`, borderColor: `${accentColor}30` }]}>
                      <AppIcon
                        name={NOTIF_TYPE_ICON[notif.type] || 'send'}
                        size={18}
                        tint={accentColor}
                      />
                    </View>

                    {/* Content */}
                    <View style={styles.notifContent}>
                      <View style={styles.notifTitleRow}>
                        <Text style={[styles.notifTitle, { fontFamily: fonts.bold }]} numberOfLines={1}>
                          {notif.title?.toUpperCase()}
                        </Text>
                        <Text style={styles.notifTime}>{formatTime(notif.created_at)}</Text>
                      </View>
                      {notif.type === 'potm'
                        ? renderPotmBody(notif.body, styles.notifBody)
                        : <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
                      }
                      {notif.fixture_id && (
                        <Text style={[styles.notifAction, { color: accentColor }]}>
                          {notif.type === 'squad_published'
                            ? 'Tap to view fixture →'
                            : notif.type === 'potm'
                            ? 'Tap to view scorecard →'
                            : 'Tap to set availability →'}
                        </Text>
                      )}
                    </View>

                    {/* Right: unread dot + delete */}
                    <View style={styles.notifRight}>
                      {!notif.read && (
                        <View style={[styles.unreadDot, { backgroundColor: accentColor }]} />
                      )}
                      <TouchableOpacity
                        onPress={() => handleDelete(notif.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.deleteIcon}>×</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          ))}

          <View style={{ height: 32 }} />
        </Animated.View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.navy },
  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: spacing.md },

  header:       { paddingTop: spacing.lg, marginBottom: spacing.lg },
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.md },
  sectionLabel: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 2, color: colors.gold, textTransform: 'uppercase', marginBottom: 4 },
  pageTitle:    { fontFamily: fonts.display, fontSize: 36, letterSpacing: 2, color: colors.white, lineHeight: 40 },
  markReadBtn:  { backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)', borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  markReadText:         { fontFamily: fonts.body, fontWeight: '600', fontSize: 13, color: colors.gold },
  markReadBtnDisabled:  { opacity: 0.35 },
  markReadTextDisabled: { color: colors.textMuted },

  statsRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsLeft:    { flexDirection: 'row', gap: 16 },
  statsText:    { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  statsNum:     { color: colors.white, fontWeight: '700' },
  filterToggle: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, overflow: 'hidden' },
  filterBtn:    { paddingHorizontal: 16, paddingVertical: 7 },
  filterBtnActive:{ backgroundColor: 'rgba(245,197,24,0.12)' },
  filterBtnText:{ fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  loadingText:  { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
  emptyCard:    { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', marginTop: spacing.md },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyTitle:   { fontFamily: fonts.display, fontSize: 22, letterSpacing: 1, color: colors.white, marginBottom: 8 },
  emptyText:    { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  group:        { marginBottom: spacing.xl },
  groupHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 8 },
  groupLabel:   { fontFamily: fonts.body, fontWeight: '700', fontSize: 11, letterSpacing: 2, color: colors.textMuted },
  groupCount:   { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },

  notifCard:    { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, borderRadius: radius.md, padding: 14, marginBottom: 6, gap: 12 },
  notifCardUnread:{ backgroundColor: 'rgba(245,197,24,0.02)' },

  notifIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  notifIconEmoji: { fontSize: 22, lineHeight: 28 },

  notifContent: { flex: 1, minWidth: 0 },
  notifTitleRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  notifTitle:   { fontFamily: fonts.body, fontWeight: '500', fontSize: 14, color: colors.white, flex: 1 },
  notifTime:    { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, whiteSpace: 'nowrap' },
  notifBody:    { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  notifAction:  { fontFamily: fonts.body, fontWeight: '600', fontSize: 12, marginTop: 5 },
  notifRight:   { alignItems: 'center', gap: 8, flexShrink: 0 },
  unreadDot:    { width: 8, height: 8, borderRadius: 4 },
  deleteIcon:   { fontSize: 18, color: colors.textMuted, lineHeight: 22 },
})
// pavilion-app/src/screens/captain/CaptainTrainingScreen.jsx
// Captain read-only training view — upcoming sessions, attendance counts, prompt players

import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { format, parseISO } from 'date-fns'
import { supabase }      from '../../lib/supabase'
import useAuthStore      from '../../store/authStore'
import TopHeader         from '../../components/layout/TopHeader'
import { colors, fonts, spacing, radius } from '../../theme'
import { SCREENS, toTitleCase } from '../../lib/constants'
import AppIcon           from '../../components/AppIcon'

function toLocalISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function CaptainTrainingScreen({ navigation }) {
  const profile = useAuthStore(s => s.profile)

  const [sessions,   setSessions]   = useState([])
  const [counts,     setCounts]     = useState({})   // { [sessionId]: { available, tentative, unavailable, noReply, total } }
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useFocusEffect(useCallback(() => { loadSessions() }, []))

  const loadSessions = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const today = toLocalISO(new Date())
      const { data: sess } = await supabase
        .from('training_sessions')
        .select('*')
        .gte('session_date', today)
        .order('session_date', { ascending: true })

      if (!sess?.length) { setSessions([]); setCounts({}); return }
      setSessions(sess)

      // Attendance counts for all sessions in one pass
      const sessionIds = sess.map(s => s.id)
      const [{ data: avail }, { data: members }] = await Promise.all([
        supabase.from('training_attendance').select('session_id, status').in('session_id', sessionIds),
        supabase.from('profiles').select('id').in('role', ['member', 'captain', 'admin', 'superadmin']),
      ])

      const totalMembers = members?.length || 0
      const countMap = {}
      avail?.forEach(a => {
        if (!countMap[a.session_id]) countMap[a.session_id] = { available: 0, tentative: 0, unavailable: 0 }
        if (countMap[a.session_id][a.status] !== undefined) countMap[a.session_id][a.status]++
      })

      const result = {}
      sess.forEach(s => {
        const c      = countMap[s.id] || { available: 0, tentative: 0, unavailable: 0 }
        const sumResp = c.available + c.tentative + c.unavailable
        result[s.id] = { ...c, noReply: Math.max(0, totalMembers - sumResp), total: totalMembers }
      })
      setCounts(result)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  if (loading) return (
    <View style={styles.container}><TopHeader />
      <View style={styles.centred}><ActivityIndicator color={colors.gold} size="large" /></View>
    </View>
  )

  return (
    <View style={styles.container}>
      <TopHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadSessions(true)} tintColor={colors.gold} />}
        showsVerticalScrollIndicator={false}>

        <View style={styles.pageHeader}>
          <Text style={styles.sectionLabel}>CAPTAIN</Text>
          <Text style={styles.pageTitle}>TRAINING</Text>
        </View>

        {sessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <AppIcon name="training" size={36} tint={colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>NO UPCOMING SESSIONS</Text>
            <Text style={styles.emptyText}>No training sessions scheduled</Text>
          </View>
        ) : (
          sessions.map(session => {
            const c = counts[session.id] || { available: 0, tentative: 0, unavailable: 0, noReply: 0, total: 0 }
            const dow = new Date(session.session_date + 'T12:00:00').getDay()
            const accentColor = dow === 6 ? colors.gold : '#60A5FA'

            return (
              <TouchableOpacity
                key={session.id}
                style={[styles.sessionCard, { borderLeftColor: accentColor }]}
                onPress={() => navigation.navigate(SCREENS.TRAINING_DETAIL, { sessionId: session.id })}
                activeOpacity={0.8}
              >
                {/* Date block */}
                <View style={[styles.dateBlock, { borderRightColor: accentColor + '40' }]}>
                  <Text style={[styles.dateNum, { color: accentColor }]}>
                    {format(parseISO(session.session_date), 'dd')}
                  </Text>
                  <Text style={styles.dateDow}>{format(parseISO(session.session_date), 'EEE').toUpperCase()}</Text>
                  <Text style={styles.dateMon}>{format(parseISO(session.session_date), 'MMM').toUpperCase()}</Text>
                </View>

                {/* Info */}
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionTitle} numberOfLines={1}>{session.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                    <AppIcon name="venue" size={11} tint={colors.textLight} />
                    <Text style={styles.sessionMeta}>{session.venue}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                    <AppIcon name="time" size={11} tint={colors.textLight} />
                    <Text style={styles.sessionMeta}>{session.session_time?.slice(0,5)}</Text>
                  </View>

                  {/* Availability counts */}
                  <View style={styles.countRow}>
                    {c.available   > 0 && <View style={styles.countItem}><View style={[styles.countDot,{backgroundColor:colors.green}]}/><Text style={[styles.countNum,{color:colors.green}]}>{c.available}</Text></View>}
                    {c.tentative   > 0 && <View style={styles.countItem}><View style={[styles.countDot,{backgroundColor:'#F97316'}]}/><Text style={[styles.countNum,{color:'#F97316'}]}>{c.tentative}</Text></View>}
                    {c.unavailable > 0 && <View style={styles.countItem}><View style={[styles.countDot,{backgroundColor:colors.red}]}/><Text style={[styles.countNum,{color:colors.red}]}>{c.unavailable}</Text></View>}
                    {c.noReply     > 0 && <View style={styles.countItem}><View style={[styles.countDot,{backgroundColor:'rgba(255,255,255,0.2)'}]}/><Text style={[styles.countNum,{color:colors.textMuted}]}>{c.noReply}</Text></View>}
                    <Text style={styles.countLabel}>/ {c.total}</Text>
                  </View>

                  {/* Mini progress bar */}
                  {c.total > 0 && (
                    <View style={styles.progressBar}>
                      {c.available   > 0 && <View style={{width:`${(c.available/c.total)*100}%`,   backgroundColor:colors.green, height:'100%'}}/>}
                      {c.tentative   > 0 && <View style={{width:`${(c.tentative/c.total)*100}%`,   backgroundColor:'#F97316',    height:'100%'}}/>}
                      {c.unavailable > 0 && <View style={{width:`${(c.unavailable/c.total)*100}%`, backgroundColor:colors.red,   height:'100%'}}/>}
                    </View>
                  )}
                </View>

                <AppIcon name="back" size={12} tint={colors.textMuted} style={{ transform: [{ rotate: '180deg' }] }} />
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.navy },
  scroll:      { flex: 1 },
  content:     { padding: spacing.md, paddingBottom: 60 },
  centred:     { flex: 1, justifyContent: 'center', alignItems: 'center' },

  pageHeader:  { marginBottom: spacing.lg },
  sectionLabel:{ fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.green, marginBottom: 4 },
  pageTitle:   { fontFamily: fonts.display, fontSize: 36, letterSpacing: 2, color: colors.white, lineHeight: 40 },

  emptyCard:   { backgroundColor: colors.navyLight, borderRadius: radius.md, padding: 48, alignItems: 'center' },
  emptyTitle:  { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1, color: colors.white, marginBottom: 6 },
  emptyText:   { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  sessionCard: { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, borderRadius: radius.md, marginBottom: 12, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', paddingRight: spacing.md },
  dateBlock:   { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRightWidth: 1, minWidth: 56 },
  dateNum:     { fontFamily: fonts.display, fontSize: 26, lineHeight: 28 },
  dateDow:     { fontFamily: fonts.bold, fontSize: 9, color: colors.textMuted, letterSpacing: 1 },
  dateMon:     { fontFamily: fonts.bold, fontSize: 9, color: colors.textMuted },
  sessionInfo: { flex: 1, paddingVertical: 12, paddingHorizontal: 12 },
  sessionTitle:{ fontFamily: fonts.bold, fontSize: 14, color: colors.white, marginBottom: 4 },
  sessionMeta: { fontFamily: fonts.bold, fontSize: 11, color: colors.textLight },

  countRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' },
  countItem:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  countDot:    { width: 7, height: 7, borderRadius: 4 },
  countNum:    { fontFamily: fonts.bold, fontSize: 11 },
  countLabel:  { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },

  progressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', overflow: 'hidden', borderRadius: 2 },
})

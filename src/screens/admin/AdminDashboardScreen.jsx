// pavilion-app/src/screens/admin/AdminDashboardScreen.jsx
// Admin overview — stats, pending approvals, join requests, upcoming fixtures, announcements

import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, Alert, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import useAuthStore from '../../store/authStore'
import TopHeader from '../../components/layout/TopHeader'
import { colors, fonts, spacing, radius } from '../../theme'
import { SCREENS, MATCH_TYPE_LABELS } from '../../lib/constants'
import AppIcon from '../../components/AppIcon'

// ─── Configurable ─────────────────────────────────────────────────────────────
const FIXTURE_LIMIT = 6

const AUDIENCE_META = {
  all:     { color: colors.gold,    label: 'All Members' },
  member:  { color: colors.textMuted, label: 'Members' },
  captain: { color: colors.green,   label: 'Captains' },
  admin:   { color: '#A78BFA',      label: 'Admins' },
}

export default function AdminDashboardScreen({ navigation }) {
  const profile = useAuthStore(s => s.profile)

  const [stats,         setStats]         = useState({ members: 0, pending: 0, fixtures: 0, teams: 5 })
  const [pending,       setPending]       = useState([])
  const [joinRequests,  setJoinRequests]  = useState([])
  const [fixtures,      setFixtures]      = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)

  useFocusEffect(useCallback(() => { loadAll() }, []))

  // ── Real-time: re-fetch when profiles or join_requests change ─────────────
  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'profiles',
      }, () => { fetchPending(); fetchStats() })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'join_requests',
      }, () => fetchJoinRequests())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'fixtures',
      }, () => { fetchFixtures(); fetchStats() })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const loadAll = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    await Promise.all([fetchStats(), fetchPending(), fetchJoinRequests(), fetchFixtures(), fetchAnnouncements()])
    setLoading(false)
    setRefreshing(false)
  }

  const fetchStats = async () => {
    const [members, pend, fix] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact' }).neq('role', 'pending'),
      supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'pending'),
      supabase.from('fixtures').select('id', { count: 'exact' }).gte('match_date', new Date().toISOString().split('T')[0]),
    ])
    setStats({ members: members.count || 0, pending: pend.count || 0, fixtures: fix.count || 0, teams: 5 })
  }

  const fetchPending = async () => {
    const { data } = await supabase
      .from('profiles').select('id, full_name, phone, created_at')
      .eq('role', 'pending').order('created_at', { ascending: true })
    if (data) setPending(data)
  }

  const fetchJoinRequests = async () => {
    const { data, error } = await supabase
      .from('join_requests')
      .select('id, player_id, team_id, status, requested_at, teams(name)')
      .eq('status', 'pending').order('requested_at', { ascending: true })
    if (error || !data || data.length === 0) { setJoinRequests([]); return }
    const playerIds = [...new Set(data.map(r => r.player_id))]
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', playerIds)
    const profileMap = {}
    profiles?.forEach(p => { profileMap[p.id] = p.full_name })
    setJoinRequests(data.map(r => ({ ...r, playerName: profileMap[r.player_id] || 'Unknown' })))
  }

  const fetchFixtures = async () => {
    const { data } = await supabase.from('fixtures')
      .select('*, teams(name)').gte('match_date', new Date().toISOString().split('T')[0])
      .order('match_date', { ascending: true }).limit(FIXTURE_LIMIT)
    if (data) setFixtures(data)
  }

  const fetchAnnouncements = async () => {
    const { data } = await supabase.from('announcements')
      .select('id, title, target_role, created_at, profiles(full_name)')
      .order('created_at', { ascending: false }).limit(3)
    if (data) setAnnouncements(data)
  }

  const handleApprove = async (memberId, name) => {
    const { error } = await supabase.from('profiles').update({ role: 'member' }).eq('id', memberId)
    if (error) { Alert.alert('Error', 'Failed to approve member'); return }
    setPending(prev => prev.filter(p => p.id !== memberId))
    setStats(prev => ({ ...prev, pending: prev.pending - 1, members: prev.members + 1 }))
  }

  const handleReject = async (memberId, name) => {
    Alert.alert('Reject Application', `Reject and remove ${name}'s application?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
        // DELETE profile row — 'rejected' is not a valid role enum
        await supabase.from('profiles').delete().eq('id', memberId)
        setPending(prev => prev.filter(p => p.id !== memberId))
        setStats(prev => ({ ...prev, pending: prev.pending - 1 }))
      }},
    ])
  }

  const handleApproveJoin = async (req) => {
    const { error } = await supabase.from('team_members')
      .insert({ player_id: req.player_id, team_id: req.team_id, status: 'active' })
    if (error) { Alert.alert('Error', 'Failed to add to team'); return }
    await supabase.from('join_requests').update({ status: 'approved' }).eq('id', req.id)
    setJoinRequests(prev => prev.filter(r => r.id !== req.id))
  }

  const handleRejectJoin = async (req) => {
    await supabase.from('join_requests').update({ status: 'rejected' }).eq('id', req.id)
    setJoinRequests(prev => prev.filter(r => r.id !== req.id))
  }

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  if (loading) {
    return (
      <View style={styles.container}>
        <TopHeader />
        <View style={styles.centred}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <TopHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor={colors.gold} />}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <Text style={styles.sectionLabel}>ADMINISTRATION</Text>
          <Text style={styles.pageTitle}>ADMIN OVERVIEW</Text>
          <Text style={styles.pageSub}>Harrow Town Cricket Club · {new Date().getFullYear()}</Text>
        </View>

        {/* ── Stats 2×2 ── */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Active Members',    value: stats.members,  color: colors.green },
            { label: 'Pending Approval',  value: stats.pending,  color: '#F97316', urgent: stats.pending > 0 },
            { label: 'Upcoming Fixtures', value: stats.fixtures, color: colors.gold },
            { label: 'Active Teams',      value: stats.teams,    color: colors.textMuted },
          ].map(s => (
            <View key={s.label} style={[styles.statCard, s.urgent && styles.statCardUrgent]}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
              {s.urgent && <Text style={styles.urgentBadge}>ACTION REQUIRED</Text>}
            </View>
          ))}
        </View>

        {/* ── Pending member approvals ── */}
        {pending.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MEMBERSHIP</Text>
            <Text style={styles.sectionTitle}>Pending Approvals</Text>
            {pending.map(member => (
              <View key={member.id} style={styles.memberCard}>
                <View style={styles.memberCardLeft}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{getInitials(member.full_name)}</Text>
                  </View>
                  <View>
                    <Text style={styles.memberName}>{member.full_name}</Text>
                    <Text style={styles.memberSub}>{member.phone || 'No phone'}</Text>
                    <Text style={styles.memberSub}>Joined {format(parseISO(member.created_at), 'd MMM yyyy')}</Text>
                  </View>
                </View>
                <View style={styles.approvalBtns}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(member.id, member.full_name)} activeOpacity={0.8}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <AppIcon name="approve" size={13} tint={colors.green} />
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(member.id, member.full_name)} activeOpacity={0.8}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <AppIcon name="reject" size={13} tint={colors.red} />
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Team join requests ── */}
        {joinRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SQUADS</Text>
            <Text style={styles.sectionTitle}>Join Requests</Text>
            {joinRequests.map(req => (
              <View key={req.id} style={styles.joinCard}>
                <View style={styles.joinCardLeft}>
                  <View style={styles.avatarCircleGold}>
                    <Text style={styles.avatarTextGold}>{getInitials(req.playerName)}</Text>
                  </View>
                  <View>
                    <Text style={styles.memberName}>{req.playerName}</Text>
                    <Text style={styles.memberSub}>Requesting <Text style={styles.teamName}>{req.teams?.name}</Text></Text>
                  </View>
                </View>
                <View style={styles.approvalBtns}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleApproveJoin(req)} activeOpacity={0.8}>
                    <AppIcon name="approve" size={14} tint={colors.green} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRejectJoin(req)} activeOpacity={0.8}>
                    <AppIcon name="reject" size={14} tint={colors.red} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Upcoming fixtures ── */}
        {fixtures.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <View>
                <Text style={styles.sectionLabel}>SCHEDULE</Text>
                <Text style={styles.sectionTitle}>Upcoming Fixtures</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate(SCREENS.ADMIN_FIXTURES)} activeOpacity={0.7}>
                <Text style={styles.seeAll}>+ Add →</Text>
              </TouchableOpacity>
            </View>
            {fixtures.map(f => (
              <View key={f.id} style={styles.fixtureRow}>
                <View style={styles.fixtureDateBlock}>
                  <Text style={styles.fixtureDateNum}>{format(parseISO(f.match_date), 'dd')}</Text>
                  <Text style={styles.fixtureDateMon}>{format(parseISO(f.match_date), 'MMM')}</Text>
                </View>
                <View style={styles.fixtureInfo}>
                  <View style={styles.fixtureTagRow}>
                    <View style={styles.teamBadge}><Text style={styles.teamBadgeText}>{f.teams?.name}</Text></View>
                    {(() => {
                      const hwCfg = f.home_away === 'home'
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
                  <Text style={styles.fixtureTitle}>HTCC <Text style={styles.vsText}>vs</Text> {f.opponent?.toUpperCase()}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 1 }}>
                    <AppIcon name="venue" size={11} tint={colors.textLight} />
                    <Text style={styles.fixtureMeta}>{f.venue}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <AppIcon name="time" size={11} tint={colors.textLight} />
                    <Text style={styles.fixtureMeta}>{f.match_time?.slice(0,5)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Recent announcements ── */}
        {announcements.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <View>
                <Text style={styles.sectionLabel}>COMMUNICATIONS</Text>
                <Text style={styles.sectionTitle}>Announcements</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate(SCREENS.ADMIN_TRAINING)} activeOpacity={0.7}>
                <Text style={styles.seeAll}>All →</Text>
              </TouchableOpacity>
            </View>
            {announcements.map(ann => {
              const meta = AUDIENCE_META[ann.target_role] || AUDIENCE_META.all
              return (
                <TouchableOpacity key={ann.id} style={[styles.annCard, { borderTopColor: meta.color }]}
                  onPress={() => navigation.navigate(SCREENS.ADMIN_TRAINING)} activeOpacity={0.8}>
                  <View style={styles.annCardTop}>
                    <View style={[styles.audienceBadge, { backgroundColor: meta.color + '18', borderColor: meta.color + '44' }]}>
                      <Text style={[styles.audienceBadgeText, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.annDate}>{format(parseISO(ann.created_at), 'd MMM')}</Text>
                  </View>
                  <Text style={styles.annTitle}>{ann.title}</Text>
                  {ann.profiles?.full_name && <Text style={styles.annBy}>by {ann.profiles.full_name}</Text>}
                </TouchableOpacity>
              )
            })}
          </View>
        )}

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.navy },
  scroll:         { flex: 1 },
  content:        { padding: spacing.md, paddingBottom: 60 },
  centred:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn:        { marginBottom: spacing.sm },
  backText:       { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },

  pageHeader:     { marginBottom: spacing.lg },
  sectionLabel:   { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.gold, marginBottom: 4 },
  pageTitle:      { fontFamily: fonts.display, fontSize: 36, letterSpacing: 2, color: colors.white, lineHeight: 40 },
  pageSub:        { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 4 },

  statsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.lg },
  statCard:       { width: '47%', backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  statCardUrgent: { borderColor: 'rgba(249,115,22,0.3)', backgroundColor: 'rgba(249,115,22,0.04)' },
  statValue:      { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, letterSpacing: 1 },
  statLabel:      { fontFamily: fonts.bold, fontSize: 11, color: colors.textMuted, marginTop: 4 },
  urgentBadge:    { fontFamily: fonts.bold, fontSize: 9, color: '#F97316', letterSpacing: 1, marginTop: 4 },

  section:        { marginBottom: spacing.xl },
  sectionRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.sm },
  sectionTitle:   { fontFamily: fonts.display, fontSize: 22, letterSpacing: 1, color: colors.white, lineHeight: 26 },
  seeAll:         { fontFamily: fonts.bold, fontSize: 12, color: colors.gold },

  memberCard:     { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  memberCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatarCircle:   { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(245,197,24,0.1)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontFamily: fonts.bold, fontSize: 12, color: colors.gold },
  avatarCircleGold: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarTextGold: { fontFamily: fonts.bold, fontSize: 12, color: colors.gold },
  memberName:     { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  memberSub:      { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  teamName:       { fontFamily: fonts.bold, color: colors.gold },
  approvalBtns:   { gap: 6 },
  approveBtn:     { backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 7 },
  approveBtnText: { fontFamily: fonts.bold, fontSize: 12, color: colors.green },
  rejectBtn:      { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 7 },
  rejectBtnText:  { fontFamily: fonts.bold, fontSize: 12, color: colors.red },
  joinCard:       { backgroundColor: 'rgba(245,197,24,0.03)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.15)', borderRadius: radius.md, padding: spacing.md, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  joinCardLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },

  fixtureRow:     { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: 8, flexDirection: 'row', gap: 14 },
  fixtureDateBlock:{ alignItems: 'center', justifyContent: 'center', paddingRight: 14, borderRightWidth: 1, borderRightColor: colors.border, minWidth: 40 },
  fixtureDateNum: { fontFamily: fonts.display, fontSize: 26, color: colors.gold, lineHeight: 28 },
  fixtureDateMon: { fontFamily: fonts.bold, fontSize: 10, color: colors.textMuted, letterSpacing: 1 },
  fixtureInfo:    { flex: 1 },
  fixtureTagRow:  { flexDirection: 'row', gap: 6, marginBottom: 6, alignItems: 'center' },
  teamBadge:      { backgroundColor: 'rgba(245,197,24,0.1)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, alignItems: 'center', justifyContent: 'center' },
  teamBadgeText:  { fontFamily: fonts.bold, fontSize: 10, color: colors.gold, letterSpacing: 0.5 },
  hwBadge:        { borderWidth: 1, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 },
  hwBadgeText:    { fontFamily: fonts.bold, fontSize: 10 },
  fixtureTitle:   { fontFamily: fonts.bold, fontSize: 14, color: colors.white, marginBottom: 3 },
  vsText:         { fontFamily: fonts.display, fontSize: 14, color: colors.gold },
  fixtureMeta:    { fontFamily: fonts.bold, fontSize: 11, color: colors.textLight, marginBottom: 1 },

  annCard:        { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderTopWidth: 3, borderRadius: radius.md, padding: spacing.md, marginBottom: 8 },
  annCardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  audienceBadge:  { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  audienceBadgeText: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1 },
  annDate:        { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  annTitle:       { fontFamily: fonts.bold, fontSize: 14, color: colors.white, marginBottom: 3 },
  annBy:          { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
})
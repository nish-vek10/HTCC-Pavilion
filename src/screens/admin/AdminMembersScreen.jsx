// pavilion-app/src/screens/admin/AdminMembersScreen.jsx
// Admin member management — list, role change, team assignment

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View, Text, FlatList, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, RefreshControl, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { toTitleCase } from '../../lib/constants'
import useAuthStore from '../../store/authStore'
import TopHeader from '../../components/layout/TopHeader'
import { colors, fonts, spacing, radius } from '../../theme'
import { sendPushToUser, insertNotification } from '../../lib/pushNotifications'
import AppIcon from '../../components/AppIcon'

// ─── Configurable ─────────────────────────────────────────────────────────────
const ROLE_COLOURS = {
  superadmin: '#A78BFA',
  admin:      colors.gold,
  captain:    colors.green,
  member:     colors.textMuted,
  pending:    '#F97316',
}

const FILTER_TABS = [
  { key: 'all',     label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'member',  label: 'Members' },
  { key: 'captain', label: 'Captains' },
  { key: 'admin',   label: 'Admins' },
]

// Pure helper — defined at module level so it is never recreated on re-render
function getInitials(name) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

export default function AdminMembersScreen({ navigation }) {
  const currentUser  = useAuthStore(s => s.profile)
  const isSuperAdmin = useAuthStore(s => s.isSuperAdmin)

  const [members,         setMembers]         = useState([])
  const [teams,           setTeams]           = useState([])
  const [loading,         setLoading]         = useState(true)
  const [refreshing,      setRefreshing]      = useState(false)
  const [search,          setSearch]          = useState('')
  const [filter,          setFilter]          = useState('all')
  const [roleModal,       setRoleModal]       = useState({ open: false, member: null })
  // Captain team picker — shown after selecting 'captain' role
  const [captainTeamModal, setCaptainTeamModal] = useState({ open: false, memberId: null, memberName: '' })
  // Play Cricket ID editor
  const [pcModal, setPcModal] = useState({ open: false, member: null, value: '' })
  const [savingPcId, setSavingPcId] = useState(false)

  useFocusEffect(useCallback(() => { loadAll() }, []))

  // ── Real-time: refresh member list on any profile change ─────────────────
  useEffect(() => {
    const channel = supabase
      .channel('admin-members-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'profiles',
      }, () => fetchMembers())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'team_members',
      }, () => fetchMembers())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const loadAll = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      await Promise.all([fetchMembers(), fetchTeams()])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchMembers = async () => {
    const { data } = await supabase.from('profiles')
      .select('id, full_name, phone, role, created_at, pc_member_id, team_members(team_id, teams(name))')
      .order('full_name')
    if (data) setMembers(data)
  }

  const fetchTeams = async () => {
    const { data } = await supabase.from('teams').select('id, name').order('name')
    if (data) setTeams(data)
  }

  const getRoleOptions = () => {
    if (isSuperAdmin?.()) return ['member', 'captain', 'admin']
    return ['member', 'captain']
  }

  const handleRoleChange = async (memberId, newRole, memberName) => {
    if (memberId === currentUser.id) { Alert.alert('Error', "You can't change your own role"); return }
    if (newRole === 'admin' && !isSuperAdmin?.()) { Alert.alert('Error', 'Only a Super Admin can promote to Admin'); return }

    // Rejected = DELETE profile row entirely — 'rejected' is not a valid role enum
    // Use SECURITY DEFINER RPC — direct delete is blocked by RLS
    if (newRole === 'rejected') {
      const { data: deleted, error } = await supabase.rpc('delete_pending_profile', { p_member_id: memberId })
      if (error || !deleted) {
        Alert.alert('Error', 'Failed to reject application. Please try again.')
        return
      }
      setMembers(prev => prev.filter(m => m.id !== memberId))
      setRoleModal({ open: false, member: null })
      return
    }

    // Captain — close role modal first, show team picker to assign which team
    if (newRole === 'captain') {
      setRoleModal({ open: false, member: null })
      setCaptainTeamModal({ open: true, memberId, memberName })
      return
    }

    await applyRoleChange(memberId, newRole, memberName)
  }

  // ── Confirm captain + team assignment ──────────────────────────────────────
  const handleCaptainTeamSelect = async (teamId, teamName) => {
    const { memberId, memberName } = captainTeamModal
    setCaptainTeamModal({ open: false, memberId: null, memberName: '' })

    // 1. Set role = captain on profile
    const { error } = await supabase.from('profiles').update({ role: 'captain' }).eq('id', memberId)
    if (error) { Alert.alert('Error', 'Failed to update role'); return }

    // 2. Clear is_captain on all their existing team_members rows
    await supabase.from('team_members').update({ is_captain: false }).eq('player_id', memberId)

    // 3. Set is_captain = true for the selected team (upsert ensures row exists)
    await supabase.from('team_members').upsert(
      { player_id: memberId, team_id: teamId, status: 'active', is_captain: true },
      { onConflict: 'player_id,team_id' }
    )

    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: 'captain' } : m))
    sendPushToUser(memberId, "You've Been Made Captain", `Congratulations! You are now captain of ${teamName}. You have access to the Captain panel and squad selection.`, { type: 'role_change' })
    insertNotification(memberId, 'role_change', "You've Been Made Captain", `Congratulations! You are now captain of ${teamName}.`)
  }

  const applyRoleChange = async (memberId, newRole, memberName) => {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', memberId)
    if (error) { Alert.alert('Error', 'Failed to update role'); return }

    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))

    // If demoted from captain, clear is_captain flag
    if (newRole === 'member') {
      await supabase.from('team_members').update({ is_captain: false }).eq('player_id', memberId)
    }

    let notifTitle = '', notifBody = '', notifType = 'role_change'
    if (newRole === 'member') {
      notifTitle = 'Application Approved'
      notifBody  = 'Welcome to Harrow Town Cricket Club! Your membership has been approved. You now have full access to Pavilion.'
      notifType  = 'approval'
    } else if (newRole === 'admin') {
      notifTitle = "You've Been Made Admin"
      notifBody  = 'You have been granted Admin access to the Pavilion platform. You can now manage fixtures, members, and training sessions.'
    }
    if (notifTitle) {
      sendPushToUser(memberId, notifTitle, notifBody, { type: notifType })
      insertNotification(memberId, notifType, notifTitle, notifBody)
    }
    setRoleModal({ open: false, member: null })
  }

  const handleApprove = (member) => handleRoleChange(member.id, 'member', member.full_name)

  const handleReject = (member) => {
    Alert.alert('Reject Application', `Reject ${member.full_name}'s application?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => handleRoleChange(member.id, 'rejected', member.full_name) },
    ])
  }

  const handleTeamToggle = async (memberId, memberName, teamId, teamName, isAssigned) => {
    if (isAssigned) {
      // Removing from team — no notification needed
      await supabase.from('team_members').delete().eq('player_id', memberId).eq('team_id', teamId)
    } else {
      // Adding to team — notify the member
      await supabase.from('team_members').insert({ player_id: memberId, team_id: teamId, status: 'active' })
      const notifTitle = 'Added to a Team'
      const notifBody  = `You've been added to ${teamName}. Check your fixtures tab for upcoming matches.`
      sendPushToUser(memberId, notifTitle, notifBody, { type: 'team_added' })
      insertNotification(memberId, 'team_added', notifTitle, notifBody)
    }
    await fetchMembers()
  }

  // ── Derived values — memoised to avoid recalculation on every render ────────
  const displayed = useMemo(() => members.filter(m => {
    const matchSearch = m.full_name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || m.role === filter ||
      (filter === 'admin' && ['admin','superadmin'].includes(m.role))
    return matchSearch && matchFilter
  }), [members, search, filter])

  const filterCounts = useMemo(() => ({
    all:     members.length,
    pending: members.filter(m => m.role === 'pending').length,
    member:  members.filter(m => m.role === 'member').length,
    captain: members.filter(m => m.role === 'captain').length,
    admin:   members.filter(m => ['admin','superadmin'].includes(m.role)).length,
  }), [members])

  // ── Save Play Cricket member ID ───────────────────────────────────────────
  const handleSavePcId = async () => {
    const { member, value } = pcModal
    if (!member) return
    setSavingPcId(true)
    try {
      const pcId = value.trim() ? parseInt(value.trim(), 10) : null
      if (value.trim() && isNaN(pcId)) {
        Alert.alert('Invalid ID', 'Play Cricket ID must be a number.')
        return
      }
      const { error } = await supabase
        .from('profiles')
        .update({ pc_member_id: pcId })
        .eq('id', member.id)
      if (error) throw error
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, pc_member_id: pcId } : m))
      setPcModal({ open: false, member: null, value: '' })
    } catch (err) {
      Alert.alert('Error', err.message)
    } finally {
      setSavingPcId(false)
    }
  }

  // ── Memoised callbacks passed to MemberCard to prevent re-renders ────────
  const onTeamToggle  = useCallback(handleTeamToggle, [teams])
  const onApprove     = useCallback(handleApprove, [])
  const onReject      = useCallback(handleReject, [])
  const onRoleModal   = useCallback((member) => setRoleModal({ open: true, member }), [])

  // ── FlatList renderItem — wrapped in React.memo to skip re-render when
  //    parent re-renders for unrelated state (search text, modal state etc.) ──
  const renderMember = useCallback(({ item: member }) => {
    const memberTeamIds = member.team_members?.map(tm => tm.team_id) || []
    const isCurrentUser = member.id === currentUser.id
    const roleColor     = ROLE_COLOURS[member.role] || colors.textMuted
    return (
      <View style={styles.memberCard}>
        {/* Top row */}
        <View style={styles.memberTop}>
          <View style={[styles.avatar, { borderColor: roleColor }]}>
            <Text style={[styles.avatarText, { color: roleColor }]}>{getInitials(member.full_name)}</Text>
          </View>
          <View style={styles.memberInfo}>
            <View style={styles.memberNameRow}>
              <Text style={styles.memberName}>{toTitleCase(member.full_name)}</Text>
              {isCurrentUser && <View style={styles.youBadge}><Text style={styles.youText}>You</Text></View>}
              <View style={[styles.roleBadge, { backgroundColor: roleColor + '18', borderColor: roleColor + '44' }]}>
                <Text style={[styles.roleText, { color: roleColor }]}>{member.role.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.memberSub}>{member.phone || 'No phone'} · {format(parseISO(member.created_at), 'd MMM yyyy')}</Text>
          </View>
        </View>

        {/* Team chips */}
        <View style={styles.teamChips}>
          {teams.map(team => {
            const assigned = memberTeamIds.includes(team.id)
            return (
              <TouchableOpacity key={team.id}
                style={[styles.teamChip, assigned && styles.teamChipActive]}
                onPress={() => onTeamToggle(member.id, member.full_name, team.id, team.name, assigned)}
                activeOpacity={0.7}>
                <Text style={[styles.teamChipText, assigned && styles.teamChipTextActive]}>
                  {assigned ? '✓ ' : '+ '}{team.name}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Pending actions */}
        {!isCurrentUser && member.role === 'pending' && (
          <View style={styles.pendingActions}>
            <TouchableOpacity style={[styles.approveBtn, { flexDirection: 'row', gap: 6 }]} onPress={() => onApprove(member)} activeOpacity={0.8}>
              <AppIcon name="approve" size={14} tint={colors.green} />
              <Text style={styles.approveBtnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.rejectBtn, { flexDirection: 'row', gap: 6 }]} onPress={() => onReject(member)} activeOpacity={0.8}>
              <AppIcon name="reject" size={14} tint={colors.red} />
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Role change button for non-pending, non-superadmin, non-self */}
        {!isCurrentUser && member.role !== 'superadmin' && member.role !== 'pending' && (
          <TouchableOpacity style={styles.changeRoleBtn}
            onPress={() => onRoleModal(member)}
            activeOpacity={0.7}>
            <Text style={styles.changeRoleText}>Change Role: {member.role}</Text>
          </TouchableOpacity>
        )}

        {/* Play Cricket ID link — only for non-pending active players */}
        {member.role !== 'pending' && (
          <TouchableOpacity
            style={styles.pcIdRow}
            onPress={() => setPcModal({ open: true, member, value: member.pc_member_id ? String(member.pc_member_id) : '' })}
            activeOpacity={0.7}
          >
            <Text style={styles.pcIdLabel}>PC ID</Text>
            <Text style={[styles.pcIdValue, !member.pc_member_id && styles.pcIdMissing]}>
              {member.pc_member_id ? String(member.pc_member_id) : 'Not linked — tap to set'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }, [teams, currentUser, onTeamToggle, onApprove, onReject, onRoleModal])

  // ── FlatList list header — search bar + filters rendered above the list ───
  const ListHeader = useMemo(() => (
    <View>
      <View style={styles.pageHeader}>
        <Text style={styles.sectionLabel}>ADMINISTRATION</Text>
        <Text style={styles.pageTitle}>MEMBERS</Text>
      </View>

      {/* Search */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search members…"
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />

      {/* Filter tabs — horizontal scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity key={tab.key} style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
            onPress={() => setFilter(tab.key)} activeOpacity={0.7}>
            <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
            <Text style={[styles.filterCount, filter === tab.key && styles.filterCountActive]}>
              {filterCounts[tab.key]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Loading / empty states inside header so FlatList is hidden */}
      {loading && <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />}
      {!loading && displayed.length === 0 && (
        <View style={styles.emptyCard}><Text style={styles.emptyText}>No members found</Text></View>
      )}
    </View>
  ), [search, filter, filterCounts, loading, displayed.length])

  return (
    <View style={styles.container}>
      <TopHeader />
      {/* FlatList virtualises the member list — only renders visible rows.
          Replaces ScrollView + .map() to prevent memory pressure on large clubs. */}
      <FlatList
        data={displayed}
        keyExtractor={item => item.id}
        renderItem={renderMember}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        // windowSize: render 5 viewports around viewport (default 21 — too aggressive)
        windowSize={5}
        // removeClippedSubviews: unmount off-screen rows on Android
        removeClippedSubviews={true}
        // maxToRenderPerBatch: controls chunk size per JS frame
        maxToRenderPerBatch={8}
        initialNumToRender={10}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor={colors.gold} />
        }
      />

      {/* ── Role picker modal ── */}
      <Modal visible={roleModal.open} transparent animationType="slide" onRequestClose={() => setRoleModal({ open: false, member: null })}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setRoleModal({ open: false, member: null })}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Change Role</Text>
            <Text style={styles.modalSub}>{toTitleCase(roleModal.member?.full_name)}</Text>
            {getRoleOptions().map(role => (
              <TouchableOpacity key={role}
                style={[styles.roleOption, roleModal.member?.role === role && styles.roleOptionActive]}
                onPress={() => handleRoleChange(roleModal.member.id, role, roleModal.member.full_name)}
                activeOpacity={0.7}>
                <Text style={[styles.roleOptionText, roleModal.member?.role === role && styles.roleOptionTextActive]}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                  {role === 'captain' ? '  →  Select team' : ''}
                </Text>
                {roleModal.member?.role === role && <Text style={styles.roleCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setRoleModal({ open: false, member: null })}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Captain team picker modal ── */}
      <Modal visible={captainTeamModal.open} transparent animationType="slide"
        onRequestClose={() => setCaptainTeamModal({ open: false, memberId: null, memberName: '' })}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1}
          onPress={() => setCaptainTeamModal({ open: false, memberId: null, memberName: '' })}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Captain of Which Team?</Text>
            <Text style={styles.modalSub}>{toTitleCase(captainTeamModal.memberName)}</Text>
            {teams.map(team => (
              <TouchableOpacity key={team.id}
                style={styles.roleOption}
                onPress={() => handleCaptainTeamSelect(team.id, team.name)}
                activeOpacity={0.7}>
                <Text style={styles.roleOptionText}>{team.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel}
              onPress={() => setCaptainTeamModal({ open: false, memberId: null, memberName: '' })}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Play Cricket ID editor modal ──────────────────────────────────── */}
      <Modal visible={pcModal.open} transparent animationType="slide"
        onRequestClose={() => setPcModal({ open: false, member: null, value: '' })}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1}
            onPress={() => setPcModal({ open: false, member: null, value: '' })}>
            <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>PLAY CRICKET ID</Text>
              <Text style={styles.modalSub}>{toTitleCase(pcModal.member?.full_name)}</Text>
              <Text style={styles.pcModalHint}>
                Enter the Play Cricket member ID. Found in PC admin or any match scorecard.
              </Text>
              <TextInput
                style={styles.pcModalInput}
                value={pcModal.value}
                onChangeText={v => setPcModal(p => ({ ...p, value: v }))}
                placeholder="e.g. 3778631"
                placeholderTextColor="rgba(139,155,180,0.4)"
                keyboardType="number-pad"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSavePcId}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={[styles.modalCancel, { flex: 1, marginTop: 0, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 14 }]}
                  onPress={() => setPcModal({ open: false, member: null, value: '' })}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.approveBtn, { flex: 1, justifyContent: 'center' }]}
                  onPress={handleSavePcId}
                  disabled={savingPcId}>
                  {savingPcId
                    ? <ActivityIndicator size="small" color={colors.navy} />
                    : <Text style={styles.approveBtnText}>Confirm</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.navy },
  scroll:          { flex: 1 },
  content:         { padding: spacing.md, paddingBottom: 60 },
  backBtn:         { marginBottom: spacing.sm },
  backText:        { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  pageHeader:      { marginBottom: spacing.lg },
  sectionLabel:    { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.gold, marginBottom: 4 },
  pageTitle:       { fontFamily: fonts.display, fontSize: 36, letterSpacing: 2, color: colors.white, lineHeight: 40 },

  searchInput:     { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontFamily: fonts.body, fontSize: 14, color: colors.white, marginBottom: spacing.md },
  filterRow:       { marginBottom: spacing.md, flexGrow: 0 },
  filterTab:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, marginRight: 8 },
  filterTabActive: { borderColor: 'rgba(245,197,24,0.4)', backgroundColor: 'rgba(245,197,24,0.08)' },
  filterTabText:   { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  filterTabTextActive: { fontFamily: fonts.bold, color: colors.gold },
  filterCount:     { fontFamily: fonts.bold, fontSize: 11, color: colors.textMuted, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  filterCountActive: { color: colors.gold, backgroundColor: 'rgba(245,197,24,0.2)' },

  emptyCard:       { backgroundColor: colors.navyLight, borderRadius: radius.md, padding: 40, alignItems: 'center' },
  emptyText:       { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },

  memberCard:      { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: 10 },
  memberTop:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.sm },
  avatar:          { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:      { fontFamily: fonts.bold, fontSize: 13 },
  memberInfo:      { flex: 1 },
  memberNameRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  memberName:      { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  youBadge:        { backgroundColor: 'rgba(245,197,24,0.1)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  youText:         { fontFamily: fonts.bold, fontSize: 10, color: colors.gold },
  roleBadge:       { borderWidth: 1, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  roleText:        { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1 },
  memberSub:       { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 3 },

  teamChips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  teamChip:        { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  teamChipActive:  { borderColor: 'rgba(34,197,94,0.4)', backgroundColor: 'rgba(34,197,94,0.1)' },
  teamChipText:    { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  teamChipTextActive: { fontFamily: fonts.bold, color: colors.green },

  pendingActions:  { flexDirection: 'row', gap: 8, marginBottom: spacing.sm },
  approveBtn:      { flex: 1, backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  approveBtnText:  { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
  rejectBtn:       { flex: 1, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  rejectBtnText:   { fontFamily: fonts.bold, fontSize: 13, color: colors.red },

  changeRoleBtn:   { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 9, alignItems: 'center', marginBottom: 6 },
  changeRoleText:  { fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted },

  // ── Play Cricket ID row ──
  pcIdRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  pcIdLabel:       { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.2, color: colors.textMuted, width: 44 },
  pcIdValue:       { fontFamily: fonts.body, fontSize: 12, color: colors.white },
  pcIdMissing:     { color: '#F97316', fontStyle: 'italic' },
  pcModalHint:     { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginBottom: 12, lineHeight: 16 },
  pcModalInput:    { backgroundColor: 'rgba(22,34,54,0.8)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 16, color: colors.white },

  modalBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:      { backgroundColor: colors.navyLight, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(245,197,24,0.15)', padding: spacing.lg, paddingBottom: 40 },
  modalHandle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  modalTitle:      { fontFamily: fonts.display, fontSize: 22, letterSpacing: 2, color: colors.white, marginBottom: 4 },
  modalSub:        { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginBottom: spacing.lg },
  roleOption:      { paddingVertical: 14, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roleOptionActive:{ borderColor: 'rgba(245,197,24,0.4)', backgroundColor: 'rgba(245,197,24,0.08)' },
  roleOptionText:  { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted },
  roleOptionTextActive: { fontFamily: fonts.bold, color: colors.gold },
  roleCheck:       { fontFamily: fonts.bold, fontSize: 16, color: colors.gold },
  modalCancel:     { marginTop: 8, paddingVertical: 14, alignItems: 'center' },
  modalCancelText: { fontFamily: fonts.bold, fontSize: 14, color: colors.red },
})
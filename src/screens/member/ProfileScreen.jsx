// pavilion-app/src/screens/member/ProfileScreen.jsx
// Mirrors pavilion-web/src/pages/member/ProfilePage.jsx
// Profile edit, my teams, change password

import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Animated, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import useAuthStore from '../../store/authStore'
import TopHeader from '../../components/layout/TopHeader'
import { colors, fonts, spacing, radius } from '../../theme'
import { SCREENS, toTitleCase } from '../../lib/constants'
import AppIcon from '../../components/AppIcon'

// ─── Configurable ─────────────────────────────────────────────────────────────
const AVATAR_COLOURS = [
  { label: 'Gold',   value: '#F5C518' },
  { label: 'Green',  value: '#22C55E' },
  { label: 'Blue',   value: '#3B82F6' },
  { label: 'Purple', value: '#A78BFA' },
  { label: 'Orange', value: '#F97316' },
  { label: 'Pink',   value: '#EC4899' },
]

const ROLE_META = {
  superadmin: { label: 'Super Admin', color: '#A78BFA', desc: 'Full platform access' },
  admin:      { label: 'Admin',       color: '#F5C518', desc: 'Club Administrator' },
  captain:    { label: 'Captain',     color: '#22C55E', desc: 'Team Captain' },
  member:     { label: 'Member',      color: '#8B9BB4', desc: 'Club Member' },
  pending:    { label: 'Pending',     color: '#F97316', desc: 'Awaiting Approval' },
}

function getInitials(name) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

export default function ProfileScreen({ navigation, route }) {
  const { profile, setProfile, signOut } = useAuthStore()

  // fromPanel=true when tapped from AdminPanel or CaptainPanel via TopHeader avatar.
  // In panel context: show "Return to Member View" instead of panel entry buttons.
  const fromPanel = route?.params?.fromPanel || false

  const [fullName,     setFullName]     = useState('')
  const [phone,        setPhone]        = useState('')
  const [avatarColor,  setAvatarColor]  = useState('#F5C518')
  const [myTeams,      setMyTeams]      = useState([])
  const [saving,       setSaving]       = useState(false)

  const [newPw,        setNewPw]        = useState('')
  const [confirmPw,    setConfirmPw]    = useState('')
  const [showPw,       setShowPw]       = useState(false)
  const [pwSaving,     setPwSaving]     = useState(false)

  const fadeAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start()
  }, [])

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setPhone(profile.phone || '')
      setAvatarColor(profile.avatar_color || '#F5C518')
      fetchMyTeams()
    }
  }, [profile])

  const fetchMyTeams = async () => {
    const { data } = await supabase
      .from('team_members')
      .select('teams(id, name, day_type)')
      .eq('player_id', profile.id)
      .eq('status', 'active')
    if (data) setMyTeams(data.map(t => t.teams).filter(Boolean))
  }

  const handleSave = async () => {
    if (!fullName.trim()) { Alert.alert('Error', 'Name cannot be empty'); return }
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name:    fullName.trim(),
          phone:        phone.trim() || null,
          avatar_color: avatarColor,
        })
        .eq('id', profile.id)
        .select()
        .single()

      if (error) throw error
      setProfile(data)
      Alert.alert('Success', 'Profile updated successfully')
    } catch (err) {
      Alert.alert('Error', 'Failed to update profile: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (newPw !== confirmPw) { Alert.alert('Error', 'Passwords do not match'); return }
    if (newPw.length < 8)    { Alert.alert('Error', 'Password must be at least 8 characters'); return }
    setPwSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) throw error
      Alert.alert('Success', 'Password changed successfully')
      setNewPw(''); setConfirmPw('')
    } catch (err) {
      Alert.alert('Error', 'Failed to change password: ' + err.message)
    } finally {
      setPwSaving(false)
    }
  }

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ])
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              'Are you sure?',
              'Your profile, availability, and all associated data will be permanently removed.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      // Delete profile row — cascades to team_members, availability, notifications
                      await supabase.rpc('delete_user')
                      await signOut()
                    } catch (err) {
                      Alert.alert('Error', 'Failed to delete account. Please contact anish.vek10@gmail.com')
                    }
                  },
                },
              ]
            )
          },
        },
      ]
    )
  }

  const roleMeta     = ROLE_META[profile?.role] || ROLE_META.member
  const initials     = getInitials(fullName)
  const pwStrength   = (() => {
    if (!newPw) return null
    if (newPw.length < 6)  return { label: 'Too short', color: colors.red,   w: '25%' }
    if (newPw.length < 8)  return { label: 'Weak',      color: '#F97316',    w: '50%' }
    if (newPw.length < 12) return { label: 'Good',      color: colors.gold,  w: '75%' }
    return                        { label: 'Strong',     color: colors.green, w: '100%' }
  })()

  return (
    <View style={styles.container}>
      <TopHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.sectionLabel}>ACCOUNT</Text>
            <Text style={styles.pageTitle}>MY PROFILE</Text>
          </View>

          {/* ── Panel navigation buttons — context-aware ── */}
          {fromPanel ? (
            // Inside admin/captain panel → show "Return to Member View"
            <TouchableOpacity
              style={styles.returnMemberBtn}
              onPress={() => navigation.getParent()?.navigate('Member')}
              activeOpacity={0.8}
            >
              <View style={styles.panelBtnInner}>
                <Text style={styles.panelBtnIcon}>⚡</Text>
                <View>
                  <Text style={styles.returnMemberTitle}>Back to Member View</Text>
                  <Text style={styles.returnMemberSub}>Return to home dashboard</Text>
                </View>
              </View>
              <Text style={styles.returnMemberArrow}>›</Text>
            </TouchableOpacity>
          ) : (
            <>
              {/* Admin Panel button — shown in member view for admins */}
              {(profile?.role === 'admin' || profile?.role === 'superadmin') && (
                <TouchableOpacity
                  style={styles.adminPanelBtn}
                  onPress={() => navigation.getParent()?.navigate('AdminPanel')}
                  activeOpacity={0.8}
                >
                  <View style={styles.panelBtnInner}>
                    <Text style={styles.panelBtnIcon}>⚙️</Text>
                    <View>
                      <Text style={styles.adminPanelTitle}>Admin Panel</Text>
                      <Text style={styles.adminPanelSub}>Members · Fixtures · Matchday · Announcements</Text>
                    </View>
                  </View>
                  <Text style={styles.adminPanelArrow}>›</Text>
                </TouchableOpacity>
              )}

              {/* Captain Panel button — shown in member view for captains */}
              {profile?.role === 'captain' && (
                <TouchableOpacity
                  style={styles.captainPanelBtn}
                  onPress={() => navigation.getParent()?.navigate('CaptainPanel')}
                  activeOpacity={0.8}
                >
                  <View style={styles.panelBtnInner}>
                    <AppIcon name="cricketBat" size={22} style={{ marginRight: 0 }} />
                    <View>
                      <Text style={styles.captainPanelTitle}>Captain Panel</Text>
                      <Text style={styles.captainPanelSub}>Fixtures · Squad Selection</Text>
                    </View>
                  </View>
                  <Text style={styles.captainPanelArrow}>›</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* ── Profile card ── */}
          <View style={styles.card}>

            {/* Avatar + identity */}
            <View style={styles.avatarRow}>
              <View style={[styles.avatar, { borderColor: avatarColor, shadowColor: avatarColor }]}>
                <Text style={[styles.avatarText, { color: avatarColor }]}>{initials}</Text>
              </View>
              <View style={styles.identity}>
                <Text style={styles.identityName}>{toTitleCase(profile?.full_name)}</Text>
                <Text style={styles.identityEmail}>{profile?.email}</Text>
                <View style={[styles.roleBadge, { backgroundColor: `${roleMeta.color}18`, borderColor: `${roleMeta.color}33` }]}>
                  <View style={[styles.roleDot, { backgroundColor: roleMeta.color }]} />
                  <View>
                    <Text style={[styles.roleText, { color: roleMeta.color }]}>{roleMeta.label}</Text>
                    {!!roleMeta.desc && (
                      <Text style={[styles.roleDesc, { color: roleMeta.color }]}>{roleMeta.desc}</Text>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* ── Edit form ── */}
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.inputLabel}>Phone <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+44 7700 000000"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{profile?.email}</Text>
              <Text style={styles.readOnlyTag}>READ ONLY</Text>
            </View>

            {/* Avatar colour picker */}
            <Text style={styles.inputLabel}>Avatar Colour</Text>
            <View style={styles.colourRow}>
              {AVATAR_COLOURS.map(c => (
                <TouchableOpacity
                  key={c.value}
                  onPress={() => setAvatarColor(c.value)}
                  activeOpacity={0.8}
                  style={[
                    styles.colourDot,
                    { backgroundColor: c.value },
                    avatarColor === c.value && [styles.colourDotActive, { shadowColor: c.value }],
                  ]}
                />
              ))}
            </View>

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>

          {/* ── My Teams card ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>My Teams</Text>
              <Text style={styles.cardSubtitle}>Managed by admin</Text>
            </View>
            {myTeams.length === 0 ? (
              <Text style={styles.emptyText}>You haven't been assigned to any teams yet.</Text>
            ) : (
              <View style={styles.teamsList}>
                {myTeams.map(team => (
                  <View key={team.id} style={styles.teamChip}>
                    <Text style={styles.teamChipText}>{team.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Change Password card ── */}
          <View style={styles.card}>
            <View style={[styles.cardHeader, { marginBottom: spacing.md }]}>
              <Text style={styles.cardTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setShowPw(p => !p)}>
                <Text style={styles.showHideText}>{showPw ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPw}
              onChangeText={setNewPw}
              secureTextEntry={!showPw}
              placeholder="Min. 8 characters"
              placeholderTextColor={colors.textMuted}
              autoComplete="new-password"
            />

            {/* Strength bar */}
            {pwStrength && (
              <View style={styles.strengthWrap}>
                <View style={styles.strengthTrack}>
                  <View style={[styles.strengthFill, { width: pwStrength.w, backgroundColor: pwStrength.color }]} />
                </View>
                <Text style={[styles.strengthLabel, { color: pwStrength.color }]}>{pwStrength.label}</Text>
              </View>
            )}

            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPw}
              onChangeText={setConfirmPw}
              secureTextEntry={!showPw}
              placeholder="Repeat new password"
              placeholderTextColor={colors.textMuted}
              autoComplete="new-password"
            />
            {!!confirmPw && newPw !== confirmPw && (
              <Text style={styles.mismatch}>Passwords don't match</Text>
            )}

            <TouchableOpacity
              onPress={handlePasswordChange}
              disabled={pwSaving}
              activeOpacity={0.85}
              style={[styles.pwBtn, pwSaving && { opacity: 0.6 }]}
            >
              <Text style={styles.pwBtnText}>{pwSaving ? 'Updating…' : 'Update Password'}</Text>
            </TouchableOpacity>
          </View>

          {/* ── Sign Out ── */}
          <TouchableOpacity onPress={handleSignOut} activeOpacity={0.8} style={styles.signOutBtn}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <AppIcon name="signout" size={16} tint={colors.red} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </View>
          </TouchableOpacity>

          {/* ── Delete Account ── */}
          <TouchableOpacity onPress={handleDeleteAccount} activeOpacity={0.8} style={styles.deleteAccountBtn}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <AppIcon name="delete" size={15} tint="rgba(239,68,68,0.6)" />
              <Text style={styles.deleteAccountText}>Delete Account</Text>
            </View>
          </TouchableOpacity>

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
  sectionLabel: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 2, color: colors.gold, textTransform: 'uppercase', marginBottom: 4 },
  pageTitle:    { fontFamily: fonts.display, fontSize: 36, letterSpacing: 2, color: colors.white, lineHeight: 40 },

  card:         { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardTitle:    { fontFamily: fonts.body, fontWeight: '700', fontSize: 15, color: colors.white },
  cardSubtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },

  avatarRow:    { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: spacing.lg },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(245,197,24,0.08)',
    borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  avatarText:   { fontFamily: fonts.display, fontSize: 24, letterSpacing: 2 },
  identity:     { flex: 1 },
  identityName: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 1, color: colors.white, lineHeight: 26 },
  identityEmail:{ fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: 8 },
  roleBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1, alignSelf: 'flex-start' },
  roleDot:      { width: 6, height: 6, borderRadius: 3 },
  roleText:     { fontFamily: fonts.body, fontWeight: '700', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  roleDesc:     { fontFamily: fonts.body, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.75 },

  inputLabel:   { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginBottom: 6, marginTop: spacing.sm },
  optional:     { color: colors.textMuted, fontWeight: '400' },
  input: {
    backgroundColor: colors.navy,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: 13,
    color: colors.white, fontFamily: fonts.body, fontSize: 14,
    marginBottom: spacing.sm,
  },
  readOnlyField:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 13, marginBottom: spacing.sm },
  readOnlyText: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  readOnlyTag:  { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, letterSpacing: 1 },
  colourRow:    { flexDirection: 'row', gap: 12, marginBottom: spacing.lg, marginTop: 6 },
  colourDot:    { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: 'transparent' },
  colourDotActive:{ borderColor: colors.white, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6 },
  saveBtn:      { backgroundColor: colors.gold, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.sm },
  saveBtnText:  { fontFamily: fonts.body, fontWeight: '700', fontSize: 15, color: colors.navy },

  emptyText:    { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  teamsList:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  teamChip:     { backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)', borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7 },
  teamChipText: { fontFamily: fonts.body, fontWeight: '600', fontSize: 13, color: colors.gold },

  showHideText: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  strengthWrap: { marginBottom: spacing.sm },
  strengthTrack:{ height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  strengthFill: { height: '100%', borderRadius: 2 },
  strengthLabel:{ fontFamily: fonts.body, fontSize: 11, textAlign: 'right' },
  mismatch:     { fontFamily: fonts.body, fontSize: 12, color: colors.red, marginTop: -4, marginBottom: spacing.sm },
  pwBtn:        { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.sm },
  pwBtnText:    { fontFamily: fonts.body, fontWeight: '600', fontSize: 15, color: colors.textLight },

  // ── Return to Member View button — muted/neutral theme ──────────────────
  returnMemberBtn:   {
    backgroundColor: 'rgba(139,155,180,0.06)',
    borderWidth: 1, borderColor: 'rgba(139,155,180,0.25)',
    borderRadius: radius.md, padding: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  returnMemberTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.white, marginBottom: 2 },
  returnMemberSub:   { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  returnMemberArrow: { fontFamily: fonts.bold, fontSize: 22, color: colors.textMuted },

  // ── Admin panel button — blue theme ──────────────────────────────────────
  adminPanelBtn:   {
    backgroundColor: 'rgba(96,165,250,0.06)',
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)',
    borderRadius: radius.md, padding: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  adminPanelTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.white, marginBottom: 2 },
  adminPanelSub:   { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  adminPanelArrow: { fontFamily: fonts.bold, fontSize: 22, color: '#60A5FA' },

  // ── Captain panel button — green theme ───────────────────────────────────
  captainPanelBtn:   {
    backgroundColor: 'rgba(34,197,94,0.06)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: radius.md, padding: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  captainPanelTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.white, marginBottom: 2 },
  captainPanelSub:   { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  captainPanelArrow: { fontFamily: fonts.bold, fontSize: 22, color: colors.green },

  // ── Shared ───────────────────────────────────────────────────────────────
  panelBtnInner:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  panelBtnIcon:   { fontSize: 24 },

  signOutBtn:         { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: radius.md, padding: 16, alignItems: 'center', marginBottom: spacing.md },
  signOutText:        { fontFamily: fonts.body, fontWeight: '600', fontSize: 15, color: colors.red },
  deleteAccountBtn:   { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)', borderRadius: radius.md, padding: 16, alignItems: 'center', marginBottom: spacing.md },
  deleteAccountText:  { fontFamily: fonts.body, fontWeight: '600', fontSize: 14, color: 'rgba(239,68,68,0.6)' },
})
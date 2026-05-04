// pavilion-app/src/screens/admin/AdminPanelProfileScreen.jsx
// Profile screen shown inside admin/captain panel
// Allows sign out and return to member view

import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert,
} from 'react-native'
import { supabase }      from '../../lib/supabase'
import { toTitleCase }  from '../../lib/constants'
import useAuthStore      from '../../store/authStore'
import TopHeader         from '../../components/layout/TopHeader'
import { colors, fonts, spacing, radius } from '../../theme'
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
  superadmin: { label: 'Super Admin',  desc: 'Full Platform Access', color: '#A78BFA' },
  admin:      { label: 'Admin',        desc: 'Club Administrator',   color: colors.gold },
  captain:    { label: 'Captain',      desc: 'Team Captain',         color: colors.green },
  member:     { label: 'Member',       desc: 'Club Member',          color: colors.textMuted },
}

function getInitials(name) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || '?'
}

export default function AdminPanelProfileScreen({ navigation }) {
  const { profile, setProfile, signOut } = useAuthStore()

  const [fullName,    setFullName]    = useState(profile?.full_name || '')
  const [phone,       setPhone]       = useState(profile?.phone || '')
  const [avatarColor, setAvatarColor] = useState(profile?.avatar_color || '#F5C518')
  const [saving,      setSaving]      = useState(false)
  const [newPw,       setNewPw]       = useState('')
  const [confirmPw,   setConfirmPw]   = useState('')
  const [pwSaving,    setPwSaving]    = useState(false)
  const [showPw,      setShowPw]      = useState(false)

  const roleMeta = ROLE_META[profile?.role] || ROLE_META.member

  const handleSave = async () => {
    if (!fullName.trim()) { Alert.alert('Error', 'Name cannot be empty'); return }
    setSaving(true)
    try {
      const { data, error } = await supabase.from('profiles')
        .update({ full_name: fullName.trim(), phone: phone.trim() || null, avatar_color: avatarColor })
        .eq('id', profile.id).select().single()
      if (error) throw error
      setProfile(data)
      Alert.alert('Saved', 'Profile updated successfully')
    } catch (err) {
      Alert.alert('Error', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (newPw !== confirmPw) { Alert.alert('Error', 'Passwords do not match'); return }
    if (newPw.length < 8)    { Alert.alert('Error', 'Min. 8 characters'); return }
    setPwSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) throw error
      Alert.alert('Done', 'Password changed successfully')
      setNewPw(''); setConfirmPw('')
    } catch (err) {
      Alert.alert('Error', err.message)
    } finally {
      setPwSaving(false)
    }
  }

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ])
  }

  const handleBackToMember = () => {
    // Pop back to the root navigator which shows MemberNavigator
    navigation.getParent()?.getParent()?.navigate('Member')
  }

  return (
    <View style={styles.container}>
      <TopHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <Text style={styles.pageTitle}>MY PROFILE</Text>
        </View>

        {/* ── Back to Member View — right under title ── */}
        <TouchableOpacity style={styles.backToMemberBtn} onPress={handleBackToMember} activeOpacity={0.8}>
          <Text style={styles.backToMemberIcon}>⚡</Text>
          <View>
            <Text style={styles.backToMemberTitle}>Back to Member View</Text>
            <Text style={styles.backToMemberSub}>Home · Fixtures · Teams · Alerts</Text>
          </View>
          <Text style={styles.backToMemberArrow}>›</Text>
        </TouchableOpacity>

        {/* ── Profile card ── */}
        <View style={styles.card}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatar, { borderColor: avatarColor }]}>
              <Text style={[styles.avatarText, { color: avatarColor }]}>{getInitials(fullName)}</Text>
            </View>
            <View style={styles.identity}>
              <Text style={styles.identityName}>{toTitleCase(profile?.full_name)}</Text>
              <View style={[styles.roleBadge, { backgroundColor: roleMeta.color + '18', borderColor: roleMeta.color + '33' }]}>
                <View style={[styles.roleDot, { backgroundColor: roleMeta.color }]} />
                <View>
                  <Text style={[styles.roleLabel, { color: roleMeta.color }]}>{roleMeta.label}</Text>
                  <Text style={[styles.roleDesc,  { color: roleMeta.color }]}>{roleMeta.desc}</Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.inputLabel}>Full Name</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} autoCapitalize="words" placeholderTextColor={colors.textMuted} />

          <Text style={styles.inputLabel}>Phone <Text style={{ color: colors.textMuted }}>(optional)</Text></Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+44 7700 000000" placeholderTextColor={colors.textMuted} />

          <Text style={styles.inputLabel}>Email</Text>
          <View style={styles.readOnly}>
            <Text style={styles.readOnlyText}>{profile?.email}</Text>
            <Text style={styles.readOnlyTag}>READ ONLY</Text>
          </View>

          <Text style={styles.inputLabel}>Avatar Colour</Text>
          <View style={styles.colourRow}>
            {AVATAR_COLOURS.map(c => (
              <TouchableOpacity key={c.value} onPress={() => setAvatarColor(c.value)} activeOpacity={0.8}
                style={[styles.colourDot, { backgroundColor: c.value }, avatarColor === c.value && styles.colourDotActive]} />
            ))}
          </View>

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Change Password ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Change Password</Text>
            <TouchableOpacity onPress={() => setShowPw(p => !p)}>
              <Text style={styles.showHide}>{showPw ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>New Password</Text>
          <TextInput style={styles.input} value={newPw} onChangeText={setNewPw}
            secureTextEntry={!showPw} placeholder="Min. 8 characters" placeholderTextColor={colors.textMuted} />

          <Text style={styles.inputLabel}>Confirm Password</Text>
          <TextInput style={styles.input} value={confirmPw} onChangeText={setConfirmPw}
            secureTextEntry={!showPw} placeholder="Repeat new password" placeholderTextColor={colors.textMuted} />

          {!!confirmPw && newPw !== confirmPw && (
            <Text style={styles.mismatch}>Passwords don't match</Text>
          )}

          <TouchableOpacity style={[styles.pwBtn, pwSaving && { opacity: 0.6 }]} onPress={handlePasswordChange} disabled={pwSaving} activeOpacity={0.85}>
            <Text style={styles.pwBtnText}>{pwSaving ? 'Updating…' : 'Update Password'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Sign Out ── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <AppIcon name="signout" size={16} tint={colors.red} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </View>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.navy },
  scroll:           { flex: 1 },
  content:          { padding: spacing.md },

  backToMemberBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(245,197,24,0.06)',
    borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)',
    borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md,
  },
  backToMemberIcon:  { fontSize: 22 },
  backToMemberTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  backToMemberSub:   { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  backToMemberArrow: { fontFamily: fonts.bold, fontSize: 22, color: colors.gold, marginLeft: 'auto' },

  header:       { marginBottom: spacing.lg },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.gold, textTransform: 'uppercase', marginBottom: 4 },
  pageTitle:    { fontFamily: fonts.display, fontSize: 36, letterSpacing: 2, color: colors.white, lineHeight: 40 },

  card:         { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardTitle:    { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  showHide:     { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },

  avatarRow:    { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: spacing.lg },
  avatar:       { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontFamily: fonts.display, fontSize: 24, letterSpacing: 2 },
  identity:     { flex: 1 },
  identityName: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1, color: colors.white, lineHeight: 24, marginBottom: 8 },
  roleBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1, alignSelf: 'flex-start' },
  roleDot:      { width: 6, height: 6, borderRadius: 3 },
  roleLabel:    { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  roleDesc:     { fontFamily: fonts.body, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.75 },

  inputLabel:   { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginBottom: 6, marginTop: spacing.sm },
  input:        { backgroundColor: colors.navy, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 13, color: colors.white, fontFamily: fonts.body, fontSize: 14, marginBottom: spacing.sm },
  readOnly:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 13, marginBottom: spacing.sm },
  readOnlyText: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  readOnlyTag:  { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, letterSpacing: 1 },
  colourRow:    { flexDirection: 'row', gap: 12, marginBottom: spacing.lg, marginTop: 6 },
  colourDot:    { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: 'transparent' },
  colourDotActive: { borderColor: colors.white },
  saveBtn:      { backgroundColor: colors.gold, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.sm },
  saveBtnText:  { fontFamily: fonts.bold, fontSize: 15, color: colors.navy },

  mismatch:     { fontFamily: fonts.body, fontSize: 12, color: colors.red, marginBottom: spacing.sm },
  pwBtn:        { borderWidth: 1, borderColor: colors.border, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.sm },
  pwBtnText:    { fontFamily: fonts.bold, fontSize: 15, color: colors.textLight },

  signOutBtn:   { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: radius.md, padding: 16, alignItems: 'center', marginBottom: spacing.md },
  signOutText:  { fontFamily: fonts.bold, fontSize: 15, color: colors.red },
})
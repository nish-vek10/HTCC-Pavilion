// pavilion-app/src/screens/admin/AdminAnnouncementsScreen.jsx
// Post, edit and delete club announcements

import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import useAuthStore from '../../store/authStore'
import TopHeader from '../../components/layout/TopHeader'
import AppIcon   from '../../components/AppIcon'
import { colors, fonts, spacing, radius } from '../../theme'
import { sendPushToRole, insertNotificationsForRole } from '../../lib/pushNotifications'

// ─── Configurable ─────────────────────────────────────────────────────────────
const BODY_LIMIT = 1000

const AUDIENCE_OPTIONS = [
  { value: 'all',     label: 'All Members',   color: colors.gold },
  { value: 'member',  label: 'Members Only',  color: colors.textMuted },
  { value: 'captain', label: 'Captains Only', color: colors.green },
  { value: 'admin',   label: 'Admins Only',   color: '#A78BFA' },
]

const EMPTY_FORM = { title: '', body: '', target_role: 'all' }

export default function AdminAnnouncementsScreen({ navigation, embedded = false }) {
  const profile = useAuthStore(s => s.profile)

  const [announcements, setAnnouncements] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [showForm,      setShowForm]      = useState(false)
  const [form,          setForm]          = useState(EMPTY_FORM)
  const [submitting,    setSubmitting]    = useState(false)
  const [expandedId,    setExpandedId]    = useState(null)
  // null = create mode, string id = edit mode
  const [editingId,     setEditingId]     = useState(null)

  useFocusEffect(useCallback(() => { fetchAnnouncements() }, []))

  const fetchAnnouncements = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const { data } = await supabase.from('announcements')
      .select('id, title, body, target_role, created_at, profiles(full_name)')
      .order('created_at', { ascending: false })
    if (data) setAnnouncements(data)
    setLoading(false)
    setRefreshing(false)
  }

  // ── Open edit form pre-populated with existing announcement ───────────────
  const handleEditOpen = (ann) => {
    setForm({ title: ann.title, body: ann.body, target_role: ann.target_role })
    setEditingId(ann.id)
    setShowForm(true)
  }

  // ── Close and reset form ─────────────────────────────────────────────────
  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  // ── Create announcement ───────────────────────────────────────────────────
  const handleCreate = async () => {
    setSubmitting(true)
    try {
      const { error } = await supabase.from('announcements').insert({
        title:       form.title.trim(),
        body:        form.body.trim(),
        target_role: form.target_role,
        created_by:  profile.id,
      })
      if (error) throw error

      // Push notification only on create — not on edit
      const pushTitle = form.title.trim()
      const pushBody  = form.body.trim().slice(0, 100) + (form.body.trim().length > 100 ? '…' : '')
      sendPushToRole(form.target_role, pushTitle, pushBody, { type: 'announcement' })
      insertNotificationsForRole(form.target_role, 'announcement', pushTitle, pushBody)

      closeForm()
      await fetchAnnouncements()
    } catch (err) {
      Alert.alert('Error', 'Failed to post: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Update existing announcement — no re-push ────────────────────────────
  const handleUpdate = async () => {
    setSubmitting(true)
    try {
      const { error } = await supabase.from('announcements')
        .update({
          title:       form.title.trim(),
          body:        form.body.trim(),
          target_role: form.target_role,
        })
        .eq('id', editingId)
      if (error) throw error

      // Update local state immediately — no refetch needed
      setAnnouncements(prev =>
        prev.map(a =>
          a.id === editingId
            ? { ...a, title: form.title.trim(), body: form.body.trim(), target_role: form.target_role }
            : a
        )
      )
      closeForm()
    } catch (err) {
      Alert.alert('Error', 'Failed to update: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Route submit to create or update ─────────────────────────────────────
  const handleSubmit = () => {
    if (!form.title.trim()) { Alert.alert('Error', 'Title is required'); return }
    if (!form.body.trim())  { Alert.alert('Error', 'Message body is required'); return }
    if (editingId) handleUpdate()
    else           handleCreate()
  }

  // ── Delete with confirmation ──────────────────────────────────────────────
  const handleDelete = (ann) => {
    Alert.alert('Delete Announcement', `Delete "${ann.title}"?\n\nThis cannot be undone.`, [
      { text: 'Keep It', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('announcements').delete().eq('id', ann.id)
        if (error) { Alert.alert('Error', 'Failed to delete'); return }
        setAnnouncements(prev => prev.filter(a => a.id !== ann.id))
        // If this announcement was being edited, close the form
        if (editingId === ann.id) closeForm()
      }},
    ])
  }

  const audienceMeta = (role) => AUDIENCE_OPTIONS.find(o => o.value === role) || AUDIENCE_OPTIONS[0]

  return (
    <View style={styles.container}>
      {!embedded && <TopHeader />}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAnnouncements(true)} tintColor={colors.gold} />}
        showsVerticalScrollIndicator={false}>

        <View style={styles.pageHeaderRow}>
          <View>
            <Text style={styles.sectionLabel}>ADMINISTRATION</Text>
            <Text style={styles.pageTitle}>ANNOUNCEMENTS</Text>
          </View>
          <TouchableOpacity
            style={[styles.primaryBtn, showForm && styles.cancelBtn]}
            onPress={() => { if (showForm) closeForm(); else setShowForm(true) }}
            activeOpacity={0.8}>
            <Text style={[styles.primaryBtnText, showForm && styles.cancelBtnText]}>
              {showForm ? 'Cancel' : '+ New'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Compose / Edit form ── */}
        {showForm && (
          <View style={styles.formCard}>
            {/* Form header — shows mode */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <AppIcon name={editingId ? 'edit' : 'send'} size={15} tint={colors.gold} />
              <Text style={styles.formTitle}>
                {editingId ? 'Edit Announcement' : 'Compose Announcement'}
              </Text>
            </View>

            {/* Edit mode — no re-push notice */}
            {editingId && (
              <View style={styles.editNotice}>
                <AppIcon name="pending" size={13} tint={colors.gold} />
                <Text style={styles.editNoticeText}>
                  Editing will update the announcement text. No new push notification will be sent.
                </Text>
              </View>
            )}

            <Text style={styles.inputLabel}>Audience</Text>
            <View style={styles.audienceRow}>
              {AUDIENCE_OPTIONS.map(opt => (
                <TouchableOpacity key={opt.value}
                  style={[styles.audienceChip, form.target_role === opt.value && { borderColor: opt.color + '66', backgroundColor: opt.color + '18' }]}
                  onPress={() => setForm(f => ({ ...f, target_role: opt.value }))} activeOpacity={0.7}>
                  <Text style={[styles.audienceChipText, form.target_role === opt.value && { color: opt.color, fontFamily: fonts.bold }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Title</Text>
            <TextInput style={styles.input} placeholder="e.g. Training cancelled this Wednesday"
              placeholderTextColor={colors.textMuted} value={form.title} maxLength={120}
              onChangeText={v => setForm(f => ({ ...f, title: v }))} />

            <View style={styles.bodyLabelRow}>
              <Text style={styles.inputLabel}>Message</Text>
              <Text style={[styles.charCount, form.body.length > BODY_LIMIT * 0.9 && { color: '#F97316' }]}>
                {form.body.length}/{BODY_LIMIT}
              </Text>
            </View>
            <TextInput style={[styles.input, styles.textarea]} placeholder="Write your announcement here…"
              placeholderTextColor={colors.textMuted} value={form.body} maxLength={BODY_LIMIT}
              multiline numberOfLines={5} textAlignVertical="top"
              onChangeText={v => setForm(f => ({ ...f, body: v }))} />

            <TouchableOpacity
              style={[styles.submitBtn, (submitting || !form.title || !form.body) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting || !form.title || !form.body}
              activeOpacity={0.8}>
              <Text style={styles.submitBtnText}>
                {submitting
                  ? (editingId ? 'Saving…' : 'Posting…')
                  : (editingId ? 'Save Changes' : 'Post Announcement')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── List ── */}
        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
        ) : announcements.length === 0 ? (
          <View style={styles.emptyCard}>
            <AppIcon name="send" size={36} tint={colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>NO ANNOUNCEMENTS YET</Text>
            <Text style={styles.emptyText}>Tap "+ New" to post your first announcement</Text>
          </View>
        ) : (
          announcements.map(ann => {
            const meta       = audienceMeta(ann.target_role)
            const isExpanded = expandedId === ann.id
            const isLong     = ann.body.length > 200
            const isEditing  = editingId === ann.id

            return (
              <View
                key={ann.id}
                style={[
                  styles.annCard,
                  { borderTopColor: meta.color },
                  isEditing && styles.annCardEditing,
                ]}>
                {/* Top row — audience badge · date · action buttons */}
                <View style={styles.annTopRow}>
                  <View style={[styles.audienceBadge, { backgroundColor: meta.color + '18', borderColor: meta.color + '44' }]}>
                    <Text style={[styles.audienceBadgeText, { color: meta.color }]}>
                      {meta.label.split(' ')[1] || 'All'}
                    </Text>
                  </View>
                  <Text style={styles.annDate}>{format(parseISO(ann.created_at), 'EEE d MMM yyyy')}</Text>

                  {/* Action buttons — edit + delete */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.editBtn, isEditing && styles.editBtnActive]}
                      onPress={() => {
                        if (isEditing) closeForm()
                        else handleEditOpen(ann)
                      }}
                      activeOpacity={0.7}>
                      <AppIcon name="edit" size={12} tint={isEditing ? colors.navy : colors.gold} />
                      <Text style={[styles.editBtnText, isEditing && { color: colors.navy }]}>
                        {isEditing ? 'Editing' : 'Edit'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(ann)}
                      activeOpacity={0.7}>
                      <AppIcon name="delete" size={12} tint={colors.red} />
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Announcement content */}
                <Text style={styles.annTitle}>{ann.title}</Text>
                <Text style={styles.annBody} numberOfLines={isLong && !isExpanded ? 3 : undefined}>
                  {ann.body}
                </Text>
                {isLong && (
                  <TouchableOpacity onPress={() => setExpandedId(isExpanded ? null : ann.id)} activeOpacity={0.7}>
                    <Text style={styles.readMore}>{isExpanded ? 'Show less' : 'Read more'}</Text>
                  </TouchableOpacity>
                )}
                {ann.profiles?.full_name && (
                  <Text style={styles.postedBy}>Posted by {ann.profiles.full_name}</Text>
                )}
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.navy },
  scroll:           { flex: 1 },
  content:          { padding: spacing.md, paddingBottom: 60 },
  pageHeaderRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.lg },
  sectionLabel:     { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.gold, marginBottom: 4 },
  pageTitle:        { fontFamily: fonts.display, fontSize: 32, letterSpacing: 2, color: colors.white, lineHeight: 36, textTransform: 'uppercase' },
  primaryBtn:       { backgroundColor: colors.gold, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 10 },
  cancelBtn:        { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  primaryBtnText:   { fontFamily: fonts.bold, fontSize: 13, color: colors.navy },
  cancelBtnText:    { color: colors.red },

  formCard:         { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  formTitle:        { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  // Edit-mode notice
  editNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(245,197,24,0.06)', borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.2)', borderRadius: radius.sm,
    padding: 10, marginBottom: spacing.md,
  },
  editNoticeText: { fontFamily: fonts.body, fontSize: 11, color: colors.gold, flex: 1, lineHeight: 16 },
  inputLabel:       { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.5, color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' },
  input:            { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontFamily: fonts.body, fontSize: 14, color: colors.white, marginBottom: spacing.md },
  textarea:         { minHeight: 120, textAlignVertical: 'top' },
  audienceRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  audienceChip:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  audienceChipText: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  bodyLabelRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  charCount:        { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  submitBtn:        { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  submitBtnDisabled:{ opacity: 0.5 },
  submitBtnText:    { fontFamily: fonts.bold, fontSize: 14, color: colors.navy },

  emptyCard:        { backgroundColor: colors.navyLight, borderRadius: radius.md, padding: 48, alignItems: 'center' },
  emptyTitle:       { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1, color: colors.white, marginBottom: 6, marginTop: 12 },
  emptyText:        { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  annCard:          { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderTopWidth: 3, borderRadius: radius.md, padding: spacing.md, marginBottom: 10 },
  // Active editing highlight
  annCardEditing:   { borderColor: 'rgba(245,197,24,0.3)', backgroundColor: 'rgba(245,197,24,0.03)' },
  annTopRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm, flexWrap: 'wrap' },
  audienceBadge:    { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  audienceBadgeText:{ fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1 },
  annDate:          { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, flex: 1 },
  // Edit + delete in a row
  cardActions:      { flexDirection: 'row', gap: 6, alignItems: 'center' },
  editBtn:          { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)', borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 5 },
  editBtnActive:    { backgroundColor: colors.gold, borderColor: colors.gold },
  editBtnText:      { fontFamily: fonts.bold, fontSize: 11, color: colors.gold },
  deleteBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 5 },
  deleteBtnText:    { fontFamily: fonts.bold, fontSize: 11, color: colors.red },
  annTitle:         { fontFamily: fonts.bold, fontSize: 15, color: colors.white, marginBottom: 6, textTransform: 'uppercase' },
  annBody:          { fontFamily: fonts.body, fontSize: 13, color: colors.textLight, lineHeight: 20, marginBottom: 6 },
  readMore:         { fontFamily: fonts.bold, fontSize: 12, color: colors.gold, marginBottom: 6 },
  postedBy:         { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 4 },
})

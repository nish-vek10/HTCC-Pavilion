// pavilion-app/src/screens/admin/AdminTrainingScreen.jsx
// Admin training session management — create, edit, view attendance, prompt all

import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, RefreshControl, Modal,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { format, parseISO, addWeeks, isBefore, isEqual } from 'date-fns'
import DateTimePicker from '@react-native-community/datetimepicker'
import { supabase }      from '../../lib/supabase'
import useAuthStore      from '../../store/authStore'
import TopHeader         from '../../components/layout/TopHeader'
import { colors, fonts, spacing, radius } from '../../theme'
import { SCREENS }       from '../../lib/constants'
import AppIcon           from '../../components/AppIcon'

// ─── Configurable ─────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  title:        '',
  venue:        '',
  session_date: '',
  session_time: '17:30', // overridden dynamically based on day chosen
  is_recurring: false,
  end_date:     '',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const toISO = (dd_mm_yyyy) => {
  if (!dd_mm_yyyy || dd_mm_yyyy.length !== 10) return ''
  const [dd, mm, yyyy] = dd_mm_yyyy.split('-')
  return `${yyyy}-${mm}-${dd}`
}
const toDDMMYYYY = (date) => {
  const dd   = String(date.getDate()).padStart(2, '0')
  const mm   = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}
// Convert YYYY-MM-DD → DD-MM-YYYY for display
const toDisplayDate = (isoStr) => {
  if (!isoStr || isoStr.length < 10) return ''
  const [yyyy, mm, dd] = isoStr.split('-')
  return `${dd}-${mm}-${yyyy}`
}
const defaultTimeForDate = (ddmmyyyy) => {
  if (!ddmmyyyy || ddmmyyyy.length !== 10) return '17:30'
  const [dd, mm, yyyy] = ddmmyyyy.split('-')
  const dayOfWeek = new Date(`${yyyy}-${mm}-${dd}`).getDay()
  return dayOfWeek === 6 ? '15:00' : '17:30' // 6 = Saturday
}

export default function AdminTrainingScreen({ navigation, embedded = false }) {
  const profile = useAuthStore(s => s.profile)

  const [sessions,        setSessions]        = useState([])
  const [loading,         setLoading]         = useState(true)
  const [refreshing,      setRefreshing]      = useState(false)
  const [showForm,        setShowForm]        = useState(false)
  const [form,            setForm]            = useState(EMPTY_FORM)
  const [editingId,       setEditingId]       = useState(null)  // null = create mode, id = edit mode
  const [submitting,      setSubmitting]      = useState(false)
  const [datePickerOpen,  setDatePickerOpen]  = useState(false)
  const [datePickerField, setDatePickerField] = useState('session_date')

  useFocusEffect(useCallback(() => { loadSessions() }, []))

  const loadSessions = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('training_sessions')
      .select('*')
      .gte('session_date', today)
      .order('session_date', { ascending: true })
    if (data) setSessions(data)
    setLoading(false)
    setRefreshing(false)
  }

  // ── Open edit form pre-populated with session data ────────────────────────
  const handleEditOpen = (session) => {
    setForm({
      title:        session.title,
      venue:        session.venue,
      session_date: toDisplayDate(session.session_date), // display format DD-MM-YYYY
      session_time: session.session_time?.slice(0, 5) || '17:30',
      is_recurring: false,  // edit mode: never show recurring toggle
      end_date:     '',
    })
    setEditingId(session.id)
    setShowForm(true)
  }

  // ── Close and reset form ─────────────────────────────────────────────────
  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  // ── Generate weekly occurrences up to end_date ────────────────────────
  const generateOccurrences = (baseDate, endDate, time, title, venue) => {
    const dates = []
    let current = new Date(baseDate)
    const end   = new Date(endDate)
    while (isBefore(current, end) || isEqual(current, end)) {
      dates.push({
        title,
        venue,
        session_date: current.toISOString().split('T')[0],
        session_time: time,
      })
      current = addWeeks(current, 1)
    }
    return dates
  }

  // ── Create session(s) ─────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.title.trim())     { Alert.alert('Error', 'Title is required'); return }
    if (!form.venue.trim())     { Alert.alert('Error', 'Venue is required'); return }
    if (!form.session_date)     { Alert.alert('Error', 'Date is required'); return }
    if (form.is_recurring && !form.end_date) { Alert.alert('Error', 'End date required for recurring sessions'); return }

    // Convert DD-MM-YYYY → YYYY-MM-DD for Supabase
    const isoDate    = toISO(form.session_date)
    const isoEndDate = form.end_date ? toISO(form.end_date) : null
    if (!isoDate)    { Alert.alert('Error', 'Invalid date — use DD-MM-YYYY format'); return }
    if (form.is_recurring && !isoEndDate) { Alert.alert('Error', 'Invalid end date — use DD-MM-YYYY format'); return }

    setSubmitting(true)
    try {
      if (!form.is_recurring) {
        // Single session
        const { error: singleErr } = await supabase
          .from('training_sessions')
          .insert({
            title:        form.title.trim(),
            venue:        form.venue.trim(),
            session_date: isoDate,
            session_time: form.session_time,
            created_by:   profile.id,
          })
        if (singleErr) throw singleErr
      } else {
        // Recurring — create parent then children
        const { data: parent, error: parentErr } = await supabase
          .from('training_sessions')
          .insert({
            title:        form.title.trim(),
            venue:        form.venue.trim(),
            session_date: isoDate,
            session_time: form.session_time,
            created_by:   profile.id,
          })
          .select().single()
        if (parentErr) throw parentErr

        const occurrences = generateOccurrences(
          isoDate, isoEndDate,
          form.session_time, form.title.trim(), form.venue.trim()
        ).slice(1) // skip first — already created as parent

        if (occurrences.length > 0) {
          const children = occurrences.map(o => ({
            ...o,
            parent_id:  parent.id,
            created_by: profile.id,
          }))
          const { error: childErr } = await supabase.from('training_sessions').insert(children)
          if (childErr) throw childErr
        }
      }

      closeForm()
      await loadSessions()
      Alert.alert('Created', form.is_recurring
        ? `Recurring sessions created up to ${form.end_date}`
        : 'Training session created')
    } catch (err) {
      Alert.alert('Error', 'Failed to create session: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Update single session ─────────────────────────────────────────────────
  const handleUpdate = async () => {
    if (!form.title.trim())   { Alert.alert('Error', 'Title is required'); return }
    if (!form.venue.trim())   { Alert.alert('Error', 'Venue is required'); return }
    if (!form.session_date)   { Alert.alert('Error', 'Date is required'); return }

    const isoDate = toISO(form.session_date)
    if (!isoDate) { Alert.alert('Error', 'Invalid date — use DD-MM-YYYY format'); return }

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('training_sessions')
        .update({
          title:        form.title.trim(),
          venue:        form.venue.trim(),
          session_date: isoDate,
          session_time: form.session_time,
        })
        .eq('id', editingId)
      if (error) throw error

      closeForm()
      await loadSessions()
      Alert.alert('Updated', 'Training session updated')
    } catch (err) {
      Alert.alert('Error', 'Failed to update session: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Route submit to create or update ─────────────────────────────────────
  const handleSubmit = () => {
    if (editingId) handleUpdate()
    else           handleCreate()
  }

  const handleDelete = (session) => {
    const msg = session.parent_id === null
      ? 'Delete this session and all its recurring occurrences?'
      : 'Delete just this session?'

    Alert.alert('Delete Training Session', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        if (session.parent_id === null) {
          // Delete parent — cascades to children
          await supabase.from('training_sessions').delete().eq('id', session.id)
          // Also delete any children where this is the parent
          await supabase.from('training_sessions').delete().eq('parent_id', session.id)
        } else {
          await supabase.from('training_sessions').delete().eq('id', session.id)
        }
        await loadSessions()
      }},
    ])
  }

  // Group by month
  const grouped = sessions.reduce((acc, s) => {
    const month = format(parseISO(s.session_date), 'MMMM yyyy')
    if (!acc[month]) acc[month] = []
    acc[month].push(s)
    return acc
  }, {})


  return (
    <View style={styles.container}>
      {!embedded && <TopHeader />}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadSessions(true)} tintColor={colors.gold} />}
        showsVerticalScrollIndicator={false}>

        <View style={styles.pageHeaderRow}>
          <View>
            <Text style={styles.sectionLabel}>ADMINISTRATION</Text>
            <Text style={styles.pageTitle}>TRAINING</Text>
          </View>
          <TouchableOpacity
            style={[styles.primaryBtn, showForm && styles.cancelBtn]}
            onPress={() => { if (showForm) closeForm(); else setShowForm(true) }}
            activeOpacity={0.8}>
            <Text style={[styles.primaryBtnText, showForm && styles.cancelBtnText]}>
              {showForm ? 'Cancel' : '+ Add Session'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Create / Edit form ── */}
        {showForm && (
          <View style={styles.formCard}>
            {/* Form header — shows mode */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md }}>
              <AppIcon name={editingId ? 'edit' : 'add'} size={14} tint={colors.gold} />
              <Text style={styles.formTitle}>
                {editingId ? 'Edit Session' : 'New Training Session'}
              </Text>
            </View>

            {/* Edit-only warning for recurring children */}
            {editingId && (
              <View style={styles.editNotice}>
                <AppIcon name="pending" size={13} tint={colors.gold} />
                <Text style={styles.editNoticeText}>
                  Editing this session only — other occurrences in the series are not affected.
                </Text>
              </View>
            )}

            <Text style={styles.inputLabel}>Title</Text>
            <TextInput style={styles.input} placeholder="e.g. Pre-Season Training"
              placeholderTextColor={colors.textMuted} value={form.title}
              onChangeText={v => setForm(f => ({ ...f, title: v }))} />

            <Text style={styles.inputLabel}>Venue</Text>
            <TextInput style={styles.input} placeholder="e.g. Rayners Lane"
              placeholderTextColor={colors.textMuted} value={form.venue}
              onChangeText={v => setForm(f => ({ ...f, venue: v }))} />

            <Text style={styles.inputLabel}>Date</Text>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => { setDatePickerField('session_date'); setDatePickerOpen(true) }}
              activeOpacity={0.8}>
              <Text style={[styles.dateBtnText, !form.session_date && { color: colors.textMuted }]}>
                {form.session_date || 'DD-MM-YYYY'}
              </Text>
              <AppIcon name="date" size={18} tint={colors.gold} />
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Time (HH:MM)</Text>
            <TextInput
              style={styles.input}
              placeholder="17:30"
              placeholderTextColor={colors.textMuted}
              value={form.session_time}
              keyboardType="numeric"
              maxLength={5}
              onChangeText={v => {
                let cleaned = v.replace(/[^0-9]/g, '')
                if (cleaned.length > 2) cleaned = cleaned.slice(0,2) + ':' + cleaned.slice(2)
                setForm(f => ({ ...f, session_time: cleaned }))
              }}
            />

            {/* Recurring toggle — create mode only */}
            {!editingId && (
              <TouchableOpacity
                style={[styles.recurringToggle, form.is_recurring && styles.recurringToggleActive]}
                onPress={() => setForm(f => ({ ...f, is_recurring: !f.is_recurring }))}
                activeOpacity={0.8}>
                <View style={styles.recurringToggleLeft}>
                  <AppIcon name="fixtures" size={18} tint={form.is_recurring ? colors.gold : colors.textMuted} />
                  <View>
                    <Text style={[styles.recurringToggleTitle, form.is_recurring && { color: colors.gold }]}>
                      Recurring Weekly
                    </Text>
                    <Text style={styles.recurringToggleSub}>Repeats every week on the same day</Text>
                  </View>
                </View>
                <View style={[styles.toggleDot, form.is_recurring && styles.toggleDotActive]} />
              </TouchableOpacity>
            )}

            {form.is_recurring && !editingId && (
              <>
                <Text style={styles.inputLabel}>End Date</Text>
                <TouchableOpacity
                  style={styles.dateBtn}
                  onPress={() => { setDatePickerField('end_date'); setDatePickerOpen(true) }}
                  activeOpacity={0.8}>
                  <Text style={[styles.dateBtnText, !form.end_date && { color: colors.textMuted }]}>
                    {form.end_date || 'DD-MM-YYYY'}
                  </Text>
                  <AppIcon name="date" size={18} tint={colors.gold} />
                </TouchableOpacity>
              </>
            )}

            <View style={styles.formBtns}>
              <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit} disabled={submitting} activeOpacity={0.8}>
                <Text style={styles.submitBtnText}>
                  {submitting
                    ? (editingId ? 'Saving…' : 'Creating…')
                    : (editingId ? 'Save Changes' : 'Create Session')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Sessions list ── */}
        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
        ) : sessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <AppIcon name="cricketBat" size={36} tint={colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>NO UPCOMING SESSIONS</Text>
            <Text style={styles.emptyText}>Tap "+ Add Session" to schedule training</Text>
          </View>
        ) : (
          Object.entries(grouped).map(([month, monthSessions]) => (
            <View key={month} style={styles.monthGroup}>
              <Text style={styles.monthHeader}>{month.toUpperCase()}</Text>
              {monthSessions.map(session => (
                <TouchableOpacity
                  key={session.id}
                  style={styles.sessionCard}
                  onPress={() => navigation.navigate(SCREENS.TRAINING_DETAIL, { sessionId: session.id })}
                  activeOpacity={0.8}>
                  <View style={styles.sessionCardLeft}>
                    <View style={styles.sessionDateBlock}>
                      <Text style={styles.sessionDateNum}>{format(parseISO(session.session_date), 'dd')}</Text>
                      <Text style={styles.sessionDateDow}>{format(parseISO(session.session_date), 'EEE').toUpperCase()}</Text>
                    </View>
                    <View style={styles.sessionInfo}>
                      {session.parent_id !== null && (
                        <View style={styles.recurringBadge}>
                          <Text style={styles.recurringBadgeText}>RECURRING</Text>
                        </View>
                      )}
                      <Text style={styles.sessionTitle}>{session.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                        <AppIcon name="venue" size={11} tint={colors.textLight} />
                        <Text style={styles.sessionMeta}>{session.venue}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <AppIcon name="time" size={11} tint={colors.textLight} />
                        <Text style={styles.sessionMeta}>{session.session_time?.slice(0,5)}</Text>
                      </View>
                    </View>
                  </View>
                  {/* Action buttons — edit + delete */}
                  <View style={styles.sessionCardRight}>
                    <Text style={styles.sessionArrow}>›</Text>
                    <View style={styles.cardActions}>
                      {/* Edit button */}
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => handleEditOpen(session)}
                        activeOpacity={0.7}>
                        <AppIcon name="edit" size={13} tint={colors.gold} />
                      </TouchableOpacity>
                      {/* Delete button */}
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDelete(session)}
                        activeOpacity={0.7}>
                        <AppIcon name="delete" size={13} tint={colors.red} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>

    {/* ── Date picker — modal with backdrop, tap outside to dismiss ── */}
      <Modal
        visible={datePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDatePickerOpen(false)}>
        <TouchableOpacity
          style={styles.datePickerBackdrop}
          activeOpacity={1}
          onPress={() => setDatePickerOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.datePickerContainer}>
            <DateTimePicker
              value={(() => {
                const raw = datePickerField === 'session_date' ? form.session_date : form.end_date
                if (raw && raw.length === 10) {
                  const [dd, mm, yyyy] = raw.split('-')
                  return new Date(`${yyyy}-${mm}-${dd}`)
                }
                return new Date()
              })()}
              mode="date"
              display="inline"
              minimumDate={new Date()}
              themeVariant="dark"
              accentColor={colors.gold}
              onChange={(event, selectedDate) => {
                setDatePickerOpen(false)
                if (event.type === 'dismissed' || !selectedDate) return
                const formatted = toDDMMYYYY(selectedDate)
                if (datePickerField === 'session_date') {
                  const smartTime = defaultTimeForDate(formatted)
                  setForm(f => ({ ...f, session_date: formatted, session_time: smartTime }))
                } else {
                  setForm(f => ({ ...f, end_date: formatted }))
                }
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.navy },
  scroll:           { flex: 1 },
  content:          { padding: spacing.md, paddingBottom: 60 },
  pageHeaderRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.lg },
  sectionLabel:     { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.gold, marginBottom: 4 },
  pageTitle:        { fontFamily: fonts.display, fontSize: 36, letterSpacing: 2, color: colors.white, lineHeight: 40, textTransform: 'uppercase' },
  primaryBtn:       { backgroundColor: colors.gold, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 10 },
  cancelBtn:        { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  primaryBtnText:   { fontFamily: fonts.bold, fontSize: 13, color: colors.navy },
  cancelBtnText:    { color: colors.red },

  formCard:         { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  formTitle:        { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  // Edit-mode notice — warn user this edit affects only this session
  editNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(245,197,24,0.06)', borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.2)', borderRadius: radius.sm,
    padding: 10, marginBottom: spacing.sm,
  },
  editNoticeText: { fontFamily: fonts.body, fontSize: 11, color: colors.gold, flex: 1, lineHeight: 16 },
  // Date picker modal — centered with backdrop dismiss
  datePickerBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  datePickerContainer:  { backgroundColor: colors.navyLight, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)' },
  inputLabel:       { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1, color: colors.textMuted, marginBottom: 6, marginTop: spacing.sm, textTransform: 'uppercase' },
  input:            { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontFamily: fonts.body, fontSize: 14, color: colors.white, marginBottom: spacing.sm },
  pickerBtn:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, marginBottom: spacing.sm },
  pickerBtnText:    { fontFamily: fonts.body, fontSize: 14, color: colors.white },
  pickerArrow:      { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },

  recurringToggle:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  recurringToggleActive: { borderColor: 'rgba(245,197,24,0.3)', backgroundColor: 'rgba(245,197,24,0.04)' },
  recurringToggleLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recurringToggleTitle:  { fontFamily: fonts.bold, fontSize: 14, color: colors.textLight, marginBottom: 2 },
  recurringToggleSub:    { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  toggleDot:             { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.border },
  toggleDotActive:       { backgroundColor: colors.gold },

  dateBtn:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 13, marginBottom: spacing.sm },
  dateBtnText:      { fontFamily: fonts.medium, fontSize: 15, color: colors.white },
  formBtns:         { marginTop: spacing.sm },
  submitBtn:        { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  submitBtnText:    { fontFamily: fonts.bold, fontSize: 14, color: colors.navy },

  emptyCard:        { backgroundColor: colors.navyLight, borderRadius: radius.md, padding: 48, alignItems: 'center' },
  emptyTitle:       { fontFamily: fonts.display, fontSize: 22, letterSpacing: 1, color: colors.white, marginBottom: 6 },
  emptyText:        { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  monthGroup:       { marginBottom: spacing.xl },
  monthHeader:      { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 2, color: colors.gold, marginBottom: spacing.md, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },

  sessionCard:      { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionCardLeft:  { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  sessionDateBlock: { alignItems: 'center', paddingRight: 14, borderRightWidth: 1, borderRightColor: colors.border, minWidth: 44 },
  sessionDateNum:   { fontFamily: fonts.display, fontSize: 26, color: colors.gold, lineHeight: 28 },
  sessionDateDow:   { fontFamily: fonts.bold, fontSize: 10, color: colors.textMuted, letterSpacing: 1 },
  sessionInfo:      { flex: 1 },
  recurringBadge:   { backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 4 },
  recurringBadgeText: { fontFamily: fonts.bold, fontSize: 9, color: colors.gold, letterSpacing: 1 },
  sessionTitle:     { fontFamily: fonts.bold, fontSize: 14, color: colors.white, marginBottom: 3, textTransform: 'uppercase' },
  sessionMeta:      { fontFamily: fonts.bold, fontSize: 11, color: colors.textLight, marginBottom: 2 },
  sessionCardRight: { alignItems: 'flex-end', gap: 4 },
  sessionArrow:     { fontFamily: fonts.bold, fontSize: 22, color: colors.gold },
  // Edit + delete buttons grouped vertically
  cardActions:      { gap: 4 },
  editBtn:          { backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  deleteBtn:        { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 5 },

  modalBackdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:       { backgroundColor: colors.navyLight, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 40, maxHeight: '60%' },
  modalHandle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  modalTitle:       { fontFamily: fonts.display, fontSize: 20, letterSpacing: 2, color: colors.white, marginBottom: spacing.md },
  timeOption:       { paddingVertical: 14, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 8 },
  timeOptionActive: { borderColor: 'rgba(245,197,24,0.4)', backgroundColor: 'rgba(245,197,24,0.08)' },
  timeOptionText:   { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted },
  timeOptionTextActive: { fontFamily: fonts.bold, color: colors.gold },
})

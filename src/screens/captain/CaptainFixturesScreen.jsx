// pavilion-app/src/screens/captain/CaptainFixturesScreen.jsx
// Captain fixture management — add, edit, delete, remind, select squad

import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, RefreshControl, Modal,
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
const EMPTY_FORM = { opponent: '', venue: '', match_date: '', match_time: '12:30', match_type: 'league', home_away: 'home' }

const MATCH_TYPES = [
  { key: 'league', label: 'MCCL' },
  { key: 'cup', label: 'Cup' },
  { key: 'friendly', label: 'Friendly' },
  { key: 'sunday_comp', label: 'CVSL' },
]

export default function CaptainFixturesScreen({ navigation }) {
  const profile = useAuthStore(s => s.profile)
  const isAdmin = useAuthStore(s => s.isAdmin)

  const [myTeam,       setMyTeam]       = useState(null)
  const [allTeams,     setAllTeams]     = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [fixtures,     setFixtures]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [showForm,     setShowForm]     = useState(false)
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [editingId,    setEditingId]    = useState(null)
  const [submitting,   setSubmitting]   = useState(false)
  const [reminding,    setReminding]    = useState(null)
  const [typePickerOpen, setTypePickerOpen] = useState(false)
  const [haPickerOpen,   setHaPickerOpen]   = useState(false)
  const [teamPickerOpen, setTeamPickerOpen] = useState(false)

  useFocusEffect(useCallback(() => { loadTeam() }, []))
  useFocusEffect(useCallback(() => { if (selectedTeamId) fetchFixtures() }, [selectedTeamId]))

  const loadTeam = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    if (isAdmin?.()) {
      const { data } = await supabase.from('teams').select('id, name, day_type').order('name')
      if (data) { setAllTeams(data); if (!selectedTeamId) setSelectedTeamId(data[0]?.id || null) }
    } else {
      const { data: tm } = await supabase.from('team_members')
        .select('teams(id, name, day_type)').eq('player_id', profile.id).eq('status', 'active').limit(1).single()
      if (tm?.teams) { setMyTeam(tm.teams); setSelectedTeamId(tm.teams.id) }
    }
    setLoading(false)
    setRefreshing(false)
  }

  const fetchFixtures = async () => {
    if (!selectedTeamId) return
    const { data } = await supabase.from('fixtures')
      .select('*, teams(id, name), squads(id, published, published_at, squad_members(player_id))')
      .eq('team_id', selectedTeamId).order('match_date', { ascending: true })
    if (data) setFixtures(data)
  }

  const handleEdit = (fixture) => {
    setForm({ opponent: fixture.opponent, venue: fixture.venue, match_date: fixture.match_date,
      match_time: fixture.match_time?.slice(0,5) || '12:30', match_type: fixture.match_type, home_away: fixture.home_away || 'home' })
    setEditingId(fixture.id)
    setShowForm(true)
  }

  const handleCancel = () => { setShowForm(false); setForm(EMPTY_FORM); setEditingId(null) }

  const handleSubmit = async () => {
    if (!form.opponent)   { Alert.alert('Error', 'Opponent required'); return }
    if (!form.venue)      { Alert.alert('Error', 'Venue required'); return }
    if (!form.match_date) { Alert.alert('Error', 'Date required'); return }
    setSubmitting(true)
    try {
      const teamName = myTeam?.name || allTeams.find(t => t.id === selectedTeamId)?.name || ''
      const payload  = { ...form, team_id: selectedTeamId, day_type: teamName === 'Sunday XI' ? 'sunday' : 'saturday' }
      if (editingId) {
        const { error } = await supabase.from('fixtures').update(payload).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('fixtures').insert({ ...payload, created_by: profile.id })
        if (error) throw error
      }
      handleCancel()
      await fetchFixtures()
    } catch (err) {
      Alert.alert('Error', 'Failed to save: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = (fixture) => {
    if (fixture.squads?.[0]?.published) { Alert.alert('Cannot Delete', 'Squad has been published. Unpublish it first.'); return }
    Alert.alert('Delete Fixture', `Delete vs ${fixture.opponent}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('fixtures').delete().eq('id', fixture.id)
        setFixtures(prev => prev.filter(f => f.id !== fixture.id))
      }},
    ])
  }

  const handleRemind = async (fixture) => {
    setReminding(fixture.id)
    try {
      const { data, error } = await supabase.rpc('send_fixture_reminder', { p_fixture_id: fixture.id })
      if (error) throw error
      Alert.alert('Reminder', data === 0 ? 'All players have already responded.' : `Reminder sent to ${data} player${data !== 1 ? 's' : ''}.`)
    } catch { Alert.alert('Error', 'Failed to send reminder') }
    finally { setReminding(null) }
  }

  const currentTeam = myTeam || allTeams.find(t => t.id === selectedTeamId)
  const typeName  = MATCH_TYPES.find(t => t.key === form.match_type)?.label || 'League'
  const haLabel   = form.home_away === 'home' ? 'Home' : form.home_away === 'away' ? 'Away' : 'Neutral'

  return (
    <View style={styles.container}>
      <TopHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadTeam(true)} tintColor={colors.gold} />}
        showsVerticalScrollIndicator={false}>

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AppIcon name="back" size={13} tint={colors.textMuted} />
            <Text style={styles.backText}>Back</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.pageHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionLabel}>CAPTAIN</Text>
            <Text style={styles.pageTitle}>MY FIXTURES</Text>
            {currentTeam && <Text style={styles.teamName}>{currentTeam.name}</Text>}
          </View>
          <TouchableOpacity style={[styles.primaryBtn, showForm && styles.cancelBtn]}
            onPress={() => editingId ? handleCancel() : setShowForm(v => !v)} activeOpacity={0.8}>
            <Text style={[styles.primaryBtnText, showForm && styles.cancelBtnText]}>
              {showForm ? '✕ Cancel' : '+ Add'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Admin team switcher ── */}
        {isAdmin?.() && allTeams.length > 0 && (
          <TouchableOpacity style={styles.teamSwitcher} onPress={() => setTeamPickerOpen(true)} activeOpacity={0.8}>
            <Text style={styles.teamSwitcherText}>{currentTeam?.name || 'Select team'}</Text>
            <Text style={styles.pickerArrow}>▾</Text>
          </TouchableOpacity>
        )}

        {/* ── Form ── */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingId ? 'Edit Fixture' : 'New Fixture'}</Text>

            <Text style={styles.inputLabel}>Opponent</Text>
            <TextInput style={styles.input} placeholder="e.g. Ealing CC" placeholderTextColor={colors.textMuted}
              value={form.opponent} onChangeText={v => setForm(f => ({ ...f, opponent: v }))} />

            <Text style={styles.inputLabel}>Venue</Text>
            <TextInput style={styles.input} placeholder="e.g. Rayners Lane" placeholderTextColor={colors.textMuted}
              value={form.venue} onChangeText={v => setForm(f => ({ ...f, venue: v }))} />

            <Text style={styles.inputLabel}>Match Date (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} placeholder="2026-05-02" placeholderTextColor={colors.textMuted}
              value={form.match_date} onChangeText={v => setForm(f => ({ ...f, match_date: v }))} />

            <Text style={styles.inputLabel}>Kick-off Time (HH:MM)</Text>
            <TextInput style={styles.input} placeholder="12:30" placeholderTextColor={colors.textMuted}
              value={form.match_time} onChangeText={v => setForm(f => ({ ...f, match_time: v }))} />

            <Text style={styles.inputLabel}>Match Type</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setTypePickerOpen(true)} activeOpacity={0.8}>
              <Text style={styles.pickerBtnText}>{typeName}</Text>
              <Text style={styles.pickerArrow}>▾</Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Home / Away</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setHaPickerOpen(true)} activeOpacity={0.8}>
              <Text style={styles.pickerBtnText}>{haLabel}</Text>
              <Text style={styles.pickerArrow}>▾</Text>
            </TouchableOpacity>

            <View style={styles.formBtns}>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} activeOpacity={0.8} disabled={submitting}>
                <Text style={styles.submitBtnText}>{submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Create Fixture'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostBtn} onPress={handleCancel} activeOpacity={0.7}>
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Fixtures list ── */}
        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
        ) : !selectedTeamId ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>⚠️</Text>
            <Text style={styles.emptyTitle}>NO TEAM ASSIGNED</Text>
            <Text style={styles.emptyText}>Contact an admin to be assigned as captain</Text>
          </View>
        ) : fixtures.length === 0 ? (
          <View style={styles.emptyCard}>
            <AppIcon name="date" size={36} tint={colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>NO FIXTURES YET</Text>
            <Text style={styles.emptyText}>Tap "+ Add" to schedule your first match</Text>
          </View>
        ) : (
          fixtures.map(fixture => {
            const squad       = fixture.squads?.[0] || null
            const isPublished = squad?.published || false
            const squadCount  = squad?.squad_members?.length || 0

            return (
              <View key={fixture.id} style={styles.fixtureCard}>
                <View style={styles.fixtureTop}>
                  {/* Date block */}
                  <View style={styles.dateBlock}>
                    <Text style={styles.dateNum}>{format(parseISO(fixture.match_date), 'dd')}</Text>
                    <Text style={styles.dateDow}>{format(parseISO(fixture.match_date), 'EEE').toUpperCase()}</Text>
                    <Text style={styles.dateMon}>{format(parseISO(fixture.match_date), 'MMM').toUpperCase()}</Text>
                  </View>

                  {/* Info */}
                  <View style={styles.fixtureInfo}>
                    <View style={styles.tagRow}>
                      {(() => {
                        const hwCfg = fixture.home_away === 'home'
                          ? { icon: 'homeFixture', label: 'HOME',    color: colors.green,     bg: 'rgba(34,197,94,0.1)',      border: 'rgba(34,197,94,0.25)' }
                          : fixture.home_away === 'away'
                          ? { icon: 'awayFixture', label: 'AWAY',    color: '#60A5FA',         bg: 'rgba(96,165,250,0.1)',     border: 'rgba(96,165,250,0.25)' }
                          : { icon: 'neutral',     label: 'NEUTRAL', color: colors.textMuted,  bg: 'rgba(255,255,255,0.04)',   border: colors.border }
                        return (
                          <View style={[styles.hwBadge, { backgroundColor: hwCfg.bg, borderColor: hwCfg.border, flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
                            <AppIcon name={hwCfg.icon} size={10} tint={hwCfg.color} />
                            <Text style={[styles.hwBadgeText, { color: hwCfg.color }]}>{hwCfg.label}</Text>
                          </View>
                        )
                      })()}
                      <Text style={styles.matchTypeText}>{MATCH_TYPE_LABELS[fixture.match_type] || fixture.match_type}</Text>
                      {isPublished ? (
                        <View style={styles.publishedBadge}><Text style={styles.publishedText}>✓ SQUAD</Text></View>
                      ) : squadCount > 0 ? (
                        <View style={styles.draftBadge}><Text style={styles.draftText}>{squadCount}/11</Text></View>
                      ) : null}
                    </View>
                    <Text style={styles.fixtureTitle}>HTCC <Text style={styles.vsText}>vs</Text> {fixture.opponent?.toUpperCase()}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                      <AppIcon name="date" size={11} tint={colors.textLight} />
                      <Text style={styles.fixtureMeta}>{format(parseISO(fixture.match_date), 'EEE d MMM yyyy')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                      <AppIcon name="time" size={11} tint={colors.textLight} />
                      <Text style={styles.fixtureMeta}>{fixture.match_time?.slice(0,5)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                      <AppIcon name="venue" size={11} tint={colors.textLight} />
                      <Text style={styles.fixtureMeta}>{fixture.venue}</Text>
                    </View>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.squadBtn}
                    onPress={() => navigation.navigate(SCREENS.SQUAD_SELECTION, { fixtureId: fixture.id })}
                    activeOpacity={0.8}>
                    <Text style={styles.squadBtnText}>{isPublished ? 'View Squad' : 'Select Squad'}</Text>
                  </TouchableOpacity>
                  {new Date(fixture.match_date) >= new Date() && (
                    <TouchableOpacity style={styles.remindBtn}
                      onPress={() => handleRemind(fixture)} disabled={reminding === fixture.id} activeOpacity={0.8}>
                      {reminding === fixture.id
                        ? <Text style={styles.remindBtnText}>…</Text>
                        : <AppIcon name="alerts" size={14} tint="#60A5FA" />
                      }
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(fixture)} activeOpacity={0.8}>
                    <AppIcon name="edit" size={14} tint={colors.gold} />
                  </TouchableOpacity>
                  {!isPublished && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(fixture)} activeOpacity={0.8}>
                      <AppIcon name="delete" size={14} tint={colors.red} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )
          })
        )}
      </ScrollView>

      {/* ── Match type modal ── */}
      <Modal visible={typePickerOpen} transparent animationType="slide" onRequestClose={() => setTypePickerOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setTypePickerOpen(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Match Type</Text>
            {MATCH_TYPES.map(t => (
              <TouchableOpacity key={t.key} style={[styles.pickerOption, form.match_type === t.key && styles.pickerOptionActive]}
                onPress={() => { setForm(f => ({ ...f, match_type: t.key })); setTypePickerOpen(false) }} activeOpacity={0.7}>
                <Text style={[styles.pickerOptionText, form.match_type === t.key && styles.pickerOptionTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── HA modal ── */}
      <Modal visible={haPickerOpen} transparent animationType="slide" onRequestClose={() => setHaPickerOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setHaPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Home / Away</Text>
            {[{key:'home',label:'Home'},{key:'away',label:'Away'},{key:'neutral',label:'Neutral'}].map(opt => (
              <TouchableOpacity key={opt.key} style={[styles.pickerOption, form.home_away === opt.key && styles.pickerOptionActive]}
                onPress={() => { setForm(f => ({ ...f, home_away: opt.key })); setHaPickerOpen(false) }} activeOpacity={0.7}>
                <Text style={[styles.pickerOptionText, form.home_away === opt.key && styles.pickerOptionTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Team picker modal (admin only) ── */}
      <Modal visible={teamPickerOpen} transparent animationType="slide" onRequestClose={() => setTeamPickerOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setTeamPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Team</Text>
            {allTeams.map(t => (
              <TouchableOpacity key={t.id} style={[styles.pickerOption, selectedTeamId === t.id && styles.pickerOptionActive]}
                onPress={() => { setSelectedTeamId(t.id); setTeamPickerOpen(false) }} activeOpacity={0.7}>
                <Text style={[styles.pickerOptionText, selectedTeamId === t.id && styles.pickerOptionTextActive]}>{t.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
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
  pageHeaderRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.lg },
  sectionLabel:    { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.green, marginBottom: 4 },
  pageTitle:       { fontFamily: fonts.display, fontSize: 36, letterSpacing: 2, color: colors.white, lineHeight: 40 },
  teamName:        { fontFamily: fonts.bold, fontSize: 13, color: colors.green, marginTop: 4 },
  primaryBtn:      { backgroundColor: colors.gold, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 10 },
  cancelBtn:       { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  primaryBtnText:  { fontFamily: fonts.bold, fontSize: 13, color: colors.navy },
  cancelBtnText:   { color: colors.red },
  teamSwitcher:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, marginBottom: spacing.md },
  teamSwitcherText:{ fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  pickerArrow:     { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },

  formCard:        { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  formTitle:       { fontFamily: fonts.bold, fontSize: 15, color: colors.white, marginBottom: spacing.md },
  inputLabel:      { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1, color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' },
  input:           { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontFamily: fonts.body, fontSize: 14, color: colors.white, marginBottom: spacing.md },
  pickerBtn:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, marginBottom: spacing.md },
  pickerBtnText:   { fontFamily: fonts.body, fontSize: 14, color: colors.white },
  formBtns:        { flexDirection: 'row', gap: 10, marginTop: 4 },
  submitBtn:       { flex: 1, backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  submitBtnText:   { fontFamily: fonts.bold, fontSize: 14, color: colors.navy },
  ghostBtn:        { paddingVertical: 13, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: 'center' },
  ghostBtnText:    { fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },

  emptyCard:       { backgroundColor: colors.navyLight, borderRadius: radius.md, padding: 48, alignItems: 'center' },
  emptyIcon:       { fontSize: 40, marginBottom: 12 },
  emptyTitle:      { fontFamily: fonts.display, fontSize: 22, letterSpacing: 1, color: colors.white, marginBottom: 6 },
  emptyText:       { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  fixtureCard:     { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 12, overflow: 'hidden' },
  fixtureTop:      { flexDirection: 'row', gap: 14, padding: spacing.md },
  dateBlock:       { alignItems: 'center', paddingRight: 14, borderRightWidth: 1, borderRightColor: colors.border, minWidth: 44 },
  dateNum:         { fontFamily: fonts.display, fontSize: 28, color: colors.gold, lineHeight: 30 },
  dateDow:         { fontFamily: fonts.bold, fontSize: 10, color: colors.textMuted, letterSpacing: 1 },
  dateMon:         { fontFamily: fonts.bold, fontSize: 10, color: colors.textMuted },
  fixtureInfo:     { flex: 1 },
  tagRow:          { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' },
  hwBadge:         { borderWidth: 1, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 },
  hwBadgeText:     { fontFamily: fonts.bold, fontSize: 10 },
  matchTypeText:   { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  publishedBadge:  { backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  publishedText:   { fontFamily: fonts.bold, fontSize: 10, color: colors.green },
  draftBadge:      { backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  draftText:       { fontFamily: fonts.bold, fontSize: 10, color: colors.gold },
  fixtureTitle:    { fontFamily: fonts.bold, fontSize: 15, color: colors.white, marginBottom: 3 },
  vsText:          { fontFamily: fonts.display, fontSize: 15, color: colors.gold },
  fixtureMeta:     { fontFamily: fonts.bold, fontSize: 11, color: colors.textLight, marginBottom: 2 },
  actionRow:       { flexDirection: 'row', gap: 6, padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  squadBtn:        { flex: 2, backgroundColor: colors.gold, borderRadius: radius.sm, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  squadBtnText:    { fontFamily: fonts.bold, fontSize: 12, color: colors.navy },
  remindBtn:       { flex: 1, backgroundColor: 'rgba(96,165,250,0.1)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)', borderRadius: radius.sm, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  remindBtnText:   { fontFamily: fonts.bold, fontSize: 14, color: '#60A5FA' },
  editBtn:         { flex: 1, backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)', borderRadius: radius.sm, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  editBtnText:     { fontFamily: fonts.bold, fontSize: 12, color: colors.gold },
  deleteBtn:       { flex: 1, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: radius.sm, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText:   { fontFamily: fonts.bold, fontSize: 12, color: colors.red },

  modalBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:      { backgroundColor: colors.navyLight, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(34,197,94,0.15)', padding: spacing.lg, paddingBottom: 40 },
  modalHandle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  modalTitle:      { fontFamily: fonts.display, fontSize: 20, letterSpacing: 2, color: colors.white, marginBottom: spacing.md },
  pickerOption:    { paddingVertical: 14, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 8 },
  pickerOptionActive: { borderColor: 'rgba(34,197,94,0.4)', backgroundColor: 'rgba(34,197,94,0.08)' },
  pickerOptionText:   { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted },
  pickerOptionTextActive: { fontFamily: fonts.bold, color: colors.green },
})
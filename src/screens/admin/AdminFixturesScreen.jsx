// pavilion-app/src/screens/admin/AdminFixturesScreen.jsx
// Admin fixture management — add, edit, delete fixtures with reminder

import React, { useState, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, RefreshControl, Modal,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { format, parseISO } from 'date-fns'
import DateTimePicker from '@react-native-community/datetimepicker'
import { supabase } from '../../lib/supabase'
import useAuthStore from '../../store/authStore'
import TopHeader from '../../components/layout/TopHeader'
import { colors, fonts, spacing, radius } from '../../theme'
import { SCREENS, MATCH_TYPE_LABELS } from '../../lib/constants'
import AppIcon from '../../components/AppIcon'

// ─── Configurable ─────────────────────────────────────────────────────────────
const EMPTY_FORM = { team_id: '', opponent: '', venue: '', match_date: '', match_time: '12:30', match_type: 'league', home_away: 'home' }

const toISO      = (dd_mm_yyyy) => {
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
const isoToDisplay = (iso) => {
  if (!iso || iso.length !== 10) return iso
  const [yyyy, mm, dd] = iso.split('-')
  return `${dd}-${mm}-${yyyy}`
}

const MATCH_TYPES = [
  { key: 'league',      label: 'MCCL' },
  { key: 'cup',         label: 'Cup' },
  { key: 'friendly',    label: 'Friendly' },
  { key: 'sunday_comp', label: 'CVSL' },
]

export default function AdminFixturesScreen({ navigation }) {
  const profile = useAuthStore(s => s.profile)

  const [fixtures,    setFixtures]    = useState([])
  const [teams,       setTeams]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [showForm,    setShowForm]    = useState(false)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [editingId,   setEditingId]   = useState(null)
  const [submitting,     setSubmitting]     = useState(false)
  const [reminding,      setReminding]      = useState(null)
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  // Modal pickers state
  const [teamPickerOpen,  setTeamPickerOpen]  = useState(false)
  const [typePickerOpen,  setTypePickerOpen]  = useState(false)
  const [haPickerOpen,    setHaPickerOpen]    = useState(false)

  useFocusEffect(useCallback(() => { loadAll() }, []))

  const loadAll = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    await Promise.all([fetchFixtures(), fetchTeams()])
    setLoading(false)
    setRefreshing(false)
  }

  const fetchTeams = async () => {
    const { data } = await supabase.from('teams').select('id, name').order('name')
    if (data) setTeams(data)
  }

  const fetchFixtures = async () => {
    const { data } = await supabase.from('fixtures')
      .select('*, teams(name), squads(id, published)')
      .order('match_date', { ascending: true })
    if (data) setFixtures(data)
  }

  const handleEdit = (fixture) => {
    setForm({
      team_id:    fixture.team_id,
      opponent:   fixture.opponent,
      venue:      fixture.venue,
      match_date: isoToDisplay(fixture.match_date),
      match_time: fixture.match_time?.slice(0,5) || '12:30',
      match_type: fixture.match_type,
      home_away:  fixture.home_away || 'home',
    })
    setEditingId(fixture.id)
    setShowForm(true)
  }

  const handleCancel = () => { setShowForm(false); setForm(EMPTY_FORM); setEditingId(null) }

  const handleSubmit = async () => {
    if (!form.team_id)    { Alert.alert('Error', 'Please select a team'); return }
    if (!form.opponent)   { Alert.alert('Error', 'Opponent is required'); return }
    if (!form.venue)      { Alert.alert('Error', 'Venue is required'); return }
    if (!form.match_date) { Alert.alert('Error', 'Date is required'); return }

    const isoDate = toISO(form.match_date)
    if (!isoDate) { Alert.alert('Error', 'Invalid date — use DD-MM-YYYY format'); return }

    setSubmitting(true)
    try {
      const teamName = teams.find(t => t.id === form.team_id)?.name || ''
      const payload  = { ...form, match_date: isoDate, day_type: teamName === 'Sunday XI' ? 'sunday' : 'saturday' }

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
      Alert.alert('Error', 'Failed to save fixture: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = (fixture) => {
    Alert.alert('Delete Fixture', `Delete vs ${fixture.opponent}? All availability will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('fixtures').delete().eq('id', fixture.id)
        if (error) {
          Alert.alert('Delete Failed', error.message)
          return
        }
        setFixtures(prev => prev.filter(f => f.id !== fixture.id))
      }},
    ])
  }

  const handleRemind = async (fixture) => {
    setReminding(fixture.id)
    try {
      const { data, error } = await supabase.rpc('send_fixture_reminder', { p_fixture_id: fixture.id })
      if (error) throw error
      Alert.alert('Reminder Sent', data === 0 ? 'All players have already responded.' : `Reminder sent to ${data} player${data !== 1 ? 's' : ''}.`)
    } catch (err) {
      Alert.alert('Error', 'Failed to send reminder')
    } finally {
      setReminding(null)
    }
  }

  // ─── Split into upcoming and past ────────────────────────────────────────
  // Use Monday 00:00 as the cutoff — Saturday and Sunday fixtures stay in
  // "upcoming" all weekend and move to archive together on Monday morning
  const [showArchive, setShowArchive] = useState(false)

  // Cache Monday ISO — avoids creating new Date objects on every render
  const thisMondayISO = useMemo(() => {
    const today = new Date()
    const day   = today.getDay()
    const diff  = day === 0 ? -6 : 1 - day
    const mon   = new Date(today)
    mon.setDate(today.getDate() + diff)
    mon.setHours(0, 0, 0, 0)
    const year  = mon.getFullYear()
    const month = String(mon.getMonth() + 1).padStart(2, '0')
    const d     = String(mon.getDate()).padStart(2, '0')
    return `${year}-${month}-${d}`
  }, [])

  const upcomingFixtures = useMemo(
    () => fixtures.filter(f => f.match_date >= thisMondayISO),
    [fixtures, thisMondayISO]
  )
  const pastFixtures = useMemo(
    () => fixtures.filter(f => f.match_date < thisMondayISO),
    [fixtures, thisMondayISO]
  )

  // Group upcoming by month — memoised to avoid re-running reduce on every render
  const upcomingSections = useMemo(() => {
    const grouped = upcomingFixtures.reduce((acc, f) => {
      const month = format(parseISO(f.match_date), 'MMMM yyyy')
      if (!acc[month]) acc[month] = []
      acc[month].push(f)
      return acc
    }, {})
    return Object.entries(grouped).map(([month, data]) => ({
      title: month, count: data.length, data,
    }))
  }, [upcomingFixtures])

  // Sections for sticky month headers
  // Count non-section direct ScrollView children that appear before the first month header
  // Each section = 2 direct children [month header, items group]
  const adminStickyIndices = useMemo(() => {
    if (loading) return []
    const base =
      1 +                                               // pageHeaderRow — always present
      (showForm ? 1 : 0) +                              // form card
      (pastFixtures.length > 0 ? 1 : 0) +              // archive toggle
      (showArchive && pastFixtures.length > 0 ? 1 : 0) // archive list
    return upcomingSections.map((_, i) => base + i * 2)
  }, [loading, showForm, pastFixtures.length, showArchive, upcomingSections])

  const selectedTeamName = useMemo(
    () => teams.find(t => t.id === form.team_id)?.name || 'Select team…',
    [teams, form.team_id]
  )
  const selectedTypeName = useMemo(
    () => MATCH_TYPES.find(t => t.key === form.match_type)?.label || 'League',
    [form.match_type]
  )
  const haLabel = form.home_away === 'home' ? 'Home' : form.home_away === 'away' ? 'Away' : 'Neutral'

  return (
    <View style={styles.container}>
      <TopHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor={colors.gold} />}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={adminStickyIndices}>

        <View style={styles.pageHeaderRow}>
          <View>
            <Text style={styles.sectionLabel}>ADMINISTRATION</Text>
            <Text style={styles.pageTitle}>FIXTURES</Text>
          </View>
          <TouchableOpacity style={[styles.primaryBtn, showForm && styles.cancelBtn]}
            onPress={() => editingId ? handleCancel() : setShowForm(v => !v)} activeOpacity={0.8}>
            <Text style={[styles.primaryBtnText, showForm && styles.cancelBtnText]}>
              {showForm ? '✕ Cancel' : '+ Add Fixture'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Form ── */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {editingId ? 'Edit Fixture' : 'New Fixture'}
              <Text style={editingId ? {} : { color: colors.gold }}>
                {editingId ? '' : 'New Fixture'}
              </Text>
            </Text>

            <Text style={styles.inputLabel}>Team</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setTeamPickerOpen(true)} activeOpacity={0.8}>
              <Text style={[styles.pickerBtnText, !form.team_id && { color: colors.textMuted }]}>{selectedTeamName}</Text>
              <Text style={styles.pickerArrow}>▾</Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Opponent</Text>
            <TextInput style={styles.input} placeholder="e.g. Harrow Town CC" placeholderTextColor={colors.textMuted}
              value={form.opponent} onChangeText={v => setForm(f => ({ ...f, opponent: v }))} />

            <Text style={styles.inputLabel}>Venue</Text>
            <TextInput style={styles.input} placeholder="e.g. Rayners Lane" placeholderTextColor={colors.textMuted}
              value={form.venue} onChangeText={v => setForm(f => ({ ...f, venue: v }))} />

            <Text style={styles.inputLabel}>Match Date</Text>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => setDatePickerOpen(true)}
              activeOpacity={0.8}>
              <Text style={[styles.dateBtnText, !form.match_date && { color: colors.textMuted }]}>
                {form.match_date || 'DD-MM-YYYY'}
              </Text>
              <AppIcon name="date" size={18} tint={colors.gold} />
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Kick-off Time (HH:MM)</Text>
            <TextInput style={styles.input} placeholder="12:30" placeholderTextColor={colors.textMuted}
              value={form.match_time} onChangeText={v => setForm(f => ({ ...f, match_time: v }))} />

            <Text style={styles.inputLabel}>Match Type</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setTypePickerOpen(true)} activeOpacity={0.8}>
              <Text style={styles.pickerBtnText}>{selectedTypeName}</Text>
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

        {/* ── Archive toggle ── */}
        {!loading && pastFixtures.length > 0 && (
          <TouchableOpacity
            style={styles.archiveToggle}
            onPress={() => setShowArchive(v => !v)}
            activeOpacity={0.8}
          >
            <View style={styles.archiveToggleLeft}>
              <Text style={styles.archiveToggleIcon}>🗄</Text>
              <View>
                <Text style={styles.archiveToggleTitle}>Past Fixtures Archive</Text>
                <Text style={styles.archiveToggleSub}>{pastFixtures.length} completed fixture{pastFixtures.length !== 1 ? 's' : ''}</Text>
              </View>
            </View>
            <Text style={styles.archiveToggleArrow}>{showArchive ? '▲' : '▼'}</Text>
          </TouchableOpacity>
        )}

        {/* ── Archive list ── */}
        {!loading && showArchive && pastFixtures.length > 0 && (
          <View style={styles.archiveSection}>
            {pastFixtures.sort((a,b) => b.match_date.localeCompare(a.match_date)).map(fixture => {
              const isPublished = fixture.squads?.[0]?.published || false
              return (
                <View key={fixture.id} style={[styles.fixtureCard, styles.archiveCard]}>
                  <View style={styles.fixtureCardTop}>
                    <View style={styles.fixtureDateBlock}>
                      <Text style={[styles.fixtureDateNum, styles.archiveDateNum]}>{format(parseISO(fixture.match_date), 'dd')}</Text>
                      <Text style={styles.fixtureDow}>{format(parseISO(fixture.match_date), 'EEE').toUpperCase()}</Text>
                    </View>
                    <View style={styles.fixtureInfo}>
                      <View style={styles.tagRow}>
                        <View style={styles.teamBadge}><Text style={styles.teamBadgeText}>{fixture.teams?.name}</Text></View>
                        <View style={styles.pastBadge}><Text style={styles.pastBadgeText}>PLAYED</Text></View>
                      </View>
                      <Text style={styles.fixtureTitle}>
                        HTCC <Text style={styles.vsText}>vs</Text> {fixture.opponent?.toUpperCase()}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <AppIcon name="venue" size={11} tint={colors.textLight} />
                        <Text style={styles.fixtureMeta}>{fixture.venue}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <AppIcon name="time" size={11} tint={colors.textLight} />
                        <Text style={styles.fixtureMeta}>{fixture.match_time?.slice(0,5)} · {format(parseISO(fixture.match_date), 'MMM yyyy')}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.squadBtn}
                      onPress={() => navigation.navigate(SCREENS.SQUAD_SELECTION, { fixtureId: fixture.id })}
                      activeOpacity={0.8}>
                      <Text style={styles.squadBtnText}>{isPublished ? 'View Squad' : 'Squad'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(fixture)} activeOpacity={0.8}>
                      <AppIcon name="edit" size={14} tint={colors.gold} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(fixture)} activeOpacity={0.8}>
                      <AppIcon name="delete" size={14} tint={colors.red} />
                    </TouchableOpacity>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* ── Upcoming fixture list grouped by month ── */}
        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
        ) : upcomingFixtures.length === 0 && pastFixtures.length === 0 ? (
          <View style={styles.emptyCard}>
            <AppIcon name="date" size={36} tint={colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>NO FIXTURES YET</Text>
            <Text style={styles.emptyText}>Tap "+ Add Fixture" to create one</Text>
          </View>
        ) : (
          upcomingSections.flatMap(section => [
            // Sticky month header — direct child of ScrollView
            <View key={`mh-${section.title}`} style={styles.monthHeaderRow}>
              <Text style={styles.monthTitle}>{section.title.toUpperCase()}</Text>
              <Text style={styles.monthCount}>{section.count} fixture{section.count !== 1 ? 's' : ''}</Text>
            </View>,
            // Fixture items — grouped in a single direct child of ScrollView
            <View key={`mi-${section.title}`} style={styles.monthItemsGroup}>
              {section.data.map(fixture => {
                const isPublished = fixture.squads?.[0]?.published || false
                return (
                  <View key={fixture.id} style={styles.fixtureCard}>
                    <View style={styles.fixtureCardTop}>
                      <View style={styles.fixtureDateBlock}>
                        <Text style={styles.fixtureDateNum}>{format(parseISO(fixture.match_date), 'dd')}</Text>
                        <Text style={styles.fixtureDow}>{format(parseISO(fixture.match_date), 'EEE').toUpperCase()}</Text>
                      </View>
                      <View style={styles.fixtureInfo}>
                        <View style={styles.tagRow}>
                          <View style={styles.teamBadge}><Text style={styles.teamBadgeText}>{fixture.teams?.name}</Text></View>
                          {(() => {
                            const hwCfg = fixture.home_away === 'home'
                              ? { icon: 'homeFixture', label: 'HOME',    color: colors.green,     bg: 'rgba(34,197,94,0.1)',      border: 'rgba(34,197,94,0.25)' }
                              : fixture.home_away === 'away'
                              ? { icon: 'awayFixture', label: 'AWAY',    color: '#60A5FA',         bg: 'rgba(96,165,250,0.1)',     border: 'rgba(96,165,250,0.25)' }
                              : { icon: 'neutral',     label: 'NEUTRAL', color: colors.textMuted,  bg: 'rgba(255,255,255,0.04)',   border: colors.border }
                            return (
                              <View style={[styles.hwBadge, { backgroundColor: hwCfg.bg, borderColor: hwCfg.border, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                                <AppIcon name={hwCfg.icon} size={10} tint={hwCfg.color} />
                                <Text style={[styles.hwBadgeText, { color: hwCfg.color }]}>{hwCfg.label}</Text>
                              </View>
                            )
                          })()}
                          {isPublished && <View style={styles.publishedBadge}><Text style={styles.publishedText}>✓ SQUAD</Text></View>}
                        </View>
                        <Text style={styles.fixtureTitle}>
                          HTCC <Text style={styles.vsText}>vs</Text> {fixture.opponent?.toUpperCase()}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                          <AppIcon name="venue" size={11} tint={colors.textLight} />
                          <Text style={styles.fixtureMeta}>{fixture.venue}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <AppIcon name="time" size={11} tint={colors.textLight} />
                          <Text style={styles.fixtureMeta}>{fixture.match_time?.slice(0,5)}</Text>
                        </View>
                      </View>
                    </View>
                    {/* Action buttons */}
                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.squadBtn}
                        onPress={() => navigation.navigate(SCREENS.SQUAD_SELECTION, { fixtureId: fixture.id })}
                        activeOpacity={0.8}>
                        <Text style={styles.squadBtnText}>{isPublished ? 'View Squad' : 'Select Squad'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.remindBtn}
                        onPress={() => handleRemind(fixture)} disabled={reminding === fixture.id} activeOpacity={0.8}>
                        {reminding === fixture.id
                          ? <Text style={styles.remindBtnText}>…</Text>
                          : <AppIcon name="alerts" size={14} tint="#60A5FA" />
                        }
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(fixture)} activeOpacity={0.8}>
                        <AppIcon name="edit" size={14} tint={colors.gold} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(fixture)} activeOpacity={0.8}>
                        <AppIcon name="delete" size={14} tint={colors.red} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )
              })}
            </View>,
          ])
        )}
      </ScrollView>

      {/* ── Team picker modal ── */}
      <Modal visible={teamPickerOpen} transparent animationType="slide" onRequestClose={() => setTeamPickerOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setTeamPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Team</Text>
            {teams.map(t => (
              <TouchableOpacity key={t.id} style={[styles.pickerOption, form.team_id === t.id && styles.pickerOptionActive]}
                onPress={() => { setForm(f => ({ ...f, team_id: t.id })); setTeamPickerOpen(false) }} activeOpacity={0.7}>
                <Text style={[styles.pickerOptionText, form.team_id === t.id && styles.pickerOptionTextActive]}>{t.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Match type picker modal ── */}
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

      {/* ── Home/Away picker modal ── */}
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
                if (form.match_date && form.match_date.length === 10) {
                  const [dd, mm, yyyy] = form.match_date.split('-')
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
                setForm(f => ({ ...f, match_date: toDDMMYYYY(selectedDate) }))
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
  backBtn:          { marginBottom: spacing.sm },
  backText:         { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  pageHeaderRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.lg },
  sectionLabel:     { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.gold, marginBottom: 4 },
  pageTitle:        { fontFamily: fonts.display, fontSize: 36, letterSpacing: 2, color: colors.white, lineHeight: 40 },
  primaryBtn:       { backgroundColor: colors.gold, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 10 },
  cancelBtn:        { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  primaryBtnText:   { fontFamily: fonts.bold, fontSize: 13, color: colors.navy },
  cancelBtnText:    { color: colors.red },

  formCard:         { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  formTitle:        { fontFamily: fonts.bold, fontSize: 15, color: colors.white, marginBottom: spacing.md },
  inputLabel:       { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' },
  input:            { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontFamily: fonts.body, fontSize: 14, color: colors.white, marginBottom: spacing.md },
  dateBtn:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 13, marginBottom: spacing.md },
  dateBtnText:      { fontFamily: fonts.medium, fontSize: 15, color: colors.white },
  dateBtnIcon:      { fontSize: 18 },
  // Picker buttons now match input container style
  pickerBtn:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, marginBottom: spacing.md },
  pickerBtnText:    { fontFamily: fonts.body, fontSize: 14, color: colors.white, flex: 1 },
  pickerArrow:      { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  // Date picker modal — centered with backdrop dismiss
  datePickerBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  datePickerContainer:  { backgroundColor: colors.navyLight, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)' },
  formBtns:         { flexDirection: 'row', gap: 10, marginTop: 4 },
  submitBtn:        { flex: 1, backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  submitBtnText:    { fontFamily: fonts.bold, fontSize: 14, color: colors.navy },
  ghostBtn:         { paddingVertical: 13, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: 'center' },
  ghostBtnText:     { fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },

  emptyCard:        { backgroundColor: colors.navyLight, borderRadius: radius.md, padding: 48, alignItems: 'center' },
  emptyIcon:        { fontSize: 40, marginBottom: 12 },
  emptyTitle:       { fontFamily: fonts.display, fontSize: 22, letterSpacing: 1, color: colors.white, marginBottom: 6 },
  emptyText:        { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  monthGroup:      { marginBottom: spacing.xl },
  monthHeader:     { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 2, color: colors.gold, marginBottom: spacing.md, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  // Sticky month header — negative margin cancels content padding so bg spans full width
  monthHeaderRow:  {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: spacing.md,
    marginHorizontal: -spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.navy,
    zIndex: 1,
  },
  monthTitle:      { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 2, color: colors.gold },
  monthCount:      { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  monthItemsGroup: { paddingTop: 8, marginBottom: spacing.xl },
  fixtureCard:      { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 10, overflow: 'hidden' },
  fixtureCardTop:   { flexDirection: 'row', gap: 12, padding: spacing.md },
  fixtureDateBlock: { alignItems: 'center', paddingRight: 12, borderRightWidth: 1, borderRightColor: colors.border, minWidth: 44 },
  fixtureDateNum:   { fontFamily: fonts.display, fontSize: 26, color: colors.gold, lineHeight: 28 },
  fixtureDow:       { fontFamily: fonts.bold, fontSize: 10, color: colors.textMuted, letterSpacing: 1 },
  fixtureInfo:      { flex: 1 },
  tagRow:           { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' },
  teamBadge:        { backgroundColor: 'rgba(245,197,24,0.1)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, alignItems: 'center', justifyContent: 'center' },
  teamBadgeText:    { fontFamily: fonts.bold, fontSize: 10, color: colors.gold },
  hwBadge:          { borderWidth: 1, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 },
  hwBadgeText:      { fontFamily: fonts.bold, fontSize: 10 },
  publishedBadge:   { backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  publishedText:    { fontFamily: fonts.bold, fontSize: 10, color: colors.green },
  fixtureTitle:     { fontFamily: fonts.bold, fontSize: 14, color: colors.white, marginBottom: 3 },
  vsText:           { fontFamily: fonts.display, color: colors.gold, fontSize: 14 },
  fixtureMeta:      { fontFamily: fonts.bold, fontSize: 11, color: colors.textLight, marginBottom: 2 },
  actionRow:        { flexDirection: 'row', gap: 6, padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  squadBtn:         { flex: 2, backgroundColor: colors.gold, borderRadius: radius.sm, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  squadBtnText:     { fontFamily: fonts.bold, fontSize: 12, color: colors.navy },
  remindBtn:        { flex: 1, backgroundColor: 'rgba(96,165,250,0.1)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)', borderRadius: radius.sm, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  remindBtnText:    { fontFamily: fonts.bold, fontSize: 14, color: '#60A5FA' },
  editBtn:          { flex: 1, backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)', borderRadius: radius.sm, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  editBtnText:      { fontFamily: fonts.bold, fontSize: 12, color: colors.gold },
  deleteBtn:        { flex: 1, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: radius.sm, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText:    { fontFamily: fonts.bold, fontSize: 12, color: colors.red },

  archiveToggle:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(139,155,180,0.06)', borderWidth: 1, borderColor: 'rgba(139,155,180,0.2)', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  archiveToggleLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  archiveToggleIcon:  { fontSize: 20 },
  archiveToggleTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.textLight, marginBottom: 2 },
  archiveToggleSub:   { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  archiveToggleArrow: { fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },
  archiveSection:     { marginBottom: spacing.lg },
  archiveCard:        { opacity: 0.7 },
  archiveDateNum:     { color: colors.textMuted },
  pastBadge:          { backgroundColor: 'rgba(139,155,180,0.1)', borderWidth: 1, borderColor: 'rgba(139,155,180,0.2)', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  pastBadgeText:      { fontFamily: fonts.bold, fontSize: 10, color: colors.textMuted },

  modalBackdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:       { backgroundColor: colors.navyLight, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(245,197,24,0.15)', padding: spacing.lg, paddingBottom: 40 },
  modalHandle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  modalTitle:       { fontFamily: fonts.display, fontSize: 20, letterSpacing: 2, color: colors.white, marginBottom: spacing.md },
  pickerOption:     { paddingVertical: 14, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 8 },
  pickerOptionActive: { borderColor: 'rgba(245,197,24,0.4)', backgroundColor: 'rgba(245,197,24,0.08)' },
  pickerOptionText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted },
  pickerOptionTextActive: { fontFamily: fonts.bold, color: colors.gold },
})
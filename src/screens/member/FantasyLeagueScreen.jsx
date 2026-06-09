// pavilion-app/src/screens/member/FantasyLeagueScreen.jsx
// Pavilion Fantasy League — pick from published MCCL Playing XIs each matchday,
// earn POTM-formula points, compete on a season leaderboard.

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, Pressable, StyleSheet, Alert, ActivityIndicator,
  Animated, Easing, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { format, parseISO }  from 'date-fns'
import { supabase }          from '../../lib/supabase'
import useAuthStore          from '../../store/authStore'
import TopHeader             from '../../components/layout/TopHeader'
import AppIcon               from '../../components/AppIcon'
import { colors, fonts, spacing, radius } from '../../theme'
import { toTitleCase, TEAM_COLOURS, CLUB_NAME } from '../../lib/constants'
import { calcPlayerPoints, applyMultiplier }     from '../../lib/fantasyPoints'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TEAM_TAB_ORDER = ['1st XI', '2nd XI', '3rd XI', '4th XI']
const CUTOFF_HOUR    = 9

function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}
function teamShort(name = '') {
  if (name.includes('1st')) return '1ST XI'
  if (name.includes('2nd')) return '2ND XI'
  if (name.includes('3rd')) return '3RD XI'
  if (name.includes('4th')) return '4TH XI'
  return name.toUpperCase()
}
function teamTabColor(name = '') {
  for (const [key, col] of Object.entries(TEAM_COLOURS)) {
    if (name.includes(key.split(' ')[0])) return col
  }
  return colors.gold
}
function isCutoffPassed(matchdayDate) {
  if (!matchdayDate) return false
  const cutoff = new Date(matchdayDate + 'T' + String(CUTOFF_HOUR).padStart(2, '0') + ':00:00')
  return new Date() >= cutoff
}
// Local ISO date (BST-safe) — avoids UTC midnight date-shift
function toLocalISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function determineCurrentMatchday(matchdays) {
  if (!matchdays.length) return null
  const today = toLocalISO(new Date())
  return matchdays.find(md => md.date >= today) || matchdays[matchdays.length - 1]
}

// ─── Points reference data — matches FixtureDetailScreen POTM card exactly ────
const FANTASY_POINTS_REF = [
  { section: 'BATTING', color: colors.gold, rows: [
    { action: 'Per run',            pts: '+1'  },
    { action: 'Per four (bonus)',   pts: '+2'  },
    { action: 'Per six (bonus)',    pts: '+4'  },
    { action: 'Not out (≥30r)',     pts: '+5'  },
    { action: '25+ runs',           pts: '+10' },
    { action: '50+ runs',           pts: '+20' },
    { action: '100+ runs',          pts: '+40' },
    { action: 'Duck (dismissed 0)', pts: '−5'  },
    { action: 'Run out (batting)',  pts: '−8'  },
  ]},
  { section: 'BOWLING', color: '#60A5FA', rows: [
    { action: 'Per wicket',         pts: '+25' },
    { action: 'Per maiden',         pts: '+5'  },
    { action: '3+ wickets bonus',   pts: '+10' },
    { action: '4+ wickets bonus',   pts: '+15' },
    { action: '5+ wickets bonus',   pts: '+30' },
    { action: 'Per wide',           pts: '−1'  },
    { action: 'Per no-ball',        pts: '−2'  },
    { action: 'Economy 7–8',        pts: '−2'  },
    { action: 'Economy 8–9',        pts: '−3'  },
    { action: 'Economy 9–10',       pts: '−5'  },
    { action: 'Economy ≥10',        pts: '−8'  },
  ]},
  { section: 'FIELDING', color: colors.green, rows: [
    { action: 'Per catch',          pts: '+10' },
    { action: 'Per stumping',       pts: '+10' },
  ]},
  { section: 'MULTIPLIERS', color: '#F5C518', rows: [
    { action: 'Captain (C)',        pts: '×3'  },
    { action: 'Vice-Captain (VC)',  pts: '×2'  },
  ]},
]

// ─── PointsModal — matches FixtureDetailScreen POTM card UI exactly ──────────
function PointsModal({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.ptsBackdrop}>
        <View style={s.ptsBox}>
          {/* Header */}
          <View style={s.ptsBoxHeader}>
            <Text style={s.ptsBoxTitle}>POINTS SYSTEM</Text>
            <TouchableOpacity onPress={onClose} style={s.ptsBoxClose}>
              <Text style={s.ptsBoxCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          {/* Scrollable content — contentContainerStyle grows naturally, modal box clips at maxHeight */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
            {FANTASY_POINTS_REF.map(({ section, color, rows }) => (
              <View key={section} style={s.ptsSect}>
                <Text style={[s.ptsSectTitle, { color }]}>{section}</Text>
                {rows.map(row => {
                  const isNeg = row.pts.startsWith('−') || row.pts.startsWith('-')
                  const valCol = isNeg ? '#EF4444' : color
                  return (
                    <View key={row.action} style={s.ptsRowItem}>
                      <Text style={s.ptsRowAction}>{row.action}</Text>
                      <Text style={[s.ptsRowValue, { color: valCol }]}>{row.pts}</Text>
                    </View>
                  )
                })}
              </View>
            ))}
            <View style={{ height: 16 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

// ─── CreateTeamModal ──────────────────────────────────────────────────────────
function CreateTeamModal({ visible, saving, teamName, onChangeName, onSubmit, onClose, editMode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={s.centreBackdrop} onPress={onClose}>
          <Pressable style={s.centreBox} onPress={() => {}}>
            <Text style={s.centreTitle}>{editMode ? 'RENAME TEAM' : 'CREATE YOUR TEAM'}</Text>
            <Text style={s.centreSub}>
              {editMode ? 'Choose a new name for your fantasy team.' : 'Give your squad a unique name. You can change it any time.'}
            </Text>
            <TextInput
              style={s.teamNameInput}
              value={teamName}
              onChangeText={onChangeName}
              placeholder="e.g. Golden Arms XI"
              placeholderTextColor={colors.textMuted}
              maxLength={30}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />
            <Text style={s.charCount}>{teamName.length}/30</Text>
            <View style={s.centreBtns}>
              <TouchableOpacity style={s.centreCancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={s.centreCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.centreConfirmBtn, (saving || teamName.trim().length < 2) && s.btnDisabled]}
                onPress={onSubmit}
                disabled={saving || teamName.trim().length < 2}
                activeOpacity={0.8}
              >
                <Text style={s.centreConfirmText}>{saving ? 'Saving…' : editMode ? 'Save' : 'Create Team'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── PlayerStrip ──────────────────────────────────────────────────────────────
function PlayerStrip({ pick, breakdown, showPoints }) {
  const raw        = breakdown?.total || 0
  const multiplied = applyMultiplier(raw, pick.is_captain, pick.is_vc)
  const roleColor  = pick.is_captain ? colors.gold : pick.is_vc ? '#60A5FA' : null
  return (
    <View style={s.playerStrip}>
      <View style={[s.stripAvatar, { backgroundColor: (pick.color || colors.gold) + '22', borderColor: (pick.color || colors.gold) + '44' }]}>
        <Text style={[s.stripAvatarText, { color: pick.color || colors.gold }]}>{getInitials(pick.player_name)}</Text>
      </View>
      <View style={s.stripInfo}>
        <View style={s.stripNameRow}>
          <Text style={s.stripName} numberOfLines={1}>{pick.player_name}</Text>
          {pick.is_captain && <View style={s.badgeC}><Text style={s.badgeCText}>C</Text></View>}
          {pick.is_vc      && <View style={s.badgeVC}><Text style={s.badgeVCText}>VC</Text></View>}
        </View>
        <Text style={s.stripTeam}>{teamShort(pick.team_name)}</Text>
      </View>
      {showPoints ? (
        <View style={s.stripPtsBlock}>
          {roleColor && (
            <Text style={[s.stripMultiplier, { color: roleColor }]}>{pick.is_captain ? '×3' : '×2'}</Text>
          )}
          <Text style={[s.stripPoints, roleColor && { color: roleColor }]}>
            {multiplied >= 0 ? '+' : ''}{Math.round(multiplied)}
          </Text>
        </View>
      ) : (
        <Text style={s.stripPending}>—</Text>
      )}
    </View>
  )
}

// ─── PickTeamModal ────────────────────────────────────────────────────────────
function PickTeamModal({ visible, onClose, matchdayNum, matchdayDate, availablePlayers, existingPicks, onSave, saving, prevPickedIds, myProfileId }) {
  const tabKeys = TEAM_TAB_ORDER.filter(k => availablePlayers[k])

  const [activeTab,  setActiveTab]  = useState(0)
  const [picks,      setPicks]      = useState([])
  const [roleTarget, setRoleTarget] = useState(null)

  useEffect(() => {
    if (visible) { setPicks(existingPicks ? [...existingPicks] : []); setActiveTab(0); setRoleTarget(null) }
  }, [visible])

  const captain = picks.find(p => p.is_captain)
  const vc      = picks.find(p => p.is_vc)
  const count   = picks.length

  const togglePlayer = (player, teamName) => {
    const existing = picks.find(p => p.player_id === player.id)
    if (existing) { setRoleTarget({ ...player, team_name: teamName }); return }
    // Blocked — picked in the previous matchday (self exempt: can back yourself every week)
    if (prevPickedIds?.has(player.id) && player.id !== myProfileId) return
    if (picks.length >= 11) { Alert.alert('Squad Full', 'Remove a player before adding another.'); return }
    const teamCount = picks.filter(p => p.team_name === teamName).length
    if (teamCount >= 3) { Alert.alert('Team Limit', `Max 3 players from ${teamName}. Remove one first.`); return }
    setPicks(prev => [...prev, {
      player_id: player.id, fixture_id: player.fixtureId,
      player_name: player.name, team_name: teamName,
      color: player.color, is_captain: false, is_vc: false,
    }])
  }

  const assignRole = (role) => {
    if (!roleTarget) return
    setPicks(prev => prev.map(p => {
      if (role === 'captain') return { ...p, is_captain: p.player_id === roleTarget.id ? !p.is_captain : false }
      if (role === 'vc')      return { ...p, is_vc:      p.player_id === roleTarget.id ? !p.is_vc      : false }
      return p
    }))
    setRoleTarget(null)
  }

  const removeFromPicks = (pid) => { setPicks(prev => prev.filter(p => p.player_id !== pid)); setRoleTarget(null) }

  const handleConfirm = () => {
    if (count !== 11) { Alert.alert('Need 11 Players', `Select ${11 - count} more.`); return }
    if (!captain)     { Alert.alert('No Captain', 'Tap a selected player → set Captain.'); return }
    if (!vc)          { Alert.alert('No Vice-Captain', 'Tap a selected player → set Vice-Captain.'); return }
    onSave(picks)
  }

  const tabColor = tabKeys[activeTab] ? teamTabColor(tabKeys[activeTab]) : colors.gold
  const rolePick = roleTarget ? picks.find(p => p.player_id === roleTarget.id) : null

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={s.pickContainer}>

        {/* Header */}
        <View style={s.pickHeader}>
          <TouchableOpacity onPress={onClose} style={s.pickBackBtn} activeOpacity={0.7}>
            <AppIcon name="back" size={14} tint={colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.pickTitle}>MATCHDAY {matchdayNum} SELECTION</Text>
            {matchdayDate && <Text style={s.pickSubtitle}>{format(parseISO(matchdayDate), 'EEE d MMM yyyy')} · Cutoff 9:00 AM</Text>}
          </View>
          <View style={[s.pickCounter, count === 11 && s.pickCounterFull]}>
            <Text style={[s.pickCounterText, count === 11 && { color: colors.navy }]}>{count}/11</Text>
          </View>
        </View>

        {/* C / VC status */}
        <View style={s.pickRoleRow}>
          <View style={[s.pickRoleChip, captain && s.pickRoleChipC]}>
            <Text style={[s.pickRoleChipText, captain && { color: colors.gold }]}>
              {captain ? `C: ${captain.player_name.split(' ')[0]}` : 'Captain not set'}
            </Text>
          </View>
          <View style={[s.pickRoleChip, vc && s.pickRoleChipVC]}>
            <Text style={[s.pickRoleChipText, vc && { color: '#60A5FA' }]}>
              {vc ? `VC: ${vc.player_name.split(' ')[0]}` : 'VC not set'}
            </Text>
          </View>
        </View>

        {/* Team tabs */}
        <View style={s.pickTabRow}>
          {tabKeys.map((key, idx) => {
            const col = teamTabColor(key)
            const isActive = idx === activeTab
            const teamPickCount = picks.filter(p => p.team_name === key).length
            const atMax = teamPickCount >= 3
            return (
              <TouchableOpacity
                key={key}
                style={[s.pickTab, isActive && { borderBottomColor: col, borderBottomWidth: 2 }]}
                onPress={() => setActiveTab(idx)}
                activeOpacity={0.7}
              >
                <Text style={[s.pickTabText, isActive && { color: col }]}>{teamShort(key)}</Text>
                {teamPickCount > 0 && (
                  <View style={[s.pickTabBadge, { backgroundColor: atMax ? '#F97316' : col }]}>
                    <Text style={s.pickTabBadgeNum}>{teamPickCount}/3</Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Player list */}
        <ScrollView style={s.pickList} showsVerticalScrollIndicator={false}>
          {(availablePlayers[tabKeys[activeTab]] || []).map(player => {
            const pick        = picks.find(p => p.player_id === player.id)
            const isSelected  = !!pick
            const isCap       = pick?.is_captain || false
            const isVc        = pick?.is_vc       || false
            // Blocked if picked in the previous matchday (self exempt — can back yourself every week)
            const isBlocked   = !isSelected && (prevPickedIds?.has(player.id) || false) && player.id !== myProfileId
            return (
              <TouchableOpacity
                key={player.id}
                style={[
                  s.pickRow,
                  isSelected && { borderColor: tabColor + '55', backgroundColor: tabColor + '08' },
                  isBlocked  && s.pickRowBlocked,
                ]}
                onPress={() => !isBlocked && togglePlayer(player, tabKeys[activeTab])}
                activeOpacity={isBlocked ? 1 : 0.7}
              >
                <View style={[s.pickCheck, isSelected && { backgroundColor: tabColor, borderColor: tabColor }, isBlocked && s.pickCheckBlocked]}>
                  {isSelected && <Text style={s.pickCheckMark}>✓</Text>}
                  {isBlocked  && <Text style={s.pickCheckBlockedMark}>✕</Text>}
                </View>
                <View style={[s.pickAvatar, { backgroundColor: player.color + (isBlocked ? '11' : '22'), borderColor: player.color + (isBlocked ? '22' : '44') }]}>
                  <Text style={[s.pickAvatarText, { color: player.color, opacity: isBlocked ? 0.4 : 1 }]}>{getInitials(player.name)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.pickPlayerName, isSelected && { color: colors.white, fontFamily: fonts.bold }, isBlocked && { color: colors.textMuted }]} numberOfLines={1}>
                    {player.name}
                  </Text>
                  {isBlocked && (
                    <Text style={s.pickBlockedLabel}>In your last week's XI · not eligible</Text>
                  )}
                </View>
                {isSelected && (
                  <View style={[s.pickRoleBadge, isCap && s.pickRoleBadgeC, isVc && s.pickRoleBadgeVC, !isCap && !isVc && s.pickRoleBadgeNone]}>
                    <Text style={[s.pickRoleBadgeText, isCap && { color: colors.gold }, isVc && { color: '#60A5FA' }, !isCap && !isVc && { color: colors.textMuted }]}>
                      {isCap ? 'C' : isVc ? 'VC' : '·'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Confirm footer */}
        <View style={s.pickFooter}>
          <TouchableOpacity
            style={[s.pickConfirmBtn, (saving || count !== 11 || !captain || !vc) && s.btnDisabled]}
            onPress={handleConfirm}
            disabled={saving || count !== 11 || !captain || !vc}
            activeOpacity={0.8}
          >
            <Text style={s.pickConfirmText}>
              {saving ? 'Saving…' : count < 11 ? `Select ${11 - count} more` : !captain ? 'Assign Captain' : !vc ? 'Assign Vice-Captain' : '✓ Confirm XI'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Role action sheet */}
        {roleTarget && (
          <Pressable style={s.roleBackdrop} onPress={() => setRoleTarget(null)}>
            <Pressable style={s.roleSheet} onPress={() => {}}>
              <View style={s.roleHandle} />
              <Text style={s.roleName}>{roleTarget.player_name || roleTarget.name}</Text>
              <Text style={s.roleSub}>{teamShort(roleTarget.team_name || '')} · Tap to assign role</Text>
              <TouchableOpacity style={[s.roleBtn, rolePick?.is_captain && s.roleBtnActiveC]} onPress={() => assignRole('captain')} activeOpacity={0.7}>
                <View style={s.roleBtnLeft}>
                  <View style={s.roleBadgeC}><Text style={s.roleBadgeText}>C</Text></View>
                  <Text style={s.roleBtnLabel}>Captain  ×3</Text>
                </View>
                {rolePick?.is_captain && <Text style={{ color: colors.gold, fontFamily: fonts.bold, fontSize: 16 }}>✓</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[s.roleBtn, rolePick?.is_vc && s.roleBtnActiveVC]} onPress={() => assignRole('vc')} activeOpacity={0.7}>
                <View style={s.roleBtnLeft}>
                  <View style={s.roleBadgeVC}><Text style={s.roleBadgeText}>VC</Text></View>
                  <Text style={s.roleBtnLabel}>Vice-Captain  ×2</Text>
                </View>
                {rolePick?.is_vc && <Text style={{ color: '#60A5FA', fontFamily: fonts.bold, fontSize: 16 }}>✓</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.roleRemoveBtn} onPress={() => removeFromPicks(roleTarget.id || roleTarget.player_id)} activeOpacity={0.7}>
                <Text style={s.roleRemoveText}>✕  Remove from Team</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.roleCancelBtn} onPress={() => setRoleTarget(null)} activeOpacity={0.7}>
                <Text style={s.roleCancelText}>Cancel</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        )}
      </View>
    </Modal>
  )
}

// ─── Medal config ─────────────────────────────────────────────────────────────
const MEDAL_ICONS = { 1: 'goldMedal', 2: 'silverMedal', 3: 'bronzeMedal' }
const MEDAL_COLS  = {
  1: { border: '#F5C518', bg: 'rgba(245,197,24,0.08)', text: '#F5C518'  },
  2: { border: '#B0B8C1', bg: 'rgba(176,184,193,0.06)', text: '#B0B8C1' },
  3: { border: '#CD7F32', bg: 'rgba(205,127,50,0.06)',  text: '#CD7F32' },
}

// ─── LbTopCard — full-width animated podium card ─────────────────────────────
function LbTopCard({ entry, rank, onPress, animValue }) {
  const col     = MEDAL_COLS[rank]
  const isFirst = rank === 1

  const opacity    = animValue
  const translateY = animValue.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })

  // Gold card shimmer sweep — rank 1 only
  const goldSweep = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!isFirst) return
    Animated.loop(
      Animated.sequence([
        Animated.timing(goldSweep, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true }),
        Animated.delay(1200),
      ])
    ).start()
  }, [isFirst])
  const sweepX = goldSweep.interpolate({ inputRange: [0, 1], outputRange: [-320, 420] })

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], marginBottom: 8 }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[
          s.lbTopCard,
          { borderColor: col.border, backgroundColor: col.bg },
          isFirst && s.lbTopCard1,
          entry.is_me && { borderColor: col.border, borderWidth: 2 },
        ]}
      >
        {/* Gold shimmer sweep — background layer, rank 1 only */}
        {isFirst && (
          <Animated.View
            pointerEvents="none"
            style={[s.lbGoldSweep, { transform: [{ translateX: sweepX }, { skewX: '-18deg' }] }]}
          />
        )}

        {/* Left: medal circle only — no rank text, medal icon shows number */}
        <View style={s.lbTopLeft}>
          <View style={[s.lbTopMedalCircle,
            { width: isFirst ? 42 : 34, height: isFirst ? 42 : 34, borderRadius: isFirst ? 21 : 17,
              backgroundColor: col.border + '20', borderColor: col.border + '50' }]}>
            <AppIcon name={MEDAL_ICONS[rank]} size={isFirst ? 22 : 16} />
          </View>
        </View>

        {/* Center: team name + member name */}
        <View style={s.lbTopCenter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text style={[s.lbTopTeamName, { color: isFirst ? colors.white : col.text, fontSize: isFirst ? 15 : 13 }]}>
              {entry.team_name}
            </Text>
            {entry.is_me && (
              <View style={s.lbMeBadge}><Text style={s.lbMeBadgeText}>YOU</Text></View>
            )}
          </View>
          <Text style={s.lbTopMember}>{entry.member_name}</Text>
        </View>

        {/* Right: points */}
        <View style={s.lbTopPtsBlock}>
          <Text style={[s.lbTopPts, { color: col.text, fontSize: isFirst ? 26 : 18 }]}>
            {Math.round(entry.total_points)}
          </Text>
          <Text style={[s.lbTopPtsSuffix, { color: col.text }]}>pts</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ─── PlayerDetailModal ─────────────────────────────────────────────────────────
// isMe=true  → matchday cards that expand to show own XI + per-player points
// isMe=false → matchday cards only (picks private, never exposed to others)
function PlayerDetailModal({ visible, onClose, team, data, loading, matchdays, isMe, picks, pickPoints }) {
  const [expandedMd, setExpandedMd] = useState(null)

  if (!team) return null
  const total = data.reduce((acc, r) => acc + Number(r.total_points), 0)

  const dateByMd = {}
  matchdays?.forEach(m => { dateByMd[m.matchday_num] = m.date })

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        <Pressable style={s.detailSheet} onPress={() => {}}>
          <View style={s.modalHandle} />

          {/* Header */}
          <View style={s.detailHeader}>
            <View style={s.detailTrophyWrap}>
              <AppIcon name="trophy" size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.detailTeamName} numberOfLines={1}>{team.team_name}</Text>
              <Text style={s.detailMember}>{team.member_name}</Text>
            </View>
            {data.length > 0 && (
              <View style={s.detailSeasonBadge}>
                <Text style={s.detailSeasonTotal}>{Math.round(total)}</Text>
                <Text style={s.detailSeasonLabel}>PTS</Text>
              </View>
            )}
          </View>

          <View style={s.detailDivider} />

          {loading ? (
            <ActivityIndicator color={colors.gold} style={{ marginVertical: 32 }} />
          ) : data.length === 0 ? (
            <Text style={s.detailEmpty}>No matchday scores recorded yet.</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              {data.map(row => {
                const dateStr   = dateByMd[row.matchday]
                const dateLabel = dateStr ? format(parseISO(dateStr), 'EEE d MMM yyyy') : null
                const pts       = Math.round(Number(row.total_points))
                const mdPicks   = isMe ? (picks[row.matchday] || []) : []
                const isOpen    = isMe && expandedMd === row.matchday

                return (
                  <View key={row.matchday}>
                    {/* ── Score card — tappable if own team and picks exist ── */}
                    <TouchableOpacity
                      style={s.detailMdCard}
                      activeOpacity={isMe && mdPicks.length > 0 ? 0.7 : 1}
                      onPress={() => {
                        if (isMe && mdPicks.length > 0) setExpandedMd(isOpen ? null : row.matchday)
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.detailMdCardTitle}>MATCHDAY {row.matchday}</Text>
                        {dateLabel && <Text style={s.detailMdCardDate}>{dateLabel}</Text>}
                        {isMe && mdPicks.length > 0 && (
                          <Text style={s.detailMdCardHint}>{isOpen ? 'Hide XI ▲' : 'View XI ▼'}</Text>
                        )}
                      </View>
                      <Text style={[s.detailMdCardPts, pts < 0 && { color: colors.red }]}>
                        {pts >= 0 ? '+' : ''}{pts} pts
                      </Text>
                    </TouchableOpacity>

                    {/* ── Expanded XI — own picks + individual points ── */}
                    {isOpen && mdPicks.length > 0 && (
                      <View style={s.detailPicksWrap}>
                        {mdPicks.map((p, idx) => {
                          const rawPts   = pickPoints[row.matchday]?.[p.player_id]?.total || 0
                          const finalPts = Math.round(applyMultiplier(rawPts, p.is_captain, p.is_vc))
                          return (
                            <View key={idx} style={s.detailPickRow}>
                              {/* Avatar */}
                              <View style={[s.detailPickAvatar, { backgroundColor: p.color + '22', borderColor: p.color + '44' }]}>
                                <Text style={[s.detailPickInitials, { color: p.color }]}>
                                  {p.player_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </Text>
                              </View>
                              {/* Name + team */}
                              <View style={{ flex: 1 }}>
                                <Text style={s.detailPickName} numberOfLines={1}>{p.player_name}</Text>
                                <Text style={s.detailPickTeam}>{teamShort(p.team_name)}</Text>
                              </View>
                              {/* C/VC badge + points */}
                              <View style={s.detailPickRight}>
                                {p.is_captain && <View style={s.detailBadgeC}><Text style={s.detailBadgeCText}>C</Text></View>}
                                {p.is_vc      && <View style={s.detailBadgeVC}><Text style={s.detailBadgeVCText}>VC</Text></View>}
                                <Text style={[s.detailPickPts, finalPts < 0 && { color: colors.red }]}>
                                  {finalPts >= 0 ? '+' : ''}{finalPts}
                                </Text>
                              </View>
                            </View>
                          )
                        })}
                      </View>
                    )}
                  </View>
                )
              })}
            </ScrollView>
          )}

          <TouchableOpacity style={s.modalCloseBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.modalCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FantasyLeagueScreen() {
  const profile = useAuthStore(s => s.profile)

  const [loading,          setLoading]          = useState(true)
  const [fantasyTeam,      setFantasyTeam]       = useState(null)
  const [currentMatchday,  setCurrentMatchday]   = useState(null)
  const [availablePlayers, setAvailablePlayers]  = useState({})
  const [myPicks,          setMyPicks]           = useState([])
  const [prevPickedIds,    setPrevPickedIds]     = useState(new Set())  // player_ids picked in previous matchday
  const [playerPoints,     setPlayerPoints]      = useState({})
  const [scorecardIn,      setScorecardIn]       = useState(false)
  const [leaderboard,      setLeaderboard]       = useState([])
  const [mdLeaderboard,    setMdLeaderboard]     = useState([])
  const [saving,           setSaving]            = useState(false)

  const [showCreateModal,  setShowCreateModal]   = useState(false)
  const [showPickModal,    setShowPickModal]      = useState(false)
  const [showPointsModal,  setShowPointsModal]   = useState(false)
  const [editTeamMode,     setEditTeamMode]      = useState(false)
  const [teamNameInput,    setTeamNameInput]     = useState('')

  // Leaderboard tabs — MATCHDAY is default
  const [lbTab,            setLbTab]             = useState('matchday')

  // Matchday archive — all matchdays + selected matchday for leaderboard browse
  const [allMatchdays,     setAllMatchdays]      = useState([])
  const [selectedMdNum,    setSelectedMdNum]     = useState(null)   // null = current
  const [allMdScores,      setAllMdScores]       = useState({})     // { [mdNum]: { [teamId]: pts } }
  const [teamsBaseCache,   setTeamsBaseCache]    = useState([])     // [{ team_id, team_name, member_name, is_me }]

  // Player detail drill-down
  const [detailTeam,       setDetailTeam]       = useState(null)
  const [detailData,       setDetailData]        = useState([])   // [{ matchday, total_points }]
  const [detailPicks,      setDetailPicks]       = useState({})   // { [matchday]: [pick,...] } — own team only
  const [detailPickPoints, setDetailPickPoints]  = useState({})   // { [matchday]: { [playerId]: { total } } } — own team only
  const [showDetail,       setShowDetail]        = useState(false)
  const [detailLoading,    setDetailLoading]     = useState(false)

  const shimmer = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(Animated.timing(shimmer, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })).start()
  }, [])
  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-120, 120] })

  // Podium entrance animation — staggered slide-up per card (reset on tab/data change)
  const podiumAnims = useRef([
    new Animated.Value(0), new Animated.Value(0), new Animated.Value(0),
  ]).current
  const triggerPodium = useCallback(() => {
    podiumAnims.forEach(a => a.setValue(0))
    Animated.stagger(100, podiumAnims.map(a =>
      Animated.timing(a, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true })
    )).start()
  }, [])
  useEffect(() => {
    if (leaderboard.length > 0 || mdLeaderboard.length > 0) triggerPodium()
  }, [leaderboard, mdLeaderboard])
  useEffect(() => { triggerPodium() }, [lbTab])

  useFocusEffect(useCallback(() => { if (profile?.id) loadAll(profile.id) }, [profile?.id]))

  // ── Live cutoff ticker — re-evaluates mdStatus every 60s while screen is open ──
  // Prevents stale 'open' state if user leaves app open past 11am without refreshing
  const [_tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // ── Data loading ─────────────────────────────────────────────────────────────
  const loadAll = async (userId) => {
    setLoading(true)
    try {
      const [{ data: team }, { data: fixtures }] = await Promise.all([
        supabase.from('fantasy_teams').select('id, team_name').eq('member_id', userId).maybeSingle(),
        supabase.from('fixtures').select('id, match_date, teams(id, name), opponent').eq('match_type', 'league').order('match_date', { ascending: true }),
      ])
      setFantasyTeam(team || null)

      // Group fixtures by date → matchdays (exclude Sundays — friendlies/non-MCCL)
      const dateMap = {}
      ;(fixtures || []).forEach(f => {
        const dow = new Date(f.match_date + 'T12:00:00').getDay()
        if (dow === 0) return // skip Sundays
        if (!dateMap[f.match_date]) dateMap[f.match_date] = []
        dateMap[f.match_date].push(f)
      })
      const matchdays = Object.keys(dateMap).sort().map((date, idx) => ({
        matchday_num: idx + 1, date, fixtures: dateMap[date],
      }))

      const current = determineCurrentMatchday(matchdays)
      if (!current) { return }

      const fixtureIds    = current.fixtures.map(f => f.id)
      // fixture_id → team name — used to label picks reliably (avoids join ambiguity)
      const fixtureTeamMap = {}
      current.fixtures.forEach(f => { fixtureTeamMap[f.id] = f.teams?.name || '' })

      // Check all squads published
      const { data: squads } = await supabase.from('squads').select('fixture_id').in('fixture_id', fixtureIds).eq('published', true)
      const allPublished = (squads?.length || 0) >= current.fixtures.length
      const locked = isCutoffPassed(current.date)
      setCurrentMatchday({ ...current, allPublished, locked })

      // Available players if squads published
      if (allPublished) {
        const { data: squadData } = await supabase
          .from('squads')
          .select('fixture_id, squad_members(player_id, profiles(id, full_name, avatar_color))')
          .in('fixture_id', fixtureIds).eq('published', true)
        const available = {}
        current.fixtures.forEach(f => {
          const sq = squadData?.find(sq => sq.fixture_id === f.id)
          const teamName = f.teams?.name || ''
          available[teamName] = (sq?.squad_members || []).map(sm => ({
            id: sm.player_id, name: toTitleCase(sm.profiles?.full_name) || 'Unknown',
            color: sm.profiles?.avatar_color || colors.gold, fixtureId: f.id,
          }))
        })
        setAvailablePlayers(available)
      }

      // ── Previous matchday picks — blocked for current week (no repeat picks) ──
      if (team && current.matchday_num > 1) {
        const { data: prevPicks } = await supabase
          .from('fantasy_picks')
          .select('player_id')
          .eq('team_id', team.id)
          .eq('matchday', current.matchday_num - 1)
        const prevSet = new Set((prevPicks || []).map(p => p.player_id))
        setPrevPickedIds(prevSet)
      } else {
        setPrevPickedIds(new Set())
      }

      // Picks + points if team exists
      if (team) {
        const { data: picksData } = await supabase
          .from('fantasy_picks')
          .select('player_id, fixture_id, is_captain, is_vc, profiles(full_name, avatar_color), fixtures(teams(name))')
          .eq('team_id', team.id).eq('matchday', current.matchday_num)

        const picks = (picksData || []).map(p => ({
          player_id:   p.player_id,   fixture_id:  p.fixture_id,
          is_captain:  p.is_captain,  is_vc:       p.is_vc,
          player_name: toTitleCase(p.profiles?.full_name) || 'Unknown',
          // fixtureTeamMap is the authoritative source; fallback to join if missing
          team_name:   fixtureTeamMap[p.fixture_id] || p.fixtures?.teams?.name || '',
          color:       p.profiles?.avatar_color || colors.gold,
        }))
        setMyPicks(picks)

        if (picks.length > 0) {
          const { count } = await supabase.from('match_results').select('id', { count: 'exact', head: true }).in('fixture_id', fixtureIds)
          const hasScorecard = (count || 0) > 0
          setScorecardIn(hasScorecard)
          if (hasScorecard) {
            const pointsMap = await fetchPoints(picks)
            setPlayerPoints(pointsMap)
            const total = picks.reduce((sum, p) => sum + applyMultiplier(pointsMap[p.player_id]?.total || 0, p.is_captain, p.is_vc), 0)
            await supabase.from('fantasy_scores').upsert(
              { team_id: team.id, matchday: current.matchday_num, total_points: total, calculated_at: new Date().toISOString() },
              { onConflict: 'team_id,matchday' }
            )
          }
        }
      }

      // Store all matchdays for archive navigation
      setAllMatchdays(matchdays.map(m => ({ matchday_num: m.matchday_num, date: m.date })))

      const lbData = await fetchLeaderboard(team?.id, current?.matchday_num || 0)
      setLeaderboard(lbData.overallLB)
      setMdLeaderboard(lbData.matchdayLB)
      setAllMdScores(lbData.byMd)
      setTeamsBaseCache(lbData.teamsBase)

      // Default matchday selector → last matchday that has any scores.
      // If no scores exist yet, fall back to current matchday_num.
      const scoredMdNums = Object.keys(lbData.byMd).map(Number).filter(n => n > 0)
      const lastScored   = scoredMdNums.length > 0 ? Math.max(...scoredMdNums) : (current?.matchday_num || null)
      setSelectedMdNum(lastScored)
    } catch (err) {
      console.error('[Fantasy] loadAll error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchPoints = async (picks) => {
    const byFixture = {}
    picks.forEach(p => { if (!byFixture[p.fixture_id]) byFixture[p.fixture_id] = []; byFixture[p.fixture_id].push(p.player_id) })
    const pointsMap = {}
    await Promise.all(Object.entries(byFixture).map(async ([fid, pids]) => {
      const [{ data: bat }, { data: bowl }, { data: field }] = await Promise.all([
        supabase.from('match_batting').select('*').eq('fixture_id', fid).in('player_id', pids),
        supabase.from('match_bowling').select('*').eq('fixture_id', fid).in('player_id', pids),
        supabase.from('match_fielding').select('*').eq('fixture_id', fid).in('player_id', pids),
      ])
      const bm = {}; bat?.forEach(r => bm[r.player_id] = r)
      const bw = {}; bowl?.forEach(r => bw[r.player_id] = r)
      const fm = {}; field?.forEach(r => fm[r.player_id] = r)
      pids.forEach(pid => { pointsMap[pid] = calcPlayerPoints(bm[pid], bw[pid], fm[pid]) })
    }))
    return pointsMap
  }

  const fetchLeaderboard = async (myTeamId, currentMd) => {
    const { data: teams }  = await supabase.from('fantasy_teams').select('id, team_name, member_id, member_full_name, profiles(full_name)')
    const { data: scores } = await supabase.from('fantasy_scores').select('team_id, matchday, total_points')

    // Build overall totals + per-matchday map
    const overall = {}
    const byMd    = {}
    ;(scores || []).forEach(s => {
      if (!overall[s.team_id]) overall[s.team_id] = { total: 0, matchdays: 0 }
      overall[s.team_id].total    += Number(s.total_points)
      overall[s.team_id].matchdays += 1
      if (!byMd[s.matchday]) byMd[s.matchday] = {}
      byMd[s.matchday][s.team_id] = Number(s.total_points)
    })

    const base = (teams || []).map(t => ({
      team_id:     t.id,
      team_name:   t.team_name,
      member_name: toTitleCase(t.member_full_name || t.profiles?.full_name) || '',
      is_me:       t.id === myTeamId,
    }))

    const overallLB = base
      .map(t => ({
        ...t,
        total_points:     overall[t.team_id]?.total    || 0,
        matchdays_played: overall[t.team_id]?.matchdays || 0,
      }))
      .sort((a, b) => b.total_points - a.total_points)
      .map((t, i) => ({ ...t, rank: i + 1 }))

    // Matchday leaderboard — only teams with scores this matchday
    const mdScores  = byMd[currentMd] || {}
    const matchdayLB = base
      .filter(t => mdScores[t.team_id] != null)
      .map(t => ({
        ...t,
        total_points:     mdScores[t.team_id] || 0,
        matchdays_played: 1,
      }))
      .sort((a, b) => b.total_points - a.total_points)
      .map((t, i) => ({ ...t, rank: i + 1 }))

    return { overallLB, matchdayLB, byMd, teamsBase: base }
  }

  // ── Team create / rename ─────────────────────────────────────────────────────
  const openCreate = () => { setEditTeamMode(false); setTeamNameInput(''); setShowCreateModal(true) }
  const openRename = () => { setEditTeamMode(true); setTeamNameInput(fantasyTeam?.team_name || ''); setShowCreateModal(true) }

  const handleSaveTeamName = async () => {
    const name = teamNameInput.trim()
    if (name.length < 2) return
    setSaving(true)
    try {
      const payload = { team_name: name, updated_at: new Date().toISOString() }
      const { error } = editTeamMode
        ? await supabase.from('fantasy_teams').update(payload).eq('id', fantasyTeam.id)
        : await supabase.from('fantasy_teams').insert({ member_id: profile.id, team_name: name, member_full_name: profile.full_name || null })
      if (error?.code === '23505') { Alert.alert('Name Taken', 'That team name is already in use. Choose another.'); return }
      if (error) throw error
      setShowCreateModal(false)
      setTeamNameInput('')
      await loadAll(profile.id)
    } catch (err) { Alert.alert('Error', err.message) }
    finally { setSaving(false) }
  }

  // ── Save picks ───────────────────────────────────────────────────────────────
  const handleSavePicks = async (pendingPicks) => {
    // Hard cutoff check — re-evaluated at submit time, not just at render
    if (isCutoffPassed(currentMatchday?.date)) {
      setShowPickModal(false)
      Alert.alert('Picks Locked', 'The 9:00 AM cutoff for this matchday has passed. No changes allowed.')
      return
    }
    setSaving(true)
    try {
      const teamId = fantasyTeam.id
      const mdNum  = currentMatchday.matchday_num
      await supabase.from('fantasy_picks').delete().eq('team_id', teamId).eq('matchday', mdNum)
      await supabase.from('fantasy_picks').insert(pendingPicks.map(p => ({
        team_id: teamId, matchday: mdNum, fixture_id: p.fixture_id,
        player_id: p.player_id, is_captain: p.is_captain || false, is_vc: p.is_vc || false,
      })))
      setShowPickModal(false)
      await loadAll(profile.id)
    } catch (err) { Alert.alert('Error', 'Failed to save picks: ' + err.message) }
    finally { setSaving(false) }
  }

  // ── Recompute matchday leaderboard when selected matchday changes ────────────
  useEffect(() => {
    if (selectedMdNum == null || teamsBaseCache.length === 0) return
    const mdMap   = allMdScores[selectedMdNum] || {}
    const newLB   = teamsBaseCache
      .filter(t => mdMap[t.team_id] != null)
      .map(t => ({ ...t, total_points: mdMap[t.team_id] || 0, matchdays_played: 1 }))
      .sort((a, b) => b.total_points - a.total_points)
      .map((t, i) => ({ ...t, rank: i + 1 }))
    setMdLeaderboard(newLB)
  }, [selectedMdNum, allMdScores, teamsBaseCache])

  // ── Team drill-down ───────────────────────────────────────────────────────────
  // isMe=true  → fetch own picks + per-player points (RLS allows this)
  // isMe=false → fetch scores only (picks are private — RLS blocks other teams' picks)
  const handleTeamPress = async (entry) => {
    setDetailTeam(entry)
    setDetailData([])
    setDetailPicks({})
    setDetailPickPoints({})
    setDetailLoading(true)
    setShowDetail(true)

    // Always fetch scores (publicly readable)
    const { data: scores } = await supabase
      .from('fantasy_scores')
      .select('matchday, total_points')
      .eq('team_id', entry.team_id)
      .order('matchday', { ascending: true })
    setDetailData(scores || [])

    // Own team only — fetch picks + calculate per-player points
    if (entry.is_me) {
      const { data: rawPicks } = await supabase
        .from('fantasy_picks')
        .select('matchday, fixture_id, player_id, is_captain, is_vc, profiles(full_name, avatar_color), fixtures(teams(name))')
        .eq('team_id', entry.team_id)
        .order('matchday', { ascending: true })

      if (rawPicks?.length) {
        // Group picks by matchday
        const grouped = {}
        const fixturePlayerMap = {} // { fixtureId: [playerId,...] }
        rawPicks.forEach(p => {
          if (!grouped[p.matchday]) grouped[p.matchday] = []
          grouped[p.matchday].push({
            player_id:   p.player_id,
            fixture_id:  p.fixture_id,
            player_name: toTitleCase(p.profiles?.full_name) || 'Unknown',
            team_name:   p.fixtures?.teams?.name || '',
            is_captain:  p.is_captain,
            is_vc:       p.is_vc,
            color:       p.profiles?.avatar_color || colors.gold,
          })
          if (!fixturePlayerMap[p.fixture_id]) fixturePlayerMap[p.fixture_id] = []
          fixturePlayerMap[p.fixture_id].push(p.player_id)
        })
        setDetailPicks(grouped)

        // Fetch batting/bowling/fielding per fixture → calculate per-player points
        const pointsByMd = {} // { [matchday]: { [playerId]: calcPlayerPoints result } }
        await Promise.all(
          Object.entries(fixturePlayerMap).map(async ([fid, pids]) => {
            const [{ data: bat }, { data: bowl }, { data: field }] = await Promise.all([
              supabase.from('match_batting').select('*').eq('fixture_id', fid).in('player_id', pids),
              supabase.from('match_bowling').select('*').eq('fixture_id', fid).in('player_id', pids),
              supabase.from('match_fielding').select('*').eq('fixture_id', fid).in('player_id', pids),
            ])
            const bm = {}; bat?.forEach(r => bm[r.player_id] = r)
            const bw = {}; bowl?.forEach(r => bw[r.player_id] = r)
            const fm = {}; field?.forEach(r => fm[r.player_id] = r)
            // Find which matchday this fixture belongs to
            rawPicks.filter(p => p.fixture_id === fid).forEach(p => {
              if (!pointsByMd[p.matchday]) pointsByMd[p.matchday] = {}
              pointsByMd[p.matchday][p.player_id] = calcPlayerPoints(bm[p.player_id], bw[p.player_id], fm[p.player_id])
            })
          })
        )
        setDetailPickPoints(pointsByMd)
      }
    }

    setDetailLoading(false)
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const myEntry   = leaderboard.find(e => e.is_me)
  const totalMult = myPicks.reduce((sum, p) => sum + applyMultiplier(playerPoints[p.player_id]?.total || 0, p.is_captain, p.is_vc), 0)
  // _tick forces re-evaluation every 60s so cutoff flips to LOCKED without a manual refresh
  const isNowLocked = isCutoffPassed(currentMatchday?.date)
  const mdStatus  = !currentMatchday ? 'waiting'
    : scorecardIn && myPicks.length > 0 ? 'results'
    : isNowLocked                        ? 'locked'
    : currentMatchday.allPublished       ? 'open'
    : 'waiting'

  if (loading) return (
    <View style={s.container}>
      <TopHeader />
      <View style={s.centred}><ActivityIndicator color={colors.gold} size="large" /></View>
    </View>
  )

  return (
    <View style={s.container}>
      <TopHeader />
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Page header ── */}
        <View style={s.pageHeaderRow}>
          <View>
            <Text style={s.sectionLabel}>MEMBER</Text>
            <Text style={s.pageTitle}>FANTASY LEAGUE</Text>
          </View>
          {fantasyTeam && (
            <TouchableOpacity style={s.pointsBtn} onPress={() => setShowPointsModal(true)} activeOpacity={0.7}>
              <AppIcon name="cricketBat" size={13} tint={colors.gold} />
              <Text style={s.pointsBtnText}>Points</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── NO TEAM STATE ── */}
        {!fantasyTeam && (
          <>
            <View style={s.heroCard}>
              <View style={s.heroBadge}>
                <Animated.View style={[s.shimmer, { transform: [{ translateX: shimmerX }] }]} />
                <Text style={s.heroBadgeText}>SEASON 2026</Text>
              </View>
              <View style={s.trophyWrap}><AppIcon name="trophy" size={56} /></View>
              <Text style={s.heroTitle}>PAVILION FANTASY</Text>
              <Text style={s.heroSub}>Pick your XI from published Playing XIs each matchday. Earn points. Top the table.</Text>
              <TouchableOpacity style={s.createBtn} onPress={openCreate} activeOpacity={0.8}>
                <Text style={s.createBtnText}>Create Your Team  →</Text>
              </TouchableOpacity>
            </View>

            {[
              { icon: 'cricketBat',   title: 'Pick from Published XIs',    desc: 'Choose 11 players from all 4 MCCL Playing XIs after squads are confirmed.',          color: colors.gold   },
              { icon: 'captainBadge', title: 'Captain & Vice-Captain',      desc: 'Captain earns 3× points. Vice-Captain earns 2×. Choose your power plays wisely.',   color: '#60A5FA'     },
              { icon: 'trophy',       title: 'POTM-Based Points',           desc: 'Same formula as Player of the Match — runs, wickets, economy, fielding and more.',   color: '#F97316'     },
              { icon: 'stats',        title: 'Season Leaderboard',          desc: 'Compete across 18 MCCL matchdays. Your total points update every match week.',       color: colors.green  },
            ].map(f => (
              <View key={f.title} style={[s.featureCard, { borderLeftColor: f.color }]}>
                <View style={[s.featureIcon, { backgroundColor: f.color + '18' }]}>
                  <AppIcon name={f.icon} size={22} tint={f.icon === 'trophy' || f.icon === 'captainBadge' ? undefined : f.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.featureTitle, { color: f.color }]}>{f.title}</Text>
                  <Text style={s.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}

            <View style={s.pointsCard}>
              <View style={s.pointsCardHeader}>
                <AppIcon name="cricketBat" size={15} tint={colors.gold} />
                <Text style={s.pointsCardTitle}>POINTS SYSTEM</Text>
              </View>
              {FANTASY_POINTS_REF.map(({ section, color, rows }) => (
                <View key={section} style={s.ptsSect}>
                  <Text style={[s.ptsSectTitle, { color }]}>{section}</Text>
                  {rows.map(row => {
                    const isNeg = row.pts.startsWith('−') || row.pts.startsWith('-')
                    const valCol = isNeg ? '#EF4444' : color
                    return (
                      <View key={row.action} style={s.ptsRowItem}>
                        <Text style={s.ptsRowAction}>{row.action}</Text>
                        <Text style={[s.ptsRowValue, { color: valCol }]}>{row.pts}</Text>
                      </View>
                    )
                  })}
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── HAS TEAM STATE ── */}
        {fantasyTeam && (
          <>
            {/* Team header */}
            <View style={s.teamCard}>
              <View style={s.teamCardTop}>
                <View style={s.trophySmall}><AppIcon name="trophy" size={20} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.teamName}>{fantasyTeam.team_name}</Text>
                  <Text style={s.teamMember}>{toTitleCase(profile?.full_name)}</Text>
                </View>
                <TouchableOpacity style={s.editTeamBtn} onPress={openRename} activeOpacity={0.7}>
                  <AppIcon name="edit" size={13} tint={colors.textMuted} />
                </TouchableOpacity>
              </View>
              {myEntry && (
                <View style={s.teamStats}>
                  <View style={s.teamStat}>
                    <Text style={s.teamStatNum}>#{myEntry.rank}</Text>
                    <Text style={s.teamStatLabel}>RANK</Text>
                  </View>
                  <View style={s.teamStatDiv} />
                  <View style={s.teamStat}>
                    <Text style={s.teamStatNum}>{myEntry.matchdays_played}</Text>
                    <Text style={s.teamStatLabel}>GW PLAYED</Text>
                  </View>
                  <View style={s.teamStatDiv} />
                  <View style={s.teamStat}>
                    <Text style={[s.teamStatNum, { color: colors.gold }]}>{Math.round(myEntry.total_points)}</Text>
                    <Text style={s.teamStatLabel}>SEASON PTS</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Current matchday card */}
            {currentMatchday && (
              <View style={s.mdCard}>
                <View style={s.mdTopRow}>
                  <View>
                    <Text style={s.mdNum}>MATCHDAY {currentMatchday.matchday_num}</Text>
                    <Text style={s.mdDate}>{format(parseISO(currentMatchday.date), 'EEEE d MMMM yyyy')}</Text>
                  </View>
                  <View style={[s.statusChip, mdStatus === 'open' && s.chipOpen, mdStatus === 'results' && s.chipResults, mdStatus === 'locked' && s.chipLocked]}>
                    <Text style={[s.statusChipText, mdStatus === 'open' && { color: colors.green }, mdStatus === 'results' && { color: colors.gold }, mdStatus === 'locked' && { color: '#EF4444' }]}>
                      {mdStatus === 'open' ? 'OPEN' : mdStatus === 'results' ? 'RESULTS IN' : mdStatus === 'locked' ? 'LOCKED' : 'WAITING'}
                    </Text>
                  </View>
                </View>

                {mdStatus === 'open' && <Text style={s.cutoffNote}>Picks lock at 9:00 AM on {format(parseISO(currentMatchday.date), 'd MMM')}</Text>}

                {mdStatus === 'open' && myPicks.length === 0 && (
                  <TouchableOpacity style={s.pickXIBtn} onPress={() => setShowPickModal(true)} activeOpacity={0.8}>
                    <Text style={s.pickXIBtnText}>Pick Your XI  →</Text>
                  </TouchableOpacity>
                )}

                {mdStatus === 'waiting' && (
                  <View style={s.waitingRow}>
                    <AppIcon name="date" size={13} tint={colors.textMuted} />
                    <Text style={s.waitingText}>Waiting for all 4 squads to be published</Text>
                  </View>
                )}

                {myPicks.length > 0 && (
                  <>
                    <View style={s.picksHeader}>
                      <Text style={s.picksHeaderTitle}>YOUR XI</Text>
                      {!isNowLocked && (
                        <TouchableOpacity onPress={() => setShowPickModal(true)} activeOpacity={0.7}>
                          <Text style={s.editPicksLink}>EDIT ✎</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {[...myPicks].sort((a, b) => {
                      const teamOrder = (n = '') => {
                        if (n.includes('1st')) return 0
                        if (n.includes('2nd')) return 1
                        if (n.includes('3rd')) return 2
                        if (n.includes('4th')) return 3
                        return 4
                      }
                      const tA = teamOrder(a.team_name); const tB = teamOrder(b.team_name)
                      if (tA !== tB) return tA - tB
                      return (a.player_name || '').localeCompare(b.player_name || '')
                    }).map(pick => (
                      <PlayerStrip key={pick.player_id} pick={pick} breakdown={playerPoints[pick.player_id]} showPoints={scorecardIn} />
                    ))}
                    {scorecardIn && (
                      <View style={s.totalRow}>
                        <Text style={s.totalLabel}>MATCHDAY TOTAL</Text>
                        <Text style={s.totalPoints}>{totalMult >= 0 ? '+' : ''}{Math.round(totalMult)}</Text>
                      </View>
                    )}
                  </>
                )}

                {isNowLocked && myPicks.length === 0 && (
                  <Text style={s.noPicksText}>No picks submitted for this matchday.</Text>
                )}
              </View>
            )}
          </>
        )}

        {/* ── Leaderboard ── */}
        <View style={s.lbSection}>
          <View style={s.lbDivRow}>
            <View style={s.lbDiv} />
            <Text style={s.lbDivLabel}>LEADERBOARD</Text>
            <View style={s.lbDiv} />
          </View>

          {/* Tabs — MATCHDAY first (default) */}
          <View style={s.lbTabRow}>
            <TouchableOpacity
              style={[s.lbTabBtn, lbTab === 'matchday' && s.lbTabBtnActive]}
              onPress={() => setLbTab('matchday')}
              activeOpacity={0.7}
            >
              <Text style={[s.lbTabText, lbTab === 'matchday' && s.lbTabTextActive]}>MATCHDAY</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.lbTabBtn, lbTab === 'overall' && s.lbTabBtnActive]}
              onPress={() => setLbTab('overall')}
              activeOpacity={0.7}
            >
              <Text style={[s.lbTabText, lbTab === 'overall' && s.lbTabTextActive]}>SEASON</Text>
            </TouchableOpacity>
          </View>

          {/* Matchday archive navigator */}
          {lbTab === 'matchday' && allMatchdays.length > 0 && (() => {
            const idx    = allMatchdays.findIndex(m => m.matchday_num === selectedMdNum)
            const mdInfo = allMatchdays[idx]
            const canPrev = idx > 0
            const canNext = idx < allMatchdays.length - 1
            return (
              <View style={s.mdNavRow}>
                <TouchableOpacity
                  onPress={() => canPrev && setSelectedMdNum(allMatchdays[idx - 1].matchday_num)}
                  style={[s.mdNavBtn, !canPrev && s.mdNavBtnDisabled]}
                  activeOpacity={0.7}
                  disabled={!canPrev}
                >
                  <Text style={[s.mdNavArrow, !canPrev && { opacity: 0.3 }]}>‹</Text>
                </TouchableOpacity>
                <View style={s.mdNavCenter}>
                  <Text style={s.mdNavLabel}>MATCHDAY {selectedMdNum}</Text>
                  {mdInfo && (
                    <Text style={s.mdNavDate}>
                      {new Date(mdInfo.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => canNext && setSelectedMdNum(allMatchdays[idx + 1].matchday_num)}
                  style={[s.mdNavBtn, !canNext && s.mdNavBtnDisabled]}
                  activeOpacity={0.7}
                  disabled={!canNext}
                >
                  <Text style={[s.mdNavArrow, !canNext && { opacity: 0.3 }]}>›</Text>
                </TouchableOpacity>
              </View>
            )
          })()}

          {/* Leaderboard content */}
          {(() => {
            const data = lbTab === 'overall' ? leaderboard : mdLeaderboard
            if (data.length === 0) {
              return (
                <View style={s.lbEmptyWrap}>
                  <Text style={s.lbEmpty}>
                    {lbTab === 'overall'
                      ? 'No teams yet. Be the first!'
                      : 'No scores this matchday yet.'}
                  </Text>
                </View>
              )
            }
            const top3 = data.slice(0, 3)
            const rest = data.slice(3)
            return (
              <>
                {/* Ranks 1–3 — full-width stacked podium cards */}
                {top3.map((entry, i) => (
                  <LbTopCard
                    key={entry.team_id}
                    entry={entry}
                    rank={i + 1}
                    animValue={podiumAnims[i]}
                    onPress={() => handleTeamPress(entry)}
                  />
                ))}

                {/* Ranks 4+ */}
                {rest.map(entry => (
                  <TouchableOpacity
                    key={entry.team_id}
                    onPress={() => handleTeamPress(entry)}
                    activeOpacity={0.75}
                  >
                    <View style={[s.lbRow, entry.is_me && s.lbRowMe]}>
                      <View style={s.lbRankBlock}>
                        <Text style={s.lbRank}>#{entry.rank}</Text>
                      </View>
                      <View style={s.lbTeamBlock}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={s.lbTeamName} numberOfLines={1}>{entry.team_name}</Text>
                          {entry.is_me && (
                            <View style={s.lbMeBadge}><Text style={s.lbMeBadgeText}>YOU</Text></View>
                          )}
                        </View>
                        <Text style={s.lbMemberName} numberOfLines={1}>{entry.member_name}</Text>
                      </View>
                      <View style={s.lbStatsBlock}>
                        {lbTab === 'overall' && (
                          <Text style={s.lbGW}>{entry.matchdays_played} GW</Text>
                        )}
                        <Text style={[s.lbPoints, entry.is_me && { color: colors.gold }]}>
                          {Math.round(entry.total_points)}<Text style={s.lbPointsSuffix}> pts</Text>
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )
          })()}
        </View>

        <Text style={s.footerNote}>{CLUB_NAME} · Pavilion Fantasy 2026 · 18 Matchdays</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      <PointsModal visible={showPointsModal} onClose={() => setShowPointsModal(false)} />
      <PlayerDetailModal
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        team={detailTeam}
        data={detailData}
        matchdays={allMatchdays}
        loading={detailLoading}
        isMe={detailTeam?.is_me || false}
        picks={detailPicks}
        pickPoints={detailPickPoints}
      />
      <CreateTeamModal
        visible={showCreateModal} saving={saving} teamName={teamNameInput}
        onChangeName={setTeamNameInput} onSubmit={handleSaveTeamName}
        onClose={() => setShowCreateModal(false)} editMode={editTeamMode}
      />
      {currentMatchday && (
        <PickTeamModal
          visible={showPickModal} onClose={() => setShowPickModal(false)}
          matchdayNum={currentMatchday.matchday_num} matchdayDate={currentMatchday.date}
          availablePlayers={availablePlayers} existingPicks={myPicks}
          onSave={handleSavePicks} saving={saving}
          prevPickedIds={prevPickedIds}
          myProfileId={profile?.id}
        />
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.navy },
  scroll:      { flex: 1 },
  content:     { padding: spacing.md },
  centred:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },

  // Page header
  pageHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.lg },
  sectionLabel:  { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.gold, marginBottom: 4 },
  pageTitle:     { fontFamily: fonts.display, fontSize: 36, letterSpacing: 2, color: colors.white, lineHeight: 40 },
  pointsBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  pointsBtnText: { fontFamily: fonts.bold, fontSize: 11, color: colors.gold, letterSpacing: 0.5 },

  // Hero (no team)
  heroCard:     { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)', borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.lg, overflow: 'hidden' },
  heroBadge:    { backgroundColor: 'rgba(245,197,24,0.12)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.35)', borderRadius: 100, paddingHorizontal: 16, paddingVertical: 6, marginBottom: spacing.lg, overflow: 'hidden' },
  shimmer:      { position: 'absolute', top: 0, bottom: 0, width: 80, backgroundColor: 'rgba(245,197,24,0.18)', transform: [{ skewX: '-20deg' }] },
  heroBadgeText:{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 3, color: colors.gold },
  trophyWrap:   { marginBottom: spacing.md, shadowColor: colors.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10 },
  heroTitle:    { fontFamily: fonts.display, fontSize: 28, letterSpacing: 4, color: colors.white, textAlign: 'center', marginBottom: 8 },
  heroSub:      { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20, maxWidth: 270, marginBottom: spacing.lg },
  createBtn:    { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 32, alignSelf: 'stretch', alignItems: 'center' },
  createBtnText:{ fontFamily: fonts.bold, fontSize: 15, color: colors.navy, letterSpacing: 0.5 },

  // Feature cards
  featureCard:  { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 10 },
  featureIcon:  { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featureTitle: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 0.3, marginBottom: 4 },
  featureDesc:  { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, lineHeight: 18 },

  // Points card (inline, no team state)
  pointsCard:       { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: 'rgba(245,197,24,0.15)', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  pointsCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  pointsCardTitle:  { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 2, color: colors.gold },

  // Points rows — shared between inline card + modal
  ptsSect:       { paddingTop: 12, paddingHorizontal: 16 },
  ptsSectTitle:  { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, marginBottom: 8 },
  ptsRowItem:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  ptsRowAction:  { fontFamily: fonts.body, fontSize: 13, color: colors.textLight },
  ptsRowValue:   { fontFamily: fonts.bold, fontSize: 13 },

  // Points modal — centered box (matches FixtureDetailScreen POTM card)
  ptsBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  ptsBox:        { width: '100%', maxHeight: '82%', backgroundColor: colors.navyLight, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(245,197,24,0.15)', overflow: 'hidden' },
  ptsBoxHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  ptsBoxTitle:   { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 2, color: colors.gold },
  ptsBoxClose:   { padding: 4 },
  ptsBoxCloseText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },

  // Team header card
  teamCard:     { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  teamCardTop:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.md },
  trophySmall:  { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(245,197,24,0.1)', alignItems: 'center', justifyContent: 'center' },
  teamName:     { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1.5, color: colors.white },
  teamMember:   { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  editTeamBtn:  { padding: 8 },
  teamStats:    { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  teamStat:     { flex: 1, alignItems: 'center' },
  teamStatNum:  { fontFamily: fonts.display, fontSize: 22, letterSpacing: 1, color: colors.white },
  teamStatLabel:{ fontFamily: fonts.bold, fontSize: 8, letterSpacing: 2, color: colors.textMuted, marginTop: 2 },
  teamStatDiv:  { width: 1, backgroundColor: colors.border, marginVertical: 4 },

  // Matchday card
  mdCard:      { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  mdTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  mdNum:       { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.green },
  mdDate:      { fontFamily: fonts.display, fontSize: 15, letterSpacing: 1, color: colors.white, marginTop: 2 },
  statusChip:  { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(139,155,180,0.25)', backgroundColor: 'rgba(139,155,180,0.08)' },
  chipOpen:    { borderColor: 'rgba(34,197,94,0.3)', backgroundColor: 'rgba(34,197,94,0.08)' },
  chipResults: { borderColor: 'rgba(245,197,24,0.3)', backgroundColor: 'rgba(245,197,24,0.08)' },
  chipLocked:  { borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.06)' },
  statusChipText: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.5, color: colors.textMuted },
  cutoffNote:  { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginBottom: spacing.md },
  pickXIBtn:   { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm },
  pickXIBtnText:{ fontFamily: fonts.bold, fontSize: 14, color: colors.navy },
  waitingRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm },
  waitingText: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  picksHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, marginTop: spacing.sm },
  picksHeaderTitle: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 2, color: colors.textMuted },
  editPicksLink:    { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1, color: colors.gold },
  noPicksText: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' },

  // Player strip
  playerStrip:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  stripAvatar:   { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stripAvatarText: { fontFamily: fonts.bold, fontSize: 10 },
  stripInfo:     { flex: 1, minWidth: 0 },
  stripNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 1 },
  stripName:     { fontFamily: fonts.bold, fontSize: 13, color: colors.white, flexShrink: 1 },
  badgeC:        { backgroundColor: 'rgba(245,197,24,0.18)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.5)', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1 },
  badgeCText:    { fontFamily: fonts.bold, fontSize: 9, color: colors.gold },
  badgeVC:       { backgroundColor: 'rgba(96,165,250,0.18)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.5)', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1 },
  badgeVCText:   { fontFamily: fonts.bold, fontSize: 9, color: '#60A5FA' },
  stripTeam:     { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1, color: colors.textMuted },
  stripPtsBlock: { alignItems: 'flex-end' },
  stripMultiplier: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.5 },
  stripPoints:   { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  stripPending:  { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  totalRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(245,197,24,0.2)' },
  totalLabel:    { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 2, color: colors.textMuted },
  totalPoints:   { fontFamily: fonts.display, fontSize: 24, letterSpacing: 2, color: colors.gold },

  // Leaderboard
  lbSection:    { marginTop: spacing.lg },
  lbDivRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.md },
  lbDiv:        { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  lbDivLabel:   { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.textMuted },

  // Tabs
  lbTabRow:       { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.sm, padding: 3, marginBottom: spacing.md },
  lbTabBtn:       { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm - 1 },
  lbTabBtnActive: { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)' },
  lbTabText:      { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.5, color: colors.textMuted },
  lbTabTextActive:{ color: colors.gold },

  // Top 3 podium — full-width stacked animated cards
  // rank 2 & 3 use paddingVertical: 9 (same as rank 4+ rows) — only rank 1 is taller
  lbTopCard:        { borderWidth: 1, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  lbTopCard1:       { paddingVertical: 16, borderRadius: radius.lg },
  lbTopLeft:        { alignItems: 'center', width: 42, flexShrink: 0 },
  lbTopMedalCircle: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  lbTopCenter:      { flex: 1, minWidth: 0 },
  lbTopTeamName:    { fontFamily: fonts.display, letterSpacing: 0.8, color: colors.white },
  lbTopMember:      { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  lbTopPtsBlock:    { alignItems: 'flex-end', flexShrink: 0 },
  lbTopPts:         { fontFamily: fonts.display, letterSpacing: 0.5 },
  lbTopPtsSuffix:   { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1, opacity: 0.7, marginTop: 1 },
  // Gold sweep — absolute band that sweeps left → right across rank 1 card background
  lbGoldSweep:      { position: 'absolute', top: 0, bottom: 0, width: 90, backgroundColor: 'rgba(245,197,24,0.14)' },

  // Me badge
  lbMeBadge:      { backgroundColor: 'rgba(245,197,24,0.15)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.4)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  lbMeBadgeText:  { fontFamily: fonts.bold, fontSize: 8, letterSpacing: 1, color: colors.gold },

  // Regular rows (rank 4+)
  lbEmptyWrap:  { paddingVertical: spacing.lg },
  lbEmpty:      { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  lbRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: spacing.md, marginBottom: 8, gap: 4 },
  lbRowMe:      { borderColor: 'rgba(245,197,24,0.35)', backgroundColor: 'rgba(245,197,24,0.04)' },
  lbRankBlock:  { width: 34, alignItems: 'center', flexShrink: 0 },
  lbRank:       { fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted },
  lbTeamBlock:  { flex: 1, minWidth: 0, marginRight: 6 },
  lbTeamName:   { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  lbMemberName: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  lbStatsBlock: { alignItems: 'flex-end', flexShrink: 0 },
  lbGW:         { fontFamily: fonts.bold, fontSize: 10, color: colors.textMuted, letterSpacing: 0.5 },
  lbPoints:     { fontFamily: fonts.display, fontSize: 18, color: colors.white, letterSpacing: 0.5 },
  lbPointsSuffix: { fontFamily: fonts.bold, fontSize: 10, color: colors.textMuted },
  footerNote:   { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, textAlign: 'center', opacity: 0.5, paddingVertical: spacing.lg },

  // Player detail modal
  detailSheet:      { backgroundColor: colors.navyLight, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(245,197,24,0.15)', paddingHorizontal: spacing.lg, paddingBottom: 40, paddingTop: 12 },
  detailHeader:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.md },
  detailTrophyWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(245,197,24,0.08)', alignItems: 'center', justifyContent: 'center' },
  detailTeamName:   { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1.5, color: colors.white },
  detailMember:     { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  detailDivider:    { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: spacing.md },
  detailEmpty:      { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl },
  detailTotalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, marginTop: 4, borderTopWidth: 1.5, borderTopColor: 'rgba(245,197,24,0.25)' },
  detailTotalLabel: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 2, color: colors.textMuted },
  detailTotalPts:   { fontFamily: fonts.display, fontSize: 24, letterSpacing: 1, color: colors.gold },

  // Points modal (shared sheet)
  modalBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:      { backgroundColor: colors.navyLight, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(245,197,24,0.15)', paddingHorizontal: spacing.lg, paddingBottom: 40, paddingTop: 12 },
  modalHandle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  modalTitleRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  modalTitle:      { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 2, color: colors.gold },
  modalSub:        { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 18 },
  modalCloseBtn:   { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: spacing.md },
  modalCloseBtnText:{ fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },

  // Create/rename modal
  centreBackdrop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: spacing.lg },
  centreBox:       { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: radius.lg, padding: spacing.lg },
  centreTitle:     { fontFamily: fonts.display, fontSize: 22, letterSpacing: 2, color: colors.white, marginBottom: 6 },
  centreSub:       { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.md },
  teamNameInput:   { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.medium, fontSize: 16, color: colors.white, marginBottom: 4 },
  charCount:       { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, textAlign: 'right', marginBottom: spacing.md },
  centreBtns:      { flexDirection: 'row', gap: 10 },
  centreCancelBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  centreCancelText:{ fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },
  centreConfirmBtn:{ flex: 1, backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  centreConfirmText:{ fontFamily: fonts.bold, fontSize: 14, color: colors.navy },

  // Pick Team modal
  pickContainer: { flex: 1, backgroundColor: colors.navy },
  pickHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  pickBackBtn:   { padding: 8 },
  pickTitle:     { fontFamily: fonts.display, fontSize: 17, letterSpacing: 2, color: colors.white },
  pickSubtitle:  { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  pickCounter:   { backgroundColor: 'rgba(139,155,180,0.15)', borderWidth: 1, borderColor: 'rgba(139,155,180,0.3)', borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  pickCounterFull:{ backgroundColor: colors.green, borderColor: colors.green },
  pickCounterText:{ fontFamily: fonts.bold, fontSize: 13, color: colors.white, letterSpacing: 0.5 },
  pickRoleRow:   { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickRoleChip:  { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center' },
  pickRoleChipC: { borderColor: 'rgba(245,197,24,0.25)', backgroundColor: 'rgba(245,197,24,0.05)' },
  pickRoleChipVC:{ borderColor: 'rgba(96,165,250,0.25)', backgroundColor: 'rgba(96,165,250,0.05)' },
  pickRoleChipText:{ fontFamily: fonts.bold, fontSize: 11, color: colors.textMuted, letterSpacing: 0.3 },
  pickTabRow:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  pickTab:       { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', position: 'relative' },
  pickTabText:   { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1, color: colors.textMuted },
  pickTabBadge:  { position: 'absolute', top: 5, right: 8, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  pickTabBadgeNum:{ fontFamily: fonts.bold, fontSize: 9, color: colors.navy },
  pickList:      { flex: 1, paddingHorizontal: spacing.md },
  pickRow:            { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'transparent', borderRadius: radius.sm, marginVertical: 2, paddingHorizontal: 4 },
  pickRowBlocked:     { opacity: 0.45 },
  pickCheck:          { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pickCheckMark:      { fontFamily: fonts.bold, fontSize: 11, color: colors.navy },
  pickCheckBlocked:   { borderColor: colors.red, backgroundColor: 'rgba(239,68,68,0.08)' },
  pickCheckBlockedMark:{ fontFamily: fonts.bold, fontSize: 9, color: colors.red },
  pickBlockedLabel:   { fontFamily: fonts.body, fontSize: 10, color: colors.red, marginTop: 2, letterSpacing: 0.2 },
  pickAvatar:    { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pickAvatarText:{ fontFamily: fonts.bold, fontSize: 11 },
  pickPlayerName:{ fontFamily: fonts.medium, fontSize: 14, color: colors.textLight },
  pickRoleBadge: { width: 30, height: 26, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pickRoleBadgeC:{ backgroundColor: 'rgba(245,197,24,0.15)', borderColor: 'rgba(245,197,24,0.5)' },
  pickRoleBadgeVC:{ backgroundColor: 'rgba(96,165,250,0.15)', borderColor: 'rgba(96,165,250,0.5)' },
  pickRoleBadgeNone:{ backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
  pickRoleBadgeText:{ fontFamily: fonts.bold, fontSize: 10 },
  pickFooter:    { padding: spacing.md, paddingBottom: 32, borderTopWidth: 1, borderTopColor: colors.border },
  pickConfirmBtn:{ backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center' },
  pickConfirmText:{ fontFamily: fonts.bold, fontSize: 15, color: colors.navy },

  // Role action sheet (inside pick modal)
  roleBackdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  roleSheet:     { backgroundColor: '#1A2744', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: spacing.lg, paddingBottom: 36, paddingTop: 10 },
  roleHandle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  roleName:      { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1, color: colors.white, marginBottom: 2 },
  roleSub:       { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginBottom: spacing.md },
  roleBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 8 },
  roleBtnActiveC:{ borderColor: 'rgba(245,197,24,0.4)', backgroundColor: 'rgba(245,197,24,0.06)' },
  roleBtnActiveVC:{ borderColor: 'rgba(96,165,250,0.4)', backgroundColor: 'rgba(96,165,250,0.06)' },
  roleBtnLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roleBadgeC:    { width: 30, height: 26, borderRadius: 4, backgroundColor: 'rgba(245,197,24,0.15)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.4)', alignItems: 'center', justifyContent: 'center' },
  roleBadgeVC:   { width: 30, height: 26, borderRadius: 4, backgroundColor: 'rgba(96,165,250,0.15)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.4)', alignItems: 'center', justifyContent: 'center' },
  roleBadgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.white },
  roleBtnLabel:  { fontFamily: fonts.bold, fontSize: 14, color: colors.textLight },
  roleRemoveBtn: { paddingVertical: 13, alignItems: 'center', marginBottom: 8 },
  roleRemoveText:{ fontFamily: fonts.bold, fontSize: 13, color: '#EF4444' },
  roleCancelBtn: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  roleCancelText:{ fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },

  // Matchday archive navigator (prev/next)
  mdNavRow:          { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: radius.md, marginBottom: spacing.md, overflow: 'hidden' },
  mdNavBtn:          { paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  mdNavBtnDisabled:  { opacity: 0.3 },
  mdNavArrow:        { fontFamily: fonts.bold, fontSize: 22, color: colors.gold, lineHeight: 26 },
  mdNavCenter:       { flex: 1, alignItems: 'center', paddingVertical: 10, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  mdNavLabel:        { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 2, color: colors.white },
  mdNavDate:         { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },

  // Player detail modal — season badge in header
  detailSeasonBadge: { alignItems: 'center', backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.25)', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0 },
  detailSeasonTotal: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 1, color: colors.gold },
  detailSeasonLabel: { fontFamily: fonts.bold, fontSize: 8, letterSpacing: 2, color: colors.textMuted, marginTop: 1 },

  // Matchday score cards
  detailMdCard:      {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6,
  },
  detailMdCardTitle: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.8, color: colors.green, marginBottom: 3 },
  detailMdCardDate:  { fontFamily: fonts.body, fontSize: 12, color: colors.textLight },
  detailMdCardHint:  { fontFamily: fonts.body, fontSize: 10, color: colors.gold, marginTop: 3, opacity: 0.75 },
  detailMdCardPts:   { fontFamily: fonts.bold, fontSize: 18, color: colors.gold, letterSpacing: 0.5 },

  // Own XI expanded picks (self-view only)
  detailPicksWrap:    { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, marginBottom: 8, paddingVertical: 4, paddingHorizontal: 4 },
  detailPickRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  detailPickAvatar:   { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  detailPickInitials: { fontFamily: fonts.bold, fontSize: 9 },
  detailPickName:     { fontFamily: fonts.medium, fontSize: 13, color: colors.textLight },
  detailPickTeam:     { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.8, color: colors.textMuted, marginTop: 1 },
  detailPickRight:    { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  detailPickPts:      { fontFamily: fonts.bold, fontSize: 14, color: colors.gold, minWidth: 36, textAlign: 'right' },
  detailBadgeC:       { backgroundColor: 'rgba(245,197,24,0.15)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.45)', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1 },
  detailBadgeCText:   { fontFamily: fonts.bold, fontSize: 8, color: colors.gold },
  detailBadgeVC:      { backgroundColor: 'rgba(96,165,250,0.15)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.45)', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1 },
  detailBadgeVCText:  { fontFamily: fonts.bold, fontSize: 8, color: '#60A5FA' },
})

// pavilion-app/src/screens/member/StatsScreen.jsx
// Season stats from match_batting, match_bowling, match_potm
// Filters: Team (All/1st–Sunday) + Competition (All/MCCL/Cup/Friendly/CVSL)
// Tabs: Batting | Bowling | Fielding | Awards
// Tap player row → full stats modal

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, FlatList, Modal, Animated, ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView }  from 'react-native-safe-area-context'
import { supabase }      from '../../lib/supabase'
import TopHeader         from '../../components/layout/TopHeader'
import AppIcon           from '../../components/AppIcon'
import icons             from '../../lib/icons'
import { colors, fonts, spacing, radius } from '../../theme'
import { teamColor, shortTeam } from '../../lib/constants'

// ─── CONFIGURABLE ─────────────────────────────────────────────────────────────
const MAX_LIST_ROWS = 25   // rows shown before "Show all" button

// Team filters — matches TEAM_ORDER in other screens
const TEAM_FILTERS = [
  { label: 'ALL',    value: null },
  { label: '1st XI', value: '1st XI' },
  { label: '2nd XI', value: '2nd XI' },
  { label: '3rd XI', value: '3rd XI' },
  { label: '4th XI', value: '4th XI' },
  { label: 'Sunday', value: 'Sunday XI' },
]

// Competition filters — match match_type values in fixtures table
const COMP_FILTERS = [
  { label: 'ALL',      value: null },
  { label: 'MCCL',     value: 'league' },
  { label: 'CVSL',     value: 'sunday_comp' },
  { label: 'Friendly', value: 'friendly' },
  { label: 'Cup',      value: 'cup' },
]

// Category tabs
const CATEGORIES = [
  { key: 'batting',  label: 'Batting',   icon: 'cricketBat'   },
  { key: 'bowling',  label: 'Bowling',   icon: 'cricketBowl'  },
  { key: 'fielding', label: 'Fielding',  icon: 'cricketField' },
  { key: 'awards',   label: 'Awards',    icon: 'trophy'       },
]

// Medal ring accent colours — gold, silver, bronze
const MEDAL_ACCENT = ['#F5C518', '#A8A9AD', '#CD7F32']
// ──────────────────────────────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(val, decimals = 2) {
  if (val === null || val === undefined || val === '') return '—'
  const n = parseFloat(val)
  if (isNaN(n) || n === 0) return decimals === 0 ? '0' : '—'
  return decimals === 0 ? String(Math.round(n)) : n.toFixed(decimals)
}

// shortTeam — imported from constants.js

// teamColor — imported from constants.js

// ─── Aggregate raw match data into per-player stats ────────────────────────────
function aggregateStats(batData, bowlData, fieldData, potmData, teamFilter, compFilter) {
  const passesFilter = (row) => {
    const tName = row.fixtures?.teams?.name || ''
    const mType = row.fixtures?.match_type  || ''
    const teamOk = !teamFilter || tName === teamFilter ||
      // fuzzy match for "Sunday XI" vs "Sunday 1st XI" etc.
      (teamFilter === 'Sunday XI' && tName.toLowerCase().includes('sunday'))
    const compOk = !compFilter || mType === compFilter
    return teamOk && compOk
  }

  const map = {}

  // ── Batting ─────────────────────────────────────────────────────────────────
  batData.filter(passesFilter).forEach(row => {
    const pid = row.player_id
    if (!map[pid]) {
      map[pid] = {
        player_id: pid,
        player_name: row.profiles?.full_name || 'Unknown',
        teams: new Set(),
        // batting totals
        bat_innings: 0, bat_runs: 0, bat_balls: 0,
        bat_fours: 0, bat_sixes: 0, bat_not_outs: 0,
        bat_highest: 0, bat_highest_no: false,
        bat_fifties: 0, bat_hundreds: 0,
      }
    }
    const p   = map[pid]
    const tName = row.fixtures?.teams?.name
    if (tName) p.teams.add(tName)

    const runs  = row.runs  || 0
    const balls = row.balls || 0
    p.bat_innings++
    p.bat_runs  += runs
    p.bat_balls += balls
    p.bat_fours += row.fours || 0
    p.bat_sixes += row.sixes || 0
    if (row.not_out) p.bat_not_outs++
    if (runs > p.bat_highest || (runs === p.bat_highest && row.not_out)) {
      p.bat_highest    = runs
      p.bat_highest_no = row.not_out
    }
    if (runs >= 100) p.bat_hundreds++
    else if (runs >= 50) p.bat_fifties++
  })

  // ── Bowling ─────────────────────────────────────────────────────────────────
  bowlData.filter(passesFilter).forEach(row => {
    const pid = row.player_id
    if (!map[pid]) {
      map[pid] = {
        player_id: pid,
        player_name: row.profiles?.full_name || 'Unknown',
        teams: new Set(),
        bat_innings: 0, bat_runs: 0, bat_balls: 0,
        bat_fours: 0, bat_sixes: 0, bat_not_outs: 0,
        bat_highest: 0, bat_highest_no: false,
        bat_fifties: 0, bat_hundreds: 0,
      }
    }
    const p = map[pid]
    const tName = row.fixtures?.teams?.name
    if (tName) p.teams.add(tName)

    if (p.bowl_overs === undefined) {
      p.bowl_innings      = 0
      p.bowl_overs        = 0; p.bowl_maidens = 0
      p.bowl_runs         = 0; p.bowl_wickets = 0
      p.bowl_best_wickets = 0; p.bowl_best_runs = 999
      p.bowl_five_fors    = 0; p.bowl_four_fors = 0
    }
    p.bowl_innings  += 1
    p.bowl_overs    += parseFloat(row.overs   || 0)
    p.bowl_maidens  += row.maidens  || 0
    p.bowl_runs     += row.runs     || 0
    p.bowl_wickets  += row.wickets  || 0

    // Track best bowling figures and hauls
    const wkts = row.wickets || 0
    const runs  = row.runs   || 0
    if (wkts > p.bowl_best_wickets ||
        (wkts === p.bowl_best_wickets && runs < p.bowl_best_runs)) {
      p.bowl_best_wickets = wkts
      p.bowl_best_runs    = runs
    }
    if (wkts >= 5)      p.bowl_five_fors += 1
    else if (wkts >= 4) p.bowl_four_fors += 1
  })

  // ── Fielding ────────────────────────────────────────────────────────────────
  fieldData.filter(passesFilter).forEach(row => {
    const pid = row.player_id
    if (!map[pid]) return  // only track fielding for players already in map
    const p = map[pid]
    if (p.field_catches   === undefined) { p.field_catches = 0; p.field_stumpings = 0 }
    p.field_catches   += row.catches   || 0
    p.field_stumpings += row.stumpings || 0
    const tName = row.fixtures?.teams?.name
    if (tName) p.teams.add(tName)
  })

  // ── POTM ────────────────────────────────────────────────────────────────────
  potmData.filter(passesFilter).forEach(row => {
    const pid = row.player_id
    if (!map[pid]) return  // skip POTM for players with no batting row (edge case)
    const p = map[pid]
    p.potm_count  = (p.potm_count  || 0) + 1
    p.potm_points = (p.potm_points || 0) + parseFloat(row.points || 0)
  })

  // ── Derive calculated fields ─────────────────────────────────────────────────
  return Object.values(map).map(p => {
    p.teams          = Array.from(p.teams)
    p.htcc_team_name = p.teams[0] || ''

    // Batting derived
    const dismissals  = p.bat_innings - p.bat_not_outs
    p.bat_average     = dismissals > 0   ? p.bat_runs / dismissals   : null
    p.bat_strike_rate = p.bat_balls > 0  ? (p.bat_runs / p.bat_balls) * 100 : null

    // Bowling derived
    if (p.bowl_overs !== undefined) {
      const totalBalls     = p.bowl_overs > 0 ? Math.floor(p.bowl_overs) * 6 + Math.round((p.bowl_overs % 1) * 10) : 0
      p.bowl_average      = p.bowl_wickets > 0 ? p.bowl_runs / p.bowl_wickets : null
      p.bowl_economy      = p.bowl_overs   > 0 ? p.bowl_runs / p.bowl_overs   : null
      p.bowl_strike_rate  = p.bowl_wickets > 0 ? totalBalls  / p.bowl_wickets : null
      p.bowl_best_figures = p.bowl_best_wickets > 0
        ? `${p.bowl_best_wickets}/${p.bowl_best_runs}` : '—'
    }

    return p
  })
}

// ─── Player detail modal ──────────────────────────────────────────────────────
const PlayerModal = React.memo(function PlayerModal({ player, visible, onClose }) {
  if (!player) return null
  const tc = teamColor(player.htcc_team_name)
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modal.container}>
        <TouchableOpacity style={modal.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={modal.sheet}>
          <View style={modal.handleWrap}>
            <View style={modal.handle} />
            <TouchableOpacity style={modal.closeBtn} onPress={onClose}>
              <Text style={modal.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={modal.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={modal.header}>
              <View style={{ flex: 1 }}>
                <Text style={modal.playerName}>{player.player_name}</Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {(player.teams || [player.htcc_team_name]).filter(Boolean).map((tname, i) => {
                    const tc2 = teamColor(tname)
                    return (
                      <View key={i} style={[modal.teamBadge, { borderColor: `${tc2}40`, backgroundColor: `${tc2}12` }]}>
                        <View style={[modal.teamDot, { backgroundColor: tc2 }]} />
                        <Text style={[modal.teamLabel, { color: tc2 }]}>{tname}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
              {(player.potm_count > 0) && (
                <View style={modal.potmBadge}>
                  <AppIcon name="trophy" size={18} />
                  <Text style={modal.potmBadgeText}>{player.potm_count}× POTM</Text>
                </View>
              )}
            </View>

            {/* Batting */}
            {player.bat_innings > 0 && (
              <>
                <Text style={modal.sectionTitle}>BATTING</Text>
                <View style={modal.statsGrid}>
                  <StatBox label="Innings"  value={fmt(player.bat_innings, 0)} />
                  <StatBox label="Runs"     value={fmt(player.bat_runs, 0)}    highlight />
                  <StatBox label="Average"  value={fmt(player.bat_average)} />
                  <StatBox label="S/R"      value={fmt(player.bat_strike_rate)} />
                  <StatBox label="Highest"  value={player.bat_highest > 0 ? `${player.bat_highest}${player.bat_highest_no ? '*' : ''}` : '—'} highlight />
                  <StatBox label="4s"       value={fmt(player.bat_fours, 0)} />
                  <StatBox label="6s"       value={fmt(player.bat_sixes, 0)} />
                  <StatBox label="50s/100s" value={`${player.bat_fifties}/${player.bat_hundreds}`} />
                </View>
              </>
            )}

            {/* Bowling */}
            {player.bowl_overs > 0 && (
              <>
                <Text style={modal.sectionTitle}>BOWLING</Text>
                <View style={modal.statsGrid}>
                  {/* Innings before Wickets; Runs before Best — per layout spec */}
                  <StatBox label="Innings"  value={fmt(player.bowl_innings, 0)} />
                  <StatBox label="Wickets"  value={fmt(player.bowl_wickets, 0)} highlight />
                  <StatBox label="Overs"    value={fmt(player.bowl_overs, 1)} />
                  <StatBox label="Average"  value={fmt(player.bowl_average)} />
                  <StatBox label="Economy"  value={fmt(player.bowl_economy)} />
                  <StatBox label="S/R"      value={fmt(player.bowl_strike_rate)} />
                  <StatBox label="Maidens"  value={fmt(player.bowl_maidens, 0)} />
                  <StatBox label="Runs"     value={fmt(player.bowl_runs, 0)} />
                  <StatBox label="5-fers"   value={fmt((player.bowl_five_fors || 0), 0)} />
                  <StatBox label="Best"     value={player.bowl_best_figures || '—'} highlight />
                </View>
              </>
            )}

            {/* Fielding — show whenever catches or stumpings recorded */}
            {((player.field_catches || 0) + (player.field_stumpings || 0)) > 0 && (
              <>
                <Text style={modal.sectionTitle}>FIELDING</Text>
                <View style={modal.statsGrid}>
                  {/* Only Total gets the gold highlight */}
                  <StatBox label="Catches"    value={fmt(player.field_catches || 0, 0)} />
                  <StatBox label="Stumpings"  value={fmt(player.field_stumpings || 0, 0)} />
                  <StatBox label="Total"      value={fmt((player.field_catches || 0) + (player.field_stumpings || 0), 0)} highlight />
                </View>
              </>
            )}

            {/* Awards */}
            {player.potm_count > 0 && (
              <>
                <Text style={modal.sectionTitle}>AWARDS</Text>
                <View style={modal.statsGrid}>
                  {/* Both POTM and Total Pts get the gold highlight */}
                  <StatBox label="POTM"       value={fmt(player.potm_count, 0)}  highlight />
                  <StatBox label="Total Pts"  value={fmt(player.potm_points, 0)} highlight />
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
})

function StatBox({ label, value, highlight }) {
  return (
    <View style={[modal.statBox, highlight && modal.statBoxHighlight]}>
      <Text style={[modal.statValue, highlight && modal.statValueHighlight]}>{value}</Text>
      <Text style={modal.statLabel}>{label}</Text>
    </View>
  )
}

// ─── Summary leader card ──────────────────────────────────────────────────────
const SummaryCard = React.memo(function SummaryCard({ label, name, value, unit, color }) {
  return (
    <View style={[summary.card, { borderTopColor: color }]}>
      <Text style={[summary.value, { color }]}>{value}</Text>
      <Text style={summary.unit}>{unit}</Text>
      <View style={summary.divider} />
      <Text style={summary.label}>{label}</Text>
      <Text style={summary.name} numberOfLines={1}>{name || '—'}</Text>
    </View>
  )
})

const MiniStat = React.memo(function MiniStat({ label, value, primary }) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniStatValue, primary && styles.miniStatValuePrimary]}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  )
})

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function StatsScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current

  const [category,   setCategory]   = useState('batting')
  const [teamFilter, setTeamFilter] = useState(null)
  const [compFilter, setCompFilter] = useState(null)
  const [search,     setSearch]     = useState('')
  const [showMore,   setShowMore]   = useState(false)
  const [modalState, setModalState] = useState({ visible: false, player: null })

  // Raw data from Supabase — fetched once, filtered client-side
  const [batRaw,   setBatRaw]   = useState([])
  const [bowlRaw,  setBowlRaw]  = useState([])
  const [fieldRaw, setFieldRaw] = useState([])
  const [potmRaw,  setPotmRaw]  = useState([])
  const [loading, setLoading] = useState(true)

  // ── Fetch all raw data once on mount ────────────────────────────────────────
  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [batRes, bowlRes, fieldRes, potmRes] = await Promise.all([
        supabase
          .from('match_batting')
          .select('*, profiles!player_id(id, full_name), fixtures!fixture_id(id, match_type, team_id, teams!team_id(name))'),
        supabase
          .from('match_bowling')
          .select('*, profiles!player_id(id, full_name), fixtures!fixture_id(id, match_type, team_id, teams!team_id(name))'),
        supabase
          .from('match_fielding')
          .select('*, profiles!player_id(id, full_name), fixtures!fixture_id(id, match_type, team_id, teams!team_id(name))'),
        supabase
          .from('match_potm')
          .select('*, profiles!player_id(id, full_name), fixtures!fixture_id(id, match_type, team_id, teams!team_id(name))'),
      ])
      if (batRes.data)   setBatRaw(batRes.data)
      if (bowlRes.data)  setBowlRaw(bowlRes.data)
      if (fieldRes.data) setFieldRaw(fieldRes.data)
      if (potmRes.data)  setPotmRaw(potmRes.data)
    } catch (err) {
      console.error('[Stats] fetchAll error:', err.message)
    } finally {
      setLoading(false)
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start()
    }
  }

  // ── Aggregate + sort whenever filters or category change ────────────────────
  const stats = useMemo(() => {
    const agg = aggregateStats(batRaw, bowlRaw, fieldRaw, potmRaw, teamFilter, compFilter)

    if (category === 'batting') {
      return agg.filter(p => p.bat_innings > 0)
                .sort((a, b) => (b.bat_runs || 0) - (a.bat_runs || 0))
    }
    if (category === 'bowling') {
      return agg.filter(p => p.bowl_wickets > 0)
                .sort((a, b) => (b.bowl_wickets || 0) - (a.bowl_wickets || 0))
    }
    if (category === 'fielding') {
      return agg
        .filter(p => (p.field_catches || 0) + (p.field_stumpings || 0) > 0)
        .sort((a, b) =>
          ((b.field_catches || 0) + (b.field_stumpings || 0)) -
          ((a.field_catches || 0) + (a.field_stumpings || 0))
        )
    }
    // Awards
    return agg.filter(p => p.potm_count > 0)
              .sort((a, b) => (b.potm_count || 0) - (a.potm_count || 0))
  }, [batRaw, bowlRaw, fieldRaw, potmRaw, teamFilter, compFilter, category])

  // Reset show more when filters change
  useEffect(() => { setShowMore(false) }, [category, teamFilter, compFilter, search])

  // ── Client-side name search ──────────────────────────────────────────────────
  const filtered = useMemo(
    () => search
      ? stats.filter(p => p.player_name?.toLowerCase().includes(search.toLowerCase()))
      : stats,
    [stats, search]
  )

  const displayed = useMemo(
    () => showMore ? filtered : filtered.slice(0, MAX_LIST_ROWS),
    [showMore, filtered]
  )

  const openPlayer = useCallback((player) => {
    setModalState({ visible: true, player })
  }, [])

  // ── Summary leader cards ─────────────────────────────────────────────────────
  const summaryCards = useMemo(() => {
    if (!stats.length) return null

    if (category === 'batting') {
      const topRuns = stats[0]
      const topAvg  = [...stats].filter(p => p.bat_innings > 2)
                        .sort((a,b) => (b.bat_average||0) - (a.bat_average||0))[0]
      const topHS   = [...stats].sort((a,b) => (b.bat_highest||0) - (a.bat_highest||0))[0]
      const topSR   = [...stats].filter(p => (p.bat_balls||0) > 30)
                        .sort((a,b) => (b.bat_strike_rate||0) - (a.bat_strike_rate||0))[0]
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.summaryScroll} contentContainerStyle={styles.summaryContent}>
          <SummaryCard label="Most Runs" name={topRuns?.player_name} value={fmt(topRuns?.bat_runs, 0)}    unit="runs" color={colors.gold}    />
          <SummaryCard label="Best Avg"  name={topAvg?.player_name}  value={fmt(topAvg?.bat_average)}     unit="avg"  color={colors.green}   />
          <SummaryCard label="Highest"   name={topHS?.player_name}   value={topHS?.bat_highest > 0 ? `${topHS.bat_highest}${topHS.bat_highest_no ? '*':''}` : '—'} unit="hs" color="#60A5FA" />
          <SummaryCard label="Best SR"   name={topSR?.player_name}   value={fmt(topSR?.bat_strike_rate)}  unit="sr"   color="#F97316"         />
        </ScrollView>
      )
    }
    if (category === 'bowling') {
      const topWkts = stats[0]
      const topAvg  = [...stats].filter(p => p.bowl_wickets > 2)
                        .sort((a,b) => (a.bowl_average||999) - (b.bowl_average||999))[0]
      const topEco  = [...stats].filter(p => (p.bowl_overs||0) > 10)
                        .sort((a,b) => (a.bowl_economy||99) - (b.bowl_economy||99))[0]
      const topBB   = [...stats].sort((a,b) => (b.bowl_best_wickets||0) - (a.bowl_best_wickets||0))[0]
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.summaryScroll} contentContainerStyle={styles.summaryContent}>
          <SummaryCard label="Most Wkts" name={topWkts?.player_name} value={fmt(topWkts?.bowl_wickets, 0)}  unit="wkts" color={colors.gold}   />
          <SummaryCard label="Best Avg"  name={topAvg?.player_name}  value={fmt(topAvg?.bowl_average)}      unit="avg"  color={colors.green}  />
          <SummaryCard label="Best Eco"  name={topEco?.player_name}  value={fmt(topEco?.bowl_economy)}      unit="eco"  color="#60A5FA"        />
          <SummaryCard label="Best Fig"  name={topBB?.player_name}   value={topBB?.bowl_best_figures || '—'} unit="bb"  color="#F97316"        />
        </ScrollView>
      )
    }
    if (category === 'fielding') {
      const topTotal = stats[0]
      const topCatch = [...stats].sort((a,b) => (b.field_catches||0) - (a.field_catches||0))[0]
      const topSt    = [...stats].sort((a,b) => (b.field_stumpings||0) - (a.field_stumpings||0))[0]
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.summaryScroll} contentContainerStyle={styles.summaryContent}>
          <SummaryCard label="Most Ovr." name={topTotal?.player_name} value={fmt((topTotal?.field_catches||0)+(topTotal?.field_stumpings||0), 0)} unit="total" color={colors.gold} />
          <SummaryCard label="Most Cts"  name={topCatch?.player_name} value={fmt(topCatch?.field_catches||0, 0)}    unit="catches"   color={colors.green} />
          <SummaryCard label="Stumpings" name={topSt?.player_name}    value={fmt(topSt?.field_stumpings||0, 0)}    unit="stumpings" color="#60A5FA"       />
        </ScrollView>
      )
    }
    if (category === 'awards') {
      const top = stats[0]
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.summaryScroll} contentContainerStyle={styles.summaryContent}>
          <SummaryCard label="Most POTM"  name={top?.player_name}  value={fmt(top?.potm_count, 0)}  unit="awards" color={colors.gold} />
          <SummaryCard label="Most Pts"   name={[...stats].sort((a,b) => (b.potm_points||0) - (a.potm_points||0))[0]?.player_name}
            value={fmt([...stats].sort((a,b) => (b.potm_points||0) - (a.potm_points||0))[0]?.potm_points, 0)} unit="pts" color="#F97316" />
        </ScrollView>
      )
    }
    return null
  }, [stats, category])

  // ── Row renderer ─────────────────────────────────────────────────────────────
  const renderRow = useCallback(({ item, index }) => (
    <TouchableOpacity
      style={[styles.row, index === 0 && styles.rowFirst]}
      onPress={() => openPlayer(item)}
      activeOpacity={0.75}
    >
      {/* Rank + medal */}
      <View style={[styles.rankWrap, index < 3 && styles.rankWrapTop]}>
        {index < 3 ? (
          <View style={{
            width: 38, height: 38, borderRadius: 22,
            backgroundColor: `${MEDAL_ACCENT[index]}18`,
            borderWidth: 1.5, borderColor: `${MEDAL_ACCENT[index]}60`,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Image
              source={[icons.goldMedal, icons.silverMedal, icons.bronzeMedal][index]}
              style={{ width: 54, height: 54 }}
              resizeMode="contain"
            />
          </View>
        ) : (
          <Text style={styles.rank}>{index + 1}</Text>
        )}
      </View>

      {/* Name + team badge */}
      <View style={styles.rowMid}>
        <Text style={styles.rowName} numberOfLines={1}>{item.player_name}</Text>
        <View style={styles.rowTeamBadges}>
          {(item.teams?.length > 0 ? item.teams : [item.htcc_team_name]).filter(Boolean).map((tname, i) => {
            const tc2 = teamColor(tname)
            return (
              <View key={i} style={[styles.rowTeamBadge, { backgroundColor: `${tc2}15`, borderColor: `${tc2}30` }]}>
                <Text style={[styles.rowTeamText, { color: tc2 }]}>{shortTeam(tname)}</Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* Stats */}
      {category === 'batting' && (
        <View style={styles.rowStats}>
          <MiniStat label="Runs" value={fmt(item.bat_runs, 0)}   primary />
          <MiniStat label="Avg"  value={fmt(item.bat_average)}           />
          <MiniStat label="HS"   value={item.bat_highest > 0 ? `${item.bat_highest}${item.bat_highest_no ? '*':''}` : '—'} />
        </View>
      )}
      {category === 'bowling' && (
        <View style={styles.rowStats}>
          <MiniStat label="Wkts" value={fmt(item.bowl_wickets, 0)} primary />
          <MiniStat label="Avg"  value={fmt(item.bowl_average)}            />
          <MiniStat label="Eco"  value={fmt(item.bowl_economy)}            />
        </View>
      )}
      {category === 'fielding' && (
        <View style={styles.rowStats}>
          <MiniStat label="Total"    value={fmt((item.field_catches || 0) + (item.field_stumpings || 0), 0)} primary />
          <MiniStat label="Cts"      value={fmt(item.field_catches   || 0, 0)} />
          <MiniStat label="St"       value={fmt(item.field_stumpings || 0, 0)} />
        </View>
      )}
      {category === 'awards' && (
        <View style={styles.rowStats}>
          <MiniStat label="POTM" value={fmt(item.potm_count, 0)}  primary />
          <MiniStat label="Pts"  value={fmt(item.potm_points, 0)}         />
        </View>
      )}

      <Text style={styles.rowChevron}>›</Text>
    </TouchableOpacity>
  ), [category, openPlayer])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <TopHeader />

      <View style={styles.inner}>

        {/* Page header */}
        <View style={styles.header}>
          <Text style={styles.sectionLabel}>HTCC · 2026 SEASON</Text>
          <Text style={styles.pageTitle}>STATS</Text>
        </View>

        {/* ── Team filter pills ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
          {TEAM_FILTERS.map(tf => {
            const active = teamFilter === tf.value
            return (
              <TouchableOpacity key={tf.label}
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => setTeamFilter(tf.value)} activeOpacity={0.75}>
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                  {tf.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {/* ── Competition filter pills ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
          {COMP_FILTERS.map(cf => {
            const active = compFilter === cf.value
            return (
              <TouchableOpacity key={cf.label}
                style={[styles.filterPill, styles.filterPillComp, active && styles.filterPillCompActive]}
                onPress={() => setCompFilter(cf.value)} activeOpacity={0.75}>
                <Text style={[styles.filterPillText, active && styles.filterPillCompTextActive]}>
                  {cf.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {/* ── Search ── */}
        <View style={styles.searchWrap}>
          <AppIcon name="search" size={14} tint={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search player…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.searchClear}>
              <Text style={styles.searchClearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Category tabs ── */}
        <View style={styles.catTabs}>
          {CATEGORIES.map(cat => {
            const active = category === cat.key
            return (
              <TouchableOpacity key={cat.key}
                style={[styles.catTab, active && styles.catTabActive]}
                onPress={() => setCategory(cat.key)} activeOpacity={0.8}>
                {cat.icon === 'trophy'
                  ? <AppIcon name={cat.icon} size={18} style={{ opacity: active ? 1 : 0.45 }} />
                  : <AppIcon name={cat.icon} size={18} tint={active ? colors.gold : colors.textMuted} />
                }
                <Text style={[styles.catLabel, active && styles.catLabelActive]}>{cat.label}</Text>
                {active && <View style={styles.catUnderline} />}
              </TouchableOpacity>
            )
          })}
        </View>

        {/* ── Content ── */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.gold} size="large" />
            <Text style={styles.loadingText}>Loading stats…</Text>
          </View>
        ) : (
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <FlatList
              data={displayed}
              keyExtractor={item => item.player_id}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 32 }}
              ListHeaderComponent={() => (
                <View>
                  {!search && summaryCards}
                  <View style={styles.countRow}>
                    <Text style={styles.countText}>
                      {filtered.length === 0
                        ? 'No players found'
                        : `${Math.min(displayed.length, filtered.length)} of ${filtered.length} players`}
                    </Text>
                  </View>
                </View>
              )}
              renderItem={renderRow}
              ListFooterComponent={() => (
                !showMore && filtered.length > MAX_LIST_ROWS ? (
                  <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowMore(true)}>
                    <Text style={styles.showMoreText}>Show all {filtered.length} players</Text>
                  </TouchableOpacity>
                ) : null
              )}
              ListEmptyComponent={() => (
                <View style={styles.emptyWrap}>
                  <AppIcon name="cricketBat" size={36} tint={colors.textMuted} />
                  <Text style={styles.emptyTitle}>NO DATA YET</Text>
                  <Text style={styles.emptyText}>
                    {search
                      ? `No players matching "${search}"`
                      : 'Stats will appear once match scorecards are submitted.'}
                  </Text>
                </View>
              )}
            />
          </Animated.View>
        )}
      </View>

      <PlayerModal
        player={modalState.player}
        visible={modalState.visible}
        onClose={() => setModalState(prev => ({ ...prev, visible: false }))}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.navy },
  inner:        { flex: 1, paddingHorizontal: spacing.md },
  header:       { paddingTop: spacing.md, paddingBottom: 4 },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.gold },
  pageTitle:    { fontFamily: fonts.display, fontSize: 36, letterSpacing: 3, color: colors.white, lineHeight: 42 },

  // ── Filters ──
  filterScroll:  { flexGrow: 0, flexShrink: 0, marginBottom: 6 },
  filterContent: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingRight: spacing.md },
  filterPill:    { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)' },
  filterPillActive: { backgroundColor: 'rgba(245,197,24,0.1)', borderColor: 'rgba(245,197,24,0.4)' },
  filterPillComp: { paddingVertical: 5, paddingHorizontal: 12 },
  filterPillCompActive: { backgroundColor: 'rgba(96,165,250,0.1)', borderColor: 'rgba(96,165,250,0.4)' },
  filterPillText: { fontFamily: fonts.bold, fontSize: 11, color: colors.textMuted, letterSpacing: 0.5 },
  filterPillTextActive:     { color: colors.gold },
  filterPillCompTextActive: { color: '#60A5FA' },

  // ── Search ──
  searchWrap:     { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, gap: 8, marginBottom: spacing.sm },
  searchInput:    { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.white, padding: 0 },
  searchClear:    { padding: 2 },
  searchClearText:{ fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted },

  // ── Category tabs — icon LEFT of text so row is compact ──
  catTabs:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4 },
  // 4 tabs — compact row with icon left of text
  catTab:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 7, gap: 4, position: 'relative' },
  catTabActive: {},
  catLabel:     { fontFamily: fonts.bold, fontSize: 10, color: colors.textMuted, letterSpacing: 0.2 },
  catLabelActive:{ color: colors.gold },
  catUnderline: { position: 'absolute', bottom: -1, left: 8, right: 8, height: 2, backgroundColor: colors.gold, borderRadius: 1 },

  // ── Summary ──
  summaryScroll:  { marginBottom: spacing.sm },
  summaryContent: { gap: 10, paddingRight: spacing.md, paddingVertical: 4 },

  // ── Rows ──
  countRow:     { marginBottom: 6 },
  countText:    { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  row:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', gap: 10 },
  rowFirst:     { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  rankWrap:     { width: 32, alignItems: 'center' },
  rankWrapTop:  { width: 44 },
  rank:         { fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  rowMid:       { flex: 1, gap: 3 },
  rowName:      { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  rowTeamBadges:{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  rowTeamBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  rowTeamText:  { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.3 },
  rowStats:     { flexDirection: 'row', gap: 10, alignItems: 'center' },
  rowChevron:   { fontFamily: fonts.body, fontSize: 18, color: colors.textMuted, marginLeft: 2 },

  miniStat:           { alignItems: 'center', minWidth: 34 },
  miniStatValue:      { fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted },
  miniStatValuePrimary:{ color: colors.white },
  miniStatLabel:      { fontFamily: fonts.body, fontSize: 9, color: colors.textMuted, letterSpacing: 0.3, marginTop: 1 },

  // ── Loading / empty ──
  loadingWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
  loadingText:  { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  emptyWrap:    { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle:   { fontFamily: fonts.bold, fontSize: 14, color: colors.white, letterSpacing: 1.5 },
  emptyText:    { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 30 },

  showMoreBtn:  { alignItems: 'center', paddingVertical: 14 },
  showMoreText: { fontFamily: fonts.bold, fontSize: 13, color: colors.gold, letterSpacing: 0.5 },
})

const summary = StyleSheet.create({
  card:    { width: 110, backgroundColor: colors.navyLight, borderTopWidth: 3, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  value:   { fontFamily: fonts.display, fontSize: 26, letterSpacing: 1 },
  unit:    { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  label:   { fontFamily: fonts.bold, fontSize: 9, color: colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' },
  name:    { fontFamily: fonts.bold, fontSize: 11, color: colors.white },
})

const modal = StyleSheet.create({
  container:    { flex: 1, justifyContent: 'flex-end' },
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:        { backgroundColor: '#162236', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: 'rgba(245,197,24,0.2)', maxHeight: '85%', overflow: 'hidden' },
  handleWrap:   { height: 44, alignItems: 'center', justifyContent: 'center', paddingTop: 12 },
  handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  closeBtn:     { position: 'absolute', right: 16, top: 6, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontFamily: fonts.bold, fontSize: 13, color: '#EF4444' },
  scrollContent:{ paddingHorizontal: spacing.lg, paddingBottom: 40 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: spacing.sm, marginBottom: spacing.lg },
  playerName:   { fontFamily: fonts.display, fontSize: 26, letterSpacing: 1, color: colors.white, marginBottom: 6 },
  teamBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  teamDot:      { width: 6, height: 6, borderRadius: 3 },
  teamLabel:    { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.3 },
  potmBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245,197,24,0.1)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.3)', borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6 },
  potmBadgeText:{ fontFamily: fonts.bold, fontSize: 12, color: colors.gold },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.textMuted, marginTop: 16, marginBottom: 8 },
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox:      { flex: 1, minWidth: 70, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 10, alignItems: 'center' },
  statBoxHighlight: {
    backgroundColor: 'rgba(245,197,24,0.08)',
    borderColor: 'rgba(245,197,24,0.35)',
    // Subtle gold glow — modern without being heavy
    shadowColor:   '#F5C518',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius:  7,
    elevation:     4,
  },
  statValue:    { fontFamily: fonts.display, fontSize: 22, color: colors.white, letterSpacing: 1 },
  statValueHighlight: { color: '#F5C518' },
  statLabel:    { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, letterSpacing: 0.5, marginTop: 2 },
})
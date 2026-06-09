// pavilion-app/src/screens/member/StatsScreen.jsx
// Season stats from match_batting, match_bowling, match_potm
// Filters: Team (All/1st–Sunday) + Competition (All/MCCL/Cup/Friendly/CVSL)
// Tabs: Batting | Bowling | Fielding | Awards
// Tap player row → full stats modal

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Pressable,
  StyleSheet, FlatList, Modal, Animated, ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView }  from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { supabase }      from '../../lib/supabase'
import TopHeader         from '../../components/layout/TopHeader'
import AppIcon           from '../../components/AppIcon'
import icons             from '../../lib/icons'
import { colors, fonts, spacing, radius } from '../../theme'
import { teamColor, shortTeam, toTitleCase } from '../../lib/constants'
import { calcPlayerPoints } from '../../lib/fantasyPoints'

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

  // POTM awards and total points never include friendly fixtures.
  // Applies regardless of what compFilter is set to — even if user selects
  // "Friendly" filter, POTM count and points from those games are always excluded.
  const passesFilterCompetitive = (row) => {
    if ((row.fixtures?.match_type || '') === 'friendly') return false
    return passesFilter(row)
  }

  const map = {}

  // ── Batting ─────────────────────────────────────────────────────────────────
  batData.filter(passesFilter).forEach(row => {
    const pid = row.player_id
    if (!map[pid]) {
      map[pid] = {
        player_id: pid,
        player_name: toTitleCase(row.profiles?.full_name) || 'Unknown',
        teams: new Set(),
        // batting totals
        bat_innings: 0, bat_runs: 0, bat_balls: 0,
        bat_fours: 0, bat_sixes: 0, bat_not_outs: 0,
        bat_highest: 0, bat_highest_no: false,
        bat_fifties: 0, bat_hundreds: 0,
      }
    }
    const p     = map[pid]
    const tName = row.fixtures?.teams?.name
    if (tName) p.teams.add(tName)

    const runs  = row.runs  || 0
    const balls = row.balls || 0

    // Innings only counts if the player actually batted:
    // faced ≥1 ball, OR was run out without facing a ball
    const didBat = balls > 0 || !!row.run_out
    if (didBat) {
      p.bat_innings++
      if (row.not_out) p.bat_not_outs++
    }

    p.bat_runs  += runs
    p.bat_balls += balls
    p.bat_fours += row.fours || 0
    p.bat_sixes += row.sixes || 0

    if (runs > p.bat_highest || (runs === p.bat_highest && row.not_out && didBat)) {
      p.bat_highest    = runs
      p.bat_highest_no = !!row.not_out
    }
    if (runs >= 100) p.bat_hundreds++
    else if (runs >= 50) p.bat_fifties++
  })

  // ── Bowling ─────────────────────────────────────────────────────────────────
  // IMPORTANT: overs stored as cricket notation "X.Y" where Y is extra balls (0-5),
  // NOT a decimal. 3.4 = 3 overs + 4 balls = 22 balls total.
  // We must convert to integer balls before summing — direct float addition breaks:
  //   3.4 + 0.4 = 3.8 (JS), but cricket: 4+4=8 balls = 1 extra over → should be 4.2
  function oversToBalls(oversVal) {
    const v         = parseFloat(oversVal || 0)
    const fullOvers = Math.floor(v)
    const extraBalls = Math.round((v - fullOvers) * 10)
    return fullOvers * 6 + extraBalls
  }

  bowlData.filter(passesFilter).forEach(row => {
    const pid = row.player_id
    if (!map[pid]) {
      map[pid] = {
        player_id: pid,
        player_name: toTitleCase(row.profiles?.full_name) || 'Unknown',
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

    if (p.bowl_balls === undefined) {
      p.bowl_innings      = 0
      p.bowl_balls        = 0  // total balls bowled — correct accumulator for cricket overs
      p.bowl_maidens      = 0
      p.bowl_runs         = 0
      p.bowl_wickets      = 0
      p.bowl_best_wickets = 0
      p.bowl_best_runs    = 999
      p.bowl_five_fors    = 0
      p.bowl_four_fors    = 0
    }

    const balls = oversToBalls(row.overs)
    if (balls > 0) p.bowl_innings++  // innings only if actually bowled
    p.bowl_balls   += balls
    p.bowl_maidens += row.maidens || 0
    p.bowl_runs    += row.runs    || 0
    p.bowl_wickets += row.wickets || 0

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
  potmData.filter(passesFilterCompetitive).forEach(row => {
    const pid = row.player_id
    if (!map[pid]) return  // skip POTM for players with no batting row (edge case)
    const p = map[pid]
    const mdPts = parseFloat(row.points || 0)
    p.potm_count    = (p.potm_count  || 0) + 1
    p.potm_points   = (p.potm_points || 0) + mdPts
    p.potm_best_md  = Math.max(p.potm_best_md || 0, mdPts)
  })

  // ── Total points — sum calcPlayerPoints across ALL matches (not just POTM) ──
  // Build fixture-keyed lookups for bowl + field so we can cross-join with batting.
  const bowlByKey  = {}
  const fieldByKey = {}
  bowlData.filter(passesFilterCompetitive).forEach(r => {
    bowlByKey[`${r.fixture_id}:${r.player_id}`] = r
  })
  fieldData.filter(passesFilterCompetitive).forEach(r => {
    fieldByKey[`${r.fixture_id}:${r.player_id}`] = r
  })
  // Accumulate per player across every batting row (covers all played matches)
  batData.filter(passesFilterCompetitive).forEach(row => {
    const pid = row.player_id
    if (!map[pid]) return
    const key   = `${row.fixture_id}:${pid}`
    const bowl  = bowlByKey[key]  || null
    const field = fieldByKey[key] || null
    const pts   = calcPlayerPoints(row, bowl, field).total
    map[pid].total_points = (map[pid].total_points || 0) + pts
  })
  // Also credit bowling-only contributions (players who bowled but weren't in batting)
  bowlData.filter(passesFilterCompetitive).forEach(row => {
    const pid = row.player_id
    if (!map[pid]) return
    const key   = `${row.fixture_id}:${pid}`
    if (batData.find(b => b.fixture_id === row.fixture_id && b.player_id === pid)) return // already counted
    const field = fieldByKey[key] || null
    const pts   = calcPlayerPoints(null, row, field).total
    map[pid].total_points = (map[pid].total_points || 0) + pts
  })

  // ── Derive calculated fields ─────────────────────────────────────────────────
  return Object.values(map).map(p => {
    const xiRank = (name = '') => {
      if (name.includes('1st')) return 0
      if (name.includes('2nd')) return 1
      if (name.includes('3rd')) return 2
      if (name.includes('4th')) return 3
      return 4
    }
    p.teams          = Array.from(p.teams).sort((a, b) => xiRank(a) - xiRank(b))
    p.htcc_team_name = p.teams[0] || ''

    // Batting derived
    const dismissals  = p.bat_innings - p.bat_not_outs
    p.bat_average     = dismissals > 0   ? p.bat_runs / dismissals   : null
    p.bat_strike_rate = p.bat_balls > 0  ? (p.bat_runs / p.bat_balls) * 100 : null

    // Bowling derived — all based on bowl_balls (integer) accumulated above
    if (p.bowl_balls !== undefined) {
      const tb = p.bowl_balls  // total balls (integer — correct cricket accumulator)
      // Display overs as "X.Y" cricket notation (e.g. 82 balls → 13.4)
      p.bowl_overs       = tb > 0 ? Math.floor(tb / 6) + (tb % 6) / 10 : 0
      // Average: runs conceded per wicket
      p.bowl_average     = p.bowl_wickets > 0 ? p.bowl_runs / p.bowl_wickets : null
      // Economy: runs per over — divide by actual overs (tb/6), not display notation
      p.bowl_economy     = tb > 0 ? p.bowl_runs / (tb / 6) : null
      // Strike rate: balls per wicket
      p.bowl_strike_rate = p.bowl_wickets > 0 ? tb / p.bowl_wickets : null
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

            {/* Awards — always show if player has any match data */}
            {((player.bat_innings > 0) || (player.bowl_balls > 0)) && (
              <>
                <Text style={modal.sectionTitle}>AWARDS</Text>
                <View style={modal.statsGrid}>
                  <StatBox label="POTM"       value={fmt(player.potm_count || 0, 0)}  highlight />
                  <StatBox label="Total Pts"  value={fmt(player.total_points || 0, 0)} highlight />
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

  const [category,        setCategory]        = useState('batting')
  const [teamFilter,      setTeamFilter]      = useState(null)
  const [compFilter,      setCompFilter]      = useState(null)
  const [search,          setSearch]          = useState('')
  const [showMore,        setShowMore]        = useState(false)
  const [modalState,      setModalState]      = useState({ visible: false, player: null })
  const [filterModalOpen, setFilterModalOpen] = useState(false)

  const activeFilterCount = [teamFilter !== null, compFilter !== null].filter(Boolean).length
  const hasFilters = teamFilter !== null || compFilter !== null

  // Raw data from Supabase — fetched once, filtered client-side
  const [batRaw,   setBatRaw]   = useState([])
  const [bowlRaw,  setBowlRaw]  = useState([])
  const [fieldRaw, setFieldRaw] = useState([])
  const [potmRaw,  setPotmRaw]  = useState([])
  const [loading, setLoading] = useState(true)

  // ── Fetch all raw data once on mount ────────────────────────────────────────
  useFocusEffect(useCallback(() => { fetchAll() }, []))

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
    // Awards — primary: POTM count desc, secondary: total_points desc (tiebreak)
    return agg.filter(p => p.potm_count > 0)
              .sort((a, b) =>
                (b.potm_count || 0) - (a.potm_count || 0) ||
                (b.total_points || 0) - (a.total_points || 0)
              )
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
      return (
        <View style={[styles.summaryScroll, styles.summaryContent]}>
          <SummaryCard label="Most Runs" name={topRuns?.player_name} value={fmt(topRuns?.bat_runs, 0)}    unit="runs" color={colors.gold}    />
          <SummaryCard label="Best Avg"  name={topAvg?.player_name}  value={fmt(topAvg?.bat_average)}     unit="avg"  color={colors.green}   />
          <SummaryCard label="Highest"   name={topHS?.player_name}   value={topHS?.bat_highest > 0 ? `${topHS.bat_highest}${topHS.bat_highest_no ? '*':''}` : '—'} unit="hs" color="#60A5FA" />
        </View>
      )
    }
    if (category === 'bowling') {
      const topWkts = stats[0]
      const topEco  = [...stats].filter(p => (p.bowl_overs||0) >= 4)
                        .sort((a,b) => (a.bowl_economy||99) - (b.bowl_economy||99))[0]
      const topBB   = [...stats].sort((a,b) => (b.bowl_best_wickets||0) - (a.bowl_best_wickets||0))[0]
      return (
        <View style={[styles.summaryScroll, styles.summaryContent]}>
          <SummaryCard label="Most Wkts" name={topWkts?.player_name} value={fmt(topWkts?.bowl_wickets, 0)}  unit="wkts" color={colors.gold}   />
          <SummaryCard label="Best Eco"  name={topEco?.player_name}  value={fmt(topEco?.bowl_economy)}      unit="eco"  color={colors.green}  />
          <SummaryCard label="Best Fig"  name={topBB?.player_name}   value={topBB?.bowl_best_figures || '—'} unit="bb"  color="#60A5FA"       />
        </View>
      )
    }
    if (category === 'fielding') {
      const topTotal = stats[0]
      const topCatch = [...stats].sort((a,b) => (b.field_catches||0) - (a.field_catches||0))[0]
      const topSt    = [...stats].sort((a,b) => (b.field_stumpings||0) - (a.field_stumpings||0))[0]
      return (
        <View style={[styles.summaryScroll, styles.summaryContent]}>
          <SummaryCard label="Most Ovr." name={topTotal?.player_name} value={fmt((topTotal?.field_catches||0)+(topTotal?.field_stumpings||0), 0)} unit="total" color={colors.gold} />
          <SummaryCard label="Most Cts"  name={topCatch?.player_name} value={fmt(topCatch?.field_catches||0, 0)}    unit="catches"   color={colors.green} />
          <SummaryCard label="Stumpings" name={topSt?.player_name}    value={fmt(topSt?.field_stumpings||0, 0)}    unit="stumpings" color="#60A5FA"       />
        </View>
      )
    }
    if (category === 'awards') {
      const topPotm   = stats[0]
      const topOvr    = [...stats].sort((a,b) => (b.total_points||0)  - (a.total_points||0))[0]
      const topBestMd = [...stats].sort((a,b) => (b.potm_best_md||0) - (a.potm_best_md||0))[0]
      return (
        <View style={[styles.summaryScroll, styles.summaryContent]}>
          <SummaryCard label="Most POTM"    name={topPotm?.player_name}   value={fmt(topPotm?.potm_count, 0)}    unit="awards" color={colors.gold}   />
          <SummaryCard label="Most Ovr Pts" name={topOvr?.player_name}    value={fmt(topOvr?.total_points, 0)}   unit="pts"    color={colors.green}  />
          <SummaryCard label="Best M-D Pts" name={topBestMd?.player_name} value={fmt(topBestMd?.potm_best_md, 0)} unit="pts"   color="#60A5FA"        />
        </View>
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
          <MiniStat label="Pts"  value={fmt(item.total_points, 0)}         />
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

        {/* ── Search bar + Filter button ── */}
        <View style={styles.searchRow}>
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
          <TouchableOpacity
            onPress={() => setFilterModalOpen(true)}
            activeOpacity={0.8}
            style={[styles.filtersBtn, activeFilterCount > 0 && styles.filtersBtnActive]}
          >
            <AppIcon name="filter" size={13} tint={activeFilterCount > 0 ? colors.gold : colors.textMuted} />
            <Text style={[styles.filtersBtnText, activeFilterCount > 0 && styles.filtersBtnTextActive]}>
              {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Filter Modal ── */}
        <Modal
          visible={filterModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setFilterModalOpen(false)}
        >
          <Pressable style={styles.fModalBackdrop} onPress={() => setFilterModalOpen(false)}>
            <Pressable style={styles.fModalSheet} onPress={() => {}}>
              <View style={styles.fModalHandle} />
              <View style={styles.fModalHeader}>
                <Text style={styles.fModalTitle}>FILTERS</Text>
                {hasFilters && (
                  <TouchableOpacity
                    onPress={() => { setTeamFilter(null); setCompFilter(null) }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.fModalClear}>Clear all</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.fModalColumns}>
                {/* Team column */}
                <View style={styles.fModalColumn}>
                  <Text style={styles.fModalColTitle}>TEAM</Text>
                  {TEAM_FILTERS.map(tf => (
                    <TouchableOpacity
                      key={tf.label}
                      onPress={() => setTeamFilter(tf.value)}
                      style={[styles.fModalOption, teamFilter === tf.value && styles.fModalOptionActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.fModalOptionText, teamFilter === tf.value && styles.fModalOptionTextActive]}>
                        {tf.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Competition column */}
                <View style={styles.fModalColumn}>
                  <Text style={styles.fModalColTitle}>COMPETITION</Text>
                  {COMP_FILTERS.map(cf => (
                    <TouchableOpacity
                      key={cf.label}
                      onPress={() => setCompFilter(cf.value)}
                      style={[styles.fModalOption, compFilter === cf.value && styles.fModalOptionActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.fModalOptionText, compFilter === cf.value && styles.fModalOptionTextActive]}>
                        {cf.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setFilterModalOpen(false)}
                style={styles.fModalApply}
                activeOpacity={0.85}
              >
                <Text style={styles.fModalApplyText}>Apply Filters</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

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

  // ── Search + Filter row ──
  searchRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  searchWrap:     { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  searchInput:    { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.white, padding: 0 },
  searchClear:    { padding: 2 },
  searchClearText:{ fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted },
  filtersBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9 },
  filtersBtnActive:     { backgroundColor: 'rgba(245,197,24,0.08)', borderColor: 'rgba(245,197,24,0.4)' },
  filtersBtnText:       { fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted },
  filtersBtnTextActive: { color: colors.gold },

  // ── Filter modal ──
  fModalBackdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  fModalSheet:       { backgroundColor: '#162236', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingBottom: 40 },
  fModalHandle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: 12, marginBottom: 18 },
  fModalHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  fModalTitle:       { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1, color: colors.white },
  fModalClear:       { fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted },
  fModalColumns:     { flexDirection: 'row', gap: 10, marginBottom: 20 },
  fModalColumn:      { flex: 1, gap: 6 },
  fModalColTitle:    { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.5, color: colors.textMuted, marginBottom: 4 },
  fModalOption:      { paddingVertical: 9, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)' },
  fModalOptionActive:{ backgroundColor: 'rgba(245,197,24,0.1)', borderColor: 'rgba(245,197,24,0.4)' },
  fModalOptionText:  { fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted, letterSpacing: 0.3 },
  fModalOptionTextActive: { color: colors.gold },
  fModalApply:       { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  fModalApplyText:   { fontFamily: fonts.bold, fontSize: 14, color: colors.navy },

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
  summaryContent: { flexDirection: 'row', justifyContent: 'center', alignItems: 'stretch', gap: 10, paddingVertical: 4 },

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
  card:    { flex: 1, backgroundColor: colors.navyLight, borderTopWidth: 3, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 12, gap: 2 },
  value:   { fontFamily: fonts.display, fontSize: 28, letterSpacing: 0.5 },
  unit:    { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 7 },
  label:   { fontFamily: fonts.bold, fontSize: 9, color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  name:    { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
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
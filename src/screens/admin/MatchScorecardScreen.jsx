// pavilion-app/src/screens/admin/MatchScorecardScreen.jsx
// In-app match scorecard — result, batting, bowling, fielding → instant POTM
// Accessible from AdminMatchdayScreen and CaptainFixturesScreen (admin/captain only)

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, Animated, Easing,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { format, parseISO }  from 'date-fns'
import { supabase }          from '../../lib/supabase'
import { toTitleCase }       from '../../lib/constants'
import useAuthStore          from '../../store/authStore'
import AppIcon               from '../../components/AppIcon'
import { colors, fonts, spacing, radius } from '../../theme'
import { sendPushToUsers, insertNotifications } from '../../lib/pushNotifications'

// ─── CONFIGURABLE: POTM points system ─────────────────────────────────────────
// Adjust these values to rebalance scoring. All calculations use these constants.
const POTM = {
  // ── Batting ────────────────────────────────────────────────────────────────
  RUN:             1,   // per run scored
  FOUR_BONUS:      2,   // per four boundary (stacks with RUN)
  SIX_BONUS:       4,   // per six boundary (stacks with RUN)
  NOT_OUT:         5,   // not out bonus — only applied if runs >= NOT_OUT_MIN
  NOT_OUT_MIN:    30,   // minimum runs to qualify for not out bonus
  MILESTONE_25:   10,   // 25+ runs bonus
  MILESTONE_50:   20,   // 50+ runs bonus (stacks on MILESTONE_25)
  MILESTONE_100:  40,   // 100+ runs bonus (stacks on MILESTONE_50)
  DUCK_PEN:       -5,   // dismissed for 0 (not not-out) — duck penalty
  RUN_OUT_PEN:    -8,   // additional penalty if dismissed by run out
  // ── Bowling ────────────────────────────────────────────────────────────────
  WICKET:         25,   // per wicket taken
  MAIDEN:          5,   // per maiden over
  THREE_WKT:      10,   // 3+ wickets bonus
  FIVE_WKT:       25,   // 5+ wickets bonus (stacks on THREE_WKT)
  WIDE_PEN:       -1,   // per wide (penalty)
  NB_PEN:         -2,   // per no-ball (penalty)
  // Economy rate penalties — flat total, applied only if overs > 0
  // Set any value to 0 to disable that tier
  ECO_PEN_7:      -2,   // economy 7.00–7.99
  ECO_PEN_8:      -3,   // economy 8.00–8.99
  ECO_PEN_9:      -5,   // economy 9.00–9.99
  ECO_PEN_10:     -8,   // economy ≥ 10.00
  // ── Fielding ───────────────────────────────────────────────────────────────
  CATCH:          10,   // per catch
  STUMPING:       10,   // per stumping — equalised with catch
}

// Exceptional performance thresholds — triggers gold glow on player row
const EXCEPTIONAL = {
  BAT_RUNS:      50,  // batting: 50+ runs → gold glow
  BOWL_WICKETS:  3,   // bowling: 3+ wickets → gold glow
  FIELD_CATCHES: 2,   // fielding: 2+ catches → blue glow
}
// ──────────────────────────────────────────────────────────────────────────────

const TABS = ['Result', 'Batting', 'Bowling', 'Fielding']

// ─── Helpers ──────────────────────────────────────────────────────────────────
const int  = (v) => parseInt(v, 10) || 0
const dec  = (v) => parseFloat(v)   || 0

function calcSR(runs, balls) {
  if (!int(balls)) return '—'
  return ((int(runs) / int(balls)) * 100).toFixed(1)
}

function calcEco(runs, overs) {
  const ov = dec(overs)
  if (!ov) return '—'
  const ovActual = (Math.floor(ov) * 6 + Math.round((ov - Math.floor(ov)) * 10)) / 6
  return (int(runs) / ovActual).toFixed(2)
}

// ─── POTM reveal card (animated modal) ────────────────────────────────────────
function POTMCard({ player, points, onDismiss }) {
  const overlayOp = useRef(new Animated.Value(0)).current
  const cardScale = useRef(new Animated.Value(0.6)).current
  const cardOp    = useRef(new Animated.Value(0)).current
  const glowOp    = useRef(new Animated.Value(0.3)).current
  const glowLoop  = useRef(null)

  useEffect(() => {
    // Phase 1: overlay fades in
    Animated.timing(overlayOp, { toValue: 1, duration: 300, useNativeDriver: true }).start()

    // Phase 2: card springs up
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(cardScale, { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }),
        Animated.timing(cardOp,    { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start()
    }, 250)

    // Phase 3: gold glow pulses continuously
    setTimeout(() => {
      glowLoop.current = Animated.loop(Animated.sequence([
        Animated.timing(glowOp, { toValue: 1,   duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowOp, { toValue: 0.3, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]))
      glowLoop.current.start()
    }, 500)

    return () => glowLoop.current?.stop()
  }, [])

  const initials = player.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'

  return (
    <Modal transparent animationType="none" visible statusBarTranslucent>
      <Animated.View style={[s.potmOverlay, { opacity: overlayOp }]}>
        <Animated.View style={[s.potmCard, { opacity: cardOp, transform: [{ scale: cardScale }] }]}>

          {/* Pulsing gold ring around card */}
          <Animated.View style={[s.potmGlowRing, { opacity: glowOp }]} />

          {/* Gold header bar */}
          <View style={s.potmHeader}>
            <Text style={s.potmHeaderText}>PLAYER OF THE MATCH</Text>
          </View>

          {/* Player avatar initials */}
          <View style={s.potmAvatar}>
            <Text style={s.potmInitials}>{initials}</Text>
          </View>

          {/* Player name */}
          <Text style={s.potmName}>{player.full_name?.toUpperCase()}</Text>

          {/* Points */}
          <View style={s.potmPtsRow}>
            <Text style={s.potmPts}>{Math.round(points)}</Text>
            <Text style={s.potmPtsLabel}> PTS</Text>
          </View>

          {/* Divider */}
          <View style={s.potmDivider} />

          {/* Dismiss */}
          <TouchableOpacity style={s.potmBtn} onPress={onDismiss} activeOpacity={0.8}>
            <Text style={s.potmBtnText}>CONTINUE</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

// ─── Number input cell ─────────────────────────────────────────────────────────
function NumCell({ value, onChange, decimal = false, width = 44 }) {
  return (
    <TextInput
      style={[s.numCell, { width }]}
      value={value}
      onChangeText={onChange}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      placeholder="0"
      placeholderTextColor="rgba(255,255,255,0.2)"
      maxLength={decimal ? 4 : 3}
      selectTextOnFocus
    />
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function MatchScorecardScreen({ route, navigation }) {
  const { fixtureId } = route.params
  const profile  = useAuthStore(s => s.profile)
  const insets   = useSafeAreaInsets()

  // ── Data ────────────────────────────────────────────────────────────────────
  const [fixture,     setFixture]     = useState(null)
  const [squad,       setSquad]       = useState([])   // [{ player_id, full_name, position_order }]
  const [loading,     setLoading]     = useState(true)

  // ── Active tab ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(0)

  // ── Form state ───────────────────────────────────────────────────────────────
  const [winner,          setWinner]          = useState(null)   // 'htcc' | 'opponent' | 'draw' | 'no_result'
  const [playcricketUrl,  setPlaycricketUrl]  = useState('')     // optional PlayCricket scorecard URL
  const [batting,  setBatting]  = useState({})     // { [player_id]: { runs, balls, fours, sixes, not_out, run_out } }
  const [bowling,  setBowling]  = useState({})     // { [player_id]: { overs, maidens, runs, wickets, no_balls, wides } }
  const [fielding, setFielding] = useState({})     // { [player_id]: { catches, stumpings } }

  // ── Submission ───────────────────────────────────────────────────────────────
  const [submitting,   setSubmitting]   = useState(false)
  const [savingDraft,  setSavingDraft]  = useState(false)
  const [showPOTM,     setShowPOTM]     = useState(false)
  const [potmData,     setPotmData]     = useState(null)

  // ── Fetch fixture + published squad ─────────────────────────────────────────
  useEffect(() => {
    fetchData()
  }, [fixtureId])

  const fetchData = async () => {
    try {
      // Fetch fixture details
      const { data: fix } = await supabase
        .from('fixtures')
        .select('*, teams(id, name)')
        .eq('id', fixtureId)
        .single()
      setFixture(fix)

      // Get published squad for this fixture
      const { data: squadRow } = await supabase
        .from('squads')
        .select('id')
        .eq('fixture_id', fixtureId)
        .eq('published', true)
        .maybeSingle()

      if (!squadRow) {
        Alert.alert('No Published Squad', 'Publish the squad before submitting the scorecard.')
        navigation.goBack()
        return
      }

      // Get squad members ordered by batting position
      const { data: members } = await supabase
        .from('squad_members')
        .select('position_order, is_captain, is_wicketkeeper, profiles!player_id(id, full_name)')
        .eq('squad_id', squadRow.id)
        .order('position_order', { ascending: true })

      const formatted = (members || []).map(m => ({
        player_id:      m.profiles.id,
        full_name:      toTitleCase(m.profiles.full_name),
        position_order: m.position_order,
        is_captain:     m.is_captain,
        is_wk:          m.is_wicketkeeper,
      }))
      setSquad(formatted)

      // Pre-fill any existing scorecard data (re-submission case)
      await prefillExisting(fixtureId, formatted)
    } catch (err) {
      console.error('[Scorecard] fetchData error:', err.message)
    } finally {
      setLoading(false)
    }
  }

  const prefillExisting = async (fid, squadList) => {
    // Result
    const { data: res } = await supabase
      .from('match_results').select('winner, playcricket_url').eq('fixture_id', fid).maybeSingle()
    if (res) {
      setWinner(res.winner)
      if (res.playcricket_url) setPlaycricketUrl(res.playcricket_url)
    }

    // Batting
    const { data: bat } = await supabase
      .from('match_batting').select('*').eq('fixture_id', fid)
    if (bat?.length) {
      const map = {}
      bat.forEach(r => {
        map[r.player_id] = {
          runs: String(r.runs), balls: String(r.balls),
          fours: String(r.fours), sixes: String(r.sixes),
          not_out: r.not_out,
          run_out: r.run_out || false,
        }
      })
      setBatting(map)
    }

    // Bowling
    const { data: bowl } = await supabase
      .from('match_bowling').select('*').eq('fixture_id', fid)
    if (bowl?.length) {
      const map = {}
      bowl.forEach(r => {
        map[r.player_id] = {
          overs: String(r.overs), maidens: String(r.maidens),
          runs: String(r.runs), wickets: String(r.wickets),
          no_balls: String(r.no_balls), wides: String(r.wides),
        }
      })
      setBowling(map)
    }

    // Fielding
    const { data: field } = await supabase
      .from('match_fielding').select('*').eq('fixture_id', fid)
    if (field?.length) {
      const map = {}
      field.forEach(r => {
        map[r.player_id] = {
          catches: String(r.catches), stumpings: String(r.stumpings),
        }
      })
      setFielding(map)
    }
  }

  // ── State update helpers ─────────────────────────────────────────────────────
  const updateBat  = useCallback((pid, field, val) => {
    setBatting(p => ({ ...p, [pid]: { ...p[pid], [field]: val } }))
  }, [])

  const updateBowl = useCallback((pid, field, val) => {
    setBowling(p => ({ ...p, [pid]: { ...p[pid], [field]: val } }))
  }, [])

  const updateField = useCallback((pid, field, val) => {
    setFielding(p => ({ ...p, [pid]: { ...p[pid], [field]: val } }))
  }, [])

  const toggleNotOut = useCallback((pid) => {
    setBatting(p => ({
      ...p,
      [pid]: { ...p[pid], not_out: !p[pid]?.not_out, run_out: false }  // can't be run out AND not out
    }))
  }, [])

  const toggleRunOut = useCallback((pid) => {
    setBatting(p => ({
      ...p,
      [pid]: { ...p[pid], run_out: !p[pid]?.run_out, not_out: false }  // run out = dismissed
    }))
  }, [])

  // ── POTM calculation ─────────────────────────────────────────────────────────
  const calculatePOTM = useCallback(() => {
    let topPlayer = null
    let topPoints = -Infinity

    squad.forEach(player => {
      const pid = player.player_id
      let pts = 0

      // Batting
      const bat   = batting[pid]  || {}
      const runs  = int(bat.runs)
      const fours = int(bat.fours)
      const sixes = int(bat.sixes)
      pts += runs  * POTM.RUN
      pts += fours * POTM.FOUR_BONUS
      pts += sixes * POTM.SIX_BONUS
      if (bat.not_out && runs >= POTM.NOT_OUT_MIN) pts += POTM.NOT_OUT
      if (runs >= 100) pts += POTM.MILESTONE_100 + POTM.MILESTONE_50 + POTM.MILESTONE_25
      else if (runs >= 50) pts += POTM.MILESTONE_50 + POTM.MILESTONE_25
      else if (runs >= 25) pts += POTM.MILESTONE_25
      // Duck penalty — dismissed for 0
      if (runs === 0 && !bat.not_out && (int(bat.balls) > 0 || bat.run_out)) pts += POTM.DUCK_PEN
      // Run out penalty — additional deduction if dismissed by run out
      if (bat.run_out && !bat.not_out) pts += POTM.RUN_OUT_PEN

      // Bowling
      const bowl    = bowling[pid]  || {}
      const wickets = int(bowl.wickets)
      const maidens = int(bowl.maidens)
      pts += wickets * POTM.WICKET
      pts += maidens * POTM.MAIDEN
      pts += int(bowl.wides)    * POTM.WIDE_PEN
      pts += int(bowl.no_balls) * POTM.NB_PEN

      // Economy penalty — tiered flat deduction, only when overs bowled > 0
      const bowlOversRaw = dec(bowl.overs)
      if (bowlOversRaw > 0) {
        const bowlOversActual = (Math.floor(bowlOversRaw) * 6 + Math.round((bowlOversRaw - Math.floor(bowlOversRaw)) * 10)) / 6
        const eco = int(bowl.runs) / bowlOversActual
        if      (eco >= 10) pts += POTM.ECO_PEN_10
        else if (eco >= 9)  pts += POTM.ECO_PEN_9
        else if (eco >= 8)  pts += POTM.ECO_PEN_8
        else if (eco >= 7)  pts += POTM.ECO_PEN_7
      }

      if (wickets >= 5) pts += POTM.FIVE_WKT + POTM.THREE_WKT
      else if (wickets >= 3) pts += POTM.THREE_WKT

      // Fielding
      const field = fielding[pid] || {}
      pts += int(field.catches)   * POTM.CATCH
      pts += int(field.stumpings) * POTM.STUMPING

      if (pts > topPoints) {
        topPoints = pts
        topPlayer = player
      }
    })

    return { player: topPlayer, points: Math.max(0, topPoints) }
  }, [squad, batting, bowling, fielding])

  // ── Save Draft ───────────────────────────────────────────────────────────────
  // Persists batting / bowling / fielding without touching match_results or POTM.
  // No winner required. Safe to call mid-match (e.g. after bowling innings only).
  const handleSaveDraft = async () => {
    setSavingDraft(true)
    try {
      // Batting — upsert all squad members (zeros preserved intentionally)
      const batRows = squad.map(p => ({
        fixture_id: fixtureId,
        player_id:  p.player_id,
        position:   p.position_order,
        runs:     int(batting[p.player_id]?.runs),
        balls:    int(batting[p.player_id]?.balls),
        fours:    int(batting[p.player_id]?.fours),
        sixes:    int(batting[p.player_id]?.sixes),
        not_out:  batting[p.player_id]?.not_out || false,
        run_out:  batting[p.player_id]?.run_out || false,
      }))
      const { error: batErr } = await supabase
        .from('match_batting').upsert(batRows, { onConflict: 'fixture_id,player_id' })
      if (batErr) throw batErr

      // Bowling — only rows with actual data
      const bowlRows = squad
        .filter(p => dec(bowling[p.player_id]?.overs) > 0 || int(bowling[p.player_id]?.wickets) > 0)
        .map(p => ({
          fixture_id: fixtureId,
          player_id:  p.player_id,
          overs:    dec(bowling[p.player_id]?.overs),
          maidens:  int(bowling[p.player_id]?.maidens),
          runs:     int(bowling[p.player_id]?.runs),
          wickets:  int(bowling[p.player_id]?.wickets),
          no_balls: int(bowling[p.player_id]?.no_balls),
          wides:    int(bowling[p.player_id]?.wides),
        }))
      if (bowlRows.length > 0) {
        const { error: bowlErr } = await supabase
          .from('match_bowling').upsert(bowlRows, { onConflict: 'fixture_id,player_id' })
        if (bowlErr) throw bowlErr
      }

      // Fielding — only rows with catches or stumpings
      const fieldRows = squad
        .filter(p => int(fielding[p.player_id]?.catches) > 0 || int(fielding[p.player_id]?.stumpings) > 0)
        .map(p => ({
          fixture_id: fixtureId,
          player_id:  p.player_id,
          catches:   int(fielding[p.player_id]?.catches),
          stumpings: int(fielding[p.player_id]?.stumpings),
        }))
      if (fieldRows.length > 0) {
        const { error: fieldErr } = await supabase
          .from('match_fielding').upsert(fieldRows, { onConflict: 'fixture_id,player_id' })
        if (fieldErr) throw fieldErr
      }

      Alert.alert('Draft Saved', 'Progress saved. Come back any time to continue — no result or POTM calculated yet.')
    } catch (err) {
      console.error('[Scorecard] draft error:', err.message)
      Alert.alert('Save Failed', err.message)
    } finally {
      setSavingDraft(false)
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!winner) {
      Alert.alert('Result Required', 'Select match result before submitting.')
      return
    }

    setSubmitting(true)
    try {
      // 1. Match result
      const { error: resErr } = await supabase.from('match_results').upsert({
        fixture_id:      fixtureId,
        winner,
        playcricket_url: playcricketUrl.trim() || null,
        submitted_by:    profile.id,
        submitted_at:    new Date().toISOString(),
      }, { onConflict: 'fixture_id' })
      if (resErr) throw resErr

      // 2. Batting rows — upsert all squad members
      const batRows = squad.map(p => ({
        fixture_id: fixtureId,
        player_id:  p.player_id,
        position:   p.position_order,
        runs:        int(batting[p.player_id]?.runs),
        balls:       int(batting[p.player_id]?.balls),
        fours:       int(batting[p.player_id]?.fours),
        sixes:       int(batting[p.player_id]?.sixes),
        not_out:     batting[p.player_id]?.not_out  || false,
        run_out:     batting[p.player_id]?.run_out  || false,
      }))
      const { error: batErr } = await supabase.from('match_batting').upsert(batRows, { onConflict: 'fixture_id,player_id' })
      if (batErr) throw batErr

      // 3. Bowling rows — only players with overs or wickets entered
      const bowlRows = squad
        .filter(p => dec(bowling[p.player_id]?.overs) > 0 || int(bowling[p.player_id]?.wickets) > 0)
        .map(p => ({
          fixture_id: fixtureId,
          player_id:  p.player_id,
          overs:       dec(bowling[p.player_id]?.overs),
          maidens:     int(bowling[p.player_id]?.maidens),
          runs:        int(bowling[p.player_id]?.runs),
          wickets:     int(bowling[p.player_id]?.wickets),
          no_balls:    int(bowling[p.player_id]?.no_balls),
          wides:       int(bowling[p.player_id]?.wides),
        }))
      if (bowlRows.length > 0) {
        const { error: bowlErr } = await supabase.from('match_bowling').upsert(bowlRows, { onConflict: 'fixture_id,player_id' })
        if (bowlErr) throw bowlErr
      }

      // 4. Fielding rows — only players with catches or stumpings
      const fieldRows = squad
        .filter(p => int(fielding[p.player_id]?.catches) > 0 || int(fielding[p.player_id]?.stumpings) > 0)
        .map(p => ({
          fixture_id: fixtureId,
          player_id:  p.player_id,
          catches:    int(fielding[p.player_id]?.catches),
          stumpings:  int(fielding[p.player_id]?.stumpings),
        }))
      if (fieldRows.length > 0) {
        const { error: fieldErr } = await supabase.from('match_fielding').upsert(fieldRows, { onConflict: 'fixture_id,player_id' })
        if (fieldErr) throw fieldErr
      }

      // 5. Calculate and store POTM
      const { player: potmPlayer, points: potmPoints } = calculatePOTM()
      if (potmPlayer && potmPoints > 0) {
        const { error: potmErr } = await supabase.from('match_potm').upsert({
          fixture_id:    fixtureId,
          player_id:     potmPlayer.player_id,
          points:        potmPoints,
          calculated_at: new Date().toISOString(),
        }, { onConflict: 'fixture_id' })
        if (potmErr) throw potmErr

        // 6. Push notification to all squad members announcing POTM
        const squadPlayerIds = squad.map(p => p.player_id)
        const potmTitle = 'Player of the Match'
        const opponent  = fixture?.opponent || 'Opponent'
        const potmBody  = `${potmPlayer.full_name} is POTM vs ${opponent} with ${Math.round(potmPoints)} pts!`
        sendPushToUsers(squadPlayerIds, potmTitle, potmBody, { type: 'potm', fixture_id: fixtureId })
        insertNotifications(squadPlayerIds, 'potm', potmTitle, potmBody, { fixture_id: fixtureId })

        setPotmData({ ...potmPlayer, points: potmPoints })
        setShowPOTM(true)
      } else {
        Alert.alert('Submitted', 'Scorecard saved successfully.')
        navigation.goBack()
      }
    } catch (err) {
      console.error('[Scorecard] submit error:', err.message)
      Alert.alert('Submission Failed', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Sticky column header — rendered outside ScrollView so it never scrolls ──
  // paddingHorizontal: 20 = 12 (tabContent) + 8 (playerRow) → aligns with playerRow edges
  // stickyStatRow paddingLeft: 24 = playerRowInputs paddingLeft → cells align pixel-perfect
  const renderStickyHeader = () => {
    if (activeTab === 1) return (
      <View style={s.stickyHeaderOuter}>
        <Text style={s.stickyPlayerLabel}>#  PLAYER</Text>
        <View style={s.stickyStatRow}>
          <Text style={[s.thCell, { width: 44 }]}>R</Text>
          <Text style={[s.thCell, { width: 44 }]}>B</Text>
          <Text style={[s.thCell, { width: 36 }]}>4s</Text>
          <Text style={[s.thCell, { width: 36 }]}>6s</Text>
          <Text style={[s.thCell, { width: 46 }]}>SR</Text>
          <Text style={[s.thCell, { width: 38 }]}>NO</Text>
          <Text style={[s.thCell, { width: 38 }]}>RO</Text>
        </View>
      </View>
    )
    if (activeTab === 2) return (
      <View style={s.stickyHeaderOuter}>
        <Text style={s.stickyPlayerLabel}>#  PLAYER</Text>
        <View style={s.stickyStatRow}>
          <Text style={[s.thCell, { width: 42 }]}>Ov</Text>
          <Text style={[s.thCell, { width: 36 }]}>Md</Text>
          <Text style={[s.thCell, { width: 36 }]}>R</Text>
          <Text style={[s.thCell, { width: 36 }]}>W</Text>
          <Text style={[s.thCell, { width: 36 }]}>Wd</Text>
          <Text style={[s.thCell, { width: 36 }]}>NB</Text>
          <Text style={[s.thCell, { width: 46 }]}>Eco</Text>
        </View>
      </View>
    )
    if (activeTab === 3) return (
      <View style={s.stickyHeaderOuter}>
        <Text style={s.stickyPlayerLabel}>#  PLAYER</Text>
        <View style={s.stickyStatRow}>
          <Text style={[s.thCell, { width: 60 }]}>Ct</Text>
          <Text style={[s.thCell, { width: 60 }]}>St</Text>
        </View>
      </View>
    )
    return null
  }

  // ── Result tab ───────────────────────────────────────────────────────────────
  const renderResult = () => {
    const opts = [
      { key: 'htcc',      label: 'HTCC',       sub: 'We won', color: colors.green },
      { key: 'opponent',  label: fixture?.opponent?.toUpperCase() || 'OPPONENT', sub: 'They won', color: '#EF4444' },
      { key: 'draw',      label: 'DRAW',        sub: 'Tied', color: colors.gold },
      { key: 'no_result', label: 'NO RESULT',   sub: 'Abandoned', color: colors.textMuted },
    ]
    return (
      <View style={s.tabContent}>
        <Text style={s.tabSectionLabel}>MATCH RESULT</Text>
        {opts.map(opt => {
          const active = winner === opt.key
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                s.resultCard,
                active && { borderColor: opt.color, backgroundColor: `${opt.color}18` },
              ]}
              onPress={() => setWinner(opt.key)}
              activeOpacity={0.75}
            >
              <View style={[s.resultDot, { backgroundColor: active ? opt.color : 'transparent',
                borderColor: active ? opt.color : 'rgba(255,255,255,0.15)' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.resultLabel, active && { color: opt.color }]}>{opt.label}</Text>
                <Text style={s.resultSub}>{opt.sub}</Text>
              </View>
              {active && <AppIcon name="approve" size={16} tint={opt.color} />}
            </TouchableOpacity>
          )
        })}

        {/* ── PlayCricket scorecard URL ── */}
        <Text style={[s.tabSectionLabel, { marginTop: 24 }]}>PLAYCRICKET SCORECARD (OPTIONAL)</Text>
        <Text style={s.urlHint}>Paste full PlayCricket scorecard URL — members will see a link at the bottom of the scorecard.</Text>
        <TextInput
          style={s.urlInput}
          value={playcricketUrl}
          onChangeText={setPlaycricketUrl}
          onEndEditing={e => setPlaycricketUrl(e.nativeEvent.text)}
          placeholder="https://play-cricket.com/…"
          placeholderTextColor="rgba(139,155,180,0.4)"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
        />
      </View>
    )
  }

  // ── Batting tab ──────────────────────────────────────────────────────────────
  const renderBatting = () => (
    <View style={s.tabContent}>
      {squad.map((player, idx) => {
        const pid  = player.player_id
        const bat  = batting[pid] || {}
        const runs = int(bat.runs)
        const exceptional = runs >= EXCEPTIONAL.BAT_RUNS

        return (
          <View key={pid} style={[
            s.playerRow,
            exceptional && s.playerRowGold,
          ]}>
            {/* Position + name */}
            <View style={s.playerRowTop}>
              <Text style={s.playerPos}>{player.position_order}</Text>
              <Text style={s.playerName} numberOfLines={1}>
                {player.full_name}
                {player.is_captain ? ' (C)' : ''}
                {player.is_wk      ? ' (WK)' : ''}
              </Text>
              {exceptional && (
                <View style={s.goldBadge}>
                  <Text style={s.goldBadgeText}>★ {runs}</Text>
                </View>
              )}
            </View>

            {/* Input row */}
            <View style={s.playerRowInputs}>
              <NumCell value={bat.runs}   onChange={v => updateBat(pid, 'runs',  v)} width={44} />
              <NumCell value={bat.balls}  onChange={v => updateBat(pid, 'balls', v)} width={44} />
              <NumCell value={bat.fours}  onChange={v => updateBat(pid, 'fours', v)} width={36} />
              <NumCell value={bat.sixes}  onChange={v => updateBat(pid, 'sixes', v)} width={36} />
              {/* SR — auto calculated, read only */}
              <View style={[s.numCell, { width: 46, justifyContent: 'center' }]}>
                <Text style={s.calcText}>{calcSR(bat.runs, bat.balls)}</Text>
              </View>
              {/* NOT OUT toggle */}
              <TouchableOpacity
                style={[s.noToggle, bat.not_out && s.noToggleActive]}
                onPress={() => toggleNotOut(pid)}
                activeOpacity={0.7}
              >
                <Text style={[s.noToggleText, bat.not_out && s.noToggleTextActive]}>
                  {bat.not_out ? '✓' : 'NO'}
                </Text>
              </TouchableOpacity>
              {/* RUN OUT toggle — mutually exclusive with not out */}
              <TouchableOpacity
                style={[s.noToggle, bat.run_out && s.runOutToggleActive]}
                onPress={() => toggleRunOut(pid)}
                activeOpacity={0.7}
              >
                <Text style={[s.noToggleText, bat.run_out && s.runOutToggleTextActive]}>
                  RO
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      })}
    </View>
  )

  // ── Bowling tab ──────────────────────────────────────────────────────────────
  const renderBowling = () => {
    // Reverse order — lower batting order players listed first (typically the bowlers)
    const bowlingSquad = [...squad].reverse()

    return (
      <View style={s.tabContent}>
        {bowlingSquad.map(player => {
          const pid     = player.player_id
          const bowl    = bowling[pid] || {}
          const wickets = int(bowl.wickets)
          const exceptional = wickets >= EXCEPTIONAL.BOWL_WICKETS

          return (
            <View key={pid} style={[
              s.playerRow,
              exceptional && s.playerRowGold,
            ]}>
              {/* Position + name */}
              <View style={s.playerRowTop}>
                <Text style={s.playerPos}>{player.position_order}</Text>
                <Text style={s.playerName} numberOfLines={1}>
                  {player.full_name}
                  {player.is_captain ? ' (C)' : ''}
                  {player.is_wk      ? ' (WK)' : ''}
                </Text>
                {exceptional && (
                  <View style={s.goldBadge}>
                    <Text style={s.goldBadgeText}>★ {wickets}W</Text>
                  </View>
                )}
              </View>

              {/* Input row */}
              <View style={s.playerRowInputs}>
                {/* Overs uses decimal-pad */}
                <NumCell value={bowl.overs}    onChange={v => updateBowl(pid, 'overs',    v)} width={42} decimal />
                <NumCell value={bowl.maidens}  onChange={v => updateBowl(pid, 'maidens',  v)} width={36} />
                <NumCell value={bowl.runs}     onChange={v => updateBowl(pid, 'runs',     v)} width={36} />
                <NumCell value={bowl.wickets}  onChange={v => updateBowl(pid, 'wickets',  v)} width={36} />
                <NumCell value={bowl.wides}    onChange={v => updateBowl(pid, 'wides',    v)} width={36} />
                <NumCell value={bowl.no_balls} onChange={v => updateBowl(pid, 'no_balls', v)} width={36} />
                {/* Economy — auto calculated */}
                <View style={[s.numCell, { width: 46, justifyContent: 'center' }]}>
                  <Text style={s.calcText}>{calcEco(bowl.runs, bowl.overs)}</Text>
                </View>
              </View>
            </View>
          )
        })}
      </View>
    )
  }

  // ── Fielding tab ─────────────────────────────────────────────────────────────
  const renderFielding = () => (
    <View style={s.tabContent}>
      {squad.map(player => {
        const pid   = player.player_id
        const field = fielding[pid] || {}
        const ct    = int(field.catches)
        const st    = int(field.stumpings)
        const exceptional = ct >= EXCEPTIONAL.FIELD_CATCHES || st >= 1

        return (
          <View key={pid} style={[
            s.playerRow,
            exceptional && s.playerRowBlue,
          ]}>
            <View style={s.playerRowTop}>
              <Text style={s.playerPos}>{player.position_order}</Text>
              <Text style={[s.playerName, { flex: 1 }]} numberOfLines={1}>
                {player.full_name}
                {player.is_wk ? ' (WK)' : ''}
              </Text>
              {exceptional && (
                <View style={[s.goldBadge, s.blueBadge]}>
                  <Text style={[s.goldBadgeText, { color: '#60A5FA' }]}>
                    {ct > 0 ? `${ct}c` : ''}{st > 0 ? ` ${st}st` : ''}
                  </Text>
                </View>
              )}
            </View>

            <View style={s.playerRowInputs}>
              <NumCell value={field.catches}   onChange={v => updateField(pid, 'catches',   v)} width={60} />
              <NumCell value={field.stumpings} onChange={v => updateField(pid, 'stumpings', v)} width={60} />
            </View>
          </View>
        )
      })}
    </View>
  )

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    )
  }

  const tabContent = [renderResult, renderBatting, renderBowling, renderFielding]

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <AppIcon name="back" size={18} tint={colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.headerSub}>SUBMIT RESULT</Text>
          <Text style={s.headerTitle} numberOfLines={1}>
            HTCC <Text style={{ color: colors.gold }}>vs</Text> {fixture?.opponent?.toUpperCase()}
          </Text>
        </View>
        {fixture?.match_date && (
          <Text style={s.headerDate}>
            {format(parseISO(fixture.match_date), 'd MMM').toUpperCase()}
          </Text>
        )}
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map((tab, idx) => (
          <TouchableOpacity
            key={tab}
            style={[s.tabItem, activeTab === idx && s.tabItemActive]}
            onPress={() => setActiveTab(idx)}
            activeOpacity={0.7}
          >
            <Text style={[s.tabLabel, activeTab === idx && s.tabLabelActive]}>{tab}</Text>
            {/* Red dot if result not yet set and on result tab */}
            {idx === 0 && !winner && (
              <View style={s.tabDot} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Sticky column headers — outside ScrollView, never scrolls */}
      {activeTab > 0 && renderStickyHeader()}

      {/* Tab content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {tabContent[activeTab]?.()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer — Draft + Submit */}
      <View style={[s.submitBar, { paddingBottom: 16 + insets.bottom }]}>
        <View style={s.submitRow}>
          <TouchableOpacity
            style={[s.draftBtn, (savingDraft || submitting) && s.submitBtnDisabled]}
            onPress={handleSaveDraft}
            disabled={savingDraft || submitting}
            activeOpacity={0.8}
          >
            {savingDraft
              ? <ActivityIndicator color={colors.textMuted} size="small" />
              : <Text style={s.draftBtnText}>Save Draft</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.submitBtn, (submitting || savingDraft) && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting || savingDraft}
            activeOpacity={0.8}
          >
            {submitting
              ? <ActivityIndicator color={colors.navy} size="small" />
              : <Text style={s.submitBtnText}>Submit Scorecard</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* POTM reveal */}
      {showPOTM && potmData && (
        <POTMCard
          player={potmData}
          points={potmData.points}
          onDismiss={() => { setShowPOTM(false); navigation.goBack() }}
        />
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  loadingWrap: {
    flex: 1,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,197,24,0.1)',
  },
  backBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  headerSub: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.gold,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: 1,
    color: colors.white,
    lineHeight: 24,
  },
  headerDate: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
  },

  // ── Tab bar ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(22,34,54,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,197,24,0.12)',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
  },
  tabLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.gold,
  },
  tabDot: {
    position: 'absolute',
    top: 8, right: 14,
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },

  // ── Tab content ──
  tabContent: {
    paddingHorizontal: 12,
    paddingTop: 14,
  },
  tabSectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.textMuted,
    marginBottom: 14,
    marginLeft: 4,
  },

  // ── PlayCricket URL input ──
  urlHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 8,
    lineHeight: 16,
  },
  urlInput: {
    backgroundColor: 'rgba(22,34,54,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.white,
  },

  // ── Result cards ──
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22,34,54,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    gap: 14,
  },
  resultDot: {
    width: 18, height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
  },
  resultLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.white,
    letterSpacing: 1,
  },
  resultSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },

  // ── Sticky column header (outside ScrollView) ──
  // paddingHorizontal: 20 = tabContent(12) + playerRow(8) → aligns with playerRow content
  stickyHeaderOuter: {
    backgroundColor: 'rgba(10,22,38,0.98)',
    paddingHorizontal: 20,
    paddingTop: 7,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,197,24,0.2)',
  },
  stickyPlayerLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.gold,
    marginBottom: 4,
  },
  // paddingLeft: 24 = playerRowInputs.paddingLeft → input cells align pixel-perfect
  stickyStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 24,
  },
  thCell: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.gold,
    textAlign: 'center',
  },

  // ── Player rows ──
  playerRow: {
    backgroundColor: 'rgba(22,34,54,0.7)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    marginBottom: 7,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  playerRowGold: {
    borderLeftColor: colors.gold,
    backgroundColor: 'rgba(245,197,24,0.06)',
  },
  playerRowBlue: {
    borderLeftColor: '#60A5FA',
    backgroundColor: 'rgba(96,165,250,0.06)',
  },
  playerRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerPos: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textMuted,
    width: 18,
    textAlign: 'right',
  },
  playerName: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.white,
    flex: 1,
  },
  playerRowInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 24,
  },

  // ── Number input cell ──
  numCell: {
    height: 36,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  calcText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.gold,
    textAlign: 'center',
  },

  // ── NOT OUT toggle ──
  noToggle: {
    width: 38,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noToggleActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(245,197,24,0.15)',
  },
  noToggleText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  noToggleTextActive: {
    color: colors.gold,
  },
  // Run out toggle — red tint (penalty)
  runOutToggleActive: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  runOutToggleTextActive: {
    color: '#EF4444',
  },

  // ── Exceptional badges ──
  goldBadge: {
    backgroundColor: 'rgba(245,197,24,0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  goldBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.gold,
    letterSpacing: 0.5,
  },
  blueBadge: {
    backgroundColor: 'rgba(96,165,250,0.12)',
  },

  // ── Submit bar ──
  submitBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(13,27,42,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,197,24,0.12)',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  submitRow: {
    flexDirection: 'row',
    gap: 10,
  },
  draftBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(139,155,180,0.3)',
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  draftBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  submitBtn: {
    flex: 2,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 1.5,
    color: colors.navy,
  },

  // ── POTM modal ──
  potmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  potmCard: {
    width: 300,
    backgroundColor: '#0F1E30',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(245,197,24,0.5)',
    alignItems: 'center',
    overflow: 'hidden',
    paddingBottom: 28,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 20,
  },
  potmGlowRing: {
    position: 'absolute',
    top: -2, left: -2, right: -2, bottom: -2,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.gold,
    zIndex: -1,
  },
  potmHeader: {
    width: '100%',
    backgroundColor: colors.gold,
    paddingVertical: 10,
    alignItems: 'center',
  },
  potmHeaderText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 3,
    color: colors.navy,
  },
  potmAvatar: {
    width: 72, height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(245,197,24,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(245,197,24,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  potmInitials: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.gold,
    letterSpacing: 2,
  },
  potmName: {
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: 2,
    color: colors.white,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 32,
  },
  potmPtsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },
  potmPts: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.gold,
    letterSpacing: 1,
  },
  potmPtsLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  potmDivider: {
    width: 60, height: 1.5,
    backgroundColor: 'rgba(245,197,24,0.3)',
    marginVertical: 20,
  },
  potmBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 40,
  },
  potmBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.navy,
  },
})
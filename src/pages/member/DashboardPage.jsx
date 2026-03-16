// pavilion-web/src/pages/member/DashboardPage.jsx
// Mirrors pavilion-app/src/screens/member/DashboardScreen.jsx exactly.
// Features: smart week offset, Saturday/Sunday fixture cards (gold/blue),
// availability toggle, stats grid, announcements, training strip, join team section.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase }       from '../../lib/supabase.js'
import { useAuthStore }   from '../../store/authStore.js'
import AppShell           from '../../components/layout/AppShell.jsx'
import ClubLoader         from '../../components/ui/ClubLoader.jsx'
import {
  PAGE_TITLES,
  AVAILABILITY_CONFIG,
  MATCH_TYPE_LABELS,
  ROUTES,
} from '../../lib/constants.js'

// ─── CONFIGURABLE ─────────────────────────────────────────────────────────────
const SUNDAY_BLUE  = '#60A5FA'   // Sunday fixture accent — matches native app
const GOLD         = '#F5C518'   // Saturday fixture accent

// ─── Date helpers (mirrors DashboardScreen.jsx exactly) ───────────────────────

// Use local date parts to avoid UTC/BST off-by-one error.
// Never use .toISOString().split('T')[0] — midnight BST = 23:00 UTC previous day.
function toLocalISO(d) {
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Returns ISO date strings for the Saturday and Sunday of a given week offset.
// offset=0 → this week, offset=1 → next week, offset=-1 → last week
function getWeekDates(offset) {
  const today     = new Date()
  const day       = today.getDay()                  // 0=Sun … 6=Sat
  const diffToSat = day === 6 ? 0 : (6 - day)
  const sat       = new Date(today)
  sat.setDate(today.getDate() + diffToSat + offset * 7)
  sat.setHours(0, 0, 0, 0)
  const sun = new Date(sat)
  sun.setDate(sat.getDate() + 1)
  return { saturday: toLocalISO(sat), sunday: toLocalISO(sun) }
}

// Returns the ISO date string for this Monday at 00:00 local time.
// Saturday + Sunday fixtures archive together the following Monday.
function getThisMonday() {
  const today = new Date()
  const day   = today.getDay()
  const diff  = day === 0 ? -6 : 1 - day
  const mon   = new Date(today)
  mon.setDate(today.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return toLocalISO(mon)
}

// Human-readable label for the week navigator pill
function getWeekLabel(offset) {
  if (offset === 0)  return 'This Weekend'
  if (offset === 1)  return 'Next Weekend'
  if (offset === -1) return 'Last Weekend'
  if (offset > 1)    return `In ${offset} weekends`
  return `${Math.abs(offset)} weekends ago`
}

// Time-of-day greeting
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

// ─── Availability bar sub-component ───────────────────────────────────────────
function AvailabilityBar({ counts }) {
  const total = counts.available + counts.tentative + counts.unavailable
  if (total === 0) return null

  return (
    <div style={{ marginBottom: '14px' }}>
      {/* Segmented bar */}
      <div style={{
        height: '5px', borderRadius: '3px',
        background: 'rgba(255,255,255,0.06)',
        display: 'flex', overflow: 'hidden', marginBottom: '8px',
      }}>
        {counts.available > 0 && (
          <div style={{ flex: counts.available, background: 'var(--green)' }} />
        )}
        {counts.tentative > 0 && (
          <div style={{ flex: counts.tentative, background: 'var(--gold)' }} />
        )}
        {counts.unavailable > 0 && (
          <div style={{ flex: counts.unavailable, background: 'var(--red)' }} />
        )}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '14px' }}>
        {[
          { count: counts.available,   color: 'var(--green)', label: 'Available'   },
          { count: counts.tentative,   color: 'var(--gold)',  label: 'Tentative'   },
          { count: counts.unavailable, color: 'var(--red)',   label: 'No'          },
        ].map(c => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color }} />
            <span style={{ fontWeight: 700, fontSize: '12px', color: c.color }}>{c.count}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Fixture Card sub-component ───────────────────────────────────────────────
function FixtureCard({ fixture, myStatus, counts = {}, submitting, onSetStatus, onNavigate, isSunday }) {
  const accent    = isSunday ? SUNDAY_BLUE : GOLD
  const isLoading = submitting === fixture.id

  return (
    <div
      className="card card--hoverable"
      onClick={() => onNavigate(fixture.id)}
      style={{
        overflow: 'hidden',
        opacity: isLoading ? 0.7 : 1,
        transition: 'opacity 0.2s',
        cursor: 'pointer',
      }}
    >
      {/* Gold/blue top accent border */}
      <div style={{ height: '3px', background: accent, opacity: 0.7 }} />

      {/* Card header — team badge + home/away + match type */}
      <div style={{
        padding: '14px 18px',
        borderBottom: `1px solid ${accent}20`,
        background: `linear-gradient(135deg, ${accent}08, var(--navy-mid))`,
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Team badge */}
          <div style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px',
            color: accent,
            background: `${accent}15`,
            border: `1px solid ${accent}40`,
            padding: '4px 10px', borderRadius: '6px',
          }}>
            {fixture.teams?.name}
          </div>
          {/* Home/Away badge */}
          <div style={{
            fontSize: '11px', fontWeight: 700,
            color:       fixture.home_away === 'home' ? 'var(--green)' : fixture.home_away === 'away' ? SUNDAY_BLUE : 'var(--text-muted)',
            background:  fixture.home_away === 'home' ? 'rgba(34,197,94,0.1)' : fixture.home_away === 'away' ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.04)',
            border:      fixture.home_away === 'home' ? '1px solid rgba(34,197,94,0.25)' : fixture.home_away === 'away' ? '1px solid rgba(96,165,250,0.25)' : '1px solid var(--navy-border)',
            padding: '4px 10px', borderRadius: '6px',
          }}>
            {fixture.home_away === 'home' ? '🏠 HOME' : fixture.home_away === 'away' ? '✈️ AWAY' : '⚖️ NEUTRAL'}
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {MATCH_TYPE_LABELS[fixture.match_type] || fixture.match_type}
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: '16px 18px' }}>
        {/* HTCC VS OPPONENT */}
        <div style={{
          fontWeight: 700, fontSize: '16px',
          color: 'var(--text-primary)', marginBottom: '12px', letterSpacing: '0.3px',
        }}>
          HTCC{' '}
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '18px', letterSpacing: '2px', color: accent,
          }}>VS</span>
          {' '}{fixture.opponent?.toUpperCase()}
        </div>

        {/* Date + time */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '6px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            📅 {format(parseISO(fixture.match_date), 'EEE d MMM').toUpperCase()}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            🕐 {fixture.match_time?.slice(0, 5)}
          </div>
        </div>

        {/* Venue */}
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          📍 {fixture.venue}
        </div>

        {/* Availability bar */}
        <AvailabilityBar counts={counts} />

        {/* Availability buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {['available', 'unavailable', 'tentative'].map(status => {
            const cfg      = AVAILABILITY_CONFIG[status]
            const isActive = myStatus === status
            return (
              <button
                key={status}
                onClick={e => { e.stopPropagation(); onSetStatus(fixture.id, status) }}
                disabled={isLoading}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  paddingTop: '10px', paddingBottom: '10px',
                  borderRadius: 'var(--radius-md)',
                  border:      isActive ? `2px solid ${cfg.color}` : '2px solid var(--navy-border)',
                  background:  isActive ? cfg.fillColor : 'transparent',
                  color:       isActive ? cfg.color : 'var(--text-muted)',
                  fontSize: '12px', fontWeight: isActive ? 700 : 400,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'var(--transition)',
                  boxShadow: isActive ? `0 0 10px ${cfg.color}40` : 'none',
                }}
              >
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: isActive ? cfg.color : 'var(--text-muted)',
                  flexShrink: 0,
                }} />
                {status === 'available' ? 'Available' : status === 'unavailable' ? 'Unavailable' : 'Tentative'}
              </button>
            )
          })}
        </div>

        {/* Status confirmation */}
        {myStatus && (
          <div style={{
            marginTop: '10px', fontSize: '12px', fontWeight: 600,
            color: AVAILABILITY_CONFIG[myStatus]?.color, textAlign: 'center',
          }}>
            ✓ You're marked as {myStatus} for this match
          </div>
        )}
      </div>

      {/* Card footer */}
      <div style={{
        padding: '12px 18px',
        borderTop: '1px solid var(--navy-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <button
          className="btn btn--ghost"
          style={{ fontSize: '13px', padding: '6px 12px', color: accent }}
          onClick={e => { e.stopPropagation(); onNavigate(fixture.id) }}
        >
          View Details →
        </button>
        {fixture.availability_deadline && (
          <div style={{
            fontSize: '11px', color: 'var(--text-muted)',
            background: 'rgba(255,255,255,0.04)',
            padding: '4px 10px', borderRadius: '6px',
            border: '1px solid var(--navy-border)',
          }}>
            Deadline: {format(parseISO(fixture.availability_deadline), 'EEE d MMM')}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Day section header (Saturday / Sunday label row) ─────────────────────────
function DaySectionHeader({ dateStr, isSunday, isThisWeekend, count }) {
  const accent = isSunday ? SUNDAY_BLUE : GOLD
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
      {/* Date pill */}
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: '13px', letterSpacing: '2px',
        color: accent,
        padding: '4px 16px',
        background: `${accent}10`,
        border: `1px solid ${accent}30`,
        borderRadius: 'var(--radius-full)',
        whiteSpace: 'nowrap',
      }}>
        <span className="date-pill-desktop">
          {format(parseISO(dateStr), 'EEEE d MMMM yyyy').toUpperCase()}
        </span>
        <span className="date-pill-mobile">
          {format(parseISO(dateStr), 'EEE d MMM yy').toUpperCase()}
        </span>
      </div>
      {/* "This Weekend" badge */}
      {isThisWeekend && (
        <div style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
          color: 'var(--green)', background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.2)',
          padding: '3px 10px', borderRadius: 'var(--radius-full)',
          whiteSpace: 'nowrap',
        }}>
          THIS WEEKEND
        </div>
      )}
      {/* Separator line */}
      <div style={{ flex: 1, height: '1px', background: `${accent}20` }} />
      {/* Fixture count */}
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {count} fixture{count !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

// ─── Main page component ───────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate  = useNavigate()
  const profile   = useAuthStore(state => state.profile)
  const isAdmin   = useAuthStore(state => state.isAdmin)
  const isCaptain = useAuthStore(state => state.isCaptain)

  // ── State ──────────────────────────────────────────────────────────────────
  const [fixtures,          setFixtures]          = useState([])
  const [availability,      setAvailability]      = useState({})
  const [fixtureCounts,     setFixtureCounts]     = useState({})
  const [announcements,     setAnnouncements]     = useState([])
  const [allTeams,          setAllTeams]          = useState([])
  const [joinRequests,      setJoinRequests]      = useState([])
  const [memberTeamIds,     setMemberTeamIds]     = useState([])
  const [trainingSessions,  setTrainingSessions]  = useState([])
  const [trainingAvail,     setTrainingAvail]     = useState({})
  const [loading,           setLoading]           = useState(true)
  const [submitting,        setSubmitting]        = useState(null)
  const [joinLoading,       setJoinLoading]       = useState(null)
  const [trainingSubmitting, setTrainingSubmitting] = useState(null)
  const [weekOffset,        setWeekOffset]        = useState(0)

  // ── On mount ───────────────────────────────────────────────────────────────
  useEffect(() => {
    document.title = PAGE_TITLES.DASHBOARD
  }, [])

  useEffect(() => {
    if (profile) loadData()
  }, [profile])

  // ── Re-fetch fixtures when week changes ────────────────────────────────────
  useEffect(() => {
    if (profile) fetchFixtures(weekOffset)
  }, [weekOffset])

  // ── Fetch availability counts when fixtures change ─────────────────────────
  useEffect(() => {
    if (fixtures.length > 0) fetchAllCounts()
  }, [fixtures])

  // ── Smart offset: find first upcoming weekend with fixtures for this player ─
  // Scans up to 16 weeks ahead — identical logic to DashboardScreen.jsx
  const findSmartOffset = async (teamIds) => {
    if (!teamIds?.length) return 0
    const thisMonday = getThisMonday()
    for (let offset = 0; offset <= 16; offset++) {
      const { saturday, sunday } = getWeekDates(offset)
      // Skip weekends that are fully in the past
      if (saturday < thisMonday && sunday < thisMonday) continue
      const { data } = await supabase
        .from('fixtures')
        .select('id')
        .in('team_id', teamIds)
        .in('match_date', [saturday, sunday])
        .limit(1)
      if (data?.length > 0) return offset
    }
    return 0
  }

  // ── Main data loader ───────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true)
    try {
      // Step 1 — get player's team memberships first (needed for smart offset)
      const { data: myTeams } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('player_id', profile.id)
        .eq('status', 'active')
      const teamIds = myTeams?.map(t => t.team_id) || []
      setMemberTeamIds(teamIds)

      // Step 2 — find first upcoming weekend with fixtures and jump straight there
      const smartOffset = await findSmartOffset(teamIds)
      if (smartOffset !== weekOffset) {
        setWeekOffset(smartOffset)
        // useEffect([weekOffset]) will call fetchFixtures(smartOffset) automatically
      }

      // Step 3 — load everything else in parallel
      await Promise.all([
        fetchFixtures(smartOffset),
        fetchMyAvailability(),
        fetchAnnouncements(),
        fetchAllTeams(),
        fetchJoinRequests(),
        fetchTrainingSessions(),
      ])
    } finally {
      setLoading(false)
    }
  }

  // ── Fetch fixtures for the selected weekend ────────────────────────────────
  const fetchFixtures = async (offset = 0) => {
    const { saturday, sunday } = getWeekDates(offset)

    const { data: myTeams } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('player_id', profile.id)
      .eq('status', 'active')

    const teamIds = myTeams?.map(t => t.team_id) || []
    setMemberTeamIds(teamIds)
    if (teamIds.length === 0) { setFixtures([]); return }

    const { data, error } = await supabase
      .from('fixtures')
      .select('*, teams(id, name, day_type)')
      .in('team_id', teamIds)
      .in('match_date', [saturday, sunday])
      .order('match_date', { ascending: true })

    if (!error && data) setFixtures(data)
  }

  // ── Fetch my availability responses ───────────────────────────────────────
  const fetchMyAvailability = async () => {
    const { data } = await supabase
      .from('availability')
      .select('fixture_id, status')
      .eq('player_id', profile.id)
    if (data) {
      const map = {}
      data.forEach(a => { map[a.fixture_id] = a.status })
      setAvailability(map)
    }
  }

  // ── Fetch availability counts for all visible fixtures ────────────────────
  const fetchAllCounts = async () => {
    const ids = fixtures.map(f => f.id)
    const { data } = await supabase
      .from('availability')
      .select('fixture_id, status')
      .in('fixture_id', ids)
    if (data) {
      const counts = {}
      ids.forEach(id => { counts[id] = { available: 0, unavailable: 0, tentative: 0 } })
      data.forEach(({ fixture_id, status }) => {
        if (counts[fixture_id]) counts[fixture_id][status]++
      })
      setFixtureCounts(counts)
    }
  }

  // ── Fetch recent announcements relevant to this member ────────────────────
  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, body, target_role, created_at')
      .in('target_role', ['all', profile.role])
      .order('created_at', { ascending: false })
      .limit(3)
    if (data) setAnnouncements(data)
  }

  // ── Fetch all club teams (for join section) ────────────────────────────────
  const fetchAllTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name, day_type')
      .order('name')
    if (data) setAllTeams(data)
  }

  // ── Fetch pending join requests ────────────────────────────────────────────
  const fetchJoinRequests = async () => {
    const { data } = await supabase
      .from('join_requests')
      .select('id, team_id, status, teams(name)')
      .eq('player_id', profile.id)
      .eq('status', 'pending')
    if (data) setJoinRequests(data)
  }

  // ── Fetch upcoming training sessions + my responses ───────────────────────
  const fetchTrainingSessions = async () => {
    const today = toLocalISO(new Date())
    const { data: sessions } = await supabase
      .from('training_sessions')
      .select('*')
      .gte('session_date', today)
      .order('session_date', { ascending: true })
      .limit(5)
    if (sessions) setTrainingSessions(sessions)

    if (sessions?.length > 0) {
      const sessionIds = sessions.map(s => s.id)
      const { data: avail } = await supabase
        .from('training_availability')
        .select('session_id, status')
        .eq('player_id', profile.id)
        .in('session_id', sessionIds)
      const map = {}
      avail?.forEach(a => { map[a.session_id] = a.status })
      setTrainingAvail(map)
    }
  }

  // ── Set / toggle availability for a fixture ───────────────────────────────
  const setStatus = async (fixtureId, status) => {
    setSubmitting(fixtureId)
    try {
      const existing = availability[fixtureId]
      if (existing === status) {
        // Toggle off — delete the record
        await supabase.from('availability').delete()
          .eq('fixture_id', fixtureId).eq('player_id', profile.id)
        setAvailability(prev => { const next = { ...prev }; delete next[fixtureId]; return next })
      } else if (existing) {
        // Switch status — update the record
        await supabase.from('availability').update({ status })
          .eq('fixture_id', fixtureId).eq('player_id', profile.id)
        setAvailability(prev => ({ ...prev, [fixtureId]: status }))
      } else {
        // New response — insert a record
        await supabase.from('availability').insert({ fixture_id: fixtureId, player_id: profile.id, status })
        setAvailability(prev => ({ ...prev, [fixtureId]: status }))
      }
    } catch (err) {
      toast.error('Failed to update availability')
      console.error('[Dashboard] setStatus error:', err)
    } finally {
      setSubmitting(null)
    }
  }

  // ── Set / toggle availability for a training session ──────────────────────
  const setTrainingStatus = async (sessionId, status) => {
    setTrainingSubmitting(sessionId)
    try {
      const existing = trainingAvail[sessionId]
      if (existing === status) {
        await supabase.from('training_availability').delete()
          .eq('session_id', sessionId).eq('player_id', profile.id)
        setTrainingAvail(prev => { const n = { ...prev }; delete n[sessionId]; return n })
      } else if (existing) {
        await supabase.from('training_availability').update({ status })
          .eq('session_id', sessionId).eq('player_id', profile.id)
        setTrainingAvail(prev => ({ ...prev, [sessionId]: status }))
      } else {
        await supabase.from('training_availability').insert({ session_id: sessionId, player_id: profile.id, status })
        setTrainingAvail(prev => ({ ...prev, [sessionId]: status }))
      }
    } catch (err) {
      toast.error('Failed to update training availability')
      console.error('[Dashboard] setTrainingStatus error:', err)
    } finally {
      setTrainingSubmitting(null)
    }
  }

  // ── Join team request ──────────────────────────────────────────────────────
  const handleJoinRequest = async (team) => {
    setJoinLoading(team.id)
    try {
      const { error } = await supabase.from('join_requests').insert({
        player_id: profile.id,
        team_id:   team.id,
      })
      if (error) {
        if (error.code === '23505') {
          toast('Already have a pending request for this team', { icon: '⏳' })
        } else throw error
        return
      }
      toast.success(`Join request sent to ${team.name}`)
      await fetchJoinRequests()
    } catch {
      toast.error('Failed to send join request')
    } finally {
      setJoinLoading(null)
    }
  }

  // ── Cancel a pending join request ─────────────────────────────────────────
  const handleCancelJoinRequest = async (team) => {
    setJoinLoading(team.id)
    try {
      await supabase.from('join_requests').delete()
        .eq('player_id', profile.id).eq('team_id', team.id).eq('status', 'pending')
      toast('Join request cancelled', { icon: '↩️' })
      await fetchJoinRequests()
    } catch {
      toast.error('Failed to cancel request')
    } finally {
      setJoinLoading(null)
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const { saturday: satDate, sunday: sunDate } = getWeekDates(weekOffset)
  const satFixtures    = fixtures.filter(f => f.match_date === satDate)
  const sunFixtures    = fixtures.filter(f => f.match_date === sunDate)
  const thisWeekend    = weekOffset === 0 ? fixtures : []
  const pendingIds     = new Set(joinRequests.map(r => r.team_id))
  // Use actual team memberships — not just teams with fixtures this week
  const teamsToShow    = allTeams.filter(t => !memberTeamIds.includes(t.id))
  const totalResponded = Object.keys(availability).length
  const totalAvailable = Object.values(availability).filter(s => s === 'available').length

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="page-inner" style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Greeting header ── */}
        <div className="animate-fade-in dashboard-header" style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.5px' }}>
            {getGreeting()},
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 5vw, 52px)',
            letterSpacing: '2px', lineHeight: 1, marginBottom: '8px',
            color: 'var(--gold)',
          }}>
            {profile?.full_name?.split(' ')[0].toUpperCase() || 'PLAYER'} 🏏
          </h1>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            {thisWeekend.length > 0
              ? `You have ${thisWeekend.length} fixture${thisWeekend.length > 1 ? 's' : ''} this weekend — set your availability below.`
              : 'No fixtures this weekend. Check upcoming fixtures below.'}
          </div>
        </div>

        {/* ── Stats grid (2×2 on mobile, 4 across on desktop) ── */}
        <div className="stats-grid-mobile" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '16px', marginBottom: '40px',
        }}>
          {[
            { label: 'This Weekend', value: thisWeekend.length,  sub: 'fixtures',       color: 'var(--gold)'        },
            { label: 'Responded',    value: totalResponded,       sub: 'this season',    color: 'var(--green)'       },
            { label: 'Available',    value: totalAvailable,       sub: 'confirmed',      color: 'var(--green)'       },
            { label: 'Upcoming',     value: fixtures.length,      sub: 'total fixtures', color: 'var(--text-muted)'  },
          ].map(stat => (
            <div key={stat.label} className="card" style={{
              padding: '20px 22px',
              borderTop: `3px solid ${stat.color}`,
            }}>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: '38px',
                letterSpacing: '1px', color: stat.color, lineHeight: 1,
              }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '6px' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {stat.sub}
              </div>
            </div>
          ))}
        </div>

        {/* ── Announcements carousel ── */}
        {!loading && announcements.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <div className="section-label">CLUB NEWS</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '26px', letterSpacing: '1px',
                color: 'var(--text-primary)',
              }}>
                ANNOUNCEMENTS
              </div>
              {announcements.length > 1 && (
                <div style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 700, opacity: 0.7, whiteSpace: 'nowrap' }}>
                  Swipe for more ›
                </div>
              )}
            </div>
            {/* Horizontal scroll carousel — one card per "page" */}
            <div style={{
              display: 'flex',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              gap: '12px',
              paddingBottom: '4px',
            }}>
              <style>{`.ann-carousel::-webkit-scrollbar { display: none; }`}</style>
              {announcements.map((ann, i) => (
                <div
                  key={ann.id}
                  className="card ann-carousel"
                  style={{
                    flex: '0 0 100%',
                    scrollSnapAlign: 'start',
                    padding: '16px 18px',
                    boxSizing: 'border-box',
                    minWidth: 0,
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {format(parseISO(ann.created_at), 'EEE, d MMM yyyy')}
                  </div>
                  <div style={{
                    fontWeight: 700, fontSize: '14px',
                    color: 'var(--text-primary)', marginBottom: '8px',
                    textTransform: 'uppercase', letterSpacing: '0.3px',
                  }}>
                    {ann.title}
                  </div>
                  <div style={{ fontSize: '13px', color: '#CBD5E1', lineHeight: 1.7 }}>
                    {ann.body}
                  </div>
                </div>
              ))}
            </div>
            {/* Carousel dots */}
            {announcements.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '10px' }}>
                {announcements.map((_, i) => (
                  <div key={i} style={{
                    width: '6px', height: '6px', borderRadius: '3px',
                    background: 'rgba(255,255,255,0.15)',
                  }} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Training sessions carousel ── */}
        {!loading && trainingSessions.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <div className="section-label">UPCOMING TRAINING</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '26px', letterSpacing: '1px',
                color: 'var(--text-primary)',
              }}>
                SESSIONS
              </div>
              {trainingSessions.length > 1 && (
                <div style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 700, opacity: 0.7, whiteSpace: 'nowrap' }}>
                  Swipe for more ›
                </div>
              )}
            </div>
            {/* Horizontal scroll carousel */}
            <div style={{
              display: 'flex',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              gap: '12px',
              paddingBottom: '4px',
            }}>
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              {trainingSessions.map(session => {
                const myStatus  = trainingAvail[session.id] || null
                const isLoading = trainingSubmitting === session.id
                const d         = new Date(session.session_date + 'T00:00:00')
                const days      = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
                const months    = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
                return (
                  <div key={session.id} className="card" style={{
                    padding: '16px 20px',
                    border: '1px solid rgba(96,165,250,0.2)',
                    display: 'flex', flexDirection: 'column', gap: '12px',
                  }}>
                    {/* Session info row */}
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                      {/* Date block */}
                      <div style={{
                        textAlign: 'center',
                        paddingRight: '16px',
                        borderRight: '1px solid var(--navy-border)',
                        minWidth: '44px', flexShrink: 0,
                      }}>
                        <div style={{
                          fontFamily: 'var(--font-display)', fontSize: '28px',
                          color: SUNDAY_BLUE, lineHeight: 1,
                        }}>
                          {d.getDate()}
                        </div>
                        <div style={{
                          fontSize: '10px', fontWeight: 700,
                          color: 'var(--text-muted)', letterSpacing: '1px',
                          textTransform: 'uppercase', marginTop: '2px',
                        }}>
                          {days[d.getDay()]}
                        </div>
                      </div>
                      {/* Details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: 700, fontSize: '15px',
                          color: 'var(--text-primary)', marginBottom: '6px',
                          textTransform: 'uppercase', letterSpacing: '0.5px',
                        }}>
                          {session.title}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            📅 {days[d.getDay()].toUpperCase()} {d.getDate()} {months[d.getMonth()]}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            🕐 {session.session_time?.slice(0, 5)}
                          </div>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          📍 {session.venue}
                        </div>
                      </div>
                    </div>

                    {/* Training availability buttons */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {[
                        { status: 'available',   label: 'Available',   color: 'var(--green)', fill: 'rgba(34,197,94,0.12)' },
                        { status: 'unavailable', label: 'Unavailable', color: 'var(--red)',   fill: 'rgba(239,68,68,0.10)' },
                      ].map(opt => {
                        const isActive = myStatus === opt.status
                        return (
                          <button
                            key={opt.status}
                            onClick={() => !isLoading && setTrainingStatus(session.id, opt.status)}
                            disabled={isLoading}
                            style={{
                              flex: 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                              paddingTop: '10px', paddingBottom: '10px',
                              borderRadius: 'var(--radius-md)',
                              border:     isActive ? `1px solid ${opt.color}` : '1px solid var(--navy-border)',
                              background: isActive ? opt.fill : 'transparent',
                              color:      isActive ? opt.color : 'var(--text-muted)',
                              fontSize: '13px', fontWeight: isActive ? 700 : 400,
                              cursor: isLoading ? 'not-allowed' : 'pointer',
                              transition: 'var(--transition)',
                            }}
                          >
                            <div style={{
                              width: '8px', height: '8px', borderRadius: '50%',
                              background: isActive ? opt.color : 'rgba(255,255,255,0.2)',
                            }} />
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>

                    {/* Training status confirmation */}
                    {myStatus && (
                      <div style={{
                        fontSize: '12px', fontWeight: 600, textAlign: 'center',
                        color: myStatus === 'available' ? 'var(--green)' : 'var(--red)',
                      }}>
                        ✓ {myStatus === 'available'
                          ? 'You are attending this session'
                          : 'You are unavailable for this session'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            </div>
            {/* Carousel dots */}
            {trainingSessions.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '10px' }}>
                {trainingSessions.map((_, i) => (
                  <div key={i} style={{
                    width: '6px', height: '6px', borderRadius: '3px',
                    background: 'rgba(255,255,255,0.15)',
                  }} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Fixtures section header + week navigator ── */}
        <div className="week-nav-wrap" style={{
          marginBottom: '24px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '14px',
        }}>
          <div>
            <div className="section-label">Your Fixtures</div>
            <div className="section-title" style={{ fontSize: '28px' }}>Set Availability</div>
          </div>
          <div className="week-nav-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              style={{
                padding: '8px 14px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--navy-border)',
                background: 'transparent', color: 'var(--text-muted)',
                fontSize: '13px', cursor: 'pointer', transition: 'var(--transition)',
              }}
            >
              ← Prev
            </button>
            <div
              className="week-nav-pill"
              onClick={() => setWeekOffset(0)}
              title="Jump to current week"
              style={{
                padding: '7px 18px', borderRadius: 'var(--radius-full)',
                background: weekOffset === 0 ? 'rgba(245,197,24,0.08)' : 'rgba(255,255,255,0.04)',
                border:     weekOffset === 0 ? '1px solid rgba(245,197,24,0.3)' : '1px solid var(--navy-border)',
                color:      weekOffset === 0 ? 'var(--gold)' : 'var(--text-muted)',
                fontSize: '13px', fontWeight: 700, minWidth: '140px', textAlign: 'center',
                cursor: weekOffset !== 0 ? 'pointer' : 'default',
                letterSpacing: '0.3px',
              }}
            >
              {getWeekLabel(weekOffset)}
            </div>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              style={{
                padding: '8px 14px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--navy-border)',
                background: 'transparent', color: 'var(--text-muted)',
                fontSize: '13px', cursor: 'pointer', transition: 'var(--transition)',
              }}
            >
              Next →
            </button>
            {(isCaptain() || isAdmin()) && (
              <button
                className="btn btn--secondary"
                style={{ fontSize: '13px', marginLeft: '8px' }}
                onClick={() => navigate('/captain/fixtures')}
              >
                + Add Fixture
              </button>
            )}
          </div>
        </div>

        {/* ── Loading state ── */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <ClubLoader message="Loading your fixtures…" size={64} />
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && fixtures.length === 0 && (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏏</div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '24px', letterSpacing: '1px', marginBottom: '8px',
            }}>
              NO FIXTURES YET
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
              You haven't been added to any teams yet, or no fixtures are scheduled for this weekend.
            </div>
            <button className="btn btn--primary" onClick={() => navigate(ROUTES.TEAMS)}>
              View My Teams
            </button>
          </div>
        )}

        {/* ── Saturday + Sunday fixture groups ── */}
        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

            {/* ── Saturday ── */}
            <div>
              <DaySectionHeader
                dateStr={satDate}
                isSunday={false}
                isThisWeekend={weekOffset === 0}
                count={satFixtures.length}
              />
              {satFixtures.length === 0 ? (
                <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                  No Saturday fixtures scheduled for this week
                </div>
              ) : (
                <div className="fixture-scroll-x" style={{
                  display: 'grid',
                  gridTemplateColumns: satFixtures.length === 4
                    ? 'repeat(2, minmax(0, 1fr))'
                    : `repeat(${Math.min(satFixtures.length, 3)}, minmax(0, 1fr))`,
                  gap: '16px',
                }}>
                  {satFixtures.map(fixture => (
                    <FixtureCard
                      key={fixture.id}
                      fixture={fixture}
                      myStatus={availability[fixture.id] || null}
                      counts={fixtureCounts[fixture.id] || { available: 0, unavailable: 0, tentative: 0 }}
                      submitting={submitting}
                      onSetStatus={setStatus}
                      onNavigate={id => navigate('/fixture/' + id)}
                      isSunday={false}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Sunday ── */}
            {sunFixtures.length > 0 && (
              <div>
                <DaySectionHeader
                  dateStr={sunDate}
                  isSunday={true}
                  isThisWeekend={weekOffset === 0}
                  count={sunFixtures.length}
                />
                <div className="fixture-scroll-sun" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '16px',
                }}>
                  {sunFixtures.map(fixture => (
                    <FixtureCard
                      key={fixture.id}
                      fixture={fixture}
                      myStatus={availability[fixture.id] || null}
                      counts={fixtureCounts[fixture.id] || { available: 0, unavailable: 0, tentative: 0 }}
                      submitting={submitting}
                      onSetStatus={setStatus}
                      onNavigate={id => navigate('/fixture/' + id)}
                      isSunday={true}
                    />
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── Join a Team section ── */}
        {!loading && teamsToShow.length > 0 && (
          <div style={{ marginTop: '48px' }}>
            <div style={{ marginBottom: '20px' }}>
              <div className="section-label">Club Teams</div>
              <div className="section-title" style={{ fontSize: '26px', marginBottom: '6px' }}>
                Join a Team
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Request to join a squad — your captain or admin will approve it.
              </div>
            </div>

            {/* Pending requests banner */}
            {joinRequests.length > 0 && (
              <div style={{
                padding: '12px 18px', borderRadius: 'var(--radius-md)',
                background: 'rgba(245,197,24,0.06)',
                border: '1px solid rgba(245,197,24,0.2)',
                marginBottom: '16px', fontSize: '13px',
                color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
              }}>
                ⏳ You have {joinRequests.length} pending join request{joinRequests.length > 1 ? 's' : ''}:{' '}
                <span style={{ fontWeight: 700 }}>
                  {joinRequests.map(r => r.teams?.name).join(', ')}
                </span>
              </div>
            )}

            {/* Team cards grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '14px',
            }}>
              {teamsToShow.map(team => {
                const isPending = pendingIds.has(team.id)
                const isLoading = joinLoading === team.id
                return (
                  <div key={team.id} className="card" style={{
                    padding: '22px 20px', textAlign: 'center',
                    border:     isPending ? '1px solid rgba(245,197,24,0.25)' : '1px solid var(--navy-border)',
                    background: isPending ? 'rgba(245,197,24,0.03)' : undefined,
                    transition: 'var(--transition)',
                  }}>
                    {/* HTCC crest */}
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%',
                      background: '#0D1B2A',
                      border: '2px solid #F5C518',
                      boxShadow: '0 0 0 3px rgba(245,197,24,0.15)',
                      overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 14px',
                    }}>
                      <img
                        src="/assets/images/htcc-logo.png"
                        alt="HTCC"
                        style={{
                          width: '100%', height: '100%',
                          objectFit: 'cover', objectPosition: 'center 20%',
                          mixBlendMode: 'screen',
                        }}
                      />
                    </div>
                    {/* Team name */}
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '17px', letterSpacing: '1px',
                      color: 'var(--text-primary)', marginBottom: '4px',
                    }}>
                      {team.name.toUpperCase()}
                    </div>
                    {/* Day type */}
                    <div style={{
                      fontSize: '11px', color: 'var(--text-muted)',
                      marginBottom: '16px', textTransform: 'capitalize',
                      letterSpacing: '0.5px',
                    }}>
                      {team.day_type} fixture
                    </div>
                    {/* Action button */}
                    {isPending ? (
                      <button
                        onClick={() => handleCancelJoinRequest(team)}
                        disabled={isLoading}
                        style={{
                          width: '100%', padding: '9px 12px',
                          borderRadius: 'var(--radius-md)',
                          background: 'rgba(245,197,24,0.08)',
                          border: '1px solid rgba(245,197,24,0.25)',
                          fontSize: '12px', color: 'var(--gold)', fontWeight: 700,
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          transition: 'var(--transition)',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.textContent = '✕ Cancel Request'
                          e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
                          e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
                          e.currentTarget.style.color = 'var(--red)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.textContent = isLoading ? 'Cancelling…' : '⏳ Request Pending'
                          e.currentTarget.style.background = 'rgba(245,197,24,0.08)'
                          e.currentTarget.style.borderColor = 'rgba(245,197,24,0.25)'
                          e.currentTarget.style.color = 'var(--gold)'
                        }}
                      >
                        {isLoading ? 'Cancelling…' : '⏳ Request Pending'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoinRequest(team)}
                        disabled={isLoading}
                        style={{
                          width: '100%', padding: '9px 12px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--navy-border)',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          fontSize: '12px', fontWeight: 600,
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          transition: 'var(--transition)',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = 'rgba(245,197,24,0.4)'
                          e.currentTarget.style.color = 'var(--gold)'
                          e.currentTarget.style.background = 'rgba(245,197,24,0.06)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--navy-border)'
                          e.currentTarget.style.color = 'var(--text-muted)'
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        {isLoading ? 'Sending…' : '+ Request to Join'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </AppShell>
  )
}
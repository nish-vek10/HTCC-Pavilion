// pavilion-web/src/pages/member/FixturesPage.jsx

import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, isPast } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell from '../../components/layout/AppShell.jsx'
import ClubLoader from '../../components/ui/ClubLoader.jsx'
import { AVAILABILITY_CONFIG, MATCH_TYPE_LABELS } from '../../lib/constants.js'

// ── toLocalISO — avoids UTC/BST off-by-one (never use .toISOString()) ─────────
function toLocalISO(d) {
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ─── CONFIGURABLE ─────────────────────────────────
const ALL = 'all'

const HOME_AWAY_LABELS = {
  home:    { label: 'Home',    icon: '🏠', color: 'var(--green)' },
  away:    { label: 'Away',    icon: '✈️',  color: 'var(--amber)' },
  neutral: { label: 'Neutral', icon: '⚖️', color: 'var(--text-muted)' },
}

export default function FixturesPage() {
  const navigate  = useNavigate()
  const profile   = useAuthStore(state => state.profile)

  const [fixtures,     setFixtures]     = useState([])
  const [availability, setAvailability] = useState({})
  const [squads,       setSquads]       = useState({})   // { fixtureId: published bool }
  const [loading,      setLoading]      = useState(true)

  // ── Filters ──
  const [teamFilter,     setTeamFilter]     = useState(ALL)
  const [typeFilter,     setTypeFilter]     = useState(ALL)
  const [homeAwayFilter, setHomeAwayFilter] = useState(ALL)
  const [periodFilter,   setPeriodFilter]   = useState('upcoming') // upcoming | past | all

  // ── Teams I belong to ──
  const [myTeams, setMyTeams] = useState([])

  // ── Training sessions ──────────────────────────────────────────────────────
  const [trainingSessions,   setTrainingSessions]   = useState([])
  const [trainingAvail,      setTrainingAvail]      = useState({})
  const [trainingSubmitting, setTrainingSubmitting] = useState(null)
  const [trainingModal,      setTrainingModal]      = useState(null) // session or null

  useEffect(() => { document.title = 'Pavilion · Fixtures' }, [])
  useEffect(() => { if (profile?.id) loadAll() }, [profile?.id])

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([fetchFixtures(), fetchMyAvailability(), fetchTrainingSessions()])
    setLoading(false)
  }

  // ── Fetch upcoming training sessions + my responses ───────────────────────
  const fetchTrainingSessions = async () => {
    const today = toLocalISO(new Date())
    const { data: sessions } = await supabase
      .from('training_sessions')
      .select('*')
      .gte('session_date', today)
      .order('session_date', { ascending: true })
      .limit(8)
    if (!sessions) return
    setTrainingSessions(sessions)

    if (sessions.length > 0) {
      const { data: avail } = await supabase
        .from('training_availability')
        .select('session_id, status')
        .eq('player_id', profile.id)
        .in('session_id', sessions.map(s => s.id))
      const map = {}
      avail?.forEach(a => { map[a.session_id] = a.status })
      setTrainingAvail(map)
    }
  }

  // ── Set / toggle off training availability ────────────────────────────────
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
      setTrainingModal(null)
    } catch (err) {
      toast.error('Failed to update training availability')
    } finally {
      setTrainingSubmitting(null)
    }
  }

  const fetchFixtures = async () => {
    // Get teams this player belongs to
    const { data: teamRows } = await supabase
      .from('team_members')
      .select('team_id, teams(id, name)')
      .eq('player_id', profile.id)
      .eq('status', 'active')

    const teamIds = teamRows?.map(t => t.team_id) || []
    const teams   = teamRows?.map(t => t.teams).filter(Boolean) || []
    setMyTeams(teams)

    if (teamIds.length === 0) { setFixtures([]); return }

    // Fetch all fixtures (past + upcoming) for those teams
    const { data, error } = await supabase
      .from('fixtures')
      .select('*, teams(id, name), squads(id, published)')
      .in('team_id', teamIds)
      .order('match_date', { ascending: true })

    if (!error && data) {
      setFixtures(data)
      // Build squads map
      const sq = {}
      data.forEach(f => { sq[f.id] = f.squads?.[0]?.published || false })
      setSquads(sq)
    }
  }

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

  // ── Filtered fixtures ──
  const filtered = useMemo(() => {
    return fixtures.filter(f => {
      const past = isPast(parseISO(f.match_date))

      if (periodFilter === 'upcoming' && past)   return false
      if (periodFilter === 'past'     && !past)  return false
      if (teamFilter   !== ALL && f.team_id     !== teamFilter)  return false
      if (typeFilter   !== ALL && f.match_type  !== typeFilter)  return false
      if (homeAwayFilter !== ALL && f.home_away !== homeAwayFilter) return false

      return true
    })
  }, [fixtures, periodFilter, teamFilter, typeFilter, homeAwayFilter])

  // ── Unique match types across my fixtures ──
  const matchTypes = useMemo(() => {
    const types = [...new Set(fixtures.map(f => f.match_type).filter(Boolean))]
    return types
  }, [fixtures])

  // ── Stats ──
  const totalUpcoming  = fixtures.filter(f => !isPast(parseISO(f.match_date))).length
  const totalPast      = fixtures.filter(f =>  isPast(parseISO(f.match_date))).length
  const totalAvailable = Object.values(availability).filter(s => s === 'available').length
  const totalResponded = Object.keys(availability).length

  // ── Clear all filters ──
  const clearFilters = () => {
    setTeamFilter(ALL)
    setTypeFilter(ALL)
    setHomeAwayFilter(ALL)
    setPeriodFilter('upcoming')
  }

  const hasActiveFilters =
    teamFilter !== ALL || typeFilter !== ALL ||
    homeAwayFilter !== ALL || periodFilter !== 'upcoming'

  return (
    <AppShell>
      <div className="page-inner" style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '32px' }}>
          <div className="section-label">Your Schedule</div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 4vw, 44px)',
            letterSpacing: '2px', lineHeight: 1, marginBottom: '4px',
          }}>
            FIXTURES
          </h1>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            All matches across your teams
          </div>
        </div>

        {/* ── Season stats row ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '14px', marginBottom: '32px',
        }}>
          {[
            { label: 'Upcoming',  value: totalUpcoming,  color: 'var(--gold)'        },
            { label: 'Played',    value: totalPast,      color: 'var(--text-muted)'  },
            { label: 'Responded', value: totalResponded, color: 'var(--green)'       },
            { label: 'Available', value: totalAvailable, color: 'var(--green)'       },
          ].map(s => (
            <div key={s.label} className="card" style={{
              padding: '18px 20px',
              borderTop: `3px solid ${s.color}`,
            }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '34px', letterSpacing: '1px',
                color: s.color, lineHeight: 1,
              }}>
                {loading ? '—' : s.value}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 600 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Upcoming training sessions strip — mirrors native FixturesScreen ── */}
        {!loading && trainingSessions.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: '10px',
            }}>
              <div style={{
                fontSize: '10px', fontWeight: 700, letterSpacing: '2px',
                color: '#60A5FA', textTransform: 'uppercase',
              }}>
                Upcoming Training
              </div>
              <div style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 700, opacity: 0.7 }}>
                Tap to set availability
              </div>
            </div>
            {/* Horizontal scroll strip — one card per session, peeks next */}
            <div style={{
              display: 'flex', gap: '10px',
              overflowX: 'auto', scrollbarWidth: 'none',
              msOverflowStyle: 'none', paddingBottom: '4px',
            }}>
              <style>{`.training-strip::-webkit-scrollbar { display: none; }`}</style>
              {trainingSessions.map(session => {
                const myStatus = trainingAvail[session.id] || null
                const d        = new Date(session.session_date + 'T00:00:00')
                const days     = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
                const months   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                const dotColor = myStatus === 'available' ? '#22C55E'
                  : myStatus === 'unavailable' ? '#EF4444' : null
                return (
                  <div
                    key={session.id}
                    className="training-strip"
                    onClick={() => setTrainingModal(session)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      flexShrink: 0, cursor: 'pointer',
                      background: 'var(--bg-surface)',
                      border: '1px solid rgba(96,165,250,0.2)',
                      borderLeft: '3px solid #60A5FA',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      minWidth: '240px', maxWidth: '300px',
                      transition: 'var(--transition)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(96,165,250,0.5)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(96,165,250,0.2)'}
                  >
                    {/* Date block */}
                    <div style={{ textAlign: 'center', minWidth: '36px' }}>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '26px', color: '#60A5FA', lineHeight: '28px',
                      }}>
                        {d.getDate()}
                      </div>
                      <div style={{
                        fontSize: '9px', fontWeight: 700, letterSpacing: '1px',
                        color: 'var(--text-muted)', textTransform: 'uppercase',
                      }}>
                        {days[d.getDay()]}
                      </div>
                    </div>
                    {/* Divider */}
                    <div style={{ width: '1px', alignSelf: 'stretch', background: 'rgba(96,165,250,0.15)' }} />
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px',
                        color: '#60A5FA', marginBottom: '3px',
                      }}>
                        {days[d.getDay()].toUpperCase()} {d.getDate()} {months[d.getMonth()].toUpperCase()}
                      </div>
                      <div style={{
                        fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)',
                        marginBottom: '3px', textTransform: 'uppercase',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {session.title}
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#CBD5E1' }}>
                        🕐 {session.session_time?.slice(0, 5)}
                      </div>
                      <div style={{
                        fontSize: '11px', fontWeight: 600, color: '#CBD5E1',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        📍 {session.venue}
                      </div>
                    </div>
                    {/* Availability dot */}
                    <div style={{
                      width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0,
                      background: dotColor || 'transparent',
                      border: dotColor ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
                      boxShadow: dotColor ? `0 0 6px ${dotColor}` : 'none',
                    }} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Training availability modal ── */}
        {trainingModal && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setTrainingModal(null)}
              style={{
                position: 'fixed', inset: 0, zIndex: 400,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
              }}
            />
            {/* Bottom sheet */}
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401,
              background: 'var(--bg-surface)',
              borderTop: '1px solid rgba(96,165,250,0.2)',
              borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
              padding: '12px 24px 48px',
              animation: 'slide-up-sheet 0.25s ease forwards',
            }}>
              <style>{`
                @keyframes slide-up-sheet {
                  from { transform: translateY(100%); opacity: 0; }
                  to   { transform: translateY(0);    opacity: 1; }
                }
              `}</style>
              {/* Handle */}
              <div style={{
                width: '36px', height: '4px', borderRadius: '2px',
                background: 'var(--navy-border)',
                margin: '0 auto 20px',
              }} />
              {/* Label */}
              <div style={{
                fontSize: '10px', fontWeight: 700, letterSpacing: '2px',
                color: '#60A5FA', marginBottom: '6px',
              }}>
                TRAINING SESSION
              </div>
              {/* Title */}
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '22px', letterSpacing: '1px',
                color: 'var(--text-primary)', marginBottom: '8px',
              }}>
                {trainingModal.title?.toUpperCase()}
              </div>
              {/* Meta */}
              {(() => {
                const d      = new Date(trainingModal.session_date + 'T00:00:00')
                const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                return (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#CBD5E1', marginBottom: '4px' }}>
                      📅 {days[d.getDay()]} {d.getDate()} {months[d.getMonth()]}
                      {'      '}
                      🕐 {trainingModal.session_time?.slice(0, 5)}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#CBD5E1' }}>
                      📍 {trainingModal.venue}
                    </div>
                  </div>
                )
              })()}
              {/* Availability buttons */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                {[
                  { status: 'available',   label: 'Available',   color: '#22C55E', fill: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.35)'  },
                  { status: 'unavailable', label: 'Unavailable', color: '#EF4444', fill: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.3)'   },
                ].map(opt => {
                  const isActive     = trainingAvail[trainingModal?.id] === opt.status
                  const isSubmitting = trainingSubmitting === trainingModal?.id
                  return (
                    <button
                      key={opt.status}
                      onClick={() => setTrainingStatus(trainingModal.id, opt.status)}
                      disabled={isSubmitting}
                      style={{
                        flex: 1, padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${isActive ? opt.border : 'var(--navy-border)'}`,
                        background: isActive ? opt.fill : 'transparent',
                        color: isActive ? opt.color : 'var(--text-muted)',
                        fontSize: '14px', fontWeight: isActive ? 700 : 400,
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        transition: 'var(--transition)',
                      }}
                    >
                      <div style={{
                        width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                        background: isActive ? opt.color : 'rgba(255,255,255,0.2)',
                      }} />
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              {/* Status confirmation */}
              {trainingModal && trainingAvail[trainingModal.id] && (
                <div style={{
                  fontSize: '13px', fontWeight: 700, textAlign: 'center', marginBottom: '14px',
                  color: trainingAvail[trainingModal.id] === 'available' ? '#22C55E' : '#EF4444',
                }}>
                  ✓ You are {trainingAvail[trainingModal.id] === 'available' ? 'attending' : 'unavailable for'} this session
                </div>
              )}
              {/* Close */}
              <button
                onClick={() => setTrainingModal(null)}
                style={{
                  width: '100%', padding: '13px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--navy-border)',
                  background: 'transparent',
                  color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </>
        )}

        {/* ── Filters ── */}
        <div style={{ marginBottom: '28px' }}>
        <div className="filter-scroll-x" style={{
          display: 'flex', flexWrap: 'nowrap', gap: '10px',
          marginBottom: '8px', alignItems: 'center',
        }}>

          {/* Period toggle */}
          <div style={{
            display: 'flex', borderRadius: 'var(--radius-full)',
            border: '1px solid var(--navy-border)',
            overflow: 'hidden', flexShrink: 0,
          }}>
            {[
              { key: 'upcoming', label: 'Upcoming' },
              { key: 'past',     label: 'Past'     },
              { key: 'all',      label: 'All'      },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setPeriodFilter(opt.key)}
                style={{
                  padding: '8px 16px', border: 'none',
                  background: periodFilter === opt.key
                    ? 'rgba(245,197,24,0.15)'
                    : 'transparent',
                  color: periodFilter === opt.key ? 'var(--gold)' : 'var(--text-muted)',
                  fontSize: '13px', fontWeight: periodFilter === opt.key ? 700 : 400,
                  cursor: 'pointer', transition: 'var(--transition)',
                  borderRight: '1px solid var(--navy-border)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Team filter */}
          {myTeams.length > 1 && (
            <select
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value)}
              className="input"
              style={{ width: 'auto', minWidth: '130px', fontSize: '13px', padding: '8px 12px' }}
            >
              <option value={ALL}>All Teams</option>
              {myTeams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}

          {/* Match type filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="input"
            style={{ width: 'auto', minWidth: '130px', fontSize: '13px', padding: '8px 12px' }}
          >
            <option value={ALL}>All Types</option>
            {matchTypes.map(type => (
              <option key={type} value={type}>{MATCH_TYPE_LABELS[type] || type}</option>
            ))}
          </select>

          {/* Home / Away filter */}
          <select
            value={homeAwayFilter}
            onChange={e => setHomeAwayFilter(e.target.value)}
            className="input"
            style={{ width: 'auto', minWidth: '130px', fontSize: '13px', padding: '8px 12px' }}
          >
            <option value={ALL}>Home & Away</option>
            <option value="home">🏠 Home</option>
            <option value="away">✈️ Away</option>
            <option value="neutral">⚖️ Neutral</option>
          </select>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{
                padding: '8px 14px', borderRadius: 'var(--radius-full)',
                border: '1px solid rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.06)',
                color: 'var(--red)', fontSize: '13px',
                cursor: 'pointer', transition: 'var(--transition)',
              }}
            >
              ✕ Clear
            </button>
          )}

          </div>
        {/* Result count — outside scroll row so it's always visible */}
        <div style={{ fontSize: '12px', color: 'var(--text-faint)', textAlign: 'right' }}>
          {filtered.length} fixture{filtered.length !== 1 ? 's' : ''}
        </div>
        </div>

        {/* ── Fixtures list ── */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <ClubLoader message="Loading fixtures…" size={64} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📅</div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '20px', letterSpacing: '1px', marginBottom: '8px',
            }}>
              NO FIXTURES FOUND
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              {hasActiveFilters ? 'Try adjusting your filters' : 'No fixtures scheduled yet'}
            </div>
            {hasActiveFilters && (
              <button className="btn btn--ghost" onClick={clearFilters}>
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          (() => {
            // ── Group by month ──
            const grouped = filtered.reduce((acc, f) => {
              const month = format(parseISO(f.match_date), 'MMMM yyyy')
              if (!acc[month]) acc[month] = []
              acc[month].push(f)
              return acc
            }, {})

            return Object.entries(grouped).map(([month, monthFixtures]) => (
              <div key={month} style={{ marginBottom: '36px' }}>

                {/* Month divider */}
                <div style={{
                  fontSize: '12px', fontWeight: 700, letterSpacing: '2px',
                  textTransform: 'uppercase', color: 'var(--gold)',
                  marginBottom: '14px', paddingBottom: '10px',
                  borderBottom: '1px solid var(--navy-border)',
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>{month}</span>
                  <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>
                    {monthFixtures.length} match{monthFixtures.length !== 1 ? 'es' : ''}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {monthFixtures.map(fixture => {
                    const past       = isPast(parseISO(fixture.match_date))
                    const myStatus   = availability[fixture.id] || null
                    const isPublished = squads[fixture.id] || false
                    const cfg        = myStatus ? AVAILABILITY_CONFIG[myStatus] : null
                    const hw         = HOME_AWAY_LABELS[fixture.home_away] || HOME_AWAY_LABELS.home

                    return (
                      <div
                        key={fixture.id}
                        className="card card--hoverable"
                        onClick={() => navigate('/fixture/' + fixture.id)}
                        style={{
                          padding: '0',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          opacity: past ? 0.65 : 1,
                          transition: 'var(--transition)',
                          borderLeft: cfg
                            ? '3px solid ' + cfg.color
                            : '3px solid transparent',
                        }}
                      >
                        <div style={{
                          display: 'flex', alignItems: 'center',
                          padding: '16px 20px', gap: '16px', flexWrap: 'wrap',
                        }}>

                          {/* Date block */}
                          <div style={{
                            width: '44px', textAlign: 'center', flexShrink: 0,
                            borderRight: '1px solid var(--navy-border)',
                            paddingRight: '16px',
                          }}>
                            <div style={{
                              fontFamily: 'var(--font-display)',
                              fontSize: '26px', color: past ? 'var(--text-muted)' : 'var(--gold)',
                              lineHeight: 1,
                            }}>
                              {format(parseISO(fixture.match_date), 'dd')}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '1px' }}>
                              {format(parseISO(fixture.match_date), 'EEE').toUpperCase()}
                            </div>
                          </div>

                          {/* Match info */}
                          <div style={{ flex: 1, minWidth: '180px' }}>
                            {/* Tags row — order: Team · Home/Away · Match Type */}
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                              {/* Team badge */}
                              <span style={{
                                fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
                                color: 'var(--gold)', background: 'rgba(245,197,24,0.1)',
                                padding: '2px 8px', borderRadius: '4px',
                                border: '1px solid rgba(245,197,24,0.2)',
                              }}>
                                {fixture.teams?.name}
                              </span>
                              {/* Home/Away badge — standard */}
                              <span style={{
                                fontSize: '10px', fontWeight: 700,
                                color: fixture.home_away === 'home' ? 'var(--green)' : fixture.home_away === 'away' ? '#60A5FA' : 'var(--text-muted)',
                                background: fixture.home_away === 'home' ? 'rgba(34,197,94,0.1)' : fixture.home_away === 'away' ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.04)',
                                border: fixture.home_away === 'home' ? '1px solid rgba(34,197,94,0.25)' : fixture.home_away === 'away' ? '1px solid rgba(96,165,250,0.25)' : '1px solid var(--navy-border)',
                                padding: '2px 8px', borderRadius: '4px',
                              }}>
                                {fixture.home_away === 'home' ? '🏠 HOME' : fixture.home_away === 'away' ? '✈️ AWAY' : '⚖️ NEUTRAL'}
                              </span>
                              {/* Match type badge */}
                              <span style={{
                                fontSize: '10px', color: 'var(--text-muted)',
                                background: 'rgba(255,255,255,0.04)',
                                padding: '2px 8px', borderRadius: '4px',
                                border: '1px solid rgba(255,255,255,0.06)',
                              }}>
                                {MATCH_TYPE_LABELS[fixture.match_type] || fixture.match_type}
                              </span>
                              {isPublished && (
                                <span style={{
                                  fontSize: '10px', fontWeight: 700,
                                  color: 'var(--green)',
                                  background: 'rgba(34,197,94,0.08)',
                                  padding: '2px 8px', borderRadius: '4px',
                                  border: '1px solid rgba(34,197,94,0.2)',
                                }}>
                                  ✓ Squad Out
                                </span>
                              )}
                              {past && (
                                <span style={{
                                  fontSize: '10px', color: 'var(--text-faint)',
                                  background: 'rgba(255,255,255,0.04)',
                                  padding: '2px 8px', borderRadius: '4px',
                                  border: '1px solid rgba(255,255,255,0.06)',
                                }}>
                                  Played
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            <div style={{
                              fontWeight: 700, fontSize: '15px',
                              color: 'var(--text-primary)', marginBottom: '4px',
                            }}>
                              HTCC <span style={{
                                fontFamily: 'var(--font-display)',
                                color: 'var(--gold)', letterSpacing: '1px',
                              }}>VS</span> {fixture.opponent.toUpperCase()}
                            </div>

                            {/* Meta */}
                            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                📍 {fixture.venue}
                              </span>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                🕐 {fixture.match_time?.slice(0, 5)}
                              </span>
                            </div>
                          </div>

                          {/* Right — availability badge */}
                          <div style={{ flexShrink: 0, textAlign: 'right' }}>
                            {cfg ? (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '6px 12px', borderRadius: 'var(--radius-full)',
                                background: cfg.fillColor,
                                border: '1px solid ' + cfg.color + '55',
                                fontSize: '12px', fontWeight: 700, color: cfg.color,
                              }}>
                                <div style={{
                                  width: '7px', height: '7px', borderRadius: '50%',
                                  background: cfg.color,
                                  boxShadow: '0 0 5px ' + cfg.color,
                                }} />
                                {cfg.label}
                              </div>
                            ) : !past ? (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '6px 12px', borderRadius: 'var(--radius-full)',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                fontSize: '12px', color: 'var(--text-faint)',
                              }}>
                                Not responded
                              </div>
                            ) : null}

                            <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '6px' }}>
                              View details →
                            </div>
                          </div>

                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          })()
        )}

      </div>
    </AppShell>
  )
}
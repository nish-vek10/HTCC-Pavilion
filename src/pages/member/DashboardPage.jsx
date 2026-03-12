// pavilion-web/src/pages/member/DashboardPage.jsx

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, isThisWeek, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell from '../../components/layout/AppShell.jsx'
import {
  PAGE_TITLES,
  AVAILABILITY_CONFIG,
  MATCH_TYPE_LABELS,
  ROUTES,
} from '../../lib/constants.js'

// ─── CONFIGURABLE: How many upcoming fixtures to show ──
const FIXTURES_LIMIT = 6

export default function DashboardPage() {
  const navigate  = useNavigate()
  const profile   = useAuthStore(state => state.profile)
  const isAdmin   = useAuthStore(state => state.isAdmin)
  const isCaptain = useAuthStore(state => state.isCaptain)

  const [fixtures,      setFixtures]      = useState([])
  const [availability,  setAvailability]  = useState({})
  const [fixtureCounts, setFixtureCounts] = useState({})
  const [announcements, setAnnouncements] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [submitting,    setSubmitting]    = useState(null)
  const [allTeams,      setAllTeams]      = useState([])
  const [joinRequests,  setJoinRequests]  = useState([])
  const [joinLoading,   setJoinLoading]   = useState(null)
  const [weekOffset,    setWeekOffset]    = useState(0)  // 0 = current week

  useEffect(() => { document.title = PAGE_TITLES.DASHBOARD }, [])
  useEffect(() => { if (profile) loadData() }, [profile])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchFixtures(weekOffset), fetchMyAvailability(), fetchAnnouncements(), fetchAllTeams(), fetchJoinRequests()])
    } finally {
      setLoading(false)
    }
  }

  // ── Compute Saturday + Sunday dates for a given week offset ──
  const getWeekDates = (offset) => {
    const today = new Date()
    const day   = today.getDay()                      // 0=Sun, 6=Sat
    const diffToSat = day === 6 ? 0 : (6 - day)
    const sat   = new Date(today)
    sat.setDate(today.getDate() + diffToSat + offset * 7)
    const sun   = new Date(sat)
    sun.setDate(sat.getDate() + 1)
    return {
      saturday: sat.toISOString().split('T')[0],
      sunday:   sun.toISOString().split('T')[0],
    }
  }

  // ── Fetch fixtures for this week's Saturday + Sunday only ──
  const fetchFixtures = async (offset = 0) => {
    const { saturday, sunday } = getWeekDates(offset)

    const { data: myTeams } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('player_id', profile.id)
      .eq('status', 'active')

    const teamIds = myTeams?.map(t => t.team_id) || []
    if (teamIds.length === 0) { setFixtures([]); return }

    const { data, error } = await supabase
      .from('fixtures')
      .select('*, teams(id, name, day_type)')
      .in('team_id', teamIds)
      .in('match_date', [saturday, sunday])
      .order('match_date', { ascending: true })

    if (!error && data) setFixtures(data)
  }

  // ── Fetch my availability responses ──
  const fetchMyAvailability = async () => {
    const { data, error } = await supabase
      .from('availability')
      .select('fixture_id, status')
      .eq('player_id', profile.id)

    if (!error && data) {
      const map = {}
      data.forEach(a => { map[a.fixture_id] = a.status })
      setAvailability(map)
    }
  }

   // ── Fetch all club teams ──
  const fetchAllTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name, day_type')
      .order('name')
    if (data) setAllTeams(data)
  }

  // ── Fetch my pending join requests ──
  const fetchJoinRequests = async () => {
    const { data } = await supabase
      .from('join_requests')
      .select('id, team_id, status, teams(name)')
      .eq('player_id', profile.id)
      .eq('status', 'pending')
    if (data) setJoinRequests(data)
  }

  // ── Cancel a pending join request ──
  const handleCancelJoinRequest = async (team) => {
    setJoinLoading(team.id)
    try {
      await supabase
        .from('join_requests')
        .delete()
        .eq('player_id', profile.id)
        .eq('team_id', team.id)
        .eq('status', 'pending')
      toast('Join request cancelled', { icon: '↩️' })
      await fetchJoinRequests()
    } catch {
      toast.error('Failed to cancel request')
    } finally {
      setJoinLoading(null)
    }
  }

  // ── Submit a join request ──
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

  // ── Fetch recent announcements relevant to this member ──
  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, body, target_role, created_at')
      .in('target_role', ['all', profile.role])
      .order('created_at', { ascending: false })
      .limit(3)
    if (data) setAnnouncements(data)
  }

  // ── Re-fetch fixtures when week changes ──
  useEffect(() => {
    if (profile) fetchFixtures(weekOffset)
  }, [weekOffset])

  // ── Fetch availability counts per fixture ──
  useEffect(() => {
    if (fixtures.length > 0) fetchAllCounts()
  }, [fixtures])

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

  // ── Submit / update availability ──
  const setStatus = async (e, fixtureId, status) => {
    e.stopPropagation() // prevent card click navigating
    setSubmitting(fixtureId)
    try {
      const existing = availability[fixtureId]
      if (existing) {
        await supabase
          .from('availability')
          .update({ status })
          .eq('fixture_id', fixtureId)
          .eq('player_id', profile.id)
      } else {
        await supabase
          .from('availability')
          .insert({ fixture_id: fixtureId, player_id: profile.id, status })
      }
      setAvailability(prev => ({ ...prev, [fixtureId]: status }))
    } catch (err) {
      console.error('[Dashboard] Failed to set availability:', err)
    } finally {
      setSubmitting(null)
    }
  }

  // ── Greeting ──
  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  const { saturday: satDate, sunday: sunDate } = getWeekDates(weekOffset)
  const satFixtures  = fixtures.filter(f => f.match_date === satDate)
  const sunFixtures  = fixtures.filter(f => f.match_date === sunDate)
  const thisWeekend  = weekOffset === 0 ? fixtures : []

  // ── Format week label ──
  const weekLabel = (() => {
    const { saturday } = getWeekDates(weekOffset)
    const d = parseISO(saturday)
    if (weekOffset === 0) return 'This Weekend'
    if (weekOffset === 1) return 'Next Weekend'
    if (weekOffset === -1) return 'Last Weekend'
    return `w/c ${format(d, 'd MMM yyyy')}`
  })()

  return (
    <AppShell>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '40px' }} className="animate-fade-in">
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.5px' }}>
            {greeting()},
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 5vw, 52px)',
            letterSpacing: '2px', lineHeight: 1, marginBottom: '8px',
          }}>
            {profile?.full_name?.split(' ')[0].toUpperCase() || 'PLAYER'} 🏏
          </h1>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            {thisWeekend.length > 0
              ? `You have ${thisWeekend.length} fixture${thisWeekend.length > 1 ? 's' : ''} this weekend — set your availability below.`
              : 'No fixtures this weekend. Check upcoming fixtures below.'}
          </div>
        </div>

        {/* ── Quick stats row ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '16px', marginBottom: '40px',
        }}>
          {[
            { label: 'This Weekend', value: thisWeekend.length,                                                    sub: 'fixtures',      color: 'var(--gold)'        },
            { label: 'Responded',    value: Object.keys(availability).length,                                      sub: 'this season',   color: 'var(--green)'       },
            { label: 'Available',    value: Object.values(availability).filter(s => s === 'available').length,     sub: 'confirmed',     color: 'var(--green)'       },
            { label: 'Upcoming',     value: fixtures.length,                                                       sub: 'total fixtures', color: 'var(--text-muted)' },
          ].map(stat => (
            <div key={stat.label} className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '38px', letterSpacing: '1px', color: stat.color, lineHeight: 1 }}>
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

        {/* ── Announcements ── */}
        {!loading && announcements.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <div className="section-label">Club News</div>
            <div className="section-title" style={{ fontSize: '24px', marginBottom: '16px' }}>
              Announcements
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {announcements.map(ann => (
                <div key={ann.id} className="card" style={{ padding: '18px 22px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-faint)', marginBottom: '6px' }}>
                    {format(parseISO(ann.created_at), 'EEE d MMM yyyy, HH:mm')}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '6px' }}>
                    {ann.title}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {ann.body}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Fixtures section header + week navigator ── */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div className="section-label">Your Fixtures</div>
            <div className="section-title" style={{ fontSize: '28px' }}>Set Availability</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Week navigator */}
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
            <div style={{
              padding: '7px 18px', borderRadius: 'var(--radius-full)',
              background: weekOffset === 0 ? 'rgba(245,197,24,0.08)' : 'rgba(255,255,255,0.04)',
              border: weekOffset === 0 ? '1px solid rgba(245,197,24,0.3)' : '1px solid var(--navy-border)',
              color: weekOffset === 0 ? 'var(--gold)' : 'var(--text-muted)',
              fontSize: '13px', fontWeight: 700, minWidth: '140px', textAlign: 'center',
              cursor: weekOffset !== 0 ? 'pointer' : 'default',
              letterSpacing: '0.3px',
            }}
              onClick={() => setWeekOffset(0)}
              title="Jump to current week"
            >
              {weekLabel}
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
              <button className="btn btn--secondary" style={{ fontSize: '13px', marginLeft: '8px' }}
                onClick={() => navigate('/captain/fixtures')}>
                + Add Fixture
              </button>
            )}
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <div style={{
              width: '36px', height: '36px', margin: '0 auto 16px',
              border: '3px solid var(--navy-light)',
              borderTop: '3px solid var(--gold)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            Loading your fixtures…
          </div>
        )}

        {/* Empty state */}
        {!loading && fixtures.length === 0 && (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏏</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', letterSpacing: '1px', marginBottom: '8px' }}>
              NO FIXTURES YET
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
              You haven't been added to any teams yet, or no fixtures are scheduled.
            </div>
            <button className="btn btn--primary" onClick={() => navigate(ROUTES.TEAMS)}>
              View My Teams
            </button>
          </div>
        )}

        {/* ── Saturday fixtures ── */}
        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

            {/* ── Saturday group ── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: '13px', letterSpacing: '2px',
                  color: 'var(--gold)', padding: '4px 16px',
                  background: 'rgba(245,197,24,0.08)',
                  border: '1px solid rgba(245,197,24,0.25)',
                  borderRadius: 'var(--radius-full)',
                }}>
                  🏏 {format(parseISO(satDate), 'EEEE d MMMM yyyy').toUpperCase()}
                </div>
                {weekOffset === 0 && (
                  <div style={{
                    fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
                    color: 'var(--green)', background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.2)',
                    padding: '3px 10px', borderRadius: 'var(--radius-full)',
                  }}>THIS WEEKEND</div>
                )}
                <div style={{ flex: 1, height: '1px', background: 'rgba(245,197,24,0.15)' }} />
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {satFixtures.length} fixture{satFixtures.length !== 1 ? 's' : ''}
                </div>
              </div>

              {satFixtures.length === 0 ? (
                <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                  No Saturday fixtures scheduled for this week
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: satFixtures.length === 4
                    ? 'repeat(2, minmax(0, 1fr))'
                    : `repeat(${Math.min(satFixtures.length, 3)}, minmax(0, 1fr))`,
                  gap: '16px',
                }}>
                  {satFixtures.map(fixture => {
                    const myStatus  = availability[fixture.id] || null
                    const counts    = fixtureCounts[fixture.id] || { available: 0, unavailable: 0, tentative: 0 }
                    const total     = counts.available + counts.unavailable + counts.tentative
                    const isLoading = submitting === fixture.id
                    const matchDate = parseISO(fixture.match_date)
                    return (
                      <div key={fixture.id} className="card card--hoverable"
                        onClick={() => navigate('/fixture/' + fixture.id)}
                        style={{ overflow: 'hidden', opacity: isLoading ? 0.7 : 1, transition: 'opacity 0.2s', cursor: 'pointer' }}
                      >
                        {/* Card top — gold */}
                        <div style={{
                          background: 'linear-gradient(135deg, rgba(245,197,24,0.06), var(--navy-mid))',
                          padding: '14px 18px', borderTop: '3px solid rgba(245,197,24,0.4)',
                          borderBottom: '1px solid rgba(245,197,24,0.12)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: 'var(--gold)', background: 'rgba(245,197,24,0.12)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(245,197,24,0.3)' }}>
                              {fixture.teams?.name}
                            </div>
                            <div style={{
                              fontSize: '11px', fontWeight: 700,
                              color: fixture.home_away === 'home' ? 'var(--green)' : fixture.home_away === 'away' ? '#60A5FA' : 'var(--text-muted)',
                              background: fixture.home_away === 'home' ? 'rgba(34,197,94,0.1)' : fixture.home_away === 'away' ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.04)',
                              border: fixture.home_away === 'home' ? '1px solid rgba(34,197,94,0.25)' : fixture.home_away === 'away' ? '1px solid rgba(96,165,250,0.25)' : '1px solid var(--navy-border)',
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
                        <div style={{ padding: '18px 20px' }}>
                          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '14px' }}>
                            HTCC{' '}
                            <span style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', letterSpacing: '1px' }}>VS</span>
                            {' '}{fixture.opponent.toUpperCase()}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              <span>📅</span>{format(matchDate, 'EEE d MMM yyyy').toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              <span>🕐</span>{fixture.match_time?.slice(0, 5) || '12:30'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '18px' }}>
                            <span>📍</span>{fixture.venue}
                          </div>
                          {total > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                              <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', display: 'flex', marginBottom: '8px' }}>
                                {counts.available   > 0 && <div style={{ flex: counts.available,   background: 'var(--green)', transition: 'flex 0.5s' }} />}
                                {counts.tentative   > 0 && <div style={{ flex: counts.tentative,   background: 'var(--amber)', transition: 'flex 0.5s' }} />}
                                {counts.unavailable > 0 && <div style={{ flex: counts.unavailable, background: 'var(--red)',   transition: 'flex 0.5s' }} />}
                              </div>
                              <div style={{ display: 'flex', gap: '14px' }}>
                                {[
                                  { count: counts.available,   color: 'var(--green)', label: 'Available' },
                                  { count: counts.tentative,   color: 'var(--amber)', label: 'Tentative' },
                                  { count: counts.unavailable, color: 'var(--red)',   label: 'No' },
                                ].map(c => (
                                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color }} />
                                    <span style={{ color: c.color, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.count}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>{c.label}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {['available', 'unavailable', 'tentative'].map(status => {
                              const cfg = AVAILABILITY_CONFIG[status]
                              const isActive = myStatus === status
                              return (
                                <button key={status} onClick={(e) => setStatus(e, fixture.id, status)} disabled={isLoading} style={{
                                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                  padding: '10px 6px', borderRadius: 'var(--radius-md)',
                                  border: '2px solid ' + (isActive ? cfg.color : 'var(--navy-border)'),
                                  background: isActive ? cfg.fillColor : 'transparent',
                                  color: isActive ? cfg.color : 'var(--text-muted)',
                                  fontSize: '12px', fontWeight: isActive ? 700 : 500,
                                  cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'var(--transition)',
                                  boxShadow: isActive ? '0 0 12px ' + cfg.color + '33' : 'none',
                                }}>
                                  <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: isActive ? cfg.color : 'var(--text-faint)', boxShadow: isActive ? '0 0 6px ' + cfg.color : 'none' }} />
                                  {status === 'available' ? 'Available' : status === 'unavailable' ? 'Unavailable' : 'Tentative'}
                                </button>
                              )
                            })}
                          </div>
                          {myStatus && (
                            <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '12px', color: AVAILABILITY_CONFIG[myStatus]?.color, fontWeight: 600 }}>
                              ✓ You're marked as {myStatus} for this match
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--navy-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <button className="btn btn--ghost" style={{ fontSize: '13px', padding: '6px 12px' }}
                            onClick={(e) => { e.stopPropagation(); navigate('/fixture/' + fixture.id) }}>
                            View Details →
                          </button>
                          {fixture.availability_deadline && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--navy-border)' }}>
                              Deadline: {format(parseISO(fixture.availability_deadline), 'EEE d MMM')}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Sunday group ── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: '13px', letterSpacing: '2px',
                  color: '#60A5FA', padding: '4px 16px',
                  background: 'rgba(96,165,250,0.08)',
                  border: '1px solid rgba(96,165,250,0.25)',
                  borderRadius: 'var(--radius-full)',
                }}>
                  ☀️ {format(parseISO(sunDate), 'EEEE d MMMM yyyy').toUpperCase()}
                </div>
                {weekOffset === 0 && (
                  <div style={{
                    fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
                    color: 'var(--green)', background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.2)',
                    padding: '3px 10px', borderRadius: 'var(--radius-full)',
                  }}>THIS WEEKEND</div>
                )}
                <div style={{ flex: 1, height: '1px', background: 'rgba(96,165,250,0.15)' }} />
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {sunFixtures.length} fixture{sunFixtures.length !== 1 ? 's' : ''}
                </div>
              </div>

              {sunFixtures.length === 0 ? (
                <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                  No Sunday fixture scheduled for this week
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 600px)', gap: '16px' }}>
                  {sunFixtures.map(fixture => {
                    const myStatus  = availability[fixture.id] || null
                    const counts    = fixtureCounts[fixture.id] || { available: 0, unavailable: 0, tentative: 0 }
                    const total     = counts.available + counts.unavailable + counts.tentative
                    const isLoading = submitting === fixture.id
                    const matchDate = parseISO(fixture.match_date)
                    return (
                      <div key={fixture.id} className="card card--hoverable"
                        onClick={() => navigate('/fixture/' + fixture.id)}
                        style={{ overflow: 'hidden', opacity: isLoading ? 0.7 : 1, transition: 'opacity 0.2s', cursor: 'pointer' }}
                      >
                        {/* Card top — blue */}
                        <div style={{
                          background: 'linear-gradient(135deg, rgba(96,165,250,0.06), var(--navy-mid))',
                          padding: '14px 18px', borderTop: '3px solid rgba(96,165,250,0.4)',
                          borderBottom: '1px solid rgba(96,165,250,0.12)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: '#60A5FA', background: 'rgba(96,165,250,0.12)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(96,165,250,0.3)' }}>
                              {fixture.teams?.name}
                            </div>
                            <div style={{
                              fontSize: '11px', fontWeight: 700,
                              color: fixture.home_away === 'home' ? 'var(--green)' : fixture.home_away === 'away' ? '#60A5FA' : 'var(--text-muted)',
                              background: fixture.home_away === 'home' ? 'rgba(34,197,94,0.1)' : fixture.home_away === 'away' ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.04)',
                              border: fixture.home_away === 'home' ? '1px solid rgba(34,197,94,0.25)' : fixture.home_away === 'away' ? '1px solid rgba(96,165,250,0.25)' : '1px solid var(--navy-border)',
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
                        <div style={{ padding: '18px 20px' }}>
                          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '14px' }}>
                            HTCC{' '}
                            <span style={{ fontFamily: 'var(--font-display)', color: '#60A5FA', letterSpacing: '1px' }}>VS</span>
                            {' '}{fixture.opponent.toUpperCase()}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              <span>📅</span>{format(matchDate, 'EEE d MMM yyyy').toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              <span>🕐</span>{fixture.match_time?.slice(0, 5) || '12:30'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '18px' }}>
                            <span>📍</span>{fixture.venue}
                          </div>
                          {total > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                              <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', display: 'flex', marginBottom: '8px' }}>
                                {counts.available   > 0 && <div style={{ flex: counts.available,   background: 'var(--green)', transition: 'flex 0.5s' }} />}
                                {counts.tentative   > 0 && <div style={{ flex: counts.tentative,   background: 'var(--amber)', transition: 'flex 0.5s' }} />}
                                {counts.unavailable > 0 && <div style={{ flex: counts.unavailable, background: 'var(--red)',   transition: 'flex 0.5s' }} />}
                              </div>
                              <div style={{ display: 'flex', gap: '14px' }}>
                                {[
                                  { count: counts.available,   color: 'var(--green)', label: 'Available' },
                                  { count: counts.tentative,   color: 'var(--amber)', label: 'Tentative' },
                                  { count: counts.unavailable, color: 'var(--red)',   label: 'No' },
                                ].map(c => (
                                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color }} />
                                    <span style={{ color: c.color, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.count}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>{c.label}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {['available', 'unavailable', 'tentative'].map(status => {
                              const cfg = AVAILABILITY_CONFIG[status]
                              const isActive = myStatus === status
                              return (
                                <button key={status} onClick={(e) => setStatus(e, fixture.id, status)} disabled={isLoading} style={{
                                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                  padding: '10px 6px', borderRadius: 'var(--radius-md)',
                                  border: '2px solid ' + (isActive ? cfg.color : 'var(--navy-border)'),
                                  background: isActive ? cfg.fillColor : 'transparent',
                                  color: isActive ? cfg.color : 'var(--text-muted)',
                                  fontSize: '12px', fontWeight: isActive ? 700 : 500,
                                  cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'var(--transition)',
                                  boxShadow: isActive ? '0 0 12px ' + cfg.color + '33' : 'none',
                                }}>
                                  <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: isActive ? cfg.color : 'var(--text-faint)', boxShadow: isActive ? '0 0 6px ' + cfg.color : 'none' }} />
                                  {status === 'available' ? 'Available' : status === 'unavailable' ? 'Unavailable' : 'Tentative'}
                                </button>
                              )
                            })}
                          </div>
                          {myStatus && (
                            <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '12px', color: AVAILABILITY_CONFIG[myStatus]?.color, fontWeight: 600 }}>
                              ✓ You're marked as {myStatus} for this match
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--navy-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <button className="btn btn--ghost" style={{ fontSize: '13px', padding: '6px 12px' }}
                            onClick={(e) => { e.stopPropagation(); navigate('/fixture/' + fixture.id) }}>
                            View Details →
                          </button>
                          {fixture.availability_deadline && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--navy-border)' }}>
                              Deadline: {format(parseISO(fixture.availability_deadline), 'EEE d MMM')}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── Join a Team section — only show teams not yet joined ── */}
        {(() => {
          // Teams the member is already in (from fixtures team_ids)
          const myTeamIds = new Set(fixtures.map(f => f.team_id))
          const pendingIds = new Set(joinRequests.map(r => r.team_id))
          const teamsToShow = allTeams.filter(t => !myTeamIds.has(t.id))

          if (teamsToShow.length === 0) return null

          return (
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
                  color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
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
                  const isPending  = pendingIds.has(team.id)
                  const isLoading  = joinLoading === team.id
                  const isWeekend  = team.day_type === 'saturday'

                  return (
                    <div key={team.id} className="card" style={{
                      padding: '22px 20px', textAlign: 'center',
                      border: isPending ? '1px solid rgba(245,197,24,0.25)' : '1px solid var(--navy-border)',
                      background: isPending ? 'rgba(245,197,24,0.03)' : undefined,
                      transition: 'var(--transition)',
                    }}>
                      {/* Team icon — HTCC crest circle */}
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        background: '#0D1B2A',
                        border: '2px solid #F5C518',
                        boxShadow: '0 0 0 3px rgba(245,197,24,0.15)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 14px',
                      }}>
                        <img
                          src="/assets/images/htcc-logo.png"
                          alt="HTCC Crest"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center 20%',
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

                      {/* Action */}
                      {isPending ? (
                        <button
                          onClick={() => handleCancelJoinRequest(team)}
                          disabled={isLoading}
                          style={{
                            width: '100%', padding: '9px 12px',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(245,197,24,0.08)',
                            border: '1px solid rgba(245,197,24,0.25)',
                            fontSize: '12px', color: 'var(--amber)', fontWeight: 700,
                            letterSpacing: '0.5px', cursor: isLoading ? 'not-allowed' : 'pointer',
                            transition: 'var(--transition)',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.textContent = '✕ Cancel Request'
                            e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
                            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
                            e.currentTarget.style.color = 'var(--red)'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.textContent = '⏳ Request Pending'
                            e.currentTarget.style.background = 'rgba(245,197,24,0.08)'
                            e.currentTarget.style.borderColor = 'rgba(245,197,24,0.25)'
                            e.currentTarget.style.color = 'var(--amber)'
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
          )
        })()}

      </div>
    </AppShell>
  )
}

// pavilion-web/src/pages/member/TeamsPage.jsx

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell from '../../components/layout/AppShell.jsx'
import ConfirmModal from '../../components/ui/ConfirmModal.jsx'
import { PAGE_TITLES, ROUTES, AVAILABILITY_CONFIG, MATCH_TYPE_LABELS } from '../../lib/constants.js'

export default function TeamsPage() {
  const navigate  = useNavigate()
  const profile   = useAuthStore(state => state.profile)

  const [myTeams,      setMyTeams]      = useState([])  // Teams I belong to
  const [allTeams,     setAllTeams]     = useState([])  // All teams (for join requests)
  const [fixtures,     setFixtures]     = useState([])  // Upcoming fixtures for my teams
  const [availability, setAvailability] = useState({})  // { fixture_id: status }
  const [joinRequests, setJoinRequests] = useState([])  // My pending join requests
  const [loading,      setLoading]      = useState(true)

  // ── Join request modal ──
  const [joinModal, setJoinModal] = useState({ open: false, team: null })

  useEffect(() => { document.title = PAGE_TITLES.TEAMS }, [])
  useEffect(() => { if (profile?.id) loadAll() }, [profile?.id])

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([
      fetchMyTeams(),
      fetchAllTeams(),
      fetchJoinRequests(),
    ])
    setLoading(false)
  }

  // ── Fetch teams I'm a member of ──
  const fetchMyTeams = async () => {
    const { data } = await supabase
      .from('team_members')
      .select('teams(id, name, day_type, captain_id)')
      .eq('player_id', profile.id)
      .eq('status', 'active')

    if (data) {
      const teams = data.map(t => t.teams).filter(Boolean)
      setMyTeams(teams)
      if (teams.length > 0) {
        await fetchFixturesAndAvailability(teams.map(t => t.id))
      }
    }
  }

  // ── Fetch all teams for join requests ──
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
      .select('id, team_id, status, requested_at, teams(name)')
      .eq('player_id', profile.id)
      .eq('status', 'pending')
    if (data) setJoinRequests(data)
  }

  // ── Fetch upcoming fixtures + my availability ──
  const fetchFixturesAndAvailability = async (teamIds) => {
    const today = new Date().toISOString().split('T')[0]

    const { data: fixtureData } = await supabase
      .from('fixtures')
      .select('*, teams(id, name)')
      .in('team_id', teamIds)
      .gte('match_date', today)
      .order('match_date', { ascending: true })
      .limit(10)

    if (fixtureData) {
      setFixtures(fixtureData)

      // Fetch availability for these fixtures
      const ids = fixtureData.map(f => f.id)
      if (ids.length > 0) {
        const { data: availData } = await supabase
          .from('availability')
          .select('fixture_id, status')
          .eq('player_id', profile.id)
          .in('fixture_id', ids)

        if (availData) {
          const map = {}
          availData.forEach(a => { map[a.fixture_id] = a.status })
          setAvailability(map)
        }
      }
    }
  }

  // ── Set availability ──
  const setStatus = async (fixtureId, status) => {
    try {
      const existing = availability[fixtureId]
      if (existing) {
        await supabase.from('availability')
          .update({ status })
          .eq('fixture_id', fixtureId)
          .eq('player_id', profile.id)
      } else {
        await supabase.from('availability')
          .insert({ fixture_id: fixtureId, player_id: profile.id, status })
      }
      setAvailability(prev => ({ ...prev, [fixtureId]: status }))
      toast.success('Availability updated')
    } catch (err) {
      toast.error('Failed to update availability')
    }
  }

  // ── Cancel a pending join request ──
  const handleCancelJoinRequest = async (teamId, teamName) => {
    try {
      await supabase
        .from('join_requests')
        .delete()
        .eq('player_id', profile.id)
        .eq('team_id', teamId)
        .eq('status', 'pending')
      toast('Join request cancelled', { icon: '↩️' })
      await fetchJoinRequests()
    } catch {
      toast.error('Failed to cancel request')
    }
  }

  // ── Submit join request ──
  const handleJoinRequest = async () => {
    const team = joinModal.team
    setJoinModal({ open: false, team: null })

    try {
      const { error } = await supabase.from('join_requests').insert({
        player_id: profile.id,
        team_id:   team.id,
      })
      if (error) {
        if (error.code === '23505') {
          toast('You already have a pending request for this team', { icon: '⏳' })
        } else {
          throw error
        }
        return
      }
      toast.success(`Join request sent to ${team.name}`)
      await fetchJoinRequests()
    } catch (err) {
      toast.error('Failed to send join request')
    }
  }

  // ── Helpers ──
  const isInTeam       = (teamId) => myTeams.some(t => t.id === teamId)
  const hasPendingReq  = (teamId) => joinRequests.some(r => r.team_id === teamId)
  const teamFixtures   = (teamId) => fixtures.filter(f => f.team_id === teamId)

  return (
    <AppShell>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '36px' }} className="animate-fade-in">
          <div className="section-label">My Club</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '2px', lineHeight: 1 }}>
            MY TEAMS
          </h1>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          <>
            {/* ── My current teams ── */}
            {myTeams.length === 0 ? (
              <div className="card" style={{ padding: '48px', textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏏</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '1px', marginBottom: '8px' }}>
                  NOT IN ANY TEAMS YET
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                  Request to join a team below. A captain or admin will approve your request.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', marginBottom: '40px' }}>
                {myTeams.map(team => {
                  const tFixtures = teamFixtures(team.id)
                  return (
                    <div key={team.id} className="card" style={{ overflow: 'hidden' }}>

                      {/* Team header — golden accent */}
                      <div style={{
                        background: 'linear-gradient(135deg, rgba(245,197,24,0.07), var(--navy-mid))',
                        padding: '18px 24px',
                        borderBottom: '1px solid rgba(245,197,24,0.15)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        borderTop: '3px solid rgba(245,197,24,0.5)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          {/* Team icon badge — HTCC crest circle */}
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            background: '#0D1B2A',
                            border: '2px solid #F5C518',
                            boxShadow: '0 0 0 3px rgba(245,197,24,0.15), 0 2px 10px rgba(0,0,0,0.6)',
                            overflow: 'hidden',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
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
                          <div>
                            <div style={{
                              fontFamily: 'var(--font-display)', fontSize: '22px',
                              letterSpacing: '2px', color: 'var(--gold)',
                              textShadow: '0 0 20px rgba(245,197,24,0.2)',
                            }}>
                              {team.name.toUpperCase()}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'capitalize' }}>
                              {team.day_type} fixture team
                            </div>
                          </div>
                        </div>
                        <div style={{
                          padding: '6px 14px', borderRadius: 'var(--radius-full)',
                          background: 'rgba(34,197,94,0.1)',
                          border: '1px solid rgba(34,197,94,0.25)',
                          fontSize: '12px', fontWeight: 700, color: 'var(--green)',
                          letterSpacing: '0.5px',
                        }}>
                          ✓ MEMBER
                        </div>
                      </div>

                      {/* Upcoming fixtures for this team */}
                      <div style={{ padding: '20px 24px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '14px' }}>
                          Upcoming Fixtures
                        </div>

                        {tFixtures.length === 0 ? (
                          <div style={{ fontSize: '14px', color: 'var(--text-muted)', padding: '8px 0' }}>
                            No upcoming fixtures scheduled for this team.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {tFixtures.map(fixture => {
                              const myStatus = availability[fixture.id] || null
                              return (
                                <div key={fixture.id} style={{
                                  background: 'rgba(255,255,255,0.02)',
                                  border: '1px solid var(--navy-border)',
                                  borderRadius: 'var(--radius-md)',
                                  padding: '14px 18px',
                                  display: 'flex', alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '16px', flexWrap: 'wrap',
                                }}>
                                  {/* Date + opponent */}
                                  <div style={{ flex: 1, minWidth: '180px' }}>
                                    {/* Line 1: Home/Away · Date · Competition */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                      <span style={{
                                        fontSize: '11px', fontWeight: 700,
                                        color: fixture.home_away === 'home' ? 'var(--green)' : 'var(--amber)',
                                        background: fixture.home_away === 'home' ? 'rgba(34,197,94,0.1)' : 'rgba(245,197,24,0.1)',
                                        padding: '2px 7px', borderRadius: '4px',
                                        border: fixture.home_away === 'home' ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(245,197,24,0.25)',
                                      }}>
                                        {fixture.home_away === 'home' ? '🏠 HOME' : '✈️ AWAY'}
                                      </span>
                                      <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px' }}>·</span>
                                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
                                        {format(parseISO(fixture.match_date), 'd MMMM yy').toUpperCase()}
                                      </span>
                                      <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px' }}>·</span>
                                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {MATCH_TYPE_LABELS[fixture.match_type] || fixture.match_type}
                                      </span>
                                    </div>
                                    {/* Match title */}
                                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                                      HTCC{' '}
                                      <span style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', letterSpacing: '1px' }}>VS</span>
                                      {' '}{fixture.opponent.toUpperCase()}
                                    </div>
                                    {/* Line 2: Time · Venue */}
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                      <span>🕐 {fixture.match_time?.slice(0, 5)}</span>
                                      <span>📍 {fixture.venue}</span>
                                    </div>
                                  </div>

                                  {/* Availability pills */}
                                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                    {['available', 'unavailable', 'tentative'].map(status => {
                                      const cfg      = AVAILABILITY_CONFIG[status]
                                      const isActive = myStatus === status
                                      return (
                                        <button
                                          key={status}
                                          onClick={() => setStatus(fixture.id, status)}
                                          style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '8px 14px',
                                            borderRadius: 'var(--radius-md)',
                                            border: '2px solid ' + (isActive ? cfg.color : 'var(--navy-border)'),
                                            background: isActive ? cfg.fillColor : 'transparent',
                                            color: isActive ? cfg.color : 'var(--text-muted)',
                                            fontSize: '12px', fontWeight: isActive ? 700 : 500,
                                            cursor: 'pointer', transition: 'var(--transition)',
                                            boxShadow: isActive ? '0 0 12px ' + cfg.color + '33' : 'none',
                                            whiteSpace: 'nowrap',
                                          }}
                                          onMouseEnter={e => {
                                            if (!isActive) {
                                              e.currentTarget.style.borderColor = cfg.color
                                              e.currentTarget.style.color = cfg.color
                                            }
                                          }}
                                          onMouseLeave={e => {
                                            if (!isActive) {
                                              e.currentTarget.style.borderColor = 'var(--navy-border)'
                                              e.currentTarget.style.color = 'var(--text-muted)'
                                            }
                                          }}
                                        >
                                          <div style={{
                                            width: '8px', height: '8px', borderRadius: '50%',
                                            background: isActive ? cfg.color : 'var(--text-faint)',
                                            boxShadow: isActive ? '0 0 6px ' + cfg.color : 'none',
                                            flexShrink: 0,
                                          }} />
                                          {cfg.label}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Join a team section ── */}
            <div>
              <div style={{ marginBottom: '16px' }}>
                <div className="section-label">Club Teams</div>
                <div className="section-title" style={{ fontSize: '22px' }}>Join a Team</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Request to join a team. Your captain or admin will approve the request.
                </div>
              </div>

              {/* Pending join requests banner */}
              {joinRequests.length > 0 && (
                <div style={{
                  padding: '12px 18px', borderRadius: 'var(--radius-md)',
                  background: 'rgba(245,197,24,0.06)',
                  border: '1px solid rgba(245,197,24,0.2)',
                  marginBottom: '16px', fontSize: '13px',
                  color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  ⏳ You have {joinRequests.length} pending join request{joinRequests.length > 1 ? 's' : ''}:
                  <span style={{ fontWeight: 700 }}>
                    {joinRequests.map(r => r.teams?.name).join(', ')}
                  </span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {allTeams.map(team => {
                  const alreadyIn = isInTeam(team.id)
                  const pending   = hasPendingReq(team.id)

                  return (
                    <div key={team.id} className="card" style={{ padding: '20px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', letterSpacing: '1px', color: 'var(--text-primary)', marginBottom: '6px' }}>
                        {team.name.toUpperCase()}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'capitalize' }}>
                        {team.day_type}
                      </div>

                      {alreadyIn ? (
                        <div style={{
                          padding: '8px', borderRadius: 'var(--radius-md)',
                          background: 'rgba(34,197,94,0.08)',
                          border: '1px solid rgba(34,197,94,0.2)',
                          fontSize: '12px', color: 'var(--green)', fontWeight: 700,
                        }}>
                          ✓ Member
                        </div>
                      ) : pending ? (
                        <button
                          className="btn"
                          onClick={() => handleCancelJoinRequest(team.id, team.name)}
                          style={{
                            width: '100%', padding: '8px',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(245,197,24,0.06)',
                            border: '1px solid rgba(245,197,24,0.2)',
                            fontSize: '12px', color: 'var(--amber)', fontWeight: 700,
                            cursor: 'pointer', transition: 'var(--transition)',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.textContent = '✕ Cancel Request'
                            e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
                            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
                            e.currentTarget.style.color = 'var(--red)'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.textContent = '⏳ Pending'
                            e.currentTarget.style.background = 'rgba(245,197,24,0.06)'
                            e.currentTarget.style.borderColor = 'rgba(245,197,24,0.2)'
                            e.currentTarget.style.color = 'var(--amber)'
                          }}
                        >
                          ⏳ Pending
                        </button>
                      ) : (
                        <button
                          className="btn btn--ghost"
                          style={{ width: '100%', fontSize: '13px', padding: '8px' }}
                          onClick={() => setJoinModal({ open: true, team })}>
                          Request to Join
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Join request confirmation modal ── */}
      <ConfirmModal
        isOpen={joinModal.open}
        title="Request to Join"
        message={`Send a join request to ${joinModal.team?.name}? Your captain or admin will review and approve it.`}
        confirmLabel="Send Request"
        cancelLabel="Cancel"
        confirmDanger={false}
        onConfirm={handleJoinRequest}
        onCancel={() => setJoinModal({ open: false, team: null })}
      />
    </AppShell>
  )
}
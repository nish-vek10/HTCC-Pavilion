// pavilion-web/src/pages/member/TeamsPage.jsx

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell from '../../components/layout/AppShell.jsx'
import ConfirmModal from '../../components/ui/ConfirmModal.jsx'
import ClubLoader from '../../components/ui/ClubLoader.jsx'
import { PAGE_TITLES, ROUTES, AVAILABILITY_CONFIG, MATCH_TYPE_LABELS } from '../../lib/constants.js'

// ── toLocalISO — avoids UTC/BST off-by-one (never use .toISOString()) ────────
function toLocalISO(d) {
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ── Canonical team sort order — mirrors native TEAM_ORDER exactly ─────────────
const TEAM_ORDER = ['1st XI', '2nd XI', '3rd XI', '4th XI', 'Sunday XI']
function sortTeams(teams) {
  return [...teams].sort((a, b) => {
    const idx = name => {
      const i = TEAM_ORDER.findIndex(t => name === t || name.includes(t.split(' ')[0]))
      return i === -1 ? 999 : i
    }
    return idx(a.name) - idx(b.name)
  })
}

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

  // ── Fixture carousel state: tracks active slide index per team ──
  const [carouselIdx, setCarouselIdx] = useState({})   // { teamId: number }
  const carouselRefs = useRef({})                        // { teamId: DOM ref }

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
      const teams = sortTeams(data.map(t => t.teams).filter(Boolean))
      setMyTeams(teams)
      if (teams.length > 0) {
        await fetchFixturesAndAvailability(teams.map(t => t.id))
      }
    }
  }

  // ── Fetch all teams for join requests — sorted by canonical order ──────────
  const fetchAllTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name, day_type')
      .order('name')
    if (data) setAllTeams(sortTeams(data))
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
    const today = toLocalISO(new Date())

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

  // ── Set / switch / unset availability ──
  // Clicking the already-active status deselects it (deletes the record)
  const setStatus = async (fixtureId, status) => {
    try {
      const existing = availability[fixtureId]

      if (existing === status) {
        // ── Toggle off: delete the record ──
        await supabase
          .from('availability')
          .delete()
          .eq('fixture_id', fixtureId)
          .eq('player_id', profile.id)
        setAvailability(prev => {
          const next = { ...prev }
          delete next[fixtureId]
          return next
        })
        toast('Availability cleared', { icon: '↩️' })
      } else if (existing) {
        // ── Switch status ──
        await supabase
          .from('availability')
          .update({ status })
          .eq('fixture_id', fixtureId)
          .eq('player_id', profile.id)
        setAvailability(prev => ({ ...prev, [fixtureId]: status }))
        toast.success('Availability updated')
      } else {
        // ── New response ──
        await supabase
          .from('availability')
          .insert({ fixture_id: fixtureId, player_id: profile.id, status })
        setAvailability(prev => ({ ...prev, [fixtureId]: status }))
        toast.success('Availability updated')
      }
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

  // ── Detect touch device: disables hover handlers on mobile to prevent sticky border bug ──
  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches

  // ── Helpers ──
  const isInTeam       = (teamId) => myTeams.some(t => t.id === teamId)
  // String coercion on both sides — guards against UUID type mismatch from Supabase
  const hasPendingReq  = (teamId) => joinRequests.some(r => String(r.team_id) === String(teamId))
  const teamFixtures   = (teamId) => fixtures.filter(f => f.team_id === teamId)

  // ── Carousel: scroll to specific slide index ──
  const scrollToCarousel = (teamId, idx) => {
    const el = carouselRefs.current[teamId]
    if (!el) return
    el.scrollTo({ left: el.offsetWidth * idx, behavior: 'smooth' })
    setCarouselIdx(prev => ({ ...prev, [teamId]: idx }))
  }

  // ── Carousel: update active dot on user swipe ──
  const handleCarouselScroll = (teamId, total) => {
    const el = carouselRefs.current[teamId]
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.offsetWidth)
    setCarouselIdx(prev => ({ ...prev, [teamId]: Math.min(Math.max(idx, 0), total - 1) }))
  }

  return (
    <>
    <AppShell>
      <div className="page-inner" style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '36px' }} className="animate-fade-in">
          <div className="section-label">My Club</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '2px', lineHeight: 1 }}>
            MY TEAMS
          </h1>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <ClubLoader message="Loading your teams…" size={64} />
          </div>
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
                          <div>
                            {/* ── Horizontal snap carousel ── */}
                            <div
                              ref={el => { carouselRefs.current[team.id] = el }}
                              className="team-fixture-carousel"
                              onScroll={() => handleCarouselScroll(team.id, tFixtures.length)}
                            >
                              {tFixtures.map(fixture => {
                                const myStatus = availability[fixture.id] || null
                                return (
                                  <div key={fixture.id} className="team-fixture-carousel-item">
                                    <div style={{
                                      background: 'rgba(255,255,255,0.02)',
                                      border: '1px solid var(--navy-border)',
                                      borderRadius: 'var(--radius-md)',
                                      padding: '16px 18px',
                                    }}>
                                      {/* ── Header: date + badges ── */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
                                          {format(parseISO(fixture.match_date), 'd MMMM yy').toUpperCase()}
                                        </span>
                                        <span style={{
                                          fontSize: '11px', fontWeight: 700,
                                          color: fixture.home_away === 'home' ? 'var(--green)' : fixture.home_away === 'away' ? '#60A5FA' : 'var(--text-muted)',
                                          background: fixture.home_away === 'home' ? 'rgba(34,197,94,0.1)' : fixture.home_away === 'away' ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.04)',
                                          border: fixture.home_away === 'home' ? '1px solid rgba(34,197,94,0.25)' : fixture.home_away === 'away' ? '1px solid rgba(96,165,250,0.25)' : '1px solid var(--navy-border)',
                                          padding: '2px 8px', borderRadius: '4px',
                                        }}>
                                          {fixture.home_away === 'home' ? '🏠 HOME' : fixture.home_away === 'away' ? '✈️ AWAY' : '⚖️ NEUTRAL'}
                                        </span>
                                        <span style={{
                                          fontSize: '11px', color: 'var(--text-muted)',
                                          background: 'rgba(255,255,255,0.04)',
                                          padding: '2px 8px', borderRadius: '4px',
                                          border: '1px solid rgba(255,255,255,0.06)',
                                        }}>
                                          {MATCH_TYPE_LABELS[fixture.match_type] || fixture.match_type}
                                        </span>
                                      </div>

                                      {/* ── Match title ── */}
                                      <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)', marginBottom: '10px' }}>
                                        HTCC{' '}
                                        <span style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', letterSpacing: '1px' }}>VS</span>
                                        {' '}{fixture.opponent.toUpperCase()}
                                      </div>

                                      {/* ── Time + venue ── */}
                                      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>🕐 {fixture.match_time?.slice(0, 5)}</span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>📍 {fixture.venue}</span>
                                      </div>

                                      {/* ── Availability pills ── */}
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        {['available', 'unavailable', 'tentative'].map(status => {
                                          const cfg      = AVAILABILITY_CONFIG[status]
                                          const isActive = myStatus === status
                                          return (
                                            <button
                                              key={status}
                                              onClick={(e) => { e.stopPropagation(); setStatus(fixture.id, status) }}
                                              style={{
                                                flex: 1,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                padding: '10px 6px',
                                                borderRadius: 'var(--radius-md)',
                                                border: '2px solid ' + (isActive ? cfg.color : 'var(--navy-border)'),
                                                background: isActive ? cfg.fillColor : 'transparent',
                                                color: isActive ? cfg.color : 'var(--text-muted)',
                                                fontSize: '12px', fontWeight: isActive ? 700 : 500,
                                                cursor: 'pointer', transition: 'var(--transition)',
                                                boxShadow: isActive ? '0 0 12px ' + cfg.color + '33' : 'none',
                                                whiteSpace: 'nowrap',
                                              }}
                                              onMouseEnter={isTouchDevice ? undefined : (e => { if (!isActive) { e.currentTarget.style.borderColor = cfg.color; e.currentTarget.style.color = cfg.color } })}
                                              onMouseLeave={isTouchDevice ? undefined : (e => { if (!isActive) { e.currentTarget.style.borderColor = 'var(--navy-border)'; e.currentTarget.style.color = 'var(--text-muted)' } })}
                                            >
                                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isActive ? cfg.color : 'var(--text-faint)', boxShadow: isActive ? '0 0 6px ' + cfg.color : 'none', flexShrink: 0 }} />
                                              {cfg.label}
                                            </button>
                                          )
                                        })}
                                      </div>

                                      {/* ── Status confirmation — mirrors native statusConfirm ── */}
                                      {myStatus && (
                                        <div style={{
                                          marginTop: '10px', fontSize: '12px', fontWeight: 600,
                                          color: AVAILABILITY_CONFIG[myStatus]?.color,
                                          textAlign: 'center',
                                        }}>
                                          ✓ You're marked as {myStatus} for this match
                                        </div>
                                      )}

                                      {/* ── View Details link — mirrors native carouselViewDetail ── */}
                                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); navigate('/fixture/' + fixture.id) }}
                                          style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            fontSize: '13px', fontWeight: 600, color: 'var(--gold)',
                                            padding: 0,
                                          }}
                                        >
                                          View Details →
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            {/* ── Navigation dots + prev/next ── */}
                            {tFixtures.length > 1 && (
                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
                                {/* Prev */}
                                <button
                                  onClick={() => scrollToCarousel(team.id, Math.max(0, (carouselIdx[team.id] || 0) - 1))}
                                  disabled={(carouselIdx[team.id] || 0) === 0}
                                  style={{
                                    width: '26px', height: '26px', borderRadius: '50%',
                                    background: 'none',
                                    border: '1px solid var(--navy-border)',
                                    color: (carouselIdx[team.id] || 0) === 0 ? 'var(--text-faint)' : 'var(--text-muted)',
                                    fontSize: '14px', cursor: (carouselIdx[team.id] || 0) === 0 ? 'default' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'var(--transition)',
                                  }}
                                >‹</button>

                                {/* Dots */}
                                {tFixtures.map((_, i) => (
                                  <div
                                    key={i}
                                    onClick={() => scrollToCarousel(team.id, i)}
                                    style={{
                                      width: (carouselIdx[team.id] || 0) === i ? '20px' : '6px',
                                      height: '6px', borderRadius: '3px',
                                      background: (carouselIdx[team.id] || 0) === i ? 'var(--gold)' : 'rgba(255,255,255,0.15)',
                                      cursor: 'pointer', transition: 'all 0.3s ease',
                                    }}
                                  />
                                ))}

                                {/* Next */}
                                <button
                                  onClick={() => scrollToCarousel(team.id, Math.min(tFixtures.length - 1, (carouselIdx[team.id] || 0) + 1))}
                                  disabled={(carouselIdx[team.id] || 0) === tFixtures.length - 1}
                                  style={{
                                    width: '26px', height: '26px', borderRadius: '50%',
                                    background: 'none',
                                    border: '1px solid var(--navy-border)',
                                    color: (carouselIdx[team.id] || 0) === tFixtures.length - 1 ? 'var(--text-faint)' : 'var(--text-muted)',
                                    fontSize: '14px', cursor: (carouselIdx[team.id] || 0) === tFixtures.length - 1 ? 'default' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'var(--transition)',
                                  }}
                                >›</button>
                              </div>
                            )}
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

              {(() => {
                // ── Split teams by day type ──
                const satTeams = allTeams.filter(t => t.day_type === 'saturday')
                const sunTeams = allTeams.filter(t => t.day_type === 'sunday')

                // ── Reusable team card ──
                const renderCard = (team) => {
                  const alreadyIn = isInTeam(team.id)
                  const pending   = hasPendingReq(team.id)
                  return (
                    <div key={team.id} className="card" style={{ padding: '22px 18px', textAlign: 'center' }}>

                      {/* HTCC crest with gold ring */}
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '50%',
                        background: '#0D1B2A', border: '2px solid #F5C518',
                        boxShadow: '0 0 0 3px rgba(245,197,24,0.15), 0 2px 10px rgba(0,0,0,0.5)',
                        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 14px',
                      }}>
                        <img src="/assets/images/htcc-logo.png" alt="HTCC Crest"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', mixBlendMode: 'screen' }} />
                      </div>

                      {/* Team name */}
                      <div style={{
                        fontFamily: 'var(--font-display)', fontSize: '17px', letterSpacing: '1px',
                        color: 'var(--text-primary)', marginBottom: '4px',
                      }}>
                        {team.name.toUpperCase()}
                      </div>

                      {/* Day type */}
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'capitalize', letterSpacing: '0.5px' }}>
                        {team.day_type} fixture
                      </div>

                      {/* Action */}
                      {alreadyIn ? (
                        <div style={{
                          padding: '9px 12px', borderRadius: 'var(--radius-md)',
                          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                          fontSize: '12px', color: 'var(--green)', fontWeight: 700,
                        }}>✓ Member</div>
                      ) : pending ? (
                        <button
                          onClick={() => handleCancelJoinRequest(team.id, team.name)}
                          style={{
                            width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md)',
                            background: 'rgba(245,197,24,0.08)', border: '1px solid rgba(245,197,24,0.3)',
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
                            e.currentTarget.textContent = '⏳ Requested'
                            e.currentTarget.style.background = 'rgba(245,197,24,0.08)'
                            e.currentTarget.style.borderColor = 'rgba(245,197,24,0.3)'
                            e.currentTarget.style.color = 'var(--amber)'
                          }}
                        >⏳ Requested</button>
                      ) : (
                        <button
                          onClick={() => setJoinModal({ open: true, team })}
                          style={{
                            width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md)',
                            background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)',
                            fontSize: '12px', color: '#60A5FA', fontWeight: 600,
                            cursor: 'pointer', transition: 'var(--transition)',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(59,130,246,0.16)'
                            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(59,130,246,0.08)'
                            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'
                          }}
                        >+ Request to Join</button>
                      )}
                    </div>
                  )
                }

                return (
                  <>
                    {/* Saturday teams — 2×2 grid */}
                    {satTeams.length > 0 && (
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr',
                        gap: '14px', marginBottom: sunTeams.length > 0 ? '14px' : '0',
                      }}>
                        {satTeams.map(renderCard)}
                      </div>
                    )}
                    {/* Sunday teams — full width row layout, mirrors native joinCardWide */}
                    {sunTeams.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {sunTeams.map(team => {
                          const alreadyIn = isInTeam(team.id)
                          const pending   = hasPendingReq(team.id)
                          return (
                            <div key={team.id} className="card" style={{
                              padding: '16px 18px',
                              display: 'flex', alignItems: 'center',
                              justifyContent: 'space-between', gap: '14px',
                              border: pending ? '1px solid rgba(245,197,24,0.25)' : undefined,
                            }}>
                              {/* Left: crest + name */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                  width: '44px', height: '44px', borderRadius: '50%',
                                  background: '#0D1B2A', border: '2px solid #F5C518',
                                  boxShadow: '0 0 0 3px rgba(245,197,24,0.15)',
                                  overflow: 'hidden', flexShrink: 0,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  <img src="/assets/images/htcc-logo.png" alt="HTCC"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', mixBlendMode: 'screen' }} />
                                </div>
                                <div>
                                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', letterSpacing: '1px', color: 'var(--text-primary)' }}>
                                    {team.name.toUpperCase()}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: '2px' }}>
                                    {team.day_type} fixture
                                  </div>
                                </div>
                              </div>
                              {/* Right: action button */}
                              {alreadyIn ? (
                                <div style={{
                                  padding: '8px 14px', borderRadius: 'var(--radius-md)',
                                  background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                                  fontSize: '12px', color: 'var(--green)', fontWeight: 700, flexShrink: 0,
                                }}>✓ Member</div>
                              ) : pending ? (
                                <button
                                  onClick={() => handleCancelJoinRequest(team.id, team.name)}
                                  style={{
                                    padding: '8px 14px', borderRadius: 'var(--radius-md)',
                                    background: 'rgba(245,197,24,0.08)', border: '1px solid rgba(245,197,24,0.25)',
                                    fontSize: '12px', color: 'var(--gold)', fontWeight: 700,
                                    cursor: 'pointer', flexShrink: 0, transition: 'var(--transition)',
                                  }}
                                  onMouseEnter={e => { e.currentTarget.textContent = '✕ Cancel'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.color = 'var(--red)' }}
                                  onMouseLeave={e => { e.currentTarget.textContent = '⏳ Requested'; e.currentTarget.style.background = 'rgba(245,197,24,0.08)'; e.currentTarget.style.borderColor = 'rgba(245,197,24,0.25)'; e.currentTarget.style.color = 'var(--gold)' }}
                                >⏳ Requested</button>
                              ) : (
                                <button
                                  onClick={() => setJoinModal({ open: true, team })}
                                  style={{
                                    padding: '8px 14px', borderRadius: 'var(--radius-md)',
                                    background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)',
                                    fontSize: '12px', color: '#60A5FA', fontWeight: 600,
                                    cursor: 'pointer', flexShrink: 0, transition: 'var(--transition)',
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.16)' }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)' }}
                                >+ Request</button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </>
        )}
      </div>

      </AppShell>

    {/* ── Join request confirmation modal — portalled to body to escape
        AppShell's page-fade-in transform stacking context ── */}
    {joinModal.open && createPortal(
      <ConfirmModal
        isOpen={joinModal.open}
        title="Request to Join"
        message={`Send a join request to ${joinModal.team?.name}? Your captain or admin will review and approve it.`}
        confirmLabel="Send Request"
        cancelLabel="Cancel"
        confirmDanger={false}
        onConfirm={handleJoinRequest}
        onCancel={() => setJoinModal({ open: false, team: null })}
      />,
      document.body
    )}
  </>
  )
}
// pavilion-web/src/pages/admin/AdminMatchdayPage.jsx

import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, startOfWeek, addDays } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell from '../../components/layout/AppShell.jsx'
import { AVAILABILITY_CONFIG } from '../../lib/constants.js'

// ─── CONFIGURABLE ─────────────────────────────────
const SATURDAY_TEAMS = ['1st XI', '2nd XI', '3rd XI', '4th XI']
const SUNDAY_TEAMS   = ['Sunday XI']
const TABS           = [
  { key: 'saturday', label: '🏏 Saturday XIs' },
  { key: 'sunday',   label: '☀️ Sunday XI'    },
]

// ─── Availability dot colours ─────────────────────
const STATUS_DOT = {
  available:   { color: 'var(--green)', label: 'Available' },
  unavailable: { color: 'var(--red)',   label: 'Unavailable' },
  tentative:   { color: 'var(--amber)', label: 'Tentative' },
}

// ─── Home/Away display config ──────────────────────
const HOME_AWAY_CONFIG = {
  home:    { emoji: '🏠', label: 'Home',    color: '#22C55E' },
  away:    { emoji: '✈️',  label: 'Away',    color: '#60A5FA' },
  neutral: { emoji: '⚖️', label: 'Neutral', color: '#8B9BB4' },
}

// ─── Match type labels ─────────────────────────────
const MATCH_TYPE_LABELS = {
  league:      '🏆 MCCL',
  cup:         '🏅 Cup',
  friendly:    '🤝 Friendly',
  sunday_comp: '☀️ CVSL',
}

export default function AdminMatchdayPage() {
  const navigate = useNavigate()
  const profile  = useAuthStore(state => state.profile)

  const [activeTab,  setActiveTab]  = useState('saturday')
  const [matchDate,  setMatchDate]  = useState(getNextSaturday())
  const [fixtures,   setFixtures]   = useState([])
  const [playerData, setPlayerData] = useState({}) // { [fixtureId]: { players, squad } }
  const [loading,    setLoading]    = useState(true)

  useEffect(() => { document.title = 'Pavilion · Matchday — Admin' }, [])
  useEffect(() => { if (profile?.id) loadMatchday() }, [profile?.id, matchDate, activeTab])

  // ── Get next Saturday/Sunday by default ──
  function getNextSaturday() {
    const today = new Date()
    const day   = today.getDay() // 0=Sun, 6=Sat
    const diff  = day === 6 ? 0 : (6 - day)
    const sat   = new Date(today)
    sat.setDate(today.getDate() + diff)
    return sat.toISOString().split('T')[0]
  }

  function getNextSunday() {
    const today = new Date()
    const day   = today.getDay()
    const diff  = day === 0 ? 0 : (7 - day)
    const sun   = new Date(today)
    sun.setDate(today.getDate() + diff)
    return sun.toISOString().split('T')[0]
  }

  // ── Switch tab and jump to relevant default date ──
  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setMatchDate(tab === 'saturday' ? getNextSaturday() : getNextSunday())
  }

  // ── Load all fixtures for the selected date + tab ──
  const loadMatchday = async () => {
    setLoading(true)
    setFixtures([])
    setPlayerData({})

    const teamNames = activeTab === 'saturday' ? SATURDAY_TEAMS : SUNDAY_TEAMS

    // Fetch teams matching this tab
    const { data: teamRows } = await supabase
      .from('teams')
      .select('id, name')
      .in('name', teamNames)

    if (!teamRows || teamRows.length === 0) {
      setLoading(false)
      return
    }

    const teamIds = teamRows.map(t => t.id)

    // Fetch fixtures for those teams on the selected date
    const { data: fixtureRows, error } = await supabase
      .from('fixtures')
      .select('*, teams(id, name)')
      .eq('match_date', matchDate)
      .in('team_id', teamIds)

    if (error) { toast.error('Failed to load fixtures'); setLoading(false); return }

    setFixtures(fixtureRows || [])

    // For each fixture — fetch players + availability + squad
    await Promise.all((fixtureRows || []).map(f => fetchFixtureDetail(f.id, f.team_id)))

    setLoading(false)
  }

  const fetchFixtureDetail = async (fixtureId, teamId) => {
    // Team members
    const { data: members } = await supabase
      .from('team_members')
      .select('player_id, profiles(id, full_name, avatar_color)')
      .eq('team_id', teamId)
      .eq('status', 'active')

    // Availability for this fixture
    const { data: avail } = await supabase
      .from('availability')
      .select('player_id, status')
      .eq('fixture_id', fixtureId)

    // Squad (if published)
    const { data: squadData } = await supabase
      .from('squads')
      .select('id, published, squad_members(player_id, position_order)')
      .eq('fixture_id', fixtureId)
      .single()

    const availMap = {}
    avail?.forEach(a => { availMap[a.player_id] = a.status })

    const squadIds = new Set(
      squadData?.squad_members?.map(sm => sm.player_id) || []
    )

    const players = (members || []).map(m => ({
      id:        m.player_id,
      name:      m.profiles?.full_name || 'Unknown',
      color:     m.profiles?.avatar_color || '#F5C518',
      status:    availMap[m.player_id] || null,
      inSquad:   squadIds.has(m.player_id),
    })).sort((a, b) => {
      const order = { available: 0, tentative: 1, unavailable: 2 }
      return (order[a.status] ?? 3) - (order[b.status] ?? 3)
    })

    setPlayerData(prev => ({
      ...prev,
      [fixtureId]: { players, squad: squadData },
    }))
  }

  // ── Count helpers ──
  const countStatus = (fixtureId, status) =>
    playerData[fixtureId]?.players?.filter(p => p.status === status).length || 0

  const getInitials = (name) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  // ── Navigate to prev/next matchday ──
  const shiftDate = (days) => {
    const d = new Date(matchDate)
    d.setDate(d.getDate() + days)
    setMatchDate(d.toISOString().split('T')[0])
  }

  const formattedDate = matchDate
    ? format(parseISO(matchDate), 'EEEE d MMMM yyyy')
    : ''

  // ── No fixtures state ──
  const noFixtures = !loading && fixtures.length === 0

  return (
    <AppShell>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '28px' }}>
          <div className="section-label">Administration</div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 4vw, 44px)',
            letterSpacing: '2px', lineHeight: 1, marginBottom: '4px',
          }}>
            MATCHDAY
          </h1>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Availability and squads across all teams
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              style={{
                padding: '10px 22px',
                borderRadius: 'var(--radius-full)',
                border: activeTab === tab.key
                  ? '1px solid rgba(245,197,24,0.5)'
                  : '1px solid var(--navy-border)',
                background: activeTab === tab.key
                  ? 'rgba(245,197,24,0.1)'
                  : 'transparent',
                color: activeTab === tab.key ? 'var(--gold)' : 'var(--text-muted)',
                fontSize: '13px', fontWeight: activeTab === tab.key ? 700 : 400,
                cursor: 'pointer', transition: 'var(--transition)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Date navigator ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '16px',
          marginBottom: '32px', flexWrap: 'wrap',
        }}>
          <button
            onClick={() => shiftDate(-7)}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--navy-border)',
              background: 'transparent', color: 'var(--text-muted)',
              fontSize: '13px', cursor: 'pointer', transition: 'var(--transition)',
            }}
          >
            ← Prev
          </button>

          <div style={{ flex: 1, textAlign: 'center' }}>
            <input
              type="date"
              value={matchDate}
              onChange={e => setMatchDate(e.target.value)}
              className="input"
              style={{ textAlign: 'center', maxWidth: '200px', cursor: 'pointer' }}
            />
            <div style={{
              fontSize: '13px', color: 'var(--gold)',
              fontWeight: 600, marginTop: '6px', letterSpacing: '0.5px',
            }}>
              {formattedDate}
            </div>
          </div>

          <button
            onClick={() => shiftDate(7)}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--navy-border)',
              background: 'transparent', color: 'var(--text-muted)',
              fontSize: '13px', cursor: 'pointer', transition: 'var(--transition)',
            }}
          >
            Next →
          </button>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
            Loading matchday data…
          </div>
        )}

        {/* ── No fixtures ── */}
        {noFixtures && (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '22px', letterSpacing: '1px', marginBottom: '8px',
            }}>
              NO FIXTURES ON THIS DATE
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
              {activeTab === 'saturday' ? 'No Saturday XI fixtures' : 'No Sunday XI fixture'} scheduled for {formattedDate}
            </div>
            <button
              className="btn btn--primary"
              onClick={() => navigate('/admin/fixtures')}
            >
              + Add Fixture
            </button>
          </div>
        )}

        {/* ── Fixture grid ── */}
        {!loading && fixtures.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: activeTab === 'saturday'
              ? 'repeat(auto-fill, minmax(280px, 1fr))'
              : '1fr',
            gap: '20px',
            maxWidth: activeTab === 'sunday' ? '600px' : undefined,
          }}>
            {fixtures.map(fixture => {
              const data       = playerData[fixture.id]
              const players    = data?.players || []
              const squad      = data?.squad
              const isPublished = squad?.published || false

              const availCount = countStatus(fixture.id, 'available')
              const tentCount  = countStatus(fixture.id, 'tentative')
              const unavailCount = countStatus(fixture.id, 'unavailable')
              const noReply    = players.filter(p => !p.status).length

              return (
                <div key={fixture.id} className="card" style={{
                  overflow: 'hidden',
                  border: isPublished
                    ? '1px solid rgba(34,197,94,0.25)'
                    : '1px solid var(--navy-border)',
                }}>
                  {/* Card header */}
                  <div style={{
                    padding: '16px 18px',
                    background: 'linear-gradient(135deg, var(--bg-elevated), var(--navy-mid))',
                    borderBottom: '1px solid var(--navy-border)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        {/* Line 1: Team · Home/Away · Match Type */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          {/* Team badge */}
                          <span style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '13px', letterSpacing: '1.5px',
                            color: 'var(--gold)', background: 'rgba(245,197,24,0.1)',
                            padding: '2px 8px', borderRadius: '4px',
                            border: '1px solid rgba(245,197,24,0.2)',
                          }}>
                            {fixture.teams?.name?.toUpperCase()}
                          </span>
                          {/* Home/Away badge — standard */}
                          <span style={{
                            fontSize: '11px', fontWeight: 700,
                            color: fixture.home_away === 'home' ? 'var(--green)' : fixture.home_away === 'away' ? '#60A5FA' : 'var(--text-muted)',
                            background: fixture.home_away === 'home' ? 'rgba(34,197,94,0.1)' : fixture.home_away === 'away' ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.04)',
                            border: fixture.home_away === 'home' ? '1px solid rgba(34,197,94,0.25)' : fixture.home_away === 'away' ? '1px solid rgba(96,165,250,0.25)' : '1px solid var(--navy-border)',
                            padding: '2px 8px', borderRadius: '4px',
                          }}>
                            {fixture.home_away === 'home' ? '🏠 HOME' : fixture.home_away === 'away' ? '✈️ AWAY' : '⚖️ NEUTRAL'}
                          </span>
                          {/* Match type badge */}
                          <span style={{
                            fontSize: '11px', color: 'var(--text-muted)',
                            background: 'rgba(255,255,255,0.04)',
                            padding: '2px 8px', borderRadius: '4px',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}>
                            {MATCH_TYPE_LABELS[fixture.match_type] || fixture.match_type}
                          </span>
                        </div>
                        {/* Match title */}
                        <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                          HTCC{' '}
                          <span style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', letterSpacing: '1px' }}>VS</span>
                          {' '}{fixture.opponent.toUpperCase()}
                        </div>
                        {/* Line 2: Venue */}
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          📍 {fixture.venue}
                        </div>
                        {/* Line 3: Time */}
                        {fixture.match_time && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            🕐 {fixture.match_time.slice(0,5)}
                          </div>
                        )}
                      </div>

                      {isPublished ? (
                        <div style={{
                          fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
                          color: 'var(--green)', background: 'rgba(34,197,94,0.1)',
                          border: '1px solid rgba(34,197,94,0.25)',
                          padding: '4px 10px', borderRadius: '20px',
                          whiteSpace: 'nowrap',
                        }}>
                          ✓ SQUAD OUT
                        </div>
                      ) : (
                        <div style={{
                          fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
                          color: 'var(--text-faint)', background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          padding: '4px 10px', borderRadius: '20px',
                          whiteSpace: 'nowrap',
                        }}>
                          PENDING
                        </div>
                      )}
                    </div>

                    {/* Availability summary bar */}
                    <div style={{ marginTop: '14px' }}>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                        {[
                          { count: availCount,   color: 'var(--green)', label: 'Available' },
                          { count: tentCount,    color: 'var(--amber)', label: 'Tentative' },
                          { count: unavailCount, color: 'var(--red)',   label: 'Unavailable' },
                          { count: noReply,      color: 'rgba(255,255,255,0.15)', label: 'No reply' },
                        ].map(({ count, color, label }) => count > 0 && (
                          <div key={label} style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            fontSize: '11px', color: color, fontWeight: 600,
                          }}>
                            <div style={{
                              width: '7px', height: '7px', borderRadius: '50%',
                              background: color,
                            }} />
                            {count}
                          </div>
                        ))}
                      </div>

                      {/* Progress bar */}
                      {players.length > 0 && (
                        <div style={{
                          height: '4px', borderRadius: '2px',
                          background: 'rgba(255,255,255,0.06)',
                          display: 'flex', overflow: 'hidden',
                        }}>
                          {['available', 'tentative', 'unavailable'].map(s => {
                            const count = countStatus(fixture.id, s)
                            const pct   = (count / players.length) * 100
                            const color = s === 'available' ? 'var(--green)' : s === 'tentative' ? 'var(--amber)' : 'var(--red)'
                            return pct > 0 ? (
                              <div key={s} style={{ width: pct + '%', background: color, transition: 'width 0.4s' }} />
                            ) : null
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Player list */}
                  <div style={{ padding: '8px 0', maxHeight: '320px', overflowY: 'auto' }}>
                    {players.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-faint)' }}>
                        No players assigned to this team
                      </div>
                    ) : players.map((player, i) => {
                      const dot = player.status ? STATUS_DOT[player.status] : null

                      return (
                        <div key={player.id} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '8px 16px',
                          borderBottom: i < players.length - 1
                            ? '1px solid rgba(255,255,255,0.03)'
                            : 'none',
                          opacity: player.status === 'unavailable' ? 0.5 : 1,
                        }}>
                          {/* Squad position number or avatar */}
                          {player.inSquad ? (
                            <div style={{
                              width: '24px', height: '24px', borderRadius: '50%',
                              background: 'var(--gold)', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '10px', fontWeight: 700, color: 'var(--navy)',
                            }}>
                              {squad?.squad_members
                                ?.sort((a, b) => a.position_order - b.position_order)
                                ?.findIndex(sm => sm.player_id === player.id) + 1}
                            </div>
                          ) : (
                            <div style={{
                              width: '24px', height: '24px', borderRadius: '50%',
                              background: player.color + '22',
                              border: '1px solid ' + player.color + '44',
                              flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '9px', fontWeight: 700, color: player.color,
                            }}>
                              {getInitials(player.name)}
                            </div>
                          )}

                          <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', fontWeight: player.inSquad ? 700 : 400 }}>
                            {player.name}
                            {player.inSquad && (
                              <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--gold)' }}>
                                ★
                              </span>
                            )}
                          </div>

                          {/* Status dot */}
                          {dot ? (
                            <div style={{
                              width: '8px', height: '8px', borderRadius: '50%',
                              background: dot.color,
                              boxShadow: '0 0 5px ' + dot.color,
                              flexShrink: 0,
                            }} />
                          ) : (
                            <div style={{
                              width: '8px', height: '8px', borderRadius: '50%',
                              background: 'rgba(255,255,255,0.1)',
                              flexShrink: 0,
                            }} />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Card footer — squad action */}
                  <div style={{
                    padding: '12px 16px',
                    borderTop: '1px solid var(--navy-border)',
                    display: 'flex', gap: '8px',
                  }}>
                    <button
                      onClick={() => navigate('/captain/fixtures/' + fixture.id + '/squad')}
                      className="btn btn--primary"
                      style={{ flex: 1, fontSize: '13px', padding: '9px' }}
                    >
                      {isPublished ? '👁 View Squad' : '🏏 Select Squad'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Legend ── */}
        {!loading && fixtures.length > 0 && (
          <div style={{
            marginTop: '32px', display: 'flex', gap: '20px',
            flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-muted)',
          }}>
            {[
              { color: 'var(--green)', label: 'Available' },
              { color: 'var(--amber)', label: 'Tentative' },
              { color: 'var(--red)',   label: 'Unavailable' },
              { color: 'rgba(255,255,255,0.15)', label: 'No response' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: item.color,
                }} />
                {item.label}
              </div>
            ))}

            {/* Star legend item — uses character not dot */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--gold)', fontSize: '12px', lineHeight: 1 }}>★</span>
              In published squad
            </div>
          </div>
        )}

      </div>
    </AppShell>
  )
}
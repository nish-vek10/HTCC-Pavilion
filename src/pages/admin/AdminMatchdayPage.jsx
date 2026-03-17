// pavilion-web/src/pages/admin/AdminMatchdayPage.jsx
// Mirrors pavilion-app/src/screens/admin/AdminMatchdayScreen.jsx exactly.
// Saturday/Sunday tabs, date navigator, availability overview, prompt buttons.

import { useEffect, useState, useCallback, createPortal } from 'react'
import { createPortal as reactCreatePortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase }     from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell         from '../../components/layout/AppShell.jsx'
import ClubLoader       from '../../components/ui/ClubLoader.jsx'

// ─── CONFIGURABLE ─────────────────────────────────────────────────────────────
const SATURDAY_TEAMS = ['1st XI', '2nd XI', '3rd XI', '4th XI']
const SUNDAY_TEAMS   = ['Sunday XI']

// ── toLocalISO — avoids UTC/BST off-by-one (never use .toISOString()) ────────
function toLocalISO(d) {
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getNextSaturday() {
  const today = new Date()
  const diff  = today.getDay() === 6 ? 0 : (6 - today.getDay())
  const sat   = new Date(today)
  sat.setDate(today.getDate() + diff)
  return toLocalISO(sat)
}

function getNextSunday() {
  const today = new Date()
  const diff  = today.getDay() === 0 ? 0 : (7 - today.getDay())
  const sun   = new Date(today)
  sun.setDate(today.getDate() + diff)
  return toLocalISO(sun)
}

function getInitials(name) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

// ─── Prompt helper — mirrors pavilion-app/src/lib/promptHelper.js ─────────────

async function fetchPromptedPlayers(fixtureId) {
  const { data, error } = await supabase
    .from('availability_prompts')
    .select('player_id')
    .eq('fixture_id', fixtureId)
  if (error) { console.warn('[promptHelper] fetch error:', error.message); return {} }
  const set = {}
  data?.forEach(r => { set[`${fixtureId}_${r.player_id}`] = true })
  return set
}

async function sendPromptNotification(fixtureId, playerId, promptedBy) {
  // Upsert so re-prompting updates the timestamp
  const { error } = await supabase
    .from('availability_prompts')
    .upsert(
      { fixture_id: fixtureId, player_id: playerId, prompted_by: promptedBy },
      { onConflict: 'fixture_id,player_id' }
    )
  if (error) console.warn('[promptHelper] upsert error:', error.message)

  const notifTitle = '🏏 Availability Reminder'
  const notifBody  = 'Your captain needs your availability response for the upcoming match.'

  const { error: notifErr } = await supabase.from('notifications').insert({
    user_id:    playerId,
    type:       'availability_reminder',
    title:      notifTitle,
    body:       notifBody,
    fixture_id: fixtureId,
    read:       false,
  })
  if (notifErr) console.warn('[promptHelper] notification insert error:', notifErr.message)
}

export default function AdminMatchdayPage() {
  const navigate = useNavigate()
  const profile  = useAuthStore(state => state.profile)

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState('saturday')
  const [matchDate,    setMatchDate]    = useState(getNextSaturday())
  const [fixtures,     setFixtures]     = useState([])
  const [playerData,   setPlayerData]   = useState({}) // { [fixtureId]: { players, squad } }
  const [loading,      setLoading]      = useState(true)
  // { [fixtureId_playerId]: true } — tracks who has been prompted this session
  const [prompted,     setPrompted]     = useState({})
  // Re-prompt confirmation modal state
  const [promptModal,  setPromptModal]  = useState({
    open: false, fixtureId: null, playerId: null, playerName: '',
  })

  useEffect(() => { document.title = 'Pavilion · Matchday — Admin' }, [])
  useEffect(() => { if (profile?.id) loadMatchday() }, [profile?.id, matchDate, activeTab])

  // ── Tab change — jump to correct default date ──────────────────────────────
  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setMatchDate(tab === 'saturday' ? getNextSaturday() : getNextSunday())
  }

  // ── Date navigator — always jumps exactly 7 days, noon local time ──────────
  // Parse at noon local time to prevent DST edge cases shifting the date back
  const shiftDate = (direction) => {
    const d = new Date(matchDate + 'T12:00:00')
    d.setDate(d.getDate() + direction * 7)
    setMatchDate(toLocalISO(d))
  }

  // ── Main data loader ───────────────────────────────────────────────────────
  const loadMatchday = async () => {
    setLoading(true)
    setFixtures([])
    setPlayerData({})

    const teamNames = activeTab === 'saturday' ? SATURDAY_TEAMS : SUNDAY_TEAMS

    const { data: teamRows } = await supabase
      .from('teams').select('id, name').in('name', teamNames)

    if (!teamRows || teamRows.length === 0) { setLoading(false); return }

    const teamIds = teamRows.map(t => t.id)

    const { data: fixtureRows, error } = await supabase
      .from('fixtures')
      .select('*, teams(id, name)')
      .eq('match_date', matchDate)
      .in('team_id', teamIds)

    if (error) { toast.error('Failed to load fixtures'); setLoading(false); return }

    setFixtures(fixtureRows || [])

    // Fetch player data + prompted state for all fixtures in parallel
    await Promise.all((fixtureRows || []).map(f => fetchFixtureDetail(f.id, f.team_id)))

    const promptedMaps = await Promise.all(
      (fixtureRows || []).map(f => fetchPromptedPlayers(f.id))
    )
    setPrompted(Object.assign({}, ...promptedMaps))

    setLoading(false)
  }

  // ── Fetch players + availability + squad for one fixture ──────────────────
  const fetchFixtureDetail = async (fixtureId, teamId) => {
    const [{ data: members }, { data: avail }, { data: squadData }] = await Promise.all([
      supabase.from('team_members')
        .select('player_id, profiles(id, full_name, avatar_color)')
        .eq('team_id', teamId).eq('status', 'active'),
      supabase.from('availability')
        .select('player_id, status').eq('fixture_id', fixtureId),
      supabase.from('squads')
        .select('id, published, squad_members(player_id, position_order)')
        .eq('fixture_id', fixtureId).maybeSingle(),
    ])

    const availMap = {}
    avail?.forEach(a => { availMap[a.player_id] = a.status })
    const squadIds = new Set(squadData?.squad_members?.map(sm => sm.player_id) || [])

    const players = (members || []).map(m => ({
      id:      m.player_id,
      name:    m.profiles?.full_name || 'Unknown',
      color:   m.profiles?.avatar_color || '#F5C518',
      status:  availMap[m.player_id] || null,
      inSquad: squadIds.has(m.player_id),
    })).sort((a, b) => {
      const order = { available: 0, tentative: 1, unavailable: 2 }
      return (order[a.status] ?? 3) - (order[b.status] ?? 3)
    })

    setPlayerData(prev => ({ ...prev, [fixtureId]: { players, squad: squadData } }))
  }

  // ── Prompt a player — show re-prompt modal if already prompted ────────────
  const handlePrompt = async (fixtureId, playerId, playerName) => {
    const key = `${fixtureId}_${playerId}`
    if (prompted[key]) {
      setPromptModal({ open: true, fixtureId, playerId, playerName })
      return
    }
    await sendPrompt(fixtureId, playerId, playerName)
  }

  const sendPrompt = async (fixtureId, playerId, playerName) => {
    const key = `${fixtureId}_${playerId}`
    await sendPromptNotification(fixtureId, playerId, profile?.id)
    setPrompted(prev => ({ ...prev, [key]: true }))
    setPromptModal({ open: false, fixtureId: null, playerId: null, playerName: '' })
    toast.success(`Reminder sent to ${playerName}`)
  }

  // ── Count helpers ──────────────────────────────────────────────────────────
  const countStatus = (fixtureId, status) =>
    playerData[fixtureId]?.players?.filter(p => p.status === status).length || 0

  // ── Accent colour per tab — gold Saturday, blue Sunday ────────────────────
  const accent = activeTab === 'saturday' ? '#F5C518' : '#60A5FA'

  // ── Re-prompt modal portalled to body ─────────────────────────────────────
  const promptModalPortal = promptModal.open ? reactCreatePortal(
    <>
      <div
        onClick={() => setPromptModal({ open: false, fixtureId: null, playerId: null, playerName: '' })}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        }}
      />
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1001,
        background: 'var(--bg-surface)',
        border: '1px solid var(--navy-border)',
        borderRadius: '16px',
        padding: '28px',
        width: 'min(420px, calc(100vw - 48px))',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        animation: 'fade-in 0.15s ease',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '22px', letterSpacing: '1px',
          color: 'var(--text-primary)', marginBottom: '10px',
        }}>
          Prompt Again?
        </div>
        <div style={{
          fontSize: '14px', color: 'var(--text-muted)',
          lineHeight: 1.6, marginBottom: '24px',
        }}>
          Send another availability reminder to{' '}
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            {promptModal.playerName}
          </span>?
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setPromptModal({ open: false, fixtureId: null, playerId: null, playerName: '' })}
            style={{
              flex: 1, padding: '13px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: 'var(--red)', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => sendPrompt(promptModal.fixtureId, promptModal.playerId, promptModal.playerName)}
            style={{
              flex: 1, padding: '13px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(34,197,94,0.12)',
              border: '1px solid rgba(34,197,94,0.3)',
              color: 'var(--green)', fontSize: '14px', fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Prompt Again
          </button>
        </div>
      </div>
    </>,
    document.body
  ) : null

  return (
    <>
      {promptModalPortal}
      <AppShell>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>

          {/* ── Header ── */}
          <div style={{ marginBottom: '24px' }}>
            <div className="section-label">Administration</div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 4vw, 44px)',
              letterSpacing: '2px', lineHeight: 1,
            }}>
              MATCHDAY
            </h1>
          </div>

          {/* ── Saturday / Sunday tabs — gold vs blue, mirrors native tabRow ── */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {[
              { key: 'saturday', label: 'SATURDAY XIs', activeColor: '#F5C518', activeBg: 'rgba(245,197,24,0.12)', activeBorder: 'rgba(245,197,24,0.6)' },
              { key: 'sunday',   label: 'SUNDAY XI',    activeColor: '#60A5FA', activeBg: 'rgba(96,165,250,0.12)', activeBorder: 'rgba(96,165,250,0.6)'  },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                style={{
                  flex: 1, padding: '10px 0',
                  borderRadius: 'var(--radius-full)',
                  border: activeTab === tab.key
                    ? `1px solid ${tab.activeBorder}`
                    : '1px solid var(--navy-border)',
                  background: activeTab === tab.key ? tab.activeBg : 'transparent',
                  color: activeTab === tab.key ? tab.activeColor : 'var(--text-muted)',
                  fontSize: '13px', fontWeight: activeTab === tab.key ? 700 : 400,
                  cursor: 'pointer', transition: 'var(--transition)',
                  letterSpacing: '0.5px',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Date navigator — circular arrows + accent pill, mirrors native dateNav ── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            marginBottom: '28px',
          }}>
            {/* ‹ Prev arrow */}
            <button
              onClick={() => shiftDate(-1)}
              style={{
                width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                border: `1px solid ${accent}40`,
                background: 'rgba(255,255,255,0.03)',
                color: accent, fontSize: '22px', lineHeight: 1,
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                transition: 'var(--transition)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = `${accent}15`}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            >
              ‹
            </button>

            {/* Date pill — matches native datePill exactly */}
            <div style={{
              flex: 1, padding: '9px 16px', textAlign: 'center',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${accent}50`,
              background: `${accent}12`,
              fontFamily: 'var(--font-body)', fontWeight: 700,
              fontSize: '11px', letterSpacing: '1px',
              color: accent,
            }}>
              {format(parseISO(matchDate), 'EEE d MMM yyyy').toUpperCase()}
            </div>

            {/* › Next arrow */}
            <button
              onClick={() => shiftDate(1)}
              style={{
                width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                border: `1px solid ${accent}40`,
                background: 'rgba(255,255,255,0.03)',
                color: accent, fontSize: '22px', lineHeight: 1,
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                transition: 'var(--transition)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = `${accent}15`}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            >
              ›
            </button>
          </div>

          {/* ── Loading ── */}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <ClubLoader message="Loading matchday data…" size={64} />
            </div>
          )}

          {/* ── No fixtures empty state ── */}
          {!loading && fixtures.length === 0 && (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📅</div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '22px', letterSpacing: '1px', marginBottom: '8px',
              }}>
                NO FIXTURES
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                No {activeTab === 'saturday' ? 'Saturday' : 'Sunday'} fixtures on{' '}
                {format(parseISO(matchDate), 'EEE d MMM yyyy')}
              </div>
              <button className="btn btn--primary" onClick={() => navigate('/admin/fixtures')}>
                + Add Fixture
              </button>
            </div>
          )}

          {/* ── Fixture cards grid ── */}
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
                const data        = playerData[fixture.id]
                const players     = data?.players || []
                const squad       = data?.squad
                const isPublished = squad?.published || false

                const availCount   = countStatus(fixture.id, 'available')
                const tentCount    = countStatus(fixture.id, 'tentative')
                const unavailCount = countStatus(fixture.id, 'unavailable')
                const noReply      = players.filter(p => !p.status).length

                return (
                  <div key={fixture.id} className="card" style={{
                    overflow: 'hidden',
                    border: isPublished
                      ? '1px solid rgba(34,197,94,0.25)'
                      : '1px solid var(--navy-border)',
                  }}>

                    {/* ── Card header ── */}
                    <div style={{
                      padding: '16px 18px',
                      background: 'linear-gradient(135deg, var(--bg-elevated), var(--navy-mid))',
                      borderBottom: '1px solid var(--navy-border)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Tag row */}
                          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontFamily: 'var(--font-display)',
                              fontSize: '13px', letterSpacing: '1.5px',
                              color: 'var(--gold)', background: 'rgba(245,197,24,0.1)',
                              padding: '2px 8px', borderRadius: '4px',
                              border: '1px solid rgba(245,197,24,0.2)',
                            }}>
                              {fixture.teams?.name?.toUpperCase()}
                            </span>
                            <span style={{
                              fontSize: '11px', fontWeight: 700,
                              color: fixture.home_away === 'home' ? '#22C55E' : '#60A5FA',
                              background: fixture.home_away === 'home' ? 'rgba(34,197,94,0.1)' : 'rgba(96,165,250,0.1)',
                              border: fixture.home_away === 'home' ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(96,165,250,0.25)',
                              padding: '2px 8px', borderRadius: '4px',
                            }}>
                              {fixture.home_away === 'home' ? '🏠 HOME' : fixture.home_away === 'away' ? '✈️ AWAY' : '⚖️ NEUTRAL'}
                            </span>
                          </div>
                          {/* Match title */}
                          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                            HTCC{' '}
                            <span style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', letterSpacing: '1px' }}>VS</span>
                            {' '}{fixture.opponent?.toUpperCase()}
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '2px' }}>📍 {fixture.venue}</div>
                          {fixture.match_time && (
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#CBD5E1' }}>🕐 {fixture.match_time.slice(0, 5)}</div>
                          )}
                        </div>
                        {/* Squad status pill */}
                        <div style={{
                          fontSize: '9px', fontWeight: 700, letterSpacing: '1px',
                          color: isPublished ? '#22C55E' : 'var(--text-faint)',
                          background: isPublished ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                          border: isPublished ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.08)',
                          padding: '4px 10px', borderRadius: '20px',
                          whiteSpace: 'nowrap', flexShrink: 0,
                        }}>
                          {isPublished ? '✓ SQUAD OUT' : 'PENDING'}
                        </div>
                      </div>

                      {/* ── Availability summary counts ── */}
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px', marginBottom: '8px' }}>
                        {[
                          { count: availCount,   color: '#22C55E', label: 'Available'   },
                          { count: tentCount,    color: '#F97316', label: 'Tentative'   },
                          { count: unavailCount, color: '#EF4444', label: 'No'          },
                          { count: noReply,      color: 'rgba(255,255,255,0.2)', label: 'No reply' },
                        ].map(item => item.count > 0 && (
                          <div key={item.label} style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            fontSize: '11px', fontWeight: 600, color: item.color,
                          }}>
                            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: item.color }} />
                            {item.count} {item.label}
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
                            const color = s === 'available' ? '#22C55E' : s === 'tentative' ? '#F97316' : '#EF4444'
                            return pct > 0
                              ? <div key={s} style={{ width: pct + '%', background: color }} />
                              : null
                          })}
                        </div>
                      )}
                    </div>

                    {/* ── Player list — mirrors native playerList ── */}
                    <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                      {!data ? (
                        <div style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}>
                          <ClubLoader size={32} />
                        </div>
                      ) : players.length === 0 ? (
                        <div style={{
                          padding: '24px', textAlign: 'center',
                          fontSize: '13px', color: 'var(--text-faint)',
                        }}>
                          No players assigned to this team
                        </div>
                      ) : players.map((player, i) => {
                        const statusColor = player.status === 'available' ? '#22C55E'
                          : player.status === 'unavailable' ? '#EF4444'
                          : player.status === 'tentative'   ? '#F97316'
                          : null
                        const key = `${fixture.id}_${player.id}`
                        const isPrompted = prompted[key]

                        return (
                          <div
                            key={player.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '8px 16px',
                              borderBottom: i < players.length - 1
                                ? '1px solid rgba(255,255,255,0.03)' : 'none',
                              opacity: player.status === 'unavailable' ? 0.5 : 1,
                            }}
                          >
                            {/* Squad number badge or avatar */}
                            {player.inSquad ? (
                              <div style={{
                                width: '24px', height: '24px', borderRadius: '50%',
                                background: '#F5C518', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '10px', fontWeight: 700, color: '#0D1B2A',
                              }}>
                                {squad?.squad_members
                                  ?.sort((a, b) => (a.position_order || 0) - (b.position_order || 0))
                                  ?.findIndex(sm => sm.player_id === player.id) + 1 || '•'}
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

                            {/* Player name + squad star */}
                            <div style={{
                              flex: 1, fontSize: '13px',
                              color: 'var(--text-primary)',
                              fontWeight: player.inSquad ? 700 : 400,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {player.name}
                              {player.inSquad && (
                                <span style={{ marginLeft: '5px', fontSize: '10px', color: '#F5C518' }}>★</span>
                              )}
                            </div>

                            {/* Prompt button — only for no-reply players, mirrors native */}
                            {!player.status && (
                              <button
                                onClick={() => handlePrompt(fixture.id, player.id, player.name)}
                                style={{
                                  padding: '3px 9px',
                                  borderRadius: '4px', flexShrink: 0,
                                  background: isPrompted
                                    ? 'rgba(139,155,180,0.1)'
                                    : 'rgba(96,165,250,0.12)',
                                  border: isPrompted
                                    ? '1px solid rgba(139,155,180,0.25)'
                                    : '1px solid rgba(96,165,250,0.35)',
                                  color: isPrompted ? 'var(--text-muted)' : '#60A5FA',
                                  fontSize: '10px', fontWeight: 700,
                                  cursor: 'pointer', transition: 'var(--transition)',
                                }}
                              >
                                {isPrompted ? 'Prompted' : 'Prompt'}
                              </button>
                            )}

                            {/* Status dot */}
                            <div style={{
                              width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                              background: statusColor || 'rgba(255,255,255,0.1)',
                              boxShadow: statusColor ? `0 0 5px ${statusColor}` : 'none',
                            }} />
                          </div>
                        )
                      })}
                    </div>

                    {/* ── Footer — Select/View Squad button ── */}
                    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--navy-border)' }}>
                      <button
                        onClick={() => navigate('/captain/fixtures/' + fixture.id + '/squad')}
                        className="btn btn--primary"
                        style={{ width: '100%', fontSize: '13px', padding: '11px' }}
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
              marginTop: '28px', display: 'flex', gap: '16px',
              flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-muted)',
            }}>
              {[
                { color: '#22C55E', label: 'Available'   },
                { color: '#F97316', label: 'Tentative'   },
                { color: '#EF4444', label: 'Unavailable' },
                { color: 'rgba(255,255,255,0.15)', label: 'No response' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                  {item.label}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#F5C518', fontSize: '11px' }}>★</span>
                In published squad
              </div>
            </div>
          )}

        </div>
      </AppShell>
    </>
  )
}
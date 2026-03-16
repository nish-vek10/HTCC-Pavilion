// pavilion-web/src/pages/member/MatchConfirmationPage.jsx
// Shown when a player taps a squad_published notification.
// Displays the published squad + lets the player confirm Playing / Not Playing.

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase }     from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell         from '../../components/layout/AppShell.jsx'
import ClubLoader       from '../../components/ui/ClubLoader.jsx'
import { MATCH_TYPE_LABELS } from '../../lib/constants.js'

export default function MatchConfirmationPage() {
  const { fixtureId } = useParams()
  const navigate      = useNavigate()
  const profile       = useAuthStore(state => state.profile)

  const [fixture,      setFixture]      = useState(null)
  const [squad,        setSquad]        = useState([])   // squad_players rows
  const [confirmation, setConfirmation] = useState(null) // existing match_confirmation
  const [loading,      setLoading]      = useState(true)
  const [submitting,   setSubmitting]   = useState(false)

  useEffect(() => {
    if (profile?.id && fixtureId) loadData()
  }, [profile?.id, fixtureId])

  const loadData = async () => {
    setLoading(true)
    await Promise.all([fetchFixture(), fetchSquad(), fetchConfirmation()])
    setLoading(false)
  }

  // ── Fetch fixture details ──────────────────────────────────────────────────
  const fetchFixture = async () => {
    const { data } = await supabase
      .from('fixtures')
      .select('*, teams(id, name)')
      .eq('id', fixtureId)
      .single()
    if (data) setFixture(data)
  }

  // ── Fetch published squad with player profiles ────────────────────────────
  const fetchSquad = async () => {
    const { data: squadData } = await supabase
      .from('squads')
      .select('id')
      .eq('fixture_id', fixtureId)
      .eq('published', true)
      .single()
    if (!squadData) return

    const { data: players } = await supabase
      .from('squad_players')
      .select('player_id, position, profiles(id, full_name, avatar_color)')
      .eq('squad_id', squadData.id)
      .order('position')
    if (players) setSquad(players)
  }

  // ── Fetch any existing confirmation from this player ──────────────────────
  const fetchConfirmation = async () => {
    const { data } = await supabase
      .from('match_confirmations')
      .select('*')
      .eq('fixture_id', fixtureId)
      .eq('player_id', profile.id)
      .maybeSingle()
    if (data) setConfirmation(data)
  }

  // ── Submit Playing / Not Playing confirmation ─────────────────────────────
  const handleConfirm = async (playing) => {
    setSubmitting(true)
    try {
      if (confirmation) {
        // Switch existing answer
        const { data, error } = await supabase
          .from('match_confirmations')
          .update({ confirmed_playing: playing, confirmed_at: new Date().toISOString() })
          .eq('id', confirmation.id)
          .select().single()
        if (error) throw error
        setConfirmation(data)
      } else {
        // First time answering
        const { data, error } = await supabase
          .from('match_confirmations')
          .insert({ fixture_id: fixtureId, player_id: profile.id, confirmed_playing: playing })
          .select().single()
        if (error) throw error
        setConfirmation(data)
      }
      toast.success(playing ? '✅ Confirmed — you are playing!' : '↩️ Noted — you are not playing')
    } catch (err) {
      toast.error('Failed to save confirmation')
      console.error('[MatchConfirmation]', err)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isInSquad = squad.some(p => p.player_id === profile?.id)
  const initials  = name => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) return (
    <AppShell>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <ClubLoader message="Loading match details…" size={64} />
      </div>
    </AppShell>
  )

  // ── Fixture not found ─────────────────────────────────────────────────────
  if (!fixture) return (
    <AppShell>
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px' }}>
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏏</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '1px' }}>
            FIXTURE NOT FOUND
          </div>
        </div>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: '32px' }}>
          <div className="section-label">Match Day</div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 4vw, 44px)',
            letterSpacing: '2px', lineHeight: 1,
          }}>
            MATCH CONFIRMATION
          </h1>
        </div>

        {/* ── Fixture card ── */}
        <div className="card" style={{ overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ height: '3px', background: 'var(--gold)' }} />
          <div style={{ padding: '22px 24px' }}>
            {/* Badges */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '11px', fontWeight: 700, letterSpacing: '1px',
                color: 'var(--gold)', background: 'rgba(245,197,24,0.1)',
                padding: '3px 10px', borderRadius: '4px',
                border: '1px solid rgba(245,197,24,0.2)',
              }}>
                {fixture.teams?.name}
              </span>
              <span style={{
                fontSize: '11px', fontWeight: 700,
                color: fixture.home_away === 'home' ? 'var(--green)' : '#60A5FA',
                background: fixture.home_away === 'home' ? 'rgba(34,197,94,0.1)' : 'rgba(96,165,250,0.1)',
                border: fixture.home_away === 'home' ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(96,165,250,0.25)',
                padding: '3px 10px', borderRadius: '4px',
              }}>
                {fixture.home_away === 'home' ? '🏠 HOME' : fixture.home_away === 'away' ? '✈️ AWAY' : '⚖️ NEUTRAL'}
              </span>
              <span style={{
                fontSize: '11px', color: 'var(--text-muted)',
                background: 'rgba(255,255,255,0.04)',
                padding: '3px 10px', borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                {MATCH_TYPE_LABELS[fixture.match_type] || fixture.match_type}
              </span>
            </div>
            {/* Match title */}
            <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--text-primary)', marginBottom: '14px' }}>
              HTCC{' '}
              <span style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', letterSpacing: '1px' }}>VS</span>
              {' '}{fixture.opponent?.toUpperCase()}
            </div>
            {/* Meta row */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                📅 {format(parseISO(fixture.match_date), 'EEEE d MMMM yyyy').toUpperCase()}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                🕐 {fixture.match_time?.slice(0, 5)}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                📍 {fixture.venue}
              </span>
            </div>
          </div>
        </div>

        {/* ── Squad published banner ── */}
        <div style={{
          background: 'rgba(34,197,94,0.06)',
          border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px', marginBottom: '20px',
          fontSize: '13px', color: 'var(--green)', fontWeight: 600,
        }}>
          📋 The squad for this match has been published. Please confirm your availability for match day below.
        </div>

        {/* ── Not in squad notice ── */}
        {!isInSquad && squad.length > 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--navy-border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px', marginBottom: '20px',
            fontSize: '13px', color: 'var(--text-muted)',
          }}>
            ℹ️ You are not currently in the selected squad for this match.
          </div>
        )}

        {/* ── Confirmation card ── */}
        <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Are you playing in this match?
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Let your captain know your final match day availability.
          </div>

          {/* Playing / Not Playing buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {[
              { playing: true,  label: "✅  I'm Playing",  color: '#22C55E', fill: 'rgba(34,197,94,0.12)'  },
              { playing: false, label: '❌  Not Playing',  color: '#EF4444', fill: 'rgba(239,68,68,0.10)'  },
            ].map(opt => {
              const isActive = confirmation !== null && confirmation.confirmed_playing === opt.playing
              return (
                <button
                  key={String(opt.playing)}
                  onClick={() => handleConfirm(opt.playing)}
                  disabled={submitting}
                  style={{
                    flex: 1, padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${isActive ? opt.color : 'var(--navy-border)'}`,
                    background: isActive ? opt.fill : 'transparent',
                    color: isActive ? opt.color : 'var(--text-muted)',
                    fontSize: '15px', fontWeight: isActive ? 700 : 500,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    transition: 'var(--transition)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    boxShadow: isActive ? `0 0 16px ${opt.color}30` : 'none',
                  }}
                >
                  <div style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: isActive ? opt.color : 'rgba(255,255,255,0.2)',
                    flexShrink: 0,
                  }} />
                  {opt.label}
                </button>
              )
            })}
          </div>

          {/* Status confirmation */}
          {confirmation && (
            <div style={{
              marginTop: '16px', padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: confirmation.confirmed_playing
                ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
              border: `1px solid ${confirmation.confirmed_playing
                ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
              fontSize: '13px', fontWeight: 700, textAlign: 'center',
              color: confirmation.confirmed_playing ? '#22C55E' : '#EF4444',
            }}>
              {confirmation.confirmed_playing
                ? '✅ You have confirmed you are playing in this match'
                : '❌ You have confirmed you are not playing in this match'}
            </div>
          )}
        </div>

        {/* ── Published squad list ── */}
        {squad.length > 0 && (
          <div className="card" style={{ padding: '24px' }}>
            <div style={{
              fontWeight: 700, fontSize: '15px',
              color: 'var(--text-primary)', marginBottom: '16px',
            }}>
              Selected Squad — {squad.length} Players
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {squad.map((sp, i) => {
                const p       = sp.profiles
                const color   = p?.avatar_color || '#F5C518'
                const isMe    = p?.id === profile?.id
                return (
                  <div key={sp.player_id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: isMe
                      ? 'rgba(245,197,24,0.06)' : 'rgba(255,255,255,0.02)',
                    border: isMe
                      ? '1px solid rgba(245,197,24,0.2)' : '1px solid var(--navy-border)',
                  }}>
                    {/* Number */}
                    <div style={{
                      fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)',
                      width: '18px', flexShrink: 0, textAlign: 'right',
                    }}>
                      {i + 1}
                    </div>
                    {/* Avatar */}
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: `${color}22`, border: `1.5px solid ${color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700, color, flexShrink: 0,
                    }}>
                      {initials(p?.full_name)}
                    </div>
                    {/* Name */}
                    <div style={{
                      flex: 1, fontSize: '14px',
                      fontWeight: isMe ? 700 : 500,
                      color: isMe ? 'var(--gold)' : 'var(--text-primary)',
                    }}>
                      {p?.full_name}{isMe && ' (You)'}
                    </div>
                    {/* Position */}
                    {sp.position && (
                      <div style={{
                        fontSize: '11px', color: 'var(--text-muted)',
                        background: 'rgba(255,255,255,0.04)',
                        padding: '2px 8px', borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        {sp.position}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Back link ── */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button
            onClick={() => navigate('/fixture/' + fixtureId)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '13px', color: 'var(--text-muted)',
              transition: 'var(--transition)',
            }}
          >
            ← View full fixture details
          </button>
        </div>

      </div>
    </AppShell>
  )
}
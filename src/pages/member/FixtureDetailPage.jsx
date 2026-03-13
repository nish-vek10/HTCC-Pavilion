// pavilion-web/src/pages/member/FixtureDetailPage.jsx

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell from '../../components/layout/AppShell.jsx'
import { AVAILABILITY_CONFIG, MATCH_TYPE_LABELS } from '../../lib/constants.js'

export default function FixtureDetailPage() {
  const { fixtureId } = useParams()
  const navigate      = useNavigate()
  const profile       = useAuthStore(state => state.profile)

  const [fixture,      setFixture]      = useState(null)
  const [squad,        setSquad]        = useState(null)
  const [squadMembers, setSquadMembers] = useState([])
  const [myStatus,     setMyStatus]     = useState(null)
  const [submitting,   setSubmitting]   = useState(false)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => { if (profile?.id && fixtureId) loadAll() }, [profile?.id, fixtureId])

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([fetchFixture(), fetchSquad(), fetchMyAvailability()])
    setLoading(false)
  }

  const fetchFixture = async () => {
    const { data, error } = await supabase
      .from('fixtures')
      .select('*, teams(name)')
      .eq('id', fixtureId)
      .single()

    if (error || !data) { toast.error('Fixture not found'); navigate(-1); return }
    setFixture(data)
    document.title = 'Pavilion · vs ' + data.opponent
  }

  const fetchSquad = async () => {
    const { data } = await supabase
      .from('squads')
      .select('id, published, published_at, squad_members(player_id, position_order, profiles(full_name, avatar_color))')
      .eq('fixture_id', fixtureId)
      .eq('published', true)
      .single()

    if (data) {
      setSquad(data)
      const sorted = [...(data.squad_members || [])]
        .sort((a, b) => (a.position_order || 0) - (b.position_order || 0))
      setSquadMembers(sorted)
    }
  }

  const fetchMyAvailability = async () => {
    const { data } = await supabase
      .from('availability')
      .select('status')
      .eq('fixture_id', fixtureId)
      .eq('player_id', profile.id)
      .single()

    if (data) setMyStatus(data.status)
  }

  // ── Set / switch / unset availability ──
  // Clicking the already-active status deselects it (deletes the record)
  const handleAvailability = async (status) => {
    setSubmitting(true)
    try {
      if (myStatus === status) {
        // ── Toggle off: delete the record ──
        const { error } = await supabase
          .from('availability')
          .delete()
          .eq('fixture_id', fixtureId)
          .eq('player_id', profile.id)
        if (error) throw error
        setMyStatus(null)
        toast('Availability cleared', { icon: '↩️' })
      } else {
        // ── New or switched response ──
        const { error } = await supabase
          .from('availability')
          .upsert({
            fixture_id: fixtureId,
            player_id:  profile.id,
            status,
          }, { onConflict: 'fixture_id,player_id' })
        if (error) throw error
        setMyStatus(status)
        toast.success('Availability updated')
      }
    } catch (err) {
      toast.error('Failed to update: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const getInitials = (name) =>
    name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  const isInSquad = squadMembers.some(sm => sm.player_id === profile?.id)

  if (loading) {
    return (
      <AppShell>
        <div style={{ textAlign: 'center', padding: '100px', color: 'var(--text-muted)' }}>
          Loading fixture…
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="page-inner" style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Back ── */}
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: '13px',
          marginBottom: '20px', padding: 0,
        }}>
          ← Back
        </button>

        {/* ── Fixture header ── */}
        <div className="card" style={{
          padding: '28px',
          marginBottom: '24px',
          background: 'linear-gradient(135deg, var(--navy-card), var(--navy-mid))',
          border: '1px solid var(--navy-border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '11px', fontWeight: 700, letterSpacing: '1px',
                  color: 'var(--gold)', background: 'rgba(245,197,24,0.1)',
                  padding: '3px 10px', borderRadius: '4px',
                  border: '1px solid rgba(245,197,24,0.2)',
                }}>
                  {fixture?.teams?.name}
                </span>
                <span style={{
                  fontSize: '11px', color: 'var(--text-muted)',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '3px 10px', borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  {MATCH_TYPE_LABELS[fixture?.match_type] || fixture?.match_type}
                </span>
                <span style={{
                  fontSize: '11px', fontWeight: 600,
                  color: fixture?.home_away === 'home' ? 'var(--green)' : 'var(--amber)',
                  background: fixture?.home_away === 'home' ? 'rgba(34,197,94,0.08)' : 'rgba(245,197,24,0.08)',
                  padding: '3px 10px', borderRadius: '4px',
                  border: '1px solid ' + (fixture?.home_away === 'home' ? 'rgba(34,197,94,0.2)' : 'rgba(245,197,24,0.2)'),
                }}>
                  {fixture?.home_away === 'home' ? '🏠 Home' : fixture?.home_away === 'away' ? '✈️ Away' : '⚖️ Neutral'}
                </span>
              </div>

              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(24px, 5vw, 38px)',
                letterSpacing: '2px', lineHeight: 1,
                marginBottom: '14px',
              }}>
                HTCC <span style={{ color: 'var(--gold)' }}>VS</span> {fixture?.opponent?.toUpperCase()}
              </h1>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📅 <span>{fixture && format(parseISO(fixture.match_date), 'EEEE d MMMM yyyy')}</span>
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🕐 <span>{fixture?.match_time?.slice(0, 5)}</span>
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📍 <span>{fixture?.venue}</span>
                </div>
              </div>
            </div>

            {/* Date block */}
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '64px', lineHeight: 1,
                color: 'var(--gold)', letterSpacing: '2px',
              }}>
                {fixture && format(parseISO(fixture.match_date), 'dd')}
              </div>
              <div style={{ fontSize: '16px', color: 'var(--text-muted)', letterSpacing: '2px' }}>
                {fixture && format(parseISO(fixture.match_date), 'MMM').toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* ── My Availability ── */}
        <div className="card" style={{ padding: '22px', marginBottom: '24px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '14px', letterSpacing: '0.5px' }}>
            My Availability
          </div>

          <div className="avail-detail-row" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {Object.entries(AVAILABILITY_CONFIG).map(([status, cfg]) => {
              const isActive = myStatus === status
              return (
                <button
                  key={status}
                  onClick={() => !submitting && handleAvailability(status)}
                  disabled={submitting}
                  style={{
                    flex: 1, minWidth: '100px',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: isActive
                      ? '2px solid ' + cfg.color
                      : '1px solid var(--navy-border)',
                    background: isActive ? cfg.fillColor : 'transparent',
                    color: isActive ? cfg.color : 'var(--text-muted)',
                    fontSize: '13px', fontWeight: isActive ? 700 : 400,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    transition: 'var(--transition)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '4px',
                  }}
                >
                  <div style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: cfg.color,
                    boxShadow: isActive ? '0 0 8px ' + cfg.color : 'none',
                  }} />
                  {cfg.label}
                </button>
              )
            })}
          </div>

          {isInSquad && (
            <div style={{
              marginTop: '14px', padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245,197,24,0.06)',
              border: '1px solid rgba(245,197,24,0.2)',
              fontSize: '13px', color: 'var(--gold)',
              fontWeight: 600, textAlign: 'center',
            }}>
              ★ You are in the Published Squad for this Match!
            </div>
          )}
        </div>

        {/* ── Published Squad ── */}
        {squad ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{
              padding: '16px 20px',
              background: 'linear-gradient(135deg, rgba(34,197,94,0.06), var(--bg-elevated))',
              borderBottom: '1px solid rgba(34,197,94,0.15)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px', letterSpacing: '1.5px',
              }}>
                SELECTED SQUAD
              </div>
              <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 600 }}>
                ✓ Published {squad.published_at && format(parseISO(squad.published_at), 'EEE d MMM, HH:mm')}
              </div>
            </div>

            <div style={{ padding: '8px 0' }}>
              {squadMembers.map((sm, index) => {
                const isMe = sm.player_id === profile?.id
                return (
                  <div key={sm.player_id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 20px',
                    background: isMe ? 'rgba(245,197,24,0.04)' : 'transparent',
                    borderBottom: index < squadMembers.length - 1
                      ? '1px solid rgba(255,255,255,0.04)'
                      : 'none',
                  }}>
                    {/* Position number */}
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: isMe ? 'var(--gold)' : 'rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 700,
                      color: isMe ? 'var(--navy)' : 'var(--text-muted)',
                      flexShrink: 0,
                    }}>
                      {index + 1}
                    </div>

                    {/* Avatar */}
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: (sm.profiles?.avatar_color || '#F5C518') + '22',
                      border: '1px solid ' + (sm.profiles?.avatar_color || '#F5C518') + '44',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 700,
                      color: sm.profiles?.avatar_color || '#F5C518',
                      flexShrink: 0,
                    }}>
                      {getInitials(sm.profiles?.full_name)}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: isMe ? 700 : 500,
                        color: isMe ? 'var(--gold)' : 'var(--text-primary)',
                      }}>
                        {sm.profiles?.full_name}
                        {isMe && <span style={{ marginLeft: '8px', fontSize: '11px' }}>← You</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🏏</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Squad Not Yet Announced!
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              The Captain will Publish the Squad before Matchday!
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
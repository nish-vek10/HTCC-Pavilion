// pavilion-web/src/pages/admin/AdminTrainingDetailPage.jsx
// Mirrors pavilion-app/src/screens/admin/TrainingDetailScreen.jsx
// Shows 2x2 stats, progress bar, prompt all, player sections (available/unavailable/no reply)

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase }     from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell         from '../../components/layout/AppShell.jsx'
import ClubLoader       from '../../components/ui/ClubLoader.jsx'

function getInitials(name) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

export default function AdminTrainingDetailPage() {
  const { sessionId } = useParams()
  const navigate      = useNavigate()
  const profile       = useAuthStore(state => state.profile)

  const [session,   setSession]   = useState(null)
  const [players,   setPlayers]   = useState([])
  const [avail,     setAvail]     = useState({}) // { [playerId]: 'available' | 'unavailable' }
  const [loading,   setLoading]   = useState(true)
  const [prompting, setPrompting] = useState(false)

  useEffect(() => { document.title = 'Pavilion · Training Session — Admin' }, [])
  useEffect(() => { if (profile?.id && sessionId) loadAll() }, [profile?.id, sessionId])

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([fetchSession(), fetchPlayers()])
    setLoading(false)
  }

  const fetchSession = async () => {
    const { data } = await supabase
      .from('training_sessions').select('*').eq('id', sessionId).single()
    if (data) setSession(data)
  }

  const fetchPlayers = async () => {
    // All active members — exclude pending
    const { data: members } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_color, role')
      .neq('role', 'pending')
      .order('full_name')

    const { data: availability } = await supabase
      .from('training_availability')
      .select('player_id, status')
      .eq('session_id', sessionId)

    const availMap = {}
    availability?.forEach(a => { availMap[a.player_id] = a.status })

    setPlayers(members || [])
    setAvail(availMap)
  }

  // ── Prompt all non-responders — mirrors native handlePromptAll ────────────
  const handlePromptAll = async () => {
    const noReply = players.filter(p => !avail[p.id])
    if (noReply.length === 0) {
      toast('All members have set their availability', { icon: '✅' })
      return
    }

    setPrompting(true)
    try {
      const notifTitle = '🏋️ Training Availability'
      const notifBody  = `Please update your availability for ${session?.title} on ${
        session?.session_date
          ? format(parseISO(session.session_date), 'EEE d MMM')
          : 'upcoming session'
      }.`

      await supabase.from('notifications').insert(
        noReply.map(p => ({
          user_id:            p.id,
          type:               'training_reminder',
          title:              notifTitle,
          body:               notifBody,
          training_session_id: sessionId,
          read:               false,
        }))
      )
      toast.success(`Reminder sent to ${noReply.length} player${noReply.length !== 1 ? 's' : ''}`)
    } catch (err) {
      toast.error('Failed to send reminders: ' + err.message)
    } finally {
      setPrompting(false)
    }
  }

  // ── Derived — sorted A-Z per section ─────────────────────────────────────
  const sortAZ        = (a, b) => (a.full_name || '').localeCompare(b.full_name || '')
  const totalPlayers  = players.length
  const availableList = players.filter(p => avail[p.id] === 'available').sort(sortAZ)
  const unavailList   = players.filter(p => avail[p.id] === 'unavailable').sort(sortAZ)
  const notSetList    = players.filter(p => !avail[p.id]).sort(sortAZ)

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <ClubLoader message="Loading session…" size={64} />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Back ── */}
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px', padding: 0,
        }}>
          ← Back to Sessions
        </button>

        {/* ── Session header — mirrors native sessionHeader ── */}
        <div style={{ marginBottom: '28px' }}>
          <div className="section-label">Training Session</div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(22px, 4vw, 32px)',
            letterSpacing: '1px', lineHeight: 1,
            marginBottom: '12px',
          }}>
            {session?.title?.toUpperCase()}
          </h1>
          <div style={{ fontWeight: 600, fontSize: '13px', color: '#CBD5E1', marginBottom: '4px' }}>
            📅 {session && format(parseISO(session.session_date), 'EEEE d MMMM yyyy')}
          </div>
          <div style={{ fontWeight: 600, fontSize: '13px', color: '#CBD5E1', marginBottom: '4px' }}>
            🕐 {session?.session_time?.slice(0, 5)}
          </div>
          <div style={{ fontWeight: 600, fontSize: '13px', color: '#CBD5E1' }}>
            📍 {session?.venue}
          </div>
        </div>

        {/* ── 2x2 stats — mirrors native statsGrid ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '12px', marginBottom: '20px',
        }}>
          {[
            { label: 'Total Players', value: totalPlayers,         color: '#8B9BB4' },
            { label: 'Available',     value: availableList.length, color: '#22C55E' },
            { label: 'Unavailable',   value: unavailList.length,   color: '#EF4444' },
            { label: 'Not Responded', value: notSetList.length,    color: '#F97316' },
          ].map(stat => (
            <div key={stat.label} className="card" style={{
              padding: '16px',
              borderTop: `3px solid ${stat.color}`,
            }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '36px', letterSpacing: '1px',
                color: stat.color, lineHeight: '40px',
              }}>
                {stat.value}
              </div>
              <div style={{ fontWeight: 700, fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Progress bar ── */}
        {totalPlayers > 0 && (
          <div style={{
            height: '6px', background: 'rgba(255,255,255,0.06)',
            borderRadius: '3px', overflow: 'hidden',
            display: 'flex', marginBottom: '20px',
          }}>
            {availableList.length > 0 && (
              <div style={{ flex: availableList.length, background: '#22C55E', height: '100%' }} />
            )}
            {unavailList.length > 0 && (
              <div style={{ flex: unavailList.length, background: '#EF4444', height: '100%' }} />
            )}
            {notSetList.length > 0 && (
              <div style={{ flex: notSetList.length, background: 'rgba(255,255,255,0.08)', height: '100%' }} />
            )}
          </div>
        )}

        {/* ── Prompt all — only shown if there are non-responders ── */}
        {notSetList.length > 0 && (
          <button
            onClick={handlePromptAll}
            disabled={prompting}
            style={{
              display: 'block', width: '100%', padding: '13px',
              borderRadius: 'var(--radius-md)', marginBottom: '28px',
              background: 'rgba(96,165,250,0.1)',
              border: '1px solid rgba(96,165,250,0.3)',
              color: '#60A5FA', fontSize: '14px', fontWeight: 700,
              cursor: prompting ? 'not-allowed' : 'pointer',
              opacity: prompting ? 0.6 : 1,
              transition: 'var(--transition)',
            }}
          >
            {prompting
              ? 'Sending reminders…'
              : `🔔 Prompt ${notSetList.length} Non-Responder${notSetList.length !== 1 ? 's' : ''}`}
          </button>
        )}

        {/* ── Player sections — Available / Unavailable / Not Responded ── */}
        {[
          { list: availableList, label: 'Available',     dot: '#22C55E' },
          { list: unavailList,   label: 'Unavailable',   dot: '#EF4444' },
          { list: notSetList,    label: 'Not Responded', dot: 'rgba(255,255,255,0.2)' },
        ].filter(s => s.list.length > 0).map(section => (
          <div key={section.label} style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--navy-border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden', marginBottom: '12px',
          }}>
            {/* Section header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 16px',
              borderBottom: '1px solid var(--navy-border)',
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: section.dot, flexShrink: 0 }} />
              <div style={{ fontWeight: 700, fontSize: '11px', letterSpacing: '1.5px', color: 'var(--text-muted)' }}>
                {section.label} · {section.list.length}
              </div>
            </div>

            {/* Player rows */}
            {section.list.map((player, i) => (
              <div key={player.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 16px',
                borderBottom: i < section.list.length - 1
                  ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                  background: (player.avatar_color || '#F5C518') + '22',
                  border: '1px solid ' + (player.avatar_color || '#F5C518') + '44',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 700,
                  color: player.avatar_color || '#F5C518',
                }}>
                  {getInitials(player.full_name)}
                </div>
                <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {player.full_name}
                </div>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: section.dot,
                  boxShadow: section.dot !== 'rgba(255,255,255,0.2)' ? `0 0 5px ${section.dot}` : 'none',
                  flexShrink: 0,
                }} />
              </div>
            ))}
          </div>
        ))}

      </div>
    </AppShell>
  )
}
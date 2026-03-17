// pavilion-web/src/pages/admin/AdminTrainingPage.jsx
// Mirrors pavilion-app/src/screens/admin/AdminTrainingScreen.jsx
// Training session management — create, list, delete sessions
// embedded=true → skip AppShell (used inside AdminSessionsPage combined view)

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, addWeeks, isBefore, isEqual } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase }     from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell         from '../../components/layout/AppShell.jsx'
import ConfirmModal     from '../../components/ui/ConfirmModal.jsx'
import ClubLoader       from '../../components/ui/ClubLoader.jsx'

// ─── CONFIGURABLE ─────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  title:        '',
  venue:        '',
  session_date: '',
  session_time: '17:30',
  is_recurring: false,
  end_date:     '',
}

// ── Smart default time based on day of week — matches native defaultTimeForDate
function defaultTimeForDate(isoDate) {
  if (!isoDate) return '17:30'
  const day = new Date(isoDate + 'T12:00:00').getDay()
  return day === 6 ? '15:00' : '17:30' // Saturday → 15:00, else 17:30
}

// ── Generate weekly occurrences up to end_date ────────────────────────────────
function generateOccurrences(baseDate, endDate, time, title, venue) {
  const dates   = []
  let current   = new Date(baseDate + 'T12:00:00')
  const end     = new Date(endDate + 'T12:00:00')
  while (isBefore(current, end) || isEqual(current, end)) {
    dates.push({
      title, venue,
      session_date: current.toISOString().split('T')[0],
      session_time: time,
    })
    current = addWeeks(current, 1)
  }
  return dates
}

export default function AdminTrainingPage({ embedded = false }) {
  const navigate = useNavigate()
  const profile  = useAuthStore(state => state.profile)

  const [sessions,      setSessions]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [showForm,      setShowForm]      = useState(false)
  const [form,          setForm]          = useState(EMPTY_FORM)
  const [submitting,    setSubmitting]    = useState(false)
  const [deleteModal,   setDeleteModal]   = useState({ open: false, session: null })

  useEffect(() => { if (profile?.id) loadSessions() }, [profile?.id])

  const loadSessions = async () => {
    setLoading(true)
    // toLocalISO for today — avoids BST/UTC off-by-one
    const today = new Date()
    const todayISO = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    const { data } = await supabase
      .from('training_sessions')
      .select('*')
      .gte('session_date', todayISO)
      .order('session_date', { ascending: true })
    if (data) setSessions(data)
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim())    { toast.error('Title is required'); return }
    if (!form.venue.trim())    { toast.error('Venue is required'); return }
    if (!form.session_date)    { toast.error('Date is required'); return }
    if (form.is_recurring && !form.end_date) { toast.error('End date required for recurring sessions'); return }

    setSubmitting(true)
    try {
      if (!form.is_recurring) {
        // Single session
        const { error } = await supabase.from('training_sessions').insert({
          title:        form.title.trim(),
          venue:        form.venue.trim(),
          session_date: form.session_date,
          session_time: form.session_time,
          created_by:   profile.id,
        })
        if (error) throw error
        toast.success('Training session created')
      } else {
        // Recurring — create parent then children
        const { data: parent, error: parentErr } = await supabase
          .from('training_sessions')
          .insert({
            title:        form.title.trim(),
            venue:        form.venue.trim(),
            session_date: form.session_date,
            session_time: form.session_time,
            created_by:   profile.id,
          })
          .select().single()
        if (parentErr) throw parentErr

        const occurrences = generateOccurrences(
          form.session_date, form.end_date,
          form.session_time, form.title.trim(), form.venue.trim()
        ).slice(1) // skip first — already created as parent

        if (occurrences.length > 0) {
          const { error: childErr } = await supabase.from('training_sessions').insert(
            occurrences.map(o => ({ ...o, parent_id: parent.id, created_by: profile.id }))
          )
          if (childErr) throw childErr
        }
        toast.success(`Recurring sessions created`)
      }

      setForm(EMPTY_FORM)
      setShowForm(false)
      await loadSessions()
    } catch (err) {
      toast.error('Failed to create session: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    const session = deleteModal.session
    setDeleteModal({ open: false, session: null })
    if (!session) return

    if (session.parent_id === null) {
      // Delete parent + all children (cascade)
      await supabase.from('training_sessions').delete().eq('id', session.id)
      await supabase.from('training_sessions').delete().eq('parent_id', session.id)
    } else {
      await supabase.from('training_sessions').delete().eq('id', session.id)
    }
    toast.success('Session deleted')
    await loadSessions()
  }

  // Group sessions by month
  const grouped = sessions.reduce((acc, s) => {
    const month = format(parseISO(s.session_date), 'MMMM yyyy')
    if (!acc[month]) acc[month] = []
    acc[month].push(s)
    return acc
  }, {})

  const content = (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: embedded ? '0' : '32px 24px' }}>

      {/* ── Header ── */}
      {!embedded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div>
            <div className="section-label">Administration</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '2px', lineHeight: 1 }}>
              TRAINING
            </h1>
          </div>
          <button className="btn btn--primary" onClick={() => { setShowForm(v => !v); setForm(EMPTY_FORM) }}>
            {showForm ? '✕ Cancel' : '+ Add Session'}
          </button>
        </div>
      )}

      {/* ── Embedded header ── */}
      {embedded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '1px', color: 'var(--text-primary)' }}>
            TRAINING SESSIONS
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setForm(EMPTY_FORM) }}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-md)',
              background: showForm ? 'rgba(239,68,68,0.1)' : 'var(--gold)',
              border: showForm ? '1px solid rgba(239,68,68,0.3)' : 'none',
              color: showForm ? 'var(--red)' : 'var(--navy)',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {showForm ? '✕ Cancel' : '+ Add Session'}
          </button>
        </div>
      )}

      {/* ── Create form ── */}
      {showForm && (
        <div className="card" style={{
          padding: '24px', marginBottom: '28px',
          border: '1px solid rgba(245,197,24,0.2)',
          background: 'rgba(245,197,24,0.02)',
        }}>
          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--gold)', marginBottom: '20px' }}>
            ➕ New Training Session
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', minWidth: 0 }}>

              <div style={{ gridColumn: '1 / -1' }}>
                <label className="input-label">Title</label>
                <input className="input" type="text" placeholder="e.g. Pre-Season Training"
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label className="input-label">Venue</label>
                <input className="input" type="text" placeholder="e.g. Rayners Lane"
                  value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} required />
              </div>

              <div style={{ minWidth: 0 }}>
                <label className="input-label">Date</label>
                <input
                  className="input" type="date"
                  value={form.session_date}
                  onChange={e => {
                    const d = e.target.value
                    setForm(f => ({ ...f, session_date: d, session_time: defaultTimeForDate(d) }))
                  }}
                  required
                  style={{
                    width: '100%', boxSizing: 'border-box', colorScheme: 'dark',
                    color: form.session_date ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <label className="input-label">Start Time</label>
                <input
                  className="input" type="time"
                  value={form.session_time}
                  onChange={e => setForm(f => ({ ...f, session_time: e.target.value }))}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', colorScheme: 'dark' }}
                />
              </div>
            </div>

            {/* ── Recurring toggle — mirrors native recurringToggle ── */}
            <div
              onClick={() => setForm(f => ({ ...f, is_recurring: !f.is_recurring }))}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', marginTop: '16px',
                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                background: form.is_recurring ? 'rgba(245,197,24,0.04)' : 'rgba(255,255,255,0.03)',
                border: form.is_recurring ? '1px solid rgba(245,197,24,0.3)' : '1px solid var(--navy-border)',
                transition: 'var(--transition)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>🔁</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: form.is_recurring ? 'var(--gold)' : 'var(--text-muted)' }}>
                    Recurring Weekly
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px' }}>
                    Repeats every week on the same day
                  </div>
                </div>
              </div>
              {/* Toggle pill */}
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: form.is_recurring ? 'var(--gold)' : 'var(--navy-border)',
                transition: 'var(--transition)',
              }} />
            </div>

            {/* End date — only shown when recurring */}
            {form.is_recurring && (
              <div style={{ marginTop: '16px' }}>
                <label className="input-label">End Date</label>
                <input
                  className="input" type="date"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  required
                  style={{
                    width: '100%', boxSizing: 'border-box', colorScheme: 'dark',
                    color: form.end_date ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button type="submit" className="btn btn--primary"
                style={{ minWidth: '150px' }} disabled={submitting}>
                {submitting ? 'Creating…' : 'Create Session'}
              </button>
              <button type="button" className="btn btn--ghost"
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Sessions list ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <ClubLoader message="Loading sessions…" size={64} />
        </div>
      ) : sessions.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏋️</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '1px', marginBottom: '8px' }}>
            NO UPCOMING SESSIONS
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Tap "+ Add Session" to schedule training
          </div>
        </div>
      ) : (
        Object.entries(grouped).map(([month, monthSessions]) => (
          <div key={month} style={{ marginBottom: '28px' }}>
            {/* Month header */}
            <div style={{
              fontWeight: 700, fontSize: '11px', letterSpacing: '2px',
              color: 'var(--gold)', textTransform: 'uppercase',
              paddingBottom: '10px', marginBottom: '12px',
              borderBottom: '1px solid var(--navy-border)',
            }}>
              {month}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {monthSessions.map(session => (
                // ── Session card — mirrors native sessionCard ──
                <div key={session.id} style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--navy-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: '14px',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                }}
                  onClick={() => navigate(`/admin/sessions/${session.id}`)}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(245,197,24,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--navy-border)'}
                >
                  {/* Date block */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    flexShrink: 0, paddingRight: '14px', minWidth: '44px',
                    borderRight: '1px solid var(--navy-border)',
                  }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: 'var(--gold)', lineHeight: '28px' }}>
                      {format(parseISO(session.session_date), 'dd')}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px' }}>
                      {format(parseISO(session.session_date), 'EEE').toUpperCase()}
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {session.parent_id !== null && (
                      <div style={{
                        display: 'inline-block', marginBottom: '4px',
                        fontSize: '9px', fontWeight: 700, letterSpacing: '1px',
                        color: 'var(--gold)', background: 'rgba(245,197,24,0.08)',
                        border: '1px solid rgba(245,197,24,0.2)',
                        padding: '2px 6px', borderRadius: '4px',
                      }}>
                        🔁 RECURRING
                      </div>
                    )}
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: '3px' }}>
                      {session.title}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '11px', color: '#CBD5E1', marginBottom: '2px' }}>
                      📍 {session.venue}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '11px', color: '#CBD5E1' }}>
                      🕐 {session.session_time?.slice(0, 5)}
                    </div>
                  </div>

                  {/* Right: arrow + delete */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--gold)', lineHeight: 1 }}>›</span>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteModal({ open: true, session }) }}
                      style={{
                        padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                        background: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        color: 'var(--red)', fontSize: '11px', fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Portalled delete confirm */}
      <ConfirmModal
        isOpen={deleteModal.open}
        title="Delete Training Session"
        message={deleteModal.session?.parent_id === null
          ? 'Delete this session and all its recurring occurrences?'
          : 'Delete just this single session?'}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmDanger={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal({ open: false, session: null })}
      />
    </div>
  )

  if (embedded) return content
  return <AppShell>{content}</AppShell>
}
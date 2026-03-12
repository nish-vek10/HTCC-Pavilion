// pavilion-web/src/pages/admin/AdminFixturesPage.jsx

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell from '../../components/layout/AppShell.jsx'
import ConfirmModal from '../../components/ui/ConfirmModal.jsx'
import { PAGE_TITLES, MATCH_TYPE_LABELS } from '../../lib/constants.js'

// ─── CONFIGURABLE ─────────────────────────────────
const EMPTY_FORM = {
  team_id:    '',
  opponent:   '',
  venue:      '',
  match_date: '',
  match_time: '12:30',
  match_type: 'league',
  home_away:  'home',
}

export default function AdminFixturesPage() {
  const navigate = useNavigate()
  const profile  = useAuthStore(state => state.profile)

  const [fixtures,    setFixtures]    = useState([])
  const [teams,       setTeams]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [editingId,   setEditingId]   = useState(null)
  const [submitting,  setSubmitting]  = useState(false)
  const [deleteModal, setDeleteModal] = useState({ open: false, fixtureId: null, opponent: '' })

  useEffect(() => { document.title = PAGE_TITLES.ADMIN_FIXTURES }, [])
  useEffect(() => { if (profile?.id) loadAll() }, [profile?.id])

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([fetchFixtures(), fetchTeams()])
    setLoading(false)
  }

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from('teams').select('id, name').order('name')
    if (error) { toast.error('Failed to load teams'); return }
    if (data) setTeams(data)
  }

  const fetchFixtures = async () => {
    const { data, error } = await supabase
      .from('fixtures')
      .select('*, teams(name), squads(id, published)')
      .order('match_date', { ascending: true })
    if (!error && data) setFixtures(data)
  }

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleEdit = (fixture) => {
    setForm({
      team_id:    fixture.team_id,
      opponent:   fixture.opponent,
      venue:      fixture.venue,
      match_date: fixture.match_date,
      match_time: fixture.match_time?.slice(0, 5) || '13:00',
      match_type: fixture.match_type,
      home_away:  fixture.home_away || 'home',
    })
    setEditingId(fixture.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancel = () => {
    setShowForm(false)
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.team_id) { toast.error('Please select a team'); return }
    setSubmitting(true)

    try {
      const teamName = teams.find(t => t.id === form.team_id)?.name || ''
      const payload  = {
        ...form,
        day_type: teamName === 'Sunday XI' ? 'sunday' : 'saturday',
      }

      if (editingId) {
        const { error } = await supabase.from('fixtures').update(payload).eq('id', editingId)
        if (error) throw error
        toast.success('Fixture updated successfully')
      } else {
        const { error } = await supabase.from('fixtures').insert({ ...payload, created_by: profile.id })
        if (error) throw error
        toast.success('Fixture created successfully')
      }

      handleCancel()
      await fetchFixtures()
    } catch (err) {
      toast.error('Failed to save fixture: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const promptDelete = (fixtureId, opponent) =>
    setDeleteModal({ open: true, fixtureId, opponent })

  const handleDeleteConfirm = async () => {
    const { fixtureId, opponent } = deleteModal
    setDeleteModal({ open: false, fixtureId: null, opponent: '' })
    const { error } = await supabase.from('fixtures').delete().eq('id', fixtureId)
    if (error) { toast.error('Failed to delete fixture'); return }
    toast.success('Fixture vs ' + opponent + ' deleted')
    setFixtures(prev => prev.filter(f => f.id !== fixtureId))
  }

  // ── Group by month ──
  const grouped = fixtures.reduce((acc, f) => {
    const month = format(parseISO(f.match_date), 'MMMM yyyy')
    if (!acc[month]) acc[month] = []
    acc[month].push(f)
    return acc
  }, {})

  // ── Home/away colour helper ──
  const homeAwayColor = (val) =>
    val === 'home' ? 'var(--green)' : val === 'away' ? 'var(--amber)' : 'var(--text-muted)'

  const homeAwayLabel = (val) =>
    val === 'home' ? '🏠 Home' : val === 'away' ? '✈️ Away' : '⚖️ Neutral'

  return (
    <AppShell>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '36px' }}>
          <div>
            <div className="section-label">Administration</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '2px', lineHeight: 1 }}>
              FIXTURES
            </h1>
          </div>
          <button className="btn btn--primary"
            onClick={() => { editingId ? handleCancel() : setShowForm(v => !v) }}
            style={{ marginTop: '8px' }}>
            {showForm ? '✕ Cancel' : '+ Add Fixture'}
          </button>
        </div>

        {/* ── Form ── */}
        {showForm && (
          <div className="card" style={{
            padding: '28px', marginBottom: '36px',
            border: editingId ? '1px solid rgba(245,197,24,0.25)' : '1px solid var(--navy-border)',
            background: editingId ? 'rgba(245,197,24,0.03)' : undefined,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                {editingId ? '✏️  Edit Fixture' : '➕  New Fixture'}
              </div>
              {editingId && (
                <div style={{
                  fontSize: '11px', color: 'var(--amber)',
                  background: 'rgba(245,197,24,0.1)',
                  border: '1px solid rgba(245,197,24,0.2)',
                  padding: '3px 10px', borderRadius: '6px',
                  fontWeight: 700, letterSpacing: '1px',
                }}>
                  EDITING
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="input-label">Team</label>
                  <select className="input" name="team_id" value={form.team_id} onChange={handleChange} required>
                    <option value="">Select team…</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="input-label">Match Type</label>
                  <select className="input" name="match_type" value={form.match_type} onChange={handleChange}>
                    {Object.entries(MATCH_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="input-label">Opponent</label>
                  <input className="input" name="opponent" type="text"
                    placeholder="e.g. Ealing CC"
                    value={form.opponent} onChange={handleChange} required />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="input-label">Venue</label>
                  <input className="input" name="venue" type="text"
                    placeholder="e.g. Harrow Recreation Ground"
                    value={form.venue} onChange={handleChange} required />
                </div>

                <div>
                  <label className="input-label">Match Date</label>
                  <input className="input" name="match_date" type="date"
                    value={form.match_date} onChange={handleChange} required />
                </div>

                <div>
                  <label className="input-label">Kick-off Time</label>
                  <input className="input" name="match_time" type="time"
                    value={form.match_time} onChange={handleChange} required />
                </div>

                <div>
                  <label className="input-label">Home / Away</label>
                  <select className="input" name="home_away" value={form.home_away} onChange={handleChange}>
                    <option value="home">🏠 Home</option>
                    <option value="away">✈️ Away</option>
                    <option value="neutral">⚖️ Neutral</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn btn--primary"
                  style={{ minWidth: '160px' }} disabled={submitting}>
                  {submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Create Fixture'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={handleCancel}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Fixtures list ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            Loading fixtures…
          </div>
        ) : fixtures.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', letterSpacing: '1px', marginBottom: '8px' }}>
              NO FIXTURES YET
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Click "+ Add Fixture" to create the first fixture
            </div>
          </div>
        ) : (
          Object.entries(grouped).map(([month, monthFixtures]) => (
            <div key={month} style={{ marginBottom: '36px' }}>
              {/* Month header */}
              <div style={{
                fontSize: '13px', fontWeight: 700, letterSpacing: '2px',
                textTransform: 'uppercase', color: 'var(--gold)',
                marginBottom: '14px', paddingBottom: '10px',
                borderBottom: '1px solid var(--navy-border)',
              }}>
                {month}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {monthFixtures.map(fixture => {
                  const isPublished = fixture.squads?.[0]?.published || false
                  const isEditing   = editingId === fixture.id

                  return (
                    <div key={fixture.id}
                      className="card card--hoverable"
                      style={{
                        padding: '16px 20px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        border: isEditing ? '1px solid rgba(245,197,24,0.4)' : undefined,
                      }}
                    >
                      {/* Date block */}
                      <div style={{
                        width: '48px', textAlign: 'center', flexShrink: 0,
                        borderRight: '1px solid var(--navy-border)',
                        paddingRight: '18px', marginRight: '18px',
                      }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--gold)', lineHeight: 1 }}>
                          {format(parseISO(fixture.match_date), 'dd')}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px' }}>
                          {format(parseISO(fixture.match_date), 'EEE').toUpperCase()}
                        </div>
                      </div>

                      {/* Match info */}
                      <div style={{ flex: 1 }}>
                        {/* Tags: Team · Home/Away · Match Type */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          {/* Team badge */}
                          <span style={{
                            fontSize: '11px', fontWeight: 700, letterSpacing: '1px',
                            color: 'var(--gold)', background: 'rgba(245,197,24,0.1)',
                            padding: '2px 8px', borderRadius: '4px',
                            border: '1px solid rgba(245,197,24,0.2)',
                          }}>
                            {fixture.teams?.name}
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
                          {isPublished && (
                            <span style={{
                              fontSize: '11px', fontWeight: 700, color: 'var(--green)',
                              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
                              padding: '2px 8px', borderRadius: '4px',
                            }}>
                              ✓ SQUAD OUT
                            </span>
                          )}
                        </div>

                        <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                          HTCC{' '}
                          <span style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', letterSpacing: '1px' }}>VS</span>
                          {' '}{fixture.opponent.toUpperCase()}
                        </div>

                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', gap: '14px' }}>
                          <span>📍 {fixture.venue}</span>
                          <span>🕐 {fixture.match_time?.slice(0, 5)}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => navigate('/captain/fixtures/' + fixture.id + '/squad')}
                          className="btn btn--primary"
                          style={{ fontSize: '13px', padding: '7px 14px' }}
                        >
                          {isPublished ? '👁 View Squad' : '🏏 Select Squad'}
                        </button>

                        <button
                          onClick={() => handleEdit(fixture)}
                          style={{
                            padding: '7px 14px', borderRadius: 'var(--radius-md)',
                            background: isEditing ? 'rgba(245,197,24,0.15)' : 'rgba(245,197,24,0.08)',
                            border: isEditing ? '1px solid rgba(245,197,24,0.5)' : '1px solid rgba(245,197,24,0.25)',
                            color: 'var(--gold)', fontSize: '13px', fontWeight: 600,
                            cursor: 'pointer', transition: 'var(--transition)',
                          }}
                        >
                          {isEditing ? 'Editing…' : 'Edit'}
                        </button>

                        <button
                          onClick={() => promptDelete(fixture.id, fixture.opponent)}
                          style={{
                            padding: '7px 14px', borderRadius: 'var(--radius-md)',
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            color: 'var(--red)', fontSize: '13px',
                            cursor: 'pointer', transition: 'var(--transition)',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModal.open}
        title="Delete Fixture"
        message={'Delete the fixture vs ' + deleteModal.opponent + '? All availability responses will also be removed and this cannot be undone.'}
        confirmLabel="Delete Fixture"
        cancelLabel="Keep It"
        confirmDanger={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal({ open: false, fixtureId: null, opponent: '' })}
      />
    </AppShell>
  )
}
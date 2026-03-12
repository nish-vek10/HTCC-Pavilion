// pavilion-web/src/pages/captain/CaptainFixturesPage.jsx

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell from '../../components/layout/AppShell.jsx'
import ConfirmModal from '../../components/ui/ConfirmModal.jsx'
import { MATCH_TYPE_LABELS, AVAILABILITY_CONFIG } from '../../lib/constants.js'

// ─── CONFIGURABLE ─────────────────────────────────
const EMPTY_FORM = {
  opponent:   '',
  venue:      '',
  match_date: '',
  match_time: '12:30',
  match_type: 'league',
  home_away:  'home',
}

export default function CaptainFixturesPage() {
  const navigate  = useNavigate()
  const profile   = useAuthStore(state => state.profile)
  const isAdmin   = useAuthStore(state => state.isAdmin)

  const [myTeam,     setMyTeam]     = useState(null)   // Captain's team
  const [allTeams,   setAllTeams]   = useState([])     // All teams (admin only)
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [fixtures,   setFixtures]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [editingId,  setEditingId]  = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteModal,  setDeleteModal]  = useState({ open: false, fixtureId: null, opponent: '' })
  const [reminding,    setReminding]    = useState(null)  // fixtureId currently sending reminder

  useEffect(() => { document.title = 'Pavilion · My Fixtures' }, [])
  useEffect(() => { if (profile?.id) loadTeam() }, [profile?.id])
  useEffect(() => { if (selectedTeamId) fetchFixtures() }, [selectedTeamId])

  // ── Find captain's team or load all for admin ──
  const loadTeam = async () => {
    setLoading(true)

    if (isAdmin()) {
      // Admins can see all teams
      const { data } = await supabase
        .from('teams').select('id, name, day_type').order('name')
      if (data) {
        setAllTeams(data)
        setSelectedTeamId(data[0]?.id || null)
      }
    } else {
      // Captain — find team where they are captain
      const { data } = await supabase
        .from('teams')
        .select('id, name, day_type')
        .eq('captain_id', profile.id)
        .single()

      if (data) {
        setMyTeam(data)
        setSelectedTeamId(data.id)
      } else {
        // Fallback: find via team_members
        const { data: tm } = await supabase
          .from('team_members')
          .select('teams(id, name, day_type)')
          .eq('player_id', profile.id)
          .eq('status', 'active')
          .limit(1)
          .single()

        if (tm?.teams) {
          setMyTeam(tm.teams)
          setSelectedTeamId(tm.teams.id)
        }
      }
    }
    setLoading(false)
  }

  const fetchFixtures = async () => {
    if (!selectedTeamId) return
    const { data, error } = await supabase
      .from('fixtures')
      .select(`
        *,
        teams(id, name),
        squads(id, published, published_at,
          squad_members(player_id)
        )
      `)
      .eq('team_id', selectedTeamId)
      .order('match_date', { ascending: true })

    if (!error && data) setFixtures(data)
  }

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleEdit = (fixture) => {
    setForm({
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
    if (!selectedTeamId) { toast.error('No team selected'); return }
    setSubmitting(true)

    try {
      const teamName = myTeam?.name || allTeams.find(t => t.id === selectedTeamId)?.name || ''
      const payload  = {
        ...form,
        team_id:  selectedTeamId,
        day_type: teamName === 'Sunday XI' ? 'sunday' : 'saturday',
      }

      if (editingId) {
        const { error } = await supabase.from('fixtures').update(payload).eq('id', editingId)
        if (error) throw error
        toast.success('Fixture updated')
      } else {
        const { error } = await supabase.from('fixtures').insert({ ...payload, created_by: profile.id })
        if (error) throw error
        toast.success('Fixture created')
      }

      handleCancel()
      await fetchFixtures()
    } catch (err) {
      toast.error('Failed to save fixture: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const promptDelete = (fixtureId, opponent) => setDeleteModal({ open: true, fixtureId, opponent })

  const handleDeleteConfirm = async () => {
    const { fixtureId, opponent } = deleteModal
    setDeleteModal({ open: false, fixtureId: null, opponent: '' })
    const { error } = await supabase.from('fixtures').delete().eq('id', fixtureId)
    if (error) { toast.error('Failed to delete fixture'); return }
    toast.success(`Fixture vs ${opponent} deleted`)
    setFixtures(prev => prev.filter(f => f.id !== fixtureId))
  }

  // ── Send availability reminder to non-responders ──
  const handleSendReminder = async (fixture) => {
    setReminding(fixture.id)
    try {
      const { data, error } = await supabase.rpc('send_fixture_reminder', {
        p_fixture_id: fixture.id,
      })
      if (error) throw error
      if (data === 0) {
        toast('All players have already responded', { icon: '✅' })
      } else {
        toast.success(`Reminder sent to ${data} player${data !== 1 ? 's' : ''}`)
      }
    } catch (err) {
      toast.error('Failed to send reminder: ' + err.message)
    } finally {
      setReminding(null)
    }
  }

  const currentTeam = myTeam || allTeams.find(t => t.id === selectedTeamId)

  return (
    <AppShell>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="section-label">Captain</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '2px', lineHeight: 1 }}>
              MY FIXTURES
            </h1>
            {currentTeam && (
              <div style={{ fontSize: '14px', color: 'var(--gold)', marginTop: '6px', fontWeight: 600 }}>
                {currentTeam.name}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Admin team switcher */}
            {isAdmin() && allTeams.length > 0 && (
              <select className="input" style={{ margin: 0, fontSize: '13px', width: '140px' }}
                value={selectedTeamId || ''}
                onChange={e => setSelectedTeamId(e.target.value)}>
                {allTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <button className="btn btn--primary"
              onClick={() => { editingId ? handleCancel() : setShowForm(v => !v) }}>
              {showForm ? '✕ Cancel' : '+ Add Fixture'}
            </button>
          </div>
        </div>

        {/* ── Add / Edit Form ── */}
        {showForm && (
          <div className="card" style={{
            padding: '28px', marginBottom: '32px',
            border: editingId ? '1px solid rgba(245,197,24,0.25)' : '1px solid var(--navy-border)',
            background: editingId ? 'rgba(245,197,24,0.03)' : undefined,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                {editingId ? '✏️  Edit Fixture' : '➕  New Fixture'}
              </div>
              {editingId && (
                <div style={{
                  fontSize: '11px', color: 'var(--amber)',
                  background: 'rgba(245,197,24,0.1)', border: '1px solid rgba(245,197,24,0.2)',
                  padding: '3px 10px', borderRadius: '6px', fontWeight: 700, letterSpacing: '1px',
                }}>
                  EDITING
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                  <label className="input-label">Match Type</label>
                  <select className="input" name="match_type" value={form.match_type} onChange={handleChange}>
                    {Object.entries(MATCH_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
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
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading…</div>
        ) : !selectedTeamId ? (
          <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '1px' }}>
              NO TEAM ASSIGNED
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>
              You haven't been assigned as captain of any team. Contact an admin.
            </div>
          </div>
        ) : fixtures.length === 0 ? (
          <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📅</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '1px', marginBottom: '8px' }}>
              NO FIXTURES YET
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Click "+ Add Fixture" to schedule your first match
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {fixtures.map(fixture => {
              const squad       = fixture.squads?.[0] || null
              const isPublished = squad?.published || false
              const squadCount  = squad?.squad_members?.length || 0

              return (
                <div key={fixture.id} className="card card--hoverable"
                  style={{
                    padding: '18px 22px',
                    border: editingId === fixture.id ? '1px solid rgba(245,197,24,0.4)' : undefined,
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>

                    {/* Date block */}
                    <div style={{
                      width: '50px', textAlign: 'center', flexShrink: 0,
                      borderRight: '1px solid var(--navy-border)',
                      paddingRight: '20px',
                    }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '30px', color: 'var(--gold)', lineHeight: 1 }}>
                        {format(parseISO(fixture.match_date), 'dd')}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px' }}>
                        {format(parseISO(fixture.match_date), 'EEE').toUpperCase()}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {format(parseISO(fixture.match_date), 'MMM')}
                      </div>
                    </div>

                    {/* Fixture info */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '11px', fontWeight: 700,
                          color: fixture.home_away === 'home' ? 'var(--green)' : 'var(--amber)',
                          background: fixture.home_away === 'home' ? 'rgba(34,197,94,0.1)' : 'rgba(245,197,24,0.1)',
                          padding: '2px 8px', borderRadius: '4px',
                          border: fixture.home_away === 'home' ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(245,197,24,0.25)',
                        }}>
                          {fixture.home_away === 'home' ? '🏠 HOME' : fixture.home_away === 'away' ? '✈️ AWAY' : '⚖️ NEUTRAL'}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {MATCH_TYPE_LABELS[fixture.match_type]}
                        </span>
                        {/* Squad status badge */}
                        {isPublished ? (
                          <span style={{
                            fontSize: '11px', fontWeight: 700, color: 'var(--green)',
                            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
                            padding: '2px 8px', borderRadius: '4px',
                          }}>
                            ✓ SQUAD PUBLISHED
                          </span>
                        ) : squadCount > 0 ? (
                          <span style={{
                            fontSize: '11px', fontWeight: 700, color: 'var(--amber)',
                            background: 'rgba(245,197,24,0.08)', border: '1px solid rgba(245,197,24,0.2)',
                            padding: '2px 8px', borderRadius: '4px',
                          }}>
                            {squadCount}/11 SELECTED
                          </span>
                        ) : null}
                      </div>

                      <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                        HTCC{' '}
                        <span style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', letterSpacing: '1px' }}>VS</span>
                        {' '}{fixture.opponent.toUpperCase()}
                      </div>

                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                        <span>📅 {format(parseISO(fixture.match_date), 'EEE d MMM yyyy')}</span>
                        <span>🕐 {fixture.match_time?.slice(0, 5)}</span>
                        <span>📍 {fixture.venue}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => navigate(`/captain/fixtures/${fixture.id}/squad`)}
                        className="btn btn--primary"
                        style={{ fontSize: '13px', padding: '8px 16px' }}>
                        {isPublished ? '👁 View Squad' : '🏏 Select Squad'}
                      </button>
                      {/* Availability reminder — only for upcoming fixtures */}
                      {new Date(fixture.match_date) >= new Date(new Date().toDateString()) && (
                        <button
                          onClick={() => handleSendReminder(fixture)}
                          disabled={reminding === fixture.id}
                          style={{
                            padding: '8px 16px', borderRadius: 'var(--radius-md)',
                            background: 'rgba(96,165,250,0.08)',
                            border: '1px solid rgba(96,165,250,0.25)',
                            color: '#60A5FA', fontSize: '13px', fontWeight: 600,
                            cursor: reminding === fixture.id ? 'not-allowed' : 'pointer',
                            transition: 'var(--transition)', opacity: reminding === fixture.id ? 0.6 : 1,
                          }}
                        >
                          {reminding === fixture.id ? 'Sending…' : '🔔 Remind'}
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(fixture)}
                        style={{
                          padding: '8px 16px', borderRadius: 'var(--radius-md)',
                          background: 'rgba(245,197,24,0.08)',
                          border: '1px solid rgba(245,197,24,0.25)',
                          color: 'var(--gold)', fontSize: '13px', fontWeight: 600,
                          cursor: 'pointer', transition: 'var(--transition)',
                        }}>
                        Edit
                      </button>
                      {!isPublished && (
                        <button
                          onClick={() => promptDelete(fixture.id, fixture.opponent)}
                          style={{
                            padding: '8px 16px', borderRadius: 'var(--radius-md)',
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            color: 'var(--red)', fontSize: '13px',
                            cursor: 'pointer', transition: 'var(--transition)',
                          }}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModal.open}
        title="Delete Fixture"
        message={`Delete the fixture vs ${deleteModal.opponent}? All availability responses will also be removed.`}
        confirmLabel="Delete Fixture"
        cancelLabel="Keep It"
        confirmDanger={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal({ open: false, fixtureId: null, opponent: '' })}
      />
    </AppShell>
  )
}
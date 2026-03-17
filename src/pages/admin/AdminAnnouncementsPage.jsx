// pavilion-web/src/pages/admin/AdminAnnouncementsPage.jsx

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell from '../../components/layout/AppShell.jsx'
import ConfirmModal from '../../components/ui/ConfirmModal.jsx'

// ─── CONFIGURABLE: Audience options ───────────────
const AUDIENCE_OPTIONS = [
  { value: 'all',        label: '📢 All Members' },
  { value: 'member',     label: '👥 Members Only' },
  { value: 'captain',    label: '🏏 Captains Only' },
  { value: 'admin',      label: '⚙️ Admins Only' },
]

// ─── Audience badge colours ────────────────────────
const AUDIENCE_META = {
  all:     { color: '#F5C518', bg: 'rgba(245,197,24,0.1)',   label: 'All Members' },
  member:  { color: '#8B9BB4', bg: 'rgba(139,155,180,0.1)', label: 'Members' },
  captain: { color: '#22C55E', bg: 'rgba(34,197,94,0.1)',   label: 'Captains' },
  admin:   { color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', label: 'Admins' },
}

const EMPTY_FORM = { title: '', body: '', target_role: 'all' }

// embedded=true → skip AppShell wrapper (used inside AdminSessionsPage combined view)
export default function AdminAnnouncementsPage({ embedded = false }) {
  const profile = useAuthStore(state => state.profile)

  const [announcements, setAnnouncements] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [showForm,      setShowForm]      = useState(false)
  const [form,          setForm]          = useState(EMPTY_FORM)
  const [submitting,    setSubmitting]    = useState(false)
  const [deleteModal,   setDeleteModal]   = useState({ open: false, id: null, title: '' })
  const [expandedId,    setExpandedId]    = useState(null)

  useEffect(() => { document.title = 'Pavilion · Announcements — Admin' }, [])
  useEffect(() => { if (profile?.id) fetchAnnouncements() }, [profile?.id])

  const fetchAnnouncements = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('announcements')
      .select(`
        id, title, body, target_role, created_at,
        profiles ( full_name )
      `)
      .order('created_at', { ascending: false })

    if (!error && data) setAnnouncements(data)
    setLoading(false)
  }

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  // ── Post announcement ──
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Title is required'); return }
    if (!form.body.trim())  { toast.error('Message body is required'); return }

    setSubmitting(true)
    try {
      const { error } = await supabase.from('announcements').insert({
        title:       form.title.trim(),
        body:        form.body.trim(),
        target_role: form.target_role,
        created_by:  profile.id,
      })
      if (error) throw error

      toast.success('Announcement posted')
      setForm(EMPTY_FORM)
      setShowForm(false)
      await fetchAnnouncements()
    } catch (err) {
      toast.error('Failed to post announcement: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete announcement ──
  const handleDeleteConfirm = async () => {
    const { id, title } = deleteModal
    setDeleteModal({ open: false, id: null, title: '' })

    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) { toast.error('Failed to delete announcement'); return }

    toast.success('Announcement deleted')
    setAnnouncements(prev => prev.filter(a => a.id !== id))
  }

  // ── Character count helper ──
  const bodyLength = form.body.length
  const BODY_LIMIT = 1000

  const content = (
    <>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: embedded ? '0' : '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '36px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="section-label">Administration</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '2px', lineHeight: 1 }}>
              ANNOUNCEMENTS
            </h1>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Broadcast messages to members, captains, or the whole club
            </div>
          </div>
          <button
            className="btn btn--primary"
            onClick={() => setShowForm(v => !v)}
            style={{ marginTop: '8px' }}
          >
            {showForm ? '✕ Cancel' : '+ New Announcement'}
          </button>
        </div>

        {/* ── Compose form ── */}
        {showForm && (
          <div className="card" style={{
            padding: '28px', marginBottom: '36px',
            border: '1px solid rgba(245,197,24,0.2)',
            background: 'rgba(245,197,24,0.02)',
          }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '22px' }}>
              📢 Compose Announcement
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Audience selector */}
                <div>
                  <label className="input-label">Audience</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {AUDIENCE_OPTIONS.map(opt => {
                      const isActive = form.target_role === opt.value
                      const meta     = AUDIENCE_META[opt.value]
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, target_role: opt.value }))}
                          style={{
                            padding: '8px 14px', borderRadius: 'var(--radius-full)',
                            border: isActive
                              ? '1px solid ' + meta.color + '66'
                              : '1px solid var(--navy-border)',
                            background: isActive ? meta.bg : 'transparent',
                            color: isActive ? meta.color : 'var(--text-muted)',
                            fontSize: '13px', fontWeight: isActive ? 700 : 400,
                            cursor: 'pointer', transition: 'var(--transition)',
                          }}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="input-label">Title</label>
                  <input
                    className="input" name="title" type="text"
                    placeholder="e.g. Training this Wednesday cancelled"
                    value={form.title} onChange={handleChange}
                    maxLength={120} required
                  />
                </div>

                {/* Body */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label className="input-label" style={{ marginBottom: 0 }}>Message</label>
                    <span style={{
                      fontSize: '11px',
                      color: bodyLength > BODY_LIMIT * 0.9 ? 'var(--amber)' : 'var(--text-faint)',
                    }}>
                      {bodyLength}/{BODY_LIMIT}
                    </span>
                  </div>
                  <textarea
                    className="input"
                    name="body"
                    placeholder="Write your announcement here…"
                    value={form.body}
                    onChange={handleChange}
                    maxLength={BODY_LIMIT}
                    required
                    rows={5}
                    style={{ resize: 'vertical', minHeight: '120px', fontFamily: 'var(--font-body)' }}
                  />
                </div>

                {/* Preview */}
                {form.title && form.body && (
                  <div style={{
                    padding: '16px 18px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--navy-border)',
                    borderRadius: 'var(--radius-md)',
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '1px', marginBottom: '8px' }}>
                      PREVIEW
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '6px' }}>
                      {form.title}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {form.body}
                    </div>
                    <div style={{ marginTop: '10px', fontSize: '11px', color: AUDIENCE_META[form.target_role]?.color }}>
                      → Visible to: {AUDIENCE_META[form.target_role]?.label}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="submit" className="btn btn--primary"
                    style={{ minWidth: '160px' }} disabled={submitting}>
                    {submitting ? 'Posting…' : '📢 Post Announcement'}
                  </button>
                  <button type="button" className="btn btn--ghost"
                    onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ── Announcements list ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            Loading announcements…
          </div>
        ) : announcements.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📢</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '1px', marginBottom: '8px' }}>
              NO ANNOUNCEMENTS YET
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Click "+ New Announcement" to broadcast a message to your members
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {announcements.map(ann => {
              const meta       = AUDIENCE_META[ann.target_role] || AUDIENCE_META.all
              const isExpanded = expandedId === ann.id
              const isLong     = ann.body.length > 200

              return (
                <div key={ann.id} className="card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '18px 22px' }}>

                    {/* Top row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        {/* Badges row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <div style={{
                            fontSize: '11px', fontWeight: 700, letterSpacing: '1px',
                            color: meta.color, background: meta.bg,
                            border: '1px solid ' + meta.color + '33',
                            padding: '3px 10px', borderRadius: '20px',
                          }}>
                            {meta.label}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
                            {format(parseISO(ann.created_at), 'EEE d MMM yyyy, HH:mm')}
                          </div>
                          {ann.profiles?.full_name && (
                            <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
                              · Posted by {ann.profiles.full_name}
                            </div>
                          )}
                        </div>

                        {/* Title */}
                        <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                          {ann.title}
                        </div>

                        {/* Body — collapsed if long */}
                        <div style={{
                          fontSize: '14px', color: 'var(--text-muted)',
                          lineHeight: 1.7, whiteSpace: 'pre-wrap',
                          overflow: 'hidden',
                          maxHeight: isLong && !isExpanded ? '60px' : 'none',
                          position: 'relative',
                        }}>
                          {ann.body}
                          {isLong && !isExpanded && (
                            <div style={{
                              position: 'absolute', bottom: 0, left: 0, right: 0,
                              height: '32px',
                              background: 'linear-gradient(transparent, var(--bg-surface))',
                            }} />
                          )}
                        </div>

                        {/* Expand / collapse */}
                        {isLong && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : ann.id)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--gold)', fontSize: '13px',
                              marginTop: '6px', padding: 0, fontWeight: 600,
                            }}
                          >
                            {isExpanded ? '▲ Show less' : '▼ Read more'}
                          </button>
                        )}
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => setDeleteModal({ open: true, id: ann.id, title: ann.title })}
                        style={{
                          padding: '7px 14px', borderRadius: 'var(--radius-md)',
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.2)',
                          color: 'var(--red)', fontSize: '13px',
                          cursor: 'pointer', transition: 'var(--transition)',
                          flexShrink: 0,
                        }}
                      >
                        Delete
                      </button>
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
        title="Delete Announcement"
        message={'Delete the announcement "' + deleteModal.title + '"? This cannot be undone.'}
        confirmLabel="Delete"
        cancelLabel="Keep It"
        confirmDanger={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal({ open: false, id: null, title: '' })}
      />
    </div>
    </>
  )

  if (embedded) return content
  return <AppShell>{content}</AppShell>
}
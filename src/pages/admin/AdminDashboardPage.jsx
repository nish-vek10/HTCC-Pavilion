// pavilion-web/src/pages/admin/AdminDashboardPage.jsx

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell from '../../components/layout/AppShell.jsx'
import { PAGE_TITLES, MATCH_TYPE_LABELS, ROUTES } from '../../lib/constants.js'

// ─── Audience badge meta ───────────────────────────
const AUDIENCE_META = {
  all:     { color: '#F5C518', bg: 'rgba(245,197,24,0.1)',   label: 'All Members' },
  member:  { color: '#8B9BB4', bg: 'rgba(139,155,180,0.1)', label: 'Members' },
  captain: { color: '#22C55E', bg: 'rgba(34,197,94,0.1)',   label: 'Captains' },
  admin:   { color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', label: 'Admins' },
}

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const profile  = useAuthStore(state => state.profile)

  const [stats,         setStats]         = useState({ members: 0, pending: 0, fixtures: 0, teams: 0 })
  const [pending,       setPending]       = useState([])
  const [fixtures,      setFixtures]      = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading,       setLoading]       = useState(true)

  useEffect(() => { document.title = PAGE_TITLES.ADMIN_DASHBOARD }, [])
  useEffect(() => { if (profile?.id) loadAll() }, [profile?.id])

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([fetchStats(), fetchPending(), fetchFixtures(), fetchAnnouncements()])
    setLoading(false)
  }

  // ── Fetch overview stats ──
  const fetchStats = async () => {
    const [members, pendingCount, fixtureCount] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact' }).neq('role', 'pending'),
      supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'pending'),
      supabase.from('fixtures').select('id', { count: 'exact' })
        .gte('match_date', new Date().toISOString().split('T')[0]),
    ])
    setStats({
      members:  members.count  || 0,
      pending:  pendingCount.count || 0,
      fixtures: fixtureCount.count || 0,
      teams:    5,
    })
  }

  // ── Fetch pending member approvals ──
  const fetchPending = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, created_at')
      .eq('role', 'pending')
      .order('created_at', { ascending: true })

    if (!error && data) setPending(data)
  }

  // ── Fetch upcoming fixtures ──
  const fetchFixtures = async () => {
    const { data, error } = await supabase
      .from('fixtures')
      .select('*, teams(name)')
      .gte('match_date', new Date().toISOString().split('T')[0])
      .order('match_date', { ascending: true })
      .limit(8)

    if (!error && data) setFixtures(data)
  }

  // ── Fetch 3 most recent announcements ──
  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, body, target_role, created_at, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(3)
    if (data) setAnnouncements(data)
  }

  // ── Approve a pending member ──
  const handleApprove = async (memberId, name) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'member' })
      .eq('id', memberId)

    if (error) {
      toast.error('Failed to approve member')
      return
    }
    toast.success(`${name} approved as member`)
    setPending(prev => prev.filter(p => p.id !== memberId))
    setStats(prev => ({ ...prev, pending: prev.pending - 1, members: prev.members + 1 }))
  }

  // ── Reject / delete a pending member ──
  const handleReject = async (memberId, name) => {
    if (!window.confirm(`Reject and remove ${name}'s application?`)) return

    const { error } = await supabase.auth.admin
      ? await supabase.from('profiles').delete().eq('id', memberId)
      : await supabase.from('profiles').update({ role: 'rejected' }).eq('id', memberId)

    if (error) { toast.error('Failed to reject member'); return }

    toast(`${name}'s application rejected`, { icon: '❌' })
    setPending(prev => prev.filter(p => p.id !== memberId))
    setStats(prev => ({ ...prev, pending: prev.pending - 1 }))
  }

  return (
    <AppShell>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '40px' }} className="animate-fade-in">
          <div className="section-label">Administration</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 48px)', letterSpacing: '2px', lineHeight: 1 }}>
            ADMIN OVERVIEW
          </h1>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Harrow Town Cricket Club · Season {new Date().getFullYear()}
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px', marginBottom: '40px',
        }}>
          {[
            { label: 'Active Members', value: stats.members,  color: 'var(--green)',       icon: '👥' },
            { label: 'Pending Approval', value: stats.pending,  color: 'var(--amber)',       icon: '⏳', urgent: stats.pending > 0 },
            { label: 'Upcoming Fixtures', value: stats.fixtures, color: 'var(--gold)',        icon: '📅' },
            { label: 'Active Teams',    value: stats.teams,    color: 'var(--text-muted)',   icon: '🏏' },
          ].map(stat => (
            <div key={stat.label} className="card" style={{
              padding: '22px',
              border: stat.urgent ? '1px solid rgba(245,197,24,0.3)' : undefined,
              background: stat.urgent ? 'rgba(245,197,24,0.04)' : undefined,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '44px', letterSpacing: '1px',
                  color: stat.color, lineHeight: 1,
                }}>
                  {loading ? '—' : stat.value}
                </div>
                <span style={{ fontSize: '24px', opacity: 0.6 }}>{stat.icon}</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '8px' }}>
                {stat.label}
              </div>
              {stat.urgent && (
                <div style={{ fontSize: '11px', color: 'var(--amber)', marginTop: '4px', fontWeight: 700 }}>
                  ACTION REQUIRED
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Two column layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>

          {/* ── Pending Approvals ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div className="section-label">Membership</div>
                <div className="section-title" style={{ fontSize: '22px' }}>Pending Approvals</div>
              </div>
              <button className="btn btn--ghost" style={{ fontSize: '13px' }}
                onClick={() => navigate(ROUTES.ADMIN_MEMBERS)}>
                All Members →
              </button>
            </div>

            {loading ? (
              <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
            ) : pending.length === 0 ? (
              <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>All Clear</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No pending approvals</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pending.map(member => (
                  <div key={member.id} className="card" style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Avatar */}
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--navy-light), var(--gold-dim))',
                          border: '1px solid rgba(245,197,24,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '13px', fontWeight: 700, color: 'var(--gold)',
                          flexShrink: 0,
                        }}>
                          {member.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                            {member.full_name}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {member.phone || 'No phone'} · Joined {format(parseISO(member.created_at), 'd MMM yyyy')}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleApprove(member.id, member.full_name)}
                          style={{
                            padding: '6px 14px', borderRadius: 'var(--radius-md)',
                            background: 'rgba(34,197,94,0.12)',
                            border: '1px solid rgba(34,197,94,0.3)',
                            color: 'var(--green)', fontSize: '13px', fontWeight: 600,
                            cursor: 'pointer', transition: 'var(--transition)',
                          }}>
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(member.id, member.full_name)}
                          style={{
                            padding: '6px 14px', borderRadius: 'var(--radius-md)',
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            color: 'var(--red)', fontSize: '13px',
                            cursor: 'pointer', transition: 'var(--transition)',
                          }}>
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Upcoming Fixtures ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div className="section-label">Schedule</div>
                <div className="section-title" style={{ fontSize: '22px' }}>Upcoming Fixtures</div>
              </div>
              <button className="btn btn--primary" style={{ fontSize: '13px' }}
                onClick={() => navigate(ROUTES.ADMIN_FIXTURES)}>
                + Add Fixture
              </button>
            </div>

            {loading ? (
              <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
            ) : fixtures.length === 0 ? (
              <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📅</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>No fixtures yet</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Add your first fixture to get started</div>
                <button className="btn btn--primary" style={{ fontSize: '13px' }}
                  onClick={() => navigate(ROUTES.ADMIN_FIXTURES)}>
                  Add Fixture
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {fixtures.map(fixture => (
                  <div key={fixture.id} className="card" style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                          <span style={{
                            fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
                            color: 'var(--gold)',
                            background: 'rgba(245,197,24,0.1)',
                            padding: '2px 8px', borderRadius: '4px',
                            border: '1px solid rgba(245,197,24,0.2)',
                          }}>
                            {fixture.teams?.name}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {fixture.match_type}
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                          vs {fixture.opponent}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {format(parseISO(fixture.match_date), 'EEE d MMM')} · {fixture.venue}
                        </div>
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '22px', color: 'var(--gold)',
                        letterSpacing: '1px', textAlign: 'right',
                      }}>
                        {format(parseISO(fixture.match_date), 'dd')}
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                          {format(parseISO(fixture.match_date), 'MMM')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>{/* end two-col grid */}

        {/* ── Recent Announcements ── */}
        <div style={{ marginTop: '40px' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px',
          }}>
            <div>
              <div className="section-label">Communications</div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(20px, 3vw, 28px)',
                letterSpacing: '2px', lineHeight: 1,
              }}>
                RECENT ANNOUNCEMENTS
              </div>
            </div>
            <button
              className="btn btn--ghost"
              onClick={() => navigate(ROUTES.ADMIN_ANNOUNCEMENTS)}
              style={{ fontSize: '13px' }}
            >
              All Announcements →
            </button>
          </div>

          {loading ? (
            <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading…
            </div>
          ) : announcements.length === 0 ? (
            <div className="card" style={{
              padding: '36px', textAlign: 'center',
              color: 'var(--text-muted)', fontSize: '14px',
            }}>
              📢 No announcements posted yet —{' '}
              <span
                onClick={() => navigate(ROUTES.ADMIN_ANNOUNCEMENTS)}
                style={{ color: 'var(--gold)', cursor: 'pointer', fontWeight: 600 }}
              >
                post one now
              </span>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '14px',
            }}>
              {announcements.map(ann => {
                const meta    = AUDIENCE_META[ann.target_role] || AUDIENCE_META.all
                const preview = ann.body.length > 120 ? ann.body.slice(0, 120) + '…' : ann.body
                return (
                  <div
                    key={ann.id}
                    className="card"
                    onClick={() => navigate(ROUTES.ADMIN_ANNOUNCEMENTS)}
                    style={{
                      padding: '18px 20px',
                      borderTop: '3px solid ' + meta.color,
                      display: 'flex', flexDirection: 'column', gap: '8px',
                      cursor: 'pointer', transition: 'var(--transition)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{
                        fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
                        color: meta.color, background: meta.bg,
                        border: '1px solid ' + meta.color + '33',
                        padding: '2px 8px', borderRadius: '20px',
                      }}>
                        {meta.label.toUpperCase()}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
                        {format(parseISO(ann.created_at), 'd MMM')}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {ann.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, flex: 1 }}>
                      {preview}
                    </div>
                    {ann.profiles?.full_name && (
                      <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px' }}>
                        Posted by {ann.profiles.full_name}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>{/* end page wrapper */}
    </AppShell>
  )
}
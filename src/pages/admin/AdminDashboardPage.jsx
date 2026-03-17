// pavilion-web/src/pages/admin/AdminDashboardPage.jsx

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell from '../../components/layout/AppShell.jsx'
import ConfirmModal from '../../components/ui/ConfirmModal.jsx'
import ClubLoader from '../../components/ui/ClubLoader.jsx'
import { PAGE_TITLES, MATCH_TYPE_LABELS, ROUTES } from '../../lib/constants.js'

// ── toLocalISO — avoids UTC/BST off-by-one (never use .toISOString()) ────────
function toLocalISO(d) {
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ─── Audience badge meta ───────────────────────────
const AUDIENCE_META = {
  all:     { color: '#F5C518', bg: 'rgba(245,197,24,0.1)',   label: 'All Members' },
  member:  { color: '#8B9BB4', bg: 'rgba(139,155,180,0.1)', label: 'Members' },
  captain: { color: '#22C55E', bg: 'rgba(34,197,94,0.1)',   label: 'Captains' },
  admin:   { color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', label: 'Admins' },
}

// ─── Home/Away display config ──────────────────────
const HOME_AWAY_CONFIG = {
  home:    { emoji: '🏠', label: 'Home',    color: '#22C55E' },
  away:    { emoji: '✈️',  label: 'Away',    color: '#60A5FA' },
  neutral: { emoji: '⚖️', label: 'Neutral', color: '#8B9BB4' },
}

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const profile  = useAuthStore(state => state.profile)

  const [stats,         setStats]         = useState({ members: 0, pending: 0, fixtures: 0, teams: 0 })
  const [pending,       setPending]       = useState([])
  const [fixtures,      setFixtures]      = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [joinRequests,  setJoinRequests]  = useState([])
  const [loading,       setLoading]       = useState(true)
  // ── Confirm modal state — portalled to body to escape transform stacking ──
  const [confirmModal,  setConfirmModal]  = useState({ open: false, title: '', message: '', onConfirm: null })

  useEffect(() => { document.title = PAGE_TITLES.ADMIN_DASHBOARD }, [])
  useEffect(() => { if (profile?.id) loadAll() }, [profile?.id])

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([fetchStats(), fetchPending(), fetchFixtures(), fetchAnnouncements(), fetchJoinRequests()])
    setLoading(false)
  }

  // ── Fetch overview stats ──
  // pending = membership approvals + team join requests combined — both need action
  const fetchStats = async () => {
    const [members, pendingMembers, pendingJoins, fixtureCount] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact' }).neq('role', 'pending'),
      supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'pending'),
      supabase.from('join_requests').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('fixtures').select('id', { count: 'exact' })
        .gte('match_date', toLocalISO(new Date())),
    ])
    setStats({
      members:  members.count       || 0,
      pending:  (pendingMembers.count || 0) + (pendingJoins.count || 0),
      fixtures: fixtureCount.count  || 0,
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
      .gte('match_date', toLocalISO(new Date()))
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

  // ── Fetch pending team join requests ──
  // Avoids nested profile join (FK points to auth.users not public.profiles)
  const fetchJoinRequests = async () => {
    const { data, error } = await supabase
      .from('join_requests')
      .select('id, player_id, team_id, status, requested_at, teams(name)')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true })

    if (error) { console.error('[AdminDashboard] fetchJoinRequests:', error.message); return }
    if (!data || data.length === 0) { setJoinRequests([]); return }

    // Fetch player names separately from public.profiles
    const playerIds = [...new Set(data.map(r => r.player_id))]
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', playerIds)

    const profileMap = {}
    profileData?.forEach(p => { profileMap[p.id] = p.full_name })

    // Merge player names into requests
    const merged = data.map(r => ({
      ...r,
      profiles: { full_name: profileMap[r.player_id] || 'Unknown' },
    }))

    setJoinRequests(merged)
  }

  // ── Approve a team join request — adds to team_members + sends notification ──
  const handleApproveJoin = async (req) => {
    const { error: insertErr } = await supabase
      .from('team_members')
      .insert({ player_id: req.player_id, team_id: req.team_id, status: 'active' })

    if (insertErr) { toast.error('Failed to add to team'); return }

    // Mark request as approved
    await supabase.from('join_requests').update({ status: 'approved' }).eq('id', req.id)

    // Send join_approved notification to the player
    await supabase.from('notifications').insert({
      user_id: req.player_id,
      type:    'join_approved',
      title:   `Squad Request Approved 🟢`,
      body:    `Your request to join ${req.teams?.name} has been approved. Welcome to the squad!`,
      read:    false,
    })

    toast.success(`${req.profiles?.full_name} added to ${req.teams?.name}`)
    setJoinRequests(prev => prev.filter(r => r.id !== req.id))
  }

  // ── Reject a team join request ──
  const handleRejectJoin = async (req) => {
    await supabase.from('join_requests').update({ status: 'rejected' }).eq('id', req.id)
    toast(`${req.profiles?.full_name}'s request for ${req.teams?.name} rejected`, { icon: '❌' })
    setJoinRequests(prev => prev.filter(r => r.id !== req.id))
  }

  // ── Approve a pending member — updates role + sends welcome notification ──
  const handleApprove = async (memberId, name) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'member' })
      .eq('id', memberId)

    if (error) { toast.error('Failed to approve member'); return }

    // Send welcome notification to the new member
    await supabase.from('notifications').insert({
      user_id: memberId,
      type:    'welcome',
      title:   'Welcome to Harrow Town CC! 🏏',
      body:    `Hi ${name}, your membership has been approved. Welcome to the club!`,
      read:    false,
    })

    toast.success(`${name} approved as member`)
    setPending(prev => prev.filter(p => p.id !== memberId))
    setStats(prev => ({ ...prev, pending: prev.pending - 1, members: prev.members + 1 }))
  }

  // ── Reject a pending member — deletes their profile row ──
  // Note: 'rejected' is NOT a valid user_role enum — always DELETE the profile
  const handleReject = async (memberId, name) => {
    setConfirmModal({
      open: true,
      title: 'Reject Application',
      message: `Reject and permanently remove ${name}'s application? This cannot be undone.`,
      danger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, open: false }))
        const { error } = await supabase.from('profiles').delete().eq('id', memberId)
        if (error) { toast.error('Failed to reject member'); return }
        toast(`${name}'s application rejected`, { icon: '❌' })
        setPending(prev => prev.filter(p => p.id !== memberId))
        setStats(prev => ({ ...prev, pending: prev.pending - 1 }))
      },
    })
  }

  return (
    <>
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
            { label: 'Actions Required', value: stats.pending,  color: 'var(--amber)',       icon: '⏳', urgent: stats.pending > 0 },
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

                {/* ── Active Teams: HTCC crest badge; others: emoji ── */}
                {stat.label === 'Active Teams' ? (
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: '#0D1B2A',
                    border: '2px solid #F5C518',
                    boxShadow: '0 0 0 3px rgba(245,197,24,0.15), 0 2px 10px rgba(0,0,0,0.6)',
                    overflow: 'hidden', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <img
                      src="/assets/images/htcc-logo.png"
                      alt="HTCC"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', mixBlendMode: 'screen' }}
                    />
                  </div>
                ) : (
                  <span style={{ fontSize: '24px', opacity: 0.6 }}>{stat.icon}</span>
                )}
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

        {/* ── Two column layout — stacks to single column on mobile ── */}
        <div className="admin-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>

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
              <div className="card" style={{ padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClubLoader message="Loading…" size={48} />
              </div>
            ) : pending.length === 0 && joinRequests.length === 0 ? (
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

            {/* ── Team join requests ── */}
            {!loading && joinRequests.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Squad Join Requests
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {joinRequests.map(req => (
                    <div key={req.id} className="card" style={{
                      padding: '14px 18px',
                      border: '1px solid rgba(245,197,24,0.15)',
                      background: 'rgba(245,197,24,0.02)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {/* Avatar */}
                          <div style={{
                            width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                            background: 'rgba(245,197,24,0.1)',
                            border: '1px solid rgba(245,197,24,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: 700, color: 'var(--gold)',
                          }}>
                            {req.profiles?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                              {req.profiles?.full_name}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Requesting to join{' '}
                              <span style={{ color: 'var(--gold)', fontWeight: 600 }}>
                                {req.teams?.name}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button
                            onClick={() => handleApproveJoin(req)}
                            style={{
                              padding: '6px 14px', borderRadius: 'var(--radius-md)',
                              background: 'rgba(34,197,94,0.12)',
                              border: '1px solid rgba(34,197,94,0.3)',
                              color: 'var(--green)', fontSize: '13px', fontWeight: 600,
                              cursor: 'pointer', transition: 'var(--transition)',
                            }}>
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => handleRejectJoin(req)}
                            style={{
                              padding: '6px 14px', borderRadius: 'var(--radius-md)',
                              background: 'rgba(239,68,68,0.08)',
                              border: '1px solid rgba(239,68,68,0.2)',
                              color: 'var(--red)', fontSize: '13px',
                              cursor: 'pointer', transition: 'var(--transition)',
                            }}>
                            ✕ Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
              <div className="card" style={{ padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClubLoader message="Loading…" size={48} />
              </div>
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
                        {/* Line 1: Team · Home/Away · Match Type */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px', flexWrap: 'wrap' }}>
                          {/* Team badge */}
                          <span style={{
                            fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
                            color: 'var(--gold)', background: 'rgba(245,197,24,0.1)',
                            padding: '2px 8px', borderRadius: '4px',
                            border: '1px solid rgba(245,197,24,0.2)',
                          }}>
                            {fixture.teams?.name}
                          </span>
                          {/* Home/Away badge — standard */}
                          <span style={{
                            fontSize: '10px', fontWeight: 700,
                            color: fixture.home_away === 'home' ? 'var(--green)' : fixture.home_away === 'away' ? '#60A5FA' : 'var(--text-muted)',
                            background: fixture.home_away === 'home' ? 'rgba(34,197,94,0.1)' : fixture.home_away === 'away' ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.04)',
                            border: fixture.home_away === 'home' ? '1px solid rgba(34,197,94,0.25)' : fixture.home_away === 'away' ? '1px solid rgba(96,165,250,0.25)' : '1px solid var(--navy-border)',
                            padding: '2px 8px', borderRadius: '4px',
                          }}>
                            {fixture.home_away === 'home' ? '🏠 HOME' : fixture.home_away === 'away' ? '✈️ AWAY' : '⚖️ NEUTRAL'}
                          </span>
                          {/* Match type badge */}
                          <span style={{
                            fontSize: '10px', color: 'var(--text-muted)',
                            background: 'rgba(255,255,255,0.04)',
                            padding: '2px 8px', borderRadius: '4px',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}>
                            {MATCH_TYPE_LABELS[fixture.match_type] || fixture.match_type}
                          </span>
                        </div>
                        {/* Match title */}
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                          HTCC{' '}
                          <span style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', letterSpacing: '1px' }}>VS</span>
                          {' '}{fixture.opponent.toUpperCase()}
                        </div>
                        {/* Line 2: Venue */}
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                          📍 {fixture.venue}
                        </div>
                        {/* Line 3: Date · Time */}
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          🗓 {format(parseISO(fixture.match_date), 'EEE d MMM')}{fixture.match_time ? ` · 🕐 ${fixture.match_time.slice(0,5)}` : ''}
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
            <div className="card" style={{ padding: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClubLoader message="Loading…" size={48} />
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

    {/* ── Confirm modal — portalled to body to escape page-fade-in transform ── */}
    {confirmModal.open && createPortal(
      <ConfirmModal
        isOpen={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.danger ? 'Reject' : 'Confirm'}
        cancelLabel="Cancel"
        confirmDanger={confirmModal.danger}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, open: false }))}
      />,
      document.body
    )}

    <style>{`
      @media (max-width: 768px) {
        .admin-two-col { grid-template-columns: 1fr !important; }
      }
    `}</style>
    </>
  )
}
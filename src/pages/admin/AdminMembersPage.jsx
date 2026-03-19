// pavilion-web/src/pages/admin/AdminMembersPage.jsx

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell from '../../components/layout/AppShell.jsx'
import ConfirmModal from '../../components/ui/ConfirmModal.jsx'
import ClubLoader from '../../components/ui/ClubLoader.jsx'
import { PAGE_TITLES, ROLES } from '../../lib/constants.js'



// ─── Role badge colours ────────────────────────────
const ROLE_COLOURS = {
  superadmin: '#A78BFA',
  admin:      '#F5C518',
  captain:    '#22C55E',
  member:     '#8B9BB4',
  pending:    '#F97316',
}

export default function AdminMembersPage() {
  const currentUser    = useAuthStore(state => state.profile)
  const profile        = useAuthStore(state => state.profile)
  const isSuperAdmin   = useAuthStore(state => state.isSuperAdmin)

  const [members,  setMembers]  = useState([])
  const [teams,    setTeams]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,      setSearch]      = useState('')
  const [filter,      setFilter]      = useState('all')  // all | pending | member | captain | admin
  const [rejectModal, setRejectModal] = useState({ open: false, memberId: null, memberName: '' })

  useEffect(() => { document.title = PAGE_TITLES.ADMIN_MEMBERS }, [])
  useEffect(() => { if (profile?.id) loadAll() }, [profile?.id])

  // ── Role options based on who is viewing ──
  // Superadmin can promote up to admin
  // Admin can only promote up to captain — cannot grant admin
  const getRoleOptions = () => {
    if (isSuperAdmin?.()) {
      return [
        { value: 'member',  label: 'Member'  },
        { value: 'captain', label: 'Captain' },
        { value: 'admin',   label: 'Admin'   },
      ]
    }
    return [
      { value: 'member',  label: 'Member'  },
      { value: 'captain', label: 'Captain' },
    ]
  }

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([fetchMembers(), fetchTeams()])
    setLoading(false)
  }

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id, full_name, phone, role, created_at,
        team_members ( team_id, teams ( name ) )
      `)
      .order('full_name')

    if (!error && data) setMembers(data)
  }

  const fetchTeams = async () => {
    const { data } = await supabase.from('teams').select('id, name').order('name')
    if (data) setTeams(data)
  }

  // ── Update member role ──
  const handleRoleChange = async (memberId, newRole, memberName) => {
    if (memberId === currentUser.id) {
      toast.error("You can't change your own role")
      return
    }
    // Only superadmin can grant admin role
    if (newRole === 'admin' && !isSuperAdmin?.()) {
      toast.error('Only a Super Admin can promote members to Admin')
      return
    }

    // 'rejected' is NOT a valid Supabase enum — branch before hitting the DB
    if (newRole === 'rejected') {
      // Delete the profile row entirely instead of setting an invalid role
      const { error: deleteErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', memberId)
      if (deleteErr) { toast.error('Failed to reject: ' + deleteErr.message); return }
      toast(`${memberName}'s application rejected`, { icon: '❌' })
      setMembers(prev => prev.filter(m => m.id !== memberId))
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', memberId)

    if (error) { toast.error('Failed to update role: ' + error.message); return }

    toast.success(`${memberName} is now ${newRole}`)
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))

    // ── Send in-app notification — mirrors native handleRoleChange ────────────
    let notifType  = 'role_change'
    let notifTitle = ''
    let notifBody  = ''

    if (newRole === 'member') {
      notifType  = 'approval'
      notifTitle = '✅ Application Approved'
      notifBody  = 'Welcome to Harrow Town Cricket Club! Your membership has been approved. You now have full access to Pavilion.'
    } else if (newRole === 'captain') {
      notifTitle = "🏏 You've Been Made Captain"
      notifBody  = 'Congratulations! You have been promoted to Captain. You now have access to the Captain panel and squad selection.'
    } else if (newRole === 'admin') {
      notifTitle = '⚙️ You\'ve Been Made Admin'
      notifBody  = 'You have been granted Admin access to the Pavilion platform. You can now manage fixtures, members, and training sessions.'
    }

    if (notifTitle) {
      await supabase.from('notifications').insert({
        user_id: memberId, type: notifType,
        title: notifTitle, body: notifBody, read: false,
      })
    }

    // ── Send approval email via Edge Function ─────────────────────────────
    if (newRole === 'member') {
      try {
        const firstName = memberName?.split(' ')[0] || memberName

        // Fetch email from profiles
        const { data: memberProfile, error: profileErr } = await supabase
          .from('profiles').select('email').eq('id', memberId).single()

        console.log('[Approval] memberProfile:', memberProfile, 'error:', profileErr)

        if (!memberProfile?.email) {
          console.warn('[Approval] No email found for member:', memberId)
        } else {
          console.log('[Approval] Invoking edge function for:', memberProfile.email)
          const { data: fnData, error: fnErr } = await supabase.functions.invoke(
            'send-approval-email',
            { body: { email: memberProfile.email, firstName } }
          )
          console.log('[Approval] Function result:', fnData, 'error:', fnErr)
          if (fnErr) console.error('[Approval] Edge function error:', fnErr)
        }
      } catch (err) {
        console.error('[Approval] Unexpected error:', err.message)
      }
    }
  }

  // ── Assign member to team ──
  const handleTeamToggle = async (memberId, teamId, isAssigned, memberName) => {
    if (isAssigned) {
      // Remove from team
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('player_id', memberId)
        .eq('team_id', teamId)

      if (error) { toast.error('Failed to remove from team'); return }
      toast(`Removed from team`, { icon: '➖' })
    } else {
      // Add to team
      const { error } = await supabase
        .from('team_members')
        .insert({ player_id: memberId, team_id: teamId, status: 'active' })

      if (error) { toast.error('Failed to add to team'); return }
      toast.success(`Added to team`)
    }

    await fetchMembers()
  }

  // ── Filter + search ──
  const displayed = members.filter(m => {
    const matchSearch = m.full_name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || m.role === filter
    return matchSearch && matchFilter
  })

  const filterCounts = {
    all:     members.length,
    pending: members.filter(m => m.role === 'pending').length,
    member:  members.filter(m => m.role === 'member').length,
    captain: members.filter(m => m.role === 'captain').length,
    admin:   members.filter(m => ['admin','superadmin'].includes(m.role)).length,
  }

  return (
    <AppShell>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '32px' }}>
          <div className="section-label">Administration</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '2px', lineHeight: 1 }}>
            MEMBERS
          </h1>
        </div>

        {/* ── Filter tabs + Search ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { key: 'all',     label: 'All' },
              { key: 'pending', label: 'Pending' },
              { key: 'member',  label: 'Members' },
              { key: 'captain', label: 'Captains' },
              { key: 'admin',   label: 'Admins' },
            ].map(tab => (
              <button key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  padding: '7px 14px', borderRadius: 'var(--radius-full)',
                  border: `1px solid ${filter === tab.key ? 'rgba(245,197,24,0.4)' : 'var(--navy-border)'}`,
                  background: filter === tab.key ? 'rgba(245,197,24,0.08)' : 'transparent',
                  color: filter === tab.key ? 'var(--gold)' : 'var(--text-muted)',
                  fontSize: '13px', fontWeight: filter === tab.key ? 700 : 400,
                  cursor: 'pointer', transition: 'var(--transition)',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                {tab.label}
                <span style={{
                  background: filter === tab.key ? 'rgba(245,197,24,0.2)' : 'rgba(255,255,255,0.06)',
                  color: filter === tab.key ? 'var(--gold)' : 'var(--text-muted)',
                  borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 700,
                }}>
                  {filterCounts[tab.key]}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            className="input"
            style={{ width: '220px', margin: 0 }}
            placeholder="🔍  Search members…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* ── Members list ── */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <ClubLoader message="Loading members…" size={64} />
          </div>
        ) : displayed.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No members found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {displayed.map(member => {
              const memberTeamIds = member.team_members?.map(tm => tm.team_id) || []
              const isCurrentUser = member.id === currentUser.id
              const roleColor     = ROLE_COLOURS[member.role] || '#8B9BB4'

              return (
                // ── Native card structure: top row → team chips → actions ──
                <div key={member.id} className="card" style={{ padding: '16px' }}>

                  {/* ── Top row: avatar + name/role/sub — mirrors native memberTop ── */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(255,255,255,0.05)',
                      border: `2px solid ${roleColor}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: 700, color: roleColor,
                    }}>
                      {member.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Name row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                          {member.full_name}
                        </span>
                        {isCurrentUser && (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gold)', background: 'rgba(245,197,24,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                            You
                          </span>
                        )}
                        <span style={{
                          fontSize: '9px', fontWeight: 700, letterSpacing: '1px',
                          textTransform: 'uppercase', color: roleColor,
                          background: `${roleColor}18`,
                          border: `1px solid ${roleColor}44`,
                          padding: '2px 7px', borderRadius: '4px',
                        }}>
                          {member.role.toUpperCase()}
                        </span>
                      </div>
                      {/* Sub */}
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {member.phone || 'No phone'} · {format(parseISO(member.created_at), 'd MMM yyyy')}
                      </div>
                    </div>
                  </div>

                  {/* ── Team chips — mirrors native teamChips ── */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    {teams.map(team => {
                      const assigned = memberTeamIds.includes(team.id)
                      return (
                        <button key={team.id}
                          onClick={() => handleTeamToggle(member.id, team.id, assigned, member.full_name)}
                          style={{
                            padding: '4px 10px', borderRadius: 'var(--radius-full)',
                            border: `1px solid ${assigned ? 'rgba(34,197,94,0.4)' : 'var(--navy-border)'}`,
                            background: assigned ? 'rgba(34,197,94,0.1)' : 'transparent',
                            color: assigned ? '#22C55E' : 'var(--text-muted)',
                            fontSize: '11px', fontWeight: assigned ? 700 : 400,
                            cursor: 'pointer', transition: 'var(--transition)',
                          }}>
                          {assigned ? '✓ ' : '+ '}{team.name}
                        </button>
                      )
                    })}
                  </div>

                  {/* ── Pending actions — ✓ ✕ stacked, matches native pendingActions ── */}
                  {!isCurrentUser && member.role === 'pending' && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <button
                        onClick={() => handleRoleChange(member.id, 'member', member.full_name)}
                        style={{
                          flex: 1, padding: '10px 0',
                          borderRadius: 'var(--radius-md)',
                          background: 'rgba(34,197,94,0.12)',
                          border: '1px solid rgba(34,197,94,0.3)',
                          color: '#22C55E', fontSize: '13px', fontWeight: 700,
                          cursor: 'pointer', transition: 'var(--transition)',
                        }}
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => setRejectModal({ open: true, memberId: member.id, memberName: member.full_name })}
                        style={{
                          flex: 1, padding: '10px 0',
                          borderRadius: 'var(--radius-md)',
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.2)',
                          color: 'var(--red)', fontSize: '13px', fontWeight: 700,
                          cursor: 'pointer', transition: 'var(--transition)',
                        }}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  )}

                  {/* ── Role change — dropdown for non-pending, non-superadmin, non-self ── */}
                  {!isCurrentUser && member.role !== 'superadmin' && member.role !== 'pending' && (
                    <select
                      className="input"
                      style={{ width: '100%', margin: 0, fontSize: '12px', padding: '8px 12px' }}
                      value={member.role}
                      onChange={e => handleRoleChange(member.id, e.target.value, member.full_name)}
                    >
                      {getRoleOptions().map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
    {createPortal(
        <ConfirmModal
          isOpen={rejectModal.open}
          title="Reject Application"
          message={`Reject ${rejectModal.memberName}'s application and remove them from the platform? This cannot be undone.`}
          confirmLabel="Reject"
          cancelLabel="Cancel"
          confirmDanger={true}
          onConfirm={() => {
            handleRoleChange(rejectModal.memberId, 'rejected', rejectModal.memberName)
            setRejectModal({ open: false, memberId: null, memberName: '' })
          }}
          onCancel={() => setRejectModal({ open: false, memberId: null, memberName: '' })}
        />,
        document.body
      )}
    </AppShell>
  )
}
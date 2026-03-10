// pavilion-web/src/pages/admin/AdminMembersPage.jsx

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell from '../../components/layout/AppShell.jsx'
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
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('all')  // all | pending | member | captain | admin

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

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', memberId)

    if (error) { toast.error('Failed to update role'); return }

    toast.success(`${memberName} is now ${newRole}`)
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
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

        {/* ── Members Table ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>No Members Added.</div>
        ) : displayed.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No members found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {displayed.map(member => {
              const memberTeamIds = member.team_members?.map(tm => tm.team_id) || []
              const isCurrentUser = member.id === currentUser.id

              return (
                <div key={member.id} className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>

                    {/* Avatar */}
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--navy-light), var(--gold-dim))',
                      border: `2px solid ${ROLE_COLOURS[member.role] || 'var(--navy-border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 700,
                      color: ROLE_COLOURS[member.role] || 'var(--text-muted)',
                    }}>
                      {member.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                          {member.full_name}
                        </span>
                        {isCurrentUser && (
                          <span style={{ fontSize: '11px', color: 'var(--gold)', background: 'rgba(245,197,24,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                            You
                          </span>
                        )}
                        <span style={{
                          fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
                          color: ROLE_COLOURS[member.role], background: `${ROLE_COLOURS[member.role]}18`,
                          padding: '2px 8px', borderRadius: '4px',
                        }}>
                          {member.role}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {member.phone || 'No phone'} · Joined {format(parseISO(member.created_at), 'd MMM yyyy')}
                      </div>

                      {/* Team chips */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                        {teams.map(team => {
                          const assigned = memberTeamIds.includes(team.id)
                          return (
                            <button key={team.id}
                              onClick={() => handleTeamToggle(member.id, team.id, assigned, member.full_name)}
                              style={{
                                padding: '4px 10px', borderRadius: 'var(--radius-full)',
                                border: `1px solid ${assigned ? 'rgba(34,197,94,0.4)' : 'var(--navy-border)'}`,
                                background: assigned ? 'rgba(34,197,94,0.1)' : 'transparent',
                                color: assigned ? 'var(--green)' : 'var(--text-muted)',
                                fontSize: '12px', fontWeight: assigned ? 600 : 400,
                                cursor: 'pointer', transition: 'var(--transition)',
                              }}>
                              {assigned ? '✓ ' : '+ '}{team.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Role selector */}
                    {!isCurrentUser && member.role !== 'superadmin' && (
                      <select
                        className="input"
                        style={{ width: '130px', margin: 0, fontSize: '13px', padding: '8px 12px' }}
                        value={member.role === 'pending' ? 'pending' : member.role}
                        onChange={e => handleRoleChange(member.id, e.target.value, member.full_name)}
                      >
                        {member.role === 'pending' && (
                          <option value="pending" disabled>Pending…</option>
                        )}
                        {getRoleOptions().map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    )}

                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </AppShell>
  )
}
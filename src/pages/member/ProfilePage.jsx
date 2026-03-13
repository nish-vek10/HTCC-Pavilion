// pavilion-web/src/pages/member/ProfilePage.jsx

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell from '../../components/layout/AppShell.jsx'
import { PAGE_TITLES } from '../../lib/constants.js'

// ─── CONFIGURABLE: Avatar accent colours to choose from ──
const AVATAR_COLOURS = [
  { label: 'Gold',    value: '#F5C518' },
  { label: 'Green',   value: '#22C55E' },
  { label: 'Blue',    value: '#3B82F6' },
  { label: 'Purple',  value: '#A78BFA' },
  { label: 'Orange',  value: '#F97316' },
  { label: 'Pink',    value: '#EC4899' },
]

// ─── Role badge config ─────────────────────────────
const ROLE_META = {
  superadmin: { label: 'Super Admin', color: '#A78BFA', desc: 'Full platform access' },
  admin:      { label: 'Admin',       color: '#F5C518', desc: 'Club Administrator' },
  captain:    { label: 'Captain',     color: '#22C55E', desc: 'Team Captain' },
  member:     { label: 'Member',      color: '#8B9BB4', desc: 'Club Member' },
  pending:    { label: 'Pending',     color: '#F97316', desc: 'Awaiting Approval' },
}

export default function ProfilePage() {
  const profile       = useAuthStore(state => state.profile)
  const updateProfile = useAuthStore(state => state.updateProfile)
  const user          = useAuthStore(state => state.user)

  const [form, setForm] = useState({
    full_name:    '',
    phone:        '',
    avatar_color: '#F5C518',
  })
  const [loading,   setLoading]   = useState(false)
  const [pwForm,    setPwForm]    = useState({ current: '', newPw: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [showPw,    setShowPw]    = useState(false)
  const [myTeams,   setMyTeams]   = useState([])

  useEffect(() => { document.title = PAGE_TITLES.PROFILE }, [])

  // ── Populate form from current profile ──
  useEffect(() => {
    if (profile) {
      setForm({
        full_name:    profile.full_name    || '',
        phone:        profile.phone        || '',
        avatar_color: profile.avatar_color || '#F5C518',
      })
    }
  }, [profile])

  // ── Load teams this member belongs to ──
  useEffect(() => {
    if (profile?.id) fetchMyTeams()
  }, [profile?.id])

  const fetchMyTeams = async () => {
    const { data } = await supabase
      .from('team_members')
      .select('teams(id, name, day_type)')
      .eq('player_id', profile.id)
      .eq('status', 'active')
    if (data) setMyTeams(data.map(t => t.teams).filter(Boolean))
  }

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // ── Save profile changes ──
  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.full_name.trim()) { toast.error('Name cannot be empty'); return }

    setLoading(true)
    try {
      await updateProfile({
        full_name:    form.full_name.trim(),
        phone:        form.phone.trim() || null,
        avatar_color: form.avatar_color,
      })
      toast.success('Profile updated successfully')
    } catch (err) {
      toast.error('Failed to update profile: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Change password ──
  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (pwForm.newPw !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    if (pwForm.newPw.length < 8)         { toast.error('Password must be at least 8 characters'); return }

    setPwLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pwForm.newPw })
      if (error) throw error
      toast.success('Password changed successfully')
      setPwForm({ current: '', newPw: '', confirm: '' })
    } catch (err) {
      toast.error('Failed to change password: ' + err.message)
    } finally {
      setPwLoading(false)
    }
  }

  const roleMeta   = ROLE_META[profile?.role] || ROLE_META.member
  const initials   = form.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  const avatarColor = form.avatar_color || '#F5C518'

  return (
    <AppShell>
      <div className="page-inner" style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '36px' }} className="animate-fade-in">
          <div className="section-label">Account</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '2px', lineHeight: 1 }}>
            MY PROFILE
          </h1>
        </div>

        {/* ── Profile card ── */}
        <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>

          {/* Avatar + identity row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px', flexWrap: 'wrap' }}>
            {/* Big avatar */}
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, var(--navy-light), ${avatarColor}33)`,
              border: `3px solid ${avatarColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: '28px', letterSpacing: '2px',
              color: avatarColor,
              boxShadow: `0 0 24px ${avatarColor}33`,
            }}>
              {initials}
            </div>

            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', letterSpacing: '1px', color: 'var(--text-primary)', lineHeight: 1 }}>
                {profile?.full_name}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {user?.email}
              </div>
              {/* Role badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                marginTop: '8px',
                fontSize: '11px', fontWeight: 700, letterSpacing: '1px',
                textTransform: 'uppercase',
                color: roleMeta.color,
                background: `${roleMeta.color}18`,
                border: `1px solid ${roleMeta.color}33`,
                padding: '4px 12px', borderRadius: '20px',
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: roleMeta.color }} />
                {roleMeta.label} · {roleMeta.desc}
              </div>
            </div>
          </div>

          {/* ── Edit form ── */}
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>

              <div style={{ gridColumn: '1 / -1' }}>
                <label className="input-label">Full Name</label>
                <input className="input" name="full_name" type="text"
                  value={form.full_name} onChange={handleChange} required />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label className="input-label">
                  Phone{' '}
                  <span style={{ color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                    (optional)
                  </span>
                </label>
                <input className="input" name="phone" type="tel"
                  placeholder="+44 7700 000000"
                  value={form.phone} onChange={handleChange} />
              </div>

              {/* Email (read-only) */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="input-label">Email</label>
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--navy-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px', color: 'var(--text-muted)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  {user?.email}
                  <span style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '1px' }}>
                    READ ONLY
                  </span>
                </div>
              </div>

              {/* Avatar colour picker */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="input-label">Avatar Colour</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {AVATAR_COLOURS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onClick={() => setForm(prev => ({ ...prev, avatar_color: c.value }))}
                      style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: c.value,
                        border: form.avatar_color === c.value
                          ? `3px solid var(--text-primary)`
                          : '3px solid transparent',
                        cursor: 'pointer',
                        boxShadow: form.avatar_color === c.value
                          ? `0 0 12px ${c.value}66`
                          : 'none',
                        transition: 'var(--transition)',
                        outline: 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn--primary"
              style={{ minWidth: '160px' }} disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* ── My Teams card ── */}
        <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
            My Teams
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>
              Managed by admin
            </span>
          </div>

          {myTeams.length === 0 ? (
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', padding: '8px 0' }}>
              You haven't been assigned to any teams yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {myTeams.map(team => (
                <div key={team.id} style={{
                  padding: '8px 18px', borderRadius: 'var(--radius-full)',
                  background: 'rgba(245,197,24,0.08)',
                  border: '1px solid rgba(245,197,24,0.25)',
                  color: 'var(--gold)', fontSize: '13px', fontWeight: 600,
                  letterSpacing: '0.5px',
                }}>
                  🏏 {team.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Change Password card ── */}
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '20px' }}>
            Change Password
          </div>

          <form onSubmit={handlePasswordChange}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="input-label" style={{ marginBottom: 0 }}>New Password</label>
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input className="input" type={showPw ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  value={pwForm.newPw}
                  onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))}
                  required autoComplete="new-password" />
              </div>

              <div>
                <label className="input-label">Confirm New Password</label>
                <input className="input" type={showPw ? 'text' : 'password'}
                  placeholder="Repeat new password"
                  value={pwForm.confirm}
                  onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                  required autoComplete="new-password" />
                {pwForm.confirm && pwForm.newPw !== pwForm.confirm && (
                  <div style={{ fontSize: '12px', color: 'var(--red)', marginTop: '4px' }}>
                    Passwords don't match
                  </div>
                )}
              </div>
            </div>

            <button type="submit" className="btn btn--secondary"
              style={{ minWidth: '180px' }} disabled={pwLoading}>
              {pwLoading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>

      </div>
    </AppShell>
  )
}
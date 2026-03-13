// pavilion-web/src/components/layout/Navbar.jsx

import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore.js'
import { APP_NAME, CLUB_SHORT, ROUTES } from '../../lib/constants.js'
import NotificationBell from './NotificationBell.jsx'

// ─── CONFIGURABLE: Nav links per role ─────────────
const MEMBER_NAV = [
  { label: 'Home',     path: ROUTES.DASHBOARD },
  { label: 'Fixtures', path: ROUTES.FIXTURES },
  { label: 'My Teams', path: ROUTES.TEAMS },
]

const CAPTAIN_NAV = [
  { label: 'Home',      path: ROUTES.DASHBOARD },
  { label: 'My Teams',  path: ROUTES.TEAMS },
  { label: 'Fixtures',  path: '/captain/fixtures' },
]

const ADMIN_NAV = [
  { label: 'Overview',  path: ROUTES.ADMIN_DASHBOARD },
  { label: 'Matchday',  path: '/admin/matchday' },
  { label: 'Fixtures',  path: ROUTES.ADMIN_FIXTURES },
  { label: 'Members',   path: ROUTES.ADMIN_MEMBERS },
  { label: 'Announce',  path: ROUTES.ADMIN_ANNOUNCEMENTS },
]

export default function Navbar() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const signOut   = useAuthStore(state => state.signOut)
  const profile   = useAuthStore(state => state.profile)
  const isAdmin      = useAuthStore(state => state.isAdmin)
  const isCaptain    = useAuthStore(state => state.isCaptain)
  const isSuperAdmin = useAuthStore(state => state.isSuperAdmin)

  const [menuOpen,    setMenuOpen]    = useState(false)  // Mobile hamburger
  const [profileOpen, setProfileOpen] = useState(false)  // Profile dropdown
  const dropdownRef = useRef(null)

  // ── Determine nav links based on role ──
  const navLinks = isAdmin() ? ADMIN_NAV
    : isCaptain() ? CAPTAIN_NAV
    : MEMBER_NAV

  // ── Close dropdown when clicking outside ──
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Sign out handler ──
  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out successfully')
    navigate(ROUTES.LANDING)
  }

  // ── Get initials for avatar ──
  const getInitials = (name) => {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  // ── Role badge config ──
  const roleBadge = {
    superadmin: { label: 'Super Admin', color: '#A78BFA' },
    admin:      { label: 'Admin',       color: '#F5C518' },
    captain:    { label: 'Captain',     color: '#22C55E' },
    member:     { label: 'Member',      color: '#8B9BB4' },
  }[profile?.role] || { label: 'Member', color: '#8B9BB4' }

  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(13,27,42,0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--navy-border)',
        padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '64px',
        transition: 'var(--transition)',
      }}>

        {/* ── Left: Pavilion app identity ── */}
        <Link to={ROUTES.DASHBOARD} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src="/assets/icons/pavilion-icon.svg"
            alt="Pavilion"
            style={{
              width: '38px',
              height: '38px',
              objectFit: 'contain',
              borderRadius: '10px',
              flexShrink: 0,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              letterSpacing: '0.1em',
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}>
              PAVILION
            </span>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              fontWeight: 400,
              letterSpacing: '0.25em',
              color: 'var(--gold)',
              lineHeight: 1,
            }}>
              HTCC
            </span>
          </div>
        </Link>

        {/* ── Centre: Nav links (desktop) ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}
          className="nav-desktop">
          {navLinks.map(link => {
            // Exact match for root paths, prefix match only for non-root admin paths
            const isActive = link.path === '/admin'
              ? location.pathname === '/admin'
              : location.pathname === link.path ||
                location.pathname.startsWith(link.path + '/')

            return (
              <Link key={link.path} to={link.path} style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--gold)' : 'var(--text-muted)',
                  background: isActive ? 'rgba(245,197,24,0.08)' : 'transparent',
                  transition: 'var(--transition)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = isActive ? 'rgba(245,197,24,0.08)' : 'transparent' }}
                >
                  {link.label}
                </div>
              </Link>
            )
          })}
        </div>

        {/* ── Right: HTCC identity + Profile ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

          {/* HTCC crest + club name — hidden on mobile via className */}
          <div className="navbar-htcc-identity" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            paddingRight: '12px',
            borderRight: '1px solid var(--navy-border)',
          }}>

            {/* Gold-ringed crest badge */}
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: '#0D1B2A',
              border: '2px solid #F5C518',
              boxShadow: '0 0 0 3px rgba(245,197,24,0.15), 0 2px 10px rgba(0,0,0,0.6)',
              overflow: 'hidden',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <img
                src="/assets/images/htcc-logo.png"
                alt="HTCC Crest"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center 20%',
                  mixBlendMode: 'screen',
                }}
              />
            </div>

            {/* Club name — two stacked lines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                letterSpacing: '0.1em',
                color: '#F5C518',
                lineHeight: 1,
              }}>
                HARROW TOWN
              </span>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                letterSpacing: '0.15em',
                color: '#8B9BB4',
                lineHeight: 1,
              }}>
                CRICKET CLUB
              </span>
            </div>
          </div>

          {/* Notification bell */}
          <NotificationBell />

          {/* Profile dropdown */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setProfileOpen(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: profileOpen ? 'rgba(245,197,24,0.08)' : 'var(--bg-elevated)',
                border: `1px solid ${profileOpen ? 'rgba(245,197,24,0.3)' : 'var(--navy-border)'}`,
                borderRadius: 'var(--radius-full)',
                padding: '5px 12px 5px 5px',
                cursor: 'pointer', transition: 'var(--transition)',
              }}>
              {/* Avatar circle */}
              <div style={{
                width: '30px', height: '30px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--navy-light), var(--gold-dim))',
                border: '1px solid rgba(245,197,24,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, color: 'var(--gold)',
                flexShrink: 0,
              }}>
                {getInitials(profile?.full_name)}
              </div>
              <div className="navbar-profile-name" style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  {profile?.full_name?.split(' ')[0] || 'Member'}
                </div>
                <div style={{ fontSize: '10px', color: roleBadge.color, letterSpacing: '0.5px' }}>
                  {roleBadge.label}
                </div>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '2px' }}>
                {profileOpen ? '▲' : '▼'}
              </span>
            </button>

            {/* Dropdown menu */}
            {profileOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: 'var(--bg-surface)',
                border: '1px solid var(--navy-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '8px',
                minWidth: '200px',
                boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
                animation: 'fade-in 0.15s ease',
                zIndex: 200,
              }}>
                {/* Profile header */}
                <div style={{
                  padding: '10px 12px 14px',
                  borderBottom: '1px solid var(--navy-border)',
                  marginBottom: '6px',
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {profile?.full_name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {profile?.email || ''}
                  </div>
                  <div style={{
                    display: 'inline-block', marginTop: '6px',
                    fontSize: '10px', fontWeight: 700,
                    letterSpacing: '1px', textTransform: 'uppercase',
                    color: roleBadge.color,
                    background: `${roleBadge.color}18`,
                    padding: '2px 8px', borderRadius: '4px',
                  }}>
                    {roleBadge.label}
                  </div>
                </div>

                {/* Menu items */}
                {[
                  { label: '👤  My Profile',   path: ROUTES.PROFILE },
                  { label: '👥  My Teams',      path: ROUTES.TEAMS },
                  ...(isAdmin() ? [{ label: '⚙️  Admin Panel', path: ROUTES.ADMIN_DASHBOARD }] : []),
                ].map(item => (
                  <button key={item.path}
                    onClick={() => { navigate(item.path); setProfileOpen(false) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '9px 12px', borderRadius: 'var(--radius-md)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '13px', color: 'var(--text-muted)',
                      transition: 'var(--transition)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)' }}
                  >
                    {item.label}
                  </button>
                ))}

                {/* ── Preview as Member ── */}
                {(isAdmin() || isSuperAdmin?.()) && (
                  <div style={{ marginTop: '6px' }}>
                    <div style={{
                      padding: '6px 12px 4px',
                      fontSize: '10px', fontWeight: 700,
                      letterSpacing: '1.5px', textTransform: 'uppercase',
                      color: 'var(--text-faint)',
                    }}>
                      Preview as Member
                    </div>
                    {[
                      { label: '🏠 Dashboard', to: '/dashboard' },
                      { label: '📅 Fixtures',  to: '/fixtures'  },
                      { label: '👥 My Teams',  to: '/teams'     },
                      { label: '👤 Profile',   to: '/profile'   },
                    ].map(link => (
                      <button
                        key={link.to}
                        onClick={() => { navigate(link.to); setProfileOpen(false) }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '9px 12px', borderRadius: 'var(--radius-md)',
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: '13px', color: 'var(--text-muted)',
                          transition: 'var(--transition)',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(245,197,24,0.06)'
                          e.currentTarget.style.color = 'var(--gold)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'none'
                          e.currentTarget.style.color = 'var(--text-muted)'
                        }}
                      >
                        {link.label}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--navy-border)', marginTop: '6px', paddingTop: '6px' }}>
                  <button
                    onClick={handleSignOut}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '9px 12px', borderRadius: 'var(--radius-md)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '13px', color: 'var(--red)',
                      transition: 'var(--transition)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-fill)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                  >
                    🚪  Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(m => !m)}
            className="nav-mobile nav-mobile-hamburger"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-primary)', fontSize: '22px', padding: '4px',
            }}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* ── Mobile slide-down menu ── */}
      {menuOpen && (
        <div style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--navy-border)',
          padding: '12px 16px',
          display: 'flex', flexDirection: 'column', gap: '4px',
          position: 'sticky', top: '64px', zIndex: 99,
        }} className="nav-mobile nav-mobile-menu">
          {navLinks.map(link => (
            <Link key={link.path} to={link.path}
              style={{ textDecoration: 'none' }}
              onClick={() => setMenuOpen(false)}>
              <div style={{
                padding: '12px 16px', borderRadius: 'var(--radius-md)',
                color: location.pathname === link.path ? 'var(--gold)' : 'var(--text-muted)',
                background: location.pathname === link.path ? 'rgba(245,197,24,0.08)' : 'transparent',
                fontSize: '15px', fontWeight: 500,
              }}>
                {link.label}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Desktop/mobile nav visibility styles */}
      <style>{`
        .nav-mobile { display: none; }
        @media (max-width: 768px) {
          .nav-desktop { display: none !important; }
          .nav-mobile  { display: flex !important; }
        }
      `}</style>
    </>
  )
}
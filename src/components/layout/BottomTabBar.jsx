// pavilion-web/src/components/layout/BottomTabBar.jsx

// ── iOS-style fixed bottom navigation bar ──
// Shown only on mobile (≤768px) via CSS.
// Replaces the hamburger menu entirely on small screens.

import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'
import { ROUTES } from '../../lib/constants.js'

// ─── CONFIGURABLE: Tab definitions per role ────────
const MEMBER_TABS = [
  { label: 'Home',     path: ROUTES.DASHBOARD,  icon: '⚡' },
  { label: 'Fixtures', path: ROUTES.FIXTURES,   icon: '📅' },
  { label: 'Teams',    path: ROUTES.TEAMS,      icon: '🏏' },
  { label: 'Profile',  path: ROUTES.PROFILE,    icon: '👤' },
]

const CAPTAIN_TABS = [
  { label: 'Home',     path: ROUTES.DASHBOARD,       icon: '⚡' },
  { label: 'Teams',    path: ROUTES.TEAMS,           icon: '🏏' },
  { label: 'Fixtures', path: '/captain/fixtures',    icon: '📅' },
  { label: 'Profile',  path: ROUTES.PROFILE,         icon: '👤' },
]

const ADMIN_TABS = [
  { label: 'Overview',  path: ROUTES.ADMIN_DASHBOARD,      icon: '📊' },
  { label: 'Matchday',  path: '/admin/matchday',           icon: '⚡' },
  { label: 'Fixtures',  path: ROUTES.ADMIN_FIXTURES,       icon: '📅' },
  { label: 'Members',   path: ROUTES.ADMIN_MEMBERS,        icon: '👥' },
  { label: 'Announce',  path: ROUTES.ADMIN_ANNOUNCEMENTS,  icon: '📢' },
]

export default function BottomTabBar() {
  const navigate     = useNavigate()
  const location     = useLocation()
  const isAdmin      = useAuthStore(state => state.isAdmin)
  const isCaptain    = useAuthStore(state => state.isCaptain)

  const tabs = isAdmin() ? ADMIN_TABS : isCaptain() ? CAPTAIN_TABS : MEMBER_TABS

  return (
    <nav
      className="bottom-tab-bar"
      style={{
        position:       'fixed',
        bottom:         0, left: 0, right: 0,
        zIndex:         200,
        background:     'rgba(13,27,42,0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop:      '1px solid rgba(245,197,24,0.15)',
        display:        'flex',
        alignItems:     'stretch',
        paddingBottom:  'env(safe-area-inset-bottom)',
        boxShadow:      '0 -4px 32px rgba(0,0,0,0.5)',
      }}
    >
      {tabs.map(tab => {
        // Exact match for /admin root, prefix match for everything else
        const isActive = tab.path === '/admin'
          ? location.pathname === '/admin'
          : location.pathname === tab.path ||
            location.pathname.startsWith(tab.path + '/')

        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              flex:           1,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '4px',
              padding:        '10px 4px 12px',
              background:     'none',
              border:         'none',
              cursor:         'pointer',
              position:       'relative',
              transition:     'all 0.2s ease',
              minHeight:      '56px',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {/* ── Active gold indicator dot ── */}
            {isActive && (
              <div style={{
                position:     'absolute',
                top:          '6px',
                width:        '4px', height: '4px',
                borderRadius: '50%',
                background:   '#F5C518',
                boxShadow:    '0 0 6px rgba(245,197,24,0.9)',
              }} />
            )}

            {/* ── Tab icon ── */}
            <span style={{
              fontSize:   '20px',
              lineHeight: 1,
              filter:     isActive ? 'none' : 'grayscale(0.2) opacity(0.45)',
              transform:  isActive ? 'scale(1.15)' : 'scale(1)',
              transition: 'all 0.2s ease',
            }}>
              {tab.icon}
            </span>

            {/* ── Tab label ── */}
            <span style={{
              fontSize:     '10px',
              fontWeight:   isActive ? 700 : 400,
              color:        isActive ? '#F5C518' : '#8B9BB4',
              letterSpacing:'0.3px',
              lineHeight:   1,
              transition:   'all 0.2s ease',
              fontFamily:   'var(--font-body)',
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
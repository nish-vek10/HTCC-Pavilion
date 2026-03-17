// pavilion-web/src/components/layout/BottomTabBar.jsx
// iOS-style fixed bottom navigation bar.
// Shown only on mobile (≤768px) via CSS — hidden on desktop.
// Member: Home / Fixtures / Teams / Alerts / Profile — matches native app exactly.

import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'
import { ROUTES } from '../../lib/constants.js'

// ─── CONFIGURABLE: Tab definitions per role ───────────────────────────────────
// icon: emoji string, OR null to render the HTCC crest badge instead
const MEMBER_TABS = [
  { label: 'Home',     path: ROUTES.DASHBOARD,     icon: '⚡'  },
  { label: 'Fixtures', path: ROUTES.FIXTURES,      icon: '📅'  },
  { label: 'Teams',    path: ROUTES.TEAMS,         icon: null  },  // HTCC crest
  { label: 'Alerts',   path: ROUTES.NOTIFICATIONS, icon: '🔔'  },
  { label: 'Profile',  path: ROUTES.PROFILE,       icon: '👤'  },
]

const CAPTAIN_TABS = [
  { label: 'Home',     path: ROUTES.DASHBOARD,      icon: '⚡'  },
  { label: 'Fixtures', path: '/captain/fixtures',   icon: '📅'  },
  { label: 'Teams',    path: ROUTES.TEAMS,          icon: null  },  // HTCC crest
  { label: 'Alerts',   path: ROUTES.NOTIFICATIONS,  icon: '🔔'  },
  { label: 'Profile',  path: '/captain/profile',    icon: '👤'  },  // distinct path → fromAdmin=true
]

const ADMIN_TABS = [
  { label: 'Overview', path: ROUTES.ADMIN_DASHBOARD,     icon: null  },  // HTCC crest — mirrors native CrestIcon
  { label: 'Matchday', path: '/admin/matchday',          icon: '🏏'  },  // matches native
  { label: 'Fixtures', path: ROUTES.ADMIN_FIXTURES,      icon: '📅'  },
  { label: 'Members',  path: ROUTES.ADMIN_MEMBERS,       icon: '👥'  },
  { label: 'Sessions', path: ROUTES.ADMIN_ANNOUNCEMENTS, icon: '🏋️' },
  { label: 'Profile',  path: '/admin/profile',           icon: '👤'  },  // distinct path → fromAdmin=true
]

export default function BottomTabBar() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const isAdmin   = useAuthStore(state => state.isAdmin)
  const isCaptain = useAuthStore(state => state.isCaptain)
  const profile   = useAuthStore(state => state.profile)

  // Derive initials + avatar colour from profile — used for Profile tab icon
  const avatarColor    = profile?.avatar_color || '#F5C518'
  const avatarInitials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  // ── Detect panel context from URL — mirrors native RootNavigator ──────────
  // Admin/captain on /admin/* or /captain/* → their panel tabs
  // Admin/captain on member paths (/dashboard, /fixtures, etc.) → member tabs
  // This replicates MemberNavigator vs AdminNavigator being separate navigators
  const onAdminPath   = location.pathname.startsWith('/admin')
  const onCaptainPath = location.pathname.startsWith('/captain')

  const tabs = onAdminPath
    ? ADMIN_TABS
    : onCaptainPath
    ? CAPTAIN_TABS
    : MEMBER_TABS

  return (
    <nav
      className="bottom-tab-bar"
      style={{
        position:             'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex:               200,
        background:           'rgba(13,27,42,0.97)',
        backdropFilter:       'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop:            '1px solid rgba(245,197,24,0.15)',
        display:              'flex',
        alignItems:           'stretch',
        paddingBottom:        'env(safe-area-inset-bottom)',
        boxShadow:            '0 -4px 32px rgba(0,0,0,0.5)',
      }}
    >
      {tabs.map(tab => {
        // Exact match for /admin root; prefix match for all other paths
        const isActive = tab.path === '/admin'
          ? location.pathname === '/admin'
          : location.pathname === tab.path ||
            location.pathname.startsWith(tab.path + '/')

        return (
          <button
            key={tab.path}
            onClick={() => {
              navigate(tab.path)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            style={{
              flex:                    1,
              display:                 'flex',
              flexDirection:           'column',
              alignItems:              'center',
              justifyContent:          'center',
              gap:                     '4px',
              padding:                 '10px 4px 12px',
              background:              'none',
              border:                  'none',
              cursor:                  'pointer',
              position:                'relative',
              transition:              'all 0.2s ease',
              minHeight:               '56px',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {/* Active gold dot indicator */}
            {isActive && (
              <div style={{
                position: 'absolute', top: '6px',
                width: '4px', height: '4px',
                borderRadius: '50%',
                background: '#F5C518',
                boxShadow: '0 0 6px rgba(245,197,24,0.9)',
              }} />
            )}

            {/* Icon — three cases: HTCC crest (Teams), avatar circle (Profile), emoji (all others) */}
            {tab.icon === null ? (
              // HTCC crest — Teams tab (member) and Overview tab (admin), mirrors native CrestIcon
              <div style={{
                width: '24px', height: '24px',
                borderRadius: '50%',
                background: '#0D1B2A',
                border: isActive ? '2px solid #F5C518' : '2px solid rgba(139,155,180,0.4)',
                boxShadow: isActive
                  ? '0 0 0 2px rgba(245,197,24,0.25), 0 0 8px rgba(245,197,24,0.4)'
                  : 'none',
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transform: isActive ? 'scale(1.15)' : 'scale(1)',
                transition: 'all 0.2s ease',
              }}>
                <img
                  src="/assets/images/htcc-logo.png"
                  alt="Teams"
                  style={{
                    width: '100%', height: '100%',
                    objectFit: 'cover', objectPosition: 'center 20%',
                    mixBlendMode: 'screen',
                    opacity: isActive ? 1 : 0.5,
                  }}
                />
              </div>
            ) : tab.label === 'Profile' ? (
              // Avatar circle with initials — Profile tab
              <div style={{
                width: '24px', height: '24px',
                borderRadius: '50%',
                background: `${avatarColor}22`,
                border: isActive
                  ? `2px solid ${avatarColor}`
                  : '2px solid rgba(139,155,180,0.4)',
                boxShadow: isActive
                  ? `0 0 0 2px ${avatarColor}30, 0 0 8px ${avatarColor}50`
                  : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transform: isActive ? 'scale(1.15)' : 'scale(1)',
                transition: 'all 0.2s ease',
                fontSize: '9px', fontWeight: 700,
                color: isActive ? avatarColor : 'rgba(139,155,180,0.7)',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.5px',
              }}>
                {avatarInitials}
              </div>
            ) : (
              // Emoji icon — all other tabs
              <span style={{
                fontSize: '20px', lineHeight: 1,
                filter: isActive ? 'none' : 'grayscale(0.2) opacity(0.45)',
                transform: isActive ? 'scale(1.15)' : 'scale(1)',
                transition: 'all 0.2s ease',
              }}>
                {tab.icon}
              </span>
            )}

            {/* Label */}
            <span style={{
              fontSize: '10px',
              fontWeight: isActive ? 700 : 400,
              color: isActive ? '#F5C518' : '#8B9BB4',
              letterSpacing: '0.3px', lineHeight: 1,
              transition: 'all 0.2s ease',
              fontFamily: 'var(--font-body)',
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
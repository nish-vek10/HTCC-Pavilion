// pavilion-web/src/components/layout/ProtectedRoute.jsx

import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'
import { ROUTES } from '../../lib/constants.js'

// ─────────────────────────────────────────────────
// Loading spinner shown while session initialises
// ─────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '20px',
    }}>
      <img
        src="/assets/images/htcc-logo.png"
        alt="HTCC"
        style={{ width: '64px', height: '64px', objectFit: 'contain', opacity: 0.8 }}
        className="animate-float"
      />
      <div style={{
        width: '32px', height: '32px',
        border: '3px solid var(--navy-light)',
        borderTop: '3px solid var(--gold)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────
// MemberRoute — requires approved member or higher
// Redirects pending users to /pending
// Redirects unauthenticated to /login
// ─────────────────────────────────────────────────
export function MemberRoute({ children }) {
  const { user, profile, loading } = useAuthStore()

  if (loading) return <LoadingScreen />
  if (!user)   return <Navigate to={ROUTES.LOGIN} replace />
  if (profile?.role === 'pending') return <Navigate to={ROUTES.PENDING} replace />

  return children
}

// ─────────────────────────────────────────────────
// CaptainRoute — requires captain, admin, or superadmin
// ─────────────────────────────────────────────────
export function CaptainRoute({ children }) {
  const { user, profile, loading } = useAuthStore()

  if (loading) return <LoadingScreen />
  if (!user)   return <Navigate to={ROUTES.LOGIN} replace />
  if (profile?.role === 'pending') return <Navigate to={ROUTES.PENDING} replace />
  if (!['captain','admin','superadmin'].includes(profile?.role)) {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  return children
}

// ─────────────────────────────────────────────────
// AdminRoute — requires admin or superadmin only
// ─────────────────────────────────────────────────
export function AdminRoute({ children }) {
  const { user, profile, loading } = useAuthStore()

  if (loading) return <LoadingScreen />
  if (!user)   return <Navigate to={ROUTES.LOGIN} replace />
  if (profile?.role === 'pending') return <Navigate to={ROUTES.PENDING} replace />
  if (!['admin','superadmin'].includes(profile?.role)) {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  return children
}

// ─────────────────────────────────────────────────
// PublicOnlyRoute — redirects logged-in users away
// from login/signup pages
// ─────────────────────────────────────────────────
export function PublicOnlyRoute({ children }) {
  const { user, profile, loading } = useAuthStore()

  if (loading) return <LoadingScreen />

  if (user) {
    if (profile?.role === 'pending') return <Navigate to={ROUTES.PENDING} replace />
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  return children
}
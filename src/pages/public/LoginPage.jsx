// pavilion-web/src/pages/public/LoginPage.jsx

import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore.js'
import { APP_NAME, CLUB_SHORT, PAGE_TITLES, ROUTES } from '../../lib/constants.js'

export default function LoginPage() {
  const navigate  = useNavigate()
  const signIn    = useAuthStore(state => state.signIn)
  const profile   = useAuthStore(state => state.profile)

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showPw,   setShowPw]   = useState(false)

  // ── Set browser tab title ──
  useEffect(() => {
    document.title = PAGE_TITLES.LOGIN
  }, [])

  // ── Handle sign in ──────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { profile } = await signIn({ email, password })

      if (profile?.role === 'pending') {
        toast('Your account is awaiting admin approval.', { icon: '⏳' })
        navigate(ROUTES.PENDING)
      } else {
        toast.success(`Welcome back!`)
        navigate(ROUTES.DASHBOARD)
      }
    } catch (err) {
      // Friendly error messages
      if (err.message.includes('Invalid login')) {
        setError('Incorrect email or password. Please try again.')
      } else if (err.message.includes('Email not confirmed')) {
        setError('Please verify your email address before signing in.')
      } else {
        setError(err.message || 'Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(245,197,24,0.05) 0%, transparent 70%)',
      }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 2 }} className="animate-fade-in">

        {/* Logo + heading */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <img
            src="/assets/images/htcc-logo.png"
            alt="HTCC"
            style={{ width: '72px', height: '72px', objectFit: 'contain', marginBottom: '16px' }}
          />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '2px' }}>
            {APP_NAME}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Sign in to your {CLUB_SHORT} account
          </div>
        </div>

        {/* Form card */}
        <div className="card" style={{ padding: '32px' }}>

          {error && (
            <div style={{
              background: 'var(--red-fill)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-md)', padding: '12px 16px',
              fontSize: '13px', color: 'var(--red)', marginBottom: '20px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '18px' }}>
              <label className="input-label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="input-label" style={{ marginBottom: 0 }}>Password</label>
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                className="input"
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn--primary"
              style={{ width: '100%', padding: '14px', fontSize: '15px' }}
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>

          <div style={{
            marginTop: '24px', paddingTop: '24px',
            borderTop: '1px solid var(--navy-border)',
            textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)',
          }}>
            Not a member yet?{' '}
            <Link to={ROUTES.SIGNUP} style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>
              Join HTCC
            </Link>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link to={ROUTES.LANDING} style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none' }}>
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
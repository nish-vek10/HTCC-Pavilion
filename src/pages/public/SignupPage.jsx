// pavilion-web/src/pages/public/SignupPage.jsx

import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore.js'
import { APP_NAME, CLUB_NAME, CLUB_SHORT, PAGE_TITLES, ROUTES } from '../../lib/constants.js'

export default function SignupPage() {
  const navigate = useNavigate()
  const signUp   = useAuthStore(state => state.signUp)

  const [form, setForm] = useState({
    fullName:  '',
    email:     '',
    phone:     '',
    password:  '',
    confirmPw: '',
  })
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showPw,   setShowPw]   = useState(false)

  // ── Set browser tab title ──
  useEffect(() => {
    document.title = PAGE_TITLES.SIGNUP
  }, [])

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // ── Password strength indicator ────────────────
  const pwStrength = () => {
    const p = form.password
    if (!p) return null
    if (p.length < 6)  return { label: 'Too short',  color: '#EF4444', width: '25%' }
    if (p.length < 8)  return { label: 'Weak',       color: '#F97316', width: '50%' }
    if (p.length < 12) return { label: 'Good',       color: '#F5C518', width: '75%' }
    return               { label: 'Strong',           color: '#22C55E', width: '100%' }
  }
  const strength = pwStrength()

  // ── Handle sign up ──────────────────────────────
  const handleSignup = async (e) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPw) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      await signUp({
        email:    form.email,
        password: form.password,
        fullName: form.fullName,
        phone:    form.phone,
      })
      toast.success('Account created! Awaiting admin approval.')
      navigate(ROUTES.PENDING)
    } catch (err) {
      if (err.message.includes('already registered')) {
        setError('An account with this email already exists. Try signing in.')
      } else {
        setError(err.message || 'Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page-wrapper" style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(245,197,24,0.04) 0%, transparent 70%)',
      }} />

      <div style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 2 }} className="animate-fade-in">

        {/* ── Logo + heading ── */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          {/* Gold-ringed HTCC crest */}
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: '#0D1B2A',
            border: '2px solid #F5C518',
            boxShadow: '0 0 0 5px rgba(245,197,24,0.12), 0 4px 24px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <img
              src="/assets/images/htcc-logo.png"
              alt="HTCC"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', mixBlendMode: 'screen' }}
            />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '2px' }}>
            Join {APP_NAME}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.6 }}>
            Register for {CLUB_NAME}.<br />
            An admin will approve your account shortly.
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

          <form onSubmit={handleSignup}>
            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Full Name</label>
              <input className="input" name="fullName" type="text"
                placeholder="John Smith"
                value={form.fullName} onChange={handleChange}
                required disabled={loading} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Email</label>
              <input className="input" name="email" type="email"
                placeholder="you@example.com"
                value={form.email} onChange={handleChange}
                required disabled={loading} autoComplete="email" />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">
                Phone{' '}
                <span style={{ color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  (optional)
                </span>
              </label>
              <input className="input" name="phone" type="tel"
                placeholder="+44 7700 000000"
                value={form.phone} onChange={handleChange}
                disabled={loading} />
            </div>

            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="input-label" style={{ marginBottom: 0 }}>Password</label>
                <button type="button" onClick={() => setShowPw(p => !p)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
              <input className="input" name="password" type={showPw ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={form.password} onChange={handleChange}
                required disabled={loading} autoComplete="new-password" />
            </div>

            {/* Password strength bar */}
            {strength && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ height: '4px', background: 'var(--navy-light)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: strength.width, background: strength.color, transition: 'all 0.3s', borderRadius: '2px' }} />
                </div>
                <div style={{ fontSize: '11px', color: strength.color, marginTop: '4px', textAlign: 'right' }}>
                  {strength.label}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '28px' }}>
              <label className="input-label">Confirm Password</label>
              <input className="input" name="confirmPw" type={showPw ? 'text' : 'password'}
                placeholder="Repeat password"
                value={form.confirmPw} onChange={handleChange}
                required disabled={loading} autoComplete="new-password" />
              {form.confirmPw && form.password !== form.confirmPw && (
                <div style={{ fontSize: '12px', color: 'var(--red)', marginTop: '4px' }}>
                  Passwords don't match
                </div>
              )}
            </div>

            <button type="submit" className="btn btn--primary"
              style={{ width: '100%', padding: '14px', fontSize: '15px' }}
              disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account →'}
            </button>
          </form>

          <div style={{
            marginTop: '24px', paddingTop: '24px',
            borderTop: '1px solid var(--navy-border)',
            textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)',
          }}>
            Already a member?{' '}
            <Link to={ROUTES.LOGIN} style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>
              Sign in
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
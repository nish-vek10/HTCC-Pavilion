// pavilion-web/src/pages/public/SignupPage.jsx

import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore.js'
import { APP_NAME, CLUB_NAME, PAGE_TITLES, ROUTES } from '../../lib/constants.js'

// ─── CONFIGURABLE: Phone country codes ────────────────────────────────────────
const PHONE_CODES = [
  { code: '+44',  flag: '🇬🇧', label: 'UK' },
  { code: '+1',   flag: '🇺🇸', label: 'US' },
  { code: '+1',   flag: '🇨🇦', label: 'CA' },
  { code: '+91',  flag: '🇮🇳', label: 'IN' },
  { code: '+92',  flag: '🇵🇰', label: 'PK' },
  { code: '+880', flag: '🇧🇩', label: 'BD' },
  { code: '+94',  flag: '🇱🇰', label: 'LK' },
  { code: '+971', flag: '🇦🇪', label: 'AE' },
  { code: '+966', flag: '🇸🇦', label: 'SA' },
  { code: '+27',  flag: '🇿🇦', label: 'ZA' },
  { code: '+254', flag: '🇰🇪', label: 'KE' },
  { code: '+234', flag: '🇳🇬', label: 'NG' },
  { code: '+61',  flag: '🇦🇺', label: 'AU' },
  { code: '+64',  flag: '🇳🇿', label: 'NZ' },
  { code: '+33',  flag: '🇫🇷', label: 'FR' },
  { code: '+49',  flag: '🇩🇪', label: 'DE' },
  { code: '+34',  flag: '🇪🇸', label: 'ES' },
  { code: '+39',  flag: '🇮🇹', label: 'IT' },
  { code: '+31',  flag: '🇳🇱', label: 'NL' },
  { code: '+351', flag: '🇵🇹', label: 'PT' },
  { code: '+353', flag: '🇮🇪', label: 'IE' },
  { code: '+355', flag: '🇦🇱', label: 'AL' },
  { code: '+212', flag: '🇲🇦', label: 'MA' },
  { code: '+20',  flag: '🇪🇬', label: 'EG' },
  { code: '+60',  flag: '🇲🇾', label: 'MY' },
  { code: '+65',  flag: '🇸🇬', label: 'SG' },
  { code: '+86',  flag: '🇨🇳', label: 'CN' },
  { code: '+81',  flag: '🇯🇵', label: 'JP' },
  { code: '+82',  flag: '🇰🇷', label: 'KR' },
  { code: '+55',  flag: '🇧🇷', label: 'BR' },
  { code: '+52',  flag: '🇲🇽', label: 'MX' },
]

export default function SignupPage() {
  const navigate = useNavigate()
  const signUp   = useAuthStore(state => state.signUp)

  const [form, setForm] = useState({
    fullName:    '',
    email:       '',
    phoneCode:   '+44',
    phoneNumber: '',
    password:    '',
    confirmPw:   '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [showPw,  setShowPw]  = useState(false)

  useEffect(() => { document.title = PAGE_TITLES.SIGNUP }, [])

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // ── Password requirements ──────────────────────────────────────────────────
  const pwChecks = {
    hasUpper: /[A-Z]/.test(form.password),
    hasLower: /[a-z]/.test(form.password),
    hasDigit: /[0-9]/.test(form.password),
    hasLength: form.password.length >= 8,
  }
  const allChecksPassed = Object.values(pwChecks).every(Boolean)

  // ── Password strength bar ──────────────────────────────────────────────────
  const pwStrength = () => {
    const p = form.password
    if (!p) return null
    const score = [pwChecks.hasUpper, pwChecks.hasLower, pwChecks.hasDigit, pwChecks.hasLength].filter(Boolean).length
    if (score <= 1) return { label: 'Too weak',  color: '#EF4444', width: '25%' }
    if (score === 2) return { label: 'Weak',      color: '#F97316', width: '50%' }
    if (score === 3) return { label: 'Good',      color: '#F5C518', width: '75%' }
    return              { label: 'Strong',        color: '#22C55E', width: '100%' }
  }
  const strength = pwStrength()

  // ── Handle sign up ─────────────────────────────────────────────────────────
  const handleSignup = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.phoneNumber.trim()) {
      setError('Phone number is required.')
      return
    }
    if (form.password !== form.confirmPw) {
      setError('Passwords do not match.')
      return
    }
    if (!allChecksPassed) {
      setError('Password must meet all requirements below.')
      return
    }

    // Combine code + number for storage e.g. "+447307608332"
    const fullPhone = form.phoneCode + form.phoneNumber.replace(/^0/, '')

    setLoading(true)
    try {
      await signUp({
        email:     form.email,
        password:  form.password,
        fullName:  form.fullName,
        phone:     fullPhone,
        phoneCode: form.phoneCode,
      })
      toast.success('Account created! Please check your email.')
      navigate(ROUTES.CHECK_EMAIL)
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
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: '#0D1B2A',
            border: '2px solid #F5C518',
            boxShadow: '0 0 0 5px rgba(245,197,24,0.12), 0 4px 24px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <img src="/assets/images/htcc-logo.png" alt="HTCC"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', mixBlendMode: 'screen' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '2px' }}>
            Join {APP_NAME}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.6 }}>
            Register for {CLUB_NAME}.<br />
            An admin will approve your account shortly.
          </div>
        </div>

        {/* ── Form card ── */}
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

            {/* Full Name */}
            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Full Name</label>
              <input className="input" name="fullName" type="text"
                placeholder="John Smith"
                value={form.fullName} onChange={handleChange}
                required disabled={loading} />
            </div>

            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Email</label>
              <input className="input" name="email" type="email"
                placeholder="you@example.com"
                value={form.email} onChange={handleChange}
                required disabled={loading} autoComplete="email" />
            </div>

            {/* Phone — split code + number */}
            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Phone Number</label>
              <div style={{ display: 'flex', gap: '8px' }}>

                {/* Country code dropdown */}
                <select
                  name="phoneCode"
                  value={form.phoneCode}
                  onChange={handleChange}
                  disabled={loading}
                  style={{
                    flexShrink: 0, width: '110px',
                    padding: '12px 8px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--navy-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    outline: 'none',
                    colorScheme: 'dark',
                  }}
                >
                  {PHONE_CODES.map((c, i) => (
                    <option key={i} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>

                {/* Number input */}
                <input
                  className="input"
                  name="phoneNumber"
                  type="tel"
                  placeholder="07123 456 789"
                  value={form.phoneNumber}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  style={{ flex: 1, margin: 0 }}
                />
              </div>
            </div>

            {/* Password */}
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
              <div style={{ marginBottom: '8px' }}>
                <div style={{ height: '4px', background: 'var(--navy-light)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: strength.width, background: strength.color, transition: 'all 0.3s', borderRadius: '2px' }} />
                </div>
                <div style={{ fontSize: '11px', color: strength.color, marginTop: '4px', textAlign: 'right' }}>
                  {strength.label}
                </div>
              </div>
            )}

            {/* Password requirements checklist */}
            {form.password.length > 0 && (
              <div style={{
                marginBottom: '16px', padding: '12px 14px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--navy-border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex', flexDirection: 'column', gap: '6px',
              }}>
                {[
                  { key: 'hasUpper',  label: 'At least one uppercase letter' },
                  { key: 'hasLower',  label: 'At least one lowercase letter' },
                  { key: 'hasDigit',  label: 'At least one number' },
                  { key: 'hasLength', label: 'Minimum 8 characters' },
                ].map(req => (
                  <div key={req.key} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '12px',
                    color: pwChecks[req.key] ? '#22C55E' : 'var(--text-faint)',
                    transition: 'color 0.2s',
                  }}>
                    <span style={{ fontSize: '10px' }}>
                      {pwChecks[req.key] ? '✓' : '○'}
                    </span>
                    {req.label}
                  </div>
                ))}
              </div>
            )}

            {/* Confirm Password */}
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
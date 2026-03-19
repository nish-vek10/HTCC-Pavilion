// pavilion-web/src/pages/public/SignupPage.jsx

import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore.js'
import { APP_NAME, CLUB_NAME, PAGE_TITLES, ROUTES } from '../../lib/constants.js'

// ─── CONFIGURABLE: Phone country codes — iso used for flagcdn.com images ──────
const PHONE_CODES = [
  { code: '+44',  iso: 'gb', label: 'United Kingdom' },
  { code: '+1',   iso: 'us', label: 'United States' },
  { code: '+1',   iso: 'ca', label: 'Canada' },
  { code: '+91',  iso: 'in', label: 'India' },
  { code: '+92',  iso: 'pk', label: 'Pakistan' },
  { code: '+880', iso: 'bd', label: 'Bangladesh' },
  { code: '+94',  iso: 'lk', label: 'Sri Lanka' },
  { code: '+971', iso: 'ae', label: 'UAE' },
  { code: '+966', iso: 'sa', label: 'Saudi Arabia' },
  { code: '+27',  iso: 'za', label: 'South Africa' },
  { code: '+254', iso: 'ke', label: 'Kenya' },
  { code: '+234', iso: 'ng', label: 'Nigeria' },
  { code: '+61',  iso: 'au', label: 'Australia' },
  { code: '+64',  iso: 'nz', label: 'New Zealand' },
  { code: '+33',  iso: 'fr', label: 'France' },
  { code: '+49',  iso: 'de', label: 'Germany' },
  { code: '+34',  iso: 'es', label: 'Spain' },
  { code: '+39',  iso: 'it', label: 'Italy' },
  { code: '+31',  iso: 'nl', label: 'Netherlands' },
  { code: '+351', iso: 'pt', label: 'Portugal' },
  { code: '+353', iso: 'ie', label: 'Ireland' },
  { code: '+212', iso: 'ma', label: 'Morocco' },
  { code: '+20',  iso: 'eg', label: 'Egypt' },
  { code: '+60',  iso: 'my', label: 'Malaysia' },
  { code: '+65',  iso: 'sg', label: 'Singapore' },
  { code: '+86',  iso: 'cn', label: 'China' },
  { code: '+81',  iso: 'jp', label: 'Japan' },
  { code: '+82',  iso: 'kr', label: 'South Korea' },
  { code: '+55',  iso: 'br', label: 'Brazil' },
  { code: '+52',  iso: 'mx', label: 'Mexico' },
]

// ── Flag image helper — uses flagcdn.com ──────────────────────────────────────
function FlagImg({ iso, size = 20 }) {
  return (
    <img
      src={`https://flagcdn.com/w${size}/${iso}.png`}
      srcSet={`https://flagcdn.com/w${size * 2}/${iso}.png 2x`}
      width={size}
      height={Math.round(size * 0.75)}
      alt={iso.toUpperCase()}
      style={{ borderRadius: '2px', objectFit: 'cover', flexShrink: 0 }}
    />
  )
}

// ── Custom phone code dropdown with search ────────────────────────────────────
function PhoneCodeDropdown({ value, onChange, disabled }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const ref = React.useRef(null)

  const selected = PHONE_CODES.find(c => c.code === value && c.iso === 'gb')
    || PHONE_CODES.find(c => c.code === value)
    || PHONE_CODES[0]

  const filtered = PHONE_CODES.filter(c =>
    c.label.toLowerCase().includes(search.toLowerCase()) ||
    c.code.includes(search)
  )

  // Close on outside click
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0, width: '120px' }}>

      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(v => !v); setSearch('') }}
        style={{
          width: '100%', height: '46px',
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '0 10px',
          background: 'var(--bg-input)',
          border: `1px solid ${open ? 'rgba(245,197,24,0.5)' : 'var(--navy-border)'}`,
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          fontSize: '14px',
        }}
      >
        <FlagImg iso={selected.iso} size={20} />
        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{selected.code}</span>
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>▼</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0,
          width: '240px', zIndex: 9999,
          background: '#1A2F4A',
          border: '1px solid rgba(245,197,24,0.2)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}>
          {/* Search */}
          <div style={{ padding: '8px' }}>
            <input
              autoFocus
              type="text"
              placeholder="🔍  Search country or code…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--navy-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
                fontSize: '12px', outline: 'none',
              }}
            />
          </div>

          {/* Options list — 5 visible, scrollable */}
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                No results
              </div>
            ) : filtered.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { onChange(c.code); setOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px',
                  background: c.code === value ? 'rgba(245,197,24,0.08)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = c.code === value ? 'rgba(245,197,24,0.08)' : 'transparent'}
              >
                <FlagImg iso={c.iso} size={18} />
                <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{c.label}</span>
                <span style={{ fontSize: '12px', color: 'var(--gold)', fontWeight: 700 }}>{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

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

                <PhoneCodeDropdown
                  value={form.phoneCode}
                  onChange={(code) => setForm(prev => ({ ...prev, phoneCode: code }))}
                  disabled={loading}
                />

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
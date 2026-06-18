// pavilion-web/src/pages/public/ResetPasswordPage.jsx
// Web-based password reset — opened from Supabase reset email link
// detectSessionInUrl: true auto-exchanges token → fires PASSWORD_RECOVERY event

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { APP_NAME, CLUB_NAME, PAGE_TITLES, ROUTES } from '../../lib/constants.js'

// ── Stage machine: loading → form → success → error ──────────────────────────
const STAGE = {
  LOADING: 'loading',
  FORM:    'form',
  SUCCESS: 'success',
  EXPIRED: 'expired',
}

export default function ResetPasswordPage() {
  const [stage,    setStage]    = useState(STAGE.LOADING)
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [showCf,   setShowCf]   = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    document.title = PAGE_TITLES.RESET_PASSWORD
  }, [])

  // ── Wait for Supabase to fire PASSWORD_RECOVERY ────────────────────────────
  // detectSessionInUrl: true processes the URL hash automatically.
  // We listen for PASSWORD_RECOVERY to know the token is valid.
  // Also check getSession() in case the event already fired before mount.
  useEffect(() => {
    let resolved = false

    // Check if Supabase already processed the hash before we mounted
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (resolved) return
      if (session?.user) {
        resolved = true
        setStage(STAGE.FORM)
      }
    })

    // Listen for the PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        resolved = true
        setStage(STAGE.FORM)
      }
      // If SIGNED_OUT fires while loading, link is invalid/expired
      if (event === 'SIGNED_OUT' && !resolved) {
        setStage(STAGE.EXPIRED)
      }
    })

    // Timeout — if neither event fires within 8s, assume link expired
    const timeout = setTimeout(() => {
      if (!resolved) setStage(STAGE.EXPIRED)
    }, 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleReset(e) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSaving(true)
    try {
      const { error: supaErr } = await supabase.auth.updateUser({ password })
      if (supaErr) throw supaErr

      // Sign out web session — user will log back in via the app
      await supabase.auth.signOut()
      setStage(STAGE.SUCCESS)
    } catch (err) {
      setError(err.message || 'Failed to update password. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Shared layout wrapper ──────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      position: 'relative', overflow: 'hidden',
    }}>

      {/* Gold radial glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(245,197,24,0.05) 0%, transparent 70%)',
      }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 2 }}
           className="animate-fade-in">

        {/* ── HTCC Crest ── */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
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
            {stage === STAGE.SUCCESS ? 'ALL DONE' : 'NEW PASSWORD'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {stage === STAGE.SUCCESS
              ? 'Your password has been updated'
              : stage === STAGE.EXPIRED
              ? 'This reset link has expired'
              : 'Choose a strong new password'}
          </div>
        </div>

        {/* ── LOADING ── */}
        {stage === STAGE.LOADING && (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              border: '3px solid rgba(245,197,24,0.2)',
              borderTopColor: '#F5C518',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 20px',
            }} />
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Verifying your reset link…
            </div>
          </div>
        )}

        {/* ── EXPIRED / INVALID ── */}
        {stage === STAGE.EXPIRED && (
          <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏱️</div>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              Link Expired or Already Used
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '28px' }}>
              Reset links are single-use and expire after 1 hour. Request a fresh link from the app.
            </div>
            <div style={{
              padding: '14px 16px',
              background: 'rgba(96,165,250,0.04)',
              border: '1px solid rgba(96,165,250,0.2)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px', color: '#93C5FD',
              lineHeight: 1.6, marginBottom: '24px', textAlign: 'left',
            }}>
              💡 Open the Pavilion app → <strong>Sign In</strong> → <strong>Forgot Password</strong> to get a new link.
            </div>
            <Link to={ROUTES.LOGIN} style={{
              display: 'block', textAlign: 'center',
              fontSize: '14px', color: 'var(--gold)',
              fontWeight: 600, textDecoration: 'none',
            }}>
              ← Back to Sign In
            </Link>
          </div>
        )}

        {/* ── FORM ── */}
        {stage === STAGE.FORM && (
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

            <form onSubmit={handleReset}>

              {/* New password */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="input-label" style={{ marginBottom: 0 }}>New Password</label>
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
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={saving}
                  autoComplete="new-password"
                />
              </div>

              {/* Confirm password */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="input-label" style={{ marginBottom: 0 }}>Confirm Password</label>
                  <button
                    type="button"
                    onClick={() => setShowCf(p => !p)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}
                  >
                    {showCf ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  className="input"
                  type={showCf ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  disabled={saving}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className="btn btn--primary"
                style={{ width: '100%', padding: '14px', fontSize: '15px' }}
                disabled={saving}
              >
                {saving ? 'Updating…' : 'Set New Password →'}
              </button>
            </form>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {stage === STAGE.SUCCESS && (
          <div className="card" style={{ padding: '32px', textAlign: 'center' }}>

            {/* Green tick */}
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(34,197,94,0.1)',
              border: '2px solid rgba(34,197,94,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '28px',
            }}>
              ✓
            </div>

            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#4ADE80' }}>
              Password Updated!
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '28px' }}>
              Your new password is set. Open the Pavilion app and sign in with your email and new password.
            </div>

            {/* Deep link button — opens app on mobile */}
            <a
              href="pavilion://login"
              style={{
                display: 'block',
                background: '#F5C518',
                color: '#0D1B2A',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700, fontSize: '15px',
                textDecoration: 'none',
                marginBottom: '16px',
              }}
            >
              Open Pavilion App →
            </a>

            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              On desktop?{' '}
              <Link to={ROUTES.LOGIN} style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>
                Sign in here
              </Link>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link to={ROUTES.LANDING} style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none' }}>
            ← Back to home
          </Link>
        </div>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

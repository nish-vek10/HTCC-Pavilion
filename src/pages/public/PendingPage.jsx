// pavilion-web/src/pages/public/PendingPage.jsx

import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { APP_NAME, CLUB_NAME, PAGE_TITLES } from '../../lib/constants.js'

export default function PendingPage() {

  // ── Set browser tab title ──
  useEffect(() => {
    document.title = PAGE_TITLES.PENDING
  }, [])

  return (
    <div className="auth-page-wrapper" style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle gold glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 50% 40% at 50% 30%, rgba(245,197,24,0.06) 0%, transparent 70%)',
      }} />

      <div className="animate-fade-in pending-card" style={{
        width: '100%', maxWidth: '460px',
        background: 'var(--bg-surface)',
        border: '1px solid rgba(245,197,24,0.2)',
        borderRadius: 'var(--radius-xl)',
        padding: '48px 40px',
        textAlign: 'center',
        position: 'relative', zIndex: 2,
      }}>

        {/* ── HTCC crest with gold ring ── */}
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: '#0D1B2A',
          border: '2px solid #F5C518',
          boxShadow: '0 0 0 5px rgba(245,197,24,0.12), 0 4px 24px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 28px',
        }} className="animate-float">
          <img
            src="/assets/images/htcc-logo.png"
            alt="HTCC"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', mixBlendMode: 'screen' }}
          />
        </div>

        <div style={{ fontFamily: 'var(--font-display)', fontSize: '30px', letterSpacing: '2px', marginBottom: '12px' }}>
          AWAITING APPROVAL
        </div>
        <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.75, marginBottom: '36px' }}>
          Your registration for <strong style={{ color: 'var(--text-primary)' }}>{CLUB_NAME}</strong> has been received.
          An admin will review and approve your account shortly.
        </p>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
          {[
            { icon: '✅', title: 'Account Created',   desc: 'Your details have been submitted.',           done: true },
            { icon: '⏳', title: 'Admin Review',       desc: 'Awaiting approval from HTCC committee.',      done: false },
            { icon: '🔔', title: 'You\'ll be notified', desc: 'Push notification sent once approved.',       done: false },
            { icon: '🏏', title: 'Full Access',        desc: 'Set availability and view your squad.',       done: false },
          ].map(step => (
            <div key={step.title} style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '14px 16px',
              background: step.done ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.02)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${step.done ? 'rgba(34,197,94,0.2)' : 'var(--navy-border)'}`,
              opacity: step.done ? 1 : 0.6,
            }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>{step.icon}</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{step.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: '32px', paddingTop: '28px',
          borderTop: '1px solid var(--navy-border)',
          fontSize: '13px', color: 'var(--text-muted)',
        }}>
          Questions? Contact your HTCC admin directly.
          <br />
          <Link to="/login" style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none', marginTop: '8px', display: 'inline-block' }}>
            ← Back to Sign In
          </Link>
        </div>
      </div>

      <div style={{ marginTop: '24px', fontSize: '13px', color: 'var(--text-faint)' }}>
        {APP_NAME} · {CLUB_NAME}
      </div>
    </div>
  )
}
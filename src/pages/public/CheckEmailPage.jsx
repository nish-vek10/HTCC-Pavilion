// pavilion-web/src/pages/public/CheckEmailPage.jsx
// Shown immediately after signup — instructs user to confirm their email
// Same design language as PendingPage and SignupPage

import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { APP_NAME, CLUB_NAME, PAGE_TITLES, ROUTES } from '../../lib/constants.js'

export default function CheckEmailPage() {
  const location = useLocation()

  useEffect(() => {
    document.title = PAGE_TITLES.CHECK_EMAIL
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

      {/* Subtle gold glow — matches PendingPage */}
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

        {/* ── HTCC crest with gold ring — matches PendingPage ── */}
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
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center 20%',
              mixBlendMode: 'screen',
            }}
          />
        </div>

        {/* Title */}
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '28px', letterSpacing: '2px',
          marginBottom: '12px',
        }}>
          CHECK YOUR EMAIL
        </div>

        {/* Subtitle */}
        <p style={{
          fontSize: '15px', color: 'var(--text-muted)',
          lineHeight: 1.75, marginBottom: '32px',
        }}>
          We've sent a confirmation link to your email address.
          Click it to activate your account and proceed to{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{CLUB_NAME}</strong>.
        </p>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', marginBottom: '28px' }}>
          {[
            {
              icon: '✅',
              title: 'Account Registered',
              desc: 'Your details have been submitted successfully.',
              done: true,
            },
            {
              icon: '📧',
              title: 'Confirm Your Email',
              desc: 'Click the link in the email we just sent you.',
              done: false,
              highlight: true,
            },
            {
              icon: '⏳',
              title: 'Admin Approval',
              desc: 'An admin will review and approve your membership.',
              done: false,
            },
            {
              icon: '🏏',
              title: 'Full Access',
              desc: 'Set availability, view fixtures and join your squad.',
              done: false,
            },
          ].map(step => (
            <div key={step.title} style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '13px 16px',
              background: step.done
                ? 'rgba(34,197,94,0.05)'
                : step.highlight
                  ? 'rgba(245,197,24,0.04)'
                  : 'rgba(255,255,255,0.02)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${
                step.done ? 'rgba(34,197,94,0.2)'
                : step.highlight ? 'rgba(245,197,24,0.25)'
                : 'var(--navy-border)'
              }`,
              opacity: step.done || step.highlight ? 1 : 0.55,
            }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>{step.icon}</span>
              <div>
                <div style={{
                  fontSize: '14px', fontWeight: 600,
                  color: step.highlight ? 'var(--gold)' : 'var(--text-primary)',
                }}>
                  {step.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Spam notice */}
        <div style={{
          padding: '14px 16px',
          background: 'rgba(96,165,250,0.04)',
          border: '1px solid rgba(96,165,250,0.2)',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px', color: '#93C5FD',
          lineHeight: 1.6, marginBottom: '28px',
          textAlign: 'left',
        }}>
          💡 <strong>Can't find the email?</strong> Check your <strong>spam or junk folder</strong> — it may have been filtered automatically.
        </div>

        {/* Divider + bottom message */}
        <div style={{
          paddingTop: '24px',
          borderTop: '1px solid var(--navy-border)',
          fontSize: '14px', color: 'var(--text-muted)',
          lineHeight: 1.7,
        }}>
          <p style={{ margin: '0 0 12px 0' }}>
            Already confirmed? You will be notified once an admin approves your account.
          </p>
          <Link to={ROUTES.LANDING} style={{
            color: 'var(--gold)', fontWeight: 600,
            textDecoration: 'none', fontSize: '13px',
          }}>
            ← Back to Home
          </Link>
        </div>
      </div>

      <div style={{ marginTop: '24px', fontSize: '13px', color: 'var(--text-faint)' }}>
        {APP_NAME} · {CLUB_NAME}
      </div>
    </div>
  )
}
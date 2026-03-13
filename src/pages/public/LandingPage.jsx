// pavilion-web/src/pages/public/LandingPage.jsx

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { APP_NAME, CLUB_NAME, CLUB_SHORT, CLUB_FOUNDED } from '../../lib/constants.js'

export default function LandingPage() {
  const navigate = useNavigate()

  // ── Set browser tab title ──
  useEffect(() => {
    document.title = `${APP_NAME} · ${CLUB_SHORT}`
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>

      {/* ── NAV ── */}
      <nav className="landing-nav" style={{
        position:       'sticky', top: 0, zIndex: 100,
        background:     'rgba(13,27,42,0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom:   '1px solid var(--navy-border)',
        padding:        '0 40px',
        display:        'flex', alignItems: 'center', justifyContent: 'space-between',
        height:         '64px',
      }}>

        {/* ── Left: Pavilion icon + app name ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/assets/icons/pavilion-icon.svg"
            alt="Pavilion"
            style={{ width: '36px', height: '36px', borderRadius: '10px' }}
          />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '2px', lineHeight: 1 }}>
              {APP_NAME}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--gold)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '2px' }}>
              {CLUB_SHORT}
            </div>
          </div>
        </div>

        {/* ── Right: HTCC crest + club name + action buttons ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

          {/* Club identity — matches Navbar.jsx exactly, hidden on mobile */}
          <div className="landing-nav-htcc" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

            {/* Gold-ringed HTCC crest — same as Navbar */}
            <div style={{
              width: '44px', height: '44px', borderRadius: '50%',
              background: '#0D1B2A',
              border: '2px solid #F5C518',
              boxShadow: '0 0 0 3px rgba(245,197,24,0.15), 0 2px 10px rgba(0,0,0,0.6)',
              overflow: 'hidden', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img
                src="/assets/images/htcc-logo.png"
                alt="HTCC Crest"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', mixBlendMode: 'screen' }}
              />
            </div>

            {/* Club name — same font sizes and colours as Navbar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px', letterSpacing: '0.1em',
                color: '#F5C518', lineHeight: 1,
              }}>
                HARROW TOWN
              </span>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '12px', letterSpacing: '0.15em',
                color: '#8B9BB4', lineHeight: 1,
              }}>
                CRICKET CLUB
              </span>
            </div>
          </div>

          {/* Divider — hidden on mobile with HTCC identity */}
          <div className="landing-nav-divider" style={{ width: '1px', height: '28px', background: 'var(--navy-border)' }} />

          {/* Action buttons */}
          <div className="landing-nav-buttons" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="btn btn--secondary" onClick={() => navigate('/login')}>
              Sign In
            </button>
            <button className="btn btn--primary" onClick={() => navigate('/signup')}>
              Join the Club
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="landing-hero" style={{
        minHeight: '88vh',
        display: 'flex', alignItems: 'center',
        padding: '80px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background effects */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 60% 50% at 70% 50%, rgba(245,197,24,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: 'linear-gradient(rgba(245,197,24,1) 1px, transparent 1px), linear-gradient(90deg, rgba(245,197,24,1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '640px' }} className="animate-fade-in">
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(245,197,24,0.1)',
            border: '1px solid rgba(245,197,24,0.25)',
            borderRadius: '20px', padding: '6px 14px',
            fontSize: '11px', color: 'var(--gold)',
            letterSpacing: '2px', textTransform: 'uppercase',
            fontWeight: 600, marginBottom: '28px',
          }}>
            🏏 Est. {CLUB_FOUNDED} · {CLUB_NAME}
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(52px, 7vw, 84px)',
            lineHeight: 0.95, letterSpacing: '2px',
            marginBottom: '24px',
          }}>
            YOUR SQUAD.<br />
            YOUR <span style={{ color: 'var(--gold)' }}>PAVILION.</span>
          </h1>

          <p style={{
            fontSize: '17px', color: 'var(--text-muted)',
            maxWidth: '460px', marginBottom: '40px', lineHeight: 1.75,
          }}>
            One platform for all five HTCC teams. Set your availability,
            track selections, and know your squad — before matchday.
          </p>

          <div className="landing-hero-btns" style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <button className="btn btn--primary" style={{ fontSize: '15px', padding: '14px 32px' }}
              onClick={() => navigate('/signup')}>
              Join HTCC →
            </button>
            <button className="btn btn--secondary" style={{ fontSize: '15px', padding: '14px 32px' }}
              onClick={() => navigate('/login')}>
              Member Login
            </button>
          </div>

          {/* Stats row */}
          <div className="landing-stats-row" style={{
            display: 'flex', gap: '40px',
            marginTop: '60px', paddingTop: '40px',
            borderTop: '1px solid var(--navy-border)',
          }}>
            {[
              { num: '5',  label: 'Teams' },
              { num: '55+', label: 'Members' },
              { num: '44', label: 'Sat. Slots' },
              { num: '1',  label: 'Platform' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '38px', color: 'var(--gold)', letterSpacing: '1px' }}>
                  {s.num}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="landing-features" style={{ padding: '80px', borderTop: '1px solid var(--navy-border)' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div className="section-label">Built for HTCC</div>
          <div className="section-title">Everything your club needs</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', maxWidth: '1100px', margin: '0 auto' }}>
          {[
            { icon: '✅', title: 'Set Availability',    desc: 'One tap to confirm for Saturday. Green, red, or tentative — captains see it instantly.' },
            { icon: '🏏', title: 'Squad Published',     desc: 'Selected? You get a push notification the moment your captain confirms the XI.' },
            { icon: '📋', title: 'Matchday Overview',   desc: 'All 4 Saturday XIs in one grid. 44 slots, full picture, zero WhatsApp chasing.' },
            { icon: '⏰', title: 'Auto Reminders',      desc: 'Monday 10am: anyone who hasn\'t responded gets a nudge automatically.' },
            { icon: '🔒', title: 'Secure Access',       desc: 'Admin-approved membership. Role-based access for members, captains, and admins.' },
            { icon: '📱', title: 'App + Web',           desc: 'Full platform on desktop. Push notifications on iOS and Android.' },
          ].map(f => (
            <div key={f.title} className="card card--hoverable" style={{ padding: '28px' }}>
              <div style={{ fontSize: '28px', marginBottom: '14px' }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px', color: 'var(--text-primary)' }}>{f.title}</div>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FOOTER ── */}
      <section className="landing-cta" style={{
        padding: '80px', textAlign: 'center',
        borderTop: '1px solid var(--navy-border)',
        background: 'var(--bg-surface)',
      }}>
        <div className="landing-cta-title" style={{ fontFamily: 'var(--font-display)', fontSize: '48px', letterSpacing: '2px', marginBottom: '16px' }}>
          READY TO <span style={{ color: 'var(--gold)' }}>PLAY?</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '16px', marginBottom: '32px' }}>
          Register your account — an HTCC admin will approve you shortly.
        </p>
        <button className="btn btn--primary" style={{ fontSize: '16px', padding: '16px 40px' }}
          onClick={() => navigate('/signup')}>
          Create Account
        </button>
      </section>

      {/* ── FOOTER ── */}
      <footer className="landing-footer" style={{
        padding: '32px 80px',
        borderTop: '1px solid var(--navy-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '12px',
      }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} {CLUB_NAME}. All rights reserved.
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Powered by <span style={{ color: 'var(--gold)' }}>{APP_NAME}</span>
        </div>
      </footer>

    </div>
  )
}
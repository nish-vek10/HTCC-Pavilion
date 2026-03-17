// pavilion-web/src/components/ui/SplashScreen.jsx
// App entry splash — shown while auth initialises (loading === true)
// Mirrors SplashV4_Typewriter from native exactly:
// Dual-orbit HTCC crest → typewriter PAVILION → divider → HARROW TOWN → CRICKET CLUB

import { useEffect, useState } from 'react'

// ─── CONFIGURABLE ─────────────────────────────────────────────────────────────
const CREST_SIZE   = 110   // px — inner crest badge
const CHAR_MS      = 100   // ms per typewriter character
const WORDS = [
  { text: 'PAVILION',     font: 'var(--font-display)', size: '52px', color: '#FFFFFF',  spacing: '10px', delay: 600  },
  { text: 'HARROW TOWN',  font: 'var(--font-display)', size: '20px', color: '#F5C518',  spacing: '5px',  delay: 0    },
  { text: 'CRICKET CLUB', font: 'var(--font-display)', size: '13px', color: '#8B9BB4',  spacing: '5px',  delay: 0    },
]

// Typewriter hook — returns visible character count for a string
function useTypewriter(text, charMs, startDelay, enabled) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) return
    setCount(0)
    const timer = setTimeout(() => {
      let i = 0
      const iv = setInterval(() => {
        i++
        setCount(i)
        if (i >= text.length) clearInterval(iv)
      }, charMs)
      return () => clearInterval(iv)
    }, startDelay)
    return () => clearTimeout(timer)
  }, [enabled])
  return count
}

export default function SplashScreen() {
  // ── Phase tracking ─────────────────────────────────────────────────────────
  const [phase, setPhase] = useState(0)
  // 0 = crest only
  // 1 = typewriter PAVILION
  // 2 = divider visible
  // 3 = typewriter HARROW TOWN
  // 4 = typewriter CRICKET CLUB
  // 5 = pulse dots

  const [showCursor, setShowCursor] = useState(true)

  // ── Phase timeline ─────────────────────────────────────────────────────────
  useEffect(() => {
    const pavDuration = 600 + WORDS[0].text.length * CHAR_MS  // delay + type time
    const htDuration  = pavDuration + 400 + WORDS[1].text.length * CHAR_MS
    const ccDuration  = htDuration + 200 + WORDS[2].text.length * CHAR_MS

    const t1 = setTimeout(() => setPhase(1), 400)               // start PAVILION
    const t2 = setTimeout(() => setPhase(2), pavDuration + 200) // show divider
    const t3 = setTimeout(() => setPhase(3), pavDuration + 500) // start HARROW TOWN
    const t4 = setTimeout(() => setPhase(4), htDuration + 200)  // start CRICKET CLUB
    const t5 = setTimeout(() => setPhase(5), ccDuration + 1400) // pulse dots — +1s extra

    // Cursor blinks then disappears after PAVILION finishes
    const tCursor = setTimeout(() => {
      let blinks = 0
      const blink = setInterval(() => {
        setShowCursor(c => !c)
        blinks++
        if (blinks >= 6) { clearInterval(blink); setShowCursor(false) }
      }, 300)
    }, pavDuration + 100)

    return () => [t1, t2, t3, t4, t5, tCursor].forEach(clearTimeout)
  }, [])

  // ── Typewriter counts ──────────────────────────────────────────────────────
  const pavCount = useTypewriter(WORDS[0].text, CHAR_MS, 0,   phase >= 1)
  const htCount  = useTypewriter(WORDS[1].text, CHAR_MS, 0,   phase >= 3)
  const ccCount  = useTypewriter(WORDS[2].text, CHAR_MS, 0,   phase >= 4)

  const outerSize = CREST_SIZE + 32  // spinning ring container

  return (
    <div style={{
      position:        'fixed',
      inset:           0,
      background:      '#0D1B2A',
      display:         'flex',
      flexDirection:   'column',
      alignItems:      'center',
      justifyContent:  'center',
      gap:             '20px',
      zIndex:          9999,
    }}>

      <style>{`
        @keyframes splash-spin-cw {
          to { transform: rotate(360deg); }
        }
        @keyframes splash-spin-ccw {
          to { transform: rotate(-360deg); }
        }
        @keyframes splash-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splash-divider {
          from { width: 0; opacity: 0; }
          to   { width: 72px; opacity: 0.6; }
        }
        @keyframes splash-dot-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }
      `}</style>

      {/* ── Dual-orbit HTCC crest ── */}
      <div style={{
        position:        'relative',
        width:           outerSize,
        height:          outerSize,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        marginBottom:    '8px',
      }}>

        {/* Outer ring — clockwise, full arc */}
        <div style={{
          position:         'absolute',
          inset:            0,
          borderRadius:     '50%',
          border:           '3px solid rgba(245,197,24,0.1)',
          borderTopColor:   '#F5C518',
          borderRightColor: 'rgba(245,197,24,0.5)',
          animation:        'splash-spin-cw 1.1s linear infinite',
        }} />

        {/* Inner ring — counter-clockwise, partial arc */}
        <div style={{
          position:           'absolute',
          inset:              '8px',
          borderRadius:       '50%',
          border:             '2px solid rgba(245,197,24,0.06)',
          borderBottomColor:  'rgba(245,197,24,0.6)',
          borderLeftColor:    'rgba(245,197,24,0.25)',
          animation:          'splash-spin-ccw 1.7s linear infinite',
        }} />

        {/* HTCC crest badge */}
        <div style={{
          width:           CREST_SIZE,
          height:          CREST_SIZE,
          borderRadius:    '50%',
          background:      '#0D1B2A',
          border:          '2.5px solid #F5C518',
          boxShadow:       '0 0 0 3px rgba(245,197,24,0.2), 0 0 20px rgba(245,197,24,0.4)',
          overflow:        'hidden',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          flexShrink:      0,
        }}>
          <img
            src="/assets/images/htcc-logo.png"
            alt="HTCC"
            style={{
              width:          '100%',
              height:         '100%',
              objectFit:      'cover',
              objectPosition: 'center 20%',
              mixBlendMode:   'screen',
            }}
          />
        </div>
      </div>

      {/* ── PAVILION typewriter ── */}
      {phase >= 1 && (
        <div style={{
          display:         'flex',
          alignItems:      'center',
          height:          '64px',
          animation:       'splash-fade-in 0.3s ease forwards',
        }}>
          <span style={{
            fontFamily:    'var(--font-display)',
            fontSize:      '52px',
            letterSpacing: '10px',
            color:         '#FFFFFF',
            lineHeight:    1,
          }}>
            {WORDS[0].text.slice(0, pavCount)}
          </span>
          {/* Blinking cursor */}
          {showCursor && phase === 1 && (
            <div style={{
              width:        '3px',
              height:       '46px',
              background:   '#F5C518',
              borderRadius: '2px',
              marginLeft:   '4px',
              flexShrink:   0,
            }} />
          )}
        </div>
      )}

      {/* ── Gold divider ── */}
      {phase >= 2 && (
        <div style={{
          height:      '1.5px',
          background:  '#F5C518',
          animation:   'splash-divider 0.4s ease forwards',
          borderRadius:'1px',
        }} />
      )}

      {/* ── HARROW TOWN typewriter ── */}
      {phase >= 3 && (
        <div style={{
          fontFamily:    'var(--font-display)',
          fontSize:      '26px',
          letterSpacing: '5px',
          color:         '#F5C518',
          lineHeight:    1,
          minHeight:     '24px',
          animation:     'splash-fade-in 0.3s ease forwards',
        }}>
          {WORDS[1].text.slice(0, htCount)}
        </div>
      )}

      {/* ── CRICKET CLUB typewriter ── */}
      {phase >= 4 && (
        <div style={{
          fontFamily:    'var(--font-display)',
          fontSize:      '16px',
          letterSpacing: '5px',
          color:         '#8B9BB4',
          lineHeight:    1,
          minHeight:     '18px',
          marginTop:     '-8px',
          animation:     'splash-fade-in 0.3s ease forwards',
        }}>
          {WORDS[2].text.slice(0, ccCount)}
        </div>
      )}

      {/* ── Pulse dots — shown after all text done ── */}
      {phase >= 5 && (
        <div style={{
          position:       'absolute',
          bottom:         '52px',
          display:        'flex',
          gap:            '10px',
          animation:      'splash-fade-in 0.4s ease forwards',
        }}>
          {[0, 200, 400].map(delay => (
            <div
              key={delay}
              style={{
                width:         '7px',
                height:        '7px',
                borderRadius:  '50%',
                background:    '#F5C518',
                animation:     `splash-dot-pulse 1.6s ease-in-out ${delay}ms infinite`,
              }}
            />
          ))}
        </div>
      )}

    </div>
  )
}
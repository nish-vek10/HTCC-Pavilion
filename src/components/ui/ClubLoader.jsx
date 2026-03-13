// pavilion-web/src/components/ui/ClubLoader.jsx

// ── Shared animated loader used across all loading states ──
// Spinning gold arc outside, HTCC crest with solid gold ring inside.

export default function ClubLoader({ message = 'Loading…', size = 72 }) {
  // ── CONFIGURABLE: ring stroke scales proportionally with size ──
  const strokeWidth = Math.max(3, Math.round(size * 0.05))
  const outerSize   = size + strokeWidth * 4   // total container diameter
  const crestSize   = size - strokeWidth * 2   // inner crest badge diameter

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            '24px',
    }}>

      {/* ── Outer container: spinning arc wraps the crest ── */}
      <div style={{
        position: 'relative',
        width:    outerSize,
        height:   outerSize,
        display:  'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}>

        <style>{`
          @keyframes pavilion-spin {
            to { transform: rotate(360deg); }
          }
          @keyframes pavilion-pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.35; }
          }
        `}</style>

        {/* ── Layer 1: spinning gold arc — outermost ── */}
        <div style={{
          position:     'absolute',
          inset:        0,
          borderRadius: '50%',
          border:       `${strokeWidth}px solid rgba(245,197,24,0.12)`,
          borderTopColor:   '#F5C518',
          borderRightColor: 'rgba(245,197,24,0.45)',
          animation:    'pavilion-spin 1.1s linear infinite',
          zIndex:       2,
        }} />

        {/* ── Layer 2: HTCC crest with solid gold ring — sits inside arc ── */}
        <div style={{
          position:       'relative',
          width:          crestSize,
          height:         crestSize,
          borderRadius:   '50%',
          background:     '#0D1B2A',
          border:         `3px solid #F5C518`,
          boxShadow:      '0 0 0 3px rgba(245,197,24,0.25), 0 0 18px rgba(245,197,24,0.5)',
          overflow:       'hidden',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          zIndex:         1,
          flexShrink:     0,
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

      {/* ── Pulsing message below ── */}
      {message && (
        <div style={{
          fontSize:      '11px',
          color:         'var(--text-muted)',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          fontFamily:    'var(--font-display)',
          animation:     'pavilion-pulse 1.8s ease-in-out infinite',
        }}>
          {message}
        </div>
      )}

    </div>
  )
}
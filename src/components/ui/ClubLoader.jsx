// pavilion-web/src/components/ui/ClubLoader.jsx

// ── Shared animated loader used across all loading states ──
// Displays the HTCC crest inside a spinning gold ring arc

export default function ClubLoader({ message = 'Loading…', size = 72 }) {
  const ring    = size + 16          // outer spinning ring diameter
  const border  = Math.max(3, size * 0.045) // ring stroke scales with size

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            '20px',
    }}>

      {/* ── Spinning ring + crest ── */}
      <div style={{ position: 'relative', width: ring, height: ring }}>

        {/* Spinning gold arc (CSS animation injected inline) */}
        <style>{`
          @keyframes pavilion-spin {
            0%   { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pavilion-pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.4; }
          }
        `}</style>

        {/* Outer spinning arc */}
        <div style={{
          position:     'absolute',
          inset:        0,
          borderRadius: '50%',
          border:       `${border}px solid transparent`,
          borderTopColor:   '#F5C518',
          borderRightColor: 'rgba(245,197,24,0.35)',
          animation:    'pavilion-spin 1.1s linear infinite',
        }} />

        {/* Inner static gold ring (background) */}
        <div style={{
          position:     'absolute',
          inset:        border * 1.5,
          borderRadius: '50%',
          border:       '1.5px solid rgba(245,197,24,0.12)',
        }} />

        {/* HTCC crest circle — solid gold ring matching navbar badge */}
        <div style={{
          position:       'absolute',
          inset:          border * 2,
          borderRadius:   '50%',
          background:     '#0D1B2A',
          border:         '2px solid #F5C518',
          boxShadow:      '0 0 0 3px rgba(245,197,24,0.15), 0 2px 12px rgba(0,0,0,0.6)',
          overflow:       'hidden',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
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

      {/* ── Pulsing message ── */}
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
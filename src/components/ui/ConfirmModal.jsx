// pavilion-web/src/components/ui/ConfirmModal.jsx

// ─────────────────────────────────────────────────
// Reusable modern confirmation modal.
// Replaces all window.confirm() calls across the app.
// Usage:
//   <ConfirmModal
//     isOpen={showModal}
//     title="Delete Fixture"
//     message="Are you sure you want to delete vs Ealing CC? This cannot be undone."
//     confirmLabel="Delete"
//     confirmDanger={true}
//     onConfirm={handleDelete}
//     onCancel={() => setShowModal(false)}
//   />
// ─────────────────────────────────────────────────

export default function ConfirmModal({
  isOpen,
  title        = 'Are you sure?',
  message      = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel  = 'Discard',
  confirmDanger = true,   // true = red confirm, false = gold confirm
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.15s ease',
        }}
      />

      {/* ── Modal box ── */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        width: '100%', maxWidth: '420px',
        margin: '0 16px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--navy-border)',
        borderRadius: 'var(--radius-xl, 16px)',
        boxShadow: confirmDanger
          ? '0 0 0 1px rgba(239,68,68,0.2), 0 32px 64px rgba(0,0,0,0.5)'
          : '0 0 0 1px rgba(245,197,24,0.2), 0 32px 64px rgba(0,0,0,0.5)',
        padding: '32px 28px 24px',
        animation: 'slideUp 0.2s ease',
      }}>

        {/* Icon */}
        <div style={{
          width: '52px', height: '52px', borderRadius: '50%',
          background: confirmDanger ? 'rgba(239,68,68,0.1)' : 'rgba(245,197,24,0.1)',
          border: `1px solid ${confirmDanger ? 'rgba(239,68,68,0.3)' : 'rgba(245,197,24,0.3)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '24px', margin: '0 auto 20px',
        }}>
          {confirmDanger ? '🗑️' : '⚠️'}
        </div>

        {/* Title */}
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '22px', letterSpacing: '1px',
          textAlign: 'center', color: 'var(--text-primary)',
          marginBottom: '10px',
        }}>
          {title.toUpperCase()}
        </div>

        {/* Message */}
        <div style={{
          fontSize: '14px', color: 'var(--text-muted)',
          textAlign: 'center', lineHeight: 1.6,
          marginBottom: '28px',
        }}>
          {message}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>

          {/* Cancel — green */}
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '13px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(34,197,94,0.35)',
              background: 'rgba(34,197,94,0.08)',
              color: 'var(--green)',
              fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', transition: 'var(--transition)',
              letterSpacing: '0.5px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.16)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(34,197,94,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.08)'; e.currentTarget.style.boxShadow = 'none' }}
          >
            {cancelLabel}
          </button>

          {/* Confirm — red or gold */}
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '13px',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${confirmDanger ? 'rgba(239,68,68,0.4)' : 'rgba(245,197,24,0.4)'}`,
              background: confirmDanger ? 'rgba(239,68,68,0.12)' : 'rgba(245,197,24,0.12)',
              color: confirmDanger ? 'var(--red)' : 'var(--gold)',
              fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', transition: 'var(--transition)',
              letterSpacing: '0.5px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = confirmDanger ? 'rgba(239,68,68,0.22)' : 'rgba(245,197,24,0.22)'
              e.currentTarget.style.boxShadow = confirmDanger ? '0 0 20px rgba(239,68,68,0.25)' : '0 0 20px rgba(245,197,24,0.25)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = confirmDanger ? 'rgba(239,68,68,0.12)' : 'rgba(245,197,24,0.12)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translate(-50%, -44%) } to { opacity: 1; transform: translate(-50%, -50%) } }
      `}</style>
    </>
  )
}
// pavilion-web/src/pages/admin/AdminSessionsPage.jsx
// Combined Sessions tab — mirrors AdminTrainingAnnouncementsScreen.jsx exactly
// 🏋️ Training (default) | 📢 Announce toggle switcher at the top

import { useState } from 'react'
import AppShell               from '../../components/layout/AppShell.jsx'
import AdminTrainingPage      from './AdminTrainingPage.jsx'
import AdminAnnouncementsPage from './AdminAnnouncementsPage.jsx'

// ─── CONFIGURABLE ─────────────────────────────────────────────────────────────
const TABS = [
  { key: 'training',      label: '🏋️ Training',  activeColor: '#F5C518', activeBg: 'rgba(245,197,24,0.12)', activeBorder: 'rgba(245,197,24,0.3)'  },
  { key: 'announcements', label: '📢 Announce', activeColor: '#A78BFA', activeBg: 'rgba(167,139,250,0.12)', activeBorder: 'rgba(167,139,250,0.3)' },
]

export default function AdminSessionsPage() {
  const [activePanel, setActivePanel] = useState('training')

  return (
    <AppShell>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '20px' }}>
          <div className="section-label">Administration</div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 4vw, 44px)',
            letterSpacing: '2px', lineHeight: 1,
          }}>
            SESSIONS
          </h1>
        </div>

        {/* ── Toggle switcher — mirrors native AdminTrainingAnnouncementsScreen switcher ── */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-surface)',
          border: '1px solid var(--navy-border)',
          borderRadius: 'var(--radius-full)',
          padding: '3px', marginBottom: '28px',
          gap: '3px',
        }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActivePanel(tab.key)}
              style={{
                flex: 1, padding: '9px 0',
                borderRadius: 'var(--radius-full)',
                border: activePanel === tab.key ? `1px solid ${tab.activeBorder}` : '1px solid transparent',
                background: activePanel === tab.key ? tab.activeBg : 'transparent',
                color: activePanel === tab.key ? tab.activeColor : 'var(--text-muted)',
                fontSize: '13px', fontWeight: activePanel === tab.key ? 700 : 400,
                cursor: 'pointer', transition: 'var(--transition)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Active panel — embedded=true skips AppShell ── */}
        {activePanel === 'training'
          ? <AdminTrainingPage embedded />
          : <AdminAnnouncementsPage embedded />
        }
      </div>
    </AppShell>
  )
}
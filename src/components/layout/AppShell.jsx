// pavilion-web/src/components/layout/AppShell.jsx

import { useEffect, useState } from 'react'
import Navbar from './Navbar.jsx'

// ─────────────────────────────────────────────────
// AppShell wraps all authenticated pages.
// Provides: Navbar + dark/light mode toggle + main
// content area with consistent padding.
// ─────────────────────────────────────────────────

export default function AppShell({ children }) {
  // ── Dark mode: default ON, persisted to localStorage ──
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('htcc-theme')
    return saved ? saved === 'dark' : true  // Default dark
  })

  // ── Apply theme to <html> data-theme attribute ──
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('htcc-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <main style={{ minHeight: 'calc(100vh - 64px)' }}>
        {children}
      </main>
    </div>
  )
}
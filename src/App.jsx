// pavilion-web/src/App.jsx
// Web-only entry — sole purpose: serve /reset-password from Supabase email links.
// All other traffic → friendly "Get the App" fallback.

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore.js'
import ResetPasswordPage from './pages/public/ResetPasswordPage.jsx'
import { ROUTES } from './lib/constants.js'

// ── Fallback: any URL that isn't /reset-password ─────────────────────────────
function GetTheAppPage() {
  useEffect(() => { document.title = 'Pavilion · HTCC' }, [])
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0D1B2A',
      color: '#F8F9FA',
      fontFamily: "'DM Sans', sans-serif",
      textAlign: 'center',
      padding: '24px',
    }}>
      <img
        src="/assets/images/htcc-logo.png"
        alt="HTCC"
        style={{ width: 80, height: 80, marginBottom: 24, borderRadius: 16 }}
      />
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Pavilion</h1>
      <p style={{ color: '#94A3B8', marginBottom: 0, fontSize: 16 }}>
        Harrow Town Cricket Club
      </p>
    </div>
  )
}

export default function App() {
  const init = useAuthStore(state => state.init)

  useEffect(() => { init() }, [init])

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1A2F4A',
            color: '#F8F9FA',
            border: '1px solid rgba(255,255,255,0.08)',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '14px',
            borderRadius: '10px',
          },
          success: { iconTheme: { primary: '#22C55E', secondary: '#1A2F4A' }, duration: 4000 },
          error:   { iconTheme: { primary: '#EF4444', secondary: '#1A2F4A' }, duration: 5000 },
        }}
      />
      <Routes>
        <Route path={ROUTES.RESET_PASSWORD} element={<ResetPasswordPage />} />
        <Route path="*" element={<GetTheAppPage />} />
      </Routes>
    </BrowserRouter>
  )
}

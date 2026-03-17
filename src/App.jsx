// pavilion-web/src/App.jsx

import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

// ── Auth store ──
import { useAuthStore } from './store/authStore.js'

// ── Route guards ──
import {
  MemberRoute,
  CaptainRoute,
  AdminRoute,
  PublicOnlyRoute,
} from './components/layout/ProtectedRoute.jsx'

// ── Public pages ──
import LandingPage from './pages/public/LandingPage.jsx'
import LoginPage   from './pages/public/LoginPage.jsx'
import SignupPage  from './pages/public/SignupPage.jsx'
import PendingPage from './pages/public/PendingPage.jsx'

// ── Member pages ──
import DashboardPage from './pages/member/DashboardPage.jsx'
import ProfilePage from './pages/member/ProfilePage.jsx'
import TeamsPage           from './pages/member/TeamsPage.jsx'
import FixtureDetailPage   from './pages/member/FixtureDetailPage.jsx'
import FixturesPage        from './pages/member/FixturesPage.jsx'
import CaptainFixturesPage  from './pages/captain/CaptainFixturesPage.jsx'
import SquadSelectionPage   from './pages/captain/SquadSelectionPage.jsx'
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx'
import AdminFixturesPage  from './pages/admin/AdminFixturesPage.jsx'
import AdminMembersPage   from './pages/admin/AdminMembersPage.jsx'
import AdminMatchdayPage      from './pages/admin/AdminMatchdayPage.jsx'
import AdminAnnouncementsPage  from './pages/admin/AdminAnnouncementsPage.jsx'
import AdminSessionsPage       from './pages/admin/AdminSessionsPage.jsx'
import AdminTrainingDetailPage from './pages/admin/AdminTrainingDetailPage.jsx'
import NotificationsPage       from './pages/member/NotificationsPage.jsx'
import MatchConfirmationPage   from './pages/member/MatchConfirmationPage.jsx'

// ── Constants ──
import { ROUTES } from './lib/constants.js'
import SplashScreen from './components/ui/SplashScreen.jsx'

export default function App() {
  const init    = useAuthStore(state => state.init)
  const loading = useAuthStore(state => state.loading)
  const [minTimeDone, setMinTimeDone] = useState(false)

  // ── Initialise auth session on app mount ──
  useEffect(() => {
    init()
  }, [init])

  // ── Minimum splash duration — 3.5 seconds ──
  useEffect(() => {
    const timer = setTimeout(() => setMinTimeDone(true), 3500)
    return () => clearTimeout(timer)
  }, [])

  // ── Show splash until BOTH auth resolved AND 3.5s elapsed ──
  if (loading || !minTimeDone) return <SplashScreen />

  return (
    <BrowserRouter>
      {/* ── Global toast notifications ── */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1A2F4A',
            color:      '#F8F9FA',
            border:     '1px solid rgba(255,255,255,0.08)',
            fontFamily: "'DM Sans', sans-serif",
            fontSize:   '14px',
            borderRadius: '10px',
          },
          success: {
            iconTheme: { primary: '#22C55E', secondary: '#1A2F4A' },
            duration: 4000,
          },
          error: {
            iconTheme: { primary: '#EF4444', secondary: '#1A2F4A' },
            duration: 5000,
          },
        }}
      />

      <Routes>
        {/* ── Public routes — redirect to dashboard if already logged in ── */}
        <Route path={ROUTES.LANDING} element={<LandingPage />} />

        <Route path={ROUTES.LOGIN} element={
          <PublicOnlyRoute><LoginPage /></PublicOnlyRoute>
        } />

        <Route path={ROUTES.SIGNUP} element={
          <PublicOnlyRoute><SignupPage /></PublicOnlyRoute>
        } />

        {/* ── Pending approval — authenticated but not yet approved ── */}
        <Route path={ROUTES.PENDING} element={<PendingPage />} />

        {/* ── Member routes ── */}
        <Route path={ROUTES.DASHBOARD} element={
          <MemberRoute><DashboardPage /></MemberRoute>
        } />

        {/* ── Admin routes ── */}
        <Route path={ROUTES.ADMIN_DASHBOARD} element={
          <AdminRoute><AdminDashboardPage /></AdminRoute>
        } />
        <Route path={ROUTES.ADMIN_FIXTURES} element={
          <AdminRoute><AdminFixturesPage /></AdminRoute>
        } />
        <Route path={ROUTES.ADMIN_MEMBERS} element={
          <AdminRoute><AdminMembersPage /></AdminRoute>
        } />

        <Route path="/admin/matchday" element={
          <AdminRoute><AdminMatchdayPage /></AdminRoute>
        } />
        <Route path={ROUTES.ADMIN_ANNOUNCEMENTS} element={
          <AdminRoute><AdminAnnouncementsPage /></AdminRoute>
        } />
        {/* ── Sessions tab — combined Training + Announcements toggle ── */}
        <Route path={ROUTES.ADMIN_SESSIONS} element={
          <AdminRoute><AdminSessionsPage /></AdminRoute>
        } />
        <Route path="/admin/sessions/:sessionId" element={
          <AdminRoute><AdminTrainingDetailPage /></AdminRoute>
        } />

        <Route path={ROUTES.PROFILE} element={
          <MemberRoute><ProfilePage /></MemberRoute>
        } />

        <Route path={ROUTES.TEAMS} element={
          <MemberRoute><TeamsPage /></MemberRoute>
        } />

        <Route path="/fixture/:fixtureId" element={
          <MemberRoute><FixtureDetailPage /></MemberRoute>
        } />
        <Route path="/fixtures" element={
          <MemberRoute><FixturesPage /></MemberRoute>
        } />

        {/* ── Captain routes ── */}
        <Route path="/captain/fixtures" element={
          <CaptainRoute><CaptainFixturesPage /></CaptainRoute>
        } />
        <Route path="/captain/fixtures/:fixtureId/squad" element={
          <CaptainRoute><SquadSelectionPage /></CaptainRoute>
        } />

        {/* ── Notifications ── */}
        <Route path={ROUTES.NOTIFICATIONS} element={
          <MemberRoute><NotificationsPage /></MemberRoute>
        } />

        {/* ── Match confirmation — shown when squad is published ── */}
        <Route path="/fixture-confirmation/:fixtureId" element={
          <MemberRoute><MatchConfirmationPage /></MemberRoute>
        } />

        {/* ── Admin/Captain panel profile — same ProfilePage, /admin/* path
            triggers fromAdmin=true in ProfilePage → shows Back to Member View ── */}
        <Route path="/admin/profile" element={
          <AdminRoute><ProfilePage /></AdminRoute>
        } />
        <Route path="/captain/profile" element={
          <CaptainRoute><ProfilePage /></CaptainRoute>
        } />

        {/* ── Catch-all ── */}
        <Route path="*" element={<Navigate to={ROUTES.LANDING} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
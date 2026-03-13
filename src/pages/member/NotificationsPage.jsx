// pavilion-web/src/pages/member/NotificationsPage.jsx

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, isToday, isYesterday, isThisWeek } from 'date-fns'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell from '../../components/layout/AppShell.jsx'
import { PAGE_TITLES } from '../../lib/constants.js'

// ─── CONFIGURABLE ─────────────────────────────────
const TYPE_ICON = {
  availability_reminder: '🏏',
  squad_published:       '📋',
  approval:              '✅',
  welcome:               '👋',
  join_approved:         '✅',
  join_rejected:         '❌',
  custom:                '📢',
}

const TYPE_COLOR = {
  availability_reminder: 'var(--gold)',
  squad_published:       'var(--green)',
  approval:              'var(--green)',
  welcome:               '#60A5FA',
  join_approved:         'var(--green)',
  join_rejected:         'var(--red)',
  custom:                'var(--text-muted)',
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const profile  = useAuthStore(state => state.profile)

  const [notifications, setNotifications] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState('all')  // all | unread

  useEffect(() => { document.title = PAGE_TITLES.NOTIFICATIONS }, [])
  useEffect(() => { if (profile?.id) fetchNotifications() }, [profile?.id])

  const fetchNotifications = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    if (data) setNotifications(data)
    setLoading(false)
  }

  // ── Mark all as read ──
  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return
    await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  // ── Mark single as read + navigate ──
  const handleClick = async (notif) => {
    if (!notif.read) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notif.id)
      setNotifications(prev =>
        prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
      )
    }
    if (notif.fixture_id) {
      navigate('/fixture/' + notif.fixture_id)
    }
  }

  // ── Delete a notification ──
  const handleDelete = async (e, id) => {
    e.stopPropagation()
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  // ── Group notifications by date label ──
  const groupByDate = (notifs) => {
    const groups = {}
    notifs.forEach(n => {
      const d = parseISO(n.created_at)
      const label = isToday(d)     ? 'Today'
        : isYesterday(d)           ? 'Yesterday'
        : isThisWeek(d)            ? 'This Week'
        : format(d, 'MMMM yyyy')
      if (!groups[label]) groups[label] = []
      groups[label].push(n)
    })
    return groups
  }

  const filtered = filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications

  const grouped      = groupByDate(filtered)
  const unreadCount  = notifications.filter(n => !n.read).length
  const totalCount   = notifications.length

  return (
    <AppShell>
      <div className="page-inner" style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '32px' }}>
          <div className="section-label">Your Account</div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px',
          }}>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 4vw, 44px)',
              letterSpacing: '2px', lineHeight: 1,
            }}>
              NOTIFICATIONS
            </h1>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  padding: '8px 18px', borderRadius: 'var(--radius-full)',
                  background: 'rgba(245,197,24,0.08)',
                  border: '1px solid rgba(245,197,24,0.25)',
                  color: 'var(--gold)', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', transition: 'var(--transition)',
                }}
              >
                ✓ Mark all read
              </button>
            )}
          </div>
        </div>

        {/* ── Stats + filter row ── */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap',
          gap: '12px', marginBottom: '24px',
        }}>
          {/* Stats */}
          <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{totalCount}</span> total
            </span>
            {unreadCount > 0 && (
              <span>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{unreadCount}</span> unread
              </span>
            )}
          </div>

          {/* Filter toggle */}
          <div style={{
            display: 'flex',
            border: '1px solid var(--navy-border)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
          }}>
            {[
              { key: 'all',    label: 'All'    },
              { key: 'unread', label: 'Unread' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                style={{
                  padding: '7px 16px', border: 'none',
                  background: filter === opt.key
                    ? 'rgba(245,197,24,0.12)'
                    : 'transparent',
                  color: filter === opt.key ? 'var(--gold)' : 'var(--text-muted)',
                  fontSize: '13px', fontWeight: filter === opt.key ? 700 : 400,
                  cursor: 'pointer', transition: 'var(--transition)',
                  borderRight: opt.key === 'all' ? '1px solid var(--navy-border)' : 'none',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            Loading notifications…
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && filtered.length === 0 && (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔔</div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '22px', letterSpacing: '1px', marginBottom: '8px',
            }}>
              {filter === 'unread' ? 'ALL CAUGHT UP' : 'NO NOTIFICATIONS YET'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {filter === 'unread'
                ? 'You have no unread notifications'
                : 'Availability reminders and squad announcements will appear here'}
            </div>
          </div>
        )}

        {/* ── Grouped notifications ── */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {Object.entries(grouped).map(([label, items]) => (
              <div key={label}>
                {/* Group header */}
                <div style={{
                  fontSize: '11px', fontWeight: 700, letterSpacing: '2px',
                  color: 'var(--text-muted)', textTransform: 'uppercase',
                  marginBottom: '10px', paddingBottom: '8px',
                  borderBottom: '1px solid var(--navy-border)',
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>{label}</span>
                  <span style={{ fontWeight: 400, letterSpacing: '0' }}>
                    {items.length} notification{items.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Notification rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {items.map(notif => {
                    const accentColor = TYPE_COLOR[notif.type] || 'var(--text-muted)'
                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleClick(notif)}
                        className="card"
                        style={{
                          padding: '16px 20px',
                          cursor: notif.fixture_id ? 'pointer' : 'default',
                          borderLeft: `3px solid ${notif.read ? 'transparent' : accentColor}`,
                          background: notif.read
                            ? undefined
                            : 'rgba(245,197,24,0.02)',
                          transition: 'var(--transition)',
                          display: 'flex', gap: '14px', alignItems: 'flex-start',
                        }}
                      >
                        {/* Icon circle */}
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '50%',
                          background: accentColor + '15',
                          border: '1px solid ' + accentColor + '30',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '18px', flexShrink: 0,
                        }}>
                          {TYPE_ICON[notif.type] || '🔔'}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'flex-start', gap: '12px', marginBottom: '4px',
                          }}>
                            <div style={{
                              fontWeight: notif.read ? 500 : 700,
                              fontSize: '14px', color: 'var(--text-primary)',
                            }}>
                              {notif.title}
                            </div>
                            <div style={{
                              fontSize: '11px', color: 'var(--text-faint)',
                              whiteSpace: 'nowrap', flexShrink: 0,
                            }}>
                              {format(parseISO(notif.created_at), 'HH:mm')}
                            </div>
                          </div>
                          <div style={{
                            fontSize: '13px', color: 'var(--text-muted)',
                            lineHeight: 1.6,
                          }}>
                            {notif.body}
                          </div>
                          {notif.fixture_id && (
                            <div style={{
                              fontSize: '12px', color: accentColor,
                              fontWeight: 600, marginTop: '6px',
                            }}>
                              Tap to set availability →
                            </div>
                          )}
                        </div>

                        {/* Unread dot + delete */}
                        <div style={{
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', gap: '10px', flexShrink: 0,
                        }}>
                          {!notif.read && (
                            <div style={{
                              width: '9px', height: '9px', borderRadius: '50%',
                              background: accentColor,
                              boxShadow: '0 0 6px ' + accentColor,
                            }} />
                          )}
                          <button
                            onClick={(e) => handleDelete(e, notif.id)}
                            title="Dismiss"
                            style={{
                              background: 'none', border: 'none',
                              cursor: 'pointer', fontSize: '14px',
                              color: 'var(--text-faint)', padding: '2px',
                              lineHeight: 1, transition: 'var(--transition)',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
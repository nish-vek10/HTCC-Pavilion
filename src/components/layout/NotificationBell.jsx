// pavilion-web/src/components/layout/NotificationBell.jsx

import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import { ROUTES } from '../../lib/constants.js'

// ─── CONFIGURABLE ─────────────────────────────────
const DROPDOWN_LIMIT = 8  // Max items shown in bell dropdown

// ─── Notification type icon map ───────────────────
const TYPE_ICON = {
  availability_reminder: '🏏',
  training_reminder:     '🎯',
  squad_published:       '📋',
  approval:              '✅',
  welcome:               '👋',
  join_approved:         '🟢',
  role_change:           '🎖️',
  announcement:          '📢',
  custom:                '🔔',
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const profile  = useAuthStore(state => state.profile)

  const [notifications, setNotifications] = useState([])
  const [open,          setOpen]          = useState(false)
  const dropdownRef = useRef(null)

  // Derived: unread count
  const unreadCount = notifications.filter(n => !n.read).length

  // ── Initial fetch ──
  useEffect(() => {
    if (profile?.id) fetchNotifications()
  }, [profile?.id])

  // ── Real-time: listen for new notifications ──
  useEffect(() => {
    if (!profile?.id) return

    const channel = supabase
      .channel('pavilion-notifications-bell')
      // ── New notification arrives → prepend to list ──
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev])
        }
      )
      // ── Notification marked read (from page or bell) → update in place ──
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          setNotifications(prev =>
            prev.map(n => n.id === payload.new.id ? { ...n, read: payload.new.read } : n)
          )
        }
      )
      // ── Notification deleted (from page) → remove from bell list ──
      .on(
        'postgres_changes',
        {
          event:  'DELETE',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          setNotifications(prev => prev.filter(n => n.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile?.id])

  // ── Close dropdown on outside click ──
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setNotifications(data)
  }

  // ── Mark all unread as read ──
  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return
    await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  // ── Mark single notification as read ──
  const markOneRead = async (id) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  // ── Click a notification: mark read + navigate ──
  const handleNotifClick = async (notif) => {
    if (!notif.read) await markOneRead(notif.id)
    setOpen(false)

    switch (notif.type) {
      case 'availability_reminder':
        if (notif.fixture_id) navigate('/fixture/' + notif.fixture_id)
        break
      case 'training_reminder':
        navigate(notif.training_session_id
          ? '/fixtures?training=' + notif.training_session_id
          : '/fixtures')
        break
      case 'squad_published':
        if (notif.fixture_id) navigate('/fixture-confirmation/' + notif.fixture_id)
        break
      case 'approval':
      case 'welcome':
        navigate('/dashboard')
        break
      case 'join_approved':
        navigate('/teams')
        break
      case 'role_change':
        navigate('/profile')
        break
      default:
        break
    }
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>

      {/* ── Bell button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        style={{
          position: 'relative',
          width: '38px', height: '38px',
          borderRadius: 'var(--radius-md)',
          border: open
            ? '1px solid rgba(245,197,24,0.3)'
            : '1px solid var(--navy-border)',
          background: open
            ? 'rgba(245,197,24,0.08)'
            : 'var(--bg-elevated)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'var(--transition)', flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '16px', lineHeight: 1 }}>🔔</span>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <div style={{
            position: 'absolute', top: '-5px', right: '-5px',
            minWidth: '18px', height: '18px', borderRadius: '9px',
            background: '#EF4444',
            border: '2px solid #0D1B2A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 700, color: '#fff',
            padding: '0 4px', lineHeight: 1,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: '340px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--navy-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          zIndex: 300, overflow: 'hidden',
          animation: 'fade-in 0.15s ease',
        }}>

          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--navy-border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{
              fontWeight: 700, fontSize: '14px',
              color: 'var(--text-primary)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              Notifications
              {unreadCount > 0 && (
                <span style={{
                  fontSize: '11px', fontWeight: 700, color: '#EF4444',
                  background: 'rgba(239,68,68,0.1)',
                  padding: '2px 7px', borderRadius: '10px',
                  border: '1px solid rgba(239,68,68,0.2)',
                }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '12px', color: 'var(--gold)', fontWeight: 600,
                  padding: '2px 6px',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: '40px 20px', textAlign: 'center',
                fontSize: '13px', color: 'var(--text-muted)',
              }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔔</div>
                No notifications yet
              </div>
            ) : (
              notifications.slice(0, DROPDOWN_LIMIT).map((notif, i) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: i < Math.min(notifications.length, DROPDOWN_LIMIT) - 1
                      ? '1px solid rgba(255,255,255,0.04)'
                      : 'none',
                    background: notif.read ? 'transparent' : 'rgba(245,197,24,0.03)',
                    cursor: notif.fixture_id ? 'pointer' : 'default',
                    transition: 'var(--transition)',
                    display: 'flex', gap: '12px', alignItems: 'flex-start',
                  }}
                  onMouseEnter={e => {
                    if (notif.fixture_id)
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = notif.read
                      ? 'transparent'
                      : 'rgba(245,197,24,0.03)'
                  }}
                >
                  {/* Type icon */}
                  <div style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>
                    {TYPE_ICON[notif.type] || '🔔'}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: notif.read ? 500 : 700,
                      fontSize: '13px', color: 'var(--text-primary)',
                      marginBottom: '3px',
                    }}>
                      {notif.title}
                    </div>
                    <div style={{
                      fontSize: '12px', color: 'var(--text-muted)',
                      lineHeight: 1.5, overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {notif.body}
                    </div>
                    <div style={{
                      fontSize: '11px', color: 'var(--text-faint)', marginTop: '4px',
                    }}>
                      {format(parseISO(notif.created_at), 'EEE d MMM, HH:mm')}
                    </div>
                  </div>

                  {/* Unread dot */}
                  {!notif.read && (
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: 'var(--gold)', flexShrink: 0, marginTop: '5px',
                    }} />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer — view all */}
          {notifications.length > 0 && (
            <div style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--navy-border)',
              textAlign: 'center',
            }}>
              <button
                onClick={() => { setOpen(false); navigate(ROUTES.NOTIFICATIONS) }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '13px', color: 'var(--gold)', fontWeight: 600,
                }}
              >
                View all notifications →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
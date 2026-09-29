import { useMemo, useState } from 'react'
import {
  Bell,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  CircleGauge,
  FolderKanban,
  MessageCircle,
  Users,
  X,
} from 'lucide-react'
import { notificationSourceLabels } from '../../data/notificationData.js'
import './NotificationDrawer.css'

const sourceOptions = ['all', 'itsm', 'livechat', 'projects', 'calendar', 'rota']

const sourceIcons = {
  itsm: CircleGauge,
  livechat: MessageCircle,
  projects: FolderKanban,
  calendar: CalendarDays,
  rota: Users,
}

function relativeTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return 'Now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d`
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date)
}

function isToday(value) {
  const date = new Date(value)
  const today = new Date()
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
}

function NotificationItem({ notification, onOpen }) {
  const Icon = sourceIcons[notification.source] || Bell
  return (
    <button
      className={`notification-drawer-item${notification.read ? ' is-read' : ' is-unread'}`}
      onClick={() => onOpen(notification)}
      type="button"
    >
      <span className={`notification-drawer-icon source-${notification.source || 'itsm'}`} aria-hidden="true">
        <Icon size={17} />
      </span>
      <span className="notification-drawer-copy">
        <span className="notification-drawer-meta-row">
          <span>{notificationSourceLabels[notification.source] || 'Hi5Central'}</span>
          <span aria-hidden="true">•</span>
          <time dateTime={notification.createdAt}>{relativeTime(notification.createdAt)}</time>
        </span>
        <strong>{notification.title}</strong>
        <span>{notification.detail}</span>
      </span>
      <span className="notification-drawer-end" aria-hidden="true">
        {!notification.read && <span className={`notification-drawer-unread tone-${notification.tone || 'info'}`} />}
        <ChevronRight size={16} />
      </span>
    </button>
  )
}

export function NotificationDrawer({
  notifications,
  onClearRead,
  onClose,
  onMarkAllRead,
  onOpenNotification,
}) {
  const [mode, setMode] = useState('all')
  const [source, setSource] = useState('all')

  const unreadCount = notifications.filter((notification) => !notification.read).length
  const sourceCounts = useMemo(() => notifications.reduce((counts, notification) => {
    counts[notification.source] = (counts[notification.source] || 0) + 1
    return counts
  }, {}), [notifications])

  const filtered = useMemo(() => notifications
    .filter((notification) => mode === 'all' || !notification.read)
    .filter((notification) => source === 'all' || notification.source === source)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [mode, notifications, source])

  const today = filtered.filter((notification) => isToday(notification.createdAt))
  const earlier = filtered.filter((notification) => !isToday(notification.createdAt))

  return (
    <aside className="notification-drawer" aria-label="Notifications">
      <header className="notification-drawer-header">
        <div>
          <span className="eyebrow">Inbox</span>
          <div className="notification-drawer-title-row">
            <strong>Notifications</strong>
            {unreadCount > 0 && <span>{unreadCount} unread</span>}
          </div>
        </div>
        <button
          aria-label="Close notifications"
          className="notification-drawer-close"
          onClick={onClose}
          title="Close notifications"
          type="button"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="notification-drawer-toolbar">
        <div className="notification-drawer-mode" aria-label="Notification view">
          <button className={mode === 'all' ? 'active' : ''} onClick={() => setMode('all')} type="button">
            All <span>{notifications.length}</span>
          </button>
          <button className={mode === 'unread' ? 'active' : ''} onClick={() => setMode('unread')} type="button">
            Unread <span>{unreadCount}</span>
          </button>
        </div>
        <div className="notification-drawer-actions">
          <button disabled={!unreadCount} onClick={onMarkAllRead} type="button">
            <CheckCheck size={14} aria-hidden="true" />
            Mark all read
          </button>
          <button disabled={!notifications.some((notification) => notification.read)} onClick={onClearRead} type="button">
            Clear read
          </button>
        </div>
      </div>

      <div className="notification-drawer-sources" aria-label="Filter notifications by area">
        {sourceOptions.map((option) => {
          const label = option === 'all' ? 'All areas' : notificationSourceLabels[option]
          const count = option === 'all' ? notifications.length : sourceCounts[option] || 0
          return (
            <button
              className={source === option ? 'active' : ''}
              key={option}
              onClick={() => setSource(option)}
              type="button"
            >
              {label}
              <span>{count}</span>
            </button>
          )
        })}
      </div>

      <div className="notification-drawer-list">
        {!filtered.length && (
          <div className="notification-drawer-empty">
            <Bell size={24} aria-hidden="true" />
            <strong>No notifications here</strong>
            <span>{mode === 'unread' ? 'You are all caught up.' : 'Try another area filter.'}</span>
          </div>
        )}

        {!!today.length && (
          <section>
            <div className="notification-drawer-group-label">Today</div>
            {today.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} onOpen={onOpenNotification} />
            ))}
          </section>
        )}

        {!!earlier.length && (
          <section>
            <div className="notification-drawer-group-label">Earlier</div>
            {earlier.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} onOpen={onOpenNotification} />
            ))}
          </section>
        )}
      </div>
    </aside>
  )
}

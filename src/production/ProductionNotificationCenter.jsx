import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, Check, CheckCheck, ChevronRight, Mail, MonitorUp, Settings2, X } from 'lucide-react'
import './ProductionNotificationCenter.css'

const API_BASE = window.__HI5_API_BASE__
const LOCAL_NOTIFICATIONS_KEY = 'hi5central-notifications-v1'
const BRIDGE_KEY = 'hi5central-server-notification-bridge-v1'
const BROWSER_SHOWN_KEY = 'hi5central-browser-notifications-shown-v1'

const CATEGORY_LABELS = {
  incidents: ['Incidents', 'Incident activity, status and assignment changes'],
  serviceRequests: ['Service Requests', 'Request progress and lifecycle updates'],
  problems: ['Problems', 'Investigation, Known Error and resolution activity'],
  changes: ['Changes', 'Change lifecycle and implementation activity'],
  assignments: ['Assignments', 'Records and work assigned to you'],
  approvals: ['Approvals', 'Approval requests and decisions'],
  tasks: ['Fulfilment tasks', 'Task readiness, blocking and completion'],
  customerUpdates: ['Customer updates', 'Requester-visible comments and responses'],
  liveChat: ['Live Chat', 'Waiting chats and conversation activity'],
  projects: ['Projects', 'Project assignments and updates'],
  calendar: ['Calendar', 'Upcoming and changed calendar events'],
  rota: ['Rota', 'Availability and rota changes'],
  rmm: ['RMM', 'Device, alert and monitoring activity'],
  security: ['Security', 'Security and account events'],
  platform: ['Platform', 'General Hi5Central workspace events'],
}

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function writeJson(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* optional cache */ }
}

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || 'Notification operation failed.')
    error.status = response.status
    throw error
  }
  return payload
}

function relativeTime(value) {
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return ''
  const seconds = Math.round((time - Date.now()) / 1000)
  const absolute = Math.abs(seconds)
  if (absolute < 60) return 'Now'
  if (absolute < 3600) return new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' }).format(Math.round(seconds / 60), 'minute')
  if (absolute < 86400) return new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' }).format(Math.round(seconds / 3600), 'hour')
  return new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' }).format(Math.round(seconds / 86400), 'day')
}

function navigate(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
  window.dispatchEvent(new Event('hi5-routechange'))
}

function pathForNotification(item) {
  const type = String(item?.target?.type || '').toLowerCase()
  const reference = item?.target?.reference || ''
  if (type === 'service request') return reference ? `/requests/${encodeURIComponent(reference)}` : '/requests'
  if (type === 'problem') return reference ? `/problems/${encodeURIComponent(reference)}` : '/problems'
  if (type === 'change') return reference ? `/changes/${encodeURIComponent(reference)}` : '/changes'
  if (type === 'incident' || type === 'ticket') return reference ? `/incidents/${encodeURIComponent(reference)}` : '/incidents'
  if (type.includes('project')) return reference ? `/projects/${encodeURIComponent(reference)}` : '/projects'
  if (type.includes('livechat') || type.includes('live_chat')) return '/live-chat'
  if (type.includes('calendar')) return '/calendar'
  if (type.includes('rota')) return '/rota'
  return '/dashboard'
}

function updateBellBadge(count) {
  document.querySelectorAll('.production-workspace-notifications, .notification-trigger').forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    node.dataset.hi5ServerUnread = count > 0 ? String(Math.min(99, count)) : ''
    node.classList.toggle('hi5-has-server-notifications', count > 0)
  })
}

function PreferenceToggle({ checked, onChange, title, copy, icon: Icon }) {
  return <button className={`hi5-notification-toggle ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)} type="button">
    {Icon ? <Icon size={17} /> : null}<span><strong>{title}</strong>{copy ? <small>{copy}</small> : null}</span><i><b /></i>
  </button>
}

function PreferencePanel({ preferences, setPreferences, onSave, saving, tenant = false }) {
  if (!preferences) return null
  const updateChannel = (key, value) => setPreferences((current) => ({ ...current, channels: { ...current.channels, [key]: value } }))
  const updateCategory = (key, value) => setPreferences((current) => ({ ...current, categories: { ...current.categories, [key]: value } }))

  async function toggleBrowser(value) {
    if (value && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      updateChannel('browser', permission === 'granted')
      return
    }
    updateChannel('browser', value)
  }

  return <section className="hi5-notification-settings-card">
    <header><div><span>{tenant ? 'Tenant defaults' : 'My notifications'}</span><strong>{tenant ? 'Default notification policy' : 'Delivery and event preferences'}</strong></div></header>
    <div className="hi5-notification-channel-grid">
      <PreferenceToggle checked={preferences.channels.inApp} onChange={(value) => updateChannel('inApp', value)} icon={Bell} title="In-app" copy="Notification Centre and unread badge" />
      <PreferenceToggle checked={preferences.channels.email} onChange={(value) => updateChannel('email', value)} icon={Mail} title="Email" copy="Styled Hi5Central email notifications" />
      <PreferenceToggle checked={preferences.channels.browser} onChange={toggleBrowser} icon={MonitorUp} title="Browser" copy="Desktop/browser alerts while signed in" />
    </div>
    <div className="hi5-notification-category-grid">
      {Object.entries(CATEGORY_LABELS).map(([key, [label, copy]]) => <PreferenceToggle checked={preferences.categories[key] !== false} copy={copy} key={key} onChange={(value) => updateCategory(key, value)} title={label} />)}
    </div>
    <footer><button disabled={saving} onClick={onSave} type="button"><Check size={14} />{saving ? 'Saving…' : tenant ? 'Save tenant defaults' : 'Save my preferences'}</button></footer>
  </section>
}

function NotificationSettingsSurface() {
  const [preferences, setPreferences] = useState(null)
  const [tenantSettings, setTenantSettings] = useState(null)
  const [saving, setSaving] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      apiJson('/api/v1/notification-preferences'),
      apiJson('/api/v1/notification-settings').catch((requestError) => requestError.status === 403 ? null : Promise.reject(requestError)),
    ]).then(([mine, tenant]) => {
      if (!active) return
      setPreferences(mine.preferences)
      setTenantSettings(tenant?.settings || null)
    }).catch((loadError) => { if (active) setError(loadError.message) })
    return () => { active = false }
  }, [])

  async function saveMine() {
    setSaving('mine'); setError(''); setNotice('')
    try {
      const result = await apiJson('/api/v1/notification-preferences', { method: 'PATCH', body: JSON.stringify({ preferences }) })
      setPreferences(result.preferences); setNotice('Your notification preferences are saved.')
    } catch (saveError) { setError(saveError.message) } finally { setSaving('') }
  }

  async function saveTenant() {
    setSaving('tenant'); setError(''); setNotice('')
    try {
      const result = await apiJson('/api/v1/notification-settings', { method: 'PATCH', body: JSON.stringify({ settings: tenantSettings }) })
      setTenantSettings(result.settings); setNotice('Tenant notification defaults are saved.')
    } catch (saveError) { setError(saveError.message) } finally { setSaving('') }
  }

  return <div className="hi5-notification-settings-surface">
    <div className="hi5-notification-settings-intro"><span>Platform notifications</span><h2>Choose what Hi5Central tells people — and where.</h2><p>Events from ITSM, Live Chat, Projects, Calendar, Rota, RMM and security use one notification policy. Personal choices can narrow the tenant defaults.</p></div>
    {notice ? <div className="hi5-notification-settings-notice">{notice}</div> : null}
    {error ? <div className="hi5-notification-settings-error">{error}</div> : null}
    <PreferencePanel preferences={preferences} setPreferences={setPreferences} saving={saving === 'mine'} onSave={saveMine} />
    {tenantSettings ? <PreferencePanel tenant preferences={tenantSettings} setPreferences={setTenantSettings} saving={saving === 'tenant'} onSave={saveTenant} /> : null}
  </div>
}

function NotificationDrawer({ items, unreadCount, loading, error, onClose, onOpen, onReadAll, onSettings }) {
  return createPortal(<div className="hi5-notification-layer"><button aria-label="Close notifications" className="hi5-notification-backdrop" onClick={onClose} type="button" /><aside className="hi5-notification-drawer" aria-label="Notifications">
    <header><div><span>Hi5Central</span><strong>Notifications</strong></div><div>{unreadCount > 0 ? <button onClick={onReadAll} title="Mark all read" type="button"><CheckCheck size={16} /></button> : null}<button onClick={onSettings} title="Notification settings" type="button"><Settings2 size={16} /></button><button onClick={onClose} title="Close notifications" type="button"><X size={17} /></button></div></header>
    <div className="hi5-notification-drawer-summary"><span>{unreadCount ? `${unreadCount} unread` : 'All caught up'}</span><small>Updates from across your Hi5Central workspace</small></div>
    <div className="hi5-notification-list">
      {loading ? <div className="hi5-notification-empty">Loading notifications…</div> : null}
      {!loading && error ? <div className="hi5-notification-empty is-error">{error}</div> : null}
      {!loading && !error && !items.length ? <div className="hi5-notification-empty"><Bell size={20} /><strong>No notifications yet</strong><span>New activity will appear here.</span></div> : null}
      {items.map((item) => <button className={`hi5-notification-item ${item.read ? '' : 'is-unread'}`} key={item.id} onClick={() => onOpen(item)} type="button"><i /><span><small>{CATEGORY_LABELS[item.category]?.[0] || 'Hi5Central'} · {relativeTime(item.createdAt)}</small><strong>{item.title}</strong><em>{item.body}</em></span><ChevronRight size={15} /></button>)}
    </div>
  </aside></div>, document.body)
}

export function ProductionNotificationCenter() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [preferences, setPreferences] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [settingsTarget, setSettingsTarget] = useState(null)
  const baselineRef = useRef(false)

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true)
    try {
      const payload = await apiJson('/api/v1/notifications?limit=150')
      setItems(payload.items || []); setUnreadCount(Number(payload.unreadCount || 0)); setPreferences(payload.preferences || null); setError('')
      updateBellBadge(Number(payload.unreadCount || 0))
    } catch (loadError) {
      if (loadError.status !== 401) setError(loadError.message)
    } finally { if (!quiet) setLoading(false) }
  }

  useEffect(() => {
    void load({ quiet: true })
    const timer = window.setInterval(() => { if (!document.hidden) void load({ quiet: true }) }, 30000)
    const visibility = () => { if (!document.hidden) void load({ quiet: true }) }
    document.addEventListener('visibilitychange', visibility)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visibility); updateBellBadge(0) }
  }, [])

  useEffect(() => {
    const intercept = (event) => {
      const target = event.target instanceof Element ? event.target.closest('.production-workspace-notifications, .notification-trigger') : null
      if (!target) return
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.()
      setOpen((current) => !current)
      void load()
    }
    document.addEventListener('click', intercept, true)
    return () => document.removeEventListener('click', intercept, true)
  }, [])

  useEffect(() => {
    const scan = () => {
      if (window.location.pathname !== '/settings/itsm/notifications') { setSettingsTarget(null); return }
      const target = document.querySelector('.production-settings-content')
      setSettingsTarget(target instanceof HTMLElement ? target : null)
    }
    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('hi5-routechange', scan)
    return () => { observer.disconnect(); window.removeEventListener('hi5-routechange', scan) }
  }, [])

  useEffect(() => {
    const syncLocal = async () => {
      const local = readJson(LOCAL_NOTIFICATIONS_KEY, [])
      if (!Array.isArray(local)) return
      const state = readJson(BRIDGE_KEY, { seen: [] })
      const seen = new Set(Array.isArray(state.seen) ? state.seen : [])
      if (!baselineRef.current && !seen.size) {
        local.forEach((item) => item?.id && seen.add(item.id))
        baselineRef.current = true
        writeJson(BRIDGE_KEY, { seen: [...seen].slice(-500) })
        return
      }
      baselineRef.current = true
      const additions = local.filter((item) => item?.id && !seen.has(item.id)).slice(0, 20)
      for (const item of additions) {
        try {
          await apiJson('/api/v1/notifications/client-event', { method: 'POST', body: JSON.stringify({ externalId: item.id, source: item.source || 'platform', title: item.title || 'Hi5Central update', detail: item.detail || '', target: item.target || {}, tone: item.tone || 'info' }) })
          seen.add(item.id)
        } catch { /* Local notifications remain visible in the legacy store if sync is temporarily unavailable. */ }
      }
      writeJson(BRIDGE_KEY, { seen: [...seen].slice(-500) })
      if (additions.length) void load({ quiet: true })
    }
    const timer = window.setInterval(syncLocal, 1800)
    void syncLocal()
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!preferences?.channels?.browser || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const shown = new Set(readJson(BROWSER_SHOWN_KEY, []))
    const fresh = items.filter((item) => !item.read && !shown.has(item.id)).slice(0, 4)
    fresh.forEach((item) => {
      try {
        const notification = new Notification(item.title, { body: item.body, tag: `hi5-${item.id}`, icon: '/hi5central-logo.png' })
        notification.onclick = () => { window.focus(); navigate(pathForNotification(item)); notification.close() }
        shown.add(item.id)
        apiJson(`/api/v1/notifications/${encodeURIComponent(item.id)}/browser-delivered`, { method: 'POST' }).catch(() => {})
      } catch { /* Browser notification support is optional. */ }
    })
    writeJson(BROWSER_SHOWN_KEY, [...shown].slice(-500))
  }, [items, preferences?.channels?.browser])

  async function openItem(item) {
    if (!item.read) {
      await apiJson(`/api/v1/notifications/${encodeURIComponent(item.id)}/read`, { method: 'POST' }).catch(() => {})
      setItems((current) => current.map((value) => value.id === item.id ? { ...value, read: true } : value))
      setUnreadCount((value) => Math.max(0, value - 1))
    }
    setOpen(false)
    navigate(pathForNotification(item))
  }

  async function readAll() {
    await apiJson('/api/v1/notifications/read-all', { method: 'POST' })
    setItems((current) => current.map((item) => ({ ...item, read: true }))); setUnreadCount(0); updateBellBadge(0)
  }

  const drawer = useMemo(() => open ? <NotificationDrawer items={items} unreadCount={unreadCount} loading={loading} error={error} onClose={() => setOpen(false)} onOpen={openItem} onReadAll={readAll} onSettings={() => { setOpen(false); navigate('/settings/itsm/notifications') }} /> : null, [open, items, unreadCount, loading, error])

  return <>{drawer}{settingsTarget ? createPortal(<NotificationSettingsSurface />, settingsTarget) : null}</>
}

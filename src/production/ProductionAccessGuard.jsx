import { useEffect, useMemo, useState } from 'react'

const API_BASE = window.__HI5_API_BASE__

const permissionByModule = {
  home: 'dashboard.view',
  incidents: 'itsm.incidents.view',
  requests: 'itsm.requests.view',
  problems: 'itsm.problems.view',
  changes: 'itsm.changes.view',
  calendar: 'calendar.view',
  projects: 'projects.view',
  rota: 'rota.view',
  people: 'organisation.people.view',
  knowledge: 'knowledge.view_internal',
  cmdb: 'cmdb.view',
  reports: 'reports.view',
  settings: 'settings.view',
  livechat: 'live_chat.view',
  tickets: 'itsm.records.view_all',
}

const permissionByNavTitle = {
  Dashboard: 'dashboard.view',
  Incidents: 'itsm.incidents.view',
  'Service Requests': 'itsm.requests.view',
  Problems: 'itsm.problems.view',
  Changes: 'itsm.changes.view',
  Calendar: 'calendar.view',
  Projects: 'projects.view',
  'Rota & Availability': 'rota.view',
  People: 'organisation.people.view',
  Knowledge: 'knowledge.view_internal',
  CMDB: 'cmdb.view',
  Reports: 'reports.view',
  Settings: 'settings.view',
}

const routeCandidates = [
  ['dashboard.view', '/dashboard'],
  ['itsm.incidents.view', '/incidents'],
  ['itsm.requests.view', '/requests'],
  ['itsm.problems.view', '/problems'],
  ['itsm.changes.view', '/changes'],
  ['live_chat.view', '/live-chat'],
  ['knowledge.view_internal', '/knowledge'],
  ['organisation.people.view', '/people'],
  ['projects.view', '/projects'],
  ['calendar.view', '/calendar'],
  ['rota.view', '/rota'],
  ['cmdb.view', '/cmdb'],
  ['reports.view', '/reports'],
  ['access.roles.view', '/settings/roles-permissions'],
  ['settings.view', '/settings/organisation'],
]

function permissionForPath(pathname) {
  if (pathname === '/' || pathname === '/login' || pathname.startsWith('/onboarding')) return ''
  if (pathname.startsWith('/settings/roles-permissions')) return 'access.roles.view'
  if (pathname.startsWith('/settings')) return 'settings.view'
  if (pathname.startsWith('/incidents')) return 'itsm.incidents.view'
  if (pathname.startsWith('/requests')) return 'itsm.requests.view'
  if (pathname.startsWith('/problems')) return 'itsm.problems.view'
  if (pathname.startsWith('/changes')) return 'itsm.changes.view'
  if (pathname.startsWith('/tickets')) return 'itsm.records.view_all'
  if (pathname.startsWith('/live-chat')) return 'live_chat.view'
  if (pathname.startsWith('/knowledge')) return 'knowledge.view_internal'
  if (pathname.startsWith('/people')) return 'organisation.people.view'
  if (pathname.startsWith('/calendar')) return 'calendar.view'
  if (pathname.startsWith('/projects')) return 'projects.view'
  if (pathname.startsWith('/rota')) return 'rota.view'
  if (pathname.startsWith('/cmdb')) return 'cmdb.view'
  if (pathname.startsWith('/reports')) return 'reports.view'
  if (pathname.startsWith('/dashboard')) return 'dashboard.view'
  return ''
}

function setHidden(element, hidden) {
  if (!(element instanceof HTMLElement)) return
  if (hidden) {
    if (!element.dataset.hi5RbacDisplay) element.dataset.hi5RbacDisplay = element.style.display || '__empty__'
    element.style.setProperty('display', 'none', 'important')
    element.setAttribute('aria-hidden', 'true')
  } else if (element.dataset.hi5RbacDisplay !== undefined) {
    const previous = element.dataset.hi5RbacDisplay
    if (previous === '__empty__') element.style.removeProperty('display')
    else element.style.display = previous
    delete element.dataset.hi5RbacDisplay
    element.removeAttribute('aria-hidden')
  }
}

export function ProductionAccessGuard() {
  const [session, setSession] = useState(null)
  const permissions = useMemo(() => new Set(session?.access?.effectivePermissions || []), [session])

  function can(permission) {
    if (!permission) return true
    if (permissions.has(permission)) return true
    if (permission.startsWith('itsm.') && permissions.has('itsm.records.view_all') && permission.endsWith('.view')) return true
    return false
  }

  async function refresh() {
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/session`, { credentials: 'include', cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.authenticated) {
        setSession(null)
        return
      }
      setSession(payload)
    } catch {
      setSession(null)
    }
  }

  useEffect(() => {
    void refresh()
    const onChange = () => void refresh()
    window.addEventListener('hi5-access-changed', onChange)
    window.addEventListener('focus', onChange)
    window.addEventListener('hi5-routechange', onChange)
    const interval = window.setInterval(refresh, 20_000)
    return () => {
      window.removeEventListener('hi5-access-changed', onChange)
      window.removeEventListener('focus', onChange)
      window.removeEventListener('hi5-routechange', onChange)
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!session?.authenticated || !session.access?.workspaceAccess) return undefined

    const apply = () => {
      document.querySelectorAll('.nav-item[title]').forEach((element) => {
        const title = element.getAttribute('title') || element.textContent?.trim() || ''
        const permission = permissionByNavTitle[title]
        if (permission) setHidden(element, !can(permission))
      })

      document.querySelectorAll('.workspace-tab[data-tab-module]').forEach((element) => {
        const module = element.getAttribute('data-tab-module') || ''
        const permission = permissionByModule[module]
        if (permission) setHidden(element, !can(permission))
      })

      const broadAnalyst = can('itsm.records.view_all')
      document.querySelectorAll('.chrome-search,.tab-add').forEach((element) => setHidden(element, !broadAnalyst))

      const createAllowed = ['itsm.records.create_all','itsm.incidents.create','itsm.requests.create','itsm.problems.create','itsm.changes.create'].some(can)
      document.querySelectorAll('.chrome-record-create').forEach((element) => setHidden(element, !createAllowed))

      const settingsNav = document.querySelector('.nav-item[title="Settings"]')
      if (settingsNav instanceof HTMLElement && can('access.roles.view')) setHidden(settingsNav, false)

      const currentPermission = permissionForPath(window.location.pathname)
      if (currentPermission && !can(currentPermission)) {
        const fallback = routeCandidates.find(([permission]) => can(permission))?.[1] || '/login'
        if (window.location.pathname !== fallback) {
          window.history.replaceState({}, '', fallback)
          window.dispatchEvent(new Event('hi5-routechange'))
        }
      }
    }

    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-tab-module','title'] })
    const interval = window.setInterval(apply, 600)
    return () => {
      observer.disconnect()
      window.clearInterval(interval)
    }
  }, [session, permissions])

  return null
}

const ALL_TICKET_FILTERS = {
  status: 'All',
  priority: 'All',
  type: 'All',
}

const LIST_ROUTES = {
  '/dashboard': {
    kind: 'workspace',
    path: '/dashboard',
    viewId: 'home',
    key: 'home',
    title: 'Dashboard',
  },
  '/tickets': {
    kind: 'workspace',
    path: '/tickets',
    viewId: 'tickets',
    key: 'tickets',
    title: 'All Records',
    filter: ALL_TICKET_FILTERS,
    query: '',
  },
  '/incidents': {
    kind: 'workspace',
    path: '/incidents',
    viewId: 'incidents',
    key: 'incidents',
    title: 'Incidents',
    filter: { ...ALL_TICKET_FILTERS, type: 'Incident' },
    query: '',
  },
  '/requests': {
    kind: 'workspace',
    path: '/requests',
    viewId: 'requests',
    key: 'requests',
    title: 'Service Requests',
    filter: { ...ALL_TICKET_FILTERS, type: 'Service Request' },
    query: '',
  },
  '/tasks': {
    kind: 'workspace',
    path: '/tasks',
    viewId: 'tickets',
    key: 'tasks',
    title: 'Tasks',
    navId: 'tasks',
    filter: ALL_TICKET_FILTERS,
    query: '',
  },
  '/problems': {
    kind: 'workspace',
    path: '/problems',
    viewId: 'problems',
    key: 'problems',
    title: 'Problems',
    filter: { ...ALL_TICKET_FILTERS, type: 'Problem' },
    query: '',
  },
  '/changes': {
    kind: 'workspace',
    path: '/changes',
    viewId: 'changes',
    key: 'changes',
    title: 'Changes',
  },
  '/live-chat': {
    kind: 'workspace',
    path: '/live-chat',
    viewId: 'livechat',
    key: 'livechat',
    title: 'Live Chat',
  },
  '/calendar': {
    kind: 'workspace',
    path: '/calendar',
    viewId: 'calendar',
    key: 'calendar',
    title: 'Calendar',
  },
  '/projects': {
    kind: 'workspace',
    path: '/projects',
    viewId: 'projects',
    key: 'projects',
    title: 'Projects',
  },
  '/rota': {
    kind: 'workspace',
    path: '/rota',
    viewId: 'rota',
    key: 'rota',
    title: 'Rota & Availability',
  },
  '/people': {
    kind: 'workspace',
    path: '/people',
    viewId: 'people',
    key: 'people',
    title: 'People',
  },
  '/cmdb': {
    kind: 'workspace',
    path: '/cmdb',
    viewId: 'cmdb',
    key: 'cmdb',
    title: 'CMDB',
  },
  '/knowledge': {
    kind: 'workspace',
    path: '/knowledge',
    viewId: 'knowledge',
    key: 'knowledge',
    title: 'Knowledge',
  },
  '/reports': {
    kind: 'workspace',
    path: '/reports',
    viewId: 'reports',
    key: 'reports',
    title: 'Reports',
  },
  '/profile': {
    kind: 'workspace',
    path: '/profile',
    viewId: 'profile',
    key: 'profile',
    title: 'Profile',
  },
  '/settings': {
    kind: 'workspace',
    path: '/settings/appearance',
    viewId: 'settings',
    key: 'settings-appearance',
    title: 'Settings',
    settingsSection: 'appearance',
  },
  '/settings/appearance': {
    kind: 'workspace',
    path: '/settings/appearance',
    viewId: 'settings',
    key: 'settings-appearance',
    title: 'Settings',
    settingsSection: 'appearance',
  },
  '/portal': {
    kind: 'workspace',
    path: '/portal',
    viewId: 'portal',
    key: 'portal',
    title: 'Self-Service',
  },
  '/new-tab': {
    kind: 'workspace',
    path: '/new-tab',
    viewId: 'newtab',
    key: 'newtab',
    title: 'New Tab',
  },
}

const ALIASES = {
  '/home': '/dashboard',
  '/self-service': '/portal',
  '/settings/workspace': '/profile',
  '/settings/profile': '/profile',
}

const NEW_RECORD_ROUTES = {
  incidents: { type: 'Incident', navId: 'incidents', title: 'New Incident' },
  requests: { type: 'Service Request', navId: 'requests', title: 'New Service Request' },
  problems: { type: 'Problem', navId: 'problems', title: 'New Problem' },
  changes: { type: 'Change', navId: 'changes', title: 'New Change' },
}

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') return '/'
  const withoutTrailingSlash = pathname.replace(/\/+$/, '')
  return withoutTrailingSlash || '/'
}

function recordRoute(id, pathPrefix, type) {
  return {
    kind: 'workspace',
    path: `/${pathPrefix}/${id}`,
    viewId: 'tickets',
    key: `ticket-${id}`,
    title: id,
    recordId: id,
    filter: type ? { ...ALL_TICKET_FILTERS, type } : undefined,
    query: '',
  }
}

export function routeFromLocation(location = window.location) {
  let pathname = normalizePathname(location.pathname)
  pathname = ALIASES[pathname] || pathname

  if (pathname === '/' || pathname === '/login') {
    return {
      kind: 'login',
      path: '/login',
    }
  }

  if (LIST_ROUTES[pathname]) {
    return { ...LIST_ROUTES[pathname] }
  }

  const settingsMatch = pathname.match(/^\/settings\/(.+)$/i)
  if (settingsMatch) {
    const settingsSection = settingsMatch[1].toLowerCase()
    return {
      kind: 'workspace',
      path: `/settings/${settingsSection}`,
      viewId: 'settings',
      key: 'settings-appearance',
      title: 'Settings',
      settingsSection,
    }
  }

  const newRecordMatch = pathname.match(/^\/(incidents|requests|problems|changes)\/new$/i)
  if (newRecordMatch) {
    const section = newRecordMatch[1].toLowerCase()
    const config = NEW_RECORD_ROUTES[section]
    return {
      kind: 'workspace',
      path: `/${section}/new`,
      viewId: 'newrecord',
      key: `new-${section}`,
      title: config.title,
      newRecordType: config.type,
      navId: config.navId,
    }
  }

  const portalRequestMatch = pathname.match(/^\/portal\/requests\/([^/]+)$/i)
  if (portalRequestMatch) {
    const id = decodeURIComponent(portalRequestMatch[1]).toUpperCase()
    return {
      kind: 'workspace',
      path: `/portal/requests/${encodeURIComponent(id)}`,
      viewId: 'portal',
      key: `portal-request-${id}`,
      title: id,
      portalRequestId: id,
    }
  }

  const taskMatch = pathname.match(/^\/tasks\/([^/]+)$/i)
  if (taskMatch) {
    const taskKey = decodeURIComponent(taskMatch[1]).toUpperCase()
    return {
      kind: 'workspace',
      path: `/tasks/${encodeURIComponent(taskKey)}`,
      viewId: 'tickets',
      key: `task-${taskKey}`,
      title: taskKey,
      recordId: `TASK:${taskKey}`,
      navId: 'tasks',
      query: '',
    }
  }

  const cmdbMatch = pathname.match(/^\/cmdb\/([^/]+)$/i)
  if (cmdbMatch) {
    const assetId = decodeURIComponent(cmdbMatch[1]).toUpperCase()
    return {
      kind: 'workspace',
      path: `/cmdb/${encodeURIComponent(assetId)}`,
      viewId: 'cmdb',
      key: `asset-${assetId}`,
      title: assetId,
      assetId,
    }
  }

  const projectMatch = pathname.match(/^\/projects\/([^/]+)$/i)
  if (projectMatch) {
    const projectId = decodeURIComponent(projectMatch[1]).toUpperCase()
    return {
      kind: 'workspace',
      path: `/projects/${encodeURIComponent(projectId)}`,
      viewId: 'projects',
      key: `project-${projectId}`,
      title: projectId,
      projectId,
    }
  }

  const knowledgeMatch = pathname.match(/^\/knowledge\/([^/]+)$/i)
  if (knowledgeMatch) {
    const articleSlug = decodeURIComponent(knowledgeMatch[1]).toLowerCase()
    return {
      kind: 'workspace',
      path: `/knowledge/${encodeURIComponent(articleSlug)}`,
      viewId: 'knowledge',
      key: `knowledge-${articleSlug}`,
      title: 'Knowledge Article',
      articleSlug,
    }
  }

  const newTabMatch = pathname.match(/^\/new-tab\/([^/]+)$/i)
  if (newTabMatch) {
    const key = decodeURIComponent(newTabMatch[1])
    return {
      kind: 'workspace',
      path: `/new-tab/${encodeURIComponent(key)}`,
      viewId: 'newtab',
      key,
      title: 'New Tab',
    }
  }

  const recordMatch = pathname.match(
    /^\/(incidents|requests|problems|changes|tickets)\/([^/]+)$/i,
  )

  if (recordMatch) {
    const [, section, rawId] = recordMatch
    const id = decodeURIComponent(rawId).toUpperCase()
    const routeMap = {
      incidents: ['incidents', 'Incident'],
      requests: ['requests', 'Service Request'],
      problems: ['problems', 'Problem'],
      changes: ['changes', 'Change'],
      tickets: ['tickets', undefined],
    }
    const [prefix, type] = routeMap[section.toLowerCase()]
    return recordRoute(id, prefix, type)
  }

  return {
    kind: 'not-found',
    path: pathname,
  }
}

export function defaultRouteForRole(role) {
  return role === 'requester' ? { ...LIST_ROUTES['/portal'] } : { ...LIST_ROUTES['/dashboard'] }
}

export function resolveRouteForRole(route, role) {
  if (role === 'requester') {
    if (route?.kind === 'workspace' && route.viewId === 'portal') return route
    return defaultRouteForRole('requester')
  }

  if (route?.kind === 'workspace') {
    return route
  }

  return defaultRouteForRole('analyst')
}

function recordPrefixFromTicket(ticket, recordId = '') {
  if (ticket?.type === 'Incident') return 'incidents'
  if (ticket?.type === 'Service Request') return 'requests'
  if (ticket?.type === 'Problem') return 'problems'
  if (ticket?.type === 'Change') return 'changes'

  if (recordId.startsWith('INC-')) return 'incidents'
  if (recordId.startsWith('REQ-')) return 'requests'
  if (recordId.startsWith('PRB-')) return 'problems'
  if (recordId.startsWith('CHG-')) return 'changes'

  return 'tickets'
}

function newRecordPrefix(type) {
  return {
    Incident: 'incidents',
    'Service Request': 'requests',
    Problem: 'problems',
    Change: 'changes',
  }[type] || 'incidents'
}

export function pathForTab(tab, tickets = []) {
  if (!tab) return '/dashboard'

  if (tab.portalRequestId) {
    return `/portal/requests/${encodeURIComponent(tab.portalRequestId)}`
  }

  if (tab.assetId) {
    return `/cmdb/${encodeURIComponent(tab.assetId)}`
  }

  if (tab.articleSlug) {
    return `/knowledge/${encodeURIComponent(tab.articleSlug)}`
  }

  if (tab.projectId) {
    return `/projects/${encodeURIComponent(tab.projectId)}`
  }

  if (tab.newRecordType) {
    return `/${newRecordPrefix(tab.newRecordType)}/new`
  }

  if (tab.recordId?.startsWith('TASK:')) {
    return `/tasks/${encodeURIComponent(tab.recordId.slice(5))}`
  }

  if (tab.recordId) {
    const ticket = tickets.find((item) => item.id === tab.recordId)
    return `/${recordPrefixFromTicket(ticket, tab.recordId)}/${encodeURIComponent(tab.recordId)}`
  }

  if (tab.settingsSection) {
    return `/settings/${tab.settingsSection}`
  }

  if (tab.key === 'tasks') return '/tasks'
  if (tab.viewId === 'incidents' || tab.key === 'incidents') return '/incidents'
  if (tab.viewId === 'requests' || tab.key === 'requests') return '/requests'
  if (tab.viewId === 'problems' || tab.key === 'problems') return '/problems'

  return {
    home: '/dashboard',
    tickets: '/tickets',
    portal: '/portal',
    changes: '/changes',
    livechat: '/live-chat',
    calendar: '/calendar',
    projects: '/projects',
    rota: '/rota',
    people: '/people',
    cmdb: '/cmdb',
    knowledge: '/knowledge',
    reports: '/reports',
    settings: '/settings/appearance',
    profile: '/profile',
    newtab: tab.key && tab.key !== 'newtab' ? `/new-tab/${encodeURIComponent(tab.key)}` : '/new-tab',
  }[tab.viewId] || '/dashboard'
}

export function writeRoute(path, { replace = false } = {}) {
  const normalizedPath = normalizePathname(path)
  if (normalizePathname(window.location.pathname) === normalizedPath) return

  const method = replace ? 'replaceState' : 'pushState'
  window.history[method]({}, '', normalizedPath)
  window.dispatchEvent(new CustomEvent('hi5-routechange', {
    detail: { path: normalizedPath, replace },
  }))
}

export function allTicketFilters() {
  return { ...ALL_TICKET_FILTERS }
}

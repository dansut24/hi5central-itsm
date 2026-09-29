import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  LogOut,
  Menu,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import {
  analystNavGroups,
  analystNavIds,
  assets,
  knowledgeArticles,
  workspaceLoginProfiles, serviceCatalog,
  serviceDeskModules,
  viewMeta,
} from './workspaceConfig.jsx'
import { createNotification } from './runtimeNotifications.js'
import { buildLifecycleTransition } from '../lib/lifecycle.js'
import { portalHomePath, portalRequestPath, portalRouteFromLocation, resolveTenantSurface, rmmPath } from '../lib/tenantSurface.js'
import { deploymentConfig } from '../lib/deploymentConfig.js'
import {
  buildOrganisationAuditEntry,
  resolveCurrentPerson,
} from '../lib/peopleRbac.js'
import {
  countBy,
  getBreadcrumbs,
  makeTab,
  newTicketId,
} from '../lib/workspace.js'
import {
  allTicketFilters,
  defaultRouteForRole,
  pathForTab,
  resolveRouteForRole,
  routeFromLocation,
  writeRoute,
} from '../lib/routes.js'
import { authenticateWorkspaceUser } from './runtimeAuthBoundary.js'
import {
  loadAccent,
  loadCalendarEvents,
  loadDensity,
  loadLiveChatConversations,
  loadLiveChatPreferences,
  loadNotifications,
  loadOrganisationAudit,
  loadOrganisationDepartments,
  loadOrganisationPeople,
  loadOrganisationTeams,
  loadPortalSession,
  loadRmmSession,
  loadSession,
  loadSidebarMode,
  loadTheme,
  loadTickets,
  loadProjects,
  loadRotaEntries,
  loadWorkspace,
  saveAccent,
  saveCalendarEvents,
  saveDensity,
  saveLiveChatConversations,
  saveLiveChatPreferences,
  saveNotifications,
  saveOrganisationAudit,
  saveOrganisationDepartments,
  saveOrganisationPeople,
  saveOrganisationTeams,
  savePortalSession,
  saveRmmSession,
  saveSession,
  saveSidebarMode,
  saveTheme,
  saveTickets,
  saveProjects,
  saveRotaEntries,
  saveWorkspace,
} from '../services/runtimeState.js'
import {
  addProductionProjectActivity,
  addProductionProjectTask,
  createProductionProject,
  createProductionProjectMilestone,
  createProductionProjectRisk,
  fetchProductionProjects,
  updateProductionProject,
  updateProductionProjectMilestone,
  updateProductionProjectRisk,
  updateProductionProjectTask,
} from '../services/productionProjects.js'
import { CalendarView } from '../features/calendar/CalendarView.jsx'
import { ProjectManagementView } from '../features/projects/ProjectViews.jsx'
import { RotaView } from '../features/rota/RotaView.jsx'
import { LiveChatView } from '../features/live-chat/LiveChatView.jsx'
import { NotificationDrawer } from '../features/notifications/NotificationDrawer.jsx'
import { PeopleView } from '../features/people/PeopleView.jsx'
import {
  ChangesView,
  CmdbRecordView,
  CmdbView,
  DashboardView,
  KnowledgeArticleView,
  KnowledgeView,
  NewRecordView,
  NewTabView,
  RecordCreateMenu,
  ReportsView,
  TicketRecordView,
  TicketsView,
} from '../features/workspace/WorkspaceViews.jsx'
import './WorkspaceRuntime.css'

function sessionHasPermission(session, permission) {
  const effective = session?.access?.effectivePermissions || []
  const grants = session?.access?.permissions || []
  if (effective.includes(permission) || grants.includes('*') || grants.includes(permission)) return true
  return grants.some((grant) => grant.endsWith('*') && permission.startsWith(grant.slice(0, -1)))
}


function workspaceTabModule(tab) {
  if (tab?.navId) return tab.navId
  if (tab?.projectId) return 'projects'

  const recordId = String(tab?.recordId || '').toUpperCase()
  if (recordId.startsWith('INC-')) return 'incidents'
  if (recordId.startsWith('REQ-')) return 'requests'
  if (recordId.startsWith('PRB-')) return 'problems'
  if (recordId.startsWith('CHG-')) return 'changes'

  if (tab?.newRecordType === 'Incident') return 'incidents'
  if (tab?.newRecordType === 'Service Request') return 'requests'
  if (tab?.newRecordType === 'Problem') return 'problems'
  if (tab?.newRecordType === 'Change') return 'changes'

  return tab?.viewId || 'tickets'
}

function getSystemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function tabFromRoute(route) {
  const asset = route.assetId ? assets.find((item) => item.id === route.assetId) : undefined
  const article = route.articleSlug
    ? knowledgeArticles.find((item) => item.slug === route.articleSlug)
    : undefined

  return makeTab(route.viewId, {
    // The workspace launcher is a singleton. Older builds created timestamped
    // /new-tab/:key routes; canonicalise all of them back to one tab identity.
    key: route.viewId === 'newtab' ? NEW_TAB_KEY : route.key,
    title: asset?.name || article?.title || route.title,
    pinned: route.viewId === 'home' || route.viewId === 'livechat' || (route.viewId === 'portal' && !route.portalRequestId),
    recordId: route.recordId,
    assetId: route.assetId,
    articleSlug: route.articleSlug,
    projectId: route.projectId,
    portalRequestId: route.portalRequestId,
    settingsSection: route.settingsSection,
    newRecordType: route.newRecordType,
    navId: route.navId,
    filter: route.filter,
    query: route.query,
  })
}

const MAX_WORKSPACE_TABS = 12
const NEW_TAB_KEY = 'newtab'
const LIVE_CHAT_TAB_KEY = 'livechat'

function liveChatTab() {
  return makeTab('livechat', { key: LIVE_CHAT_TAB_KEY, title: 'Live Chat', pinned: true })
}

function syncLiveChatFixedTab(currentTabs, enabled) {
  const withoutLiveChat = currentTabs.filter((tab) => tab.key !== LIVE_CHAT_TAB_KEY)
  if (!enabled) {
    return withoutLiveChat.length
      ? withoutLiveChat
      : [makeTab('home', { key: 'home', title: 'Dashboard', pinned: true })]
  }

  const fixedTab = liveChatTab()
  const homeIndex = withoutLiveChat.findIndex((tab) => tab.key === 'home')
  const insertAt = homeIndex >= 0 ? homeIndex + 1 : 0
  const nextTabs = [...withoutLiveChat]
  nextTabs.splice(insertAt, 0, fixedTab)

  if (nextTabs.length <= MAX_WORKSPACE_TABS) return nextTabs

  const removableIndex = nextTabs.findLastIndex?.((tab) => !tab.pinned) ?? -1
  if (removableIndex >= 0) nextTabs.splice(removableIndex, 1)
  return nextTabs.slice(0, MAX_WORKSPACE_TABS)
}

function emptyTicketDraft(type = 'Incident') {
  return {
    type,
    requesterId: '',
    requester: '',
    requesterEmail: '',
    requesterStaffNumber: '',
    requesterJobTitle: '',
    requesterDepartment: '',
    requesterLocation: '',
    requesterManager: '',
    title: '',
    description: '',
    impact: 'Medium',
    urgency: 'Medium',
    priority: 'Medium',
    service: 'Collaboration',
    category: 'Email & Messaging',
    team: 'Service Desk',
    requestTemplateId: '',
    requestedItems: [],
    requestApprovals: [],
    requestTasks: [],
    requestCostCentre: '',
    requestRequiredBy: '',
    problemImpactScope: '',
    problemHypothesis: '',
    problemWorkaround: '',
    problemRootCause: '',
    problemPermanentFix: '',
    problemRelatedIncidentsText: '',
    changeType: 'Normal',
    changeRisk: 'Medium',
    changeApprovalRoute: 'CAB',
    changeBusinessReason: '',
    changeImplementationPlan: '',
    changeTestPlan: '',
    changeBackoutPlan: '',
    changePlannedStart: '',
    changePlannedEnd: '',
    changeDowntime: 'No outage expected',
    changeAffectedCisText: '',
  }
}

function isTicketDraftDirty(draft, type = draft?.type || 'Incident') {
  if (!draft) return false
  const baseline = emptyTicketDraft(type)
  return Object.keys(baseline).some((key) => {
    if (key === 'type') return false
    const current = draft[key]
    const initial = baseline[key]
    if (Array.isArray(current) || Array.isArray(initial)) {
      return JSON.stringify(current || []) !== JSON.stringify(initial || [])
    }
    return current !== initial
  })
}

function restoreWorkspaceTabs(workspace, routeTab) {
  const normalizeWorkspaceTab = (tab) =>
    tab?.viewId === 'newtab'
      ? makeTab('newtab', { ...tab, key: NEW_TAB_KEY, title: 'New Tab' })
      : tab

  const normalizedRouteTab = normalizeWorkspaceTab(routeTab)
  const savedTabs = Array.isArray(workspace?.tabs)
    ? workspace.tabs
        .filter((tab) => tab && typeof tab.key === 'string' && typeof tab.viewId === 'string')
        .map((tab) => normalizeWorkspaceTab(makeTab(tab.viewId, tab)))
    : []

  // This also cleans up duplicate launcher tabs persisted by older builds.
  const deduped = savedTabs.filter(
    (tab, index, list) => list.findIndex((candidate) => candidate.key === tab.key) === index,
  )

  if (!deduped.some((tab) => tab.key === normalizedRouteTab.key)) {
    deduped.push(normalizedRouteTab)
  }

  if (!deduped.length) return [normalizedRouteTab]
  if (deduped.length <= MAX_WORKSPACE_TABS) return deduped

  const essentials = deduped.filter((tab) => tab.pinned || tab.key === normalizedRouteTab.key)
  const recent = deduped
    .filter((tab) => !essentials.some((essential) => essential.key === tab.key))
    .slice(-(MAX_WORKSPACE_TABS - essentials.length))

  return [...essentials, ...recent].slice(-MAX_WORKSPACE_TABS)
}

function addWorkspaceTab(currentTabs, tab) {
  const normalizedTab =
    tab?.viewId === 'newtab'
      ? makeTab('newtab', { ...tab, key: NEW_TAB_KEY, title: 'New Tab' })
      : tab

  if (
    currentTabs.some(
      (currentTab) =>
        currentTab.key === normalizedTab.key ||
        (normalizedTab.viewId === 'newtab' && currentTab.viewId === 'newtab'),
    )
  ) {
    return currentTabs
  }

  const nextTabs = [...currentTabs, normalizedTab]
  if (nextTabs.length <= MAX_WORKSPACE_TABS) return nextTabs

  const removableIndex = nextTabs.findIndex(
    (currentTab) => !currentTab.pinned && currentTab.key !== normalizedTab.key,
  )
  if (removableIndex >= 0) nextTabs.splice(removableIndex, 1)

  return nextTabs.slice(-MAX_WORKSPACE_TABS)
}

function WorkspaceRuntime() {
  const tenantSurface = resolveTenantSurface()
  const platform = deploymentConfig()
  const isPortalSurface = tenantSurface.kind === 'portal'
  const isRmmSurface = tenantSurface.kind === 'rmm'
  const [initialTickets] = useState(loadTickets)
  const [initialProjects] = useState(loadProjects)
  const [initialRotaEntries] = useState(loadRotaEntries)
  const [initialCalendarEvents] = useState(loadCalendarEvents)
  const [initialLiveChatConversations] = useState(loadLiveChatConversations)
  const [initialLiveChatPreferences] = useState(loadLiveChatPreferences)
  const [initialNotifications] = useState(loadNotifications)
  const [initialOrganisationAudit] = useState(loadOrganisationAudit)
  const [initialOrganisationPeople] = useState(loadOrganisationPeople)
  const [initialOrganisationTeams] = useState(loadOrganisationTeams)
  const [initialOrganisationDepartments] = useState(loadOrganisationDepartments)
  const [initialSession] = useState(() => isPortalSurface ? loadPortalSession() : isRmmSurface ? loadRmmSession() : loadSession())
  const [initialWorkspace] = useState(loadWorkspace)
  const [initialRoute] = useState(() => {
    if (isPortalSurface) return portalRouteFromLocation(tenantSurface)
    if (isRmmSurface) return defaultRouteForRole('analyst')
    const route = routeFromLocation()
    return route.viewId === 'portal' ? defaultRouteForRole('analyst') : route
  })
  const initialWorkspaceRoute = resolveRouteForRole(
    initialRoute,
    initialSession?.role || 'analyst',
  )
  const initialRouteTab = tabFromRoute(initialWorkspaceRoute)
  const restoredInitialTabs = initialSession?.role === 'analyst'
    ? restoreWorkspaceTabs(initialWorkspace, initialRouteTab)
    : [initialRouteTab]
  const initialTabs = initialSession?.role === 'analyst'
    ? syncLiveChatFixedTab(restoredInitialTabs, initialLiveChatPreferences.enabled)
    : restoredInitialTabs
  const initialActiveTab =
    initialTabs.find((tab) => tab.key === initialRouteTab.key) ||
    initialTabs.find((tab) => tab.key === initialWorkspace?.activeTabKey) ||
    initialTabs[0] ||
    initialRouteTab
  const [session, setSession] = useState(initialSession)
  const [theme, setTheme] = useState(loadTheme)
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)
  const [accent, setAccent] = useState(loadAccent)
  const [sidebarMode, setSidebarMode] = useState(loadSidebarMode)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [pullRefreshDragging, setPullRefreshDragging] = useState(false)
  const [pullRefreshArmed, setPullRefreshArmed] = useState(false)
  const [pullRefreshing, setPullRefreshing] = useState(false)
  const [density, setDensity] = useState(loadDensity)
  const tabListRef = useRef(null)
  const mainFrameRef = useRef(null)
  const pullRefreshGestureRef = useRef({
    active: false,
    engaged: false,
    startX: 0,
    startY: 0,
    distance: 0,
    scrollTarget: null,
    refreshing: false,
  })
  const pullRefreshTimerRef = useRef(null)
  const [tickets, setTickets] = useState(initialTickets)
  const [projects, setProjects] = useState(initialProjects)
  const [rotaEntries, setRotaEntries] = useState(initialRotaEntries)
  const [calendarEvents, setCalendarEvents] = useState(initialCalendarEvents)
  const [liveChatConversations, setLiveChatConversations] = useState(initialLiveChatConversations)
  const [liveChatPreferences, setLiveChatPreferences] = useState(initialLiveChatPreferences)
  const [selectedLiveChatId, setSelectedLiveChatId] = useState(() => initialLiveChatConversations.find((conversation) => conversation.status !== 'Closed')?.id || initialLiveChatConversations[0]?.id || '')
  const [tabs, setTabs] = useState(initialTabs)
  const [activeTabKey, setActiveTabKey] = useState(initialActiveTab.key)
  const initialRouteType =
    initialActiveTab.newRecordType ||
    (initialActiveTab.filter?.type && initialActiveTab.filter.type !== 'All'
      ? initialActiveTab.filter.type
      : undefined)
  const initialModuleTicket = initialRouteType
    ? initialTickets.find((ticket) => ticket.type === initialRouteType)
    : undefined
  const [selectedTicketId, setSelectedTicketId] = useState(
    initialWorkspaceRoute.recordId || initialModuleTicket?.id || initialTickets[0]?.id || '',
  )
  const [query, setQuery] = useState(initialActiveTab.query || '')
  const [filters, setFilters] = useState(
    initialActiveTab.filter || allTicketFilters(),
  )
  const [toast, setToast] = useState('')
  const [notifications, setNotifications] = useState(initialNotifications)
  const [organisationAudit, setOrganisationAudit] = useState(initialOrganisationAudit)
  const [people, setPeople] = useState(initialOrganisationPeople)
  const [teams, setTeams] = useState(initialOrganisationTeams)
  const [departments, setDepartments] = useState(initialOrganisationDepartments)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [tabContextMenu, setTabContextMenu] = useState(null)
  const [newComment, setNewComment] = useState('')
  const [portalQuery, setPortalQuery] = useState('')
  const [loginMode, setLoginMode] = useState(isPortalSurface ? 'requester' : isRmmSurface ? 'rmm' : 'analyst')
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [ticketDraft, setTicketDraft] = useState(() => emptyTicketDraft(initialRouteType || 'Incident'))
  const [portalDraft, setPortalDraft] = useState({
    requester: initialSession?.role === 'requester' ? initialSession.name : '',
    email: initialSession?.role === 'requester' ? workspaceLoginProfiles.requester.username : '',
    category: 'Report an IT Issue',
    title: '',
    description: '',
    urgency: 'Medium',
  })

  const resolvedTheme = theme === 'system' ? systemTheme : theme

  useEffect(() => {
    saveTickets(tickets)
  }, [tickets])

  useEffect(() => {
    saveProjects(projects)
  }, [projects])

  useEffect(() => {
    if (!session || session.role === 'requester') return undefined
    let cancelled = false
    fetchProductionProjects()
      .then((items) => { if (!cancelled) setProjects(items) })
      .catch((error) => { if (!cancelled) console.warn('Unable to load production projects', error) })
    return () => { cancelled = true }
  }, [session?.role, session?.tenantId, session?.id])

  useEffect(() => {
    saveRotaEntries(rotaEntries)
  }, [rotaEntries])

  useEffect(() => {
    saveCalendarEvents(calendarEvents)
  }, [calendarEvents])

  useEffect(() => {
    saveLiveChatConversations(liveChatConversations)
  }, [liveChatConversations])

  useEffect(() => {
    saveOrganisationAudit(organisationAudit)
  }, [organisationAudit])

  useEffect(() => {
    saveLiveChatPreferences(liveChatPreferences)
  }, [liveChatPreferences])

  useEffect(() => {
    saveNotifications(notifications)
  }, [notifications])

  useEffect(() => {
    saveOrganisationPeople(people)
  }, [people])

  useEffect(() => {
    saveOrganisationTeams(teams)
  }, [teams])

  useEffect(() => {
    saveOrganisationDepartments(departments)
  }, [departments])

  useEffect(() => {
    saveTheme(theme)
  }, [theme])

  useEffect(() => {
    saveAccent(accent)
  }, [accent])

  useEffect(() => {
    saveDensity(density)
  }, [density])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return undefined

    const handleSystemThemeChange = (event) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    setSystemTheme(media.matches ? 'dark' : 'light')
    media.addEventListener?.('change', handleSystemThemeChange)
    return () => media.removeEventListener?.('change', handleSystemThemeChange)
  }, [])

  useEffect(() => {
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 680px) and (any-pointer: coarse), (max-height: 600px) and (any-pointer: coarse)')
    const mainFrame = mainFrameRef.current
    if (!media || !mainFrame || session?.role !== 'analyst') return undefined

    const PULL_THRESHOLD = 58
    const PULL_MAX = 96
    const REFRESH_HOLD = 48

    const setPullDistance = (distance) => {
      mainFrame.style.setProperty('--pull-refresh-distance', `${Math.max(0, distance)}px`)
    }

    const isScrollable = (element) => {
      if (!(element instanceof HTMLElement) || element.getClientRects().length === 0) return false

      const style = window.getComputedStyle(element)
      return (
        /(auto|scroll)/.test(style.overflowY) &&
        element.scrollHeight > element.clientHeight + 2
      )
    }

    const findScrollTarget = (element) => {
      let current = element instanceof HTMLElement ? element : element?.parentElement

      while (current && current !== mainFrame) {
        if (isScrollable(current)) return current
        current = current.parentElement
      }

      return null
    }

    const findActiveScrollTarget = () => {
      const workspace = mainFrame.querySelector('.workspace')
      if (!(workspace instanceof HTMLElement)) return null

      if (isScrollable(workspace)) return workspace

      return Array.from(workspace.querySelectorAll('*')).find(isScrollable) || null
    }

    const resetGesture = ({ animate = true } = {}) => {
      const gesture = pullRefreshGestureRef.current
      gesture.active = false
      gesture.engaged = false
      gesture.distance = 0
      gesture.scrollTarget = null
      setPullRefreshArmed(false)
      setPullRefreshDragging(false)

      if (animate) {
        window.requestAnimationFrame(() => setPullDistance(0))
      } else {
        setPullDistance(0)
      }
    }

    const finishRefresh = () => {
      pullRefreshGestureRef.current.refreshing = false
      setTickets(loadTickets())
      setPullRefreshing(false)
      setPullRefreshArmed(false)
      setToast('Workspace refreshed')
      window.requestAnimationFrame(() => setPullDistance(0))
    }

    const beginRefresh = () => {
      pullRefreshGestureRef.current.refreshing = true
      setPullRefreshDragging(false)
      setPullRefreshArmed(false)
      setPullRefreshing(true)
      setPullDistance(REFRESH_HOLD)

      if (pullRefreshTimerRef.current) {
        window.clearTimeout(pullRefreshTimerRef.current)
      }

      pullRefreshTimerRef.current = window.setTimeout(finishRefresh, 650)
    }

    const handleTouchStart = (event) => {
      if (
        !media.matches ||
        pullRefreshGestureRef.current.refreshing ||
        event.touches.length !== 1
      ) return

      const rawTarget = event.target
      if (!(rawTarget instanceof Element) || !mainFrame.contains(rawTarget)) return

      const target = rawTarget instanceof HTMLElement ? rawTarget : rawTarget.parentElement
      if (!target) return

      const inWorkspace = Boolean(target.closest('.workspace'))
      const inBreadcrumbs = Boolean(target.closest('.breadcrumbs'))
      if (!inWorkspace && !inBreadcrumbs) return

      // The tab strip remains horizontal-swipe only. Form controls should also
      // keep their native touch behaviour. Breadcrumbs, however, are a valid
      // top-edge pull target on compact mobile layouts.
      if (target.closest('.tab-list, .sidebar, .breadcrumb-mobile-actions, .notifications-panel, .global-search-panel, .header-overlay-backdrop, input, textarea, select')) return

      const scrollTarget = findScrollTarget(target) || findActiveScrollTarget()
      if (scrollTarget && scrollTarget.scrollTop > 1) return

      const touch = event.touches[0]
      pullRefreshGestureRef.current = {
        active: true,
        engaged: false,
        startX: touch.clientX,
        startY: touch.clientY,
        distance: 0,
        scrollTarget,
        refreshing: false,
      }
    }

    const handleTouchMove = (event) => {
      const gesture = pullRefreshGestureRef.current
      if (!gesture.active || gesture.refreshing || event.touches.length !== 1) return

      if (gesture.scrollTarget && gesture.scrollTarget.scrollTop > 1) {
        resetGesture()
        return
      }

      const touch = event.touches[0]
      const deltaX = touch.clientX - gesture.startX
      const deltaY = touch.clientY - gesture.startY

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
        resetGesture()
        return
      }

      if (deltaY <= 0) {
        if (gesture.engaged) resetGesture()
        return
      }

      if (deltaY < 5) return

      // Capture the vertical gesture before iOS Safari turns it into its
      // native rubber-band / browser pull-to-refresh behaviour.
      if (event.cancelable) event.preventDefault()
      event.stopPropagation()

      if (!gesture.engaged) {
        gesture.engaged = true
        setPullRefreshDragging(true)
      }

      const resistedDistance = Math.min(PULL_MAX, deltaY * 0.52)
      gesture.distance = resistedDistance
      setPullDistance(resistedDistance)

      const armed = resistedDistance >= PULL_THRESHOLD
      setPullRefreshArmed((current) => (current === armed ? current : armed))
    }

    const handleTouchEnd = () => {
      const gesture = pullRefreshGestureRef.current
      if (!gesture.active) return

      const shouldRefresh = gesture.engaged && gesture.distance >= PULL_THRESHOLD
      gesture.active = false
      gesture.engaged = false
      gesture.scrollTarget = null

      if (shouldRefresh) {
        beginRefresh()
        return
      }

      resetGesture()
    }

    const handleViewportChange = () => {
      if (!media.matches) {
        resetGesture({ animate: false })
        pullRefreshGestureRef.current.refreshing = false
        setPullRefreshing(false)
      }
    }

    // iOS Safari can keep the native elastic scroll gesture inside nested
    // overflow containers before an ancestor bubble listener gets a chance to
    // cancel it. Capture on document instead, then scope the gesture back to
    // the current Hi5Central main frame in handleTouchStart.
    document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true })
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true, capture: true })
    media.addEventListener?.('change', handleViewportChange)

    return () => {
      document.removeEventListener('touchstart', handleTouchStart, true)
      document.removeEventListener('touchmove', handleTouchMove, true)
      document.removeEventListener('touchend', handleTouchEnd, true)
      document.removeEventListener('touchcancel', handleTouchEnd, true)
      media.removeEventListener?.('change', handleViewportChange)
      resetGesture({ animate: false })
      if (pullRefreshTimerRef.current) {
        window.clearTimeout(pullRefreshTimerRef.current)
      }
    }
  }, [session?.role])

  useEffect(() => {
    saveSidebarMode(sidebarMode)
  }, [sidebarMode])

  useEffect(() => {
    if (isPortalSurface) savePortalSession(session)
    else if (isRmmSurface) saveRmmSession(session)
    else saveSession(session)
  }, [isPortalSurface, isRmmSurface, session])

  useEffect(() => {
    if (session?.role !== 'analyst') return
    saveWorkspace({ tabs: tabs.slice(-MAX_WORKSPACE_TABS), activeTabKey })
  }, [activeTabKey, session?.role, tabs])

  useEffect(() => {
    if (session?.role !== 'analyst') return
    setTabs((currentTabs) => syncLiveChatFixedTab(currentTabs, liveChatPreferences.enabled))
  }, [liveChatPreferences.enabled, session?.role])

  useEffect(() => {
    if (isRmmSurface) return undefined
    const currentRoute = isPortalSurface ? portalRouteFromLocation(tenantSurface) : routeFromLocation()

    if (!session) {
      if (!isPortalSurface) writeRoute('/login', { replace: true })
      return
    }

    if (!isPortalSurface && currentRoute.viewId === 'portal') {
      writeRoute('/dashboard', { replace: true })
      return
    }

    if (session.role === 'analyst' && currentRoute.viewId === 'livechat' && !liveChatPreferences.enabled) {
      writeRoute('/dashboard', { replace: true })
      return
    }

    const resolvedRoute = resolveRouteForRole(currentRoute, session.role)
    if (resolvedRoute.path !== currentRoute.path) {
      writeRoute(isPortalSurface ? portalHomePath(tenantSurface) : resolvedRoute.path, { replace: true })
    }
  }, [isPortalSurface, isRmmSurface, liveChatPreferences.enabled, session])

  useEffect(() => {
    if (isRmmSurface) return undefined

    function handlePopState() {
      if (!session) return

      const currentRoute = isPortalSurface ? portalRouteFromLocation(tenantSurface) : routeFromLocation()
      if (!isPortalSurface && currentRoute.viewId === 'portal') {
        writeRoute('/dashboard', { replace: true })
        return
      }
      const route = resolveRouteForRole(currentRoute, session.role)

      if (session.role === 'analyst' && route.viewId === 'livechat' && !liveChatPreferences.enabled) {
        const fallback = tabs.find((tab) => tab.key === 'home') || tabs.find((tab) => tab.key !== LIVE_CHAT_TAB_KEY)
        if (fallback) {
          setActiveTabKey(fallback.key)
          writeRoute(pathForTab(fallback, tickets), { replace: true })
        }
        return
      }

      const currentTab = tabs.find((tab) => tab.key === activeTabKey)
      const leavingDirtyDraft =
        currentTab?.viewId === 'newrecord' &&
        route.key !== currentTab.key &&
        isTicketDraftDirty(ticketDraft, currentTab.newRecordType)

      if (leavingDirtyDraft) {
        const confirmed = window.confirm('You have unsaved changes. Leave this record without saving?')
        if (!confirmed) {
          writeRoute(pathForTab(currentTab, tickets), { replace: true })
          return
        }
        setTicketDraft(emptyTicketDraft(currentTab.newRecordType || ticketDraft.type))
      }

      if (route.path !== currentRoute.path) {
        writeRoute(route.path, { replace: true })
      }

      const tab = tabFromRoute(route)

      if (route.recordId) {
        setSelectedTicketId(route.recordId)
      } else if (route.newRecordType) {
        setTicketDraft((currentDraft) => ({ ...currentDraft, type: route.newRecordType }))
      } else if (route.filter?.type && route.filter.type !== 'All') {
        const firstModuleTicket = tickets.find((ticket) => ticket.type === route.filter.type)
        if (firstModuleTicket) setSelectedTicketId(firstModuleTicket.id)
        setTicketDraft((currentDraft) => ({ ...currentDraft, type: route.filter.type }))
      }
      if (route.filter) {
        setFilters(route.filter)
      }
      if (route.query !== undefined) {
        setQuery(route.query)
      }

      setTabs((currentTabs) => addWorkspaceTab(currentTabs, tab))
      setActiveTabKey(tab.key)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [activeTabKey, isPortalSurface, isRmmSurface, liveChatPreferences.enabled, session, tabs, ticketDraft, tickets])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!tabContextMenu) return undefined

    const handlePointerDown = (event) => {
      if (event.target.closest?.('.tab-context-menu')) return
      setTabContextMenu(null)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setTabContextMenu(null)
    }
    const closeMenu = () => setTabContextMenu(null)

    document.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [tabContextMenu])

  useEffect(() => {
    const list = tabListRef.current
    const activeTabElement = list
      ? Array.from(list.children).find((element) => element.dataset?.tabKey === activeTabKey)
      : undefined
    if (!list || !activeTabElement) return

    const left = activeTabElement.offsetLeft
    const right = left + activeTabElement.offsetWidth
    const visibleLeft = list.scrollLeft
    const visibleRight = visibleLeft + list.clientWidth

    if (left < visibleLeft || right > visibleRight) {
      list.scrollTo({
        left: Math.max(0, left - 12),
        behavior: 'smooth',
      })
    }
  }, [activeTabKey, tabs.length])

  const activeTab = tabs.find((tab) => tab.key === activeTabKey) || tabs[0]
  const contextMenuTab = tabContextMenu
    ? tabs.find((tab) => tab.key === tabContextMenu.tabKey)
    : undefined
  const activeView = activeTab?.viewId || 'home'
  const liveChatUnreadCount = useMemo(
    () => liveChatConversations.reduce((total, conversation) => total + (Number(conversation.unread) || 0), 0),
    [liveChatConversations],
  )
  const activeModule = serviceDeskModules[activeView]
  const activeModuleType = activeModule?.type
  const activeHasUnsavedChanges =
    activeView === 'newrecord' && isTicketDraftDirty(ticketDraft, activeTab?.newRecordType)

  useEffect(() => {
    if (!activeHasUnsavedChanges) return undefined

    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [activeHasUnsavedChanges])

  useEffect(() => {
    if (activeView !== 'livechat' || !selectedLiveChatId) return
    setLiveChatConversations((current) => {
      let changed = false
      const next = current.map((conversation) => {
        if (conversation.id !== selectedLiveChatId || !conversation.unread) return conversation
        changed = true
        return { ...conversation, unread: 0 }
      })
      return changed ? next : current
    })
  }, [activeView, liveChatConversations, selectedLiveChatId])

  useEffect(() => {
    if (!(activeView === 'tickets' || serviceDeskModules[activeView])) return

    setTabs((currentTabs) =>
      currentTabs.map((tab) => {
        if (tab.key !== activeTabKey) return tab

        const currentFilter = tab.filter || {}
        const filterUnchanged =
          currentFilter.status === filters.status &&
          currentFilter.priority === filters.priority &&
          currentFilter.type === filters.type
        const queryUnchanged = (tab.query || '') === query

        if (filterUnchanged && queryUnchanged) return tab
        return { ...tab, filter: { ...filters }, query }
      }),
    )
  }, [activeTabKey, activeView, filters, query])

  const selectedTicket =
    tickets.find((ticket) => ticket.id === (activeTab?.recordId || selectedTicketId)) ||
    (activeModuleType ? tickets.find((ticket) => ticket.type === activeModuleType) : undefined) ||
    tickets[0]
  const selectedAsset = activeTab?.assetId
    ? assets.find((asset) => asset.id === activeTab.assetId)
    : undefined
  const selectedArticle = activeTab?.articleSlug
    ? knowledgeArticles.find((article) => article.slug === activeTab.articleSlug)
    : undefined
  const selectedProject = activeTab?.projectId
    ? projects.find((project) => project.id === activeTab.projectId)
    : undefined
  const selectedPortalRequest = activeTab?.portalRequestId
    ? tickets.find((ticket) => (
        ticket.id === activeTab.portalRequestId
        && (session?.role !== 'requester' || ticket.requester === session.name || (ticket.requesterEmail && ticket.requesterEmail === session.username))
      ))
    : undefined
  const canViewSettings = sessionHasPermission(session, 'settings.view')
  const visibleNavIds = analystNavIds.filter((id) => id !== 'settings' || canViewSettings)
  const navItems = visibleNavIds.map((id) => viewMeta[id])
  const navGroups = analystNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((id) => id !== 'settings' || canViewSettings).map((id) => viewMeta[id]),
    }))
    .filter((group) => group.items.length)
  const activeNavId =
    activeView === 'tickets' && activeTab?.recordId
      ? {
          Incident: 'incidents',
          'Service Request': 'requests',
          Problem: 'problems',
          Change: 'changes',
        }[selectedTicket?.type]
      : activeView === 'newrecord'
        ? activeTab?.navId || {
            Incident: 'incidents',
            'Service Request': 'requests',
            Problem: 'problems',
            Change: 'changes',
          }[activeTab?.newRecordType]

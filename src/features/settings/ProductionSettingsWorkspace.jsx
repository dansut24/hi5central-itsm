import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  BookOpen,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CreditCard,
  FileKey2,
  Gauge,
  GitBranch,
  Globe2,
  Link2,
  ListChecks,
  Mail,
  MonitorCog,
  Palette,
  Save,
  Server,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react'
import { ProductionTenantSecurityAudit } from './ProductionTenantSecurityAudit.jsx'
import './ProductionSettingsWorkspace.css'

const API_BASE = window.__HI5_API_BASE__
const TENANT_RUNTIME_CONFIG_KEY = 'hi5central-tenant-runtime-config-v1'
const SETTINGS_NAV_VISIBLE_KEY = 'hi5central-settings-nav-visible-v1'

const accentColours = {
  amber: '#f59e0b',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  emerald: '#10b981',
  violet: '#8b5cf6',
  rose: '#f43f5e',
}

const defaultNotificationSettings = {
  channels: { inApp: true, email: true, browser: false },
  categories: {
    incidents: true, serviceRequests: true, problems: true, changes: true,
    assignments: true, approvals: true, tasks: true, customerUpdates: true,
    liveChat: true, projects: true, calendar: true, rota: true,
    rmm: true, security: true, platform: true,
  },
  requesterEvents: {
    customerUpdates: true, statusChanges: true, recordCreated: true,
    approvals: true, taskUpdates: false, systemUpdates: false,
  },
}

const defaultPrefixes = {
  incident: 'INC-',
  serviceRequest: 'REQ-',
  problem: 'PRB-',
  change: 'CHG-',
}

const sections = {
  organisation: { path: '/settings/organisation', group: 'General', label: 'Organisation', icon: Building2, area: 'company' },
  appearance: { path: '/settings/appearance', group: 'General', label: 'Appearance & branding', icon: Palette, area: 'theme' },
  directory: { path: '/settings/people-directory', group: 'General', label: 'People & directory', icon: Users, area: 'users' },
  teams: { path: '/settings/teams-departments', group: 'General', label: 'Teams & departments', icon: GitBranch, area: 'groups' },
  roles: { path: '/settings/roles-permissions', group: 'General', label: 'Roles & permissions', icon: FileKey2, area: 'permissions' },
  security: { path: '/settings/security-mfa', group: 'General', label: 'Security policy', icon: ShieldCheck, area: 'security' },

  'itsm-dashboard': { path: '/settings/itsm/dashboard', group: 'ITSM', label: 'Dashboard', icon: Gauge, area: 'itsm' },
  'itsm-records': { path: '/settings/itsm/records', group: 'ITSM', label: 'Records & queues', icon: ListChecks, area: 'itsm' },
  'itsm-incidents': { path: '/settings/itsm/incidents', group: 'ITSM', label: 'Incidents', icon: Wrench, area: 'itsm' },
  'itsm-requests': { path: '/settings/itsm/service-requests', group: 'ITSM', label: 'Service requests', icon: ListChecks, area: 'itsm' },
  'itsm-problems': { path: '/settings/itsm/problems', group: 'ITSM', label: 'Problems', icon: ShieldCheck, area: 'itsm' },
  'itsm-changes': { path: '/settings/itsm/changes', group: 'ITSM', label: 'Changes', icon: GitBranch, area: 'itsm' },
  'itsm-tasks': { path: '/settings/itsm/tasks', group: 'ITSM', label: 'Tasks', icon: Check, area: 'itsm' },
  'itsm-catalogue': { path: '/settings/itsm/service-catalogue', group: 'ITSM', label: 'Service catalogue', icon: BookOpen, area: 'itsm' },
  'itsm-projects': { path: '/settings/itsm/projects', group: 'ITSM', label: 'Projects', icon: GitBranch, area: 'itsm' },
  'itsm-calendar': { path: '/settings/itsm/calendar-rota', group: 'ITSM', label: 'Calendar & rota', icon: Globe2, area: 'itsm' },
  'itsm-live-chat': { path: '/settings/itsm/live-chat', group: 'ITSM', label: 'Live Chat', icon: Mail, area: 'itsm' },
  'itsm-cmdb': { path: '/settings/itsm/cmdb', group: 'ITSM', label: 'CMDB & assets', icon: Server, area: 'itsm' },
  'itsm-knowledge': { path: '/settings/itsm/knowledge', group: 'ITSM', label: 'Knowledge', icon: BookOpen, area: 'itsm' },
  'itsm-reports': { path: '/settings/itsm/reports-search', group: 'ITSM', label: 'Reports & search', icon: Gauge, area: 'itsm' },
  'itsm-attachments': { path: '/settings/itsm/attachments', group: 'ITSM', label: 'Attachments', icon: FileKey2, area: 'itsm' },
  'itsm-numbering': { path: '/settings/itsm/record-numbering', group: 'ITSM', label: 'Record numbering', icon: ListChecks, area: 'itsm' },
  'itsm-slas': { path: '/settings/itsm/slas', group: 'ITSM', label: 'SLAs', icon: Gauge, area: 'itsm' },
  'itsm-service-desk': { path: '/settings/itsm/service-desk', group: 'ITSM', label: 'Service desk', icon: Wrench, area: 'itsm' },
  'itsm-portal': { path: '/settings/itsm/portal', group: 'ITSM', label: 'Portal', icon: Globe2, area: 'itsm' },
  'itsm-notifications': { path: '/settings/itsm/notifications', group: 'ITSM', label: 'Notifications', icon: Bell, area: 'notificationSettings' },

  'rmm-sites': { path: '/settings/rmm/sites', group: 'RMM', label: 'Sites', icon: Globe2, area: 'rmm' },
  'rmm-agent': { path: '/settings/rmm/agent-defaults', group: 'RMM', label: 'Agent defaults', icon: Server, area: 'rmm' },
  'rmm-monitoring': { path: '/settings/rmm/monitoring', group: 'RMM', label: 'Monitoring', icon: Gauge, area: 'rmm' },
  'rmm-patching': { path: '/settings/rmm/patching', group: 'RMM', label: 'Patching', icon: ListChecks, area: 'rmm' },
  'rmm-remote': { path: '/settings/rmm/remote-access', group: 'RMM', label: 'Remote access', icon: MonitorCog, area: 'rmm' },

  integrations: { path: '/settings/integrations', group: 'Platform', label: 'Integrations', icon: Link2, area: 'integrations' },
  subscription: { path: '/settings/subscription', group: 'Platform', label: 'Subscription', icon: CreditCard, area: 'billing' },
}

function effectiveSettings(session) {
  return session?.settings && Object.keys(session.settings).length
    ? session.settings
    : session?.onboarding?.data || {}
}

function defaults(session) {
  const companyName = session?.tenant?.companyName || ''
  return {
    company: {
      displayName: companyName,
      legalName: companyName,
      country: 'United Kingdom',
      industry: 'Technology',
      employeeBand: '51-250',
      timezone: 'Europe/London',
      locale: 'en-GB',
    },
    theme: { mode: 'system', accent: 'amber', brandName: companyName, portalTitle: 'IT Help Centre' },
    users: {
      source: 'microsoft365', syncUsers: true, syncGroups: true,
      microsoft365: { status: 'not_connected', tenantName: '', directoryUsers: 0, directoryGroups: 0 },
    },
    groups: { serviceDeskTeam: 'Service Desk', firstDepartment: 'IT', firstSite: 'Head Office', assignmentModel: 'team-first' },
    permissions: { preset: 'balanced', requesterAccess: 'portal', changeApprovalRole: 'admin-change' },
    security: { requireMfa: true, sessionHours: '12', passwordPolicy: 'strong', auditRetention: '365' },
    itsm: {
      numberingMode: 'default', recordPrefixes: { ...defaultPrefixes }, recordDigits: '5',
      supportEmail: 'support', defaultTeam: 'Service Desk', businessHours: 'uk-business', defaultPriority: 'Medium',
      slaTargets: {
        Critical: { responseMinutes: '15', resolutionMinutes: '240' },
        High: { responseMinutes: '30', resolutionMinutes: '480' },
        Medium: { responseMinutes: '240', resolutionMinutes: '1440' },
        Low: { responseMinutes: '480', resolutionMinutes: '2880' },
      },
      serviceRequestSlaTargets: {
        Critical: { responseMinutes: '30', resolutionMinutes: '480' },
        High: { responseMinutes: '60', resolutionMinutes: '960' },
        Medium: { responseMinutes: '240', resolutionMinutes: '2880' },
        Low: { responseMinutes: '480', resolutionMinutes: '5760' },
      },
      projectSlaTargets: {
        Critical: { targetDays: '14' },
        High: { targetDays: '30' },
        Medium: { targetDays: '60' },
        Low: { targetDays: '90' },
      },
      managerApprovalThreshold: '500',
      portalName: 'IT Help Centre', portalKnowledge: true, requesterComments: true, liveChat: true, aiAssistant: false,
      cabName: 'Change Advisory Board', standardChangeAutoApprove: true,
      requesterNotifications: true, slaWarnings: true, knowledgeFeedback: true,
      dashboard: { defaultRange: 'today', showServiceHealth: true, showRecentActivity: true, showApprovals: true, showProjects: true },
      queues: { defaultView: 'table', pageSize: '25', rememberFilters: true, allowSavedViews: true, showSla: true, openInTabs: true },
      incidents: { defaultStatus: 'New', defaultPriority: 'Medium', requireResolutionCode: true, reopenDays: '7', autoAssignDefaultTeam: true },
      serviceRequests: { defaultStatus: 'New', requesterCanCancel: true, pauseSlaForApproval: true, autoCloseDays: '3', requireCompletionNote: true },
      problems: { defaultStatus: 'New', requireRootCause: true, requireKnownErrorReview: true, allowIncidentLinking: true },
      changes: { defaultType: 'Normal', requireImplementationPlan: true, requireTestPlan: true, requireBackoutPlan: true, enforceApproval: true },
      tasks: { defaultStatus: 'Open', inheritParentTeam: true, requireAssigneeToStart: true, requireCompletionNote: false, showOnCalendar: true },
      catalogue: { enabled: true, requireOwner: true, showPrices: true, allowOneOffRequests: true, requireApprovalForCost: true },
      projects: { enabled: true, requireOwner: true, syncCalendar: true, showTaskDueDates: true, showMilestones: true, defaultHealth: 'On track' },
      calendar: { weekStart: 'monday', workingDayStart: '09:00', workingDayEnd: '17:30', showChanges: true, showProjects: true, showTasks: true, showRota: true },
      liveChatConfig: { enabled: true, autoClaimOnReply: true, allowTransfer: true, createIncidentFromChat: true, inactivityMinutes: '30' },
      cmdb: { enabled: true, linkRecords: true, showRmmDevices: true, requireOwnerForManualCi: false, allowManualCi: true },
      knowledge: { internalEnabled: true, portalEnabled: true, feedbackEnabled: true, requireReview: true, reviewDays: '180' },
      reports: { enabled: true, allowExport: true, allowSavedViews: true, defaultRangeDays: '30', includeClosed: true },
      attachments: { maxMb: '5', requesterUploads: true, internalAttachments: true },
    },
    rmm: {
      defaultSite: 'Main site', agentChannel: 'stable', monitoringPolicy: 'Standard endpoint monitoring',
      patchRing: 'Standard Windows endpoints', maintenanceWindow: 'Wednesday 22:00-02:00',
      unattendedAccess: true, requireRemoteApproval: false,
    },
    integrations: {
      microsoftTeams: { status: 'not_connected' },
      slack: { status: 'not_connected' },
      jira: { status: 'not_connected' },
      webhooks: { enabled: false, endpointCount: 0 },
      apiAccess: { enabled: true, tokenCount: 0 },
    },
    billing: { plan: 'trial', billingLater: true, expectedTechnicians: '5', expectedDevices: '100', billingContact: session?.user?.email || '' },
  }
}

function mergeSlaTargets(base = {}, stored = {}) {
  return Object.fromEntries(['Critical', 'High', 'Medium', 'Low'].map((priority) => [priority, {
    ...(base?.[priority] || {}),
    ...(stored?.[priority] || {}),
  }]))
}

function mergeConfig(base, stored) {
  const next = { ...base }
  for (const [key, value] of Object.entries(stored || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      next[key] = { ...(base[key] || {}), ...value }
      if (key === 'itsm') {
        next[key].recordPrefixes = { ...defaultPrefixes, ...(value.recordPrefixes || {}) }
        next[key].slaTargets = mergeSlaTargets(base[key]?.slaTargets, value.slaTargets)
        next[key].serviceRequestSlaTargets = mergeSlaTargets(base[key]?.serviceRequestSlaTargets, value.serviceRequestSlaTargets)
        next[key].projectSlaTargets = mergeSlaTargets(base[key]?.projectSlaTargets, value.projectSlaTargets)
        for (const nestedKey of ['dashboard','queues','incidents','serviceRequests','problems','changes','tasks','catalogue','projects','calendar','liveChatConfig','cmdb','knowledge','reports','attachments']) {
          next[key][nestedKey] = { ...(base[key]?.[nestedKey] || {}), ...(value[nestedKey] || {}) }
        }
      }
    } else {
      next[key] = value
    }
  }
  return next
}

function sectionFromPath(pathname) {
  const found = Object.entries(sections).find(([, meta]) => meta.path === pathname)
  if (found) return found[0]
  if (pathname === '/settings' || pathname === '/settings/workspace' || pathname === '/settings/profile') return 'organisation'
  return 'organisation'
}

function Field({ label, hint, children, full = false }) {
  return (
    <label className={`production-settings-field ${full ? 'is-full' : ''}`}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  )
}

function Toggle({ checked, onChange, title, description }) {
  return (
    <button className={`production-settings-toggle ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)} type="button">
      <span><strong>{title}</strong><small>{description}</small></span>
      <span className="production-settings-switch" aria-hidden="true"><span /></span>
    </button>
  )
}

function Panel({ title, description, children }) {
  return (
    <section className="production-settings-panel">
      <header><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div></header>
      <div className="production-settings-panel-body">{children}</div>
    </section>
  )
}

function IntegrationCard({ name, description, status, icon: Icon = Link2 }) {
  const connected = status === 'connected'
  return (
    <div className="production-integration-card">
      <span className="production-integration-icon"><Icon size={20} /></span>
      <div><strong>{name}</strong><p>{description}</p><small>{connected ? 'Connected' : 'Not connected'}</small></div>
      <button disabled type="button">{connected ? 'Managed by connector' : 'Configure connector'}</button>
    </div>
  )
}

function normalisePrefix(value, fallback) {
  const cleaned = String(value || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 9)
  if (!cleaned) return fallback
  return cleaned.endsWith('-') ? cleaned : `${cleaned}-`
}

function writeRuntimeConfig(session, config) {
  const itsm = config.itsm || {}
  const theme = config.theme || {}
  try {
    window.localStorage.setItem(TENANT_RUNTIME_CONFIG_KEY, JSON.stringify({
      tenantSlug: session?.tenant?.slug || '',
      theme: { mode: theme.mode || 'system', accent: theme.accent || 'amber', brandName: theme.brandName || '', portalTitle: theme.portalTitle || 'IT Help Centre' },
      recordNumbering: {
        mode: itsm.numberingMode || 'default',
        prefixes: itsm.recordPrefixes || defaultPrefixes,
        digits: itsm.recordDigits || '5',
      },
      microsoft365: config.users?.microsoft365 || {},
      itsm,
      rmm: config.rmm || {},
    }))
  } catch {
    // Runtime cache bridges persisted tenant settings into the workspace shell.
  }
}

function loadSettingsNavVisible() {
  try {
    const stored = window.localStorage.getItem(SETTINGS_NAV_VISIBLE_KEY)
    return stored === null ? true : JSON.parse(stored) !== false
  } catch {
    return true
  }
}

function SettingsNavigation({ activeId, modules, onNavigate, inline = false }) {
  const navGroups = ['General', 'ITSM', 'RMM', 'Platform']
  return (
    <nav className={inline ? 'production-settings-inline-nav' : 'production-settings-nav'} aria-label="Settings navigation">
      {navGroups.map((group) => {
        const items = Object.entries(sections).filter(([, meta]) => (
          meta.group === group
          && (group !== 'ITSM' || modules.itsm)
          && (group !== 'RMM' || modules.rmm)
        ))
        if (!items.length) return null
        return (
          <section key={group}>
            <span>{group}</span>
            {items.map(([id, meta]) => {
              const Icon = meta.icon
              return (
                <button
                  aria-current={id === activeId ? 'page' : undefined}
                  className={id === activeId ? 'is-active' : ''}
                  key={id}
                  onClick={() => onNavigate(meta)}
                  type="button"
                >
                  <Icon size={16} />
                  <span>{meta.label}</span>
                  {!inline ? <ChevronRight size={14} /> : null}
                </button>
              )
            })}
          </section>
        )
      })}
    </nav>
  )
}

export function ProductionSettingsWorkspace({ currentPath, session, onSessionChange }) {
  const initialConfig = useMemo(() => mergeConfig(defaults(session), effectiveSettings(session)), [session])
  const [config, setConfig] = useState(initialConfig)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')
  const [notificationSettings, setNotificationSettings] = useState(defaultNotificationSettings)
  const [notificationSettingsLoaded, setNotificationSettingsLoaded] = useState(false)
  const [settingsNavVisible, setSettingsNavVisible] = useState(loadSettingsNavVisible)
  const activeId = sectionFromPath(currentPath)
  const active = sections[activeId]
  const modules = session?.tenant?.modules || {}
  const accent = config.theme?.accent || 'amber'

  useEffect(() => {
    setConfig(mergeConfig(defaults(session), effectiveSettings(session)))
  }, [session])

  useEffect(() => {
    let active = true
    fetch(`${API_BASE}/api/v1/notification-settings`, { credentials: 'include' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Could not load tenant notification settings.')
        if (active) {
          setNotificationSettings(payload.settings || defaultNotificationSettings)
          setNotificationSettingsLoaded(true)
        }
      })
      .catch((loadError) => {
        if (active && activeId === 'itsm-notifications') setError(loadError.message)
      })
    return () => { active = false }
  }, [session?.tenant?.id])

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_NAV_VISIBLE_KEY, JSON.stringify(settingsNavVisible))
    } catch {
      // Per-browser Settings navigation preference only.
    }
  }, [settingsNavVisible])

  function navigate(meta) {
    window.history.pushState({}, '', meta.path)
    window.dispatchEvent(new Event('hi5-routechange'))
  }

  function updateArea(area, field, value) {
    setConfig((current) => ({ ...current, [area]: { ...(current[area] || {}), [field]: value } }))
    setSaved('')
    setError('')
  }

  function updateNotification(group, field, value) {
    setNotificationSettings((current) => ({
      ...current,
      [group]: { ...(current[group] || {}), [field]: value },
    }))
    setSaved('')
    setError('')
  }

  function updateNested(area, parent, field, value) {
    setConfig((current) => ({
      ...current,
      [area]: {
        ...(current[area] || {}),
        [parent]: { ...(current[area]?.[parent] || {}), [field]: value },
      },
    }))
    setSaved('')
    setError('')
  }

  async function saveActive() {
    const area = active.area

    if (area === 'notificationSettings') {
      setSaving(true)
      setSaved('')
      setError('')
      try {
        const response = await fetch(`${API_BASE}/api/v1/notification-settings`, {
          method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: notificationSettings }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Could not save notification settings.')
        setNotificationSettings(payload.settings || notificationSettings)
        setNotificationSettingsLoaded(true)
        setSaved('Saved to tenant')
      } catch (saveError) {
        setError(saveError.message)
      } finally {
        setSaving(false)
      }
      return
    }

    let data = config[area] || {}

    if (area === 'itsm') {
      const prefixes = data.numberingMode === 'custom'
        ? Object.fromEntries(Object.entries(defaultPrefixes).map(([key, fallback]) => [key, normalisePrefix(data.recordPrefixes?.[key], fallback)]))
        : { ...defaultPrefixes }
      data = { ...data, recordPrefixes: prefixes }
      setConfig((current) => ({ ...current, itsm: data }))
    }

    setSaving(true)
    setSaved('')
    setError('')
    try {
      const response = await fetch(`${API_BASE}/api/v1/settings/${area}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not save these settings.')
      const nextConfig = mergeConfig(defaults(payload), payload.settings || payload.onboarding?.data || {})
      setConfig(nextConfig)
      writeRuntimeConfig(payload, nextConfig)
      if (['system', 'light', 'dark'].includes(nextConfig.theme?.mode)) {
        window.localStorage.setItem('hi5central-theme-mode', JSON.stringify(nextConfig.theme.mode))
      }
      if (accentColours[nextConfig.theme?.accent]) {
        window.localStorage.setItem('hi5central-accent', JSON.stringify(nextConfig.theme.accent))
      }
      onSessionChange?.(payload)
      setSaved('Saved to tenant')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={`production-settings-shell ${settingsNavVisible ? '' : 'settings-nav-hidden'}`}
      style={{ '--settings-accent': accentColours[accent] || accentColours.amber }}
    >
      <aside className="production-settings-sidebar">
        <div className="production-settings-sidebar-heading">
          <div>
            <span>Administration</span>
            <strong>Settings</strong>
          </div>
          <button
            aria-label="Hide Settings navigation"
            onClick={() => setSettingsNavVisible(false)}
            title="Hide Settings navigation"
            type="button"
          >
            <ChevronLeft size={18} />
          </button>
        </div>
        <SettingsNavigation activeId={activeId} modules={modules} onNavigate={navigate} />
      </aside>

      <main className="production-settings-main">
        <header className="production-settings-topbar">
          <div className="production-settings-title-row">
            <button
              className="production-settings-nav-reveal"
              onClick={() => setSettingsNavVisible(true)}
              title="Show Settings navigation"
              type="button"
            >
              <ChevronRight size={17} />
              <span>Settings</span>
            </button>
            <div><span>Tenant settings</span><h1>{active.label}</h1></div>
          </div>
          <div className="production-settings-save-state">
            {saved ? <span className="is-saved"><Check size={14} /> {saved}</span> : null}
            {error ? <span className="is-error">{error}</span> : null}
            <button disabled={saving} onClick={saveActive} type="button"><Save size={16} /> {saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </header>

        <SettingsNavigation activeId={activeId} inline modules={modules} onNavigate={navigate} />

        <div className="production-settings-scroll-region">
          <div className="production-settings-content">
            {activeId === 'organisation' ? <Organisation config={config.company} update={(f, v) => updateArea('company', f, v)} /> : null}
            {activeId === 'appearance' ? <Appearance config={config.theme} update={(f, v) => updateArea('theme', f, v)} /> : null}
            {activeId === 'directory' ? <Directory config={config.users} update={(f, v) => updateArea('users', f, v)} updateNested={(p, f, v) => updateNested('users', p, f, v)} /> : null}
            {activeId === 'teams' ? <TeamsDepartments config={config.groups} update={(f, v) => updateArea('groups', f, v)} /> : null}
            {activeId === 'roles' ? <RolesPermissions config={config.permissions} update={(f, v) => updateArea('permissions', f, v)} /> : null}
            {activeId === 'security' ? <Security config={config.security} update={(f, v) => updateArea('security', f, v)} /> : null}

            {activeId === 'itsm-dashboard' ? <ItsmDashboard config={config.itsm} update={(f, v) => updateNested('itsm', 'dashboard', f, v)} /> : null}
            {activeId === 'itsm-records' ? <ItsmRecords config={config.itsm} update={(f, v) => updateNested('itsm', 'queues', f, v)} /> : null}
            {activeId === 'itsm-incidents' ? <ItsmIncidents config={config.itsm} update={(f, v) => updateNested('itsm', 'incidents', f, v)} /> : null}
            {activeId === 'itsm-requests' ? <ItsmRequests config={config.itsm} update={(f, v) => updateNested('itsm', 'serviceRequests', f, v)} /> : null}
            {activeId === 'itsm-problems' ? <ItsmProblems config={config.itsm} update={(f, v) => updateNested('itsm', 'problems', f, v)} /> : null}
            {activeId === 'itsm-tasks' ? <ItsmTasks config={config.itsm} update={(f, v) => updateNested('itsm', 'tasks', f, v)} /> : null}
            {activeId === 'itsm-catalogue' ? <ItsmCatalogue config={config.itsm} update={(f, v) => updateNested('itsm', 'catalogue', f, v)} /> : null}
            {activeId === 'itsm-projects' ? <ItsmProjects config={config.itsm} update={(f, v) => updateNested('itsm', 'projects', f, v)} /> : null}
            {activeId === 'itsm-calendar' ? <ItsmCalendar config={config.itsm} update={(f, v) => updateNested('itsm', 'calendar', f, v)} /> : null}
            {activeId === 'itsm-live-chat' ? <ItsmLiveChat config={config.itsm} update={(f, v) => updateNested('itsm', 'liveChatConfig', f, v)} updateRoot={(f, v) => updateArea('itsm', f, v)} /> : null}
            {activeId === 'itsm-cmdb' ? <ItsmCmdb config={config.itsm} update={(f, v) => updateNested('itsm', 'cmdb', f, v)} /> : null}
            {activeId === 'itsm-reports' ? <ItsmReports config={config.itsm} update={(f, v) => updateNested('itsm', 'reports', f, v)} /> : null}
            {activeId === 'itsm-attachments' ? <ItsmAttachments config={config.itsm} update={(f, v) => updateNested('itsm', 'attachments', f, v)} /> : null}
            {activeId === 'itsm-numbering' ? <ItsmNumbering config={config.itsm} update={(f, v) => updateArea('itsm', f, v)} updateNested={(p, f, v) => updateNested('itsm', p, f, v)} /> : null}
            {activeId === 'itsm-slas' ? <ItsmSlas config={config.itsm} update={(f, v) => updateArea('itsm', f, v)} /> : null}
            {activeId === 'itsm-service-desk' ? <ItsmServiceDesk config={config.itsm} update={(f, v) => updateArea('itsm', f, v)} tenant={session?.tenant} /> : null}
            {activeId === 'itsm-portal' ? <ItsmPortal config={config.itsm} update={(f, v) => updateArea('itsm', f, v)} /> : null}
            {activeId === 'itsm-knowledge' ? <ItsmKnowledge config={config.itsm} update={(f, v) => updateNested('itsm', 'knowledge', f, v)} updateRoot={(f, v) => updateArea('itsm', f, v)} /> : null}
            {activeId === 'itsm-changes' ? <ItsmChanges config={config.itsm} update={(f, v) => updateNested('itsm', 'changes', f, v)} updateRoot={(f, v) => updateArea('itsm', f, v)} /> : null}
            {activeId === 'itsm-notifications' ? <ItsmNotifications config={notificationSettings} loaded={notificationSettingsLoaded} update={updateNotification} /> : null}

            {activeId === 'rmm-sites' ? <RmmSites config={config.rmm} update={(f, v) => updateArea('rmm', f, v)} /> : null}
            {activeId === 'rmm-agent' ? <RmmAgent config={config.rmm} update={(f, v) => updateArea('rmm', f, v)} /> : null}
            {activeId === 'rmm-monitoring' ? <RmmMonitoring config={config.rmm} update={(f, v) => updateArea('rmm', f, v)} /> : null}
            {activeId === 'rmm-patching' ? <RmmPatching config={config.rmm} update={(f, v) => updateArea('rmm', f, v)} /> : null}
            {activeId === 'rmm-remote' ? <RmmRemote config={config.rmm} update={(f, v) => updateArea('rmm', f, v)} /> : null}

            {activeId === 'integrations' ? <Integrations config={config.integrations} update={(f, v) => updateArea('integrations', f, v)} /> : null}
            {activeId === 'subscription' ? <Subscription config={config.billing} update={(f, v) => updateArea('billing', f, v)} modules={modules} /> : null}
          </div>
        </div>
      </main>
    </div>
  )
}

function Organisation({ config, update }) {
  return <Panel title="Organisation" description="Core tenant identity and regional defaults inherited from onboarding."><div className="production-settings-grid"><Field label="Display name"><input value={config.displayName || ''} onChange={(e) => update('displayName', e.target.value)} /></Field><Field label="Legal / registered name"><input value={config.legalName || ''} onChange={(e) => update('legalName', e.target.value)} /></Field><Field label="Country"><input value={config.country || ''} onChange={(e) => update('country', e.target.value)} /></Field><Field label="Industry"><select value={config.industry || 'Technology'} onChange={(e) => update('industry', e.target.value)}><option>Technology</option><option>Professional services</option><option>Education</option><option>Healthcare</option><option>Retail</option><option>Manufacturing</option><option>Other</option></select></Field><Field label="Organisation size"><select value={config.employeeBand || '51-250'} onChange={(e) => update('employeeBand', e.target.value)}><option value="1-50">1-50</option><option value="51-250">51-250</option><option value="251-1000">251-1,000</option><option value="1001+">1,001+</option></select></Field><Field label="Time zone"><select value={config.timezone || 'Europe/London'} onChange={(e) => update('timezone', e.target.value)}><option>Europe/London</option><option>Europe/Dublin</option><option>UTC</option><option>America/New_York</option></select></Field><Field label="Locale"><select value={config.locale || 'en-GB'} onChange={(e) => update('locale', e.target.value)}><option value="en-GB">English (UK)</option><option value="en-US">English (US)</option></select></Field></div></Panel>
}

function Appearance({ config, update }) {
  return <><Panel title="Appearance" description="Tenant defaults. Individual user preferences can override these later."><div className="production-settings-grid"><Field label="Default appearance"><select value={config.mode || 'system'} onChange={(e) => update('mode', e.target.value)}><option value="system">Use device setting</option><option value="light">Light</option><option value="dark">Dark</option></select></Field><Field label="Accent colour"><select value={config.accent || 'amber'} onChange={(e) => update('accent', e.target.value)}>{Object.keys(accentColours).map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></Field><Field label="Workspace brand name"><input value={config.brandName || ''} onChange={(e) => update('brandName', e.target.value)} /></Field><Field label="Portal title"><input value={config.portalTitle || ''} onChange={(e) => update('portalTitle', e.target.value)} /></Field></div></Panel><Panel title="Brand preview"><div className="production-brand-preview"><span className="production-brand-dot" /><div><strong>{config.brandName || 'Hi5Central'}</strong><small>{config.portalTitle || 'IT Help Centre'}</small></div></div></Panel></>
}

function Directory({ config, update }) {
  const connected = config.microsoft365?.status === 'connected'
  return <><Panel title="People & directory" description="Choose the source of truth for people, groups and profile fields."><div className="production-settings-grid"><Field label="Directory source"><select value={config.source || 'microsoft365'} onChange={(e) => update('source', e.target.value)}><option value="microsoft365">Microsoft 365 / Entra ID</option><option value="manual">Hi5Central managed</option><option value="hr">HR integration</option></select></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(config.syncUsers)} onChange={(v) => update('syncUsers', v)} title="Synchronise users" description="Import and update directory people after a connector is established." /><Toggle checked={Boolean(config.syncGroups)} onChange={(v) => update('syncGroups', v)} title="Synchronise groups" description="Use Microsoft groups as governed sources after a connector is established." /></div></Panel><Panel title="Microsoft 365" description="Connection state is reported by the production OAuth and Microsoft Graph connector."><div className="production-365-card"><span><Cloud size={22} /></span><div><strong>{connected ? config.microsoft365.tenantName || 'Microsoft 365' : 'Microsoft 365 not connected'}</strong><p>{connected ? `${config.microsoft365.directoryUsers || 0} users · ${config.microsoft365.directoryGroups || 0} groups discovered` : 'Configure the Microsoft 365 connector in Integrations. No directory connection is created from this screen.'}</p></div><button disabled type="button">{connected ? 'Managed by connector' : 'Configure in Integrations'}</button></div></Panel></>
}

function TeamsDepartments({ config, update }) { return <Panel title="Teams & departments" description="Initial organisation structure and assignment defaults."><div className="production-settings-grid"><Field label="Primary support team"><input value={config.serviceDeskTeam || ''} onChange={(e) => update('serviceDeskTeam', e.target.value)} /></Field><Field label="Primary department"><input value={config.firstDepartment || ''} onChange={(e) => update('firstDepartment', e.target.value)} /></Field><Field label="Primary site"><input value={config.firstSite || ''} onChange={(e) => update('firstSite', e.target.value)} /></Field><Field label="Assignment model"><select value={config.assignmentModel || 'team-first'} onChange={(e) => update('assignmentModel', e.target.value)}><option value="team-first">Team first</option><option value="individual-first">Individual first</option><option value="round-robin">Round robin</option></select></Field></div></Panel> }

function RolesPermissions({ config, update }) { return <><Panel title="Roles & permissions" description="Tenant-wide RBAC starting model."><div className="production-settings-grid"><Field label="Permission preset"><select value={config.preset || 'balanced'} onChange={(e) => update('preset', e.target.value)}><option value="balanced">Balanced</option><option value="restricted">Restricted</option><option value="open">Open collaboration</option></select></Field><Field label="Requester access"><select value={config.requesterAccess || 'portal'} onChange={(e) => update('requesterAccess', e.target.value)}><option value="portal">Portal only</option><option value="portal-approvals">Portal + approvals</option></select></Field><Field label="Change approval role"><select value={config.changeApprovalRole || 'admin-change'} onChange={(e) => update('changeApprovalRole', e.target.value)}><option value="admin-change">Admins + change managers</option><option value="change-only">Change managers only</option><option value="cab">CAB members</option></select></Field></div></Panel><Panel title="Role model"><div className="production-role-cards"><div><strong>Owner</strong><span>Tenant, subscription and security control</span></div><div><strong>Administrator</strong><span>Platform configuration without ownership transfer</span></div><div><strong>Analyst</strong><span>Operational ITSM work according to assigned permissions</span></div><div><strong>Requester</strong><span>Portal, own requests and assigned approvals</span></div></div></Panel></> }

function Security({ config, update }) {
  return <>
    <Panel title="Security policy" description="Tenant-wide authentication, session, password and audit controls. Personal account security is managed from Profile.">
      <div className="production-settings-toggle-list">
        <Toggle
          checked={Boolean(config.requireMfa)}
          onChange={(value) => update('requireMfa', value)}
          title="Require administrator MFA"
          description="Require tenant owners and administrators to complete authenticator MFA. This policy is enforced by the production authentication service."
        />
      </div>
      <div className="production-settings-grid">
        <Field label="Session length"><select value={config.sessionHours || '12'} onChange={(event) => update('sessionHours', event.target.value)}><option value="8">8 hours</option><option value="12">12 hours</option><option value="24">24 hours</option></select></Field>
        <Field label="Password policy"><select value={config.passwordPolicy || 'strong'} onChange={(event) => update('passwordPolicy', event.target.value)}><option value="strong">Strong</option><option value="standard">Standard</option></select></Field>
        <Field label="Audit retention"><select value={config.auditRetention || '365'} onChange={(event) => update('auditRetention', event.target.value)}><option value="90">90 days</option><option value="365">365 days</option><option value="730">730 days</option></select></Field>
      </div>
    </Panel>
    <ProductionTenantSecurityAudit />
  </>
}


function ItsmDashboard({ config, update }) {
  const value = config.dashboard || {}
  return <><Panel title="Dashboard" description="Choose the tenant defaults used by the service-management overview. Individual dashboard customisation can still be layered on top."><div className="production-settings-grid"><Field label="Default time range"><select value={value.defaultRange || 'today'} onChange={(e) => update('defaultRange', e.target.value)}><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(value.showServiceHealth)} onChange={(v) => update('showServiceHealth', v)} title="Service health" description="Show workload/SLA health on the Dashboard." /><Toggle checked={Boolean(value.showRecentActivity)} onChange={(v) => update('showRecentActivity', v)} title="Recent activity" description="Show recent ITSM record activity." /><Toggle checked={Boolean(value.showApprovals)} onChange={(v) => update('showApprovals', v)} title="Approvals" description="Show approval workload and pending decisions." /><Toggle checked={Boolean(value.showProjects)} onChange={(v) => update('showProjects', v)} title="Project summary" description="Include project delivery information in the overview." /></div></Panel></>
}

function ItsmRecords({ config, update }) {
  const value = config.queues || {}
  return <><Panel title="Records & queues" description="Shared behaviour for All Records, Incidents, Requests, Problems and Changes."><div className="production-settings-grid"><Field label="Default view"><select value={value.defaultView || 'table'} onChange={(e) => update('defaultView', e.target.value)}><option value="table">Table</option><option value="compact">Compact list</option><option value="cards">Cards</option></select></Field><Field label="Rows per page"><select value={String(value.pageSize || '25')} onChange={(e) => update('pageSize', e.target.value)}><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(value.rememberFilters)} onChange={(v) => update('rememberFilters', v)} title="Remember queue filters" description="Restore the last filter/search state when a technician returns." /><Toggle checked={Boolean(value.allowSavedViews)} onChange={(v) => update('allowSavedViews', v)} title="Saved views" description="Allow technicians to create persisted queue views." /><Toggle checked={Boolean(value.showSla)} onChange={(v) => update('showSla', v)} title="Show SLA state" description="Display SLA health within record queues." /><Toggle checked={Boolean(value.openInTabs)} onChange={(v) => update('openInTabs', v)} title="Open records in workspace tabs" description="Keep record navigation inside the ITSM tab workspace." /></div></Panel></>
}

function ItsmIncidents({ config, update }) {
  const value = config.incidents || {}
  return <Panel title="Incidents" description="Defaults and lifecycle rules for Incident Management."><div className="production-settings-grid"><Field label="Default status"><select value={value.defaultStatus || 'New'} onChange={(e) => update('defaultStatus', e.target.value)}><option>New</option><option>Assigned</option><option>In Progress</option></select></Field><Field label="Default priority"><select value={value.defaultPriority || 'Medium'} onChange={(e) => update('defaultPriority', e.target.value)}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></Field><Field label="Reopen window"><div className="production-prefix-field"><input type="number" min="0" max="90" value={value.reopenDays || '7'} onChange={(e) => update('reopenDays', e.target.value)} /><span>days</span></div></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(value.requireResolutionCode)} onChange={(v) => update('requireResolutionCode', v)} title="Require resolution details" description="Require resolution information before an Incident can be resolved." /><Toggle checked={Boolean(value.autoAssignDefaultTeam)} onChange={(v) => update('autoAssignDefaultTeam', v)} title="Use default assignment team" description="Use the Service Desk default team when no routing rule supplies one." /></div></Panel>
}

function ItsmRequests({ config, update }) {
  const value = config.serviceRequests || {}
  return <Panel title="Service requests" description="Fulfilment, approval and requester behaviour for Service Requests."><div className="production-settings-grid"><Field label="Default status"><select value={value.defaultStatus || 'New'} onChange={(e) => update('defaultStatus', e.target.value)}><option>New</option><option>Assigned</option><option>In Progress</option></select></Field><Field label="Auto-close after completion"><div className="production-prefix-field"><input type="number" min="0" max="90" value={value.autoCloseDays || '3'} onChange={(e) => update('autoCloseDays', e.target.value)} /><span>days</span></div></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(value.requesterCanCancel)} onChange={(v) => update('requesterCanCancel', v)} title="Requester cancellation" description="Allow a requester to cancel an eligible request from the Portal." /><Toggle checked={Boolean(value.pauseSlaForApproval)} onChange={(v) => update('pauseSlaForApproval', v)} title="Pause SLA for approval" description="Pause fulfilment clocks while approval is genuinely pending." /><Toggle checked={Boolean(value.requireCompletionNote)} onChange={(v) => update('requireCompletionNote', v)} title="Completion note required" description="Require a completion note before fulfilment closes." /></div></Panel>
}

function ItsmProblems({ config, update }) {
  const value = config.problems || {}
  return <Panel title="Problems" description="Problem Management defaults and governance."><div className="production-settings-grid"><Field label="Default status"><select value={value.defaultStatus || 'New'} onChange={(e) => update('defaultStatus', e.target.value)}><option>New</option><option>Investigation</option><option>Known Error</option></select></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(value.requireRootCause)} onChange={(v) => update('requireRootCause', v)} title="Root cause required" description="Require root-cause information before a Problem can be resolved." /><Toggle checked={Boolean(value.requireKnownErrorReview)} onChange={(v) => update('requireKnownErrorReview', v)} title="Known Error review" description="Require the Known Error stage to be reviewed before closure." /><Toggle checked={Boolean(value.allowIncidentLinking)} onChange={(v) => update('allowIncidentLinking', v)} title="Related Incidents" description="Allow Incidents to be linked to Problem records." /></div></Panel>
}

function ItsmTasks({ config, update }) {
  const value = config.tasks || {}
  return <Panel title="Tasks" description="Task defaults shared by Incident, Request, Problem, Change and Project work."><div className="production-settings-grid"><Field label="Default status"><select value={value.defaultStatus || 'Open'} onChange={(e) => update('defaultStatus', e.target.value)}><option>Open</option><option>Assigned</option></select></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(value.inheritParentTeam)} onChange={(v) => update('inheritParentTeam', v)} title="Inherit parent team" description="Start new tasks with the parent record or project team." /><Toggle checked={Boolean(value.requireAssigneeToStart)} onChange={(v) => update('requireAssigneeToStart', v)} title="Assignee required to start" description="Prevent an unassigned task from moving to In Progress." /><Toggle checked={Boolean(value.requireCompletionNote)} onChange={(v) => update('requireCompletionNote', v)} title="Completion note required" description="Require evidence/notes before a task completes." /><Toggle checked={Boolean(value.showOnCalendar)} onChange={(v) => update('showOnCalendar', v)} title="Calendar projection" description="Project due tasks onto the shared calendar." /></div></Panel>
}

function ItsmCatalogue({ config, update }) {
  const value = config.catalogue || {}
  return <Panel title="Service catalogue" description="Tenant defaults for customer-facing catalogue items and one-off requests."><div className="production-settings-toggle-list"><Toggle checked={Boolean(value.enabled)} onChange={(v) => update('enabled', v)} title="Service catalogue enabled" description="Expose governed catalogue items to the Portal." /><Toggle checked={Boolean(value.requireOwner)} onChange={(v) => update('requireOwner', v)} title="Item owner required" description="Require an accountable owner for catalogue items." /><Toggle checked={Boolean(value.showPrices)} onChange={(v) => update('showPrices', v)} title="Show prices" description="Display one-off/monthly costs to requesters." /><Toggle checked={Boolean(value.allowOneOffRequests)} onChange={(v) => update('allowOneOffRequests', v)} title="One-off requests" description="Allow non-catalogue request capture." /><Toggle checked={Boolean(value.requireApprovalForCost)} onChange={(v) => update('requireApprovalForCost', v)} title="Cost approval" description="Use the Service Desk approval threshold for chargeable requests." /></div></Panel>
}

function ItsmProjects({ config, update }) {
  const value = config.projects || {}
  return <Panel title="Projects" description="Project-management defaults used across Projects, tasks and Calendar."><div className="production-settings-grid"><Field label="Default health"><select value={value.defaultHealth || 'On track'} onChange={(e) => update('defaultHealth', e.target.value)}><option>On track</option><option>At risk</option><option>Blocked</option></select></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(value.enabled)} onChange={(v) => update('enabled', v)} title="Projects enabled" description="Expose project management to authorised technicians." /><Toggle checked={Boolean(value.requireOwner)} onChange={(v) => update('requireOwner', v)} title="Project owner required" description="Require accountable ownership on active projects." /><Toggle checked={Boolean(value.syncCalendar)} onChange={(v) => update('syncCalendar', v)} title="Calendar integration" description="Project target dates and milestones appear on Calendar." /><Toggle checked={Boolean(value.showTaskDueDates)} onChange={(v) => update('showTaskDueDates', v)} title="Project task dates" description="Project task due dates appear on Calendar." /><Toggle checked={Boolean(value.showMilestones)} onChange={(v) => update('showMilestones', v)} title="Milestones" description="Enable milestone tracking and calendar projection." /></div></Panel>
}

function ItsmCalendar({ config, update }) {
  const value = config.calendar || {}
  return <Panel title="Calendar & rota" description="Shared scheduling defaults for service-management work and technician availability."><div className="production-settings-grid"><Field label="Week starts"><select value={value.weekStart || 'monday'} onChange={(e) => update('weekStart', e.target.value)}><option value="monday">Monday</option><option value="sunday">Sunday</option></select></Field><Field label="Working day starts"><input type="time" value={value.workingDayStart || '09:00'} onChange={(e) => update('workingDayStart', e.target.value)} /></Field><Field label="Working day ends"><input type="time" value={value.workingDayEnd || '17:30'} onChange={(e) => update('workingDayEnd', e.target.value)} /></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(value.showChanges)} onChange={(v) => update('showChanges', v)} title="Changes" description="Show planned Change windows." /><Toggle checked={Boolean(value.showProjects)} onChange={(v) => update('showProjects', v)} title="Projects" description="Show project targets and milestones." /><Toggle checked={Boolean(value.showTasks)} onChange={(v) => update('showTasks', v)} title="Tasks" description="Show dated record/project tasks." /><Toggle checked={Boolean(value.showRota)} onChange={(v) => update('showRota', v)} title="Rota" description="Overlay technician availability/rota information." /></div></Panel>
}

function ItsmLiveChat({ config, update, updateRoot }) {
  const value = config.liveChatConfig || {}
  const setEnabled = (next) => { update('enabled', next); updateRoot('liveChat', next) }
  return <Panel title="Live Chat" description="Conversation and conversion behaviour for attended customer support."><div className="production-settings-grid"><Field label="Inactivity timeout"><div className="production-prefix-field"><input type="number" min="5" max="240" value={value.inactivityMinutes || '30'} onChange={(e) => update('inactivityMinutes', e.target.value)} /><span>minutes</span></div></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(value.enabled)} onChange={setEnabled} title="Live Chat enabled" description="Enable the Live Chat workspace and customer contact entry point." /><Toggle checked={Boolean(value.autoClaimOnReply)} onChange={(v) => update('autoClaimOnReply', v)} title="Claim on first reply" description="Automatically claim a waiting conversation when a technician replies." /><Toggle checked={Boolean(value.allowTransfer)} onChange={(v) => update('allowTransfer', v)} title="Conversation transfer" description="Allow conversations to be transferred between teams/technicians." /><Toggle checked={Boolean(value.createIncidentFromChat)} onChange={(v) => update('createIncidentFromChat', v)} title="Create Incident from chat" description="Allow a conversation to be converted into an Incident." /></div></Panel>
}

function ItsmCmdb({ config, update }) {
  const value = config.cmdb || {}
  return <Panel title="CMDB & assets" description="How configuration items and RMM assets participate in ITSM records."><div className="production-settings-toggle-list"><Toggle checked={Boolean(value.enabled)} onChange={(v) => update('enabled', v)} title="CMDB enabled" description="Expose Assets & CIs in the ITSM workspace." /><Toggle checked={Boolean(value.linkRecords)} onChange={(v) => update('linkRecords', v)} title="Link records to CIs" description="Allow service records to reference affected configuration items." /><Toggle checked={Boolean(value.showRmmDevices)} onChange={(v) => update('showRmmDevices', v)} title="Show RMM devices" description="Include managed RMM devices as configuration items." /><Toggle checked={Boolean(value.allowManualCi)} onChange={(v) => update('allowManualCi', v)} title="Manual CIs" description="Allow non-RMM configuration items to be maintained." /><Toggle checked={Boolean(value.requireOwnerForManualCi)} onChange={(v) => update('requireOwnerForManualCi', v)} title="Manual CI owner required" description="Require ownership on manually managed CIs." /></div></Panel>
}

function ItsmReports({ config, update }) {
  const value = config.reports || {}
  return <Panel title="Reports & search" description="Tenant-level defaults for reporting, exports and search."><div className="production-settings-grid"><Field label="Default report range"><select value={String(value.defaultRangeDays || '30')} onChange={(e) => update('defaultRangeDays', e.target.value)}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">365 days</option></select></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(value.enabled)} onChange={(v) => update('enabled', v)} title="Reports enabled" description="Expose operational ITSM reports to authorised users." /><Toggle checked={Boolean(value.allowExport)} onChange={(v) => update('allowExport', v)} title="Record export" description="Allow authorised technicians to export record data." /><Toggle checked={Boolean(value.allowSavedViews)} onChange={(v) => update('allowSavedViews', v)} title="Saved reporting views" description="Allow report/view definitions to be retained." /><Toggle checked={Boolean(value.includeClosed)} onChange={(v) => update('includeClosed', v)} title="Include closed records" description="Include completed/closed work in report totals by default." /></div></Panel>
}

function ItsmAttachments({ config, update }) {
  const value = config.attachments || {}
  return <Panel title="Attachments" description="Tenant defaults and security boundaries enforced by the production attachment endpoints."><div className="production-settings-grid"><Field label="Maximum file size"><div className="production-prefix-field"><input type="number" min="1" max="20" value={value.maxMb || '5'} onChange={(e) => update('maxMb', e.target.value)} /><span>MB</span></div></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(value.requesterUploads)} onChange={(v) => update('requesterUploads', v)} title="Requester uploads" description="Allow requesters to upload customer-visible Service Request attachments." /><Toggle checked={Boolean(value.internalAttachments)} onChange={(v) => update('internalAttachments', v)} title="Internal attachments" description="Allow technician-only Incident, Problem, Change and Service Request attachments." /></div></Panel>
}

function ItsmNumbering({ config, update, updateNested }) { return <Panel title="Record numbering" description="Control the prefix and numeric length used when Hi5Central creates new service records."><div className="production-settings-grid"><Field label="Numbering mode"><select value={config.numberingMode || 'default'} onChange={(e) => update('numberingMode', e.target.value)}><option value="default">Hi5Central defaults</option><option value="custom">Custom prefixes</option></select></Field><Field label="Numeric digits"><select value={config.recordDigits || '5'} onChange={(e) => update('recordDigits', e.target.value)}>{['4','5','6','7','8'].map((d) => <option key={d} value={d}>{d} digits</option>)}</select></Field>{[['incident','Incident'],['serviceRequest','Service Request'],['problem','Problem'],['change','Change']].map(([key,label]) => <Field key={key} label={`${label} prefix`}><input disabled={config.numberingMode !== 'custom'} value={config.numberingMode === 'custom' ? config.recordPrefixes?.[key] || defaultPrefixes[key] : defaultPrefixes[key]} onChange={(e) => updateNested('recordPrefixes', key, e.target.value)} /></Field>)}</div><div className="production-number-preview"><span>Preview</span><strong>{config.numberingMode === 'custom' ? config.recordPrefixes?.incident || 'INC-' : 'INC-'}{String(1).padStart(Number(config.recordDigits || 5), '0')}</strong></div></Panel> }

function SlaTargetGrid({ title, description, bucket, config, update }) {
  const priorities = ['Critical', 'High', 'Medium', 'Low']
  const updateTarget = (priority, field, value) => update(bucket, {
    ...(config[bucket] || {}),
    [priority]: {
      ...(config[bucket]?.[priority] || {}),
      [field]: value,
    },
  })

  return <section className="production-settings-sla-block">
    <header><strong>{title}</strong><small>{description}</small></header>
    <div className="production-settings-sla-table">
      <div className="production-settings-sla-row is-heading"><span>Priority</span><span>First response</span><span>Resolution</span></div>
      {priorities.map((priority) => <div className="production-settings-sla-row" key={priority}>
        <strong>{priority}</strong>
        <label><input aria-label={`${title} ${priority} response minutes`} min="1" type="number" value={config[bucket]?.[priority]?.responseMinutes || ''} onChange={(event) => updateTarget(priority, 'responseMinutes', event.target.value)} /><small>minutes</small></label>
        <label><input aria-label={`${title} ${priority} resolution minutes`} min="1" type="number" value={config[bucket]?.[priority]?.resolutionMinutes || ''} onChange={(event) => updateTarget(priority, 'resolutionMinutes', event.target.value)} /><small>minutes</small></label>
      </div>)}
    </div>
  </section>
}

function ProjectTargetGrid({ config, update }) {
  const priorities = ['Critical', 'High', 'Medium', 'Low']
  const updateTarget = (priority, value) => update('projectSlaTargets', {
    ...(config.projectSlaTargets || {}),
    [priority]: { ...(config.projectSlaTargets?.[priority] || {}), targetDays: value },
  })

  return <section className="production-settings-sla-block">
    <header><strong>Project delivery targets</strong><small>Used when a new project has no explicit target date. The project deadline and task/milestone due dates are then tracked in Projects and Calendar.</small></header>
    <div className="production-settings-project-sla-table">
      {priorities.map((priority) => <label key={priority}><strong>{priority}</strong><input aria-label={`Project ${priority} target days`} min="1" type="number" value={config.projectSlaTargets?.[priority]?.targetDays || ''} onChange={(event) => updateTarget(priority, event.target.value)} /><small>days</small></label>)}
    </div>
  </section>
}

function ItsmSlas({ config, update }) {
  return <Panel title="SLAs" description="Service-level targets used directly by the production ITSM policy engine. Response is captured on the first technician customer-visible update.">
    <div className="production-settings-grid">
      <Field label="Business hours"><select value={config.businessHours || 'uk-business'} onChange={(e) => update('businessHours', e.target.value)}><option value="uk-business">UK business hours</option><option value="24x7">24 × 7</option><option value="custom">Custom schedule</option></select></Field>
      <Field label="Default priority"><select value={config.defaultPriority || 'Medium'} onChange={(e) => update('defaultPriority', e.target.value)}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></Field>
    </div>
    <div className="production-settings-sla-targets">
      <SlaTargetGrid title="Incident targets" description="Applied to Incident response and resolution clocks." bucket="slaTargets" config={config} update={update} />
      <SlaTargetGrid title="Service Request targets" description="Applied to Service Request response and fulfilment clocks, including approval pause/resume." bucket="serviceRequestSlaTargets" config={config} update={update} />
      <ProjectTargetGrid config={config} update={update} />
    </div>
    <div className="production-settings-toggle-list"><Toggle checked={Boolean(config.slaWarnings)} onChange={(v) => update('slaWarnings', v)} title="SLA warning notifications" description="Warn analysts before response or resolution targets breach." /></div>
  </Panel>
}

function ItsmServiceDesk({ config, update, tenant }) { return <Panel title="Service desk" description="Core assignment, inbound support and approval defaults."><div className="production-settings-grid"><Field label="Support address"><div className="production-prefix-field"><input value={config.supportEmail || 'support'} onChange={(e) => update('supportEmail', e.target.value)} /><span>@{tenant?.slug}.hi5central.com</span></div></Field><Field label="Default assignment team"><input value={config.defaultTeam || ''} onChange={(e) => update('defaultTeam', e.target.value)} /></Field><Field label="Manager approval threshold (£)"><input type="number" min="0" value={config.managerApprovalThreshold || '500'} onChange={(e) => update('managerApprovalThreshold', e.target.value)} /></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(config.liveChat)} onChange={(v) => update('liveChat', v)} title="Live Chat" description="Expose live support in the technician workspace and Portal." /><Toggle checked={Boolean(config.aiAssistant)} onChange={(v) => update('aiAssistant', v)} title="AI assistant" description="Tenant preference. AI features remain unavailable until the production AI service is connected." /></div></Panel> }

function ItsmPortal({ config, update }) { return <Panel title="Portal" description="Control the customer-facing self-service experience."><div className="production-settings-grid"><Field label="Portal name"><input value={config.portalName || ''} onChange={(e) => update('portalName', e.target.value)} /></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(config.portalKnowledge)} onChange={(v) => update('portalKnowledge', v)} title="Show knowledge" description="Allow requesters to browse published articles." /><Toggle checked={Boolean(config.requesterComments)} onChange={(v) => update('requesterComments', v)} title="Requester comments" description="Allow users to add customer-visible updates to their requests." /></div></Panel> }

function ItsmKnowledge({ config, update, updateRoot }) { const value = config.knowledge || {}; return <Panel title="Knowledge" description="Publishing, Portal availability and review defaults for the knowledge base."><div className="production-settings-grid"><Field label="Review interval"><div className="production-prefix-field"><input min="1" max="730" type="number" value={value.reviewDays || '180'} onChange={(e) => update('reviewDays', e.target.value)} /><span>days</span></div></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(value.internalEnabled)} onChange={(v) => update('internalEnabled', v)} title="Internal knowledge" description="Enable technician-facing knowledge articles." /><Toggle checked={Boolean(value.portalEnabled)} onChange={(v) => { update('portalEnabled', v); updateRoot('portalKnowledge', v) }} title="Publish to Portal" description="Make published knowledge available to requesters." /><Toggle checked={Boolean(value.feedbackEnabled)} onChange={(v) => { update('feedbackEnabled', v); updateRoot('knowledgeFeedback', v) }} title="Article feedback" description="Allow users to mark articles helpful or not helpful." /><Toggle checked={Boolean(value.requireReview)} onChange={(v) => update('requireReview', v)} title="Periodic review" description="Require published content to be reviewed on a schedule." /></div></Panel> }

function ItsmChanges({ config, update, updateRoot }) { const value = config.changes || {}; return <Panel title="Changes" description="Change Management defaults, evidence requirements and approval governance."><div className="production-settings-grid"><Field label="CAB name"><input value={config.cabName || ''} onChange={(e) => updateRoot('cabName', e.target.value)} /></Field><Field label="Default change type"><select value={value.defaultType || 'Normal'} onChange={(e) => update('defaultType', e.target.value)}><option>Standard</option><option>Normal</option><option>Emergency</option></select></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(config.standardChangeAutoApprove)} onChange={(v) => updateRoot('standardChangeAutoApprove', v)} title="Auto-approve standard changes" description="Use approved Standard Change templates as the approval authority." /><Toggle checked={Boolean(value.enforceApproval)} onChange={(v) => update('enforceApproval', v)} title="Approval required" description="Require an approval decision before scheduled implementation." /><Toggle checked={Boolean(value.requireImplementationPlan)} onChange={(v) => update('requireImplementationPlan', v)} title="Implementation plan required" description="Require an implementation plan before Assessment can complete." /><Toggle checked={Boolean(value.requireTestPlan)} onChange={(v) => update('requireTestPlan', v)} title="Test plan required" description="Require test/validation steps for governed changes." /><Toggle checked={Boolean(value.requireBackoutPlan)} onChange={(v) => update('requireBackoutPlan', v)} title="Backout plan required" description="Require a rollback/backout plan before implementation." /></div></Panel> }

function ItsmNotifications({ config, loaded, update }) {
  const channels = config.channels || defaultNotificationSettings.channels
  const categories = config.categories || defaultNotificationSettings.categories
  const requesterEvents = config.requesterEvents || defaultNotificationSettings.requesterEvents
  const eventLabels = [['incidents','Incidents'],['serviceRequests','Service requests'],['problems','Problems'],['changes','Changes'],['assignments','Assignments'],['approvals','Approvals'],['tasks','Tasks'],['customerUpdates','Customer updates'],['liveChat','Live Chat'],['projects','Projects'],['calendar','Calendar'],['rota','Rota'],['security','Security'],['platform','Platform']]
  return <><Panel title="Notification channels" description={loaded ? 'These tenant defaults are enforced by the production notification service.' : 'Loading production notification policy…'}><div className="production-settings-toggle-list"><Toggle checked={Boolean(channels.inApp)} onChange={(v) => update('channels', 'inApp', v)} title="Technician notification bell" description="Allow in-app notification-centre delivery." /><Toggle checked={Boolean(channels.email)} onChange={(v) => update('channels', 'email', v)} title="Email delivery" description="Allow email delivery when an event and recipient category are enabled." /><Toggle checked={Boolean(channels.browser)} onChange={(v) => update('channels', 'browser', v)} title="Browser notifications" description="Allow browser notification delivery for opted-in users." /></div></Panel><Panel title="Technician event categories" description="Choose which operational event families can generate notifications."><div className="production-settings-toggle-list">{eventLabels.map(([key,label]) => <Toggle key={key} checked={Boolean(categories[key])} onChange={(v) => update('categories', key, v)} title={label} description={'Allow ' + label.toLowerCase() + ' notification events.'} />)}</div></Panel><Panel title="Requester email policy" description="Control which customer-facing events can reach requesters. Internal/system noise can remain suppressed."><div className="production-settings-toggle-list"><Toggle checked={Boolean(requesterEvents.customerUpdates)} onChange={(v) => update('requesterEvents', 'customerUpdates', v)} title="Customer-visible updates" description="Send genuine technician/customer updates." /><Toggle checked={Boolean(requesterEvents.statusChanges)} onChange={(v) => update('requesterEvents', 'statusChanges', v)} title="Status changes" description="Notify requesters about lifecycle status changes." /><Toggle checked={Boolean(requesterEvents.recordCreated)} onChange={(v) => update('requesterEvents', 'recordCreated', v)} title="Creation acknowledgement" description="Send a confirmation when a requester record is created." /><Toggle checked={Boolean(requesterEvents.approvals)} onChange={(v) => update('requesterEvents', 'approvals', v)} title="Approvals" description="Send approval requests/decisions to requesters where applicable." /><Toggle checked={Boolean(requesterEvents.taskUpdates)} onChange={(v) => update('requesterEvents', 'taskUpdates', v)} title="Task updates" description="Allow fulfilment task events to be sent to requesters." /><Toggle checked={Boolean(requesterEvents.systemUpdates)} onChange={(v) => update('requesterEvents', 'systemUpdates', v)} title="System/internal updates" description="Allow system-generated updates. Recommended off to avoid customer noise." /></div></Panel></>
}

function RmmSites({ config, update }) { return <Panel title="Sites" description="Tenant-wide defaults used when creating the first managed RMM scope."><div className="production-settings-grid"><Field label="Default site"><input value={config.defaultSite || ''} onChange={(e) => update('defaultSite', e.target.value)} /></Field><Field label="Maintenance window"><input value={config.maintenanceWindow || ''} onChange={(e) => update('maintenanceWindow', e.target.value)} /></Field></div></Panel> }
function RmmAgent({ config, update }) { return <Panel title="Agent defaults" description="Default channel for newly enrolled endpoints."><div className="production-settings-grid"><Field label="Agent update channel"><select value={config.agentChannel || 'stable'} onChange={(e) => update('agentChannel', e.target.value)}><option value="stable">Stable</option><option value="early">Early access</option></select></Field></div></Panel> }
function RmmMonitoring({ config, update }) { return <Panel title="Monitoring" description="Default monitoring policy inherited by newly managed scopes."><div className="production-settings-grid"><Field label="Default monitoring policy"><input value={config.monitoringPolicy || ''} onChange={(e) => update('monitoringPolicy', e.target.value)} /></Field></div></Panel> }
function RmmPatching({ config, update }) { return <Panel title="Patching" description="Default patch ring and maintenance behaviour."><div className="production-settings-grid"><Field label="Patch ring"><input value={config.patchRing || ''} onChange={(e) => update('patchRing', e.target.value)} /></Field><Field label="Maintenance window"><input value={config.maintenanceWindow || ''} onChange={(e) => update('maintenanceWindow', e.target.value)} /></Field></div></Panel> }
function RmmRemote({ config, update }) { return <Panel title="Remote access" description="Unattended remote-session defaults for managed devices."><div className="production-settings-toggle-list"><Toggle checked={Boolean(config.unattendedAccess)} onChange={(v) => update('unattendedAccess', v)} title="Allow unattended access" description="Permit authorised technicians to start remote sessions without a local prompt." /><Toggle checked={Boolean(config.requireRemoteApproval)} onChange={(v) => update('requireRemoteApproval', v)} title="Require local approval" description="Use attended approval by default instead of unattended access." /></div></Panel> }

function MicrosoftConnections() {
  const [state, setState] = useState({ loading: true, configured: false, connections: [], connectedCount: 0, totalDeviceCount: 0 })
  const [working, setWorking] = useState('')
  const [message, setMessage] = useState('')
  const [showMicrosoftSetup, setShowMicrosoftSetup] = useState(false)

  const load = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/integrations/microsoft`, { credentials: 'include' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not load Microsoft connection state.')
      setState({ loading: false, ...payload, connections: payload.connections || [] })
    } catch (error) {
      setState((current) => ({ ...current, loading: false }))
      setMessage(error.message)
    }
  }

  useEffect(() => { void load() }, [])
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('microsoft')
    if (result === 'account_linked') setMessage('Your Microsoft account has been linked to this Hi5Central user.')
  }, [])

  function addTenant() {
    if (!state.configured) {
      setShowMicrosoftSetup(true)
      setMessage('Microsoft platform app registration must be configured securely on the Hi5Central server before a tenant can be connected.')
      return
    }
    const suggested = window.prompt('Give this Microsoft tenant a friendly name (for example UK tenant or Acquired company).', 'Microsoft 365')
    if (suggested === null) return
    const name = suggested.trim() || 'Microsoft 365'
    window.location.href = `${API_BASE}/api/v1/integrations/microsoft/connect?name=${encodeURIComponent(name)}`
  }

  async function action(key, request, success) {
    setWorking(key); setMessage('')
    try {
      const response = await request()
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Microsoft action failed.')
      setMessage(success(payload))
      await load()
    } catch (error) { setMessage(error.message) } finally { setWorking('') }
  }

  async function rename(connection) {
    const value = window.prompt('Microsoft tenant name', connection.connection_name || 'Microsoft 365')
    if (value === null || value.trim() === connection.connection_name) return
    await action(`rename-${connection.id}`, () => fetch(`${API_BASE}/api/v1/integrations/microsoft/${connection.id}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connectionName: value.trim() }),
    }), () => 'Connection renamed.')
  }

  async function disconnect(connection) {
    if (!window.confirm(`Disconnect ${connection.connection_name}? Imported inventory will be retained.`)) return
    await action(`disconnect-${connection.id}`, () => fetch(`${API_BASE}/api/v1/integrations/microsoft/${connection.id}/disconnect`, { method: 'POST', credentials: 'include' }), () => 'Microsoft tenant disconnected.')
  }

  async function toggleSso(connection) {
    const next = !connection.sso_enabled
    await action(`sso-${connection.id}`, () => fetch(`${API_BASE}/api/v1/integrations/microsoft/${connection.id}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ssoEnabled: next }),
    }), () => next ? 'Microsoft sign-in enabled.' : 'Microsoft sign-in disabled.')
  }

  const connections = state.connections || []
  return <>
    <div className="production-integration-card production-microsoft-card is-summary">
      <span className="production-integration-icon"><Cloud size={20} /></span>
      <div><strong>Microsoft 365 / Entra ID / Intune</strong><p>Connect one or more Microsoft tenants. Each directory keeps its own consent, users, devices and sync history.</p><small>{state.loading ? 'Checking connections…' : !state.configured ? 'App registration required' : `${state.connectedCount || 0} connected tenant${state.connectedCount === 1 ? '' : 's'} · ${state.totalDeviceCount || 0} devices`}</small>{state.configured && state.credentials ? <div className="production-microsoft-credential-preview"><span><small>Application (client) ID</small><code>{state.credentials.clientId || 'Not available'}</code></span><span><small>Client secret</small><code>{state.credentials.clientSecret || 'Not available'}</code></span><em>Only the first four characters are displayed after storage. The full client secret is never returned to the browser.</em></div> : null}{message ? <small className="is-feedback">{message}</small> : null}</div>
      <div className="production-integration-actions"><button disabled={state.loading || Boolean(working)} onClick={addTenant} type="button">Add Microsoft tenant</button>{state.connectedCount > 1 ? <button disabled={Boolean(working)} onClick={() => action('sync-all', () => fetch(`${API_BASE}/api/v1/integrations/microsoft/sync-all`, { method: 'POST', credentials: 'include' }), (payload) => `Synced ${payload.connections?.length || 0} Microsoft tenants and ${payload.devices || 0} devices.`)} type="button">{working === 'sync-all' ? 'Syncing…' : 'Sync all'}</button> : null}</div>
    </div>
    {showMicrosoftSetup && !state.configured ? <div className="production-microsoft-setup" role="status">
      <div><strong>Microsoft platform app setup required</strong><p>Create the Entra app registration first. The Application (client) ID and client secret are stored securely on the Hi5Central server and are not entered in tenant Settings.</p></div>
      <div className="production-microsoft-setup-details"><span><small>Redirect URI</small><code>{state.callbackUri || `${API_BASE}/api/v1/auth/microsoft/callback`}</code></span><span><small>Credential storage</small><strong>The client secret is stored in a root-owned protected server file and mounted read-only into the API. After storage, Hi5Central only exposes the first four characters as a masked preview.</strong></span><span><small>Application permissions and why they are required</small><div className="production-microsoft-permissions"><span><code>User.Read.All</code><p>Reads Entra user profile data so Hi5Central can sync People and link each Intune device to the correct requester or employee.</p></span><span><code>DeviceManagementManagedDevices.Read.All</code><p>Reads Intune managed-device inventory, ownership and compliance data so devices can appear in RMM and ITSM Assets &amp; CIs. This is read-only; Hi5Central does not request device write permission.</p></span></div></span><span><small>Next step</small><strong>After creating the app registration, store the client ID and secret on the Hi5Central server. This page will then enable Microsoft tenant connection automatically.</strong></span></div>
      <button onClick={() => setShowMicrosoftSetup(false)} type="button">Close</button>
    </div> : null}
    {connections.map((connection) => {
      const connected = connection.status === 'connected'
      const lastSync = connection.last_sync_completed_at ? new Date(connection.last_sync_completed_at).toLocaleString() : 'Not yet synced'
      return <div className={`production-integration-card production-microsoft-card ${connected ? 'is-connected' : ''}`} key={connection.id}>
        <span className="production-integration-icon"><Cloud size={20} /></span>
        <div><strong>{connection.connection_name || 'Microsoft 365'}</strong><p>{connection.directory_tenant_id || 'Directory tenant pending'} · {connected ? 'Connected' : connection.status}</p><small>{connection.device_count || 0} devices · Last sync {lastSync}</small><small>Microsoft sign-in: {connection.sso_enabled ? 'On' : 'Off'}</small>{connection.current_user_principal ? <small>My linked Microsoft account: {connection.current_user_principal}</small> : connection.sso_enabled ? <small>My Microsoft account is not linked yet.</small> : null}{connection.last_sync_error ? <small className="is-feedback">{connection.last_sync_error}</small> : null}</div>
        <div className="production-integration-actions">{connected ? <><button disabled={Boolean(working)} onClick={() => action(`sync-${connection.id}`, () => fetch(`${API_BASE}/api/v1/integrations/microsoft/${connection.id}/sync`, { method: 'POST', credentials: 'include' }), (payload) => `Synced ${payload.users || 0} users and ${payload.devices || 0} devices from ${connection.connection_name}.`)} type="button">{working === `sync-${connection.id}` ? 'Syncing…' : 'Sync now'}</button><button disabled={Boolean(working)} onClick={() => toggleSso(connection)} type="button">{working === `sso-${connection.id}` ? 'Saving…' : connection.sso_enabled ? 'Disable SSO' : 'Enable SSO'}</button>{connection.sso_enabled ? <button disabled={Boolean(working)} onClick={() => { window.location.href = `${API_BASE}/api/v1/integrations/microsoft/${connection.id}/link-me` }} type="button">{connection.current_user_principal ? 'Relink my account' : 'Link my account'}</button> : null}<button disabled={Boolean(working)} onClick={() => rename(connection)} type="button">Rename</button><button disabled={Boolean(working)} onClick={() => disconnect(connection)} type="button">Disconnect</button></> : <button disabled={!state.configured || Boolean(working)} onClick={addTenant} type="button">Reconnect / add tenant</button>}</div>
      </div>
    })}
  </>
}

function Integrations({ config, update }) {
  return <><Panel title="Integrations" description="Connection catalogue for directory, collaboration, service-management and API integrations."><div className="production-integration-grid"><MicrosoftConnections /><IntegrationCard name="Microsoft Teams" description="Service notifications and collaboration actions." icon={Users} status={config.microsoftTeams?.status} /><IntegrationCard name="Slack" description="Notifications and workflow actions." icon={Mail} status={config.slack?.status} /><IntegrationCard name="Jira" description="Link engineering work and service records." icon={GitBranch} status={config.jira?.status} /></div></Panel><Panel title="Developer integrations"><div className="production-settings-toggle-list"><Toggle checked={Boolean(config.apiAccess?.enabled)} onChange={(v) => update('apiAccess', { ...(config.apiAccess || {}), enabled: v })} title="API access" description="Prepare this tenant for scoped API credentials." /><Toggle checked={Boolean(config.webhooks?.enabled)} onChange={(v) => update('webhooks', { ...(config.webhooks || {}), enabled: v })} title="Webhooks" description="Allow outbound event delivery when webhook management is enabled." /></div></Panel></>
}

function Subscription({ config, update, modules }) { return <><Panel title="Subscription" description="Subscription metadata for this tenant. Billing activation is handled by the production billing service."><div className="production-settings-grid"><Field label="Plan"><select value={config.plan || 'trial'} onChange={(e) => update('plan', e.target.value)}><option value="trial">Trial</option><option value="business">Business</option><option value="enterprise">Enterprise</option><option value="internal">Internal test tenant</option></select></Field><Field label="Billing contact"><input type="email" value={config.billingContact || ''} onChange={(e) => update('billingContact', e.target.value)} /></Field><Field label="Expected technicians"><input type="number" min="1" value={config.expectedTechnicians || '5'} onChange={(e) => update('expectedTechnicians', e.target.value)} /></Field><Field label="Expected devices"><input type="number" min="0" value={config.expectedDevices || '100'} onChange={(e) => update('expectedDevices', e.target.value)} /></Field></div></Panel><Panel title="Enabled products"><div className="production-product-summary">{modules.itsm ? <div><Wrench size={18} /><span><strong>Hi5Central ITSM</strong><small>Technician workspace + Portal</small></span></div> : null}{modules.rmm ? <div><MonitorCog size={18} /><span><strong>Hi5Central RMM</strong><small>Endpoint management</small></span></div> : null}</div></Panel></> }
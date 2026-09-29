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

  'itsm-numbering': { path: '/settings/itsm/record-numbering', group: 'ITSM', label: 'Record numbering', icon: ListChecks, area: 'itsm' },
  'itsm-slas': { path: '/settings/itsm/slas', group: 'ITSM', label: 'SLAs', icon: Gauge, area: 'itsm' },
  'itsm-service-desk': { path: '/settings/itsm/service-desk', group: 'ITSM', label: 'Service desk', icon: Wrench, area: 'itsm' },
  'itsm-portal': { path: '/settings/itsm/portal', group: 'ITSM', label: 'Portal', icon: Globe2, area: 'itsm' },
  'itsm-knowledge': { path: '/settings/itsm/knowledge', group: 'ITSM', label: 'Knowledge', icon: BookOpen, area: 'itsm' },
  'itsm-changes': { path: '/settings/itsm/changes', group: 'ITSM', label: 'Changes', icon: GitBranch, area: 'itsm' },
  'itsm-notifications': { path: '/settings/itsm/notifications', group: 'ITSM', label: 'Notifications', icon: Bell, area: 'itsm' },

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
      p1ResponseMinutes: '15', p1ResolutionMinutes: '240', managerApprovalThreshold: '500',
      portalName: 'IT Help Centre', portalKnowledge: true, requesterComments: true, liveChat: true, aiAssistant: false,
      cabName: 'Change Advisory Board', standardChangeAutoApprove: true,
      requesterNotifications: true, slaWarnings: true, knowledgeFeedback: true,
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

function mergeConfig(base, stored) {
  const next = { ...base }
  for (const [key, value] of Object.entries(stored || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      next[key] = { ...(base[key] || {}), ...value }
      if (key === 'itsm') next[key].recordPrefixes = { ...defaultPrefixes, ...(value.recordPrefixes || {}) }
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
      theme: { mode: theme.mode || 'system', accent: theme.accent || 'amber' },
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
  const [settingsNavVisible, setSettingsNavVisible] = useState(loadSettingsNavVisible)
  const activeId = sectionFromPath(currentPath)
  const active = sections[activeId]
  const modules = session?.tenant?.modules || {}
  const accent = config.theme?.accent || 'amber'

  useEffect(() => {
    setConfig(mergeConfig(defaults(session), effectiveSettings(session)))
  }, [session])

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

            {activeId === 'itsm-numbering' ? <ItsmNumbering config={config.itsm} update={(f, v) => updateArea('itsm', f, v)} updateNested={(p, f, v) => updateNested('itsm', p, f, v)} /> : null}
            {activeId === 'itsm-slas' ? <ItsmSlas config={config.itsm} update={(f, v) => updateArea('itsm', f, v)} /> : null}
            {activeId === 'itsm-service-desk' ? <ItsmServiceDesk config={config.itsm} update={(f, v) => updateArea('itsm', f, v)} tenant={session?.tenant} /> : null}
            {activeId === 'itsm-portal' ? <ItsmPortal config={config.itsm} update={(f, v) => updateArea('itsm', f, v)} /> : null}
            {activeId === 'itsm-knowledge' ? <ItsmKnowledge config={config.itsm} update={(f, v) => updateArea('itsm', f, v)} /> : null}
            {activeId === 'itsm-changes' ? <ItsmChanges config={config.itsm} update={(f, v) => updateArea('itsm', f, v)} /> : null}
            {activeId === 'itsm-notifications' ? <ItsmNotifications config={config.itsm} update={(f, v) => updateArea('itsm', f, v)} /> : null}

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

function ItsmNumbering({ config, update, updateNested }) { return <Panel title="Record numbering" description="Control the prefix and numeric length used when Hi5Central creates new service records."><div className="production-settings-grid"><Field label="Numbering mode"><select value={config.numberingMode || 'default'} onChange={(e) => update('numberingMode', e.target.value)}><option value="default">Hi5Central defaults</option><option value="custom">Custom prefixes</option></select></Field><Field label="Numeric digits"><select value={config.recordDigits || '5'} onChange={(e) => update('recordDigits', e.target.value)}>{['4','5','6','7','8'].map((d) => <option key={d} value={d}>{d} digits</option>)}</select></Field>{[['incident','Incident'],['serviceRequest','Service Request'],['problem','Problem'],['change','Change']].map(([key,label]) => <Field key={key} label={`${label} prefix`}><input disabled={config.numberingMode !== 'custom'} value={config.numberingMode === 'custom' ? config.recordPrefixes?.[key] || defaultPrefixes[key] : defaultPrefixes[key]} onChange={(e) => updateNested('recordPrefixes', key, e.target.value)} /></Field>)}</div><div className="production-number-preview"><span>Preview</span><strong>{config.numberingMode === 'custom' ? config.recordPrefixes?.incident || 'INC-' : 'INC-'}{String(1).padStart(Number(config.recordDigits || 5), '0')}</strong></div></Panel> }

function ItsmSlas({ config, update }) { return <Panel title="SLAs" description="Default service-level targets used by the tenant ITSM policy engine."><div className="production-settings-grid"><Field label="Business hours"><select value={config.businessHours || 'uk-business'} onChange={(e) => update('businessHours', e.target.value)}><option value="uk-business">UK business hours</option><option value="24x7">24 × 7</option><option value="custom">Custom schedule</option></select></Field><Field label="P1 response (minutes)"><input type="number" min="1" value={config.p1ResponseMinutes || '15'} onChange={(e) => update('p1ResponseMinutes', e.target.value)} /></Field><Field label="P1 resolution (minutes)"><input type="number" min="1" value={config.p1ResolutionMinutes || '240'} onChange={(e) => update('p1ResolutionMinutes', e.target.value)} /></Field><Field label="Default priority"><select value={config.defaultPriority || 'Medium'} onChange={(e) => update('defaultPriority', e.target.value)}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(config.slaWarnings)} onChange={(v) => update('slaWarnings', v)} title="SLA warning notifications" description="Warn analysts before response or resolution targets breach." /></div></Panel> }

function ItsmServiceDesk({ config, update, tenant }) { return <Panel title="Service desk" description="Core assignment, inbound support and approval defaults."><div className="production-settings-grid"><Field label="Support address"><div className="production-prefix-field"><input value={config.supportEmail || 'support'} onChange={(e) => update('supportEmail', e.target.value)} /><span>@{tenant?.slug}.hi5central.com</span></div></Field><Field label="Default assignment team"><input value={config.defaultTeam || ''} onChange={(e) => update('defaultTeam', e.target.value)} /></Field><Field label="Manager approval threshold (£)"><input type="number" min="0" value={config.managerApprovalThreshold || '500'} onChange={(e) => update('managerApprovalThreshold', e.target.value)} /></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(config.liveChat)} onChange={(v) => update('liveChat', v)} title="Live Chat" description="Expose live support in the technician workspace and Portal." /><Toggle checked={Boolean(config.aiAssistant)} onChange={(v) => update('aiAssistant', v)} title="AI assistant" description="Tenant preference. AI features remain unavailable until the production AI service is connected." /></div></Panel> }

function ItsmPortal({ config, update }) { return <Panel title="Portal" description="Control the customer-facing self-service experience."><div className="production-settings-grid"><Field label="Portal name"><input value={config.portalName || ''} onChange={(e) => update('portalName', e.target.value)} /></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(config.portalKnowledge)} onChange={(v) => update('portalKnowledge', v)} title="Show knowledge" description="Allow requesters to browse published articles." /><Toggle checked={Boolean(config.requesterComments)} onChange={(v) => update('requesterComments', v)} title="Requester comments" description="Allow users to add customer-visible updates to their requests." /></div></Panel> }

function ItsmKnowledge({ config, update }) { return <Panel title="Knowledge" description="Publishing and feedback defaults for the knowledge base."><div className="production-settings-toggle-list"><Toggle checked={Boolean(config.knowledgeFeedback)} onChange={(v) => update('knowledgeFeedback', v)} title="Article feedback" description="Allow users to mark articles helpful or not helpful." /><Toggle checked={Boolean(config.portalKnowledge)} onChange={(v) => update('portalKnowledge', v)} title="Publish to Portal" description="Make published knowledge available to requesters." /></div></Panel> }

function ItsmChanges({ config, update }) { return <Panel title="Changes" description="Default CAB and standard-change governance."><div className="production-settings-grid"><Field label="CAB name"><input value={config.cabName || ''} onChange={(e) => update('cabName', e.target.value)} /></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(config.standardChangeAutoApprove)} onChange={(v) => update('standardChangeAutoApprove', v)} title="Auto-approve standard changes" description="Use the approved standard-change template as the authority for tenant records." /></div></Panel> }

function ItsmNotifications({ config, update }) { return <Panel title="Notifications" description="Tenant defaults for service communications."><div className="production-settings-toggle-list"><Toggle checked={Boolean(config.requesterNotifications)} onChange={(v) => update('requesterNotifications', v)} title="Requester notifications" description="Send updates when request state changes." /><Toggle checked={Boolean(config.slaWarnings)} onChange={(v) => update('slaWarnings', v)} title="SLA warnings" description="Notify analysts about approaching SLA targets." /><Toggle checked={Boolean(config.knowledgeFeedback)} onChange={(v) => update('knowledgeFeedback', v)} title="Knowledge feedback notifications" description="Surface article feedback to knowledge owners." /></div></Panel> }

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

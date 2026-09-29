import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  LayoutPanelLeft,
  Monitor,
  Moon,
  Palette,
  PanelLeft,
  PanelRight,
  Settings2,
  Sparkles,
  Sun,
  WandSparkles,
  X,
} from 'lucide-react'
import {
  loadAccent,
  loadDensity,
  loadSidebarMode,
  loadTheme,
  saveAccent,
  saveDensity,
  saveSidebarMode,
  saveTheme,
} from '../services/runtimeState.js'
import './ProductionFirstLoginExperience.css'

const API_BASE = window.__HI5_API_BASE__
const DESKTOP_SIDE_KEY = 'hi5central-primary-nav-side-v1'
const MOBILE_SIDE_KEY = 'hi5central-mobile-nav-side-v1'
const NAV_STYLE_KEY = 'hi5central-primary-nav-style-v1'
const TENANT_RUNTIME_CONFIG_KEY = 'hi5central-tenant-runtime-config-v1'
const PREFERENCE_SYNC_KEY = 'hi5central-user-preference-sync-v1'

const ACCENTS = [
  ['amber', '#f59e0b'],
  ['blue', '#3b82f6'],
  ['cyan', '#06b6d4'],
  ['emerald', '#10b981'],
  ['violet', '#8b5cf6'],
  ['rose', '#f43f5e'],
]

const COACH_STEPS = [
  {
    id: 'navigation',
    title: 'Your navigation',
    copy: 'Everything in your workspace starts here. The sidebar can be docked left or right and restyled any time.',
    selector: '.sidebar, .production-workspace-mobile-nav, .tabbar-brand',
  },
  {
    id: 'tabs',
    title: 'Workspace tabs',
    copy: 'Keep records and tools open inside Hi5Central without filling your browser with tabs.',
    selector: '.production-workspace-tabs-viewport',
  },
  {
    id: 'new',
    title: 'Create from anywhere',
    copy: 'Use New to create an Incident, Service Request, Problem or Change without losing your current work.',
    selector: '.production-workspace-new',
  },
  {
    id: 'search',
    title: 'Find anything quickly',
    copy: 'Search is always nearby. Peek will appear throughout lists and records when you want context without navigating away.',
    selector: '.production-workspace-search',
  },
]

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function tenantAccent() {
  return readJson(TENANT_RUNTIME_CONFIG_KEY, {})?.theme?.accent || 'amber'
}

function initials(name = '') {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'HC'
}

function defaultPreferences() {
  return {
    appearance: {
      theme: loadTheme(),
      accentMode: 'tenant',
      accent: loadAccent(),
      density: loadDensity(),
    },
    navigation: {
      desktopSide: readJson(DESKTOP_SIDE_KEY, 'left'),
      mobileSide: readJson(MOBILE_SIDE_KEY, 'left'),
      sidebarStyle: readJson(NAV_STYLE_KEY, 'floating'),
      sidebarMode: loadSidebarMode(),
    },
    guidance: { coachMarks: true },
  }
}

function mergePreferences(value) {
  const base = defaultPreferences()
  return {
    appearance: { ...base.appearance, ...(value?.appearance || {}) },
    navigation: { ...base.navigation, ...(value?.navigation || {}) },
    guidance: { ...base.guidance, ...(value?.guidance || {}) },
  }
}

function effectiveTheme(mode) {
  if (mode === 'dark' || mode === 'light') return mode
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyPreferences(preferences) {
  const next = mergePreferences(preferences)
  const accent = next.appearance.accentMode === 'personal' ? next.appearance.accent : tenantAccent()

  saveTheme(next.appearance.theme)
  saveAccent(accent)
  saveDensity(next.appearance.density)
  saveSidebarMode(next.navigation.sidebarMode)

  try {
    window.localStorage.setItem(DESKTOP_SIDE_KEY, JSON.stringify(next.navigation.desktopSide))
    window.localStorage.setItem(MOBILE_SIDE_KEY, JSON.stringify(next.navigation.mobileSide))
    window.localStorage.setItem(NAV_STYLE_KEY, JSON.stringify(next.navigation.sidebarStyle))
  } catch {
    // Server preferences remain authoritative if local storage is unavailable.
  }

  const shell = document.querySelector('.app-shell')
  if (shell instanceof HTMLElement) {
    shell.dataset.theme = effectiveTheme(next.appearance.theme)
    shell.dataset.accent = accent
    shell.dataset.navSide = next.navigation.desktopSide
    shell.dataset.mobileNavSide = next.navigation.mobileSide
    shell.dataset.navStyle = next.navigation.sidebarStyle
    shell.classList.remove('sidebar-expanded', 'sidebar-collapsed', 'sidebar-hidden', 'density-comfortable', 'density-compact')
    shell.classList.add(`sidebar-${next.navigation.sidebarMode}`, `density-${next.appearance.density}`)
  }

  document.documentElement.dataset.hi5NavSide = next.navigation.desktopSide
  document.documentElement.dataset.hi5MobileNavSide = next.navigation.mobileSide
  document.documentElement.dataset.hi5NavStyle = next.navigation.sidebarStyle
  document.body.dataset.hi5NavSide = next.navigation.desktopSide
  document.body.dataset.hi5MobileNavSide = next.navigation.mobileSide
  document.body.dataset.hi5NavStyle = next.navigation.sidebarStyle
  window.dispatchEvent(new CustomEvent('hi5-navigation-side-change', { detail: next.navigation }))
}

async function getPreferences() {
  const response = await fetch(`${API_BASE}/api/v1/user-preferences`, {
    credentials: 'include',
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Could not load your workspace preferences.')
  return payload
}

async function patchPreferences(preferences, markers = {}) {
  const response = await fetch(`${API_BASE}/api/v1/user-preferences`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferences, ...markers }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Could not save your workspace preferences.')
  return payload
}

function navigate(path) {
  if (!path) return
  window.history.pushState({}, '', path)
  const event = typeof PopStateEvent === 'function'
    ? new PopStateEvent('popstate', { state: window.history.state })
    : new Event('popstate')
  window.dispatchEvent(event)
  window.dispatchEvent(new Event('hi5-routechange'))
}

function Choice({ active, icon: Icon, title, copy, onClick }) {
  return (
    <button className={`hi5-first-login-choice ${active ? 'is-active' : ''}`} onClick={onClick} type="button">
      {Icon ? <Icon size={18} /> : null}
      <span><strong>{title}</strong>{copy ? <small>{copy}</small> : null}</span>
      {active ? <Check size={16} /> : null}
    </button>
  )
}

function AppearanceStep({ preferences, onChange }) {
  const appearance = preferences.appearance
  const navigation = preferences.navigation
  const setAppearance = (patch) => onChange({ ...preferences, appearance: { ...appearance, ...patch } })
  const setNavigation = (patch) => onChange({ ...preferences, navigation: { ...navigation, ...patch } })

  return (
    <div className="hi5-first-login-personalise">
      <section>
        <header><Palette size={17} /><div><strong>Appearance</strong><span>Start with the tenant brand or make the workspace yours.</span></div></header>
        <div className="hi5-first-login-three">
          <Choice active={appearance.theme === 'system'} icon={Monitor} title="System" onClick={() => setAppearance({ theme: 'system' })} />
          <Choice active={appearance.theme === 'light'} icon={Sun} title="Light" onClick={() => setAppearance({ theme: 'light' })} />
          <Choice active={appearance.theme === 'dark'} icon={Moon} title="Dark" onClick={() => setAppearance({ theme: 'dark' })} />
        </div>
        <div className="hi5-first-login-accent-mode">
          <Choice active={appearance.accentMode === 'tenant'} title="Use organisation accent" copy="Follows your Hi5Central brand." onClick={() => setAppearance({ accentMode: 'tenant' })} />
          <Choice active={appearance.accentMode === 'personal'} title="Personal accent" copy="Only changes your own workspace." onClick={() => setAppearance({ accentMode: 'personal' })} />
        </div>
        {appearance.accentMode === 'personal' ? <div className="hi5-first-login-accents" aria-label="Personal accent colour">{ACCENTS.map(([id, colour]) => <button aria-label={id} className={appearance.accent === id ? 'is-active' : ''} key={id} onClick={() => setAppearance({ accent: id })} style={{ '--swatch': colour }} type="button"><span /></button>)}</div> : null}
        <div className="hi5-first-login-two">
          <Choice active={appearance.density === 'comfortable'} title="Comfortable" copy="More breathing room." onClick={() => setAppearance({ density: 'comfortable' })} />
          <Choice active={appearance.density === 'compact'} title="Compact" copy="More information at once." onClick={() => setAppearance({ density: 'compact' })} />
        </div>
      </section>

      <section>
        <header><LayoutPanelLeft size={17} /><div><strong>Navigation</strong><span>Choose where the workspace controls sit and how they look.</span></div></header>
        <div className="hi5-first-login-two">
          <Choice active={navigation.desktopSide === 'left'} icon={PanelLeft} title="Sidebar left" onClick={() => setNavigation({ desktopSide: 'left' })} />
          <Choice active={navigation.desktopSide === 'right'} icon={PanelRight} title="Sidebar right" onClick={() => setNavigation({ desktopSide: 'right' })} />
        </div>
        <div className="hi5-first-login-two">
          <Choice active={navigation.sidebarStyle === 'floating'} title="Floating glass" copy="Curved, detached Liquid Glass navigation." onClick={() => setNavigation({ sidebarStyle: 'floating' })} />
          <Choice active={navigation.sidebarStyle === 'clean'} title="Clean panel" copy="Restrained navigation matching Settings." onClick={() => setNavigation({ sidebarStyle: 'clean' })} />
        </div>
        <div className="hi5-first-login-two">
          <Choice active={navigation.sidebarMode === 'expanded'} title="Expanded" onClick={() => setNavigation({ sidebarMode: 'expanded' })} />
          <Choice active={navigation.sidebarMode === 'collapsed'} title="Compact rail" onClick={() => setNavigation({ sidebarMode: 'collapsed' })} />
        </div>
        <div className="hi5-first-login-two hi5-first-login-mobile-side">
          <Choice active={navigation.mobileSide === 'left'} title="Mobile button left" onClick={() => setNavigation({ mobileSide: 'left' })} />
          <Choice active={navigation.mobileSide === 'right'} title="Mobile button right" onClick={() => setNavigation({ mobileSide: 'right' })} />
        </div>
      </section>
    </div>
  )
}

function FirstLoginDialog({ payload, preferences, setPreferences, onComplete, saving, error }) {
  const [step, setStep] = useState(0)
  const user = payload.user || {}
  const company = payload.tenant?.companyName || payload.tenant?.slug || 'your organisation'
  const admin = ['owner', 'admin'].includes(user.tenantRole)

  return createPortal(
    <div className="hi5-first-login-layer">
      <div className="hi5-first-login-backdrop" />
      <section className="hi5-first-login-card" role="dialog" aria-modal="true" aria-label="Welcome to Hi5Central">
        <header className="hi5-first-login-header">
          <div className="hi5-first-login-brand"><img src="/hi5central-logo.png" alt="" /><span>Hi5Central</span></div>
          <div className="hi5-first-login-progress" aria-label={`Step ${step + 1} of 3`}><i className="is-active" /><i className={step >= 1 ? 'is-active' : ''} /><i className={step >= 2 ? 'is-active' : ''} /></div>
        </header>

        <div className="hi5-first-login-body">
          {step === 0 ? <div className="hi5-first-login-welcome">
            <div className="hi5-first-login-avatar">{initials(user.name)}</div>
            <span className="hi5-first-login-kicker"><Sparkles size={14} /> Your workspace is ready</span>
            <h1>Welcome to Hi5Central{user.name ? `, ${user.name.split(' ')[0]}` : ''}.</h1>
            <p>{company} is ready. Spend about 30 seconds making the workspace comfortable, or use the defaults and get straight to work.</p>
            <div className="hi5-first-login-summary">
              <span><CheckCircle2 size={16} /> {admin ? 'Administrator workspace' : 'Service Desk workspace'}</span>
              <span><CheckCircle2 size={16} /> Tenant branding already applied</span>
              <span><CheckCircle2 size={16} /> Preferences can be changed later</span>
            </div>
          </div> : null}

          {step === 1 ? <AppearanceStep preferences={preferences} onChange={setPreferences} /> : null}

          {step === 2 ? <div className="hi5-first-login-ready">
            <span className="hi5-first-login-ready-icon"><WandSparkles size={24} /></span>
            <span className="hi5-first-login-kicker">You're ready</span>
            <h1>Your workspace, your way.</h1>
            <p>We’ll show four short pointers on the Dashboard. You can skip them at any time, and Getting Started will remain available until you dismiss it.</p>
            <label className="hi5-first-login-coach-toggle">
              <input checked={preferences.guidance.coachMarks !== false} onChange={(event) => setPreferences({ ...preferences, guidance: { ...preferences.guidance, coachMarks: event.target.checked } })} type="checkbox" />
              <span><strong>Show contextual tips</strong><small>Four short coach marks, then Hi5Central stays out of your way.</small></span>
            </label>
          </div> : null}
        </div>

        {error ? <div className="hi5-first-login-error">{error}</div> : null}

        <footer className="hi5-first-login-footer">
          {step === 0 ? <button className="is-quiet" disabled={saving} onClick={() => onComplete(defaultPreferences())} type="button">Use defaults</button> : <button className="is-quiet" disabled={saving} onClick={() => setStep((value) => Math.max(0, value - 1))} type="button">Back</button>}
          <span />
          {step < 2 ? <button className="is-primary" onClick={() => setStep((value) => value + 1)} type="button">{step === 0 ? 'Personalise workspace' : 'Continue'}<ArrowRight size={16} /></button> : <button className="is-primary" disabled={saving} onClick={() => onComplete(preferences)} type="button">{saving ? 'Saving…' : 'Open my workspace'}<ArrowRight size={16} /></button>}
        </footer>
      </section>
    </div>,
    document.body,
  )
}

function CoachMarks({ index, onNext, onSkip }) {
  const step = COACH_STEPS[index]
  const [targetFound, setTargetFound] = useState(false)

  useEffect(() => {
    document.querySelectorAll('[data-hi5-coach-focus="true"]').forEach((node) => delete node.dataset.hi5CoachFocus)
    if (!step) return undefined
    let activeTarget = null
    const attach = () => {
      activeTarget = document.querySelector(step.selector)
      if (!(activeTarget instanceof HTMLElement)) return false
      activeTarget.dataset.hi5CoachFocus = 'true'
      setTargetFound(true)
      return true
    }
    if (!attach()) {
      const timer = window.setInterval(() => { if (attach()) window.clearInterval(timer) }, 300)
      return () => {
        window.clearInterval(timer)
        if (activeTarget) delete activeTarget.dataset.hi5CoachFocus
      }
    }
    return () => { if (activeTarget) delete activeTarget.dataset.hi5CoachFocus }
  }, [step?.id])

  if (!step || !targetFound) return null
  return createPortal(
    <aside className="hi5-coach-card" aria-live="polite">
      <span>{index + 1} of {COACH_STEPS.length}</span>
      <strong>{step.title}</strong>
      <p>{step.copy}</p>
      <footer><button onClick={onSkip} type="button">Skip tour</button><button className="is-primary" onClick={onNext} type="button">{index === COACH_STEPS.length - 1 ? 'Done' : 'Next'}<ChevronRight size={14} /></button></footer>
    </aside>,
    document.body,
  )
}

function GettingStarted({ payload, onDismiss }) {
  const [open, setOpen] = useState(true)
  const admin = ['owner', 'admin'].includes(payload.user?.tenantRole)
  const modules = payload.tenant?.modules || {}
  const adminItems = [
    ['/settings/organisation', 'Organisation'],
    ['/settings/people-directory', 'People & directory'],
    ['/settings/roles-permissions', 'Roles & permissions'],
    ['/settings/security-mfa', 'Security & MFA'],
    ['/settings/itsm/service-desk', 'Service desk'],
    ['/settings/itsm/portal', 'Portal'],
    ['/settings/integrations', 'Integrations'],
  ]
  if (modules.rmm) adminItems.push(['/settings/rmm/sites', 'RMM setup'])

  if (!open) {
    return createPortal(<button className="hi5-getting-started-pill" onClick={() => setOpen(true)} type="button"><Compass size={16} />Getting started</button>, document.body)
  }

  return createPortal(
    <aside className="hi5-getting-started-card">
      <header><div><span>Getting started</span><strong>{admin ? 'Finish your workspace setup' : 'Get comfortable in Hi5Central'}</strong></div><button aria-label="Collapse Getting Started" onClick={() => setOpen(false)} type="button"><X size={15} /></button></header>
      <div className="hi5-getting-started-list">
        <button className="is-complete" type="button"><CheckCircle2 size={15} /><span><strong>Personalise workspace</strong><small>Appearance and navigation saved.</small></span></button>
        <button onClick={() => navigate('/incidents')} type="button"><Compass size={15} /><span><strong>Open your first record</strong><small>Use Peek or open it in a workspace tab.</small></span></button>
        <button onClick={() => navigate('/incidents/new')} type="button"><Sparkles size={15} /><span><strong>Create or update a record</strong><small>Learn the Service Desk flow.</small></span></button>
      </div>
      {admin ? <div className="hi5-admin-setup-centre"><span>Admin setup centre</span>{adminItems.map(([path, label]) => <button key={path} onClick={() => navigate(path)} type="button"><Settings2 size={13} />{label}<ChevronRight size={13} /></button>)}</div> : null}
      <footer><button onClick={onDismiss} type="button">Dismiss getting started</button></footer>
    </aside>,
    document.body,
  )
}

export function ProductionFirstLoginExperience() {
  const [payload, setPayload] = useState(null)
  const [preferences, setPreferences] = useState(defaultPreferences)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [path, setPath] = useState(() => window.location.pathname)
  const [coachIndex, setCoachIndex] = useState(-1)
  const [tenantHandoffVisible, setTenantHandoffVisible] = useState(false)
  const coachTimer = useRef(null)

  useEffect(() => {
    const update = () => setPath(window.location.pathname)
    window.addEventListener('popstate', update)
    window.addEventListener('hi5-routechange', update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener('hi5-routechange', update)
    }
  }, [])

  useEffect(() => {
    const scan = () => setTenantHandoffVisible(Boolean(document.querySelector('.hi5-first-run-layer')))
    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let active = true
    getPreferences()
      .then((next) => {
        if (!active) return
        const merged = next.preferences ? mergePreferences(next.preferences) : defaultPreferences()
        setPayload(next)
        setPreferences(merged)

        const localSync = readJson(PREFERENCE_SYNC_KEY, {})
        const needsCrossDeviceSync = Boolean(next.firstLoginCompletedAt && next.preferences && localSync.userId !== next.user?.id)
        if (!next.firstLoginCompletedAt || needsCrossDeviceSync) applyPreferences(merged)
        if (next.firstLoginCompletedAt && next.user?.id) {
          try { window.localStorage.setItem(PREFERENCE_SYNC_KEY, JSON.stringify({ userId: next.user.id, syncedAt: Date.now() })) } catch { /* optional cache */ }
        }
      })
      .catch((loadError) => {
        if (!active) return
        if (loadError.message !== 'Authentication required.') setError(loadError.message)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!payload?.firstLoginCompletedAt || payload.coachmarksCompletedAt || payload.preferences?.guidance?.coachMarks === false) return undefined
    if (path !== '/dashboard' || tenantHandoffVisible) return undefined
    coachTimer.current = window.setTimeout(() => setCoachIndex(0), 900)
    return () => window.clearTimeout(coachTimer.current)
  }, [path, payload?.firstLoginCompletedAt, payload?.coachmarksCompletedAt, payload?.preferences?.guidance?.coachMarks, tenantHandoffVisible])

  async function complete(nextPreferences) {
    setSaving(true)
    setError('')
    try {
      applyPreferences(nextPreferences)
      const next = await patchPreferences(nextPreferences, { firstLoginComplete: true })
      setPayload(next)
      setPreferences(mergePreferences(next.preferences))
      if (next.user?.id) {
        try { window.localStorage.setItem(PREFERENCE_SYNC_KEY, JSON.stringify({ userId: next.user.id, syncedAt: Date.now() })) } catch { /* optional cache */ }
      }
      if (window.location.pathname !== '/dashboard') navigate('/dashboard')
      window.setTimeout(() => window.location.reload(), 180)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function completeCoachmarks() {
    setCoachIndex(-1)
    try {
      const next = await patchPreferences(preferences, { coachmarksComplete: true })
      setPayload(next)
    } catch {
      // Tips are non-critical; failing to persist must never block the workspace.
    }
  }

  async function dismissGettingStarted() {
    try {
      const next = await patchPreferences(preferences, { gettingStartedDismissed: true })
      setPayload(next)
    } catch {
      setPayload((current) => current ? { ...current, gettingStartedDismissedAt: new Date().toISOString() } : current)
    }
  }

  const showFirstLogin = useMemo(() => (
    !loading
      && payload
      && !payload.firstLoginCompletedAt
      && !tenantHandoffVisible
      && path !== '/login'
      && !path.startsWith('/onboarding')
  ), [loading, path, payload, tenantHandoffVisible])

  const showGettingStarted = Boolean(
    payload?.firstLoginCompletedAt
      && !payload?.gettingStartedDismissedAt
      && path === '/dashboard'
      && coachIndex < 0
      && !tenantHandoffVisible,
  )

  return (
    <>
      {showFirstLogin ? <FirstLoginDialog payload={payload} preferences={preferences} setPreferences={setPreferences} onComplete={complete} saving={saving} error={error} /> : null}
      {coachIndex >= 0 ? <CoachMarks index={coachIndex} onSkip={completeCoachmarks} onNext={() => coachIndex >= COACH_STEPS.length - 1 ? completeCoachmarks() : setCoachIndex((value) => value + 1)} /> : null}
      {showGettingStarted ? <GettingStarted payload={payload} onDismiss={dismissGettingStarted} /> : null}
    </>
  )
}

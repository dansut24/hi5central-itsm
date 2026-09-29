import { useEffect } from 'react'
import './ProductionSessionBoundary.css'

const API_BASE = window.__HI5_API_BASE__
const PRODUCTION_SESSION_KEY = 'hi5central-production-session-v1'
const DEPRECATED_SESSION_KEYS = ['hi5central-session', 'lsl-itsm-session']
const SETTINGS_RECOVERY_KEY = 'hi5central-production-settings-recovery-v1'

function clearDeprecatedSessionKeys() {
  for (const key of DEPRECATED_SESSION_KEYS) {
    try { window.localStorage.removeItem(key) } catch { /* best effort */ }
  }
}

function productionSessionExists() {
  try {
    const raw = window.localStorage.getItem(PRODUCTION_SESSION_KEY)
    if (!raw) return false
    const session = JSON.parse(raw)
    return session?.source === 'production' && Boolean(session?.tenantSlug)
  } catch {
    return false
  }
}

function settingsPath() {
  return window.location.pathname === '/settings' || window.location.pathname.startsWith('/settings/')
}

export function ProductionSessionBoundary() {
  useEffect(() => {
    clearDeprecatedSessionKeys()
    document.documentElement.dataset.hi5ProductionBoundary = 'true'
    document.body.dataset.hi5ProductionBoundary = 'true'

    let signingOut = false
    let settingsMissingSince = 0

    function protectSettingsSurface() {
      const frame = document.querySelector('.content-frame')
      const inSettings = settingsPath()
      if (frame instanceof HTMLElement) frame.classList.toggle('hi5-production-settings-route', inSettings)

      if (!inSettings) {
        settingsMissingSince = 0
        try { window.sessionStorage.removeItem(SETTINGS_RECOVERY_KEY) } catch { /* best effort */ }
        return
      }

      const shell = document.querySelector('.production-settings-shell')
      if (shell instanceof HTMLElement) {
        settingsMissingSince = 0
        try { window.sessionStorage.removeItem(SETTINGS_RECOVERY_KEY) } catch { /* best effort */ }
        return
      }

      if (!productionSessionExists()) return
      if (!settingsMissingSince) { settingsMissingSince = Date.now(); return }
      if (Date.now() - settingsMissingSince < 1800) return

      try {
        if (window.sessionStorage.getItem(SETTINGS_RECOVERY_KEY) === '1') return
        window.sessionStorage.setItem(SETTINGS_RECOVERY_KEY, '1')
      } catch { return }
      window.location.reload()
    }

    async function signOutFromProduction() {
      if (signingOut) return
      signingOut = true
      try {
        await fetch(`${API_BASE}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' })
      } catch {
        // Continue to sign-in even when the network is unavailable.
      } finally {
        try { window.localStorage.removeItem(PRODUCTION_SESSION_KEY) } catch { /* best effort */ }
        clearDeprecatedSessionKeys()
        try { window.sessionStorage.removeItem(SETTINGS_RECOVERY_KEY) } catch { /* best effort */ }
        window.location.replace('/login')
      }
    }

    function handleSignOut(event) {
      const button = event.target instanceof Element ? event.target.closest('button') : null
      if (!(button instanceof HTMLButtonElement)) return
      const isSignOut = button.classList.contains('chrome-logout')
        || button.getAttribute('aria-label') === 'Sign out'
        || button.getAttribute('title') === 'Sign out'
      if (!isSignOut) return

      const dirty = document.querySelector('.workspace-tab.dirty, .unsaved-dot')
      if (dirty && !window.confirm('You have unsaved changes. Sign out and discard them?')) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation?.()
      void signOutFromProduction()
    }

    function routeChanged() {
      settingsMissingSince = 0
      window.setTimeout(protectSettingsSurface, 0)
    }

    document.addEventListener('click', handleSignOut, true)
    window.addEventListener('popstate', routeChanged)
    window.addEventListener('hi5-routechange', routeChanged)

    const observer = new MutationObserver(protectSettingsSurface)
    observer.observe(document.body, { childList: true, subtree: true })
    const interval = window.setInterval(protectSettingsSurface, 450)
    protectSettingsSurface()

    return () => {
      document.removeEventListener('click', handleSignOut, true)
      window.removeEventListener('popstate', routeChanged)
      window.removeEventListener('hi5-routechange', routeChanged)
      observer.disconnect()
      window.clearInterval(interval)
      document.querySelector('.content-frame')?.classList.remove('hi5-production-settings-route')
      delete document.documentElement.dataset.hi5ProductionBoundary
      delete document.body.dataset.hi5ProductionBoundary
    }
  }, [])

  return null
}

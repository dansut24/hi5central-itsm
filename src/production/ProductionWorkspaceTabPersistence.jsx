import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const PRODUCTION_SESSION_KEY = 'hi5central-production-session-v1'
const WORKSPACE_KEY = 'hi5central-workspace-analyst'
const WORKSPACE_OWNER_KEY = 'hi5central-workspace-owner-v1'
const PREFERENCE_PREFIX = 'hi5central-workspace-persist-tabs-v1'
const SNAPSHOT_PREFIX = 'hi5central-workspace-user-v1'

let isolationInstalled = false

function parseJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function currentProductionSession() {
  return parseJson(window.localStorage.getItem(PRODUCTION_SESSION_KEY), null)
}

function sessionIdentity(session) {
  const tenantId = String(session?.tenantId || session?.tenant?.id || '').trim()
  const userId = String(session?.userId || session?.user?.id || '').trim()
  if (!tenantId || !userId) return ''
  return `${tenantId}:${userId}`
}

function preferenceKey(identity) {
  return `${PREFERENCE_PREFIX}:${identity}`
}

function snapshotKey(identity) {
  return `${SNAPSHOT_PREFIX}:${identity}`
}

function restoresTabs(identity) {
  if (!identity) return false
  return window.localStorage.getItem(preferenceKey(identity)) === 'restore'
}

function storePreference(identity, restore) {
  if (!identity) return
  window.localStorage.setItem(preferenceKey(identity), restore ? 'restore' : 'reset')
  if (restore) {
    const workspace = window.localStorage.getItem(WORKSPACE_KEY)
    if (workspace) window.localStorage.setItem(snapshotKey(identity), workspace)
  } else {
    window.localStorage.removeItem(snapshotKey(identity))
  }
}

function prepareWorkspaceForIdentity(identity) {
  if (!identity) {
    window.localStorage.removeItem(WORKSPACE_KEY)
    window.localStorage.removeItem(WORKSPACE_OWNER_KEY)
    return
  }

  const currentOwner = window.localStorage.getItem(WORKSPACE_OWNER_KEY)
  if (currentOwner === identity) return

  window.localStorage.removeItem(WORKSPACE_KEY)
  if (restoresTabs(identity)) {
    const saved = window.localStorage.getItem(snapshotKey(identity))
    if (saved) window.localStorage.setItem(WORKSPACE_KEY, saved)
  }
  window.localStorage.setItem(WORKSPACE_OWNER_KEY, identity)
}

function finaliseWorkspaceForIdentity(identity) {
  if (!identity) {
    window.localStorage.removeItem(WORKSPACE_KEY)
    window.localStorage.removeItem(WORKSPACE_OWNER_KEY)
    return
  }

  if (restoresTabs(identity)) {
    const workspace = window.localStorage.getItem(WORKSPACE_KEY)
    if (workspace) window.localStorage.setItem(snapshotKey(identity), workspace)
  } else {
    window.localStorage.removeItem(snapshotKey(identity))
  }

  window.localStorage.removeItem(WORKSPACE_KEY)
  if (window.localStorage.getItem(WORKSPACE_OWNER_KEY) === identity) {
    window.localStorage.removeItem(WORKSPACE_OWNER_KEY)
  }
}

export function installWorkspaceTabSessionIsolation() {
  if (isolationInstalled || typeof window === 'undefined' || !window.localStorage) return
  isolationInstalled = true

  const initialIdentity = sessionIdentity(currentProductionSession())
  if (initialIdentity) prepareWorkspaceForIdentity(initialIdentity)
  else prepareWorkspaceForIdentity('')

  const originalSetItem = window.Storage.prototype.setItem
  const originalRemoveItem = window.Storage.prototype.removeItem

  window.Storage.prototype.setItem = function hi5SetItem(key, value) {
    if (this === window.localStorage && key === PRODUCTION_SESSION_KEY) {
      const previousIdentity = sessionIdentity(parseJson(this.getItem(PRODUCTION_SESSION_KEY), null))
      const nextIdentity = sessionIdentity(parseJson(value, null))
      if (previousIdentity && previousIdentity !== nextIdentity) finaliseWorkspaceForIdentity(previousIdentity)
      if (nextIdentity && previousIdentity !== nextIdentity) prepareWorkspaceForIdentity(nextIdentity)
    }
    return originalSetItem.call(this, key, value)
  }

  window.Storage.prototype.removeItem = function hi5RemoveItem(key) {
    if (this === window.localStorage && key === PRODUCTION_SESSION_KEY) {
      const previousIdentity = sessionIdentity(parseJson(this.getItem(PRODUCTION_SESSION_KEY), null))
      if (previousIdentity) finaliseWorkspaceForIdentity(previousIdentity)
      else prepareWorkspaceForIdentity('')
    }
    return originalRemoveItem.call(this, key)
  }
}

function useCurrentIdentity() {
  const [identity, setIdentity] = useState(() => sessionIdentity(currentProductionSession()))

  useEffect(() => {
    const update = () => setIdentity(sessionIdentity(currentProductionSession()))
    update()
    const timer = window.setInterval(update, 500)
    window.addEventListener('focus', update)
    window.addEventListener('hi5-routechange', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', update)
      window.removeEventListener('hi5-routechange', update)
    }
  }, [])

  return identity
}

function useSettingsTarget(active) {
  const [target, setTarget] = useState(null)

  useEffect(() => {
    if (!active) {
      setTarget(null)
      return undefined
    }

    let mounted = null
    const attach = () => {
      const next = document.querySelector('.production-settings-content')
      if (!(next instanceof HTMLElement)) return false
      mounted = next
      setTarget(next)
      return true
    }

    if (attach()) return undefined
    const observer = new MutationObserver(() => {
      if (attach()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [active])

  return target
}

export function ProductionWorkspaceTabPersistence() {
  const identity = useCurrentIdentity()
  const [restore, setRestore] = useState(() => restoresTabs(identity))
  const [path, setPath] = useState(() => window.location.pathname)
  const active = Boolean(identity) && (path === '/settings/appearance' || path === '/settings/workspace')
  const target = useSettingsTarget(active)

  useEffect(() => {
    setRestore(restoresTabs(identity))
  }, [identity])

  useEffect(() => {
    const update = () => setPath(window.location.pathname)
    window.addEventListener('popstate', update)
    window.addEventListener('hi5-routechange', update)
    const timer = window.setInterval(update, 350)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener('hi5-routechange', update)
      window.clearInterval(timer)
    }
  }, [])

  function changePreference(event) {
    const next = event.target.value === 'restore'
    storePreference(identity, next)
    setRestore(next)
  }

  if (!active || !target) return null

  return createPortal(
    <section className="production-settings-panel">
      <header>
        <div>
          <h2>Workspace tabs</h2>
          <p>Choose what happens to your open tabs when you sign out. This preference is stored per user on this browser.</p>
        </div>
      </header>
      <div className="production-settings-panel-body">
        <div className="production-settings-grid">
          <label className="production-settings-field">
            <span>After sign-out</span>
            <select value={restore ? 'restore' : 'reset'} onChange={changePreference}>
              <option value="reset">Start next sign-in with Dashboard only</option>
              <option value="restore">Restore my open tabs on next sign-in</option>
            </select>
            <small>Dashboard-only is the default. Restored tabs are isolated to your tenant and user account and are never shared with another signed-in user.</small>
          </label>
        </div>
      </div>
    </section>,
    target,
  )
}

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Clock3, MessageCircleMore, RefreshCw, WifiOff } from 'lucide-react'

const API_BASE = window.__HI5_API_BASE__
const LIVE_CHAT_PREFERENCES_KEY = 'hi5central-live-chat-preferences-v1'
const LIVE_CHAT_TAB_SELECTOR = '.workspace-tab-livechat, .workspace-tab[data-tab-module="livechat"]'
const MENU_SELECTOR = '.production-workspace-menu'
const MENU_ANCHOR_ATTRIBUTE = 'data-hi5-live-chat-menu-anchor'
const HEARTBEAT_MS = 25_000

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw Object.assign(new Error(payload.error || 'Could not update Live Chat.'), {
      status: response.status,
    })
  }
  return payload
}

function selectedPersonEmail() {
  const drawer = document.querySelector('.org-person-drawer')
  if (!(drawer instanceof HTMLElement)) return ''

  const facts = [...drawer.querySelectorAll('.org-profile-facts > div')]
  const emailFact = facts.find((item) => item.querySelector('span')?.textContent?.trim() === 'Email')
  return emailFact?.querySelector('strong')?.textContent?.trim().toLowerCase() || ''
}

function liveChatWorkspaceEnabled() {
  return document.querySelector(LIVE_CHAT_TAB_SELECTOR) instanceof HTMLElement
}

function ensureMenuAnchor(menu) {
  let anchor = menu.querySelector(`[${MENU_ANCHOR_ATTRIBUTE}]`)
  if (anchor instanceof HTMLElement) return anchor

  anchor = document.createElement('div')
  anchor.setAttribute(MENU_ANCHOR_ATTRIBUTE, 'true')
  anchor.style.display = 'contents'

  const buttons = Array.from(menu.querySelectorAll(':scope > button'))
  const settingsButton = buttons.find((button) => button.textContent?.trim() === 'Settings')
  const signOutButton = buttons.find((button) => button.textContent?.trim() === 'Sign out')
  menu.insertBefore(anchor, settingsButton || signOutButton || null)
  return anchor
}

function closeWorkspaceMenu() {
  const backdrop = document.querySelector('.production-workspace-menu-backdrop')
  if (backdrop instanceof HTMLElement) backdrop.click()
}

function toggleLocalWorkspacePreference(enabled) {
  let current = {}
  try {
    current = JSON.parse(window.localStorage.getItem(LIVE_CHAT_PREFERENCES_KEY) || '{}') || {}
  } catch {
    current = {}
  }

  window.localStorage.setItem(LIVE_CHAT_PREFERENCES_KEY, JSON.stringify({
    ...current,
    enabled,
  }))
}

function presenceTone(status) {
  if (status === 'Online') return '#16a34a'
  if (status === 'Away') return '#d97706'
  return '#94a3b8'
}

export function ProductionWorkspaceLiveChatMenu() {
  const [menuAnchor, setMenuAnchor] = useState(null)
  const [workspaceEnabled, setWorkspaceEnabled] = useState(() => liveChatWorkspaceEnabled())
  const [personEmail, setPersonEmail] = useState(() => selectedPersonEmail())
  const [person, setPerson] = useState(null)
  const [personLoading, setPersonLoading] = useState(false)
  const [presence, setPresence] = useState({ status: 'Offline', desiredStatus: 'Offline', support: null })
  const [presenceLoading, setPresenceLoading] = useState(false)
  const [error, setError] = useState('')
  const personRequestRef = useRef(0)
  const workspaceEnabledRef = useRef(workspaceEnabled)
  const desiredPresenceRef = useRef(presence.desiredStatus)

  useEffect(() => { workspaceEnabledRef.current = workspaceEnabled }, [workspaceEnabled])
  useEffect(() => { desiredPresenceRef.current = presence.desiredStatus }, [presence.desiredStatus])

  useEffect(() => {
    const scan = () => {
      const menu = document.querySelector(MENU_SELECTOR)
      setMenuAnchor((current) => {
        if (!(menu instanceof HTMLElement)) return null
        const next = ensureMenuAnchor(menu)
        return current === next ? current : next
      })

      setWorkspaceEnabled(liveChatWorkspaceEnabled())

      const email = selectedPersonEmail()
      setPersonEmail((current) => current === email ? current : email)
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    })

    const timer = window.setInterval(scan, 700)
    window.addEventListener('hi5-routechange', scan)
    window.addEventListener('hi5-organisation-hydrated', scan)

    return () => {
      observer.disconnect()
      window.clearInterval(timer)
      window.removeEventListener('hi5-routechange', scan)
      window.removeEventListener('hi5-organisation-hydrated', scan)
    }
  }, [])

  useEffect(() => {
    let active = true

    const refreshPresence = async ({ heartbeat = false } = {}) => {
      try {
        const next = await api(heartbeat
          ? '/api/v1/live-chat/presence/heartbeat'
          : '/api/v1/live-chat/presence', heartbeat ? { method: 'POST' } : {})
        if (active) setPresence(next)
      } catch (nextError) {
        if (active && nextError.status !== 401) setError(nextError.message)
      }
    }

    refreshPresence().then(() => {
      if (workspaceEnabledRef.current && ['Online', 'Away'].includes(desiredPresenceRef.current)) {
        refreshPresence({ heartbeat: true })
      }
    })

    const timer = window.setInterval(() => {
      if (!workspaceEnabledRef.current) return
      if (!['Online', 'Away'].includes(desiredPresenceRef.current)) return
      refreshPresence({ heartbeat: true })
    }, HEARTBEAT_MS)

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      refreshPresence().then(() => {
        if (workspaceEnabledRef.current && ['Online', 'Away'].includes(desiredPresenceRef.current)) {
          refreshPresence({ heartbeat: true })
        }
      })
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  useEffect(() => {
    const requestId = personRequestRef.current + 1
    personRequestRef.current = requestId
    setPerson(null)
    setError('')

    if (!personEmail) return undefined

    let active = true
    setPersonLoading(true)

    ;(async () => {
      try {
        const organisation = await api('/api/v1/organisation')
        const matched = (organisation.people || []).find(
          (item) => String(item.email || '').trim().toLowerCase() === personEmail,
        )
        if (!matched) return

        const entitlement = await api(`/api/v1/live-chat/entitlements/${encodeURIComponent(matched.id)}`)
        if (!active || personRequestRef.current !== requestId) return

        setPerson({
          ...matched,
          liveChatEnabled: Boolean(entitlement.liveChatEnabled),
        })
      } catch (nextError) {
        if (active && personRequestRef.current === requestId) setError(nextError.message)
      } finally {
        if (active && personRequestRef.current === requestId) setPersonLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [personEmail])

  async function toggleWorkspaceLiveChat() {
    const nextEnabled = !workspaceEnabled
    if (!nextEnabled && presence.desiredStatus !== 'Offline') {
      try {
        await api('/api/v1/live-chat/presence', {
          method: 'PATCH',
          body: JSON.stringify({ status: 'Offline' }),
        })
      } catch {
        // The local workspace preference must remain recoverable even if the API is unavailable.
      }
    }
    toggleLocalWorkspacePreference(nextEnabled)
    closeWorkspaceMenu()
    window.location.reload()
  }

  async function setAnalystPresence(status) {
    if (presenceLoading || (status !== 'Offline' && !workspaceEnabled)) return
    setPresenceLoading(true)
    setError('')
    try {
      const next = await api('/api/v1/live-chat/presence', {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setPresence(next)
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setPresenceLoading(false)
    }
  }

  async function togglePersonLiveChat() {
    if (!person || personLoading) return
    setPersonLoading(true)
    setError('')

    try {
      const result = await api(`/api/v1/live-chat/entitlements/${encodeURIComponent(person.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !person.liveChatEnabled }),
      })
      setPerson((current) => current ? {
        ...current,
        liveChatEnabled: Boolean(result.liveChatEnabled),
      } : current)
      closeWorkspaceMenu()
    } catch (nextError) {
      setError(nextError.status === 403
        ? 'Only a tenant owner or administrator can change Portal Live Chat access.'
        : nextError.message)
    } finally {
      setPersonLoading(false)
    }
  }

  if (!(menuAnchor instanceof HTMLElement)) return null

  return createPortal(
    <>
      <span className="production-workspace-menu-separator" role="separator" />
      <div
        role="group"
        aria-label="Live Chat presence"
        style={{ padding: '4px 7px 3px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '3px 2px 6px' }}>
          <span
            aria-hidden="true"
            style={{ width: '8px', height: '8px', borderRadius: '50%', background: presenceTone(presence.status), boxShadow: `0 0 0 3px ${presenceTone(presence.status)}22` }}
          />
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <small style={{ color: 'var(--muted)', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>Live Chat presence</small>
            <strong style={{ fontSize: '11px' }}>{presence.status}{presence.status !== presence.desiredStatus ? ` · ${presence.desiredStatus} selected` : ''}</strong>
          </span>
          {presenceLoading ? <RefreshCw className="is-spinning" size={13} style={{ marginLeft: 'auto' }} /> : null}
        </div>
        {['Online', 'Away', 'Offline'].map((status) => (
          <button
            disabled={presenceLoading || (status !== 'Offline' && !workspaceEnabled)}
            key={status}
            onClick={() => setAnalystPresence(status)}
            role="menuitemradio"
            aria-checked={presence.desiredStatus === status}
            type="button"
          >
            {status === 'Online'
              ? <MessageCircleMore size={14} aria-hidden="true" />
              : status === 'Away'
                ? <Clock3 size={14} aria-hidden="true" />
                : <WifiOff size={14} aria-hidden="true" />}
            {status === 'Online' ? 'Go Online' : status === 'Away' ? 'Set Away' : 'Go Offline'}
            {presence.desiredStatus === status ? <Check size={13} aria-hidden="true" style={{ marginLeft: 'auto' }} /> : null}
          </button>
        ))}
        {!workspaceEnabled ? <small style={{ display: 'block', padding: '3px 3px 5px', color: 'var(--muted)', fontSize: '9px' }}>Enable the Live Chat workspace before going Online or Away.</small> : null}
      </div>
      <button onClick={toggleWorkspaceLiveChat} role="menuitem" type="button">
        <MessageCircleMore size={14} aria-hidden="true" />
        {workspaceEnabled ? 'Disable Live Chat workspace' : 'Enable Live Chat workspace'}
      </button>
      {person ? (
        <button
          disabled={personLoading || person.active === false}
          onClick={togglePersonLiveChat}
          role="menuitem"
          title={`${person.liveChatEnabled ? 'Disable' : 'Enable'} Portal Live Chat for ${person.name}`}
          type="button"
        >
          {personLoading
            ? <RefreshCw className="is-spinning" size={14} aria-hidden="true" />
            : <MessageCircleMore size={14} aria-hidden="true" />}
          {person.liveChatEnabled ? 'Disable' : 'Enable'} Portal Chat · {person.name}
        </button>
      ) : null}
      {error ? (
        <div
          role="status"
          style={{
            padding: '5px 9px 7px',
            color: 'var(--danger, #b42318)',
            fontSize: '10px',
            lineHeight: 1.35,
          }}
        >
          {error}
        </div>
      ) : null}
    </>,
    menuAnchor,
  )
}

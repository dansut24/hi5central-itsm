import { useEffect } from 'react'

const PRODUCTION_SESSION_KEY = 'hi5central-production-session-v1'
const REDIRECT_GUARD_KEY = 'hi5central-first-login-route-bridge-v1'

function hasProductionSession() {
  try {
    const raw = window.localStorage.getItem(PRODUCTION_SESSION_KEY)
    if (!raw) return false
    const session = JSON.parse(raw)
    return Boolean(session?.source === 'production' && session?.tenantSlug)
  } catch {
    return false
  }
}

export function ProductionFirstLoginRouteBridge() {
  useEffect(() => {
    let redirected = false

    const check = () => {
      if (redirected || !hasProductionSession()) return
      const path = window.location.pathname
      if (path !== '/' && path !== '/login') return
      if (!(document.querySelector('.app-shell') instanceof HTMLElement)) return

      try {
        const last = Number(window.sessionStorage.getItem(REDIRECT_GUARD_KEY) || 0)
        if (Date.now() - last < 5_000) return
        window.sessionStorage.setItem(REDIRECT_GUARD_KEY, String(Date.now()))
      } catch {
        // Redirect remains safe without a session guard.
      }

      redirected = true
      window.location.replace('/dashboard')
    }

    check()
    const observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true, subtree: true })
    const timer = window.setInterval(check, 350)

    return () => {
      observer.disconnect()
      window.clearInterval(timer)
    }
  }, [])

  return null
}

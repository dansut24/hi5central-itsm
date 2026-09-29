const AUTH_HANDOFF_KEY = 'hi5central-auth-handoff-v1'
const HANDOFF_MAX_AGE_MS = 2 * 60 * 1000

function tenantSlugFromHost() {
  const host = window.location.hostname.toLowerCase()
  const match = host.match(/^([a-z0-9-]+)\.hi5central\.com$/)
  if (!match) return ''
  const slug = match[1]
  if (slug.endsWith('-portal') || slug.endsWith('-rmm')) return ''
  return slug
}

export function storeProductionAuthHandoff(payload) {
  if (!payload?.authenticated || !payload?.tenant?.slug) return false
  try {
    window.sessionStorage.setItem(AUTH_HANDOFF_KEY, JSON.stringify({
      createdAt: Date.now(),
      payload,
    }))
    return true
  } catch {
    return false
  }
}

export function takeProductionAuthHandoff() {
  try {
    const raw = window.sessionStorage.getItem(AUTH_HANDOFF_KEY)
    if (!raw) return null

    const stored = JSON.parse(raw)
    const payload = stored?.payload || stored
    const createdAt = Number(stored?.createdAt || 0)
    const tenantSlug = tenantSlugFromHost()

    const stale = createdAt > 0 && Date.now() - createdAt > HANDOFF_MAX_AGE_MS
    const valid = !stale
      && payload?.authenticated === true
      && payload?.tenant?.slug === tenantSlug

    window.sessionStorage.removeItem(AUTH_HANDOFF_KEY)
    return valid ? payload : null
  } catch {
    try {
      window.sessionStorage.removeItem(AUTH_HANDOFF_KEY)
    } catch {
      // Ignore storage failures; the HttpOnly cookie remains authoritative.
    }
    return null
  }
}

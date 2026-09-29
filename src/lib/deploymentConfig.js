const DEFAULT_ROOT_DOMAIN = 'hi5central.com'
const DEFAULT_PRIMARY_TENANT = ''

function runtimeSource() {
  if (typeof window === 'undefined') return {}
  const value = window.__HI5_CONFIG__
  return value && typeof value === 'object' ? value : {}
}

function envSource() {
  try {
    return import.meta.env || {}
  } catch {
    return {}
  }
}

function enumValue(value, allowed, fallback) {
  const normalized = String(value || '').trim().toLowerCase()
  return allowed.includes(normalized) ? normalized : fallback
}

function cleanDomain(value, fallback = '') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
  return normalized || fallback
}

function cleanSlug(value, fallback = DEFAULT_PRIMARY_TENANT) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
  return normalized || fallback
}

function cleanUrl(value, fallback = '') {
  const raw = String(value || '').trim()
  if (!raw) return fallback
  try {
    const url = new URL(raw)
    return `${url.protocol}//${url.host}${url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '')}`
  } catch {
    return fallback
  }
}

function originOf(value) {
  try {
    return new URL(value).origin.toLowerCase()
  } catch {
    return ''
  }
}

export function deploymentConfig() {
  const runtime = runtimeSource()
  const env = envSource()
  const deploymentMode = enumValue(
    runtime.deploymentMode || env.VITE_DEPLOYMENT_MODE,
    ['managed', 'self_hosted'],
    'managed',
  )
  const tenancyMode = enumValue(
    runtime.tenancyMode || env.VITE_TENANCY_MODE,
    ['multi', 'single'],
    'multi',
  )
  const rootDomain = cleanDomain(runtime.rootDomain || env.VITE_ROOT_DOMAIN, DEFAULT_ROOT_DOMAIN)
  const primaryTenantSlug = cleanSlug(runtime.primaryTenantSlug || env.VITE_PRIMARY_TENANT_SLUG)
  const defaultAppUrl = tenancyMode === 'single' ? `https://${rootDomain}` : ''
  const appUrl = cleanUrl(runtime.appUrl || env.VITE_APP_URL, defaultAppUrl)
  const portalUrl = cleanUrl(runtime.portalUrl || env.VITE_PORTAL_URL)
  const rmmUrl = cleanUrl(runtime.rmmUrl || env.VITE_RMM_URL)
  const apiUrl = cleanUrl(runtime.apiUrl || env.VITE_API_URL)
  const marketingUrl = cleanUrl(
    runtime.marketingUrl || env.VITE_MARKETING_URL,
    deploymentMode === 'managed' ? `https://${rootDomain}` : appUrl,
  )

  return Object.freeze({
    deploymentMode,
    tenancyMode,
    rootDomain,
    primaryTenantSlug,
    appUrl,
    portalUrl,
    rmmUrl,
    apiUrl,
    marketingUrl,
    appOrigin: originOf(appUrl),
    portalOrigin: originOf(portalUrl),
    rmmOrigin: originOf(rmmUrl),
    marketingOrigin: originOf(marketingUrl),
  })
}

export function isSingleTenantDeployment() {
  return deploymentConfig().tenancyMode === 'single'
}

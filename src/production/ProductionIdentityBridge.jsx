import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { UserRound } from 'lucide-react'
import './ProductionIdentityBridge.css'

function initials(name = '') {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'HC'
}

function hasPermission(session, permission) {
  const effective = session?.access?.effectivePermissions || []
  const grants = session?.access?.permissions || []
  if (effective.includes(permission) || grants.includes('*') || grants.includes(permission)) return true
  return grants.some((grant) => grant.endsWith('*') && permission.startsWith(grant.slice(0, -1)))
}

function openProfile() {
  if (window.location.pathname === '/profile') return
  window.history.pushState({}, '', '/profile')
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.dispatchEvent(new CustomEvent('hi5-routechange', { detail: { path: '/profile' } }))
}

function AccountButton({ compact, session }) {
  const user = session?.user || {}
  const name = user.name || 'Hi5Central user'
  const email = user.email || ''

  return (
    <button
      aria-label={`Signed in as ${name}. Open profile.`}
      className={compact ? 'production-account-chip is-compact' : 'production-account-chip'}
      onClick={openProfile}
      title={email ? `${name} · ${email}` : name}
      type="button"
    >
      <span className="production-account-avatar">{initials(name)}</span>
      {!compact ? (
        <span className="production-account-copy">
          <strong>{name}</strong>
          <small>{email || 'Open profile'}</small>
        </span>
      ) : null}
      {!compact ? <UserRound size={15} aria-hidden="true" /> : null}
    </button>
  )
}

export function ProductionIdentityBridge({ session }) {
  const [desktopTarget, setDesktopTarget] = useState(null)
  const [mobileTarget, setMobileTarget] = useState(null)
  const canViewSettings = useMemo(() => hasPermission(session, 'settings.view'), [session])

  useEffect(() => {
    document.documentElement.dataset.hi5SettingsAccess = canViewSettings ? 'true' : 'false'
    return () => { delete document.documentElement.dataset.hi5SettingsAccess }
  }, [canViewSettings])

  useEffect(() => {
    const attach = () => {
      const nextDesktop = document.querySelector('.chrome-actions')
      const nextMobile = document.querySelector('.breadcrumb-mobile-actions')
      if (nextDesktop instanceof HTMLElement) setDesktopTarget(nextDesktop)
      if (nextMobile instanceof HTMLElement) setMobileTarget(nextMobile)
      return Boolean(nextDesktop || nextMobile)
    }

    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <>
      {desktopTarget ? createPortal(<AccountButton session={session} />, desktopTarget) : null}
      {mobileTarget ? createPortal(<AccountButton compact session={session} />, mobileTarget) : null}
    </>
  )
}

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, PackageOpen } from 'lucide-react'
import { ServiceCatalogueAdminV2 } from './ServiceCatalogueAdminV2.jsx'
import './ServiceCatalogueSettingsEnhancer.css'

const API_BASE = window.__HI5_API_BASE__
const CATALOGUE_PATH = '/settings/itsm/service-catalogue'

function groupFor(nav, label) {
  if (!nav) return null
  return [...nav.querySelectorAll(':scope > section')].find((section) => section.querySelector(':scope > span')?.textContent?.trim() === label) || null
}

export function ServiceCatalogueSettingsEnhancer() {
  const [active, setActive] = useState(() => window.location.pathname === CATALOGUE_PATH)
  const [catalogueReady, setCatalogueReady] = useState(false)
  const [desktopGroup, setDesktopGroup] = useState(null)
  const [mobileGroup, setMobileGroup] = useState(null)
  const [contentHost, setContentHost] = useState(null)
  const [shell, setShell] = useState(null)

  useEffect(() => {
    let frame = 0

    const syncRoute = () => setActive(window.location.pathname === CATALOGUE_PATH)
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const nextShell = document.querySelector('.production-settings-shell')
        const nextContent = nextShell?.querySelector('.production-settings-content') || null
        const desktopNav = nextShell?.querySelector('.production-settings-nav') || null
        const mobileNav = nextShell?.querySelector('.production-settings-inline-nav') || null
        setShell((current) => current === nextShell ? current : nextShell)
        setContentHost((current) => current === nextContent ? current : nextContent)
        const nextDesktop = groupFor(desktopNav, 'ITSM')
        const nextMobile = groupFor(mobileNav, 'ITSM')
        setDesktopGroup((current) => current === nextDesktop ? current : nextDesktop)
        setMobileGroup((current) => current === nextMobile ? current : nextMobile)

        if (nextShell && window.location.pathname === CATALOGUE_PATH) {
          nextShell.classList.add('service-catalogue-route')
          const title = nextShell.querySelector('.production-settings-topbar h1')
          if (title && title.textContent !== 'Service catalogue') title.textContent = 'Service catalogue'
        }
      })
    }

    measure()
    syncRoute()
    const observer = new MutationObserver(measure)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    window.addEventListener('popstate', syncRoute)
    window.addEventListener('hi5-routechange', syncRoute)
    window.addEventListener('hi5-routechange', measure)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('popstate', syncRoute)
      window.removeEventListener('hi5-routechange', syncRoute)
      window.removeEventListener('hi5-routechange', measure)
    }
  }, [])

  useEffect(() => {
    if (!shell) return undefined
    shell.classList.toggle('service-catalogue-route', active)
    if (active) {
      const title = shell.querySelector('.production-settings-topbar h1')
      if (title) title.textContent = 'Service catalogue'
    }
    return () => shell.classList.remove('service-catalogue-route')
  }, [active, shell])

  useEffect(() => {
    if (!active) {
      setCatalogueReady(false)
      return undefined
    }
    let alive = true
    setCatalogueReady(false)
    fetch(`${API_BASE}/api/v1/organisation`, { credentials: 'include', cache: 'no-store' })
      .catch(() => null)
      .finally(() => { if (alive) setCatalogueReady(true) })
    return () => { alive = false }
  }, [active])

  function navigate() {
    if (window.location.pathname !== CATALOGUE_PATH) window.history.pushState({}, '', CATALOGUE_PATH)
    setActive(true)
    window.dispatchEvent(new Event('hi5-routechange'))
  }

  function navButton(inline = false) {
    return (
      <button
        aria-current={active ? 'page' : undefined}
        className={`service-catalogue-nav-button ${active ? 'is-active' : ''}`}
        onClick={navigate}
        type="button"
      >
        <PackageOpen size={16} />
        <span>Service catalogue</span>
        {!inline ? <ChevronRight size={14} /> : null}
      </button>
    )
  }

  return (
    <>
      {desktopGroup ? createPortal(navButton(false), desktopGroup) : null}
      {mobileGroup ? createPortal(navButton(true), mobileGroup) : null}
      {active && contentHost && catalogueReady ? createPortal(<ServiceCatalogueAdminV2 />, contentHost) : null}
    </>
  )
}

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import './ProductionNavigationStyles.css'

const DESKTOP_SIDE_KEY = 'hi5central-primary-nav-side-v1'
const MOBILE_SIDE_KEY = 'hi5central-mobile-nav-side-v1'
const NAV_STYLE_KEY = 'hi5central-primary-nav-style-v1'
const VALID_SIDES = new Set(['left', 'right'])
const VALID_STYLES = new Set(['floating', 'clean'])

function readPreference(key, validValues, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    const value = raw ? JSON.parse(raw) : fallback
    return validValues.has(value) ? value : fallback
  } catch {
    return fallback
  }
}

function applyNavigation(desktopSide, mobileSide, navStyle) {
  const desktop = VALID_SIDES.has(desktopSide) ? desktopSide : 'left'
  const mobile = VALID_SIDES.has(mobileSide) ? mobileSide : 'left'
  const style = VALID_STYLES.has(navStyle) ? navStyle : 'floating'
  document.documentElement.dataset.hi5NavSide = desktop
  document.documentElement.dataset.hi5MobileNavSide = mobile
  document.documentElement.dataset.hi5NavStyle = style
  document.body.dataset.hi5NavSide = desktop
  document.body.dataset.hi5MobileNavSide = mobile
  document.body.dataset.hi5NavStyle = style

  const shell = document.querySelector('.app-shell')
  if (shell instanceof HTMLElement) {
    shell.dataset.navSide = desktop
    shell.dataset.mobileNavSide = mobile
    shell.dataset.navStyle = style
  }
}

export function ProductionNavigationDockPreferences() {
  const [desktopSide, setDesktopSide] = useState(() => readPreference(DESKTOP_SIDE_KEY, VALID_SIDES, 'left'))
  const [mobileSide, setMobileSide] = useState(() => readPreference(MOBILE_SIDE_KEY, VALID_SIDES, 'left'))
  const [navStyle, setNavStyle] = useState(() => readPreference(NAV_STYLE_KEY, VALID_STYLES, 'floating'))
  const [settingsTarget, setSettingsTarget] = useState(null)

  useEffect(() => {
    applyNavigation(desktopSide, mobileSide, navStyle)
    try {
      window.localStorage.setItem(DESKTOP_SIDE_KEY, JSON.stringify(desktopSide))
      window.localStorage.setItem(MOBILE_SIDE_KEY, JSON.stringify(mobileSide))
      window.localStorage.setItem(NAV_STYLE_KEY, JSON.stringify(navStyle))
    } catch {
      // Personal workspace preference only; the server preference bridge will retry next session.
    }
    window.dispatchEvent(new CustomEvent('hi5-navigation-side-change', {
      detail: { desktopSide, mobileSide, navStyle },
    }))
  }, [desktopSide, mobileSide, navStyle])

  useEffect(() => {
    const syncFromStorage = () => {
      setDesktopSide(readPreference(DESKTOP_SIDE_KEY, VALID_SIDES, 'left'))
      setMobileSide(readPreference(MOBILE_SIDE_KEY, VALID_SIDES, 'left'))
      setNavStyle(readPreference(NAV_STYLE_KEY, VALID_STYLES, 'floating'))
    }

    const scan = () => {
      applyNavigation(
        readPreference(DESKTOP_SIDE_KEY, VALID_SIDES, 'left'),
        readPreference(MOBILE_SIDE_KEY, VALID_SIDES, 'left'),
        readPreference(NAV_STYLE_KEY, VALID_STYLES, 'floating'),
      )
      if (window.location.pathname !== '/settings/appearance') {
        setSettingsTarget(null)
        return
      }

      const panels = Array.from(document.querySelectorAll('.production-settings-panel'))
      const workspacePanel = panels.find((panel) => (
        panel.querySelector('h2')?.textContent?.trim().toLowerCase() === 'workspace navigation'
      ))
      const grid = workspacePanel?.querySelector('.production-settings-grid')
      setSettingsTarget(grid instanceof HTMLElement ? grid : null)
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    const timer = window.setInterval(scan, 700)
    window.addEventListener('hi5-routechange', scan)
    window.addEventListener('storage', syncFromStorage)

    return () => {
      observer.disconnect()
      window.clearInterval(timer)
      window.removeEventListener('hi5-routechange', scan)
      window.removeEventListener('storage', syncFromStorage)
    }
  }, [])

  if (!settingsTarget) return null

  return createPortal(
    <>
      <label className="production-settings-field hi5-navigation-side-field">
        <span>Desktop sidebar dock</span>
        <select value={desktopSide} onChange={(event) => setDesktopSide(event.target.value)}>
          <option value="left">Left side</option>
          <option value="right">Right side</option>
        </select>
        <small>Move primary navigation to the side that is most comfortable to reach.</small>
      </label>

      <label className="production-settings-field hi5-navigation-side-field">
        <span>Sidebar style</span>
        <select value={navStyle} onChange={(event) => setNavStyle(event.target.value)}>
          <option value="floating">Floating glass</option>
          <option value="clean">Clean panel</option>
        </select>
        <small>Floating glass keeps the curved Liquid Glass treatment. Clean panel matches the restrained Settings navigation style.</small>
      </label>

      <label className="production-settings-field hi5-navigation-side-field">
        <span>Mobile navigation button</span>
        <select value={mobileSide} onChange={(event) => setMobileSide(event.target.value)}>
          <option value="left">Left side</option>
          <option value="right">Right side</option>
        </select>
        <small>The floating drawer opens from the same side as the navigation button.</small>
      </label>
    </>,
    settingsTarget,
  )
}

import { useEffect } from 'react'

const TOKENS = [
  '--page',
  '--surface',
  '--surface-soft',
  '--surface-strong',
  '--ink',
  '--muted',
  '--line',
  '--brand',
  '--brand-strong',
  '--brand-2',
  '--accent-ink',
  '--accent-rgb',
  '--danger',
  '--warning',
  '--steady',
  '--purple',
  '--soft-shadow',
]

export function ProductionPortalThemeBridge() {
  useEffect(() => {
    let lastSignature = ''

    const sync = () => {
      const shell = document.querySelector('.app-shell')
      if (!(shell instanceof HTMLElement)) return
      const computed = getComputedStyle(shell)
      const values = TOKENS.map((token) => [token, computed.getPropertyValue(token).trim()])
      const signature = values.map(([token, value]) => `${token}:${value}`).join('|')
      if (signature === lastSignature) return
      lastSignature = signature
      for (const [token, value] of values) {
        if (value) document.body.style.setProperty(token, value)
      }
      document.body.dataset.hi5WorkspaceTheme = shell.dataset.theme || 'light'
    }

    sync()
    const timer = window.setInterval(sync, 500)
    window.addEventListener('hi5-theme-change', sync)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('hi5-theme-change', sync)
    }
  }, [])

  return null
}

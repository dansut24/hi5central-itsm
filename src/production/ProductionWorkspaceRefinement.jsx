import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import './ProductionWorkspaceRefinement.css'

const ACCENTS = new Set(['amber', 'cyan', 'blue', 'violet', 'emerald', 'rose'])
const THEMES = new Set(['system', 'light', 'dark'])
const SCROLL_TARGETS = [
  { selector: '.production-settings-nav', kind: 'settings' },
  { selector: '.nav-stack', kind: 'primary' },
  { selector: '.production-unified-detail-nav-scroll', kind: 'record' },
]

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function resolvedTheme(mode) {
  if (mode === 'dark' || mode === 'light') return mode
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function preferenceSnapshot() {
  const accent = readJson('hi5central-accent', 'amber')
  const theme = readJson('hi5central-theme-mode', 'system')
  return {
    accent: ACCENTS.has(accent) ? accent : 'amber',
    theme: THEMES.has(theme) ? theme : 'system',
  }
}

function applyPreferences(next = preferenceSnapshot()) {
  const shell = document.querySelector('.app-shell')
  if (!(shell instanceof HTMLElement)) return
  shell.dataset.accent = next.accent
  shell.dataset.theme = resolvedTheme(next.theme)
  document.documentElement.dataset.hi5Accent = next.accent
  document.documentElement.dataset.hi5Theme = next.theme
  document.body.dataset.hi5Accent = next.accent
  document.body.dataset.hi5Theme = next.theme
}

function hostFor(target, kind) {
  if (!(target instanceof HTMLElement)) return null
  if (kind === 'settings') return target.closest('.production-settings-sidebar')
  if (kind === 'primary') return target.closest('.sidebar')
  if (kind === 'record') return target.closest('.production-unified-rail')
  return target.parentElement
}

function ScrollAssist({ target, kind }) {
  const [state, setState] = useState({ up: false, down: false })
  const host = useMemo(() => hostFor(target, kind), [kind, target])

  useEffect(() => {
    if (!(target instanceof HTMLElement)) return undefined

    const update = () => {
      const max = Math.max(0, target.scrollHeight - target.clientHeight)
      setState({
        up: target.scrollTop > 3,
        down: max > 4 && target.scrollTop < max - 3,
      })
    }

    update()
    target.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)

    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(target)
    Array.from(target.children).slice(0, 12).forEach((child) => resizeObserver.observe(child))

    const mutationObserver = new MutationObserver(update)
    mutationObserver.observe(target, { childList: true, subtree: true, attributes: true })

    return () => {
      target.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [target])

  if (!(host instanceof HTMLElement)) return null

  const move = (direction) => {
    target.scrollBy({
      top: direction * Math.max(160, Math.round(target.clientHeight * 0.68)),
      behavior: 'smooth',
    })
  }

  return createPortal(
    <div className={`production-scroll-assist is-${kind}`} aria-hidden={!state.up && !state.down}>
      <button aria-label="Scroll navigation up" className={!state.up ? 'is-hidden' : ''} onClick={() => move(-1)} tabIndex={state.up ? 0 : -1} type="button"><ChevronUp size={16} /></button>
      <button aria-label="Scroll navigation down" className={!state.down ? 'is-hidden' : ''} onClick={() => move(1)} tabIndex={state.down ? 0 : -1} type="button"><ChevronDown size={16} /></button>
    </div>,
    host,
  )
}

export function ProductionWorkspaceRefinement() {
  const [targets, setTargets] = useState([])
  const targetSignatureRef = useRef('')

  useEffect(() => {
    const scan = () => {
      const next = []
      for (const definition of SCROLL_TARGETS) {
        document.querySelectorAll(definition.selector).forEach((node, index) => {
          if (node instanceof HTMLElement) next.push({ target: node, kind: definition.kind, key: `${definition.kind}-${index}` })
        })
      }
      const nextSignature = next.map((item) => `${item.key}:${item.target.className}:${item.target.scrollHeight}:${item.target.clientHeight}`).join('|')
      if (nextSignature !== targetSignatureRef.current) {
        targetSignatureRef.current = nextSignature
        setTargets(next)
      }
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('hi5-routechange', scan)
    window.addEventListener('resize', scan)
    const timer = window.setInterval(scan, 900)

    return () => {
      observer.disconnect()
      window.removeEventListener('hi5-routechange', scan)
      window.removeEventListener('resize', scan)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    let last = ''
    const sync = () => {
      const next = preferenceSnapshot()
      const signature = `${next.accent}:${next.theme}:${resolvedTheme(next.theme)}`
      if (signature !== last) {
        last = signature
        applyPreferences(next)
        window.dispatchEvent(new CustomEvent('hi5-runtime-preferences-applied', { detail: next }))
      }
    }

    sync()
    const timer = window.setInterval(sync, 120)
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const mediaListener = () => { last = ''; sync() }
    media?.addEventListener?.('change', mediaListener)
    window.addEventListener('storage', sync)
    window.addEventListener('focus', sync)
    window.addEventListener('hi5-settings-saved', sync)

    return () => {
      window.clearInterval(timer)
      media?.removeEventListener?.('change', mediaListener)
      window.removeEventListener('storage', sync)
      window.removeEventListener('focus', sync)
      window.removeEventListener('hi5-settings-saved', sync)
    }
  }, [])

  return targets.map((item) => <ScrollAssist key={item.key} kind={item.kind} target={item.target} />)
}

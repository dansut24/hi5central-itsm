import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Search, X } from 'lucide-react'
import './ProductionRecordListInteractionEnhancer.css'

const ROUTES = {
  '/incidents': 'Incident',
  '/requests': 'Service Request',
  '/problems': 'Problem',
  '/changes': 'Change',
}

const SELECTION_PREFIX = 'hi5central-record-selection-v1'
const SELECTION_EVENT = 'hi5-record-selection-changed'

function currentType() {
  return ROUTES[window.location.pathname] || null
}

function selectionKey(type) {
  return `${SELECTION_PREFIX}:${type}`
}

function readSelection(type) {
  if (!type) return []
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(selectionKey(type)) || '[]')
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return []
  }
}

function recordIdFromNode(node) {
  if (!(node instanceof HTMLElement)) return ''
  return node.querySelector('.production-record-reference')?.textContent?.trim()
    || node.querySelector('.production-record-card-open > div:first-child > strong')?.textContent?.trim()
    || node.querySelector(':scope > strong')?.textContent?.trim()
    || ''
}

function collectTargets() {
  const toolbar = document.querySelector('.production-record-toolbar')
  const search = toolbar?.querySelector('.production-record-search') || null
  const resultLine = document.querySelector('.production-record-result-line')
  if (!(toolbar instanceof HTMLElement)) return { toolbar: null, search: null, resultLine: null, entries: [] }

  const entries = []
  document.querySelectorAll('.production-record-table tbody tr').forEach((row) => {
    const id = recordIdFromNode(row)
    const target = row.querySelector('td:first-child')
    if (id && target instanceof HTMLElement) entries.push({ id, kind: 'table', node: target })
  })
  document.querySelectorAll('.production-record-card').forEach((card) => {
    const id = recordIdFromNode(card)
    if (id && card instanceof HTMLElement) entries.push({ id, kind: 'card', node: card })
  })
  document.querySelectorAll('.production-record-compact-list > button').forEach((row) => {
    const id = recordIdFromNode(row)
    if (id && row instanceof HTMLElement) entries.push({ id, kind: 'compact', node: row })
  })

  return {
    toolbar,
    search: search instanceof HTMLElement ? search : null,
    resultLine: resultLine instanceof HTMLElement ? resultLine : null,
    entries,
  }
}

function sameTargets(left, right) {
  if (left.toolbar !== right.toolbar || left.search !== right.search || left.resultLine !== right.resultLine) return false
  if (left.entries.length !== right.entries.length) return false
  return left.entries.every((entry, index) => entry.id === right.entries[index]?.id && entry.node === right.entries[index]?.node && entry.kind === right.entries[index]?.kind)
}

function Selector({ id, checked, onToggle }) {
  function toggle(event) {
    event.preventDefault()
    event.stopPropagation()
    onToggle(id)
  }

  return (
    <span
      className={`hi5-record-selector${checked ? ' is-selected' : ''}`}
      role="checkbox"
      aria-checked={checked}
      aria-label={`${checked ? 'Deselect' : 'Select'} ${id}`}
      tabIndex={0}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') toggle(event)
      }}
    >
      {checked ? <Check size={13} /> : null}
    </span>
  )
}

export function ProductionRecordListInteractionEnhancer() {
  const [type, setType] = useState(currentType)
  const [targets, setTargets] = useState(() => ({ toolbar: null, search: null, resultLine: null, entries: [] }))
  const [selected, setSelected] = useState(() => new Set(readSelection(currentType())))
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef(null)
  const targetsRef = useRef(targets)
  targetsRef.current = targets

  useEffect(() => {
    const updateRoute = () => setType(currentType())
    window.addEventListener('popstate', updateRoute)
    window.addEventListener('hi5-routechange', updateRoute)
    const timer = window.setInterval(updateRoute, 500)
    return () => {
      window.removeEventListener('popstate', updateRoute)
      window.removeEventListener('hi5-routechange', updateRoute)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    setSelected(new Set(readSelection(type)))
    setSearchOpen(false)
    if (!type) {
      setTargets({ toolbar: null, search: null, resultLine: null, entries: [] })
      return undefined
    }

    const scan = () => {
      const next = collectTargets()
      if (!sameTargets(targetsRef.current, next)) setTargets(next)
    }
    scan()
    const timer = window.setInterval(scan, 350)
    return () => window.clearInterval(timer)
  }, [type])

  useEffect(() => {
    if (!type) return
    const ids = [...selected]
    window.sessionStorage.setItem(selectionKey(type), JSON.stringify(ids))
    window.dispatchEvent(new CustomEvent(SELECTION_EVENT, { detail: { type, ids } }))
  }, [selected, type])

  useEffect(() => {
    if (!(targets.toolbar instanceof HTMLElement)) return undefined
    targets.toolbar.classList.toggle('hi5-mobile-search-open', searchOpen)
    if (searchOpen) {
      const input = targets.search?.querySelector('input')
      searchInputRef.current = input instanceof HTMLInputElement ? input : null
      window.requestAnimationFrame(() => searchInputRef.current?.focus())
    }
    return () => targets.toolbar?.classList.remove('hi5-mobile-search-open')
  }, [searchOpen, targets.search, targets.toolbar])

  const pageIds = useMemo(() => [...new Set(targets.entries.map((entry) => entry.id))], [targets.entries])
  const selectedCount = selected.size
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function togglePage() {
    setSelected((current) => {
      const next = new Set(current)
      if (allPageSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }

  if (!type || !targets.toolbar) return null

  const portals = []

  portals.push(createPortal(
    <button
      type="button"
      className={`hi5-mobile-record-search-trigger${searchOpen ? ' is-active' : ''}`}
      aria-label="Search records"
      title="Search records"
      onClick={() => setSearchOpen((value) => !value)}
    >
      <Search size={17} />
    </button>,
    targets.toolbar,
    'mobile-search-trigger',
  ))

  if (searchOpen && targets.search) {
    portals.push(createPortal(
      <button type="button" className="hi5-mobile-record-search-close" aria-label="Close search" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setSearchOpen(false) }}>
        <X size={16} />
      </button>,
      targets.search,
      'mobile-search-close',
    ))
  }

  if (targets.resultLine) {
    portals.push(createPortal(
      <div className={`hi5-record-selection-summary${selectedCount ? ' has-selection' : ''}`}>
        <button type="button" onClick={togglePage}><span className={`hi5-record-selection-box${allPageSelected ? ' is-selected' : ''}`}>{allPageSelected ? <Check size={11} /> : null}</span>{allPageSelected ? 'Clear page' : 'Select page'}</button>
        {selectedCount ? <><strong>{selectedCount} selected</strong><button type="button" className="is-clear" onClick={() => setSelected(new Set())}>Clear</button></> : null}
      </div>,
      targets.resultLine,
      'selection-summary',
    ))
  }

  targets.entries.forEach((entry) => {
    portals.push(createPortal(
      <Selector id={entry.id} checked={selected.has(entry.id)} onToggle={toggle} />,
      entry.node,
      `selector-${entry.kind}-${entry.id}`,
    ))
  })

  return portals
}

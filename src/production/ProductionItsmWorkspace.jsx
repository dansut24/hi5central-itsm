import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Eye,
  Filter,
  GripVertical,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
  TableProperties,
  X,
} from 'lucide-react'
import { hydrateProductionItsmWorkspaceRecords } from '../services/productionItsmRecords.js'
import './ProductionItsmWorkspace.css'
import './ProductionItsmWorkspaceEnhancements.css'

const API_BASE = window.__HI5_API_BASE__
const ROUTES = {
  '/incidents': { type: 'Incident', title: 'Incidents', singular: 'incident', section: 'incidents' },
  '/requests': { type: 'Service Request', title: 'Service Requests', singular: 'service request', section: 'requests' },
  '/problems': { type: 'Problem', title: 'Problems', singular: 'problem', section: 'problems' },
  '/changes': { type: 'Change', title: 'Changes', singular: 'change', section: 'changes' },
}
const PAGE_SIZES = [25, 50, 100]
const VIEW_STYLES = [
  { id: 'table', label: 'Table', icon: TableProperties },
  { id: 'compact', label: 'Compact', icon: List },
  { id: 'cards', label: 'Cards', icon: LayoutGrid },
]
const COLUMN_DEFINITIONS = [
  { key: 'reference', label: 'Reference', width: 118, locked: true },
  { key: 'summary', label: 'Summary', width: 260 },
  { key: 'priority', label: 'Priority / risk', width: 120 },
  { key: 'status', label: 'Status', width: 142 },
  { key: 'requester', label: 'Requester', width: 150 },
  { key: 'service', label: 'Service', width: 145 },
  { key: 'assignment', label: 'Assignment', width: 190 },
  { key: 'updated', label: 'Updated', width: 132 },
]
const DEFAULT_FILTERS = { status: 'All', priority: 'All', team: 'All', assignee: 'All', service: 'All', __view: 'all' }
const LIST_STATE_PREFIX = 'hi5central-record-list-state-v3'
const SAVED_VIEWS_KEY = 'hi5central-record-saved-views-v3'
const COLUMN_STATE_KEY = 'hi5central-record-columns-v3'

function currentRoute() {
  return ROUTES[window.location.pathname] || null
}

function readJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function readSessionJson(key, fallback) {
  try {
    const value = window.sessionStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function priorityClass(value = '') {
  return `is-${String(value).toLowerCase().replace(/\s+/g, '-')}`
}

function statusClass(value = '') {
  return `is-${String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function recordRoute(record) {
  const section = record.type === 'Incident' ? 'incidents'
    : record.type === 'Service Request' ? 'requests'
      : record.type === 'Problem' ? 'problems'
        : 'changes'
  return `/${section}/${encodeURIComponent(record.id)}`
}

function openPeek(detail) {
  if (!detail) return
  if (typeof window.__HI5_PEEK__ === 'function') {
    window.__HI5_PEEK__(detail)
    return
  }
  window.dispatchEvent(new CustomEvent('hi5-universal-peek', { detail }))
}

function recordPeek(record) {
  return {
    kind: record.type || 'Record',
    title: record.id,
    subtitle: record.title || 'Untitled record',
    fields: [
      ['Status', record.status],
      ['Priority / risk', record.priority],
      ['Requester', record.requester || 'Not recorded'],
      ['Service', record.service || 'Unclassified'],
      ['Assignment group', record.team || 'Unassigned team'],
      ['Assignee', record.assignee || 'Unassigned'],
      ['Updated', formatDate(record.updatedAt)],
    ],
    openPath: recordRoute(record),
    openLabel: 'Open in tab',
  }
}

function requesterPeek(record) {
  return {
    kind: 'Requester',
    title: record.requester || 'Not recorded',
    subtitle: record.type || 'Service Desk record',
    icon: 'person',
    fields: [
      ['Record', record.id],
      ['Service', record.service || 'Unclassified'],
      ['Category', record.category || 'Not recorded'],
    ],
    openPath: '/people',
    openLabel: 'Open People',
  }
}

function assignmentPeek(record) {
  return {
    kind: 'Assignment',
    title: record.assignee && record.assignee !== 'Unassigned' ? record.assignee : record.team || 'Unassigned',
    subtitle: record.team || 'Unassigned team',
    icon: 'team',
    fields: [
      ['Assignment group', record.team || 'Unassigned team'],
      ['Assignee', record.assignee || 'Unassigned'],
      ['Record', record.id],
      ['Status', record.status],
    ],
    openPath: '/people',
    openLabel: 'Open People',
  }
}

async function fetchQueue(route, state) {
  const params = new URLSearchParams({
    type: route.type,
    limit: String(state.pageSize),
    offset: String(state.page * state.pageSize),
  })
  if (state.query.trim()) params.set('search', state.query.trim())
  for (const key of ['status', 'priority', 'team', 'assignee', 'service']) {
    const value = state.filters[key]
    if (value && value !== 'All') params.set(key, value)
  }
  const response = await fetch(`${API_BASE}/api/v1/itsm-queue?${params}`, { credentials: 'include' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Could not load ${route.title}.`)
  return payload
}

function FilterSelect({ label, options, value, onChange }) {
  return (
    <label className="production-record-filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option>All</option>
        {options.filter((option) => option && option !== 'All').map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  )
}

function QueueFilters({ filterOptions, filters, onChange, onClear, sessionName, savedViews, onApplySaved, onDeleteSaved, onSaveView }) {
  const quickViews = [
    ['all', 'All records'],
    ['mine', 'Assigned to me'],
    ['unassigned', 'Unassigned'],
    ['high', 'High priority'],
    ['closed', 'Closed'],
  ]
  const activeQuick = filters.__view || 'all'

  function quick(id) {
    if (id === 'mine') onChange({ ...filters, __view: id, assignee: sessionName || 'All', status: 'All', priority: 'All' })
    else if (id === 'unassigned') onChange({ ...filters, __view: id, assignee: 'Unassigned', status: 'All', priority: 'All' })
    else if (id === 'high') onChange({ ...filters, __view: id, assignee: 'All', status: 'All', priority: 'High' })
    else if (id === 'closed') onChange({ ...filters, __view: id, assignee: 'All', status: 'Closed', priority: 'All' })
    else onChange({ ...DEFAULT_FILTERS })
  }

  return (
    <div className="production-record-filter-content">
      <section>
        <span className="production-record-filter-label">Views</span>
        <div className="production-record-view-list">
          {quickViews.map(([id, label]) => (
            <button className={activeQuick === id ? 'is-active' : ''} key={id} onClick={() => quick(id)} type="button">{label}</button>
          ))}
        </div>
      </section>

      {savedViews.length ? <section>
        <span className="production-record-filter-label">Saved views</span>
        <div className="production-record-saved-view-list">
          {savedViews.map((view) => <div key={view.id}>
            <button type="button" onClick={() => onApplySaved(view)}>{view.name}</button>
            <button type="button" aria-label={`Delete ${view.name}`} onClick={() => onDeleteSaved(view.id)}><X size={12} /></button>
          </div>)}
        </div>
      </section> : null}

      <section>
        <span className="production-record-filter-label">Filters</span>
        <FilterSelect label="Status" options={filterOptions.statuses || []} value={filters.status} onChange={(value) => onChange({ ...filters, status: value, __view: 'custom' })} />
        <FilterSelect label="Priority / risk" options={filterOptions.priorities || []} value={filters.priority} onChange={(value) => onChange({ ...filters, priority: value, __view: 'custom' })} />
        <FilterSelect label="Assignment group" options={filterOptions.teams || []} value={filters.team} onChange={(value) => onChange({ ...filters, team: value, __view: 'custom' })} />
        <FilterSelect label="Assignee" options={filterOptions.assignees || []} value={filters.assignee} onChange={(value) => onChange({ ...filters, assignee: value, __view: 'custom' })} />
        <FilterSelect label="Service" options={filterOptions.services || []} value={filters.service} onChange={(value) => onChange({ ...filters, service: value, __view: 'custom' })} />
        <button className="production-record-clear" onClick={onClear} type="button">Clear filters</button>
      </section>

      <section className="production-record-view-actions">
        <button type="button" onClick={onSaveView}><BookmarkPlus size={14} />Save current view</button>
      </section>
    </div>
  )
}

function renderTableCell(record, key) {
  if (key === 'reference') return <strong className="production-record-reference">{record.id}</strong>
  if (key === 'summary') return <><strong>{record.title}</strong><small>{record.category || record.type}</small></>
  if (key === 'priority') return <span className={`production-record-priority ${priorityClass(record.priority)}`}>{record.priority}</span>
  if (key === 'status') return <span className={`production-record-status ${statusClass(record.status)}`}>{record.status}</span>
  if (key === 'requester') return <button type="button" className="production-record-peek-link" onClick={(event) => { event.stopPropagation(); openPeek(requesterPeek(record)) }}>{record.requester || 'Not recorded'}</button>
  if (key === 'service') return <span>{record.service || 'Unclassified'}</span>
  if (key === 'assignment') return <button type="button" className="production-record-peek-link is-assignment" onClick={(event) => { event.stopPropagation(); openPeek(assignmentPeek(record)) }}><strong>{record.team || 'Unassigned team'}</strong><small>{record.assignee || 'Unassigned'}</small></button>
  if (key === 'updated') return <span>{formatDate(record.updatedAt)}</span>
  return null
}

function RecordTable({ items, onOpen, columns, widths, onWidthChange, returnRecord }) {
  function beginResize(event, column) {
    if (event.pointerType === 'touch') return
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = widths[column.key] || column.width
    const move = (moveEvent) => onWidthChange(column.key, Math.max(82, Math.min(520, startWidth + moveEvent.clientX - startX)))
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop, { once: true })
  }

  return (
    <div className="production-record-table-wrap">
      <table className="production-record-table production-record-table-enhanced">
        <colgroup>{columns.map((column) => <col key={column.key} style={{ width: `${widths[column.key] || column.width}px` }} />)}<col style={{ width: '46px' }} /></colgroup>
        <thead><tr>{columns.map((column) => <th key={column.key}><span>{column.label}</span><i className="production-record-column-resizer" onPointerDown={(event) => beginResize(event, column)} /></th>)}<th className="is-peek" /></tr></thead>
        <tbody>
          {items.map((record) => (
            <tr key={record.id} className={returnRecord === record.id ? 'is-returned' : ''} onClick={() => onOpen(record)}>
              {columns.map((column) => <td key={column.key}>{renderTableCell(record, column.key)}</td>)}
              <td className="is-peek"><button type="button" title={`Preview ${record.id}`} aria-label={`Preview ${record.id}`} onClick={(event) => { event.stopPropagation(); openPeek(recordPeek(record)) }}><Eye size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CompactList({ items, onOpen, returnRecord }) {
  return (
    <div className="production-record-compact-list">
      {items.map((record) => (
        <button className={returnRecord === record.id ? 'is-returned' : ''} key={record.id} onClick={() => onOpen(record)} type="button">
          <strong>{record.id}</strong>
          <span>{record.title}</span>
          <span className={`production-record-priority ${priorityClass(record.priority)}`}>{record.priority}</span>
          <span className={`production-record-status ${statusClass(record.status)}`}>{record.status}</span>
          <small>{record.team || 'Unassigned'} · {record.assignee || 'Unassigned'}</small>
          <small>{formatDate(record.updatedAt)}</small>
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

function CardList({ items, onOpen, returnRecord }) {
  return (
    <div className="production-record-card-list">
      {items.map((record) => (
        <article className={`production-record-card production-record-card-enhanced${returnRecord === record.id ? ' is-returned' : ''}`} key={record.id}>
          <button className="production-record-card-open" onClick={() => onOpen(record)} type="button" aria-label={`Open ${record.id}`}>
            <div><strong>{record.id}</strong><span className={`production-record-priority ${priorityClass(record.priority)}`}>{record.priority}</span></div>
            <h3>{record.title}</h3>
            <div className="production-record-card-state"><span className={`production-record-status ${statusClass(record.status)}`}>{record.status}</span><span>{record.service || 'Unclassified'}</span></div>
            <dl>
              <div><dt>Requester</dt><dd>{record.requester || 'Not recorded'}</dd></div>
              <div><dt>Assignment</dt><dd>{record.team || 'Unassigned'} · {record.assignee || 'Unassigned'}</dd></div>
            </dl>
            <footer><span>Updated {formatDate(record.updatedAt)}</span><ChevronRight size={16} /></footer>
          </button>
          <div className="production-record-card-actions">
            <button type="button" onClick={() => openPeek(requesterPeek(record))}>Requester</button>
            <button type="button" onClick={() => openPeek(assignmentPeek(record))}>Assignment</button>
            <button type="button" aria-label={`Preview ${record.id}`} onClick={() => openPeek(recordPeek(record))}><Eye size={15} />Preview</button>
          </div>
        </article>
      ))}
    </div>
  )
}

function QueueSkeleton({ viewStyle }) {
  if (viewStyle === 'cards') {
    return <div className="production-record-skeleton-cards" aria-label="Loading records">{Array.from({ length: 6 }, (_, index) => <div className="production-skeleton production-record-skeleton-card" key={index}><i /><i /><i /><i /></div>)}</div>
  }
  if (viewStyle === 'compact') {
    return <div className="production-record-skeleton-compact" aria-label="Loading records">{Array.from({ length: 8 }, (_, index) => <div className="production-skeleton production-record-skeleton-line" key={index}><i /><i /><i /><i /></div>)}</div>
  }
  return (
    <div className="production-record-skeleton-table" aria-label="Loading records">
      <div className="production-record-skeleton-head">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>
      {Array.from({ length: 7 }, (_, row) => <div className="production-skeleton production-record-skeleton-row" key={row}>{Array.from({ length: 8 }, (_, cell) => <i key={cell} />)}</div>)}
    </div>
  )
}

function ProductionQueue({ route }) {
  const productionSession = readJson('hi5central-production-session-v1', {})
  const savedStyles = readJson('hi5central-record-view-style-v1', {})
  const listStateKey = `${LIST_STATE_PREFIX}:${route.type}`
  const remembered = readSessionJson(listStateKey, {})
  const storedColumns = readJson(COLUMN_STATE_KEY, {})?.[route.type] || {}
  const allSavedViews = readJson(SAVED_VIEWS_KEY, {})

  const [query, setQuery] = useState(remembered.query || '')
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, ...(remembered.filters || {}) })
  const [viewStyle, setViewStyle] = useState(remembered.viewStyle || savedStyles[route.type] || (window.matchMedia?.('(max-width: 720px)').matches ? 'cards' : 'table'))
  const [pageSize, setPageSize] = useState(Number(remembered.pageSize || 25))
  const [page, setPage] = useState(Number(remembered.page || 0))
  const [payload, setPayload] = useState({ items: [], total: 0, filters: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mobileFilters, setMobileFilters] = useState(false)
  const [isMobileQueue, setIsMobileQueue] = useState(() => window.matchMedia?.('(max-width: 760px)').matches ?? false)
  const [revision, setRevision] = useState(0)
  const [savedViews, setSavedViews] = useState(Array.isArray(allSavedViews?.[route.type]) ? allSavedViews[route.type] : [])
  const [columnOrder, setColumnOrder] = useState(Array.isArray(storedColumns.order) && storedColumns.order.length ? storedColumns.order : COLUMN_DEFINITIONS.map((column) => column.key))
  const [hiddenColumns, setHiddenColumns] = useState(Array.isArray(storedColumns.hidden) ? storedColumns.hidden : [])
  const [columnWidths, setColumnWidths] = useState(storedColumns.widths || {})
  const [dragColumn, setDragColumn] = useState('')
  const contentRef = useRef(null)
  const restoredScrollRef = useRef(false)
  const returnRecord = remembered.returnRecord || ''

  const visibleColumns = useMemo(() => columnOrder
    .map((key) => COLUMN_DEFINITIONS.find((column) => column.key === key))
    .filter(Boolean)
    .filter((column) => column.locked || !hiddenColumns.includes(column.key)), [columnOrder, hiddenColumns])

  useEffect(() => {
    const query = window.matchMedia?.('(max-width: 760px)')
    if (!query) return undefined
    const sync = () => setIsMobileQueue(query.matches)
    sync()
    query.addEventListener?.('change', sync)
    return () => query.removeEventListener?.('change', sync)
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    fetchQueue(route, { query, filters, pageSize, page })
      .then((next) => { if (active) setPayload(next) })
      .catch((loadError) => { if (active) setError(loadError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters, page, pageSize, query, revision, route])

  useEffect(() => {
    window.sessionStorage.setItem(listStateKey, JSON.stringify({ query, filters, viewStyle, pageSize, page, scrollTop: Number(remembered.scrollTop || 0), returnRecord }))
  }, [filters, listStateKey, page, pageSize, query, returnRecord, viewStyle])

  useEffect(() => {
    if (loading || restoredScrollRef.current || !(contentRef.current instanceof HTMLElement)) return
    restoredScrollRef.current = true
    const target = Number(remembered.scrollTop || 0)
    if (target > 0) window.requestAnimationFrame(() => { if (contentRef.current) contentRef.current.scrollTop = target })
  }, [loading])

  useEffect(() => {
    const current = readJson(COLUMN_STATE_KEY, {})
    window.localStorage.setItem(COLUMN_STATE_KEY, JSON.stringify({ ...current, [route.type]: { order: columnOrder, hidden: hiddenColumns, widths: columnWidths } }))
  }, [columnOrder, columnWidths, hiddenColumns, route.type])

  function persistListState(extra = {}) {
    const current = {
      query,
      filters,
      viewStyle,
      pageSize,
      page,
      scrollTop: contentRef.current?.scrollTop || 0,
      returnRecord,
      ...extra,
    }
    window.sessionStorage.setItem(listStateKey, JSON.stringify(current))
  }

  function changeFilters(next) {
    setFilters(next)
    setPage(0)
  }

  function changeQuery(value) {
    setQuery(value)
    setPage(0)
  }

  function changeViewStyle(value) {
    setViewStyle(value)
    const current = readJson('hi5central-record-view-style-v1', {})
    window.localStorage.setItem('hi5central-record-view-style-v1', JSON.stringify({ ...current, [route.type]: value }))
  }

  function clearFilters() {
    setFilters({ ...DEFAULT_FILTERS })
    setPage(0)
  }

  function saveView() {
    const name = window.prompt('Name this view')?.trim()
    if (!name) return
    const id = `${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    const view = { id, name, query, filters, viewStyle, pageSize, columnOrder, hiddenColumns, columnWidths }
    const next = [...savedViews.filter((item) => item.name.toLowerCase() !== name.toLowerCase()), view]
    setSavedViews(next)
    const current = readJson(SAVED_VIEWS_KEY, {})
    window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify({ ...current, [route.type]: next }))
  }

  function applySavedView(view) {
    setQuery(view.query || '')
    setFilters({ ...DEFAULT_FILTERS, ...(view.filters || {}) })
    setViewStyle(view.viewStyle || 'table')
    setPageSize(Number(view.pageSize || 25))
    setPage(0)
    if (Array.isArray(view.columnOrder) && view.columnOrder.length) setColumnOrder(view.columnOrder)
    if (Array.isArray(view.hiddenColumns)) setHiddenColumns(view.hiddenColumns)
    if (view.columnWidths) setColumnWidths(view.columnWidths)
  }

  function deleteSavedView(id) {
    const next = savedViews.filter((view) => view.id !== id)
    setSavedViews(next)
    const current = readJson(SAVED_VIEWS_KEY, {})
    window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify({ ...current, [route.type]: next }))
  }

  function toggleColumn(key) {
    const column = COLUMN_DEFINITIONS.find((item) => item.key === key)
    if (!column || column.locked) return
    setHiddenColumns((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  }

  function dropColumn(targetKey) {
    if (!dragColumn || dragColumn === targetKey) return
    setColumnOrder((current) => {
      const next = current.filter((key) => key !== dragColumn)
      const targetIndex = next.indexOf(targetKey)
      next.splice(targetIndex < 0 ? next.length : targetIndex, 0, dragColumn)
      return next
    })
    setDragColumn('')
  }

  async function openRecord(record) {
    persistListState({ returnRecord: record.id })
    try { await hydrateProductionItsmWorkspaceRecords() } catch { /* Queue record still remains navigable. */ }
    window.location.assign(recordRoute(record))
  }

  function createRecord() {
    persistListState({ returnRecord: '' })
    window.location.assign(`/${route.section}/new`)
  }

  const pageCount = Math.max(1, Math.ceil(Number(payload.total || 0) / pageSize))
  const start = payload.total ? page * pageSize + 1 : 0
  const end = Math.min((page + 1) * pageSize, Number(payload.total || 0))
  const renderedViewStyle = isMobileQueue ? 'cards' : viewStyle
  const ActiveViewIcon = VIEW_STYLES.find((item) => item.id === renderedViewStyle)?.icon || TableProperties

  return (
    <section className="production-record-shell production-motion-enter production-record-shell-enhanced">
      <aside className="production-record-filter-rail">
        <div className="production-record-filter-heading"><span>Queue</span><strong>{route.title}</strong></div>
        <QueueFilters filterOptions={payload.filters || {}} filters={filters} onChange={changeFilters} onClear={clearFilters} sessionName={productionSession.name} savedViews={savedViews} onApplySaved={applySavedView} onDeleteSaved={deleteSavedView} onSaveView={saveView} />
      </aside>

      <main className="production-record-main">
        <div className="production-record-toolbar">
          <button className="production-record-filter-trigger" onClick={() => setMobileFilters(true)} type="button"><Filter size={15} />Filters</button>
          <label className="production-record-search"><Search size={17} /><input value={query} onChange={(event) => changeQuery(event.target.value)} placeholder={`Search ${route.title.toLowerCase()}...`} type="search" /></label>
          <button className="production-record-refresh" onClick={() => setRevision((value) => value + 1)} type="button" title="Refresh"><RefreshCw size={16} /></button>
          <label className="production-record-view-select"><ActiveViewIcon size={15} /><select value={viewStyle} onChange={(event) => changeViewStyle(event.target.value)}>{VIEW_STYLES.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}</select></label>
          {viewStyle === 'table' ? <details className="production-record-columns-menu"><summary><Columns3 size={15} /><span>Columns</span><ChevronDown size={13} /></summary><div><header><strong>Columns</strong><small>Drag to reorder</small></header>{columnOrder.map((key) => {
            const column = COLUMN_DEFINITIONS.find((item) => item.key === key)
            if (!column) return null
            const visible = column.locked || !hiddenColumns.includes(key)
            return <button type="button" draggable onDragStart={() => setDragColumn(key)} onDragEnd={() => setDragColumn('')} onDragOver={(event) => event.preventDefault()} onDrop={() => dropColumn(key)} className={visible ? 'is-visible' : ''} key={key}><GripVertical size={13} /><span>{column.label}</span><i onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleColumn(key) }}>{visible ? <Check size={13} /> : null}</i></button>
          })}</div></details> : null}
          <button className="production-record-new" onClick={createRecord} type="button"><Plus size={16} />New</button>
        </div>

        <div className="production-record-result-line"><span><strong>{payload.total || 0}</strong> {Number(payload.total) === 1 ? route.singular : route.title.toLowerCase()}</span><span>{start}–{end} of {payload.total || 0}</span></div>

        <div className="production-record-content" ref={contentRef}>
          {loading ? <QueueSkeleton viewStyle={renderedViewStyle} /> : null}
          {!loading && error ? <div className="production-record-state is-error"><strong>Could not load this queue</strong><span>{error}</span><button onClick={() => setRevision((value) => value + 1)} type="button">Retry</button></div> : null}
          {!loading && !error && !payload.items?.length ? <div className="production-record-state"><strong>No {route.title.toLowerCase()} in this view</strong><span>Change the filters or create the first {route.singular}.</span></div> : null}
          {!loading && !error && payload.items?.length ? (
            <div className="production-motion-enter production-motion-enter-fast">
              {renderedViewStyle === 'compact' ? <CompactList items={payload.items} onOpen={openRecord} returnRecord={returnRecord} />
                : renderedViewStyle === 'cards' ? <CardList items={payload.items} onOpen={openRecord} returnRecord={returnRecord} />
                  : <RecordTable items={payload.items} onOpen={openRecord} columns={visibleColumns} widths={columnWidths} onWidthChange={(key, width) => setColumnWidths((current) => ({ ...current, [key]: width }))} returnRecord={returnRecord} />}
            </div>
          ) : null}
        </div>

        <footer className="production-record-pagination">
          <label>Rows <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}>{PAGE_SIZES.map((size) => <option key={size}>{size}</option>)}</select></label>
          <span>Page {Math.min(page + 1, pageCount)} of {pageCount}</span>
          <div><button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} type="button"><ChevronLeft size={15} /></button><button disabled={page >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} type="button"><ChevronRight size={15} /></button></div>
        </footer>
      </main>

      {mobileFilters ? (
        <><button className="production-record-filter-backdrop" aria-label="Close filters" onClick={() => setMobileFilters(false)} type="button" /><aside className="production-record-mobile-filter production-motion-drawer"><header><div><span>Queue filters</span><strong>{route.title}</strong></div><button onClick={() => setMobileFilters(false)} type="button"><X size={17} /></button></header><QueueFilters filterOptions={payload.filters || {}} filters={filters} onChange={changeFilters} onClear={clearFilters} sessionName={productionSession.name} savedViews={savedViews} onApplySaved={(view) => { applySavedView(view); setMobileFilters(false) }} onDeleteSaved={deleteSavedView} onSaveView={saveView} /></aside></>
      ) : null}
    </section>
  )
}

export function ProductionItsmWorkspace() {
  const [route, setRoute] = useState(currentRoute)
  const [target, setTarget] = useState(null)

  useEffect(() => {
    let active = true
    const hydrate = async () => {
      try {
        const before = window.localStorage.getItem('hi5central-tickets') || '[]'
        const records = await hydrateProductionItsmWorkspaceRecords()
        const signature = records.map((record) => `${record.id}:${record.updatedAt || record.updated}`).join('|')
        const after = window.localStorage.getItem('hi5central-tickets') || '[]'
        const reloadKey = 'hi5central-production-itsm-hydrated-v1'
        if (active && before !== after && window.sessionStorage.getItem(reloadKey) !== signature) {
          window.sessionStorage.setItem(reloadKey, signature)
          window.location.reload()
        }
      } catch (error) {
        console.error('Production ITSM hydration failed', error)
      }
    }
    void hydrate()
    return () => { active = false }
  }, [])

  useEffect(() => {
    const updateRoute = () => setRoute(currentRoute())
    window.addEventListener('popstate', updateRoute)
    window.addEventListener('hi5-routechange', updateRoute)
    const timer = window.setInterval(updateRoute, 250)
    return () => {
      window.removeEventListener('popstate', updateRoute)
      window.removeEventListener('hi5-routechange', updateRoute)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!route) {
      setTarget(null)
      document.querySelector('.content-frame')?.classList.remove('production-itsm-queue-mounted')
      return undefined
    }
    let mounted = null
    const attach = () => {
      const node = document.querySelector('.content-frame')
      if (!(node instanceof HTMLElement)) return false
      mounted = node
      node.classList.add('production-itsm-queue-mounted')
      setTarget(node)
      return true
    }
    if (attach()) return () => mounted?.classList.remove('production-itsm-queue-mounted')
    const observer = new MutationObserver(() => { if (attach()) observer.disconnect() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); mounted?.classList.remove('production-itsm-queue-mounted') }
  }, [route])

  const key = useMemo(() => route?.type || 'none', [route])
  if (!route || !target) return null
  return createPortal(<ProductionQueue key={key} route={route} />, target)
}

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Clock3,
  FileText,
  Columns3,
  ExternalLink,
  Filter,
  LayoutGrid,
  List,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  PlayCircle,
  RefreshCw,
  Search,
  TableProperties,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react'
import './ProductionItsmWorkspace.css'
import './ProductionItsmWorkspaceEnhancements.css'
import './ProductionActivityCanvasRecord.css'
import './ProductionActivityActionRecord.css'
import { Hi5EntityTypeahead } from './Hi5EntityTypeahead.jsx'
import './ProductionTaskExperience.css'

const API_BASE = window.__HI5_API_BASE__
const PAGE_SIZES = [25, 50, 100]
const VIEW_STYLES = [
  { id: 'table', label: 'Table', icon: TableProperties },
  { id: 'compact', label: 'Compact', icon: List },
  { id: 'cards', label: 'Cards', icon: LayoutGrid },
]
const WORK_VIEWS = [
  { id: 'mine', label: 'My Tasks', description: 'Work currently assigned to you' },
  { id: 'team', label: 'Team Queue', description: 'Active work routed to your teams' },
  { id: 'unassigned', label: 'Unassigned', description: 'Ready work waiting to be taken' },
  { id: 'blocked', label: 'Blocked', description: 'Work that needs attention' },
]
const COLUMNS = [
  { key: 'reference', label: 'Reference', width: 140, locked: true },
  { key: 'summary', label: 'Summary', width: 245, locked: true },
  { key: 'priority', label: 'Priority / risk', width: 110 },
  { key: 'status', label: 'Status', width: 125 },
  { key: 'requester', label: 'Requester', width: 150 },
  { key: 'service', label: 'Service', width: 140 },
  { key: 'assignment', label: 'Assignment', width: 180 },
  { key: 'due', label: 'Due / target', width: 155 },
  { key: 'updated', label: 'Updated', width: 145 },
  { key: 'actions', label: 'Action', width: 125, locked: true },
]
const DEFAULT_FILTERS = { scope: 'team', status: 'All', priority: 'All', team: 'All', assignee: 'All', service: 'All', due: 'All' }

function routeFromPath(pathname = window.location.pathname) {
  if (pathname === '/tasks' || pathname === '/tasks/') return { kind: 'list' }
  const match = pathname.match(/^\/tasks\/([^/]+)\/?$/i)
  return match ? { kind: 'detail', taskKey: decodeURIComponent(match[1]).toUpperCase() } : null
}

function navigate(path) {
  if (window.location.pathname === path) return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.dispatchEvent(new CustomEvent('hi5-routechange', { detail: { path } }))
}

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`)
  return payload
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function readSession() {
  try { return JSON.parse(window.localStorage.getItem('hi5central-production-session-v1') || '{}') || {} } catch { return {} }
}

function statusClass(value = '') {
  return `is-${String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function priorityClass(value = '') {
  return `is-${String(value).toLowerCase().replace(/\s+/g, '-')}`
}

function dueMeta(value, status = '') {
  if (status === 'Completed') return { className: 'is-complete', label: 'Completed', overdue: false }
  if (!value) return { className: 'is-none', label: 'No due date', overdue: false }
  const due = new Date(value)
  if (Number.isNaN(due.getTime())) return { className: 'is-none', label: 'No due date', overdue: false }
  const now = new Date()
  if (due.getTime() < now.getTime()) return { className: 'is-overdue', label: 'Overdue', overdue: true }
  const sameDay = due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth() && due.getDate() === now.getDate()
  if (sameDay) return { className: 'is-today', label: 'Due today', overdue: false }
  if (due.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000) return { className: 'is-soon', label: 'Due soon', overdue: false }
  return { className: 'is-scheduled', label: 'Scheduled', overdue: false }
}

function taskRecord(task) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.primaryRequest?.priority || 'Medium',
    requester: task.primaryRequest?.requester || 'Not recorded',
    service: task.primaryRequest?.service || 'Unclassified',
    team: task.team || 'Unassigned team',
    assignee: task.assignee || 'Unassigned',
    assigneeEmail: task.assigneeEmail || '',
    updatedAt: task.updatedAt,
    primaryRequest: task.primaryRequest?.id || '',
    dueAt: task.dueAt,
  }
}

function TaskDue({ record, compact = false }) {
  const meta = dueMeta(record.dueAt, record.status)
  return <span className={`production-task-due ${meta.className}${compact ? ' is-compact' : ''}`}><strong>{meta.label}</strong><small>{record.dueAt ? formatDate(record.dueAt) : 'No target set'}</small></span>
}

function TaskNavButton({ target }) {
  if (!target) return null
  return createPortal(
    <button
      type="button"
      className={window.location.pathname.startsWith('/tasks') ? 'production-task-nav is-active' : 'production-task-nav'}
      onClick={() => navigate('/tasks')}
    >
      <ListChecks size={16} aria-hidden="true" />
      <span>Tasks</span>
    </button>,
    target,
  )
}

function AwaitingApprovalButton({ target, statusSelect }) {
  if (!target || !statusSelect) return null
  const active = statusSelect.value === 'Pending Approval'
  return createPortal(
    <button
      type="button"
      className={active ? 'is-active production-awaiting-approval-view' : 'production-awaiting-approval-view'}
      onClick={() => {
        statusSelect.value = 'Pending Approval'
        statusSelect.dispatchEvent(new Event('change', { bubbles: true }))
      }}
    >Awaiting approval</button>,
    target,
  )
}

function useWorkspaceTargets(taskRoute) {
  const [content, setContent] = useState(null)
  const [nav, setNav] = useState(null)
  const [approvalTarget, setApprovalTarget] = useState(null)
  const [approvalSelect, setApprovalSelect] = useState(null)

  useEffect(() => {
    const find = () => {
      setContent(taskRoute ? document.querySelector('.content-frame') : null)
      const serviceDesk = [...document.querySelectorAll('.nav-group')].find((node) => node.querySelector('.nav-group-title')?.textContent?.trim() === 'Service Desk')
      setNav(serviceDesk?.querySelector('.nav-items') || null)

      if (window.location.pathname === '/requests' || window.location.pathname === '/requests/') {
        const shell = [...document.querySelectorAll('.production-record-shell')].find((node) => node.querySelector('.production-record-filter-heading strong')?.textContent?.trim() === 'Service Requests')
        const viewList = shell?.querySelector('.production-record-view-list') || null
        const fields = [...(shell?.querySelectorAll('.production-record-filter-field') || [])]
        const statusField = fields.find((field) => field.querySelector('span')?.textContent?.trim() === 'Status')
        setApprovalTarget(viewList)
        setApprovalSelect(statusField?.querySelector('select') || null)
      } else {
        setApprovalTarget(null)
        setApprovalSelect(null)
      }
    }

    find()
    const observer = new MutationObserver(find)
    observer.observe(document.body, { childList: true, subtree: true })
    const timer = window.setInterval(find, 500)
    return () => { observer.disconnect(); window.clearInterval(timer) }
  }, [taskRoute])

  return { content, nav, approvalTarget, approvalSelect }
}

function FilterSelect({ label, value, options, onChange }) {
  return <label className="production-record-filter-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option>All</option>{(options || []).filter((option) => option && option !== 'All').map((option) => <option key={option}>{option}</option>)}</select></label>
}

function TaskFilters({ payload, filters, onChange, onClear, query, onQueryChange }) {
  const options = payload.filters || {}

  return <div className="production-record-filter-content">
    <section>
      <span className="production-record-filter-label">Search</span>
      <label className="production-record-drawer-search"><Search size={15} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search tasks or parent requests…" type="search" /></label>
    </section>
    <section>
      <span className="production-record-filter-label">Filters</span>
      <FilterSelect label="Status" value={filters.status} options={options.statuses} onChange={(value) => onChange({ ...filters, status: value })} />
      <FilterSelect label="Priority / risk" value={filters.priority} options={options.priorities} onChange={(value) => onChange({ ...filters, priority: value })} />
      <FilterSelect label="Assignment group" value={filters.team} options={options.teams} onChange={(value) => onChange({ ...filters, team: value })} />
      <FilterSelect label="Assignee" value={filters.assignee} options={options.assignees} onChange={(value) => onChange({ ...filters, assignee: value })} />
      <FilterSelect label="Service" value={filters.service} options={options.services} onChange={(value) => onChange({ ...filters, service: value })} />
      <FilterSelect label="Due / target" value={filters.due} options={options.due} onChange={(value) => onChange({ ...filters, due: value })} />
      <button className="production-record-clear" type="button" onClick={onClear}>Reset to Team Queue</button>
    </section>
  </div>
}

function TaskWorkViews({ payload, active, onChange }) {
  const counts = payload.views || {}
  return <nav className="production-task-work-views" aria-label="Task work queues">{WORK_VIEWS.map((view) => <button key={view.id} type="button" className={active === view.id ? 'is-active' : ''} onClick={() => onChange(view.id)}><span><strong>{view.label}</strong><small>{view.description}</small></span><b>{Number(counts[view.id] || 0)}</b></button>)}</nav>
}

function renderCell(record, key) {
  if (key === 'reference') return <strong className="production-record-reference">{record.id}</strong>
  if (key === 'summary') return <><strong>{record.title}</strong><small>{record.primaryRequest ? `Primary ${record.primaryRequest}` : 'Workflow task'}</small></>
  if (key === 'priority') return <span className={`production-record-priority ${priorityClass(record.priority)}`}>{record.priority}</span>
  if (key === 'status') return <span className={`production-record-status ${statusClass(record.status)}`}>{record.status}</span>
  if (key === 'requester') return <span>{record.requester}</span>
  if (key === 'service') return <span>{record.service}</span>
  if (key === 'assignment') return <span className="production-task-assignment"><strong>{record.team}</strong><small>{record.assignee}</small></span>
  if (key === 'due') return <TaskDue record={record} />
  if (key === 'updated') return <span>{formatDate(record.updatedAt)}</span>
  return null
}

function taskCanBeTaken(record) {
  return record.status === 'Ready' && (!record.assignee || record.assignee === 'Unassigned')
}

function TaskOwnershipButton({ record, onTake, busyTask }) {
  if (!taskCanBeTaken(record)) return <span className="production-task-ownership-state">{record.status === 'Ready' ? record.assignee : '—'}</span>
  const busy = busyTask === record.id
  return <button type="button" className="production-task-ownership-button" disabled={busy} onClick={(event) => { event.stopPropagation(); void onTake(record) }}><UserPlus size={14} />{busy ? 'Taking…' : 'Take task'}</button>
}

function TaskTable({ items, columns, onOpen, onTake, busyTask }) {
  return <div className="production-record-table-wrap"><table className="production-record-table production-record-table-enhanced"><colgroup>{columns.map((column) => <col key={column.key} style={{ width: `${column.width}px` }} />)}</colgroup><thead><tr>{columns.map((column) => <th key={column.key}><span>{column.label}</span></th>)}</tr></thead><tbody>{items.map((record) => <tr key={record.id} className={dueMeta(record.dueAt, record.status).overdue ? 'is-task-overdue' : ''} onClick={() => onOpen(record)}>{columns.map((column) => <td key={column.key}>{column.key === 'actions' ? <TaskOwnershipButton record={record} onTake={onTake} busyTask={busyTask} /> : renderCell(record, column.key)}</td>)}</tr>)}</tbody></table></div>
}

function TaskCompactList({ items, onOpen, onTake, busyTask }) {
  return <div className="production-record-compact-list">{items.map((record) => <div className={`production-task-compact-row${dueMeta(record.dueAt, record.status).overdue ? ' is-task-overdue' : ''}`} key={record.id}><button className="production-task-compact-open" onClick={() => onOpen(record)} type="button"><strong>{record.id}</strong><span>{record.title}</span><span className={`production-record-priority ${priorityClass(record.priority)}`}>{record.priority}</span><span className={`production-record-status ${statusClass(record.status)}`}>{record.status}</span><small>{record.team} · {record.assignee}</small><TaskDue record={record} compact /><ChevronRight size={15} /></button><TaskOwnershipButton record={record} onTake={onTake} busyTask={busyTask} /></div>)}</div>
}

function TaskCardList({ items, onOpen, onTake, busyTask }) {
  return <div className="production-record-card-list production-task-mobile-card-list">{items.map((record) => {
    const due = dueMeta(record.dueAt, record.status)
    return <article className={`production-record-card production-record-card-enhanced production-task-mobile-card${due.overdue ? ' is-task-overdue' : ''}`} key={record.id}>
      <button className="production-record-card-open production-task-mobile-card-open" type="button" onClick={() => onOpen(record)}>
        <span className="production-record-card-icon is-service-request"><ListChecks size={18} /></span>
        <span className="production-record-card-copy">
          <strong>{record.id}</strong>
          <b>{record.title}</b>
          <small>{record.primaryRequest ? `Primary ${record.primaryRequest}` : 'Workflow task'} · {record.team || 'Unassigned'}</small>
        </span>
        <span className={`production-record-status ${statusClass(record.status)}`}>{record.status}</span>
        <span className="production-record-card-facts">
          <span><small>Priority</small><strong>{record.priority || 'Not set'}</strong></span>
          <span><small>Due</small><strong className={due.overdue ? 'is-overdue' : ''}>{due.label}</strong></span>
          <span><small>Assignee</small><strong>{record.assignee || 'Unassigned'}</strong></span>
        </span>
        <ChevronRight className="production-record-card-chevron" size={17} />
      </button>
      {taskCanBeTaken(record) ? <div className="production-task-mobile-card-action"><TaskOwnershipButton record={record} onTake={onTake} busyTask={busyTask} /></div> : null}
    </article>
  })}</div>
}

function TaskQueue() {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS })
  const [viewStyle, setViewStyle] = useState(window.matchMedia?.('(max-width: 720px)').matches ? 'cards' : 'table')
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(0)
  const [payload, setPayload] = useState({ items: [], total: 0, filters: {}, views: {}, viewer: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [mobileFilters, setMobileFilters] = useState(false)
  const [hiddenColumns, setHiddenColumns] = useState(['updated'])
  const [ownershipBusy, setOwnershipBusy] = useState('')
  const [ownershipError, setOwnershipError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize), scope: filters.scope })
    if (query.trim()) params.set('search', query.trim())
    for (const key of ['status', 'priority', 'team', 'assignee', 'service', 'due']) {
      if (filters[key] && filters[key] !== 'All') params.set(key, filters[key])
    }
    apiJson(`/api/v1/task-work-queue?${params}`)
      .then((next) => { if (active) setPayload(next) })
      .catch((loadError) => { if (active) setError(loadError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters, page, pageSize, query, revision])

  const records = useMemo(() => (payload.items || []).map(taskRecord), [payload.items])
  const columns = COLUMNS.filter((column) => column.locked || !hiddenColumns.includes(column.key))
  const total = Number(payload.total || 0)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const renderedViewStyle = window.matchMedia?.('(max-width: 760px)').matches ? 'cards' : 'table'
  const changeFilters = (next) => { setFilters(next); setPage(0) }
  const clearFilters = () => { setFilters({ ...DEFAULT_FILTERS }); setPage(0) }
  const selectScope = (scope) => changeFilters({ ...DEFAULT_FILTERS, scope })
  const currentView = [...WORK_VIEWS, { id: 'all', label: 'All active' }, { id: 'completed', label: 'Completed' }].find((view) => view.id === filters.scope)
  const taskViews = [...WORK_VIEWS, { id: 'all', label: 'All active' }, { id: 'completed', label: 'Completed' }]
  const activeFilterCount = [
    query.trim(),
    filters.status !== 'All' ? filters.status : '',
    filters.priority !== 'All' ? filters.priority : '',
    filters.team !== 'All' ? filters.team : '',
    filters.assignee !== 'All' ? filters.assignee : '',
    filters.service !== 'All' ? filters.service : '',
    filters.due !== 'All' ? filters.due : '',
  ].filter(Boolean).length

  async function takeTask(record) {
    if (!taskCanBeTaken(record) || ownershipBusy) return
    setOwnershipBusy(record.id)
    setOwnershipError('')
    try {
      await apiJson(`/api/v1/tasks/${encodeURIComponent(record.id)}/take`, { method: 'POST' })
      setRevision((value) => value + 1)
    } catch (takeError) {
      setOwnershipError(takeError.message)
      setRevision((value) => value + 1)
    } finally {
      setOwnershipBusy('')
    }
  }

  return <section className="production-task-experience production-record-shell production-motion-enter production-record-shell-enhanced">
    <main className="production-record-main">
      <div className="production-record-viewbar production-task-viewbar">
        <div className="production-record-view-pills" aria-label="Task quick views">
          {taskViews.map((view) => <button className={filters.scope === view.id ? 'is-active' : ''} key={view.id} onClick={() => selectScope(view.id)} type="button">{view.label}</button>)}
        </div>
        <button className="production-record-viewbar-filter" type="button" onClick={() => setMobileFilters(true)}><Filter size={15} />Filters{activeFilterCount > 0 ? <b>{activeFilterCount}</b> : null}</button>
      </div>

      {ownershipError ? <div className="production-task-ownership-error"><AlertTriangle size={15} /><span>{ownershipError}</span><button type="button" aria-label="Dismiss" onClick={() => setOwnershipError('')}><X size={14} /></button></div> : null}

      <div className="production-record-content">
        {loading ? <div className="production-record-state"><strong>Loading tasks…</strong><span>Checking your current fulfilment queues.</span></div> : null}
        {!loading && error ? <div className="production-record-state is-error"><strong>Could not load this queue</strong><span>{error}</span><button type="button" onClick={() => setRevision((value) => value + 1)}>Retry</button></div> : null}
        {!loading && !error && !records.length ? <div className="production-record-state"><strong>No tasks in {currentView?.label || 'this view'}</strong><span>Waiting workflow steps stay hidden until their dependencies are complete.</span></div> : null}
        {!loading && !error && records.length ? <div className="production-motion-enter production-motion-enter-fast">{renderedViewStyle === 'cards' ? <TaskCardList items={records} onOpen={(record) => navigate(`/tasks/${encodeURIComponent(record.id)}`)} onTake={takeTask} busyTask={ownershipBusy} /> : <TaskTable items={records} columns={columns} onOpen={(record) => navigate(`/tasks/${encodeURIComponent(record.id)}`)} onTake={takeTask} busyTask={ownershipBusy} />}</div> : null}
      </div>

      <footer className="production-record-pagination"><label>Rows <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}>{PAGE_SIZES.map((size) => <option key={size}>{size}</option>)}</select></label><span>Page {Math.min(page + 1, pageCount)} of {pageCount}</span><div><button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} type="button"><ChevronLeft size={15} /></button><button disabled={page >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} type="button"><ChevronRight size={15} /></button></div></footer>
    </main>

    {mobileFilters ? <><button className="production-record-filter-backdrop" aria-label="Close filters" type="button" onClick={() => setMobileFilters(false)} /><aside className="production-record-mobile-filter production-motion-drawer"><header><div><span>Queue filters</span><strong>Tasks</strong></div><button type="button" onClick={() => setMobileFilters(false)}><X size={17} /></button></header><TaskFilters payload={payload} filters={filters} onChange={changeFilters} onClear={clearFilters} query={query} onQueryChange={(value) => { setQuery(value); setPage(0) }} /></aside></> : null}
  </section>
}

function Field({ label, children, hint }) {
  return <label className="activity-canvas-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>
}

function InspectorRow({ label, value, meta, onClick }) {
  return <button type="button" className="activity-canvas-inspector-row" onClick={onClick}><span><small>{label}</small><strong>{value || 'Not recorded'}</strong>{meta ? <em>{meta}</em> : null}</span><ChevronRight size={17} /></button>
}

function TaskDetail({ taskKey }) {
  const [task, setTask] = useState(null)
  const [directory, setDirectory] = useState({ people: [], teams: [] })
  const [parentRequest, setParentRequest] = useState(null)
  const [team, setTeam] = useState('')
  const [assignee, setAssignee] = useState('Unassigned')
  const [completionNotes, setCompletionNotes] = useState('')
  const [completionOpen, setCompletionOpen] = useState(false)
  const [assignmentEditing, setAssignmentEditing] = useState(false)
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true)
    setError('')
    try {
      const nextTask = await apiJson(`/api/v1/tasks/${encodeURIComponent(taskKey)}`)
      const [nextDirectory, nextParent] = await Promise.all([
        apiJson('/api/v1/assignment/options?recordType=Service%20Request').catch(() => ({ people: [], teams: [] })),
        nextTask.primaryRequest?.id ? apiJson(`/api/v1/service-requests/${encodeURIComponent(nextTask.primaryRequest.id)}`).catch(() => null) : null,
      ])
      setTask(nextTask)
      setDirectory(nextDirectory || { people: [], teams: [] })
      setParentRequest(nextParent)
      setTeam(nextTask.team || '')
      setAssignee(nextTask.assignee || 'Unassigned')
      setCompletionNotes(nextTask.completionNotes || '')
    } catch (loadError) { setError(loadError.message) } finally { if (!quiet) setLoading(false) }
  }

  useEffect(() => { void load() }, [taskKey])

  async function patch(body, success) {
    setSaving(true); setError(''); setNotice('')
    try {
      await apiJson(`/api/v1/tasks/${encodeURIComponent(taskKey)}`, { method: 'PATCH', body: JSON.stringify(body) })
      await load({ quiet: true })
      setCompletionOpen(false)
      setAssignmentEditing(false)
      if (success) setNotice(success)
      return true
    } catch (saveError) { setError(saveError.message); return false } finally { setSaving(false) }
  }

  async function ownershipAction(action, success) {
    if (saving) return
    setSaving(true); setError(''); setNotice('')
    try {
      await apiJson(`/api/v1/tasks/${encodeURIComponent(taskKey)}/${action}`, { method: 'POST' })
      await load({ quiet: true })
      setNotice(success)
    } catch (ownershipError) { setError(ownershipError.message) } finally { setSaving(false) }
  }

  if (loading) return <section className="production-task-experience task-work-item is-loading"><div className="activity-canvas-skeleton is-heading" /><div className="activity-canvas-skeleton is-ribbon" /></section>
  if (!task) return <section className="production-task-experience task-work-item"><div className="activity-canvas-failure"><strong>Could not open this task</strong><span>{error}</span><button type="button" onClick={() => load()}>Retry</button></div></section>
  const completed = task.status === 'Completed'
  const parent = task.primaryRequest || {}
  const session = readSession()
  const taskUnassigned = !task.assignee || task.assignee === 'Unassigned'
  const taskIsMine = !taskUnassigned && (
    (task.assigneeEmail && session.email && task.assigneeEmail.toLowerCase() === String(session.email).toLowerCase())
    || (task.assignee && session.name && task.assignee === session.name)
  )
  const canTake = task.status === 'Ready' && taskUnassigned
  const canRelease = task.status === 'Ready' && taskIsMine
  const detailDue = dueMeta(task.dueAt, task.status)
  const teams = directory.teams || []
  const selectedTeam = teams.find((item) => item.name === team) || null
  const allPeople = directory.people || []
  const teamPeople = selectedTeam ? (selectedTeam.members || []) : allPeople
  const selectedAssignee = allPeople.find((person) => person.name === assignee) || null
  const assignmentDirty = team !== (task.team || '') || assignee !== (task.assignee || 'Unassigned')
  const taskEvents = (parentRequest?.activities || []).filter((activity) => activity?.metadata?.taskKey === task.id)
  const taskAttachments = taskEvents.flatMap((activity) => (activity.attachments || []).map((item, index) => ({ ...item, eventId: activity.id, _key: item.id || `${activity.id}-${index}` })))
  const tabs = [
    ['overview', 'Overview'],
    ['activity', `Activity${taskEvents.length ? ` ${taskEvents.length + 1}` : ''}`],
    ['attachments', `Attachments${taskAttachments.length ? ` ${taskAttachments.length}` : ''}`],
    ['audit', 'Audit Log'],
  ]
  const activeTabLabel = (tabs.find(([value]) => value === tab)?.[1] || 'Overview').replace(/\s+\d+$/, '')

  const personMatches = (left, right) => {
    if (!left || !right) return false
    return Boolean(
      (left.databaseId && right.databaseId && left.databaseId === right.databaseId)
      || (left.id && right.id && left.id === right.id)
      || (left.email && right.email && left.email.toLowerCase() === right.email.toLowerCase())
      || (left.name && right.name && left.name === right.name)
    )
  }

  const chooseAssignee = (person) => {
    if (!person) { setAssignee('Unassigned'); return }
    setAssignee(person.name || 'Unassigned')
    const compatible = teams.filter((candidate) => (candidate.members || []).some((member) => personMatches(member, person)))
    if (selectedTeam && compatible.some((candidate) => candidate.name === selectedTeam.name)) return
    const preferred = compatible.find((candidate) => (candidate.members || []).some((member) => personMatches(member, person) && member.isPrimary)) || compatible[0]
    if (preferred) setTeam(preferred.name)
  }

  const changeTeam = (nextTeam) => {
    const nextName = nextTeam?.name || ''
    setTeam(nextName)
    if (!nextTeam) { setAssignee('Unassigned'); return }
    const stillEligible = selectedAssignee && (nextTeam.members || []).some((member) => personMatches(member, selectedAssignee))
    if (!stillEligible) setAssignee('Unassigned')
  }

  const renderAssignmentEditor = () => <div className="task-detail-assignment-editor">
    <label><span>Assignment group</span><Hi5EntityTypeahead items={teams} value={selectedTeam} disabled={completed || saving} onSelect={changeTeam} placeholder="Type at least 2 characters…" minimumCharacters={2} emptyLabel="No matching assignment groups" getSearchText={(item) => item.name || ''} getMeta={(item) => `${(item.members || []).length} eligible technician${(item.members || []).length === 1 ? '' : 's'}`} /></label>
    <label><span>Assignee</span><Hi5EntityTypeahead items={teamPeople} value={selectedAssignee} disabled={completed || saving} onSelect={chooseAssignee} placeholder="Type at least 2 characters…" minimumCharacters={2} emptyLabel={team ? `No matching eligible users in ${team}` : 'No matching eligible technicians'} /></label>
    {assignmentDirty && !completed ? <button type="button" disabled={saving} onClick={() => patch({ team, assignee }, 'Assignment saved')}><Check size={15} />Save assignment</button> : null}
  </div>

  const renderOverview = () => <div className="task-detail-overview">
    <section className="task-detail-card task-detail-instructions">
      <header><div><span>Work item</span><h2>Task instructions</h2></div></header>
      <div className="task-detail-card-body"><p>{task.instructions || 'No additional instructions were supplied for this task.'}</p>{task.completionNotes ? <div className="task-detail-completion-note"><CheckCircle2 size={16} /><span><small>Completion notes</small><strong>{task.completionNotes}</strong></span></div> : null}</div>
    </section>

    <section className="task-detail-card">
      <header><div><span>Context</span><h2>Task information</h2></div></header>
      <div className="task-detail-facts">
        <button type="button" onClick={() => parent.id && navigate(`/requests/${encodeURIComponent(parent.id)}`)}><small>Primary request</small><strong>{parent.id || 'Not recorded'}</strong><span>{parent.title || 'No parent request title'}</span></button>
        <div><small>Requester</small><strong>{parent.requester || 'Not recorded'}</strong><span>{parent.requesterEmail || 'No requester email'}</span></div>
        <div><small>Service</small><strong>{parent.service || 'Not recorded'}</strong><span>Service context</span></div>
        <div><small>Due / target</small><strong>{task.dueAt ? formatDate(task.dueAt) : 'No due date'}</strong><span className={detailDue.overdue ? 'is-danger' : ''}>{detailDue.label}</span></div>
        <div><small>Dependencies</small><strong>{task.dependencies?.length ? `${task.dependencies.length} prerequisite${task.dependencies.length === 1 ? '' : 's'}` : 'None'}</strong><span>{task.dependencies?.length ? 'Workflow dependencies recorded' : 'No prerequisites'}</span></div>
        <div><small>Created</small><strong>{formatDate(task.createdAt)}</strong><span>Task creation time</span></div>
      </div>
    </section>

    <section className="task-detail-card">
      <header><div><span>Ownership</span><h2>Assignment</h2></div><button type="button" disabled={completed} onClick={() => setAssignmentEditing((value) => !value)}>{assignmentEditing ? 'Close' : 'Edit'}</button></header>
      <div className="task-detail-assignment-summary"><span><small>Team</small><strong>{task.team || 'Unassigned'}</strong></span><span><small>Assignee</small><strong>{task.assignee || 'Unassigned'}</strong></span></div>
      {assignmentEditing ? renderAssignmentEditor() : null}
    </section>
  </div>

  const renderActivity = () => <section className="task-detail-card task-detail-activity">
    {completionOpen && !completed ? <div className="task-work-item-composer"><label><span>Completion notes</span><textarea rows="3" value={completionNotes} disabled={saving || !taskIsMine} onChange={(event) => setCompletionNotes(event.target.value)} placeholder="Record what was completed and any relevant outcome…" /></label><button type="button" disabled={saving || !taskIsMine || !completionNotes.trim()} onClick={() => patch({ status: 'Completed', completionNotes }, 'Task completed')}><CheckCircle2 size={15} />Complete task</button></div> : null}
    <header><div><span>Timeline</span><h2>Activity</h2></div></header>
    <div className="task-detail-timeline">{taskEvents.length ? taskEvents.map((event) => <div className="task-work-item-event" key={event.id}><i /><div><strong>{event.text || event.message || 'Task updated'}</strong><small>{event.actor || 'Hi5Central'} · {formatDate(event.createdAt)}</small></div></div>) : <div className="task-detail-empty">No task-specific activity has been recorded yet.</div>}{completed && !taskEvents.length ? <div className="task-work-item-event"><i /><div><strong>Task completed</strong><small>{task.completionNotes || 'No completion notes'} · {formatDate(task.completedAt)}</small></div></div> : null}</div>
  </section>

  const renderAttachments = () => <section className="task-detail-card"><header><div><span>Evidence</span><h2>Attachments</h2></div></header><div className="task-detail-list">{taskAttachments.length ? taskAttachments.map((item, index) => <div className="task-work-item-attachment" key={item.id || item._key || index}><span><Paperclip size={17} /></span><div><strong>{item.name || item.fileName || 'Attachment'}</strong><small>{item.size ? `${Math.max(1, Math.round(Number(item.size) / 1024))} KB` : 'Attached to task activity'}</small></div></div>) : <div className="task-detail-empty">No attachments are linked to this task yet.</div>}</div></section>

  const renderAudit = () => <section className="task-detail-card"><header><div><span>Forensic history</span><h2>Audit Log</h2></div></header><div className="task-detail-list">{taskEvents.length ? taskEvents.map((event) => <div className="task-work-item-audit" key={event.id}><time>{formatDate(event.createdAt)}</time><div><strong>{event.text || event.message || event.metadata?.event || 'Task updated'}</strong><small>{event.actor || 'Hi5Central'}{event.metadata?.event ? ` · ${event.metadata.event}` : ''}</small></div></div>) : <div className="task-detail-empty">No task-specific audit events have been recorded yet.</div>}</div></section>

  const activeContent = tab === 'overview' ? renderOverview() : tab === 'attachments' ? renderAttachments() : tab === 'audit' ? renderAudit() : renderActivity()

  return <section className="production-task-experience task-work-item task-detail-rmm production-motion-enter">
    <nav className="task-detail-breadcrumbs" aria-label="Breadcrumb">
      <button type="button" onClick={() => navigate('/tasks')}>Tasks</button><ChevronRight size={13} />
      <button type="button" onClick={() => setTab('overview')}>{task.id}</button><ChevronRight size={13} />
      <span>{activeTabLabel}</span>
    </nav>

    <section className="task-detail-hero">
      <span className="task-detail-hero-icon"><ListChecks size={27} /></span>
      <div className="task-detail-identity">
        <div><strong>{task.id}</strong><span className={`activity-canvas-pill ${statusClass(task.status)}`}>{task.status}</span><span className={`activity-canvas-pill ${priorityClass(parent.priority || 'Medium')}`}>{parent.priority || 'Medium'}</span></div>
        <h1>{task.title}</h1>
        <p>{task.team || 'Unassigned'} / {task.assignee || 'Unassigned'} · Parent {parent.id || 'not recorded'} · {detailDue.label}</p>
      </div>
      <div className="task-detail-hero-actions">
        {canTake ? <button type="button" className="is-primary" disabled={saving} onClick={() => ownershipAction('take', 'Task taken')}><UserPlus size={16} />Take task</button> : null}
        {canRelease ? <button type="button" disabled={saving} onClick={() => ownershipAction('release', 'Task released to team queue')}><UserMinus size={16} />Release</button> : null}
        <details className="record-lab-action-menu task-detail-action-menu">
          <summary><UserPlus size={16} /><span>Assignment</span><ChevronDown size={14} /></summary>
          <div className="record-lab-action-menu-popover">
            <button type="button" disabled={completed} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); setTab('overview'); setAssignmentEditing(true) }}><UserPlus size={15} /><span><strong>Edit assignment</strong><small>Change team or technician</small></span></button>
            <button type="button" disabled={!parent.id} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); if (parent.id) navigate(`/requests/${encodeURIComponent(parent.id)}`) }}><ExternalLink size={15} /><span><strong>Open parent</strong><small>{parent.id || 'No parent request'}</small></span></button>
          </div>
        </details>
        <details className="record-lab-action-menu task-detail-action-menu">
          <summary><CheckCircle2 size={16} /><span>Status</span><ChevronDown size={14} /></summary>
          <div className="record-lab-action-menu-popover align-right">
            <button type="button" disabled={saving || completed || !taskIsMine} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); void patch({ status: 'In Progress' }, 'Task started') }}><PlayCircle size={15} /><span><strong>Start</strong><small>Set task in progress</small></span></button>
            <button type="button" disabled={saving || completed || !taskIsMine} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); void patch({ status: 'Blocked' }, 'Task blocked') }}><CircleStop size={15} /><span><strong>Block</strong><small>Mark task blocked</small></span></button>
            <button type="button" disabled={saving || completed || !taskIsMine} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); setTab('activity'); setCompletionOpen(true) }}><CheckCircle2 size={15} /><span><strong>Complete</strong><small>Add completion notes and finish</small></span></button>
          </div>
        </details>
      </div>
    </section>

    {error ? <div className="activity-canvas-banner is-error"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => setError('')}><X size={15} /></button></div> : null}
    {notice ? <div className="activity-canvas-banner is-success"><CheckCircle2 size={17} /><span>{notice}</span><button type="button" onClick={() => setNotice('')}><X size={15} /></button></div> : null}

    <nav className="task-detail-tabs">{tabs.map(([value, label]) => <button type="button" key={value} className={tab === value ? 'is-active' : ''} onClick={() => { setCompletionOpen(false); setTab(value) }}>{label}</button>)}<button type="button" className="task-detail-refresh" onClick={() => load({ quiet: true })}><RefreshCw size={15} /><span>Refresh</span></button></nav>
    <main className="task-detail-content">{activeContent}</main>
  </section>
}

export function ProductionTaskExperience() {
  const [taskRoute, setTaskRoute] = useState(() => routeFromPath())
  const targets = useWorkspaceTargets(taskRoute)

  useEffect(() => {
    const update = () => setTaskRoute(routeFromPath())
    window.addEventListener('popstate', update)
    window.addEventListener('hi5-routechange', update)
    const timer = window.setInterval(update, 250)
    return () => { window.removeEventListener('popstate', update); window.removeEventListener('hi5-routechange', update); window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    const node = targets.content
    if (!(node instanceof HTMLElement) || !taskRoute) return undefined
    node.classList.add('production-task-mounted')
    return () => node.classList.remove('production-task-mounted')
  }, [targets.content, taskRoute])

  return <>
    <TaskNavButton target={targets.nav} />
    <AwaitingApprovalButton target={targets.approvalTarget} statusSelect={targets.approvalSelect} />
    {taskRoute && targets.content ? createPortal(taskRoute.kind === 'detail' ? <TaskDetail key={taskRoute.taskKey} taskKey={taskRoute.taskKey} /> : <TaskQueue />, targets.content) : null}
  </>
}

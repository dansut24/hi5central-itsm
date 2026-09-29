import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ReactGridLayout, { useContainerWidth, verticalCompactor } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { createSortedRowModel, rowSortingFeature, sortFns, tableFeatures, useTable } from '@tanstack/react-table'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleGauge,
  ClipboardCheck,
  Clock3,
  Copy,
  GripVertical,
  Headphones,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogIn,
  LogOut,
  MessageSquarePlus,
  Monitor,
  Moon,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Search,
  Send,
  Server,
  Settings,
  Share2,
  SlidersHorizontal,
  Star,
  Sun,
  Trash2,
  UserCheck,
  UserRound,
  Users,
  Wrench,
  X
} from 'lucide-react'
import { accentOptions, workspaceUsers, incidentServices, workspaceLoginProfiles, priorities, statusOptions, teams, types } from '../../runtime/workspaceConfig.jsx'
import { priorityClass, statusClass } from '../../lib/workspace.js'
import { UnifiedRecordDetailView } from './UnifiedRecordDetailView.jsx'

export function LoginScreen() {
  return null
}

export function SelfServiceShell({
  accent,
  activeRequest,
  currentUser,
  handleLogout,
  handlePortalSubmit,
  openPortalHome,
  openPortalRequest,
  portalDraft,
  portalQuery,
  portalResults,
  serviceCatalog,
  setPortalDraft,
  setPortalQuery,
  setTheme,
  theme,
  tickets,
  toast,
}) {
  return (
    <div className="portal-shell" data-accent={accent} data-theme={theme}>
      <header className="portal-shell-header">
        <div className="portal-shell-brand">
          <img src={`${import.meta.env.BASE_URL}hi5central-logo.png`} alt="Hi5Central" />
          <div>
            <span>Technology Services</span>
            <strong>Self-Service Portal</strong>
          </div>
        </div>
        <div className="portal-shell-actions">
          <button
            className="icon-button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            type="button"
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <button className="user-pill" onClick={handleLogout} title="Sign out" type="button">
            <span>{currentUser.initials}</span>
            <LogOut size={15} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="portal-page">
        {activeRequest ? (
          <PortalRequestView
            onBack={openPortalHome}
            request={activeRequest}
          />
        ) : (
          <SelfServicePortal
            currentUser={currentUser}
            handlePortalSubmit={handlePortalSubmit}
            openPortalRequest={openPortalRequest}
            portalDraft={portalDraft}
            portalQuery={portalQuery}
            portalResults={portalResults}
            serviceCatalog={serviceCatalog}
            setPortalDraft={setPortalDraft}
            setPortalQuery={setPortalQuery}
            tickets={tickets}
          />
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  )
}


export function PortalRequestView({ onBack, request }) {
  return (
    <div className="portal-request-detail">
      <button className="text-button portal-back-button" onClick={onBack} type="button">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to Self-Service
      </button>

      <section className="portal-request-card">
        <div className="detail-header">
          <div>
            <span className="eyebrow">{request.id}</span>
            <h2>{request.title}</h2>
          </div>
          <span className={`status-pill ${statusClass(request.status)}`}>{request.status}</span>
        </div>

        <div className="detail-grid">
          <InfoItem label="Type" value={request.type} icon={Inbox} />
          <InfoItem label="Service" value={request.service} icon={Server} />
          <InfoItem label="Priority" value={request.priority} icon={CircleGauge} />
          <InfoItem label="Updated" value={request.updated} icon={Clock3} />
        </div>

        <p className="detail-copy">{request.description}</p>

        <div className="next-step">
          <strong>What happens next</strong>
          <span>{request.nextStep}</span>
        </div>

        <div className="timeline">
          {request.comments.map((comment, index) => (
            <div className="timeline-item" key={`${request.id}-portal-${index}-${comment}`}>
              <span></span>
              <p>{comment}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export function NewTabView({ navItems, openNewRecord, openRecordTab, openTab, tickets }) {
  const [launcherQuery, setLauncherQuery] = useState('')
  const quickLinks = navItems
  const createActions = [
    ['Incident', 'Report and manage an interruption'],
    ['Service Request', 'Request access, hardware or a service'],
    ['Problem', 'Investigate a recurring root cause'],
    ['Change', 'Plan and approve a controlled change'],
  ]
  const normalizedQuery = launcherQuery.trim().toLowerCase()
  const matchingRecords = normalizedQuery
    ? tickets
        .filter((ticket) =>
          [ticket.id, ticket.title, ticket.requester, ticket.service, ticket.team]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery),
        )
        .slice(0, 8)
    : []
  const matchingWorkspaces = normalizedQuery
    ? quickLinks.filter((item) => item.label.toLowerCase().includes(normalizedQuery))
    : []

  return (
    <div className="new-tab-view launcher-view">
      <section className="launcher-shell">
        <div className="launcher-heading">
          <span className="eyebrow">Workspace launcher</span>
          <h2>What would you like to open?</h2>
          <p>Search records, create work or jump straight to another Hi5Central workspace.</p>
        </div>

        <label className="launcher-search">
          <Search size={18} aria-hidden="true" />
          <input
            autoFocus
            onChange={(event) => setLauncherQuery(event.target.value)}
            placeholder="Search records or workspaces"
            type="search"
            value={launcherQuery}
          />
          <span>Search</span>
        </label>

        {normalizedQuery ? (
          <div className="launcher-results">
            <section className="launcher-section">
              <div className="launcher-section-heading">
                <strong>Records</strong>
                <span>{matchingRecords.length} result{matchingRecords.length === 1 ? '' : 's'}</span>
              </div>
              <div className="launcher-record-list">
                {matchingRecords.map((ticket) => (
                  <button key={ticket.id} onClick={() => openRecordTab(ticket)} type="button">
                    <span className={`priority-dot ${priorityClass(ticket.priority)}`} />
                    <span className="launcher-record-id">{ticket.id}</span>
                    <strong>{ticket.title}</strong>
                    <small>{ticket.status} · {ticket.team}</small>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                ))}
                {!matchingRecords.length && (
                  <div className="launcher-empty">No records match “{launcherQuery.trim()}”.</div>
                )}
              </div>
            </section>

            {!!matchingWorkspaces.length && (
              <section className="launcher-section">
                <div className="launcher-section-heading">
                  <strong>Workspaces</strong>
                </div>
                <div className="launcher-workspace-grid compact">
                  {matchingWorkspaces.map((item) => (
                    <button key={item.id} onClick={() => openTab(item.id)} type="button">
                      <strong>{item.label}</strong>
                      <span>Open workspace</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="launcher-default-grid">
            <section className="launcher-section launcher-create-section">
              <div className="launcher-section-heading">
                <strong>Create</strong>
                <span>Start new work</span>
              </div>
              <div className="launcher-create-grid">
                {createActions.map(([recordType, description]) => (
                  <button key={recordType} onClick={() => openNewRecord(recordType)} type="button">
                    <span className="launcher-create-icon"><Plus size={16} aria-hidden="true" /></span>
                    <span>
                      <strong>{recordType}</strong>
                      <small>{description}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="launcher-section">
              <div className="launcher-section-heading">
                <strong>Open</strong>
                <span>Workspace</span>
              </div>
              <div className="launcher-workspace-grid">
                {quickLinks.map((item) => (
                  <button key={item.id} onClick={() => openTab(item.id)} type="button">
                    <strong>{item.label}</strong>
                    <span>{item.id === 'home' ? 'Operational dashboard' : `Open ${item.label.toLowerCase()}`}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="launcher-section launcher-recent-section">
              <div className="launcher-section-heading">
                <strong>Recent</strong>
                <span>Records</span>
              </div>
              <div className="launcher-record-list">
                {tickets.slice(0, 6).map((ticket) => (
                  <button key={ticket.id} onClick={() => openRecordTab(ticket)} type="button">
                    <span className={`priority-dot ${priorityClass(ticket.priority)}`} />
                    <span className="launcher-record-id">{ticket.id}</span>
                    <strong>{ticket.title}</strong>
                    <small>{ticket.status} · {ticket.team}</small>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  )
}

const DASHBOARD_STORAGE_KEY = 'hi5central-dashboards-v3'
const DASHBOARD_MAX_WIDGETS = 12

const DASHBOARD_WIDGET_LIBRARY = [
  { id: 'active-records', label: 'Active Records', category: 'Metrics', description: 'Open workload with trend context', defaultSpan: 4 },
  { id: 'high-priority', label: 'High Priority', category: 'Metrics', description: 'Critical and high priority workload', defaultSpan: 4 },
  { id: 'approvals', label: 'Approvals', category: 'Metrics', description: 'Records waiting for approval', defaultSpan: 4 },
  { id: 'sla-watch', label: 'SLA Watch', category: 'Metrics', description: 'Records approaching SLA targets', defaultSpan: 4 },
  { id: 'my-work', label: 'My Work', category: 'Records', description: 'Records assigned to the current analyst', defaultSpan: 4 },
  { id: 'needs-attention', label: 'Needs Attention', category: 'Records', description: 'High priority and SLA-risk work', defaultSpan: 4 },
  { id: 'service-queue', label: 'Live Service Queue', category: 'Tables', description: 'Full-width sortable operational table', defaultSpan: 12 },
  { id: 'team-workload', label: 'Team Workload', category: 'Analytics', description: 'Current workload by assignment group', defaultSpan: 4 },
  { id: 'priority-mix', label: 'Priority Mix', category: 'Analytics', description: 'Current workload split by priority', defaultSpan: 4 },
  { id: 'service-health', label: 'Service Health', category: 'Analytics', description: 'Open work grouped by service', defaultSpan: 4 },
  { id: 'change-schedule', label: 'Upcoming Changes', category: 'Records', description: 'Implementation schedule and CAB work', defaultSpan: 4 },
  { id: 'recent-activity', label: 'Recent Activity', category: 'Activity', description: 'Latest meaningful record activity', defaultSpan: 4 },
  { id: 'saved-filter', label: 'Saved Filter', category: 'Records', description: 'Reusable filtered record list', defaultSpan: 4 },
  { id: 'heading', label: 'Heading / Note', category: 'Custom', description: 'Short operational note for a dashboard', defaultSpan: 4 },
]

const DASHBOARD_SIZE_OPTIONS = [
  { id: 4, label: 'Standard' },
  { id: 12, label: 'Full width' },
]

const DASHBOARD_TEMPLATES = [
  {
    id: 'my-work-template',
    name: 'My Work',
    description: 'A compact personal analyst dashboard designed to fit one screen.',
    widgets: [
      ['active-records', 4], ['high-priority', 4], ['sla-watch', 4],
      ['my-work', 4], ['needs-attention', 4], ['team-workload', 4],
      ['service-queue', 12],
    ],
  },
  {
    id: 'service-desk-template',
    name: 'Service Desk Operations',
    description: 'Queues, SLA pressure and team workload in a three-row operations view.',
    widgets: [
      ['active-records', 4], ['high-priority', 4], ['sla-watch', 4],
      ['team-workload', 4], ['priority-mix', 4], ['service-health', 4],
      ['service-queue', 12],
    ],
  },
  {
    id: 'cab-template',
    name: 'CAB & Change',
    description: 'Approvals, upcoming change activity and a sortable change queue.',
    widgets: [
      ['approvals', 4], ['high-priority', 4], ['change-schedule', 4],
      ['recent-activity', 4], ['service-health', 4], ['priority-mix', 4],
      ['service-queue', 12, { title: 'Change Queue', filterType: 'Change' }],
    ],
  },
  {
    id: 'executive-template',
    name: 'Executive Service Overview',
    description: 'High-level workload, risk and service distribution.',
    widgets: [
      ['active-records', 4], ['high-priority', 4], ['sla-watch', 4],
      ['service-health', 4], ['priority-mix', 4], ['team-workload', 4],
    ],
  },
]

const DASHBOARD_TABLE_FEATURES = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
})

function makeDashboardWidget(type, span, overrides = {}) {
  const definition = DASHBOARD_WIDGET_LIBRARY.find((item) => item.id === type)
  return {
    id: overrides.id || `DW-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    title: overrides.title || definition?.label || 'Widget',
    span: (span === 12 || definition?.defaultSpan === 12) ? 12 : 4,
    limit: overrides.limit || 6,
    note: overrides.note || 'Use this space for team guidance, operational context or a handover note.',
    filterType: overrides.filterType || 'All',
  }
}

function widgetsFromTemplate(template) {
  return template.widgets.map(([type, span, overrides], index) =>
    makeDashboardWidget(type, span, { ...(overrides || {}), id: `${template.id}-${type}-${index}` }),
  )
}

function seedDashboards() {
  const [myWork, serviceDesk, cab, executive] = DASHBOARD_TEMPLATES
  return [
    {
      id: 'DB-MY-WORK',
      name: 'My Work',
      owner: 'Hi5Central User',
      scope: 'mine',
      isDefault: true,
      canEdit: true,
      description: 'Your personal day-to-day analyst workspace.',
      widgets: widgetsFromTemplate(myWork),
      shares: [],
    },
    {
      id: 'DB-SERVICE-DESK',
      name: 'Service Desk Operations',
      owner: 'Service Desk Leads',
      scope: 'team',
      team: 'Service Desk',
      isDefault: false,
      canEdit: true,
      description: 'Shared operational view for the Service Desk team.',
      widgets: widgetsFromTemplate(serviceDesk),
      shares: [
        { id: 'TEAM-Service Desk', kind: 'team', name: 'Service Desk', permission: 'Can edit' },
        { id: 'USR-Priya Raman', kind: 'user', name: 'Priya Raman', permission: 'Can view' },
      ],
    },
    {
      id: 'DB-CAB',
      name: 'CAB & Change',
      owner: 'Change Management',
      scope: 'shared',
      isDefault: false,
      canEdit: false,
      description: 'Shared CAB schedule and approval view.',
      widgets: widgetsFromTemplate(cab),
      shares: [{ id: 'TEAM-Infrastructure', kind: 'team', name: 'Infrastructure', permission: 'Can view' }],
    },
    {
      id: 'DB-EXEC',
      name: 'Executive Service Overview',
      owner: 'Technology Leadership',
      scope: 'shared',
      isDefault: false,
      canEdit: false,
      description: 'High-level shared service-management overview.',
      widgets: widgetsFromTemplate(executive),
      shares: [],
    },
  ]
}

function cloneDashboards(value) {
  return JSON.parse(JSON.stringify(value))
}

function loadDashboards() {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_STORAGE_KEY)
    if (!stored) return seedDashboards()
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.length) return seedDashboards()
    return parsed.map((dashboard) => ({
      ...dashboard,
      widgets: Array.isArray(dashboard.widgets)
        ? dashboard.widgets.map((widget) => ({ ...widget, span: widget.span === 12 ? 12 : 4 }))
        : [],
    }))
  } catch {
    return seedDashboards()
  }
}

function dashboardWidgetIcon(type) {
  return {
    'active-records': Inbox,
    'high-priority': AlertCircle,
    approvals: ClipboardCheck,
    'sla-watch': Clock3,
    'my-work': UserCheck,
    'needs-attention': CircleGauge,
    'service-queue': ListChecks,
    'team-workload': Users,
    'priority-mix': CircleGauge,
    'service-health': Server,
    'change-schedule': CalendarClock,
    'recent-activity': MessageSquarePlus,
    'saved-filter': SlidersHorizontal,
    heading: BookOpen,
  }[type] || LayoutDashboard
}

function dashboardWidgetKind(type) {
  if (['active-records', 'high-priority', 'approvals', 'sla-watch'].includes(type)) return 'Metric'
  if (['team-workload', 'priority-mix', 'service-health'].includes(type)) return 'Analytics'
  if (type === 'service-queue') return 'Table'
  if (type === 'heading') return 'Note'
  return 'List'
}

function buildTrend(value, seed = 0) {
  const base = Math.max(2, Number(value) || 2)
  const shifts = [0.72, 0.81, 0.76, 0.88, 0.84, 0.94, 1]
  return shifts.map((ratio, index) => ({ day: index + 1, value: Math.max(1, Math.round(base * ratio + ((seed + index) % 3 - 1))) }))
}

function objectToChartData(value, limit = 5) {
  return Object.entries(value || {})
    .map(([name, count]) => ({ name, value: count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

const DASHBOARD_GRID_COLUMNS = 12
const DASHBOARD_STANDARD_ROW_CAPACITY = 3

function packDashboardLayout(widgets, maxAcross) {
  const layout = []
  let index = 0
  let y = 0
  const rowCapacity = Math.max(1, Math.min(DASHBOARD_STANDARD_ROW_CAPACITY, maxAcross || DASHBOARD_STANDARD_ROW_CAPACITY))

  while (index < widgets.length) {
    const widget = widgets[index]

    if (widget.span === 12) {
      layout.push({
        i: widget.id,
        x: 0,
        y,
        w: DASHBOARD_GRID_COLUMNS,
        h: 1,
        minW: DASHBOARD_GRID_COLUMNS,
        maxW: DASHBOARD_GRID_COLUMNS,
        minH: 1,
        maxH: 1,
      })
      index += 1
      y += 1
      continue
    }

    const row = []
    while (index < widgets.length && widgets[index].span !== 12 && row.length < rowCapacity) {
      row.push(widgets[index])
      index += 1
    }

    // Standard rows always consume the complete available row:
    // 3 widgets = 4/4/4, 2 widgets = 6/6, 1 widget = 12.
    const cellWidth = DASHBOARD_GRID_COLUMNS / Math.max(1, row.length)
    row.forEach((rowWidget, rowIndex) => {
      layout.push({
        i: rowWidget.id,
        x: rowIndex * cellWidth,
        y,
        w: cellWidth,
        h: 1,
        minW: cellWidth,
        maxW: cellWidth,
        minH: 1,
        maxH: 1,
      })
    })
    y += 1
  }

  return layout
}

function dashboardRowCount(layout) {
  if (!layout.length) return 1
  return Math.max(...layout.map((item) => item.y + item.h))
}

function applyDashboardSlotWidths(previousWidgets, reorderedWidgets) {
  const slotWidths = previousWidgets.map((widget) => widget.span === 12 ? 12 : 4)
  return reorderedWidgets.map((widget, index) => ({
    ...widget,
    span: slotWidths[index] ?? (widget.span === 12 ? 12 : 4),
  }))
}

function applyDashboardReorderWidths(previousWidgets, reorderedWidgets) {
  // Dragging a full-width widget into the incomplete standard row directly
  // above it fills that row; there is no full-width slot to transfer. This
  // mirrors the accessible Move earlier action and prevents an existing
  // standard widget from unexpectedly becoming full width after a drag.
  const reorderedIndexes = new Map(reorderedWidgets.map((widget, index) => [widget.id, index]))
  const incompleteRowFillers = new Set()

  previousWidgets.forEach((widget, previousIndex) => {
    if (widget.span !== 12) return
    const reorderedIndex = reorderedIndexes.get(widget.id)
    if (typeof reorderedIndex !== 'number' || reorderedIndex >= previousIndex) return
    const remainder = consecutiveStandardCountBefore(previousWidgets, previousIndex)
      % DASHBOARD_STANDARD_ROW_CAPACITY
    if (remainder > 0 && remainder < DASHBOARD_STANDARD_ROW_CAPACITY) {
      incompleteRowFillers.add(widget.id)
    }
  })

  if (incompleteRowFillers.size) {
    return reorderedWidgets.map((widget) => ({
      ...widget,
      span: incompleteRowFillers.has(widget.id) ? 4 : widget.span,
    }))
  }

  return applyDashboardSlotWidths(previousWidgets, reorderedWidgets)
}

function insertWidgetIntoOpenStandardRow(widgets, widget) {
  // Width is semantic (Standard or Full). Standard visual width is derived
  // from row occupancy, so fill the first incomplete 3-widget standard row.
  let standardCount = 0
  for (let index = 0; index < widgets.length; index += 1) {
    if (widgets[index].span === 12) {
      const remainder = standardCount % DASHBOARD_STANDARD_ROW_CAPACITY
      if (remainder > 0) {
        const next = [...widgets]
        next.splice(index, 0, { ...widget, span: 4 })
        return next
      }
      standardCount = 0
      continue
    }
    standardCount += 1
  }

  return [...widgets, { ...widget, span: widget.span === 12 ? 12 : 4 }]
}

function consecutiveStandardCountBefore(widgets, index) {
  let count = 0
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (widgets[cursor].span === 12) break
    count += 1
  }
  return count
}

function DashboardMetric({ detail, onClick, trend, trendLabel, value }) {
  const trendData = buildTrend(value, trend)
  return (
    <button className="dashboard-metric-v3" onClick={onClick} type="button">
      <div className="dashboard-metric-value-row">
        <strong>{value}</strong>
        <span className={`dashboard-metric-trend ${trend < 0 ? 'is-good' : trend > 0 ? 'is-up' : ''}`}>{trend > 0 ? '+' : ''}{trend}%</span>
      </div>
      <div className="dashboard-metric-context">
        <span>{detail}</span>
        <small>{trendLabel}</small>
      </div>
      <div className="dashboard-sparkline" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendData} margin={{ top: 4, right: 2, left: 2, bottom: 1 }}>
            <defs>
              <linearGradient id={`spark-${String(detail).replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--dashboard-accent)" stopOpacity={0.24} />
                <stop offset="100%" stopColor="var(--dashboard-accent)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke="var(--dashboard-accent)" strokeWidth={2} fill={`url(#spark-${String(detail).replace(/\W/g, '')})`} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </button>
  )
}

function DashboardBarChart({ data }) {
  const rows = objectToChartData(data)
  if (!rows.length) return <div className="dashboard-widget-empty">No data in this view.</div>
  return (
    <div className="dashboard-chart-v3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="var(--dashboard-grid-line)" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis dataKey="name" type="category" width={82} tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: 'var(--surface-soft)' }} contentStyle={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)', color: 'var(--ink)', fontSize: 11 }} />
          <Bar dataKey="value" fill="var(--dashboard-accent)" radius={[0, 7, 7, 0]} maxBarSize={15} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function DashboardPriorityChart({ data }) {
  const rows = objectToChartData(data, 6)
  const total = rows.reduce((sum, item) => sum + item.value, 0)
  const palette = ['#d64545', '#ef7d32', '#d6a72f', 'var(--dashboard-accent)', '#6f7f94', '#9aa5b4']
  if (!rows.length) return <div className="dashboard-widget-empty">No data in this view.</div>
  return (
    <div className="dashboard-donut-v3">
      <div className="dashboard-donut-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip contentStyle={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)', color: 'var(--ink)', fontSize: 11 }} />
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="80%" paddingAngle={3} stroke="none" isAnimationActive={false}>
              {rows.map((entry, index) => <Cell fill={palette[index % palette.length]} key={entry.name} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span><strong>{total}</strong><small>records</small></span>
      </div>
      <div className="dashboard-donut-legend">
        {rows.slice(0, 4).map((entry, index) => <span key={entry.name}><i style={{ background: palette[index % palette.length] }} /><b>{entry.name}</b><small>{entry.value}</small></span>)}
      </div>
    </div>
  )
}

function Hi5DashboardTable({ mobile = false, onOpen, rows }) {
  const tableHostRef = useRef(null)
  const [page, setPage] = useState(0)
  const [hostHeight, setHostHeight] = useState(190)

  useEffect(() => {
    const node = tableHostRef.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => setHostHeight(entry.contentRect.height || 190))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const columns = useMemo(() => [
    {
      accessorKey: 'id',
      header: 'Reference',
      cell: (info) => <strong className="dashboard-table-ref">{info.getValue()}</strong>,
    },
    {
      accessorKey: 'title',
      header: 'Summary',
      cell: (info) => <span className="dashboard-table-summary">{info.getValue()}</span>,
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: (info) => <span className={`dashboard-priority-label ${priorityClass(info.getValue())}`}><i />{info.getValue()}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info) => <span className={`status-pill ${statusClass(info.getValue())}`}>{info.getValue()}</span>,
    },
    { accessorKey: 'team', header: 'Team' },
    {
      accessorKey: 'assignee',
      header: 'Assignee',
      cell: (info) => info.getValue() || 'Unassigned',
    },
    {
      accessorKey: 'slaPercent',
      header: 'SLA',
      cell: (info) => <SlaBar value={info.getValue()} label={info.row.original.sla} />,
    },
  ], [])

  const table = useTable({
    key: 'hi5-dashboard-service-queue',
    features: DASHBOARD_TABLE_FEATURES,
    columns,
    data: rows,
  })

  const sortedRows = table.getRowModel().rows
  const pageSize = mobile ? 6 : hostHeight < 150 ? 3 : 4
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const visibleRows = sortedRows.slice(safePage * pageSize, safePage * pageSize + pageSize)

  useEffect(() => {
    setPage((current) => Math.min(current, Math.max(0, pageCount - 1)))
  }, [pageCount])

  return (
    <div className={`dashboard-table-shell ${mobile ? 'is-mobile' : ''}`} ref={tableHostRef}>
      {mobile ? (
        <div className="dashboard-table-mobile-list">
          {visibleRows.map((row) => (
            <button className="dashboard-table-mobile-card" key={row.id} onClick={() => onOpen(row.original)} type="button">
              <span className="dashboard-table-mobile-main">
                <strong>{row.original.id}</strong>
                <small>{row.original.title}</small>
              </span>
              <span className="dashboard-table-mobile-meta">
                <span className={`dashboard-priority-label ${priorityClass(row.original.priority)}`}><i />{row.original.priority}</span>
                <span className={`status-pill ${statusClass(row.original.status)}`}>{row.original.status}</span>
                <small>{row.original.sla}</small>
              </span>
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <div className="dashboard-data-table-wrap">
          <table className="dashboard-data-table">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const sorted = header.column.getIsSorted()
                    return (
                      <th data-column={header.column.id} key={header.id}>
                        {header.isPlaceholder ? null : (
                          <button className={header.column.getCanSort() ? 'is-sortable' : ''} onClick={header.column.getToggleSortingHandler()} type="button">
                            <table.FlexRender header={header} />
                            {sorted === 'asc' && <ArrowUp size={11} />}
                            {sorted === 'desc' && <ArrowDown size={11} />}
                          </button>
                        )}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onOpen(row.original)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onOpen(row.original) }}
                  role="button"
                  tabIndex={0}
                >
                  {row.getAllCells().map((cell) => <td data-column={cell.column.id} key={cell.id}><table.FlexRender cell={cell} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pageCount > 1 && (
        <div className="dashboard-table-pager" aria-label="Queue pages">
          <small>{safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sortedRows.length)} of {sortedRows.length}</small>
          <span>
            <button aria-label="Previous records" disabled={safePage === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} type="button"><ArrowLeft size={13} /></button>
            <button aria-label="Next records" disabled={safePage >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} type="button"><ChevronRight size={13} /></button>
          </span>
        </div>
      )}
    </div>
  )
}

function DashboardRecordList({ emptyText = 'Nothing matches this view.', onOpen, rows }) {
  if (!rows.length) return <div className="dashboard-widget-empty">{emptyText}</div>
  return (
    <div className="dashboard-record-list-v3">
      {rows.map((ticket) => (
        <button key={ticket.id} onClick={() => onOpen(ticket)} type="button">
          <span className={`priority-dot ${priorityClass(ticket.priority)}`} />
          <span className="dashboard-record-copy"><strong>{ticket.id}</strong><small>{ticket.title}</small></span>
          <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
          <small className="dashboard-record-sla">{ticket.sla}</small>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

function DashboardWidgetFrame({ children, editMode, index, onConfigure, onMove, onRemove, widget }) {
  const Icon = dashboardWidgetIcon(widget.type)
  return (
    <article className={`dashboard-widget dashboard-widget-${widget.type}`}>
      <header className="dashboard-widget-header-v3">
        <span className="dashboard-widget-icon"><Icon size={14} aria-hidden="true" /></span>
        <span className="dashboard-widget-title"><strong>{widget.title}</strong><small>{dashboardWidgetKind(widget.type)}</small></span>
        {editMode && (
          <span className="dashboard-widget-edit-actions">
            <button className="dashboard-drag-handle" title="Drag widget" type="button"><GripVertical size={14} /></button>
            <button onClick={() => onMove?.(index, -1)} title="Move earlier" type="button"><ArrowUp size={13} /></button>
            <button onClick={() => onMove?.(index, 1)} title="Move later" type="button"><ArrowDown size={13} /></button>
            <button onClick={() => onConfigure?.(widget)} title="Configure widget" type="button"><Settings size={13} /></button>
            <button onClick={() => onRemove?.(widget.id)} title="Remove widget" type="button"><Trash2 size={13} /></button>
          </span>
        )}
      </header>
      <div className="dashboard-widget-body-v3">{children}</div>
    </article>
  )
}

function DashboardWidgetContent({ dashboardMetrics, filters, mobile = false, openRecordTab, openTab, tickets, widget }) {
  const workingTickets = tickets
    .filter((ticket) => filters.team === 'All' || ticket.team === filters.team)
    .filter((ticket) => filters.service === 'All' || ticket.service === filters.service)
    .filter((ticket) => widget.filterType === 'All' || ticket.type === widget.filterType)

  const activeTickets = workingTickets.filter((ticket) => !['Closed', 'Resolved'].includes(ticket.status))
  const riskTickets = [...workingTickets]
    .filter((ticket) => ticket.status !== 'Resolved')
    .sort((a, b) => b.slaPercent - a.slaPercent)
  const myWork = activeTickets.filter((ticket) => ['Hi5Central User', 'Priya Raman', 'Noah Williams'].includes(ticket.assignee))
  const needsAttention = activeTickets.filter((ticket) =>
    ['Critical', 'High'].includes(ticket.priority) || ticket.slaPercent >= 60 || !ticket.assignee || ticket.assignee === 'Unassigned',
  )
  const changes = workingTickets.filter((ticket) => ticket.type === 'Change')

  if (widget.type === 'active-records') {
    return <DashboardMetric detail="Open workload" onClick={() => openTab('tickets')} trend={8} trendLabel="vs last week" value={dashboardMetrics.active} />
  }
  if (widget.type === 'high-priority') {
    return <DashboardMetric detail="Critical + high" onClick={() => openTab('incidents')} trend={-6} trendLabel="risk improving" value={dashboardMetrics.highRisk} />
  }
  if (widget.type === 'approvals') {
    return <DashboardMetric detail="Awaiting decision" onClick={() => openTab('requests')} trend={3} trendLabel="since yesterday" value={dashboardMetrics.approvals} />
  }
  if (widget.type === 'sla-watch') {
    return <DashboardMetric detail="At risk today" onClick={() => openTab('incidents')} trend={-4} trendLabel="vs yesterday" value={dashboardMetrics.slaPressure} />
  }

  if (widget.type === 'heading') {
    return <div className="dashboard-note-v3"><p>{widget.note}</p></div>
  }

  if (widget.type === 'service-queue') {
    const rows = riskTickets.slice(0, Math.max(widget.limit, 6))
    return <Hi5DashboardTable mobile={mobile} onOpen={openRecordTab} rows={rows} />
  }

  if (widget.type === 'my-work') {
    return <DashboardRecordList onOpen={openRecordTab} rows={myWork.slice(0, widget.limit)} />
  }
  if (widget.type === 'needs-attention') {
    return <DashboardRecordList onOpen={openRecordTab} rows={needsAttention.slice(0, widget.limit)} />
  }
  if (widget.type === 'saved-filter') {
    return <DashboardRecordList onOpen={openRecordTab} rows={activeTickets.slice(0, widget.limit)} />
  }

  if (widget.type === 'team-workload') {
    return <DashboardBarChart data={dashboardMetrics.teamCounts} />
  }
  if (widget.type === 'service-health') {
    return <DashboardBarChart data={dashboardMetrics.serviceCounts} />
  }
  if (widget.type === 'priority-mix') {
    return <DashboardPriorityChart data={dashboardMetrics.priorityCounts} />
  }

  if (widget.type === 'change-schedule') {
    return <DashboardRecordList emptyText="No upcoming changes." onOpen={openRecordTab} rows={changes.slice(0, widget.limit)} />
  }

  if (widget.type === 'recent-activity') {
    return (
      <div className="dashboard-activity-v3">
        {workingTickets.slice(0, widget.limit).map((ticket, index) => (
          <button key={`${ticket.id}-${index}`} onClick={() => openRecordTab(ticket)} type="button">
            <span className="dashboard-activity-dot" />
            <span><strong>{ticket.id}</strong><small>{index % 2 === 0 ? 'Record updated' : 'Assignment changed'} · {ticket.title}</small></span>
            <time>{index + 2}m</time>
          </button>
        ))}
      </div>
    )
  }

  return <div className="dashboard-widget-empty">Widget preview unavailable.</div>
}

export function DashboardView({ currentUser, openRecordTab, openTab, sidebarMode, tickets }) {
  const [dashboards, setDashboards] = useState(loadDashboards)
  const [activeDashboardId, setActiveDashboardId] = useState(() => loadDashboards().find((item) => item.isDefault)?.id || 'DB-MY-WORK')
  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editSnapshot, setEditSnapshot] = useState(null)
  const [widgetCatalogOpen, setWidgetCatalogOpen] = useState(false)
  const [configureWidgetId, setConfigureWidgetId] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [dashboardFilters, setDashboardFilters] = useState({ service: 'All', team: 'All', period: 'Last 30 days' })
  const [newDashboardName, setNewDashboardName] = useState('')
  const [newDashboardTemplate, setNewDashboardTemplate] = useState('my-work-template')
  const [shareTarget, setShareTarget] = useState('Service Desk')
  const [shareKind, setShareKind] = useState('team')
  const [sharePermission, setSharePermission] = useState('Can view')
  const [gridHeight, setGridHeight] = useState(560)

  const { width: gridWidth, containerRef: gridContainerRef, mounted: gridMounted } = useContainerWidth({ initialWidth: 1200 })
  const activeDashboard = dashboards.find((item) => item.id === activeDashboardId) || dashboards[0]
  const configuredWidget = activeDashboard?.widgets.find((widget) => widget.id === configureWidgetId)
  const currentUserName = currentUser?.name || 'Hi5Central User'

  useEffect(() => {
    try {
      window.localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(dashboards))
    } catch {
      // Browser persistence is best-effort only.
    }
  }, [dashboards])

  useEffect(() => {
    const node = gridContainerRef.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    const measure = () => setGridHeight(Math.max(180, Math.round(node.getBoundingClientRect().height)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [gridContainerRef, gridMounted, activeDashboardId])

  const filteredTickets = useMemo(() => tickets
    .filter((ticket) => dashboardFilters.team === 'All' || ticket.team === dashboardFilters.team)
    .filter((ticket) => dashboardFilters.service === 'All' || ticket.service === dashboardFilters.service),
  [dashboardFilters.service, dashboardFilters.team, tickets])

  const dashboardMetrics = useMemo(() => {
    const active = filteredTickets.filter((ticket) => !['Closed', 'Resolved'].includes(ticket.status))
    const highRisk = filteredTickets.filter((ticket) => ['Critical', 'High'].includes(ticket.priority))
    const awaitingApproval = filteredTickets.filter((ticket) => ['Pending Approval', 'CAB Review'].includes(ticket.status))
    const slaPressure = filteredTickets.filter((ticket) => ticket.slaPercent >= 60 && ticket.status !== 'Resolved')
    const countBy = (field) => filteredTickets.reduce((result, ticket) => {
      const key = ticket[field] || 'Unassigned'
      result[key] = (result[key] || 0) + 1
      return result
    }, {})
    return {
      active: active.length,
      highRisk: highRisk.length,
      approvals: awaitingApproval.length,
      slaPressure: slaPressure.length,
      teamCounts: countBy('team'),
      priorityCounts: countBy('priority'),
      serviceCounts: countBy('service'),
    }
  }, [filteredTickets])

  const services = useMemo(() => ['All', ...new Set(tickets.map((ticket) => ticket.service).filter(Boolean))], [tickets])
  const pointerIsCoarse = typeof window !== 'undefined' && window.matchMedia?.('(any-pointer: coarse)').matches
  const mobileStack = Boolean(pointerIsCoarse && (gridWidth < 680 || gridHeight < 460))
  const maxWidgetsAcross = gridWidth >= 980 ? 3 : gridWidth >= 620 ? 2 : 1
  const packedLayout = useMemo(() => packDashboardLayout(activeDashboard.widgets, maxWidgetsAcross), [activeDashboard.widgets, maxWidgetsAcross])
  const rowCount = dashboardRowCount(packedLayout)
  const gridGap = 10
  const rowHeight = Math.max(36, Math.floor((gridHeight - Math.max(0, rowCount - 1) * gridGap) / Math.max(rowCount, 1)))

  function updateDashboard(id, updater) {
    setDashboards((current) => current.map((dashboard) => dashboard.id === id ? updater(dashboard) : dashboard))
  }

  function beginEdit() {
    if (!activeDashboard.canEdit) return
    setEditSnapshot(cloneDashboards(dashboards))
    setEditMode(true)
    setDashboardMenuOpen(false)
    setMoreOpen(false)
  }

  function saveEdit() {
    setEditSnapshot(null)
    setEditMode(false)
    setWidgetCatalogOpen(false)
    setConfigureWidgetId(null)
  }

  function cancelEdit() {
    if (editSnapshot) setDashboards(editSnapshot)
    setEditSnapshot(null)
    setEditMode(false)
    setWidgetCatalogOpen(false)
    setConfigureWidgetId(null)
  }

  function addWidget(type) {
    if (activeDashboard.widgets.length >= DASHBOARD_MAX_WIDGETS) return
    const definition = DASHBOARD_WIDGET_LIBRARY.find((item) => item.id === type)
    updateDashboard(activeDashboard.id, (dashboard) => {
      const widget = makeDashboardWidget(type, definition?.defaultSpan)
      return {
        ...dashboard,
        widgets: widget.span === 12
          ? [...dashboard.widgets, widget]
          : insertWidgetIntoOpenStandardRow(dashboard.widgets, widget),
      }
    })
    setWidgetCatalogOpen(false)
  }

  function removeWidget(widgetId) {
    updateDashboard(activeDashboard.id, (dashboard) => ({
      ...dashboard,
      widgets: dashboard.widgets.filter((widget) => widget.id !== widgetId),
    }))
    if (configureWidgetId === widgetId) setConfigureWidgetId(null)
  }

  function updateWidget(widgetId, changes) {
    updateDashboard(activeDashboard.id, (dashboard) => ({
      ...dashboard,
      widgets: dashboard.widgets.map((widget) => widget.id === widgetId ? { ...widget, ...changes } : widget),
    }))
  }

  function moveWidget(index, delta) {
    const target = index + delta
    if (target < 0 || target >= activeDashboard.widgets.length) return
    updateDashboard(activeDashboard.id, (dashboard) => {
      const movingWidget = dashboard.widgets[index]

      // If a full-width widget sits directly below an incomplete standard row,
      // "move earlier" fills the empty row slot first. With two widgets above,
      // that produces an immediate 33/33/33 row; with one above, 50/50.
      if (delta < 0 && movingWidget?.span === 12) {
        const standardsBefore = consecutiveStandardCountBefore(dashboard.widgets, index)
        const remainder = standardsBefore % DASHBOARD_STANDARD_ROW_CAPACITY
        if (remainder > 0 && remainder < DASHBOARD_STANDARD_ROW_CAPACITY) {
          return {
            ...dashboard,
            widgets: dashboard.widgets.map((widget, widgetIndex) =>
              widgetIndex === index ? { ...widget, span: 4 } : widget,
            ),
          }
        }
      }

      const reorderedWidgets = [...dashboard.widgets]
      const [widget] = reorderedWidgets.splice(index, 1)
      reorderedWidgets.splice(target, 0, widget)
      const widgets = applyDashboardReorderWidths(dashboard.widgets, reorderedWidgets)
      return { ...dashboard, widgets }
    })
  }

  function commitGridOrder(layout) {
    if (!editMode || !Array.isArray(layout) || !layout.length) return
    const order = [...layout].sort((a, b) => a.y - b.y || a.x - b.x).map((item) => item.i)
    updateDashboard(activeDashboard.id, (dashboard) => {
      const byId = new Map(dashboard.widgets.map((widget) => [widget.id, widget]))
      const reorderedWidgets = order.map((id) => byId.get(id)).filter(Boolean)
      dashboard.widgets.forEach((widget) => { if (!order.includes(widget.id)) reorderedWidgets.push(widget) })
      const unchanged = reorderedWidgets.every((widget, index) => widget.id === dashboard.widgets[index]?.id)
      if (unchanged) return dashboard
      const widgets = applyDashboardReorderWidths(dashboard.widgets, reorderedWidgets)
      return { ...dashboard, widgets }
    })
  }

  function createDashboard() {
    const template = DASHBOARD_TEMPLATES.find((item) => item.id === newDashboardTemplate)
    const name = newDashboardName.trim() || `My ${template?.name || 'Dashboard'}`
    const id = `DB-${Date.now()}`
    const dashboard = {
      id,
      name,
      owner: currentUserName,
      scope: 'mine',
      isDefault: false,
      canEdit: true,
      description: template?.description || 'Personal dashboard',
      widgets: template ? widgetsFromTemplate(template).map((widget) => ({ ...widget, id: `${id}-${widget.id}` })) : [],
      shares: [],
    }
    setDashboards((current) => [...current, dashboard])
    setActiveDashboardId(id)
    setCreateOpen(false)
    setNewDashboardName('')
  }

  function duplicateDashboard() {
    const id = `DB-${Date.now()}`
    const copy = {
      ...cloneDashboards(activeDashboard),
      id,
      name: `${activeDashboard.name} copy`,
      owner: currentUserName,
      scope: 'mine',
      canEdit: true,
      isDefault: false,
      shares: [],
      widgets: activeDashboard.widgets.map((widget, index) => ({ ...widget, id: `${id}-${index}-${widget.type}` })),
    }
    setDashboards((current) => [...current, copy])
    setActiveDashboardId(id)
    setMoreOpen(false)
  }

  function setAsDefault() {
    setDashboards((current) => current.map((dashboard) => ({ ...dashboard, isDefault: dashboard.id === activeDashboard.id })))
    setMoreOpen(false)
  }

  function deleteDashboard() {
    if (activeDashboard.scope !== 'mine' || dashboards.filter((item) => item.scope === 'mine').length <= 1) return
    const remaining = dashboards.filter((dashboard) => dashboard.id !== activeDashboard.id)
    setDashboards(remaining)
    setActiveDashboardId(remaining.find((item) => item.isDefault)?.id || remaining[0].id)
    setMoreOpen(false)
  }

  function addShare() {
    const name = shareTarget.trim()
    if (!name) return
    updateDashboard(activeDashboard.id, (dashboard) => ({
      ...dashboard,
      shares: [
        ...dashboard.shares.filter((item) => !(item.name === name && item.kind === shareKind)),
        { id: `${shareKind}-${name}`, kind: shareKind, name, permission: sharePermission },
      ],
    }))
  }

  function removeShare(id) {
    updateDashboard(activeDashboard.id, (dashboard) => ({
      ...dashboard,
      shares: dashboard.shares.filter((item) => item.id !== id),
    }))
  }

  const groupedDashboards = {
    mine: dashboards.filter((item) => item.scope === 'mine'),
    shared: dashboards.filter((item) => item.scope === 'shared'),
    team: dashboards.filter((item) => item.scope === 'team'),
  }

  return (
    <div className="dashboard-builder dashboard-builder-v3" data-sidebar-mode={sidebarMode || 'expanded'}>
      <div className="dashboard-toolbar-row">
        <div className="dashboard-icon-toolbar" aria-label="Dashboard controls">
          {editMode ? (
            <>
              <button aria-label="Add widget" disabled={activeDashboard.widgets.length >= DASHBOARD_MAX_WIDGETS} onClick={() => setWidgetCatalogOpen(true)} title="Add widget" type="button"><Plus size={16} /></button>
              <button aria-label="Cancel dashboard edits" onClick={cancelEdit} title="Cancel" type="button"><X size={16} /></button>
              <button className="primary" aria-label="Save dashboard" onClick={saveEdit} title="Save dashboard" type="button"><CheckCircle2 size={16} /></button>
            </>
          ) : (
            <>
              <div className="dashboard-selector-wrap">
                <button aria-label="Switch dashboard" onClick={() => { setDashboardMenuOpen((open) => !open); setFilterOpen(false); setMoreOpen(false) }} title="Switch dashboard" type="button"><LayoutDashboard size={16} /></button>
                {dashboardMenuOpen && (
                  <div className="dashboard-selector-menu">
                    {[
                      ['mine', 'My dashboards'],
                      ['shared', 'Shared with me'],
                      ['team', 'Team dashboards'],
                    ].map(([group, label]) => groupedDashboards[group].length ? (
                      <section key={group}>
                        <span>{label}</span>
                        {groupedDashboards[group].map((dashboard) => (
                          <button className={dashboard.id === activeDashboard.id ? 'active' : ''} key={dashboard.id} onClick={() => { setActiveDashboardId(dashboard.id); setDashboardMenuOpen(false); setEditMode(false) }} type="button">
                            <strong>{dashboard.name}</strong>
                            <small>{dashboard.owner}{dashboard.isDefault ? ' · Default' : ''}</small>
                          </button>
                        ))}
                      </section>
                    ) : null)}
                    <button className="dashboard-menu-create" onClick={() => { setCreateOpen(true); setDashboardMenuOpen(false) }} type="button"><Plus size={15} /> Create dashboard</button>
                  </div>
                )}
              </div>

              <div className="dashboard-filter-wrap">
                <button className={filterOpen ? 'active' : ''} aria-label="Dashboard filters" onClick={() => { setFilterOpen((open) => !open); setDashboardMenuOpen(false); setMoreOpen(false) }} title="Dashboard filters" type="button"><SlidersHorizontal size={16} /></button>
                {filterOpen && (
                  <div className="dashboard-filter-popover" aria-label="Dashboard filters">
                    <label>Service<select value={dashboardFilters.service} onChange={(event) => setDashboardFilters({ ...dashboardFilters, service: event.target.value })}>{services.map((service) => <option key={service}>{service}</option>)}</select></label>
                    <label>Team<select value={dashboardFilters.team} onChange={(event) => setDashboardFilters({ ...dashboardFilters, team: event.target.value })}>{['All', ...teams].map((team) => <option key={team}>{team}</option>)}</select></label>
                    <label>Period<select value={dashboardFilters.period} onChange={(event) => setDashboardFilters({ ...dashboardFilters, period: event.target.value })}>{['Today', 'Last 7 days', 'Last 30 days', 'This quarter'].map((period) => <option key={period}>{period}</option>)}</select></label>
                  </div>
                )}
              </div>

              <button aria-label="Share dashboard" onClick={() => setShareOpen(true)} title="Share dashboard" type="button"><Share2 size={16} /></button>
              {activeDashboard.canEdit ? (
                <button aria-label="Edit dashboard" onClick={beginEdit} title="Edit dashboard" type="button"><Pencil size={16} /></button>
              ) : (
                <button aria-label="Make a copy" onClick={duplicateDashboard} title="Make a copy" type="button"><Copy size={16} /></button>
              )}
              <div className="dashboard-more-wrap">
                <button aria-label="Dashboard actions" onClick={() => { setMoreOpen((open) => !open); setDashboardMenuOpen(false); setFilterOpen(false) }} title="Dashboard actions" type="button"><MoreHorizontal size={17} /></button>
                {moreOpen && (
                  <div className="dashboard-more-menu">
                    <button onClick={duplicateDashboard} type="button"><Copy size={14} /> Duplicate dashboard</button>
                    <button disabled={activeDashboard.isDefault} onClick={setAsDefault} type="button"><Star size={14} /> Set as default</button>
                    {activeDashboard.scope === 'mine' && <button className="danger" onClick={deleteDashboard} type="button"><Trash2 size={14} /> Delete dashboard</button>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="dashboard-canvas" onClick={() => { setDashboardMenuOpen(false); setMoreOpen(false); setFilterOpen(false) }}>
        <div className={`dashboard-grid-host ${mobileStack ? 'is-mobile-stack' : ''}`} ref={gridContainerRef}>
          {!activeDashboard.widgets.length ? (
            <button className="dashboard-empty-canvas" onClick={() => { if (!editMode) beginEdit(); setWidgetCatalogOpen(true) }} type="button">
              <Plus size={22} />
              <strong>Add your first widget</strong>
              <span>Build this dashboard from the Hi5Central widget catalogue.</span>
            </button>
          ) : mobileStack ? (
            <div className="dashboard-mobile-stack-v3">
              {activeDashboard.widgets.map((widget, index) => (
                <DashboardWidgetFrame editMode={editMode} index={index} key={widget.id} onConfigure={(item) => setConfigureWidgetId(item.id)} onMove={moveWidget} onRemove={removeWidget} widget={widget}>
                  <DashboardWidgetContent dashboardMetrics={dashboardMetrics} filters={dashboardFilters} mobile={mobileStack} openRecordTab={openRecordTab} openTab={openTab} tickets={tickets} widget={widget} />
                </DashboardWidgetFrame>
              ))}
            </div>
          ) : gridMounted ? (
            <ReactGridLayout
              className="dashboard-rgl-v3"
              compactor={verticalCompactor}
              dragConfig={{ enabled: editMode, handle: '.dashboard-drag-handle', bounded: true }}
              gridConfig={{ cols: DASHBOARD_GRID_COLUMNS, rowHeight, margin: [gridGap, gridGap], containerPadding: [0, 0] }}
              layout={packedLayout}
              onLayoutChange={commitGridOrder}
              resizeConfig={{ enabled: false }}
              width={gridWidth}
            >
              {activeDashboard.widgets.map((widget, index) => (
                <div className={`dashboard-grid-item-v3 ${widget.span === 12 ? 'is-full-width' : ''}`} key={widget.id}>
                  <DashboardWidgetFrame editMode={editMode} index={index} onConfigure={(item) => setConfigureWidgetId(item.id)} onMove={moveWidget} onRemove={removeWidget} widget={widget}>
                    <DashboardWidgetContent dashboardMetrics={dashboardMetrics} filters={dashboardFilters} mobile={mobileStack} openRecordTab={openRecordTab} openTab={openTab} tickets={tickets} widget={widget} />
                  </DashboardWidgetFrame>
                </div>
              ))}
            </ReactGridLayout>
          ) : null}
        </div>
      </div>

      {widgetCatalogOpen && (
        <>
          <button className="dashboard-panel-backdrop" aria-label="Close widget catalogue" onClick={() => setWidgetCatalogOpen(false)} type="button" />
          <aside className="dashboard-side-panel" aria-label="Widget catalogue">
            <header><div><span className="eyebrow">Dashboard builder</span><h2>Add widget</h2></div><button onClick={() => setWidgetCatalogOpen(false)} type="button"><X size={17} /></button></header>
            <div className="dashboard-widget-catalog">
              <div className="dashboard-widget-limit">{activeDashboard.widgets.length} / {DASHBOARD_MAX_WIDGETS} widgets</div>
              {[...new Set(DASHBOARD_WIDGET_LIBRARY.map((item) => item.category))].map((category) => (
                <section key={category}>
                  <span>{category}</span>
                  {DASHBOARD_WIDGET_LIBRARY.filter((item) => item.category === category).map((item) => (
                    <button disabled={activeDashboard.widgets.length >= DASHBOARD_MAX_WIDGETS} key={item.id} onClick={() => addWidget(item.id)} type="button">
                      <Plus size={15} /><span><strong>{item.label}</strong><small>{item.description}</small></span>
                    </button>
                  ))}
                </section>
              ))}
            </div>
          </aside>
        </>
      )}

      {configuredWidget && (
        <>
          <button className="dashboard-panel-backdrop" aria-label="Close widget settings" onClick={() => setConfigureWidgetId(null)} type="button" />
          <aside className="dashboard-side-panel" aria-label="Widget settings">
            <header><div><span className="eyebrow">Widget</span><h2>Configure</h2></div><button onClick={() => setConfigureWidgetId(null)} type="button"><X size={17} /></button></header>
            <div className="dashboard-config-form">
              <label>Title<input value={configuredWidget.title} onChange={(event) => updateWidget(configuredWidget.id, { title: event.target.value })} /></label>
              <label>Width<select value={configuredWidget.span} onChange={(event) => updateWidget(configuredWidget.id, { span: Number(event.target.value) })}>{DASHBOARD_SIZE_OPTIONS.map((size) => <option key={size.id} value={size.id}>{size.label}</option>)}</select></label>
              {!['active-records', 'high-priority', 'approvals', 'sla-watch', 'heading'].includes(configuredWidget.type) && (
                <label>Records shown<select value={configuredWidget.limit} onChange={(event) => updateWidget(configuredWidget.id, { limit: Number(event.target.value) })}>{[4, 6, 8, 10, 12].map((limit) => <option key={limit}>{limit}</option>)}</select></label>
              )}
              {['saved-filter', 'service-queue', 'my-work', 'needs-attention'].includes(configuredWidget.type) && (
                <label>Record type<select value={configuredWidget.filterType} onChange={(event) => updateWidget(configuredWidget.id, { filterType: event.target.value })}>{['All', ...types].map((type) => <option key={type}>{type}</option>)}</select></label>
              )}
              {configuredWidget.type === 'heading' && <label>Text<textarea rows="6" value={configuredWidget.note} onChange={(event) => updateWidget(configuredWidget.id, { note: event.target.value })} /></label>}
              <div className="dashboard-config-preview"><span>Responsive behaviour</span><strong>{DASHBOARD_SIZE_OPTIONS.find((size) => size.id === configuredWidget.span)?.label}</strong><small>Standard rows always fill the available width automatically: three widgets use thirds, two use halves, and one uses the full row. Full-width slots still transfer when a complete row is reordered, while a full-width widget moved into an incomplete row fills the empty standard slot first.</small></div>
            </div>
          </aside>
        </>
      )}

      {shareOpen && (
        <div className="dashboard-modal-layer" role="presentation">
          <button className="dashboard-modal-backdrop" aria-label="Close sharing" onClick={() => setShareOpen(false)} type="button" />
          <section className="dashboard-modal" role="dialog" aria-modal="true" aria-label="Share dashboard">
            <header><div><span className="eyebrow">Sharing</span><h2>{activeDashboard.name}</h2></div><button onClick={() => setShareOpen(false)} type="button"><X size={17} /></button></header>
            <p>Dashboard sharing requires the server-side sharing service. Local-only sharing changes are disabled.</p>
            {activeDashboard.canEdit ? (
              <div className="dashboard-share-add">
                <label>Share with<select value={shareKind} onChange={(event) => setShareKind(event.target.value)}><option value="team">Team</option><option value="user">User</option></select></label>
                <label>{shareKind === 'team' ? 'Team' : 'User'}<select value={shareTarget} onChange={(event) => setShareTarget(event.target.value)}>{(shareKind === 'team' ? teams : workspaceUsers.map((user) => user.name)).map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>Permission<select value={sharePermission} onChange={(event) => setSharePermission(event.target.value)}>{['Can view', 'Can edit', 'Can manage'].map((item) => <option key={item}>{item}</option>)}</select></label>
                <button disabled type="button">Server sharing required</button>
              </div>
            ) : (
              <div className="dashboard-share-readonly">You can view this dashboard's sharing membership. Make a copy to create and manage your own version.</div>
            )}
            <div className="dashboard-share-list">
              <div><span className="dashboard-share-avatar">DS</span><span><strong>{activeDashboard.owner}</strong><small>Owner</small></span><b>Owner</b></div>
              {activeDashboard.shares.map((share) => (
                <div key={share.id}><span className="dashboard-share-avatar">{share.kind === 'team' ? <Users size={15} /> : share.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span><strong>{share.name}</strong><small>{share.kind === 'team' ? 'Team' : 'User'}</small></span><b>{share.permission}</b>{activeDashboard.canEdit && <button onClick={() => removeShare(share.id)} type="button"><X size={14} /></button>}</div>
              ))}
            </div>
          </section>
        </div>
      )}

      {createOpen && (
        <div className="dashboard-modal-layer" role="presentation">
          <button className="dashboard-modal-backdrop" aria-label="Close create dashboard" onClick={() => setCreateOpen(false)} type="button" />
          <section className="dashboard-modal dashboard-create-modal" role="dialog" aria-modal="true" aria-label="Create dashboard">
            <header><div><span className="eyebrow">Dashboard library</span><h2>Create dashboard</h2></div><button onClick={() => setCreateOpen(false)} type="button"><X size={17} /></button></header>
            <label className="dashboard-name-field">Dashboard name<input placeholder="e.g. Infrastructure Operations" value={newDashboardName} onChange={(event) => setNewDashboardName(event.target.value)} /></label>
            <div className="dashboard-template-grid">
              {DASHBOARD_TEMPLATES.map((template) => (
                <button className={newDashboardTemplate === template.id ? 'active' : ''} key={template.id} onClick={() => setNewDashboardTemplate(template.id)} type="button">
                  <LayoutDashboard size={19} /><strong>{template.name}</strong><span>{template.description}</span><small>{template.widgets.length} widgets</small>
                </button>
              ))}
              <button className={newDashboardTemplate === 'blank' ? 'active' : ''} onClick={() => setNewDashboardTemplate('blank')} type="button"><Plus size={19} /><strong>Blank dashboard</strong><span>Start with an empty canvas.</span><small>0 widgets</small></button>
            </div>
            <footer><button onClick={() => setCreateOpen(false)} type="button">Cancel</button><button className="primary" onClick={createDashboard} type="button">Create dashboard</button></footer>
          </section>
        </div>
      )}
    </div>
  )
}


export function TicketRecordView({
  addComment,
  currentUser,
  newComment,
  openAssetByName,
  openRecordTab,
  people,
  selectedTicket,
  setNewComment,
  teams,
  tickets,
  transitionTicket,
  updateTicket,
}) {
  if (!selectedTicket) {
    return (
      <div className="record-page">
        <section className="record-primary empty-record">
          <span className="eyebrow">Record not found</span>
          <h2>This record is no longer available</h2>
          <p>The record may have been closed or removed from the current workspace data.</p>
        </section>
      </div>
    )
  }

  return (
    <UnifiedRecordDetailView
      addComment={addComment}
      currentUser={currentUser}
      key={selectedTicket.id}
      newComment={newComment}
      openAssetByName={openAssetByName}
      openRecordTab={openRecordTab}
      people={people}
      setNewComment={setNewComment}
      teams={teams}
      ticket={selectedTicket}
      tickets={tickets}
      transitionTicket={transitionTicket}
      updateTicket={updateTicket}
    />
  )
}

const incidentRecordSections = [
  { id: 'overview', label: 'Overview', icon: Inbox },
  { id: 'activity', label: 'Activity', icon: MessageSquarePlus },
  { id: 'related', label: 'Related', icon: Server },
  { id: 'sla', label: 'SLA', icon: Clock3 },
]

const incidentLifecycle = ['New', 'In Progress', 'Pending', 'Resolved', 'Closed']
const incidentPendingReasons = [
  'Awaiting customer',
  'Awaiting vendor',
  'Awaiting change',
  'Awaiting third party',
  'Scheduled',
]
const incidentResolutionCodes = [
  'Resolved - fix applied',
  'Resolved - workaround provided',
  'Resolved - user action',
  'Resolved - no fault found',
  'Resolved - duplicate',
]

function incidentLifecycleIndex(status) {
  if (status === 'Pending Approval' || status === 'CAB Review') return 2
  if (status === 'Monitoring') return 1
  const index = incidentLifecycle.indexOf(status)
  return index < 0 ? 0 : index
}

function incidentSlaTargets(priority) {
  if (priority === 'Critical') return { response: '15 min', resolution: '1 hr' }
  if (priority === 'High') return { response: '30 min', resolution: '4 hr' }
  if (priority === 'Medium') return { response: '1 hr', resolution: '8 hr' }
  return { response: '4 hr', resolution: '2 business days' }
}

function IncidentRecordWorkspace({
  addComment,
  newComment,
  openAssetByName,
  setNewComment,
  ticket,
  updateTicket,
}) {
  const [activeSection, setActiveSection] = useState('overview')
  const [workflowPanel, setWorkflowPanel] = useState(null)
  const [pendingReason, setPendingReason] = useState(ticket.pendingReason || 'Awaiting customer')
  const [resolutionCode, setResolutionCode] = useState(ticket.resolutionCode || incidentResolutionCodes[0])
  const [resolutionNotes, setResolutionNotes] = useState(ticket.resolutionNotes || '')
  const [noteMode, setNoteMode] = useState('work')
  const lifecycleIndex = incidentLifecycleIndex(ticket.status)
  const slaTargets = incidentSlaTargets(ticket.priority)
  const linkedAssets = ticket.linkedAssets || []
  const isResolved = ticket.status === 'Resolved' || ticket.status === 'Closed'
  const isPending = ticket.status === 'Pending'

  const knowledgeSuggestions = ticket.service === 'Identity'
    ? ['Resetting MFA on a new phone', 'Troubleshooting SSO sign-in failures']
    : ticket.service === 'Collaboration'
      ? ['Microsoft 365 mail flow checks', 'How to collect an Exchange message trace']
      : ['Service troubleshooting checklist', 'Collecting diagnostics before escalation']

  function confirmPending() {
    updateTicket(ticket.id, {
      status: 'Pending',
      pendingReason,
      nextStep: pendingReason,
    })
    setWorkflowPanel(null)
  }

  function confirmResolution() {
    if (!resolutionNotes.trim()) return
    updateTicket(ticket.id, {
      status: 'Resolved',
      resolutionCode,
      resolutionNotes: resolutionNotes.trim(),
      slaPercent: 100,
      sla: 'Met',
      nextStep: 'Confirm service restoration and close after validation.',
    })
    setWorkflowPanel(null)
  }

  function renderWorkflowPanel() {
    if (workflowPanel === 'pending') {
      return (
        <section className="incident-workflow-panel" aria-label="Place incident pending">
          <div>
            <span className="eyebrow">Status transition</span>
            <h3>Place incident on hold</h3>
            <p>Choose why progress is paused. This reason will later drive SLA pause rules and requester communication.</p>
          </div>
          <label>
            Pending reason
            <select value={pendingReason} onChange={(event) => setPendingReason(event.target.value)}>
              {incidentPendingReasons.map((reason) => <option key={reason}>{reason}</option>)}
            </select>
          </label>
          <div className="incident-workflow-actions">
            <button className="secondary-action" onClick={() => setWorkflowPanel(null)} type="button">Cancel</button>
            <button className="primary-action compact" onClick={confirmPending} type="button">Set pending</button>
          </div>
        </section>
      )
    }

    if (workflowPanel === 'resolve') {
      return (
        <section className="incident-workflow-panel" aria-label="Resolve incident">
          <div>
            <span className="eyebrow">Status transition</span>
            <h3>Resolve incident</h3>
            <p>Capture the resolution now so closure, reporting and future knowledge can use the same structured information.</p>
          </div>
          <div className="form-row">
            <label>
              Resolution code
              <select value={resolutionCode} onChange={(event) => setResolutionCode(event.target.value)}>
                {incidentResolutionCodes.map((code) => <option key={code}>{code}</option>)}
              </select>
            </label>
            <label>
              Resolution notes
              <textarea
                onChange={(event) => setResolutionNotes(event.target.value)}
                placeholder="What fixed the issue?"
                value={resolutionNotes}
              />
            </label>
          </div>
          <div className="incident-workflow-actions">
            <button className="secondary-action" onClick={() => setWorkflowPanel(null)} type="button">Cancel</button>
            <button className="primary-action compact" disabled={!resolutionNotes.trim()} onClick={confirmResolution} type="button">
              Resolve incident
            </button>
          </div>
        </section>
      )
    }

    return null
  }

  function renderOverview() {
    return (
      <div className="incident-overview-layout">
        <div className="incident-overview-main">
          <section className="incident-detail-section incident-user-summary">
            <div className="incident-section-heading">
              <div>
                <span className="eyebrow">Affected user</span>
                <h3>{ticket.requester}</h3>
              </div>
              <UserRound size={20} aria-hidden="true" />
            </div>
            <div className="incident-inline-facts">
              {ticket.requesterJobTitle && <span>{ticket.requesterJobTitle}</span>}
              {ticket.requesterDepartment && <span>{ticket.requesterDepartment}</span>}
              {ticket.requesterStaffNumber && <span>{ticket.requesterStaffNumber}</span>}
              <span>{ticket.location}</span>
            </div>
            {ticket.requesterEmail && <p className="incident-user-contact">{ticket.requesterEmail}</p>}
            {ticket.requesterManager && <p className="incident-user-contact">Manager: {ticket.requesterManager}</p>}
          </section>

          <section className="incident-detail-section">
            <div className="incident-section-heading">
              <div>
                <span className="eyebrow">Description</span>
                <h3>Issue summary</h3>
              </div>
              <ClipboardCheck size={20} aria-hidden="true" />
            </div>
            <p className="incident-description">{ticket.description}</p>
          </section>

          <section className="incident-detail-section">
            <div className="incident-section-heading">
              <div>
                <span className="eyebrow">Classification</span>
                <h3>Service and priority</h3>
              </div>
              <CircleGauge size={20} aria-hidden="true" />
            </div>
            <div className="incident-property-grid">
              <IncidentProperty label="Service" value={ticket.service} />
              <IncidentProperty label="Category" value={ticket.category || 'Not classified'} />
              <IncidentProperty label="Impact" value={ticket.impact || 'Not set'} />
              <IncidentProperty label="Urgency" value={ticket.urgency || 'Not set'} />
              <IncidentProperty label="Priority" value={ticket.priority} strong />
              <IncidentProperty label="Location" value={ticket.location} />
            </div>
          </section>

          <section className="incident-detail-section">
            <div className="incident-section-heading">
              <div>
                <span className="eyebrow">Assignment</span>
                <h3>Ownership</h3>
              </div>
              <Users size={20} aria-hidden="true" />
            </div>
            <div className="incident-assignment-grid">
              <label>
                Assignment group
                <select value={ticket.team} onChange={(event) => updateTicket(ticket.id, { team: event.target.value })}>
                  {teams.map((team) => <option key={team}>{team}</option>)}
                </select>
              </label>
              <label>
                Assigned to
                <select value={ticket.assignee} onChange={(event) => updateTicket(ticket.id, { assignee: event.target.value })}>
                  {['Unassigned', 'Hi5Central User', 'Priya Raman', 'Noah Williams', 'Amara Okafor', 'Sam Taylor', 'Maya Ford'].map((assignee) => (
                    <option key={assignee}>{assignee}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="incident-next-step-panel">
            <span className="eyebrow">Next step</span>
            <strong>{ticket.nextStep}</strong>
            {isPending && <span>Pending reason: {ticket.pendingReason || pendingReason}</span>}
            {isResolved && ticket.resolutionCode && <span>{ticket.resolutionCode}</span>}
          </section>
        </div>

        <aside className="incident-overview-rail">
          <section className="incident-glance-panel">
            <span className="eyebrow">At a glance</span>
            <div className="incident-glance-list">
              <IncidentProperty label="Created" value={ticket.created} />
              <IncidentProperty label="Updated" value={ticket.updated} />
              <IncidentProperty label="SLA remaining" value={ticket.sla} />
              <IncidentProperty label="Configuration items" value={linkedAssets.length || 'None'} />
            </div>
          </section>

          <section className="incident-glance-panel">
            <span className="eyebrow">SLA position</span>
            <SlaBar value={ticket.slaPercent} label={ticket.sla} />
            <button className="text-button incident-inline-link" onClick={() => setActiveSection('sla')} type="button">
              View SLA detail <ChevronRight size={15} aria-hidden="true" />
            </button>
          </section>

          <section className="incident-glance-panel">
            <span className="eyebrow">Configuration items</span>
            <div className="linked-ci-list">
              {linkedAssets.length ? linkedAssets.map((asset) => (
                <button className="linked-ci-button" key={asset} onClick={() => openAssetByName?.(asset)} type="button">{asset}</button>
              )) : <span>No CI linked</span>}
            </div>
          </section>
        </aside>
      </div>
    )
  }

  function renderActivity() {
    const activityEntries = [
      ...ticket.comments.map((comment, index) => ({
        id: `comment-${index}`,
        kind: comment.toLowerCase().startsWith('customer comment:') ? 'customer' : 'work',
        actor: comment.toLowerCase().startsWith('customer comment:') ? 'Hi5Central User · Customer comment' : 'Hi5Central User · Work note',
        time: index === 0 ? 'Just now' : `${index * 12 + 6} min ago`,
        text: comment.replace(/^Customer comment:\s*/i, '').replace(/^Work note:\s*/i, '').replace(/\s*-\s*added now$/i, ''),
      })),
      {
        id: 'assignment',
        kind: 'system',
        actor: 'System · Assignment',
        time: ticket.updated,
        text: `${ticket.team} · ${ticket.assignee}`,
      },
      {
        id: 'created',
        kind: 'system',
        actor: 'System · Incident created',
        time: ticket.created,
        text: `Created for ${ticket.requester} from the analyst console.`,
      },
    ]

    return (
      <div className="incident-activity-layout">
        <section className="incident-activity-composer">
          <div className="incident-section-heading">
            <div>
              <span className="eyebrow">Add activity</span>
              <h3>Update this incident</h3>
            </div>
            <MessageSquarePlus size={20} aria-hidden="true" />
          </div>
          <div className="incident-note-mode" role="group" aria-label="Activity visibility">
            <button className={noteMode === 'work' ? 'active' : ''} onClick={() => setNoteMode('work')} type="button">Work note</button>
            <button className={noteMode === 'customer' ? 'active' : ''} onClick={() => setNoteMode('customer')} type="button">Customer comment</button>
          </div>
          <label className="incident-note-field">
            {noteMode === 'work' ? 'Internal work note' : 'Requester-visible comment'}
            <textarea
              onChange={(event) => setNewComment(event.target.value)}
              placeholder={noteMode === 'work' ? 'Add troubleshooting notes, handover detail or investigation findings' : 'Write an update the requester can see'}
              value={newComment}
            />
          </label>
          <div className="incident-composer-footer">
            <span>{noteMode === 'work' ? 'Visible to analysts only' : 'Visible to the requester'}</span>
            <button className="primary-action compact" disabled={!newComment.trim()} onClick={() => addComment(noteMode)} type="button">
              <MessageSquarePlus size={16} aria-hidden="true" />
              Add {noteMode === 'work' ? 'work note' : 'comment'}
            </button>
          </div>
        </section>

        <section className="incident-activity-timeline" aria-label="Incident activity timeline">
          <div className="incident-section-heading">
            <div>
              <span className="eyebrow">Timeline</span>
              <h3>Activity history</h3>
            </div>
          </div>
          {activityEntries.map((entry) => (
            <article className={`incident-activity-entry ${entry.kind}`} key={entry.id}>
              <span className="incident-activity-marker" aria-hidden="true" />
              <div>
                <div className="incident-activity-meta">
                  <strong>{entry.actor}</strong>
                  <span>{entry.time}</span>
                </div>
                <p>{entry.text}</p>
              </div>
            </article>
          ))}
        </section>
      </div>
    )
  }

  function renderRelated() {
    return (
      <div className="incident-related-layout">
        <section className="incident-related-section">
          <div className="incident-section-heading">
            <div>
              <span className="eyebrow">Configuration</span>
              <h3>Affected configuration items</h3>
            </div>
            <Server size={20} aria-hidden="true" />
          </div>
          {linkedAssets.length ? (
            <div className="incident-related-list">
              {linkedAssets.map((asset) => (
                <button className="incident-related-row" key={asset} onClick={() => openAssetByName?.(asset)} type="button">
                  <span className="incident-related-icon"><Server size={17} aria-hidden="true" /></span>
                  <span><strong>{asset}</strong><small>Configuration item</small></span>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : <p className="incident-empty-related">No configuration items are linked yet.</p>}
        </section>

        <section className="incident-related-section">
          <div className="incident-section-heading">
            <div>
              <span className="eyebrow">Relationships</span>
              <h3>Related ITSM records</h3>
            </div>
            <ClipboardCheck size={20} aria-hidden="true" />
          </div>
          <div className="incident-relationship-grid">
            <IncidentRelationship label="Problem" value="No problem linked" />
            <IncidentRelationship label="Change" value="No change linked" />
            <IncidentRelationship label="Parent / major incident" value="Not linked" />
            <IncidentRelationship label="Child incidents" value="None" />
          </div>
        </section>

        <section className="incident-related-section">
          <div className="incident-section-heading">
            <div>
              <span className="eyebrow">Knowledge</span>
              <h3>Suggested articles</h3>
            </div>
          </div>
          <div className="incident-knowledge-suggestions">
            {knowledgeSuggestions.map((article) => (
              <div key={article}>
                <BookOpen size={17} aria-hidden="true" />
                <span><strong>{article}</strong><small>Suggested from {ticket.service}</small></span>
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

  function renderSla() {
    const resolutionState = isResolved ? 'Met' : isPending ? 'Paused' : 'In progress'
    return (
      <div className="incident-sla-layout">
        <section className="incident-sla-hero">
          <div>
            <span className="eyebrow">Resolution SLA</span>
            <h3>{resolutionState}</h3>
            <p>{isResolved ? 'Resolution target completed.' : isPending ? `Clock behaviour follows the ${ticket.pendingReason || pendingReason} rule.` : `${ticket.sla} remaining against the current target.`}</p>
          </div>
          <div className="incident-sla-percent">
            <strong>{Math.min(100, ticket.slaPercent)}%</strong>
            <span>consumed</span>
          </div>
          <div className="incident-sla-progress"><span style={{ width: `${Math.min(100, ticket.slaPercent)}%` }} /></div>
        </section>

        <div className="incident-sla-card-grid">
          <section className="incident-sla-card met">
            <span className="eyebrow">First response</span>
            <div className="incident-sla-card-heading"><CheckCircle2 size={20} aria-hidden="true" /><strong>Met</strong></div>
            <IncidentProperty label="Target" value={slaTargets.response} />
            <IncidentProperty label="Completed" value="8 min" />
          </section>
          <section className={`incident-sla-card ${isResolved ? 'met' : isPending ? 'paused' : 'active'}`}>
            <span className="eyebrow">Resolution</span>
            <div className="incident-sla-card-heading"><Clock3 size={20} aria-hidden="true" /><strong>{resolutionState}</strong></div>
            <IncidentProperty label="Target" value={slaTargets.resolution} />
            <IncidentProperty label={isResolved ? 'Completed' : 'Remaining'} value={isResolved ? 'Within target' : ticket.sla} />
          </section>
        </div>

        <section className="incident-sla-policy">
          <span className="eyebrow">Clock behaviour</span>
          <h3>Designed for policy-driven SLA rules</h3>
          <p>When the backend is introduced, priority, service, business hours and pending reasons will determine target selection, pause behaviour, breaches and escalations.</p>
          <div className="incident-sla-policy-grid">
            <IncidentProperty label="Business hours" value="Service calendar" />
            <IncidentProperty label="Pending pause" value="Reason dependent" />
            <IncidentProperty label="Escalation" value="Before breach" />
          </div>
        </section>
      </div>
    )
  }

  const panel = activeSection === 'activity'
    ? renderActivity()
    : activeSection === 'related'
      ? renderRelated()
      : activeSection === 'sla'
        ? renderSla()
        : renderOverview()

  return (
    <div className="incident-record-workspace">
      <header className="incident-record-header">
        <div className="incident-record-identity">
          <div className="incident-record-reference-row">
            <span>{ticket.id}</span>
            <span>Updated {ticket.updated}</span>
          </div>
          <h2>{ticket.title}</h2>
          <div className="incident-record-badges">
            <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
            <span className={`incident-priority-badge ${priorityClass(ticket.priority)}`}>
              <span className={`priority-dot ${priorityClass(ticket.priority)}`} />
              {ticket.priority} priority
            </span>
            <span>{ticket.service}</span>
          </div>
        </div>

        <div className="incident-record-actions" aria-label="Incident actions">
          <button onClick={() => updateTicket(ticket.id, { assignee: 'Hi5Central User' })} type="button">
            <UserCheck size={16} aria-hidden="true" />
            Assign to me
          </button>
          <button disabled={isResolved} onClick={() => updateTicket(ticket.id, { status: 'In Progress' })} type="button">
            <Wrench size={16} aria-hidden="true" />
            Start work
          </button>
          <button disabled={isResolved} onClick={() => setWorkflowPanel(workflowPanel === 'pending' ? null : 'pending')} type="button">
            <Clock3 size={16} aria-hidden="true" />
            Pending
          </button>
          {ticket.status === 'Closed' ? (
            <button disabled type="button">
              <CheckCircle2 size={16} aria-hidden="true" />
              Closed
            </button>
          ) : ticket.status === 'Resolved' ? (
            <button onClick={() => updateTicket(ticket.id, { status: 'Closed', nextStep: 'Incident closed.' })} type="button">
              <CheckCircle2 size={16} aria-hidden="true" />
              Close
            </button>
          ) : (
            <button onClick={() => setWorkflowPanel(workflowPanel === 'resolve' ? null : 'resolve')} type="button">
              <CheckCircle2 size={16} aria-hidden="true" />
              Resolve
            </button>
          )}
        </div>
      </header>

      <div className="incident-lifecycle" aria-label="Incident lifecycle">
        {incidentLifecycle.map((status, index) => {
          const isCurrent = index === lifecycleIndex
          const isComplete = index < lifecycleIndex
          return (
            <div className={isCurrent ? 'current' : isComplete ? 'complete' : ''} key={status}>
              <span>{isComplete ? '✓' : index + 1}</span>
              <strong>{status}</strong>
            </div>
          )
        })}
      </div>

      {renderWorkflowPanel()}

      <nav className="incident-record-tabs" aria-label="Incident record sections">
        {incidentRecordSections.map(({ id, label, icon: Icon }) => (
          <button
            aria-current={activeSection === id ? 'page' : undefined}
            className={activeSection === id ? 'active' : ''}
            key={id}
            onClick={() => setActiveSection(id)}
            type="button"
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      <div className="incident-record-panel">{panel}</div>
    </div>
  )
}

function IncidentProperty({ label, strong = false, value }) {
  return (
    <div className={strong ? 'incident-property strong' : 'incident-property'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function IncidentRelationship({ label, value }) {
  return (
    <div className="incident-relationship-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function TicketDetailContent({
  addComment,
  newComment,
  setNewComment,
  ticket,
  updateTicket,
}) {
  return (
    <section className="ticket-detail-content">
      <div className="detail-header">
        <div>
          <span className="eyebrow">{ticket.id}</span>
          <h2>{ticket.title}</h2>
        </div>
        <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
      </div>

      <div className="detail-grid">
        <InfoItem label="Requester" value={ticket.requester} icon={UserRound} />
        <InfoItem label="Service" value={ticket.service} icon={Server} />
        <InfoItem label="Team" value={ticket.team} icon={Users} />
        <InfoItem label="Assignee" value={ticket.assignee} icon={Headphones} />
      </div>

      {(ticket.category || ticket.impact || ticket.urgency) && (
        <div className="detail-grid incident-classification-grid">
          {ticket.category && <InfoItem label="Category" value={ticket.category} icon={ClipboardCheck} />}
          {ticket.impact && <InfoItem label="Impact" value={ticket.impact} icon={CircleGauge} />}
          {ticket.urgency && <InfoItem label="Urgency" value={ticket.urgency} icon={Clock3} />}
          <InfoItem label="Priority" value={ticket.priority} icon={AlertCircle} />
        </div>
      )}

      <p className="detail-copy">{ticket.description}</p>

      <div className="form-row">
        <label>
          Status
          <select
            onChange={(event) => updateTicket(ticket.id, { status: event.target.value })}
            value={ticket.status}
          >
            {statusOptions.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          Assignee
          <select
            onChange={(event) => updateTicket(ticket.id, { assignee: event.target.value })}
            value={ticket.assignee}
          >
            {['Unassigned', 'Priya Raman', 'Noah Williams', 'Amara Okafor', 'Sam Taylor', 'Maya Ford'].map((assignee) => (
              <option key={assignee}>{assignee}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="action-strip">
        <button onClick={() => updateTicket(ticket.id, { status: 'In Progress' })} type="button">
          <Wrench size={16} aria-hidden="true" />
          Start
        </button>
        <button onClick={() => updateTicket(ticket.id, { status: 'Pending Approval' })} type="button">
          <ClipboardCheck size={16} aria-hidden="true" />
          Approval
        </button>
        <button onClick={() => updateTicket(ticket.id, { status: 'Resolved', slaPercent: 100, sla: 'Met' })} type="button">
          <CheckCircle2 size={16} aria-hidden="true" />
          Resolve
        </button>
      </div>

      <div className="next-step">
        <strong>Next step</strong>
        <span>{ticket.nextStep}</span>
      </div>

      <div className="comment-box">
        <label>
          Activity note
          <textarea
            onChange={(event) => setNewComment(event.target.value)}
            placeholder="Add a visible work note"
            value={newComment}
          />
        </label>
        <button className="primary-action compact" onClick={addComment} type="button">
          <MessageSquarePlus size={16} aria-hidden="true" />
          Add note
        </button>
      </div>

      <div className="timeline">
        {ticket.comments.map((comment, index) => (
          <div className="timeline-item" key={`${ticket.id}-${index}-${comment}`}>
            <span></span>
            <p>{comment}</p>
          </div>
        ))}
      </div>
    </section>
  )
}



const unifiedRecordTypes = ['Incident', 'Service Request', 'Change', 'Problem']

const unifiedRecordMeta = {
  Incident: {
    eyebrow: 'Service Desk',
    title: 'Incidents',
    singular: 'Incident',
    description: 'Triage service interruptions, protect SLA targets and keep ownership clear.',
    attentionLabel: 'At risk',
  },
  'Service Request': {
    eyebrow: 'Service Desk',
    title: 'Service Requests',
    singular: 'Service Request',
    description: 'Track catalogue requests, approvals, fulfilment ownership and delivery progress.',
    attentionLabel: 'Awaiting approval',
  },
  Change: {
    eyebrow: 'Change Management',
    title: 'Changes',
    singular: 'Change',
    description: 'Assess risk, protect implementation windows and keep approvals visible before execution.',
    attentionLabel: 'High risk',
  },
  Problem: {
    eyebrow: 'Problem Management',
    title: 'Problems',
    singular: 'Problem',
    description: 'Investigate recurring issues, connect evidence and drive work toward a permanent fix.',
    attentionLabel: 'Known errors',
  },
}

export function RecordCreateMenu({ openNewRecord, className = '' }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 56, right: 12 })
  const menuRef = useRef(null)
  const popoverRef = useRef(null)

  const updatePosition = () => {
    const trigger = menuRef.current?.querySelector('.record-create-trigger')
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setPosition({
      top: Math.round(rect.bottom + 8),
      right: Math.max(10, Math.round(window.innerWidth - rect.right)),
    })
  }

  useEffect(() => {
    if (!open) return undefined
    updatePosition()
    const close = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (
        event.type === 'pointerdown' &&
        !menuRef.current?.contains(event.target) &&
        !popoverRef.current?.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    const reposition = () => updatePosition()
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  const popover = open && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="record-create-popover"
          ref={popoverRef}
          role="menu"
          style={{ '--record-menu-top': `${position.top}px`, '--record-menu-right': `${position.right}px` }}
        >
          <div className="record-create-popover-heading">
            <span className="eyebrow">Create record</span>
            <strong>Choose a record type</strong>
          </div>
          {unifiedRecordTypes.map((recordType) => {
            const meta = unifiedRecordMeta[recordType]
            return (
              <button
                key={recordType}
                onClick={() => {
                  setOpen(false)
                  openNewRecord?.(recordType)
                }}
                role="menuitem"
                type="button"
              >
                <span className={`record-type-mark ${recordType.toLowerCase().replace(/\s+/g, '-')}`}>
                  {recordType === 'Service Request' ? 'SR' : recordType[0]}
                </span>
                <span>
                  <strong>{recordType}</strong>
                  <small>{meta.description}</small>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            )
          })}
        </div>,
        document.querySelector('.app-shell') || document.body,
      )
    : null

  return (
    <div className={`record-create-menu ${className}`.trim()} ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="record-create-trigger"
        onClick={() => {
          updatePosition()
          setOpen((current) => !current)
        }}
        type="button"
      >
        <Plus size={16} aria-hidden="true" />
        <span>New</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {popover}
    </div>
  )
}

function unifiedAttention(ticket, recordType) {
  if (recordType === 'Incident') return Number(ticket.slaPercent || 0) >= 60 && !['Resolved', 'Closed'].includes(ticket.status)
  if (recordType === 'Service Request') return ['Pending Approval', 'Awaiting Approval'].includes(ticket.status) || ticket.requestApprovals?.some((item) => item.status === 'Pending')
  if (recordType === 'Change') return ['High', 'Critical'].includes(ticket.risk || ticket.priority)
  if (recordType === 'Problem') return String(ticket.knownErrorStatus || '').toLowerCase().includes('known') || String(ticket.knownErrorStatus || '').toLowerCase().includes('declared')
  return false
}

function unifiedKeyDetail(ticket, recordType) {
  if (recordType === 'Incident') {
    return {
      primary: ticket.sla || 'No SLA',
      secondary: `${Number(ticket.slaPercent || 0)}% elapsed`,
    }
  }
  if (recordType === 'Service Request') {
    const cost = (ticket.requestedItems || []).reduce((sum, item) => sum + Number(item.unitCost || 0) * Number(item.quantity || 1), 0)
    return {
      primary: cost ? `£${cost.toLocaleString('en-GB')}` : 'No charge',
      secondary: `${ticket.requestedItems?.length || 0} requested item${ticket.requestedItems?.length === 1 ? '' : 's'}`,
    }
  }
  if (recordType === 'Change') {
    return {
      primary: ticket.window || 'To be scheduled',
      secondary: ticket.changeType || 'Normal change',
    }
  }
  return {
    primary: `${ticket.relatedIncidents?.length || 0} linked incident${ticket.relatedIncidents?.length === 1 ? '' : 's'}`,
    secondary: ticket.knownErrorStatus || 'Not declared',
  }
}

function unifiedPriority(ticket, recordType) {
  return recordType === 'Change' ? (ticket.risk || ticket.priority || 'Medium') : (ticket.priority || 'Medium')
}

function UnifiedRecordQueue({
  filters,
  openNewRecord,
  openRecordTab,
  query,
  recordType,
  setFilters,
  setQuery,
  tickets,
  updateTicket,
}) {
  const meta = unifiedRecordMeta[recordType]
  const [localQuery, setLocalQuery] = useState('')
  const [localFilters, setLocalFilters] = useState({ status: 'All', priority: 'All' })
  const [quickView, setQuickView] = useState('all')
  const [sortKey, setSortKey] = useState('updated')
  const [sortDirection, setSortDirection] = useState('desc')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [teamFilter, setTeamFilter] = useState('All')
  const [assigneeFilter, setAssigneeFilter] = useState('All')
  const [serviceFilter, setServiceFilter] = useState('All')
  const [selectedIds, setSelectedIds] = useState([])

  const searchValue = typeof query === 'string' ? query : localQuery
  const updateSearch = setQuery || setLocalQuery
  const statusFilter = filters?.status || localFilters.status
  const priorityFilter = filters?.priority || localFilters.priority
  const updateStatusFilter = (value) => setFilters
    ? setFilters({ ...filters, status: value })
    : setLocalFilters((current) => ({ ...current, status: value }))
  const updatePriorityFilter = (value) => setFilters
    ? setFilters({ ...filters, priority: value })
    : setLocalFilters((current) => ({ ...current, priority: value }))

  const records = tickets.filter((ticket) => ticket.type === recordType)
  const openRecords = records.filter((ticket) => !['Resolved', 'Closed', 'Cancelled'].includes(ticket.status))
  const mineCount = openRecords.filter((ticket) => ticket.assignee === 'Hi5Central User').length
  const unassignedCount = openRecords.filter((ticket) => !ticket.assignee || ticket.assignee === 'Unassigned').length
  const attentionCount = records.filter((ticket) => unifiedAttention(ticket, recordType)).length

  const teamsAvailable = ['All', ...new Set(records.map((ticket) => ticket.team).filter(Boolean))]
  const assigneesAvailable = ['All', ...new Set(records.map((ticket) => ticket.assignee).filter(Boolean))]
  const servicesAvailable = ['All', ...new Set(records.map((ticket) => ticket.service).filter(Boolean))]
  const statusesAvailable = ['All', ...new Set(records.map((ticket) => ticket.status).filter(Boolean))]

  const normalizedQuery = searchValue.trim().toLowerCase()
  const quickMatch = (ticket) => {
    if (quickView === 'mine') return ticket.assignee === 'Hi5Central User' && !['Resolved', 'Closed', 'Cancelled'].includes(ticket.status)
    if (quickView === 'mygroup') return ticket.team === 'Service Desk' && !['Resolved', 'Closed', 'Cancelled'].includes(ticket.status)
    if (quickView === 'unassigned') return (!ticket.assignee || ticket.assignee === 'Unassigned') && !['Resolved', 'Closed', 'Cancelled'].includes(ticket.status)
    if (quickView === 'priority') return ['Critical', 'High'].includes(unifiedPriority(ticket, recordType)) && !['Resolved', 'Closed', 'Cancelled'].includes(ticket.status)
    if (quickView === 'attention') return unifiedAttention(ticket, recordType)
    if (quickView === 'pending') return String(ticket.status || '').toLowerCase().includes('pending') || String(ticket.status || '').toLowerCase().includes('approval')
    if (quickView === 'closed') return ['Resolved', 'Closed', 'Cancelled'].includes(ticket.status)
    return true
  }

  const updatedWeight = (value) => {
    const normalized = String(value || '').toLowerCase()
    if (normalized.includes('just now')) return 0
    const minutes = normalized.match(/(\d+)\s*min/)
    if (minutes) return Number(minutes[1])
    const hours = normalized.match(/(\d+)\s*hr/)
    if (hours) return Number(hours[1]) * 60
    if (normalized.includes('yesterday')) return 1440
    return 2880
  }
  const priorityWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 }
  const visibleRecords = records
    .filter((ticket) => {
      const queryMatches = !normalizedQuery || [ticket.id, ticket.title, ticket.requester, ticket.service, ticket.team, ticket.assignee, ticket.status]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
      if (!queryMatches) return false
      if (statusFilter !== 'All' && ticket.status !== statusFilter) return false
      if (priorityFilter !== 'All' && unifiedPriority(ticket, recordType) !== priorityFilter) return false
      if (teamFilter !== 'All' && ticket.team !== teamFilter) return false
      if (assigneeFilter !== 'All' && ticket.assignee !== assigneeFilter) return false
      if (serviceFilter !== 'All' && ticket.service !== serviceFilter) return false
      return quickMatch(ticket)
    })
    .sort((a, b) => {
      let aValue
      let bValue
      if (sortKey === 'reference') {
        aValue = Number(String(a.id).match(/\d+/)?.[0] || 0)
        bValue = Number(String(b.id).match(/\d+/)?.[0] || 0)
      } else if (sortKey === 'priority') {
        aValue = priorityWeight[unifiedPriority(a, recordType)] || 0
        bValue = priorityWeight[unifiedPriority(b, recordType)] || 0
      } else if (sortKey === 'updated') {
        aValue = updatedWeight(a.updated)
        bValue = updatedWeight(b.updated)
      } else {
        aValue = String(a[sortKey] || '').toLowerCase()
        bValue = String(b[sortKey] || '').toLowerCase()
      }
      const result = typeof aValue === 'string' ? aValue.localeCompare(bValue) : aValue - bValue
      return sortDirection === 'asc' ? result : -result
    })

  const activeFilterCount = [statusFilter, priorityFilter, teamFilter, assigneeFilter, serviceFilter].filter((value) => value !== 'All').length
  const quickViews = [
    ['all', 'All'],
    ['mine', 'Assigned to me'],
    ['mygroup', 'My group'],
    ['unassigned', 'Unassigned'],
    ['priority', 'High priority'],
    ['attention', meta.attentionLabel],
    ['pending', 'Pending'],
    ['closed', 'Closed'],
  ]

  const sortBy = (key) => {
    if (sortKey === key) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortKey(key)
    setSortDirection(key === 'priority' ? 'desc' : 'asc')
  }
  const sortIndicator = (key) => sortKey === key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''
  const clearFilters = () => {
    updateStatusFilter('All')
    updatePriorityFilter('All')
    setTeamFilter('All')
    setAssigneeFilter('All')
    setServiceFilter('All')
    setQuickView('all')
  }
  const bulkUpdate = (patch) => {
    if (!updateTicket) return
    selectedIds.forEach((id) => updateTicket(id, patch))
    setSelectedIds([])
  }

  return (
    <section className="unified-record-queue">
      <div className="unified-record-queue-inner">
        <header className="unified-record-header">
          <div>
            <span className="eyebrow">{meta.eyebrow}</span>
            <h2>{meta.title}</h2>
            <p>{meta.description}</p>
          </div>
          <RecordCreateMenu openNewRecord={openNewRecord} />
        </header>

        <div className="unified-record-metrics" aria-label={`${meta.title} summary`}>
          <div><strong>{openRecords.length}</strong><span>Open</span></div>
          <div><strong>{mineCount}</strong><span>Mine</span></div>
          <div><strong>{unassignedCount}</strong><span>Unassigned</span></div>
          <div className={attentionCount ? 'attention' : ''}><strong>{attentionCount}</strong><span>{meta.attentionLabel}</span></div>
        </div>

        <div className="unified-record-toolbar">
          <label className="unified-record-search">
            <Search size={18} aria-hidden="true" />
            <input
              onChange={(event) => updateSearch(event.target.value)}
              placeholder={`Search ${meta.title.toLowerCase()}, requester, service...`}
              type="search"
              value={searchValue}
            />
          </label>
          <button className={activeFilterCount ? 'unified-filter-button active' : 'unified-filter-button'} onClick={() => setFiltersOpen((current) => !current)} type="button">
            <SlidersHorizontal size={17} aria-hidden="true" />
            Filters
            {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
          </button>
          <label className="unified-mobile-sort">
            <span>Sort</span>
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
              <option value="updated">Updated</option>
              <option value="priority">Priority / risk</option>
              <option value="reference">Reference</option>
              <option value="status">Status</option>
            </select>
          </label>
        </div>

        {filtersOpen && (
          <div className="unified-record-filter-panel">
            <label>Status<select value={statusFilter} onChange={(event) => updateStatusFilter(event.target.value)}>{statusesAvailable.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Priority / risk<select value={priorityFilter} onChange={(event) => updatePriorityFilter(event.target.value)}><option>All</option>{priorities.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Team<select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>{teamsAvailable.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Assignee<select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}>{assigneesAvailable.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Service<select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}>{servicesAvailable.map((value) => <option key={value}>{value}</option>)}</select></label>
            <button className="text-button" onClick={clearFilters} type="button">Clear filters</button>
          </div>
        )}

        <div className="unified-record-quick-views" aria-label={`${meta.title} saved views`}>
          {quickViews.map(([id, label]) => (
            <button className={quickView === id ? 'active' : ''} key={id} onClick={() => setQuickView(id)} type="button">{label}</button>
          ))}
        </div>

        <div className="unified-record-result-line">
          <span><strong>{visibleRecords.length}</strong> {visibleRecords.length === 1 ? meta.singular.toLowerCase() : meta.title.toLowerCase()}</span>
          <span>Sorted by {sortKey} {sortDirection === 'asc' ? 'ascending' : 'descending'}</span>
        </div>

        {selectedIds.length > 0 && updateTicket && (
          <div className="unified-record-bulk-bar">
            <strong>{selectedIds.length} selected</strong>
            <div>
              <button onClick={() => bulkUpdate({ assignee: 'Hi5Central User' })} type="button">Assign to me</button>
                            <button onClick={() => setSelectedIds([])} type="button">Clear</button>
            </div>
          </div>
        )}

        {visibleRecords.length ? (
          <>
            <div className="unified-record-table-wrap">
              <table className="unified-record-table">
                <thead>
                  <tr>
                    <th className="unified-select-column"><span className="sr-only">Select</span></th>
                    <th><button onClick={() => sortBy('reference')} type="button">Reference{sortIndicator('reference')}</button></th>
                    <th>Summary</th>
                    <th><button onClick={() => sortBy('priority')} type="button">Priority / risk{sortIndicator('priority')}</button></th>
                    <th><button onClick={() => sortBy('status')} type="button">Status{sortIndicator('status')}</button></th>
                    <th>Requester</th>
                    <th>Service</th>
                    <th>Assignment</th>
                    <th>Key detail</th>
                    <th><button onClick={() => sortBy('updated')} type="button">Updated{sortIndicator('updated')}</button></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((ticket) => {
                    const detail = unifiedKeyDetail(ticket, recordType)
                    const priority = unifiedPriority(ticket, recordType)
                    return (
                      <tr key={ticket.id} onClick={() => openRecordTab(ticket)}>
                        <td className="unified-select-column" onClick={(event) => event.stopPropagation()}>
                          <input aria-label={`Select ${ticket.id}`} checked={selectedIds.includes(ticket.id)} onChange={() => setSelectedIds((current) => current.includes(ticket.id) ? current.filter((id) => id !== ticket.id) : [...current, ticket.id])} type="checkbox" />
                        </td>
                        <td><button className="unified-record-link" onClick={(event) => { event.stopPropagation(); openRecordTab(ticket) }} type="button">{ticket.id}</button></td>
                        <td><strong>{ticket.title}</strong><small>{ticket.category || ticket.type}</small></td>
                        <td><span className={`unified-priority ${priorityClass(priority)}`}>{priority}</span></td>
                        <td><span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span></td>
                        <td><strong>{ticket.requester || 'Not recorded'}</strong><small>{ticket.location || ''}</small></td>
                        <td>{ticket.service || 'Unclassified'}</td>
                        <td><strong>{ticket.team || 'Unassigned team'}</strong><small>{ticket.assignee || 'Unassigned'}</small></td>
                        <td><strong>{detail.primary}</strong><small>{detail.secondary}</small></td>
                        <td>{ticket.updated || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="unified-record-mobile-list">
              {visibleRecords.map((ticket) => {
                const detail = unifiedKeyDetail(ticket, recordType)
                const priority = unifiedPriority(ticket, recordType)
                return (
                  <button className="unified-record-mobile-card" key={ticket.id} onClick={() => openRecordTab(ticket)} type="button">
                    <div className="unified-record-mobile-top"><strong>{ticket.id}</strong><span className={`unified-priority ${priorityClass(priority)}`}>{priority}</span></div>
                    <h3>{ticket.title}</h3>
                    <div className="unified-record-mobile-state"><span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span><span>{ticket.service || 'Unclassified'}</span></div>
                    <dl>
                      <div><dt>Requester</dt><dd>{ticket.requester || 'Not recorded'}</dd></div>
                      <div><dt>Assignment</dt><dd>{ticket.team || 'Unassigned'} · {ticket.assignee || 'Unassigned'}</dd></div>
                      <div><dt>Key detail</dt><dd>{detail.primary}</dd></div>
                    </dl>
                    <footer><span>Updated {ticket.updated || '—'}</span><ChevronRight size={17} aria-hidden="true" /></footer>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div className="unified-record-empty"><Inbox size={28} /><strong>No {meta.title.toLowerCase()} match this view</strong><span>Change the saved view, search or filters to see more records.</span></div>
        )}
      </div>
    </section>
  )
}

function IncidentQueueView(props) {
  return <UnifiedRecordQueue {...props} recordType="Incident" />
}

function ServiceRequestQueueView(props) {
  return <UnifiedRecordQueue {...props} recordType="Service Request" />
}

function ProblemQueueView(props) {
  return <UnifiedRecordQueue {...props} recordType="Problem" />
}

export function TicketsView({
  addComment,
  filters,
  filteredTickets,
  handleTicketSubmit,
  moduleConfig,
  newComment,
  openNewRecord,
  openRecordTab,
  query,
  selectedTicket,
  setFilters,
  setNewComment,
  setQuery,
  setSelectedTicketId,
  setTicketDraft,
  ticketDraft,
  tickets,
  updateTicket,
}) {
  if (moduleConfig?.type === 'Incident') {
    return (
      <IncidentQueueView
        filters={filters}
        filteredTickets={filteredTickets}
        openNewRecord={openNewRecord}
        openRecordTab={openRecordTab}
        query={query}
        setFilters={setFilters}
        setQuery={setQuery}
        tickets={tickets}
        updateTicket={updateTicket}
      />
    )
  }

  if (moduleConfig?.type === 'Service Request') {
    return (
      <ServiceRequestQueueView
        filters={filters}
        openNewRecord={openNewRecord}
        openRecordTab={openRecordTab}
        query={query}
        setFilters={setFilters}
        setQuery={setQuery}
        tickets={tickets}
        updateTicket={updateTicket}
      />
    )
  }

  if (moduleConfig?.type === 'Problem') {
    return (
      <ProblemQueueView
        filters={filters}
        openNewRecord={openNewRecord}
        openRecordTab={openRecordTab}
        query={query}
        setFilters={setFilters}
        setQuery={setQuery}
        tickets={tickets}
        updateTicket={updateTicket}
      />
    )
  }

  const moduleTickets = moduleConfig
    ? tickets.filter((ticket) => ticket.type === moduleConfig.type)
    : tickets
  const recordLabel = moduleConfig ? moduleConfig.label.toLowerCase() : 'records'
  const queueTitle = moduleConfig?.queueTitle || 'All Records'
  const createTitle = moduleConfig?.createTitle || 'New Record'
  const createLabel = moduleConfig?.createLabel || 'Create Record'
  const searchPlaceholder = moduleConfig?.searchPlaceholder || 'Record, requester, service'

  return (
    <div className="tickets-layout">
      <section className="ticket-list-zone">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{filteredTickets.length} of {moduleTickets.length} {recordLabel}</span>
            <h2>{queueTitle}</h2>
          </div>
          <button
            className="primary-action compact"
            onClick={() => openNewRecord?.(moduleConfig?.type || ticketDraft.type)}
            type="button"
          >
            <Plus size={16} aria-hidden="true" />
            {createLabel}
          </button>
        </div>

        <div className={moduleConfig ? 'filter-grid module-filter-grid' : 'filter-grid'}>
          <label>
            Search
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              type="search"
              value={query}
            />
          </label>
          {!moduleConfig && (
            <FilterSelect label="Type" options={['All', ...types]} value={filters.type} onChange={(type) => setFilters({ ...filters, type })} />
          )}
          <FilterSelect label="Priority" options={['All', ...priorities]} value={filters.priority} onChange={(priority) => setFilters({ ...filters, priority })} />
          <FilterSelect label="Status" options={['All', ...statusOptions]} value={filters.status} onChange={(status) => setFilters({ ...filters, status })} />
        </div>

        <div className="ticket-stack">
          {filteredTickets.map((ticket) => (
            <button
              className={selectedTicket?.id === ticket.id ? 'ticket-card selected' : 'ticket-card'}
              key={ticket.id}
              onClick={() => {
                setSelectedTicketId(ticket.id)
                openRecordTab(ticket)
              }}
              type="button"
            >
              <div className="ticket-card-top">
                <span className={`type-chip ${ticket.type.toLowerCase().replace(/\s+/g, '-')}`}>{ticket.type}</span>
                <span className={`priority-label ${priorityClass(ticket.priority)}`}>{ticket.priority}</span>
              </div>
              <strong>{ticket.title}</strong>
              <div className="ticket-meta">
                <span>{ticket.id}</span>
                <span>{ticket.requester}</span>
                <span>{ticket.team}</span>
              </div>
              <div className="ticket-card-bottom">
                <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
                <SlaBar value={ticket.slaPercent} label={ticket.sla} />
              </div>
            </button>
          ))}
        </div>
      </section>

      <aside className="ticket-detail-zone">
        {selectedTicket && (
          <TicketDetailContent
            addComment={addComment}
            newComment={newComment}
            setNewComment={setNewComment}
            ticket={selectedTicket}
            updateTicket={updateTicket}
          />
        )}

        <form className="new-ticket-form" id="new-ticket-form" onSubmit={handleTicketSubmit}>
          <div className="section-heading tight">
            <div>
              <span className="eyebrow">Quick Capture</span>
              <h2>{createTitle}</h2>
            </div>
          </div>
          <div className={moduleConfig ? '' : 'form-row'}>
            {!moduleConfig && (
              <label>
                Type
                <select value={ticketDraft.type} onChange={(event) => setTicketDraft({ ...ticketDraft, type: event.target.value })}>
                  {types.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Priority
              <select value={ticketDraft.priority} onChange={(event) => setTicketDraft({ ...ticketDraft, priority: event.target.value })}>
                {priorities.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Summary
            <input
              onChange={(event) => setTicketDraft({ ...ticketDraft, title: event.target.value })}
              placeholder="What needs attention?"
              value={ticketDraft.title}
            />
          </label>
          <label>
            Requester
            <input
              onChange={(event) => setTicketDraft({ ...ticketDraft, requester: event.target.value })}
              placeholder="Person or team"
              value={ticketDraft.requester}
            />
          </label>
          <div className="form-row">
            <label>
              Service
              <select value={ticketDraft.service} onChange={(event) => setTicketDraft({ ...ticketDraft, service: event.target.value })}>
                {['Collaboration', 'Identity', 'Hardware', 'Network Security', 'Wireless', 'Access'].map((service) => (
                  <option key={service}>{service}</option>
                ))}
              </select>
            </label>
            <label>
              Team
              <select value={ticketDraft.team} onChange={(event) => setTicketDraft({ ...ticketDraft, team: event.target.value })}>
                {teams.map((team) => (
                  <option key={team}>{team}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Description
            <textarea
              onChange={(event) => setTicketDraft({ ...ticketDraft, description: event.target.value })}
              placeholder="Impact, symptoms, desired outcome"
              value={ticketDraft.description}
            />
          </label>
          <button className="primary-action compact" type="submit">
            <Plus size={16} aria-hidden="true" />
            Quick create
          </button>
        </form>
      </aside>
    </div>
  )
}


function incidentPriority(impact, urgency) {
  const score = {
    High: 3,
    Medium: 2,
    Low: 1,
  }
  const total = (score[impact] || 2) + (score[urgency] || 2)
  if (impact === 'High' && urgency === 'High') return 'Critical'
  if (total >= 5) return 'High'
  if (total >= 4) return 'Medium'
  return 'Low'
}

function userInitials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}


function UnifiedNewRecordForm({
  handleTicketSubmit,
  hasUnsavedChanges,
  onRecordTypeChange,
  setTicketDraft,
  ticketDraft,
}) {
  const [userQuery, setUserQuery] = useState('')
  const recordType = ticketDraft.type || 'Incident'
  const selectedTemplate = serviceRequestCatalogTemplates.find((template) => template.id === ticketDraft.requestTemplateId)
  const selectedUser = ticketDraft.requesterId ? workspaceUsers.find((user) => user.id === ticketDraft.requesterId) : null
  const requestCost = (ticketDraft.requestedItems || []).reduce((sum, item) => sum + Number(item.unitCost || 0) * Number(item.quantity || 1), 0)
  const meta = unifiedRecordMeta[recordType] || unifiedRecordMeta.Incident
  const normalizedQuery = userQuery.trim().toLowerCase()
  const userResults = normalizedQuery
    ? workspaceUsers
        .filter((user) =>
          [
            user.name,
            user.email,
            user.staffNumber,
            user.jobTitle,
            user.department,
            user.location,
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery),
        )
        .slice(0, 8)
    : []

  const update = (patch) => setTicketDraft({ ...ticketDraft, ...patch })
  const changeType = (nextType) => {
    if (nextType === recordType) return
    update({
      type: nextType,
      priority: nextType === 'Change' ? (ticketDraft.changeRisk || 'Medium') : ticketDraft.priority,
    })
    onRecordTypeChange?.(nextType)
  }
  const selectRequester = (user) => {
    update({
      requesterId: user.id,
      requester: user.name,
      requesterEmail: user.email,
      requesterStaffNumber: user.staffNumber,
      requesterJobTitle: user.jobTitle,
      requesterDepartment: user.department,
      requesterLocation: user.location,
      requesterManager: user.manager,
    })
    setUserQuery('')
  }
  const clearRequester = () => {
    update({
      requesterId: '',
      requester: '',
      requesterEmail: '',
      requesterStaffNumber: '',
      requesterJobTitle: '',
      requesterDepartment: '',
      requesterLocation: '',
      requesterManager: '',
    })
    setUserQuery('')
  }
  const selectRequestTemplate = (templateId) => {
    const template = serviceRequestCatalogTemplates.find((item) => item.id === templateId)
    if (!template) {
      update({ requestTemplateId: '', requestedItems: [], requestApprovals: [], requestTasks: [] })
      return
    }
    const approvals = template.approvals.map((approval) => ({
      ...approval,
      approver: approval.approver === 'Line manager' ? ticketDraft.requesterManager || 'Line manager' : approval.approver,
    }))
    update({
      requestTemplateId: template.id,
      title: ticketDraft.title || template.title,
      service: template.service,
      team: template.team,
      priority: 'Medium',
      requestedItems: template.items.map((item) => ({ ...item })),
      requestApprovals: approvals,
      requestTasks: template.tasks.map((task) => ({ ...task })),
    })
  }

  return (
    <div className="unified-new-record-page">
      <section className="unified-new-record-shell">
        <header className="unified-new-record-header">
          <div>
            <span className="eyebrow">Create record</span>
            <h2>New record</h2>
            <p>Select the record type and requester first. The relevant form appears once the requester is confirmed.</p>
          </div>
          {hasUnsavedChanges && <span className="draft-status">Unsaved changes</span>}
        </header>

        <nav className="unified-record-type-picker" aria-label="Record type">
          {unifiedRecordTypes.map((type) => (
            <button className={recordType === type ? 'active' : ''} key={type} onClick={() => changeType(type)} type="button">
              <span className={`record-type-mark ${type.toLowerCase().replace(/\s+/g, '-')}`}>{type === 'Service Request' ? 'SR' : type[0]}</span>
              <span><strong>{type}</strong><small>{unifiedRecordMeta[type].description}</small></span>
              {recordType === type && <CheckCircle2 size={17} aria-hidden="true" />}
            </button>
          ))}
        </nav>

        <ol className="incident-stepper unified-record-stepper" aria-label="Record creation progress">
          <li className={selectedUser ? 'complete' : 'active'}>
            <span>1</span>
            <div><strong>Select requester</strong><small>Name, email or staff number</small></div>
          </li>
          <li className={selectedUser ? 'active' : ''}>
            <span>2</span>
            <div><strong>{recordType} details</strong><small>Fields adapt to record type</small></div>
          </li>
          <li>
            <span>3</span>
            <div><strong>Submitted</strong><small>{meta.singular} workspace</small></div>
          </li>
        </ol>

        {!selectedUser ? (
          <section className="incident-stage-card unified-requester-lookup-stage">
            <div className="incident-stage-heading">
              <span className="stage-number">1</span>
              <div>
                <span className="eyebrow">Requester</span>
                <h3>Who is this {meta.singular.toLowerCase()} for?</h3>
                <p>Start typing and select a person from the People directory. The {meta.singular.toLowerCase()} form will appear after selection.</p>
              </div>
            </div>

            <div className="unified-user-combobox">
              <label className="incident-user-search" htmlFor="unified-requester-search">
                <Search size={20} aria-hidden="true" />
                <input
                  aria-autocomplete="list"
                  aria-controls="unified-requester-results"
                  aria-expanded={Boolean(normalizedQuery)}
                  autoComplete="off"
                  autoFocus
                  id="unified-requester-search"
                  onChange={(event) => setUserQuery(event.target.value)}
                  placeholder="Start typing a name, email, staff number, department..."
                  role="combobox"
                  type="search"
                  value={userQuery}
                />
              </label>

              {!normalizedQuery ? (
                <div className="unified-typeahead-hint">
                  <UserRound size={22} aria-hidden="true" />
                  <span>Start typing to search People</span>
                  <small>Matches appear immediately as you type.</small>
                </div>
              ) : userResults.length ? (
                <div className="incident-user-results unified-user-results" id="unified-requester-results" role="listbox">
                  {userResults.map((user) => (
                    <button key={user.id} onClick={() => selectRequester(user)} role="option" type="button">
                      <span className="directory-avatar">{userInitials(user.name)}</span>
                      <span className="directory-primary">
                        <strong>{user.name}</strong>
                        <small>{user.email}</small>
                      </span>
                      <span className="directory-secondary">
                        <strong>{user.staffNumber}</strong>
                        <small>{user.jobTitle}</small>
                      </span>
                      <span className="directory-location">
                        <strong>{user.department}</strong>
                        <small>{user.location}</small>
                      </span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="unified-typeahead-hint no-results" id="unified-requester-results">
                  <Search size={22} aria-hidden="true" />
                  <span>No matching people</span>
                  <small>Try another name, email address or staff number.</small>
                </div>
              )}
            </div>
          </section>
        ) : (
          <div className="unified-new-record-details-layout">
            <aside className="incident-requester-card unified-record-requester-card">
              <div className="incident-stage-heading compact">
                <span className="stage-number complete">1</span>
                <div><span className="eyebrow">Requester selected</span><h3>{selectedUser.name}</h3></div>
              </div>
              <div className="requester-profile">
                <span className="directory-avatar large">{userInitials(selectedUser.name)}</span>
                <div><strong>{selectedUser.name}</strong><span>{selectedUser.jobTitle}</span></div>
              </div>
              <dl className="requester-facts">
                <div><dt>Email</dt><dd>{selectedUser.email}</dd></div>
                <div><dt>Staff number</dt><dd>{selectedUser.staffNumber}</dd></div>
                <div><dt>Department</dt><dd>{selectedUser.department}</dd></div>
                <div><dt>Location</dt><dd>{selectedUser.location}</dd></div>
                <div><dt>Manager</dt><dd>{selectedUser.manager}</dd></div>
              </dl>
              <button className="secondary-action full-width" onClick={clearRequester} type="button">Change requester</button>
            </aside>

            <form className="unified-new-record-form" onSubmit={handleTicketSubmit}>
              <section className="unified-form-section">
                <div className="unified-form-section-heading"><span>2A</span><div><strong>Record details</strong><small>Core information for this {meta.singular.toLowerCase()}.</small></div></div>
                <label>{recordType === 'Change' ? 'Change summary' : recordType === 'Problem' ? 'Problem summary' : 'Summary'}<input autoFocus required value={ticketDraft.title} onChange={(event) => update({ title: event.target.value })} placeholder={`Short ${meta.singular.toLowerCase()} summary`} /></label>
                <div className="unified-form-grid three">
                  <label>Service<select value={ticketDraft.service} onChange={(event) => update({ service: event.target.value })}>{['Collaboration', 'Identity', 'Hardware', 'Network Security', 'Wireless', 'Access', 'Print'].map((service) => <option key={service}>{service}</option>)}</select></label>
                  <label>Assignment group<select value={ticketDraft.team} onChange={(event) => update({ team: event.target.value })}>{teams.map((team) => <option key={team}>{team}</option>)}</select></label>
                  <label>Category<input value={ticketDraft.category || ''} onChange={(event) => update({ category: event.target.value })} placeholder="Classification" /></label>
                </div>
                {(recordType === 'Service Request' || recordType === 'Problem') && (
                  <div className="unified-form-grid two">
                    <label>Priority<select value={ticketDraft.priority} onChange={(event) => update({ priority: event.target.value })}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
                    <label>Requester location<input readOnly value={ticketDraft.requesterLocation || selectedUser.location} /></label>
                  </div>
                )}
              </section>

              {recordType === 'Incident' && (
                <section className="unified-form-section">
                  <div className="unified-form-section-heading"><span>2B</span><div><strong>Incident impact</strong><small>Capture impact and urgency so the service desk can prioritise correctly.</small></div></div>
                  <div className="unified-form-grid three">
                    <label>Impact<select value={ticketDraft.impact} onChange={(event) => { const impact = event.target.value; update({ impact, priority: incidentPriority(impact, ticketDraft.urgency) }) }}><option>Low</option><option>Medium</option><option>High</option></select></label>
                    <label>Urgency<select value={ticketDraft.urgency} onChange={(event) => { const urgency = event.target.value; update({ urgency, priority: incidentPriority(ticketDraft.impact, urgency) }) }}><option>Low</option><option>Medium</option><option>High</option></select></label>
                    <label>Calculated priority<input readOnly value={ticketDraft.priority} /></label>
                  </div>
                  <label>Description<textarea rows="6" value={ticketDraft.description} onChange={(event) => update({ description: event.target.value })} placeholder="Symptoms, impact, affected users and troubleshooting already completed" /></label>
                </section>
              )}

              {recordType === 'Service Request' && (
                <section className="unified-form-section">
                  <div className="unified-form-section-heading"><span>2B</span><div><strong>Catalogue & fulfilment</strong><small>Select a service to snapshot requested items, cost, approvals and workflow tasks.</small></div></div>
                  <label>Catalogue service<select value={ticketDraft.requestTemplateId || ''} onChange={(event) => selectRequestTemplate(event.target.value)}><option value="">Select catalogue service</option>{serviceRequestCatalogTemplates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}</select></label>
                  {selectedTemplate && (
                    <div className="unified-catalogue-summary">
                      <div><span className="eyebrow">Selected service</span><strong>{selectedTemplate.title}</strong><p>{selectedTemplate.description}</p></div>
                      <div className="unified-catalogue-cost"><span>Snapshot cost</span><strong>£{requestCost.toLocaleString('en-GB')}</strong></div>
                      <div className="unified-catalogue-items">{ticketDraft.requestedItems.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.category} · Qty {item.quantity || 1}</small></span><strong>£{(Number(item.unitCost || 0) * Number(item.quantity || 1)).toLocaleString('en-GB')}</strong></div>)}</div>
                      <div className="unified-catalogue-flow"><span>{ticketDraft.requestApprovals.length} approval{ticketDraft.requestApprovals.length === 1 ? '' : 's'}</span><span>{ticketDraft.requestTasks.length} fulfilment task{ticketDraft.requestTasks.length === 1 ? '' : 's'}</span></div>
                    </div>
                  )}
                  <div className="unified-form-grid two"><label>Cost centre<input value={ticketDraft.requestCostCentre || ''} onChange={(event) => update({ requestCostCentre: event.target.value })} placeholder="Optional" /></label><label>Required by<input type="date" value={ticketDraft.requestRequiredBy || ''} onChange={(event) => update({ requestRequiredBy: event.target.value })} /></label></div>
                  <label>Request details<textarea rows="5" value={ticketDraft.description} onChange={(event) => update({ description: event.target.value })} placeholder="Business need, options, delivery location or other fulfilment information" /></label>
                </section>
              )}

              {recordType === 'Problem' && (
                <section className="unified-form-section">
                  <div className="unified-form-section-heading"><span>2B</span><div><strong>Investigation context</strong><small>Capture the recurring pattern, evidence and current theory.</small></div></div>
                  <label>Problem description<textarea rows="5" value={ticketDraft.description} onChange={(event) => update({ description: event.target.value })} placeholder="Recurring symptoms, pattern and business impact" /></label>
                  <div className="unified-form-grid two"><label>Impact scope<input value={ticketDraft.problemImpactScope || ''} onChange={(event) => update({ problemImpactScope: event.target.value })} placeholder="Users, sites, services or versions affected" /></label><label>Related incidents<input value={ticketDraft.problemRelatedIncidentsText || ''} onChange={(event) => update({ problemRelatedIncidentsText: event.target.value })} placeholder="INC-1032, INC-1044" /></label></div>
                  <div className="unified-form-grid two"><label>Initial hypothesis<textarea rows="4" value={ticketDraft.problemHypothesis || ''} onChange={(event) => update({ problemHypothesis: event.target.value })} placeholder="Current root-cause theory" /></label><label>Known workaround<textarea rows="4" value={ticketDraft.problemWorkaround || ''} onChange={(event) => update({ problemWorkaround: event.target.value })} placeholder="Safe mitigation already known" /></label></div>
                </section>
              )}

              {recordType === 'Change' && (
                <>
                  <section className="unified-form-section">
                    <div className="unified-form-section-heading"><span>2B</span><div><strong>Change assessment</strong><small>Define the change type, risk, approval route and affected scope.</small></div></div>
                    <div className="unified-form-grid three"><label>Change type<select value={ticketDraft.changeType || 'Normal'} onChange={(event) => update({ changeType: event.target.value })}><option>Standard</option><option>Normal</option><option>Emergency</option></select></label><label>Risk<select value={ticketDraft.changeRisk || 'Medium'} onChange={(event) => update({ changeRisk: event.target.value, priority: event.target.value })}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label><label>Approval route<select value={ticketDraft.changeApprovalRoute || 'CAB'} onChange={(event) => update({ changeApprovalRoute: event.target.value })}><option>CAB</option><option>Service owner</option><option>Security approval</option><option>Emergency CAB</option></select></label></div>
                    <label>Affected CIs<input value={ticketDraft.changeAffectedCisText || ''} onChange={(event) => update({ changeAffectedCisText: event.target.value })} placeholder="FW-EDGE-A, M365-TENANT" /></label>
                    <label>Business reason<textarea rows="4" value={ticketDraft.changeBusinessReason || ''} onChange={(event) => update({ changeBusinessReason: event.target.value, description: event.target.value })} placeholder="Why the change is required and the expected outcome" /></label>
                  </section>
                  <section className="unified-form-section">
                    <div className="unified-form-section-heading"><span>2C</span><div><strong>Plan & schedule</strong><small>Capture implementation, validation, recovery and the proposed window.</small></div></div>
                    <label>Implementation plan<textarea rows="5" value={ticketDraft.changeImplementationPlan || ''} onChange={(event) => update({ changeImplementationPlan: event.target.value })} placeholder="Ordered implementation steps" /></label>
                    <div className="unified-form-grid two"><label>Test plan<textarea rows="4" value={ticketDraft.changeTestPlan || ''} onChange={(event) => update({ changeTestPlan: event.target.value })} placeholder="How success will be validated" /></label><label>Backout plan<textarea rows="4" value={ticketDraft.changeBackoutPlan || ''} onChange={(event) => update({ changeBackoutPlan: event.target.value })} placeholder="How service will be restored if validation fails" /></label></div>
                    <div className="unified-form-grid three"><label>Planned start<input type="datetime-local" value={ticketDraft.changePlannedStart || ''} onChange={(event) => update({ changePlannedStart: event.target.value })} /></label><label>Planned end<input type="datetime-local" value={ticketDraft.changePlannedEnd || ''} onChange={(event) => update({ changePlannedEnd: event.target.value })} /></label><label>Expected impact<input value={ticketDraft.changeDowntime || ''} onChange={(event) => update({ changeDowntime: event.target.value })} placeholder="No outage expected" /></label></div>
                  </section>
                </>
              )}

              <div className="unified-new-record-submit">
                <div><span className="eyebrow">Create {recordType}</span><strong>The submitted record will replace this New record tab.</strong></div>
                <button className="primary-action" type="submit"><Plus size={17} aria-hidden="true" />Create {recordType}</button>
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  )
}

function IncidentIntakeView(props) {
  return <UnifiedNewRecordForm {...props} />
}

const serviceRequestCatalogTemplates = [
  {
    id: 'laptop-refresh',
    title: 'Laptop refresh',
    description: 'Replace an ageing or under-performing corporate laptop with the standard professional bundle.',
    service: 'Hardware',
    team: 'End User Compute',
    items: [
      { id: 'CAT-LAP-PRO-14', name: 'Lenovo ThinkPad T14 Gen 7', category: 'Laptop', quantity: 1, unitCost: 1249, options: ['Intel Core Ultra 7', '32 GB RAM', '1 TB SSD', '3-year onsite warranty'] },
      { id: 'CAT-DOCK-USBC', name: 'USB-C Performance Dock', category: 'Accessory', quantity: 1, unitCost: 189, options: ['135W power supply', 'Dual-display support'] },
    ],
    approvals: [
      { id: 'APPROVAL-1', label: 'Line manager approval', approver: 'Line manager', status: 'Pending', updated: 'Created with request' },
      { id: 'APPROVAL-2', label: 'Cost-centre approval', approver: 'Finance Operations', status: 'Pending', updated: 'Created with request' },
    ],
    tasks: [
      { id: 'TASK-1', title: 'Confirm stock and reserve device', team: 'End User Compute', assignee: 'Unassigned', autoAssignee: 'Noah Williams', status: 'Waiting', requiresApproval: true, dependsOn: [], due: 'Within 4 hr of approval', instructions: 'Confirm the approved configuration is available and reserve the serial number.' },
      { id: 'TASK-2', title: 'Build and secure laptop', team: 'End User Compute', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-1'], due: '1 business day', instructions: 'Apply the corporate build, encryption, endpoint security and required applications.' },
      { id: 'TASK-3', title: 'Transfer profile and approved data', team: 'Service Desk', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-2'], due: 'Before handover', instructions: 'Confirm cloud sync and transfer any approved local user data.' },
      { id: 'TASK-4', title: 'Arrange handover and collect old device', team: 'Service Desk', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-3'], due: 'Required-by date', instructions: 'Arrange handover, verify identity, collect the replaced asset and update the asset record.' },
    ],
  },
  {
    id: 'new-starter-access',
    title: 'New starter access package',
    description: 'Provision the standard collaboration, VPN and shared-resource access required for a new employee.',
    service: 'Access',
    team: 'Service Desk',
    items: [
      { id: 'CAT-M365-E3', name: 'Microsoft 365 E3 licence', category: 'Software', quantity: 1, unitCost: 31, options: ['Monthly licence'] },
      { id: 'CAT-VPN-STD', name: 'Corporate VPN access', category: 'Access', quantity: 1, unitCost: 0, options: ['Standard employee profile'] },
      { id: 'CAT-SHARED-ACCESS', name: 'Department shared resources', category: 'Access', quantity: 1, unitCost: 0, options: ['Manager-approved standard groups'] },
    ],
    approvals: [
      { id: 'APPROVAL-1', label: 'Manager approval', approver: 'Line manager', status: 'Pending', updated: 'Created with request' },
    ],
    tasks: [
      { id: 'TASK-1', title: 'Create identity and licence', team: 'Identity', assignee: 'Unassigned', status: 'Waiting', requiresApproval: true, dependsOn: [], due: 'Within 4 hr of approval', instructions: 'Create the corporate identity and allocate the approved Microsoft 365 licence.' },
      { id: 'TASK-2', title: 'Provision shared-resource access', team: 'Service Desk', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-1'], due: 'Before start date', instructions: 'Apply the approved department and project group memberships.' },
      { id: 'TASK-3', title: 'Assign VPN profile', team: 'Network', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-2'], due: 'Before start date', instructions: 'Apply the standard VPN profile and confirm conditional-access prerequisites.' },
      { id: 'TASK-4', title: 'Validate starter access', team: 'Service Desk', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-3'], due: 'Before start date', instructions: 'Validate the requested services and confirm the package is ready for the starter.' },
    ],
  },
  {
    id: 'software-access',
    title: 'Software access request',
    description: 'Request a standard licensed application for an existing employee.',
    service: 'Access',
    team: 'Service Desk',
    items: [
      { id: 'CAT-SOFTWARE-STD', name: 'Standard licensed application', category: 'Software', quantity: 1, unitCost: 24, options: ['Named-user licence', 'Standard support'] },
    ],
    approvals: [
      { id: 'APPROVAL-1', label: 'Manager approval', approver: 'Line manager', status: 'Pending', updated: 'Created with request' },
    ],
    tasks: [
      { id: 'TASK-1', title: 'Validate licence availability', team: 'Service Desk', assignee: 'Unassigned', status: 'Waiting', requiresApproval: true, dependsOn: [], due: 'Within 4 hr of approval', instructions: 'Confirm licence availability and validate the requested software is on the approved catalogue.' },
      { id: 'TASK-2', title: 'Assign licence and entitlement', team: 'Service Desk', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-1'], due: '1 business day', instructions: 'Allocate the licence and apply the required entitlement group.' },
      { id: 'TASK-3', title: 'Confirm user access', team: 'Service Desk', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-2'], due: 'Within SLA', instructions: 'Confirm the user can launch and authenticate to the requested application.' },
    ],
  },
  {
    id: 'shared-mailbox',
    title: 'Shared mailbox access',
    description: 'Add an employee to an existing shared mailbox with standard access permissions.',
    service: 'Collaboration',
    team: 'Service Desk',
    items: [
      { id: 'CAT-SHARED-MAILBOX', name: 'Shared mailbox access', category: 'Access', quantity: 1, unitCost: 0, options: ['Read and send-as access'] },
    ],
    approvals: [],
    tasks: [
      { id: 'TASK-1', title: 'Validate mailbox owner approval', team: 'Service Desk', assignee: 'Hi5Central User', status: 'Ready', dependsOn: [], due: 'Within 2 hr', instructions: 'Confirm the request references the approved shared mailbox and owner.' },
      { id: 'TASK-2', title: 'Apply mailbox permissions', team: 'Collaboration', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-1'], due: 'Within 4 hr', instructions: 'Apply the requested mailbox permissions and allow time for replication.' },
      { id: 'TASK-3', title: 'Validate access with requester', team: 'Service Desk', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-2'], due: 'Within SLA', instructions: 'Confirm the mailbox is visible and the requested permissions are working.' },
    ],
  },
]

function ServiceRequestIntakeView(props) {
  return <UnifiedNewRecordForm {...props} />
}

function ProblemIntakeView(props) {
  return <UnifiedNewRecordForm {...props} />
}

function ChangeIntakeView(props) {
  return <UnifiedNewRecordForm {...props} />
}

function GenericNewRecordView({
  handleTicketSubmit,
  hasUnsavedChanges,
  recordType,
  setTicketDraft,
  ticketDraft,
}) {
  const title = {
    'Service Request': 'New Service Request',
    Problem: 'New Problem',
    Change: 'New Change',
  }[recordType] || 'New Record'

  return (
    <div className="new-record-page">
      <section className="new-record-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Create record</span>
            <h2>{title}</h2>
          </div>
          <div className="new-record-heading-status">
            {hasUnsavedChanges && <span className="draft-status">Unsaved changes</span>}
            <span className="type-chip">{recordType}</span>
          </div>
        </div>

        <form className="new-record-form" onSubmit={handleTicketSubmit}>
          <div className="form-row">
            <label>
              Priority
              <select
                value={ticketDraft.priority}
                onChange={(event) => setTicketDraft({ ...ticketDraft, priority: event.target.value })}
              >
                {priorities.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>
            <label>
              Requester
              <input
                onChange={(event) => setTicketDraft({ ...ticketDraft, requester: event.target.value })}
                placeholder="Person or team"
                value={ticketDraft.requester}
              />
            </label>
          </div>

          <label>
            Summary
            <input
              autoFocus
              onChange={(event) => setTicketDraft({ ...ticketDraft, title: event.target.value })}
              placeholder="What needs attention?"
              value={ticketDraft.title}
            />
          </label>

          <div className="form-row">
            <label>
              Service
              <select
                value={ticketDraft.service}
                onChange={(event) => setTicketDraft({ ...ticketDraft, service: event.target.value })}
              >
                {['Collaboration', 'Identity', 'Hardware', 'Network Security', 'Wireless', 'Access'].map((service) => (
                  <option key={service}>{service}</option>
                ))}
              </select>
            </label>
            <label>
              Team
              <select
                value={ticketDraft.team}
                onChange={(event) => setTicketDraft({ ...ticketDraft, team: event.target.value })}
              >
                {teams.map((team) => (
                  <option key={team}>{team}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Description
            <textarea
              onChange={(event) => setTicketDraft({ ...ticketDraft, description: event.target.value })}
              placeholder="Impact, symptoms, desired outcome"
              value={ticketDraft.description}
            />
          </label>

          <div className="new-record-actions">
            <button className="primary-action" type="submit">
              <Plus size={17} aria-hidden="true" />
              Create {recordType}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export function NewRecordView(props) {
  if (props.recordType === 'Incident') {
    return <IncidentIntakeView {...props} />
  }

  if (props.recordType === 'Service Request') {
    return <ServiceRequestIntakeView {...props} />
  }

  if (props.recordType === 'Problem') {
    return <ProblemIntakeView {...props} />
  }

  if (props.recordType === 'Change') {
    return <ChangeIntakeView {...props} />
  }

  return <GenericNewRecordView {...props} />
}

export function SelfServicePortal({
  currentUser,
  handlePortalSubmit,
  openPortalRequest,
  portalDraft,
  portalQuery,
  portalResults,
  serviceCatalog,
  setPortalDraft,
  setPortalQuery,
  tickets,
}) {
  const isRequester = currentUser?.role === 'requester' || currentUser?.profile === 'requester'
  const requesterName = isRequester ? currentUser.name : portalDraft.requester
  const requesterEmail = portalDraft.email || currentUser?.username || workspaceLoginProfiles.requester.username
  const myRequests = tickets.filter((ticket) => ticket.requester === requesterName).slice(0, 3)
  const visibleRequests = myRequests.length ? myRequests : tickets.filter((ticket) => ticket.type === 'Service Request').slice(0, 3)

  return (
    <div className="portal-view">
      <section className="portal-hero">
        <div>
          <span className="eyebrow">Self-Service Portal</span>
          <h2>Get help, request access, and track IT work in one place.</h2>
        </div>
        <label className="portal-search">
          <Search size={19} aria-hidden="true" />
          <input
            onChange={(event) => setPortalQuery(event.target.value)}
            placeholder="Search help articles or services"
            type="search"
            value={portalQuery}
          />
        </label>
      </section>

      <section className="catalog-grid">
        {serviceCatalog.map(({ title, description, icon: Icon, accent }) => (
          <button
            className={`catalog-card ${accent}`}
            key={title}
            onClick={() => setPortalDraft({ ...portalDraft, category: title, title: title === 'Report an IT Issue' ? '' : title })}
            type="button"
          >
            <Icon size={22} aria-hidden="true" />
            <strong>{title}</strong>
            <span>{description}</span>
          </button>
        ))}
      </section>

      <div className="portal-columns">
        <form className="portal-form" onSubmit={handlePortalSubmit}>
          <div className="section-heading tight">
            <div>
              <span className="eyebrow">Raise a request</span>
              <h2>Tell IT what you need</h2>
            </div>
          </div>
          <div className="form-row">
            <label>
              Name
            <input
              onChange={(event) => setPortalDraft({ ...portalDraft, requester: event.target.value })}
              placeholder="Your name"
              value={portalDraft.requester || requesterName || ''}
            />
            </label>
            <label>
              Email
              <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setPortalDraft({ ...portalDraft, email: event.target.value })}
              placeholder="you@hi5central.com"
              type="text"
              value={requesterEmail}
            />
            </label>
          </div>
          <div className="form-row">
            <label>
              Category
              <select
                onChange={(event) => setPortalDraft({ ...portalDraft, category: event.target.value })}
                value={portalDraft.category}
              >
                {serviceCatalog.map((item) => (
                  <option key={item.title}>{item.title}</option>
                ))}
              </select>
            </label>
            <label>
              Urgency
              <select
                onChange={(event) => setPortalDraft({ ...portalDraft, urgency: event.target.value })}
                value={portalDraft.urgency}
              >
                {['High', 'Medium', 'Low'].map((urgency) => (
                  <option key={urgency}>{urgency}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Summary
            <input
              onChange={(event) => setPortalDraft({ ...portalDraft, title: event.target.value })}
              placeholder="Short summary"
              value={portalDraft.title}
            />
          </label>
          <label>
            Details
            <textarea
              onChange={(event) => setPortalDraft({ ...portalDraft, description: event.target.value })}
              placeholder="What is affected, who is impacted, and when did it start?"
              value={portalDraft.description}
            />
          </label>
          <button className="primary-action" type="submit">
            <Send size={17} aria-hidden="true" />
            Submit request
          </button>
        </form>

        <section className="portal-side">
          <div>
            <div className="section-heading tight">
              <div>
                <span className="eyebrow">Knowledge</span>
                <h2>Suggested Help</h2>
              </div>
            </div>
            <div className="article-list">
              {portalResults.slice(0, 3).map((article) => (
                <article className="article-row" key={article.title}>
                  <BookOpen size={17} aria-hidden="true" />
                  <div>
                    <strong>{article.title}</strong>
                    <span>{article.category} - {article.updated}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div>
            <div className="section-heading tight">
              <div>
                <span className="eyebrow">Tracking</span>
                <h2>Recent Requests</h2>
              </div>
            </div>
            <div className="mini-request-list">
              {visibleRequests.map((ticket) => (
                <button
                  className="mini-request mini-request-button"
                  key={ticket.id}
                  onClick={() => openPortalRequest?.(ticket)}
                  type="button"
                >
                  <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
                  <strong>{ticket.title}</strong>
                  <small>{ticket.id} - {ticket.updated}</small>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export function ChangesView({ openNewRecord, openRecordTab, tickets, updateTicket }) {
  return (
    <UnifiedRecordQueue
      openNewRecord={openNewRecord}
      openRecordTab={openRecordTab}
      recordType="Change"
      tickets={tickets}
      updateTicket={updateTicket}
    />
  )
}

export function CmdbView({ assets, openAsset, tickets }) {
  return (
    <div className="cmdb-view">
      <section className="asset-grid">
        {assets.map((asset) => (
          <article className="asset-card" key={asset.name}>
            <div className="asset-icon">
              <Server size={22} aria-hidden="true" />
            </div>
            <div>
              <span className="eyebrow">{asset.className}</span>
              <h2>{asset.name}</h2>
            </div>
            <div className="asset-meta">
              <span>Owner: {asset.owner}</span>
              <span>Open incidents: {asset.incidents}</span>
            </div>
            <span className={`health-pill ${asset.health.toLowerCase().replace(/\s+/g, '-')}`}>{asset.health}</span>
            <div className="relationship-list">
              {asset.related.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <button className="text-button asset-open-button" onClick={() => openAsset(asset)} type="button">
              Open CI
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </article>
        ))}
      </section>

      <section className="operational-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Dependencies</span>
            <h2>Linked Records</h2>
          </div>
        </div>
        <div className="queue-table">
          {tickets.slice(0, 5).map((ticket) => (
            <div className="queue-row static" key={ticket.id}>
              <span className={`priority-dot ${priorityClass(ticket.priority)}`}></span>
              <span>
                <strong>{ticket.id}</strong>
                {ticket.title}
              </span>
              <span>{ticket.linkedAssets.join(', ') || 'No CI linked'}</span>
              <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}


export function CmdbRecordView({ asset, openRecordTab, tickets }) {
  const linkedTickets = tickets.filter((ticket) => ticket.linkedAssets?.includes(asset.name) || ticket.linkedAssets?.includes(asset.id))

  return (
    <div className="entity-detail-view">
      <section className="entity-detail-card">
        <div className="detail-header">
          <div>
            <span className="eyebrow">{asset.className}</span>
            <h2>{asset.name}</h2>
          </div>
          <span className={`health-pill ${asset.health.toLowerCase().replace(/\s+/g, '-')}`}>{asset.health}</span>
        </div>

        <div className="detail-grid">
          <InfoItem label="CI identifier" value={asset.id} icon={Server} />
          <InfoItem label="Owner" value={asset.owner} icon={Users} />
          <InfoItem label="Open incidents" value={asset.incidents} icon={AlertCircle} />
          <InfoItem label="Relationships" value={asset.related.length} icon={CircleGauge} />
        </div>

        <div className="record-context-block">
          <span className="eyebrow">Relationships</span>
          <div className="linked-ci-list">
            {asset.related.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="entity-related-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Operational context</span>
            <h2>Linked Records</h2>
          </div>
        </div>
        <div className="quick-record-list">
          {linkedTickets.length ? linkedTickets.map((ticket) => (
            <button key={ticket.id} onClick={() => openRecordTab(ticket)} type="button">
              <span>{ticket.id}</span>
              <strong>{ticket.title}</strong>
              <small>{ticket.status} - {ticket.team}</small>
            </button>
          )) : (
            <div className="empty-inline-state">No records are linked to this CI yet.</div>
          )}
        </div>
      </section>
    </div>
  )
}

export function KnowledgeArticleView({ article }) {
  return (
    <div className="knowledge-article-view">
      <article className="knowledge-article-card">
        <div className="knowledge-article-heading">
          <BookOpen size={24} aria-hidden="true" />
          <div>
            <span className="eyebrow">{article.category}</span>
            <h2>{article.title}</h2>
            <p>{article.updated} · {article.reads} reads</p>
          </div>
        </div>

        <p className="knowledge-summary">{article.summary}</p>

        <div className="article-steps">
          <span className="eyebrow">Guidance</span>
          <ol>
            {article.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </article>
    </div>
  )
}

export function KnowledgeView({ openArticle, portalQuery, portalResults, setPortalQuery }) {
  return (
    <div className="knowledge-view">
      <section className="portal-hero slim">
        <div>
          <span className="eyebrow">Knowledge Base</span>
          <h2>Reusable fixes, known errors, and standard request guidance.</h2>
        </div>
        <label className="portal-search">
          <Search size={19} aria-hidden="true" />
          <input
            onChange={(event) => setPortalQuery(event.target.value)}
            placeholder="Search the knowledge base"
            type="search"
            value={portalQuery}
          />
        </label>
      </section>
      <section className="knowledge-grid">
        {portalResults.map((article) => (
          <article className="knowledge-card" key={article.title}>
            <BookOpen size={20} aria-hidden="true" />
            <span className="eyebrow">{article.category}</span>
            <h2>{article.title}</h2>
            <p>{article.reads} reads - {article.updated}</p>
            <button className="text-button" onClick={() => openArticle(article)} type="button">
              Open article
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </article>
        ))}
      </section>
    </div>
  )
}

export function ReportsView({ metrics, tickets }) {
  const byType = metrics.typeCounts
  const resolution = {
    Met: tickets.filter((ticket) => ticket.sla === 'Met').length,
    Watch: tickets.filter((ticket) => ticket.slaPercent >= 60 && ticket.sla !== 'Met').length,
    Healthy: tickets.filter((ticket) => ticket.slaPercent < 60).length,
  }

  return (
    <div className="reports-view">
      <section className="report-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Performance</span>
            <h2>Service Management Snapshot</h2>
          </div>
        </div>
        <div className="metric-row">
          <MetricCard label="Total Records" value={tickets.length} detail="All active data" icon={ListChecks} tone="blue" />
          <MetricCard label="SLA Met" value={resolution.Met} detail="Resolved in target" icon={CheckCircle2} tone="blue" />
          <MetricCard label="Needs Review" value={resolution.Watch} detail="SLA pressure" icon={Clock3} tone="amber" />
        </div>
      </section>

      <section className="workload-panel wide">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Demand</span>
            <h2>Volume by Process</h2>
          </div>
        </div>
        <BarList data={byType} />
      </section>

      <section className="workload-panel wide">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Delivery</span>
            <h2>SLA Health</h2>
          </div>
        </div>
        <BarList data={resolution} palette="delivery" />
      </section>
    </div>
  )
}

function MetricCard({ label, value, detail, icon: Icon, tone }) {
  return (
    <article className={`metric-card ${tone}`}>
      <Icon size={21} aria-hidden="true" />
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        <small>{detail}</small>
      </div>
    </article>
  )
}

function FilterSelect({ label, options, value, onChange }) {
  return (
    <label>
      {label}
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function InfoItem({ label, value, icon: Icon }) {
  return (
    <div className="info-item">
      <Icon size={17} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SlaBar({ value, label }) {
  return (
    <span className="sla-bar" aria-label={`SLA ${label}`}>
      <span style={{ width: `${Math.min(value, 100)}%` }}></span>
      <small>{label}</small>
    </span>
  )
}

function BarList({ data, palette = 'default' }) {
  const entries = Object.entries(data)
  const max = Math.max(...entries.map(([, value]) => value), 1)

  return (
    <div className={`bar-list ${palette}`}>
      {entries.map(([label, value]) => (
        <div className="bar-row" key={label}>
          <span>{label}</span>
          <div className="bar-track">
            <span style={{ width: `${(value / max) * 100}%` }}></span>
          </div>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  )
}

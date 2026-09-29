import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { exportRecordDocument } from '../lib/recordExportPremium.js'
import { fetchProductionServiceRequest } from '../services/productionServiceRequests.js'
import { ProductionRecordExportMenu } from './ProductionRecordExportMenu.jsx'

const API_BASE = window.__HI5_API_BASE__
const LIST_STATE_PREFIX = 'hi5central-record-list-state-v3'
const COLUMN_STATE_KEY = 'hi5central-record-columns-v3'
const SELECTION_PREFIX = 'hi5central-record-selection-v1'
const SELECTION_EVENT = 'hi5-record-selection-changed'
const LISTS = {
  incidents: { type: 'Incident', title: 'Incidents' },
  requests: { type: 'Service Request', title: 'Service Requests' },
  problems: { type: 'Problem', title: 'Problems' },
  changes: { type: 'Change', title: 'Changes' },
}
const COLUMNS = {
  reference: ['Reference', (record) => record.id],
  summary: ['Summary', (record) => record.title],
  priority: ['Priority / risk', (record) => record.priority],
  status: ['Status', (record) => record.status],
  requester: ['Requester', (record) => record.requester],
  service: ['Service', (record) => record.service],
  assignment: ['Assignment', (record) => [record.team, record.assignee].filter(Boolean).join(' / ')],
  updated: ['Updated', (record) => formatDate(record.updatedAt)],
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function readJson(storage, key, fallback) {
  try {
    const value = storage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function contextFor(pathname = window.location.pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean)
  if (parts.length === 1 && LISTS[parts[0]]) return { kind: 'list', section: parts[0], ...LISTS[parts[0]] }
  if (parts.length === 2 && LISTS[parts[0]] && parts[1].toLowerCase() !== 'new') {
    return { kind: 'detail', section: parts[0], reference: decodeURIComponent(parts[1]), ...LISTS[parts[0]] }
  }
  return null
}

function selectionKey(type) {
  return `${SELECTION_PREFIX}:${type}`
}

function selectedIdsFor(type) {
  const value = readJson(window.sessionStorage, selectionKey(type), [])
  return Array.isArray(value) ? value.filter(Boolean) : []
}

async function apiJson(path) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Export data could not be loaded.')
  return payload
}

function listParams(context, state, limit, offset) {
  const params = new URLSearchParams({ type: context.type, limit: String(limit), offset: String(offset) })
  if (state.query?.trim()) params.set('search', state.query.trim())
  const filters = state.filters || {}
  for (const key of ['status', 'priority', 'team', 'assignee', 'service']) {
    const value = filters[key]
    if (value && value !== 'All') params.set(key, value)
  }
  return params
}

async function fetchWholeQueue(context, state) {
  const records = []
  let offset = 0
  let total = Infinity
  while (offset < total && records.length < 10000) {
    const response = await apiJson(`/api/v1/itsm-queue?${listParams(context, state, 100, offset)}`)
    const items = Array.isArray(response.items) ? response.items : []
    records.push(...items)
    total = Number(response.total || items.length)
    if (!items.length) break
    offset += items.length
  }
  return records
}

async function recordsForScope(context, currentState, scope, selectedIds) {
  if (scope === 'selected') {
    const selected = new Set(selectedIds)
    if (!selected.size) return []
    const records = await fetchWholeQueue(context, { query: '', filters: {} })
    return records.filter((record) => selected.has(record.id))
  }
  if (scope === 'all') return fetchWholeQueue(context, { query: '', filters: {} })
  return fetchWholeQueue(context, currentState)
}

function currentColumns(context) {
  const stored = readJson(window.localStorage, COLUMN_STATE_KEY, {})?.[context.type] || {}
  const order = Array.isArray(stored.order) && stored.order.length ? stored.order : Object.keys(COLUMNS)
  const hidden = new Set(Array.isArray(stored.hidden) ? stored.hidden : [])
  return order.filter((key) => COLUMNS[key] && (key === 'reference' || !hidden.has(key)))
}

function listDocument(context, records, state, scope) {
  const keys = currentColumns(context)
  const filters = state.filters || {}
  const scopeLabel = scope === 'selected' ? 'Selected records' : scope === 'all' ? 'All records' : 'Current view'
  const filterSummary = scope === 'current' ? [
    state.query ? `Search: ${state.query}` : '',
    ...['status', 'priority', 'team', 'assignee', 'service'].map((key) => filters[key] && filters[key] !== 'All' ? `${key}: ${filters[key]}` : ''),
  ].filter(Boolean).join(' · ') : ''
  return {
    title: `${context.title} export`,
    subtitle: `${scopeLabel} · ${records.length} record${records.length === 1 ? '' : 's'}${filterSummary ? ` · ${filterSummary}` : ''}`,
    sections: [{
      title: context.title,
      type: 'table',
      columns: keys.map((key) => COLUMNS[key][0]),
      rows: records.map((record) => keys.map((key) => COLUMNS[key][1](record) || '')),
    }],
  }
}

function genericDetailDocument(context, detail, tasks) {
  const activities = Array.isArray(detail.activities) ? detail.activities : []
  const relationships = Array.isArray(detail.relationships) ? detail.relationships : []
  const attachments = Array.isArray(detail.attachments) ? detail.attachments : []
  return {
    title: `${detail.id || context.reference} · ${detail.title || context.type}`,
    subtitle: `${context.type} exported ${formatDate(new Date())}`,
    sections: [
      {
        title: 'Record details', type: 'fields', rows: [
          ['Reference', detail.id || context.reference], ['Summary', detail.title], ['Status', detail.status], ['Priority', detail.priority],
          ['Requester', detail.requester], ['Requester email', detail.requesterEmail], ['Service', detail.service], ['Category', detail.category],
          ['Assignment group', detail.team], ['Assignee', detail.assignee], ['Impact', detail.impact], ['Urgency', detail.urgency],
          ['Resolution code', detail.resolutionCode], ['Resolution summary', detail.resolutionSummary], ['Updated', formatDate(detail.updatedAt)],
        ].filter((row) => row[1] !== undefined && row[1] !== null && String(row[1]).trim()),
      },
      {
        title: 'Activity', type: 'table', columns: ['Date', 'Actor', 'Type', 'Visibility', 'Update'],
        rows: activities.map((item) => [formatDate(item.createdAt), item.actor || 'Hi5Central', item.kind || 'Update', item.visibility || '', item.text || item.metadata?.richHtml || '']),
      },
      {
        title: 'Tasks', type: 'table', columns: ['Task', 'Status', 'Team', 'Assignee', 'Due'],
        rows: (tasks || []).map((task) => [task.title || task.id, task.status, task.team || '', task.assignee || '', formatDate(task.dueAt)]),
      },
      {
        title: 'Relationships', type: 'table', columns: ['Relationship', 'Reference', 'Type', 'Summary'],
        rows: relationships.map((item) => [item.relationshipType || item.type || '', item.reference || item.targetReference || '', item.recordType || '', item.title || '']),
      },
      {
        title: 'Attachments', type: 'table', columns: ['File', 'Type', 'Size', 'Uploaded by'],
        rows: attachments.map((item) => [item.fileName || item.name, item.mimeType || item.type || '', item.byteSize || item.size || '', item.uploadedBy || '']),
      },
    ].filter((section) => section.type === 'fields' || section.rows.length),
  }
}

function serviceRequestDocument(context, detail) {
  const activities = Array.isArray(detail.activities) ? detail.activities : []
  const answers = Array.isArray(detail.requestInformation) ? detail.requestInformation : []
  const items = Array.isArray(detail.requestedItems) ? detail.requestedItems : []
  const approvals = Array.isArray(detail.requestApprovals) ? detail.requestApprovals : []
  const tasks = Array.isArray(detail.requestTasks) ? detail.requestTasks : []
  return {
    title: `${detail.id || context.reference} · ${detail.title || 'Service Request'}`,
    subtitle: `Service Request exported ${formatDate(new Date())}`,
    sections: [
      { title: 'Request details', type: 'fields', rows: [
        ['Reference', detail.id || context.reference], ['Summary', detail.title], ['Description', detail.description], ['Status', detail.status], ['Priority', detail.priority],
        ['Requester', detail.requester], ['Requester email', detail.requesterEmail], ['Service', detail.service], ['Catalogue item', detail.catalogueItemTitle],
        ['Assignment group', detail.team], ['Assignee', detail.assignee], ['One-off cost', detail.oneOffCost], ['Monthly cost', detail.monthlyCost], ['Currency', detail.currency],
        ['Created', formatDate(detail.createdAt)], ['Updated', formatDate(detail.updatedAt)],
      ].filter((row) => row[1] !== undefined && row[1] !== null && String(row[1]).trim()) },
      { title: 'Submitted information', type: 'table', columns: ['Question', 'Answer'], rows: answers.map((item) => [item.label, item.value]) },
      { title: 'Requested items', type: 'table', columns: ['Item', 'Category', 'Qty', 'One-off', 'Monthly'], rows: items.map((item) => [item.name, item.category, item.quantity || 1, item.unitOneOffCost || 0, item.unitMonthlyCost || 0]) },
      { title: 'Approvals', type: 'table', columns: ['Approval', 'Status', 'Approver', 'Decision note'], rows: approvals.map((item) => [item.label, item.status, item.approver || item.approverName || '', item.decisionNote || '']) },
      { title: 'Tasks', type: 'table', columns: ['Task', 'Status', 'Team', 'Assignee', 'Due'], rows: tasks.map((item) => [item.title, item.status, item.team || '', item.assignee || '', formatDate(item.dueAt)]) },
      { title: 'Activity', type: 'table', columns: ['Date', 'Actor', 'Type', 'Visibility', 'Update'], rows: activities.map((item) => [formatDate(item.createdAt), item.actor || 'Hi5Central', item.kind || 'Update', item.visibility || '', item.text || '']) },
    ].filter((section) => section.type === 'fields' || section.rows.length),
  }
}

async function documentFor(context, scope, selectedIds) {
  if (context.kind === 'list') {
    const state = readJson(window.sessionStorage, `${LIST_STATE_PREFIX}:${context.type}`, { query: '', filters: {} })
    const records = await recordsForScope(context, state, scope, selectedIds)
    return {
      model: listDocument(context, records, state, scope),
      fileName: `${context.section}-${scope}-${new Date().toISOString().slice(0, 10)}`,
    }
  }

  if (context.type === 'Service Request') {
    const detail = await fetchProductionServiceRequest(context.reference)
    return { model: serviceRequestDocument(context, detail), fileName: context.reference }
  }

  const [detail, taskPayload] = await Promise.all([
    apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(context.reference)}`),
    apiJson(`/api/v1/itsm-actions/${encodeURIComponent(context.reference)}/tasks`).catch(() => ({ tasks: [] })),
  ])
  return { model: genericDetailDocument(context, detail, taskPayload.tasks || []), fileName: context.reference }
}

export function ProductionRecordExportEnhancer() {
  const [context, setContext] = useState(() => contextFor())
  const [target, setTarget] = useState(null)
  const [selectedIds, setSelectedIds] = useState(() => {
    const initial = contextFor()
    return initial?.kind === 'list' ? selectedIdsFor(initial.type) : []
  })

  useEffect(() => {
    const update = () => setContext(contextFor())
    window.addEventListener('popstate', update)
    window.addEventListener('hi5-routechange', update)
    const timer = window.setInterval(update, 500)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener('hi5-routechange', update)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    setSelectedIds(context?.kind === 'list' ? selectedIdsFor(context.type) : [])
    const handleSelection = (event) => {
      if (context?.kind !== 'list' || event.detail?.type !== context.type) return
      setSelectedIds(Array.isArray(event.detail.ids) ? event.detail.ids : [])
    }
    window.addEventListener(SELECTION_EVENT, handleSelection)
    return () => window.removeEventListener(SELECTION_EVENT, handleSelection)
  }, [context?.kind, context?.type])

  useEffect(() => {
    setTarget(null)
    if (!context) return undefined
    const selector = context.kind === 'list' ? '.production-record-toolbar' : '.activity-canvas-commands'
    let observer = null
    const attach = () => {
      const node = document.querySelector(selector)
      if (!(node instanceof HTMLElement)) return false
      setTarget(node)
      return true
    }
    if (!attach()) {
      observer = new MutationObserver(() => {
        if (attach()) observer?.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    }
    return () => observer?.disconnect()
  }, [context?.kind, context?.section, context?.reference])

  const key = useMemo(() => context ? `${context.kind}:${context.section}:${context.reference || ''}` : 'none', [context])
  if (!context || !target) return null

  async function onExport(format, scope = 'record') {
    const output = await documentFor(context, scope, selectedIds)
    await exportRecordDocument(output.model, format, output.fileName)
  }

  return createPortal(
    <ProductionRecordExportMenu
      key={key}
      onExport={onExport}
      compact={context.kind === 'detail'}
      className="hi5-record-export-mounted"
      listMode={context.kind === 'list'}
      selectedCount={selectedIds.length}
    />,
    target,
  )
}

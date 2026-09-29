import { fetchProductionServiceRequests, serviceRequestForWorkspace } from './productionServiceRequests.js'

const API_BASE = window.__HI5_API_BASE__
const TICKETS_KEY = 'hi5central-tickets'

function formatDate(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'The ITSM record operation failed.')
  return payload
}

export function itsmRecordForWorkspace(record) {
  const activities = Array.isArray(record.activities) ? record.activities : []
  return {
    ...record,
    created: formatDate(record.createdAt),
    updated: formatDate(record.updatedAt),
    sla: record.sla || (record.type === 'Incident' ? 'Not yet calculated' : '—'),
    slaPercent: Number(record.slaPercent || 0),
    nextStep: record.nextStep || (record.status === 'Closed' ? 'Record closed.' : 'Review and progress this record.'),
    comments: Array.isArray(record.comments) ? record.comments : [],
    activities: activities.map((activity) => ({
      ...activity,
      createdAtLabel: formatDate(activity.createdAt),
    })),
    attachments: Array.isArray(record.attachments) ? record.attachments : [],
    linkedAssets: Array.isArray(record.linkedAssets) ? record.linkedAssets : [],
    persistence: 'api',
    source: record.source || 'production-api',
  }
}

async function fetchAllGenericRecords() {
  const items = []
  let offset = 0
  const limit = 200
  for (;;) {
    const payload = await apiJson(`/api/v1/itsm-records?limit=${limit}&offset=${offset}`)
    const batch = Array.isArray(payload.items) ? payload.items : []
    items.push(...batch)
    if (batch.length < limit || items.length >= Number(payload.total || 0)) break
    offset += limit
  }
  return items
}

export async function fetchProductionItsmWorkspaceRecords() {
  const [serviceRequests, genericRecords] = await Promise.all([
    fetchProductionServiceRequests(),
    fetchAllGenericRecords(),
  ])
  return [
    ...serviceRequests.map(serviceRequestForWorkspace),
    ...genericRecords.map(itsmRecordForWorkspace),
  ]
}

export function cacheProductionItsmWorkspaceRecords(records) {
  const next = Array.isArray(records) ? records : []
  window.localStorage.setItem(TICKETS_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('hi5-production-itsm-hydrated', { detail: { tickets: next } }))
  return next
}

export async function hydrateProductionItsmWorkspaceRecords() {
  const records = await fetchProductionItsmWorkspaceRecords()
  return cacheProductionItsmWorkspaceRecords(records)
}

export async function fetchProductionItsmRecord(reference) {
  return itsmRecordForWorkspace(await apiJson(`/api/v1/itsm-records/${encodeURIComponent(reference)}`))
}

export async function createProductionItsmRecord(ticket) {
  const created = await apiJson('/api/v1/itsm-records', {
    method: 'POST',
    body: JSON.stringify(ticket),
  })
  return itsmRecordForWorkspace(created)
}

export async function patchProductionItsmRecord(reference, updates) {
  const payload = await apiJson(`/api/v1/itsm-records/${encodeURIComponent(reference)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
  return itsmRecordForWorkspace(payload)
}

export async function addProductionItsmActivity(reference, activity) {
  const payload = await apiJson(`/api/v1/itsm-records/${encodeURIComponent(reference)}/activities`, {
    method: 'POST',
    body: JSON.stringify({
      kind: activity.kind || 'work',
      text: activity.text || '',
      metadata: activity.metadata || {},
    }),
  })
  return itsmRecordForWorkspace(payload)
}

function mutableData(ticket) {
  const excluded = new Set([
    'id','databaseId','type','title','description','requester','requesterId','requesterEmail','requesterJobTitle',
    'requesterDepartment','requesterLocation','location','service','category','priority','status','team','assignee',
    'created','updated','createdAt','updatedAt','closedAt','source','persistence','activities','comments',
  ])
  return Object.fromEntries(Object.entries(ticket || {}).filter(([key]) => !excluded.has(key)))
}

function fingerprint(ticket) {
  if (!ticket) return ''
  return JSON.stringify({
    title: ticket.title || '',
    description: ticket.description || '',
    service: ticket.service || '',
    category: ticket.category || '',
    priority: ticket.priority || '',
    status: ticket.status || '',
    team: ticket.team || '',
    assignee: ticket.assignee || '',
    data: mutableData(ticket),
    activities: (ticket.activities || []).map((activity) => ({ id: activity.id, kind: activity.kind, text: activity.text || '' })),
  })
}

export async function synchroniseProductionItsmRecordSnapshot(previous, next) {
  if (!next || !['Incident', 'Problem', 'Change'].includes(next.type)) return null

  if (!previous || previous.persistence !== 'api') {
    const created = await createProductionItsmRecord(next)
    cacheProductionItsmWorkspaceRecords([
      created,
      ...JSON.parse(window.localStorage.getItem(TICKETS_KEY) || '[]').filter((item) => item.id !== next.id),
    ])
    return created
  }

  if (fingerprint(previous) === fingerprint(next)) return null

  const updates = {
    title: next.title,
    description: next.description,
    service: next.service,
    category: next.category,
    priority: next.priority,
    status: next.status,
    team: next.team,
    assignee: next.assignee,
    recordData: mutableData(next),
  }
  const priorActivityIds = new Set((previous.activities || []).map((activity) => activity.id))
  const additions = (next.activities || []).filter((activity) => activity?.id && !priorActivityIds.has(activity.id) && activity.text)

  let reconciled = await patchProductionItsmRecord(previous.id, updates)
  for (const activity of additions) reconciled = await addProductionItsmActivity(previous.id, activity)
  return reconciled
}

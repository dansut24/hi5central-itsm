const API_BASE = window.__HI5_API_BASE__
const TICKETS_KEY = 'hi5central-tickets'

function readJson(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function formatDate(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function nextStepFor(status) {
  if (status === 'Pending Approval') return 'Waiting for approval'
  if (status === 'Approved') return 'Approval complete. Fulfilment can begin.'
  if (status === 'Rejected') return 'Approval was rejected'
  if (status === 'Completed' || status === 'Closed') return 'Request completed'
  if (status === 'In Progress') return 'Fulfilment is in progress'
  return 'Service Desk review and fulfilment'
}

function activityForUi(activity) {
  return {
    ...activity,
    created: formatDate(activity.createdAt),
    createdAtLabel: formatDate(activity.createdAt),
  }
}

function mergeOperationalState(request, state) {
  if (!state) return request
  return {
    ...request,
    status: state.status || request.status,
    priority: state.priority || request.priority,
    assignee: state.assignee || 'Unassigned',
    assigneeId: state.assigneeId || '',
    assigneeEmail: state.assigneeEmail || '',
    operationalData: state.operationalData || {},
    updatedAt: state.updatedAt || request.updatedAt,
  }
}

export function serviceRequestForWorkspace(request) {
  return {
    id: request.id,
    databaseId: request.databaseId,
    type: 'Service Request',
    title: request.title,
    description: request.description || '',
    descriptionHtml: request.descriptionHtml || '',
    requester: request.requester || '',
    requesterEmail: request.requesterEmail || '',
    requesterJobTitle: request.requesterJobTitle || '',
    requesterDepartment: request.requesterDepartment || '',
    requesterSite: request.requesterSite || '',
    service: request.service || 'Service Catalogue',
    team: request.team || 'Unassigned',
    assignee: request.assignee || 'Unassigned',
    assigneeId: request.assigneeId || '',
    assigneeEmail: request.assigneeEmail || '',
    priority: request.priority || 'Medium',
    status: request.status || 'New',
    created: formatDate(request.createdAt),
    updated: formatDate(request.updatedAt),
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    sla: request.status === 'Pending Approval' ? 'Paused for approval' : 'Not yet calculated',
    slaPercent: 0,
    nextStep: nextStepFor(request.status),
    catalogueItemId: request.catalogueItemId || '',
    catalogueItemTitle: request.catalogueItemTitle || '',
    requestInformation: Array.isArray(request.requestInformation) ? request.requestInformation : [],
    submittedFields: request.submittedFields || {},
    requestedItems: Array.isArray(request.requestedItems) ? request.requestedItems : [],
    requestApprovals: Array.isArray(request.requestApprovals) ? request.requestApprovals : [],
    requestTasks: Array.isArray(request.requestTasks) ? request.requestTasks : [],
    activities: Array.isArray(request.activities) ? request.activities.map(activityForUi) : [],
    comments: [],
    attachments: [],
    oneOffCost: Number(request.oneOffCost || 0),
    monthlyCost: Number(request.monthlyCost || 0),
    currency: request.currency || 'GBP',
    approvalMode: request.approvalMode || 'none',
    approvalThreshold: request.approvalThreshold,
    workflow: request.workflow || '',
    completionNotes: request.operationalData?.completionNotes || '',
    reopenReason: request.operationalData?.reopenReason || '',
    approvalNote: request.operationalData?.approvalNote || '',
    source: 'production-api',
    persistence: 'api',
  }
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
  if (!response.ok) throw new Error(payload.error || 'The Service Request operation failed.')
  return payload
}

export async function fetchProductionServiceRequests() {
  const [payload, statePayload] = await Promise.all([
    apiJson('/api/v1/service-requests?limit=200'),
    apiJson('/api/v1/service-request-state'),
  ])
  const states = new Map((statePayload.items || []).map((state) => [state.reference, state]))
  return (Array.isArray(payload.items) ? payload.items : []).map((request) => mergeOperationalState(request, states.get(request.id)))
}

export async function fetchProductionServiceRequest(reference) {
  const encoded = encodeURIComponent(reference)
  const [request, state] = await Promise.all([
    apiJson(`/api/v1/service-requests/${encoded}`),
    apiJson(`/api/v1/service-request-state/${encoded}`),
  ])
  return mergeOperationalState(request, state)
}

export function cacheProductionServiceRequests(requests) {
  const apiTickets = requests.map(serviceRequestForWorkspace)
  const stored = readJson(TICKETS_KEY, null)
  const base = Array.isArray(stored) ? stored : []
  const nonServiceRequests = base.filter((ticket) => ticket.type !== 'Service Request')
  const next = [...apiTickets, ...nonServiceRequests]
  window.localStorage.setItem(TICKETS_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('hi5-service-requests-hydrated', { detail: { requests: apiTickets } }))
  return next
}

export function cacheProductionServiceRequest(request) {
  const ticket = serviceRequestForWorkspace(request)
  const stored = readJson(TICKETS_KEY, [])
  const base = Array.isArray(stored) ? stored : []
  const next = base.some((item) => item.id === ticket.id)
    ? base.map((item) => item.id === ticket.id ? ticket : item)
    : [ticket, ...base]
  window.localStorage.setItem(TICKETS_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('hi5-service-request-reconciled', { detail: { ticket } }))
  return ticket
}

export async function reconcileProductionServiceRequest(reference) {
  const request = await fetchProductionServiceRequest(reference)
  return cacheProductionServiceRequest(request)
}

export async function hydrateProductionServiceRequests() {
  const requests = await fetchProductionServiceRequests()
  cacheProductionServiceRequests(requests)
  return requests
}

export async function createProductionServiceRequest(payload) {
  return apiJson('/api/v1/service-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function patchProductionServiceRequest(reference, updates) {
  return apiJson(`/api/v1/service-requests/${encodeURIComponent(reference)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export async function transitionProductionServiceRequest(reference, targetStatus, values = {}) {
  await apiJson(`/api/v1/service-requests/${encodeURIComponent(reference)}/transition`, {
    method: 'POST',
    body: JSON.stringify({ targetStatus, values }),
  })
  return reconcileProductionServiceRequest(reference)
}

export async function addProductionServiceRequestActivity(reference, activity) {
  await apiJson(`/api/v1/service-requests/${encodeURIComponent(reference)}/activities`, {
    method: 'POST',
    body: JSON.stringify({
      kind: activity.kind === 'work' ? 'work' : 'customer',
      text: activity.text || '',
      html: activity.html || '',
      attachments: Array.isArray(activity.attachments) ? activity.attachments : [],
    }),
  })
}

export async function patchProductionServiceRequestTask(reference, taskKey, updates) {
  await apiJson(`/api/v1/service-requests/${encodeURIComponent(reference)}/tasks/${encodeURIComponent(taskKey)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export async function decideProductionServiceRequestApproval(reference, approvalId, decision, note = '') {
  await apiJson(`/api/v1/service-requests/${encodeURIComponent(reference)}/approvals/${encodeURIComponent(approvalId)}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision, note }),
  })
  return reconcileProductionServiceRequest(reference)
}

function taskDelta(before, after) {
  const updates = {}
  if (before?.status !== after?.status) updates.status = after?.status
  if (before?.team !== after?.team) updates.team = after?.team || ''
  if (before?.assignee !== after?.assignee) updates.assignee = after?.assignee || ''
  if ((before?.completionNotes || '') !== (after?.completionNotes || '')) updates.completionNotes = after?.completionNotes || ''
  return updates
}

export async function synchroniseProductionServiceRequestDelta(previous, updates) {
  if (!previous || previous.type !== 'Service Request' || previous.persistence !== 'api') return null

  const operations = []
  const fieldUpdates = {}
  if (Object.prototype.hasOwnProperty.call(updates, 'priority') && updates.priority !== previous.priority) fieldUpdates.priority = updates.priority
  if (Object.prototype.hasOwnProperty.call(updates, 'team') && updates.team !== previous.team) fieldUpdates.team = updates.team || ''
  if (Object.prototype.hasOwnProperty.call(updates, 'assignee') && updates.assignee !== previous.assignee) fieldUpdates.assignee = updates.assignee || ''
  if (Object.keys(fieldUpdates).length) operations.push(patchProductionServiceRequest(previous.id, fieldUpdates))

  if (Array.isArray(updates.activities)) {
    const priorIds = new Set((previous.activities || []).map((activity) => activity.id))
    const additions = updates.activities.filter((activity) => activity?.id && !priorIds.has(activity.id))
    for (const activity of additions) operations.push(addProductionServiceRequestActivity(previous.id, activity))
  }

  if (Array.isArray(updates.requestTasks)) {
    const priorTasks = new Map((previous.requestTasks || []).map((task) => [task.id, task]))
    for (const task of updates.requestTasks) {
      const before = priorTasks.get(task.id)
      if (!before) continue
      const delta = taskDelta(before, task)
      if (Object.keys(delta).length) operations.push(patchProductionServiceRequestTask(previous.id, task.id, delta))
    }
  }

  if (!operations.length) return null
  try {
    await Promise.all(operations)
    return await reconcileProductionServiceRequest(previous.id)
  } catch (error) {
    window.dispatchEvent(new CustomEvent('hi5-service-requests-sync-error', {
      detail: { reference: previous.id, message: error.message },
    }))
    try {
      return await reconcileProductionServiceRequest(previous.id)
    } catch {
      throw error
    }
  }
}

export async function synchroniseProductionServiceRequestSnapshot(previous, next) {
  if (!previous || !next || previous.id !== next.id || previous.persistence !== 'api' || next.type !== 'Service Request') return null

  let reconciled = null
  try {
    if (previous.status !== next.status) {
      const values = {
        approvalConfirmation: next.status === 'Approved'
          ? (next.requestApprovals || []).every((approval) => approval.status !== 'Pending')
          : undefined,
        approvalNote: next.approvalNote || '',
        completionNotes: next.completionNotes || '',
        reopenReason: next.reopenReason || '',
      }
      reconciled = await transitionProductionServiceRequest(previous.id, next.status, values)
    }

    const deltaResult = await synchroniseProductionServiceRequestDelta(previous, next)
    if (deltaResult) reconciled = deltaResult
    return reconciled
  } catch (error) {
    window.dispatchEvent(new CustomEvent('hi5-service-requests-sync-error', {
      detail: { reference: previous.id, message: error.message },
    }))
    try {
      return await reconcileProductionServiceRequest(previous.id)
    } catch {
      throw error
    }
  }
}

import { synchroniseProductionServiceRequestSnapshot } from './productionServiceRequests.js'
import { synchroniseProductionItsmRecordSnapshot } from './productionItsmRecords.js'

const PRODUCTION_SESSION_KEY = 'hi5central-production-session-v1'
const RUNTIME_BOUNDARY_KEY = 'hi5central-production-runtime-boundary-v1'
const RUNTIME_BOUNDARY_VERSION = '2026-09-12'
const API_BASE = window.__HI5_API_BASE__
const serviceRequestSyncQueues = new Map()
const itsmRecordSyncQueues = new Map()

function readJson(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* best effort */ }
}

function removeKey(key) {
  try { window.localStorage.removeItem(key) } catch { /* best effort */ }
}

function isLegacyOrganisationRecord(item) {
  return /^(?:AGT|USR|TEAM|DEPT)-/i.test(String(item?.id || ''))
}

function enforceProductionRuntimeBoundary() {
  if (readJson(RUNTIME_BOUNDARY_KEY, '') === RUNTIME_BOUNDARY_VERSION) return

  // One-time cleanup of the historical browser stores. Canonical
  // tenant data is rehydrated from PostgreSQL/API state after authentication.
  for (const key of [
    'hi5central-session',
    'lsl-itsm-session',
    'lsl-itsm-tickets',
    'hi5central-portal-session',
    'hi5central-rmm-session',
    'hi5central-projects-v1',
    'hi5central-rota-v1',
    'hi5central-calendar-v1',
    'hi5central-live-chat-conversations-v1',
    'hi5central-notifications-v1',
    'hi5central-organisation-sites-v1',
  ]) removeKey(key)

  const tickets = readJson('hi5central-tickets', [])
  writeJson(
    'hi5central-tickets',
    Array.isArray(tickets) ? tickets.filter((ticket) => ticket?.persistence === 'api') : [],
  )

  for (const key of [
    'hi5central-organisation-people-v1',
    'hi5central-organisation-teams-v1',
    'hi5central-organisation-departments-v1',
  ]) {
    const current = readJson(key, [])
    writeJson(key, Array.isArray(current) ? current.filter((item) => !isLegacyOrganisationRecord(item)) : [])
  }

  writeJson(RUNTIME_BOUNDARY_KEY, RUNTIME_BOUNDARY_VERSION)
}

enforceProductionRuntimeBoundary()

function productionOrganisationEnabled() {
  const session = readJson(PRODUCTION_SESSION_KEY, null)
  return Boolean(session?.source === 'production' && session?.tenantSlug)
}

function productionServiceRequestsEnabled() {
  const session = readJson(PRODUCTION_SESSION_KEY, null)
  return Boolean(session?.source === 'production' && session?.role === 'analyst' && session?.tenantSlug)
}

function productionItsmEnabled() {
  return productionServiceRequestsEnabled()
}

function serviceRequestMutableFingerprint(ticket) {
  if (!ticket) return ''
  return JSON.stringify({
    status: ticket.status || '', priority: ticket.priority || '', team: ticket.team || '', assignee: ticket.assignee || '',
    approvalNote: ticket.approvalNote || '', completionNotes: ticket.completionNotes || '', reopenReason: ticket.reopenReason || '',
    requestApprovals: (ticket.requestApprovals || []).map((approval) => ({ id: approval.id, status: approval.status, decisionNote: approval.decisionNote || '' })),
    requestTasks: (ticket.requestTasks || []).map((task) => ({ id: task.id, status: task.status, team: task.team || '', assignee: task.assignee || '', completionNotes: task.completionNotes || '' })),
    activities: (ticket.activities || []).map((activity) => ({
      id: activity.id, kind: activity.kind, text: activity.text || '', html: activity.html || '',
      attachments: (activity.attachments || []).map((attachment) => ({ id: attachment.id, name: attachment.name, size: attachment.size, type: attachment.type })),
    })),
  })
}

function queueServiceRequestSync(previous, next) {
  if (!productionServiceRequestsEnabled()) return
  if (!previous || !next || previous.id !== next.id) return
  if (previous.type !== 'Service Request' || previous.persistence !== 'api') return
  if (serviceRequestMutableFingerprint(previous) === serviceRequestMutableFingerprint(next)) return
  const priorQueue = serviceRequestSyncQueues.get(next.id) || Promise.resolve()
  const job = priorQueue.catch(() => {})
    .then(() => synchroniseProductionServiceRequestSnapshot(previous, next))
    .then((reconciled) => {
      if (reconciled && serviceRequestMutableFingerprint(reconciled) !== serviceRequestMutableFingerprint(next)) window.setTimeout(() => window.location.reload(), 80)
    })
    .catch((error) => {
      console.error(`Service Request ${next.id} synchronisation failed`, error)
      window.dispatchEvent(new CustomEvent('hi5-service-requests-sync-error', { detail: { reference: next.id, message: error.message } }))
      window.setTimeout(() => window.location.reload(), 120)
    })
    .finally(() => { if (serviceRequestSyncQueues.get(next.id) === job) serviceRequestSyncQueues.delete(next.id) })
  serviceRequestSyncQueues.set(next.id, job)
}

function genericRecordFingerprint(ticket) {
  if (!ticket) return ''
  const clone = { ...ticket }
  for (const key of ['created', 'updated', 'createdAt', 'updatedAt', 'databaseId']) delete clone[key]
  return JSON.stringify(clone)
}

function queueItsmRecordSync(previous, next) {
  if (!productionItsmEnabled()) return
  if (!next || !['Incident', 'Problem', 'Change'].includes(next.type)) return
  if (previous && previous.id !== next.id) return
  if (previous && genericRecordFingerprint(previous) === genericRecordFingerprint(next)) return
  const queueKey = previous?.id || next.id
  const priorQueue = itsmRecordSyncQueues.get(queueKey) || Promise.resolve()
  const job = priorQueue.catch(() => {})
    .then(() => synchroniseProductionItsmRecordSnapshot(previous, next))
    .then((reconciled) => { if (reconciled) window.setTimeout(() => window.location.reload(), 90) })
    .catch((error) => {
      console.error(`${next.type} ${next.id} synchronisation failed`, error)
      window.dispatchEvent(new CustomEvent('hi5-itsm-record-sync-error', { detail: { reference: next.id, message: error.message } }))
      window.setTimeout(() => window.location.reload(), 140)
    })
    .finally(() => { if (itsmRecordSyncQueues.get(queueKey) === job) itsmRecordSyncQueues.delete(queueKey) })
  itsmRecordSyncQueues.set(queueKey, job)
}

export async function syncOrganisationCollection(collection, items) {
  if (!productionOrganisationEnabled()) return null
  try {
    const response = await fetch(`${API_BASE}/api/v1/organisation/${encodeURIComponent(collection)}`, {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: Array.isArray(items) ? items : [] }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || `Could not save Organisation ${collection}.`)
    window.dispatchEvent(new CustomEvent('hi5-organisation-synchronised', { detail: { collection, snapshot: payload } }))
    return payload
  } catch (error) {
    console.error(`Organisation ${collection} synchronisation failed`, error)
    window.dispatchEvent(new CustomEvent('hi5-organisation-sync-error', { detail: { collection, message: error.message } }))
    return null
  }
}

export function loadTickets() {
  if (!productionItsmEnabled()) return []
  const stored = readJson('hi5central-tickets', [])
  return Array.isArray(stored) ? stored.filter((ticket) => ticket?.persistence === 'api') : []
}
export function loadOrganisationPeople() { const value = readJson('hi5central-organisation-people-v1', []); return Array.isArray(value) ? value.filter((item) => !isLegacyOrganisationRecord(item)) : [] }
export function loadOrganisationTeams() { const value = readJson('hi5central-organisation-teams-v1', []); return Array.isArray(value) ? value.filter((item) => !isLegacyOrganisationRecord(item)) : [] }
export function loadOrganisationDepartments() { const value = readJson('hi5central-organisation-departments-v1', []); return Array.isArray(value) ? value.filter((item) => !isLegacyOrganisationRecord(item)) : [] }
export function loadOrganisationAudit() { const value = readJson('hi5central-organisation-audit-v1', []); return Array.isArray(value) ? value : [] }
export function loadProjects() { const value = readJson('hi5central-projects-v1', []); return Array.isArray(value) ? value : [] }
export function loadRotaEntries() { const value = readJson('hi5central-rota-v1', []); return Array.isArray(value) ? value : [] }
export function loadCalendarEvents() { const value = readJson('hi5central-calendar-v1', []); return Array.isArray(value) ? value : [] }
export function loadLiveChatPreferences() { return { enabled: false, availability: 'Offline', soundEnabled: true, messagePreviews: true, enterToSend: true, ...(readJson('hi5central-live-chat-preferences-v1', {}) || {}) } }
export function loadLiveChatConversations() { const value = readJson('hi5central-live-chat-conversations-v1', []); return Array.isArray(value) ? value : [] }
export function loadNotifications() { const value = readJson('hi5central-notifications-v1', []); return Array.isArray(value) ? value : [] }
export function loadSession() { const session = readJson(PRODUCTION_SESSION_KEY, null); return session?.source === 'production' && session?.role === 'analyst' ? session : null }

export function saveProductionSession(session) {
  if (session?.source === 'production' && session?.role === 'analyst') writeJson(PRODUCTION_SESSION_KEY, session)
  else removeKey(PRODUCTION_SESSION_KEY)
}
export function clearProductionSession() { removeKey(PRODUCTION_SESSION_KEY) }
export function loadTheme() { const value = readJson('hi5central-theme-mode', null); return ['system', 'light', 'dark'].includes(value) ? value : 'system' }
export function loadAccent() { const value = readJson('hi5central-accent', 'amber'); return ['amber', 'cyan', 'blue', 'violet', 'emerald', 'rose'].includes(value) ? value : 'amber' }
export function loadDensity() { const value = readJson('hi5central-density', 'comfortable'); return ['comfortable', 'compact'].includes(value) ? value : 'comfortable' }
export function loadSidebarMode() { const value = readJson('hi5central-sidebar-mode', 'expanded'); return ['expanded', 'collapsed', 'hidden'].includes(value) ? value : 'expanded' }
export function loadWorkspace() { const value = readJson('hi5central-workspace-analyst', null); return value && Array.isArray(value.tabs) ? { tabs: value.tabs, activeTabKey: typeof value.activeTabKey === 'string' ? value.activeTabKey : null } : null }
export function saveWorkspace(value) { if (value && Array.isArray(value.tabs)) writeJson('hi5central-workspace-analyst', value) }

export function saveTickets(value) {
  const next = Array.isArray(value) ? value : []
  const previous = readJson('hi5central-tickets', [])
  writeJson('hi5central-tickets', next)
  if (!productionItsmEnabled() || !Array.isArray(previous)) return
  const previousById = new Map(previous.map((ticket) => [ticket.id, ticket]))
  next.forEach((ticket) => {
    const before = previousById.get(ticket.id)
    if (ticket.type === 'Service Request') { if (before) queueServiceRequestSync(before, ticket); return }
    if (['Incident', 'Problem', 'Change'].includes(ticket.type)) queueItsmRecordSync(before || null, ticket)
  })
}

export function saveOrganisationPeople(value) { writeJson('hi5central-organisation-people-v1', Array.isArray(value) ? value.filter((item) => !isLegacyOrganisationRecord(item)) : []) }
export function saveOrganisationTeams(value) { writeJson('hi5central-organisation-teams-v1', Array.isArray(value) ? value.filter((item) => !isLegacyOrganisationRecord(item)) : []) }
export function saveOrganisationDepartments(value) { writeJson('hi5central-organisation-departments-v1', Array.isArray(value) ? value.filter((item) => !isLegacyOrganisationRecord(item)) : []) }
export function saveOrganisationAudit(value) { writeJson('hi5central-organisation-audit-v1', Array.isArray(value) ? value.slice(0, 500) : []) }
export function saveProjects(value) { writeJson('hi5central-projects-v1', Array.isArray(value) ? value : []) }
export function saveRotaEntries(value) { writeJson('hi5central-rota-v1', Array.isArray(value) ? value : []) }
export function saveCalendarEvents(value) { writeJson('hi5central-calendar-v1', Array.isArray(value) ? value : []) }
export function saveLiveChatPreferences(value) { writeJson('hi5central-live-chat-preferences-v1', value || {}) }
export function saveLiveChatConversations(value) { writeJson('hi5central-live-chat-conversations-v1', Array.isArray(value) ? value : []) }
export function saveNotifications(value) { writeJson('hi5central-notifications-v1', Array.isArray(value) ? value : []) }
export function saveTheme(value) { writeJson('hi5central-theme-mode', value) }
export function saveAccent(value) { writeJson('hi5central-accent', value) }
export function saveDensity(value) { writeJson('hi5central-density', value) }
export function saveSidebarMode(value) { writeJson('hi5central-sidebar-mode', value) }

export function loadPortalSession() { return null }
export function savePortalSession() { removeKey('hi5central-portal-session') }
export function loadRmmSession() { return null }
export function saveRmmSession() { removeKey('hi5central-rmm-session') }
export function saveSession(session) {
  if (session?.source === 'production') { saveProductionSession(session); return }
  const hadProductionSession = Boolean(readJson(PRODUCTION_SESSION_KEY, null))
  removeKey(PRODUCTION_SESSION_KEY)
  removeKey('hi5central-session')
  removeKey('lsl-itsm-session')
  if (hadProductionSession) fetch(`${API_BASE}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
}

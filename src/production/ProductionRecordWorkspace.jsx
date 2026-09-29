import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  CircleDot,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Laptop,
  MessageSquareText,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  UserRoundCog,
  X,
} from 'lucide-react'
import {
  addProductionServiceRequestActivity,
  fetchProductionServiceRequest,
  patchProductionServiceRequest,
  transitionProductionServiceRequest,
} from '../services/productionServiceRequests.js'
import { deploymentConfig } from '../lib/deploymentConfig.js'
import { resolveTenantSurface } from '../lib/tenantSurface.js'
import { Hi5EntityTypeahead } from './Hi5EntityTypeahead.jsx'
import './ProductionRecordWorkspace.css'

const API_BASE = window.__HI5_API_BASE__
const GENERIC_TYPES = {
  incidents: 'Incident',
  problems: 'Problem',
  changes: 'Change',
}

function rmmDeviceHref(deviceId) {
  const encoded = encodeURIComponent(String(deviceId || '').toUpperCase())
  const surface = resolveTenantSurface()
  const deployment = deploymentConfig()
  if (deployment.tenancyMode === 'single') return `/rmm/devices/${encoded}`
  if (surface?.canonical && surface?.tenantSlug) return `https://${surface.tenantSlug}-rmm.${deployment.rootDomain}/devices/${encoded}`
  return `/rmm/devices/${encoded}`
}

function intuneDeviceHref(deviceId) {
  const encoded = encodeURIComponent(String(deviceId || ''))
  return `https://intune.microsoft.com/#view/Microsoft_Intune_Devices/DeviceSettingsMenuBlade/~/overview/mdmDeviceId/${encoded}`
}

function recordWorkspaceRoute(pathname = window.location.pathname) {
  const match = pathname.match(/^\/(incidents|requests|problems|changes)\/([^/]+)\/?$/i)
  if (!match) return null
  const section = match[1].toLowerCase()
  return {
    section,
    type: section === 'requests' ? 'Service Request' : GENERIC_TYPES[section],
    reference: decodeURIComponent(match[2]),
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
  if (!response.ok) {
    const error = new Error(payload.error || 'The request could not be completed.')
    error.status = response.status
    throw error
  }
  return payload
}

function formatDate(value, withYear = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function relativeTime(value) {
  if (!value) return '—'
  const delta = new Date(value).getTime() - Date.now()
  const absolute = Math.abs(delta)
  const [unit, divisor] = absolute >= 86400000
    ? ['day', 86400000]
    : absolute >= 3600000
      ? ['hour', 3600000]
      : ['minute', 60000]
  return new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' }).format(Math.round(delta / divisor), unit)
}

function money(value, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0))
}

function activityDay(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Earlier'
  const today = new Date()
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const days = Math.round((startToday - startDate) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days > 1 && days < 7) return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(date)
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' }).format(date)
}

function activityDateKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'earlier'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function sectionForRecordType(type = '') {
  const value = String(type || '').toLowerCase()
  if (value.includes('service request')) return 'requests'
  if (value.includes('problem')) return 'problems'
  if (value.includes('change')) return 'changes'
  return 'incidents'
}

function formatBytes(value = 0) {
  const bytes = Math.max(0, Number(value || 0))
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const amount = bytes / (1024 ** index)
  return `${amount >= 10 || index === 0 ? Math.round(amount) : amount.toFixed(1)} ${units[index]}`
}

function fileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

function slug(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function serviceRequestToLab(request, assignment, organisation) {
  const activities = Array.isArray(request.activities) ? request.activities : []
  return {
    ...request,
    id: request.id,
    reference: request.id,
    type: 'Service Request',
    title: request.title || request.catalogueItemTitle || request.id,
    requester: request.requester || '',
    requesterEmail: request.requesterEmail || '',
    service: request.service || request.catalogueItemTitle || 'Service Catalogue',
    category: request.catalogueItemTitle || 'Catalogue request',
    status: request.status || 'New',
    priority: request.priority || 'Medium',
    team: request.team || 'Unassigned',
    assignee: request.assignee || 'Unassigned',
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    description: request.description || '',
    activities,
    requestInformation: Array.isArray(request.requestInformation) ? request.requestInformation : [],
    requestedItems: Array.isArray(request.requestedItems) ? request.requestedItems : [],
    requestTasks: Array.isArray(request.requestTasks) ? request.requestTasks : [],
    requestApprovals: Array.isArray(request.requestApprovals) ? request.requestApprovals : [],
    attachments: Array.isArray(request.attachments) ? request.attachments : [],
    relationships: Array.isArray(request.relationships) ? request.relationships : [],
    oneOffCost: Number(request.oneOffCost || 0),
    monthlyCost: Number(request.monthlyCost || 0),
    currency: request.currency || 'GBP',
    nextStep: request.nextStep || '',
    sla: request.sla && typeof request.sla === 'object' ? request.sla : null,
    slaLabel: typeof request.sla === 'string' ? request.sla : '',
    organisation: organisation || { people: [], teams: [], departments: [], sites: [], teamMemberships: [] },
    options: {
      people: assignment?.people || [],
      teams: assignment?.teams || [],
    },
  }
}

function activityText(item) {
  return item.text || item.label || item.message || 'Record updated'
}

function isSystemActivity(item) {
  if (!item) return false
  return ['field_change', 'relationship', 'attachment', 'system', 'state', 'status'].includes(item.kind)
    || item.visibility === 'system'
}

function isCustomerActivity(item) {
  return item?.kind === 'customer' || item?.visibility === 'customer'
}

function initials(name = '') {
  return String(name || 'H')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'HC'
}

function LabPill({ tone = 'neutral', children }) {
  return <span className={`record-lab-pill is-${tone}`}>{children}</span>
}

function Metric({ label, value, sub, tone = 'neutral', icon }) {
  return <div className={`record-lab-metric is-${tone}`}>
    <div className="record-lab-metric-icon">{icon}</div>
    <div><span>{label}</span><strong>{value}</strong>{sub ? <small>{sub}</small> : null}</div>
  </div>
}

function OverviewFact({ label, value, sub }) {
  return <div className="record-lab-fact"><span>{label}</span><strong>{value || 'Not recorded'}</strong>{sub ? <small>{sub}</small> : null}</div>
}

function TimelineItem({ item }) {
  if (isSystemActivity(item)) {
    const changes = Array.isArray(item.metadata?.changes) ? item.metadata.changes : []
    return <div className={`record-lab-system-event is-${slug(item.kind || 'system')}`}>
      <i />
      <div><strong>{activityText(item)}</strong>{changes.length ? <small>{changes.map((change) => `${change.field}: ${String(change.from || '—')} → ${String(change.to || '—')}`).join(' · ')}</small> : null}</div>
      <time>{formatDate(item.createdAt)}</time>
    </div>
  }

  const customer = isCustomerActivity(item)
  const origin = item.kind === 'origin' || item.origin === true
  const inlineAttachments = [
    ...(Array.isArray(item.attachments) ? item.attachments : []),
    ...(Array.isArray(item.metadata?.attachments) ? item.metadata.attachments : []),
  ]
  const label = origin ? 'Original request' : customer ? 'Customer update' : 'Internal note'
  return <article className={`record-lab-timeline-card${customer ? ' is-customer' : ''}${origin ? ' is-origin' : ''}`}>
    <div className={`record-lab-avatar${origin ? ' is-origin' : ''}`}>{origin ? <FileText size={16} /> : initials(item.actor || 'Hi5Central')}</div>
    <div>
      <header><span><strong>{item.actor || 'Hi5Central'}</strong><small>{formatDate(item.createdAt)}</small></span><LabPill tone={origin ? 'warning' : customer ? 'accent' : 'neutral'}>{label}</LabPill></header>
      <p>{activityText(item)}</p>
      {inlineAttachments.length ? <div className="record-lab-inline-attachments">{inlineAttachments.map((attachment, index) => <span key={attachment.id || attachment.fileName || attachment.name || index}><Paperclip size={13} />{attachment.fileName || attachment.name || 'Attachment'}</span>)}</div> : null}
    </div>
  </article>
}


function SlaPanel({ detail }) {
  const response = detail?.sla?.response
  const resolution = detail?.sla?.resolution
  const paused = Boolean(detail?.sla?.paused)

  const statusFor = (metric) => {
    if (!metric) return { label: 'Not configured', tone: 'neutral', sub: 'No target on this record' }
    if (metric.state === 'met') return { label: 'Met', tone: 'good', sub: metric.completedAt ? `Completed ${formatDate(metric.completedAt)}` : 'Target met' }
    if (metric.state === 'breached') return { label: 'Breached', tone: 'danger', sub: metric.dueAt ? `${relativeTime(metric.dueAt)}` : 'Target exceeded' }
    if (metric.state === 'warning') return { label: metric.dueAt ? `${relativeTime(metric.dueAt)}` : 'At risk', tone: 'warning', sub: 'At risk' }
    return { label: metric.dueAt ? `${relativeTime(metric.dueAt)}` : 'On track', tone: 'good', sub: 'On track' }
  }

  const responseState = statusFor(response)
  const resolutionState = statusFor(resolution)

  if (!response && !resolution && detail?.slaLabel) {
    return <section className="record-lab-sla-card is-neutral">
      <Metric label="SLA" value={detail.slaLabel} sub="Service Request SLA preview" icon={<Clock3 size={18} />} />
      <div className="record-lab-sla-note">This lab is ready to surface response and resolution timers as soon as the Service Request SLA engine supplies them.</div>
    </section>
  }

  return <section className="record-lab-sla-card">
    <Metric label="First response" value={responseState.label} sub={responseState.sub} tone={responseState.tone} icon={<MessageSquareText size={18} />} />
    <Metric label="Resolution" value={resolutionState.label} sub={resolutionState.sub} tone={resolutionState.tone} icon={<Clock3 size={18} />} />
    <Metric label="SLA clock" value={paused ? 'Paused' : 'Running'} sub={paused && detail.sla?.pausedAt ? `Since ${formatDate(detail.sla.pausedAt)}` : 'Current timer state'} tone={paused ? 'warning' : 'accent'} icon={<CircleDot size={18} />} />
  </section>
}

function ActionComposer({ mode, detail, saving, onClose, onPost, onReassign, onResolve, onPending }) {
  const [text, setText] = useState('')
  const [team, setTeam] = useState(detail.team || '')
  const [assignee, setAssignee] = useState(detail.assignee || 'Unassigned')
  const [pendingStatus, setPendingStatus] = useState('Pending Customer')
  const [resolutionCode, setResolutionCode] = useState('Fixed')
  const [files, setFiles] = useState([])
  const [fileError, setFileError] = useState('')
  const customer = mode === 'customer'
  const noteMode = mode === 'internal' || mode === 'customer'
  const attachmentsSupported = noteMode && detail.type !== 'Service Request'
  const teams = detail.options?.teams || []
  const allPeople = detail.options?.people || []
  const selectedTeam = teams.find((item) => item.name === team) || null
  const teamPeople = selectedTeam ? (selectedTeam.members || []) : allPeople
  const selectedAssignee = allPeople.find((person) => person.name === assignee) || null

  const personMatches = (left, right) => {
    if (!left || !right) return false
    return Boolean(
      (left.databaseId && right.databaseId && left.databaseId === right.databaseId)
      || (left.id && right.id && left.id === right.id)
      || (left.email && right.email && left.email.toLowerCase() === right.email.toLowerCase())
      || (left.name && right.name && left.name === right.name)
    )
  }

  const teamsForPerson = (person) => teams.filter((candidate) =>
    (candidate.members || []).some((member) => personMatches(member, person)),
  )

  const chooseAssignee = (person) => {
    if (!person) {
      setAssignee('Unassigned')
      return
    }
    setAssignee(person.name || 'Unassigned')
    const compatibleTeams = teamsForPerson(person)
    if (selectedTeam && compatibleTeams.some((candidate) => candidate.name === selectedTeam.name)) return
    const preferred = compatibleTeams.find((candidate) =>
      (candidate.members || []).some((member) => personMatches(member, person) && member.isPrimary),
    ) || compatibleTeams[0]
    if (preferred) setTeam(preferred.name)
  }

  const changeTeam = (nextTeam) => {
    const nextName = nextTeam?.name || ''
    setTeam(nextName)
    if (!nextTeam) {
      setAssignee('Unassigned')
      return
    }
    const stillEligible = selectedAssignee && (nextTeam.members || []).some((member) => personMatches(member, selectedAssignee))
    if (!stillEligible) setAssignee('Unassigned')
  }

  const addFiles = (selected) => {
    const incoming = [...(selected || [])]
    const tooLarge = incoming.find((file) => file.size > 5 * 1024 * 1024)
    if (tooLarge) {
      setFileError(`${tooLarge.name} is larger than the 5 MB attachment limit.`)
      return
    }
    setFileError('')
    setFiles((current) => [...current, ...incoming].slice(0, 5))
  }

  const removeFile = (index) => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))

  const submit = async () => {
    if (mode === 'internal' || mode === 'customer') return onPost({ visibility: customer ? 'customer' : 'internal', text, files })
    if (mode === 'reassign') return onReassign({ team, assignee, note: text })
    if (mode === 'resolve') return onResolve({ resolutionCode, note: text })
    if (mode === 'pending') return onPending({ status: pendingStatus, note: text })
    return false
  }

  const label = {
    internal: 'Internal note',
    customer: 'Customer update',
    reassign: 'Reassign record',
    resolve: detail.type === 'Change' ? 'Complete change' : `Resolve ${detail.type.toLowerCase()}`,
    pending: 'Set pending',
  }[mode] || 'Update record'

  return <div className="record-lab-composer">
    <header><div><span>Working action</span><strong>{label}</strong></div><button type="button" onClick={onClose}><X size={16} />Close</button></header>
    {mode === 'reassign' ? <div className="record-lab-composer-fields">
      <label className="record-lab-person-picker-field"><span>Assignment group</span><Hi5EntityTypeahead
        items={teams}
        value={selectedTeam}
        onSelect={changeTeam}
        placeholder="Type at least 2 characters…"
        minimumCharacters={2}
        emptyLabel="No matching assignment groups"
        getSearchText={(item) => item.name || ''}
        getMeta={(item) => `${(item.members || []).length} eligible technician${(item.members || []).length === 1 ? '' : 's'}`}
      /><small className="record-lab-picker-hint">Search by team name. Selecting a team restricts the assignee search.</small></label>
      <label className="record-lab-person-picker-field"><span>Assignee</span><Hi5EntityTypeahead
        items={teamPeople}
        value={selectedAssignee}
        onSelect={chooseAssignee}
        placeholder="Type at least 2 characters…"
        minimumCharacters={2}
        emptyLabel={team ? `No matching eligible users in ${team}` : 'No matching eligible technicians'}
        getSearchText={(person) => [person.name, person.email, person.staffNumber, person.jobTitle, person.availability].filter(Boolean).join(' ')}
        getMeta={(person) => [person.jobTitle, person.email].filter(Boolean).join(' · ') || person.availability || 'Available'}
      /><small className="record-lab-picker-hint">{team ? `Eligible members of ${team}` : 'Search all eligible technicians; selecting a person will set their team automatically'}.</small></label>
    </div> : null}
    {mode === 'resolve' && detail.type === 'Incident' ? <div className="record-lab-composer-fields is-single"><label><span>Resolution code</span><select value={resolutionCode} onChange={(event) => setResolutionCode(event.target.value)}>{['Fixed','Workaround','User education','Configuration change','Known error','Duplicate','No fault found','Other'].map((value) => <option key={value}>{value}</option>)}</select></label></div> : null}
    {mode === 'pending' ? <div className="record-lab-composer-fields is-single"><label><span>Pending status</span><select value={pendingStatus} onChange={(event) => setPendingStatus(event.target.value)}><option>Pending Customer</option><option>Pending Vendor</option></select></label></div> : null}
    <textarea autoFocus={mode !== 'reassign'} value={text} onChange={(event) => setText(event.target.value)} placeholder={customer ? 'Write a customer-visible update…' : mode === 'reassign' ? 'Add a handoff note…' : mode === 'resolve' ? 'Add resolution notes…' : mode === 'pending' ? 'Why is this record being placed on hold?' : 'Write an internal work note…'} />
    {attachmentsSupported ? <div className="record-lab-composer-attachments"><label><Paperclip size={14} />Attach files<input type="file" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = '' }} /></label>{files.length ? <div className="record-lab-composer-file-list">{files.map((file, index) => <span key={`${file.name}-${file.size}-${index}`}><Paperclip size={12} /><b>{file.name}</b><small>{formatBytes(file.size)}</small><button type="button" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}><X size={12} /></button></span>)}</div> : null}{fileError ? <small className="record-lab-composer-file-error">{fileError}</small> : null}</div> : null}
    <footer><span>{customer ? 'Visible to requester' : mode === 'reassign' ? `Selected: ${assignee || 'Unassigned'}` : files.length ? `${files.length} attachment${files.length === 1 ? '' : 's'} will be added with this note` : 'Technician workspace'}</span><button type="button" disabled={saving || ((mode === 'internal' || mode === 'customer') && !text.trim())} onClick={submit}><Send size={16} />{saving ? 'Saving…' : label}</button></footer>
  </div>
}

function RecordWorkspace({ route }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState('activity')
  const [composerMode, setComposerMode] = useState('')
  const [showSystemEvents, setShowSystemEvents] = useState(() => window.localStorage.getItem('hi5central-record-lab-activity-mode') === 'all')
  const [activityQuery, setActivityQuery] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [contextView, setContextView] = useState('home')
  const [requesterAssets, setRequesterAssets] = useState([])
  const [inspectorCollapsed, setInspectorCollapsed] = useState(() => window.localStorage.getItem('hi5central-record-lab-inspector-collapsed') === '1')
  const scrollRef = useRef(null)
  const timelineRef = useRef(null)

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true)
    setError('')
    try {
      let nextDetail
      if (route.type === 'Service Request') {
        const [request, assignment, organisation] = await Promise.all([
          fetchProductionServiceRequest(route.reference),
          apiJson(`/api/v1/assignment/options?recordType=${encodeURIComponent(route.type)}`).catch(() => ({ people: [], teams: [] })),
          apiJson('/api/v1/organisation').catch(() => ({ people: [], teams: [], departments: [], sites: [], teamMemberships: [] })),
        ])
        nextDetail = serviceRequestToLab(request, assignment, organisation)
      } else {
        const [payload, taskPayload, assignment, organisation] = await Promise.all([
          apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}`),
          apiJson(`/api/v1/itsm-actions/${encodeURIComponent(route.reference)}/tasks`).catch(() => ({ tasks: [] })),
          apiJson(`/api/v1/assignment/options?recordType=${encodeURIComponent(route.type)}`).catch(() => ({ people: [], teams: [] })),
          apiJson('/api/v1/organisation').catch(() => ({ people: [], teams: [], departments: [], sites: [], teamMemberships: [] })),
        ])
        nextDetail = {
          ...payload,
          requestTasks: taskPayload.tasks || [],
          organisation,
          options: { ...(payload.options || {}), people: assignment.people || [], teams: assignment.teams || [] },
        }
      }

      const requesterSearch = nextDetail.requester || ''
      const recentPayload = requesterSearch
        ? await apiJson(`/api/v1/itsm-queue?search=${encodeURIComponent(requesterSearch)}&limit=20`).catch(() => ({ items: [] }))
        : { items: [] }
      nextDetail.contextRecentRecords = (recentPayload.items || [])
        .filter((item) => item.id !== nextDetail.id && String(item.requester || '').toLowerCase() === String(nextDetail.requester || '').toLowerCase())
        .slice(0, 6)
      setDetail(nextDetail)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      if (!quiet) setLoading(false)
    }
  }


  useEffect(() => { void load() }, [route.reference, route.type])
  useEffect(() => {
    if (!detail) { setRequesterAssets([]); return undefined }
    const people = Array.isArray(detail.organisation?.people) ? detail.organisation.people : []
    const person = people.find((item) =>
      (detail.requesterEmail && item.email && String(item.email).toLowerCase() === String(detail.requesterEmail).toLowerCase())
      || (detail.requesterId && item.id === detail.requesterId)
      || (detail.requester && item.name && String(item.name).toLowerCase() === String(detail.requester).toLowerCase()),
    )
    const personLookupId = person?.databaseId || person?.id
    if (!personLookupId) { setRequesterAssets([]); return undefined }
    let active = true
    apiJson(`/api/v1/rmm/devices?personId=${encodeURIComponent(personLookupId)}`)
      .then((payload) => {
        if (!active) return
        setRequesterAssets((payload.devices || []).map((device) => ({
          id: device.reference || device.id,
          name: device.name,
          type: [device.platform || device.operating_system, device.compliance_state ? `Compliance: ${device.compliance_state}` : '', device.source_connection_name || ''].filter(Boolean).join(' · '),
          status: device.management_state || 'Managed',
          source: device.source,
          sourceTenant: device.source_connection_name || '',
          sourceDirectoryTenantId: device.source_directory_tenant_id || '',
          serialNumber: device.serial_number,
          sourceDeviceId: device.source_device_id || '',
          directoryDeviceId: device.directory_device_id || '',
          rmmReference: device.rmm_reference || device.reference || '',
          rmmMatchMethod: device.rmm_match_method || (device.source === 'hi5central_agent' ? 'agent' : 'inventory'),
          deviceId: device.reference,
        })))
      })
      .catch(() => { if (active) setRequesterAssets([]) })
    return () => { active = false }
  }, [detail?.id, detail?.requesterEmail, detail?.requesterId, detail?.requester])
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 }, [tab])
  useEffect(() => { setContextView('home'); setActivityQuery('') }, [route.reference])
  useEffect(() => { window.localStorage.setItem('hi5central-record-lab-inspector-collapsed', inspectorCollapsed ? '1' : '0') }, [inspectorCollapsed])
  useEffect(() => { window.localStorage.setItem('hi5central-record-lab-activity-mode', showSystemEvents ? 'all' : 'human') }, [showSystemEvents])

  const run = async (handler, success) => {
    setSaving(true); setError(''); setNotice('')
    try {
      await handler()
      await load({ quiet: true })
      setComposerMode('')
      setNotice(success)
      return true
    } catch (actionError) {
      setError(actionError.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  const postNote = ({ visibility, text, files = [] }) => run(async () => {
    if (route.type === 'Service Request') {
      await addProductionServiceRequestActivity(route.reference, { kind: visibility === 'customer' ? 'customer' : 'work', text, html: '', attachments: [] })
    } else {
      const uploaded = []
      for (const file of files) {
        const contentBase64 = await fileBase64(file)
        const uploadResult = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/attachments`, {
          method: 'POST',
          body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'application/octet-stream', contentBase64 }),
        })
        const match = (uploadResult.attachments || []).find((item) => item.fileName === file.name)
        uploaded.push(match || { fileName: file.name, mimeType: file.type || 'application/octet-stream', byteSize: file.size })
      }
      await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/activity`, {
        method: 'POST',
        body: JSON.stringify({
          text,
          visibility,
          metadata: uploaded.length ? { attachments: uploaded.map((item) => ({ id: item.id, fileName: item.fileName, mimeType: item.mimeType, byteSize: item.byteSize })) } : {},
        }),
      })
    }
  }, visibility === 'customer' ? 'Customer update sent' : 'Internal note added')


  const reassign = ({ team, assignee, note }) => run(async () => {
    if (route.type === 'Service Request') {
      await patchProductionServiceRequest(route.reference, { team, assignee })
      if (note?.trim()) await addProductionServiceRequestActivity(route.reference, { kind: 'work', text: note.trim(), html: '', attachments: [] })
    } else {
      await apiJson(`/api/v1/itsm-actions/${encodeURIComponent(route.reference)}/reassign`, { method: 'POST', body: JSON.stringify({ version: detail.version, team, assignee, note }) })
    }
  }, 'Record reassigned')

  const resolve = ({ resolutionCode, note }) => run(async () => {
    if (route.type === 'Service Request') {
      await transitionProductionServiceRequest(route.reference, 'Completed', { completionNotes: note || 'Completed from Record Workspace Lab' })
    } else {
      await apiJson(`/api/v1/itsm-actions/${encodeURIComponent(route.reference)}/resolve`, { method: 'POST', body: JSON.stringify({ version: detail.version, resolutionCode, note, visibility: 'internal' }) })
    }
  }, route.type === 'Service Request' ? 'Request completed' : `${route.type} resolved`)

  const pending = ({ status, note }) => run(async () => {
    if (route.type === 'Service Request') {
      await transitionProductionServiceRequest(route.reference, 'In Progress', { completionNotes: note || '' })
    } else {
      await apiJson(`/api/v1/itsm-actions/${encodeURIComponent(route.reference)}/pending`, { method: 'POST', body: JSON.stringify({ version: detail.version, status, note, visibility: 'internal' }) })
    }
  }, 'Record placed on hold')

  const beginAction = (mode) => {
    setTab('activity')
    setComposerMode((current) => current === mode ? '' : mode)
  }

  const uploadAttachment = () => run(async () => {
    if (!attachment || route.type === 'Service Request') return
    const contentBase64 = await fileBase64(attachment)
    await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/attachments`, {
      method: 'POST',
      body: JSON.stringify({ fileName: attachment.name, mimeType: attachment.type || 'application/octet-stream', contentBase64 }),
    })
    setAttachment(null)
  }, 'Attachment uploaded')

  const removeAttachment = (attachmentId) => run(async () => {
    if (route.type === 'Service Request') return
    await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/attachments/remove`, {
      method: 'POST',
      body: JSON.stringify({ attachmentId }),
    })
  }, 'Attachment removed')

  const navigateLab = (path) => {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
    window.dispatchEvent(new CustomEvent('hi5-routechange', { detail: { path } }))
  }

  if (loading) return <div className="record-lab-loading"><div /><span>Opening record workspace lab…</span></div>
  if (!detail) return <div className="record-lab-failure"><AlertTriangle size={22} /><strong>Could not load this record</strong><span>{error}</span><button type="button" onClick={() => load()}>Retry</button></div>

  const activities = Array.isArray(detail.activities) ? [...detail.activities] : []
  if (detail.description?.trim() && route.type !== 'Service Request') {
    activities.unshift({ id: `origin-${detail.id}`, kind: 'origin', origin: true, visibility: 'customer', actor: detail.requester || 'Requester', text: detail.description, createdAt: detail.createdAt })
  }
  activities.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  const meaningfulActivities = activities.filter((item) => !isSystemActivity(item))
  const auditActivities = activities.filter((item) => isSystemActivity(item))
  const activityBase = showSystemEvents ? activities : meaningfulActivities
  const normalizedActivityQuery = activityQuery.trim().toLowerCase()
  const visibleActivities = normalizedActivityQuery
    ? activityBase.filter((item) => [activityText(item), item.actor, item.kind, item.visibility].filter(Boolean).join(' ').toLowerCase().includes(normalizedActivityQuery))
    : activityBase
  const activityDays = []
  const seenActivityDays = new Set()
  activityBase.forEach((item) => {
    const key = activityDateKey(item.createdAt)
    if (seenActivityDays.has(key)) return
    seenActivityDays.add(key)
    activityDays.push({ key, label: activityDay(item.createdAt) })
  })
  const longActivity = activityBase.length >= 12
  const tasks = Array.isArray(detail.requestTasks) ? detail.requestTasks : []
  const approvals = Array.isArray(detail.requestApprovals) ? detail.requestApprovals : []
  const requestInformation = Array.isArray(detail.requestInformation) ? detail.requestInformation : []
  const requestedItems = Array.isArray(detail.requestedItems) ? detail.requestedItems : []
  const relationships = Array.isArray(detail.relationships) ? detail.relationships : []
  const recordAttachments = Array.isArray(detail.attachments) ? detail.attachments : []
  const activityAttachments = activities.flatMap((activity) => (Array.isArray(activity.attachments) ? activity.attachments : []).map((item, index) => ({ ...item, activityId: activity.id, _key: item.id || `${activity.id}-${index}` })))
  const attachmentMap = new Map()
  ;[...recordAttachments, ...activityAttachments].forEach((item, index) => attachmentMap.set(item.id || item._key || `attachment-${index}`, item))
  const attachments = [...attachmentMap.values()]
  const completeTasks = tasks.filter((item) => item.status === 'Completed').length
  const pendingApprovals = approvals.filter((item) => item.status === 'Pending').length
  const responseState = detail.sla?.response?.state
  const resolutionState = detail.sla?.resolution?.state
  const primarySlaTone = resolutionState === 'breached' ? 'danger' : resolutionState === 'warning' ? 'warning' : resolutionState === 'met' ? 'good' : 'accent'
  const primarySlaLabel = detail.sla?.resolution?.dueAt
    ? (resolutionState === 'breached' ? `Breached ${relativeTime(detail.sla.resolution.dueAt)}` : `${relativeTime(detail.sla.resolution.dueAt)}`)
    : detail.slaLabel || 'No SLA target'
  const organisation = detail.organisation || { people: [], departments: [], sites: [] }
  const organisationPeople = Array.isArray(organisation.people) ? organisation.people : []
  const requesterPerson = organisationPeople.find((person) =>
    (detail.requesterEmail && person.email && person.email.toLowerCase() === String(detail.requesterEmail).toLowerCase())
    || (detail.requesterId && person.id === detail.requesterId)
    || (detail.requester && person.name && person.name.toLowerCase() === String(detail.requester).toLowerCase()),
  ) || null
  const requesterDepartment = (organisation.departments || []).find((department) => department.id === requesterPerson?.departmentId)
  const requesterManager = organisationPeople.find((person) => person.id === requesterPerson?.managerId)
  const contextRecentRecords = Array.isArray(detail.contextRecentRecords) ? detail.contextRecentRecords : []
  const linkedAssets = [
    ...requesterAssets,
    ...(Array.isArray(detail.assets) ? detail.assets : []),
    ...(Array.isArray(detail.configurationItems) ? detail.configurationItems : []),
    ...(Array.isArray(detail.recordData?.assets) ? detail.recordData.assets : []),
    ...(Array.isArray(detail.recordData?.configurationItems) ? detail.recordData.configurationItems : []),
  ]
  const blockedTask = tasks.find((item) => String(item.status || '').toLowerCase() === 'blocked')
  const contextualInsights = [
    ...(blockedTask ? [{ tone: 'danger', title: 'Blocked task', text: `${blockedTask.title || 'A linked task'} needs attention before work can continue.` }] : []),
    ...(String(detail.status || '').toLowerCase().includes('pending customer') ? [{ tone: 'warning', title: 'Waiting on customer', text: 'The record is currently paused for requester input.' }] : []),
    ...(String(detail.status || '').toLowerCase().includes('pending approval') ? [{ tone: 'warning', title: 'Approval outstanding', text: 'Fulfilment should not continue until the required approval is completed.' }] : []),
    ...(detail.assignee === 'Unassigned' || !detail.assignee ? [{ tone: 'warning', title: 'No technician assigned', text: 'The record is currently sitting with the assignment group rather than an individual.' }] : []),
    ...(contextRecentRecords.length >= 2 ? [{ tone: 'accent', title: 'Repeat contact', text: `${contextRecentRecords.length} other recent records are associated with this requester.` }] : []),
    ...(relationships.length ? [{ tone: 'accent', title: 'Linked work exists', text: `${relationships.length} related record${relationships.length === 1 ? '' : 's'} may provide useful context.` }] : []),
  ]
  const contextualSignal = blockedTask
    ? { tone: 'danger', label: 'Blocked task', detail: blockedTask.title || 'Needs attention' }
    : String(detail.status || '').toLowerCase().includes('pending customer')
      ? { tone: 'warning', label: 'Waiting on customer', detail: 'Requester action required' }
      : String(detail.status || '').toLowerCase().includes('pending approval')
        ? { tone: 'warning', label: 'Approval pending', detail: 'Decision required' }
        : (detail.assignee === 'Unassigned' || !detail.assignee)
          ? { tone: 'warning', label: 'Needs assignment', detail: detail.team || 'Unassigned group' }
          : contextRecentRecords.length >= 3
            ? { tone: 'accent', label: 'Repeat contact', detail: `${contextRecentRecords.length} recent records` }
            : null

  const tabs = route.type === 'Service Request'
    ? [
        ['activity', `Activity${meaningfulActivities.length ? ` ${meaningfulActivities.length}` : ''}`],
        ['request', `Request${requestInformation.length ? ` ${requestInformation.length}` : ''}`],
        ['tasks', `Tasks${tasks.length ? ` ${tasks.length}` : ''}`],
        ...(approvals.length ? [['approvals', `Approvals ${approvals.length}`]] : []),
        ['sla', 'SLA'],
        ['related', 'Related'],
        ['attachments', `Attachments${attachments.length ? ` ${attachments.length}` : ''}`],
        ['audit', 'Audit Log'],
        ['details', 'Details'],
      ]
    : [
        ['activity', `Activity${meaningfulActivities.length ? ` ${meaningfulActivities.length}` : ''}`],
        ['tasks', `Tasks${tasks.length ? ` ${tasks.length}` : ''}`],
        ['sla', 'SLA'],
        ['related', 'Related'],
        ['attachments', `Attachments${attachments.length ? ` ${attachments.length}` : ''}`],
        ['audit', 'Audit Log'],
        ['details', 'Details'],
      ]

  const latest = meaningfulActivities.slice(0, 4)

  const renderOverview = () => <div className="record-lab-overview-grid">
    <section className="record-lab-panel record-lab-summary-panel">
      <header><span>Record information</span><h2>{route.type === 'Service Request' ? 'Request summary' : 'What is happening?'}</h2></header>
      <div className="record-lab-description">{detail.description?.trim() || 'No description has been recorded.'}</div>
      <div className="record-lab-facts-grid">
        <OverviewFact label="Requester" value={detail.requester} sub={detail.requesterEmail} />
        <OverviewFact label="Service" value={detail.service} />
        <OverviewFact label="Category" value={detail.category || detail.catalogueItemTitle} />
        <OverviewFact label="Assignment" value={detail.team || 'Unassigned'} sub={detail.assignee || 'Unassigned'} />
        <OverviewFact label="Created" value={formatDate(detail.createdAt, true)} />
        <OverviewFact label="Last updated" value={formatDate(detail.updatedAt, true)} />
      </div>
    </section>

    <aside className="record-lab-work-rail">
      <section className="record-lab-panel">
        <header><span>Work</span><h3>Next attention</h3></header>
        {route.type === 'Service Request' ? <>
          <OverviewFact label="Fulfilment" value={tasks.length ? `${completeTasks} of ${tasks.length} tasks complete` : (detail.nextStep || detail.status)} />
          <OverviewFact label="Approvals" value={approvals.length ? (pendingApprovals ? `${pendingApprovals} pending` : 'Complete') : 'Not required'} />
          <OverviewFact label="Cost" value={`${money(detail.oneOffCost, detail.currency)} one-off`} sub={`${money(detail.monthlyCost, detail.currency)}/month`} />
        </> : <>
          <OverviewFact label="Priority" value={detail.priority || 'Medium'} sub={`${detail.impact || 'Medium'} impact · ${detail.urgency || 'Medium'} urgency`} />
          <OverviewFact label="SLA" value={primarySlaLabel} />
          <OverviewFact label="Resolution" value={detail.resolutionCode || 'Not resolved'} />
        </>}
      </section>
      <section className={`record-lab-panel record-lab-mini-sla is-${primarySlaTone}`} onClick={() => setTab('sla')} role="button" tabIndex="0">
        <span>Resolution SLA</span><strong>{primarySlaLabel}</strong><small>{responseState === 'met' ? 'First response met' : 'Open SLA detail'}</small>
      </section>
    </aside>

    <section className="record-lab-panel record-lab-recent-panel">
      <header><span>Recent activity</span><h2>Latest meaningful updates</h2><button type="button" onClick={() => setTab('activity')}>View all activity</button></header>
      <div className="record-lab-recent-list">{latest.length ? latest.map((item) => <TimelineItem item={item} key={item.id} />) : <div className="record-lab-empty">No notes or customer updates yet.</div>}</div>
    </section>
  </div>

  const renderInspector = (mobile = false) => {
    if (!mobile && inspectorCollapsed) return null

    const peekTitle = { user: 'Requester', assets: 'Assets & CIs', related: 'Related work', insights: 'Insights' }[contextView]
    const openRecord = (item) => navigateLab(`/record-lab/${sectionForRecordType(item.type || item.targetType)}/${encodeURIComponent(item.id || item.reference || item.targetReference)}`)
    const coreContext = <div className="record-lab-inspector-facts">
      <button type="button" className="record-lab-inspector-action" onClick={() => setContextView('user')}><span>Requester</span><strong>{detail.requester || 'Not recorded'}</strong><small>{detail.requesterEmail || requesterPerson?.role || 'Open requester context'}</small></button>
      <OverviewFact label="Service" value={detail.service} />
      <OverviewFact label="Category" value={detail.category || detail.catalogueItemTitle} />
      <button type="button" className="record-lab-inspector-action" onClick={() => beginAction('reassign')}><span>Assignment</span><strong>{detail.team || 'Unassigned'}</strong><small>{detail.assignee || 'Unassigned'}</small></button>
      <OverviewFact label="Priority" value={detail.priority || 'Medium'} sub={route.type === 'Incident' ? `${detail.impact || 'Medium'} impact · ${detail.urgency || 'Medium'} urgency` : ''} />
      <OverviewFact label="Created" value={formatDate(detail.createdAt, true)} />
      <OverviewFact label="Last updated" value={formatDate(detail.updatedAt, true)} />
    </div>

    const contextMenu = <div className="record-lab-context-menu">
      <button type="button" onClick={() => setContextView('user')}><UserRound size={16} /><span><strong>User</strong><small>{requesterPerson?.role || detail.requesterJobTitle || 'Requester profile and recent records'}</small></span></button>
      <button type="button" onClick={() => setContextView('assets')}><Laptop size={16} /><span><strong>Assets & CIs</strong><small>{linkedAssets.length ? `${linkedAssets.length} linked item${linkedAssets.length === 1 ? '' : 's'}` : 'No linked assets yet'}</small></span></button>
      <button type="button" onClick={() => setContextView('related')}><Link2 size={16} /><span><strong>Related</strong><small>{relationships.length ? `${relationships.length} linked record${relationships.length === 1 ? '' : 's'}` : 'No linked records'}</small></span></button>
      <button type="button" onClick={() => setContextView('insights')}><Sparkles size={16} /><span><strong>Insights</strong><small>{contextualInsights.length ? `${contextualInsights.length} evidence-based signal${contextualInsights.length === 1 ? '' : 's'}` : 'No immediate exceptions detected'}</small></span></button>
    </div>

    let peekContent = null
    if (contextView === 'user') {
      peekContent = <div className="record-lab-context-peek">
        <div className="record-lab-user-profile"><span className="record-lab-user-avatar">{initials(detail.requester)}</span><div><strong>{detail.requester || 'Requester not recorded'}</strong><small>{requesterPerson?.role || detail.requesterJobTitle || 'Job title not recorded'}</small></div></div>
        <div className="record-lab-inspector-facts">
          <OverviewFact label="Email" value={detail.requesterEmail || requesterPerson?.email} />
          <OverviewFact label="Phone" value={requesterPerson?.phone || 'Not recorded'} />
          <OverviewFact label="Department" value={requesterDepartment?.name || detail.requesterDepartment || 'Not recorded'} />
          <OverviewFact label="Site" value={requesterPerson?.location || detail.requesterLocation || detail.requesterSite || 'Not recorded'} />
          <OverviewFact label="Manager" value={requesterManager?.name || 'Not recorded'} sub={requesterManager?.email} />
          <OverviewFact label="Availability" value={requesterPerson?.status || 'Not recorded'} />
        </div>
        <div className="record-lab-inspector-section-title"><span>Recent records</span></div>
        <div className="record-lab-context-records">{contextRecentRecords.length ? contextRecentRecords.map((item) => <button type="button" key={item.id} onClick={() => openRecord(item)}><span><strong>{item.id}</strong><small>{item.type} · {item.status}</small></span><b>{item.title}</b></button>) : <div className="record-lab-context-empty">No other recent records were found for this requester.</div>}</div>
      </div>
    } else if (contextView === 'assets') {
      peekContent = <div className="record-lab-context-peek">{linkedAssets.length ? <div className="record-lab-context-records">{linkedAssets.map((asset, index) => <div className="record-lab-context-asset" key={asset.id || asset.deviceId || asset.name || index}><Laptop size={17} /><span><strong>{asset.name || asset.hostname || asset.displayName || asset.id || 'Asset'}</strong><small>{asset.type || asset.deviceType || asset.status || 'Linked configuration item'}</small>{asset.serialNumber ? <small>Serial: {asset.serialNumber}</small> : null}</span><div className="record-lab-context-asset-actions">{asset.rmmReference ? <a href={rmmDeviceHref(asset.rmmReference)} target="_blank" rel="noreferrer">Open in RMM <ExternalLink size={12} /></a> : null}{asset.source === 'intune' && asset.sourceDeviceId ? <a href={intuneDeviceHref(asset.sourceDeviceId)} target="_blank" rel="noreferrer">Open in Intune <ExternalLink size={12} /></a> : null}</div></div>)}</div> : <div className="record-lab-context-empty is-large"><Laptop size={24} /><strong>No linked assets or CIs yet</strong><span>This area is ready to surface assigned devices and configuration items as Intune/RMM data is linked to people and services.</span></div>}</div>
    } else if (contextView === 'related') {
      peekContent = <div className="record-lab-context-peek"><div className="record-lab-context-records">{relationships.length ? relationships.map((item) => <button type="button" key={item.id || item.targetReference} onClick={() => openRecord(item)}><span><strong>{item.targetReference || item.reference}</strong><small>{item.targetType || item.type} · {item.relationshipType || 'Related'}</small></span><b>Open record</b></button>) : <div className="record-lab-context-empty">No records are currently linked to this work item.</div>}</div></div>
    } else if (contextView === 'insights') {
      peekContent = <div className="record-lab-context-peek"><div className="record-lab-insight-intro"><Sparkles size={16} /><span><strong>Evidence-based context</strong><small>Signals below are derived from the record and linked data. AI-generated recommendations can use this same panel when the AI service is enabled.</small></span></div><div className="record-lab-insight-list">{contextualInsights.length ? contextualInsights.map((insight, index) => <div className={`record-lab-insight is-${insight.tone}`} key={`${insight.title}-${index}`}><span /><div><strong>{insight.title}</strong><small>{insight.text}</small></div></div>) : <div className="record-lab-context-empty">No high-confidence operational exceptions are visible from the current record data.</div>}</div></div>
    }

    return <aside className={`record-lab-inspector${mobile ? ' is-mobile-copy' : ''}`}>
      <section className="record-lab-panel record-lab-inspector-card is-unified">
        <header>{contextView === 'home' ? <div><span>Record details</span><h2>Context</h2></div> : <button type="button" className="record-lab-context-back" onClick={() => setContextView('home')}><ChevronLeft size={16} /><span><small>Context</small><strong>{peekTitle}</strong></span></button>}{!mobile ? <button type="button" className="record-lab-inspector-collapse" onClick={() => setInspectorCollapsed(true)} title="Collapse record details"><PanelLeftClose size={17} /></button> : null}</header>
        {contextView === 'home' ? <>{coreContext}<button type="button" className={`record-lab-inspector-sla is-${primarySlaTone}`} onClick={() => setTab('sla')}><span><Clock3 size={16} />Resolution SLA</span><strong>{primarySlaLabel}</strong><small>{responseState === 'met' ? 'First response met' : 'Open SLA detail'}</small></button><div className="record-lab-inspector-section-title"><span>Context</span></div>{contextMenu}</> : peekContent}
      </section>
    </aside>
  }


  const renderRequest = () => <div className="record-lab-stack">
    <section className="record-lab-panel">
      <header><span>Submitted information</span><h2>Request answers</h2></header>
      <div className="record-lab-answer-grid">{requestInformation.length ? requestInformation.map((item, index) => <OverviewFact key={`${item.label}-${index}`} label={item.label} value={String(item.value ?? '—')} />) : <div className="record-lab-empty">No structured request answers were submitted.</div>}</div>
    </section>
    <section className="record-lab-panel">
      <header><span>Catalogue</span><h2>Items & cost snapshot</h2></header>
      <div className="record-lab-item-list">{requestedItems.length ? requestedItems.map((item) => <div className="record-lab-item" key={item.databaseId || item.id || item.name}><div><strong>{item.name}</strong><span>{item.category || 'Catalogue item'} · Qty {item.quantity || 1}</span></div><b>{Number(item.unitMonthlyCost || 0) > 0 ? `${money(item.unitMonthlyCost, item.currency || detail.currency)}/mo` : money(item.unitOneOffCost, item.currency || detail.currency)}</b></div>) : <div className="record-lab-empty">No priced catalogue items.</div>}</div>
      <footer className="record-lab-cost-footer"><span><small>One-off</small><strong>{money(detail.oneOffCost, detail.currency)}</strong></span><span><small>Monthly</small><strong>{money(detail.monthlyCost, detail.currency)}</strong></span></footer>
    </section>
  </div>

  const activityRows = []
  let previousDayKey = ''
  visibleActivities.forEach((item) => {
    const dayKey = activityDateKey(item.createdAt)
    const dayLabel = activityDay(item.createdAt)
    if (dayKey !== previousDayKey) {
      activityRows.push(<div className="record-lab-day-separator" data-day-key={dayKey} key={`day-${dayKey}-${item.id}`}><span>{dayLabel}</span></div>)
      previousDayKey = dayKey
    }
    activityRows.push(<TimelineItem item={item} key={item.id} />)
  })

  const jumpToLatest = () => timelineRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  const jumpToDay = (dayKey) => {
    if (!dayKey || !timelineRef.current) return
    const node = timelineRef.current.querySelector(`[data-day-key="${dayKey}"]`)
    if (node instanceof HTMLElement) timelineRef.current.scrollTo({ top: Math.max(0, node.offsetTop - 8), behavior: 'smooth' })
  }

  const renderActivity = () => <section className="record-lab-panel record-lab-tab-panel record-lab-activity-panel">
    <div className="record-lab-action-strip record-lab-activity-actions">
      <button type="button" className={composerMode === 'internal' ? 'is-active' : ''} onClick={() => beginAction('internal')}><MessageSquareText size={16} />Internal note</button>
      <button type="button" className={composerMode === 'customer' ? 'is-active' : ''} onClick={() => beginAction('customer')}><Send size={16} />Customer update</button>
      <i />
      <button type="button" className={composerMode === 'reassign' ? 'is-active' : ''} onClick={() => beginAction('reassign')}><UserRoundCog size={16} />Reassign</button>
      <button type="button" className={composerMode === 'resolve' ? 'is-active' : ''} onClick={() => beginAction('resolve')}><CheckCircle2 size={16} />{route.type === 'Service Request' ? 'Complete' : 'Resolve'}</button>
      {route.type === 'Incident' ? <button type="button" className={composerMode === 'pending' ? 'is-active' : ''} onClick={() => beginAction('pending')}><Clock3 size={16} />Pending</button> : null}
      <button type="button" onClick={() => { setComposerMode(''); setTab('attachments') }}><Paperclip size={16} />Attachments</button>
    </div>
    {composerMode ? <div className="record-lab-activity-composer"><ActionComposer key={composerMode} mode={composerMode} detail={detail} saving={saving} onClose={() => setComposerMode('')} onPost={postNote} onReassign={reassign} onResolve={resolve} onPending={pending} /></div> : null}
    <header className="record-lab-activity-heading"><div><span>Timeline</span><h2>Activity</h2><small>{meaningfulActivities.length ? `Latest update ${relativeTime(meaningfulActivities[0]?.createdAt)}` : 'No human updates yet'}</small></div><div className="record-lab-activity-heading-tools">{longActivity ? <><label className="record-lab-activity-search"><Search size={13} /><input type="search" value={activityQuery} onChange={(event) => setActivityQuery(event.target.value)} placeholder="Search activity…" /></label>{activityDays.length > 1 ? <select aria-label="Jump to activity date" defaultValue="" onChange={(event) => { jumpToDay(event.target.value); event.target.value = '' }}><option value="">Jump to date…</option>{activityDays.map((day) => <option key={day.key} value={day.key}>{day.label}</option>)}</select> : null}<button type="button" className="record-lab-jump-latest" onClick={jumpToLatest}><ArrowUp size={13} />Latest</button></> : null}<div className="record-lab-activity-filter"><button type="button" className={!showSystemEvents ? 'is-active' : ''} onClick={() => setShowSystemEvents(false)}>Human updates</button><button type="button" className={showSystemEvents ? 'is-active' : ''} onClick={() => setShowSystemEvents(true)}>All events{auditActivities.length ? ` ${auditActivities.length}` : ''}</button></div></div></header>
    <div className="record-lab-timeline record-lab-timeline-scroll" ref={timelineRef}>{visibleActivities.length ? activityRows : <div className="record-lab-empty">{normalizedActivityQuery ? 'No activity matches this search.' : 'No notes or customer updates have been recorded yet.'}</div>}</div>
  </section>


  const renderTasks = () => <section className="record-lab-panel record-lab-tab-panel"><header><span>Work</span><h2>{route.type === 'Service Request' ? 'Fulfilment tasks' : 'Record tasks'}</h2></header>{tasks.length ? <div className="record-lab-task-list">{tasks.map((task, index) => <button type="button" className={`record-lab-task is-${slug(task.status || 'waiting')}`} key={task.id || `${task.title}-${index}`} onClick={() => route.type === 'Service Request' && task.id && navigateLab(`/tasks/${encodeURIComponent(task.id)}`)}><span className="record-lab-task-state">{task.status === 'Completed' ? <CheckCircle2 size={18} /> : <CircleDot size={18} />}</span><div><strong>{task.title}</strong><small>{task.team || 'Unassigned team'} · {task.assignee || 'Unassigned'}{task.dueAt ? ` · due ${formatDate(task.dueAt)}` : ''}</small></div><LabPill tone={task.status === 'Completed' ? 'good' : task.status === 'Blocked' ? 'danger' : 'neutral'}>{task.status || 'Waiting'}</LabPill>{route.type === 'Service Request' ? <span className="record-lab-task-open">Open</span> : null}</button>)}</div> : <div className="record-lab-empty">No tasks are currently linked to this record.</div>}</section>

  const renderApprovals = () => <section className="record-lab-panel record-lab-tab-panel"><header><span>Governance</span><h2>Approvals</h2></header>{approvals.length ? <div className="record-lab-task-list">{approvals.map((approval) => <div className="record-lab-task" key={approval.id}><span className="record-lab-task-state"><ShieldCheck size={18} /></span><div><strong>{approval.label}</strong><small>{approval.approver || 'Approver'} · {approval.status}</small></div><LabPill tone={approval.status === 'Approved' ? 'good' : approval.status === 'Rejected' ? 'danger' : 'warning'}>{approval.status}</LabPill></div>)}</div> : <div className="record-lab-empty">No approval is required.</div>}</section>

  const renderRelated = () => <section className="record-lab-panel record-lab-tab-panel"><header><span>Relationships</span><h2>Related records</h2></header>{relationships.length ? <div className="record-lab-link-list">{relationships.map((item) => <div key={item.id}><Link2 size={18} /><span><strong>{item.targetReference || item.reference}</strong><small>{item.targetType || item.type} · {item.relationshipType || 'Related'}</small></span></div>)}</div> : <div className="record-lab-empty">No related records.</div>}</section>

  const renderAttachments = () => <section className="record-lab-panel record-lab-tab-panel record-lab-attachments-panel">
    <header><span>Evidence</span><h2>Attachments</h2><LabPill tone="neutral">{attachments.length}</LabPill></header>
    {route.type !== 'Service Request' ? <div className="record-lab-upload-zone">
      <label><Upload size={19} /><span><strong>{attachment ? attachment.name : 'Choose a file'}</strong><small>{attachment ? formatBytes(attachment.size) : 'Add supporting evidence to this record'}</small></span><input type="file" onChange={(event) => setAttachment(event.target.files?.[0] || null)} /></label>
      <button type="button" disabled={!attachment || saving} onClick={uploadAttachment}><Upload size={16} />{saving ? 'Uploading…' : 'Upload'}</button>
    </div> : <div className="record-lab-attachment-note">Files included with request activity are collected here so the activity timeline stays focused on the conversation.</div>}
    {attachments.length ? <div className="record-lab-attachment-list">{attachments.map((item, index) => <div className="record-lab-attachment-row" key={item.id || item._key || index}><span className="record-lab-attachment-icon"><FileText size={18} /></span><div><strong>{item.fileName || item.name || 'Attachment'}</strong><small>{formatBytes(item.byteSize ?? item.size)}{item.uploadedBy ? ` · ${item.uploadedBy}` : ''}{item.createdAt ? ` · ${formatDate(item.createdAt)}` : ''}</small></div>{route.type !== 'Service Request' && item.id ? <><a href={`${API_BASE}/api/v1/itsm-lifecycle/${encodeURIComponent(detail.id)}/attachments/${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer" title="Download"><Download size={16} /></a><button type="button" onClick={() => removeAttachment(item.id)} title="Remove attachment"><Trash2 size={16} /></button></> : null}</div>)}</div> : <div className="record-lab-empty">No attachments have been added to this record.</div>}
  </section>

  const renderAudit = () => <section className="record-lab-panel record-lab-tab-panel"><header><span>Forensic history</span><h2>Audit Log</h2></header>{auditActivities.length ? <div className="record-lab-audit-list">{auditActivities.map((item) => { const changes = Array.isArray(item.metadata?.changes) ? item.metadata.changes : []; return <div className="record-lab-audit-row" key={item.id}><time>{formatDate(item.createdAt, true)}</time><div><strong>{activityText(item)}</strong>{changes.length ? changes.map((change, index) => <small key={`${change.field}-${index}`}><b>{change.field}</b><span>{String(change.from || '—')}</span><i>→</i><span>{String(change.to || '—')}</span></small>) : <small>{item.actor ? `By ${item.actor}` : 'System event'}</small>}</div></div> })}</div> : <div className="record-lab-empty">No system audit events are available for this record yet.</div>}</section>

  const tabContent = tab === 'activity' ? renderActivity()
    : tab === 'request' ? renderRequest()
      : tab === 'tasks' ? renderTasks()
        : tab === 'approvals' ? renderApprovals()
          : tab === 'sla' ? <div className="record-lab-stack"><SlaPanel detail={detail} /><section className="record-lab-panel record-lab-tab-panel"><header><span>SLA history</span><h2>Timer context</h2></header><div className="record-lab-facts-grid"><OverviewFact label="Created" value={formatDate(detail.createdAt, true)} /><OverviewFact label="Last updated" value={formatDate(detail.updatedAt, true)} /><OverviewFact label="SLA clock" value={detail.sla?.paused ? 'Paused' : 'Active'} sub={detail.sla?.pausedAt ? `Paused ${formatDate(detail.sla.pausedAt)}` : ''} /><OverviewFact label="Current priority" value={detail.priority} /></div></section></div>
            : tab === 'related' ? renderRelated()
              : tab === 'attachments' ? renderAttachments()
                : tab === 'details' ? renderInspector(true)
                  : renderAudit()

  return <div className="record-lab-shell" ref={scrollRef}>
    <section className="record-lab-masthead">
      <div className="record-lab-masthead-leading">
        <button type="button" className="record-lab-back" onClick={() => navigateLab(`/${route.section}`)} title={`Back to ${route.section}`}><ArrowLeft size={19} /></button>
        {inspectorCollapsed ? <button type="button" className="record-lab-details-restore" onClick={() => setInspectorCollapsed(false)} title="Show record details"><PanelLeftOpen size={18} /><span>Details</span></button> : null}
      </div>
      <div className="record-lab-heading"><div><strong>{detail.id || detail.reference}</strong><LabPill tone="accent">{detail.type || route.type}</LabPill><LabPill tone={['Resolved','Closed','Completed'].includes(detail.status) ? 'good' : 'neutral'}>{detail.status}</LabPill><LabPill tone={detail.priority === 'Critical' || detail.priority === 'High' ? 'danger' : detail.priority === 'Medium' ? 'warning' : 'good'}>{detail.priority}</LabPill></div><h1>{detail.title}</h1><p>{detail.requester || 'Requester not recorded'} · {detail.team || 'Unassigned'} / {detail.assignee || 'Unassigned'} · Updated {relativeTime(detail.updatedAt)}</p></div>
      <div className="record-lab-masthead-signals">{contextualSignal ? <button type="button" className={`record-lab-context-signal is-${contextualSignal.tone}`} onClick={() => { setInspectorCollapsed(false); setContextView(contextualSignal.label === 'Repeat contact' ? 'user' : 'insights') }}><Sparkles size={16} /><span><small>{contextualSignal.label}</small><strong>{contextualSignal.detail}</strong></span></button> : null}<button type="button" className={`record-lab-sla-badge is-${primarySlaTone}`} onClick={() => setTab('sla')}><Clock3 size={18} /><span><small>Resolution SLA</small><strong>{primarySlaLabel}</strong></span></button></div>
    </section>

    {error ? <div className="record-lab-notice is-error"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => setError('')}><X size={15} /></button></div> : null}
    {notice ? <div className="record-lab-notice is-success"><CheckCircle2 size={17} /><span>{notice}</span><button type="button" onClick={() => setNotice('')}><X size={15} /></button></div> : null}

    <div className={`record-lab-workspace-grid${inspectorCollapsed ? ' is-inspector-collapsed' : ''}`}>
      {renderInspector()}
      <section className={`record-lab-primary-workspace${tab === 'activity' ? ' is-activity-view' : ''}`}>
        <nav className="record-lab-tabs" aria-label="Record workspace sections">{tabs.map(([value, label]) => <button type="button" key={value} className={`${tab === value ? 'is-active' : ''}${value === 'details' ? ' record-lab-mobile-details-tab' : ''}`} onClick={() => { setComposerMode(''); setTab(value) }}>{label}</button>)}<button type="button" className="record-lab-refresh" onClick={() => load({ quiet: true })}><RefreshCw size={15} />Refresh</button></nav>
        <main className="record-lab-content">{tabContent}</main>
      </section>
    </div>
  </div>
}

export function ProductionRecordWorkspace() {
  const [route, setRoute] = useState(recordWorkspaceRoute)
  const [target, setTarget] = useState(null)

  useEffect(() => {
    const update = () => setRoute(recordWorkspaceRoute())
    window.addEventListener('popstate', update)
    window.addEventListener('hi5-routechange', update)
    const timer = window.setInterval(update, 250)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener('hi5-routechange', update)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!route) {
      setTarget(null)
      document.querySelector('.content-frame')?.classList.remove('production-record-workspace-mounted')
      return undefined
    }
    let mounted = null
    const attach = () => {
      const node = document.querySelector('.content-frame')
      if (!(node instanceof HTMLElement)) return false
      mounted = node
      node.classList.add('production-record-workspace-mounted')
      setTarget(node)
      return true
    }
    if (attach()) return () => mounted?.classList.remove('production-record-workspace-mounted')
    const observer = new MutationObserver(() => { if (attach()) observer.disconnect() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      mounted?.classList.remove('production-record-workspace-mounted')
    }
  }, [route])

  const key = useMemo(() => route ? `${route.type}:${route.reference}` : 'none', [route])
  if (!route || !target) return null
  return createPortal(<RecordWorkspace key={key} route={route} />, target)
}

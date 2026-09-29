import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  AtSign,
  Bold,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  ClipboardCheck,
  Clock3,
  FileText,
  FileUp,
  ExternalLink,
  Image,
  Inbox,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  MessageSquarePlus,
  Monitor,
  Paperclip,
  Plus,
  Send,
  Server,
  Share2,
  Table2,
  Trash2,
  UserCheck,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react'
import { deploymentConfig } from '../../lib/deploymentConfig.js'
import { priorityClass, statusClass } from '../../lib/workspace.js'
import { resolveTenantSurface } from '../../lib/tenantSurface.js'
import { organisationPeople, organisationTeams } from '../../data/organisationData.js'
import { readLocalAttachment, removeLocalAttachment, storeLocalAttachment } from '../../services/localAttachmentStore.js'
import {
  buildLifecycleTransition,
  getAllowedTransitions,
  getLifecycleDefinition,
  getLifecycleIndex,
  getTransitionBlockers,
  getTransitionRequirements,
  transitionLabel,
} from '../../lib/lifecycle.js'

const recordTypeMeta = {
  Incident: { className: 'incident', label: 'Incident' },
  'Service Request': { className: 'request', label: 'Service Request' },
  Problem: { className: 'problem', label: 'Problem' },
  Change: { className: 'change', label: 'Change' },
}

const commonTabs = [
  { id: 'overview', label: 'Overview', icon: Inbox },
  { id: 'activity', label: 'Activity', icon: MessageSquarePlus },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'related', label: 'Related', icon: Share2 },
  { id: 'attachments', label: 'Attachments', icon: Paperclip },
]



function initials(value = '') {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '??'
}

function valueOrFallback(value, fallback = 'Not captured') {
  return value === undefined || value === null || value === '' ? fallback : value
}

function rmmDeviceHref(deviceId) {
  const encoded = encodeURIComponent(String(deviceId || '').toUpperCase())
  const surface = resolveTenantSurface()
  const deployment = deploymentConfig()
  if (deployment.tenancyMode === 'single') return `/rmm/devices/${encoded}`
  if (surface?.canonical && surface?.tenantSlug) {
    return `https://${surface.tenantSlug}-rmm.${deployment.rootDomain}/devices/${encoded}`
  }
  return `/rmm/devices/${encoded}`
}

function currency(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function fileSize(bytes = 0) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}


const allowedRichTags = new Set([
  'A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DIV', 'EM', 'H1', 'H2', 'H3', 'HR', 'I', 'IMG',
  'LI', 'OL', 'P', 'PRE', 'S', 'SPAN', 'STRONG', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH',
  'THEAD', 'TR', 'U', 'UL',
])

function sanitizeRichHtml(html = '') {
  if (typeof document === 'undefined') return String(html || '')
  const template = document.createElement('template')
  template.innerHTML = String(html || '')

  const sanitizeNode = (node) => {
    Array.from(node.children || []).forEach((child) => {
      if (!allowedRichTags.has(child.tagName)) {
        sanitizeNode(child)
        child.replaceWith(...Array.from(child.childNodes))
        return
      }

      Array.from(child.attributes).forEach((attribute) => {
        const name = attribute.name.toLowerCase()
        const value = attribute.value || ''
        const allowed = ['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'target'].includes(name)
        if (!allowed || name.startsWith('on')) child.removeAttribute(attribute.name)
        if ((name === 'href' || name === 'src') && /^javascript:/i.test(value.trim())) child.removeAttribute(attribute.name)
      })

      if (child.tagName === 'A') {
        child.setAttribute('target', '_blank')
        child.setAttribute('rel', 'noreferrer')
      }
      sanitizeNode(child)
    })
  }

  sanitizeNode(template.content)
  return template.innerHTML
}

function htmlToPlainText(html = '') {
  if (typeof document === 'undefined') return String(html || '').replace(/<[^>]+>/g, ' ')
  const template = document.createElement('template')
  template.innerHTML = sanitizeRichHtml(html)
  return (template.content.textContent || '').replace(/\s+/g, ' ').trim()
}

function insertHtmlAtSelection(html) {
  if (typeof document === 'undefined') return
  document.execCommand('insertHTML', false, sanitizeRichHtml(html))
}

function LocalAttachmentLink({ attachment, imagePreview = false }) {
  const [url, setUrl] = useState(attachment.dataUrl || '')

  useEffect(() => {
    let active = true
    let objectUrl = ''
    if (attachment.dataUrl || !attachment.storageKey) return undefined

    readLocalAttachment(attachment.storageKey)
      .then((blob) => {
        if (!active || !blob) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {})

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment.dataUrl, attachment.storageKey])

  const isImage = String(attachment.type || '').startsWith('image/')
  if (imagePreview && isImage && url) {
    return (
      <a className="rich-activity-image" href={url} target="_blank" rel="noreferrer">
        <img alt={attachment.name} src={url} />
        <span>{attachment.name}</span>
      </a>
    )
  }

  return (
    <a className="rich-activity-file" href={url || undefined} download={attachment.name} target={url ? '_blank' : undefined} rel="noreferrer">
      <FileText size={16} />
      <span><strong>{attachment.name}</strong><small>{fileSize(attachment.size)} · {attachment.type || 'File'}</small></span>
    </a>
  )
}

function incidentSlaTargets(priority) {
  if (priority === 'Critical') return { response: '15 min', resolution: '1 hr' }
  if (priority === 'High') return { response: '30 min', resolution: '4 hr' }
  if (priority === 'Medium') return { response: '1 hr', resolution: '8 hr' }
  return { response: '4 hr', resolution: '2 business days' }
}

function inferredImpact(priority) {
  if (priority === 'Critical') return 'Widespread / business critical'
  if (priority === 'High') return 'Multiple users / major service impact'
  if (priority === 'Medium') return 'Limited group / degraded service'
  return 'Single user / low business impact'
}

function inferredUrgency(priority) {
  if (priority === 'Critical') return 'Immediate'
  if (priority === 'High') return 'High'
  if (priority === 'Medium') return 'Normal'
  return 'Low'
}



function relatedRecordIds(ticket, tickets) {
  const ids = new Set([
    ...(ticket.relatedIncidents || []),
    ...(ticket.relatedProblems || []),
    ...(ticket.relatedChanges || []),
    ...(ticket.relatedRequests || []),
    ...(ticket.relatedRecords || []),
  ])

  tickets.forEach((candidate) => {
    if (candidate.id === ticket.id) return
    const candidateLinks = [
      ...(candidate.relatedIncidents || []),
      ...(candidate.relatedProblems || []),
      ...(candidate.relatedChanges || []),
      ...(candidate.relatedRequests || []),
      ...(candidate.relatedRecords || []),
    ]
    if (candidateLinks.includes(ticket.id)) ids.add(candidate.id)
  })

  return ids
}

function syntheticTasks(ticket) {
  if (ticket.requestTasks?.length) return ticket.requestTasks

  if (ticket.type === 'Incident') {
    const progressed = ticket.status !== 'New'
    const resolved = ['Resolved', 'Closed'].includes(ticket.status)
    return [
      {
        id: `${ticket.id}-TRIAGE`,
        title: 'Triage and validate impact',
        team: ticket.team,
        assignee: ticket.assignee,
        status: progressed ? 'Completed' : 'Ready',
        due: 'Immediate',
        instructions: 'Confirm symptoms, affected users, service impact and initial diagnostics.',
      },
      {
        id: `${ticket.id}-RESTORE`,
        title: 'Investigate and restore service',
        team: ticket.team,
        assignee: ticket.assignee,
        status: resolved ? 'Completed' : progressed ? 'In Progress' : 'Waiting',
        due: ticket.sla,
        instructions: 'Progress technical investigation and apply the safest available restoration action.',
      },
      {
        id: `${ticket.id}-CONFIRM`,
        title: 'Confirm restoration and resolution',
        team: 'Service Desk',
        assignee: ticket.assignee,
        status: ticket.status === 'Closed' ? 'Completed' : ticket.status === 'Resolved' ? 'Ready' : 'Waiting',
        due: 'Before closure',
        instructions: 'Validate service restoration with the requester and capture the final resolution.',
      },
    ]
  }

  if (ticket.type === 'Problem') {
    return [
      {
        id: `${ticket.id}-ANALYSE`,
        title: 'Analyse related incidents and evidence',
        team: ticket.team,
        assignee: ticket.assignee,
        status: ticket.problemHypothesis ? 'Completed' : 'In Progress',
        due: 'Investigation',
        instructions: 'Correlate incident symptoms, affected configuration and recurring patterns.',
      },
      {
        id: `${ticket.id}-RCA`,
        title: 'Validate root cause and workaround',
        team: ticket.team,
        assignee: ticket.assignee,
        status: ticket.problemRootCause ? 'Completed' : ticket.problemWorkaround ? 'In Progress' : 'Waiting',
        due: 'Before known error',
        instructions: 'Prove or disprove the working hypothesis and document a safe workaround.',
      },
      {
        id: `${ticket.id}-FIX`,
        title: 'Deliver permanent corrective action',
        team: ticket.team,
        assignee: ticket.assignee,
        status: ticket.status === 'Resolved' || ticket.status === 'Closed' ? 'Completed' : ticket.relatedChanges?.length ? 'In Progress' : 'Waiting',
        due: 'Problem target',
        instructions: 'Coordinate the permanent fix, normally through a controlled change, and verify the outcome.',
      },
    ]
  }

  if (ticket.type === 'Change') {
    const approved = ['Scheduled', 'In Progress', 'Review', 'Closed'].includes(ticket.status) || ticket.approval === 'Approved'
    const implementing = ['In Progress', 'Review', 'Closed'].includes(ticket.status)
    return [
      {
        id: `${ticket.id}-ASSESS`,
        title: 'Risk assessment and approval',
        team: ticket.team,
        assignee: ticket.assignee,
        status: approved ? 'Completed' : 'In Progress',
        due: ticket.window || 'Before implementation',
        instructions: 'Confirm risk, affected CIs, approvals, implementation window and backout readiness.',
      },
      {
        id: `${ticket.id}-IMPLEMENT`,
        title: 'Implement approved change',
        team: ticket.team,
        assignee: ticket.assignee,
        status: ticket.status === 'Closed' || ticket.status === 'Review' ? 'Completed' : implementing ? 'In Progress' : 'Waiting',
        due: ticket.plannedStart || ticket.window || 'Scheduled window',
        instructions: ticket.implementationPlan || 'Execute the approved implementation plan.',
      },
      {
        id: `${ticket.id}-REVIEW`,
        title: 'Validate and complete post-change review',
        team: ticket.team,
        assignee: ticket.assignee,
        status: ticket.status === 'Closed' ? 'Completed' : ticket.status === 'Review' ? 'Ready' : 'Waiting',
        due: 'After implementation',
        instructions: ticket.testPlan || 'Validate service health and record the change outcome.',
      },
    ]
  }

  return []
}

function DetailProperty({ label, value, emphasis = false }) {
  return (
    <div className={emphasis ? 'unified-detail-property emphasis' : 'unified-detail-property'}>
      <span>{label}</span>
      <strong>{valueOrFallback(value)}</strong>
    </div>
  )
}

function DetailSection({ children, eyebrow, icon: Icon, title, className = '' }) {
  return (
    <section className={`unified-detail-section ${className}`.trim()}>
      <header className="unified-detail-section-heading">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h3>{title}</h3>
        </div>
        {Icon && <Icon size={19} aria-hidden="true" />}
      </header>
      {children}
    </section>
  )
}

function RequestOverview({ ticket }) {
  const items = ticket.requestedItems || []
  const approvals = ticket.requestApprovals || []
  const tasks = ticket.requestTasks || []
  const totalCost = items.reduce((sum, item) => sum + (item.unitCost || 0) * (item.quantity || 1), 0)
  const completedTasks = tasks.filter((task) => task.status === 'Completed').length
  const approved = approvals.filter((approval) => approval.status === 'Approved').length

  return (
    <div className="unified-type-overview request">
      <div className="unified-detail-metric-grid">
        <div><span>Requested items</span><strong>{items.length}</strong><small>{currency(totalCost)} captured cost</small></div>
        <div><span>Approvals</span><strong>{approved}/{approvals.length || 0}</strong><small>{approvals.some((item) => item.status === 'Pending') ? 'Approval outstanding' : 'No approval blocker'}</small></div>
        <div><span>Fulfilment</span><strong>{completedTasks}/{tasks.length || 0}</strong><small>Tasks completed</small></div>
      </div>

      <DetailSection eyebrow="Submitted fields" icon={UserRound} title="Request information">
        <div className="unified-detail-property-grid three">
          {(ticket.requestInformation?.length
            ? ticket.requestInformation
            : [
                { label: 'Requester', value: ticket.requester },
                { label: 'Department', value: ticket.requesterDepartment },
                { label: 'Job title', value: ticket.requesterJobTitle },
              ]
          ).map((item, index) => (
            <DetailProperty key={`${item.label}-${index}`} label={item.label} value={item.value} />
          ))}
        </div>
      </DetailSection>

      <DetailSection eyebrow="Catalogue" icon={ClipboardCheck} title="Requested items">
        {items.length ? (
          <div className="unified-detail-item-list">
            {items.map((item) => (
              <article key={item.id || item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.category} · Qty {item.quantity || 1}</span>
                  {!!item.options?.length && <small>{item.options.join(' · ')}</small>}
                </div>
                <b>{currency((item.unitCost || 0) * (item.quantity || 1))}</b>
              </article>
            ))}
          </div>
        ) : <p className="unified-detail-empty-copy">No structured catalogue items are attached to this request.</p>}
      </DetailSection>

      <DetailSection eyebrow="Governance" icon={CheckCircle2} title="Approvals">
        {approvals.length ? (
          <div className="unified-detail-approval-list">
            {approvals.map((approval) => (
              <article key={approval.id}>
                <span className={`unified-detail-state ${statusClass(approval.status)}`}>{approval.status}</span>
                <div><strong>{approval.label}</strong><small>{approval.approver} · {approval.updated}</small></div>
              </article>
            ))}
          </div>
        ) : <p className="unified-detail-empty-copy">This request has no approval stage.</p>}
      </DetailSection>

      {(ticket.approvalNote || ticket.completionNotes || ticket.reopenReason) && (
        <DetailSection eyebrow="Lifecycle" icon={Clock3} title="Approval and completion notes">
          <div className="unified-detail-stack">
            {ticket.approvalNote && <div><span>Approval note</span><p>{ticket.approvalNote}</p></div>}
            {ticket.completionNotes && <div><span>Fulfilment summary</span><p>{ticket.completionNotes}</p></div>}
            {ticket.reopenReason && <div><span>Reopen reason</span><p>{ticket.reopenReason}</p></div>}
          </div>
        </DetailSection>
      )}
    </div>
  )
}

function IncidentOverview({ ticket }) {
  const targets = incidentSlaTargets(ticket.priority)
  return (
    <div className="unified-type-overview incident">
      <div className="unified-detail-metric-grid">
        <div><span>First response</span><strong>{targets.response}</strong><small>Target</small></div>
        <div><span>Resolution</span><strong>{targets.resolution}</strong><small>{ticket.sla} remaining / target state</small></div>
        <div><span>SLA consumed</span><strong>{Math.min(100, ticket.slaPercent || 0)}%</strong><small>{ticket.status === 'Pending' ? 'Pending clock rules apply' : ticket.sla}</small></div>
      </div>

      <DetailSection eyebrow="Service management" icon={CircleGauge} title="Impact, urgency & SLA">
        <div className="unified-detail-property-grid three">
          <DetailProperty label="Impact" value={ticket.impact || inferredImpact(ticket.priority)} />
          <DetailProperty label="Urgency" value={ticket.urgency || inferredUrgency(ticket.priority)} />
          <DetailProperty label="Priority" value={ticket.priority} emphasis />
          <DetailProperty label="Response target" value={targets.response} />
          <DetailProperty label="Resolution target" value={targets.resolution} />
          <DetailProperty label="SLA position" value={`${Math.min(100, ticket.slaPercent || 0)}% consumed`} />
        </div>
        <div className="unified-detail-progress" aria-label={`${ticket.slaPercent || 0}% of SLA consumed`}>
          <span style={{ width: `${Math.min(100, ticket.slaPercent || 0)}%` }} />
        </div>
      </DetailSection>

      {(ticket.pendingReason || ticket.resolutionCode || ticket.resolutionNotes) && (
        <DetailSection eyebrow="Current state" icon={CheckCircle2} title="Resolution and hold information">
          <div className="unified-detail-property-grid two">
            <DetailProperty label="Pending reason" value={ticket.pendingReason} />
            <DetailProperty label="Resolution code" value={ticket.resolutionCode} />
          </div>
          {ticket.resolutionNotes && <p className="unified-detail-long-copy">{ticket.resolutionNotes}</p>}
        </DetailSection>
      )}
    </div>
  )
}

function ChangeOverview({ ticket }) {
  return (
    <div className="unified-type-overview change">
      <div className="unified-detail-metric-grid">
        <div><span>Change type</span><strong>{valueOrFallback(ticket.changeType, 'Normal')}</strong><small>{ticket.risk || ticket.priority} risk</small></div>
        <div><span>Approval</span><strong>{valueOrFallback(ticket.approval, ticket.status)}</strong><small>{valueOrFallback(ticket.approvalRoute, 'Standard route')}</small></div>
        <div><span>Window</span><strong>{valueOrFallback(ticket.window, 'Not scheduled')}</strong><small>{valueOrFallback(ticket.downtime, 'Downtime not defined')}</small></div>
      </div>

      <DetailSection eyebrow="Assessment" icon={AlertCircle} title="Risk and governance">
        <div className="unified-detail-property-grid three">
          <DetailProperty label="Change type" value={ticket.changeType || 'Normal'} />
          <DetailProperty label="Risk" value={ticket.risk || ticket.priority} emphasis />
          <DetailProperty label="Approval route" value={ticket.approvalRoute} />
          <DetailProperty label="Planned start" value={ticket.plannedStart || ticket.window} />
          <DetailProperty label="Planned end" value={ticket.plannedEnd} />
          <DetailProperty label="Expected downtime" value={ticket.downtime} />
        </div>
        {ticket.riskSummary && <div className="unified-detail-callout"><span>Risk summary</span><strong>{ticket.riskSummary}</strong></div>}
      </DetailSection>

      <div className="unified-detail-plan-grid">
        <DetailSection eyebrow="Why" title="Business reason"><p className="unified-detail-long-copy">{valueOrFallback(ticket.businessReason)}</p></DetailSection>
        <DetailSection eyebrow="Plan" title="Implementation"><p className="unified-detail-long-copy">{valueOrFallback(ticket.implementationPlan)}</p></DetailSection>
        <DetailSection eyebrow="Validation" title="Test plan"><p className="unified-detail-long-copy">{valueOrFallback(ticket.testPlan)}</p></DetailSection>
        <DetailSection eyebrow="Recovery" title="Backout plan"><p className="unified-detail-long-copy">{valueOrFallback(ticket.backoutPlan)}</p></DetailSection>
      </div>

      {(ticket.implementationNotes || ticket.failureReason || ticket.backoutOutcome || ticket.reviewOutcome || ticket.reworkReason) && (
        <DetailSection eyebrow="Execution" icon={Clock3} title="Implementation and review outcome">
          <div className="unified-detail-stack">
            {ticket.implementationNotes && <div><span>Implementation outcome</span><p>{ticket.implementationNotes}</p></div>}
            {ticket.failureReason && <div><span>Failure reason</span><p>{ticket.failureReason}</p></div>}
            {ticket.backoutOutcome && <div><span>Backout / recovery outcome</span><p>{ticket.backoutOutcome}</p></div>}
            {ticket.reviewOutcome && <div><span>Post-implementation review</span><p>{ticket.reviewOutcome}</p></div>}
            {ticket.reworkReason && <div><span>Returned to draft</span><p>{ticket.reworkReason}</p></div>}
          </div>
        </DetailSection>
      )}
    </div>
  )
}

function ProblemOverview({ ticket }) {
  return (
    <div className="unified-type-overview problem">
      <div className="unified-detail-metric-grid">
        <div><span>Related incidents</span><strong>{ticket.relatedIncidents?.length || 0}</strong><small>Linked symptoms / impact</small></div>
        <div><span>Corrective changes</span><strong>{ticket.relatedChanges?.length || 0}</strong><small>Permanent-fix activity</small></div>
        <div><span>Known error</span><strong>{valueOrFallback(ticket.knownErrorStatus, 'Not declared')}</strong><small>{ticket.knowledgeArticle || 'Knowledge not linked'}</small></div>
      </div>

      <DetailSection eyebrow="Investigation" icon={Wrench} title="Problem analysis">
        <div className="unified-detail-stack">
          <div><span>Impact scope</span><p>{valueOrFallback(ticket.problemImpactScope)}</p></div>
          <div><span>Working hypothesis</span><p>{valueOrFallback(ticket.problemHypothesis)}</p></div>
          <div><span>Current workaround</span><p>{valueOrFallback(ticket.problemWorkaround)}</p></div>
        </div>
      </DetailSection>

      <DetailSection eyebrow="Known error" icon={BookOpen} title={ticket.knownErrorTitle || 'Known error record'}>
        <div className="unified-detail-property-grid two">
          <DetailProperty label="Status" value={ticket.knownErrorStatus || 'Not declared'} />
          <DetailProperty label="Knowledge article" value={ticket.knowledgeArticle} />
        </div>
        {!!ticket.affectedVersions?.length && (
          <div className="unified-detail-chip-row">
            {ticket.affectedVersions.map((version) => <span key={version}>{version}</span>)}
          </div>
        )}
      </DetailSection>

      <DetailSection eyebrow="Permanent resolution" icon={CheckCircle2} title="Root cause and corrective action">
        <div className="unified-detail-stack">
          <div><span>Root cause</span><p>{valueOrFallback(ticket.problemRootCause)}</p></div>
          <div><span>Permanent fix</span><p>{valueOrFallback(ticket.problemPermanentFix)}</p></div>
        </div>
      </DetailSection>
    </div>
  )
}

function TypeOverview({ ticket }) {
  if (ticket.type === 'Service Request') return <RequestOverview ticket={ticket} />
  if (ticket.type === 'Change') return <ChangeOverview ticket={ticket} />
  if (ticket.type === 'Problem') return <ProblemOverview ticket={ticket} />
  return <IncidentOverview ticket={ticket} />
}

function activityActor(comment) {
  if (/^system:/i.test(comment)) return 'System'
  if (/^customer comment:/i.test(comment)) return 'Requester'
  if (/^work note:/i.test(comment)) return 'Hi5Central User'
  return 'Service Desk'
}

export function UnifiedRecordDetailView({
  addComment,
  currentUser,
  newComment,
  openAssetByName,
  openRecordTab,
  people,
  setNewComment,
  teams,
  ticket,
  tickets,
  transitionTicket,
  updateTicket,
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [noteMode, setNoteMode] = useState('work')
  const [transitionTarget, setTransitionTarget] = useState(null)
  const [transitionValues, setTransitionValues] = useState({})
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [assignmentGroupId, setAssignmentGroupId] = useState('')
  const [assignmentPersonId, setAssignmentPersonId] = useState('')
  const fileInputRef = useRef(null)
  const activityFileInputRef = useRef(null)
  const richEditorRef = useRef(null)
  const [richEditorText, setRichEditorText] = useState('')
  const [pendingActivityFiles, setPendingActivityFiles] = useState([])
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionOpen, setMentionOpen] = useState(false)
  const [composerNotice, setComposerNotice] = useState('')
  const meta = recordTypeMeta[ticket.type] || recordTypeMeta.Incident
  const lifecycleDefinition = getLifecycleDefinition(ticket.type)
  const lifecycle = lifecycleDefinition.stages
  const currentLifecycleIndex = getLifecycleIndex(ticket)
  const allowedTransitions = getAllowedTransitions(ticket)
  const transitionRequirements = transitionTarget
    ? getTransitionRequirements(ticket, transitionTarget, transitionValues)
    : []
  const transitionBlockers = transitionTarget
    ? getTransitionBlockers(ticket, transitionTarget, transitionValues)
    : []
  const tasks = useMemo(() => syntheticTasks(ticket), [ticket])
  const attachments = ticket.attachments || []
  const directoryPeople = Array.isArray(people) && people.length ? people : organisationPeople
  const directoryTeams = Array.isArray(teams) && teams.length ? teams : organisationTeams
  const actorName = currentUser?.name || 'Hi5Central User'

  const relatedRecords = useMemo(() => {
    const ids = relatedRecordIds(ticket, tickets)
    return tickets.filter((candidate) => ids.has(candidate.id))
  }, [ticket, tickets])

  const requesterRecords = useMemo(() => (
    tickets
      .filter((candidate) => candidate.id !== ticket.id && candidate.requester === ticket.requester)
      .slice(0, 6)
  ), [ticket, tickets])

  function beginTransition(targetStatus) {
    if (!targetStatus || targetStatus === ticket.status) return
    const requirements = getTransitionRequirements(ticket, targetStatus, {})
    const initialValues = Object.fromEntries(
      requirements.map((requirement) => [requirement.key, requirement.value]),
    )
    setTransitionTarget(targetStatus)
    setTransitionValues(initialValues)
  }

  function updateTransitionValue(key, nextValue) {
    setTransitionValues((current) => ({ ...current, [key]: nextValue }))
  }

  function confirmTransition() {
    if (!transitionTarget) return
    const result = transitionTicket
      ? transitionTicket(ticket.id, transitionTarget, transitionValues)
      : buildLifecycleTransition(ticket, transitionTarget, transitionValues, actorName)
    if (!result?.ok) return
    if (!transitionTicket) updateTicket(ticket.id, result.updates)
    setTransitionTarget(null)
    setTransitionValues({})
  }

  const activeAssignmentGroups = directoryTeams.filter((team) => team.active && team.departmentId === 'DEPT-TECH')
  const selectedAssignmentGroup = activeAssignmentGroups.find((team) => team.id === assignmentGroupId)
  const eligibleTechnicians = organisationPeople.filter((person) => (
    person.active
    && person.teamId === assignmentGroupId
    && ['technician', 'team_manager', 'department_manager', 'tenant_admin'].includes(person.accessProfile)
  ))

  function openAssignment() {
    const currentGroup = activeAssignmentGroups.find((group) => group.name === ticket.team)
    const currentPerson = directoryPeople.find((person) => person.name === ticket.assignee)
    setAssignmentGroupId(currentGroup?.id || '')
    setAssignmentPersonId(currentPerson?.teamId === currentGroup?.id ? currentPerson.id : '')
    setAssignmentOpen(true)
  }

  function saveAssignment() {
    if (!selectedAssignmentGroup) return
    const person = eligibleTechnicians.find((candidate) => candidate.id === assignmentPersonId)
    const nextAssignee = person?.name || 'Unassigned'
    const oldGroup = ticket.team || 'Unassigned'
    const oldAssignee = ticket.assignee || 'Unassigned'
    const assignmentNote = `System: Assignment changed from ${oldGroup} / ${oldAssignee} to ${selectedAssignmentGroup.name} / ${nextAssignee} by ${actorName}.`
    updateTicket(ticket.id, {
      team: selectedAssignmentGroup.name,
      assignee: nextAssignee,
      updated: 'Just now',
      comments: [assignmentNote, ...(ticket.comments || [])],
    })
    setAssignmentOpen(false)
  }

  function returnToGroup() {
    const assignmentNote = `System: ${ticket.assignee || 'Unassigned'} returned this record to ${ticket.team || 'the assignment group'} by ${actorName}.`
    updateTicket(ticket.id, {
      assignee: 'Unassigned',
      updated: 'Just now',
      comments: [assignmentNote, ...(ticket.comments || [])],
    })
  }

  function assignToMe() {
    const dana = directoryPeople.find((person) => person.name === actorName)
    const danaTeam = directoryTeams.find((team) => team.id === dana?.teamId)
    const assignmentNote = `System: ${ticket.team || 'Unassigned'} / ${ticket.assignee || 'Unassigned'} assigned to ${danaTeam?.name || 'Service Desk'} / ${actorName}.`
    const assignmentPatch = {
      team: danaTeam?.name || 'Service Desk',
      assignee: actorName,
      updated: 'Just now',
      comments: [assignmentNote, ...(ticket.comments || [])],
    }

    if (ticket.type === 'Incident' && ticket.status === 'New' && allowedTransitions.includes('Assigned')) {
      const result = buildLifecycleTransition({ ...ticket, ...assignmentPatch }, 'Assigned', {}, actorName)
      if (result.ok) {
        updateTicket(ticket.id, { ...assignmentPatch, ...result.updates })
        return
      }
    }
    updateTicket(ticket.id, assignmentPatch)
  }


  const mentionCandidates = useMemo(() => {
    if (!mentionOpen) return []
    const query = mentionQuery.trim().toLowerCase()
    return directoryPeople
      .filter((person) => person.active && person.name !== actorName)
      .filter((person) => !query || `${person.name} ${person.role} ${person.team}`.toLowerCase().includes(query))
      .slice(0, 6)
  }, [actorName, directoryPeople, mentionOpen, mentionQuery])

  function syncRichEditor() {
    const editor = richEditorRef.current
    if (!editor) return
    const text = (editor.innerText || '').replace(/\u00a0/g, ' ').trim()
    setRichEditorText(text)
    setNewComment?.(text)

    const match = (editor.innerText || '').match(/(?:^|\s)@([^@\n]{0,40})$/)
    setMentionOpen(Boolean(match))
    setMentionQuery(match?.[1] || '')
  }

  function runEditorCommand(command, value = null) {
    richEditorRef.current?.focus()
    document.execCommand(command, false, value)
    syncRichEditor()
  }

  function addLink() {
    const url = window.prompt('Paste the link URL')
    if (!url) return
    runEditorCommand('createLink', url)
  }

  function addSimpleTable() {
    richEditorRef.current?.focus()
    insertHtmlAtSelection('<table><tbody><tr><th>Column 1</th><th>Column 2</th></tr><tr><td>Value</td><td>Value</td></tr></tbody></table><p><br></p>')
    syncRichEditor()
  }

  async function queueActivityFiles(files) {
    const incoming = Array.from(files || [])
    if (!incoming.length) return
    setComposerNotice('')

    const created = []
    for (const file of incoming) {
      const id = `${ticket.id}-ACTFILE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const storageKey = `activity:${id}`
      try {
        await storeLocalAttachment(storageKey, file)
        created.push({ id, storageKey, name: file.name || `Pasted ${file.type || 'file'}`, size: file.size || 0, type: file.type || 'application/octet-stream' })
      } catch {
        setComposerNotice('One or more files could not be stored in this browser. Try a smaller file or use the file picker again.')
      }
    }
    if (created.length) setPendingActivityFiles((current) => [...current, ...created])
  }

  function removePendingActivityFile(file) {
    setPendingActivityFiles((current) => current.filter((item) => item.id !== file.id))
    if (file.storageKey) removeLocalAttachment(file.storageKey).catch(() => {})
  }

  async function handleRichPaste(event) {
    const clipboard = event.clipboardData
    if (!clipboard) return
    const fileItems = Array.from(clipboard.items || []).filter((item) => item.kind === 'file')
    const files = fileItems.map((item) => item.getAsFile()).filter(Boolean)
    const html = clipboard.getData('text/html')
    const text = clipboard.getData('text/plain')

    if (files.length) {
      event.preventDefault()
      await queueActivityFiles(files)
      if (text && !html) insertHtmlAtSelection(`<p>${text.replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[character])).replace(/\n/g, '<br>')}</p>`)
      syncRichEditor()
      return
    }

    if (html) {
      event.preventDefault()
      insertHtmlAtSelection(html)
      syncRichEditor()
    }
  }

  async function handleRichDrop(event) {
    const files = Array.from(event.dataTransfer?.files || [])
    if (!files.length) return
    event.preventDefault()
    await queueActivityFiles(files)
  }

  function insertMention(person) {
    richEditorRef.current?.focus()
    const selection = window.getSelection?.()
    const anchor = selection?.anchorNode
    const offset = selection?.anchorOffset || 0
    if (anchor?.nodeType === Node.TEXT_NODE) {
      const before = anchor.textContent.slice(0, offset)
      const after = anchor.textContent.slice(offset)
      const replaced = before.replace(/@[^@\n]{0,40}$/, `@${person.name} `)
      anchor.textContent = `${replaced}${after}`
      const range = document.createRange()
      range.setStart(anchor, replaced.length)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    } else {
      document.execCommand('insertText', false, `@${person.name} `)
    }
    setMentionOpen(false)
    setMentionQuery('')
    syncRichEditor()
  }

  function submitRichActivity() {
    const editor = richEditorRef.current
    if (!editor) return
    const html = sanitizeRichHtml(editor.innerHTML)
    const text = htmlToPlainText(html)
    if (!text && !pendingActivityFiles.length) return

    const mentions = directoryPeople
      .filter((person) => text.includes(`@${person.name}`))
      .map((person) => ({ id: person.id, name: person.name, email: person.email }))

    addComment(noteMode, {
      html,
      text,
      mentions,
      attachments: pendingActivityFiles,
    })
    editor.innerHTML = ''
    setRichEditorText('')
    setNewComment?.('')
    setPendingActivityFiles([])
    setMentionOpen(false)
    setMentionQuery('')
    setComposerNotice('')
  }


  async function attachFiles(event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    const created = []
    for (const file of files) {
      const id = `${ticket.id}-ATT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const storageKey = `attachment:${id}`
      try {
        await storeLocalAttachment(storageKey, file)
        created.push({
          id,
          storageKey,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          uploaded: 'Just now',
          uploadedBy: actorName,
        })
      } catch {
        created.push({
          id,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          uploaded: 'Just now',
          uploadedBy: actorName,
          storageError: true,
        })
      }
    }
    updateTicket(ticket.id, { attachments: [...created, ...attachments] })
    event.target.value = ''
  }

  function removeAttachment(id) {
    const attachment = attachments.find((item) => item.id === id)
    if (attachment?.storageKey) removeLocalAttachment(attachment.storageKey).catch(() => {})
    const nextActivities = (ticket.activities || []).map((activity) => ({
      ...activity,
      attachments: (activity.attachments || []).filter((item) => item.id !== id),
    }))
    updateTicket(ticket.id, {
      attachments: attachments.filter((item) => item.id !== id),
      activities: nextActivities,
    })
  }

  function renderWorkflowPanel() {
    if (!transitionTarget) return null

    return (
      <section className={`unified-detail-workflow-panel lifecycle-transition-panel ${transitionBlockers.length ? 'blocked' : ''}`}>
        <div className="lifecycle-transition-heading">
          <div>
            <span className="eyebrow">Lifecycle transition</span>
            <h3>{ticket.status} <ChevronRight size={18} /> {transitionTarget}</h3>
            <p>Hi5Central validates this transition before the record can move forward. Required information is written back to the record and the change is added to Activity automatically.</p>
          </div>
          <span className="lifecycle-rule-chip">Workflow controlled</span>
        </div>

        {transitionRequirements.length > 0 && (
          <div className="unified-detail-form-grid two lifecycle-transition-fields">
            {transitionRequirements.map((requirement) => {
              const fieldValue = transitionValues[requirement.key] ?? requirement.value ?? ''
              if (requirement.type === 'checkbox') {
                return (
                  <label className="lifecycle-confirmation" key={requirement.key}>
                    <input checked={Boolean(fieldValue)} onChange={(event) => updateTransitionValue(requirement.key, event.target.checked)} type="checkbox" />
                    <span><strong>{requirement.label}</strong>{requirement.description && <small>{requirement.description}</small>}</span>
                  </label>
                )
              }
              if (requirement.type === 'select') {
                return (
                  <label key={requirement.key}>{requirement.label}<select value={fieldValue} onChange={(event) => updateTransitionValue(requirement.key, event.target.value)}>{(requirement.options || []).map((option) => <option key={option}>{option}</option>)}</select></label>
                )
              }
              if (requirement.type === 'text' || requirement.type === 'datetime-local') {
                return (
                  <label key={requirement.key}>{requirement.label}<input type={requirement.type} value={fieldValue} placeholder={requirement.placeholder} onChange={(event) => updateTransitionValue(requirement.key, event.target.value)} /></label>
                )
              }
              return (
                <label key={requirement.key}>{requirement.label}<textarea value={fieldValue} placeholder={requirement.placeholder} onChange={(event) => updateTransitionValue(requirement.key, event.target.value)} /></label>
              )
            })}
          </div>
        )}

        {transitionBlockers.length > 0 && (
          <div className="lifecycle-transition-blockers" role="alert">
            <AlertCircle size={18} />
            <div><strong>This transition is not ready yet</strong>{transitionBlockers.map((blocker) => <span key={blocker}>{blocker}</span>)}</div>
          </div>
        )}

        {!transitionRequirements.length && !transitionBlockers.length && (
          <div className="lifecycle-transition-ready"><CheckCircle2 size={18} /><span><strong>Ready to transition</strong>No additional information is required for this status change.</span></div>
        )}

        <footer>
          <button onClick={() => { setTransitionTarget(null); setTransitionValues({}) }} type="button">Cancel</button>
          <button className="primary-action compact" disabled={transitionBlockers.length > 0} onClick={confirmTransition} type="button">{transitionLabel(transitionTarget)}</button>
        </footer>
      </section>
    )
  }


  function renderOverview() {
    return (
      <div className="unified-detail-overview-layout">
        <div className="unified-detail-overview-main">
          <DetailSection eyebrow={`${meta.label} summary`} icon={FileText} title="Description">
            <p className="unified-detail-description">{ticket.description}</p>
            <div className="unified-detail-callout next-step"><span>Next action</span><strong>{valueOrFallback(ticket.nextStep, 'Review and progress this record.')}</strong></div>
          </DetailSection>
          <TypeOverview ticket={ticket} />
        </div>

        <aside className="unified-detail-context-column">
          <DetailSection eyebrow="Requester" icon={UserRound} title={ticket.requester} className="requester">
            <div className="unified-detail-requester">
              <span className="unified-detail-avatar">{initials(ticket.requester)}</span>
              <div>
                <strong>{ticket.requester}</strong>
                <span>{ticket.requesterEmail || ticket.requesterJobTitle || 'Requester / stakeholder'}</span>
                {ticket.requesterDepartment && <small>{ticket.requesterDepartment}</small>}
              </div>
            </div>
          </DetailSection>

          <DetailSection eyebrow="Record context" icon={Users} title="Assignment & service">
            <div className="unified-detail-property-grid one">
              <DetailProperty label="Assignment group" value={ticket.team} />
              <DetailProperty label="Assigned to" value={ticket.assignee} />
              <DetailProperty label="Service" value={ticket.service} />
              <DetailProperty label="Location" value={ticket.location} />
            </div>
          </DetailSection>

          {ticket.rmmDeviceId && (
            <DetailSection eyebrow="Hi5Central RMM" icon={Monitor} title="Managed device">
              <div className="unified-rmm-context">
                <span className="unified-rmm-device-icon"><Monitor size={18} /></span>
                <div>
                  <strong>{ticket.rmmDeviceName || ticket.rmmDeviceId}</strong>
                  <small>{ticket.rmmDeviceId}{ticket.rmmAlertId ? ` · Alert ${ticket.rmmAlertId}` : ''}</small>
                  <span>{ticket.rmmSource || 'Linked RMM device context'}</span>
                </div>
              </div>
              <a className="unified-rmm-open-link" href={rmmDeviceHref(ticket.rmmDeviceId)} target="_blank" rel="noreferrer">
                Open managed device in RMM <ExternalLink size={14} />
              </a>
            </DetailSection>
          )}

          <DetailSection eyebrow="Audit" icon={CalendarClock} title="Record timing">
            <div className="unified-detail-property-grid one">
              <DetailProperty label="Created" value={ticket.created} />
              <DetailProperty label="Updated" value={ticket.updated} />
              <DetailProperty label={ticket.type === 'Change' ? 'Window / target' : 'SLA / target'} value={ticket.type === 'Change' ? ticket.window || ticket.sla : ticket.sla} />
            </div>
          </DetailSection>
        </aside>
      </div>
    )
  }

  function renderActivity() {
    const structuredActivities = (ticket.activities || []).map((activity) => ({ ...activity, structured: true }))
    const legacyActivities = (ticket.comments || []).map((comment, index) => ({
      id: `${ticket.id}-legacy-${index}`,
      structured: false,
      actor: activityActor(comment),
      text: comment,
      createdLabel: index === 0 ? ticket.updated : 'Earlier',
    }))
    const activityItems = [...structuredActivities, ...legacyActivities]

    return (
      <div className="unified-detail-activity-layout">
        <DetailSection eyebrow="Conversation" icon={MessageSquarePlus} title="Add activity">
          <div className="unified-detail-note-toggle" role="group" aria-label="Activity type">
            <button className={noteMode === 'work' ? 'active' : ''} onClick={() => setNoteMode('work')} type="button">Internal work note</button>
            <button className={noteMode === 'customer' ? 'active' : ''} onClick={() => setNoteMode('customer')} type="button">Customer comment</button>
          </div>

          <div className={`rich-activity-composer ${noteMode}`} onDragOver={(event) => event.preventDefault()} onDrop={handleRichDrop}>
            <div className="rich-activity-toolbar" aria-label="Formatting tools">
              <button aria-label="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => runEditorCommand('bold')} type="button"><Bold size={15} /></button>
              <button aria-label="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => runEditorCommand('italic')} type="button"><Italic size={15} /></button>
              <button aria-label="Bulleted list" onMouseDown={(event) => event.preventDefault()} onClick={() => runEditorCommand('insertUnorderedList')} type="button"><List size={15} /></button>
              <button aria-label="Numbered list" onMouseDown={(event) => event.preventDefault()} onClick={() => runEditorCommand('insertOrderedList')} type="button"><ListOrdered size={15} /></button>
              <button aria-label="Insert link" onMouseDown={(event) => event.preventDefault()} onClick={addLink} type="button"><Link2 size={15} /></button>
              <button aria-label="Insert table" onMouseDown={(event) => event.preventDefault()} onClick={addSimpleTable} type="button"><Table2 size={15} /></button>
              <span className="rich-activity-toolbar-divider" />
              <button aria-label="Attach any file" onClick={() => activityFileInputRef.current?.click()} type="button"><FileUp size={15} /></button>
              <button className="rich-activity-mention-hint" aria-label="Mention a person" onMouseDown={(event) => event.preventDefault()} onClick={() => { richEditorRef.current?.focus(); document.execCommand('insertText', false, '@'); syncRichEditor() }} type="button"><AtSign size={15} /></button>
              <input hidden multiple ref={activityFileInputRef} type="file" onChange={async (event) => { await queueActivityFiles(event.target.files); event.target.value = '' }} />
            </div>

            <div className="rich-activity-editor-wrap">
              {!richEditorText && !richEditorRef.current?.innerText && <span className="rich-activity-placeholder">{noteMode === 'work' ? 'Add troubleshooting, handover or investigation notes… Paste screenshots, files, tables or formatted content directly here.' : 'Write an update visible to the requester… You can paste screenshots, files, tables and formatted content.'}</span>}
              <div
                aria-label={noteMode === 'work' ? 'Internal work note' : 'Customer comment'}
                className="rich-activity-editor"
                contentEditable
                onInput={syncRichEditor}
                onPaste={handleRichPaste}
                ref={richEditorRef}
                role="textbox"
                suppressContentEditableWarning
              />
              {mentionOpen && (
                <div className="rich-mention-menu">
                  <span>Mention someone</span>
                  {mentionCandidates.length ? mentionCandidates.map((person) => (
                    <button key={person.id} onMouseDown={(event) => { event.preventDefault(); insertMention(person) }} type="button">
                      <span className="unified-detail-avatar small">{initials(person.name)}</span>
                      <span><strong>{person.name}</strong><small>{person.role} · {person.team}</small></span>
                    </button>
                  )) : <p>No matching people</p>}
                </div>
              )}
            </div>

            {pendingActivityFiles.length > 0 && (
              <div className="rich-activity-pending-files">
                {pendingActivityFiles.map((file) => (
                  <div key={file.id} className={String(file.type).startsWith('image/') ? 'image-file' : ''}>
                    {String(file.type).startsWith('image/') ? <Image size={16} /> : <FileText size={16} />}
                    <span><strong>{file.name}</strong><small>{fileSize(file.size)}</small></span>
                    <button aria-label={`Remove ${file.name}`} onClick={() => removePendingActivityFile(file)} type="button"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            {composerNotice && <div className="rich-activity-notice"><AlertCircle size={15} />{composerNotice}</div>}
            <div className="unified-detail-comment-actions rich">
              <span>{noteMode === 'work' ? 'Visible to technicians only · @mentions notify colleagues' : 'Requester-facing update · internal notes remain hidden'}</span>
              <button className="primary-action compact" disabled={!richEditorText.trim() && !pendingActivityFiles.length} onClick={submitRichActivity} type="button"><Send size={15} /> Add {noteMode === 'work' ? 'work note' : 'comment'}</button>
            </div>
          </div>
        </DetailSection>

        <DetailSection eyebrow="Timeline" icon={Clock3} title="Activity history">
          <div className="unified-detail-timeline rich-timeline">
            {activityItems.length ? activityItems.map((activity, index) => (
              <article className={activity.structured ? `rich-activity-item ${activity.kind || 'work'}` : ''} key={activity.id || `${ticket.id}-activity-${index}`}>
                <span className="unified-detail-timeline-marker" />
                <div>
                  <header>
                    <strong>{activity.actor || activityActor(activity.text)}</strong>
                    <span>{activity.createdLabel || activity.createdAtLabel || (index === 0 ? ticket.updated : 'Earlier')}</span>
                  </header>
                  {activity.structured ? (
                    <>
                      <div className="rich-activity-meta"><span className={activity.kind === 'customer' ? 'customer' : 'internal'}>{activity.kind === 'customer' ? 'Customer comment' : 'Internal work note'}</span>{activity.mentions?.length > 0 && <span><AtSign size={12} /> {activity.mentions.map((mention) => mention.name).join(', ')}</span>}</div>
                      {activity.html && <div className="rich-activity-content" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(activity.html) }} />}
                      {activity.attachments?.length > 0 && (
                        <div className="rich-activity-attachments">
                          {activity.attachments.filter((attachment) => String(attachment.type).startsWith('image/')).map((attachment) => <LocalAttachmentLink attachment={attachment} imagePreview key={attachment.id} />)}
                          {activity.attachments.filter((attachment) => !String(attachment.type).startsWith('image/')).map((attachment) => <LocalAttachmentLink attachment={attachment} key={attachment.id} />)}
                        </div>
                      )}
                    </>
                  ) : <p>{activity.text}</p>}
                </div>
              </article>
            )) : <p className="unified-detail-empty-copy">No activity has been recorded yet.</p>}
          </div>
        </DetailSection>
      </div>
    )
  }

  function renderTasks() {
    const completed = tasks.filter((task) => task.status === 'Completed').length
    return (
      <div className="unified-detail-task-layout">
        <div className="unified-detail-tab-intro">
          <div><span className="eyebrow">Work management</span><h3>Tasks</h3><p>{ticket.type === 'Service Request' ? 'Fulfilment tasks and workflow dependencies attached to this request.' : `Operational task plan for this ${meta.label.toLowerCase()}.`}</p></div>
          <div><strong>{completed}/{tasks.length}</strong><span>complete</span></div>
        </div>
        {tasks.length ? (
          <div className="unified-detail-task-list">
            {tasks.map((task, index) => (
              <article key={task.id || `${ticket.id}-task-${index}`}>
                <div className="unified-detail-task-number">{index + 1}</div>
                <div className="unified-detail-task-main">
                  <header><strong>{task.title}</strong><span className={`unified-detail-state ${statusClass(task.status || 'Waiting')}`}>{task.status || 'Waiting'}</span></header>
                  <p>{task.instructions}</p>
                  <dl>
                    <div><dt>Team</dt><dd>{task.team || ticket.team}</dd></div>
                    <div><dt>Assignee</dt><dd>{task.assignee || 'Unassigned'}</dd></div>
                    <div><dt>Due</dt><dd>{task.due || 'Not set'}</dd></div>
                    {!!task.dependsOn?.length && <div><dt>Depends on</dt><dd>{task.dependsOn.join(', ')}</dd></div>}
                  </dl>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="unified-detail-empty"><ListChecks size={22} /><strong>No tasks yet</strong><span>Tasks created by workflow or fulfilment will appear here.</span></div>}
      </div>
    )
  }

  function renderRelated() {
    const assets = ticket.linkedAssets || []
    return (
      <div className="unified-detail-related-grid">
        <DetailSection eyebrow="Relationships" icon={Share2} title="Related ITSM records">
          {relatedRecords.length ? (
            <div className="unified-detail-related-list">
              {relatedRecords.map((record) => (
                <button key={record.id} onClick={() => openRecordTab?.(record)} type="button">
                  <span><strong>{record.id}</strong><small>{record.type}</small></span>
                  <span className={`status-pill ${statusClass(record.status)}`}>{record.status}</span>
                  <span className="unified-detail-related-title">{record.title}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          ) : <p className="unified-detail-empty-copy">No ITSM record relationships are linked yet.</p>}
        </DetailSection>

        <DetailSection eyebrow="Configuration" icon={Server} title="Affected configuration items">
          {assets.length ? (
            <div className="unified-detail-ci-list">
              {assets.map((asset) => (
                <button key={asset} onClick={() => openAssetByName?.(asset)} type="button"><span><Server size={16} /><strong>{asset}</strong></span><ChevronRight size={16} /></button>
              ))}
            </div>
          ) : <p className="unified-detail-empty-copy">No configuration items are linked yet.</p>}
        </DetailSection>

        <DetailSection eyebrow="Requester history" icon={UserRound} title={`Other records for ${ticket.requester}`}>
          {requesterRecords.length ? (
            <div className="unified-detail-requester-records">
              {requesterRecords.map((record) => (
                <button key={record.id} onClick={() => openRecordTab?.(record)} type="button">
                  <span><strong>{record.id}</strong><small>{record.type}</small></span>
                  <span>{record.title}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          ) : <p className="unified-detail-empty-copy">No other current records were found for this requester.</p>}
        </DetailSection>
      </div>
    )
  }

  function renderAttachments() {
    return (
      <div className="unified-detail-attachment-layout">
        <div className="unified-detail-tab-intro">
          <div><span className="eyebrow">Files</span><h3>Attachments</h3><p>Screenshots, approvals, diagnostics and supporting documents remain attached to the record.</p></div>
          <button className="primary-action compact" onClick={() => fileInputRef.current?.click()} type="button"><Plus size={15} /> Add attachment</button>
          <input hidden multiple ref={fileInputRef} type="file" onChange={attachFiles} />
        </div>
        {attachments.length ? (
          <div className="unified-detail-attachment-list">
            {attachments.map((attachment) => (
              <article key={attachment.id}>
                <span className="unified-detail-file-icon"><FileText size={18} /></span>
                <div className="unified-detail-attachment-copy"><strong>{attachment.name}</strong><small>{fileSize(attachment.size)} · {attachment.uploadedBy || 'Service Desk'} · {attachment.uploaded || 'Previously'}</small>{(attachment.storageKey || attachment.dataUrl) && <LocalAttachmentLink attachment={attachment} />}</div>
                <button aria-label={`Remove ${attachment.name}`} onClick={() => removeAttachment(attachment.id)} type="button"><Trash2 size={15} /></button>
              </article>
            ))}
          </div>
        ) : <div className="unified-detail-empty"><Paperclip size={23} /><strong>No attachments</strong><span>Add screenshots, logs, approval evidence or supporting files to this record.</span><button className="secondary-action" onClick={() => fileInputRef.current?.click()} type="button">Choose files</button></div>}
      </div>
    )
  }

  const activePanel = activeTab === 'activity'
    ? renderActivity()
    : activeTab === 'tasks'
      ? renderTasks()
      : activeTab === 'related'
        ? renderRelated()
        : activeTab === 'attachments'
          ? renderAttachments()
          : renderOverview()

  return (
    <div className={`unified-detail-page ${meta.className}`}>
      <div className="unified-detail-shell">
        <header className="unified-detail-header">
          <div className="unified-detail-identity">
            <div className="unified-detail-reference-row">
              <span>{ticket.id}</span>
              <span>{meta.label}</span>
              <span>Updated {ticket.updated}</span>
            </div>
            <h2>{ticket.title}</h2>
            <div className="unified-detail-badges">
              <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
              <span className={`unified-detail-priority ${priorityClass(ticket.priority)}`}><span className={`priority-dot ${priorityClass(ticket.priority)}`} />{ticket.priority}</span>
              <span>{ticket.service}</span>
              <span>{ticket.team}</span>
            </div>
          </div>

          <div className="unified-detail-header-actions">
            <button onClick={assignToMe} type="button"><UserCheck size={15} /> Take ownership</button>
            <button onClick={openAssignment} type="button"><Users size={15} /> Assign / transfer</button>
            {ticket.assignee && ticket.assignee !== 'Unassigned' && <button onClick={returnToGroup} type="button"><Inbox size={15} /> Return to group</button>}
            {ticket.type === 'Incident' && allowedTransitions.includes('In Progress') && <button onClick={() => beginTransition('In Progress')} type="button"><Wrench size={15} /> Start / resume work</button>}
            {ticket.type === 'Incident' && allowedTransitions.includes('Pending') && <button onClick={() => beginTransition('Pending')} type="button"><Clock3 size={15} /> Pending</button>}
            {ticket.type === 'Incident' && allowedTransitions.includes('Resolved') && <button className="primary" onClick={() => beginTransition('Resolved')} type="button"><CheckCircle2 size={15} /> Resolve</button>}
            {ticket.type === 'Incident' && allowedTransitions.includes('Closed') && <button className="primary" onClick={() => beginTransition('Closed')} type="button"><CheckCircle2 size={15} /> Close</button>}
            <label className="unified-detail-status-control">
              <span>Next status</span>
              <select disabled={!allowedTransitions.length} value={transitionTarget || ''} onChange={(event) => beginTransition(event.target.value)}>
                <option value="">{allowedTransitions.length ? 'Choose transition…' : 'No further transitions'}</option>
                {allowedTransitions.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
          </div>
        </header>

        <div className={`unified-detail-lifecycle ${ticket.type === 'Change' && ticket.status === 'Failed' ? 'has-exception' : ''}`.trim()} aria-label={`${meta.label} lifecycle`}>
          {lifecycle.map((status, index) => {
            const complete = index < currentLifecycleIndex
            const current = index === currentLifecycleIndex && ticket.status !== 'Failed'
            return (
              <div className={current ? 'current' : complete ? 'complete' : ''} key={status}>
                <span>{complete ? '✓' : index + 1}</span>
                <strong>{status}</strong>
              </div>
            )
          })}
          {ticket.type === 'Change' && ticket.status === 'Failed' && <div className="exception current"><span>!</span><strong>Failed</strong></div>}
        </div>

        {assignmentOpen && (
          <section className="unified-assignment-panel" aria-label="Assign record">
            <div className="unified-assignment-heading">
              <div><span className="eyebrow">Ownership</span><h3>Assign or transfer record</h3><p>Select the assignment group first. Only active technicians who belong to that group can then be selected.</p></div>
              <button onClick={() => setAssignmentOpen(false)} type="button">Cancel</button>
            </div>
            <div className="unified-assignment-fields">
              <label>Assignment group
                <select value={assignmentGroupId} onChange={(event) => { setAssignmentGroupId(event.target.value); setAssignmentPersonId('') }}>
                  <option value="">Select group…</option>
                  {activeAssignmentGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
              </label>
              <label>Technician
                <select disabled={!assignmentGroupId} value={assignmentPersonId} onChange={(event) => setAssignmentPersonId(event.target.value)}>
                  <option value="">Unassigned / group queue</option>
                  {eligibleTechnicians.map((person) => <option key={person.id} value={person.id}>{person.name} — {person.role}</option>)}
                </select>
              </label>
            </div>
            {selectedAssignmentGroup && <div className="unified-assignment-summary"><Users size={17} /><span><strong>{selectedAssignmentGroup.name}</strong>{assignmentPersonId ? `Assigned to ${eligibleTechnicians.find((person) => person.id === assignmentPersonId)?.name}` : 'Returned to the group queue'}</span></div>}
            <footer><button disabled={!assignmentGroupId} className="primary-action compact" onClick={saveAssignment} type="button">Save assignment</button></footer>
          </section>
        )}

        {renderWorkflowPanel()}

        <nav className="unified-detail-tabs" aria-label="Record sections">
          {commonTabs.map(({ id, label, icon: Icon }) => (
            <button className={activeTab === id ? 'active' : ''} key={id} onClick={() => setActiveTab(id)} type="button">
              <Icon size={16} />
              <span>{label}</span>
              {id === 'tasks' && <b>{tasks.length}</b>}
              {id === 'related' && <b>{relatedRecords.length}</b>}
              {id === 'attachments' && <b>{attachments.length}</b>}
            </button>
          ))}
        </nav>

        <main className="unified-detail-panel">{activePanel}</main>
      </div>
    </div>
  )
}

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

const lifecycleDefinitions = {
  Incident: {
    label: 'Incident',
    stages: ['New', 'Assigned', 'In Progress', 'Pending', 'Resolved', 'Closed'],
    aliases: { Monitoring: 'In Progress' },
    transitions: {
      New: ['Assigned', 'In Progress'],
      Assigned: ['In Progress', 'New'],
      'In Progress': ['Pending', 'Resolved'],
      Pending: ['In Progress', 'Resolved'],
      Resolved: ['Closed', 'In Progress'],
      Closed: [],
    },
  },
  'Service Request': {
    label: 'Service Request',
    stages: ['New', 'Pending Approval', 'Approved', 'In Progress', 'Completed', 'Closed'],
    aliases: {
      'Awaiting Approval': 'Pending Approval',
      Fulfilment: 'In Progress',
      Resolved: 'Completed',
    },
    transitions: {
      New: ['Pending Approval', 'In Progress'],
      'Pending Approval': ['Approved'],
      Approved: ['In Progress'],
      'In Progress': ['Completed'],
      Completed: ['Closed', 'In Progress'],
      Closed: [],
    },
  },
  Change: {
    label: 'Change',
    stages: ['Draft', 'Pending Approval', 'CAB Review', 'Scheduled', 'In Progress', 'Review', 'Closed'],
    aliases: {
      Assessment: 'Draft',
      'Awaiting Approval': 'Pending Approval',
      Implementing: 'In Progress',
      Completed: 'Review',
    },
    transitions: {
      Draft: ['Pending Approval'],
      'Pending Approval': ['CAB Review', 'Draft'],
      'CAB Review': ['Scheduled', 'Draft'],
      Scheduled: ['In Progress', 'Draft'],
      'In Progress': ['Review', 'Failed'],
      Failed: ['Review', 'Draft'],
      Review: ['Closed', 'In Progress'],
      Closed: [],
    },
  },
  Problem: {
    label: 'Problem',
    stages: ['New', 'Under Investigation', 'Known Error', 'Fix in Progress', 'Resolved', 'Closed'],
    aliases: {
      Investigating: 'Under Investigation',
      'Resolution in Progress': 'Fix in Progress',
    },
    transitions: {
      New: ['Under Investigation'],
      'Under Investigation': ['Known Error', 'Fix in Progress'],
      'Known Error': ['Fix in Progress', 'Under Investigation'],
      'Fix in Progress': ['Resolved', 'Under Investigation'],
      Resolved: ['Closed', 'Under Investigation'],
      Closed: [],
    },
  },
}

const nextStepByType = {
  Incident: {
    Assigned: 'Begin diagnosis and restore service.',
    'In Progress': 'Continue diagnosis and restoration work.',
    Pending: 'Resume work when the pending dependency is cleared.',
    Resolved: 'Confirm service restoration with the requester before closure.',
    Closed: 'Incident closed. No further action is required.',
    New: 'Triage the incident and assign an owner.',
  },
  'Service Request': {
    'Pending Approval': 'Obtain the required approval before fulfilment starts.',
    Approved: 'Release the request into fulfilment.',
    'In Progress': 'Complete the remaining fulfilment tasks.',
    Completed: 'Confirm the requested service has been delivered.',
    Closed: 'Service request closed. No further action is required.',
  },
  Change: {
    'Pending Approval': 'Review the implementation plan and submit for approval.',
    'CAB Review': 'Complete CAB review and confirm the implementation window.',
    Scheduled: 'Prepare for the approved implementation window.',
    'In Progress': 'Execute the approved implementation and validation plan.',
    Failed: 'Stabilise the service, complete backout actions and document the failure.',
    Review: 'Complete post-implementation review and capture the outcome.',
    Closed: 'Change closed. No further action is required.',
    Draft: 'Complete the change plan and resubmit when ready.',
  },
  Problem: {
    'Under Investigation': 'Investigate recurring symptoms and validate the working hypothesis.',
    'Known Error': 'Use the documented workaround while a permanent fix is progressed.',
    'Fix in Progress': 'Coordinate and validate the permanent corrective action.',
    Resolved: 'Confirm the root cause and permanent fix before closure.',
    Closed: 'Problem closed. No further action is required.',
  },
}

function normalizeStatus(type, status) {
  const definition = lifecycleDefinitions[type] || lifecycleDefinitions.Incident
  return definition.aliases?.[status] || status
}

export function getLifecycleDefinition(type) {
  return lifecycleDefinitions[type] || lifecycleDefinitions.Incident
}

export function getLifecycleStages(ticket) {
  return getLifecycleDefinition(ticket?.type).stages
}

export function getLifecycleStatus(ticket) {
  return normalizeStatus(ticket?.type, ticket?.status)
}

export function getLifecycleIndex(ticket) {
  const definition = getLifecycleDefinition(ticket?.type)
  const status = getLifecycleStatus(ticket)
  if (status === 'Failed' && ticket?.type === 'Change') {
    return definition.stages.indexOf('In Progress')
  }
  const index = definition.stages.indexOf(status)
  return index >= 0 ? index : 0
}

export function getAllowedTransitions(ticket) {
  const definition = getLifecycleDefinition(ticket?.type)
  return definition.transitions[getLifecycleStatus(ticket)] || []
}

function value(ticket, values, key, fallback = '') {
  const supplied = values?.[key]
  if (supplied !== undefined && supplied !== null) return supplied
  return ticket?.[key] ?? fallback
}


function normalizeDateTimeLocal(input) {
  if (!input) return ''
  const value = String(input).trim()
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return value.slice(0, 16)

  const match = value.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s*[·,-]?\s*(\d{2}):(\d{2})/)
  if (!match) return ''
  const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }
  const month = months[match[2]]
  if (!month) return ''
  return `${match[3]}-${month}-${String(match[1]).padStart(2, '0')}T${match[4]}:${match[5]}`
}

function textRequirement(key, label, ticket, values, options = {}) {
  return {
    key,
    label,
    type: options.type || 'textarea',
    placeholder: options.placeholder || '',
    options: options.options,
    value: options.type === 'datetime-local'
      ? normalizeDateTimeLocal(value(ticket, values, key, options.defaultValue || ''))
      : value(ticket, values, key, options.defaultValue || ''),
  }
}

function checkboxRequirement(key, label, values, description) {
  return {
    key,
    label,
    type: 'checkbox',
    description,
    value: Boolean(values?.[key]),
  }
}

export function getTransitionRequirements(ticket, targetStatus, values = {}) {
  const type = ticket?.type || 'Incident'
  const current = getLifecycleStatus(ticket)

  if (type === 'Incident') {
    if (targetStatus === 'Pending') {
      return [textRequirement('pendingReason', 'Pending reason', ticket, values, { type: 'select', options: incidentPendingReasons, defaultValue: incidentPendingReasons[0] })]
    }
    if (targetStatus === 'Resolved') {
      return [
        textRequirement('resolutionCode', 'Resolution code', ticket, values, { type: 'select', options: incidentResolutionCodes, defaultValue: incidentResolutionCodes[0] }),
        textRequirement('resolutionNotes', 'Resolution notes', ticket, values, { placeholder: 'What restored the service?' }),
      ]
    }
    if (targetStatus === 'In Progress' && current === 'Resolved') {
      return [textRequirement('reopenReason', 'Reopen reason', ticket, values, { placeholder: 'Why does this incident need more work?' })]
    }
  }

  if (type === 'Service Request') {
    if (targetStatus === 'Approved') {
      return [
        checkboxRequirement('approvalConfirmation', 'Confirm required approvals have been received', values, 'Pending approvals will be marked approved and recorded in the activity timeline.'),
        textRequirement('approvalNote', 'Approval note', ticket, values, { type: 'text', placeholder: 'Optional approval reference or note' }),
      ]
    }
    if (targetStatus === 'Completed') {
      return [textRequirement('completionNotes', 'Fulfilment summary', ticket, values, { placeholder: 'What was delivered and how was completion confirmed?' })]
    }
    if (targetStatus === 'In Progress' && current === 'Completed') {
      return [textRequirement('reopenReason', 'Reopen reason', ticket, values, { placeholder: 'Why does fulfilment need to resume?' })]
    }
  }

  if (type === 'Change') {
    if (targetStatus === 'Pending Approval') {
      return [
        textRequirement('businessReason', 'Business reason', ticket, values, { placeholder: 'Why is this change required?' }),
        textRequirement('implementationPlan', 'Implementation plan', ticket, values, { placeholder: 'How will the change be implemented?' }),
        textRequirement('testPlan', 'Validation / test plan', ticket, values, { placeholder: 'How will success be verified?' }),
        textRequirement('backoutPlan', 'Backout plan', ticket, values, { placeholder: 'How will the service be restored if implementation fails?' }),
      ]
    }
    if (targetStatus === 'Scheduled') {
      return [
        checkboxRequirement('cabApproved', 'Confirm CAB / required approval has been received', values, 'The approval decision will be recorded against the change.'),
        textRequirement('plannedStart', 'Planned start', ticket, values, { type: 'datetime-local' }),
        textRequirement('plannedEnd', 'Planned end', ticket, values, { type: 'datetime-local' }),
      ]
    }
    if (targetStatus === 'Review') {
      return [textRequirement('implementationNotes', 'Implementation outcome', ticket, values, { placeholder: current === 'Failed' ? 'Summarise the failure, recovery and current service state.' : 'Summarise implementation and validation results.' })]
    }
    if (targetStatus === 'Failed') {
      return [
        textRequirement('failureReason', 'Failure reason', ticket, values, { placeholder: 'What prevented successful implementation?' }),
        textRequirement('backoutOutcome', 'Backout / recovery outcome', ticket, values, { placeholder: 'What was backed out or recovered, and what is the current service state?' }),
      ]
    }
    if (targetStatus === 'Closed') {
      return [textRequirement('reviewOutcome', 'Post-implementation review outcome', ticket, values, { placeholder: 'Capture the final outcome, lessons learned and any follow-up actions.' })]
    }
    if (targetStatus === 'Draft' && current !== 'Draft') {
      return [textRequirement('reworkReason', 'Reason for returning to Draft', ticket, values, { placeholder: 'What needs to be changed before resubmission?' })]
    }
    if (targetStatus === 'In Progress' && current === 'Review') {
      return [textRequirement('reopenReason', 'Reason for additional implementation work', ticket, values, { placeholder: 'What further implementation work is required?' })]
    }
  }

  if (type === 'Problem') {
    if (targetStatus === 'Known Error') {
      return [
        textRequirement('problemHypothesis', 'Validated cause / hypothesis', ticket, values, { placeholder: 'What has investigation established?' }),
        textRequirement('problemWorkaround', 'Workaround', ticket, values, { placeholder: 'What safe workaround should technicians use?' }),
        textRequirement('knownErrorTitle', 'Known error title', ticket, values, { type: 'text', placeholder: 'Short known-error title' }),
      ]
    }
    if (targetStatus === 'Fix in Progress') {
      return [textRequirement('problemPermanentFix', 'Permanent fix plan', ticket, values, { placeholder: 'What corrective action is being progressed?' })]
    }
    if (targetStatus === 'Resolved') {
      return [
        textRequirement('problemRootCause', 'Root cause', ticket, values, { placeholder: 'What was the confirmed root cause?' }),
        textRequirement('problemPermanentFix', 'Permanent fix', ticket, values, { placeholder: 'What permanently corrected the issue?' }),
      ]
    }
    if (targetStatus === 'Under Investigation' && ['Known Error', 'Fix in Progress', 'Resolved'].includes(current)) {
      return [textRequirement('reopenReason', 'Reason for renewed investigation', ticket, values, { placeholder: 'Why does investigation need to resume?' })]
    }
  }

  return []
}

export function getTransitionBlockers(ticket, targetStatus, values = {}) {
  const blockers = []
  const type = ticket?.type || 'Incident'
  const current = getLifecycleStatus(ticket)
  const allowed = getAllowedTransitions(ticket)

  if (!allowed.includes(targetStatus)) {
    blockers.push(`${targetStatus} is not an allowed transition from ${current}.`)
    return blockers
  }

  if (type === 'Service Request' && targetStatus === 'In Progress' && current === 'New') {
    const pendingApprovals = (ticket.requestApprovals || []).filter((approval) => approval.status === 'Pending')
    if (pendingApprovals.length) blockers.push(`${pendingApprovals.length} approval${pendingApprovals.length === 1 ? '' : 's'} must be completed before fulfilment can start.`)
  }

  if (type === 'Service Request' && targetStatus === 'Approved') {
    if (!values.approvalConfirmation) blockers.push('Confirm that the required approvals have been received.')
  }

  if (type === 'Change' && targetStatus === 'Scheduled' && !values.cabApproved && ticket.approval !== 'Approved') {
    blockers.push('CAB or the required approval must be confirmed before the change can be scheduled.')
  }

  const requirements = getTransitionRequirements(ticket, targetStatus, values)
  requirements.forEach((requirement) => {
    if (requirement.type === 'checkbox') return
    const fieldValue = String(value(ticket, values, requirement.key, '') || '').trim()
    const optional = ['approvalNote', 'knownErrorTitle'].includes(requirement.key)
    if (!optional && !fieldValue) blockers.push(`${requirement.label} is required.`)
  })

  return blockers
}

export function canTransition(ticket, targetStatus, values = {}) {
  const blockers = getTransitionBlockers(ticket, targetStatus, values)
  return { ok: blockers.length === 0, blockers }
}

function transitionSummary(ticket, targetStatus, values) {
  if (ticket.type === 'Incident' && targetStatus === 'Pending') return values.pendingReason || ticket.pendingReason
  if (ticket.type === 'Incident' && targetStatus === 'Resolved') return values.resolutionCode || ticket.resolutionCode
  if (ticket.type === 'Service Request' && targetStatus === 'Completed') return values.completionNotes
  if (ticket.type === 'Change' && targetStatus === 'Failed') return values.failureReason
  if (ticket.type === 'Change' && targetStatus === 'Closed') return values.reviewOutcome
  if (ticket.type === 'Problem' && targetStatus === 'Known Error') return values.problemWorkaround
  if (ticket.type === 'Problem' && targetStatus === 'Resolved') return values.problemRootCause
  return values.reopenReason || values.reworkReason || ''
}

export function buildLifecycleTransition(ticket, targetStatus, values = {}, actor = 'Hi5Central User') {
  const validation = canTransition(ticket, targetStatus, values)
  if (!validation.ok) return { ok: false, blockers: validation.blockers, updates: null }

  const fromStatus = ticket.status
  const current = getLifecycleStatus(ticket)
  const type = ticket.type
  const now = 'Just now'
  const detail = transitionSummary(ticket, targetStatus, values)
  const activity = `System: Status changed from ${fromStatus} to ${targetStatus} by ${actor}${detail ? ` — ${detail}` : ''}.`
  const updates = {
    status: targetStatus,
    nextStep: nextStepByType[type]?.[targetStatus] || ticket.nextStep,
    comments: [activity, ...(ticket.comments || [])],
    lifecycleHistory: [
      {
        id: `${ticket.id}-LIFE-${Date.now()}`,
        from: fromStatus,
        to: targetStatus,
        actor,
        at: now,
        note: detail || '',
      },
      ...(ticket.lifecycleHistory || []),
    ],
  }

  const copyFields = [
    'pendingReason',
    'resolutionCode',
    'resolutionNotes',
    'completionNotes',
    'reopenReason',
    'approvalNote',
    'knownErrorTitle',
    'problemHypothesis',
    'problemWorkaround',
    'problemRootCause',
    'problemPermanentFix',
    'businessReason',
    'implementationPlan',
    'testPlan',
    'backoutPlan',
    'plannedStart',
    'plannedEnd',
    'implementationNotes',
    'failureReason',
    'backoutOutcome',
    'reviewOutcome',
    'reworkReason',
  ]
  copyFields.forEach((key) => {
    if (values[key] !== undefined && values[key] !== '') updates[key] = values[key]
  })

  if (type === 'Incident' && ['Assigned', 'In Progress'].includes(targetStatus) && (!ticket.assignee || ticket.assignee === 'Unassigned')) {
    updates.assignee = actor
  }
  if (type === 'Incident' && targetStatus === 'Resolved') {
    updates.sla = 'Met'
    updates.slaPercent = 100
  }
  if (type === 'Service Request' && targetStatus === 'Approved') {
    updates.requestApprovals = (ticket.requestApprovals || []).map((approval) => (
      approval.status === 'Pending'
        ? { ...approval, status: 'Approved', updated: `Confirmed by ${actor}` }
        : approval
    ))
  }
  if (type === 'Change' && targetStatus === 'Pending Approval') updates.approval = 'Pending Approval'
  if (type === 'Change' && targetStatus === 'CAB Review') updates.approval = 'CAB Review'
  if (type === 'Change' && targetStatus === 'Draft') updates.approval = 'Not submitted'
  if (type === 'Change' && targetStatus === 'Scheduled') {
    updates.approval = 'Approved'
    const plannedStart = values.plannedStart || ticket.plannedStart
    const plannedEnd = values.plannedEnd || ticket.plannedEnd
    updates.window = [plannedStart, plannedEnd].filter(Boolean).join(' → ') || ticket.window
  }
  if (type === 'Change' && targetStatus === 'Failed') updates.approval = ticket.approval || 'Approved'
  if (type === 'Problem' && targetStatus === 'Known Error') updates.knownErrorStatus = 'Declared'
  if (type === 'Problem' && targetStatus === 'Under Investigation' && current === 'Resolved') updates.knownErrorStatus = ticket.knownErrorStatus || 'Not declared'

  return { ok: true, blockers: [], updates }
}

export function transitionLabel(targetStatus) {
  const labels = {
    Assigned: 'Assign',
    'In Progress': 'Start / resume work',
    Pending: 'Place on hold',
    Resolved: 'Resolve',
    Closed: 'Close',
    'Pending Approval': 'Submit for approval',
    Approved: 'Mark approved',
    Completed: 'Complete',
    'CAB Review': 'Send to CAB',
    Scheduled: 'Schedule',
    Review: 'Move to review',
    Failed: 'Mark failed',
    Draft: 'Return to draft',
    'Under Investigation': 'Start investigation',
    'Known Error': 'Declare known error',
    'Fix in Progress': 'Start permanent fix',
  }
  return labels[targetStatus] || `Move to ${targetStatus}`
}

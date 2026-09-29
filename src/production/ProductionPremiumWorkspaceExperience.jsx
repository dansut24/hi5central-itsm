import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Link2,
  LoaderCircle,
  Package,
  Paperclip,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
} from 'lucide-react'

const API_BASE = window.__HI5_API_BASE__
const ONBOARDING_HANDOFF_KEY = 'hi5central-onboarding-handoff-v1'
const PREVIEWABLE_ROWS = new Set([
  'Requester',
  'Assignment',
  'Request details',
  'Items & cost',
  'Approvals',
  'Tasks',
  'Relationships',
  'Attachments',
])

function recordContextFromPath(pathname = window.location.pathname) {
  const match = pathname.match(/^\/(incidents|requests|problems|changes)\/([^/]+)\/?$/i)
  if (!match || match[2].toLowerCase() === 'new') return null
  const section = match[1].toLowerCase()
  const labels = {
    incidents: ['Incidents', 'Incident'],
    requests: ['Service Requests', 'Service Request'],
    problems: ['Problems', 'Problem'],
    changes: ['Changes', 'Change'],
  }
  return {
    section,
    reference: decodeURIComponent(match[2]).toUpperCase(),
    listPath: `/${section}`,
    listLabel: labels[section][0],
    type: labels[section][1],
  }
}

function recordPath(reference = '', type = '') {
  const id = String(reference || '').toUpperCase()
  const kind = String(type || '').toLowerCase()
  if (id.startsWith('INC-') || kind.includes('incident')) return `/incidents/${encodeURIComponent(id)}`
  if (id.startsWith('REQ-') || kind.includes('service request') || kind === 'request') return `/requests/${encodeURIComponent(id)}`
  if (id.startsWith('PRB-') || kind.includes('problem')) return `/problems/${encodeURIComponent(id)}`
  if (id.startsWith('CHG-') || kind.includes('change')) return `/changes/${encodeURIComponent(id)}`
  return ''
}

function openWorkspacePath(path) {
  if (!path) return
  if (window.location.pathname !== path) window.history.pushState({}, '', path)
  const event = typeof PopStateEvent === 'function'
    ? new PopStateEvent('popstate', { state: window.history.state })
    : new Event('popstate')
  window.dispatchEvent(event)
}

async function apiJson(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Preview data could not be loaded.')
  return payload
}

async function loadCurrentRecord(context) {
  if (!context) return null
  const encoded = encodeURIComponent(context.reference)
  if (context.section === 'requests') {
    const [request, state] = await Promise.all([
      apiJson(`/api/v1/service-requests/${encoded}`),
      apiJson(`/api/v1/service-request-state/${encoded}`).catch(() => ({})),
    ])
    return { ...request, ...state }
  }
  return apiJson(`/api/v1/itsm-lifecycle/${encoded}`)
}

function cachedPeople() {
  try {
    const value = JSON.parse(window.localStorage.getItem('hi5central-organisation-people-v1') || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

async function loadPeople() {
  try {
    const organisation = await apiJson('/api/v1/organisation')
    return Array.isArray(organisation.people) ? organisation.people : cachedPeople()
  } catch {
    return cachedPeople()
  }
}

function personFor(people, { id = '', email = '', name = '' } = {}) {
  const targetId = String(id || '').toLowerCase()
  const targetEmail = String(email || '').toLowerCase()
  const targetName = String(name || '').toLowerCase()
  return people.find((person) => (
    (targetId && String(person.id || '').toLowerCase() === targetId)
      || (targetEmail && String(person.email || '').toLowerCase() === targetEmail)
      || (targetName && String(person.name || '').toLowerCase() === targetName)
  )) || null
}

function compactFields(entries) {
  return entries
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([label, value]) => ({ label, value: String(value) }))
}

function money(value, currency = 'GBP') {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
      maximumFractionDigits: 2,
    }).format(Number(value || 0))
  } catch {
    return `£${Number(value || 0).toFixed(2)}`
  }
}

function previewIcon(kind) {
  if (kind === 'Person') return <UserRound size={19} />
  if (kind === 'Assignment') return <Users size={19} />
  if (kind === 'Tasks') return <ClipboardCheck size={19} />
  if (kind === 'Approvals') return <ShieldCheck size={19} />
  if (kind === 'Items & cost') return <Package size={19} />
  if (kind === 'Relationships') return <Link2 size={19} />
  if (kind === 'Attachments') return <Paperclip size={19} />
  return <FileText size={19} />
}

function personPreview(person, fallback = {}) {
  const resolved = person || {}
  const title = resolved.name || fallback.name || 'Person'
  return {
    kind: 'Person',
    title,
    subtitle: resolved.jobTitle || fallback.email || 'Hi5Central person',
    fields: compactFields([
      ['Email', resolved.email || fallback.email],
      ['Staff number', resolved.staffNumber || resolved.employeeNumber],
      ['Job title', resolved.jobTitle],
      ['Department', resolved.department || resolved.departmentName],
      ['Site', resolved.site || resolved.location || resolved.siteName],
      ['Manager', resolved.manager || resolved.managerName],
      ['Status', resolved.status],
    ]),
    openPath: '/people',
    openLabel: 'Open People',
  }
}

function taskPreview(task) {
  return {
    kind: 'Tasks',
    title: task.title || task.name || 'Task',
    subtitle: task.status || 'Task',
    fields: compactFields([
      ['Status', task.status],
      ['Team', task.team],
      ['Assignee', task.assignee],
      ['Due', task.dueAt || task.dueDate],
      ['Completion notes', task.completionNotes],
    ]),
  }
}

function previewForRow(label, record, people) {
  if (!record) return null

  if (label === 'Requester') {
    const person = personFor(people, {
      id: record.requesterId,
      email: record.requesterEmail,
      name: record.requester,
    })
    return personPreview(person, { name: record.requester, email: record.requesterEmail })
  }

  if (label === 'Assignment') {
    const assignee = personFor(people, {
      id: record.assigneeId,
      email: record.assigneeEmail,
      name: record.assignee,
    })
    return {
      kind: 'Assignment',
      title: record.team || 'Unassigned team',
      subtitle: record.assignee || 'Unassigned',
      fields: compactFields([
        ['Team', record.team || 'Unassigned'],
        ['Assignee', record.assignee || 'Unassigned'],
        ['Email', assignee?.email || record.assigneeEmail],
        ['Department', assignee?.department || assignee?.departmentName],
        ['Site', assignee?.site || assignee?.location || assignee?.siteName],
      ]),
      openPath: assignee ? '/people' : '',
      openLabel: assignee ? 'Open People' : '',
    }
  }

  if (label === 'Request details') {
    const answers = Array.isArray(record.requestInformation) ? record.requestInformation : []
    return {
      kind: 'Request details',
      title: record.title || record.id || 'Request details',
      subtitle: `${answers.length} submitted field${answers.length === 1 ? '' : 's'}`,
      fields: answers.slice(0, 12).map((item) => ({ label: item.label || 'Field', value: String(item.value ?? '—') })),
    }
  }

  if (label === 'Tasks') {
    const tasks = Array.isArray(record.requestTasks) ? record.requestTasks : []
    const completed = tasks.filter((task) => String(task.status).toLowerCase() === 'completed').length
    return {
      kind: 'Tasks',
      title: 'Fulfilment tasks',
      subtitle: tasks.length ? `${completed} of ${tasks.length} completed` : 'No fulfilment tasks',
      items: tasks.map((task) => ({
        title: task.title || task.name || 'Task',
        meta: [task.team || 'Unassigned team', task.assignee || 'Unassigned'].join(' · '),
        badge: task.status || 'Waiting',
      })),
    }
  }

  if (label === 'Approvals') {
    const approvals = Array.isArray(record.requestApprovals) ? record.requestApprovals : []
    const pending = approvals.filter((approval) => String(approval.status).toLowerCase() === 'pending').length
    return {
      kind: 'Approvals',
      title: 'Approvals',
      subtitle: pending ? `${pending} pending` : approvals.length ? 'Approval path complete' : 'No approval required',
      items: approvals.map((approval) => ({
        title: approval.label || 'Approval',
        meta: approval.approver || 'Approver',
        badge: approval.status || 'Pending',
      })),
    }
  }

  if (label === 'Items & cost') {
    const items = Array.isArray(record.requestedItems) ? record.requestedItems : []
    return {
      kind: 'Items & cost',
      title: 'Requested items',
      subtitle: items.length ? `${items.length} catalogue item${items.length === 1 ? '' : 's'}` : 'No priced items',
      fields: compactFields([
        ['One-off', money(record.oneOffCost, record.currency)],
        ['Monthly', `${money(record.monthlyCost, record.currency)}/mo`],
      ]),
      items: items.map((item) => ({
        title: item.name || item.title || 'Catalogue item',
        meta: `${item.category || 'Catalogue item'} · Qty ${item.quantity || 1}`,
        badge: Number(item.unitMonthlyCost || 0) > 0
          ? `${money(item.unitMonthlyCost, item.currency || record.currency)}/mo`
          : money(item.unitOneOffCost, item.currency || record.currency),
      })),
    }
  }

  if (label === 'Relationships') {
    const relationships = Array.isArray(record.relationships) ? record.relationships : []
    return {
      kind: 'Relationships',
      title: 'Related records',
      subtitle: relationships.length ? `${relationships.length} relationship${relationships.length === 1 ? '' : 's'}` : 'No related records',
      items: relationships.map((item) => ({
        title: item.targetReference || item.reference || 'Related record',
        meta: [item.targetType || item.type, item.relationshipType].filter(Boolean).join(' · '),
        openPath: recordPath(item.targetReference || item.reference, item.targetType || item.type),
      })),
    }
  }

  if (label === 'Attachments') {
    const attachments = Array.isArray(record.attachments) ? record.attachments : []
    return {
      kind: 'Attachments',
      title: 'Attachments',
      subtitle: attachments.length ? `${attachments.length} file${attachments.length === 1 ? '' : 's'}` : 'No attachments',
      items: attachments.map((item) => ({
        title: item.fileName || item.name || 'Attachment',
        meta: [item.uploadedBy, item.mimeType].filter(Boolean).join(' · '),
      })),
    }
  }

  return null
}

function individualPreview(node) {
  if (node.matches('.service-request-task')) {
    return taskPreview({
      title: node.querySelector('strong')?.textContent?.trim(),
      status: node.querySelector('select')?.value,
      team: node.querySelector('small')?.textContent?.trim(),
    })
  }

  if (node.matches('.service-request-approval')) {
    return {
      kind: 'Approvals',
      title: node.querySelector('strong')?.textContent?.trim() || 'Approval',
      subtitle: node.querySelector('small')?.textContent?.trim() || 'Approval step',
    }
  }

  if (node.matches('.service-request-item')) {
    return {
      kind: 'Items & cost',
      title: node.querySelector('strong')?.textContent?.trim() || 'Catalogue item',
      subtitle: node.querySelector('small')?.textContent?.trim() || 'Requested item',
      fields: compactFields([['Price', node.querySelector('b')?.textContent?.trim()]]),
    }
  }

  if (node.matches('.activity-canvas-mini-list > div')) {
    const reference = node.querySelector('strong')?.textContent?.trim() || ''
    const meta = node.querySelector('small')?.textContent?.trim() || ''
    const openPath = recordPath(reference, meta)
    if (openPath) {
      return {
        kind: 'Relationships',
        title: reference,
        subtitle: meta || 'Related record',
        openPath,
        openLabel: 'Open record',
      }
    }
    return {
      kind: 'Attachments',
      title: reference || 'Attachment',
      subtitle: meta,
    }
  }

  return null
}

function consumeOnboardingHandoff() {
  if (window.location.pathname !== '/dashboard') return null
  try {
    const raw = window.sessionStorage.getItem(ONBOARDING_HANDOFF_KEY)
    if (!raw) return null
    window.sessionStorage.removeItem(ONBOARDING_HANDOFF_KEY)
    const payload = JSON.parse(raw)
    if (!payload || Date.now() - Number(payload.createdAt || 0) > 15 * 60 * 1000) return null
    return payload
  } catch {
    return null
  }
}

function QuickPreview({ preview, onClose, onNavigate }) {
  if (!preview) return null
  const fields = Array.isArray(preview.fields) ? preview.fields : []
  const items = Array.isArray(preview.items) ? preview.items : []

  return createPortal(
    <div className="hi5-quick-preview-layer" role="presentation">
      <button className="hi5-quick-preview-backdrop" type="button" aria-label="Close quick preview" onClick={onClose} />
      <section className="hi5-quick-preview" role="dialog" aria-modal="true" aria-label={`${preview.kind || 'Quick'} preview`}>
        <header>
          <div className="hi5-quick-preview-icon">{preview.loading ? <LoaderCircle size={19} className="is-spinning" /> : previewIcon(preview.kind)}</div>
          <div>
            <span>{preview.kind || 'Quick preview'}</span>
            <strong>{preview.title || 'Quick preview'}</strong>
            {preview.subtitle ? <small>{preview.subtitle}</small> : null}
          </div>
          <button type="button" aria-label="Close quick preview" onClick={onClose}><X size={17} /></button>
        </header>

        <div className="hi5-quick-preview-body">
          {preview.loading ? (
            <div className="hi5-quick-preview-loading">
              <span /><span /><span />
            </div>
          ) : preview.error ? (
            <div className="hi5-quick-preview-error">{preview.error}</div>
          ) : (
            <>
              {fields.length ? <div className="hi5-quick-preview-fields">{fields.map((item) => <div key={`${item.label}-${item.value}`}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div> : null}
              {items.length ? <div className="hi5-quick-preview-list">{items.map((item, index) => <article key={`${item.title}-${index}`}><div><strong>{item.title}</strong>{item.meta ? <span>{item.meta}</span> : null}</div>{item.badge ? <em>{item.badge}</em> : null}{item.openPath ? <button type="button" aria-label={`Open ${item.title}`} onClick={() => onNavigate(item.openPath)}><ExternalLink size={14} /></button> : null}</article>)}</div> : null}
              {!fields.length && !items.length && !preview.subtitle ? <div className="hi5-quick-preview-empty">No additional information is available yet.</div> : null}
            </>
          )}
        </div>

        {!preview.loading && !preview.error && (preview.manage || preview.openPath) ? (
          <footer>
            {preview.manage ? <button type="button" className="is-secondary" onClick={preview.manage}>Manage in inspector</button> : <span />}
            {preview.openPath ? <button type="button" className="is-primary" onClick={() => onNavigate(preview.openPath)}>{preview.openLabel || 'Open in tab'}<ExternalLink size={15} /></button> : null}
          </footer>
        ) : null}
      </section>
    </div>,
    document.body,
  )
}

function FirstRunHandoff({ handoff, onClose }) {
  if (!handoff) return null
  const itsmEnabled = handoff.modules?.itsm !== false
  const rmmEnabled = Boolean(handoff.modules?.rmm)
  return createPortal(
    <div className="hi5-first-run-layer">
      <div className="hi5-first-run-card" role="dialog" aria-modal="true" aria-label="Workspace setup complete">
        <div className="hi5-first-run-mark"><img src="/hi5central-logo.png" alt="" /><Sparkles size={22} /></div>
        <span className="hi5-first-run-kicker">Setup complete</span>
        <h1>{handoff.companyName ? `${handoff.companyName} is ready.` : 'Your workspace is ready.'}</h1>
        <p>Your choices have been applied. This is your live Hi5Central workspace.</p>
        <div className="hi5-first-run-checks">
          <span><CheckCircle2 size={16} /> Theme & branding applied</span>
          {itsmEnabled ? <span><CheckCircle2 size={16} /> Service desk ready</span> : null}
          {rmmEnabled ? <span><CheckCircle2 size={16} /> RMM workspace enabled</span> : null}
          <span><CheckCircle2 size={16} /> Security preferences active</span>
        </div>
        <button type="button" onClick={onClose}>Open my workspace</button>
      </div>
    </div>,
    document.body,
  )
}

export function ProductionPremiumWorkspaceExperience() {
  const [path, setPath] = useState(() => window.location.pathname)
  const [backTarget, setBackTarget] = useState(null)
  const [preview, setPreview] = useState(null)
  const [handoff, setHandoff] = useState(consumeOnboardingHandoff)
  const previewRequestRef = useRef(0)
  const bypassRowsRef = useRef(new WeakSet())
  const previousActiveRef = useRef('')
  const context = useMemo(() => recordContextFromPath(path), [path])

  useEffect(() => {
    const update = () => setPath((current) => current === window.location.pathname ? current : window.location.pathname)
    window.addEventListener('popstate', update)
    window.addEventListener('hi5-routechange', update)
    const timer = window.setInterval(update, 300)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener('hi5-routechange', update)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!context) {
      setBackTarget(null)
      return undefined
    }

    const attach = () => {
      const target = document.querySelector('.activity-canvas-top .activity-canvas-title > div')
      setBackTarget(target instanceof HTMLElement ? target : null)
      return Boolean(target)
    }

    if (attach()) return undefined
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [context?.reference, context?.section])

  useEffect(() => {
    let raf = 0
    const decorate = () => {
      raf = 0
      document.querySelectorAll('.activity-canvas-inspector-row').forEach((row) => {
        const label = row.querySelector('small')?.textContent?.trim() || ''
        if (PREVIEWABLE_ROWS.has(label)) {
          row.dataset.hi5QuickPreview = 'true'
          row.title = `Quick view ${label.toLowerCase()}`
        } else {
          delete row.dataset.hi5QuickPreview
        }
      })
      document.querySelectorAll('.service-request-task, .service-request-approval, .service-request-item, .activity-canvas-mini-list > div').forEach((node) => {
        node.dataset.hi5QuickPreviewItem = 'true'
      })
    }
    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(decorate)
    }
    decorate()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    async function openRowPreview(row) {
      const label = row.querySelector('small')?.textContent?.trim() || 'Quick preview'
      const requestId = ++previewRequestRef.current
      const manage = () => {
        setPreview(null)
        bypassRowsRef.current.add(row)
        row.click()
      }
      setPreview({ loading: true, kind: label, title: row.querySelector('strong')?.textContent?.trim() || label })
      try {
        const currentContext = recordContextFromPath()
        const [record, people] = await Promise.all([loadCurrentRecord(currentContext), loadPeople()])
        if (requestId !== previewRequestRef.current) return
        const next = previewForRow(label, record, people)
        setPreview(next ? { ...next, manage } : { kind: label, title: label, subtitle: 'Open this section in the inspector.', manage })
      } catch (error) {
        if (requestId !== previewRequestRef.current) return
        setPreview({ kind: label, title: label, error: error.message, manage })
      }
    }

    function handleClick(event) {
      const row = event.target.closest?.('.activity-canvas-inspector-row[data-hi5-quick-preview="true"]')
      if (row instanceof HTMLElement) {
        if (bypassRowsRef.current.has(row)) {
          bypassRowsRef.current.delete(row)
          return
        }
        event.preventDefault()
        event.stopPropagation()
        void openRowPreview(row)
        return
      }

      if (event.target.closest?.('button, a, input, select, textarea, summary')) return
      const item = event.target.closest?.('[data-hi5-quick-preview-item="true"]')
      if (!(item instanceof HTMLElement)) return
      const next = individualPreview(item)
      if (next) {
        event.preventDefault()
        event.stopPropagation()
        setPreview(next)
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  useEffect(() => {
    let tabObserver = null
    let bodyObserver = null

    const centreActiveTab = () => {
      const active = document.querySelector('.production-workspace-tab.is-active')
      const scroller = active?.closest('.production-workspace-tabs')
      if (!(active instanceof HTMLElement) || !(scroller instanceof HTMLElement)) return
      const touchMode = window.matchMedia?.('(hover: none), (pointer: coarse)').matches
      if (!touchMode) {
        scroller.scrollLeft = 0
        return
      }
      const left = active.offsetLeft - Math.max(0, (scroller.clientWidth - active.offsetWidth) / 2)
      scroller.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
    }

    const animateWorkspace = () => {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
      const target = document.querySelector('.content-frame')
      if (!(target instanceof HTMLElement) || typeof target.animate !== 'function') return
      target.animate([
        { opacity: 0.78, transform: 'translateY(3px) scale(.998)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ], {
        duration: 175,
        easing: 'cubic-bezier(.2,.78,.2,1)',
      })
    }

    const sync = () => {
      const active = document.querySelector('.tab-list .workspace-tab.active')
      const key = active instanceof HTMLElement ? active.dataset.tabKey || active.textContent?.trim() || '' : ''
      if (key && key !== previousActiveRef.current) {
        const hadPrevious = Boolean(previousActiveRef.current)
        previousActiveRef.current = key
        if (hadPrevious) animateWorkspace()
        window.requestAnimationFrame(() => window.requestAnimationFrame(centreActiveTab))
      }
    }

    const attach = () => {
      const list = document.querySelector('.tab-list')
      if (!(list instanceof HTMLElement)) return false
      tabObserver?.disconnect()
      tabObserver = new MutationObserver(sync)
      tabObserver.observe(list, { subtree: true, attributes: true, attributeFilter: ['class', 'data-tab-key'], childList: true })
      sync()
      return true
    }

    if (!attach()) {
      bodyObserver = new MutationObserver(() => {
        if (attach()) bodyObserver?.disconnect()
      })
      bodyObserver.observe(document.body, { childList: true, subtree: true })
    }

    window.addEventListener('resize', centreActiveTab)
    return () => {
      tabObserver?.disconnect()
      bodyObserver?.disconnect()
      window.removeEventListener('resize', centreActiveTab)
    }
  }, [])

  useEffect(() => {
    if (!preview && !handoff) return undefined
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      if (preview) {
        previewRequestRef.current += 1
        setPreview(null)
      } else if (handoff) {
        setHandoff(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handoff, preview])

  const closePreview = () => {
    previewRequestRef.current += 1
    setPreview(null)
  }

  const navigatePreview = (nextPath) => {
    closePreview()
    openWorkspacePath(nextPath)
  }

  return (
    <>
      {context && backTarget ? createPortal(
        <button
          type="button"
          className="hi5-record-back-button"
          onClick={() => openWorkspacePath(context.listPath)}
          title={`Back to ${context.listLabel}`}
          aria-label={`Back to ${context.listLabel}`}
        >
          <ArrowLeft size={15} />
          <span>{context.listLabel}</span>
        </button>,
        backTarget,
      ) : null}
      <QuickPreview preview={preview} onClose={closePreview} onNavigate={navigatePreview} />
      <FirstRunHandoff handoff={handoff} onClose={() => setHandoff(null)} />
    </>
  )
}

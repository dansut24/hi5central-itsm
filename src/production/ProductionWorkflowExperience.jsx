import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, CheckCircle2, ChevronRight, Clock3, GitBranch, Save, ShieldCheck, Sparkles } from 'lucide-react'
import './ProductionWorkflowExperience.css'

const API_BASE = window.__HI5_API_BASE__

function routeState(pathname = window.location.pathname) {
  const match = pathname.match(/^\/(requests|problems|changes)\/([^/]+)\/?$/i)
  if (!match || match[2].toLowerCase() === 'new') return null
  return { section: match[1].toLowerCase(), reference: decodeURIComponent(match[2]) }
}

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || 'The workflow operation failed.')
    error.payload = payload
    throw error
  }
  return payload
}

function StageStrip({ workflow }) {
  const stages = workflow?.stages || []
  const active = workflow?.stage || workflow?.status
  const currentIndex = Math.max(0, stages.indexOf(active))
  return <div className="hi5-workflow-stages" aria-label="Workflow progress">
    {stages.map((stage, index) => {
      const complete = index < currentIndex || ['Completed', 'Closed'].includes(workflow.status)
      const current = stage === active
      return <div className={`hi5-workflow-stage ${complete ? 'is-complete' : ''} ${current ? 'is-current' : ''}`} key={stage}>
        <i>{complete ? <Check size={11} /> : index + 1}</i><span>{stage}</span>
      </div>
    })}
  </div>
}

function Metric({ label, value, tone = '' }) {
  return <div className={`hi5-workflow-metric ${tone ? `is-${tone}` : ''}`}><span>{label}</span><strong>{value}</strong></div>
}

function Field({ label, children, hint }) {
  return <label className="hi5-workflow-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>
}

function ServiceRequestWorkflow({ workflow, busy, onTransition, onDecision }) {
  const metrics = workflow.metrics || {}
  return <>
    <div className="hi5-workflow-metrics">
      <Metric label="Approvals pending" value={metrics.pendingApprovals || 0} tone={metrics.pendingApprovals ? 'warning' : 'good'} />
      <Metric label="Tasks complete" value={`${metrics.taskComplete || 0}/${metrics.taskTotal || 0}`} tone={metrics.taskBlocked ? 'warning' : workflow.readyForCompletion ? 'good' : ''} />
      <Metric label="Blocked tasks" value={metrics.taskBlocked || 0} tone={metrics.taskBlocked ? 'danger' : 'good'} />
    </div>
    {workflow.readyForCompletion && workflow.status === 'In Progress' ? <div className="hi5-workflow-ready"><CheckCircle2 size={16} /><span><strong>Ready for completion</strong><small>All required fulfilment tasks are complete.</small></span></div> : null}
    {workflow.tasks?.length ? <details className="hi5-workflow-details"><summary>Fulfilment tasks <b>{metrics.taskComplete || 0}/{metrics.taskTotal || 0}</b></summary><div>{workflow.tasks.map((task) => <div className="hi5-workflow-task" key={task.id}><span><strong>{task.title}</strong><small>{task.assignee || task.team || 'Unassigned'}{task.dependencies?.length ? ` · after ${task.dependencies.join(', ')}` : ''}</small></span><em className={`is-${String(task.status).toLowerCase().replace(/\s+/g, '-')}`}>{task.status}</em></div>)}</div></details> : null}
    {workflow.approvals?.length ? <div className="hi5-workflow-approvals"><div className="hi5-workflow-subheading"><ShieldCheck size={15} /><span>Approvals</span></div>{workflow.approvals.map((approval) => <div className="hi5-workflow-approval" key={approval.id}><span><strong>{approval.label || 'Approval'}</strong><small>{approval.approver}{approval.note ? ` · ${approval.note}` : ''}</small></span><em>{approval.status}</em>{approval.canDecide ? <div><button disabled={busy} onClick={() => onDecision(approval.id, 'Approved')} type="button">Approve</button><button className="is-danger" disabled={busy} onClick={() => onDecision(approval.id, 'Rejected')} type="button">Reject</button></div> : null}</div>)}</div> : null}
    <WorkflowActions workflow={workflow} busy={busy} onTransition={onTransition} />
  </>
}

function ProblemEditor({ workflow, draft, setDraft, busy, onSave, onTransition }) {
  return <>
    <div className="hi5-workflow-grid">
      <Field label="Impact scope"><textarea rows="2" value={draft.impactScope || ''} onChange={(e) => setDraft((v) => ({ ...v, impactScope: e.target.value }))} placeholder="Users, services, sites or versions affected" /></Field>
      <Field label="Investigation hypothesis"><textarea rows="2" value={draft.hypothesis || ''} onChange={(e) => setDraft((v) => ({ ...v, hypothesis: e.target.value }))} placeholder="Current theory and evidence" /></Field>
      <Field label="Workaround"><textarea rows="3" value={draft.workaround || ''} onChange={(e) => setDraft((v) => ({ ...v, workaround: e.target.value }))} placeholder="Temporary way to restore or reduce impact" /></Field>
      <Field label="Root cause"><textarea rows="3" value={draft.rootCause || ''} onChange={(e) => setDraft((v) => ({ ...v, rootCause: e.target.value }))} placeholder="Confirmed underlying cause" /></Field>
      <Field label="Permanent fix"><textarea rows="3" value={draft.permanentFix || ''} onChange={(e) => setDraft((v) => ({ ...v, permanentFix: e.target.value }))} placeholder="Implemented or planned permanent correction" /></Field>
      <Field label="Known Error title"><input value={draft.knownErrorTitle || ''} onChange={(e) => setDraft((v) => ({ ...v, knownErrorTitle: e.target.value, knownError: Boolean(e.target.value) }))} placeholder="Published Known Error name" /></Field>
      <Field label="Knowledge article"><input value={draft.knowledgeArticle || ''} onChange={(e) => setDraft((v) => ({ ...v, knowledgeArticle: e.target.value }))} placeholder="KB reference or URL" /></Field>
      <Field label="Affected versions"><input value={(draft.affectedVersions || []).join(', ')} onChange={(e) => setDraft((v) => ({ ...v, affectedVersions: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }))} placeholder="e.g. 4.2, 4.3" /></Field>
    </div>
    <div className="hi5-workflow-link-summary"><span><strong>{workflow.metrics?.linkedIncidents || 0}</strong> linked incidents</span><span><strong>{workflow.metrics?.linkedChanges || 0}</strong> linked changes</span></div>
    <div className="hi5-workflow-editor-actions"><button disabled={busy} onClick={onSave} type="button"><Save size={14} />Save investigation</button></div>
    <WorkflowActions workflow={workflow} busy={busy} onTransition={onTransition} />
  </>
}

function ChangeEditor({ workflow, draft, setDraft, busy, onSave, onTransition, onDecision }) {
  const approvals = workflow.approvals || []
  return <>
    <div className="hi5-workflow-grid">
      <Field label="Change type"><select value={draft.changeType || 'Normal'} onChange={(e) => setDraft((v) => ({ ...v, changeType: e.target.value }))}><option>Standard</option><option>Normal</option><option>Emergency</option></select></Field>
      <Field label="Risk"><select value={draft.risk || 'Medium'} onChange={(e) => setDraft((v) => ({ ...v, risk: e.target.value }))}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></Field>
      <Field label="Business reason"><textarea rows="2" value={draft.businessReason || ''} onChange={(e) => setDraft((v) => ({ ...v, businessReason: e.target.value }))} /></Field>
      <Field label="Risk summary"><textarea rows="2" value={draft.riskSummary || ''} onChange={(e) => setDraft((v) => ({ ...v, riskSummary: e.target.value }))} /></Field>
      <Field label="Planned start"><input type="datetime-local" value={draft.plannedStart ? String(draft.plannedStart).slice(0, 16) : ''} onChange={(e) => setDraft((v) => ({ ...v, plannedStart: e.target.value }))} /></Field>
      <Field label="Planned end"><input type="datetime-local" value={draft.plannedEnd ? String(draft.plannedEnd).slice(0, 16) : ''} onChange={(e) => setDraft((v) => ({ ...v, plannedEnd: e.target.value }))} /></Field>
      <Field label="Expected downtime"><input value={draft.downtime || ''} onChange={(e) => setDraft((v) => ({ ...v, downtime: e.target.value }))} placeholder="e.g. 10 minutes" /></Field>
      <Field label="Approval route"><input value={draft.approvalRoute || ''} onChange={(e) => setDraft((v) => ({ ...v, approvalRoute: e.target.value }))} placeholder="CAB / service owner / emergency" /></Field>
      <Field label="Implementation plan"><textarea rows="4" value={draft.implementationPlan || ''} onChange={(e) => setDraft((v) => ({ ...v, implementationPlan: e.target.value }))} /></Field>
      <Field label="Test plan"><textarea rows="4" value={draft.testPlan || ''} onChange={(e) => setDraft((v) => ({ ...v, testPlan: e.target.value }))} /></Field>
      <Field label="Backout plan"><textarea rows="4" value={draft.backoutPlan || ''} onChange={(e) => setDraft((v) => ({ ...v, backoutPlan: e.target.value }))} /></Field>
      <Field label="Implementation notes"><textarea rows="3" value={draft.implementationNotes || ''} onChange={(e) => setDraft((v) => ({ ...v, implementationNotes: e.target.value }))} /></Field>
      <Field label="Post-implementation review"><textarea rows="3" value={draft.reviewOutcome || ''} onChange={(e) => setDraft((v) => ({ ...v, reviewOutcome: e.target.value }))} /></Field>
      <Field label="Failure / backout reason"><textarea rows="2" value={draft.failureReason || ''} onChange={(e) => setDraft((v) => ({ ...v, failureReason: e.target.value }))} /></Field>
    </div>
    <div className="hi5-workflow-editor-actions"><button disabled={busy} onClick={onSave} type="button"><Save size={14} />Save change plan</button></div>
    {approvals.length ? <div className="hi5-workflow-approvals"><div className="hi5-workflow-subheading"><ShieldCheck size={15} /><span>Approvals · {workflow.approvalState}</span></div>{approvals.map((approval) => <div className="hi5-workflow-approval" key={approval.id}><span><strong>{approval.type === 'emergency-change' ? 'Emergency Change approval' : approval.type === 'standard-auto' ? 'Standard Change policy' : 'Change approval'}</strong><small>{approval.approver}{approval.note ? ` · ${approval.note}` : ''}</small></span><em>{approval.status}</em>{approval.status === 'Pending' ? <div><button disabled={busy} onClick={() => onDecision(approval.id, 'Approved')} type="button">Approve</button><button className="is-danger" disabled={busy} onClick={() => onDecision(approval.id, 'Rejected')} type="button">Reject</button></div> : null}</div>)}</div> : null}
    <WorkflowActions workflow={workflow} busy={busy} onTransition={onTransition} />
  </>
}

function WorkflowActions({ workflow, busy, onTransition }) {
  const actions = workflow.actions || []
  if (!actions.length) return null
  return <div className="hi5-workflow-actions"><span>Next actions</span><div>{actions.map((action) => <button className={['Rejected','Cancelled','Failed','Backed Out'].includes(action) ? 'is-danger' : ''} disabled={busy} key={action} onClick={() => onTransition(action)} type="button">{action}<ChevronRight size={13} /></button>)}</div></div>
}

function WorkflowPanel({ reference }) {
  const [workflow, setWorkflow] = useState(null)
  const [draft, setDraft] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    setError('')
    try {
      const next = await apiJson(`/api/v1/workflows/${encodeURIComponent(reference)}`)
      setWorkflow(next)
      setDraft(next.data || {})
    } catch (loadError) { setError(loadError.message) }
  }

  useEffect(() => { void load() }, [reference])

  async function saveData() {
    setBusy(true); setError(''); setNotice('')
    try {
      const next = await apiJson(`/api/v1/workflows/${encodeURIComponent(reference)}/data`, { method: 'PATCH', body: JSON.stringify({ data: draft }) })
      setWorkflow(next); setDraft(next.data || {}); setNotice('Workflow details saved')
    } catch (saveError) { setError(saveError.message) } finally { setBusy(false) }
  }

  async function transition(targetStatus) {
    setBusy(true); setError(''); setNotice('')
    try {
      const values = {}
      if (workflow?.type === 'Service Request' && targetStatus === 'Completed') {
        const notes = window.prompt('Fulfilment summary')
        if (!notes) { setBusy(false); return }
        values.completionNotes = notes
      }
      if (workflow?.type === 'Service Request' && workflow.status === 'Completed' && targetStatus === 'In Progress') {
        const reason = window.prompt('Reason for reopening fulfilment')
        if (!reason) { setBusy(false); return }
        values.reopenReason = reason
      }
      if (workflow?.type === 'Change' && ['Failed', 'Backed Out'].includes(targetStatus) && !draft.failureReason && !draft.implementationNotes) {
        const reason = window.prompt(`${targetStatus} reason`)
        if (!reason) { setBusy(false); return }
        const nextDraft = { ...draft, failureReason: reason }
        await apiJson(`/api/v1/workflows/${encodeURIComponent(reference)}/data`, { method: 'PATCH', body: JSON.stringify({ data: nextDraft }) })
        setDraft(nextDraft)
      }
      const next = await apiJson(`/api/v1/workflows/${encodeURIComponent(reference)}/transition`, { method: 'POST', body: JSON.stringify({ targetStatus, values }) })
      setWorkflow(next); setDraft(next.data || draft); setNotice(`Moved to ${next.status}`)
      window.dispatchEvent(new Event('hi5-routechange'))
    } catch (transitionError) {
      setError(transitionError.payload?.blockers?.join(' ') || transitionError.message)
    } finally { setBusy(false) }
  }

  async function decide(approvalId, decision) {
    const note = window.prompt(`${decision} note (optional)`) || ''
    setBusy(true); setError(''); setNotice('')
    try {
      if (workflow?.type === 'Service Request') {
        await apiJson(`/api/v1/service-requests/${encodeURIComponent(reference)}/approvals/${encodeURIComponent(approvalId)}/decision`, { method: 'POST', body: JSON.stringify({ decision, note }) })
        await load()
        setNotice(`Approval ${decision.toLowerCase()}`)
      } else {
        const next = await apiJson(`/api/v1/workflows/${encodeURIComponent(reference)}/approvals/${encodeURIComponent(approvalId)}/decision`, { method: 'POST', body: JSON.stringify({ decision, note }) })
        setWorkflow(next); setDraft(next.data || draft); setNotice(`Approval ${decision.toLowerCase()}`)
      }
    } catch (decisionError) { setError(decisionError.message) } finally { setBusy(false) }
  }

  if (!workflow && !error) return <section className="hi5-workflow-panel is-loading"><span>Loading lifecycle…</span></section>
  if (!workflow) return <section className="hi5-workflow-panel"><div className="hi5-workflow-error"><AlertTriangle size={15} />{error}</div><button type="button" onClick={load}>Retry lifecycle</button></section>

  return <section className="hi5-workflow-panel" data-hi5-workflow={workflow.type}>
    <header><div><span><GitBranch size={14} />Lifecycle</span><strong>{workflow.type} workflow</strong></div><em>{workflow.status}</em></header>
    <StageStrip workflow={workflow} />
    {workflow.blockers?.length ? <div className="hi5-workflow-blockers"><AlertTriangle size={15} /><span><strong>Workflow gates</strong>{workflow.blockers.map((item) => <small key={item}>{item}</small>)}</span></div> : null}
    {notice ? <div className="hi5-workflow-notice"><Sparkles size={14} />{notice}</div> : null}
    {error ? <div className="hi5-workflow-error"><AlertTriangle size={15} />{error}</div> : null}
    {workflow.type === 'Service Request' ? <ServiceRequestWorkflow workflow={workflow} busy={busy} onTransition={transition} onDecision={decide} /> : null}
    {workflow.type === 'Problem' ? <ProblemEditor workflow={workflow} draft={draft} setDraft={setDraft} busy={busy} onSave={saveData} onTransition={transition} /> : null}
    {workflow.type === 'Change' ? <ChangeEditor workflow={workflow} draft={draft} setDraft={setDraft} busy={busy} onSave={saveData} onTransition={transition} onDecision={decide} /> : null}
  </section>
}

export function ProductionWorkflowExperience() {
  const [route, setRoute] = useState(() => routeState())
  const [target, setTarget] = useState(null)

  useEffect(() => {
    const update = () => setRoute(routeState())
    window.addEventListener('popstate', update)
    window.addEventListener('hi5-routechange', update)
    return () => { window.removeEventListener('popstate', update); window.removeEventListener('hi5-routechange', update) }
  }, [])

  useEffect(() => {
    if (!route) { setTarget(null); return undefined }
    const scan = () => {
      const selector = route.section === 'requests'
        ? '.activity-canvas-inspector, .activity-canvas-sidebar'
        : '.record-workbench-details'
      const next = document.querySelector(selector)
      setTarget(next instanceof HTMLElement ? next : null)
    }
    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    const timer = window.setInterval(scan, 600)
    return () => { observer.disconnect(); window.clearInterval(timer) }
  }, [route?.reference, route?.section])

  const key = useMemo(() => route ? `${route.section}:${route.reference}` : '', [route])
  if (!route || !target) return null
  return createPortal(<WorkflowPanel key={key} reference={route.reference} />, target)
}

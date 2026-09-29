import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ClipboardList,
  FileText,
  LoaderCircle,
  MessageSquareText,
  Paperclip,
  RefreshCw,
  Send,
  ShieldCheck,
  Upload,
  UserRoundCog,
} from 'lucide-react'
import {
  addProductionServiceRequestActivity,
  decideProductionServiceRequestApproval,
  fetchProductionServiceRequest,
  patchProductionServiceRequest,
  patchProductionServiceRequestTask,
} from '../services/productionServiceRequests.js'
import './ProductionRecordWorkingPeek.css'

const API_BASE = window.__HI5_API_BASE__
const GENERIC_TYPES = { incidents: 'Incident', problems: 'Problem', changes: 'Change' }

function parseRecordPath(path = '') {
  const match = String(path).match(/^\/(incidents|requests|problems|changes)\/([^/?#]+)/i)
  if (!match) return null
  const section = match[1].toLowerCase()
  return {
    section,
    type: section === 'requests' ? 'Service Request' : GENERIC_TYPES[section],
    reference: decodeURIComponent(match[2]),
  }
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function formatBytes(value) {
  const size = Number(value || 0)
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || 'The record operation could not be completed.')
    error.status = response.status
    throw error
  }
  return payload
}

function fileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || '').split(',').pop() || '')
    reader.onerror = () => reject(reader.error || new Error('Could not read attachment.'))
    reader.readAsDataURL(file)
  })
}

function Notice({ error, notice, onClear }) {
  if (!error && !notice) return null
  return <div className={`hi5-working-peek-notice${error ? ' is-error' : ' is-success'}`}>{error ? <AlertTriangle size={15} /> : <Check size={15} />}<span>{error || notice}</span><button type="button" onClick={onClear}>×</button></div>
}

function Loading() {
  return <div className="hi5-working-peek-loading"><LoaderCircle size={22} /><span>Loading record…</span></div>
}

function GenericWorkingPeek({ route }) {
  const [detail, setDetail] = useState(null)
  const [tasks, setTasks] = useState([])
  const [people, setPeople] = useState([])
  const [teams, setTeams] = useState([])
  const [view, setView] = useState('activity')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [note, setNote] = useState('')
  const [visibility, setVisibility] = useState('internal')
  const [attachment, setAttachment] = useState(null)
  const [taskTitle, setTaskTitle] = useState('')
  const [team, setTeam] = useState('')
  const [assignee, setAssignee] = useState('Unassigned')

  async function load({ quiet = false } = {}) {
    if (!quiet) setDetail(null)
    setError('')
    try {
      const [record, taskPayload, organisation] = await Promise.all([
        apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}`),
        apiJson(`/api/v1/itsm-actions/${encodeURIComponent(route.reference)}/tasks`).catch(() => ({ tasks: [] })),
        apiJson('/api/v1/organisation').catch(() => ({ people: [], teams: [] })),
      ])
      setDetail(record)
      setTasks(taskPayload.tasks || [])
      setPeople(organisation.people || [])
      setTeams(organisation.teams || [])
      setTeam(record.team || '')
      setAssignee(record.assignee || 'Unassigned')
    } catch (loadError) {
      setError(loadError.message)
    }
  }

  useEffect(() => { void load() }, [route.reference])

  async function patchRecord(values, success) {
    if (!detail) return
    setSaving(true); setError(''); setNotice('')
    try {
      const next = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}`, {
        method: 'PATCH',
        body: JSON.stringify({ version: detail.version, ...values }),
      })
      setDetail(next)
      setTeam(next.team || '')
      setAssignee(next.assignee || 'Unassigned')
      setNotice(success)
    } catch (saveError) {
      setError(saveError.status === 409 ? 'This record changed elsewhere. Reload the Peek and try again.' : saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function postNote() {
    if (!note.trim() || !detail) return
    setSaving(true); setError(''); setNotice('')
    try {
      const next = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/activity`, {
        method: 'POST',
        body: JSON.stringify({ text: note.trim(), visibility }),
      })
      setDetail(next)
      setNote('')
      setNotice(visibility === 'customer' ? 'Customer update sent' : 'Internal note added')
    } catch (postError) {
      setError(postError.message)
    } finally {
      setSaving(false)
    }
  }

  async function uploadAttachment() {
    if (!attachment || !detail) return
    if (attachment.size > 5 * 1024 * 1024) { setError('Attachments are limited to 5 MB each.'); return }
    setSaving(true); setError(''); setNotice('')
    try {
      const contentBase64 = await fileBase64(attachment)
      const next = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/attachments`, {
        method: 'POST',
        body: JSON.stringify({ fileName: attachment.name, mimeType: attachment.type || 'application/octet-stream', contentBase64 }),
      })
      setDetail(next)
      setAttachment(null)
      setNotice('Attachment uploaded')
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setSaving(false)
    }
  }

  async function createTask() {
    if (!taskTitle.trim() || !detail) return
    setSaving(true); setError(''); setNotice('')
    try {
      await apiJson(`/api/v1/itsm-actions/${encodeURIComponent(route.reference)}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ version: detail.version, title: taskTitle.trim(), team: '', assignee: 'Unassigned', note: '' }),
      })
      setTaskTitle('')
      await load({ quiet: true })
      setNotice('Task created')
    } catch (taskError) {
      setError(taskError.message)
    } finally {
      setSaving(false)
    }
  }

  if (!detail) return error ? <div className="hi5-working-peek-failure"><AlertTriangle size={20} /><strong>Could not load this record</strong><span>{error}</span><button type="button" onClick={() => load()}>Retry</button></div> : <Loading />

  const activities = Array.isArray(detail.activities) ? detail.activities : []
  const attachments = Array.isArray(detail.attachments) ? detail.attachments : []
  const relationships = Array.isArray(detail.relationships) ? detail.relationships : []

  return <div className="hi5-working-peek">
    <Notice error={error} notice={notice} onClear={() => { setError(''); setNotice('') }} />
    <div className="hi5-working-peek-record-head">
      <div><strong>{detail.id}</strong><span>{detail.status}</span><span>{detail.priority}</span></div>
      <h2>{detail.title}</h2>
      <div className="hi5-working-peek-core-controls">
        <label><span>Status</span><select disabled={saving} value={detail.status} onChange={(event) => patchRecord({ status: event.target.value }, `Status changed to ${event.target.value}`)}>{(detail.allowedStatuses || []).map((status) => <option key={status}>{status}</option>)}</select></label>
        <label><span>Team</span><select value={team} onChange={(event) => setTeam(event.target.value)}><option value="">Unassigned</option>{teams.map((item) => <option value={item.name} key={item.id}>{item.name}</option>)}</select></label>
        <label><span>Assignee</span><select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option>Unassigned</option>{people.map((person) => <option value={person.name} key={person.id}>{person.name}</option>)}</select></label>
        <button type="button" disabled={saving || (team === (detail.team || '') && assignee === (detail.assignee || 'Unassigned'))} onClick={() => patchRecord({ team, assignee }, 'Assignment saved')}><UserRoundCog size={15} />Save assignment</button>
        <button type="button" title="Reload" onClick={() => load({ quiet: true })}><RefreshCw size={15} /></button>
      </div>
    </div>

    <nav className="hi5-working-peek-tabs">
      {['activity','details','tasks','attachments'].map((item) => <button type="button" key={item} className={view === item ? 'is-active' : ''} onClick={() => setView(item)}>{item === 'activity' ? 'Activity' : item === 'details' ? 'Details' : item === 'tasks' ? `Tasks ${tasks.length}` : `Attachments ${attachments.length}`}</button>)}
    </nav>

    <div className="hi5-working-peek-content">
      {view === 'activity' ? <>
        <div className="hi5-working-peek-activity">{activities.length ? activities.map((item) => <article key={item.id}><header><strong>{item.actor || 'Hi5Central'}</strong><span>{formatDate(item.createdAt)}</span><em>{item.visibility === 'customer' ? 'Customer visible' : item.kind || 'Internal'}</em></header><p>{item.text || 'Record updated'}</p></article>) : <div className="hi5-working-peek-empty">No activity yet.</div>}</div>
        <div className="hi5-working-peek-composer"><div><button type="button" className={visibility === 'internal' ? 'is-active' : ''} onClick={() => setVisibility('internal')}>Internal note</button><button type="button" className={visibility === 'customer' ? 'is-active' : ''} onClick={() => setVisibility('customer')}>Customer update</button></div><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={visibility === 'customer' ? 'Write a customer-visible update…' : 'Write an internal note…'} /><button type="button" disabled={saving || !note.trim()} onClick={postNote}><Send size={15} />Post update</button></div>
      </> : null}

      {view === 'details' ? <div className="hi5-working-peek-facts">
        {[['Requester', detail.requester],['Email', detail.requesterEmail],['Service', detail.service],['Category', detail.category],['Impact', detail.impact],['Urgency', detail.urgency],['Assignment', `${detail.team || 'Unassigned'} / ${detail.assignee || 'Unassigned'}`],['Updated', formatDate(detail.updatedAt)]].map(([label,value]) => <div key={label}><span>{label}</span><strong>{value || 'Not recorded'}</strong></div>)}
        {relationships.length ? <section><h3>Relationships</h3>{relationships.map((item) => <p key={item.id}>{item.relationshipType || item.type || 'Related'} · {item.reference || item.targetReference || ''} {item.title || ''}</p>)}</section> : null}
      </div> : null}

      {view === 'tasks' ? <div className="hi5-working-peek-task-view"><div className="hi5-working-peek-create-task"><input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="New task title" /><button type="button" disabled={saving || !taskTitle.trim()} onClick={createTask}><ClipboardList size={15} />Create task</button></div>{tasks.length ? tasks.map((task) => <article key={task.id}><div><strong>{task.title}</strong><span>{task.status}</span></div><small>{task.team || 'Unassigned'} · {task.assignee || 'Unassigned'}{task.dueAt ? ` · Due ${formatDate(task.dueAt)}` : ''}</small></article>) : <div className="hi5-working-peek-empty">No tasks on this record.</div>}</div> : null}

      {view === 'attachments' ? <div className="hi5-working-peek-attachments"><div className="hi5-working-peek-upload"><label><Paperclip size={16} /><span>{attachment ? `${attachment.name} · ${formatBytes(attachment.size)}` : 'Choose attachment'}</span><input type="file" onChange={(event) => setAttachment(event.target.files?.[0] || null)} /></label><button type="button" disabled={saving || !attachment} onClick={uploadAttachment}><Upload size={15} />Upload</button></div>{attachments.length ? attachments.map((item) => <article key={item.id}><FileText size={17} /><span><strong>{item.fileName}</strong><small>{formatBytes(item.byteSize)} · {item.uploadedBy || 'Hi5Central'}</small></span><a href={`${API_BASE}/api/v1/itsm-lifecycle/${encodeURIComponent(detail.id)}/attachments/${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer">Open</a></article>) : <div className="hi5-working-peek-empty">No attachments on this record.</div>}</div> : null}
    </div>
  </div>
}

function ServiceRequestWorkingPeek({ route }) {
  const [detail, setDetail] = useState(null)
  const [people, setPeople] = useState([])
  const [teams, setTeams] = useState([])
  const [view, setView] = useState('activity')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [note, setNote] = useState('')
  const [visibility, setVisibility] = useState('internal')
  const [team, setTeam] = useState('')
  const [assignee, setAssignee] = useState('Unassigned')
  const [approvalNote, setApprovalNote] = useState('')
  const [attachment, setAttachment] = useState(null)

  async function load({ quiet = false } = {}) {
    if (!quiet) setDetail(null)
    setError('')
    try {
      const [request, organisation] = await Promise.all([
        fetchProductionServiceRequest(route.reference),
        apiJson('/api/v1/organisation').catch(() => ({ people: [], teams: [] })),
      ])
      setDetail(request)
      setPeople(organisation.people || [])
      setTeams(organisation.teams || [])
      setTeam(request.team || '')
      setAssignee(request.assignee || 'Unassigned')
    } catch (loadError) {
      setError(loadError.message)
    }
  }

  useEffect(() => { void load() }, [route.reference])

  async function saveAssignment() {
    setSaving(true); setError(''); setNotice('')
    try {
      await patchProductionServiceRequest(route.reference, { team, assignee })
      await load({ quiet: true })
      setNotice('Assignment saved')
    } catch (saveError) { setError(saveError.message) } finally { setSaving(false) }
  }

  async function postActivity(extraAttachments = []) {
    if (!note.trim() && !extraAttachments.length) return
    setSaving(true); setError(''); setNotice('')
    try {
      await addProductionServiceRequestActivity(route.reference, {
        kind: visibility === 'customer' ? 'customer' : 'work',
        text: note.trim(),
        html: '',
        attachments: extraAttachments,
      })
      setNote('')
      setAttachment(null)
      await load({ quiet: true })
      setNotice(extraAttachments.length ? 'Attachment added to activity' : visibility === 'customer' ? 'Customer update sent' : 'Internal note added')
    } catch (postError) { setError(postError.message) } finally { setSaving(false) }
  }

  async function uploadAttachment() {
    if (!attachment) return
    await postActivity([{ id: crypto.randomUUID?.() || `${Date.now()}`, name: attachment.name, size: attachment.size, type: attachment.type || 'application/octet-stream' }])
  }

  async function updateTask(task, status) {
    setSaving(true); setError(''); setNotice('')
    try {
      await patchProductionServiceRequestTask(route.reference, task.id, { status })
      await load({ quiet: true })
      setNotice(`${task.title} updated`)
    } catch (taskError) { setError(taskError.message) } finally { setSaving(false) }
  }

  async function decide(approval, decision) {
    setSaving(true); setError(''); setNotice('')
    try {
      await decideProductionServiceRequestApproval(route.reference, approval.id, decision, approvalNote)
      await load({ quiet: true })
      setNotice(`${approval.label} ${decision.toLowerCase()}`)
      setApprovalNote('')
    } catch (approvalError) { setError(approvalError.message) } finally { setSaving(false) }
  }

  if (!detail) return error ? <div className="hi5-working-peek-failure"><AlertTriangle size={20} /><strong>Could not load this request</strong><span>{error}</span><button type="button" onClick={() => load()}>Retry</button></div> : <Loading />

  const activities = Array.isArray(detail.activities) ? detail.activities : []
  const tasks = Array.isArray(detail.requestTasks) ? detail.requestTasks : []
  const approvals = Array.isArray(detail.requestApprovals) ? detail.requestApprovals : []
  const items = Array.isArray(detail.requestedItems) ? detail.requestedItems : []
  const info = Array.isArray(detail.requestInformation) ? detail.requestInformation : []
  const activityAttachments = activities.flatMap((item) => Array.isArray(item.attachments) ? item.attachments : [])

  return <div className="hi5-working-peek">
    <Notice error={error} notice={notice} onClear={() => { setError(''); setNotice('') }} />
    <div className="hi5-working-peek-record-head"><div><strong>{detail.id}</strong><span>{detail.status}</span><span>{detail.priority}</span></div><h2>{detail.title}</h2><div className="hi5-working-peek-core-controls"><label><span>Team</span><select value={team} onChange={(event) => setTeam(event.target.value)}><option value="">Unassigned</option>{teams.map((item) => <option value={item.name} key={item.id}>{item.name}</option>)}</select></label><label><span>Assignee</span><select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option>Unassigned</option>{people.map((person) => <option value={person.name} key={person.id}>{person.name}</option>)}</select></label><button type="button" disabled={saving || (team === (detail.team || '') && assignee === (detail.assignee || 'Unassigned'))} onClick={saveAssignment}><UserRoundCog size={15} />Save assignment</button><button type="button" title="Reload" onClick={() => load({ quiet: true })}><RefreshCw size={15} /></button></div></div>

    <nav className="hi5-working-peek-tabs">{['activity','details','tasks','approvals','attachments'].map((item) => <button type="button" key={item} className={view === item ? 'is-active' : ''} onClick={() => setView(item)}>{item === 'activity' ? 'Activity' : item === 'details' ? 'Request' : item === 'tasks' ? `Tasks ${tasks.length}` : item === 'approvals' ? `Approvals ${approvals.length}` : `Attachments ${activityAttachments.length}`}</button>)}</nav>

    <div className="hi5-working-peek-content">
      {view === 'activity' ? <><div className="hi5-working-peek-activity">{activities.length ? activities.map((item) => <article key={item.id}><header><strong>{item.actor || 'Hi5Central'}</strong><span>{formatDate(item.createdAt)}</span><em>{item.visibility === 'customer' || item.kind === 'customer' ? 'Customer visible' : item.kind === 'work' ? 'Internal' : 'System'}</em></header><p>{item.text || 'Request updated'}</p>{Array.isArray(item.attachments) && item.attachments.length ? <small>{item.attachments.map((file) => file.name).join(', ')}</small> : null}</article>) : <div className="hi5-working-peek-empty">No activity yet.</div>}</div><div className="hi5-working-peek-composer"><div><button type="button" className={visibility === 'internal' ? 'is-active' : ''} onClick={() => setVisibility('internal')}>Internal note</button><button type="button" className={visibility === 'customer' ? 'is-active' : ''} onClick={() => setVisibility('customer')}>Customer update</button></div><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add an update…" /><button type="button" disabled={saving || !note.trim()} onClick={() => postActivity()}><Send size={15} />Post update</button></div></> : null}

      {view === 'details' ? <div className="hi5-working-peek-facts">{[['Requester', detail.requester],['Email', detail.requesterEmail],['Service', detail.service],['Catalogue item', detail.catalogueItemTitle],['Assignment', `${detail.team || 'Unassigned'} / ${detail.assignee || 'Unassigned'}`],['One-off cost', `${detail.currency || 'GBP'} ${Number(detail.oneOffCost || 0).toFixed(2)}`],['Monthly cost', `${detail.currency || 'GBP'} ${Number(detail.monthlyCost || 0).toFixed(2)}`]].map(([label,value]) => <div key={label}><span>{label}</span><strong>{value || 'Not recorded'}</strong></div>)}{info.length ? <section><h3>Submitted information</h3>{info.map((item, index) => <p key={`${item.label}-${index}`}><b>{item.label}</b> {item.value}</p>)}</section> : null}{items.length ? <section><h3>Requested items</h3>{items.map((item) => <p key={item.id || item.databaseId || item.name}><b>{item.name}</b> · Qty {item.quantity || 1}</p>)}</section> : null}</div> : null}

      {view === 'tasks' ? <div className="hi5-working-peek-task-view">{tasks.length ? tasks.map((task) => <article key={task.id}><div><strong>{task.title}</strong><select disabled={saving} value={task.status} onChange={(event) => updateTask(task, event.target.value)}>{['Waiting','Ready','In Progress','Completed','Blocked'].map((status) => <option key={status}>{status}</option>)}</select></div><small>{task.team || 'Unassigned'} · {task.assignee || 'Unassigned'}{task.dueAt ? ` · Due ${formatDate(task.dueAt)}` : ''}</small></article>) : <div className="hi5-working-peek-empty">No fulfilment tasks.</div>}</div> : null}

      {view === 'approvals' ? <div className="hi5-working-peek-approval-view"><textarea value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} placeholder="Optional approval decision note" />{approvals.length ? approvals.map((approval) => <article key={approval.id}><div><ShieldCheck size={16} /><span><strong>{approval.label}</strong><small>{approval.approver || approval.approverName || 'Approver'} · {approval.status}</small></span></div>{approval.status === 'Pending' ? <div><button type="button" disabled={saving} onClick={() => decide(approval, 'Approved')}>Approve</button><button type="button" disabled={saving} onClick={() => decide(approval, 'Rejected')}>Reject</button></div> : null}</article>) : <div className="hi5-working-peek-empty">No approvals required.</div>}</div> : null}

      {view === 'attachments' ? <div className="hi5-working-peek-attachments"><div className="hi5-working-peek-upload"><label><Paperclip size={16} /><span>{attachment ? `${attachment.name} · ${formatBytes(attachment.size)}` : 'Choose attachment'}</span><input type="file" onChange={(event) => setAttachment(event.target.files?.[0] || null)} /></label><button type="button" disabled={saving || !attachment} onClick={uploadAttachment}><Upload size={15} />Add</button></div>{activityAttachments.length ? activityAttachments.map((item, index) => <article key={`${item.id || item.name}-${index}`}><FileText size={17} /><span><strong>{item.name || 'Attachment'}</strong><small>{formatBytes(item.size)} · {item.type || 'File'}</small></span></article>) : <div className="hi5-working-peek-empty">No attachments on this request.</div>}<small className="hi5-working-peek-attachment-note">Service Request attachments are currently stored against the activity entry, matching the existing request model.</small></div> : null}
    </div>
  </div>
}

export function ProductionRecordWorkingPeek({ preview }) {
  const route = useMemo(() => parseRecordPath(preview?.openPath || ''), [preview?.openPath])
  if (!route) return null
  return route.type === 'Service Request' ? <ServiceRequestWorkingPeek route={route} /> : <GenericWorkingPeek route={route} />
}

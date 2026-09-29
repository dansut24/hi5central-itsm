import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Cloud,
  ClipboardCheck,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Home,
  Inbox,
  KeyRound,
  LifeBuoy,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  PackageOpen,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react'
import { ProductionPortalApprovals } from './ProductionPortalApprovals.jsx'
import './ProductionRequesterPortal.css'

const API_BASE = window.__HI5_API_BASE__

function formatMoney(value, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function initials(value = '') {
  return String(value).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'HC'
}

function fieldVisible(field, values) {
  const condition = field?.showWhen
  if (!condition || typeof condition !== 'object') return true
  const current = values[condition.field]
  if (Object.prototype.hasOwnProperty.call(condition, 'equals')) return current === condition.equals
  if (Array.isArray(condition.oneOf)) return condition.oneOf.includes(current)
  return true
}

function requiredMissing(field, value) {
  if (!field?.required) return false
  if (Array.isArray(value)) return value.length === 0
  if (field.type === 'checkbox') return value !== true
  return !String(value ?? '').trim()
}

function catalogueCost(item, values) {
  let oneOff = 0
  let monthly = 0
  for (const field of item?.fields || []) {
    if (!fieldVisible(field, values)) continue
    const options = Array.isArray(field.options) ? field.options : []
    const selected = field.type === 'checkbox-products'
      ? new Set(Array.isArray(values[field.id]) ? values[field.id] : [])
      : new Set(values[field.id] ? [values[field.id]] : [])
    for (const option of options) {
      if (!selected.has(option.value)) continue
      const cost = Number(option.cost || 0)
      if (option.recurring === 'monthly') monthly += cost
      else oneOff += cost
    }
  }
  return { oneOff, monthly }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  return { response, payload }
}

function StatusBadge({ status }) {
  const key = String(status || 'New').toLowerCase().replace(/[^a-z]+/g, '-')
  return <span className={`prp-status prp-status-${key}`}>{status || 'New'}</span>
}

function PortalAuth({ tenant, onAuthenticated }) {
  const params = new URLSearchParams(window.location.search)
  const activationToken = params.get('token') || ''
  const [mode, setMode] = useState(window.location.pathname === '/activate' ? 'activate-complete' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [microsoftAvailable, setMicrosoftAvailable] = useState(false)

  useEffect(() => {
    let active = true
    fetch(`${API_BASE}/api/v1/auth/microsoft/status/${encodeURIComponent(tenant.slug)}`, { credentials: 'include' })
      .then(async (response) => ({ response, payload: await response.json().catch(() => ({})) }))
      .then(({ response, payload }) => { if (active) setMicrosoftAvailable(Boolean(response.ok && payload.configured && payload.connected && payload.ssoEnabled)) })
      .catch(() => { if (active) setMicrosoftAvailable(false) })
    return () => { active = false }
  }, [tenant.slug])

  function microsoftSignIn() {
    const params = new URLSearchParams({ tenantSlug: tenant.slug, surface: 'portal', returnTo: '/' })
    window.location.href = `${API_BASE}/api/v1/auth/microsoft/start?${params.toString()}`
  }

  async function signIn(event) {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      const { response, payload } = await api('/api/v1/portal/auth/login', {
        method: 'POST',
        body: JSON.stringify({ tenantSlug: tenant.slug, email, password }),
      })
      if (!response.ok) throw new Error(payload.error || 'Could not sign in.')
      onAuthenticated(payload)
      window.history.replaceState({}, '', '/')
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  async function requestActivation(event) {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      const { payload } = await api('/api/v1/portal/auth/activate/request', {
        method: 'POST',
        body: JSON.stringify({ tenantSlug: tenant.slug, email }),
      })
      setMessage(payload.message || 'If your email is in the organisation directory, an activation email has been sent.')
    } catch {
      setMessage('If your email is in the organisation directory, an activation email has been sent.')
    } finally { setBusy(false) }
  }

  async function completeActivation(event) {
    event.preventDefault()
    if (password !== confirmPassword) { setError('The passwords do not match.'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      const { response, payload } = await api('/api/v1/portal/auth/activate/complete', {
        method: 'POST',
        body: JSON.stringify({ tenantSlug: tenant.slug, token: activationToken, password }),
      })
      if (!response.ok) throw new Error(payload.error || 'Could not activate Portal access.')
      setEmail(payload.email || '')
      setPassword('')
      setConfirmPassword('')
      setMessage(payload.existingAccount
        ? 'Your organisation has been linked to your existing Hi5Central account. Sign in with your existing password.'
        : 'Your Help Centre access is active. Sign in with your new password.')
      setMode('login')
      window.history.replaceState({}, '', '/login')
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <main className="prp-auth">
      <section className="prp-auth-card">
        <div className="prp-brand"><img src="/hi5central-logo.png" alt="Hi5Central" /><span>{tenant.companyName}</span></div>
        {mode === 'activate-complete' ? (
          <>
            <div className="prp-auth-heading"><span><ShieldCheck size={18} /> Account activation</span><h1>Create your Help Centre access</h1><p>Choose a secure password to link this Portal account to your organisation profile.</p></div>
            <form onSubmit={completeActivation}>
              <label>New password<input autoComplete="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
              <label>Confirm password<input autoComplete="new-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>
              {error ? <div className="prp-alert error">{error}</div> : null}
              <button className="prp-primary" disabled={busy || !activationToken} type="submit">{busy ? <RefreshCw className="is-spinning" size={17} /> : <ShieldCheck size={17} />} Activate access</button>
            </form>
            <button className="prp-link" onClick={() => { setMode('login'); window.history.replaceState({}, '', '/login') }} type="button">Back to sign in</button>
          </>
        ) : mode === 'activate' ? (
          <>
            <div className="prp-auth-heading"><span><UserPlus size={18} /> First time here?</span><h1>Activate your account</h1><p>Use the same work email address that appears in your organisation’s Hi5Central directory.</p></div>
            <form onSubmit={requestActivation}>
              <label>Work email address<input autoComplete="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              {message ? <div className="prp-alert success">{message}</div> : null}
              {error ? <div className="prp-alert error">{error}</div> : null}
              <button className="prp-primary" disabled={busy || !email} type="submit">{busy ? <RefreshCw className="is-spinning" size={17} /> : <UserPlus size={17} />} Send activation link</button>
            </form>
            <button className="prp-link" onClick={() => { setMode('login'); setError(''); setMessage('') }} type="button">Already activated? Sign in</button>
          </>
        ) : (
          <>
            <div className="prp-auth-heading"><span><LifeBuoy size={18} /> Self-service Help Centre</span><h1>Welcome back</h1><p>Sign in to report incidents, request services and follow progress.</p></div>
            <form onSubmit={signIn}>
              <label>Email address<input autoComplete="username" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <label>Password<input autoComplete="current-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
              {message ? <div className="prp-alert success">{message}</div> : null}
              {error ? <div className="prp-alert error">{error}</div> : null}
              <button className="prp-primary" disabled={busy || !email || !password} type="submit">{busy ? <RefreshCw className="is-spinning" size={17} /> : <LogIn size={17} />} Sign in</button>
            </form>
            {microsoftAvailable ? <><div className="prp-auth-divider"><span>or</span></div><button className="prp-microsoft" onClick={microsoftSignIn} type="button"><Cloud size={17} /> Sign in with Microsoft</button></> : null}
            <button className="prp-link" onClick={() => { setMode('activate'); setError(''); setMessage('') }} type="button"><KeyRound size={15} /> Activate Portal access</button>
          </>
        )}
      </section>
      <aside className="prp-auth-aside">
        <div><span>Hi5Central</span><h2>IT help without the queue chasing.</h2><p>Report issues, request what you need, see customer-visible updates and follow progress from one place.</p></div>
        <div className="prp-feature-grid"><span><LifeBuoy size={18} /> Raise incidents</span><span><PackageOpen size={18} /> Service catalogue</span><span><Inbox size={18} /> My Requests</span><span><ShieldCheck size={18} /> Secure access</span></div>
      </aside>
    </main>
  )
}

function RequestField({ field, value, onChange }) {
  const options = Array.isArray(field.options) ? field.options : []
  if (field.type === 'textarea' || field.type === 'richtext') {
    return <textarea rows={5} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || ''} />
  }
  if (field.type === 'select' || field.type === 'product') {
    return <select value={value || ''} onChange={(e) => onChange(e.target.value)}><option value="">Select…</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label || option.value}{option.cost ? ` · ${formatMoney(option.cost)}${option.recurring === 'monthly' ? '/mo' : ''}` : ''}</option>)}</select>
  }
  if (field.type === 'checkbox-products') {
    const selected = new Set(Array.isArray(value) ? value : [])
    return <div className="prp-check-options">{options.map((option) => <label key={option.value}><input type="checkbox" checked={selected.has(option.value)} onChange={(e) => { const next = new Set(selected); if (e.target.checked) next.add(option.value); else next.delete(option.value); onChange([...next]) }} /><span><strong>{option.label || option.value}</strong>{option.cost ? <small>{formatMoney(option.cost)}{option.recurring === 'monthly' ? '/month' : ''}</small> : null}</span></label>)}</div>
  }
  if (field.type === 'checkbox') {
    return <label className="prp-checkbox"><input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /><span>{field.checkboxLabel || field.help || 'Yes'}</span></label>
  }
  const type = ['date', 'email', 'number'].includes(field.type) ? field.type : 'text'
  return <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || ''} />
}

function RaiseIncident({ onSubmitted }) {
  const [summary, setSummary] = useState('')
  const [details, setDetails] = useState('')
  const [affectedService, setAffectedService] = useState('')
  const [impact, setImpact] = useState('me')
  const [urgency, setUrgency] = useState('Medium')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (summary.trim().length < 3) { setError('Add a short summary of the issue.'); return }
    if (details.trim().length < 3) { setError('Tell the Service Desk what happened.'); return }
    setBusy(true); setError('')
    try {
      const { response, payload } = await api('/api/v1/portal/incidents', {
        method: 'POST',
        body: JSON.stringify({
          summary: summary.trim(),
          urgency,
          fields: { affectedService: affectedService.trim(), impact },
          details: { text: details.trim(), attachments: [] },
        }),
      })
      if (!response.ok) throw new Error(payload.error || 'Could not raise this incident.')
      setSummary(''); setDetails(''); setAffectedService(''); setImpact('me'); setUrgency('Medium')
      onSubmitted(payload)
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return <section className="prp-page"><div className="prp-page-heading"><span>Incident</span><h1>Raise an incident</h1><p>Tell the Service Desk when something is broken, unavailable or stopping you from working.</p></div><form className="prp-request-form" onSubmit={submit}><div className="prp-card"><h2>What’s gone wrong?</h2><label><span>Summary *</span><input value={summary} onChange={(e) => { setSummary(e.target.value); setError('') }} placeholder="For example: Outlook will not open" /></label><label><span>What happened? *</span><textarea rows={6} value={details} onChange={(e) => { setDetails(e.target.value); setError('') }} placeholder="Describe what you were doing, what you expected to happen and any error message you saw." /></label><label><span>Affected service or application</span><input value={affectedService} onChange={(e) => setAffectedService(e.target.value)} placeholder="For example: Microsoft 365" /></label><label><span>Impact *</span><select value={impact} onChange={(e) => setImpact(e.target.value)}><option value="me">Only me</option><option value="team">My team</option><option value="many">Many people</option></select></label><label><span>Urgency</span><select value={urgency} onChange={(e) => setUrgency(e.target.value)}><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Critical">Critical</option></select></label></div><aside className="prp-request-summary"><div className="prp-card"><h2>Incident summary</h2><dl><div><dt>Type</dt><dd>Incident</dd></div><div><dt>Impact</dt><dd>{impact === 'me' ? 'Only me' : impact === 'team' ? 'My team' : 'Many people'}</dd></div><div><dt>Urgency</dt><dd>{urgency}</dd></div></dl><p className="prp-muted">Your incident will be sent straight to the Service Desk and will appear in My Requests.</p>{error ? <div className="prp-alert error">{error}</div> : null}<button className="prp-primary" disabled={busy} type="submit">{busy ? <RefreshCw className="is-spinning" size={17} /> : <LifeBuoy size={17} />} Raise incident</button></div></aside></form></section>
}

function Catalogue({ items, onSubmitted }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [values, setValues] = useState({})
  const [summary, setSummary] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const filtered = useMemo(() => items.filter((item) => `${item.title} ${item.category} ${item.description}`.toLowerCase().includes(query.toLowerCase())), [items, query])
  const visibleFields = (selected?.fields || []).filter((field) => fieldVisible(field, values))
  const cost = selected ? catalogueCost(selected, values) : { oneOff: 0, monthly: 0 }

  async function submit(event) {
    event.preventDefault()
    const missing = visibleFields.find((field) => requiredMissing(field, values[field.id]))
    if (missing) { setError(`${missing.label || 'A required field'} is required.`); return }
    setBusy(true); setError('')
    try {
      const endpoint = selected.requestType === 'Incident' ? '/api/v1/portal/incidents' : '/api/v1/service-requests'
      const { response, payload } = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          catalogueItemId: selected.id,
          summary: summary || selected.title,
          fields: values,
          details: { text: details || `Submitted ${selected.title}.`, attachments: [] },
          urgency: 'Medium',
        }),
      })
      if (!response.ok) throw new Error(payload.error || 'Could not submit this request.')
      setSelected(null); setValues({}); setSummary(''); setDetails('')
      onSubmitted(payload)
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  if (selected) {
    return <section className="prp-page"><button className="prp-back" onClick={() => { setSelected(null); setError('') }} type="button"><ArrowLeft size={16} /> Back to catalogue</button><div className="prp-page-heading"><span>{selected.category}</span><h1>{selected.title}</h1><p>{selected.description}</p></div><form className="prp-request-form" onSubmit={submit}><div className="prp-card"><h2>Request details</h2><label>Summary<input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={selected.title} /></label><label>Additional details<textarea rows={4} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Anything else the Service Desk should know?" /></label>{visibleFields.map((field) => <label key={field.id}><span>{field.label}{field.required ? ' *' : ''}</span><RequestField field={field} value={values[field.id]} onChange={(value) => { setValues((current) => ({ ...current, [field.id]: value })); setError('') }} />{field.help ? <small>{field.help}</small> : null}</label>)}</div><aside className="prp-request-summary"><div className="prp-card"><h2>Request summary</h2><dl><div><dt>Service</dt><dd>{selected.service}</dd></div><div><dt>Fulfilment</dt><dd>{selected.team}</dd></div><div><dt>One-off</dt><dd>{formatMoney(cost.oneOff)}</dd></div><div><dt>Monthly</dt><dd>{formatMoney(cost.monthly)}/mo</dd></div></dl>{error ? <div className="prp-alert error">{error}</div> : null}<button className="prp-primary" disabled={busy} type="submit">{busy ? <RefreshCw className="is-spinning" size={17} /> : <Send size={17} />} Submit request</button><small>Final pricing and availability are validated by Hi5Central when you submit.</small></div></aside></form></section>
  }

  return <section className="prp-page"><div className="prp-page-heading"><span>Service catalogue</span><h1>What do you need?</h1><p>Choose a published service request and Hi5Central will route it to the right team.</p></div><div className="prp-search"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search services…" /></div>{filtered.length ? <div className="prp-catalogue-grid">{filtered.map((item) => <button key={item.id} className="prp-catalogue-card" onClick={() => { setSelected(item); setValues({}); setSummary(item.title); setError('') }} type="button"><span className="prp-icon"><PackageOpen size={20} /></span><span className="prp-category">{item.category}</span><strong>{item.title}</strong><p>{item.description}</p><span className="prp-open">Start request <ChevronRight size={15} /></span></button>)}</div> : <div className="prp-empty"><PackageOpen size={28} /><strong>No services match your search</strong><span>Try a different term.</span></div>}</section>
}

function Requests({ selectedReference, onSelect, refreshKey }) {
  const [items, setItems] = useState([])
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)

  async function loadList() {
    setLoading(true); setError('')
    try {
      const { response, payload } = await api('/api/v1/portal/requests')
      if (!response.ok) throw new Error(payload.error || 'Could not load your requests.')
      setItems(payload.items || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function loadDetail(reference) {
    setError('')
    try {
      const { response, payload } = await api(`/api/v1/portal/requests/${encodeURIComponent(reference)}`)
      if (!response.ok) throw new Error(payload.error || 'Could not load this request.')
      setDetail(payload)
    } catch (err) { setError(err.message) }
  }

  useEffect(() => { loadList() }, [refreshKey])
  useEffect(() => { if (selectedReference) loadDetail(selectedReference); else setDetail(null) }, [selectedReference, refreshKey])

  async function sendComment(event) {
    event.preventDefault()
    if (!comment.trim() || !detail) return
    setSending(true); setError('')
    try {
      const { response, payload } = await api(`/api/v1/portal/requests/${encodeURIComponent(detail.reference)}/activities`, { method: 'POST', body: JSON.stringify({ kind: 'customer', text: comment.trim() }) })
      if (!response.ok) throw new Error(payload.error || 'Could not send your update.')
      setComment('')
      await loadDetail(detail.reference)
      await loadList()
    } catch (err) { setError(err.message) }
    finally { setSending(false) }
  }

  if (detail) {
    return <section className="prp-page"><button className="prp-back" onClick={() => onSelect('')} type="button"><ArrowLeft size={16} /> My Requests</button><div className="prp-record-heading"><div><span>{detail.reference}</span><h1>{detail.title}</h1><p>Created {formatDate(detail.createdAt)} · Updated {formatDate(detail.updatedAt)}</p></div><StatusBadge status={detail.status} /></div><div className="prp-detail-grid"><div className="prp-detail-main"><div className="prp-card"><h2>{detail.requestType === 'Incident' ? 'Incident information' : 'Request information'}</h2><dl className="prp-info-list"><div><dt>Service</dt><dd>{detail.service}</dd></div><div><dt>Priority</dt><dd>{detail.priority}</dd></div>{detail.requestType !== 'Incident' ? <><div><dt>One-off cost</dt><dd>{formatMoney(detail.oneOffCost, detail.currency)}</dd></div><div><dt>Monthly cost</dt><dd>{formatMoney(detail.monthlyCost, detail.currency)}/mo</dd></div></> : null}{(detail.requestInformation || []).map((item, index) => <div key={`${item.label}-${index}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></div>{detail.items?.length ? <div className="prp-card"><h2>Requested items</h2><div className="prp-item-list">{detail.items.map((item, index) => <div key={`${item.id}-${index}`}><span><strong>{item.name}</strong><small>{item.category}</small></span><b>{item.unitMonthlyCost ? `${formatMoney(item.unitMonthlyCost, item.currency)}/mo` : formatMoney(item.unitOneOffCost, item.currency)}</b></div>)}</div></div> : null}<div className="prp-card"><h2>Activity</h2><div className="prp-timeline">{detail.activities?.length ? detail.activities.map((activity) => <div key={activity.id}><span className="prp-timeline-dot" /><div><strong>{activity.actor}</strong><time>{formatDate(activity.createdAt)}</time><p>{activity.text}</p></div></div>) : <div className="prp-empty compact">No customer-visible updates yet.</div>}</div><form className="prp-comment" onSubmit={sendComment}><textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add an update for the Service Desk…" />{error ? <div className="prp-alert error">{error}</div> : null}<button className="prp-primary" disabled={sending || !comment.trim()} type="submit"><Send size={16} /> Send update</button></form></div></div><aside className="prp-detail-side"><div className="prp-card"><h2>Progress</h2>{detail.approvals?.map((approval) => <div className="prp-progress-row" key={approval.id}><span><CheckCircle2 size={16} /><strong>{approval.label}</strong></span><small>{approval.status}</small></div>)}{detail.tasks?.map((task) => <div className="prp-progress-row" key={task.id}><span><Clock3 size={16} /><strong>{task.title}</strong></span><small>{task.status}</small></div>)}{!detail.approvals?.length && !detail.tasks?.length ? <p className="prp-muted">Your request is waiting for the Service Desk.</p> : null}</div></aside></div></section>
  }

  return <section className="prp-page"><div className="prp-page-heading"><span>My Requests</span><h1>Track your IT requests</h1><p>Only incidents and service requests submitted by your account are shown here.</p></div>{error ? <div className="prp-alert error">{error}</div> : null}{loading ? <div className="prp-loading"><RefreshCw className="is-spinning" size={22} /> Loading your requests…</div> : items.length ? <div className="prp-request-list">{items.map((item) => <button key={item.reference} onClick={() => onSelect(item.reference)} type="button"><span><small>{item.reference} · {item.service}</small><strong>{item.title}</strong><em>Updated {formatDate(item.updatedAt)}</em></span><span><StatusBadge status={item.status} /><ChevronRight size={17} /></span></button>)}</div> : <div className="prp-empty"><Inbox size={30} /><strong>No requests yet</strong><span>When you raise an incident or request a service, it will appear here.</span></div>}</section>
}

export function ProductionRequesterPortal({ catalogue, tenant }) {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [section, setSection] = useState(() => {
    const route = window.location.pathname.split('/').filter(Boolean)[0] || 'home'
    return ['incident', 'catalogue', 'requests', 'approvals'].includes(route) ? route : 'home'
  })
  const [selectedRequest, setSelectedRequest] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [mobileNav, setMobileNav] = useState(false)

  useEffect(() => {
    let active = true
    api('/api/v1/portal/auth/session').then(({ response, payload }) => {
      if (active && response.ok) setSession(payload)
    }).finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [])

  async function signOut() {
    await api('/api/v1/portal/auth/logout', { method: 'POST' })
    setSession(null); setSection('home'); setSelectedRequest('')
    window.history.replaceState({}, '', '/login')
  }

  if (checking) return <main className="prp-loading-screen"><img src="/hi5central-logo.png" alt="Hi5Central" /><RefreshCw className="is-spinning" size={24} /><span>Opening {tenant.companyName} Help Centre…</span></main>
  if (!session) return <PortalAuth tenant={tenant} onAuthenticated={setSession} />

  const user = session.user || {}
  const capabilities = session.portalCapabilities || { requests: true, approvals: false }
  const canRequest = capabilities.requests !== false
  const canApprove = Boolean(capabilities.approvals)
  const activeSection = !canRequest && ['incident', 'catalogue', 'requests'].includes(section)
    ? (canApprove ? 'approvals' : 'home')
    : section
  const serviceItems = (catalogue.items || []).filter((item) => item.requestType !== 'Incident')
  const navigate = (next) => { setSection(next); setSelectedRequest(''); setMobileNav(false); window.history.replaceState({}, '', next === 'home' ? '/' : `/${next}`) }
  const submitted = (request) => { setSelectedRequest(request.reference || request.id); setSection('requests'); setRefreshKey((value) => value + 1) }

  const requestNav = canRequest ? <>
    <button className={activeSection === 'incident' ? 'active' : ''} onClick={() => navigate('incident')}><LifeBuoy size={17} /> Raise incident</button>
    <button className={activeSection === 'catalogue' ? 'active' : ''} onClick={() => navigate('catalogue')}><PackageOpen size={17} /> Services</button>
    <button className={activeSection === 'requests' ? 'active' : ''} onClick={() => navigate('requests')}><Inbox size={17} /> My Requests</button>
  </> : null

  const mobileRequestNav = canRequest ? <>
    <button onClick={() => navigate('incident')}><LifeBuoy size={18} /> Raise incident</button>
    <button onClick={() => navigate('catalogue')}><PackageOpen size={18} /> Services</button>
    <button onClick={() => navigate('requests')}><Inbox size={18} /> My Requests</button>
  </> : null

  return (
    <div className="prp-shell">
      <header className="prp-header">
        <div className="prp-brand"><img src="/hi5central-logo.png" alt="" /><span><strong>{tenant.companyName}</strong><small>Help Centre</small></span></div>
        <nav>
          <button className={activeSection === 'home' ? 'active' : ''} onClick={() => navigate('home')}><Home size={17} /> Home</button>
          {requestNav}
          {canApprove ? <button className={activeSection === 'approvals' ? 'active' : ''} onClick={() => navigate('approvals')}><ClipboardCheck size={17} /> My Approvals</button> : null}
        </nav>
        <div className="prp-user"><span>{initials(user.name)}</span><div><strong>{user.name}</strong><small>{user.email}</small></div><button title="Sign out" onClick={signOut}><LogOut size={17} /></button></div>
        <button className="prp-mobile-menu" onClick={() => setMobileNav(true)}><Menu size={21} /></button>
      </header>
      {mobileNav ? <div className="prp-mobile-nav"><div><strong>{tenant.companyName}</strong><button onClick={() => setMobileNav(false)}><X size={20} /></button></div><button onClick={() => navigate('home')}><Home size={18} /> Home</button>{mobileRequestNav}{canApprove ? <button onClick={() => navigate('approvals')}><ClipboardCheck size={18} /> My Approvals</button> : null}<button onClick={signOut}><LogOut size={18} /> Sign out</button></div> : null}
      <main className="prp-content">
        {activeSection === 'approvals' && canApprove ? <ProductionPortalApprovals />
          : activeSection === 'incident' && canRequest ? <RaiseIncident onSubmitted={submitted} />
            : activeSection === 'catalogue' && canRequest ? <Catalogue items={serviceItems} onSubmitted={submitted} />
              : activeSection === 'requests' && canRequest ? <Requests selectedReference={selectedRequest} onSelect={setSelectedRequest} refreshKey={refreshKey} />
                : <section className="prp-home">
                    <div className="prp-hero">
                      <span>Hi {user.name?.split(' ')[0] || 'there'}</span>
                      <h1>{canRequest ? 'What can IT help you with?' : 'Approvals waiting for your review.'}</h1>
                      <p>{canRequest ? 'Report incidents, request services, follow progress and keep every customer-visible update in one place.' : 'Review Service Requests assigned to you without needing Service Desk workspace access.'}</p>
                      <div>{canRequest ? <><button className="prp-primary" onClick={() => navigate('incident')}><LifeBuoy size={17} /> Raise incident</button><button className="prp-secondary" onClick={() => navigate('catalogue')}><Plus size={17} /> Request a service</button></> : null}{canApprove ? <button className={canRequest ? 'prp-secondary' : 'prp-primary'} onClick={() => navigate('approvals')}><ClipboardCheck size={17} /> My Approvals</button> : null}</div>
                    </div>
                    <div className="prp-home-grid">
                      {canRequest ? <><button onClick={() => navigate('incident')}><span className="prp-icon"><LifeBuoy size={20} /></span><strong>Raise incident</strong><p>Tell the Service Desk when something is broken or stopping you from working.</p><ChevronRight size={17} /></button><button onClick={() => navigate('catalogue')}><span className="prp-icon"><PackageOpen size={20} /></span><strong>Service catalogue</strong><p>Browse the services and products your organisation has published.</p><ChevronRight size={17} /></button><button onClick={() => navigate('requests')}><span className="prp-icon"><Inbox size={20} /></span><strong>My Requests</strong><p>See incidents, service requests, fulfilment and customer updates.</p><ChevronRight size={17} /></button></> : null}
                      {canApprove ? <button onClick={() => navigate('approvals')}><span className="prp-icon"><ClipboardCheck size={20} /></span><strong>My Approvals</strong><p>Review requests assigned to you and approve or reject them securely.</p><ChevronRight size={17} /></button> : null}
                      <div><span className="prp-icon"><ShieldCheck size={20} /></span><strong>Private by default</strong><p>{canRequest ? 'You can only see requests associated with your authenticated account.' : 'You can only see approvals explicitly assigned to your account.'}</p></div>
                    </div>
                  </section>}
      </main>
    </div>
  )
}

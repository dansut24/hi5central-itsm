import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, ChevronRight, Clock3, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import './ProductionPortalApprovals.css'

const API_BASE = window.__HI5_API_BASE__

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'The approval operation failed.')
  return payload
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function money(value, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: currency || 'GBP', maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function ApprovalState({ status }) {
  const key = String(status || 'Pending').toLowerCase().replace(/[^a-z]+/g, '-')
  return <span className={`ppa-state is-${key}`}>{status || 'Pending'}</span>
}

export function ProductionPortalApprovals() {
  const [items, setItems] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  async function loadList() {
    setLoading(true)
    setError('')
    try {
      const payload = await api('/api/v1/portal/approvals')
      setItems(Array.isArray(payload.items) ? payload.items : [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(id) {
    setSelectedId(id)
    setDetail(null)
    setNote('')
    setError('')
    try {
      setDetail(await api(`/api/v1/portal/approvals/${encodeURIComponent(id)}`))
    } catch (loadError) {
      setError(loadError.message)
    }
  }

  useEffect(() => { void loadList() }, [])

  async function decide(decision) {
    if (!detail?.id || !detail?.request?.reference) return
    setBusy(true)
    setError('')
    try {
      await api(
        `/api/v1/service-requests/${encodeURIComponent(detail.request.reference)}/approvals/${encodeURIComponent(detail.id)}/decision`,
        { method: 'POST', body: JSON.stringify({ decision, note: note.trim() }) },
      )
      await loadList()
      await loadDetail(detail.id)
    } catch (decisionError) {
      setError(decisionError.message)
    } finally {
      setBusy(false)
    }
  }

  if (selectedId) {
    const request = detail?.request || {}
    return <section className="prp-page ppa-page">
      <button className="prp-back" type="button" onClick={() => { setSelectedId(''); setDetail(null); setError('') }}>
        <ArrowLeft size={16} /> My Approvals
      </button>
      {error ? <div className="prp-alert error">{error}</div> : null}
      {!detail ? <div className="prp-loading"><RefreshCw className="is-spinning" size={22} /> Loading approval…</div> : <>
        <div className="prp-record-heading ppa-heading">
          <div><span>{request.reference}</span><h1>{request.title}</h1><p>{detail.label} · requested {formatDate(request.createdAt)}</p></div>
          <ApprovalState status={detail.status} />
        </div>
        <div className="ppa-detail-grid">
          <div className="ppa-detail-main">
            <div className="prp-card">
              <h2>Request information</h2>
              <dl className="prp-info-list">
                <div><dt>Requester</dt><dd>{request.requester || '—'}</dd></div>
                <div><dt>Service</dt><dd>{request.service || '—'}</dd></div>
                <div><dt>Priority</dt><dd>{request.priority || '—'}</dd></div>
                <div><dt>Request status</dt><dd>{request.status || '—'}</dd></div>
                <div><dt>One-off cost</dt><dd>{money(request.oneOffCost, request.currency)}</dd></div>
                <div><dt>Monthly cost</dt><dd>{money(request.monthlyCost, request.currency)}/mo</dd></div>
                {(request.requestInformation || []).map((entry, index) => <div key={`${entry.label}-${index}`}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>)}
              </dl>
              {request.description ? <div className="ppa-description"><span>Description</span><p>{request.description}</p></div> : null}
            </div>
            {request.items?.length ? <div className="prp-card"><h2>Requested items</h2><div className="prp-item-list">{request.items.map((item, index) => <div key={`${item.id}-${index}`}><span><strong>{item.name}</strong><small>{item.category}{item.options?.length ? ` · ${item.options.join(' · ')}` : ''}</small></span><b>{item.unitMonthlyCost ? `${money(item.unitMonthlyCost, item.currency)}/mo` : money(item.unitOneOffCost, item.currency)}</b></div>)}</div></div> : null}
          </div>
          <aside className="ppa-decision-card prp-card">
            <div className="ppa-decision-title"><ShieldCheck size={19} /><div><span>Your decision</span><strong>{detail.label}</strong></div></div>
            {detail.status === 'Pending' && detail.canDecide ? <>
              <label><span>Decision note <small>optional</small></span><textarea rows={5} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add context for the requester and fulfilment team…" /></label>
              <div className="ppa-decision-actions">
                <button className="ppa-approve" type="button" disabled={busy} onClick={() => decide('Approved')}><CheckCircle2 size={17} /> Approve</button>
                <button className="ppa-reject" type="button" disabled={busy} onClick={() => decide('Rejected')}><XCircle size={17} /> Reject</button>
              </div>
            </> : <div className="ppa-decided"><ApprovalState status={detail.status} /><p>{detail.decisionNote || `This approval was ${String(detail.status).toLowerCase()}.`}</p><small>{formatDate(detail.decidedAt || detail.updatedAt)}</small></div>}
          </aside>
        </div>
      </>}
    </section>
  }

  const pending = items.filter((item) => item.status === 'Pending')
  const history = items.filter((item) => item.status !== 'Pending')

  return <section className="prp-page ppa-page">
    <div className="prp-page-heading"><span>My Approvals</span><h1>Requests waiting for your decision</h1><p>These approvals are assigned to your account. You do not need Service Desk access to review them.</p></div>
    {error ? <div className="prp-alert error">{error}</div> : null}
    {loading ? <div className="prp-loading"><RefreshCw className="is-spinning" size={22} /> Loading approvals…</div> : <>
      <div className="ppa-summary"><div><ShieldCheck size={19} /><span><strong>{pending.length}</strong><small>Awaiting your decision</small></span></div><div><Clock3 size={19} /><span><strong>{history.length}</strong><small>Previous decisions</small></span></div></div>
      <div className="ppa-list">
        {pending.map((item) => <button key={item.id} type="button" onClick={() => loadDetail(item.id)}><span><small>{item.request.reference} · {item.request.service}</small><strong>{item.request.title}</strong><em>{item.request.requester} · requested {formatDate(item.request.createdAt)}</em></span><span><ApprovalState status={item.status} /><ChevronRight size={17} /></span></button>)}
        {!pending.length ? <div className="prp-empty compact"><CheckCircle2 size={28} /><strong>You’re all caught up</strong><span>No approvals are currently waiting for you.</span></div> : null}
      </div>
      {history.length ? <div className="ppa-history"><h2>Decision history</h2><div className="ppa-list">{history.map((item) => <button key={item.id} type="button" onClick={() => loadDetail(item.id)}><span><small>{item.request.reference} · {item.label}</small><strong>{item.request.title}</strong><em>{formatDate(item.decidedAt || item.updatedAt)}</em></span><span><ApprovalState status={item.status} /><ChevronRight size={17} /></span></button>)}</div></div> : null}
    </>}
  </section>
}

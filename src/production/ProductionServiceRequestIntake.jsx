import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, CheckCircle2, ChevronRight, Search, ShoppingCart } from 'lucide-react'
import { hydrateProductionItsmWorkspaceRecords } from '../services/productionItsmRecords.js'
import './ProductionServiceRequestIntake.css'

const API_BASE = window.__HI5_API_BASE__

function optionObject(option) {
  if (option && typeof option === 'object' && !Array.isArray(option)) return option
  const value = String(option ?? '').trim()
  return value ? { value, label: value } : null
}

function visibleField(field, values) {
  const condition = field?.showWhen && typeof field.showWhen === 'object' ? field.showWhen : {}
  if (!Object.keys(condition).length) return true
  const current = values[condition.field]
  if (Object.prototype.hasOwnProperty.call(condition, 'equals')) return current === condition.equals
  if (Array.isArray(condition.oneOf)) return condition.oneOf.includes(current)
  return true
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

function FieldControl({ field, value, onChange }) {
  const options = (Array.isArray(field.options) ? field.options : []).map(optionObject).filter(Boolean)
  const common = { id: `production-sr-${field.id}`, required: Boolean(field.required) }

  if (field.type === 'textarea') {
    return <textarea {...common} rows="4" value={value || ''} onChange={(event) => onChange(event.target.value)} />
  }
  if (field.type === 'select' || field.type === 'product') {
    return (
      <select {...common} value={value || ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select an option</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label || option.value}</option>)}
      </select>
    )
  }
  if (field.type === 'checkbox-products') {
    const selected = new Set(Array.isArray(value) ? value : [])
    return (
      <div className="production-sr-checkbox-list">
        {options.map((option) => (
          <label key={option.value}><input type="checkbox" checked={selected.has(option.value)} onChange={(event) => {
            const next = new Set(selected)
            if (event.target.checked) next.add(option.value)
            else next.delete(option.value)
            onChange([...next])
          }} /><span><strong>{option.label || option.value}</strong>{option.category ? <small>{option.category}</small> : null}</span></label>
        ))}
      </div>
    )
  }
  if (field.type === 'checkbox') {
    return <label className="production-sr-single-check"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span>{field.checkboxLabel || field.help || 'Yes'}</span></label>
  }
  const type = ['date', 'email', 'number'].includes(field.type) ? field.type : 'text'
  return <input {...common} type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} />
}

function ProductionServiceRequestForm({ target }) {
  const [catalogue, setCatalogue] = useState({ items: [] })
  const [people, setPeople] = useState([])
  const [requesterId, setRequesterId] = useState('')
  const [catalogueId, setCatalogueId] = useState('')
  const [summary, setSummary] = useState('')
  const [urgency, setUrgency] = useState('Medium')
  const [fields, setFields] = useState({})
  const [details, setDetails] = useState('')
  const [requesterQuery, setRequesterQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([apiJson('/api/v1/catalogue'), apiJson('/api/v1/organisation')])
      .then(([cataloguePayload, organisation]) => {
        if (!active) return
        setCatalogue(cataloguePayload)
        setPeople((organisation.people || []).filter((person) => person.active !== false))
      })
      .catch((loadError) => { if (active) setError(loadError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const forms = useMemo(() => (catalogue.items || []).filter((item) => item.active !== false && item.kind === 'request-form' && item.requestType === 'Service Request' && item.visibility !== 'hidden'), [catalogue])
  const selectedForm = forms.find((item) => item.id === catalogueId)
  const schema = selectedForm?.formSchema || []
  const productMap = useMemo(() => new Map((catalogue.items || []).filter((item) => item.kind === 'product').map((item) => [item.id, item])), [catalogue])
  const filteredPeople = people.filter((person) => !requesterQuery.trim() || [person.name, person.email, person.jobTitle, person.role].join(' ').toLowerCase().includes(requesterQuery.trim().toLowerCase()))

  const price = useMemo(() => {
    let oneOff = 0
    let monthly = 0
    for (const field of schema) {
      if (!visibleField(field, fields) || !['product', 'checkbox-products'].includes(field.type)) continue
      const values = field.type === 'product' ? [fields[field.id]].filter(Boolean) : (Array.isArray(fields[field.id]) ? fields[field.id] : [])
      const options = (field.options || []).map(optionObject).filter(Boolean)
      for (const selected of values) {
        const option = options.find((candidate) => candidate.value === selected)
        const product = productMap.get(option?.itemId)
        if (!product) continue
        oneOff += Number(product.oneOffPrice || 0)
        monthly += Number(product.monthlyPrice || 0)
      }
    }
    return { oneOff, monthly }
  }, [fields, productMap, schema])

  function chooseForm(value) {
    setCatalogueId(value)
    setFields({})
    const form = forms.find((item) => item.id === value)
    if (form && !summary) setSummary(form.title)
  }

  async function submit(event) {
    event.preventDefault()
    if (!requesterId) { setError('Select the requester first.'); return }
    if (!catalogueId) { setError('Select a Service Catalogue item.'); return }
    setSubmitting(true)
    setError('')
    try {
      const created = await apiJson('/api/v1/service-requests', {
        method: 'POST',
        body: JSON.stringify({
          requesterPersonId: requesterId,
          catalogueItemId: catalogueId,
          summary,
          urgency,
          fields,
          details: { text: details, html: '', attachments: [] },
        }),
      })
      await hydrateProductionItsmWorkspaceRecords()
      window.location.assign(`/requests/${encodeURIComponent(created.id)}`)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <section className="production-sr-intake">
      <header className="production-sr-intake-topbar">
        <button onClick={() => window.location.assign('/requests')} type="button"><ArrowLeft size={16} />Back</button>
        <div><span>ITSM · Service Requests</span><h1>New Service Request</h1></div>
      </header>

      <div className="production-sr-intake-scroll">
        {loading ? <div className="production-sr-intake-state">Loading people and Service Catalogue…</div> : null}
        {!loading ? (
          <form className="production-sr-intake-form" onSubmit={submit}>
            <section className="production-sr-intake-card">
              <header><span>1</span><div><strong>Requester</strong><small>Create this request on behalf of an active Person in the organisation.</small></div></header>
              <label className="production-sr-field"><span>Find requester</span><div className="production-sr-search"><Search size={15} /><input value={requesterQuery} onChange={(event) => setRequesterQuery(event.target.value)} placeholder="Search name or email" /></div></label>
              <label className="production-sr-field"><span>Requester</span><select required value={requesterId} onChange={(event) => setRequesterId(event.target.value)}><option value="">Select requester</option>{filteredPeople.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}</select></label>
            </section>

            <section className="production-sr-intake-card">
              <header><span>2</span><div><strong>Catalogue service</strong><small>The live catalogue controls the request form, pricing, approvals and fulfilment.</small></div></header>
              <label className="production-sr-field"><span>Service Catalogue item</span><select required value={catalogueId} onChange={(event) => chooseForm(event.target.value)}><option value="">Select catalogue service</option>{forms.map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}</select></label>
              {selectedForm ? <div className="production-sr-catalogue-summary"><ShoppingCart size={18} /><div><strong>{selectedForm.title}</strong><small>{selectedForm.description}</small></div><span>{price.oneOff ? `£${price.oneOff.toLocaleString('en-GB')}` : '£0'}{price.monthly ? ` + £${price.monthly.toLocaleString('en-GB')}/mo` : ''}</span></div> : null}
            </section>

            {selectedForm ? (
              <section className="production-sr-intake-card">
                <header><span>3</span><div><strong>Request information</strong><small>Complete the published catalogue fields. Server-side validation and pricing are authoritative.</small></div></header>
                <div className="production-sr-form-grid">
                  <label className="production-sr-field is-full"><span>Summary</span><input required minLength="3" value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
                  <label className="production-sr-field"><span>Urgency</span><select value={urgency} onChange={(event) => setUrgency(event.target.value)}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
                  {schema.filter((field) => visibleField(field, fields)).map((field) => (
                    <label className={`production-sr-field ${['textarea','checkbox-products'].includes(field.type) ? 'is-full' : ''}`} key={field.id} htmlFor={`production-sr-${field.id}`}><span>{field.label}{field.required ? ' *' : ''}</span><FieldControl field={field} value={fields[field.id]} onChange={(value) => setFields((current) => ({ ...current, [field.id]: value }))} />{field.help ? <small>{field.help}</small> : null}</label>
                  ))}
                  <label className="production-sr-field is-full"><span>Additional fulfilment details</span><textarea rows="5" value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Business need, delivery information or anything the fulfiller should know" /></label>
                </div>
              </section>
            ) : null}

            {error ? <div className="production-sr-intake-error">{error}</div> : null}
            <div className="production-sr-intake-submit"><div><CheckCircle2 size={18} /><span><strong>PostgreSQL-backed request</strong><small>Pricing and approvals are recalculated by the API when submitted.</small></span></div><button disabled={submitting || !selectedForm} type="submit">{submitting ? 'Creating…' : 'Create Service Request'}<ChevronRight size={16} /></button></div>
          </form>
        ) : null}
      </div>
    </section>,
    target,
  )
}

export function ProductionServiceRequestIntake() {
  const [active, setActive] = useState(() => window.location.pathname === '/requests/new')
  const [target, setTarget] = useState(null)

  useEffect(() => {
    const check = () => setActive(window.location.pathname === '/requests/new')
    window.addEventListener('popstate', check)
    window.addEventListener('hi5-routechange', check)
    const timer = window.setInterval(check, 250)
    return () => { window.removeEventListener('popstate', check); window.removeEventListener('hi5-routechange', check); window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    if (!active) {
      setTarget(null)
      document.querySelector('.content-frame')?.classList.remove('production-sr-intake-mounted')
      return undefined
    }
    let mounted = null
    const attach = () => {
      const node = document.querySelector('.content-frame')
      if (!(node instanceof HTMLElement)) return false
      mounted = node
      node.classList.add('production-sr-intake-mounted')
      setTarget(node)
      return true
    }
    if (attach()) return () => mounted?.classList.remove('production-sr-intake-mounted')
    const observer = new MutationObserver(() => { if (attach()) observer.disconnect() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); mounted?.classList.remove('production-sr-intake-mounted') }
  }, [active])

  if (!active || !target) return null
  return <ProductionServiceRequestForm target={target} />
}

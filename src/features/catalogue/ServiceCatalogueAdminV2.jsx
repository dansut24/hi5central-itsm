import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  CreditCard,
  FileText,
  PackageOpen,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShoppingBag,
  Sparkles,
  Tag,
  UsersRound,
  X,
} from 'lucide-react'
import { DEFAULT_CATALOGUE_TEMPLATE_VERSION, defaultCatalogueState } from '../../data/defaultCatalogueV2.js'
import { ServiceCatalogueFormBuilder } from './ServiceCatalogueFormBuilder.jsx'
import { ServiceRequestFulfilmentBuilder } from './ServiceRequestFulfilmentBuilder.jsx'
import './ServiceCatalogueAdmin.css'
import './ServiceCatalogueAdminV2.css'

const API_BASE = window.__HI5_API_BASE__
const STORAGE_KEY = 'hi5central-service-catalogue-admin-v1'
const PRODUCTION_SESSION_KEY = 'hi5central-production-session-v1'
const ALL_ITEMS = 'All items'

function money(value) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 }).format(Number(value || 0))
}

function productionCatalogueEnabled() {
  try {
    const session = JSON.parse(window.localStorage.getItem(PRODUCTION_SESSION_KEY) || 'null')
    return Boolean(session?.source === 'production' && session?.tenantSlug)
  } catch {
    return false
  }
}

function normaliseItem(item = {}) {
  return {
    id: item.id || '',
    title: item.title || '',
    category: item.category || 'General',
    description: item.description || '',
    kind: item.kind === 'product' ? 'product' : 'request-form',
    requestType: item.requestType || 'Service Request',
    service: item.service || 'Service Catalogue',
    team: item.team || 'Service Desk',
    approval: item.approval || 'none',
    approvalThreshold: item.approvalThreshold ?? null,
    visibility: item.visibility || 'portal',
    vendor: item.vendor || '',
    sku: item.sku || '',
    priceMode: item.priceMode || 'none',
    oneOffPrice: Number(item.oneOffPrice || 0),
    monthlyPrice: Number(item.monthlyPrice || 0),
    currency: item.currency || 'GBP',
    workflow: item.workflow || 'Standard fulfilment',
    workflowTasks: Array.isArray(item.workflowTasks) ? item.workflowTasks : [],
    formSchema: Array.isArray(item.formSchema) ? item.formSchema : [],
    options: Array.isArray(item.options) ? item.options : [],
    optionsCount: Number(item.optionsCount || item.formSchema?.length || 0),
    source: item.source && typeof item.source === 'object' ? item.source : (item.source ? { provider: String(item.source) } : { provider: 'hi5central' }),
    active: item.active !== false,
  }
}

function normaliseCatalogue(value) {
  const items = Array.isArray(value?.items) ? value.items.map(normaliseItem) : []
  const categories = [...new Set([...(Array.isArray(value?.categories) ? value.categories : []), ...items.map((item) => item.category).filter(Boolean)])].sort((a, b) => a.localeCompare(b))
  return { items, categories }
}

function loadCatalogue() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
    if (stored && Array.isArray(stored.items)) return normaliseCatalogue(stored)
  } catch {
    // Ignore an invalid local cache; PostgreSQL remains authoritative in production.
  }
  return normaliseCatalogue(defaultCatalogueState())
}

function saveCatalogue(value) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  window.dispatchEvent(new CustomEvent('hi5-service-catalogue-changed', { detail: value }))
}

async function fetchRemoteCatalogue() {
  const response = await fetch(`${API_BASE}/api/v1/catalogue`, { credentials: 'include', cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Could not load the Service Catalogue.')
  return payload
}

async function syncRemoteCatalogue(value) {
  const response = await fetch(`${API_BASE}/api/v1/catalogue`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories: value.categories, items: value.items }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Could not save the Service Catalogue.')
  return payload
}

async function saveRemoteFulfilment(itemId, tasks) {
  const response = await fetch(`${API_BASE}/api/v1/catalogue/${encodeURIComponent(itemId)}/fulfilment`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Could not save the fulfilment flow.')
  return payload
}

async function fetchFulfilmentOptions() {
  const response = await fetch(`${API_BASE}/api/v1/catalogue/fulfilment-options`, { credentials: 'include', cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) return { teams: [] }
  return payload
}

function itemPrice(item) {
  if (item.priceMode === 'calculated') return 'Calculated from selections'
  const oneOff = Number(item.oneOffPrice || 0)
  const monthly = Number(item.monthlyPrice || 0)
  if (oneOff && monthly) return `${money(oneOff)} + ${money(monthly)}/mo`
  if (monthly) return `${money(monthly)}/mo`
  if (oneOff) return money(oneOff)
  return 'No charge'
}

function approvalLabel(item) {
  if (item.approval === 'manager-cost' && item.approvalThreshold !== null && item.approvalThreshold !== undefined) return `Manager / ${money(item.approvalThreshold)}+`
  if (item.approval === 'manager') return 'Manager'
  if (item.approval === 'custom') return 'Custom workflow'
  return 'No approval'
}

function kindLabel(kind) {
  return kind === 'product' ? 'Product' : 'Request form'
}

function templateStatus(template, current) {
  if (!current) return { key: 'new', label: 'New' }
  const version = Number(current.source?.templateVersion || 0)
  if (current.source?.provider === 'hi5central' && version >= DEFAULT_CATALOGUE_TEMPLATE_VERSION) return { key: 'current', label: 'Current' }
  return { key: 'updated', label: 'Update available' }
}

function resolveTemplateTasks(item, teams) {
  const names = new Set((teams || []).map((team) => team.name).filter(Boolean))
  const fallback = names.has(item.team) ? item.team : (teams?.[0]?.name || item.team || '')
  return (item.workflowTasks || []).map((task) => ({
    ...task,
    team: names.has(task.team) ? task.team : fallback,
    teamId: '',
  }))
}

function TemplateReview({ catalogue, teams, onClose, onImport }) {
  const templates = defaultCatalogueState().items
  const rows = templates.map((template) => ({ template, current: catalogue.items.find((item) => item.id === template.id) }))
  const [selected, setSelected] = useState(() => new Set(rows.filter((row) => templateStatus(row.template, row.current).key !== 'current').map((row) => row.template.id)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function importSelected() {
    if (!selected.size) return
    setBusy(true); setError('')
    try {
      await onImport(templates.filter((item) => selected.has(item.id)).map((item) => ({ ...item, workflowTasks: resolveTemplateTasks(item, teams) })))
      onClose()
    } catch (importError) {
      setError(importError.message || 'Could not import the selected templates.')
    } finally { setBusy(false) }
  }

  return (
    <div className="catalogue-editor-backdrop catalogue-template-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="catalogue-template-review">
        <header><div><span>Hi5Central defaults</span><strong>Default Catalogue v2</strong><p>Choose the templates you want to add or refresh. Nothing is replaced unless you select it here.</p></div><button aria-label="Close" onClick={onClose} type="button"><X size={19} /></button></header>
        <div className="catalogue-template-list">
          {rows.map(({ template, current }) => {
            const status = templateStatus(template, current)
            return <label className={`catalogue-template-row is-${status.key}`} key={template.id}><input checked={selected.has(template.id)} disabled={status.key === 'current'} onChange={() => toggle(template.id)} type="checkbox" /><span><strong>{template.title}</strong><small>{template.category} · {template.formSchema.filter((field) => field.type !== 'section').length} fields · {template.workflowTasks.length} fulfilment tasks</small></span><em>{status.label}</em></label>
          })}
        </div>
        {error ? <div className="catalogue-template-error">{error}</div> : null}
        <footer><button className="secondary-action" onClick={onClose} type="button">Cancel</button><button className="primary-action" disabled={busy || !selected.size} onClick={importSelected} type="button">{busy ? <RefreshCw className="is-spinning" size={16} /> : <Sparkles size={16} />} Import {selected.size || ''} selected</button></footer>
      </section>
    </div>
  )
}

function ItemEditor({ categories, item, teams, onClose, onSave, production }) {
  const creating = !item
  const [draft, setDraft] = useState(() => normaliseItem(item || {
    id: '', title: '', category: categories[0] || 'General', description: '', kind: 'request-form', requestType: 'Service Request', service: 'Service Catalogue', team: teams?.[0]?.name || 'Service Desk', approval: 'none', visibility: 'portal', priceMode: 'none', workflow: 'Standard fulfilment', formSchema: [], workflowTasks: [], active: true,
  }))
  const [workflowTasks, setWorkflowTasks] = useState(() => Array.isArray(item?.workflowTasks) ? item.workflowTasks : [])

  function update(field, value) { setDraft((current) => ({ ...current, [field]: value })) }

  function submit(event) {
    event.preventDefault()
    const generatedId = `CAT-${String(draft.title || 'ITEM').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)}-${Date.now().toString().slice(-4)}`
    const itemId = draft.id || generatedId
    const fulfilmentTasks = draft.kind === 'request-form' && draft.requestType === 'Service Request' ? workflowTasks : []
    onSave({
      ...draft,
      id: itemId,
      workflowTasks: fulfilmentTasks,
      optionsCount: (draft.formSchema || []).filter((field) => field.type !== 'section').length,
      oneOffPrice: Number(draft.oneOffPrice || 0),
      monthlyPrice: Number(draft.monthlyPrice || 0),
      approvalThreshold: draft.approval === 'manager-cost' ? Number(draft.approvalThreshold || 0) : null,
      source: draft.source?.provider === 'hi5central' ? { ...draft.source, customised: true } : draft.source,
    }, fulfilmentTasks)
  }

  return (
    <div className="catalogue-editor-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="catalogue-editor catalogue-editor-v2" aria-label={creating ? 'New catalogue item' : `Edit ${item.title}`}>
        <header><div><span>Service catalogue</span><strong>{creating ? 'New item' : item.title}</strong></div><button aria-label="Close" onClick={onClose} type="button"><X size={19} /></button></header>
        <form onSubmit={submit}>
          <section>
            <div className="catalogue-editor-heading"><span>Identity</span><strong>Catalogue item</strong></div>
            <div className="catalogue-form-grid two"><label>Item type<select value={draft.kind} onChange={(event) => update('kind', event.target.value)}><option value="request-form">Request form</option><option value="product">Product</option></select></label><label>Category<select value={draft.category} onChange={(event) => update('category', event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div>
            <label>Name<input autoFocus required value={draft.title} onChange={(event) => update('title', event.target.value)} /></label>
            <label>Description<textarea rows="3" value={draft.description} onChange={(event) => update('description', event.target.value)} /></label>
          </section>

          {draft.kind === 'request-form' ? <section><div className="catalogue-editor-heading"><span>Experience</span><strong>Request form</strong></div><ServiceCatalogueFormBuilder value={draft.formSchema} onChange={(formSchema) => update('formSchema', formSchema)} /></section> : null}

          <section>
            <div className="catalogue-editor-heading"><span>Commercial</span><strong>Cost & product data</strong></div>
            <div className="catalogue-form-grid two"><label>Pricing<select value={draft.priceMode} onChange={(event) => update('priceMode', event.target.value)}><option value="none">No charge</option><option value="fixed">Fixed price</option><option value="calculated">Calculated from selections</option></select></label><label>Vendor<input value={draft.vendor} onChange={(event) => update('vendor', event.target.value)} placeholder="Optional" /></label></div>
            <div className="catalogue-form-grid two"><label>One-off price (£)<input disabled={draft.priceMode !== 'fixed'} min="0" step="0.01" type="number" value={draft.oneOffPrice} onChange={(event) => update('oneOffPrice', event.target.value)} /></label><label>Monthly price (£)<input disabled={draft.priceMode !== 'fixed'} min="0" step="0.01" type="number" value={draft.monthlyPrice} onChange={(event) => update('monthlyPrice', event.target.value)} /></label></div>
            <label>Vendor SKU<input value={draft.sku} onChange={(event) => update('sku', event.target.value)} /></label>
          </section>

          <section>
            <div className="catalogue-editor-heading"><span>Fulfilment</span><strong>Routing & approval</strong></div>
            <div className="catalogue-form-grid two"><label>Request type<select value={draft.requestType} onChange={(event) => update('requestType', event.target.value)}><option>Service Request</option><option>Incident</option></select></label><label>Service<input value={draft.service} onChange={(event) => update('service', event.target.value)} /></label></div>
            <div className="catalogue-form-grid two"><label>Default fulfilment team{teams.length ? <select value={draft.team} onChange={(event) => update('team', event.target.value)}><option value="">Unassigned</option>{teams.map((team) => <option key={team.id || team.name} value={team.name}>{team.name}</option>)}</select> : <input value={draft.team} onChange={(event) => update('team', event.target.value)} />}</label><label>Approval<select value={draft.approval} onChange={(event) => update('approval', event.target.value)}><option value="none">No approval</option><option value="manager">Manager</option><option value="manager-cost">Manager / cost policy</option><option value="custom">Custom workflow</option></select></label></div>
            {draft.approval === 'manager-cost' ? <label>Approval threshold (£)<input min="0" step="0.01" type="number" value={draft.approvalThreshold ?? 500} onChange={(event) => update('approvalThreshold', event.target.value)} /><small>Requests at or above this value require the configured manager/cost approval.</small></label> : null}
            <label>Flow name<input value={draft.workflow} onChange={(event) => update('workflow', event.target.value)} /></label>
            {draft.kind === 'request-form' && draft.requestType === 'Service Request' ? <ServiceRequestFulfilmentBuilder itemKey={item?.id || ''} production={production} value={workflowTasks} onChange={setWorkflowTasks} formSchema={draft.formSchema} /> : null}
          </section>

          <section><div className="catalogue-editor-heading"><span>Publishing</span><strong>Visibility</strong></div><label>Visible to<select value={draft.visibility} onChange={(event) => update('visibility', event.target.value)}><option value="portal">Portal + technicians</option><option value="technicians">Technicians only</option><option value="hidden">Hidden / draft</option></select></label><label className="catalogue-toggle"><input checked={draft.active} onChange={(event) => update('active', event.target.checked)} type="checkbox" /><span><strong>Active item</strong><small>Inactive items remain available for historic request snapshots.</small></span></label></section>
          <footer><button className="secondary-action" onClick={onClose} type="button">Cancel</button><button className="primary-action" type="submit"><Check size={17} /> Save item</button></footer>
        </form>
      </aside>
    </div>
  )
}

export function ServiceCatalogueAdminV2() {
  const [catalogue, setCatalogue] = useState(loadCatalogue)
  const [teams, setTeams] = useState([])
  const [activeCategory, setActiveCategory] = useState(ALL_ITEMS)
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('Active')
  const [editorItem, setEditorItem] = useState(undefined)
  const [templateReview, setTemplateReview] = useState(false)
  const [categoryDraftOpen, setCategoryDraftOpen] = useState(false)
  const [categoryDraft, setCategoryDraft] = useState('')
  const [syncState, setSyncState] = useState(productionCatalogueEnabled() ? 'loading' : 'local')
  const [syncMessage, setSyncMessage] = useState('')

  useEffect(() => {
    if (!productionCatalogueEnabled()) return undefined
    let active = true
    async function hydrate() {
      setSyncState('loading'); setSyncMessage('')
      try {
        const [remote, options] = await Promise.all([fetchRemoteCatalogue(), fetchFulfilmentOptions()])
        if (!active) return
        setTeams(options.teams || [])
        let next
        if (remote.initialized) {
          next = normaliseCatalogue(remote)
        } else {
          next = normaliseCatalogue(defaultCatalogueState())
          await syncRemoteCatalogue(next)
          const routed = next.items.map((item) => ({ ...item, workflowTasks: resolveTemplateTasks(item, options.teams || []) }))
          for (const item of routed.filter((candidate) => candidate.requestType === 'Service Request')) await saveRemoteFulfilment(item.id, item.workflowTasks)
          next = { ...next, items: routed }
        }
        if (!active) return
        setCatalogue(next); saveCatalogue(next); setSyncState('saved')
      } catch (error) {
        console.error('Service Catalogue v2 hydration failed', error)
        if (active) { setSyncState('error'); setSyncMessage(error.message || 'Catalogue sync needs attention') }
      }
    }
    hydrate()
    return () => { active = false }
  }, [])

  const categoryRows = useMemo(() => [{ id: ALL_ITEMS, label: ALL_ITEMS, count: catalogue.items.length }, ...catalogue.categories.map((category) => ({ id: category, label: category, count: catalogue.items.filter((item) => item.category === category).length }))], [catalogue])
  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return catalogue.items.filter((item) => {
      const searchable = [item.id, item.title, item.category, item.description, item.vendor, item.sku, item.service, item.team].join(' ').toLowerCase()
      return (activeCategory === ALL_ITEMS || item.category === activeCategory) && (!needle || searchable.includes(needle)) && (kindFilter === 'All' || item.kind === kindFilter) && (statusFilter === 'All' || (statusFilter === 'Active' ? item.active : !item.active))
    })
  }, [activeCategory, catalogue.items, kindFilter, query, statusFilter])

  function persist(next) {
    setCatalogue(next); saveCatalogue(next)
    if (!productionCatalogueEnabled()) return Promise.resolve()
    setSyncState('saving'); setSyncMessage('')
    return syncRemoteCatalogue(next).then(() => setSyncState('saved')).catch((error) => { setSyncState('error'); setSyncMessage(error.message); throw error })
  }

  async function saveItem(item, workflowTasks = []) {
    const storedItem = normaliseItem({ ...item, workflowTasks })
    const items = catalogue.items.some((candidate) => candidate.id === storedItem.id) ? catalogue.items.map((candidate) => candidate.id === storedItem.id ? storedItem : candidate) : [...catalogue.items, storedItem]
    const next = normaliseCatalogue({ items, categories: [...catalogue.categories, storedItem.category] })
    setCatalogue(next); saveCatalogue(next)
    if (productionCatalogueEnabled()) {
      setSyncState('saving'); setSyncMessage('')
      try { await syncRemoteCatalogue(next); await saveRemoteFulfilment(storedItem.id, workflowTasks); setSyncState('saved') } catch (error) { setSyncState('error'); setSyncMessage(error.message); return }
    }
    setEditorItem(undefined)
  }

  async function importTemplates(selected) {
    const replacements = new Map(selected.map((item) => [item.id, normaliseItem(item)]))
    const items = catalogue.items.map((item) => replacements.get(item.id) || item)
    selected.forEach((item) => { if (!items.some((candidate) => candidate.id === item.id)) items.push(normaliseItem(item)) })
    const next = normaliseCatalogue({ items, categories: [...catalogue.categories, ...selected.map((item) => item.category)] })
    setCatalogue(next); saveCatalogue(next)
    if (productionCatalogueEnabled()) {
      setSyncState('saving'); setSyncMessage('')
      await syncRemoteCatalogue(next)
      for (const item of selected.filter((candidate) => candidate.requestType === 'Service Request')) await saveRemoteFulfilment(item.id, item.workflowTasks || [])
      setSyncState('saved')
    }
  }

  function createCategory(event) {
    event.preventDefault(); const category = categoryDraft.trim(); if (!category) return
    const next = normaliseCatalogue({ ...catalogue, categories: [...catalogue.categories, category] })
    persist(next); setActiveCategory(category); setCategoryDraft(''); setCategoryDraftOpen(false)
  }

  const activeItems = catalogue.items.filter((item) => item.active).length
  const portalItems = catalogue.items.filter((item) => item.active && item.visibility === 'portal').length
  const productItems = catalogue.items.filter((item) => item.kind === 'product').length
  const defaults = defaultCatalogueState().items
  const updates = defaults.filter((template) => templateStatus(template, catalogue.items.find((item) => item.id === template.id)).key !== 'current').length

  return (
    <div className="service-catalogue-admin service-catalogue-admin-v2">
      <aside className="catalogue-category-rail"><header><div><span>ITSM</span><strong>Catalogue categories</strong></div><PackageOpen size={18} /></header><nav>{categoryRows.map((category) => <button className={activeCategory === category.id ? 'is-active' : ''} key={category.id} onClick={() => setActiveCategory(category.id)} type="button"><Tag size={15} /><span>{category.label}</span><small>{category.count}</small></button>)}</nav><footer>{categoryDraftOpen ? <form onSubmit={createCategory}><input autoFocus placeholder="Category name" value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} /><div><button onClick={() => { setCategoryDraftOpen(false); setCategoryDraft('') }} type="button">Cancel</button><button type="submit">Add</button></div></form> : <button onClick={() => setCategoryDraftOpen(true)} type="button"><Plus size={15} /> New category</button>}</footer></aside>
      <section className="catalogue-content-surface">
        <header className="catalogue-page-heading"><div><span className="eyebrow">ITSM administration</span><h2>Service catalogue</h2><p>Build simple request forms, approvals and fulfilment flows using live tenant data.</p>{syncState !== 'local' ? <small className={`catalogue-sync-state is-${syncState}`}>{syncState === 'loading' ? 'Loading PostgreSQL catalogue…' : syncState === 'saving' ? 'Saving to PostgreSQL…' : syncState === 'error' ? (syncMessage || 'Catalogue sync needs attention') : 'PostgreSQL catalogue synced'}</small> : null}</div><div className="catalogue-heading-actions"><button className="secondary-action" onClick={() => setTemplateReview(true)} type="button"><Sparkles size={17} /> Hi5Central defaults {updates ? <em>{updates}</em> : null}</button><button className="primary-action" onClick={() => setEditorItem(null)} type="button"><Plus size={18} /> New item</button></div></header>
        <div className="catalogue-stat-grid"><article><PackageOpen size={19} /><div><strong>{activeItems}</strong><span>Active items</span></div></article><article><ShoppingBag size={19} /><div><strong>{productItems}</strong><span>Products</span></div></article><article><FileText size={19} /><div><strong>{catalogue.items.length - productItems}</strong><span>Request forms</span></div></article><article><UsersRound size={19} /><div><strong>{portalItems}</strong><span>Portal visible</span></div></article></div>
        <div className="catalogue-toolbar"><label className="catalogue-search"><Search size={18} /><input placeholder="Search catalogue, vendor, SKU or service" type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label><span>Type</span><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}><option>All</option><option value="product">Products</option><option value="request-form">Request forms</option></select></label><label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option><option>Active</option><option>Inactive</option></select></label></div>
        <div className="catalogue-item-grid">{visibleItems.map((item) => <article className={`catalogue-item-card ${!item.active ? 'is-inactive' : ''}`} key={item.id}><header><span className="catalogue-item-icon">{item.kind === 'product' ? <ShoppingBag size={20} /> : <FileText size={20} />}</span><div className="catalogue-item-actions"><span>{kindLabel(item.kind)}</span><button aria-label={`Edit ${item.title}`} onClick={() => setEditorItem(item)} type="button"><Settings2 size={17} /></button></div></header><div className="catalogue-item-title"><span>{item.category}</span><h3>{item.title}</h3><p>{item.description}</p></div><div className="catalogue-price"><CreditCard size={17} /><span><small>Price</small><strong>{itemPrice(item)}</strong></span></div><dl><div><dt>Service</dt><dd>{item.service || 'Not set'}</dd></div><div><dt>Team</dt><dd>{item.team || 'Not set'}</dd></div><div><dt>Approval</dt><dd>{approvalLabel(item)}</dd></div><div><dt>Form</dt><dd>{item.kind === 'request-form' ? `${item.formSchema.filter((field) => field.type !== 'section').length} fields` : '—'}</dd></div><div><dt>Flow</dt><dd>{item.kind === 'request-form' ? `${item.workflowTasks?.length || 'Configured'} tasks` : '—'}</dd></div></dl><footer><span className={!item.active ? 'is-inactive' : 'is-active'}>{!item.active ? 'Inactive' : 'Active'}</span><small>{item.source?.templateVersion ? `Hi5Central default v${item.source.templateVersion}` : item.workflow || 'Custom item'}</small></footer></article>)}</div>
        {!visibleItems.length ? <div className="catalogue-empty"><PackageOpen size={30} /><strong>No catalogue items found</strong><span>Try a different category, search or filter.</span></div> : null}
      </section>
      {editorItem !== undefined ? <ItemEditor categories={catalogue.categories} item={editorItem} teams={teams} onClose={() => setEditorItem(undefined)} onSave={saveItem} production={productionCatalogueEnabled()} /> : null}
      {templateReview ? <TemplateReview catalogue={catalogue} teams={teams} onClose={() => setTemplateReview(false)} onImport={importTemplates} /> : null}
    </div>
  )
}

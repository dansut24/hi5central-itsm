import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Archive, BookOpen, Check, ChevronRight, FileClock, Link2, Plus, Search, Send, X } from 'lucide-react'
import './ProductionKnowledgeLiveChat.css'

const API_BASE = window.__HI5_API_BASE__

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Knowledge request failed.')
  return payload
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function emptyDraft() {
  return { title: '', summary: '', bodyText: '', category: 'General', tagsText: '', visibility: 'internal', status: 'Draft', reviewAt: '' }
}

function articleDraft(article) {
  return article ? {
    title: article.title || '', summary: article.summary || '', bodyText: article.bodyText || '', category: article.category || 'General',
    tagsText: (article.tags || []).join(', '), visibility: article.visibility || 'internal', status: article.status || 'Draft',
    reviewAt: article.reviewAt ? String(article.reviewAt).slice(0, 10) : '',
  } : emptyDraft()
}

export function ProductionKnowledgeBase() {
  const [target, setTarget] = useState(null)
  const [active, setActive] = useState(() => window.location.pathname === '/knowledge' || window.location.pathname.startsWith('/knowledge/'))
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [versions, setVersions] = useState([])
  const [showVersions, setShowVersions] = useState(false)
  const [linkRecord, setLinkRecord] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const sync = () => setActive(window.location.pathname === '/knowledge' || window.location.pathname.startsWith('/knowledge/'))
    window.addEventListener('popstate', sync)
    window.addEventListener('hi5-routechange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hi5-routechange', sync) }
  }, [])

  useEffect(() => {
    if (!active) { setTarget(null); return undefined }
    let mounted = null
    const attach = () => {
      const next = document.querySelector('.content-frame')
      if (!(next instanceof HTMLElement)) return false
      mounted = next; mounted.classList.add('production-knowledge-mounted'); setTarget(next); return true
    }
    if (attach()) return () => mounted?.classList.remove('production-knowledge-mounted')
    const observer = new MutationObserver(() => { if (attach()) observer.disconnect() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); mounted?.classList.remove('production-knowledge-mounted') }
  }, [active])

  async function load(preferred = selected?.reference) {
    if (!active) return
    try {
      setError('')
      const payload = await api('/api/v1/knowledge')
      setItems(payload.items || [])
      const key = preferred || String(window.location.pathname.split('/')[2] || '')
      const next = (payload.items || []).find((item) => item.reference === key || item.slug === key) || (payload.items || [])[0] || null
      setSelected(next)
    } catch (err) { setError(err.message) }
  }

  useEffect(() => { if (active) load() }, [active])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((item) => {
      if (status !== 'All' && item.status !== status) return false
      if (!needle) return true
      return `${item.reference} ${item.title} ${item.summary} ${item.category} ${(item.tags || []).join(' ')}`.toLowerCase().includes(needle)
    })
  }, [items, query, status])

  const categories = useMemo(() => [...new Set(items.map((item) => item.category).filter(Boolean))].sort(), [items])

  function choose(article) {
    setSelected(article); setEditing(false); setShowVersions(false); setError('')
    const path = `/knowledge/${encodeURIComponent(article.slug || article.reference)}`
    window.history.replaceState({}, '', path)
    window.dispatchEvent(new Event('hi5-routechange'))
  }

  function newArticle() {
    setSelected(null); setDraft(emptyDraft()); setEditing(true); setShowVersions(false); setError('')
  }

  function editArticle() {
    setDraft(articleDraft(selected)); setEditing(true); setShowVersions(false); setError('')
  }

  async function saveArticle(event) {
    event.preventDefault()
    if (draft.title.trim().length < 3) { setError('Add an article title.'); return }
    setBusy(true); setError('')
    try {
      const payload = {
        title: draft.title.trim(), summary: draft.summary.trim(), bodyText: draft.bodyText,
        category: draft.category.trim() || 'General', tags: draft.tagsText.split(',').map((item) => item.trim()).filter(Boolean),
        visibility: draft.visibility, status: draft.status, reviewAt: draft.reviewAt || null,
      }
      const saved = selected
        ? await api(`/api/v1/knowledge/${encodeURIComponent(selected.reference)}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await api('/api/v1/knowledge', { method: 'POST', body: JSON.stringify(payload) })
      setEditing(false); setSelected(saved); await load(saved.reference)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function changeStatus(nextStatus) {
    if (!selected) return
    setBusy(true); setError('')
    try {
      const saved = await api(`/api/v1/knowledge/${encodeURIComponent(selected.reference)}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus, changeNote: `${nextStatus} from Knowledge workspace` }) })
      setSelected(saved); await load(saved.reference)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function openVersions() {
    if (!selected) return
    try {
      const payload = await api(`/api/v1/knowledge/${encodeURIComponent(selected.reference)}/versions`)
      setVersions(payload.items || []); setShowVersions(true)
    } catch (err) { setError(err.message) }
  }

  async function addLink(event) {
    event.preventDefault()
    const reference = linkRecord.trim().toUpperCase()
    if (!selected || !reference) return
    const type = reference.startsWith('INC-') ? 'Incident' : reference.startsWith('REQ-') ? 'Service Request' : reference.startsWith('PRB-') ? 'Problem' : reference.startsWith('CHG-') ? 'Change' : 'ITSM Record'
    setBusy(true); setError('')
    try {
      await api(`/api/v1/knowledge/${encodeURIComponent(selected.reference)}/links`, { method: 'POST', body: JSON.stringify({ recordType: type, recordReference: reference }) })
      setLinkRecord(''); await load(selected.reference)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  if (!active || !target) return null

  return createPortal(
    <div className="production-knowledge-root">
      <aside className="pkb-sidebar">
        <header><div><small>Knowledge Base</small><h2>Articles</h2></div><button className="pkb-icon primary" onClick={newArticle} title="New article"><Plus size={17} /></button></header>
        <label className="pkb-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search knowledge…" /></label>
        <div className="pkb-status-filter">{['All','Published','Draft','Archived'].map((item) => <button className={status === item ? 'active' : ''} key={item} onClick={() => setStatus(item)}>{item}</button>)}</div>
        <div className="pkb-list">
          {filtered.map((article) => <button className={selected?.reference === article.reference && !editing ? 'active' : ''} key={article.reference} onClick={() => choose(article)}><span><small>{article.reference} · {article.category}</small><strong>{article.title}</strong><em>{article.status} · v{article.version}</em></span><ChevronRight size={16} /></button>)}
          {!filtered.length ? <div className="pkb-empty"><BookOpen size={26} /><strong>No articles found</strong><span>Create your first real Knowledge article.</span></div> : null}
        </div>
      </aside>

      <main className="pkb-main">
        {error ? <div className="pkb-error">{error}<button onClick={() => setError('')}><X size={15} /></button></div> : null}
        {editing ? (
          <form className="pkb-editor" onSubmit={saveArticle}>
            <header><div><small>{selected ? selected.reference : 'New article'}</small><h1>{selected ? 'Edit Knowledge article' : 'Create Knowledge article'}</h1></div><div><button type="button" className="pkb-secondary" onClick={() => { setEditing(false); setDraft(emptyDraft()) }}>Cancel</button><button className="pkb-primary" disabled={busy}><Check size={16} /> {busy ? 'Saving…' : 'Save article'}</button></div></header>
            <div className="pkb-editor-grid">
              <section className="pkb-card pkb-editor-main">
                <label><span>Title</span><input value={draft.title} onChange={(e) => setDraft((v) => ({ ...v, title: e.target.value }))} /></label>
                <label><span>Summary</span><textarea rows={3} value={draft.summary} onChange={(e) => setDraft((v) => ({ ...v, summary: e.target.value }))} /></label>
                <label><span>Article content</span><textarea className="pkb-body-editor" rows={18} value={draft.bodyText} onChange={(e) => setDraft((v) => ({ ...v, bodyText: e.target.value }))} placeholder="Write clear steps, troubleshooting guidance, workarounds and resolution information…" /></label>
              </section>
              <aside className="pkb-card pkb-editor-side">
                <label><span>Category</span><input list="pkb-categories" value={draft.category} onChange={(e) => setDraft((v) => ({ ...v, category: e.target.value }))} /><datalist id="pkb-categories">{categories.map((item) => <option key={item} value={item} />)}</datalist></label>
                <label><span>Tags</span><input value={draft.tagsText} onChange={(e) => setDraft((v) => ({ ...v, tagsText: e.target.value }))} placeholder="vpn, microsoft 365, access" /></label>
                <label><span>Visibility</span><select value={draft.visibility} onChange={(e) => setDraft((v) => ({ ...v, visibility: e.target.value }))}><option value="internal">Internal only</option><option value="portal">Portal only</option><option value="both">Internal + Portal</option></select></label>
                <label><span>Status</span><select value={draft.status} onChange={(e) => setDraft((v) => ({ ...v, status: e.target.value }))}><option>Draft</option><option>Published</option><option>Archived</option></select></label>
                <label><span>Review date</span><input type="date" value={draft.reviewAt} onChange={(e) => setDraft((v) => ({ ...v, reviewAt: e.target.value }))} /></label>
              </aside>
            </div>
          </form>
        ) : selected ? (
          <article className="pkb-article">
            <header><div><small>{selected.reference} · {selected.category}</small><h1>{selected.title}</h1><p>{selected.summary}</p><div className="pkb-tags">{(selected.tags || []).map((tag) => <span key={tag}>{tag}</span>)}</div></div><div className="pkb-actions"><button className="pkb-secondary" onClick={openVersions}><FileClock size={16} /> Versions</button><button className="pkb-secondary" onClick={editArticle}>Edit</button>{selected.status !== 'Published' ? <button className="pkb-primary" onClick={() => changeStatus('Published')} disabled={busy}>Publish</button> : <button className="pkb-secondary" onClick={() => changeStatus('Draft')} disabled={busy}>Unpublish</button>}{selected.status !== 'Archived' ? <button className="pkb-icon" onClick={() => changeStatus('Archived')} title="Archive"><Archive size={17} /></button> : null}</div></header>
            <div className="pkb-meta"><span>Status <strong>{selected.status}</strong></span><span>Visibility <strong>{selected.visibility}</strong></span><span>Version <strong>{selected.version}</strong></span><span>Published <strong>{formatDate(selected.publishedAt)}</strong></span><span>Review <strong>{formatDate(selected.reviewAt)}</strong></span></div>
            <section className="pkb-card pkb-article-body">{selected.bodyText ? selected.bodyText.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p className="pkb-muted">No article content yet.</p>}</section>
            <div className="pkb-detail-grid"><section className="pkb-card"><h3>Linked ITSM records</h3>{selected.links?.length ? <div className="pkb-links">{selected.links.map((link) => <span key={link.id}><Link2 size={14} /> {link.recordReference} <small>{link.recordType}</small></span>)}</div> : <p className="pkb-muted">No records linked yet.</p>}<form className="pkb-link-form" onSubmit={addLink}><input value={linkRecord} onChange={(e) => setLinkRecord(e.target.value)} placeholder="INC-00001, PRB-00001…" /><button disabled={busy || !linkRecord.trim()}><Link2 size={15} /> Link</button></form></section><section className="pkb-card"><h3>Portal feedback</h3><div className="pkb-feedback"><span><strong>{selected.helpfulCount}</strong> Helpful</span><span><strong>{selected.notHelpfulCount}</strong> Not helpful</span></div><p className="pkb-muted">Feedback comes only from authenticated portal users viewing a published article.</p></section></div>
          </article>
        ) : <div className="pkb-empty large"><BookOpen size={42} /><strong>Build trustworthy support knowledge</strong><span>Create a draft, publish it internally or to the Help Centre, then link it to ITSM records.</span><button className="pkb-primary" onClick={newArticle}><Plus size={16} /> New article</button></div>}

        {showVersions && selected ? <div className="pkb-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowVersions(false)}><aside className="pkb-versions"><header><div><small>{selected.reference}</small><h2>Version history</h2></div><button className="pkb-icon" onClick={() => setShowVersions(false)}><X size={18} /></button></header><div>{versions.map((version) => <article key={version.version}><span>v{version.version}</span><div><strong>{version.title}</strong><small>{version.status} · {version.visibility} · {formatDate(version.createdAt)}</small><p>{version.changeNote || 'Article updated'}</p></div></article>)}</div></aside></div> : null}
      </main>
    </div>,
    target,
  )
}

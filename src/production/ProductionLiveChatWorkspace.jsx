import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, CheckCheck, MessageCircle, RefreshCw, Search, Send, UserRoundCheck, X } from 'lucide-react'
import './ProductionKnowledgeLiveChat.css'

const API_BASE = window.__HI5_API_BASE__

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Live Chat request failed.')
  return payload
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date)
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function initials(name = '') {
  return String(name).split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]).join('').toUpperCase() || '??'
}

export function ProductionLiveChatWorkspace() {
  const [target, setTarget] = useState(null)
  const [active, setActive] = useState(() => window.location.pathname === '/live-chat')
  const [items, setItems] = useState([])
  const [selectedRef, setSelectedRef] = useState('')
  const [detail, setDetail] = useState(null)
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [mobileThread, setMobileThread] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const selectedRefRef = useRef('')

  useEffect(() => { selectedRefRef.current = selectedRef }, [selectedRef])

  useEffect(() => {
    const sync = () => setActive(window.location.pathname === '/live-chat')
    window.addEventListener('popstate', sync); window.addEventListener('hi5-routechange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hi5-routechange', sync) }
  }, [])

  useEffect(() => {
    if (!active) { setTarget(null); return undefined }
    let mounted = null
    const attach = () => {
      const next = document.querySelector('.content-frame')
      if (!(next instanceof HTMLElement)) return false
      mounted = next; mounted.classList.add('production-live-chat-mounted'); setTarget(next); return true
    }
    if (attach()) return () => mounted?.classList.remove('production-live-chat-mounted')
    const observer = new MutationObserver(() => { if (attach()) observer.disconnect() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); mounted?.classList.remove('production-live-chat-mounted') }
  }, [active])

  async function loadList({ quiet = false } = {}) {
    if (!active) return
    try {
      if (!quiet) setError('')
      const payload = await api('/api/v1/live-chat/conversations')
      const next = payload.items || []
      setItems(next)
      const current = selectedRefRef.current
      if (!current && next.length) setSelectedRef(next[0].reference)
      window.dispatchEvent(new CustomEvent('hi5-production-live-chat-count', { detail: { unread: next.reduce((sum, item) => sum + Number(item.unread || 0), 0) } }))
    } catch (err) { if (!quiet) setError(err.message) }
  }

  async function loadDetail(reference, { quiet = false } = {}) {
    if (!reference) { setDetail(null); return }
    try {
      const payload = await api(`/api/v1/live-chat/conversations/${encodeURIComponent(reference)}`)
      setDetail(payload)
      if (Number(payload.unread || 0) > 0) await api(`/api/v1/live-chat/conversations/${encodeURIComponent(reference)}/read`, { method: 'POST' })
    } catch (err) { if (!quiet) setError(err.message) }
  }

  useEffect(() => {
    if (!active) return undefined
    loadList()
    const timer = window.setInterval(() => { loadList({ quiet: true }); if (selectedRefRef.current) loadDetail(selectedRefRef.current, { quiet: true }) }, 4000)
    return () => window.clearInterval(timer)
  }, [active])

  useEffect(() => { if (active && selectedRef) loadDetail(selectedRef) }, [active, selectedRef])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((item) => {
      if (filter !== 'All' && item.status !== filter) return false
      if (!needle) return true
      return `${item.reference} ${item.subject} ${item.participant?.name} ${item.participant?.email} ${item.lastMessage}`.toLowerCase().includes(needle)
    })
  }, [filter, items, query])

  const counts = useMemo(() => ({ All: items.length, Waiting: items.filter((x) => x.status === 'Waiting').length, Open: items.filter((x) => x.status === 'Open').length, Closed: items.filter((x) => x.status === 'Closed').length }), [items])

  function select(item) {
    setSelectedRef(item.reference); setMobileThread(true); setError('')
  }

  async function claim() {
    if (!detail) return
    setBusy(true); setError('')
    try { const next = await api(`/api/v1/live-chat/conversations/${encodeURIComponent(detail.reference)}/claim`, { method: 'POST' }); setDetail(next); await loadList({ quiet: true }) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function toggleClosed() {
    if (!detail) return
    const status = detail.status === 'Closed' ? 'Open' : 'Closed'
    setBusy(true); setError('')
    try { const next = await api(`/api/v1/live-chat/conversations/${encodeURIComponent(detail.reference)}/state`, { method: 'POST', body: JSON.stringify({ status }) }); setDetail(next); await loadList({ quiet: true }) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function send(event) {
    event.preventDefault()
    const message = draft.trim()
    if (!detail || !message) return
    setBusy(true); setError('')
    try {
      const next = await api(`/api/v1/live-chat/conversations/${encodeURIComponent(detail.reference)}/messages`, { method: 'POST', body: JSON.stringify({ message }) })
      setDetail(next); setDraft(''); await loadList({ quiet: true })
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  if (!active || !target) return null

  return createPortal(
    <div className={`production-live-chat-root ${mobileThread ? 'mobile-thread-open' : ''}`}>
      <aside className="plc-inbox">
        <header><div><small>Support messenger</small><h2>Live Chat</h2></div><button className="plc-icon" onClick={() => loadList()} title="Refresh"><RefreshCw size={17} /></button></header>
        <label className="plc-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search real conversations…" /></label>
        <div className="plc-filters">{['All','Waiting','Open','Closed'].map((item) => <button className={filter === item ? 'active' : ''} key={item} onClick={() => setFilter(item)}><span>{item}</span><strong>{counts[item]}</strong></button>)}</div>
        <div className="plc-list">{filtered.map((item) => <button className={`${selectedRef === item.reference ? 'active' : ''} ${item.unread ? 'unread' : ''}`} key={item.reference} onClick={() => select(item)}><span className="plc-avatar">{initials(item.participant?.name)}</span><span className="plc-copy"><span><strong>{item.participant?.name}</strong><small>{formatTime(item.updatedAt)}</small></span><b>{item.subject}</b><em>{item.lastMessage || 'Conversation started'}</em><small>{item.reference} · {item.status}{item.assignedTo ? ` · ${item.assignedTo}` : ''}</small></span>{item.unread ? <i>{item.unread > 99 ? '99+' : item.unread}</i> : null}</button>)}{!filtered.length ? <div className="plc-empty"><MessageCircle size={28} /><strong>No conversations</strong><span>Real portal chats will appear here when entitled users start one.</span></div> : null}</div>
      </aside>
      <main className="plc-thread">
        {error ? <div className="plc-error">{error}<button onClick={() => setError('')}><X size={15} /></button></div> : null}
        {detail ? <><header className="plc-thread-header"><button className="plc-mobile-back" onClick={() => setMobileThread(false)}><ArrowLeft size={18} /></button><span className="plc-avatar">{initials(detail.participant?.name)}</span><div><small>{detail.reference}</small><strong>{detail.participant?.name}</strong><span>{detail.participant?.email} · {detail.subject}</span></div><div className="plc-thread-actions">{detail.status === 'Waiting' ? <button className="plc-primary" onClick={claim} disabled={busy}><UserRoundCheck size={15} /> Claim</button> : null}<button className="plc-secondary" onClick={toggleClosed} disabled={busy}>{detail.status === 'Closed' ? 'Reopen' : 'Close'}</button></div></header><div className="plc-thread-meta"><span>Status <strong>{detail.status}</strong></span><span>Assigned <strong>{detail.assignedTo || 'Unassigned'}</strong></span></div><div className="plc-messages">{(detail.messages || []).map((message) => message.sender === 'system' ? <div className="plc-system" key={message.id}><span>{message.text}</span><small>{formatTime(message.createdAt)}</small></div> : <div className={`plc-message-row ${message.sender}`} key={message.id}><div className="plc-bubble"><p>{message.text}</p><span>{message.senderName ? `${message.senderName} · ` : ''}{formatTime(message.createdAt)}{message.sender === 'agent' ? <CheckCheck size={13} /> : null}</span></div></div>)}</div>{detail.status === 'Closed' ? <div className="plc-closed">This conversation is closed. <button onClick={toggleClosed}>Reopen chat</button></div> : <form className="plc-composer" onSubmit={send}><textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Message ${detail.participant?.name || 'requester'}…`} /><button className="plc-primary" disabled={busy || !draft.trim()}><Send size={16} /> Send</button></form>}</> : <div className="plc-empty large"><MessageCircle size={42} /><strong>Real Live Chat</strong><span>Select a portal conversation. No simulated chats or automatic fake replies are used in production.</span></div>}
      </main>
    </div>,
    target,
  )
}

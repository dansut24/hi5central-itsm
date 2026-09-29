import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  MessageCircle,
  Plus,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import './ProductionKnowledgeLiveChat.css'
import './ProductionPortalFloatingChat.css'

const API_BASE = window.__HI5_API_BASE__

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
  if (!response.ok) {
    throw Object.assign(new Error(payload.error || 'Help Centre request failed.'), {
      status: response.status,
      code: payload.code || '',
      support: payload.support || null,
    })
  }
  return payload
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function initials(name = '') {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'IT'
}

function currentPortalPath() {
  return window.location.pathname || '/'
}

function publishPortalRoute(path, { replace = false } = {}) {
  const next = path || '/'
  window.history[replace ? 'replaceState' : 'pushState']({}, '', next)
  window.dispatchEvent(new CustomEvent('hi5-portal-routechange', { detail: { path: next } }))
}

function knowledgeKeyFromPath(path) {
  if (!String(path || '').startsWith('/knowledge/')) return ''
  const encoded = String(path).slice('/knowledge/'.length).split('/')[0]
  if (!encoded) return ''
  try { return decodeURIComponent(encoded) } catch { return encoded }
}

function PortalKnowledge({ initialItems, routePath, onNavigate }) {
  const [items, setItems] = useState(initialItems || [])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [feedbackSaved, setFeedbackSaved] = useState(false)
  const [error, setError] = useState('')
  const routeArticleKey = knowledgeKeyFromPath(routePath)
  const selectedKey = selected?.slug || selected?.reference || ''

  useEffect(() => {
    if (Array.isArray(initialItems)) setItems(initialItems)
  }, [initialItems])

  useEffect(() => {
    if (!routeArticleKey) {
      setSelected(null)
      setFeedbackSaved(false)
      return undefined
    }
    if (selectedKey === routeArticleKey || selected?.reference === routeArticleKey) return undefined

    let active = true
    ;(async () => {
      try {
        const detail = await api(`/api/v1/portal/knowledge/${encodeURIComponent(routeArticleKey)}`)
        if (!active) return
        setSelected(detail)
        setFeedbackSaved(false)
        setError('')
      } catch (err) {
        if (active) setError(err.message)
      }
    })()
    return () => { active = false }
  }, [routeArticleKey, selectedKey, selected?.reference])

  async function search(value) {
    setQuery(value)
    try {
      const payload = await api(`/api/v1/portal/knowledge${value.trim() ? `?q=${encodeURIComponent(value.trim())}` : ''}`)
      setItems(payload.items || [])
      setError('')
    } catch (err) { setError(err.message) }
  }

  async function open(article) {
    try {
      const detail = await api(`/api/v1/portal/knowledge/${encodeURIComponent(article.slug || article.reference)}`)
      setSelected(detail)
      setFeedbackSaved(false)
      setError('')
      onNavigate(`/knowledge/${encodeURIComponent(detail.slug || detail.reference)}`)
    } catch (err) { setError(err.message) }
  }

  async function feedback(helpful) {
    if (!selected) return
    try {
      await api(`/api/v1/portal/knowledge/${encodeURIComponent(selected.slug || selected.reference)}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ helpful }),
      })
      setFeedbackSaved(true)
    } catch (err) { setError(err.message) }
  }

  if (selected) {
    return (
      <section className="ppx-page">
        <button className="ppx-back" onClick={() => onNavigate('/knowledge')} type="button">
          <ArrowLeft size={16} /> Knowledge
        </button>
        {error ? <div className="ppx-error">{error}</div> : null}
        <article className="ppx-article">
          <header>
            <span>{selected.reference} · {selected.category}</span>
            <h1>{selected.title}</h1>
            <p>{selected.summary}</p>
            <div>{(selected.tags || []).map((tag) => <small key={tag}>{tag}</small>)}</div>
          </header>
          <div className="ppx-article-body">
            {String(selected.bodyText || '').split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>
          <footer>
            <strong>Was this article helpful?</strong>
            {feedbackSaved ? (
              <span className="ppx-feedback-saved"><CheckCircle2 size={16} /> Thanks for your feedback</span>
            ) : (
              <div>
                <button onClick={() => feedback(true)} type="button"><ThumbsUp size={16} /> Yes</button>
                <button onClick={() => feedback(false)} type="button"><ThumbsDown size={16} /> No</button>
              </div>
            )}
          </footer>
        </article>
      </section>
    )
  }

  return (
    <section className="ppx-page">
      <div className="ppx-heading">
        <span>Knowledge Base</span>
        <h1>Find an answer before you wait for IT</h1>
        <p>Search published guidance from your organisation. You can still raise an incident at any time.</p>
      </div>
      {error ? <div className="ppx-error">{error}</div> : null}
      <label className="ppx-search">
        <Search size={18} />
        <input value={query} onChange={(event) => search(event.target.value)} placeholder="Search help articles…" />
      </label>
      {items.length ? (
        <div className="ppx-knowledge-grid">
          {items.map((article) => (
            <button key={article.reference} onClick={() => open(article)} type="button">
              <span><BookOpen size={19} /></span>
              <small>{article.category} · {article.reference}</small>
              <strong>{article.title}</strong>
              <p>{article.summary}</p>
              <em>Read article <ChevronRight size={14} /></em>
            </button>
          ))}
        </div>
      ) : (
        <div className="ppx-empty">
          <BookOpen size={30} />
          <strong>No published articles found</strong>
          <span>Your Service Desk can publish internal knowledge to the portal.</span>
        </div>
      )}
    </section>
  )
}

function PresenceBadge({ support }) {
  const status = support?.status || 'Offline'
  return (
    <span className={`ppfc-presence is-${status.toLowerCase()}`}>
      <i />
      {status === 'Online' ? 'Service Desk online' : status === 'Away' ? 'Service Desk away' : 'Service Desk offline'}
    </span>
  )
}

function PortalChatWidget({ initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen)
  const [enabled, setEnabled] = useState(false)
  const [items, setItems] = useState([])
  const [support, setSupport] = useState({ status: 'Offline', available: false, online: 0, away: 0 })
  const [selectedRef, setSelectedRef] = useState('')
  const [detail, setDetail] = useState(null)
  const [creating, setCreating] = useState(false)
  const [subject, setSubject] = useState('')
  const [firstMessage, setFirstMessage] = useState('')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const selectedRefRef = useRef('')

  useEffect(() => { selectedRefRef.current = selectedRef }, [selectedRef])
  useEffect(() => { if (initialOpen) setOpen(true) }, [initialOpen])

  async function load({ quiet = false } = {}) {
    const [chatResult, presenceResult] = await Promise.allSettled([
      api('/api/v1/portal/live-chat'),
      api('/api/v1/portal/live-chat-presence'),
    ])

    if (chatResult.status === 'fulfilled') {
      const state = chatResult.value
      setEnabled(Boolean(state.enabled))
      setItems(state.items || [])
    } else if (!quiet) {
      setError(chatResult.reason?.message || 'Could not load Live Chat.')
    }

    if (presenceResult.status === 'fulfilled') {
      const nextSupport = presenceResult.value
      setSupport(nextSupport)
      if (nextSupport.enabled === false) setEnabled(false)
    } else if (!quiet && chatResult.status === 'fulfilled' && chatResult.value.enabled) {
      setError(presenceResult.reason?.message || 'Could not check Service Desk availability.')
    }
  }

  async function loadDetail(reference, { quiet = false } = {}) {
    if (!reference) {
      setDetail(null)
      return
    }
    try {
      const next = await api(`/api/v1/portal/live-chat/${encodeURIComponent(reference)}`)
      setDetail(next)
      if (Number(next.unread || 0) > 0) {
        await api(`/api/v1/portal/live-chat/${encodeURIComponent(reference)}/read`, { method: 'POST' })
      }
    } catch (err) {
      if (!quiet) setError(err.message)
    }
  }

  useEffect(() => {
    let active = true
    const refresh = () => {
      if (!active) return
      load({ quiet: true })
      if (selectedRefRef.current) loadDetail(selectedRefRef.current, { quiet: true })
    }
    load()
    const timer = window.setInterval(refresh, 4000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    if (selectedRef) loadDetail(selectedRef)
    else setDetail(null)
  }, [selectedRef])

  async function start(event) {
    event.preventDefault()
    if (!support.available || !subject.trim() || !firstMessage.trim()) return
    setBusy(true)
    setError('')
    try {
      const next = await api('/api/v1/portal/live-chat', {
        method: 'POST',
        body: JSON.stringify({ subject: subject.trim(), message: firstMessage.trim() }),
      })
      setSubject('')
      setFirstMessage('')
      setCreating(false)
      setSelectedRef(next.reference)
      setDetail(next)
      await load({ quiet: true })
    } catch (err) {
      if (err.support) setSupport({ enabled: true, ...err.support })
      setError(err.message)
    } finally { setBusy(false) }
  }

  async function send(event) {
    event.preventDefault()
    if (!detail || !draft.trim()) return
    setBusy(true)
    setError('')
    try {
      const next = await api(`/api/v1/portal/live-chat/${encodeURIComponent(detail.reference)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: draft.trim() }),
      })
      setDraft('')
      setDetail(next)
      await load({ quiet: true })
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  function raiseIncident() {
    const buttons = Array.from(document.querySelectorAll('.prp-header nav button, .prp-mobile-nav button'))
    const target = buttons.find((button) => /raise incident/i.test(button.textContent || ''))
    setOpen(false)
    setCreating(false)
    setSelectedRef('')
    setDetail(null)
    if (target instanceof HTMLButtonElement) {
      target.click()
      return
    }
    publishPortalRoute('/incident')
  }

  const unread = items.reduce((sum, item) => sum + Number(item.unread || 0), 0)

  if (!enabled) return null

  return (
    <div className={`ppfc-root${open ? ' is-open' : ''}`}>
      {open ? (
        <section className="ppfc-panel" aria-label="Live Chat">
          <header className="ppfc-header">
            <div className="ppfc-header-brand">
              <span className="ppfc-header-icon"><MessageCircle size={19} /></span>
              <div><strong>Live Chat</strong><PresenceBadge support={support} /></div>
            </div>
            <button aria-label="Close Live Chat" onClick={() => setOpen(false)} type="button"><X size={18} /></button>
          </header>

          {creating ? (
            <div className="ppfc-body ppfc-start">
              <button className="ppfc-back" onClick={() => { setCreating(false); setError('') }} type="button">
                <ArrowLeft size={15} /> Conversations
              </button>
              <div className="ppfc-intro">
                <span>New conversation</span>
                <strong>How can we help?</strong>
                <p>Send a message directly to the Service Desk.</p>
              </div>
              {!support.available ? (
                <div className={`ppfc-availability is-${String(support.status || 'Offline').toLowerCase()}`}>
                  <PresenceBadge support={support} />
                  <p>{support.status === 'Away' ? 'The Service Desk is away right now, so a new live conversation cannot be started.' : 'No analysts are currently online for a new live conversation.'}</p>
                  <button onClick={raiseIncident} type="button">Raise an incident instead</button>
                </div>
              ) : (
                <form className="ppfc-start-form" onSubmit={start}>
                  <label><span>Subject</span><input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What do you need help with?" /></label>
                  <label><span>Message</span><textarea rows={5} value={firstMessage} onChange={(event) => setFirstMessage(event.target.value)} placeholder="Describe the issue or question…" /></label>
                  {error ? <div className="ppfc-error">{error}</div> : null}
                  <button className="ppfc-primary" disabled={busy || !subject.trim() || !firstMessage.trim()} type="submit"><Send size={15} /> {busy ? 'Starting…' : 'Start conversation'}</button>
                </form>
              )}
            </div>
          ) : detail ? (
            <div className="ppfc-thread">
              <div className="ppfc-thread-heading">
                <button className="ppfc-back-icon" aria-label="Back to conversations" onClick={() => { setSelectedRef(''); setDetail(null); setError('') }} type="button"><ArrowLeft size={17} /></button>
                <span className="ppfc-avatar">{initials(detail.assignedTo || 'IT')}</span>
                <div>
                  <small>{detail.reference} · {detail.status}</small>
                  <strong>{detail.subject}</strong>
                  <span>{detail.assignedTo ? `Chatting with ${detail.assignedTo}` : support.available ? 'Waiting for an analyst to join' : 'Waiting for the Service Desk'}</span>
                </div>
              </div>
              {error ? <div className="ppfc-error thread-error">{error}</div> : null}
              <div className="ppfc-messages">
                {(detail.messages || []).map((message) => message.sender === 'system' ? (
                  <div className="ppfc-system" key={message.id}>{message.text}<small>{formatTime(message.createdAt)}</small></div>
                ) : (
                  <div className={`ppfc-message ${message.sender}`} key={message.id}>
                    <p>{message.text}</p>
                    <span>{message.senderName} · {formatTime(message.createdAt)}</span>
                  </div>
                ))}
              </div>
              {detail.status === 'Closed' ? (
                <div className="ppfc-closed">This conversation has been closed by the Service Desk.</div>
              ) : (
                <form className="ppfc-composer" onSubmit={send}>
                  <textarea rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type your message…" />
                  <button aria-label="Send message" disabled={busy || !draft.trim()} type="submit"><Send size={17} /></button>
                </form>
              )}
            </div>
          ) : (
            <div className="ppfc-body">
              <div className="ppfc-home-status">
                <PresenceBadge support={support} />
                <p>{support.available
                  ? 'An analyst is online and ready to help.'
                  : support.status === 'Away'
                    ? 'The Service Desk is away right now. Existing conversations are still available below.'
                    : 'The Service Desk is offline right now. Existing conversations are still available below.'}</p>
              </div>

              {support.available ? (
                <button className="ppfc-new" onClick={() => { setCreating(true); setError('') }} type="button"><Plus size={16} /> Start a new chat</button>
              ) : (
                <button className="ppfc-incident" onClick={raiseIncident} type="button">Raise an incident instead</button>
              )}

              {error ? <div className="ppfc-error">{error}</div> : null}

              <div className="ppfc-section-title"><strong>Conversations</strong>{items.length ? <span>{items.length}</span> : null}</div>
              {items.length ? (
                <div className="ppfc-list">
                  {items.map((item) => (
                    <button key={item.reference} onClick={() => { setSelectedRef(item.reference); setError('') }} type="button">
                      <span className="ppfc-list-avatar">{initials(item.assignedTo || 'IT')}</span>
                      <span className="ppfc-list-copy"><small>{item.reference} · {item.status}</small><strong>{item.subject}</strong><em>{item.lastMessage || 'Conversation started'}</em></span>
                      <span className="ppfc-list-meta">{item.unread ? <i>{item.unread}</i> : null}<ChevronRight size={15} /></span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="ppfc-empty"><MessageCircle size={25} /><strong>No conversations yet</strong><span>{support.available ? 'Start a chat whenever you need help.' : 'When an analyst is online, you can start a live conversation here.'}</span></div>
              )}
            </div>
          )}
        </section>
      ) : null}

      <button className="ppfc-launcher" aria-expanded={open} aria-label="Open Live Chat" onClick={() => setOpen((value) => !value)} type="button">
        {open ? <X size={21} /> : <MessageCircle size={22} />}
        {!open && unread > 0 ? <span>{unread > 99 ? '99+' : unread}</span> : null}
        {!open ? <i className={`is-${String(support.status || 'Offline').toLowerCase()}`} /> : null}
      </button>
    </div>
  )
}

function IncidentSuggestions({ items, target, onNavigate }) {
  const [text, setText] = useState('')
  useEffect(() => {
    const form = document.querySelector('.prp-request-form')
    if (!(form instanceof HTMLElement)) return undefined
    const inputs = [...form.querySelectorAll('input, textarea')].slice(0, 2)
    const sync = () => setText(inputs.map((input) => input.value || '').join(' ').trim())
    inputs.forEach((input) => input.addEventListener('input', sync))
    sync()
    return () => inputs.forEach((input) => input.removeEventListener('input', sync))
  }, [target])

  const suggestions = useMemo(() => {
    const words = new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3))
    if (!words.size) return []
    return items.map((item) => {
      const hay = `${item.title} ${item.summary} ${item.category} ${item.bodyText}`.toLowerCase()
      return { item, score: [...words].filter((word) => hay.includes(word)).length }
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map((item) => item.item)
  }, [items, text])

  if (!suggestions.length || !target) return null

  return createPortal(
    <div className="ppx-suggestions prp-card">
      <span>Knowledge suggestions</span>
      <strong>These articles might solve this first</strong>
      {suggestions.map((item) => (
        <a
          href={`/knowledge/${encodeURIComponent(item.slug || item.reference)}`}
          key={item.reference}
          onClick={(event) => {
            event.preventDefault()
            onNavigate(`/knowledge/${encodeURIComponent(item.slug || item.reference)}`)
          }}
        >
          <BookOpen size={15} />
          <span><b>{item.title}</b><small>{item.summary}</small></span>
          <ChevronRight size={14} />
        </a>
      ))}
      <small>You can still raise the incident if these do not help.</small>
    </div>,
    target,
  )
}

export function ProductionPortalKnowledgeChat() {
  const initialPath = currentPortalPath()
  const legacyChatRoute = initialPath === '/live-chat' || initialPath.startsWith('/live-chat/')
  const [shell, setShell] = useState(null)
  const [desktopNav, setDesktopNav] = useState(null)
  const [mobileNav, setMobileNav] = useState(null)
  const [content, setContent] = useState(null)
  const [suggestionTarget, setSuggestionTarget] = useState(null)
  const [routePath, setRoutePath] = useState(initialPath)
  const [knowledge, setKnowledge] = useState([])
  const knowledgeMode = routePath === '/knowledge' || routePath.startsWith('/knowledge/')

  useEffect(() => {
    if (!legacyChatRoute) return
    publishPortalRoute('/', { replace: true })
    setRoutePath('/')
  }, [legacyChatRoute])

  useEffect(() => {
    const syncRoute = (event) => {
      const next = event?.detail?.path || currentPortalPath()
      setRoutePath(next)
    }
    window.addEventListener('popstate', syncRoute)
    window.addEventListener('hi5-portal-routechange', syncRoute)
    return () => {
      window.removeEventListener('popstate', syncRoute)
      window.removeEventListener('hi5-portal-routechange', syncRoute)
    }
  }, [])

  useEffect(() => {
    const scan = () => {
      const nextShell = document.querySelector('.prp-shell')
      setShell(nextShell instanceof HTMLElement ? nextShell : null)
      setDesktopNav(document.querySelector('.prp-header nav'))
      setMobileNav(document.querySelector('.prp-mobile-nav'))
      setContent(document.querySelector('.prp-content'))
      setSuggestionTarget(document.querySelector('.prp-request-summary'))
    }
    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!shell) return
    api('/api/v1/portal/knowledge').then((payload) => setKnowledge(payload.items || [])).catch(() => {})
  }, [shell])

  useEffect(() => {
    if (!(content instanceof HTMLElement)) return
    content.classList.toggle('production-portal-addon-mounted', knowledgeMode)
    return () => content.classList.remove('production-portal-addon-mounted')
  }, [content, knowledgeMode])

  useEffect(() => {
    const nativeNavigation = (event) => {
      const button = event.target.closest?.('.prp-header nav button, .prp-mobile-nav button')
      if (!button || button.dataset.hi5PortalAddon) return
      window.requestAnimationFrame(() => setRoutePath(currentPortalPath()))
    }
    document.addEventListener('click', nativeNavigation, true)
    return () => document.removeEventListener('click', nativeNavigation, true)
  }, [])

  function navigate(path) {
    publishPortalRoute(path)
    setRoutePath(path)
  }

  if (!shell) return null

  const knowledgeButton = (
    <button data-hi5-portal-addon="knowledge" className={knowledgeMode ? 'active' : ''} onClick={() => navigate('/knowledge')} type="button">
      <BookOpen size={17} /> Knowledge
    </button>
  )

  return (
    <>
      {desktopNav ? createPortal(knowledgeButton, desktopNav) : null}
      {mobileNav ? createPortal(
        <button data-hi5-portal-addon="knowledge" className={knowledgeMode ? 'active' : ''} onClick={() => navigate('/knowledge')} type="button">
          <BookOpen size={18} /> Knowledge
        </button>,
        mobileNav,
      ) : null}
      {knowledgeMode && content ? createPortal(
        <div className="production-portal-addon-root">
          <PortalKnowledge initialItems={knowledge} routePath={routePath} onNavigate={navigate} />
        </div>,
        content,
      ) : null}
      {!knowledgeMode && routePath === '/incident' ? <IncidentSuggestions items={knowledge} target={suggestionTarget} onNavigate={navigate} /> : null}
      <PortalChatWidget initialOpen={legacyChatRoute} />
    </>
  )
}

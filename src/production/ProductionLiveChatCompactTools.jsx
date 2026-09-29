import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRightLeft,
  CheckCheck,
  Download,
  FilePlus2,
  FileText,
  FolderOpen,
  Link2,
  MessageSquareText,
  Paperclip,
  Search,
  X,
} from 'lucide-react'
import './ProductionLiveChatCompactTools.css'

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
  if (!response.ok) throw new Error(payload.error || 'Live Chat request failed.')
  return payload
}

function currentReference() {
  const value = document.querySelector('.plc-thread-header small')?.textContent || ''
  return value.match(/CHAT-\d+/i)?.[0]?.toUpperCase() || ''
}

function ensureHost(anchor, key, mode = 'after') {
  if (!(anchor instanceof HTMLElement)) return null
  const selector = `[data-plcr-host="${key}"]`
  const existing = document.querySelector(selector)
  if (existing instanceof HTMLElement) return existing
  const host = document.createElement('div')
  host.dataset.plcrHost = key
  if (mode === 'prepend') anchor.prepend(host)
  else anchor.insertAdjacentElement('afterend', host)
  return host
}

function setControlledValue(element, value) {
  if (!(element instanceof HTMLTextAreaElement)) return
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  if (setter) setter.call(element, value)
  else element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.focus()
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date)
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.onload = () => resolve({
      name: file.name,
      type: file.type || 'application/octet-stream',
      dataBase64: String(reader.result || '').split(',')[1] || '',
    })
    reader.readAsDataURL(file)
  })
}

async function downloadAttachment(attachment) {
  const response = await fetch(`${API_BASE}/api/v1/live-chat/attachments/${encodeURIComponent(attachment.id)}`, {
    credentials: 'include',
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Could not download attachment.')
  const blob = await response.blob()
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = attachment.fileName || 'attachment'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(href)
}

function presenceClass(value) {
  return String(value || 'Offline').toLowerCase()
}

function ToolSheet({ title, icon, onClose, children }) {
  return createPortal(
    <div className="plcr-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="plcr-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <span className="plcr-sheet-icon">{icon}</span>
          <div><small>Live Chat</small><h3>{title}</h3></div>
          <button className="plcr-close" onClick={onClose} aria-label="Close" type="button"><X size={18} /></button>
        </header>
        <div className="plcr-sheet-body">{children}</div>
      </section>
    </div>,
    document.body,
  )
}

export function ProductionLiveChatCompactTools() {
  const [active, setActive] = useState(() => window.location.pathname === '/live-chat')
  const [reference, setReference] = useState('')
  const [actionHost, setActionHost] = useState(null)
  const [composerHost, setComposerHost] = useState(null)
  const [ops, setOps] = useState(null)
  const [agents, setAgents] = useState([])
  const [canned, setCanned] = useState([])
  const [overlay, setOverlay] = useState('')
  const [linkReference, setLinkReference] = useState('')
  const [cannedQuery, setCannedQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const sync = () => setActive(window.location.pathname === '/live-chat')
    window.addEventListener('popstate', sync)
    window.addEventListener('hi5-routechange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hi5-routechange', sync)
    }
  }, [])

  useEffect(() => {
    if (!active) {
      setReference('')
      setActionHost(null)
      setComposerHost(null)
      return undefined
    }

    const scan = () => {
      const nextReference = currentReference()
      setReference((current) => current === nextReference ? current : nextReference)
      const meta = document.querySelector('.plc-thread-meta')
      const composer = document.querySelector('.plc-composer')
      setActionHost(meta ? ensureHost(meta, 'actions') : null)
      setComposerHost(composer ? ensureHost(composer, 'composer', 'prepend') : null)
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    const timer = window.setInterval(scan, 700)

    return () => {
      observer.disconnect()
      window.clearInterval(timer)
      document.querySelectorAll('[data-plcr-host]').forEach((node) => node.remove())
    }
  }, [active])

  async function refresh() {
    if (!reference) {
      setOps(null)
      return
    }
    const results = await Promise.allSettled([
      api(`/api/v1/live-chat/conversations/${encodeURIComponent(reference)}/operations`),
      api('/api/v1/live-chat/agents'),
      api('/api/v1/live-chat/canned-responses'),
    ])
    if (results[0].status === 'fulfilled') setOps(results[0].value)
    if (results[1].status === 'fulfilled') setAgents(results[1].value.items || [])
    if (results[2].status === 'fulfilled') setCanned(results[2].value.items || [])
  }

  useEffect(() => {
    if (!reference) return undefined
    setOverlay('')
    setLinkReference('')
    setError('')
    refresh()
    const timer = window.setInterval(refresh, 3000)
    return () => window.clearInterval(timer)
  }, [reference])

  async function transferTo(personId) {
    if (!reference || !personId) return
    setBusy(true); setError('')
    try {
      await api(`/api/v1/live-chat/conversations/${encodeURIComponent(reference)}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ personId }),
      })
      setOverlay('')
      await refresh()
    } catch (nextError) { setError(nextError.message) }
    finally { setBusy(false) }
  }

  async function linkRecord() {
    if (!reference || !linkReference.trim()) return
    setBusy(true); setError('')
    try {
      await api(`/api/v1/live-chat/conversations/${encodeURIComponent(reference)}/link-record`, {
        method: 'POST',
        body: JSON.stringify({ recordReference: linkReference.trim() }),
      })
      setOverlay('')
      setLinkReference('')
      await refresh()
    } catch (nextError) { setError(nextError.message) }
    finally { setBusy(false) }
  }

  async function createIncident() {
    if (!reference) return
    setBusy(true); setError('')
    try {
      await api(`/api/v1/live-chat/conversations/${encodeURIComponent(reference)}/create-incident`, { method: 'POST' })
      setOverlay('')
      await refresh()
    } catch (nextError) { setError(nextError.message) }
    finally { setBusy(false) }
  }

  async function transcript() {
    if (!reference) return
    try {
      const result = await api(`/api/v1/live-chat/conversations/${encodeURIComponent(reference)}/transcript`)
      const href = URL.createObjectURL(new Blob([result.content || ''], { type: 'text/plain;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = href
      link.download = result.fileName || `${reference.toLowerCase()}-transcript.txt`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(href)
    } catch (nextError) { setError(nextError.message) }
  }

  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !reference) return
    setBusy(true); setError('')
    try {
      const payload = await readFile(file)
      await api(`/api/v1/live-chat/conversations/${encodeURIComponent(reference)}/attachments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      await refresh()
    } catch (nextError) { setError(nextError.message) }
    finally { setBusy(false) }
  }

  function insertCanned(item) {
    setControlledValue(document.querySelector('.plc-composer textarea'), item.body)
    setOverlay('')
    setCannedQuery('')
  }

  const activeCanned = useMemo(() => {
    const needle = cannedQuery.trim().toLowerCase()
    return canned
      .filter((item) => item.active)
      .filter((item) => !needle || `${item.shortcut} ${item.title} ${item.body}`.toLowerCase().includes(needle))
  }, [canned, cannedQuery])

  const unreadState = ops?.otherPartyTyping
    ? 'Requester is typing…'
    : ops?.requesterReadAt
      ? `Read ${formatTime(ops.requesterReadAt)}`
      : ''

  if (!active || !reference) return null

  return (
    <>
      {actionHost ? createPortal(
        <div className="plcr-actionbar" aria-label="Chat actions">
          <button onClick={() => setOverlay('transfer')} title="Transfer chat" aria-label="Transfer chat" type="button"><ArrowRightLeft size={18} /></button>
          <button className={ops?.linkedRecord ? 'is-active' : ''} onClick={() => setOverlay('link')} title="Link record" aria-label="Link record" type="button"><Link2 size={18} /></button>
          <button disabled={Boolean(ops?.linkedRecord) || busy} onClick={createIncident} title="Create Incident from chat" aria-label="Create Incident from chat" type="button"><FilePlus2 size={18} /></button>
          <button onClick={transcript} title="Download transcript" aria-label="Download transcript" type="button"><FileText size={18} /></button>
          {(ops?.attachments || []).length ? <button onClick={() => setOverlay('attachments')} title="Chat attachments" aria-label="Chat attachments" type="button"><FolderOpen size={18} /><i>{ops.attachments.length}</i></button> : null}
          {ops?.linkedRecord ? <span className="plcr-linked">{ops.linkedRecord.type} {ops.linkedRecord.reference}</span> : null}
        </div>,
        actionHost,
      ) : null}

      {composerHost ? createPortal(
        <div className="plcr-composer-tools">
          <label title="Attach file" aria-label="Attach file">
            <Paperclip size={18} />
            <input disabled={busy} type="file" onChange={upload} accept="image/*,.pdf,.txt,.csv,.docx,.xlsx" />
          </label>
          <button onClick={() => setOverlay('canned')} title="Canned responses" aria-label="Canned responses" type="button"><MessageSquareText size={18} /></button>
          {unreadState ? <span className="plcr-read-state">{ops?.otherPartyTyping ? null : <CheckCheck size={13} />}{unreadState}</span> : null}
        </div>,
        composerHost,
      ) : null}

      {error ? <div className="plcr-toast" role="status"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={14} /></button></div> : null}

      {overlay === 'transfer' ? <ToolSheet title="Transfer conversation" icon={<ArrowRightLeft size={18} />} onClose={() => setOverlay('')}>
        <p className="plcr-help">Choose an active analyst. Their current presence and open-chat load are shown below.</p>
        <div className="plcr-agent-list">
          {agents.map((agent) => <button disabled={busy || agent.current} onClick={() => transferTo(agent.personId)} key={agent.personId} type="button">
            <span className={`plcr-presence is-${presenceClass(agent.presence)}`} />
            <span><strong>{agent.name}{agent.current ? ' · You' : ''}</strong><small>{agent.email}</small></span>
            <em>{agent.presence} · {agent.openChats} open</em>
          </button>)}
          {!agents.length ? <div className="plcr-empty">No other active support analysts are available.</div> : null}
        </div>
      </ToolSheet> : null}

      {overlay === 'link' ? <ToolSheet title="Link ITSM record" icon={<Link2 size={18} />} onClose={() => setOverlay('')}>
        {ops?.linkedRecord ? <div className="plcr-linked-card"><Link2 size={18} /><span><small>Linked record</small><strong>{ops.linkedRecord.type} {ops.linkedRecord.reference}</strong></span></div> : <>
          <p className="plcr-help">Link this conversation to an existing record, or create a new Incident with the chat transcript attached.</p>
          <label className="plcr-field"><span>Record reference</span><input value={linkReference} onChange={(event) => setLinkReference(event.target.value)} placeholder="INC-00001 / REQ-00001" /></label>
          <div className="plcr-sheet-actions">
            <button className="secondary" disabled={busy || !linkReference.trim()} onClick={linkRecord} type="button"><Link2 size={16} /> Link existing</button>
            <button className="primary" disabled={busy} onClick={createIncident} type="button"><FilePlus2 size={16} /> Create Incident</button>
          </div>
        </>}
      </ToolSheet> : null}

      {overlay === 'canned' ? <ToolSheet title="Canned responses" icon={<MessageSquareText size={18} />} onClose={() => setOverlay('')}>
        <label className="plcr-search"><Search size={16} /><input value={cannedQuery} onChange={(event) => setCannedQuery(event.target.value)} placeholder="Search responses…" /></label>
        <div className="plcr-canned-list">
          {activeCanned.map((item) => <button key={item.id} onClick={() => insertCanned(item)} type="button"><code>/{item.shortcut}</code><span><strong>{item.title}</strong><small>{item.body}</small></span></button>)}
          {!activeCanned.length ? <div className="plcr-empty">No matching canned responses.</div> : null}
        </div>
      </ToolSheet> : null}

      {overlay === 'attachments' ? <ToolSheet title="Chat attachments" icon={<FolderOpen size={18} />} onClose={() => setOverlay('')}>
        <div className="plcr-file-list">
          {(ops?.attachments || []).map((attachment) => <button key={attachment.id} onClick={() => downloadAttachment(attachment).catch((nextError) => setError(nextError.message))} type="button"><Download size={16} /><span><strong>{attachment.fileName}</strong><small>{attachment.senderName || attachment.sender} · {Math.max(1, Math.round(Number(attachment.size || 0) / 1024))} KB</small></span></button>)}
          {!ops?.attachments?.length ? <div className="plcr-empty">No attachments in this conversation.</div> : null}
        </div>
      </ToolSheet> : null}
    </>
  )
}

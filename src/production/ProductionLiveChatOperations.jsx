import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRightLeft,
  BellRing,
  Download,
  FileText,
  Link2,
  Paperclip,
  Plus,
  Save,
  Settings,
  X,
} from 'lucide-react'
import './ProductionLiveChatOperations.css'

const API_BASE = window.__HI5_API_BASE__
const ALERTS_KEY = 'hi5central-live-chat-alerts-v1'

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
  if (!response.ok) throw Object.assign(new Error(payload.error || 'Live Chat request failed.'), { status: response.status, payload })
  return payload
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date)
}

function formatDuration(seconds) {
  const value = Math.max(0, Number(seconds || 0))
  if (value < 60) return `${value}s`
  if (value < 3600) return `${Math.floor(value / 60)}m`
  return `${Math.floor(value / 3600)}h ${Math.floor((value % 3600) / 60)}m`
}

function currentChatReference(selector) {
  const text = document.querySelector(selector)?.textContent || ''
  return text.match(/CHAT-\d+/i)?.[0]?.toUpperCase() || ''
}

function makeHost(anchor, key, mode = 'after') {
  if (!(anchor instanceof HTMLElement)) return null
  const existing = document.querySelector(`[data-plco-host="${key}"]`)
  if (existing instanceof HTMLElement) return existing
  const host = document.createElement('div')
  host.dataset.plcoHost = key
  if (mode === 'append') anchor.appendChild(host)
  else if (mode === 'prepend') anchor.prepend(host)
  else anchor.insertAdjacentElement('afterend', host)
  return host
}

function setControlledValue(element, value) {
  if (!(element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) return
  const elementPrototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(elementPrototype, 'value')?.set
  if (setter) setter.call(element, value)
  else element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.focus()
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.onload = () => {
      const encoded = String(reader.result || '').split(',')[1] || ''
      resolve({ name: file.name, type: file.type || 'application/octet-stream', dataBase64: encoded })
    }
    reader.readAsDataURL(file)
  })
}

async function downloadAttachment(attachment, portal = false) {
  const path = portal
    ? `/api/v1/portal/live-chat-attachments/${encodeURIComponent(attachment.id)}`
    : `/api/v1/live-chat/attachments/${encodeURIComponent(attachment.id)}`
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', cache: 'no-store' })
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

function soundAlert() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = 660
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.24)
    oscillator.addEventListener('ended', () => context.close())
  } catch {
    // Audio is an enhancement only.
  }
}

function notifyChat(title, body) {
  soundAlert()
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body, tag: 'hi5central-live-chat' }) } catch { /* browser may disallow */ }
  }
}

function WorkspaceOperations() {
  const [active, setActive] = useState(() => window.location.pathname === '/live-chat')
  const [hosts, setHosts] = useState({})
  const [reference, setReference] = useState('')
  const [metrics, setMetrics] = useState(null)
  const [ops, setOps] = useState(null)
  const [agents, setAgents] = useState([])
  const [canned, setCanned] = useState([])
  const [serviceHours, setServiceHours] = useState(null)
  const [transferPersonId, setTransferPersonId] = useState('')
  const [linkReference, setLinkReference] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [alertsEnabled, setAlertsEnabled] = useState(() => window.localStorage.getItem(ALERTS_KEY) === 'true')
  const [serviceDraft, setServiceDraft] = useState({ enabled: false, timezone: 'Europe/London', start: '09:00', end: '17:00' })
  const [cannedDraft, setCannedDraft] = useState({ shortcut: '', title: '', body: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const previousUnreadRef = useRef(null)

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
      setHosts({})
      setReference('')
      return undefined
    }
    const scan = () => {
      const inbox = document.querySelector('.plc-inbox')
      const search = document.querySelector('.plc-search')
      const inboxHeader = document.querySelector('.plc-inbox > header')
      const meta = document.querySelector('.plc-thread-meta')
      const composer = document.querySelector('.plc-composer')
      const next = {
        metrics: search ? makeHost(search, 'workspace-metrics', 'after') : null,
        header: inboxHeader ? makeHost(inboxHeader, 'workspace-header', 'append') : null,
        actions: meta ? makeHost(meta, 'workspace-actions', 'after') : null,
        composer: composer ? makeHost(composer, 'workspace-composer', 'prepend') : null,
      }
      if (inbox) setHosts(next)
      setReference(currentChatReference('.plc-thread-header small'))
    }
    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    const timer = window.setInterval(scan, 1000)
    return () => {
      observer.disconnect()
      window.clearInterval(timer)
      document.querySelectorAll('[data-plco-host]').forEach((node) => node.remove())
    }
  }, [active])

  async function refreshGlobal({ quiet = true } = {}) {
    if (!active) return
    const results = await Promise.allSettled([
      api('/api/v1/live-chat/metrics'),
      api('/api/v1/live-chat/agents'),
      api('/api/v1/live-chat/canned-responses'),
      api('/api/v1/live-chat/service-hours'),
      api('/api/v1/live-chat/conversations'),
    ])
    if (results[0].status === 'fulfilled') setMetrics(results[0].value)
    if (results[1].status === 'fulfilled') setAgents(results[1].value.items || [])
    if (results[2].status === 'fulfilled') setCanned(results[2].value.items || [])
    if (results[3].status === 'fulfilled') {
      const next = results[3].value
      setServiceHours(next)
      const monday = next.schedule?.['1']?.[0] || ['09:00', '17:00']
      setServiceDraft({ enabled: Boolean(next.enabled), timezone: next.timezone || 'Europe/London', start: monday[0], end: monday[1] })
    }
    if (results[4].status === 'fulfilled') {
      const items = results[4].value.items || []
      const unread = items.reduce((sum, item) => sum + Number(item.unread || 0), 0)
      if (alertsEnabled && previousUnreadRef.current !== null && unread > previousUnreadRef.current) {
        const newest = items.find((item) => Number(item.unread || 0) > 0)
        notifyChat('Hi5Central Live Chat', newest ? `${newest.participant?.name || 'Requester'} · ${newest.subject}` : 'New requester message')
      }
      previousUnreadRef.current = unread
    }
    if (!quiet) {
      const failed = results.find((result) => result.status === 'rejected')
      setError(failed?.reason?.message || '')
    }
  }

  async function refreshOps({ quiet = true } = {}) {
    if (!reference) { setOps(null); return }
    try {
      setOps(await api(`/api/v1/live-chat/conversations/${encodeURIComponent(reference)}/operations`))
      if (!quiet) setError('')
    } catch (nextError) {
      if (!quiet) setError(nextError.message)
    }
  }

  useEffect(() => {
    if (!active) return undefined
    refreshGlobal({ quiet: false })
    const timer = window.setInterval(() => refreshGlobal(), 5000)
    return () => window.clearInterval(timer)
  }, [active, alertsEnabled])

  useEffect(() => {
    if (!reference) { setOps(null); return undefined }
    refreshOps({ quiet: false })
    const timer = window.setInterval(() => refreshOps(), 2500)
    return () => window.clearInterval(timer)
  }, [reference])

  useEffect(() => {
    if (!reference) return undefined
    const textarea = document.querySelector('.plc-composer textarea')
    if (!(textarea instanceof HTMLTextAreaElement)) return undefined
    let timeout
    let lastSent = 0
    const setTyping = async (activeValue) => {
      try { await api(`/api/v1/live-chat/conversations/${encodeURIComponent(reference)}/typing`, { method: 'POST', body: JSON.stringify({ active: activeValue }) }) } catch { /* transient */ }
    }
    const onInput = () => {
      const now = Date.now()
      if (now - lastSent > 1800) { lastSent = now; setTyping(true) }
      window.clearTimeout(timeout)
      timeout = window.setTimeout(() => setTyping(false), 2800)
    }
    textarea.addEventListener('input', onInput)
    return () => {
      textarea.removeEventListener('input', onInput)
      window.clearTimeout(timeout)
      setTyping(false)
    }
  }, [reference, hosts.composer])

  async function transfer() {
    if (!reference || !transferPersonId) return
    setBusy(true); setError('')
    try {
      await api(`/api/v1/live-chat/conversations/${encodeURIComponent(reference)}/transfer`, { method: 'POST', body: JSON.stringify({ personId: transferPersonId }) })
      setTransferPersonId('')
      await Promise.all([refreshOps({ quiet: false }), refreshGlobal()])
    } catch (nextError) { setError(nextError.message) } finally { setBusy(false) }
  }

  async function linkRecord() {
    if (!reference || !linkReference.trim()) return
    setBusy(true); setError('')
    try {
      await api(`/api/v1/live-chat/conversations/${encodeURIComponent(reference)}/link-record`, { method: 'POST', body: JSON.stringify({ recordReference: linkReference.trim() }) })
      setLinkReference('')
      await refreshOps({ quiet: false })
    } catch (nextError) { setError(nextError.message) } finally { setBusy(false) }
  }

  async function createIncident() {
    if (!reference) return
    setBusy(true); setError('')
    try {
      await api(`/api/v1/live-chat/conversations/${encodeURIComponent(reference)}/create-incident`, { method: 'POST' })
      await refreshOps({ quiet: false })
    } catch (nextError) { setError(nextError.message) } finally { setBusy(false) }
  }

  async function transcript() {
    if (!reference) return
    try {
      const result = await api(`/api/v1/live-chat/conversations/${encodeURIComponent(reference)}/transcript`)
      const href = URL.createObjectURL(new Blob([result.content || ''], { type: 'text/plain;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = href
      link.download = result.fileName || `${reference.toLowerCase()}-transcript.txt`
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(href)
    } catch (nextError) { setError(nextError.message) }
  }

  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !reference) return
    setBusy(true); setError('')
    try {
      const payload = await readFile(file)
      await api(`/api/v1/live-chat/conversations/${encodeURIComponent(reference)}/attachments`, { method: 'POST', body: JSON.stringify(payload) })
      await refreshOps({ quiet: false })
    } catch (nextError) { setError(nextError.message) } finally { setBusy(false) }
  }

  async function enableAlerts() {
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
    window.localStorage.setItem(ALERTS_KEY, 'true')
    setAlertsEnabled(true)
    soundAlert()
  }

  async function saveHours() {
    setBusy(true); setError('')
    const schedule = Object.fromEntries(['1','2','3','4','5'].map((day) => [day, [[serviceDraft.start, serviceDraft.end]]]))
    try {
      const next = await api('/api/v1/live-chat/service-hours', { method: 'PATCH', body: JSON.stringify({ enabled: serviceDraft.enabled, timezone: serviceDraft.timezone, schedule }) })
      setServiceHours(next)
    } catch (nextError) { setError(nextError.message) } finally { setBusy(false) }
  }

  async function createCanned(event) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      await api('/api/v1/live-chat/canned-responses', { method: 'POST', body: JSON.stringify(cannedDraft) })
      setCannedDraft({ shortcut: '', title: '', body: '' })
      await refreshGlobal()
    } catch (nextError) { setError(nextError.message) } finally { setBusy(false) }
  }

  const activeCanned = useMemo(() => canned.filter((item) => item.active), [canned])

  if (!active) return null

  return (
    <>
      {hosts.metrics ? createPortal(
        <div className="plco-metrics">
          <span><b>{metrics?.waiting || 0}</b> Waiting</span>
          <span><b>{metrics?.open || 0}</b> Open</span>
          <span><b>{metrics?.analystsOnline || 0}</b> Online</span>
          <span><b>{formatDuration(metrics?.oldestWaitingSeconds)}</b> Oldest</span>
        </div>, hosts.metrics) : null}

      {hosts.header ? createPortal(
        <div className="plco-header-buttons">
          {!alertsEnabled ? <button className="plc-icon" title="Enable browser and sound alerts" onClick={enableAlerts}><BellRing size={16} /></button> : null}
          <button className="plc-icon" title="Live Chat settings" onClick={() => setSettingsOpen(true)}><Settings size={16} /></button>
        </div>, hosts.header) : null}

      {reference && hosts.actions ? createPortal(
        <div className="plco-actions">
          <div className="plco-action-group">
            <ArrowRightLeft size={14} />
            <select value={transferPersonId} onChange={(event) => setTransferPersonId(event.target.value)}>
              <option value="">Transfer to…</option>
              {agents.map((agent) => <option value={agent.personId} key={agent.personId}>{agent.name} · {agent.presence} · {agent.openChats} open</option>)}
            </select>
            <button disabled={busy || !transferPersonId} onClick={transfer}>Transfer</button>
          </div>
          <div className="plco-action-group">
            <Link2 size={14} />
            {ops?.linkedRecord ? <strong>{ops.linkedRecord.type} {ops.linkedRecord.reference}</strong> : <><input value={linkReference} onChange={(event) => setLinkReference(event.target.value)} placeholder="INC-00001 / REQ-…" /><button disabled={busy || !linkReference.trim()} onClick={linkRecord}>Link</button><button className="primary" disabled={busy} onClick={createIncident}>Create Incident</button></>}
          </div>
          <button className="plco-utility" onClick={transcript}><FileText size={14} /> Transcript</button>
          {error ? <span className="plco-error">{error}</span> : null}
        </div>, hosts.actions) : null}

      {reference && hosts.composer ? createPortal(
        <div className="plco-composer-tools">
          <label className="plco-attach" title="Attach file"><Paperclip size={15} /><input type="file" onChange={upload} accept="image/*,.pdf,.txt,.csv,.docx,.xlsx" /></label>
          <select defaultValue="" onChange={(event) => { const item = activeCanned.find((entry) => entry.id === event.target.value); if (item) setControlledValue(document.querySelector('.plc-composer textarea'), item.body); event.target.value = '' }}>
            <option value="">Canned response…</option>
            {activeCanned.map((item) => <option key={item.id} value={item.id}>/{item.shortcut} · {item.title}</option>)}
          </select>
          <span className="plco-state">{ops?.otherPartyTyping ? 'Requester is typing…' : ops?.requesterReadAt ? `Read ${formatTime(ops.requesterReadAt)}` : ''}</span>
          {(ops?.attachments || []).length ? <div className="plco-attachments">{ops.attachments.map((attachment) => <button key={attachment.id} onClick={() => downloadAttachment(attachment).catch((nextError) => setError(nextError.message))}><Download size={12} /> {attachment.fileName}</button>)}</div> : null}
        </div>, hosts.composer) : null}

      {settingsOpen ? createPortal(
        <div className="plco-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false) }}>
          <section className="plco-modal">
            <header><div><small>Live Chat</small><h3>Service settings</h3></div><button onClick={() => setSettingsOpen(false)}><X size={18} /></button></header>
            <div className="plco-setting-card">
              <h4>Service hours</h4>
              <label className="plco-check"><input type="checkbox" checked={serviceDraft.enabled} onChange={(event) => setServiceDraft((current) => ({ ...current, enabled: event.target.checked }))} /> Restrict new chats to opening hours</label>
              <div className="plco-grid"><label>Timezone<input value={serviceDraft.timezone} onChange={(event) => setServiceDraft((current) => ({ ...current, timezone: event.target.value }))} /></label><label>Monday–Friday start<input type="time" value={serviceDraft.start} onChange={(event) => setServiceDraft((current) => ({ ...current, start: event.target.value }))} /></label><label>Monday–Friday end<input type="time" value={serviceDraft.end} onChange={(event) => setServiceDraft((current) => ({ ...current, end: event.target.value }))} /></label></div>
              <button className="plco-primary" disabled={busy} onClick={saveHours}><Save size={14} /> Save hours</button>
              <small>{serviceHours?.enabled ? (serviceHours.open ? 'Currently within service hours' : 'Currently outside service hours') : 'Service hours are unrestricted'}</small>
            </div>
            <div className="plco-setting-card">
              <h4>Canned responses</h4>
              <div className="plco-canned-list">{canned.map((item) => <div key={item.id}><code>/{item.shortcut}</code><span><b>{item.title}</b><small>{item.body}</small></span></div>)}{!canned.length ? <small>No canned responses yet.</small> : null}</div>
              <form onSubmit={createCanned}><div className="plco-grid"><label>Shortcut<input value={cannedDraft.shortcut} onChange={(event) => setCannedDraft((current) => ({ ...current, shortcut: event.target.value }))} placeholder="password" /></label><label>Title<input value={cannedDraft.title} onChange={(event) => setCannedDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Password reset" /></label></div><label>Response<textarea rows={3} value={cannedDraft.body} onChange={(event) => setCannedDraft((current) => ({ ...current, body: event.target.value }))} /></label><button className="plco-primary" disabled={busy || !cannedDraft.shortcut || !cannedDraft.title || !cannedDraft.body}><Plus size={14} /> Add response</button></form>
            </div>
          </section>
        </div>, document.body) : null}
    </>
  )
}

function PortalOperations() {
  const [reference, setReference] = useState('')
  const [host, setHost] = useState(null)
  const [ops, setOps] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const scan = () => {
      const nextReference = currentChatReference('.ppfc-thread-heading small')
      setReference(nextReference)
      const composer = document.querySelector('.ppfc-composer')
      setHost(composer ? makeHost(composer, 'portal-composer', 'prepend') : null)
    }
    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    const timer = window.setInterval(scan, 900)
    return () => { observer.disconnect(); window.clearInterval(timer); document.querySelector('[data-plco-host="portal-composer"]')?.remove() }
  }, [])

  async function refresh({ quiet = true } = {}) {
    if (!reference) { setOps(null); return }
    try {
      setOps(await api(`/api/v1/portal/live-chat/${encodeURIComponent(reference)}/operations`))
      if (!quiet) setError('')
    } catch (nextError) { if (!quiet) setError(nextError.message) }
  }

  useEffect(() => {
    if (!reference) { setOps(null); return undefined }
    refresh({ quiet: false })
    const timer = window.setInterval(() => refresh(), 2500)
    return () => window.clearInterval(timer)
  }, [reference])

  useEffect(() => {
    if (!reference) return undefined
    const textarea = document.querySelector('.ppfc-composer textarea')
    if (!(textarea instanceof HTMLTextAreaElement)) return undefined
    let timeout
    let lastSent = 0
    const setTyping = async (activeValue) => {
      try { await api(`/api/v1/portal/live-chat/${encodeURIComponent(reference)}/typing`, { method: 'POST', body: JSON.stringify({ active: activeValue }) }) } catch { /* transient */ }
    }
    const onInput = () => {
      const now = Date.now()
      if (now - lastSent > 1800) { lastSent = now; setTyping(true) }
      window.clearTimeout(timeout)
      timeout = window.setTimeout(() => setTyping(false), 2800)
    }
    textarea.addEventListener('input', onInput)
    return () => { textarea.removeEventListener('input', onInput); window.clearTimeout(timeout); setTyping(false) }
  }, [reference, host])

  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !reference) return
    setBusy(true); setError('')
    try {
      const payload = await readFile(file)
      await api(`/api/v1/portal/live-chat/${encodeURIComponent(reference)}/attachments`, { method: 'POST', body: JSON.stringify(payload) })
      await refresh({ quiet: false })
    } catch (nextError) { setError(nextError.message) } finally { setBusy(false) }
  }

  if (!reference || !host) return null

  return createPortal(
    <div className="ppfco-tools">
      <label title="Attach file"><Paperclip size={15} /><input disabled={busy} type="file" onChange={upload} accept="image/*,.pdf,.txt,.csv,.docx,.xlsx" /></label>
      <span>{ops?.otherPartyTyping ? 'Service Desk is typing…' : ops?.agentReadAt ? `Service Desk read ${formatTime(ops.agentReadAt)}` : ''}</span>
      {(ops?.attachments || []).length ? <div className="ppfco-attachments">{ops.attachments.map((attachment) => <button key={attachment.id} onClick={() => downloadAttachment(attachment, true).catch((nextError) => setError(nextError.message))}><Paperclip size={11} /> {attachment.fileName}</button>)}</div> : null}
      {error ? <small className="ppfco-error">{error}</small> : null}
    </div>, host)
}

export function ProductionLiveChatOperations() {
  return <WorkspaceOperations />
}

export function ProductionPortalLiveChatOperations() {
  return <PortalOperations />
}

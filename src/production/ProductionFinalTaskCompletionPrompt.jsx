import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ExternalLink, X } from 'lucide-react'
import './ProductionFinalTaskCompletionPrompt.css'

const API_BASE = window.__HI5_API_BASE__

async function apiJson(path, options = {}) {
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
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`)
  return payload
}

function taskKeyFromPath(pathname = window.location.pathname) {
  const match = pathname.match(/^\/tasks\/([^/]+)\/?$/i)
  return match ? decodeURIComponent(match[1]).toUpperCase() : ''
}

function navigate(path) {
  if (window.location.pathname === path) return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.dispatchEvent(new CustomEvent('hi5-routechange', { detail: { path } }))
}

function completedForParent(items, parentId) {
  return (items || []).filter((item) => item?.primaryRequest?.id === parentId && item.status === 'Completed')
}

function activeForParent(items, parentId) {
  return (items || []).filter((item) => item?.primaryRequest?.id === parentId && ['Ready', 'In Progress', 'Blocked'].includes(item.status))
}

export function ProductionFinalTaskCompletionPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [summary, setSummary] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [completed, setCompleted] = useState(false)
  const handledTasks = useRef(new Set())
  const checkingTasks = useRef(new Set())

  async function inspectCompletedTask(taskKey, attempt = 0) {
    if (!taskKey || checkingTasks.current.has(taskKey)) return
    checkingTasks.current.add(taskKey)

    try {
      const task = await apiJson(`/api/v1/tasks/${encodeURIComponent(taskKey)}`)
      const parentId = task?.primaryRequest?.id
      if (task?.status !== 'Completed' || !parentId) return

      const query = new URLSearchParams({ search: parentId, limit: '200', offset: '0' })
      const [parentState, activeTasks, completedTasks] = await Promise.all([
        apiJson(`/api/v1/service-request-state/${encodeURIComponent(parentId)}`),
        apiJson(`/api/v1/tasks?${query}`),
        apiJson(`/api/v1/tasks?status=Completed&${query}`),
      ])

      if (!['Approved', 'In Progress'].includes(parentState?.status)) return

      const active = activeForParent(activeTasks?.items, parentId)
      const done = completedForParent(completedTasks?.items, parentId)
      if (active.length || !done.length) return

      setSummary('')
      setError('')
      setCompleted(false)
      setPrompt({
        taskKey,
        parentId,
        parentTitle: task.primaryRequest?.title || 'Service Request',
        totalTasks: done.length,
      })
    } catch (inspectError) {
      if (attempt < 2) {
        window.setTimeout(() => {
          checkingTasks.current.delete(taskKey)
          void inspectCompletedTask(taskKey, attempt + 1)
        }, 650)
      }
    } finally {
      if (attempt >= 2 || !checkingTasks.current.has(taskKey)) return
      checkingTasks.current.delete(taskKey)
    }
  }

  useEffect(() => {
    function inspectPage() {
      const taskKey = taskKeyFromPath()
      if (!taskKey || handledTasks.current.has(taskKey)) return

      const completionNotice = [...document.querySelectorAll('.activity-canvas-banner.is-success')]
        .find((node) => /task completed/i.test(node.textContent || ''))
      if (!completionNotice) return

      handledTasks.current.add(taskKey)
      void inspectCompletedTask(taskKey)
    }

    inspectPage()
    const observer = new MutationObserver(inspectPage)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    window.addEventListener('popstate', inspectPage)
    window.addEventListener('hi5-routechange', inspectPage)

    return () => {
      observer.disconnect()
      window.removeEventListener('popstate', inspectPage)
      window.removeEventListener('hi5-routechange', inspectPage)
    }
  }, [])

  async function completeParent() {
    const completionNotes = summary.trim()
    if (!prompt || !completionNotes || saving) return

    setSaving(true)
    setError('')
    try {
      await apiJson(`/api/v1/service-requests/${encodeURIComponent(prompt.parentId)}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          targetStatus: 'Completed',
          values: { completionNotes },
        }),
      })
      setCompleted(true)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  if (!prompt) return null

  return <div className="production-final-task-backdrop" role="presentation">
    <section className="production-final-task-modal" role="dialog" aria-modal="true" aria-labelledby="production-final-task-title">
      <header>
        <div className="production-final-task-icon"><CheckCircle2 size={22} aria-hidden="true" /></div>
        <div>
          <span>{completed ? 'Service request completed' : 'All fulfilment tasks complete'}</span>
          <h2 id="production-final-task-title">{prompt.parentId} · {prompt.parentTitle}</h2>
        </div>
        <button type="button" className="production-final-task-close" aria-label="Close" disabled={saving} onClick={() => setPrompt(null)}><X size={18} /></button>
      </header>

      {completed ? <div className="production-final-task-success">
        <CheckCircle2 size={24} aria-hidden="true" />
        <div><strong>{prompt.parentId} is now Completed.</strong><span>The normal customer completion activity and requester notification have been created.</span></div>
      </div> : <>
        <p>All {prompt.totalTasks} fulfilment {prompt.totalTasks === 1 ? 'task is' : 'tasks are'} complete. Would you like to mark the parent Service Request as Completed now?</p>
        <label className="production-final-task-summary">
          <span>Fulfilment summary <b>*</b></span>
          <textarea
            rows="5"
            value={summary}
            disabled={saving}
            autoFocus
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Summarise the completed fulfilment and outcome for the requester…"
          />
          <small>This becomes the customer-visible completion summary for the Service Request.</small>
        </label>
        {error ? <div className="production-final-task-error">{error}</div> : null}
      </>}

      <footer>
        {completed ? <>
          <button type="button" className="production-final-task-secondary" onClick={() => setPrompt(null)}>Close</button>
          <button type="button" className="production-final-task-primary" onClick={() => navigate(`/requests/${encodeURIComponent(prompt.parentId)}`)}><ExternalLink size={16} />Open service request</button>
        </> : <>
          <button type="button" className="production-final-task-secondary" disabled={saving} onClick={() => setPrompt(null)}>Not now</button>
          <button type="button" className="production-final-task-primary" disabled={saving || !summary.trim()} onClick={completeParent}><CheckCircle2 size={16} />{saving ? 'Completing…' : 'Complete service request'}</button>
        </>}
      </footer>
    </section>
  </div>
}

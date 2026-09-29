import { useEffect, useRef, useState } from 'react'
import './ProductionOrganisationWriteThrough.css'

const API_BASE = window.__HI5_API_BASE__
const POLL_MS = 300
const RETRY_MS = 1200
const BASELINE_RELOAD_KEY = 'hi5central-production-org-baseline-reload-v1'
const NOTICE_KEY = 'hi5central-production-org-write-notice-v1'

const collections = [
  { id: 'departments', storageKey: 'hi5central-organisation-departments-v1' },
  { id: 'teams', storageKey: 'hi5central-organisation-teams-v1' },
  { id: 'people', storageKey: 'hi5central-organisation-people-v1' },
]

function readItems(storageKey) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function comparable(value) {
  return JSON.stringify(value ?? null)
}

function collectionChanged(left = [], right = []) {
  return comparable(left) !== comparable(right)
}

function changedRecords(baseline = [], current = []) {
  const baselineById = new Map(baseline.map((item) => [item?.id, item]))
  return current.filter((item) => item?.id && comparable(item) !== comparable(baselineById.get(item.id)))
}

function mergeRecords(server = [], changes = []) {
  const changesById = new Map(changes.map((item) => [item.id, item]))
  const merged = server.map((item) => changesById.get(item.id) || item)
  const serverIds = new Set(server.map((item) => item.id))
  for (const item of changes) {
    if (!serverIds.has(item.id)) merged.push(item)
  }
  return merged
}

function snapshotCollections(snapshot = {}) {
  return Object.fromEntries(collections.map(({ id }) => [id, Array.isArray(snapshot[id]) ? snapshot[id] : []]))
}

function localCollections() {
  return Object.fromEntries(collections.map(({ id, storageKey }) => [id, readItems(storageKey)]))
}

function cacheSnapshot(snapshot = {}) {
  for (const { id, storageKey } of collections) {
    if (Array.isArray(snapshot[id])) {
      window.localStorage.setItem(storageKey, JSON.stringify(snapshot[id]))
    }
  }
}

async function fetchOrganisation() {
  const response = await fetch(`${API_BASE}/api/v1/organisation`, {
    credentials: 'include',
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({}))
  return { response, payload }
}

async function putCollection(collection, items) {
  const response = await fetch(`${API_BASE}/api/v1/organisation/${encodeURIComponent(collection)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Could not save ${collection}.`)
  return payload
}

function readNotice() {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(NOTICE_KEY) || 'null')
    window.sessionStorage.removeItem(NOTICE_KEY)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    window.sessionStorage.removeItem(NOTICE_KEY)
    return null
  }
}

function writeNotice(type, message) {
  try {
    window.sessionStorage.setItem(NOTICE_KEY, JSON.stringify({ type, message }))
  } catch {
    // The reload still restores the PostgreSQL snapshot if sessionStorage is unavailable.
  }
}

export function ProductionOrganisationWriteThrough() {
  const [phase, setPhase] = useState('idle')
  const [notice, setNotice] = useState(readNotice)
  const baselineRef = useRef(null)
  const syncingRef = useRef(false)
  const pollRef = useRef(null)
  const retryRef = useRef(null)

  useEffect(() => {
    let active = true

    function stopTimers() {
      if (pollRef.current) window.clearInterval(pollRef.current)
      if (retryRef.current) window.clearTimeout(retryRef.current)
      pollRef.current = null
      retryRef.current = null
    }

    function authoritativeReload(snapshot, reason) {
      cacheSnapshot(snapshot)
      try {
        window.sessionStorage.setItem(BASELINE_RELOAD_KEY, reason)
      } catch {
        // Reload remains safe without the marker.
      }
      window.location.reload()
    }

    async function synchroniseLocalChanges() {
      if (!active || syncingRef.current || !baselineRef.current) return

      const baseline = baselineRef.current
      const current = localCollections()
      const dirty = collections
        .map(({ id }) => ({ id, changes: changedRecords(baseline[id], current[id]) }))
        .filter(({ id, changes }) => changes.length || collectionChanged(baseline[id], current[id]))

      if (!dirty.length) return

      syncingRef.current = true
      setPhase('saving')

      try {
        const latestResult = await fetchOrganisation()
        if (latestResult.response.status === 401) throw new Error('Your secure session expired before the organisation change could be saved.')
        if (!latestResult.response.ok) throw new Error(latestResult.payload.error || 'Could not reload the organisation before saving.')

        let authoritative = latestResult.payload

        for (const { id, changes } of dirty) {
          if (!changes.length) continue
          const latestItems = Array.isArray(authoritative[id]) ? authoritative[id] : []
          authoritative = await putCollection(id, mergeRecords(latestItems, changes))
        }

        cacheSnapshot(authoritative)
        baselineRef.current = snapshotCollections(authoritative)
        writeNotice('success', 'Organisation changes saved to PostgreSQL.')
        window.location.reload()
      } catch (error) {
        console.error('Production Organisation write-through failed.', error)
        try {
          const restore = await fetchOrganisation()
          if (restore.response.ok) cacheSnapshot(restore.payload)
        } catch {
          // Keep the original error as the actionable failure.
        }
        writeNotice('error', error?.message || 'Organisation changes could not be saved. The server version has been restored.')
        window.location.reload()
      }
    }

    async function establishBaseline() {
      if (!active) return
      try {
        const { response, payload } = await fetchOrganisation()

        if (response.status === 401) {
          retryRef.current = window.setTimeout(establishBaseline, RETRY_MS)
          return
        }
        if (!response.ok) throw new Error(payload.error || 'Could not load the production Organisation directory.')

        const authoritative = snapshotCollections(payload)
        const local = localCollections()
        const mismatch = collections.some(({ id }) => collectionChanged(local[id], authoritative[id]))
        const alreadyReloaded = window.sessionStorage.getItem(BASELINE_RELOAD_KEY) === 'postgres-authoritative'

        baselineRef.current = authoritative
        cacheSnapshot(payload)

        if (mismatch && !alreadyReloaded) {
          authoritativeReload(payload, 'postgres-authoritative')
          return
        }

        window.sessionStorage.removeItem(BASELINE_RELOAD_KEY)
        pollRef.current = window.setInterval(synchroniseLocalChanges, POLL_MS)
      } catch (error) {
        console.error('Production Organisation baseline failed.', error)
        setNotice({ type: 'error', message: error?.message || 'Could not connect the People directory to PostgreSQL.' })
        retryRef.current = window.setTimeout(establishBaseline, RETRY_MS * 2)
      }
    }

    establishBaseline()

    return () => {
      active = false
      stopTimers()
    }
  }, [])

  return (
    <>
      {phase === 'saving' ? (
        <div className="production-org-write-overlay" role="status" aria-live="polite">
          <div>
            <span className="production-org-write-spinner" aria-hidden="true" />
            <strong>Saving organisation changes…</strong>
            <small>Writing People, Teams and Departments to PostgreSQL.</small>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className={`production-org-write-notice ${notice.type === 'error' ? 'error' : 'success'}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      ) : null}
    </>
  )
}

import { useEffect, useState } from 'react'

const API_BASE = window.__HI5_API_BASE__
const TYPE_BY_SECTION = {
  incidents: 'Incident',
  requests: 'Service Request',
  problems: 'Problem',
  changes: 'Change',
}

function routeType(pathname = window.location.pathname) {
  const match = pathname.match(/^\/(incidents|requests|problems|changes)\/([^/]+)\/?$/i)
  if (!match || match[2].toLowerCase() === 'new') return ''
  return TYPE_BY_SECTION[match[1].toLowerCase()] || ''
}

function fieldLabel(field) {
  const first = field?.firstElementChild
  return first instanceof HTMLElement ? String(first.textContent || '').trim() : ''
}

function fieldSelect(field) {
  return field?.querySelector('select') || null
}

function matchingAssigneeField(teamField) {
  const container = teamField?.parentElement
  if (!container) return null
  return [...container.querySelectorAll(':scope > label.activity-canvas-field')]
    .find((field) => fieldLabel(field) === 'Assignee') || null
}

function eligibleMembers(directory, teamName) {
  const team = (directory?.teams || []).find((item) => item.name === teamName)
  return new Set((team?.members || []).map((member) => member.name))
}

function setNativeSelectValue(select, value) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')
  descriptor?.set?.call(select, value)
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

function applyDirectory(directory, { resetInvalid = false } = {}) {
  if (!directory) return
  const teamFields = [...document.querySelectorAll('label.activity-canvas-field')]
    .filter((field) => fieldLabel(field) === 'Assignment group')

  for (const teamField of teamFields) {
    const teamSelect = fieldSelect(teamField)
    const assigneeField = matchingAssigneeField(teamField)
    const assigneeSelect = fieldSelect(assigneeField)
    if (!teamSelect || !assigneeSelect) continue

    const allowed = eligibleMembers(directory, teamSelect.value)
    const current = assigneeSelect.value
    const currentAllowed = current === 'Unassigned' || allowed.has(current)

    for (const option of assigneeSelect.options) {
      if (option.value === 'Unassigned' || option.value === '') {
        option.hidden = false
        option.disabled = false
        continue
      }
      const eligible = allowed.has(option.value)
      option.hidden = !eligible && option.value !== current
      option.disabled = !eligible
    }

    assigneeSelect.dataset.hi5TeamScoped = 'true'
    assigneeSelect.title = teamSelect.value
      ? allowed.size
        ? 'Only active members of this team with the required Hi5Central permissions can be assigned.'
        : 'No active members of this team currently have the permissions required for this record type.'
      : 'Choose an assignment group before selecting an assignee.'

    if (resetInvalid && current && current !== 'Unassigned' && !currentAllowed) {
      setNativeSelectValue(assigneeSelect, 'Unassigned')
    }
  }
}

export function ProductionAssignmentExperience() {
  const [recordType, setRecordType] = useState(() => routeType())
  const [directory, setDirectory] = useState(null)

  useEffect(() => {
    const routeChanged = () => setRecordType(routeType())
    window.addEventListener('popstate', routeChanged)
    window.addEventListener('hi5-routechange', routeChanged)
    return () => {
      window.removeEventListener('popstate', routeChanged)
      window.removeEventListener('hi5-routechange', routeChanged)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setDirectory(null)
    if (!recordType) return () => { cancelled = true }

    fetch(`${API_BASE}/api/v1/assignment/options?recordType=${encodeURIComponent(recordType)}`, {
      credentials: 'include',
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Assignment options could not be loaded.')
        return payload
      })
      .then((payload) => {
        if (!cancelled) setDirectory(payload)
      })
      .catch(() => {
        if (!cancelled) setDirectory({ recordType, teams: [], people: [] })
      })

    return () => { cancelled = true }
  }, [recordType])

  useEffect(() => {
    if (!directory || !recordType) return undefined

    let scheduled = 0
    const scheduleApply = () => {
      window.cancelAnimationFrame(scheduled)
      scheduled = window.requestAnimationFrame(() => applyDirectory(directory))
    }

    const observer = new MutationObserver(scheduleApply)
    observer.observe(document.body, { childList: true, subtree: true })

    const onChange = (event) => {
      const select = event.target
      if (!(select instanceof HTMLSelectElement)) return
      const field = select.closest('label.activity-canvas-field')
      if (!field || fieldLabel(field) !== 'Assignment group') return
      window.setTimeout(() => applyDirectory(directory, { resetInvalid: true }), 0)
    }

    document.addEventListener('change', onChange, true)
    applyDirectory(directory)

    return () => {
      observer.disconnect()
      document.removeEventListener('change', onChange, true)
      window.cancelAnimationFrame(scheduled)
    }
  }, [directory, recordType])

  return null
}

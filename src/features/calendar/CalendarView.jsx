import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Filter,
  FolderKanban,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { CALENDAR_TODAY, calendarEventTypes } from '../../data/calendarData.js'
import './CalendarView.css'

const SOURCE_META = {
  manual: { label: 'Calendar', short: 'Calendar', className: 'source-manual' },
  project: { label: 'Projects', short: 'Project', className: 'source-project' },
  rota: { label: 'Rota', short: 'Rota', className: 'source-rota' },
  change: { label: 'Changes', short: 'Change', className: 'source-change' },
  service: { label: 'Service desk', short: 'Service', className: 'source-service' },
}

const WEEKDAY_LOOKUP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

function pad(value) {
  return String(value).padStart(2, '0')
}

function isoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

function addDays(value, amount) {
  const date = typeof value === 'string' ? parseIsoDate(value) : new Date(value)
  if (!date) return ''
  date.setDate(date.getDate() + amount)
  return isoDate(date)
}

function startOfWeek(value) {
  const date = typeof value === 'string' ? parseIsoDate(value) : new Date(value)
  if (!date) return CALENDAR_TODAY
  const day = date.getDay()
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day))
  return isoDate(date)
}

function startOfMonth(value) {
  const date = typeof value === 'string' ? parseIsoDate(value) : new Date(value)
  if (!date) return CALENDAR_TODAY
  return isoDate(new Date(date.getFullYear(), date.getMonth(), 1))
}

function endOfMonth(value) {
  const date = typeof value === 'string' ? parseIsoDate(value) : new Date(value)
  if (!date) return CALENDAR_TODAY
  return isoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

function formatDate(value, options = {}) {
  const date = typeof value === 'string' ? parseIsoDate(value) : value
  if (!date) return value || ''
  return new Intl.DateTimeFormat('en-GB', options).format(date)
}

function formatRange(start, end) {
  const startDate = parseIsoDate(start)
  const endDate = parseIsoDate(end)
  if (!startDate || !endDate) return ''
  if (startDate.getMonth() === endDate.getMonth()) {
    return `${formatDate(startDate, { day: 'numeric' })}–${formatDate(endDate, { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
  return `${formatDate(startDate, { day: 'numeric', month: 'short' })} – ${formatDate(endDate, { day: 'numeric', month: 'short', year: 'numeric' })}`
}

function parseHi5DateTime(value) {
  if (!value) return null
  const normalized = String(value).replace(' · ', ' ').trim()
  const match = normalized.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/)
  if (!match) return null
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months.findIndex((item) => item.toLowerCase() === match[2].toLowerCase())
  if (month < 0) return null
  const date = new Date(Number(match[3]), month, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0))
  if (Number.isNaN(date.getTime())) return null
  return { date: isoDate(date), time: match[4] ? `${pad(match[4])}:${match[5]}` : '' }
}

function parseSimpleDate(value) {
  if (!value) return null
  const cleaned = String(value).replace(/^Required by\s+/i, '').replace(/^Before\s+/i, '').trim()
  const match = cleaned.match(/^(\d{1,2})\s+([A-Za-z]{3})(?:\s+(\d{4}))?$/)
  if (!match) return null
  return parseHi5DateTime(`${match[1]} ${match[2]} ${match[3] || '2026'}`)?.date || null
}

function parseSla(value) {
  if (!value) return null
  const explicit = String(value).match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{1,2}):(\d{2})$/)
  if (explicit) return parseHi5DateTime(`${explicit[1]} ${explicit[2]} 2026 ${explicit[3]}:${explicit[4]}`)

  const weekday = String(value).match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(\d{1,2}):(\d{2})$/i)
  if (!weekday) return null
  const base = parseIsoDate(CALENDAR_TODAY)
  const wanted = WEEKDAY_LOOKUP[weekday[1].slice(0, 3).toLowerCase()]
  let delta = wanted - base.getDay()
  if (delta < 0) delta += 7
  return { date: addDays(CALENDAR_TODAY, delta), time: `${pad(weekday[2])}:${weekday[3]}` }
}

function compareEvents(a, b) {
  const aKey = `${a.date}T${a.allDay ? '00:00' : a.start || '00:00'}`
  const bKey = `${b.date}T${b.allDay ? '00:00' : b.start || '00:00'}`
  if (aKey !== bKey) return aKey.localeCompare(bKey)
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
  return a.title.localeCompare(b.title)
}

function eventTimeLabel(event) {
  if (event.allDay) return 'All day'
  if (event.start && event.end) return `${event.start}–${event.end}`
  return event.start || 'Time TBC'
}

function personFor(people, personId, fallback = '') {
  return people.find((person) => person.id === personId)?.name || fallback
}

function deriveEvents({ calendarEvents, projects, rotaEntries, tickets, people }) {
  const result = []

  for (const item of calendarEvents) {
    result.push({ ...item, source: 'manual', sourceLabel: 'Calendar', kind: item.type || 'Other', personName: personFor(people, item.personId), readonly: false })
  }

  for (const project of projects) {
    for (const task of project.tasks || []) {
      if (!task.dueDate) continue
      result.push({
        id: `project-task-${project.id}-${task.id}`,
        source: 'project', sourceLabel: 'Project task', kind: 'Project task', title: task.title,
        date: task.dueDate, start: '', end: '', allDay: true, team: project.team,
        personId: task.assigneeId || '', personName: personFor(people, task.assigneeId), status: task.status,
        priority: task.priority, projectId: project.id, projectName: project.name, recordId: task.linkedRecord || '', readonly: true,
      })
    }

    for (const milestone of project.milestones || []) {
      if (!milestone.dueDate) continue
      result.push({
        id: `project-milestone-${project.id}-${milestone.id}`,
        source: 'project', sourceLabel: 'Project milestone', kind: 'Milestone', title: milestone.title,
        date: milestone.dueDate, start: '', end: '', allDay: true, team: project.team,
        personId: project.ownerId || '', personName: personFor(people, project.ownerId), status: milestone.status,
        projectId: project.id, projectName: project.name, readonly: true,
      })
    }

    if (project.targetDate) {
      result.push({
        id: `project-deadline-${project.id}`,
        source: 'project', sourceLabel: 'Project deadline', kind: 'Project deadline', title: `${project.name} target`,
        date: project.targetDate, start: '', end: '', allDay: true, team: project.team,
        personId: project.ownerId || '', personName: personFor(people, project.ownerId), status: project.status,
        priority: project.priority, projectId: project.id, projectName: project.name, readonly: true,
      })
    }
  }

  for (const entry of rotaEntries) {
    const absence = ['Leave', 'Sickness', 'Unavailable'].includes(entry.type)
    const endDate = entry.type === 'On Call' && entry.end && entry.start && entry.end <= entry.start ? addDays(entry.date, 1) : entry.date
    result.push({
      id: `rota-${entry.id}`, source: 'rota', sourceLabel: 'Staff rota', kind: entry.type,
      title: `${entry.type} · ${personFor(people, entry.personId, 'Team member')}`, date: entry.date, endDate,
      start: absence ? '' : entry.start, end: absence ? '' : entry.end, allDay: absence,
      team: people.find((person) => person.id === entry.personId)?.team || '', personId: entry.personId,
      personName: personFor(people, entry.personId), status: entry.status, description: entry.note || '',
      absence, rotaEntryId: entry.id, readonly: true,
    })
  }

  for (const ticket of tickets) {
    if (ticket.type === 'Change') {
      const start = parseHi5DateTime(ticket.plannedStart)
      if (start) {
        const end = parseHi5DateTime(ticket.plannedEnd)
        result.push({
          id: `change-${ticket.id}`, source: 'change', sourceLabel: 'Change window', kind: 'Change window',
          title: `${ticket.id} · ${ticket.title}`, date: start.date, endDate: end?.date || start.date,
          start: start.time, end: end?.time || '', allDay: false, team: ticket.team, personName: ticket.assignee,
          status: ticket.status, priority: ticket.priority, recordId: ticket.id,
          description: ticket.downtime || ticket.description, readonly: true,
        })
      }
      continue
    }

    if (!['Incident', 'Service Request'].includes(ticket.type)) continue
    const sla = parseSla(ticket.sla)
    if (sla) {
      result.push({
        id: `sla-${ticket.id}`, source: 'service', sourceLabel: `${ticket.type} SLA`, kind: 'SLA deadline',
        title: `${ticket.id} · ${ticket.title}`, date: sla.date, start: sla.time, end: '', allDay: !sla.time,
        team: ticket.team, personName: ticket.assignee, status: ticket.status, priority: ticket.priority,
        recordId: ticket.id, description: ticket.nextStep || ticket.description, readonly: true,
      })
    }

    if (ticket.type === 'Service Request') {
      const requiredBy = (ticket.requestInformation || []).find((item) => /required by/i.test(item.label || ''))
      const requiredDate = parseSimpleDate(requiredBy?.value)
      if (requiredDate) {
        result.push({
          id: `request-due-${ticket.id}`, source: 'service', sourceLabel: 'Request due date', kind: 'Request due',
          title: `${ticket.id} · Required by`, date: requiredDate, start: '', end: '', allDay: true,
          team: ticket.team, personName: ticket.assignee, status: ticket.status, priority: ticket.priority,
          recordId: ticket.id, description: ticket.title, readonly: true,
        })
      }
    }
  }

  return result.sort(compareEvents)
}

function detectConflicts(events) {
  const conflicts = new Map()
  const add = (eventId, message) => {
    const current = conflicts.get(eventId) || []
    if (!current.includes(message)) conflicts.set(eventId, [...current, message])
  }

  const absences = events.filter((event) => event.source === 'rota' && event.absence && event.personId)
  for (const absence of absences) {
    for (const event of events) {
      if (event.id === absence.id || event.personId !== absence.personId || event.date !== absence.date) continue
      if (event.source === 'project' || event.source === 'manual') {
        add(event.id, `${absence.personName} is marked ${absence.kind.toLowerCase()} on this date.`)
        add(absence.id, `${event.title} is also scheduled for ${absence.personName}.`)
      }
    }
  }

  const timed = events.filter((event) => event.source !== 'rota' && !event.allDay && event.start && event.end)
  for (let index = 0; index < timed.length; index += 1) {
    const first = timed[index]
    for (let otherIndex = index + 1; otherIndex < timed.length; otherIndex += 1) {
      const second = timed[otherIndex]
      if (first.date !== second.date) continue
      const samePerson = first.personId && second.personId && first.personId === second.personId
      const sameChangeTeam = first.source === 'change' && second.source === 'change' && first.team && first.team === second.team
      if (!samePerson && !sameChangeTeam) continue
      if (first.start < second.end && second.start < first.end) {
        const context = samePerson ? first.personName : first.team
        add(first.id, `Overlaps ${second.title}${context ? ` for ${context}` : ''}.`)
        add(second.id, `Overlaps ${first.title}${context ? ` for ${context}` : ''}.`)
      }
    }
  }

  return conflicts
}

function CalendarEventChip({ event, conflicts, onOpen, compact = false }) {
  const meta = SOURCE_META[event.source]
  const hasConflict = conflicts.has(event.id)
  return (
    <button
      className={`calendar-event-chip ${meta?.className || ''} ${hasConflict ? 'has-conflict' : ''}`}
      onClick={(clickEvent) => { clickEvent.stopPropagation(); onOpen(event) }}
      title={`${eventTimeLabel(event)} · ${event.title}`}
      type="button"
    >
      <i aria-hidden="true" />
      {!compact && <span>{event.allDay ? '' : event.start}</span>}
      <strong>{event.title}</strong>
      {hasConflict && <AlertTriangle aria-label="Scheduling conflict" size={12} />}
    </button>
  )
}

function EventListItem({ event, conflicts, onOpen }) {
  const meta = SOURCE_META[event.source]
  return (
    <button className="calendar-agenda-item" onClick={() => onOpen(event)} type="button">
      <span className={`calendar-source-mark ${meta?.className || ''}`}><i /></span>
      <span className="calendar-agenda-time"><strong>{event.allDay ? 'All day' : event.start || 'TBC'}</strong><small>{meta?.short}</small></span>
      <span className="calendar-agenda-copy"><strong>{event.title}</strong><small>{[event.team, event.personName, event.status].filter(Boolean).join(' · ')}</small></span>
      {conflicts.has(event.id) && <span className="calendar-conflict-pill"><AlertTriangle size={13} />Conflict</span>}
      <ChevronRight size={16} />
    </button>
  )
}

function emptyDraft(date = CALENDAR_TODAY) {
  return { id: '', title: '', date, start: '09:00', end: '09:30', allDay: false, type: 'Meeting', team: 'Service Desk', personId: '', description: '' }
}

function CalendarPanel({ event, draft, onChangeDraft, onClose, onDelete, onEdit, onSave, people, teams, conflicts }) {
  const editing = Boolean(draft)
  if (!event && !draft) return null
  const display = draft || event
  const conflictMessages = event ? conflicts.get(event.id) || [] : []

  return (
    <>
      <button aria-label="Close calendar panel" className="calendar-panel-backdrop" onClick={onClose} type="button" />
      <aside className="calendar-event-panel" aria-label={editing ? 'Calendar event editor' : 'Calendar event details'}>
        <header>
          <div><span className="eyebrow">{editing ? (draft.id ? 'Edit calendar event' : 'New calendar event') : display.sourceLabel}</span><h3>{editing ? (draft.title || 'Untitled event') : display.title}</h3></div>
          <button className="calendar-icon-button" onClick={onClose} type="button"><X size={18} /></button>
        </header>

        {editing ? (
          <form onSubmit={(submitEvent) => { submitEvent.preventDefault(); onSave() }}>
            <label>Title<input autoFocus onChange={(changeEvent) => onChangeDraft({ ...draft, title: changeEvent.target.value })} required value={draft.title} /></label>
            <div className="calendar-form-grid">
              <label>Date<input onChange={(changeEvent) => onChangeDraft({ ...draft, date: changeEvent.target.value })} required type="date" value={draft.date} /></label>
              <label>Type<select onChange={(changeEvent) => onChangeDraft({ ...draft, type: changeEvent.target.value })} value={draft.type}>{calendarEventTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            </div>
            <label className="calendar-check-row"><input checked={draft.allDay} onChange={(changeEvent) => onChangeDraft({ ...draft, allDay: changeEvent.target.checked })} type="checkbox" /><span><strong>All-day event</strong><small>Hide start and end times</small></span></label>
            {!draft.allDay && <div className="calendar-form-grid"><label>Start<input onChange={(changeEvent) => onChangeDraft({ ...draft, start: changeEvent.target.value })} required type="time" value={draft.start} /></label><label>End<input onChange={(changeEvent) => onChangeDraft({ ...draft, end: changeEvent.target.value })} required type="time" value={draft.end} /></label></div>}
            <div className="calendar-form-grid">
              <label>Team<select onChange={(changeEvent) => onChangeDraft({ ...draft, team: changeEvent.target.value })} value={draft.team}><option value="">No team</option>{teams.map((team) => <option key={team.id} value={team.name}>{team.name}</option>)}</select></label>
              <label>Person<select onChange={(changeEvent) => onChangeDraft({ ...draft, personId: changeEvent.target.value })} value={draft.personId}><option value="">No person</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
            </div>
            <label>Notes<textarea onChange={(changeEvent) => onChangeDraft({ ...draft, description: changeEvent.target.value })} placeholder="Agenda, reminder context or useful notes" rows="5" value={draft.description} /></label>
            <div className="calendar-panel-actions">
              {draft.id && <button className="calendar-danger-action" onClick={() => onDelete(draft.id)} type="button"><Trash2 size={15} />Delete</button>}
              <span />
              <button className="calendar-secondary-action" onClick={onClose} type="button">Cancel</button>
              <button className="calendar-primary-action" type="submit">{draft.id ? 'Save changes' : 'Create event'}</button>
            </div>
          </form>
        ) : (
          <div className="calendar-detail-body">
            <div className="calendar-detail-time"><CalendarDays size={18} /><span><strong>{formatDate(event.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong><small>{eventTimeLabel(event)}</small></span></div>
            <dl>
              <div><dt>Source</dt><dd>{event.sourceLabel}</dd></div>
              {event.kind && <div><dt>Type</dt><dd>{event.kind}</dd></div>}
              {event.team && <div><dt>Team</dt><dd>{event.team}</dd></div>}
              {event.personName && <div><dt>Person</dt><dd>{event.personName}</dd></div>}
              {event.status && <div><dt>Status</dt><dd>{event.status}</dd></div>}
              {event.priority && <div><dt>Priority</dt><dd>{event.priority}</dd></div>}
              {event.projectName && <div><dt>Project</dt><dd>{event.projectName}</dd></div>}
              {event.recordId && <div><dt>Record</dt><dd>{event.recordId}</dd></div>}
            </dl>
            {event.description && <section><span className="eyebrow">Details</span><p>{event.description}</p></section>}
            {!!conflictMessages.length && <section className="calendar-detail-warning"><div><AlertTriangle size={17} /><strong>Scheduling conflict</strong></div>{conflictMessages.map((message) => <p key={message}>{message}</p>)}</section>}
            <div className="calendar-panel-actions">
              {event.source === 'manual' && <button className="calendar-secondary-action" onClick={() => onEdit(event)} type="button">Edit event</button>}
              <span />
              {event.projectId && <button className="calendar-primary-action" onClick={() => event.onOpenProject?.()} type="button"><FolderKanban size={15} />Open project</button>}
              {event.recordId && <button className="calendar-primary-action" onClick={() => event.onOpenRecord?.()} type="button">Open {event.recordId}</button>}
              {event.source === 'rota' && <button className="calendar-primary-action" onClick={() => event.onOpenRota?.()} type="button"><Users size={15} />Open rota</button>}
            </div>
          </div>
        )}
      </aside>
    </>
  )
}

export function CalendarView({
  calendarEvents,
  onDeleteCalendarEvent,
  onOpenProject,
  onOpenRecord,
  onOpenRota,
  onSaveCalendarEvent,
  people,
  projects,
  rotaEntries,
  teams,
  tickets,
}) {
  const [view, setView] = useState('month')
  const [selectedDate, setSelectedDate] = useState(CALENDAR_TODAY)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [personFilter, setPersonFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [draft, setDraft] = useState(null)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const allEvents = useMemo(() => deriveEvents({ calendarEvents, projects, rotaEntries, tickets, people }), [calendarEvents, projects, rotaEntries, tickets, people])
  const conflicts = useMemo(() => detectConflicts(allEvents), [allEvents])
  const eventTypes = useMemo(() => [...new Set(allEvents.map((event) => event.kind).filter(Boolean))].sort(), [allEvents])

  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return allEvents.filter((event) => {
      if (sourceFilter !== 'all' && event.source !== sourceFilter) return false
      if (teamFilter !== 'all' && event.team !== teamFilter) return false
      if (personFilter !== 'all' && event.personId !== personFilter && event.personName !== personFor(people, personFilter)) return false
      if (typeFilter !== 'all' && event.kind !== typeFilter) return false
      if (needle && ![event.title, event.sourceLabel, event.team, event.personName, event.status, event.priority, event.projectName, event.recordId].filter(Boolean).join(' ').toLowerCase().includes(needle)) return false
      return true
    })
  }, [allEvents, sourceFilter, teamFilter, personFilter, typeFilter, query, people])

  const activeFilterCount = [sourceFilter, teamFilter, personFilter, typeFilter].filter((value) => value !== 'all').length
  const visibleConflictCount = new Set(filteredEvents.filter((event) => conflicts.has(event.id)).map((event) => event.id)).size

  const period = useMemo(() => {
    if (view === 'month') {
      const monthStart = startOfMonth(selectedDate)
      const monthEnd = endOfMonth(selectedDate)
      const gridStart = startOfWeek(monthStart)
      const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
      return { start: monthStart, end: monthEnd, days }
    }
    if (view === 'week') {
      const start = startOfWeek(selectedDate)
      return { start, end: addDays(start, 6), days: Array.from({ length: 7 }, (_, index) => addDays(start, index)) }
    }
    if (view === 'day') return { start: selectedDate, end: selectedDate, days: [selectedDate] }
    return { start: selectedDate, end: addDays(selectedDate, 30), days: [] }
  }, [selectedDate, view])

  const eventsByDate = useMemo(() => {
    const grouped = new Map()
    for (const event of filteredEvents) {
      const bucket = grouped.get(event.date) || []
      bucket.push(event)
      grouped.set(event.date, bucket.sort(compareEvents))
    }
    return grouped
  }, [filteredEvents])

  const periodEvents = filteredEvents.filter((event) => event.date >= period.start && event.date <= period.end)
  const sourceCounts = useMemo(() => Object.keys(SOURCE_META).reduce((acc, source) => ({ ...acc, [source]: allEvents.filter((event) => event.source === source).length }), {}), [allEvents])

  function periodLabel() {
    if (view === 'month') return formatDate(selectedDate, { month: 'long', year: 'numeric' })
    if (view === 'day') return formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    if (view === 'week') return formatRange(period.start, period.end)
    return `From ${formatDate(selectedDate, { day: 'numeric', month: 'long', year: 'numeric' })}`
  }

  function movePeriod(direction) {
    if (view === 'month') {
      const current = parseIsoDate(selectedDate)
      current.setMonth(current.getMonth() + direction, 1)
      setSelectedDate(isoDate(current))
      return
    }
    setSelectedDate(addDays(selectedDate, direction * (view === 'week' ? 7 : view === 'agenda' ? 30 : 1)))
  }

  function openEvent(event) {
    setDraft(null)
    setSelectedEvent({
      ...event,
      onOpenProject: event.projectId ? () => onOpenProject(event.projectId) : undefined,
      onOpenRecord: event.recordId ? () => onOpenRecord(event.recordId) : undefined,
      onOpenRota: event.source === 'rota' ? onOpenRota : undefined,
    })
  }

  function createEvent(date = selectedDate) {
    setSelectedEvent(null)
    setDraft(emptyDraft(date))
  }

  function editEvent(event) {
    const source = calendarEvents.find((item) => item.id === event.id)
    if (!source) return
    setSelectedEvent(null)
    setDraft({ ...source })
  }

  function saveDraft() {
    if (!draft?.title.trim() || !draft.date) return
    if (!draft.allDay && draft.end && draft.start && draft.end <= draft.start) return
    onSaveCalendarEvent({ ...draft, title: draft.title.trim(), start: draft.allDay ? '' : draft.start, end: draft.allDay ? '' : draft.end })
    setDraft(null)
  }

  function deleteDraft(id) {
    onDeleteCalendarEvent(id)
    setDraft(null)
    setSelectedEvent(null)
  }

  function clearFilters() {
    setSourceFilter('all')
    setTeamFilter('all')
    setPersonFilter('all')
    setTypeFilter('all')
    setQuery('')
  }

  return (
    <div className="calendar-view">
      <header className="calendar-page-header">
        <div><span className="eyebrow">Planning</span><h2>Unified Calendar</h2><p>One schedule for delivery work, staff availability, change windows, service deadlines and team events.</p></div>
        <button className="calendar-primary-action calendar-new-event" onClick={() => createEvent()} type="button"><Plus size={16} />New event</button>
      </header>

      <section className="calendar-kpi-strip" aria-label="Calendar summary">
        <article><span>Visible schedule</span><strong>{periodEvents.length}</strong><small>{view === 'agenda' ? 'next 31 days' : view}</small></article>
        <article><span>Project dates</span><strong>{sourceCounts.project || 0}</strong><small>tasks, milestones & targets</small></article>
        <article><span>Rota entries</span><strong>{sourceCounts.rota || 0}</strong><small>shifts, leave & on call</small></article>
        <article className={visibleConflictCount ? 'needs-attention' : ''}><span>Conflicts</span><strong>{visibleConflictCount}</strong><small>{visibleConflictCount ? 'visible scheduling warnings' : 'no visible clashes'}</small></article>
      </section>

      <section className="calendar-toolbar">
        <div className="calendar-period-nav">
          <button aria-label="Previous period" onClick={() => movePeriod(-1)} type="button"><ChevronLeft size={17} /></button>
          <button className="calendar-today-button" onClick={() => setSelectedDate(CALENDAR_TODAY)} type="button">Today</button>
          <button aria-label="Next period" onClick={() => movePeriod(1)} type="button"><ChevronRight size={17} /></button>
          <strong>{periodLabel()}</strong>
        </div>
        <div className="calendar-view-switch" aria-label="Calendar view">
          {['month', 'week', 'day', 'agenda'].map((item) => <button className={view === item ? 'active' : ''} key={item} onClick={() => setView(item)} type="button">{item[0].toUpperCase() + item.slice(1)}</button>)}
        </div>
        <button className={`calendar-filter-toggle ${activeFilterCount ? 'active' : ''}`} onClick={() => setMobileFiltersOpen((value) => !value)} type="button"><Filter size={15} />Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}</button>
      </section>

      <section className={`calendar-filter-bar ${mobileFiltersOpen ? 'mobile-open' : ''}`}>
        <label className="calendar-search"><Search size={15} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search schedule" value={query} /></label>
        <label><span>Source</span><select onChange={(event) => setSourceFilter(event.target.value)} value={sourceFilter}><option value="all">All sources</option>{Object.entries(SOURCE_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}</select></label>
        <label><span>Team</span><select onChange={(event) => setTeamFilter(event.target.value)} value={teamFilter}><option value="all">All teams</option>{teams.map((team) => <option key={team.id} value={team.name}>{team.name}</option>)}</select></label>
        <label><span>Person</span><select onChange={(event) => setPersonFilter(event.target.value)} value={personFilter}><option value="all">All people</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <label><span>Type</span><select onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}><option value="all">All types</option>{eventTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        {(activeFilterCount || query) && <button className="calendar-clear-filters" onClick={clearFilters} type="button">Clear</button>}
      </section>

      <div className="calendar-source-legend">
        {Object.entries(SOURCE_META).map(([id, meta]) => <button className={sourceFilter === id ? 'active' : ''} key={id} onClick={() => setSourceFilter(sourceFilter === id ? 'all' : id)} type="button"><span className={`calendar-source-mark ${meta.className}`}><i /></span>{meta.label}<small>{sourceCounts[id] || 0}</small></button>)}
      </div>

      {view === 'month' && (
        <section className="calendar-month-shell">
          <div className="calendar-weekday-row">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-month-grid">
            {period.days.map((date) => {
              const dateEvents = eventsByDate.get(date) || []
              const inMonth = date >= period.start && date <= period.end
              return (
                <div className={`calendar-month-day ${inMonth ? '' : 'outside-month'} ${date === CALENDAR_TODAY ? 'is-today' : ''} ${date === selectedDate ? 'is-selected' : ''}`} key={date}>
                  <button className="calendar-day-add-target" aria-label={`Add event on ${date}`} onClick={() => { setSelectedDate(date); createEvent(date) }} type="button" />
                  <span className="calendar-day-number">{formatDate(date, { day: 'numeric' })}<small>{formatDate(date, { month: 'short' })}</small></span>
                  <div className="calendar-day-events">{dateEvents.slice(0, 4).map((event) => <CalendarEventChip conflicts={conflicts} event={event} key={event.id} onOpen={openEvent} />)}{dateEvents.length > 4 && <span className="calendar-more-events">+{dateEvents.length - 4} more</span>}</div>
                </div>
              )
            })}
          </div>
          <div className="calendar-mobile-month-list">
            {period.days.filter((date) => date >= period.start && date <= period.end && (eventsByDate.get(date) || []).length).map((date) => <section key={date}><header><strong>{formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}</strong><button onClick={() => createEvent(date)} type="button"><Plus size={14} />Add</button></header>{(eventsByDate.get(date) || []).map((event) => <EventListItem conflicts={conflicts} event={event} key={event.id} onOpen={openEvent} />)}</section>)}
            {!periodEvents.length && <div className="calendar-empty-state"><CalendarRange size={26} /><strong>No events in this month</strong><span>Adjust the filters or add a calendar event.</span></div>}
          </div>
        </section>
      )}

      {view === 'week' && (
        <section className="calendar-week-shell">
          <div className="calendar-week-grid">
            {period.days.map((date) => <section className={date === CALENDAR_TODAY ? 'is-today' : ''} key={date}><header><span>{formatDate(date, { weekday: 'short' })}</span><strong>{formatDate(date, { day: 'numeric', month: 'short' })}</strong><button aria-label={`Add event on ${date}`} onClick={() => createEvent(date)} type="button"><Plus size={14} /></button></header><div>{(eventsByDate.get(date) || []).map((event) => <CalendarEventChip compact conflicts={conflicts} event={event} key={event.id} onOpen={openEvent} />)}{!(eventsByDate.get(date) || []).length && <span className="calendar-no-events">No events</span>}</div></section>)}
          </div>
          <div className="calendar-mobile-days">{period.days.map((date) => <section key={date}><header><strong>{formatDate(date, { weekday: 'long', day: 'numeric', month: 'short' })}</strong><button onClick={() => createEvent(date)} type="button"><Plus size={14} />Add</button></header>{(eventsByDate.get(date) || []).map((event) => <EventListItem conflicts={conflicts} event={event} key={event.id} onOpen={openEvent} />)}{!(eventsByDate.get(date) || []).length && <div className="calendar-mobile-empty">No events</div>}</section>)}</div>
        </section>
      )}

      {view === 'day' && (
        <section className="calendar-day-shell">
          <header><div><span className="eyebrow">Day schedule</span><h3>{formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })}</h3></div><button className="calendar-secondary-action" onClick={() => createEvent(selectedDate)} type="button"><Plus size={15} />Add event</button></header>
          <div className="calendar-day-agenda">{(eventsByDate.get(selectedDate) || []).map((event) => <EventListItem conflicts={conflicts} event={event} key={event.id} onOpen={openEvent} />)}{!(eventsByDate.get(selectedDate) || []).length && <div className="calendar-empty-state"><Clock3 size={26} /><strong>Nothing scheduled</strong><span>Add a meeting, reminder or focus block for this day.</span></div>}</div>
        </section>
      )}

      {view === 'agenda' && (
        <section className="calendar-agenda-shell">
          <header><div><span className="eyebrow">Agenda</span><h3>Next 31 days</h3></div><span>{periodEvents.length} visible event{periodEvents.length === 1 ? '' : 's'}</span></header>
          <div>{Array.from(new Set(periodEvents.map((event) => event.date))).map((date) => <section className="calendar-agenda-day" key={date}><header><strong>{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</strong>{date === CALENDAR_TODAY && <span>Today</span>}</header>{(eventsByDate.get(date) || []).map((event) => <EventListItem conflicts={conflicts} event={event} key={event.id} onOpen={openEvent} />)}</section>)}{!periodEvents.length && <div className="calendar-empty-state"><CircleDot size={26} /><strong>No matching events</strong><span>Adjust the filters or add a calendar event.</span></div>}</div>
        </section>
      )}

      <CalendarPanel conflicts={conflicts} draft={draft} event={selectedEvent} onChangeDraft={setDraft} onClose={() => { setDraft(null); setSelectedEvent(null) }} onDelete={deleteDraft} onEdit={editEvent} onSave={saveDraft} people={people} teams={teams} />
    </div>
  )
}

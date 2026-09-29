import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Headphones,
  Plus,
  RefreshCcw,
  Trash2,
  UserRoundCheck,
  Users,
  X,
} from 'lucide-react'
import {
  ROTA_TODAY,
  ROTA_WEEK_START,
  rotaCoverageRules,
  rotaEntryTypes,
} from '../../data/rotaData.js'
import './RotaView.css'

const TYPE_BY_ID = new Map(rotaEntryTypes.map((type) => [type.id, type]))
const TYPE_ORDER = new Map(rotaEntryTypes.map((type, index) => [type.id, index]))

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function parseIsoDate(value) {
  const [year, month, day] = String(value).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12))
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(value, amount) {
  const date = parseIsoDate(value)
  date.setUTCDate(date.getUTCDate() + amount)
  return isoDate(date)
}

function weekDaysFrom(start) {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

function formatDate(value, options) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options }).format(parseIsoDate(value))
}

function formatWeekRange(start) {
  const end = addDays(start, 6)
  const sameMonth = start.slice(0, 7) === end.slice(0, 7)
  const first = formatDate(start, { day: 'numeric', month: sameMonth ? undefined : 'short' })
  const last = formatDate(end, { day: 'numeric', month: 'short', year: 'numeric' })
  return `${first} – ${last}`
}

function personById(people, id) {
  return people.find((person) => person.id === id)
}

function entryHours(entry) {
  return TYPE_BY_ID.get(entry.type)?.capacityHours || 0
}

function entriesForPersonDate(entries, personId, date) {
  return entries
    .filter((entry) => entry.personId === personId && entry.date === date)
    .sort((a, b) => (TYPE_ORDER.get(a.type) ?? 99) - (TYPE_ORDER.get(b.type) ?? 99))
}

function buildCoverageGaps(entries, dates, team, people) {
  const rule = rotaCoverageRules[team]
  if (!rule) return []
  const teamIds = new Set(people.filter((person) => person.team === team).map((person) => person.id))

  return dates.flatMap((date, index) => {
    const required = index < 5 ? rule.weekday : rule.weekend
    return required
      .filter((type) => !entries.some((entry) => (
        entry.date === date && entry.type === type && teamIds.has(entry.personId)
      )))
      .map((type) => ({ date, type }))
  })
}

function RotaAvatar({ person }) {
  return (
    <span className={`rota-avatar tone-${person?.tone || 'slate'}`} title={person?.name || 'Unassigned'}>
      {person?.initials || '—'}
    </span>
  )
}

function RotaEntryChip({ entry, onClick, people }) {
  const preset = TYPE_BY_ID.get(entry.type)
  const coverFor = personById(people, entry.coverForId)
  const time = preset?.category === 'absence'
    ? 'All day'
    : `${entry.start || preset?.start || '—'}–${entry.end || preset?.end || '—'}`

  return (
    <button
      aria-label={`Edit ${entry.type} for ${personById(people, entry.personId)?.name || 'team member'}`}
      className={`rota-entry-chip type-${slug(entry.type)} ${entry.isOverride ? 'is-override' : ''} ${entry.status === 'Draft' ? 'is-draft' : ''}`}
      onClick={onClick}
      type="button"
    >
      <span><i />{preset?.label || entry.type}{entry.isOverride && <RefreshCcw size={11} />}</span>
      <small>{time}</small>
      {coverFor && <em>Covering {coverFor.name.split(' ')[0]}</em>}
    </button>
  )
}

function RotaEntryPanel({ entry, initialValues, onClose, onDelete, onSave, people }) {
  const initialType = entry?.type || initialValues.type || 'Standard'
  const preset = TYPE_BY_ID.get(initialType)
  const [draft, setDraft] = useState({
    id: entry?.id || '',
    personId: entry?.personId || initialValues.personId || people[0]?.id || '',
    date: entry?.date || initialValues.date || ROTA_TODAY,
    type: initialType,
    start: entry?.start ?? preset?.start ?? '',
    end: entry?.end ?? preset?.end ?? '',
    status: entry?.status || 'Confirmed',
    isOverride: entry?.isOverride || false,
    coverForId: entry?.coverForId || '',
    note: entry?.note || '',
  })
  const selectedType = TYPE_BY_ID.get(draft.type)
  const isAbsence = selectedType?.category === 'absence'

  const changeType = (type) => {
    const nextPreset = TYPE_BY_ID.get(type)
    setDraft((current) => ({
      ...current,
      type,
      start: nextPreset?.start || '',
      end: nextPreset?.end || '',
    }))
  }

  const submit = (event) => {
    event.preventDefault()
    if (!draft.personId || !draft.date) return
    onSave({
      ...draft,
      start: isAbsence ? '' : draft.start,
      end: isAbsence ? '' : draft.end,
      coverForId: draft.isOverride ? draft.coverForId : '',
      note: draft.note.trim(),
    })
    onClose()
  }

  const remove = () => {
    if (!entry || !window.confirm(`Remove this ${entry.type.toLowerCase()} entry?`)) return
    onDelete(entry.id)
    onClose()
  }

  return (
    <>
      <button aria-label="Close rota entry" className="rota-panel-backdrop" onClick={onClose} type="button" />
      <aside aria-label={entry ? 'Edit rota entry' : 'Add rota entry'} className="rota-entry-panel">
        <header>
          <div><span className="eyebrow">Rota & Availability</span><h2>{entry ? 'Edit entry' : 'Add entry'}</h2></div>
          <button aria-label="Close" onClick={onClose} type="button"><X size={18} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="rota-form-grid">
            <label className="span-two">Team member<select autoFocus={!entry} onChange={(event) => setDraft({ ...draft, personId: event.target.value })} value={draft.personId}>{people.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.team}</option>)}</select></label>
            <label>Date<input onChange={(event) => setDraft({ ...draft, date: event.target.value })} type="date" value={draft.date} /></label>
            <label>Entry type<select onChange={(event) => changeType(event.target.value)} value={draft.type}>{rotaEntryTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
            {!isAbsence && <>
              <label>Start time<input onChange={(event) => setDraft({ ...draft, start: event.target.value })} type="time" value={draft.start} /></label>
              <label>End time<input onChange={(event) => setDraft({ ...draft, end: event.target.value })} type="time" value={draft.end} /></label>
            </>}
            <label className="span-two">Status<select onChange={(event) => setDraft({ ...draft, status: event.target.value })} value={draft.status}><option>Confirmed</option><option>Draft</option></select></label>
          </div>

          <label className="rota-override-toggle">
            <input checked={draft.isOverride} onChange={(event) => setDraft({ ...draft, isOverride: event.target.checked })} type="checkbox" />
            <span><strong>Temporary cover / shift override</strong><small>Show that this entry replaces another team member’s normal cover.</small></span>
          </label>

          {draft.isOverride && (
            <label>Covering for<select onChange={(event) => setDraft({ ...draft, coverForId: event.target.value })} value={draft.coverForId}><option value="">Select team member</option>{people.filter((person) => person.id !== draft.personId).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
          )}

          <label>Notes<textarea onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Handover, cover reason or availability detail" rows="4" value={draft.note} /></label>
          {draft.type === 'On Call' && <p className="rota-form-hint"><Headphones size={14} />On-call times may run overnight into the following day.</p>}

          <div className="rota-panel-actions">
            {entry ? <button className="danger-action" onClick={remove} type="button"><Trash2 size={15} />Remove</button> : <span />}
            <div><button onClick={onClose} type="button">Cancel</button><button className="primary-action compact" type="submit">{entry ? 'Save changes' : 'Add entry'}</button></div>
          </div>
        </form>
      </aside>
    </>
  )
}

export function RotaView({ entries, onCopyEntries, onDeleteEntry, onSaveEntry, people, teams }) {
  const eligibleTeams = useMemo(() => teams, [teams])
  const [selectedTeam, setSelectedTeam] = useState(
    eligibleTeams.some((team) => team.name === 'Service Desk') ? 'Service Desk' : eligibleTeams[0]?.name,
  )
  const [weekStart, setWeekStart] = useState(ROTA_WEEK_START)
  const [editor, setEditor] = useState(null)
  const [notice, setNotice] = useState('')

  const weekDays = useMemo(() => weekDaysFrom(weekStart), [weekStart])
  const teamPeople = useMemo(
    () => people.filter((person) => person.team === selectedTeam),
    [people, selectedTeam],
  )
  const teamIds = useMemo(() => new Set(teamPeople.map((person) => person.id)), [teamPeople])
  const weekEntries = useMemo(
    () => entries.filter((entry) => teamIds.has(entry.personId) && weekDays.includes(entry.date)),
    [entries, teamIds, weekDays],
  )
  const gaps = useMemo(
    () => buildCoverageGaps(entries, weekDays, selectedTeam, people),
    [entries, people, selectedTeam, weekDays],
  )
  const gapsByDate = useMemo(() => gaps.reduce((map, gap) => {
    const current = map.get(gap.date) || []
    map.set(gap.date, [...current, gap.type])
    return map
  }, new Map()), [gaps])

  const scheduledHours = weekEntries.reduce((total, entry) => total + entryHours(entry), 0)
  const availableHours = teamPeople.reduce((total, person) => total + person.capacityHours, 0)
  const capacityPercent = availableHours ? Math.round((scheduledHours / availableHours) * 100) : 0
  const absenceEntries = weekEntries.filter((entry) => TYPE_BY_ID.get(entry.type)?.category === 'absence')
  const onCallEntries = weekEntries.filter((entry) => entry.type === 'On Call')
  const currentOnCall = onCallEntries.find((entry) => entry.date === ROTA_TODAY)
    || onCallEntries.find((entry) => entry.date >= ROTA_TODAY)
    || onCallEntries[0]
  const currentOnCallPerson = personById(people, currentOnCall?.personId)

  const openAdd = (values = {}) => {
    setEditor({
      entry: null,
      initialValues: {
        date: values.date || weekDays[0],
        type: values.type || 'Standard',
        personId: values.personId || teamPeople[0]?.id || '',
      },
    })
  }

  const openGap = (gap) => {
    const available = teamPeople
      .filter((person) => !entriesForPersonDate(weekEntries, person.id, gap.date).some((entry) => TYPE_BY_ID.get(entry.type)?.category === 'absence'))
      .sort((a, b) => {
        const aHours = weekEntries.filter((entry) => entry.personId === a.id).reduce((total, entry) => total + entryHours(entry), 0)
        const bHours = weekEntries.filter((entry) => entry.personId === b.id).reduce((total, entry) => total + entryHours(entry), 0)
        return aHours - bHours
      })[0]
    openAdd({ date: gap.date, type: gap.type, personId: available?.id })
  }

  const copyPreviousWeek = () => {
    const sourceStart = addDays(weekStart, -7)
    const sourceDays = weekDaysFrom(sourceStart)
    const source = entries.filter((entry) => teamIds.has(entry.personId) && sourceDays.includes(entry.date))
    if (!source.length) {
      setNotice(`No ${selectedTeam} entries were found in the previous week.`)
      return
    }

    const occupied = new Set(weekEntries.map((entry) => `${entry.personId}|${entry.date}`))
    const copies = source
      .filter((entry) => !occupied.has(`${entry.personId}|${addDays(entry.date, 7)}`))
      .map((entry) => ({
        ...entry,
        id: '',
        date: addDays(entry.date, 7),
        isOverride: false,
        coverForId: '',
        note: '',
      }))

    if (!copies.length) {
      setNotice('Every team-member day in this week already has an entry, so nothing was copied.')
      return
    }
    if (weekEntries.length && !window.confirm(`Copy ${copies.length} entries into open days? Existing entries will stay unchanged.`)) return
    onCopyEntries(copies)
    setNotice(`${copies.length} entries copied from ${formatWeekRange(sourceStart)}. Existing days were preserved.`)
  }

  return (
    <div className="rota-view">
      <header className="rota-page-header">
        <div><span className="eyebrow">Planning & Delivery</span><h2>Staff Rota & Availability</h2><p>Plan service coverage, on-call duty and team availability without payroll or clock-in complexity.</p></div>
        <div className="rota-header-actions">
          <label><span>Team</span><select onChange={(event) => setSelectedTeam(event.target.value)} value={selectedTeam}>{eligibleTeams.map((team) => <option key={team.id}>{team.name}</option>)}</select></label>
          <div className="rota-week-picker" aria-label="Select rota week">
            <button aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))} type="button"><ChevronLeft size={17} /></button>
            <button className="rota-week-label" onClick={() => setWeekStart(ROTA_WEEK_START)} type="button"><CalendarDays size={15} /><span><small>Week of</small><strong>{formatWeekRange(weekStart)}</strong></span></button>
            <button aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))} type="button"><ChevronRight size={17} /></button>
          </div>
          <button className="rota-secondary-action" onClick={copyPreviousWeek} type="button"><Copy size={15} />Copy previous week</button>
          <button className="primary-action compact" onClick={() => openAdd()} type="button"><Plus size={16} />Add entry</button>
        </div>
      </header>

      {notice && <div className="rota-notice" role="status"><CalendarCheck2 size={16} /><span>{notice}</span><button aria-label="Dismiss" onClick={() => setNotice('')} type="button"><X size={15} /></button></div>}

      <section aria-label="Rota summary" className="rota-kpi-strip">
        <article><span>Scheduled capacity</span><strong>{scheduledHours}h</strong><small>{capacityPercent}% of {availableHours}h</small></article>
        <article className={gaps.length ? 'needs-attention' : ''}><span>Coverage gaps</span><strong>{gaps.length}</strong><small>{gaps.length ? 'Needs assignment' : 'All required slots covered'}</small></article>
        <article><span>Unavailable</span><strong>{absenceEntries.length}</strong><small>Leave, sickness or blocked days</small></article>
        <article><span>Current on call</span><strong>{currentOnCallPerson?.name || 'Unassigned'}</strong><small>{currentOnCall ? formatDate(currentOnCall.date, { weekday: 'long', day: 'numeric', month: 'short' }) : 'No on-call cover this week'}</small></article>
      </section>

      {gaps.length > 0 && (
        <section aria-label="Coverage warnings" className="rota-coverage-alert">
          <div className="rota-alert-copy"><span><AlertTriangle size={18} /></span><div><strong>{gaps.length} coverage gap{gaps.length === 1 ? '' : 's'} in this week</strong><p>Assign the required shift or on-call cover before publishing the rota.</p></div></div>
          <div className="rota-gap-list">{gaps.map((gap) => <button key={`${gap.date}-${gap.type}`} onClick={() => openGap(gap)} type="button"><span>{formatDate(gap.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span><strong>{gap.type}</strong><Plus size={14} /></button>)}</div>
        </section>
      )}

      <section className="rota-schedule-shell">
        <header>
          <div><span className="eyebrow">Weekly schedule</span><h3>{selectedTeam}</h3></div>
          <div className="rota-legend"><span className="type-early"><i />Early</span><span className="type-standard"><i />Standard</span><span className="type-late"><i />Late</span><span className="type-on-call"><i />On call</span><span className="type-leave"><i />Unavailable</span></div>
        </header>

        <div className="rota-table-wrap">
          <table className="rota-table">
            <thead><tr><th>Team member</th>{weekDays.map((date) => <th className={date === ROTA_TODAY ? 'is-today' : ''} key={date}><span>{formatDate(date, { weekday: 'short' })}</span><strong>{formatDate(date, { day: 'numeric', month: 'short' })}</strong>{gapsByDate.has(date) && <small>{gapsByDate.get(date).join(' · ')} gap</small>}</th>)}</tr></thead>
            <tbody>{teamPeople.map((person) => {
              const personEntries = weekEntries.filter((entry) => entry.personId === person.id)
              const hours = personEntries.reduce((total, entry) => total + entryHours(entry), 0)
              const percent = person.capacityHours ? Math.round((hours / person.capacityHours) * 100) : 0
              return (
                <tr key={person.id}>
                  <th><div className="rota-person"><RotaAvatar person={person} /><span><strong>{person.name}</strong><small>{person.role}</small><span className="rota-capacity-mini"><i><b style={{ width: `${Math.min(percent, 100)}%` }} /></i>{hours}/{person.capacityHours}h</span></span></div></th>
                  {weekDays.map((date) => {
                    const dayEntries = entriesForPersonDate(weekEntries, person.id, date)
                    return <td className={`${date === ROTA_TODAY ? 'is-today' : ''} ${gapsByDate.has(date) ? 'has-team-gap' : ''}`} key={date}><div className="rota-cell-entries">{dayEntries.map((entry) => <RotaEntryChip entry={entry} key={entry.id} onClick={() => setEditor({ entry, initialValues: {} })} people={people} />)}<button aria-label={`Add entry for ${person.name} on ${date}`} className="rota-cell-add" onClick={() => openAdd({ personId: person.id, date })} type="button"><Plus size={14} />Add</button></div></td>
                  })}
                </tr>
              )
            })}</tbody>
          </table>
        </div>

        <div className="rota-mobile-list">{weekDays.map((date) => {
          const dayEntries = weekEntries.filter((entry) => entry.date === date).sort((a, b) => (TYPE_ORDER.get(a.type) ?? 99) - (TYPE_ORDER.get(b.type) ?? 99))
          return <article className={date === ROTA_TODAY ? 'is-today' : ''} key={date}><header><div><span>{formatDate(date, { weekday: 'long' })}</span><strong>{formatDate(date, { day: 'numeric', month: 'long' })}</strong></div>{gapsByDate.has(date) && <small><AlertTriangle size={13} />{gapsByDate.get(date).join(' · ')} gap</small>}</header><div>{dayEntries.length ? dayEntries.map((entry) => { const person = personById(people, entry.personId); return <button className="rota-mobile-entry" key={entry.id} onClick={() => setEditor({ entry, initialValues: {} })} type="button"><RotaAvatar person={person} /><span><strong>{person?.name}</strong><small>{TYPE_BY_ID.get(entry.type)?.label || entry.type}{entry.start ? ` · ${entry.start}–${entry.end}` : ' · All day'}</small>{entry.isOverride && <em>Temporary cover</em>}</span><ChevronRight size={16} /></button> }) : <p>No scheduled entries</p>}</div><button className="rota-mobile-add" onClick={() => openAdd({ date })} type="button"><Plus size={15} />Add entry</button></article>
        })}</div>
      </section>

      <section className="rota-support-grid">
        <article className="rota-oncall-card">
          <header><span><Headphones size={18} /></span><div><strong>On-call coverage</strong><small>Named technician for each day</small></div></header>
          <div>{weekDays.map((date) => {
            const assignments = onCallEntries.filter((entry) => entry.date === date)
            return <button className={date === ROTA_TODAY ? 'is-current' : ''} key={date} onClick={() => assignments[0] ? setEditor({ entry: assignments[0], initialValues: {} }) : openAdd({ date, type: 'On Call' })} type="button"><span><small>{formatDate(date, { weekday: 'short' })}</small><strong>{formatDate(date, { day: 'numeric', month: 'short' })}</strong></span>{assignments.length ? <span className="rota-oncall-person">{assignments.map((entry) => { const person = personById(people, entry.personId); return <span key={entry.id}><RotaAvatar person={person} />{person?.name}</span> })}</span> : <em>Unassigned</em>}<ChevronRight size={15} /></button>
          })}</div>
        </article>

        <article className="rota-capacity-card">
          <header><span><Users size={18} /></span><div><strong>Team capacity</strong><small>Scheduled shift hours against weekly capacity</small></div></header>
          <div>{teamPeople.map((person) => {
            const hours = weekEntries.filter((entry) => entry.personId === person.id).reduce((total, entry) => total + entryHours(entry), 0)
            const percent = person.capacityHours ? Math.round((hours / person.capacityHours) * 100) : 0
            return <div className="rota-capacity-row" key={person.id}><RotaAvatar person={person} /><span><strong>{person.name}<small>{percent}%</small></strong><i><b className={percent > 100 ? 'over' : ''} style={{ width: `${Math.min(percent, 100)}%` }} /></i><em>{hours}h / {person.capacityHours}h</em></span></div>
          })}</div>
          <footer><UserRoundCheck size={15} /><span>On-call duty is shown separately and does not inflate planned delivery capacity.</span></footer>
        </article>
      </section>

      {editor && <RotaEntryPanel entry={editor.entry} initialValues={editor.initialValues} key={editor.entry?.id || `${editor.initialValues.date}-${editor.initialValues.type}-${editor.initialValues.personId}`} onClose={() => setEditor(null)} onDelete={onDeleteEntry} onSave={onSaveEntry} people={teamPeople} />}
    </div>
  )
}

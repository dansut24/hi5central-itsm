import { useMemo, useState } from 'react'
import {
  Building2,
  Check,
  ChevronLeft,
  Clock3,
  Edit3,
  History,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  PlugZap,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { availabilityOptions, organisationLocations } from '../../data/organisationData.js'
import {
  accessProfileFor,
  canCreatePerson,
  canEditPerson,
  canManageDepartment,
  canManageTeam,
  describePeopleScope,
  directorySourceFor,
  editableDepartmentIdsFor,
  hasPeoplePermission,
  isFieldManagedByIntegration,
  peopleAccessProfileOptions,
  peopleEditCapabilities,
} from '../../lib/peopleRbac.js'
import './PeopleView.css'

function initialsFor(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '??'
}

function personTeam(person, teams) {
  return teams.find((team) => team.id === person.teamId) || teams.find((team) => team.name === person.team)
}

function departmentForPerson(person, teams, departments) {
  const team = personTeam(person, teams)
  return departments.find((department) => department.id === team?.departmentId) || departments.find((department) => department.id === person.departmentId)
}

function PersonAvatar({ person, large = false }) {
  return <span className={`org-avatar tone-${person?.tone || 'blue'} ${large ? 'large' : ''}`}>{person?.initials || initialsFor(person?.name)}</span>
}

function Availability({ status }) {
  return <span className={`org-availability status-${String(status || 'offline').toLowerCase().replace(/\s+/g, '-')}`}><i />{status || 'Offline'}</span>
}

function OrgTabs({ active, onChange, counts }) {
  return (
    <div className="org-tabs" role="tablist" aria-label="Organisation sections">
      {[
        ['people', 'People', UserRound, counts.people],
        ['teams', 'Teams', UsersRound, counts.teams],
        ['departments', 'Departments', Building2, counts.departments],
      ].map(([id, label, Icon, count]) => (
        <button className={active === id ? 'active' : ''} key={id} onClick={() => onChange(id)} role="tab" type="button">
          <Icon size={17} /><span>{label}</span><small>{count}</small>
        </button>
      ))}
    </div>
  )
}

function friendlyAuditValue(field, value, people, teams, departments) {
  if (value === 'Not set') return value
  if (field === 'teamId') return teams.find((item) => item.id === value)?.name || value
  if (field === 'departmentId') return departments.find((item) => item.id === value)?.name || value
  if (field === 'managerId' || field === 'leadId') return people.find((item) => item.id === value)?.name || value
  if (field === 'accessProfile') return peopleAccessProfileOptions.find((item) => item.id === value)?.label || value
  return value
}

function SourceBadge({ person }) {
  const source = directorySourceFor(person)
  return (
    <span className={`org-source-badge ${source.external ? 'external' : 'local'}`}>
      <PlugZap size={13} /> {source.label}
    </span>
  )
}

function PersonDrawer({ auditEvents, currentPerson, departments, onClose, onEdit, person, people, teams }) {
  if (!person) return null
  const team = personTeam(person, teams)
  const department = departmentForPerson(person, teams, departments)
  const manager = people.find((item) => item.id === person.managerId)
  const days = Object.entries(person.workingPattern || {}).filter(([, value]) => value?.enabled)
  const capabilities = peopleEditCapabilities(currentPerson, person, teams)
  const source = directorySourceFor(person)
  const accessProfile = accessProfileFor(person)
  const recentAudit = auditEvents.filter((event) => event.entityType === 'person' && event.entityId === person.id).slice(0, 6)

  return (
    <div className="org-drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="org-person-drawer" aria-label={`${person.name} profile`}>
        <header className="org-drawer-header">
          <button className="org-icon-button mobile-back" onClick={onClose} type="button"><ChevronLeft size={20} /></button>
          <div><span className="eyebrow">People directory</span><strong>Person details</strong></div>
          <div className="org-drawer-actions">
            {canEditPerson(currentPerson, person, teams) && <button className="secondary-action compact" onClick={onEdit} type="button"><Edit3 size={16} /> Edit</button>}
            <button className="org-icon-button" onClick={onClose} type="button"><X size={20} /></button>
          </div>
        </header>

        <div className="org-profile-hero">
          <PersonAvatar large person={person} />
          <div><h2>{person.name}</h2><p>{person.role}</p><div className="org-profile-badges"><Availability status={person.status} /><SourceBadge person={person} /></div></div>
        </div>

        <div className="org-profile-facts">
          <div><Mail size={17} /><span>Email</span><strong>{person.email || 'Not set'}</strong></div>
          <div><Phone size={17} /><span>Phone</span><strong>{person.phone || 'Not set'}</strong></div>
          <div><MapPin size={17} /><span>Location</span><strong>{person.location || 'Not set'}</strong></div>
          <div><UsersRound size={17} /><span>Team</span><strong>{team?.name || person.team || 'Unassigned'}</strong></div>
          <div><Building2 size={17} /><span>Department</span><strong>{department?.name || 'Unassigned'}</strong></div>
          <div><ShieldCheck size={17} /><span>Manager</span><strong>{manager?.name || 'No manager'}</strong></div>
          <div><Clock3 size={17} /><span>Weekly capacity</span><strong>{person.capacityHours || 0} hours</strong></div>
          <div><ShieldCheck size={17} /><span>Access role</span><strong>{accessProfile.label}</strong></div>
        </div>

        <section className="org-detail-section org-source-panel">
          <div className="org-section-title"><div><span className="eyebrow">Source of truth</span><h3>{source.label}</h3></div><PlugZap size={18} /></div>
          {source.external ? (
            <>
              <p>This profile is connected to an external directory. Fields owned by the integration are locked in Hi5Central and should be changed at source.</p>
              <div className="org-source-meta">
                <span>Managed fields <strong>{source.managedFields.length || 0}</strong></span>
                {source.lastSyncedAt && <span>Last sync <strong>{new Date(source.lastSyncedAt).toLocaleString()}</strong></span>}
              </div>
            </>
          ) : (
            <p>This profile is managed directly in Hi5Central. When a directory or HR integration owns selected fields, those fields will automatically become read-only here.</p>
          )}
        </section>

        <section className="org-detail-section">
          <div className="org-section-title"><div><span className="eyebrow">Capabilities</span><h3>Skills</h3></div><Sparkles size={18} /></div>
          <div className="org-skill-list">{person.skills?.length ? person.skills.map((skill) => <span key={skill}>{skill}</span>) : <small>No skills recorded</small>}</div>
        </section>

        <section className="org-detail-section">
          <div className="org-section-title"><div><span className="eyebrow">Availability</span><h3>Working pattern</h3></div><Clock3 size={18} /></div>
          <div className="org-working-pattern">
            {days.length ? days.map(([day, value]) => <div key={day}><span>{day.slice(0, 3)}</span><strong>{value.start}–{value.end}</strong></div>) : <small>No working pattern recorded</small>}
          </div>
        </section>

        {capabilities.audit && <section className="org-detail-section">
          <div className="org-section-title"><div><span className="eyebrow">Governance</span><h3>Recent changes</h3></div><History size={18} /></div>
          {recentAudit.length ? <div className="org-audit-list">{recentAudit.map((event) => (
            <article key={event.id}>
              <div><strong>{event.actorName}</strong><span>{new Date(event.at).toLocaleString()}</span></div>
              <p>{event.action === 'created' ? 'Created this person' : `${event.changes.length} field${event.changes.length === 1 ? '' : 's'} updated`}</p>
              {event.changes.slice(0, 3).map((change) => <small key={`${event.id}-${change.field}`}><b>{change.label}:</b> {friendlyAuditValue(change.field, change.from, people, teams, departments)} → {friendlyAuditValue(change.field, change.to, people, teams, departments)}</small>)}
            </article>
          ))}</div> : <p className="org-muted-copy">No profile changes have been recorded yet.</p>}
        </section>}
      </aside>
    </div>
  )
}

function FieldLabel({ children, locked, sourceLabel }) {
  return <span className="org-field-label"><span>{children}</span>{locked && <small><LockKeyhole size={12} /> Managed by {sourceLabel}</small>}</span>
}

function PersonEditor({ actor, departments, onClose, onSave, person, people, teams }) {
  const creating = !person
  const source = directorySourceFor(person)
  const actorProfile = accessProfileFor(actor)
  const capabilities = creating ? {
    basic: hasPeoplePermission(actor, 'people.edit_basic'),
    organisation: hasPeoplePermission(actor, 'people.edit_organisation'),
    access: hasPeoplePermission(actor, 'people.manage_roles'),
  } : peopleEditCapabilities(actor, person, teams)

  const [draft, setDraft] = useState(() => person ? {
    ...person,
    skillsText: (person.skills || []).join(', '),
  } : {
    id: '', name: '', initials: '', email: '', phone: '', role: '', teamId: teams[0]?.id || '', departmentId: departments[0]?.id || '', managerId: '', location: organisationLocations[0], status: 'Available', capacityHours: 35, tone: 'blue', skillsText: '', active: true, accessProfile: 'employee',
    directorySource: { provider: 'local', label: 'Hi5Central', externalId: '', managedFields: [], lastSyncedAt: '' },
  })

  const selectedTeam = teams.find((team) => team.id === draft.teamId)
  const inferredDepartmentId = selectedTeam?.departmentId || draft.departmentId
  const editableDepartmentIds = editableDepartmentIdsFor(actor, departments, teams)
  const allowedTeams = teams.filter((team) => {
    if (team.active === false) return false
    if (actorProfile.scope === 'all') return true
    if (actorProfile.scope === 'department') return editableDepartmentIds.includes(team.departmentId)
    if (actorProfile.scope === 'team') return team.id === actor?.teamId
    return team.id === person?.teamId
  })
  const allowedTeamIds = new Set(allowedTeams.map((team) => team.id))
  const managerCandidates = people.filter((item) => item.id !== draft.id && item.active !== false && (actorProfile.scope === 'all' || allowedTeamIds.has(item.teamId)))

  function managed(field) {
    return !creating && isFieldManagedByIntegration(person, field)
  }

  function disabled(field, capability) {
    return !capabilities[capability] || managed(field)
  }

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function submit(event) {
    event.preventDefault()
    const team = teams.find((item) => item.id === draft.teamId)
    onSave({
      ...draft,
      id: draft.id || `USR-${Date.now()}`,
      initials: draft.initials || initialsFor(draft.name),
      team: team?.name || '',
      departmentId: team?.departmentId || draft.departmentId,
      capacityHours: Number(draft.capacityHours) || 0,
      skills: draft.skillsText.split(',').map((skill) => skill.trim()).filter(Boolean),
      workingPattern: draft.workingPattern || {
        monday: { enabled: true, start: '09:00', end: '17:00' }, tuesday: { enabled: true, start: '09:00', end: '17:00' }, wednesday: { enabled: true, start: '09:00', end: '17:00' }, thursday: { enabled: true, start: '09:00', end: '17:00' }, friday: { enabled: true, start: '09:00', end: '17:00' }, saturday: { enabled: false, start: '', end: '' }, sunday: { enabled: false, start: '', end: '' },
      },
    })
  }

  return (
    <div className="org-drawer-backdrop editor" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="org-editor-drawer">
        <header className="org-drawer-header">
          <button className="org-icon-button mobile-back" onClick={onClose} type="button"><ChevronLeft size={20} /></button>
          <div><span className="eyebrow">{creating ? 'Create' : 'Update'}</span><strong>{creating ? 'New person' : person.name}</strong></div>
          <button className="org-icon-button" onClick={onClose} type="button"><X size={20} /></button>
        </header>
        <form className="org-editor-form" onSubmit={submit}>
          <div className="org-editor-context">
            <ShieldCheck size={18} />
            <div><strong>{creating ? 'Role-based creation' : 'Role-based editing'}</strong><span>Your scope: {describePeopleScope(actor, teams, departments)}. Fields outside your permissions stay read-only.</span></div>
          </div>

          {!creating && <div className={`org-editor-source ${source.external ? 'external' : ''}`}>
            <PlugZap size={18} /><div><strong>{source.label}</strong><span>{source.external ? 'Integration-owned fields are locked and must be changed at source.' : 'Managed directly in Hi5Central.'}</span></div>
          </div>}

          <div className="org-editor-section-heading"><span className="eyebrow">Organisation</span><strong>Employment details</strong></div>
          <div className="org-form-grid two">
            <label><FieldLabel locked={managed('name')} sourceLabel={source.label}>Full name</FieldLabel><input autoFocus={capabilities.organisation} disabled={disabled('name', 'organisation')} required value={draft.name} onChange={(event) => update('name', event.target.value)} /></label>
            <label><FieldLabel locked={managed('email')} sourceLabel={source.label}>Email</FieldLabel><input disabled={disabled('email', 'organisation')} type="email" value={draft.email} onChange={(event) => update('email', event.target.value)} /></label>
          </div>
          <label><FieldLabel locked={managed('role')} sourceLabel={source.label}>Job title</FieldLabel><input disabled={disabled('role', 'organisation')} required value={draft.role} onChange={(event) => update('role', event.target.value)} /></label>
          <div className="org-form-grid two">
            <label><FieldLabel locked={managed('teamId')} sourceLabel={source.label}>Team</FieldLabel><select disabled={disabled('teamId', 'organisation')} value={draft.teamId} onChange={(event) => update('teamId', event.target.value)}>{allowedTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
            <label><span className="org-field-label"><span>Department</span><small>Derived from team</small></span><select disabled value={inferredDepartmentId}>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
          </div>
          <div className="org-form-grid two">
            <label><FieldLabel locked={managed('managerId')} sourceLabel={source.label}>Manager</FieldLabel><select disabled={disabled('managerId', 'organisation')} value={draft.managerId} onChange={(event) => update('managerId', event.target.value)}><option value="">No manager</option>{managerCandidates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label><FieldLabel locked={managed('capacityHours')} sourceLabel={source.label}>Weekly capacity</FieldLabel><input disabled={disabled('capacityHours', 'organisation')} min="0" max="80" type="number" value={draft.capacityHours} onChange={(event) => update('capacityHours', event.target.value)} /></label>
          </div>

          <div className="org-editor-section-heading"><span className="eyebrow">Profile</span><strong>Self-service details</strong></div>
          <div className="org-form-grid two">
            <label><FieldLabel locked={managed('phone')} sourceLabel={source.label}>Phone</FieldLabel><input disabled={disabled('phone', 'basic')} value={draft.phone || ''} onChange={(event) => update('phone', event.target.value)} /></label>
            <label><FieldLabel locked={managed('location')} sourceLabel={source.label}>Location</FieldLabel><select disabled={disabled('location', 'basic')} value={draft.location} onChange={(event) => update('location', event.target.value)}>{organisationLocations.map((location) => <option key={location}>{location}</option>)}</select></label>
          </div>
          <label><FieldLabel locked={managed('status')} sourceLabel={source.label}>Availability</FieldLabel><select disabled={disabled('status', 'basic')} value={draft.status} onChange={(event) => update('status', event.target.value)}>{availabilityOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label><FieldLabel locked={managed('skills')} sourceLabel={source.label}>Skills</FieldLabel><textarea disabled={disabled('skills', 'basic')} rows="4" placeholder="Incident Management, Microsoft 365, Networking" value={draft.skillsText} onChange={(event) => update('skillsText', event.target.value)} /><small>Separate skills with commas.</small></label>

          {capabilities.access && <>
            <div className="org-editor-section-heading"><span className="eyebrow">Security & access</span><strong>Hi5Central role</strong></div>
            <label>Access role<select value={draft.accessProfile || 'employee'} onChange={(event) => update('accessProfile', event.target.value)}>{peopleAccessProfileOptions.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select><small>{peopleAccessProfileOptions.find((profile) => profile.id === draft.accessProfile)?.description}</small></label>
          </>}

          {capabilities.organisation && <label className="org-toggle-row"><input checked={draft.active !== false} disabled={managed('active')} onChange={(event) => update('active', event.target.checked)} type="checkbox" /><span><strong>Active person</strong><small>Inactive people remain available for historical references and administration.</small></span></label>}
          <footer><button className="secondary-action" onClick={onClose} type="button">Cancel</button><button className="primary-action" type="submit"><Check size={17} /> Save person</button></footer>
        </form>
      </aside>
    </div>
  )
}

function EntityEditor({ departments, entity, kind, onClose, onSave, people }) {
  const isTeam = kind === 'team'
  const creating = !entity
  const [draft, setDraft] = useState(() => entity ? { ...entity } : isTeam ? {
    id: '', name: '', leadId: '', departmentId: departments[0]?.id || '', colour: 'blue', description: '', active: true,
  } : { id: '', name: '', leadId: '', description: '', location: 'UK', active: true })

  function submit(event) {
    event.preventDefault()
    onSave({ ...draft, id: draft.id || `${isTeam ? 'TEAM' : 'DEPT'}-${Date.now()}` })
  }

  return (
    <div className="org-drawer-backdrop editor" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="org-editor-drawer small">
        <header className="org-drawer-header"><div><span className="eyebrow">{creating ? 'Create' : 'Update'}</span><strong>{creating ? `New ${kind}` : entity.name}</strong></div><button className="org-icon-button" onClick={onClose} type="button"><X size={20} /></button></header>
        <form className="org-editor-form" onSubmit={submit}>
          <label>Name<input autoFocus required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          {isTeam && <label>Department<select value={draft.departmentId} onChange={(event) => setDraft({ ...draft, departmentId: event.target.value })}>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>}
          <label>{isTeam ? 'Team lead' : 'Department lead'}<select value={draft.leadId} onChange={(event) => setDraft({ ...draft, leadId: event.target.value })}><option value="">Not assigned</option>{people.filter((person) => person.active !== false).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
          <label>Description<textarea rows="4" value={draft.description || ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label className="org-toggle-row"><input checked={draft.active !== false} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} type="checkbox" /><span><strong>Active {kind}</strong><small>Inactive entries remain available for historical records.</small></span></label>
          <footer><button className="secondary-action" onClick={onClose} type="button">Cancel</button><button className="primary-action" type="submit"><Check size={17} /> Save {kind}</button></footer>
        </form>
      </aside>
    </div>
  )
}

export function PeopleView({ auditEvents = [], currentPerson, departments, onSaveDepartment, onSavePerson, onSaveTeam, people, teams }) {
  const [section, setSection] = useState('people')
  const [query, setQuery] = useState('')
  const [teamFilter, setTeamFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [editor, setEditor] = useState(null)

  const visiblePeople = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return people.filter((person) => {
      const team = personTeam(person, teams)
      const department = departmentForPerson(person, teams, departments)
      const searchable = [person.name, person.email, person.role, team?.name, department?.name, person.location, ...(person.skills || [])].join(' ').toLowerCase()
      return (!needle || searchable.includes(needle)) && (teamFilter === 'All' || team?.id === teamFilter) && (statusFilter === 'All' || person.status === statusFilter)
    })
  }, [departments, people, query, statusFilter, teamFilter, teams])

  const selectedPerson = people.find((person) => person.id === selectedPersonId)
  const counts = { people: people.filter((person) => person.active !== false).length, teams: teams.filter((team) => team.active !== false).length, departments: departments.filter((department) => department.active !== false).length }
  const availableCount = people.filter((person) => person.active !== false && person.status === 'Available').length
  const accessProfile = accessProfileFor(currentPerson)

  function canCreateCurrentSection() {
    if (section === 'people') return canCreatePerson(currentPerson)
    if (section === 'teams') return canManageTeam(currentPerson, null, teams)
    return canManageDepartment(currentPerson)
  }

  function startCreate() {
    if (!canCreateCurrentSection()) return
    setEditor(section === 'people' ? { kind: 'person' } : section === 'teams' ? { kind: 'team' } : { kind: 'department' })
  }

  return (
    <div className="organisation-view">
      <div className="organisation-scroll">
        <div className="organisation-content">
          <header className="organisation-header">
            <div><span className="eyebrow">Organisation</span><h1>People, Teams & Departments</h1><p>One governed directory for assignments, availability, project delivery, service routing and future directory/HR integrations.</p></div>
            {canCreateCurrentSection() && <button className="primary-action" onClick={startCreate} type="button"><Plus size={18} /> New {section === 'people' ? 'person' : section === 'teams' ? 'team' : 'department'}</button>}
          </header>

          <div className="org-access-strip">
            <ShieldCheck size={18} />
            <div><strong>{accessProfile.label}</strong><span>{describePeopleScope(currentPerson, teams, departments)} · permissions are applied to edit and administration actions.</span></div>
            <span className="org-access-pill">RBAC active</span>
          </div>

          <div className="org-stat-grid">
            <article><UserRound size={20} /><div><strong>{counts.people}</strong><span>Active people</span></div></article>
            <article><UsersRound size={20} /><div><strong>{counts.teams}</strong><span>Teams</span></div></article>
            <article><Building2 size={20} /><div><strong>{counts.departments}</strong><span>Departments</span></div></article>
            <article><Check size={20} /><div><strong>{availableCount}</strong><span>Available now</span></div></article>
          </div>

          <OrgTabs active={section} counts={counts} onChange={(next) => { setSection(next); setQuery('') }} />

          {section === 'people' && <>
            <section className="org-toolbar">
              <label className="org-search"><Search size={18} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search people, skills, teams or locations" type="search" value={query} /></label>
              <div className="org-filter-row">
                <label><span>Team</span><select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option>All</option>{teams.filter((team) => team.active !== false).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
                <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option>{availabilityOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
              </div>
            </section>

            <div className="org-table-shell">
              <table className="org-people-table">
                <thead><tr><th>Person</th><th>Team / department</th><th>Availability</th><th>Source</th><th>Location</th><th>Skills</th><th></th></tr></thead>
                <tbody>{visiblePeople.map((person) => {
                  const team = personTeam(person, teams)
                  const department = departmentForPerson(person, teams, departments)
                  return <tr key={person.id} onClick={() => setSelectedPersonId(person.id)}>
                    <td><div className="org-person-cell"><PersonAvatar person={person} /><span><strong>{person.name}</strong><small>{person.role}</small></span></div></td>
                    <td><strong>{team?.name || 'Unassigned'}</strong><small>{department?.name || 'No department'}</small></td>
                    <td><Availability status={person.status} /></td>
                    <td><SourceBadge person={person} /></td>
                    <td>{person.location}</td>
                    <td><div className="org-skill-preview">{(person.skills || []).slice(0, 2).map((skill) => <span key={skill}>{skill}</span>)}{(person.skills || []).length > 2 && <small>+{person.skills.length - 2}</small>}</div></td>
                    <td><button className="org-row-action" onClick={(event) => { event.stopPropagation(); setSelectedPersonId(person.id) }} type="button">View</button></td>
                  </tr>
                })}</tbody>
              </table>
              <div className="org-people-cards">{visiblePeople.map((person) => {
                const team = personTeam(person, teams)
                const department = departmentForPerson(person, teams, departments)
                return <button className="org-person-card" key={person.id} onClick={() => setSelectedPersonId(person.id)} type="button"><div><PersonAvatar person={person} /><span><strong>{person.name}</strong><small>{person.role}</small></span></div><div className="org-card-badges"><Availability status={person.status} /><SourceBadge person={person} /></div><dl><div><dt>Team</dt><dd>{team?.name || 'Unassigned'}</dd></div><div><dt>Department</dt><dd>{department?.name || 'Unassigned'}</dd></div><div><dt>Location</dt><dd>{person.location}</dd></div></dl></button>
              })}</div>
              {!visiblePeople.length && <div className="org-empty"><Search size={28} /><strong>No people found</strong><span>Try a different search or filter.</span></div>}
            </div>
          </>}

          {section === 'teams' && <section className="org-entity-grid">{teams.map((team) => {
            const department = departments.find((item) => item.id === team.departmentId)
            const lead = people.find((person) => person.id === team.leadId)
            const members = people.filter((person) => person.teamId === team.id && person.active !== false)
            const manageable = canManageTeam(currentPerson, team, teams)
            return <article className="org-entity-card" key={team.id}><header><span className={`org-entity-icon tone-${team.colour || 'blue'}`}><UsersRound size={20} /></span>{manageable && <button aria-label={`Edit ${team.name}`} className="org-icon-button" onClick={() => setEditor({ kind: 'team', entity: team })} type="button"><Settings2 size={17} /></button>}</header><div><span className="eyebrow">{department?.name || 'No department'}</span><h3>{team.name}</h3><p>{team.description}</p></div><dl><div><dt>Team lead</dt><dd>{lead?.name || 'Not assigned'}</dd></div><div><dt>Members</dt><dd>{members.length}</dd></div><div><dt>Available now</dt><dd>{members.filter((person) => person.status === 'Available').length}</dd></div></dl><footer>{members.slice(0, 5).map((person) => <PersonAvatar key={person.id} person={person} />)}{members.length > 5 && <span>+{members.length - 5}</span>}</footer></article>
          })}</section>}

          {section === 'departments' && <section className="org-entity-grid departments">{departments.map((department) => {
            const lead = people.find((person) => person.id === department.leadId)
            const departmentTeams = teams.filter((team) => team.departmentId === department.id && team.active !== false)
            const memberIds = new Set(departmentTeams.map((team) => team.id))
            const members = people.filter((person) => memberIds.has(person.teamId) && person.active !== false)
            const manageable = canManageDepartment(currentPerson)
            return <article className="org-entity-card department" key={department.id}><header><span className="org-entity-icon tone-slate"><Building2 size={20} /></span>{manageable && <button aria-label={`Edit ${department.name}`} className="org-icon-button" onClick={() => setEditor({ kind: 'department', entity: department })} type="button"><Settings2 size={17} /></button>}</header><div><span className="eyebrow">Department</span><h3>{department.name}</h3><p>{department.description}</p></div><dl><div><dt>Department lead</dt><dd>{lead?.name || 'Not assigned'}</dd></div><div><dt>Teams</dt><dd>{departmentTeams.length}</dd></div><div><dt>People</dt><dd>{members.length}</dd></div></dl><footer className="org-team-tags">{departmentTeams.map((team) => <span key={team.id}>{team.name}</span>)}</footer></article>
          })}</section>}
        </div>
      </div>

      <PersonDrawer auditEvents={auditEvents} currentPerson={currentPerson} departments={departments} onClose={() => setSelectedPersonId('')} onEdit={() => setEditor({ kind: 'person', entity: selectedPerson })} person={selectedPerson} people={people} teams={teams} />
      {editor?.kind === 'person' && <PersonEditor actor={currentPerson} departments={departments} onClose={() => setEditor(null)} onSave={(value) => { onSavePerson(value); setSelectedPersonId(value.id); setEditor(null) }} person={editor.entity} people={people} teams={teams} />}
      {editor?.kind === 'team' && canManageTeam(currentPerson, editor.entity || null, teams) && <EntityEditor
        departments={accessProfile.scope === 'all' ? departments : departments.filter((department) => editableDepartmentIdsFor(currentPerson, departments, teams).includes(department.id))}
        entity={editor.entity}
        kind="team"
        onClose={() => setEditor(null)}
        onSave={(value) => { onSaveTeam(value); setEditor(null) }}
        people={accessProfile.scope === 'all' ? people : people.filter((person) => editableDepartmentIdsFor(currentPerson, departments, teams).includes(departmentForPerson(person, teams, departments)?.id))}
      />}
      {editor?.kind === 'department' && canManageDepartment(currentPerson) && <EntityEditor departments={departments} entity={editor.entity} kind="department" onClose={() => setEditor(null)} onSave={(value) => { onSaveDepartment(value); setEditor(null) }} people={people} />}
    </div>
  )
}

export const peopleAccessProfiles = {
  tenant_admin: {
    id: 'tenant_admin',
    label: 'Tenant Administrator',
    description: 'Full tenant administration, including People security and access roles.',
    scope: 'all',
    permissions: [
      'people.view',
      'people.create',
      'people.edit_basic',
      'people.edit_organisation',
      'people.manage_roles',
      'people.manage_teams',
      'people.manage_departments',
      'people.view_audit',
    ],
  },
  people_admin: {
    id: 'people_admin',
    label: 'People Administrator',
    description: 'Manage people and organisation data without changing security roles.',
    scope: 'all',
    permissions: [
      'people.view',
      'people.create',
      'people.edit_basic',
      'people.edit_organisation',
      'people.manage_teams',
      'people.manage_departments',
      'people.view_audit',
    ],
  },
  department_manager: {
    id: 'department_manager',
    label: 'Department Manager',
    description: 'Manage people and teams within the manager’s own department.',
    scope: 'department',
    permissions: [
      'people.view',
      'people.edit_basic',
      'people.edit_organisation',
      'people.manage_teams',
      'people.view_audit',
    ],
  },
  team_manager: {
    id: 'team_manager',
    label: 'Team Manager',
    description: 'Manage people within the manager’s own team.',
    scope: 'team',
    permissions: [
      'people.view',
      'people.edit_basic',
      'people.edit_organisation',
      'people.view_audit',
    ],
  },
  technician: {
    id: 'technician',
    label: 'Technician',
    description: 'Directory access plus self-service profile updates.',
    scope: 'self',
    permissions: ['people.view', 'people.edit_basic'],
  },
  employee: {
    id: 'employee',
    label: 'Employee',
    description: 'Self-service profile updates only.',
    scope: 'self',
    permissions: ['people.edit_basic'],
  },
}

export const peopleAccessProfileOptions = Object.values(peopleAccessProfiles)


export const directorySourceProviders = {
  local: { id: 'local', label: 'Hi5Central', external: false },
  microsoft_entra: { id: 'microsoft_entra', label: 'Microsoft Entra ID', external: true },
  google_workspace: { id: 'google_workspace', label: 'Google Workspace', external: true },
  hris: { id: 'hris', label: 'HR / People integration', external: true },
  api: { id: 'api', label: 'API integration', external: true },
}

export function directorySourceFor(person) {
  const source = person?.directorySource || {}
  const provider = directorySourceProviders[source.provider] || directorySourceProviders.local
  return {
    ...provider,
    ...source,
    provider: source.provider || provider.id,
    label: source.label || provider.label,
    managedFields: Array.isArray(source.managedFields) ? source.managedFields : [],
  }
}

export function isExternallyManagedPerson(person) {
  return Boolean(directorySourceFor(person).external)
}

export function isFieldManagedByIntegration(person, field) {
  return directorySourceFor(person).managedFields.includes(field)
}

export function accessProfileFor(person) {
  return peopleAccessProfiles[person?.accessProfile] || peopleAccessProfiles.employee
}

export function resolveCurrentPerson(session, people = []) {
  if (!session) return null
  if (session.personId) {
    const matched = people.find((person) => person.id === session.personId)
    if (matched) return matched
  }

  const sessionName = String(session.name || '').trim().toLowerCase()
  const sessionEmail = String(session.username || '').trim().toLowerCase()
  return people.find((person) => {
    const personName = String(person.name || '').trim().toLowerCase()
    const personEmail = String(person.email || '').trim().toLowerCase()
    return (sessionName && personName === sessionName) || (sessionEmail && personEmail === sessionEmail)
  }) || null
}

export function departmentIdForPerson(person, teams = []) {
  if (!person) return ''
  const team = teams.find((item) => item.id === person.teamId)
  return team?.departmentId || person.departmentId || ''
}

export function hasPeoplePermission(actor, permission) {
  return accessProfileFor(actor).permissions.includes(permission)
}

function targetInScope(actor, target, teams = [], scope = accessProfileFor(actor).scope) {
  if (!actor || !target) return false
  if (actor.id === target.id) return true
  if (scope === 'all') return true
  if (scope === 'department') {
    return Boolean(departmentIdForPerson(actor, teams)) && departmentIdForPerson(actor, teams) === departmentIdForPerson(target, teams)
  }
  if (scope === 'team') return Boolean(actor.teamId) && actor.teamId === target.teamId
  return false
}

export function canViewPerson(actor, target, teams = []) {
  if (!target) return false
  if (!actor) return false
  const profile = accessProfileFor(actor)
  if (profile.permissions.includes('people.view')) return true
  return actor.id === target.id
}

export function canEditPersonBasic(actor, target, teams = []) {
  if (!actor || !target || !hasPeoplePermission(actor, 'people.edit_basic')) return false
  return targetInScope(actor, target, teams)
}

export function canEditPersonOrganisation(actor, target, teams = []) {
  if (!actor || !target || !hasPeoplePermission(actor, 'people.edit_organisation')) return false
  return targetInScope(actor, target, teams)
}

export function canManagePersonAccess(actor, target, teams = []) {
  if (!actor || !target || !hasPeoplePermission(actor, 'people.manage_roles')) return false
  return targetInScope(actor, target, teams)
}

export function canCreatePerson(actor) {
  return Boolean(actor && hasPeoplePermission(actor, 'people.create'))
}

export function canViewPersonAudit(actor, target, teams = []) {
  if (!actor || !target) return false
  if (actor.id === target.id) return true
  if (!hasPeoplePermission(actor, 'people.view_audit')) return false
  return targetInScope(actor, target, teams)
}

export function canManageTeam(actor, team, teams = []) {
  if (!actor || !hasPeoplePermission(actor, 'people.manage_teams')) return false
  const profile = accessProfileFor(actor)
  if (profile.scope === 'all') return true
  if (profile.scope === 'department') {
    const actorDepartmentId = departmentIdForPerson(actor, teams)
    return Boolean(actorDepartmentId) && (!team || team.departmentId === actorDepartmentId)
  }
  return false
}

export function canManageDepartment(actor) {
  if (!actor || !hasPeoplePermission(actor, 'people.manage_departments')) return false
  return accessProfileFor(actor).scope === 'all'
}

export function editableDepartmentIdsFor(actor, departments = [], teams = []) {
  if (!actor) return []
  const profile = accessProfileFor(actor)
  if (!hasPeoplePermission(actor, 'people.manage_teams')) return []
  if (profile.scope === 'all') return departments.map((department) => department.id)
  if (profile.scope === 'department') {
    const id = departmentIdForPerson(actor, teams)
    return id ? [id] : []
  }
  return []
}

export function peopleEditCapabilities(actor, target, teams = []) {
  return {
    basic: canEditPersonBasic(actor, target, teams),
    organisation: canEditPersonOrganisation(actor, target, teams),
    access: canManagePersonAccess(actor, target, teams),
    audit: canViewPersonAudit(actor, target, teams),
  }
}

export function canEditPerson(actor, target, teams = []) {
  const capabilities = peopleEditCapabilities(actor, target, teams)
  return capabilities.basic || capabilities.organisation || capabilities.access
}

export function describePeopleScope(actor, teams = [], departments = []) {
  if (!actor) return 'No People access'
  const profile = accessProfileFor(actor)
  if (profile.scope === 'all') return 'All people'
  if (profile.scope === 'department') {
    const departmentId = departmentIdForPerson(actor, teams)
    const department = departments.find((item) => item.id === departmentId)
    return department ? `${department.name} department` : 'Own department'
  }
  if (profile.scope === 'team') {
    const team = teams.find((item) => item.id === actor.teamId)
    return team ? `${team.name} team` : 'Own team'
  }
  return 'Own profile only'
}

const auditFieldLabels = {
  name: 'Full name',
  email: 'Email',
  phone: 'Phone',
  role: 'Job title',
  teamId: 'Team',
  departmentId: 'Department',
  managerId: 'Manager',
  location: 'Location',
  status: 'Availability',
  capacityHours: 'Weekly capacity',
  skills: 'Skills',
  active: 'Account status',
  accessProfile: 'Access role',
  leadId: 'Lead',
  description: 'Description',
  directorySource: 'Directory source',
}

function comparable(value) {
  if (Array.isArray(value)) return value.join(', ')
  if (value === true) return 'Active'
  if (value === false) return 'Inactive'
  if (value === null || value === undefined || value === '') return 'Not set'
  return String(value)
}

export function buildOrganisationAuditEntry({ actor, before, after, entityType, action }) {
  const keys = entityType === 'person'
    ? ['name', 'email', 'phone', 'role', 'teamId', 'departmentId', 'managerId', 'location', 'status', 'capacityHours', 'skills', 'active', 'accessProfile']
    : entityType === 'team'
      ? ['name', 'departmentId', 'leadId', 'description', 'active']
      : ['name', 'leadId', 'description', 'active']

  const changes = before ? keys.flatMap((field) => {
    const from = comparable(before[field])
    const to = comparable(after[field])
    if (from === to) return []
    return [{ field, label: auditFieldLabels[field] || field, from, to }]
  }) : []

  return {
    id: `ORG-AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    entityType,
    entityId: after.id,
    entityName: after.name,
    action: action || (before ? 'updated' : 'created'),
    actorId: actor?.id || '',
    actorName: actor?.name || 'System',
    at: new Date().toISOString(),
    changes,
  }
}

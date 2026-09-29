import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Copy, KeyRound, Plus, Search, ShieldCheck, Users, X } from 'lucide-react'
import './ProductionAccessControl.css'

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
  if (!response.ok) throw new Error(payload.error || 'Access-control request failed.')
  return payload
}

function useRolesRoute() {
  const [active, setActive] = useState(() => window.location.pathname === '/settings/roles-permissions')
  useEffect(() => {
    const update = () => setActive(window.location.pathname === '/settings/roles-permissions')
    window.addEventListener('popstate', update)
    window.addEventListener('hi5-routechange', update)
    const interval = window.setInterval(update, 300)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener('hi5-routechange', update)
      window.clearInterval(interval)
    }
  }, [])
  return active
}

function usePortalTarget(active) {
  const [target, setTarget] = useState(null)
  useEffect(() => {
    if (!active) {
      setTarget(null)
      return undefined
    }
    let mounted = null
    const attach = () => {
      const next = document.querySelector('.production-settings-content')
      if (!(next instanceof HTMLElement)) return false
      mounted = next
      mounted.classList.add('hi5-rbac-mounted')
      setTarget(next)
      return true
    }
    if (attach()) return () => mounted?.classList.remove('hi5-rbac-mounted')
    const observer = new MutationObserver(() => {
      if (attach()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      mounted?.classList.remove('hi5-rbac-mounted')
    }
  }, [active])
  return target
}

function AccessPill({ active, children }) {
  return <span className={`hi5-rbac-access-pill ${active ? 'is-on' : ''}`}>{active ? <Check size={12} /> : <X size={12} />}{children}</span>
}

function RoleBadge({ role }) {
  return (
    <span className={`hi5-rbac-role-badge ${role.isProtected ? 'is-protected' : role.isDefault ? 'is-default' : 'is-custom'}`}>
      {role.isProtected ? 'Protected' : role.isDefault ? 'Default' : 'Custom'}
    </span>
  )
}

function PermissionGroups({ groups, selected, disabled, search, setSelected }) {
  const normalized = search.trim().toLowerCase()
  const filteredGroups = groups.map((group) => ({
    ...group,
    permissions: group.permissions.filter((permission) => !normalized || `${permission.label} ${permission.key} ${permission.group}`.toLowerCase().includes(normalized)),
  })).filter((group) => group.permissions.length)

  function toggle(permission) {
    if (disabled) return
    setSelected((current) => current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission])
  }

  function toggleGroup(group) {
    if (disabled) return
    const keys = group.permissions.map((permission) => permission.key)
    const allSelected = keys.every((key) => selected.includes(key))
    setSelected((current) => allSelected
      ? current.filter((key) => !keys.includes(key))
      : [...new Set([...current, ...keys])])
  }

  return (
    <div className="hi5-rbac-permission-groups">
      {filteredGroups.map((group) => {
        const count = group.permissions.filter((permission) => selected.includes(permission.key)).length
        return (
          <details key={group.group} open={Boolean(normalized)}>
            <summary>
              <span><ChevronDown size={15} /><strong>{group.group}</strong></span>
              <span>{count}/{group.permissions.length}</span>
            </summary>
            <div className="hi5-rbac-permission-list">
              {!disabled ? (
                <button className="hi5-rbac-select-group" type="button" onClick={() => toggleGroup(group)}>
                  {count === group.permissions.length ? 'Clear group' : 'Select group'}
                </button>
              ) : null}
              {group.permissions.map((permission) => (
                <label key={permission.key} className={selected.includes(permission.key) ? 'is-selected' : ''}>
                  <input type="checkbox" checked={selected.includes(permission.key)} disabled={disabled} onChange={() => toggle(permission.key)} />
                  <span><strong>{permission.label}</strong><small>{permission.key}</small></span>
                </label>
              ))}
            </div>
          </details>
        )
      })}
    </div>
  )
}

export function ProductionAccessControl() {
  const active = useRolesRoute()
  const target = usePortalTarget(active)
  const [tab, setTab] = useState('roles')
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [roleDraft, setRoleDraft] = useState(null)
  const [permissionSearch, setPermissionSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [userRoleIds, setUserRoleIds] = useState([])

  async function load() {
    if (!active) return
    setLoading(true)
    setError('')
    try {
      const [catalogPayload, rolePayload, userPayload] = await Promise.all([
        api('/api/v1/access/catalog'),
        api('/api/v1/access/roles'),
        api('/api/v1/access/users'),
      ])
      const nextRoles = rolePayload.roles || []
      const nextUsers = userPayload.users || []
      setGroups(catalogPayload.groups || [])
      setRoles(nextRoles)
      setUsers(nextUsers)
      setSelectedRoleId((current) => current && nextRoles.some((role) => role.id === current) ? current : nextRoles[0]?.id || '')
      setSelectedUserId((current) => current && nextUsers.some((user) => user.id === current) ? current : nextUsers[0]?.id || '')
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [active])

  const selectedRole = roles.find((role) => role.id === selectedRoleId)
  const selectedUser = users.find((user) => user.id === selectedUserId)

  useEffect(() => {
    if (!selectedRole) return
    setRoleDraft({ id: selectedRole.id, name: selectedRole.name, description: selectedRole.description || '', permissions: [...(selectedRole.permissions || [])], existing: true, isProtected: selectedRole.isProtected, isDefault: selectedRole.isDefault })
    setPermissionSearch('')
    setSaved('')
  }, [selectedRoleId, selectedRole?.id])

  useEffect(() => {
    if (!selectedUser) return
    setUserRoleIds([...(selectedUser.roleIds || [])])
    setSaved('')
  }, [selectedUserId, selectedUser?.id])

  const filteredUsers = useMemo(() => {
    const search = userSearch.trim().toLowerCase()
    if (!search) return users
    return users.filter((user) => `${user.name} ${user.email} ${user.jobTitle}`.toLowerCase().includes(search))
  }, [users, userSearch])

  function newRole() {
    setSelectedRoleId('')
    setRoleDraft({ id: '', name: '', description: '', permissions: [], existing: false, isProtected: false, isDefault: false })
    setPermissionSearch('')
    setSaved('')
  }

  function copyRole() {
    if (!selectedRole) return
    setSelectedRoleId('')
    setRoleDraft({ id: '', name: `${selectedRole.name} copy`, description: selectedRole.description || '', permissions: [...(selectedRole.permissions || [])], existing: false, isProtected: false, isDefault: false })
    setSaved('')
  }

  async function saveRole() {
    if (!roleDraft || roleDraft.isProtected) return
    setError('')
    setSaved('')
    try {
      const payload = await api(roleDraft.existing ? `/api/v1/access/roles/${roleDraft.id}` : '/api/v1/access/roles', {
        method: roleDraft.existing ? 'PATCH' : 'POST',
        body: JSON.stringify({ name: roleDraft.name, description: roleDraft.description, permissions: roleDraft.permissions }),
      })
      setSaved('Role saved')
      await load()
      setSelectedRoleId(payload.id)
      window.dispatchEvent(new Event('hi5-access-changed'))
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  function toggleUserRole(roleId) {
    const role = roles.find((item) => item.id === roleId)
    if (!selectedUser || role?.isProtected) return
    setUserRoleIds((current) => current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId])
    setSaved('')
  }

  async function saveUserRoles() {
    if (!selectedUser) return
    setError('')
    setSaved('')
    try {
      const payload = await api(`/api/v1/access/users/${selectedUser.id}/roles`, { method: 'PUT', body: JSON.stringify({ roleIds: userRoleIds }) })
      setSaved('Access updated')
      await load()
      setSelectedUserId(selectedUser.id)
      setUserRoleIds(payload.roleIds || [])
      window.dispatchEvent(new Event('hi5-access-changed'))
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  if (!active || !target) return null

  return createPortal(
    <section className="hi5-rbac-root">
      <header className="hi5-rbac-header">
        <div><span>Access control</span><h2>Roles & permissions</h2><p>Stack simple roles to build precise access. Permissions are additive and effective immediately.</p></div>
        <div className="hi5-rbac-tabs" role="tablist">
          <button className={tab === 'roles' ? 'is-active' : ''} onClick={() => setTab('roles')} type="button"><KeyRound size={16} /> Roles</button>
          <button className={tab === 'users' ? 'is-active' : ''} onClick={() => setTab('users')} type="button"><Users size={16} /> User access</button>
        </div>
      </header>

      {error ? <div className="hi5-rbac-message is-error">{error}</div> : null}
      {saved ? <div className="hi5-rbac-message is-saved"><Check size={14} /> {saved}</div> : null}
      {loading ? <div className="hi5-rbac-loading">Loading access control…</div> : null}

      {!loading && tab === 'roles' ? (
        <div className="hi5-rbac-layout">
          <aside className="hi5-rbac-list">
            <div className="hi5-rbac-list-actions"><strong>Role library</strong><button onClick={newRole} type="button"><Plus size={15} /> New</button></div>
            {roles.map((role) => (
              <button className={selectedRoleId === role.id ? 'is-active' : ''} key={role.id} onClick={() => setSelectedRoleId(role.id)} type="button">
                <span><strong>{role.name}</strong><small>{role.assignedUsers} assigned</small></span><RoleBadge role={role} />
              </button>
            ))}
          </aside>

          <div className="hi5-rbac-editor">
            {roleDraft ? (
              <>
                <div className="hi5-rbac-editor-head">
                  <div><span>{roleDraft.isProtected ? 'Protected role' : roleDraft.isDefault ? 'Default role' : roleDraft.existing ? 'Custom role' : 'New custom role'}</span><h3>{roleDraft.name || 'Untitled role'}</h3></div>
                  <div>{roleDraft.existing && !roleDraft.isProtected ? <button className="secondary" onClick={copyRole} type="button"><Copy size={15} /> Copy</button> : null}{!roleDraft.isProtected ? <button className="primary" onClick={saveRole} type="button"><Check size={15} /> Save role</button> : null}</div>
                </div>
                <div className="hi5-rbac-fields">
                  <label><span>Name</span><input disabled={roleDraft.isProtected} value={roleDraft.name} onChange={(event) => setRoleDraft((current) => ({ ...current, name: event.target.value }))} /></label>
                  <label><span>Description</span><input disabled={roleDraft.isProtected} value={roleDraft.description} onChange={(event) => setRoleDraft((current) => ({ ...current, description: event.target.value }))} /></label>
                </div>
                <div className="hi5-rbac-permissions-head"><div><strong>Permissions</strong><small>{roleDraft.permissions.includes('*') ? 'All permissions' : `${roleDraft.permissions.length} selected`}</small></div><label><Search size={14} /><input placeholder="Find a permission" value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} /></label></div>
                {roleDraft.permissions.includes('*') ? <div className="hi5-rbac-owner-note"><ShieldCheck size={17} /><span>Owner always has unrestricted tenant access and cannot be edited.</span></div> : <PermissionGroups groups={groups} selected={roleDraft.permissions} disabled={roleDraft.isProtected} search={permissionSearch} setSelected={(updater) => setRoleDraft((current) => ({ ...current, permissions: typeof updater === 'function' ? updater(current.permissions) : updater }))} />}
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {!loading && tab === 'users' ? (
        <div className="hi5-rbac-layout hi5-rbac-users-layout">
          <aside className="hi5-rbac-list">
            <label className="hi5-rbac-user-search"><Search size={14} /><input placeholder="Find a user" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} /></label>
            {filteredUsers.map((user) => (
              <button className={selectedUserId === user.id ? 'is-active' : ''} key={user.id} onClick={() => setSelectedUserId(user.id)} type="button">
                <span><strong>{user.name}</strong><small>{user.email}</small></span><span className="hi5-rbac-role-count">{user.roles?.length || 0}</span>
              </button>
            ))}
          </aside>
          <div className="hi5-rbac-editor">
            {selectedUser ? (
              <>
                <div className="hi5-rbac-editor-head"><div><span>User access</span><h3>{selectedUser.name}</h3><p>{selectedUser.email}</p></div><button className="primary" onClick={saveUserRoles} type="button"><Check size={15} /> Save access</button></div>
                <div className="hi5-rbac-effective">
                  <AccessPill active={selectedUser.effective?.workspaceAccess}>Workspace</AccessPill>
                  <AccessPill active={selectedUser.effective?.portalAccess}>Portal</AccessPill>
                  <span>{selectedUser.effective?.permissions?.length || 0} effective permissions</span>
                </div>
                <div className="hi5-rbac-role-grid">
                  {roles.filter((role) => role.active).map((role) => {
                    const checked = userRoleIds.includes(role.id)
                    const ownerLocked = role.isProtected
                    return (
                      <label key={role.id} className={checked ? 'is-selected' : ''}>
                        <input type="checkbox" checked={checked} disabled={ownerLocked} onChange={() => toggleUserRole(role.id)} />
                        <span><strong>{role.name}</strong><small>{role.description}</small></span><RoleBadge role={role} />
                      </label>
                    )
                  })}
                </div>
                <details className="hi5-rbac-effective-list">
                  <summary>Effective permissions <span>{selectedUser.effective?.permissions?.length || 0}</span></summary>
                  <div>{(selectedUser.effective?.permissions || []).map((permission) => <code key={permission}>{permission}</code>)}</div>
                </details>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>,
    target,
  )
}

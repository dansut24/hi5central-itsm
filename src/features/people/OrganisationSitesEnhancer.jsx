import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Building2,
  Check,
  Globe2,
  Link2,
  MapPin,
  Plus,
  Search,
  Server,
  Settings2,
  UsersRound,
  X,
} from 'lucide-react'
import { organisationDepartments, organisationPeople, organisationTeams } from '../../data/organisationData.js'
import { organisationSites, siteTimezones, siteTypes } from '../../data/organisationSites.js'
import { syncOrganisationCollection } from '../../services/runtimeState.js'
import './OrganisationSitesEnhancer.css'

const SITES_STORAGE_KEY = 'hi5central-organisation-sites-v1'

function readJson(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function loadSites() {
  const stored = readJson(SITES_STORAGE_KEY, organisationSites)
  if (!Array.isArray(stored) || !stored.length) return organisationSites
  const seeds = new Map(organisationSites.map((site) => [site.id, site]))
  return stored.map((site) => ({ ...seeds.get(site.id), ...site, rmmSite: { ...(seeds.get(site.id)?.rmmSite || {}), ...(site.rmmSite || {}) } }))
}

function loadOrganisationSnapshot() {
  return {
    people: readJson('hi5central-organisation-people-v1', organisationPeople),
    teams: readJson('hi5central-organisation-teams-v1', organisationTeams),
    departments: readJson('hi5central-organisation-departments-v1', organisationDepartments),
  }
}

function saveSites(sites) {
  window.localStorage.setItem(SITES_STORAGE_KEY, JSON.stringify(sites))
  window.dispatchEvent(new CustomEvent('hi5-organisation-sites-changed', { detail: { sites } }))
  syncOrganisationCollection('sites', sites).catch(() => {})
}

function siteCounts(site, organisation) {
  const people = organisation.people.filter((person) => person.active !== false && person.location === site.name)
  const teamIds = new Set(people.map((person) => person.teamId).filter(Boolean))
  const departmentIds = new Set(
    organisation.teams
      .filter((team) => teamIds.has(team.id))
      .map((team) => team.departmentId)
      .filter(Boolean),
  )
  return { people: people.length, departments: departmentIds.size }
}

function SiteEditor({ organisation, onClose, onSave, site }) {
  const creating = !site
  const [draft, setDraft] = useState(() => site ? { ...site, rmmSite: { ...(site.rmmSite || {}) } } : {
    id: '',
    code: '',
    name: '',
    type: 'Office',
    address1: '',
    city: '',
    postcode: '',
    country: 'United Kingdom',
    timezone: 'Europe/London',
    primaryContactId: '',
    supportTeamId: organisation.teams[0]?.id || '',
    rmmSite: { status: 'not_linked', id: '', label: '' },
    notes: '',
    active: true,
  })

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function submit(event) {
    event.preventDefault()
    const code = String(draft.code || draft.name || 'SITE').toUpperCase().replace(/[^A-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 18) || 'SITE'
    onSave({ ...draft, id: draft.id || `SITE-${Date.now()}`, code })
  }

  const linked = draft.rmmSite?.status === 'linked'

  return (
    <div className="org-site-drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="org-site-drawer" aria-label={creating ? 'New site' : `Edit ${site.name}`}>
        <header>
          <div><span>Organisation</span><strong>{creating ? 'New site' : site.name}</strong></div>
          <button aria-label="Close site editor" onClick={onClose} type="button"><X size={19} /></button>
        </header>
        <form onSubmit={submit}>
          <section>
            <div className="org-site-section-heading"><span>Identity</span><strong>Site details</strong></div>
            <div className="org-site-form-grid two">
              <label>Site name<input autoFocus required value={draft.name} onChange={(event) => update('name', event.target.value)} /></label>
              <label>Site code<input placeholder="LON-HQ" value={draft.code} onChange={(event) => update('code', event.target.value.toUpperCase())} /></label>
            </div>
            <div className="org-site-form-grid two">
              <label>Type<select value={draft.type} onChange={(event) => update('type', event.target.value)}>{siteTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label>Time zone<select value={draft.timezone} onChange={(event) => update('timezone', event.target.value)}>{siteTimezones.map((timezone) => <option key={timezone}>{timezone}</option>)}</select></label>
            </div>
          </section>

          <section>
            <div className="org-site-section-heading"><span>Location</span><strong>Address</strong></div>
            <label>Address<input value={draft.address1} onChange={(event) => update('address1', event.target.value)} /></label>
            <div className="org-site-form-grid two">
              <label>City<input value={draft.city} onChange={(event) => update('city', event.target.value)} /></label>
              <label>Postcode<input value={draft.postcode} onChange={(event) => update('postcode', event.target.value)} /></label>
            </div>
            <label>Country<input value={draft.country} onChange={(event) => update('country', event.target.value)} /></label>
          </section>

          <section>
            <div className="org-site-section-heading"><span>Ownership</span><strong>People & support</strong></div>
            <div className="org-site-form-grid two">
              <label>Primary contact<select value={draft.primaryContactId} onChange={(event) => update('primaryContactId', event.target.value)}><option value="">Not assigned</option>{organisation.people.filter((person) => person.active !== false).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
              <label>Support team<select value={draft.supportTeamId} onChange={(event) => update('supportTeamId', event.target.value)}><option value="">Not assigned</option>{organisation.teams.filter((team) => team.active !== false).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
            </div>
          </section>

          <section>
            <div className="org-site-section-heading"><span>RMM</span><strong>Site linkage</strong></div>
            <div className={`org-site-rmm-link ${linked ? 'is-linked' : ''}`}>
              <Server size={20} />
              <div><strong>{linked ? 'RMM site linked' : 'No RMM site linked'}</strong><span>{linked ? draft.rmmSite?.label || draft.name : 'RMM linkage is managed by the production RMM service and cannot be simulated from the organisation editor.'}</span></div>
              <button disabled type="button">{linked ? 'Managed by RMM' : 'Configure in RMM'}</button>
            </div>
          </section>

          <section>
            <label>Notes<textarea rows="4" value={draft.notes || ''} onChange={(event) => update('notes', event.target.value)} /></label>
            <label className="org-site-toggle"><input checked={draft.active !== false} onChange={(event) => update('active', event.target.checked)} type="checkbox" /><span><strong>Active site</strong><small>Inactive sites remain available for historical records and reporting.</small></span></label>
          </section>

          <footer><button className="secondary-action" onClick={onClose} type="button">Cancel</button><button className="primary-action" type="submit"><Check size={17} /> Save site</button></footer>
        </form>
      </aside>
    </div>
  )
}

export function OrganisationSitesEnhancer() {
  const [sites, setSites] = useState(loadSites)
  const [active, setActive] = useState(false)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [editorSite, setEditorSite] = useState(undefined)
  const [tabHost, setTabHost] = useState(null)
  const [contentHost, setContentHost] = useState(null)
  const [organisationView, setOrganisationView] = useState(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const view = document.querySelector('.organisation-view')
        const tabs = view?.querySelector('.org-tabs') || null
        const content = view?.querySelector('.organisation-content') || null
        setOrganisationView((current) => current === view ? current : view)
        setTabHost((current) => current === tabs ? current : tabs)
        setContentHost((current) => current === content ? current : content)
        if (view) {
          const heading = view.querySelector('.organisation-header h1')
          if (heading && !heading.textContent.includes('Sites')) heading.textContent = 'People, Teams, Departments & Sites'
        }
      })
    }

    measure()
    const observer = new MutationObserver(measure)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('hi5-routechange', measure)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('hi5-routechange', measure)
    }
  }, [])

  useEffect(() => {
    if (!organisationView || !tabHost) {
      setActive(false)
      return undefined
    }

    organisationView.classList.toggle('org-sites-active', active)
    const onTabClick = (event) => {
      const button = event.target.closest('button')
      if (button && !button.classList.contains('org-sites-tab')) setActive(false)
    }
    tabHost.addEventListener('click', onTabClick)
    return () => {
      organisationView.classList.remove('org-sites-active')
      tabHost.removeEventListener('click', onTabClick)
    }
  }, [active, organisationView, tabHost])

  useEffect(() => {
    const onChanged = () => setSites(loadSites())
    window.addEventListener('storage', onChanged)
    window.addEventListener('hi5-organisation-sites-changed', onChanged)
    window.addEventListener('hi5-organisation-hydrated', onChanged)
    return () => {
      window.removeEventListener('storage', onChanged)
      window.removeEventListener('hi5-organisation-sites-changed', onChanged)
      window.removeEventListener('hi5-organisation-hydrated', onChanged)
    }
  }, [])

  const organisation = useMemo(loadOrganisationSnapshot, [active, revision, sites])
  const visibleSites = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return sites.filter((site) => {
      const searchable = [site.name, site.code, site.type, site.city, site.postcode, site.country, site.notes].join(' ').toLowerCase()
      return (!needle || searchable.includes(needle)) && (typeFilter === 'All' || site.type === typeFilter)
    })
  }, [query, sites, typeFilter])

  function save(site) {
    const next = sites.some((item) => item.id === site.id)
      ? sites.map((item) => item.id === site.id ? site : item)
      : [...sites, site]
    setSites(next)
    saveSites(next)
    setEditorSite(undefined)
    setRevision((value) => value + 1)
  }

  if (!tabHost || !contentHost) return null

  const activeCount = sites.filter((site) => site.active !== false).length

  return (
    <>
      {createPortal(
        <button
          className={`org-sites-tab ${active ? 'active' : ''}`}
          onClick={() => { setActive(true); setRevision((value) => value + 1) }}
          role="tab"
          type="button"
        >
          <MapPin size={17} /><span>Sites</span><small>{activeCount}</small>
        </button>,
        tabHost,
      )}

      {active ? createPortal(
        <section className="org-sites-workspace">
          <div className="org-sites-toolbar">
            <div><span className="eyebrow">Organisation</span><h2>Sites</h2><p>Locations are first-class organisation records and can later map directly to ITSM routing and RMM scope.</p></div>
            <button className="primary-action" onClick={() => setEditorSite(null)} type="button"><Plus size={18} /> New site</button>
          </div>

          <div className="org-sites-filters">
            <label className="org-sites-search"><Search size={18} /><input placeholder="Search sites, codes or locations" type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <label><span>Type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>All</option>{siteTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          </div>

          <div className="org-sites-grid">
            {visibleSites.map((site) => {
              const counts = siteCounts(site, organisation)
              const contact = organisation.people.find((person) => person.id === site.primaryContactId)
              const supportTeam = organisation.teams.find((team) => team.id === site.supportTeamId)
              const linked = site.rmmSite?.status === 'linked'
              return (
                <article className={`org-site-card ${site.active === false ? 'is-inactive' : ''}`} key={site.id}>
                  <header>
                    <span className="org-site-icon"><Building2 size={21} /></span>
                    <div className="org-site-card-actions">
                      <span className={site.active === false ? 'is-inactive' : 'is-active'}>{site.active === false ? 'Inactive' : 'Active'}</span>
                      <button aria-label={`Edit ${site.name}`} onClick={() => setEditorSite(site)} type="button"><Settings2 size={17} /></button>
                    </div>
                  </header>
                  <div className="org-site-card-title"><span>{site.code}</span><h3>{site.name}</h3><p>{site.type}{site.city ? ` · ${site.city}` : ''}</p></div>
                  <dl>
                    <div><dt>People</dt><dd><UsersRound size={15} /> {counts.people}</dd></div>
                    <div><dt>Departments</dt><dd>{counts.departments}</dd></div>
                    <div><dt>Primary contact</dt><dd>{contact?.name || 'Not assigned'}</dd></div>
                    <div><dt>Support team</dt><dd>{supportTeam?.name || 'Not assigned'}</dd></div>
                    <div><dt>Time zone</dt><dd><Globe2 size={15} /> {site.timezone}</dd></div>
                    <div><dt>RMM</dt><dd className={linked ? 'org-site-linked' : ''}><Link2 size={14} /> {linked ? 'Linked' : 'Not linked'}</dd></div>
                  </dl>
                  <footer><MapPin size={15} /><span>{[site.address1, site.city, site.postcode].filter(Boolean).join(', ') || 'Virtual / no physical address'}</span></footer>
                </article>
              )
            })}
          </div>

          {!visibleSites.length ? <div className="org-sites-empty"><MapPin size={30} /><strong>No sites found</strong><span>Try a different search or type filter.</span></div> : null}

          {editorSite !== undefined ? <SiteEditor organisation={organisation} onClose={() => setEditorSite(undefined)} onSave={save} site={editorSite} /> : null}
        </section>,
        contentHost,
      ) : null}
    </>
  )
}

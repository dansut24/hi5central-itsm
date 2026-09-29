import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowUpRight,
  BookOpen,
  Building2,
  Monitor,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { assets, knowledgeArticles } from '../runtime/workspaceConfig.jsx'
import { ProductionRecordWorkingPeek } from './ProductionRecordWorkingPeek.jsx'

const PEEK_EVENT = 'hi5-universal-peek'
const PEEK_SELECTOR = [
  '.org-person-card',
  '.org-people-table tbody tr',
  '.org-entity-card',
  '.org-site-card',
  '.asset-card',
  '.knowledge-card',
].join(',')

function readJson(key, fallback = []) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || 'null')
    return value ?? fallback
  } catch {
    return fallback
  }
}

function text(node, selector) {
  return node?.querySelector(selector)?.textContent?.trim() || ''
}

function fieldsFromDl(node) {
  return Array.from(node?.querySelectorAll('dl > div') || []).map((entry) => ({
    label: text(entry, 'dt') || 'Detail',
    value: text(entry, 'dd') || 'Not recorded',
  }))
}

function navigate(path) {
  if (!path) return
  if (window.location.pathname !== path) window.history.pushState({}, '', path)
  const pop = typeof PopStateEvent === 'function'
    ? new PopStateEvent('popstate', { state: window.history.state })
    : new Event('popstate')
  window.dispatchEvent(pop)
  window.dispatchEvent(new CustomEvent('hi5-routechange'))
}

function isRecordPreview(preview) {
  return /^\/(incidents|requests|problems|changes)\/[^/?#]+/i.test(String(preview?.openPath || ''))
}

function peopleSnapshot() {
  const people = readJson('hi5central-organisation-people-v1', [])
  const teams = readJson('hi5central-organisation-teams-v1', [])
  const departments = readJson('hi5central-organisation-departments-v1', [])
  return {
    people: Array.isArray(people) ? people : [],
    teams: Array.isArray(teams) ? teams : [],
    departments: Array.isArray(departments) ? departments : [],
  }
}

function personPreview(node) {
  const name = text(node, '.org-person-cell strong') || text(node, 'strong')
  const { people, teams, departments } = peopleSnapshot()
  const person = people.find((item) => String(item.name || '').toLowerCase() === name.toLowerCase()) || {}
  const team = teams.find((item) => item.id === person.teamId) || teams.find((item) => item.name === person.team)
  const department = departments.find((item) => item.id === (team?.departmentId || person.departmentId))
  return {
    kind: 'Person',
    title: person.name || name || 'Person',
    subtitle: person.role || text(node, 'small') || 'People directory',
    icon: 'person',
    fields: [
      ['Email', person.email],
      ['Job title', person.role || person.jobTitle],
      ['Team', team?.name || person.team],
      ['Department', department?.name],
      ['Location', person.location],
      ['Availability', person.status],
    ],
    openPath: '/people',
    openLabel: 'Open People',
  }
}

function entityPreview(node) {
  const department = node.classList.contains('department')
  return {
    kind: department ? 'Department' : 'Team',
    title: text(node, 'h3') || (department ? 'Department' : 'Team'),
    subtitle: text(node, '.eyebrow') || text(node, 'p'),
    icon: department ? 'department' : 'team',
    fields: fieldsFromDl(node),
    openPath: '/people',
    openLabel: 'Open People',
  }
}

function sitePreview(node) {
  return {
    kind: 'Site',
    title: text(node, 'h3') || 'Site',
    subtitle: [text(node, '.org-site-card-title > span'), text(node, '.org-site-card-title > p')].filter(Boolean).join(' · '),
    icon: 'site',
    fields: fieldsFromDl(node),
    openPath: '/people',
    openLabel: 'Open Organisation',
  }
}

function assetPreview(node) {
  const name = text(node, 'h2') || text(node, 'h3') || text(node, 'strong')
  const asset = assets.find((item) => item.name === name || item.id === name) || {}
  return {
    kind: 'Configuration item',
    title: asset.name || name || 'Configuration item',
    subtitle: asset.className || asset.type || text(node, '.eyebrow') || 'CMDB',
    icon: 'device',
    fields: [
      ['Asset ID', asset.id],
      ['Status', asset.status],
      ['Type', asset.type || asset.className],
      ['Owner', asset.owner],
      ['Location', asset.location],
      ['Operating system', asset.os],
    ],
    openPath: asset.id ? `/cmdb/${encodeURIComponent(asset.id)}` : '/cmdb',
    openLabel: 'Open in tab',
  }
}

function knowledgePreview(node) {
  const title = text(node, 'h2') || text(node, 'h3')
  const article = knowledgeArticles.find((item) => item.title === title) || {}
  return {
    kind: 'Knowledge',
    title: article.title || title || 'Knowledge article',
    subtitle: article.category || text(node, '.eyebrow') || 'Knowledge base',
    icon: 'knowledge',
    fields: [
      ['Category', article.category],
      ['Updated', article.updated],
      ['Reads', article.reads],
      ['Owner', article.owner],
    ],
    openPath: article.slug ? `/knowledge/${encodeURIComponent(article.slug)}` : '/knowledge',
    openLabel: 'Open in tab',
  }
}

function previewFromNode(node) {
  if (node.matches('.org-person-card, .org-people-table tbody tr')) return personPreview(node)
  if (node.matches('.org-entity-card')) return entityPreview(node)
  if (node.matches('.org-site-card')) return sitePreview(node)
  if (node.matches('.asset-card')) return assetPreview(node)
  if (node.matches('.knowledge-card')) return knowledgePreview(node)
  return null
}

function iconFor(preview) {
  if (preview.icon === 'person') return <UserRound size={19} />
  if (preview.icon === 'team') return <UsersRound size={19} />
  if (preview.icon === 'department' || preview.icon === 'site') return <Building2 size={19} />
  if (preview.icon === 'device') return <Monitor size={19} />
  if (preview.icon === 'knowledge') return <BookOpen size={19} />
  return <ArrowUpRight size={19} />
}

function compactFields(fields = []) {
  return fields
    .map((field) => Array.isArray(field) ? { label: field[0], value: field[1] } : field)
    .filter((field) => field?.label && field?.value !== undefined && field?.value !== null && String(field.value).trim())
}

function PeekSurface({ preview, onClose }) {
  if (!preview) return null
  const fields = compactFields(preview.fields)
  const items = Array.isArray(preview.items) ? preview.items : []
  const workingRecord = isRecordPreview(preview)

  return createPortal(
    <div className={`hi5-universal-peek-layer${workingRecord ? ' is-working-record' : ''}`} role="presentation">
      <button className="hi5-universal-peek-backdrop" type="button" aria-label="Close preview" onClick={onClose} />
      <section className={`hi5-universal-peek${workingRecord ? ' is-working-record' : ''}`} role="dialog" aria-modal="true" aria-label={`${preview.kind || 'Item'} preview`}>
        <header>
          <div className="hi5-universal-peek-icon">{iconFor(preview)}</div>
          <div><span>{workingRecord ? 'Working Peek' : preview.kind || 'Quick preview'}</span><strong>{preview.title || 'Quick preview'}</strong>{preview.subtitle ? <small>{preview.subtitle}</small> : null}</div>
          <button type="button" aria-label="Close preview" onClick={onClose}><X size={17} /></button>
        </header>
        {workingRecord ? <div className="hi5-universal-peek-working-body"><ProductionRecordWorkingPeek preview={preview} /></div> : <div className="hi5-universal-peek-body">
          {fields.length ? <div className="hi5-universal-peek-fields">{fields.map((field) => <div key={`${field.label}-${field.value}`}><span>{field.label}</span><strong>{String(field.value)}</strong></div>)}</div> : null}
          {items.length ? <div className="hi5-universal-peek-items">{items.map((item, index) => <article key={`${item.id || item.title || 'item'}-${index}`}><div><strong>{item.title || item.name || 'Item'}</strong>{item.meta ? <span>{item.meta}</span> : null}</div>{item.badge ? <em>{item.badge}</em> : null}{item.openPath ? <button type="button" aria-label={`Open ${item.title || 'item'}`} onClick={() => { onClose(); navigate(item.openPath) }}><ArrowUpRight size={14} /></button> : null}</article>)}</div> : null}
          {!fields.length && !items.length && preview.description ? <p className="hi5-universal-peek-copy">{preview.description}</p> : null}
        </div>}
        <footer>
          <button type="button" onClick={onClose}>Close</button>
          {typeof preview.manage === 'function' && !workingRecord ? <button type="button" onClick={() => { onClose(); preview.manage() }}>{preview.manageLabel || 'Open full details'}<ArrowUpRight size={14} /></button> : null}
          {preview.openPath ? <button type="button" className="is-primary" onClick={() => { onClose(); navigate(preview.openPath) }}>{preview.openLabel || 'Open in tab'}<ArrowUpRight size={14} /></button> : null}
        </footer>
      </section>
    </div>,
    document.body,
  )
}

export function ProductionUniversalPeekV2() {
  const [preview, setPreview] = useState(null)
  const bypassRef = useRef(new WeakSet())

  useEffect(() => {
    const decorate = () => {
      document.querySelectorAll(PEEK_SELECTOR).forEach((node) => {
        if (!(node instanceof HTMLElement)) return
        node.dataset.hi5UniversalPeek = 'true'
        if (!(node instanceof HTMLButtonElement) && node.tabIndex < 0) node.tabIndex = 0
      })
    }

    const openNode = (node) => {
      const next = previewFromNode(node)
      if (!next) return false
      if (node.matches('.org-person-card, .org-people-table tbody tr')) {
        next.manageLabel = 'Open full profile'
        next.manage = () => {
          bypassRef.current.add(node)
          if (node instanceof HTMLButtonElement) node.click()
          else node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        }
      }
      setPreview(next)
      return true
    }

    const handleClick = (event) => {
      const node = event.target.closest?.(PEEK_SELECTOR)
      if (!(node instanceof HTMLElement)) return
      if (bypassRef.current.has(node)) {
        bypassRef.current.delete(node)
        return
      }
      const clickedControl = event.target.closest?.('input,select,textarea,a,[contenteditable="true"],button')
      const personCard = node.matches('.org-person-card')
      if (clickedControl && !personCard) return
      if (!openNode(node)) return
      if (personCard || node.matches('.org-people-table tbody tr')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    const handleKey = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      const node = event.target.closest?.(PEEK_SELECTOR)
      if (!(node instanceof HTMLElement) || node instanceof HTMLButtonElement) return
      if (event.target !== node) return
      if (openNode(node)) event.preventDefault()
    }

    const handleUniversalPeek = (event) => {
      if (event.detail && typeof event.detail === 'object') setPreview(event.detail)
    }

    decorate()
    const observer = new MutationObserver(decorate)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('click', handleClick, true)
    document.addEventListener('keydown', handleKey, true)
    window.addEventListener(PEEK_EVENT, handleUniversalPeek)
    window.__HI5_PEEK__ = (detail) => window.dispatchEvent(new CustomEvent(PEEK_EVENT, { detail }))

    return () => {
      observer.disconnect()
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleKey, true)
      window.removeEventListener(PEEK_EVENT, handleUniversalPeek)
      if (window.__HI5_PEEK__) delete window.__HI5_PEEK__
    }
  }, [])

  useEffect(() => {
    if (!preview) return undefined
    const onKey = (event) => { if (event.key === 'Escape') setPreview(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview])

  return <PeekSurface preview={preview} onClose={() => setPreview(null)} />
}

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { knowledgeArticles } from '../../runtime/workspaceConfig.jsx'

const KNOWLEDGE_RAIL_VISIBLE_KEY = 'hi5central-knowledge-category-rail-visible-v1'
const ALL_ARTICLES = 'All articles'
const PORTAL_THEME_VARS = ['--line', '--surface', '--surface-soft', '--ink', '--muted', '--accent-rgb', '--page']

function loadRailVisible() {
  try {
    const stored = window.localStorage.getItem(KNOWLEDGE_RAIL_VISIBLE_KEY)
    return stored === null ? true : JSON.parse(stored) !== false
  } catch {
    return true
  }
}

function categorySummary() {
  const counts = new Map()
  knowledgeArticles.forEach((article) => {
    const category = article.category || 'Uncategorised'
    counts.set(category, (counts.get(category) || 0) + 1)
  })

  return [
    { id: ALL_ARTICLES, label: ALL_ARTICLES, count: knowledgeArticles.length },
    ...[...counts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([label, count]) => ({ id: label, label, count })),
  ]
}

function readPortalTheme() {
  const shell = document.querySelector('.app-shell')
  if (!shell) return {}
  const computed = window.getComputedStyle(shell)
  return Object.fromEntries(PORTAL_THEME_VARS.map((name) => [name, computed.getPropertyValue(name).trim()]))
}

function workspaceEdgeInset() {
  const value = Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--hi5-workspace-edge'))
  return Number.isFinite(value) ? value : 2
}

export function KnowledgeContextEnhancer() {
  const categories = useMemo(categorySummary, [])
  const [activeCategory, setActiveCategory] = useState(ALL_ARTICLES)
  const [railVisible, setRailVisible] = useState(loadRailVisible)
  const [knowledgeView, setKnowledgeView] = useState(null)
  const [viewRect, setViewRect] = useState(null)
  const [mobile, setMobile] = useState(() => window.matchMedia?.('(max-width: 720px)').matches ?? false)

  useEffect(() => {
    let frame = 0
    let resizeObserver

    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const nextView = document.querySelector('.knowledge-view')
        setKnowledgeView((current) => current === nextView ? current : nextView)
        setMobile(window.matchMedia?.('(max-width: 720px)').matches ?? false)
        setViewRect(nextView ? nextView.getBoundingClientRect() : null)

        if (resizeObserver) resizeObserver.disconnect()
        if (nextView && typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            setViewRect(nextView.getBoundingClientRect())
          })
          resizeObserver.observe(nextView)
        }
      })
    }

    measure()
    const observer = new MutationObserver(measure)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-theme', 'data-accent'],
    })
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    window.addEventListener('hi5-routechange', measure)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      observer.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('hi5-routechange', measure)
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(KNOWLEDGE_RAIL_VISIBLE_KEY, JSON.stringify(railVisible))
    } catch {
      // This is a personal browser preference only.
    }
  }, [railVisible])

  useEffect(() => {
    if (!knowledgeView) return undefined

    knowledgeView.classList.add('knowledge-context-enhanced')
    knowledgeView.classList.toggle('knowledge-rail-hidden', !railVisible)

    const applyCategoryFilter = () => {
      const cards = [...knowledgeView.querySelectorAll('.knowledge-card')]
      let visibleCount = 0

      cards.forEach((card) => {
        const category = card.querySelector('.eyebrow')?.textContent?.trim() || 'Uncategorised'
        const visible = activeCategory === ALL_ARTICLES || category === activeCategory
        card.hidden = !visible
        if (visible) visibleCount += 1
      })

      const grid = knowledgeView.querySelector('.knowledge-grid')
      if (grid) {
        grid.dataset.categoryEmpty = visibleCount === 0 ? 'true' : 'false'
        grid.dataset.activeCategory = activeCategory
      }
    }

    applyCategoryFilter()
    const observer = new MutationObserver(applyCategoryFilter)
    observer.observe(knowledgeView, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      knowledgeView.classList.remove('knowledge-context-enhanced', 'knowledge-rail-hidden')
      knowledgeView.querySelectorAll('.knowledge-card').forEach((card) => { card.hidden = false })
      const grid = knowledgeView.querySelector('.knowledge-grid')
      if (grid) {
        delete grid.dataset.categoryEmpty
        delete grid.dataset.activeCategory
      }
    }
  }, [activeCategory, knowledgeView, railVisible])

  if (!knowledgeView || !viewRect) return null

  const edgeInset = workspaceEdgeInset()
  const horizontalInset = edgeInset
  const topInset = edgeInset
  const bottomInset = Math.max(edgeInset, window.innerHeight - viewRect.bottom + topInset)
  const portalTheme = readPortalTheme()

  if (mobile) {
    return createPortal(
      <nav
        className="knowledge-category-mobile-bar"
        aria-label="Knowledge categories"
        style={{
          ...portalTheme,
          left: Math.max(horizontalInset, viewRect.left + edgeInset),
          top: Math.max(edgeInset, viewRect.top + edgeInset),
          width: Math.max(0, viewRect.width - (edgeInset * 2)),
        }}
      >
        {categories.map((category) => (
          <button
            aria-pressed={activeCategory === category.id}
            className={activeCategory === category.id ? 'is-active' : ''}
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            type="button"
          >
            <span>{category.label}</span>
            <strong>{category.count}</strong>
          </button>
        ))}
      </nav>,
      document.body,
    )
  }

  if (!railVisible) {
    return createPortal(
      <button
        className="knowledge-category-rail-reveal"
        onClick={() => setRailVisible(true)}
        style={{ ...portalTheme, left: viewRect.left + edgeInset, top: viewRect.top + edgeInset }}
        title="Show Knowledge categories"
        type="button"
      >
        <BookOpen size={16} />
        <span>Categories</span>
        <ChevronRight size={15} />
      </button>,
      document.body,
    )
  }

  return createPortal(
    <aside
      className="knowledge-category-floating-rail"
      aria-label="Knowledge categories"
      style={{
        ...portalTheme,
        left: viewRect.left + edgeInset,
        top: viewRect.top + edgeInset,
        bottom: bottomInset,
        width: '258px',
      }}
    >
      <header>
        <div>
          <span>Knowledge Base</span>
          <strong>Categories</strong>
        </div>
        <button onClick={() => setRailVisible(false)} title="Hide categories" type="button">
          <ChevronLeft size={17} />
        </button>
      </header>
      <nav>
        {categories.map((category) => (
          <button
            aria-current={activeCategory === category.id ? 'page' : undefined}
            className={activeCategory === category.id ? 'is-active' : ''}
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            type="button"
          >
            <BookOpen size={15} />
            <span>{category.label}</span>
            <strong>{category.count}</strong>
          </button>
        ))}
      </nav>
      <footer>
        <span>{activeCategory === ALL_ARTICLES ? 'All knowledge' : activeCategory}</span>
        <small>Category filters work alongside search.</small>
      </footer>
    </aside>,
    document.body,
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bell,
  Copy,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react'

const TAB_SELECTOR = '.tab-list .workspace-tab'
const WORKSPACE_MENU_WIDTH = 214
const WORKSPACE_MENU_HEIGHT = 330

function cleanTabTitle(button) {
  const label = button?.querySelector('.workspace-tab-label')
  if (!(label instanceof HTMLElement)) return button?.textContent?.trim() || 'Workspace'
  const clone = label.cloneNode(true)
  clone.querySelectorAll('.live-chat-tab-notification, .unsaved-dot').forEach((node) => node.remove())
  return clone.textContent?.replace(/\s+/g, ' ').trim() || 'Workspace'
}

function originalTabButton(tabKey) {
  return Array.from(document.querySelectorAll(TAB_SELECTOR))
    .find((node) => node instanceof HTMLElement && node.dataset.tabKey === tabKey) || null
}

function proxyClick(selector) {
  const target = document.querySelector(selector)
  if (!(target instanceof HTMLElement)) return false
  target.click()
  return true
}

function semanticTabIdentity(tab) {
  const key = String(tab?.key || '').trim().toLowerCase()
  const module = String(tab?.module || '').trim().toLowerCase()
  const title = String(tab?.title || '').trim().toLowerCase()

  if (key === 'livechat' || module === 'livechat') return 'fixed:livechat'
  if (key === 'home' || module === 'home' || title === 'dashboard') return 'fixed:dashboard'
  return `${module || 'workspace'}:${title || key}`
}

function dedupeWorkspaceTabs(tabs) {
  const result = []
  const indexByIdentity = new Map()

  for (const tab of tabs) {
    const identity = semanticTabIdentity(tab)
    const existingIndex = indexByIdentity.get(identity)

    if (existingIndex === undefined) {
      indexByIdentity.set(identity, result.length)
      result.push(tab)
      continue
    }

    const existing = result[existingIndex]
    if (tab.active && !existing.active) result[existingIndex] = tab
  }

  return result
}

function readWorkspaceSnapshot() {
  const buttons = Array.from(document.querySelectorAll(TAB_SELECTOR))
    .filter((node) => node instanceof HTMLElement)

  const rawTabs = buttons.map((button, index) => {
    const unreadText = button.querySelector('.live-chat-tab-notification')?.textContent || ''
    const unread = Number.parseInt(String(unreadText).match(/\d+/)?.[0] || '0', 10)
    return {
      key: button.dataset.tabKey || `workspace-${index}`,
      module: button.dataset.tabModule || '',
      title: cleanTabTitle(button),
      active: button.classList.contains('active'),
      dirty: button.classList.contains('dirty') || Boolean(button.querySelector('.unsaved-dot')),
      closable: Boolean(button.querySelector('.tab-close')),
      unread: Number.isFinite(unread) ? unread : 0,
    }
  })

  const tabs = dedupeWorkspaceTabs(rawTabs)
  const shell = document.querySelector('.app-shell')
  const searchInput = document.querySelector('.chrome-search input') || document.querySelector('.breadcrumb-compact-search input')
  const notificationCounter = document.querySelector('.notification-trigger .notification-count, .notification-trigger .notification-badge')
  const parsedNotifications = Number.parseInt(notificationCounter?.textContent?.match(/\d+/)?.[0] || '0', 10)
  const brandImage = document.querySelector('.tabbar-brand img')

  return {
    tabs,
    active: tabs.find((tab) => tab.active) || tabs[0] || null,
    theme: shell instanceof HTMLElement ? shell.dataset.theme || 'light' : 'light',
    sidebarHidden: shell instanceof HTMLElement ? shell.classList.contains('sidebar-hidden') : false,
    searchValue: searchInput instanceof HTMLInputElement ? searchInput.value : '',
    unreadNotifications: Number.isFinite(parsedNotifications) ? parsedNotifications : 0,
    brandSrc: brandImage instanceof HTMLImageElement ? brandImage.src : '/hi5central-logo.png',
  }
}

function snapshotSignature(snapshot) {
  return JSON.stringify(snapshot)
}

function syncReactInput(input, value) {
  if (!(input instanceof HTMLInputElement)) return false
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  if (setter) setter.call(input, value)
  else input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

function invokeLegacyContextAction(tabKey, actionPrefix) {
  const target = originalTabButton(tabKey)
  if (!(target instanceof HTMLElement)) return

  document.body.classList.add('hi5-workspace-v2-programmatic-tab-menu')
  target.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: 4,
    clientY: 4,
    view: window,
  }))

  window.requestAnimationFrame(() => {
    const menu = document.querySelector('.tab-context-menu')
    const action = Array.from(menu?.querySelectorAll('button') || [])
      .find((button) => button.textContent?.trim().toLowerCase().startsWith(actionPrefix.toLowerCase()))
    if (action instanceof HTMLButtonElement && !action.disabled) action.click()
    document.body.classList.remove('hi5-workspace-v2-programmatic-tab-menu')
  })
}

function menuPositionFor(button) {
  const rect = button?.getBoundingClientRect()
  if (!rect) return { top: 54, left: Math.max(8, window.innerWidth - WORKSPACE_MENU_WIDTH - 8) }

  const left = Math.max(8, Math.min(
    rect.right - WORKSPACE_MENU_WIDTH,
    window.innerWidth - WORKSPACE_MENU_WIDTH - 8,
  ))

  const below = rect.bottom + 7
  const roomBelow = window.innerHeight - below
  const top = roomBelow >= WORKSPACE_MENU_HEIGHT
    ? below
    : Math.max(8, rect.top - WORKSPACE_MENU_HEIGHT - 7)

  return { top, left }
}

export function ProductionWorkspaceShellV2() {
  const [tabbar, setTabbar] = useState(null)
  const [snapshot, setSnapshot] = useState(() => readWorkspaceSnapshot())
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [workspaceMenuPosition, setWorkspaceMenuPosition] = useState({ top: 54, left: 8 })
  const snapshotRef = useRef('')
  const searchInputRef = useRef(null)
  const activeTabRef = useRef(null)
  const moreButtonRef = useRef(null)

  useEffect(() => {
    const scan = () => {
      const nextTabbar = document.querySelector('.tabbar')
      if (nextTabbar instanceof HTMLElement) {
        setTabbar((current) => current === nextTabbar ? current : nextTabbar)
      }

      const next = readWorkspaceSnapshot()
      const signature = snapshotSignature(next)
      if (signature !== snapshotRef.current) {
        snapshotRef.current = signature
        setSnapshot(next)
        if (!searchOpen) setSearchValue(next.searchValue)
      }
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true })
    const timer = window.setInterval(scan, 700)
    window.addEventListener('hi5-routechange', scan)
    window.addEventListener('hi5-runtime-preferences-applied', scan)
    window.addEventListener('resize', scan)

    return () => {
      observer.disconnect()
      window.clearInterval(timer)
      window.removeEventListener('hi5-routechange', scan)
      window.removeEventListener('hi5-runtime-preferences-applied', scan)
      window.removeEventListener('resize', scan)
    }
  }, [searchOpen])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      setSearchOpen(false)
      setWorkspaceMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus({ preventScroll: true })
  }, [searchOpen])

  useEffect(() => {
    const activeNode = activeTabRef.current
    if (!(activeNode instanceof HTMLElement)) return
    activeNode.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [snapshot.active?.key])

  useEffect(() => {
    if (!workspaceMenuOpen) return undefined
    const reposition = () => setWorkspaceMenuPosition(menuPositionFor(moreButtonRef.current))
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [workspaceMenuOpen])

  const visibleTabs = useMemo(
    () => snapshot.tabs.filter((tab) => tab.key !== 'newtab'),
    [snapshot.tabs],
  )
  const active = snapshot.active
  const closableCount = visibleTabs.filter((tab) => tab.closable).length

  const activateWorkspace = (tabKey) => {
    originalTabButton(tabKey)?.click()
    setWorkspaceMenuOpen(false)
  }

  const closeWorkspace = (tabKey) => {
    const close = originalTabButton(tabKey)?.querySelector('.tab-close')
    if (close instanceof HTMLElement) close.click()
  }

  const updateSearch = (value) => {
    setSearchValue(value)
    const input = document.querySelector('.chrome-search input') || document.querySelector('.breadcrumb-compact-search input')
    syncReactInput(input, value)
  }

  const toggleTheme = () => {
    const button = Array.from(document.querySelectorAll('button[title]'))
      .find((node) => node instanceof HTMLButtonElement && node.title.startsWith('Switch to '))
    button?.click()
    setWorkspaceMenuOpen(false)
  }

  const openNotifications = () => {
    proxyClick('.breadcrumb-desktop-actions .notification-trigger, .breadcrumb-mobile-actions .notification-trigger, .notification-trigger')
    setWorkspaceMenuOpen(false)
  }

  const openSettings = () => {
    proxyClick('.breadcrumb-desktop-actions button[title="Settings"], .breadcrumb-mobile-actions button[title="Settings"]')
    setWorkspaceMenuOpen(false)
  }

  const signOut = () => {
    proxyClick('.chrome-logout, .breadcrumb-mobile-action[title="Sign out"]')
    setWorkspaceMenuOpen(false)
  }

  const showSidebar = () => {
    const button = Array.from(document.querySelectorAll('button[title]'))
      .find((node) => node instanceof HTMLButtonElement && node.title === 'Show sidebar')
    button?.click()
    setWorkspaceMenuOpen(false)
  }

  const openNewRecord = () => {
    proxyClick('.record-create-trigger')
    setWorkspaceMenuOpen(false)
  }

  const duplicateActive = () => {
    if (active && active.key !== 'livechat' && active.key !== 'newtab') {
      invokeLegacyContextAction(active.key, 'Duplicate tab')
    }
    setWorkspaceMenuOpen(false)
  }

  const closeActive = () => {
    if (active?.closable) closeWorkspace(active.key)
    setWorkspaceMenuOpen(false)
  }

  const closeAll = () => {
    if (active) invokeLegacyContextAction(active.key, 'Close all tabs')
    setWorkspaceMenuOpen(false)
  }

  const toggleWorkspaceMenu = () => {
    setSearchOpen(false)
    setWorkspaceMenuOpen((current) => {
      if (!current) setWorkspaceMenuPosition(menuPositionFor(moreButtonRef.current))
      return !current
    })
  }

  const commandBar = (
    <div
      className={`production-workspace-tabdock${searchOpen ? ' is-searching' : ''}`}
      data-hi5-workspace-shell="v3"
    >
      <button
        aria-label="Open Hi5Central navigation"
        className="production-workspace-mobile-nav"
        onClick={() => proxyClick('.tabbar-brand')}
        title="Open navigation"
        type="button"
      >
        {snapshot.brandSrc
          ? <img src={snapshot.brandSrc} alt="" aria-hidden="true" />
          : <Menu size={17} aria-hidden="true" />}
      </button>

      <div className="production-workspace-tabs-viewport">
        <div className="production-workspace-tabs" role="tablist" aria-label="Open workspaces">
          {visibleTabs.map((tab) => (
            <div
              className={[
                'production-workspace-tab',
                tab.active ? 'is-active' : '',
                tab.key === 'livechat' || tab.module === 'livechat' ? 'is-livechat' : '',
                tab.dirty ? 'is-dirty' : '',
              ].filter(Boolean).join(' ')}
              key={semanticTabIdentity(tab)}
              ref={tab.active ? activeTabRef : undefined}
              onContextMenu={(event) => {
                event.preventDefault()
                if (tab.key !== 'livechat' && tab.key !== 'newtab') {
                  invokeLegacyContextAction(tab.key, 'Duplicate tab')
                }
              }}
            >
              <button
                aria-selected={tab.active}
                className="production-workspace-tab-main"
                onClick={() => activateWorkspace(tab.key)}
                role="tab"
                title={tab.title}
                type="button"
              >
                <span className="production-workspace-tab-title">{tab.title}</span>
                {tab.dirty && <span className="production-workspace-tab-dirty" aria-label="Unsaved changes" />}
                {tab.unread > 0 && (
                  <span className="production-workspace-tab-unread" aria-label={`${tab.unread} unread messages`}>
                    {tab.unread}
                  </span>
                )}
              </button>
              {tab.closable && (
                <button
                  aria-label={`Close ${tab.title}`}
                  className="production-workspace-tab-close"
                  onClick={() => closeWorkspace(tab.key)}
                  title="Close"
                  type="button"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}

          <button
            aria-label="Open workspace launcher"
            className="production-workspace-tab-add"
            onClick={() => proxyClick('.tab-add')}
            title="Open workspace launcher"
            type="button"
          >
            <Plus size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="production-workspace-tabdock-actions">
        <div className={`production-workspace-search${searchOpen ? ' is-open' : ''}`}>
          {searchOpen ? (
            <>
              <Search size={14} aria-hidden="true" />
              <input
                aria-label="Search Hi5Central"
                autoCapitalize="none"
                autoCorrect="off"
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Search records"
                ref={searchInputRef}
                type="search"
                value={searchValue}
              />
              <button aria-label="Close search" onClick={() => setSearchOpen(false)} type="button">
                <X size={13} aria-hidden="true" />
              </button>
            </>
          ) : (
            <button
              aria-label="Search Hi5Central"
              className="production-workspace-icon-action"
              onClick={() => {
                setSearchValue(snapshot.searchValue)
                setSearchOpen(true)
                setWorkspaceMenuOpen(false)
              }}
              title="Search"
              type="button"
            >
              <Search size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        <button
          aria-label="Notifications"
          className="production-workspace-icon-action production-workspace-notifications"
          onClick={openNotifications}
          title="Notifications"
          type="button"
        >
          <Bell size={16} aria-hidden="true" />
          {snapshot.unreadNotifications > 0 && <span>{snapshot.unreadNotifications}</span>}
        </button>

        <button
          aria-label="New record"
          className="production-workspace-new"
          onClick={openNewRecord}
          title="New record"
          type="button"
        >
          <Plus size={16} aria-hidden="true" />
          <span>New</span>
        </button>

        <button
          aria-expanded={workspaceMenuOpen}
          aria-label="Workspace menu"
          className="production-workspace-icon-action production-workspace-more"
          onClick={toggleWorkspaceMenu}
          ref={moreButtonRef}
          title="Workspace menu"
          type="button"
        >
          <MoreHorizontal size={17} aria-hidden="true" />
        </button>
      </div>
    </div>
  )

  const menu = workspaceMenuOpen
    ? createPortal(
        <>
          <button
            aria-label="Close workspace menu"
            className="production-workspace-menu-backdrop"
            onClick={() => setWorkspaceMenuOpen(false)}
            type="button"
          />
          <div
            className="production-workspace-menu production-workspace-menu-floating"
            role="menu"
            style={{
              '--hi5-workspace-menu-top': `${workspaceMenuPosition.top}px`,
              '--hi5-workspace-menu-left': `${workspaceMenuPosition.left}px`,
            }}
          >
            <button
              disabled={!active || active.key === 'livechat' || active.key === 'newtab'}
              onClick={duplicateActive}
              role="menuitem"
              type="button"
            >
              <Copy size={14} aria-hidden="true" />
              Duplicate current
            </button>
            <button disabled={!active?.closable} onClick={closeActive} role="menuitem" type="button">
              <X size={14} aria-hidden="true" />
              Close current
            </button>
            <button disabled={!closableCount} onClick={closeAll} role="menuitem" type="button">
              <X size={14} aria-hidden="true" />
              Close all work
            </button>
            <span className="production-workspace-menu-separator" role="separator" />
            {snapshot.sidebarHidden && (
              <button onClick={showSidebar} role="menuitem" type="button">
                <PanelLeftOpen size={14} aria-hidden="true" />
                Show navigation
              </button>
            )}
            <button onClick={toggleTheme} role="menuitem" type="button">
              {snapshot.theme === 'dark' ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
              {snapshot.theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <button onClick={openSettings} role="menuitem" type="button">
              <Settings size={14} aria-hidden="true" />
              Settings
            </button>
            <button onClick={signOut} role="menuitem" type="button">
              <LogOut size={14} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </>,
        document.body,
      )
    : null

  if (!tabbar) return null
  return (
    <>
      {createPortal(commandBar, tabbar)}
      {menu}
    </>
  )
}

import { useEffect, useRef } from 'react'
import './ProductionLiveChatBadgeBridge.css'

const API_BASE = window.__HI5_API_BASE__
const TAB_SELECTOR = '.workspace-tab-livechat, .workspace-tab[data-tab-module="livechat"]'

async function unreadCount() {
  const response = await fetch(`${API_BASE}/api/v1/live-chat/conversations`, {
    credentials: 'include',
    cache: 'no-store',
  })
  if (!response.ok) return 0
  const payload = await response.json().catch(() => ({}))
  return (payload.items || []).reduce((total, item) => total + Number(item.unread || 0), 0)
}

function applyCount(count) {
  document.querySelectorAll(TAB_SELECTOR).forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    node.dataset.hi5LiveUnread = count > 0 ? String(Math.min(99, count)) : ''
    node.classList.toggle('hi5-has-live-unread', count > 0)
    const legacy = node.querySelector('.live-chat-tab-notification')
    if (legacy instanceof HTMLElement) legacy.setAttribute('aria-hidden', 'true')
  })

  window.dispatchEvent(new CustomEvent('hi5-production-live-chat-count', {
    detail: { unread: count },
  }))
}

export function ProductionLiveChatBadgeBridge() {
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const refresh = async () => {
      try {
        const count = await unreadCount()
        if (mountedRef.current) applyCount(count)
      } catch {
        if (mountedRef.current) applyCount(0)
      }
    }

    const handleServerCount = (event) => {
      const value = Number(event?.detail?.unread || 0)
      applyCount(Number.isFinite(value) ? value : 0)
    }

    // Hide historical local unread state immediately; the asynchronous
    // refresh below then paints only the PostgreSQL-backed unread count.
    applyCount(0)
    refresh()

    const observer = new MutationObserver(() => {
      document.querySelectorAll(TAB_SELECTOR).forEach((node) => {
        if (!(node instanceof HTMLElement)) return
        const legacy = node.querySelector('.live-chat-tab-notification')
        if (legacy instanceof HTMLElement) legacy.setAttribute('aria-hidden', 'true')
      })
    })
    observer.observe(document.body, { childList: true, subtree: true })

    const timer = window.setInterval(refresh, 5000)
    window.addEventListener('visibilitychange', refresh)
    window.addEventListener('hi5-production-live-chat-count', handleServerCount)

    return () => {
      mountedRef.current = false
      observer.disconnect()
      window.clearInterval(timer)
      window.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('hi5-production-live-chat-count', handleServerCount)
    }
  }, [])

  return null
}

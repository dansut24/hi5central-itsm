import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ListChecks } from 'lucide-react'

function navigate(path) {
  if (window.location.pathname === path) return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.dispatchEvent(new CustomEvent('hi5-routechange', { detail: { path } }))
}

function setNativeSelectValue(select, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set
  if (setter) setter.call(select, value)
  else select.value = value
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

export function ProductionTaskNavigationBridge() {
  const [navGroup, setNavGroup] = useState(null)
  const [approvalViews, setApprovalViews] = useState(null)
  const [approvalStatus, setApprovalStatus] = useState(null)
  const [awaitingActive, setAwaitingActive] = useState(false)
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setPath(window.location.pathname)
        const groups = [...document.querySelectorAll('.nav-stack > div')]
        const nextNav = groups.find((group) => group.querySelector('.nav-group-label')?.textContent?.trim() === 'Service Desk') || null
        setNavGroup((current) => current === nextNav ? current : nextNav)

        let nextViews = null
        let nextStatus = null
        if (window.location.pathname === '/requests' || window.location.pathname === '/requests/') {
          const requestShell = [...document.querySelectorAll('.production-record-shell')]
            .find((shell) => shell.querySelector('.production-record-filter-heading strong')?.textContent?.trim() === 'Service Requests')
          nextViews = requestShell?.querySelector('.production-record-view-list') || null
          nextStatus = [...(requestShell?.querySelectorAll('.production-record-filter-field') || [])]
            .find((label) => label.querySelector(':scope > span')?.textContent?.trim() === 'Status')
            ?.querySelector('select') || null
        }
        setApprovalViews((current) => current === nextViews ? current : nextViews)
        setApprovalStatus((current) => current === nextStatus ? current : nextStatus)
      })
    }

    measure()
    const observer = new MutationObserver(measure)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('popstate', measure)
    window.addEventListener('hi5-routechange', measure)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('popstate', measure)
      window.removeEventListener('hi5-routechange', measure)
    }
  }, [])

  useEffect(() => {
    if (!approvalStatus) { setAwaitingActive(false); return undefined }
    const sync = () => setAwaitingActive(approvalStatus.value === 'Pending Approval')
    sync()
    approvalStatus.addEventListener('change', sync)
    return () => approvalStatus.removeEventListener('change', sync)
  }, [approvalStatus])

  return <>
    {navGroup ? createPortal(
      <button
        aria-current={path.startsWith('/tasks') ? 'page' : undefined}
        className={`nav-item production-task-nav production-task-nav-bridge ${path.startsWith('/tasks') ? 'active' : ''}`}
        onClick={() => navigate('/tasks')}
        title="Tasks"
        type="button"
      ><ListChecks size={18} aria-hidden="true" /><span>Tasks</span></button>,
      navGroup,
    ) : null}
    {approvalViews ? createPortal(
      <button
        className={`${awaitingActive ? 'is-active ' : ''}production-awaiting-approval-view production-awaiting-approval-bridge`}
        type="button"
        onClick={() => approvalStatus && setNativeSelectValue(approvalStatus, 'Pending Approval')}
      >Awaiting approval</button>,
      approvalViews,
    ) : null}
  </>
}

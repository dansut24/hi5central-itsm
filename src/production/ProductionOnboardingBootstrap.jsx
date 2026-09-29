import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react'
import { OnboardingWizard } from '../features/onboarding/OnboardingWizard.jsx'
import { resolveTenantSurface } from '../lib/tenantSurface.js'
import { takeProductionAuthHandoff } from './productionSessionBridge.js'
import './ProductionWorkspaceBootstrap.css'

const API_BASE = window.__HI5_API_BASE__
const SESSION_TIMEOUT_MS = 8000
const ONBOARDING_HANDOFF_KEY = 'hi5central-onboarding-handoff-v1'

function validSession(payload, tenantSlug) {
  return Boolean(
    payload?.authenticated === true
      && payload?.tenant?.slug
      && payload.tenant.slug === tenantSlug,
  )
}

function markOnboardingHandoff(payload) {
  try {
    window.sessionStorage.setItem(ONBOARDING_HANDOFF_KEY, JSON.stringify({
      companyName: payload?.tenant?.companyName || payload?.tenant?.slug || 'Your workspace',
      tenantSlug: payload?.tenant?.slug || '',
      modules: payload?.tenant?.modules || {},
      completedAt: payload?.onboarding?.completedAt || new Date().toISOString(),
      createdAt: Date.now(),
    }))
  } catch {
    // The handoff is presentation-only; setup completion must never depend on storage.
  }
}

async function loadSessionWithDeadline(tenantSlug) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error('SESSION_TIMEOUT')), SESSION_TIMEOUT_MS)
  })

  const request = (async () => {
    const response = await fetch(`${API_BASE}/api/v1/auth/session`, {
      credentials: 'include',
      cache: 'no-store',
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !validSession(payload, tenantSlug)) {
      const error = new Error(response.status === 401 ? 'SESSION_REQUIRED' : 'SESSION_INVALID')
      error.status = response.status
      throw error
    }
    return payload
  })()

  try {
    return await Promise.race([request, timeout])
  } finally {
    window.clearTimeout(timer)
  }
}

function ResumeFailure({ tenantName, message, onRetry }) {
  return (
    <div className="production-auth-shell">
      <div className="production-auth-card production-auth-loading">
        <img src="/hi5central-logo.png" alt="" />
        <strong>Continue setting up {tenantName}</strong>
        <span>{message}</span>
        <button type="button" onClick={onRetry}>
          <RefreshCw size={16} /> Retry secure session
        </button>
        <button type="button" onClick={() => window.location.replace('/login')}>
          Sign in again <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

function Restoring({ tenantName }) {
  return (
    <div className="production-auth-shell">
      <div className="production-auth-card production-auth-loading">
        <img src="/hi5central-logo.png" alt="" />
        <strong>Restoring {tenantName}</strong>
        <span><ShieldCheck size={15} /> Restoring your saved onboarding progress…</span>
      </div>
    </div>
  )
}

export function ProductionOnboardingBootstrap() {
  const surface = useMemo(() => resolveTenantSurface(), [])
  const [session, setSession] = useState(() => {
    const handoff = takeProductionAuthHandoff()
    return validSession(handoff, surface.tenantSlug) ? handoff : null
  })
  const [loading, setLoading] = useState(() => !session)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (session) return undefined
    let active = true

    async function restore() {
      setLoading(true)
      setError('')
      try {
        const payload = await loadSessionWithDeadline(surface.tenantSlug)
        if (!active) return
        if (payload.onboarding?.completedAt) {
          window.location.replace('/dashboard')
          return
        }
        setSession(payload)
      } catch (restoreError) {
        if (!active) return
        if (restoreError.message === 'SESSION_REQUIRED') {
          window.location.replace('/login')
          return
        }
        setError(
          restoreError.message === 'SESSION_TIMEOUT'
            ? 'Hi5Central could not restore the session within 8 seconds. You can retry or sign in again.'
            : 'Hi5Central could not restore this onboarding session. You can retry or sign in again.',
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    restore()
    return () => { active = false }
  }, [retryKey, session, surface.tenantSlug])

  function acceptSession(nextSession) {
    if (!validSession(nextSession, surface.tenantSlug)) {
      setError('Hi5Central returned an invalid onboarding session. Please sign in again.')
      setSession(null)
      return
    }

    if (nextSession.onboarding?.completedAt) {
      markOnboardingHandoff(nextSession)
      window.location.replace('/dashboard')
      return
    }

    setSession(nextSession)
    setError('')
  }

  if (session && !session.onboarding?.completedAt) {
    return <OnboardingWizard session={session} onSessionChange={acceptSession} />
  }

  if (loading) return <Restoring tenantName={surface.tenantName} />

  return (
    <ResumeFailure
      tenantName={surface.tenantName}
      message={error || 'Your onboarding session needs to be restored.'}
      onRetry={() => setRetryKey((current) => current + 1)}
    />
  )
}

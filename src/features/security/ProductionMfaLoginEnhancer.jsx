import { useEffect, useState } from 'react'
import { KeyRound, ShieldCheck, X } from 'lucide-react'
import { resolveTenantSurface } from '../../lib/tenantSurface.js'
import { storeProductionAuthHandoff } from '../../production/productionSessionBridge.js'
import './ProductionMfaLoginEnhancer.css'

const API_BASE = window.__HI5_API_BASE__

function continueAfterAuthentication(payload = {}) {
  storeProductionAuthHandoff(payload)

  const target = payload?.onboarding?.completedAt ? '/dashboard' : '/onboarding'
  window.location.replace(target)
}

function RecoveryCodes({ codes, onContinue }) {
  return (
    <div className="production-mfa-modal-card">
      <div className="production-mfa-modal-heading">
        <span><ShieldCheck size={20} /></span>
        <div><small>MFA enabled</small><strong>Save your recovery codes</strong></div>
      </div>
      <p>Each code can be used once if you lose access to your authenticator. Store them somewhere secure; Hi5Central will not show this set again.</p>
      <div className="production-mfa-recovery-grid">
        {codes.map((code) => <code key={code}>{code}</code>)}
      </div>
      <button className="production-mfa-primary" onClick={onContinue} type="button">I have saved these codes</button>
    </div>
  )
}

export function ProductionMfaLoginEnhancer() {
  const [flow, setFlow] = useState(null)
  const [setup, setSetup] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState(null)
  const [authenticatedPayload, setAuthenticatedPayload] = useState(null)

  useEffect(() => {
    async function intercept(event) {
      const form = event.target
      if (!(form instanceof HTMLFormElement)) return
      if (!form.closest('.production-auth-shell')) return

      const emailInput = form.querySelector('input[autocomplete="username"]')
      const passwordInput = form.querySelector('input[autocomplete="current-password"]')
      if (!(emailInput instanceof HTMLInputElement) || !(passwordInput instanceof HTMLInputElement)) return

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation?.()

      const surface = resolveTenantSurface()
      const tenantSlug = surface?.kind === 'workspace' ? surface.tenantSlug : ''
      if (!tenantSlug) return

      setBusy(true)
      setError('')
      setFlow(null)
      setSetup(null)
      setRecoveryCodes(null)
      setAuthenticatedPayload(null)
      try {
        const response = await fetch(`${API_BASE}/api/v1/auth/login-secure`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantSlug,
            email: emailInput.value,
            password: passwordInput.value,
          }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Sign in failed.')

        if (payload.mfaRequired) {
          const nextFlow = {
            challengeToken: payload.challengeToken,
            setupRequired: Boolean(payload.setupRequired),
            tenant: payload.tenant,
            user: payload.user,
          }
          setFlow(nextFlow)

          if (payload.setupRequired) {
            const setupResponse = await fetch(`${API_BASE}/api/v1/auth/mfa/setup`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ challengeToken: payload.challengeToken }),
            })
            const setupPayload = await setupResponse.json().catch(() => ({}))
            if (!setupResponse.ok) throw new Error(setupPayload.error || 'Could not start MFA setup.')
            setSetup(setupPayload)
          }
          return
        }

        if (payload.authenticated) {
          continueAfterAuthentication(payload)
          return
        }
        throw new Error('Hi5Central could not complete sign in.')
      } catch (loginError) {
        setFlow(null)
        setSetup(null)
        setError(loginError.message)
      } finally {
        setBusy(false)
      }
    }

    document.addEventListener('submit', intercept, true)
    return () => document.removeEventListener('submit', intercept, true)
  }, [])

  async function verify() {
    if (!flow?.challengeToken || !code.trim()) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/mfa/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken: flow.challengeToken, code: code.trim() }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'MFA verification failed.')
      if (Array.isArray(payload.recoveryCodes) && payload.recoveryCodes.length) {
        setAuthenticatedPayload(payload)
        setRecoveryCodes(payload.recoveryCodes)
        return
      }
      continueAfterAuthentication(payload)
    } catch (verifyError) {
      setError(verifyError.message)
    } finally {
      setBusy(false)
    }
  }

  function close() {
    if (busy) return
    setFlow(null)
    setSetup(null)
    setCode('')
    setError('')
    setRecoveryCodes(null)
    setAuthenticatedPayload(null)
  }

  if (!flow && !error && !busy) return null

  if (!flow) {
    return (
      <div className="production-mfa-toast" role="alert">
        <span>{busy ? 'Signing in securely…' : error}</span>
        {!busy ? <button onClick={() => setError('')} type="button"><X size={16} /></button> : null}
      </div>
    )
  }

  return (
    <div className="production-mfa-modal" role="dialog" aria-modal="true" aria-label="Multi-factor authentication">
      {recoveryCodes ? (
        <RecoveryCodes codes={recoveryCodes} onContinue={() => continueAfterAuthentication(authenticatedPayload || {})} />
      ) : (
        <div className="production-mfa-modal-card">
          <button className="production-mfa-close" disabled={busy} onClick={close} type="button" aria-label="Cancel MFA"><X size={18} /></button>
          <div className="production-mfa-modal-heading">
            <span><KeyRound size={20} /></span>
            <div>
              <small>{flow.setupRequired ? 'Set up administrator MFA' : 'Multi-factor authentication'}</small>
              <strong>{flow.tenant?.companyName || 'Hi5Central'}</strong>
            </div>
          </div>

          {flow.setupRequired ? (
            <>
              <p>Open Microsoft Authenticator, Google Authenticator, 1Password or another TOTP app and add a new account.</p>
              {setup ? (
                <div className="production-mfa-setup-box">
                  <span>Authenticator setup key</span>
                  <code>{setup.secret}</code>
                  <small>Issuer: Hi5Central · Account: {setup.account}</small>
                  <a href={setup.otpauthUri}>Open in authenticator app</a>
                </div>
              ) : <div className="production-mfa-loading">Preparing your authenticator setup…</div>}
            </>
          ) : (
            <p>Enter the six-digit code from your authenticator app. You can also use one unused recovery code.</p>
          )}

          <label className="production-mfa-code-field">
            <span>{flow.setupRequired ? 'Six-digit authenticator code' : 'Authenticator or recovery code'}</span>
            <input
              autoFocus
              autoComplete="one-time-code"
              inputMode={flow.setupRequired ? 'numeric' : 'text'}
              maxLength={flow.setupRequired ? 6 : 20}
              placeholder={flow.setupRequired ? '000000' : '000000 or recovery code'}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') verify() }}
            />
          </label>

          {error ? <div className="production-mfa-error">{error}</div> : null}
          <button
            className="production-mfa-primary"
            disabled={busy || !code.trim() || (flow.setupRequired && !setup)}
            onClick={verify}
            type="button"
          >
            {busy ? 'Verifying…' : flow.setupRequired ? 'Verify and enable MFA' : 'Verify and sign in'}
          </button>
        </div>
      )}
    </div>
  )
}

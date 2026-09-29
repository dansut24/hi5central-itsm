import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, KeyRound, ShieldCheck } from 'lucide-react'
import './OnboardingMfaEnhancer.css'

const API_BASE = window.__HI5_API_BASE__

export function OnboardingMfaEnhancer() {
  const [target, setTarget] = useState(null)
  const [required, setRequired] = useState(true)
  const [status, setStatus] = useState(null)
  const [setup, setSetup] = useState(null)
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let currentSelect = null
    let selectHandler = null

    const detachSelect = () => {
      if (currentSelect && selectHandler) currentSelect.removeEventListener('change', selectHandler)
      currentSelect = null
      selectHandler = null
    }

    const attach = () => {
      const card = document.querySelector('.onboarding-card')
      const heading = card?.querySelector('.onboarding-heading h1')
      const securityOpen = heading?.textContent?.trim() === 'Security'

      const finishNote = card?.querySelector('.onboarding-finish-note span')
      if (finishNote?.textContent?.includes('MFA enforcement')) {
        finishNote.textContent = 'All settings in this onboarding pass are persisted to the tenant. Microsoft 365, inbound email and billing remain unavailable until their production integrations are connected.'
      }

      if (!securityOpen || !card) {
        detachSelect()
        setTarget(null)
        return
      }

      const section = [...card.querySelectorAll('.onboarding-section')]
        .find((item) => item.querySelector('.onboarding-section-heading strong')?.textContent?.includes('Authentication & sessions'))
      const description = section?.querySelector('.onboarding-section-heading span')
      if (description) {
        description.textContent = 'These authentication, password, session and audit controls are enforced by the production security service.'
      }

      const nextSelect = section?.querySelector('select') || null
      if (nextSelect !== currentSelect) {
        detachSelect()
        currentSelect = nextSelect
        if (currentSelect) {
          selectHandler = () => setRequired(currentSelect?.value !== 'optional')
          selectHandler()
          currentSelect.addEventListener('change', selectHandler)
        }
      }

      let mount = card.querySelector('[data-hi5-onboarding-mfa]')
      if (!mount) {
        mount = document.createElement('div')
        mount.dataset.hi5OnboardingMfa = 'true'
        const actions = card.querySelector('.onboarding-actions')
        if (actions) card.insertBefore(mount, actions)
        else card.appendChild(mount)
      }
      setTarget((current) => current === mount ? current : mount)
    }

    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    attach()

    return () => {
      observer.disconnect()
      detachSelect()
    }
  }, [])

  async function loadStatus() {
    const response = await fetch(`${API_BASE}/api/v1/mfa/status`, { credentials: 'include' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Could not check MFA enrollment.')
    setStatus(payload)
    return payload
  }

  useEffect(() => {
    if (!target) {
      setStatus(null)
      setSetup(null)
      setRecoveryCodes([])
      setError('')
      return
    }
    let active = true
    loadStatus().catch((loadError) => {
      if (active) setError(loadError.message)
    })
    return () => { active = false }
  }, [target])

  useEffect(() => {
    if (!target) return
    const button = document.querySelector('.onboarding-card .onboarding-actions .onboarding-primary')
    if (!button) return
    const blocked = required && !status?.enrolled
    button.dataset.mfaBlocked = blocked ? 'true' : 'false'
    if (blocked) {
      button.disabled = true
      button.title = 'Set up administrator MFA before continuing.'
    } else if (!button.textContent?.includes('Saving')) {
      button.disabled = false
      button.removeAttribute('title')
    }
  }, [required, status?.enrolled, target])

  async function beginSetup() {
    setBusy(true)
    setError('')
    setRecoveryCodes([])
    try {
      const response = await fetch(`${API_BASE}/api/v1/mfa/setup`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not start authenticator setup.')
      setSetup(payload)
      setCode('')
    } catch (setupError) {
      setError(setupError.message)
    } finally {
      setBusy(false)
    }
  }

  async function confirmSetup() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/api/v1/mfa/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupToken: setup?.setupToken, code: code.trim() }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not verify the authenticator code.')
      setRecoveryCodes(payload.recoveryCodes || [])
      setSetup(null)
      setCode('')
      await loadStatus()
    } catch (confirmError) {
      setError(confirmError.message)
    } finally {
      setBusy(false)
    }
  }

  if (!target) return null

  return createPortal(
    <section className={`onboarding-mfa-card ${required ? 'is-required' : ''}`}>
      <div className="onboarding-mfa-heading">
        <span><ShieldCheck size={19} /></span>
        <div>
          <strong>Administrator authenticator MFA</strong>
          <p>{required ? 'Required before this onboarding step can continue.' : 'Optional for now. You can still enroll the owner account before continuing.'}</p>
        </div>
        <b>{status?.enrolled ? 'Enrolled' : required ? 'Required' : 'Optional'}</b>
      </div>

      {status?.enrolled ? (
        <div className="onboarding-mfa-success"><CheckCircle2 size={17} /> Authenticator verified. This tenant can safely continue onboarding.</div>
      ) : null}

      {!status?.enrolled && !setup ? (
        <button className="onboarding-mfa-primary" onClick={beginSetup} disabled={busy} type="button"><KeyRound size={16} /> Set up authenticator</button>
      ) : null}

      {setup ? (
        <div className="onboarding-mfa-setup">
          <div><strong>1. Add Hi5Central to your authenticator app</strong><p>Microsoft Authenticator, Google Authenticator, 1Password and other TOTP apps are supported.</p></div>
          <div className="onboarding-mfa-secret"><span>Setup key</span><code>{setup.secret}</code><small>{setup.account}</small><a href={setup.otpauthUri}>Open in authenticator app</a></div>
          <label><span>2. Enter the six-digit code</span><input autoComplete="one-time-code" inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} /></label>
          <button className="onboarding-mfa-primary" onClick={confirmSetup} disabled={busy || code.length !== 6} type="button"><CheckCircle2 size={16} /> Verify authenticator</button>
        </div>
      ) : null}

      {recoveryCodes.length ? (
        <div className="onboarding-mfa-recovery"><strong>Save these recovery codes now</strong><p>Each code can be used once if your authenticator is unavailable.</p><div>{recoveryCodes.map((item) => <code key={item}>{item}</code>)}</div></div>
      ) : null}

      {error ? <div className="onboarding-mfa-error">{error}</div> : null}
    </section>,
    target,
  )
}

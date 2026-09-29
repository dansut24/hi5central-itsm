import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, CheckCircle2, KeyRound, LockKeyhole, Mail, ShieldCheck, X } from 'lucide-react'
import './ProductionPasswordRecoveryEnhancer.css'

const API_BASE = window.__HI5_API_BASE__

function tenantSlugFromHost() {
  const host = window.location.hostname.toLowerCase()
  const match = host.match(/^([a-z0-9-]+)\.hi5central\.com$/)
  return match?.[1] || ''
}

function ResetScreen({ token, tenantSlug }) {
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('Password confirmation does not match.')
      return
    }
    setBusy(true)
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/password/reset`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug, token, newPassword: form.password }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not reset your password.')
      setDone(true)
    } catch (resetError) {
      setError(resetError.message)
    } finally {
      setBusy(false)
    }
  }

  function backToLogin() {
    window.history.replaceState({}, '', '/login')
    window.location.reload()
  }

  return (
    <div className="production-password-overlay">
      <div className="production-password-reset-card">
        <img src="/hi5central-logo.png" alt="" />
        {done ? (
          <div className="production-password-complete">
            <span><CheckCircle2 size={24} /></span>
            <h1>Password changed</h1>
            <p>Your existing sessions have been revoked. Sign in again using your new password and MFA if required.</p>
            <button onClick={backToLogin} type="button">Continue to sign in</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="production-password-heading">
              <span><LockKeyhole size={20} /></span>
              <div><small>Hi5Central security</small><h1>Choose a new password</h1><p>Your tenant password policy is checked by the authentication service before the password is accepted.</p></div>
            </div>
            <label><span>New password</span><input type="password" autoComplete="new-password" required value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label>
            <label><span>Confirm new password</span><input type="password" autoComplete="new-password" required value={form.confirm} onChange={(event) => setForm((current) => ({ ...current, confirm: event.target.value }))} /></label>
            {error ? <div className="production-password-error">{error}</div> : null}
            <button className="production-password-primary" disabled={busy} type="submit"><KeyRound size={17} /> {busy ? 'Changing password…' : 'Change password'}</button>
            <button className="production-password-back" onClick={backToLogin} type="button"><ArrowLeft size={15} /> Back to sign in</button>
          </form>
        )}
      </div>
    </div>
  )
}

export function ProductionPasswordRecoveryEnhancer() {
  const tenantSlug = useMemo(tenantSlugFromHost, [])
  const resetToken = useMemo(() => new URLSearchParams(window.location.search).get('token') || '', [])
  const resetOpen = window.location.pathname === '/reset-password' && Boolean(resetToken && tenantSlug)
  const [loginForm, setLoginForm] = useState(null)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (resetOpen) return undefined
    let mountedForm = null
    let forgotButton = null

    const detach = () => {
      forgotButton?.remove()
      forgotButton = null
      mountedForm = null
      setLoginForm(null)
    }

    const attach = () => {
      const form = document.querySelector('.production-auth-card')
      if (!(form instanceof HTMLFormElement)) {
        if (mountedForm) detach()
        return
      }
      if (form === mountedForm) return
      detach()
      mountedForm = form
      setLoginForm(form)

      const passwordInput = form.querySelector('input[type="password"]')
      const passwordLabel = passwordInput?.closest('label')
      if (!passwordLabel) return

      forgotButton = document.createElement('button')
      forgotButton.type = 'button'
      forgotButton.className = 'production-forgot-password-link'
      forgotButton.textContent = 'Forgot password?'
      forgotButton.addEventListener('click', () => {
        const currentEmail = form.querySelector('input[type="email"]')?.value || ''
        setEmail(currentEmail)
        setMessage('')
        setError('')
        setForgotOpen(true)
      })
      passwordLabel.insertAdjacentElement('afterend', forgotButton)
    }

    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    attach()
    return () => {
      observer.disconnect()
      detach()
    }
  }, [resetOpen])

  async function requestReset(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/password/forgot`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug, email: email.trim() }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not request a password reset.')
      setMessage(payload.message || 'If that account exists, a password reset email has been sent.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  if (resetOpen) return createPortal(<ResetScreen token={resetToken} tenantSlug={tenantSlug} />, document.body)
  if (!loginForm || !forgotOpen) return null

  return createPortal(
    <div className="production-password-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setForgotOpen(false) }}>
      <section className="production-password-modal" role="dialog" aria-modal="true" aria-labelledby="password-reset-title">
        <button className="production-password-close" onClick={() => setForgotOpen(false)} type="button" aria-label="Close"><X size={17} /></button>
        <span className="production-password-modal-icon"><Mail size={20} /></span>
        <small>Account recovery</small>
        <h2 id="password-reset-title">Reset your password</h2>
        <p>Enter the email address assigned to this Hi5Central tenant. For privacy, the response is the same whether or not an account exists.</p>
        <form onSubmit={requestReset}>
          <label><span>Email address</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          {message ? <div className="production-password-success"><ShieldCheck size={16} /> {message}</div> : null}
          {error ? <div className="production-password-error">{error}</div> : null}
          <button className="production-password-primary" disabled={busy || !email.trim()} type="submit">{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      </section>
    </div>,
    document.body,
  )
}

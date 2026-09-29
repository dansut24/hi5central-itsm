import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  KeyRound,
  Laptop,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react'
import './ProductionProfileSecurity.css'

const API_BASE = window.__HI5_API_BASE__

function formatDate(value) {
  if (!value) return '—'
  try { return new Date(value).toLocaleString('en-GB') } catch { return '—' }
}

function shortAgent(value) {
  const agent = String(value || '')
  if (!agent || agent === 'unknown') return 'Browser session'
  if (/iphone|ipad/i.test(agent)) return 'Safari on iPhone / iPad'
  if (/android/i.test(agent)) return 'Browser on Android'
  if (/windows/i.test(agent)) return 'Browser on Windows'
  if (/macintosh|mac os/i.test(agent)) return 'Browser on macOS'
  if (/linux/i.test(agent)) return 'Browser on Linux'
  return 'Browser session'
}

function Panel({ title, description, icon: Icon, action, children }) {
  return (
    <section className="production-profile-panel production-profile-security-panel">
      <header>
        <div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>
        {action || (Icon ? <Icon size={20} /> : null)}
      </header>
      <div className="production-profile-panel-body">{children}</div>
    </section>
  )
}

function RecoveryCodes({ codes }) {
  if (!Array.isArray(codes) || !codes.length) return null
  return (
    <div className="production-profile-recovery-codes">
      <strong>Save these recovery codes now</strong>
      <p>Each code works once. Store them in a secure password manager or another protected location.</p>
      <div>{codes.map((code) => <code key={code}>{code}</code>)}</div>
    </div>
  )
}

export function ProductionProfileSecurity() {
  const [mfa, setMfa] = useState(null)
  const [summary, setSummary] = useState(null)
  const [sessions, setSessions] = useState([])
  const [setup, setSetup] = useState(null)
  const [mfaCode, setMfaCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState(null)
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [removePassword, setRemovePassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...options })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Account security request failed.')
    return payload
  }

  async function loadAll({ quiet = false } = {}) {
    if (!quiet) setLoading(true)
    setError('')
    try {
      const [mfaPayload, summaryPayload, sessionsPayload] = await Promise.all([
        api('/api/v1/mfa/status'),
        api('/api/v1/security/summary'),
        api('/api/v1/security/sessions'),
      ])
      setMfa(mfaPayload)
      setSummary(summaryPayload)
      setSessions(sessionsPayload.items || [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  useEffect(() => { void loadAll() }, [])

  async function startSetup() {
    setLoading(true)
    setError('')
    setMessage('')
    setRecoveryCodes(null)
    try {
      const payload = await api('/api/v1/mfa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      setSetup(payload)
      setMfaCode('')
    } catch (setupError) {
      setError(setupError.message)
    } finally {
      setLoading(false)
    }
  }

  async function confirmSetup() {
    if (!setup?.setupToken || mfaCode.trim().length !== 6) return
    setLoading(true)
    setError('')
    try {
      const payload = await api('/api/v1/mfa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupToken: setup.setupToken, code: mfaCode.trim() }),
      })
      setMfa(payload)
      setRecoveryCodes(payload.recoveryCodes || null)
      setSetup(null)
      setMfaCode('')
      setMessage('Authenticator MFA enabled for your account.')
      await loadAll({ quiet: true })
    } catch (confirmError) {
      setError(confirmError.message)
    } finally {
      setLoading(false)
    }
  }

  async function regenerateRecoveryCodes() {
    if (mfaCode.trim().length !== 6) return
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const payload = await api('/api/v1/mfa/recovery-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: mfaCode.trim() }),
      })
      setRecoveryCodes(payload.recoveryCodes || [])
      setMfaCode('')
      setMessage('New recovery codes generated. Previous recovery codes are no longer valid.')
      await loadAll({ quiet: true })
    } catch (recoveryError) {
      setError(recoveryError.message)
    } finally {
      setLoading(false)
    }
  }

  async function changePassword(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    if (passwords.next !== passwords.confirm) {
      setError('New password confirmation does not match.')
      return
    }
    setLoading(true)
    try {
      await api('/api/v1/security/password/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.next }),
      })
      setPasswords({ current: '', next: '', confirm: '' })
      setMessage('Password changed. Every other session has been signed out.')
      await loadAll({ quiet: true })
    } catch (changeError) {
      setError(changeError.message)
    } finally {
      setLoading(false)
    }
  }

  async function revokeSession(id) {
    setMessage('')
    setError('')
    try {
      await api(`/api/v1/security/sessions/${encodeURIComponent(id)}/revoke`, { method: 'POST' })
      setMessage('Session revoked.')
      await loadAll({ quiet: true })
    } catch (revokeError) {
      setError(revokeError.message)
    }
  }

  async function revokeOthers() {
    setMessage('')
    setError('')
    try {
      const payload = await api('/api/v1/security/sessions/revoke-others', { method: 'POST' })
      setMessage(`${payload.revoked || 0} other session${payload.revoked === 1 ? '' : 's'} signed out.`)
      await loadAll({ quiet: true })
    } catch (revokeError) {
      setError(revokeError.message)
    }
  }

  async function removeAuthenticator(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    setLoading(true)
    try {
      await api('/api/v1/security/mfa/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: removePassword }),
      })
      setRemovePassword('')
      setSetup(null)
      setRecoveryCodes(null)
      setMfaCode('')
      setMessage('Authenticator removed from your account.')
      await loadAll({ quiet: true })
    } catch (removeError) {
      setError(removeError.message)
    } finally {
      setLoading(false)
    }
  }

  const activeSessions = useMemo(
    () => sessions.filter((item) => !item.revokedAt && new Date(item.expiresAt).getTime() > Date.now()),
    [sessions],
  )
  const policy = summary?.policy || {}

  return (
    <div className="production-profile-security-stack">
      <Panel
        title="Personal security"
        description="Security controls here apply only to your signed-in account. Tenant-wide security policy remains in Administration → Settings."
        icon={ShieldCheck}
        action={<button className="production-profile-security-refresh" onClick={() => loadAll()} disabled={loading} type="button" aria-label="Refresh personal security"><RefreshCw size={16} /></button>}
      >
        {loading && !summary ? <div className="production-profile-security-state">Checking your account security…</div> : null}
        <div className="production-profile-security-summary">
          <div><span>Tenant MFA policy</span><strong>{mfa?.requiredForCurrentUser ? 'Required for your role' : 'Optional for your role'}</strong></div>
          <div><span>Your authenticator</span><strong>{mfa?.enrolled ? 'Enrolled' : 'Not enrolled'}</strong></div>
          <div><span>Current session</span><strong>{mfa?.sessionVerified ? 'MFA verified' : 'Password session'}</strong></div>
          <div><span>Active sessions</span><strong>{summary?.activeSessions ?? activeSessions.length}</strong></div>
          <div><span>Last password change</span><strong>{formatDate(summary?.passwordChangedAt)}</strong></div>
        </div>
        {mfa?.requiredForCurrentUser && !mfa?.enrolled ? (
          <div className="production-profile-security-warning">
            <ShieldCheck size={18} />
            <div><strong>MFA is required for your role</strong><span>Set up your authenticator to continue meeting your tenant security policy.</span></div>
          </div>
        ) : null}
        {message ? <div className="production-profile-security-success"><CheckCircle2 size={16} /> {message}</div> : null}
        {error ? <div className="production-profile-security-error"><ShieldAlert size={16} /> {error}</div> : null}
      </Panel>

      <Panel title="My multi-factor authentication" description="Set up and manage the authenticator attached to your account." icon={ShieldCheck}>
        {!mfa?.enrolled && !setup ? (
          <button className="production-profile-security-primary" onClick={startSetup} disabled={loading} type="button">
            <KeyRound size={17} /> Set up authenticator
          </button>
        ) : null}

        {setup ? (
          <div className="production-profile-mfa-setup">
            <div><strong>1. Add Hi5Central to your authenticator</strong><p>Use Microsoft Authenticator, Google Authenticator, 1Password or another TOTP-compatible app.</p></div>
            <div className="production-profile-mfa-secret">
              <span>Setup key</span>
              <code>{setup.secret}</code>
              <small>{setup.account}</small>
              <a href={setup.otpauthUri}>Open in authenticator app</a>
            </div>
            <label><span>2. Enter the six-digit code</span><input autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} placeholder="000000" /></label>
            <button className="production-profile-security-primary" onClick={confirmSetup} disabled={loading || mfaCode.trim().length !== 6} type="button"><CheckCircle2 size={17} /> Verify and enable MFA</button>
          </div>
        ) : null}

        {mfa?.enrolled && !setup ? (
          <div className="production-profile-mfa-management">
            <div><strong>Authenticator is active</strong><p>{mfa.verifiedAt ? `Verified ${formatDate(mfa.verifiedAt)}.` : 'Your authenticator is verified.'} You have {mfa.recoveryCodesRemaining || 0} recovery codes remaining.</p></div>
            <label><span>Current six-digit authenticator code</span><input autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} placeholder="000000" /></label>
            <button onClick={regenerateRecoveryCodes} disabled={loading || mfaCode.trim().length !== 6} type="button">Generate new recovery codes</button>
          </div>
        ) : null}

        <RecoveryCodes codes={recoveryCodes} />

        {mfa?.enrolled ? (
          <form className="production-profile-security-danger" onSubmit={removeAuthenticator}>
            <div><strong>Remove my authenticator</strong><span>{mfa.requiredForCurrentUser ? 'Your tenant policy currently requires MFA for your role, so removal is blocked until an administrator changes that policy.' : 'Removing MFA signs out your other sessions and deletes your authenticator secret and recovery codes.'}</span></div>
            <input type="password" autoComplete="current-password" placeholder="Confirm your password" value={removePassword} onChange={(event) => setRemovePassword(event.target.value)} />
            <button disabled={loading || !removePassword || mfa.requiredForCurrentUser} type="submit"><ShieldAlert size={15} /> Remove</button>
          </form>
        ) : null}
      </Panel>

      <Panel title="My password" description={`Your new password must satisfy the tenant ${policy.passwordPolicy === 'standard' ? 'standard' : 'strong'} password policy.`} icon={LockKeyhole}>
        <form className="production-profile-password-form" onSubmit={changePassword}>
          <label><span>Current password</span><input type="password" autoComplete="current-password" value={passwords.current} onChange={(event) => setPasswords((current) => ({ ...current, current: event.target.value }))} required /></label>
          <label><span>New password</span><input type="password" autoComplete="new-password" value={passwords.next} onChange={(event) => setPasswords((current) => ({ ...current, next: event.target.value }))} required /></label>
          <label><span>Confirm new password</span><input type="password" autoComplete="new-password" value={passwords.confirm} onChange={(event) => setPasswords((current) => ({ ...current, confirm: event.target.value }))} required /></label>
          <button className="production-profile-security-primary" disabled={loading} type="submit"><KeyRound size={16} /> Change my password</button>
        </form>
      </Panel>

      <Panel title="My active sessions" description="Review where your account is signed in and revoke sessions you no longer recognise." icon={Laptop}>
        <div className="production-profile-session-actions"><button onClick={revokeOthers} type="button" disabled={activeSessions.length <= 1}>Sign out everywhere else</button></div>
        <div className="production-profile-sessions">
          {sessions.length ? sessions.map((item) => (
            <article className={`production-profile-session ${item.current ? 'is-current' : ''} ${item.revokedAt ? 'is-revoked' : ''}`} key={item.id}>
              <span className="production-profile-session-icon">{/iphone|ipad|android/i.test(item.userAgent || '') ? <Smartphone size={18} /> : <Laptop size={18} />}</span>
              <div><strong>{shortAgent(item.userAgent)} {item.current ? '· This device' : ''}</strong><small>Last active {formatDate(item.lastSeenAt)} · Created {formatDate(item.createdAt)}</small><small>{item.ipAddress || 'IP not recorded'} · {item.mfaVerified ? 'MFA verified' : 'Password session'}</small></div>
              <div className="production-profile-session-state"><span>{item.revokedAt ? 'Ended' : new Date(item.expiresAt).getTime() <= Date.now() ? 'Expired' : 'Active'}</span>{!item.current && !item.revokedAt && new Date(item.expiresAt).getTime() > Date.now() ? <button onClick={() => revokeSession(item.id)} type="button"><Trash2 size={14} /> Revoke</button> : null}</div>
            </article>
          )) : <div className="production-profile-security-state">No session history is available yet.</div>}
        </div>
      </Panel>
    </div>
  )
}

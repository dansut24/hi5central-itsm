import { useEffect, useState } from 'react'
import { Clock3, RefreshCw, ShieldAlert } from 'lucide-react'
import './ProductionTenantSecurityAudit.css'

const API_BASE = window.__HI5_API_BASE__

function formatDate(value) {
  if (!value) return '—'
  try { return new Date(value).toLocaleString('en-GB') } catch { return '—' }
}

function eventLabel(type) {
  const labels = {
    'security.policy_changed': 'Security policy changed',
    'password.changed': 'Password changed',
    'password.change': 'Password change failed',
    'password.reset_requested': 'Password reset requested',
    'password.reset_completed': 'Password reset completed',
    'sessions.revoked_others': 'Other sessions revoked',
    'session.revoked': 'Session revoked',
    'mfa.removed': 'Authenticator removed',
  }
  return labels[type] || String(type || '').replaceAll('.', ' ')
}

export function ProductionTenantSecurityAudit() {
  const [audit, setAudit] = useState({ items: [], retentionDays: 365 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadAudit() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/api/v1/security/audit?limit=80`, { credentials: 'include' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not load the tenant security audit.')
      setAudit(payload)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadAudit() }, [])

  return (
    <section className="production-settings-panel production-tenant-security-audit">
      <header>
        <div>
          <h2>Tenant security audit</h2>
          <p>Administrative security and account events retained according to the tenant audit policy.</p>
        </div>
        <div className="production-tenant-security-audit-actions">
          <Clock3 size={18} />
          <button onClick={loadAudit} disabled={loading} type="button" aria-label="Refresh tenant security audit"><RefreshCw size={15} /></button>
        </div>
      </header>
      <div className="production-settings-panel-body">
        <div className="production-tenant-security-audit-meta">
          <span>Retention</span><strong>{audit.retentionDays || 365} days</strong>
        </div>
        {loading && !audit.items?.length ? <div className="production-tenant-security-audit-state">Loading tenant security events…</div> : null}
        {error ? <div className="production-tenant-security-audit-error"><ShieldAlert size={15} /> {error}</div> : null}
        {!error ? (
          <div className="production-tenant-security-audit-list">
            {audit.items?.length ? audit.items.map((item) => (
              <article key={item.id}>
                <span className={`production-tenant-security-audit-dot is-${item.outcome || 'success'}`} />
                <div>
                  <strong>{eventLabel(item.type)}</strong>
                  <small>{item.actor} · {formatDate(item.createdAt)}</small>
                  <small>{item.ipAddress || 'IP not recorded'} · {item.outcome}</small>
                </div>
              </article>
            )) : !loading ? <div className="production-tenant-security-audit-state">No tenant security events have been recorded yet.</div> : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}

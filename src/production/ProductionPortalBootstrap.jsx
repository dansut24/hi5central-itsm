import { useEffect, useMemo, useState } from 'react'
import { resolveTenantSurface } from '../lib/tenantSurface.js'
import { ProductionRequesterPortalV2 } from './ProductionRequesterPortalV2.jsx'
import './ProductionPortalBootstrap.css'

const API_BASE = window.__HI5_API_BASE__

function normalizeFieldOption(option) {
  if (option && typeof option === 'object' && !Array.isArray(option)) return option
  const value = String(option ?? '').trim()
  return value ? { value, label: value } : null
}

function normalizeCatalogue(payload) {
  return {
    ...payload,
    items: payload.items.map((item) => ({
      ...item,
      fields: (Array.isArray(item.fields) ? item.fields : []).map((field) => {
        if (!Array.isArray(field?.options)) return field
        return {
          ...field,
          options: field.options.map(normalizeFieldOption).filter(Boolean),
        }
      }),
    })),
  }
}

function PortalBootstrapState({ error, onRetry, tenantName }) {
  return (
    <main className="production-portal-bootstrap">
      <section>
        <img src="/hi5central-logo.png" alt="Hi5Central" />
        <span>{tenantName}</span>
        {error ? (
          <>
            <h1>We couldn’t load the Help Centre.</h1>
            <p>{error}</p>
            <button onClick={onRetry} type="button">Try again</button>
          </>
        ) : (
          <>
            <h1>Opening your Help Centre…</h1>
            <p>Loading the services published for your organisation.</p>
          </>
        )}
      </section>
    </main>
  )
}

export function ProductionPortalBootstrap() {
  const surface = useMemo(() => resolveTenantSurface(), [])
  const [state, setState] = useState({ status: 'loading', attempt: 0, error: '', managed: true, catalogue: null })

  useEffect(() => {
    let active = true

    async function load() {
      setState((current) => ({ ...current, status: 'loading', error: '' }))
      try {
        const response = await fetch(`${API_BASE}/api/v1/portal/catalogue/${encodeURIComponent(surface.tenantSlug)}`)
        const payload = await response.json().catch(() => ({}))

        if (response.status === 404 || payload.managed === false) {
          if (active) setState((current) => ({ ...current, status: 'ready', managed: false, catalogue: null, error: '' }))
          return
        }

        if (!response.ok) throw new Error(payload.error || 'The service catalogue is temporarily unavailable.')
        if (!Array.isArray(payload.items)) throw new Error('The service catalogue response was invalid.')

        const catalogue = normalizeCatalogue(payload)
        if (active) setState((current) => ({ ...current, status: 'ready', managed: true, catalogue, error: '' }))
      } catch (error) {
        if (active) setState((current) => ({ ...current, status: 'error', error: error.message || 'The service catalogue is temporarily unavailable.' }))
      }
    }

    load()
    return () => { active = false }
  }, [state.attempt, surface.tenantSlug])

  if (state.status !== 'ready') {
    return (
      <PortalBootstrapState
        error={state.status === 'error' ? state.error : ''}
        onRetry={() => setState((current) => ({ ...current, attempt: current.attempt + 1 }))}
        tenantName={surface.tenantName || surface.tenantSlug}
      />
    )
  }

  if (!state.managed) return <PortalBootstrapState error="This Help Centre is not configured for this tenant." onRetry={() => setState((current) => ({ ...current, attempt: current.attempt + 1 }))} tenantName={surface.tenantName || surface.tenantSlug} />

  return (
    <ProductionRequesterPortalV2
      catalogue={state.catalogue || { items: [], categories: [] }}
      tenant={state.catalogue?.tenant || { slug: surface.tenantSlug, companyName: surface.tenantName || surface.tenantSlug }}
    />
  )
}

import { useEffect, useMemo, useState } from 'react'
import { ProductionRequesterPortal } from './ProductionRequesterPortal.jsx'

const API_BASE = window.__HI5_API_BASE__

function normalOption(option) {
  if (option && typeof option === 'object' && !Array.isArray(option)) {
    const value = String(option.value ?? option.label ?? '')
    return value ? { ...option, value, label: option.label || value } : null
  }
  const value = String(option ?? '').trim()
  return value ? { value, label: value } : null
}

function optionsForSource(source, lookups) {
  if (source === 'people') return lookups.people || []
  if (source === 'departments') return lookups.departments || []
  if (source === 'sites') return lookups.sites || []
  if (source === 'teams') return lookups.teams || []
  if (source === 'catalogue-products') return lookups.products || []
  return []
}

function hydrateField(field, lookups) {
  if (!field || field.type === 'section') return null
  if (field.type === 'lookup') {
    return { ...field, type: 'select', options: optionsForSource(field.source, lookups).map(normalOption).filter(Boolean) }
  }
  if (field.type === 'multiselect') {
    return { ...field, type: 'checkbox-products', options: (field.options || []).map(normalOption).filter(Boolean) }
  }
  if (['product', 'checkbox-products'].includes(field.type) && field.source === 'catalogue-products') {
    let options = optionsForSource(field.source, lookups)
    const category = String(field.sourceFilter?.category || '').trim().toLowerCase()
    if (category) options = options.filter((option) => String(option.category || '').toLowerCase() === category)
    return { ...field, options: options.map(normalOption).filter(Boolean) }
  }
  return { ...field, options: Array.isArray(field.options) ? field.options.map(normalOption).filter(Boolean) : field.options }
}

function hydratedCatalogue(catalogue, lookups) {
  return {
    ...catalogue,
    items: (catalogue?.items || []).map((item) => ({
      ...item,
      fields: (item.fields || []).map((field) => hydrateField(field, lookups)).filter(Boolean),
    })),
  }
}

export function ProductionRequesterPortalV2({ catalogue, tenant }) {
  const [lookups, setLookups] = useState({ people: [], departments: [], sites: [], teams: [], products: [] })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    let timer = 0
    let attempts = 0

    async function load() {
      attempts += 1
      try {
        const response = await fetch(`${API_BASE}/api/v1/portal/catalogue/${encodeURIComponent(tenant.slug)}/options`, { credentials: 'include', cache: 'no-store' })
        if (response.ok) {
          const payload = await response.json().catch(() => ({}))
          if (active) {
            setLookups({
              people: Array.isArray(payload.people) ? payload.people : [],
              departments: Array.isArray(payload.departments) ? payload.departments : [],
              sites: Array.isArray(payload.sites) ? payload.sites : [],
              teams: Array.isArray(payload.teams) ? payload.teams : [],
              products: Array.isArray(payload.products) ? payload.products : [],
            })
            setLoaded(true)
          }
          return
        }
      } catch {
        // Portal authentication can legitimately be absent while the login screen is open.
      }
      if (active && attempts < 180) timer = window.setTimeout(load, 1000)
    }

    load()
    const refresh = () => { attempts = 0; window.clearTimeout(timer); load() }
    window.addEventListener('focus', refresh)
    return () => { active = false; window.clearTimeout(timer); window.removeEventListener('focus', refresh) }
  }, [tenant.slug])

  const resolved = useMemo(() => hydratedCatalogue(catalogue, lookups), [catalogue, lookups])

  return <ProductionRequesterPortal catalogue={resolved} tenant={{ ...tenant, catalogueLookupsLoaded: loaded }} />
}

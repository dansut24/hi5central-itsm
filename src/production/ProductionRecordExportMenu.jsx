import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Download, LoaderCircle } from 'lucide-react'
import { RECORD_EXPORT_FORMATS } from '../lib/recordExport.js'
import './ProductionRecordExportMenu.css'

const LIST_SCOPES = [
  { id: 'selected', label: 'Selected records', description: 'Only records you selected' },
  { id: 'current', label: 'Current view', description: 'Current search and filters' },
  { id: 'all', label: 'All records', description: 'Every record in this queue' },
]

export function ProductionRecordExportMenu({ onExport, compact = false, className = '', listMode = false, selectedCount = 0 }) {
  const [busy, setBusy] = useState('')
  const [scope, setScope] = useState(selectedCount ? 'selected' : 'current')
  const detailsRef = useRef(null)

  useEffect(() => {
    if (!selectedCount && scope === 'selected') setScope('current')
  }, [scope, selectedCount])

  async function run(format) {
    if (busy) return
    setBusy(format)
    try {
      await onExport(format, listMode ? scope : 'record')
      if (detailsRef.current) detailsRef.current.open = false
    } finally {
      setBusy('')
    }
  }

  return (
    <details ref={detailsRef} className={`hi5-record-export-menu${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}>
      <summary title="Export"><Download size={16} /><span>Export</span><ChevronDown size={13} /></summary>
      <div className="hi5-record-export-popover">
        <header><strong>Export</strong><span>{listMode ? 'Choose what to export, then a format' : 'Download this record'}</span></header>
        {listMode ? <section className="hi5-record-export-scopes" aria-label="Export scope">
          {LIST_SCOPES.map((item) => {
            const disabled = item.id === 'selected' && selectedCount === 0
            return <button type="button" key={item.id} disabled={disabled || Boolean(busy)} className={scope === item.id ? 'is-active' : ''} onClick={() => !disabled && setScope(item.id)}>
              <i>{scope === item.id ? <Check size={11} /> : null}</i>
              <span><strong>{item.label}{item.id === 'selected' && selectedCount ? ` (${selectedCount})` : ''}</strong><small>{disabled ? 'Select one or more records first' : item.description}</small></span>
            </button>
          })}
        </section> : null}
        <div className="hi5-record-export-formats">
          {RECORD_EXPORT_FORMATS.map((format) => (
            <button type="button" key={format.id} disabled={Boolean(busy)} onClick={() => run(format.id)}>
              <span><strong>{format.label}</strong><small>{format.description}</small></span>
              {busy === format.id ? <LoaderCircle className="is-spinning" size={15} /> : <Download size={15} />}
            </button>
          ))}
        </div>
      </div>
    </details>
  )
}

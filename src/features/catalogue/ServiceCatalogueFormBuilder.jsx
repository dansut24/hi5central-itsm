import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, Plus, Trash2 } from 'lucide-react'
import './ServiceCatalogueFormBuilder.css'

const FIELD_TYPES = [
  ['section', 'Section heading'],
  ['text', 'Short text'],
  ['textarea', 'Long text'],
  ['date', 'Date'],
  ['datetime-local', 'Date & time'],
  ['email', 'Email address'],
  ['number', 'Number'],
  ['checkbox', 'Yes / no checkbox'],
  ['select', 'Choice'],
  ['multiselect', 'Multiple choice'],
  ['person', 'Person'],
  ['department', 'Department'],
  ['site', 'Site'],
  ['team', 'Team'],
  ['product', 'Catalogue product'],
  ['checkbox-products', 'Multiple catalogue products'],
]

const SOURCE_BY_TYPE = {
  person: 'people',
  department: 'departments',
  site: 'sites',
  team: 'teams',
  product: 'catalogue-products',
  'checkbox-products': 'catalogue-products',
}

function fieldType(field) {
  const source = String(field?.source || '')
  if (field?.type === 'lookup') {
    if (source === 'people') return 'person'
    if (source === 'departments') return 'department'
    if (source === 'sites') return 'site'
    if (source === 'teams') return 'team'
  }
  return field?.type || 'text'
}

function storedType(type) {
  return SOURCE_BY_TYPE[type] && !['product', 'checkbox-products'].includes(type) ? 'lookup' : type
}

function slug(value = '') {
  const compact = String(value)
    .trim()
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, next) => next ? next.toUpperCase() : '')
    .replace(/^[A-Z]/, (letter) => letter.toLowerCase())
  return compact || `field${Date.now().toString().slice(-5)}`
}

function optionsText(field) {
  return (Array.isArray(field.options) ? field.options : [])
    .map((option) => typeof option === 'object' ? option.label || option.value : option)
    .filter(Boolean)
    .join('\n')
}

function optionsFromText(value) {
  return String(value || '').split('\n').map((item) => item.trim()).filter(Boolean)
}

function normaliseField(raw = {}, index = 0) {
  return {
    id: raw.id || `field${index + 1}`,
    label: raw.label || `Field ${index + 1}`,
    type: raw.type || 'text',
    source: raw.source || '',
    required: raw.type === 'section' ? false : Boolean(raw.required),
    help: raw.help || '',
    placeholder: raw.placeholder || '',
    checkboxLabel: raw.checkboxLabel || '',
    options: Array.isArray(raw.options) ? raw.options : [],
    showWhen: raw.showWhen && typeof raw.showWhen === 'object' ? raw.showWhen : null,
  }
}

function previewValue(field) {
  const type = fieldType(field)
  if (type === 'section') return null
  if (['person', 'department', 'site', 'team'].includes(type)) return <select disabled><option>Loaded from your organisation</option></select>
  if (['product', 'checkbox-products'].includes(type)) return <select disabled><option>Loaded from the Service Catalogue</option></select>
  if (type === 'textarea') return <textarea disabled rows="3" placeholder={field.placeholder || 'Long answer'} />
  if (type === 'select') return <select disabled><option>{optionsText(field).split('\n')[0] || 'Choose…'}</option></select>
  if (type === 'multiselect') return <div className="form-builder-preview-checks"><span>☐ Choice one</span><span>☐ Choice two</span></div>
  if (type === 'checkbox') return <div className="form-builder-preview-checks"><span>☐ {field.checkboxLabel || field.help || 'Yes'}</span></div>
  return <input disabled placeholder={field.placeholder || (type === 'date' ? 'DD/MM/YYYY' : 'Answer')} />
}

export function ServiceCatalogueFormBuilder({ value, onChange }) {
  const fields = useMemo(() => (Array.isArray(value) ? value : []).map(normaliseField), [value])
  const [expanded, setExpanded] = useState('')
  const [preview, setPreview] = useState(false)

  function commit(next) {
    onChange(next.map((field) => {
      const type = fieldType(field)
      const payload = {
        id: field.id,
        label: field.label,
        type: storedType(type),
        required: type === 'section' ? false : Boolean(field.required),
      }
      if (SOURCE_BY_TYPE[type]) payload.source = SOURCE_BY_TYPE[type]
      if (field.help) payload.help = field.help
      if (field.placeholder) payload.placeholder = field.placeholder
      if (field.checkboxLabel) payload.checkboxLabel = field.checkboxLabel
      if (['select', 'multiselect'].includes(type) && field.options?.length) payload.options = field.options
      if (field.showWhen?.field) payload.showWhen = field.showWhen
      return payload
    }))
  }

  function update(index, patch) {
    const next = fields.map((field, position) => position === index ? { ...field, ...patch } : field)
    commit(next)
  }

  function updateType(index, type) {
    const current = fields[index]
    const next = { ...current, type: storedType(type), source: SOURCE_BY_TYPE[type] || '', required: type === 'section' ? false : current.required }
    if (!['select', 'multiselect'].includes(type)) next.options = []
    update(index, next)
  }

  function addField(type = 'text') {
    const label = type === 'section' ? 'New section' : 'New field'
    const field = normaliseField({ id: slug(`${label}${fields.length + 1}`), label, type: storedType(type), source: SOURCE_BY_TYPE[type] || '' }, fields.length)
    const next = [...fields, field]
    commit(next)
    setExpanded(field.id)
  }

  function remove(index) {
    const removed = fields[index]
    const next = fields.filter((_, position) => position !== index).map((field) => {
      if (field.showWhen?.field === removed.id) return { ...field, showWhen: null }
      return field
    })
    commit(next)
    if (expanded === removed.id) setExpanded('')
  }

  function move(index, direction) {
    const target = index + direction
    if (target < 0 || target >= fields.length) return
    const next = [...fields]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    commit(next)
  }

  function updateLabel(index, label) {
    const field = fields[index]
    const generated = /^field\d+$/.test(field.id) || /^newField\d*$/i.test(field.id)
    update(index, { label, id: generated ? slug(label) : field.id })
  }

  const conditionCandidates = (index) => fields.slice(0, index).filter((field) => fieldType(field) !== 'section')

  return (
    <div className="catalogue-form-builder">
      <header className="form-builder-header">
        <div><span>Request form</span><strong>Questions shown to the requester</strong><small>Keep forms short. Use sections and simple conditions only where they make the request easier to complete.</small></div>
        <div className="form-builder-header-actions"><button className="secondary-action" onClick={() => setPreview((current) => !current)} type="button"><Eye size={16} /> {preview ? 'Edit form' : 'Preview'}</button><button className="secondary-action" onClick={() => addField('text')} type="button"><Plus size={16} /> Add field</button></div>
      </header>

      {preview ? (
        <div className="form-builder-preview">
          {!fields.length ? <div className="form-builder-empty">No request fields yet.</div> : fields.map((field) => fieldType(field) === 'section' ? (
            <div className="form-builder-preview-section" key={field.id}><strong>{field.label}</strong>{field.help ? <span>{field.help}</span> : null}</div>
          ) : (
            <label key={field.id}><span>{field.label}{field.required ? ' *' : ''}</span>{previewValue(field)}{field.help ? <small>{field.help}</small> : null}</label>
          ))}
        </div>
      ) : (
        <div className="form-builder-list">
          {!fields.length ? <div className="form-builder-empty"><strong>No questions yet</strong><span>Add only the information IT actually needs to fulfil this request.</span></div> : null}
          {fields.map((field, index) => {
            const type = fieldType(field)
            const open = expanded === field.id
            const candidates = conditionCandidates(index)
            const conditionField = candidates.find((candidate) => candidate.id === field.showWhen?.field)
            const conditionOptions = conditionField ? (Array.isArray(conditionField.options) ? conditionField.options : []) : []
            return (
              <article className={`form-builder-row ${type === 'section' ? 'is-section' : ''}`} key={`${field.id}-${index}`}>
                <div className="form-builder-row-summary" onClick={() => setExpanded(open ? '' : field.id)} role="button" tabIndex="0">
                  <span className="form-builder-order">{type === 'section' ? '§' : index + 1}</span>
                  <div><strong>{field.label || 'Untitled field'}</strong><small>{FIELD_TYPES.find(([id]) => id === type)?.[1] || type}{field.required ? ' · Required' : ''}{field.showWhen?.field ? ' · Conditional' : ''}</small></div>
                  <div className="form-builder-row-actions" onClick={(event) => event.stopPropagation()}>
                    <button aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)} type="button"><ArrowUp size={15} /></button>
                    <button aria-label="Move down" disabled={index === fields.length - 1} onClick={() => move(index, 1)} type="button"><ArrowDown size={15} /></button>
                    <button aria-label="Delete field" onClick={() => remove(index)} type="button"><Trash2 size={15} /></button>
                  </div>
                </div>
                {open ? (
                  <div className="form-builder-editor">
                    <div className="catalogue-form-grid two">
                      <label>Field type<select value={type} onChange={(event) => updateType(index, event.target.value)}>{FIELD_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
                      <label>Field ID<input value={field.id} onChange={(event) => update(index, { id: slug(event.target.value) })} /></label>
                    </div>
                    <label>{type === 'section' ? 'Section title' : 'Label'}<input value={field.label} onChange={(event) => updateLabel(index, event.target.value)} /></label>
                    <label>Help text<input value={field.help} onChange={(event) => update(index, { help: event.target.value })} placeholder="Optional guidance shown below the field" /></label>
                    {!['section', 'checkbox'].includes(type) ? <label>Placeholder<input value={field.placeholder} onChange={(event) => update(index, { placeholder: event.target.value })} placeholder="Optional example or hint" /></label> : null}
                    {type === 'checkbox' ? <label>Checkbox text<input value={field.checkboxLabel} onChange={(event) => update(index, { checkboxLabel: event.target.value })} placeholder="For example: I confirm this is required" /></label> : null}
                    {['select', 'multiselect'].includes(type) ? <label>Choices<textarea rows="5" value={optionsText(field)} onChange={(event) => update(index, { options: optionsFromText(event.target.value) })} placeholder={'One choice per line\nChoice two\nChoice three'} /></label> : null}
                    {SOURCE_BY_TYPE[type] ? <div className="form-builder-source-note"><strong>Live data source</strong><span>This field uses the tenant’s current {SOURCE_BY_TYPE[type].replace('catalogue-', 'catalogue ')}. Values are resolved when the form is opened.</span></div> : null}
                    {type !== 'section' ? <label className="catalogue-toggle"><input checked={field.required} onChange={(event) => update(index, { required: event.target.checked })} type="checkbox" /><span><strong>Required</strong><small>The request cannot be submitted while this visible field is empty.</small></span></label> : null}
                    {type !== 'section' && candidates.length ? (
                      <div className="form-builder-condition">
                        <label className="catalogue-toggle"><input checked={Boolean(field.showWhen?.field)} onChange={(event) => update(index, { showWhen: event.target.checked ? { field: candidates[0].id, equals: '' } : null })} type="checkbox" /><span><strong>Show this field only when…</strong><small>Keep conditional forms simple by using an answer from an earlier field.</small></span></label>
                        {field.showWhen?.field ? <div className="catalogue-form-grid two"><label>Earlier field<select value={field.showWhen.field} onChange={(event) => update(index, { showWhen: { field: event.target.value, equals: '' } })}>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</select></label><label>Equals{conditionOptions.length ? <select value={field.showWhen.equals ?? ''} onChange={(event) => update(index, { showWhen: { field: field.showWhen.field, equals: event.target.value } })}><option value="">Choose…</option>{conditionOptions.map((option) => { const value = typeof option === 'object' ? option.value : option; const label = typeof option === 'object' ? option.label || option.value : option; return <option key={value} value={value}>{label}</option> })}</select> : <input value={field.showWhen.equals ?? ''} onChange={(event) => update(index, { showWhen: { field: field.showWhen.field, equals: event.target.value } })} placeholder="Value" />}</label></div> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            )
          })}
          <div className="form-builder-add-row"><button onClick={() => addField('text')} type="button"><Plus size={15} /> Question</button><button onClick={() => addField('section')} type="button"><Plus size={15} /> Section</button></div>
        </div>
      )}
    </div>
  )
}

import { useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import './Hi5EntityTypeahead.css'

function defaultInitials(value = '') {
  return String(value || 'H').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'HC'
}

export function Hi5EntityTypeahead({
  items = [],
  value = null,
  onSelect,
  placeholder = 'Start typing to search…',
  minimumCharacters = 2,
  maxResults = 8,
  getKey = (item) => item?.id || item?.email || item?.name,
  getLabel = (item) => item?.name || '',
  getMeta = (item) => [item?.jobTitle, item?.email].filter(Boolean).join(' · '),
  getSearchText = (item) => [item?.name, item?.email, item?.staffNumber, item?.jobTitle, item?.team, item?.department].filter(Boolean).join(' '),
  renderAvatar = (item) => defaultInitials(item?.name),
  emptyLabel = 'No matching results',
  className = '',
  disabled = false,
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const blurTimer = useRef(0)
  const normalized = query.trim().toLowerCase()
  const searched = normalized.length >= minimumCharacters
  const results = useMemo(() => {
    if (!searched) return []
    return items.filter((item) => getSearchText(item).toLowerCase().includes(normalized)).slice(0, maxResults)
  }, [getSearchText, items, maxResults, normalized, searched])

  const choose = (item) => {
    window.clearTimeout(blurTimer.current)
    onSelect?.(item)
    setQuery('')
    setOpen(false)
    setActiveIndex(0)
  }

  const clear = () => {
    onSelect?.(null)
    setQuery('')
    setOpen(false)
    setActiveIndex(0)
  }

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false)
      setQuery('')
      return
    }
    if (!searched || !results.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => Math.min(results.length - 1, index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => Math.max(0, index - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(results[activeIndex] || results[0])
    }
  }
  return <div className={`hi5-entity-typeahead ${className}`.trim()}>
    {value ? <div className="hi5-entity-selected">
      <span className="hi5-entity-avatar">{renderAvatar(value)}</span>
      <span className="hi5-entity-selected-copy"><strong>{getLabel(value)}</strong><small>{getMeta(value)}</small></span>
      {!disabled ? <button type="button" onClick={clear} aria-label={`Clear ${getLabel(value)}`}><X size={14} /></button> : null}
    </div> : <div className="hi5-entity-input-shell">
      <Search size={15} />
      <input
        type="search"
        value={query}
        disabled={disabled}
        autoComplete="off"
        placeholder={placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && searched}
        onFocus={() => { if (searched) setOpen(true) }}
        onBlur={() => { blurTimer.current = window.setTimeout(() => setOpen(false), 140) }}
        onChange={(event) => {
          const next = event.target.value
          setQuery(next)
          setActiveIndex(0)
          setOpen(next.trim().length >= minimumCharacters)
        }}
        onKeyDown={onKeyDown}
      />
    </div>}
    {!value && open && searched ? <div className="hi5-entity-results" role="listbox">
      {results.length ? results.map((item, index) => <button
        type="button"
        role="option"
        aria-selected={index === activeIndex}
        className={index === activeIndex ? 'is-active' : ''}
        key={getKey(item)}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => choose(item)}
      >
        <span className="hi5-entity-avatar">{renderAvatar(item)}</span>
        <span><strong>{getLabel(item)}</strong><small>{getMeta(item)}</small></span>
      </button>) : <div className="hi5-entity-empty">{emptyLabel}</div>}
    </div> : null}
  </div>
}

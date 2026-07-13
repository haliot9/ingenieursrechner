import { useEffect, useRef, useState } from 'react'
import { useCalculatorStore } from '../store/calculator-store'
import { getAllModules } from '../modules'

export function ModuleSelector() {
  const { activeModuleId, setModule } = useCalculatorStore()
  const modules = getAllModules()
  const activeModule = modules.find(module => module.id === activeModuleId)
  const [query, setQuery] = useState(activeModule?.name ?? '')
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const rootRef = useRef<HTMLElement>(null)
  const listboxId = 'module-picker-options'
  const filteredModules = modules.filter(module => {
    const needle = query.trim().toLocaleLowerCase('de-DE')
    return !needle || `${module.name} ${module.description}`.toLocaleLowerCase('de-DE').includes(needle)
  })

  useEffect(() => {
    const closeWhenOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setHighlightedIndex(-1)
        setQuery(activeModule?.name ?? '')
      }
    }
    document.addEventListener('mousedown', closeWhenOutside)
    return () => document.removeEventListener('mousedown', closeWhenOutside)
  }, [activeModule?.name])

  const selectModule = (moduleId: string) => {
    const module = modules.find(candidate => candidate.id === moduleId)
    if (!module) return
    setModule(moduleId)
    setQuery(module.name)
    setOpen(false)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      setHighlightedIndex(-1)
      setQuery(activeModule?.name ?? '')
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (filteredModules.length === 0) return
      setHighlightedIndex(current => {
        const start = current === -1 ? (event.key === 'ArrowDown' ? 0 : filteredModules.length - 1) : current
        return event.key === 'ArrowDown'
          ? Math.min(start + (current === -1 ? 0 : 1), filteredModules.length - 1)
          : Math.max(start - (current === -1 ? 0 : 1), 0)
      })
      return
    }
    if (event.key === 'Enter' && open) {
      const candidate = filteredModules[highlightedIndex] ?? filteredModules[0]
      if (candidate) {
        event.preventDefault()
        selectModule(candidate.id)
      }
    }
  }

  return (
    <nav className="module-nav" aria-label="Rechnermodule" ref={rootRef}>
      <label className="sr-only" htmlFor="module-search">Rechnermodul suchen</label>
      <input
        id="module-search"
        type="search"
        className="module-search"
        value={query}
        placeholder={activeModule?.name ?? 'Rechnermodul suchen'}
        role="searchbox"
        aria-label="Rechnermodul suchen"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-activedescendant={highlightedIndex >= 0 ? `module-option-${filteredModules[highlightedIndex]?.id}` : undefined}
        onFocus={event => { event.currentTarget.select(); setOpen(true) }}
        onChange={event => { setQuery(event.target.value); setOpen(true); setHighlightedIndex(-1) }}
        onKeyDown={handleKeyDown}
      />
      {open && (
        <div id={listboxId} className="module-options" role="listbox" aria-label="Gefilterte Rechnermodule">
          {filteredModules.length === 0 ? (
            <p className="module-empty">Kein Modul gefunden</p>
          ) : filteredModules.map((module, index) => (
            <button
              id={`module-option-${module.id}`}
              className="module-option"
              key={module.id}
              role="option"
              aria-label={module.name}
              aria-selected={module.id === activeModuleId}
              data-highlighted={index === highlightedIndex || undefined}
              onClick={() => selectModule(module.id)}
              type="button"
            >
              <strong>{module.name}</strong>
              <small>{module.description}</small>
            </button>
          ))}
        </div>
      )}
    </nav>
  )
}

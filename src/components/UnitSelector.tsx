import { useCalculatorStore } from '../store/calculator-store'

interface UnitSelectorProps {
  variableId: string
  defaultUnit: string
  alternatives: string[]
}

export function UnitSelector({ variableId, defaultUnit, alternatives }: UnitSelectorProps) {
  const { setUnit, values } = useCalculatorStore()
  const currentUnit = values[variableId]?.unit ?? defaultUnit

  if (!defaultUnit && alternatives.length === 0) {
    return <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>—</span>
  }

  const allUnits = [defaultUnit, ...alternatives].filter(Boolean)

  if (allUnits.length <= 1) {
    return <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{defaultUnit || '—'}</span>
  }

  return (
    <select
      value={currentUnit}
      onChange={(e) => setUnit(variableId, e.target.value)}
      aria-label={`Einheit für ${variableId}`}
      className="unit-select"
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
      }}
    >
      {allUnits.map(u => (
        <option key={u} value={u}>{u}</option>
      ))}
    </select>
  )
}

import { useState, useCallback } from 'react'
import { useCalculatorStore } from '../store/calculator-store'

interface ValueInputProps {
  variableId: string
}

function formatDisplayValue(value: number): string {
  const precise = value.toPrecision(6)
  if (precise.includes('e')) return Number(precise).toString()
  if (!precise.includes('.')) return precise
  return precise.replace(/0+$/, '').replace(/\.$/, '')
}

export function ValueInput({ variableId }: ValueInputProps) {
  const { values, setValue } = useCalculatorStore()
  const state = values[variableId]
  const [localValue, setLocalValue] = useState('')

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setLocalValue(raw)

    if (raw === '' || raw === '-') {
      setValue(variableId, null)
      return
    }

    const num = parseFloat(raw.replace(',', '.'))
    if (!isNaN(num)) {
      setValue(variableId, num)
    }
  }, [variableId, setValue])

  // Keep a user's exact decimal string while it still represents the current store value.
  // External changes (reset, preset, unit conversion, solver output) take precedence immediately.
  const parsedLocalValue = parseFloat(localValue.replace(',', '.'))
  const localMatchesStore = state?.isUserInput
    && Number.isFinite(parsedLocalValue)
    && parsedLocalValue === state.value
  const displayValue = localValue === '-' || localMatchesStore
    ? localValue
    : (state?.value !== null && state?.value !== undefined
        ? formatDisplayValue(state.value)
        : '')

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      placeholder="—"
      inputMode="decimal"
      aria-label={`Wert für ${variableId}`}
      className="value-input"
      style={{
        backgroundColor: state?.isComputed ? 'rgba(74, 222, 128, 0.1)' : 'var(--bg-tertiary)',
        color: state?.isComputed ? 'var(--success)' : 'var(--text-primary)',
        border: '1px solid',
        borderColor: state?.isComputed ? 'rgba(74, 222, 128, 0.3)' : 'var(--border)',
      }}
    />
  )
}

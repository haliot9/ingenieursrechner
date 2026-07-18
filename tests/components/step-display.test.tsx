import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StepDisplay } from '../../src/components/StepDisplay'
import type { SolutionStep } from '../../src/core/types'

const base: SolutionStep = {
  formulaId: 'f', formulaName: 'Testschritt', targetVariable: 'x', targetSymbol: 'x',
  originalLatex: 'x = a', rearrangedLatex: 'x = a', substitutedLatex: 'x = 1', resultLatex: 'x = 1',
  resultValue: 1, resultUnit: '', explanation: 'Test',
}

describe('StepDisplay derivation states', () => {
  it('renders structured German labels and the canonical-unit disclosure', () => {
    render(<StepDisplay steps={[{ ...base, derivationState: { mode: 'structured', rows: [
      { kind: 'formula', latex: 'x = a', displayMode: true }, { kind: 'result', latex: 'x = 1', displayMode: true },
    ] } }]} />)
    expect(screen.getByText('Formel')).toBeTruthy()
    expect(screen.getByText('Ergebnis')).toBeTruthy()
    expect(screen.getByText(/Rechenwege verwenden die vom Solver verwendeten Standard/)).toBeTruthy()
  })

  it('renders unavailable state without legacy false rows', () => {
    render(<StepDisplay steps={[{ ...base, rearrangedLatex: 'LEGACY_FALSE', derivationState: { mode: 'unavailable', resultRow: { kind: 'result', latex: 'x = 1', displayMode: true }, reasonCode: 'adapter_exception' } }]} />)
    expect(screen.getByText('Rechenweg für diesen Schritt nicht verfügbar.')).toBeTruthy()
    expect(screen.queryByText('Umgestellt')).toBeNull()
  })

  it('keeps an explicit legacy step renderable', () => {
    render(<StepDisplay steps={[{ ...base, derivationState: { mode: 'legacy' } }]} />)
    expect(screen.getByText('Umgestellt')).toBeTruthy()
  })
})

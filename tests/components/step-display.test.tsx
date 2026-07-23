import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StepDisplay } from '../../src/components/StepDisplay'
import type { PresentationPlan, SolutionStep } from '../../src/core/types'

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


  it('renders one collapsed alternative and a relation-only blocked diagnostic', () => {
    const presentation: PresentationPlan = {
      primarySteps: [{ ...base, derivationState: { mode: 'structured', rows: [{ kind: 'formula', latex: 'x = a', displayMode: true }, { kind: 'result', latex: 'x = 1', displayMode: true }] } }],
      alternatives: [
        { targetId: 'eta', formulaId: 'ideal_efficiency', formulaName: 'Idealer Joule-Wirkungsgrad', label: 'Alternative Herleitung', latex: '\\eta = 1 - 1/r_p' },
        { targetId: 'p2', formulaId: 'isobar', formulaName: 'Isobar', label: 'Alternative Herleitung', latex: 'p_2 = p_3' },
      ],
      blocked: [{ relationId: 'gr-04', targetIds: ['T2', 'T3'], latex: 'T_3 = T_2 + q_{in}/c_p', missingFactHint: 'r_p oder p_2', missingIds: ['pressureRatio'] }],
    }
    const { container } = render(<StepDisplay steps={presentation.primarySteps} presentation={presentation} />)
    const alternative = screen.getByText('Alternative Herleitung für eta').closest('details')
    expect(alternative?.open).toBe(false)
    expect(container.querySelectorAll('details.alternative-derivation')).toHaveLength(2)
    expect(container.querySelector('details.alternative-derivation[data-target-id="eta"]')).toBeTruthy()
    expect(screen.getByText(/Noch nicht eindeutig bestimmbar/)).toBeTruthy()
    expect(screen.getByText(/r_p oder p_2/)).toBeTruthy()
    expect(container.querySelector('.blocked-relation .step-result')).toBeNull()
    expect(container.innerHTML).not.toContain('katex-error')
  })

})

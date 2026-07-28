import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CalculationStoryDisplay } from '../../src/components/CalculationStoryDisplay'

const rows = [
  { id: 'start', kind: 'governing' as const, rowRole: 'start' as const, equationLatex: '\\kappa = \\frac{c_p}{c_v}', equation: { lhsLatex: '\\kappa', relationLatex: '=', rhsLatex: '\\frac{c_p}{c_v}' } },
  { id: 'continuation', kind: 'transform' as const, rowRole: 'continuation' as const, equationLatex: 'R_s = \\kappa c_v-c_v', equation: { relationLatex: '=', rhsLatex: '\\kappa c_v-c_v' }, operation: { kind: 'factor' as const, latex: '\\xrightarrow{\\text{factor }c_v}' } },
  { id: 'numeric', kind: 'numeric' as const, rowRole: 'numeric' as const, equationLatex: '= 717.5', equation: { relationLatex: '=', rhsLatex: '717.5' } },
]
const completeStory = { mode: 'complete' as const, story: { route: 'test', title: 'Kette', consumedSteps: [], unconsumedPrimarySteps: [], sections: [{ id: 'material-properties', title: 'Material properties', rows }], rows } }

describe('CalculationStoryDisplay', () => {
  it('renders semantic grid columns, KaTeX operations, local keyboard scrollers, and section headings', () => {
    const { container } = render(<CalculationStoryDisplay story={completeStory} />)
    expect(screen.getByText('Material properties')).toBeTruthy()
    const scroller = screen.getByRole('region', { name: 'Herleitung: Gleichungszeilen' })
    expect(scroller.tabIndex).toBe(0)
    expect(container.querySelector('[data-story-role="continuation"] .story-lhs')).toBeTruthy()
    expect(container.querySelectorAll('.story-equation-scroller')).toHaveLength(3)
    expect(container.querySelectorAll('.story-operation .katex')).toHaveLength(1)
    expect(container.innerHTML).not.toContain('katex-error')
    expect(container.innerHTML).not.toContain('LaTeX Error')
    expect(container.querySelector('.story-operation')?.textContent).not.toContain('\\xrightarrow')
  })

  it('renders an explicit unavailable state rather than legacy derivation cards', () => {
    render(<CalculationStoryDisplay story={{ mode: 'unavailable', reason: 'Die ausgewählte Route ist nicht vollständig belegt.' }} />)
    expect(screen.getByText('Herleitung nicht verfügbar')).toBeTruthy()
    expect(screen.getByText('Die ausgewählte Route ist nicht vollständig belegt.')).toBeTruthy()
    expect(screen.queryByText('Umgestellt')).toBeNull()
  })
})

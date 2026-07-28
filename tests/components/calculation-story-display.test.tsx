import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CalculationStoryDisplay } from '../../src/components/CalculationStoryDisplay'

const completeStory = {
  mode: 'complete' as const,
  story: {
    route: 'rs-kappa-to-cv-cp',
    title: 'Stoffeigenschaften: Rₛ + κ → cᵥ → cₚ',
    rows: [
      { id: 'governing', kind: 'governing' as const, equationLatex: '\\kappa = \\frac{c_p}{c_v}', note: 'Freigegebene Grundbeziehung.' },
      { id: 'long', kind: 'result' as const, equationLatex: 'c_v = \\frac{R_s}{\\kappa - 1} = \\frac{287.05\\;\\mathrm{J/(kg\\cdot K)}}{1.4 - 1}', operation: 'durch κ − 1 teilen', state: 'reachable' as const },
      { id: 'reuse', kind: 'reuse' as const, equationLatex: 'c_p = \\kappa c_v', operation: 'cᵥ wiederverwenden', note: 'Bereits bewiesene Beziehung verwenden.', state: 'reachable' as const },
    ],
  },
}

describe('CalculationStoryDisplay', () => {
  it('renders a labelled keyboard-focusable local proof scroller with KaTeX rows and reuse', () => {
    const { container } = render(<CalculationStoryDisplay story={completeStory} />)
    const scroller = screen.getByRole('region', { name: 'Herleitung: Gleichungszeilen' })

    expect(scroller.tabIndex).toBe(0)
    expect(scroller.classList.contains('calculation-story-spine')).toBe(true)
    expect(container.querySelector('[data-long-equation="true"]')).toBeTruthy()
    expect(screen.getByText('cᵥ wiederverwenden')).toBeTruthy()
    expect(container.innerHTML).not.toContain('katex-error')
    expect(container.innerHTML).not.toContain('LaTeX Error')
  })

  it('renders an explicit unavailable state rather than legacy derivation cards', () => {
    render(<CalculationStoryDisplay story={{ mode: 'unavailable', reason: 'Die ausgewählte Route ist nicht vollständig belegt.' }} />)
    expect(screen.getByText('Herleitung nicht verfügbar')).toBeTruthy()
    expect(screen.getByText('Die ausgewählte Route ist nicht vollständig belegt.')).toBeTruthy()
    expect(screen.queryByText('Umgestellt')).toBeNull()
  })
})

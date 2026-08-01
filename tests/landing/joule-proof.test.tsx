import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { JouleProof } from '../../src/landing/components/JouleProof'
import { getJouleProofExcerpt } from '../../src/landing/model/joule-proof'

const EXPECTED_PROOF_IDS = [
  'energy:model-reduction',
  'energy:reduced',
  'energy:enthalpy',
  'energy:qin',
  'energy:qin:numeric',
] as const

describe('JouleProof', () => {
  it('selects the exact stable equation spine from the complete Joule reference story', () => {
    const excerpt = getJouleProofExcerpt()

    expect(excerpt.map(row => row.id)).toEqual(EXPECTED_PROOF_IDS)
    expect(excerpt.at(-1)).toMatchObject({
      id: 'energy:qin:numeric',
      kind: 'numeric',
    })
  })

  it('renders the repository-authored proof as valid KaTeX with one boxed result', () => {
    const { container } = render(<JouleProof />)

    const section = screen.getByRole('region', { name: 'Vom Modell zur Wärmezufuhr.' })
    expect(section).toHaveAttribute('id', 'rechenweg')

    const renderedLatex = Array.from(
      container.querySelectorAll('annotation[encoding="application/x-tex"]'),
      annotation => annotation.textContent ?? '',
    ).join('\n')
    for (const symbol of ['q', 'h', 'c_p', 'T']) {
      expect(renderedLatex).toContain(symbol)
    }

    expect(container.querySelectorAll('[data-proof-row-id]')).toHaveLength(5)
    expect(container.querySelectorAll('.joule-proof__equation--result')).toHaveLength(1)
    expect(screen.getByRole('listitem', { name: 'Berechnetes Ergebnis' })).toHaveAttribute(
      'data-proof-row-id',
      'energy:qin:numeric',
    )
    expect(container.innerHTML).not.toContain('katex-error')
    expect(container.innerHTML).not.toContain('LaTeX Error')
  })

  it('states why the control-volume balance may be reduced before using the result relation', () => {
    render(<JouleProof />)

    expect(screen.getByText(/Stationärer Betrieb/)).toHaveTextContent(
      'Stationärer Betrieb, ein Ein- und Austritt sowie vernachlässigbare Änderungen der kinetischen und potenziellen Energie reduzieren die allgemeine Kontrollvolumenbilanz. Erst mit fehlender technischer Arbeit im Heizer und konstanten Stoffwerten des idealen Gases wird die abschließende Wärmezufuhrbeziehung gültig.',
    )
  })
})

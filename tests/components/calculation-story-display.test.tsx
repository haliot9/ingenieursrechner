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


it('renders overview before the spine, semantic collapsed optional sections, boxed payloads, and parent alternatives', () => {
  const story = {
    mode: 'complete' as const,
    story: {
      route: 'test', title: 'Kette', consumedSteps: [], unconsumedPrimarySteps: [], rows,
      overview: { model: 'Test model', givens: ['T_1'], scope: 'specific', signs: ['q_{in}>0'], route: ['state 1'] },
      sections: [
        { id: 'overview', title: 'Überblick', tier: 'main' as const, rows: [] },
        { id: 'optional', title: 'Optional', tier: 'optional' as const, defaultOpen: false, rows: [rows[0]] },
      ],
      alternatives: [{ parentRowId: 'start', title: 'Alternative', rows: [rows[1]] }],
    },
  }
  const { container } = render(<CalculationStoryDisplay story={story} />)
  expect(container.querySelector('.calculation-story-overview')).toBeTruthy()
  const optional = container.querySelector('details[data-story-tier="optional"]')
  expect(optional).toBeTruthy()
  expect(optional?.hasAttribute('open')).toBe(false)
  expect(container.querySelector('[data-story-parent-alternative="start"]')).toBeTruthy()
  expect(container.querySelector('.story-equation-display')).toBeTruthy()
})

it('renders story math in display mode, one equation core, milestones, and unique parent alternatives', () => {
  const story = {
    mode: 'complete' as const,
    story: {
      route: 'test', title: 'Kette', consumedSteps: [], unconsumedPrimarySteps: [], rows,
      sections: [{ id: 'main', title: 'Main', rows: [
        { ...rows[0], id: 'boxed', box: 'core', equation: { bridgeLatex: '\\Longleftrightarrow', lhsLatex: 'c_p', relationLatex: '=', rhsLatex: '\\kappa c_v' } },
        { id: 'done', kind: 'milestone', rowRole: 'milestone', equationLatex: 'Zustand 1 vollständig', label: 'Zustand 1 vollständig' },
      ] }],
      alternatives: [
        { parentRowId: 'boxed', title: 'Alternative', rows: [rows[1]] },
        { parentRowId: 'boxed', title: 'Alternative', rows: [rows[1]] },
      ],
    },
  }
  const { container } = render(<CalculationStoryDisplay story={story as never} />)
  expect(container.querySelector('.story-equation-display .katex-display')).toBeTruthy()
  expect(container.querySelectorAll('[data-story-parent-alternative="boxed"]')).toHaveLength(1)
  expect(container.querySelector('.story-result-core')).toBeTruthy()
  expect(container.querySelector('.story-milestone')?.textContent).toContain('Zustand 1 vollständig')
})

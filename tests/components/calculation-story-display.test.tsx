import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CalculationStoryDisplay } from '../../src/components/CalculationStoryDisplay'
import { FormulaRegistry } from '../../src/core/formula-registry'
import { solve } from '../../src/core/solver'
import { composeJouleCalculationStory } from '../../src/modules/joule/calculation-story'
import { jouleModule } from '../../src/modules/joule'

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
        { parentRowId: 'other', title: 'Other alternative', rows: [rows[1]] },
      ],
    },
  }
  const { container } = render(<CalculationStoryDisplay story={story as never} />)
  expect(container.querySelector('.story-equation-display .katex-display')).toBeTruthy()
  expect(container.querySelectorAll('[data-story-parent-alternative="boxed"]')).toHaveLength(1)
  expect(container.querySelectorAll('[data-story-parent-alternative="other"]')).toHaveLength(0)
  expect(container.querySelector('.story-result-core')).toBeTruthy()
  expect(container.querySelector('.story-milestone')?.textContent).toContain('Zustand 1 vollständig')
})

it('renders final Joule annotations with substitutions, subjects, one result box, and canonical alternative deduplication', () => {
  const input = (value: number, unit = '') => ({ value, unit, isUserInput: true, isComputed: false })
  const result = solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, {
    T1: input(300, 'K'), p1: input(100_000, 'Pa'), pressureRatio: input(10), T3: input(1400, 'K'), kappa: input(1.4), Rs: input(287, 'J/(kg*K)'),
  }, [], { plannedExecution: jouleModule.plannedExecution })
  const composed = composeJouleCalculationStory({ plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables })
  if (composed.mode !== 'complete') throw new Error('expected complete story')
  const duplicate = composed.story.alternatives?.find(alternative => alternative.parentRowId === 'entropy_abs_3:s3:numeric')
  const story = { ...composed.story, alternatives: [...(composed.story.alternatives ?? []), { ...duplicate!, rows: [{ ...duplicate!.rows[0], id: 'same-rendered-payload' }] }] }
  const { container } = render(<CalculationStoryDisplay story={{ mode: 'complete', story }} />)
  const visible = container.textContent ?? ''
  const annotations = Array.from(container.querySelectorAll('.story-equation-grid')).map(grid => Array.from(grid.querySelectorAll('.katex annotation')).map(annotation => annotation.textContent ?? '').join(''))
  expect(visible).toMatch(/287.*J.*kg.*K/)
  expect(visible).toMatch(/100000.*Pa.*10/)
  expect(annotations.some(annotation => annotation.includes('287') && annotation.includes('100000'))).toBe(true)
  expect(visible).toContain('e')
  expect(container.querySelectorAll('.story-result-core')).not.toHaveLength(0)
  expect(container.querySelector('.story-result-core')?.parentElement?.classList.contains('is-reachable')).toBe(false)
  expect(container.querySelectorAll('[data-story-parent-alternative="entropy_abs_3:s3:numeric"]')).toHaveLength(1)
})


it('renders the complete compressor and heater SFEE annotation chains in learner-visible order', () => {
  const input = (value: number, unit = '') => ({ value, unit, isUserInput: true, isComputed: false })
  const result = solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, {
    T1: input(300, 'K'), p1: input(100_000, 'Pa'), pressureRatio: input(10), T3: input(1400, 'K'), kappa: input(1.4), Rs: input(287, 'J/(kg*K)'),
  }, [], { plannedExecution: jouleModule.plannedExecution })
  const composed = composeJouleCalculationStory({ plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables })
  if (composed.mode !== 'complete') throw new Error('expected complete story')
  const { container } = render(<CalculationStoryDisplay story={composed} />)
  const annotations = Array.from(container.querySelectorAll('.story-equation-grid')).map(grid => Array.from(grid.querySelectorAll('.katex annotation')).map(annotation => annotation.textContent ?? '').join(''))
  const expected = [
    'q-w_s=(h_{out}-h_{in})+\\Delta ke+\\Delta pe',
    '\\Delta ke=0',
    'q-w_s=(h_{out}-h_{in})+\\Delta pe',
    '\\Delta pe=0',
    'q-w_s=h_{out}-h_{in}',
    'q=0',
    '-w_s=h_2-h_1',
    'w_{comp}:=-w_s',
    'w_{comp}=h_2-h_1',
    'q-w_s=h_{out}-h_{in}',
    'w_s=0',
    'q=h_{out}-h_{in}',
    'q_{in}=h_3-h_2',
  ]
  let cursor = -1
  for (const payload of expected) {
    cursor = annotations.findIndex((annotation, index) => index > cursor && annotation === payload)
    expect(cursor, `missing or out-of-order learner-visible annotation: ${payload}`).toBeGreaterThan(-1)
  }
})


it('keeps typed support attached to its parent row and independently hides only support', () => {
  const supportStory = {
    mode: 'complete' as const,
    story: {
      route: 'support-test', title: 'Support seam', consumedSteps: [], unconsumedPrimarySteps: [], rows: [{
        ...rows[0], id: 'main-with-support',
        support: {
          id: 'ideal-gas-foundation', kind: 'foundation', title: 'Ideal gas relation', defaultOpen: true,
          rows: [{ ...rows[1], id: 'support-proof', operation: { kind: 'substitute' as const, latex: '\\xrightarrow{\\text{substitute}}' } }],
        },
      }],
    },
  }
  const { container } = render(<CalculationStoryDisplay story={supportStory} />)
  expect(container.querySelector('[data-story-row-id="main-with-support"]')).toBeTruthy()
  const support = container.querySelector('[data-story-support="ideal-gas-foundation"]')
  expect(support?.getAttribute('data-story-parent-row')).toBe('main-with-support')
  expect(support?.querySelector('.story-support-row .story-operation .katex')).toBeTruthy()
  const mainOnly = screen.getByRole('button', { name: 'Nur Hauptpfad' })
  expect(mainOnly.getAttribute('aria-pressed')).toBe('false')
  fireEvent.click(mainOnly)
  expect(container.querySelector('[data-story-support="ideal-gas-foundation"]')).toBeNull()
  expect(container.querySelector('[data-story-row-id="main-with-support"]')).toBeTruthy()
  fireEvent.click(mainOnly)
  expect(container.querySelector('[data-story-support="ideal-gas-foundation"]')).toBeTruthy()
})

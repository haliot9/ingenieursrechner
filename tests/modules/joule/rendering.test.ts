import { describe, expect, it } from 'vitest'
import { FormulaRegistry } from '../../../src/core/formula-registry'
import { solve } from '../../../src/core/solver'
import type { VariableState } from '../../../src/core/types'
import { jouleModule } from '../../../src/modules/joule'
import { composeJouleCalculationStory } from '../../../src/modules/joule/calculation-story'
import { renderLatex, unitToLatex } from '../../../src/utils/latex'

function input(value: number, unit = ''): VariableState { return { value, unit, isUserInput: true, isComputed: false } }

function completeStory() {
  const result = solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, {
    T1: input(300, 'K'), p1: input(100_000, 'Pa'), pressureRatio: input(10), T3: input(1400, 'K'), kappa: input(1.4), Rs: input(287, 'J/(kg*K)'),
  }, [], { plannedExecution: jouleModule.plannedExecution })
  const composed = composeJouleCalculationStory({ plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables })
  if (composed.mode !== 'complete') throw new Error('expected complete story')
  return composed.story
}

describe('Joule human-reference math rendering', () => {
  it.each(['Pa', 'kPa', 'bar', 'MPa', 'm^3/kg', 'K', 'J/(kg*K)', 'kJ/(kg*K)', 'J/kg', 'kJ/kg'])('renders configured unit %s without a KaTeX error', unit => {
    const html = renderLatex(`x = 1 \\; ${unitToLatex(unit)}`, true)
    expect(html).not.toContain('katex-error')
    expect(html).not.toContain('LaTeX Error')
  })

  it('renders every main and attached proof row through the real KaTeX path', () => {
    const story = completeStory()
    const rows = [...story.rows, ...story.rows.flatMap(row => row.support?.rows ?? [])]
    const latexPayloads = rows.flatMap(row => [row.equationLatex, typeof row.operation === 'object' ? row.operation.latex : row.operation ?? '']).filter(Boolean)
    const failures = latexPayloads.filter(latex => {
      const html = renderLatex(latex.replaceAll('κ', '\\kappa').replaceAll('η', '\\eta').replaceAll('→', '\\to').replaceAll('−', '-'), false)
      return html.includes('katex-error') || html.includes('LaTeX Error') || html.includes('#cc0000')
    })
    expect(failures).toEqual([])
    const latexSource = latexPayloads.join('\n')
    for (const forbidden of ['\\xLongrightarrow', '\\cancelto', '\\kappac', '\\to']) expect(latexSource).not.toContain(forbidden)
    expect(story.rows).toHaveLength(62)
  })
})

import { describe, expect, it } from 'vitest'
import { FormulaRegistry } from '../../../src/core/formula-registry'
import { solve } from '../../../src/core/solver'
import type { VariableState } from '../../../src/core/types'
import { jouleModule } from '../../../src/modules/joule'
import { renderLatex, unitToLatex } from '../../../src/utils/latex'

function input(value: number, unit = ''): VariableState {
  return { value, unit, isUserInput: true, isComputed: false }
}

describe('Joule calculation-step rendering regression', () => {
  it('renders every reference result without a KaTeX error fallback', () => {
    const result = solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, {
      T1: input(300, 'K'),
      p1: input(100_000, 'Pa'),
      pressureRatio: input(10),
      T3: input(1400, 'K'),
      kappa: input(1.4),
      Rs: input(287, 'J/(kg*K)'),
    })

    const brokenResults = result.steps
      .map(step => ({
        target: step.targetVariable,
        latex: step.resultLatex,
        html: renderLatex(step.resultLatex, true),
      }))
      .filter(rendered => rendered.html.includes('katex-error') || rendered.html.includes('LaTeX Error'))

    expect(brokenResults).toEqual([])
  })

  it.each([
    'Pa', 'kPa', 'bar', 'MPa', 'atm',
    'm^3', 'cm^3', 'kg/m^3', 'm^3/kg', 'L', 'L/kg',
    'K', 'degC', 'J/(kg*K)', 'kJ/(kg*K)',
    'kg', 'g', 'kg/mol', 'g/mol', 'g/L', 'J/kg', 'kJ/kg',
  ])('renders the configured unit %s without a KaTeX error', unit => {
    const html = renderLatex(`x = 1 \\; ${unitToLatex(unit)}`, true)

    expect(html).not.toContain('katex-error')
    expect(html).not.toContain('LaTeX Error')
  })

  it('omits markup for dimensionless results', () => {
    expect(unitToLatex('')).toBe('')
  })
})

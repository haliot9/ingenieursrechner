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

  it('renders every structured reference row through the real KaTeX path', () => {
    const result = solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, {
      T1: input(300, 'K'), p1: input(100_000, 'Pa'), pressureRatio: input(10), T3: input(1400, 'K'), kappa: input(1.4), Rs: input(287, 'J/(kg*K)'),
    })
    const rendered = result.steps.flatMap(step => step.derivationState?.mode === 'structured'
      ? step.derivationState.rows.map(row => renderLatex(row.latex, row.displayMode))
      : [])
    expect(rendered).toHaveLength(86)
    expect(rendered.some(html => html.includes('katex-error') || html.includes('LaTeX Error'))).toBe(false)
  })



  it('renders primary, alternative, blocked, and contradiction math without KaTeX fallbacks', () => {
    const formulas = [
      '-\\frac{w_{netto}}{q_{in}}',
      '\\eta = 1 - \\frac{1}{r_p^{(\\kappa-1)/\\kappa}}',
      'T_3 = T_2 + q_{in}/c_p',
      '\\frac{p_2}{p_1} = 10 \\neq r_p = 9',
    ]
    const rendered = formulas.map(latex => renderLatex(latex, true))
    expect(rendered).toHaveLength(4)
    expect(rendered.some(html => html.includes('katex-error') || html.includes('LaTeX Error'))).toBe(false)
  })

})

import { describe, expect, it } from 'vitest'
import { compileSolveDirections } from '../../src/core/solve-directions'
import { JOULE_FORMULAS } from '../../src/modules/joule/formulas'
import { ALL_VARIABLES } from '../../src/modules/joule/config'
import type { Formula } from '../../src/core/types'

describe('compileSolveDirections', () => {
  it('derives stable sorted required IDs from the expression AST', () => {
    const directions = compileSolveDirections(JOULE_FORMULAS, ALL_VARIABLES.map(variable => variable.id))
    expect(JOULE_FORMULAS).toHaveLength(24)
    expect(directions).toHaveLength(42)
    expect(directions.map(direction => direction.id)).toEqual([...directions.map(direction => direction.id)].sort((left, right) => left.localeCompare(right)))
    expect(directions.find(direction => direction.id === 'cp_from_kappa_cv:cp')?.requiredIds).toEqual(['cv', 'kappa'])
  })

  it('applies an ID-keyed policy without copying expression or dependencies into the policy', () => {
    const formula: Formula = {
      id: 'policy_formula', name: 'policy', latex: 'x = log(y)', variables: ['x', 'y'],
      solveFor: { x: 'log(y)' }, latexSteps: { x: { rearranged: 'x = log(y)', explanation: 'test' } },
    }
    const conditions = [{ id: 'positive-y', description: 'y must be positive' }]
    const compileWithPolicy = compileSolveDirections as unknown as (
      formulas: readonly Formula[], variableIds: readonly string[], policies: Readonly<Record<string, unknown>>,
    ) => ReturnType<typeof compileSolveDirections>

    const [direction] = compileWithPolicy([formula], ['x', 'y'], {
      'policy_formula:x': { mode: 'disabled', routePriority: 17, conditions },
    })

    expect(direction).toMatchObject({
      id: 'policy_formula:x',
      formulaId: 'policy_formula',
      targetId: 'x',
      requiredIds: ['y'],
      mode: 'disabled',
      routePriority: 17,
      conditions,
    })
  })

  it('rejects unknown symbols instead of treating them as quantities', () => {
    const formula: Formula = {
      id: 'unknown', name: 'unknown', latex: 'x = mystery', variables: ['x'],
      solveFor: { x: 'mystery + 1' }, latexSteps: { x: { rearranged: 'x = mystery + 1', explanation: 'test' } },
    }
    expect(() => compileSolveDirections([formula], ['x'])).toThrow(/unknown symbol/i)
  })

  it('rejects target self-reference while retaining log as an approved function', () => {
    const selfReferential: Formula = {
      id: 'self', name: 'self', latex: 'x = x + y', variables: ['x', 'y'],
      solveFor: { x: 'x + y' }, latexSteps: { x: { rearranged: 'x = x + y', explanation: 'test' } },
    }
    const logarithmic: Formula = {
      id: 'logarithmic', name: 'logarithmic', latex: 'x = log(y)', variables: ['x', 'y'],
      solveFor: { x: 'log(y)' }, latexSteps: { x: { rearranged: 'x = log(y)', explanation: 'test' } },
    }

    expect(() => compileSolveDirections([selfReferential], ['x', 'y'])).toThrow(/self reference/i)
    expect(compileSolveDirections([logarithmic], ['x', 'y'])[0].requiredIds).toEqual(['y'])
  })
})

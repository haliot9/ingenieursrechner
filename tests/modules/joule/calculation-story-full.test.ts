import { describe, expect, it } from 'vitest'
import { FormulaRegistry } from '../../../src/core/formula-registry'
import { solve } from '../../../src/core/solver'
import { compileSolveDirections } from '../../../src/core/solve-directions'
import type { VariableState } from '../../../src/core/types'
import { composeJouleCalculationStory, JOULE_STORY_RECIPES } from '../../../src/modules/joule/calculation-story'
import { ALL_VARIABLES, JOULE_DIRECTION_POLICIES } from '../../../src/modules/joule/config'
import { JOULE_FORMULAS } from '../../../src/modules/joule/formulas'
import { jouleModule } from '../../../src/modules/joule'

function input(value: number, unit = ''): VariableState {
  return { value, unit, isUserInput: true, isComputed: false }
}

function referenceResult() {
  return solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, {
    T1: input(300, 'K'), p1: input(100_000, 'Pa'), pressureRatio: input(10),
    T3: input(1400, 'K'), kappa: input(1.4), Rs: input(287, 'J/(kg*K)'),
  }, [], { plannedExecution: jouleModule.plannedExecution })
}

describe('full Joule calculation-story contract', () => {
  it('covers every registered derive direction with a finite recipe and leaves only ideal-gas Rs as checks', () => {
    const directions = compileSolveDirections(JOULE_FORMULAS, ALL_VARIABLES.map(variable => variable.id), JOULE_DIRECTION_POLICIES)
    const deriveIds = directions.filter(direction => direction.mode === 'derive').map(direction => direction.id).sort()
    const validateIds = directions.filter(direction => direction.mode === 'validate-only').map(direction => direction.id).sort()

    expect(directions).toHaveLength(48)
    expect(deriveIds).toHaveLength(44)
    expect(validateIds).toEqual(['ideal_gas_1:Rs', 'ideal_gas_2:Rs', 'ideal_gas_3:Rs', 'ideal_gas_4:Rs'])
    expect(Object.keys(JOULE_STORY_RECIPES).sort()).toEqual(deriveIds)
    for (const recipe of Object.values(JOULE_STORY_RECIPES)) {
      expect(recipe).toMatchObject({ directionId: expect.any(String), entryPointLatex: expect.any(String) })
      expect(recipe.conditions).toBeInstanceOf(Array)
      expect(recipe.transitions.length).toBeGreaterThan(0)
    }
  })

  it('consumes the full reference primary route exactly once with semantic continuation rows', () => {
    const result = referenceResult()
    const story = composeJouleCalculationStory({
      plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables,
    })

    expect(story.mode).toBe('complete')
    if (story.mode !== 'complete') throw new Error('expected full story')
    const primaryIds = [...result.plan!.primaryByTarget.values()].map(direction => direction.directionId).sort()
    const consumed = story.story.consumedSteps.map(step => step.directionId).sort()
    expect(consumed).toEqual(primaryIds)
    expect(consumed).toHaveLength(22)
    expect(new Set(consumed).size).toBe(consumed.length)
    expect(story.story.unconsumedPrimarySteps).toEqual([])

    const continuation = story.story.rows.find(row => row.rowRole === 'continuation')
    expect(continuation).toBeTruthy()
    expect(continuation?.equation.lhsLatex).toBeUndefined()
    expect(continuation?.operation?.latex).toMatch(/^\\xrightarrow\{/)
    expect(story.story.rows.some(row => row.rowRole === 'check')).toBe(true)
  })
})

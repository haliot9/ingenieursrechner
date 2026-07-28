import { describe, expect, it } from 'vitest'
import { FormulaRegistry } from '../../../src/core/formula-registry'
import { solve } from '../../../src/core/solver'
import type { VariableState } from '../../../src/core/types'
import { removeConsumedStorySteps } from '../../../src/core/calculation-story'
import { composeJouleCalculationStory } from '../../../src/modules/joule/calculation-story'
import { jouleModule } from '../../../src/modules/joule'

function input(value: number, unit = ''): VariableState {
  return { value, unit, isUserInput: true, isComputed: false }
}

function referenceResult() {
  return solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, {
    T1: input(300, 'K'), p1: input(100_000, 'Pa'), pressureRatio: input(10), T3: input(1400, 'K'), kappa: input(1.4), Rs: input(287, 'J/(kg*K)'),
  }, [], { plannedExecution: jouleModule.plannedExecution })
}

describe('Joule calculation-story composer', () => {
  it('renders the material chain semantically while preserving exact accepted values', () => {
    const result = referenceResult()
    const story = composeJouleCalculationStory({ plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables })
    expect(story.mode).toBe('complete')
    if (story.mode !== 'complete') throw new Error('expected complete story')

    const continuation = story.story.rows.find(row => row.id === 'material:substitute-cp')
    expect(continuation).toMatchObject({ rowRole: 'continuation', equation: { lhsLatex: undefined, relationLatex: '=' } })
    expect(continuation?.operation).toMatchObject({ kind: 'substitute', latex: expect.stringContaining('\\xrightarrow') })
    expect(story.story.rows.find(row => row.id === 'material:cv-numeric')?.equationLatex).toContain('717.5')
    expect(story.story.rows.find(row => row.id === 'material:cp-numeric')?.equationLatex).toContain('1004.5')
  })

  it('filters every full-story primary card while retaining separate alternatives and blocked states', () => {
    const result = referenceResult()
    const story = composeJouleCalculationStory({ plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables })
    expect(story.mode).toBe('complete')
    if (story.mode !== 'complete') throw new Error('expected complete story')
    const visible = removeConsumedStorySteps({ primarySteps: result.steps, alternatives: [], blocked: [] }, story.story)
    expect(visible?.primarySteps).toEqual([])
    expect(story.story.consumedSteps).toHaveLength(22)
  })

  it('uses the direct c_v + kappa -> c_p route without an Rs story branch', () => {
    const result = solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, { cv: input(717.5, 'J/(kg*K)'), kappa: input(1.4) }, [], { plannedExecution: jouleModule.plannedExecution })
    const story = composeJouleCalculationStory({ plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables })
    expect(story.mode).toBe('complete')
    if (story.mode !== 'complete') throw new Error('expected complete story')
    expect(story.story.consumedSteps).toEqual([{ formulaId: 'cp_from_kappa_cv', targetVariable: 'cp', directionId: 'cp_from_kappa_cv:cp' }])
    expect(story.story.rows.some(row => row.equationLatex.includes('R_s'))).toBe(false)
  })

  it('returns unavailable rather than presenting authority when a selected route lacks executed provenance', () => {
    const result = referenceResult()
    const story = composeJouleCalculationStory({ plan: result.plan!, steps: result.steps.filter(step => step.targetVariable !== 'cp'), values: result.values, variables: jouleModule.variables })
    expect(story).toMatchObject({ mode: 'unavailable' })
  })

  it('does not mutate accepted solver values or leak internal direction IDs into learner rows', () => {
    const result = referenceResult()
    const acceptedValues = JSON.stringify(result.values)
    const story = composeJouleCalculationStory({ plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables })
    expect(JSON.stringify(result.values)).toBe(acceptedValues)
    if (story.mode !== 'complete') throw new Error('expected complete story')
    expect(JSON.stringify(story.story.rows)).not.toMatch(/cv_from_Rs_kappa|formulaId|targetId/)
  })
})

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
    expect(story.story.rows.find(row => row.id === 'cp_from_kappa_cv:cp:numeric')?.equationLatex).toContain('1004.5')
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
    expect(story.story.rows.find(row => row.id === 'material:cp-governing')?.equationLatex).toBe('κ = \\frac{c_p}{c_v}')
    expect(story.story.rows.find(row => row.id === 'material:cp-resolved')?.rowRole).toBe('subject-change')
    expect(story.story.rows.some(row => row.rowRole === 'reuse')).toBe(false)
  })

  it.each([
    ['heat_input:T3', 'T3', { cp: input(1000, 'J/(kg*K)'), T2: input(500, 'K'), q_in: input(100_000, 'J/kg') }, 'add', 'T_3 = T_2 + \\frac{q_{in}}{c_p}'],
    ['heat_input:T2', 'T2', { cp: input(1000, 'J/(kg*K)'), T3: input(600, 'K'), q_in: input(100_000, 'J/kg') }, 'subtract', 'T_2 = T_3 - \\frac{q_{in}}{c_p}'],
    ['heat_rejection:T1', 'T1', { cp: input(1000, 'J/(kg*K)'), T4: input(700, 'K'), q_out: input(-100_000, 'J/kg') }, 'add', 'T_1 = T_4 + \\frac{q_{out}}{c_p}'],
    ['heat_rejection:T4', 'T4', { cp: input(1000, 'J/(kg*K)'), T1: input(600, 'K'), q_out: input(-100_000, 'J/kg') }, 'subtract', 'T_4 = T_1 - \\frac{q_{out}}{c_p}'],
  ] as const)('composes the explicit reverse heat route %s', (directionId, target, inputs, operationKind, expectedResult) => {
    const result = solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, inputs, [], { plannedExecution: jouleModule.plannedExecution })
    const acceptedValues = JSON.stringify(result.values)
    const acceptedSteps = JSON.stringify(result.steps)
    const primary = [...result.plan!.primaryByTarget.values()].map(direction => direction.directionId).sort()
    expect(result.plan?.primaryByTarget.get(target)?.directionId).toBe(directionId)
    const story = composeJouleCalculationStory({ plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables })
    expect(story.mode).toBe('complete')
    expect(JSON.stringify(result.values)).toBe(acceptedValues)
    expect(JSON.stringify(result.steps)).toBe(acceptedSteps)
    if (story.mode !== 'complete') throw new Error('expected complete story')
    expect(story.story.consumedSteps.map(step => step.directionId).sort()).toEqual(primary)
    expect(story.story.rows.find(row => row.id === `${directionId}:divide-cp`)?.operation).toMatchObject({ kind: 'divide' })
    expect(story.story.rows.find(row => row.id === `${directionId}:result`)).toMatchObject({ equationLatex: expectedResult, operation: { kind: operationKind } })
  })

  it('composes GR-02 and GR-03 through their actual alternate primary directions without mutation', () => {
    const cases = [
      ['heat_input:T3', 'T3', { p1: input(100_000, 'Pa'), pressureRatio: input(10), T1: input(300, 'K'), q_in: input(824_484.2394010328, 'J/kg'), Rs: input(287), kappa: input(1.4) }],
      ['ideal_efficiency:pressureRatio', 'pressureRatio', { p3: input(1_000_000, 'Pa'), T3: input(1400, 'K'), q_out: input(-427_039.52414028544, 'J/kg'), eta: input(0.4820525320768787), Rs: input(287), kappa: input(1.4) }],
    ] as const
    for (const [directionId, target, inputs] of cases) {
      const result = solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, inputs, [], { plannedExecution: jouleModule.plannedExecution })
      const acceptedValues = JSON.stringify(result.values)
      const acceptedSteps = JSON.stringify(result.steps)
      const primary = [...result.plan!.primaryByTarget.values()].map(direction => direction.directionId).sort()
      expect(result.plan?.primaryByTarget.get(target)?.directionId).toBe(directionId)
      const story = composeJouleCalculationStory({ plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables })
      expect(story.mode).toBe('complete')
      expect(JSON.stringify(result.values)).toBe(acceptedValues)
      expect(JSON.stringify(result.steps)).toBe(acceptedSteps)
      if (story.mode !== 'complete') throw new Error('expected complete story')
      expect(story.story.consumedSteps.map(step => step.directionId).sort()).toEqual(primary)
      expect(story.story.rows.some(row => row.id.startsWith(`${directionId}:`))).toBe(true)
    }
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

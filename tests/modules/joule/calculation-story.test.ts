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
  return solve(
    FormulaRegistry.fromModule(jouleModule),
    jouleModule.variables,
    {
      T1: input(300, 'K'), p1: input(100_000, 'Pa'), pressureRatio: input(10),
      T3: input(1400, 'K'), kappa: input(1.4), Rs: input(287, 'J/(kg*K)'),
    },
    [],
    { plannedExecution: jouleModule.plannedExecution },
  )
}

describe('Joule calculation-story recipes', () => {
  it('uses exact solver facts for the Rs + kappa -> cv -> cp proof spine', () => {
    const result = referenceResult()
    const story = composeJouleCalculationStory({
      plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables,
    })

    expect(story.mode).toBe('complete')
    if (story.mode !== 'complete') throw new Error('expected a complete story')
    expect(story.story.route).toBe('rs-kappa-to-cv-cp')
    expect(story.story.rows.map(row => row.id)).toEqual([
      'kappa-governing', 'cp-derived-relation', 'rs-governing', 'substitute-cp',
      'factor-cv', 'cv-resolved', 'cv-numeric', 'cp-reuse', 'cp-numeric',
    ])
    expect(story.story.rows.find(row => row.id === 'cv-numeric')?.equationLatex)
      .toContain('717.5')
    expect(story.story.rows.find(row => row.id === 'cp-numeric')?.equationLatex)
      .toContain('1004.5')
    expect(story.story.rows.find(row => row.id === 'cp-reuse')).toMatchObject({ kind: 'reuse', state: 'reachable' })
  })

  it('keeps non-consumed Joule plan steps while filtering story-owned cv and cp cards', () => {
    const result = referenceResult()
    const story = composeJouleCalculationStory({
      plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables,
    })

    expect(story.mode).toBe('complete')
    if (story.mode !== 'complete') throw new Error('expected a complete story')
    const hybridPlan = removeConsumedStorySteps({ primarySteps: result.steps, alternatives: [], blocked: [] }, story.story)

    expect(story.story.consumedSteps).toEqual([
      { formulaId: 'cv_from_Rs_kappa', targetVariable: 'cv', directionId: 'cv_from_Rs_kappa:cv' },
      { formulaId: 'cp_from_kappa_cv', targetVariable: 'cp', directionId: 'cp_from_kappa_cv:cp' },
    ])
    expect(result.steps.map(step => step.targetVariable)).toContain('T2')
    expect(hybridPlan.primarySteps.map(step => step.targetVariable)).toContain('T2')
    expect(hybridPlan.primarySteps.map(step => step.targetVariable)).not.toContain('cv')
    expect(hybridPlan.primarySteps.map(step => step.targetVariable)).not.toContain('cp')
  })

  it('uses the direct c_v + kappa -> c_p route without an unnecessary Rs elimination', () => {
    const result = solve(
      FormulaRegistry.fromModule(jouleModule),
      jouleModule.variables,
      { cv: input(717.5, 'J/(kg*K)'), kappa: input(1.4) },
      [],
      { plannedExecution: jouleModule.plannedExecution },
    )
    const story = composeJouleCalculationStory({
      plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables,
    })

    expect(story).toMatchObject({ mode: 'complete', story: { route: 'cv-kappa-to-cp' } })
    if (story.mode !== 'complete') throw new Error('expected a complete story')
    expect(story.story.rows.map(row => row.id)).toEqual(['kappa-governing', 'cp-resolved', 'cp-numeric'])
    expect(story.story.rows.some(row => row.equationLatex.includes('R_s'))).toBe(false)
    expect(story.story.rows.find(row => row.id === 'cp-numeric')?.equationLatex).toContain('1004.5')
  })

  it('returns an explicit unavailable state when an opted-in reference route lacks provenance', () => {
    const result = referenceResult()
    const story = composeJouleCalculationStory({
      plan: result.plan!,
      steps: result.steps.filter(step => step.targetVariable !== 'cp'),
      values: result.values,
      variables: jouleModule.variables,
    })

    expect(story).toMatchObject({ mode: 'unavailable' })
  })

  it('does not mutate accepted solver values or expose solver identifiers in learner rows', () => {
    const result = referenceResult()
    const acceptedValues = JSON.stringify(result.values)
    const story = composeJouleCalculationStory({
      plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables,
    })

    expect(JSON.stringify(result.values)).toBe(acceptedValues)
    if (story.mode !== 'complete') throw new Error('expected a complete story')
    expect(JSON.stringify(story.story.rows)).not.toMatch(/cv_from_Rs_kappa|cp_from_kappa_cv|formulaId|targetId/)
  })
})

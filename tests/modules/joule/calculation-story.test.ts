import { describe, expect, it } from 'vitest'
import { FormulaRegistry } from '../../../src/core/formula-registry'
import { solve } from '../../../src/core/solver'
import type { VariableState } from '../../../src/core/types'
import { composeJouleCalculationStory } from '../../../src/modules/joule/calculation-story'
import { jouleModule } from '../../../src/modules/joule'

function input(value: number, unit = ''): VariableState { return { value, unit, isUserInput: true, isComputed: false } }

function composeReference() {
  const result = solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, {
    T1: input(300, 'K'), p1: input(100_000, 'Pa'), pressureRatio: input(10), T3: input(1400, 'K'), kappa: input(1.4), Rs: input(287, 'J/(kg*K)'),
  }, [], { plannedExecution: jouleModule.plannedExecution })
  const composed = composeJouleCalculationStory({ plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables })
  if (composed.mode !== 'complete') throw new Error('expected complete story')
  return { result, story: composed.story }
}

describe('Joule human-reference composer', () => {
  it('uses immutable selected solver provenance while its finite recipe owns presentation order', () => {
    const { result, story } = composeReference()
    expect(story.route).toBe('joule-human-reference-v1')
    expect(story.consumedSteps.map(step => step.directionId).sort()).toEqual([...result.plan!.primaryByTarget.values()].map(step => step.directionId).sort())
    expect(story.rows).toHaveLength(62)
  })

  it('keeps target-local support attached to its consumer and reserves one initially collapsed unit detail', () => {
    const { story } = composeReference()
    const supports = story.rows.filter(row => row.support)
    expect(supports.map(row => row.support?.id)).toContain('state1-units')
    expect(supports.find(row => row.support?.id === 'state1-units')?.support?.defaultOpen).toBe(false)
    expect(supports.flatMap(row => row.support?.rows ?? []).every(row => row.equation && row.rowRole)).toBe(true)
  })

  it('returns unavailable rather than inventing a story when an accepted prerequisite value is missing', () => {
    const { result } = composeReference()
    const values = { ...result.values, q_in: { ...result.values.q_in, value: null } }
    expect(composeJouleCalculationStory({ plan: result.plan!, steps: result.steps, values, variables: jouleModule.variables })).toEqual({ mode: 'unavailable', reason: 'Der Rechenweg benötigt einen vollständig belegten Joule-Referenzzustand.' })
  })
})

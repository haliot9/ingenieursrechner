import { describe, expect, it } from 'vitest'
import { FormulaRegistry } from '../../../src/core/formula-registry'
import { compileSolveDirections } from '../../../src/core/solve-directions'
import { solve } from '../../../src/core/solver'
import type { VariableState } from '../../../src/core/types'
import { jouleModule } from '../../../src/modules/joule'
import { ALL_VARIABLES, JOULE_DIRECTION_POLICIES } from '../../../src/modules/joule/config'
import { JOULE_FORMULAS } from '../../../src/modules/joule/formulas'

function input(value: number, unit = ''): VariableState {
  return { value, unit, isUserInput: true, isComputed: false }
}

function solveJoule(inputs: Record<string, VariableState>) {
  return solve(
    FormulaRegistry.fromModule(jouleModule),
    jouleModule.variables,
    inputs,
    [],
    { plannedExecution: jouleModule.plannedExecution },
  )
}

describe('Known-Facts-First Joule golden routes', () => {
  it('GR-01 preserves the frozen forward oracle through selected planned routes', () => {
    const result = solveJoule({
      T1: input(300, 'K'), p1: input(100_000, 'Pa'), pressureRatio: input(10),
      T3: input(1400, 'K'), kappa: input(1.4), Rs: input(287, 'J/(kg*K)'),
    })

    expect(result.errors).toEqual([])
    expect(result.values.T2.value).toBeCloseTo(579.209318664975, 8)
    expect(result.values.T4.value).toBeCloseTo(725.1264550923697, 8)
    expect(result.values.q_in.value).toBeCloseTo(824_484.2394010328, 6)
    expect(result.values.eta.value).toBeCloseTo(0.4820525320768787, 10)
    expect(result.plan?.primaryByTarget.get('T2')?.directionId).toBe('compressor_temperature:T2')
  })

  it('GR-02 derives T3 from q_in without treating T3 as a user fact', () => {
    const result = solveJoule({
      p1: input(100_000, 'Pa'), pressureRatio: input(10), T1: input(300, 'K'),
      q_in: input(824_484.2394010328, 'J/kg'), Rs: input(287), kappa: input(1.4),
    })
    expect(result.errors).toEqual([])
    expect(result.values.T3.value).toBeCloseTo(1400, 8)
    expect(result.values.T3.isUserInput).toBe(false)
    expect(result.plan?.primaryByTarget.get('T3')?.directionId).toBe('heat_input:T3')
  })

  it('GR-03 reconstructs pressureRatio from ideal efficiency', () => {
    const result = solveJoule({
      p3: input(1_000_000, 'Pa'), T3: input(1400, 'K'), q_out: input(-427_039.52414028544, 'J/kg'),
      eta: input(0.4820525320768787), Rs: input(287), kappa: input(1.4),
    })
    expect(result.errors).toEqual([])
    expect(result.values.pressureRatio.value).toBeCloseTo(10, 8)
    expect(result.values.T1.value).toBeCloseTo(300, 7)
    expect(result.values.T4.value).toBeCloseTo(725.1264550923697, 7)
    expect(result.plan?.primaryByTarget.get('pressureRatio')?.directionId).toBe('ideal_efficiency:pressureRatio')
  })

  it('GR-04 leaves underdetermined temperatures absent and reports a blocked route', () => {
    const result = solveJoule({ p1: input(100_000), T1: input(300), q_in: input(1000), Rs: input(287), kappa: input(1.4) })
    expect(result.values.T2.value).toBeNull()
    expect(result.values.T3.value).toBeNull()
    expect(result.plan?.blocked.find(blocked => blocked.targetId === 'T3')?.candidates.map(candidate => candidate.directionId)).toContain('heat_input:T3')
    expect(result.steps.some(step => step.targetVariable === 'T3')).toBe(false)
  })

  it('GR-05 preserves contradictory redundant user facts and reports contradiction', () => {
    const result = solveJoule({
      p1: input(100_000), p2: input(1_000_000), pressureRatio: input(9), T1: input(300),
      T3: input(1400), kappa: input(1.4), Rs: input(287),
    })
    expect(result.values.pressureRatio.value).toBe(9)
    expect(result.values.pressureRatio.isUserInput).toBe(true)
    expect(result.errors.some(error => error.type === 'contradiction' && error.variableId === 'pressureRatio')).toBe(true)
  })

  it('GR-06 uses the energy route as primary and retains ideal efficiency as an alternative', () => {
    const result = solveJoule({
      pressureRatio: input(10), kappa: input(1.4), q_in: input(824_484.2394010328), w_netto: input(-397_444.7152607473),
    })
    expect(result.values.eta.value).toBeCloseTo(0.4820525320768787, 10)
    expect(result.plan?.primaryByTarget.get('eta')?.directionId).toBe('efficiency:eta')
    expect(result.plan?.alternativesByTarget.get('eta')?.map(route => route.directionId)).toContain('ideal_efficiency:eta')
  })


  it('makes GR-06 energy primary by explicit policy priority rather than stable ID', () => {
    const directions = compileSolveDirections(JOULE_FORMULAS, ALL_VARIABLES.map(variable => variable.id), JOULE_DIRECTION_POLICIES)
    const energy = directions.find(direction => direction.id === 'efficiency:eta')!
    const ideal = directions.find(direction => direction.id === 'ideal_efficiency:eta')!
    expect(energy.routePriority).toBeLessThan(ideal.routePriority)
    expect(energy.sourceRef).toContain('GR-06')
    expect(ideal.sourceRef).toContain('GR-06')
  })

  it('blocks invalid heat-input and ideal-pressure-ratio preconditions before execution', () => {
    const negativeHeat = solveJoule({ cp: input(1000), T2: input(500), q_in: input(-10) })
    expect(negativeHeat.values.T3.value).toBeNull()
    expect(negativeHeat.steps.some(step => step.targetVariable === 'T3')).toBe(false)
    expect(negativeHeat.plan?.blocked.find(blocked => blocked.targetId === 'T3')?.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ directionId: 'heat_input:T3', preconditionState: 'unsatisfied' }),
    ]))

    const invalidEfficiency = solveJoule({ eta: input(1.2), kappa: input(1.4) })
    expect(invalidEfficiency.values.pressureRatio.value).toBeNull()
    expect(invalidEfficiency.steps.some(step => step.targetVariable === 'pressureRatio')).toBe(false)
    expect(invalidEfficiency.plan?.blocked.find(blocked => blocked.targetId === 'pressureRatio')?.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ directionId: 'ideal_efficiency:pressureRatio', preconditionState: 'unsatisfied' }),
    ]))
  })


  it('blocks invalid heat-rejection and ideal-eta preconditions before execution', () => {
    const positiveRejection = solveJoule({ cp: input(1000), T4: input(700), q_out: input(10) })
    expect(positiveRejection.values.T1.value).toBeNull()
    expect(positiveRejection.steps.some(step => step.targetVariable === 'T1')).toBe(false)
    expect(positiveRejection.plan?.blocked.find(blocked => blocked.targetId === 'T1')?.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ directionId: 'heat_rejection:T1', preconditionState: 'unsatisfied' }),
    ]))

    const invalidPressureRatio = solveJoule({ pressureRatio: input(1), kappa: input(1.4) })
    expect(invalidPressureRatio.values.eta.value).toBeNull()
    expect(invalidPressureRatio.steps.some(step => step.targetVariable === 'eta')).toBe(false)
    expect(invalidPressureRatio.plan?.blocked.find(blocked => blocked.targetId === 'eta')?.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ directionId: 'ideal_efficiency:eta', preconditionState: 'unsatisfied' }),
    ]))
  })

  it('GR-07 treats Rs as validate-only and never derives it from p-v-T', () => {
    const result = solveJoule({ p1: input(100_000), v1: input(0.861), T1: input(300) })
    expect(result.values.Rs.value).toBeNull()
    expect(result.plan?.primaryByTarget.has('Rs')).toBe(false)
  })
})

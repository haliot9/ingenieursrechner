import { describe, expect, it } from 'vitest'
import { FormulaRegistry } from '../../../src/core/formula-registry'
import { solve } from '../../../src/core/solver'
import type { VariableState } from '../../../src/core/types'
import { jouleModule } from '../../../src/modules/joule'

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

  it('GR-07 treats Rs as validate-only and never derives it from p-v-T', () => {
    const result = solveJoule({ p1: input(100_000), v1: input(0.861), T1: input(300) })
    expect(result.values.Rs.value).toBeNull()
    expect(result.plan?.primaryByTarget.has('Rs')).toBe(false)
  })
})

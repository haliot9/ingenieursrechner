import { describe, expect, it } from 'vitest'
import { FormulaRegistry } from '../../../src/core/formula-registry'
import { solve } from '../../../src/core/solver'
import type { VariableState } from '../../../src/core/types'
import { jouleModule } from '../../../src/modules/joule'

function input(value: number, unit = ''): VariableState {
  return { value, unit, isUserInput: true, isComputed: false }
}

describe('Joule cycle reference case', () => {
  it('solves the compressor outlet temperature for the frozen reference inputs', () => {
    const result = solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, {
      T1: input(300, 'K'), p1: input(100_000, 'Pa'), pressureRatio: input(10), T3: input(1400, 'K'), kappa: input(1.4), Rs: input(287, 'J/(kg*K)'),
    })
    expect(result.values.T2.value).toBeCloseTo(579.209318664975, 8)
  })

  it('solves every frozen state and signed energy output for the independent reference case', () => {
    const result = solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, {
      T1: input(300, 'K'), p1: input(100_000, 'Pa'), pressureRatio: input(10), T3: input(1400, 'K'), kappa: input(1.4), Rs: input(287, 'J/(kg*K)'),
    })
    expect(result.errors).toEqual([])
    for (const id of ['p1', 'v1', 'T1', 's1', 'p2', 'v2', 'T2', 's2', 'p3', 'v3', 'T3', 's3', 'p4', 'v4', 'T4', 's4', 'cp', 'cv', 'q_in', 'q_out', 'w_comp', 'w_turb', 'w_netto', 'eta', 'back_work_ratio']) expect(result.values[id]?.value).not.toBeNull()
    expect(result.values.T4.value).toBeCloseTo(725.1264550923697, 8)
    expect(result.values.p2.value).toBeCloseTo(1_000_000, 8)
    expect(result.values.p3.value).toBeCloseTo(1_000_000, 8)
    expect(result.values.p4.value).toBeCloseTo(100_000, 8)
    expect(result.values.w_comp.value).toBeCloseTo(280_465.7605989674, 6)
    expect(result.values.w_turb.value).toBeCloseTo(-677_910.4758597147, 6)
    expect(result.values.w_netto.value).toBeCloseTo(-397_444.7152607473, 6)
    expect(result.values.q_in.value).toBeCloseTo(824_484.2394010328, 6)
    expect(result.values.q_out.value).toBeCloseTo(-427_039.52414028544, 6)
    expect(result.values.eta.value).toBeCloseTo(0.4820525320768787, 10)
    expect(result.values.back_work_ratio.value).toBeCloseTo(0.4137209419035536, 10)
    expect(result.values.w_netto.value).toBeCloseTo(-(result.values.q_in.value as number + result.values.q_out.value as number), 8)
    expect(result.values.eta.value).toBeCloseTo(-(result.values.w_netto.value as number) / (result.values.q_in.value as number), 10)
    expect(result.values.back_work_ratio.value).toBeCloseTo((result.values.w_comp.value as number) / -(result.values.w_turb.value as number), 10)
    for (const target of ['T2', 'w_comp', 'w_turb', 'q_in', 'back_work_ratio']) expect(result.steps.some(step => step.targetVariable === target && step.rearrangedLatex.length > 0)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { FormulaRegistry } from '../../../src/core/formula-registry'
import { solve } from '../../../src/core/solver'
import type { VariableState } from '../../../src/core/types'
import { ottoModule } from '../../../src/modules/otto'

function input(value: number, unit = ''): VariableState {
  return { value, unit, isUserInput: true, isComputed: false }
}

describe('Otto cycle reference case', () => {
  it('solves all state points and cycle outputs for an independent ideal-air reference case', () => {
    const result = solve(
      FormulaRegistry.fromModule(ottoModule),
      ottoModule.variables,
      {
        T1: input(300, 'K'),
        p1: input(100_000, 'Pa'),
        r: input(10),
        T3: input(1_800, 'K'),
        kappa: input(1.4),
        Rs: input(287, 'J/(kg*K)'),
      },
    )

    expect(result.errors).toEqual([])
    for (const variableId of ['p1', 'v1', 'T1', 's1', 'p2', 'v2', 'T2', 's2', 'p3', 'v3', 'T3', 's3', 'p4', 'v4', 'T4', 's4', 'cv', 'cp', 'q_in', 'q_out', 'w_netto', 'eta']) {
      expect(result.values[variableId]?.value).not.toBeNull()
    }
    expect(result.values.cv.value).toBeCloseTo(717.5, 10)
    expect(result.values.cp.value).toBeCloseTo(1_004.5, 10)
    expect(result.values.v1.value).toBeCloseTo(0.861, 10)
    expect(result.values.v2.value).toBeCloseTo(0.0861, 10)
    expect(result.values.T2.value).toBeCloseTo(753.565929452874, 8)
    expect(result.values.p2.value).toBeCloseTo(2_511_886.43150958, 5)
    expect(result.values.p3.value).toBeCloseTo(6_000_000, 5)
    expect(result.values.T4.value).toBeCloseTo(716.592906996295, 8)
    expect(result.values.p4.value).toBeCloseTo(238_864.302332098, 5)
    expect(result.values.q_in.value).toBeCloseTo(750_816.445617563, 5)
    expect(result.values.q_out.value).toBeCloseTo(-298_905.410769842, 5)
    expect(result.values.w_netto.value).toBeCloseTo(-451_911.034847721, 5)
    expect(result.values.eta.value).toBeCloseTo(0.601892829447, 10)
    expect(result.values.eta.value).toBeCloseTo(1 - 1 / 10 ** (1.4 - 1), 10)
  })
})

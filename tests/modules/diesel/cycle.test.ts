import { describe, expect, it } from 'vitest'
import { FormulaRegistry } from '../../../src/core/formula-registry'
import { solve } from '../../../src/core/solver'
import type { VariableState } from '../../../src/core/types'
import { dieselModule } from '../../../src/modules/diesel'

function input(value: number, unit = ''): VariableState {
  return { value, unit, isUserInput: true, isComputed: false }
}

describe('Diesel cycle reference case', () => {
  it('solves all state points and cycle outputs for an independent ideal-air reference case', () => {
    const result = solve(
      FormulaRegistry.fromModule(dieselModule),
      dieselModule.variables,
      {
        T1: input(300, 'K'),
        p1: input(100_000, 'Pa'),
        r: input(18),
        rho_cutoff: input(2),
        kappa: input(1.4),
        Rs: input(287, 'J/(kg*K)'),
      },
    )

    expect(result.errors).toEqual([])
    for (const variableId of ['p1', 'v1', 'T1', 's1', 'p2', 'v2', 'T2', 's2', 'p3', 'v3', 'T3', 's3', 'p4', 'v4', 'T4', 's4', 'q_in', 'q_out', 'w_netto', 'eta']) {
      expect(result.values[variableId]?.value).not.toBeNull()
    }
    expect(result.values.T2.value).toBeCloseTo(953.301456944, 7)
    expect(result.values.p2.value).toBeCloseTo(5_719_808.74166, 4)
    expect(result.values.p3.value).toBeCloseTo(5_719_808.74166, 4)
    expect(result.values.T3.value).toBeCloseTo(1_906.60291389, 7)
    expect(result.values.T4.value).toBeCloseTo(791.704746464, 7)
    expect(result.values.p4.value).toBeCloseTo(263_901.582155, 4)
    expect(result.values.q_in.value).toBeCloseTo(957_591.3135, 4)
    expect(result.values.q_out.value).toBeCloseTo(-352_798.155588, 4)
    expect(result.values.w_netto.value).toBeCloseTo(-604_793.157912, 4)
    expect(result.values.eta.value).toBeCloseTo(0.631577531444, 8)
  })
})

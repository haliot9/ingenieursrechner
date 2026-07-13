import { describe, expect, it } from 'vitest'
import { FormulaRegistry } from '../../src/core/formula-registry'
import { solve } from '../../src/core/solver'
import type { VariableState } from '../../src/core/types'
import { carnotModule } from '../../src/modules/carnot'

function input(value: number, unit: string): VariableState {
  return { value, unit, isUserInput: true, isComputed: false }
}

describe('computed result constraints', () => {
  it('rejects an efficiency outside the physical range', () => {
    const registry = FormulaRegistry.fromModule(carnotModule)
    const result = solve(registry, carnotModule.variables, {
      T1: input(600, 'K'),
      T3: input(300, 'K'),
    })

    expect(result.values.eta.value).toBeNull()
    expect(result.errors).toContainEqual(expect.objectContaining({
      type: 'constraint_violation',
      variableId: 'eta',
    }))
  })
})

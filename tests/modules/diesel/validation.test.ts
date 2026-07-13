import { describe, expect, it } from 'vitest'
import type { VariableState } from '../../../src/core/types'
import { validateDieselCycle } from '../../../src/modules/diesel/validation'

function value(number: number): VariableState {
  return { value: number, unit: '', isUserInput: true, isComputed: false }
}

describe('Diesel cycle validation', () => {
  it('rejects a cutoff ratio at or above the compression ratio', () => {
    const errors = validateDieselCycle({ r: value(18), rho_cutoff: value(18) })
    expect(errors).toContainEqual(expect.objectContaining({ type: 'contradiction', variableId: 'rho_cutoff' }))
  })

  it('rejects inconsistent isobaric and isochoric process endpoints', () => {
    const errors = validateDieselCycle({ p2: value(2_000_000), p3: value(1_900_000), v1: value(0.8), v4: value(0.7) })
    expect(errors).toContainEqual(expect.objectContaining({ variableId: 'p3' }))
    expect(errors).toContainEqual(expect.objectContaining({ variableId: 'v4' }))
  })
})

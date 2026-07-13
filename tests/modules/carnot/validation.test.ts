import { describe, expect, it } from 'vitest'
import type { VariableState } from '../../../src/core/types'
import { validateCarnotCycle } from '../../../src/modules/carnot/validation'

function value(number: number): VariableState {
  return { value: number, unit: '', isUserInput: true, isComputed: false }
}

describe('validateCarnotCycle', () => {
  it('rejects equal or reversed reservoir temperatures', () => {
    const equal = validateCarnotCycle({ T1: value(300), T3: value(300) })
    const reversed = validateCarnotCycle({ T1: value(600), T3: value(300) })

    expect(equal).toContainEqual(expect.objectContaining({ type: 'constraint_violation', variableId: 'T3' }))
    expect(reversed).toContainEqual(expect.objectContaining({ type: 'constraint_violation', variableId: 'T3' }))
  })

  it('detects a contradictory efficiency', () => {
    const errors = validateCarnotCycle({ T1: value(300), T3: value(600), eta: value(0.4) })
    expect(errors).toContainEqual(expect.objectContaining({ type: 'contradiction', variableId: 'eta' }))
  })

  it('detects a contradictory first-law balance', () => {
    const errors = validateCarnotCycle({
      q_in: value(1000), q_out: value(-400), w_netto: value(-500),
    })
    expect(errors).toContainEqual(expect.objectContaining({ type: 'contradiction', variableId: 'w_netto' }))
  })

  it('accepts consistent central Carnot invariants', () => {
    const errors = validateCarnotCycle({
      T1: value(300), T2: value(600), T3: value(600), T4: value(300),
      eta: value(0.5), q_in: value(1000), q_out: value(-500), w_netto: value(-500),
    })
    expect(errors).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import type { VariableState } from '../../../src/core/types'
import { validateOttoCycle } from '../../../src/modules/otto/validation'

function value(number: number): VariableState {
  return { value: number, unit: '', isUserInput: true, isComputed: false }
}

describe('Otto cycle validation', () => {
  it('rejects inconsistent isochoric and isentropic process endpoints', () => {
    const errors = validateOttoCycle({
      v2: value(0.08), v3: value(0.09), v4: value(0.86), v1: value(0.80),
      s1: value(5), s2: value(6), s3: value(7), s4: value(8),
    })

    for (const variableId of ['v3', 'v4', 's2', 's4']) {
      expect(errors).toContainEqual(expect.objectContaining({ type: 'contradiction', variableId }))
    }
  })

  it('rejects a non-heating Otto state and an inconsistent energy balance', () => {
    const errors = validateOttoCycle({
      T2: value(800), T3: value(800),
      q_in: value(600_000), q_out: value(-250_000), w_netto: value(-300_000),
    })

    expect(errors).toContainEqual(expect.objectContaining({ type: 'contradiction', variableId: 'T3' }))
    expect(errors).toContainEqual(expect.objectContaining({ type: 'contradiction', variableId: 'w_netto' }))
  })

  it('rejects state relations that would reverse heat addition or heat rejection', () => {
    const errors = validateOttoCycle({
      T1: value(300), T2: value(800), T3: value(1_000), T4: value(300),
      p2: value(2_000_000), p3: value(1_900_000),
    })

    expect(errors).toContainEqual(expect.objectContaining({ type: 'contradiction', variableId: 'p3' }))
    expect(errors).toContainEqual(expect.objectContaining({ type: 'contradiction', variableId: 'T4' }))
  })
})

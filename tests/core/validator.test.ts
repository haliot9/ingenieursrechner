import { describe, expect, it } from 'vitest'
import type { Variable, VariableState } from '../../src/core/types'
import { validateInput } from '../../src/core/validator'

function state(value: number): VariableState {
  return { value, unit: '', isUserInput: true, isComputed: false }
}

function variable(constraint: Variable['constraints'][number]): Variable {
  return {
    id: 'x', symbol: 'x', latex: 'x', name: 'x', defaultUnit: '', alternativeUnits: [],
    constraints: [constraint],
  }
}

describe('strict variable constraints', () => {
  it('supports strict greater-than bounds', () => {
    const target = variable({ type: 'greaterThan', value: 1, message: 'x > 1' })
    expect(validateInput(target, state(1))?.type).toBe('constraint_violation')
    expect(validateInput(target, state(1.0001))).toBeNull()
  })

  it('supports strict less-than bounds', () => {
    const target = variable({ type: 'lessThan', value: 0, message: 'x < 0' })
    expect(validateInput(target, state(0))?.type).toBe('constraint_violation')
    expect(validateInput(target, state(-0.0001))).toBeNull()
  })
})

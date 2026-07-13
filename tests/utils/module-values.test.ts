import { describe, expect, it } from 'vitest'
import type { VariableState } from '../../src/core/types'
import { carnotModule } from '../../src/modules/carnot'
import { convertValuesToModuleUnits } from '../../src/utils/module-values'

function displayed(value: number, unit: string): VariableState {
  return { value, unit, isUserInput: false, isComputed: true }
}

describe('convertValuesToModuleUnits', () => {
  it('restores display values to the module SI/default-unit contract', () => {
    const converted = convertValuesToModuleUnits(carnotModule, {
      p1: displayed(0.883883, 'bar'),
      v1: displayed(811.759, 'L/kg'),
      T1: displayed(-23.15, 'degC'),
      s1: displayed(-0.0497565, 'kJ/(kg*K)'),
      q_in: displayed(230.954, 'kJ/kg'),
    })

    expect(converted.p1.value).toBeCloseTo(88_388.3, 5)
    expect(converted.p1.unit).toBe('Pa')
    expect(converted.v1.value).toBeCloseTo(0.811759, 8)
    expect(converted.v1.unit).toBe('m^3/kg')
    expect(converted.T1.value).toBeCloseTo(250, 8)
    expect(converted.T1.unit).toBe('K')
    expect(converted.s1.value).toBeCloseTo(-49.7565, 8)
    expect(converted.s1.unit).toBe('J/(kg*K)')
    expect(converted.q_in.value).toBeCloseTo(230_954, 5)
    expect(converted.q_in.unit).toBe('J/kg')
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { getModule } from '../../../src/modules'
import { useCalculatorStore } from '../../../src/store/calculator-store'

describe('Diesel module registration', () => {
  beforeEach(() => {
    useCalculatorStore.getState().setModule('carnot')
  })

  it('is available from the public module registry and its reference preset solves through the store', () => {
    expect(getModule('diesel')?.name).toBe('Diesel-Prozess')

    useCalculatorStore.getState().setModule('diesel')
    useCalculatorStore.getState().loadPreset('reference-air')

    const { activeModuleId, values, errors } = useCalculatorStore.getState()
    expect(activeModuleId).toBe('diesel')
    expect(values.eta.value).toBeCloseTo(0.631577531444, 8)
    expect(errors).toEqual([])
  })
})

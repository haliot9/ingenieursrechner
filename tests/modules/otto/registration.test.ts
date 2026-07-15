import { beforeEach, describe, expect, it } from 'vitest'
import { getModule } from '../../../src/modules'
import { useCalculatorStore } from '../../../src/store/calculator-store'

describe('Otto module registration', () => {
  beforeEach(() => {
    useCalculatorStore.getState().setModule('carnot')
  })

  it('is available from the public module registry and its reference preset solves through the store', () => {
    expect(getModule('otto')?.name).toBe('Otto-Prozess')

    useCalculatorStore.getState().setModule('otto')
    useCalculatorStore.getState().loadPreset('reference-air')

    const { activeModuleId, values, errors } = useCalculatorStore.getState()
    expect(activeModuleId).toBe('otto')
    expect(values.eta.value).toBeCloseTo(0.601892829447, 10)
    expect(errors).toEqual([])
  })
})

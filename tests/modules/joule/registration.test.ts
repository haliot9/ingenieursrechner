import { beforeEach, describe, expect, it } from 'vitest'
import { getModule } from '../../../src/modules'
import { useCalculatorStore } from '../../../src/store/calculator-store'

describe('Joule module registration', () => {
  beforeEach(() => useCalculatorStore.getState().setModule('carnot'))
  it('is publicly registered and exposes BWR through the generic store result path', () => {
    expect(getModule('joule')?.name).toBe('Joule-/Brayton-Prozess')
    useCalculatorStore.getState().setModule('joule')
    useCalculatorStore.getState().loadPreset('reference-air')
    const state = useCalculatorStore.getState()
    expect(state.activeModuleId).toBe('joule')
    expect(state.values.back_work_ratio.value).toBeCloseTo(0.4137209419035536, 10)
    expect(state.errors).toEqual([])
  })
})

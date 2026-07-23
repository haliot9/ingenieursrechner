import { beforeEach, describe, expect, it } from 'vitest'
import { useCalculatorStore } from '../../src/store/calculator-store'

describe('calculator presets', () => {
  beforeEach(() => {
    useCalculatorStore.getState().setModule('carnot')
  })

  it('reports contradictory redundant Carnot inputs', () => {
    const store = useCalculatorStore.getState()
    store.setValue('T1', 300)
    store.setValue('T3', 600)
    store.setValue('eta', 0.4)

    expect(useCalculatorStore.getState().errors).toContainEqual(expect.objectContaining({
      type: 'contradiction',
      variableId: 'eta',
    }))
  })

  it('rejects invalid engine signs and kappa equal to one', () => {
    useCalculatorStore.getState().setValue('q_in', -1000)
    expect(useCalculatorStore.getState().errors).toContainEqual(expect.objectContaining({ variableId: 'q_in' }))

    useCalculatorStore.getState().setModule('carnot')
    useCalculatorStore.getState().setValue('kappa', 1)
    expect(useCalculatorStore.getState().errors).toContainEqual(expect.objectContaining({ variableId: 'kappa' }))
  })

  it('loads the reference air case and solves the Carnot cycle', () => {
    useCalculatorStore.getState().loadPreset('reference-air')

    const { values, errors } = useCalculatorStore.getState()
    expect(values.T1.value).toBe(250)
    expect(values.T3.value).toBe(500)
    expect(values.p2.value).toBe(1_000_000)
    expect(values.p3.value).toBe(200_000)
    expect(values.Rs.value).toBe(287)
    expect(values.kappa.value).toBe(1.4)
    expect(values.eta.value).toBeCloseTo(0.5, 8)
    expect(errors.filter(error => error.type !== 'insufficient_data')).toEqual([])
  })


  it('clears stale computed scenario data when a current user edit is invalid', () => {
    const store = useCalculatorStore.getState()
    store.setModule('joule')
    store.loadPreset('reference-air')
    store.setUnit('p1', 'bar')
    expect(useCalculatorStore.getState().values.T2.isComputed).toBe(true)

    store.setValue('pressureRatio', 1)
    const invalid = useCalculatorStore.getState()
    expect(invalid.values.p1).toMatchObject({ value: 1, unit: 'bar', isUserInput: true, isComputed: false })
    expect(invalid.values.pressureRatio).toMatchObject({ value: 1, unit: '', isUserInput: true, isComputed: false })
    expect(Object.values(invalid.values).filter(value => !value.isUserInput).every(value => value.value === null && !value.isComputed)).toBe(true)
    expect(invalid.steps).toEqual([])
    expect(invalid.plan).toBeUndefined()
    expect(invalid.presentation).toBeUndefined()
  })

  it('atomically clears planned Joule evidence and presentation with the scenario', () => {
    const store = useCalculatorStore.getState()
    store.setModule('joule')
    store.loadPreset('reference-air')
    expect(useCalculatorStore.getState().plan).toBeTruthy()
    expect(useCalculatorStore.getState().presentation?.primarySteps.length).toBeGreaterThan(0)

    store.clearAll()
    const cleared = useCalculatorStore.getState()
    expect(cleared.values.T1.value).toBeNull()
    expect(cleared.steps).toEqual([])
    expect(cleared.plan).toBeUndefined()
    expect(cleared.presentation).toBeUndefined()
    expect(cleared.errors).toEqual([])
    expect(cleared.unsolved).toEqual([])
  })

})

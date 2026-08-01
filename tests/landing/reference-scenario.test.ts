import { describe, expect, it } from 'vitest'
import { THERMODYNAMICS_MODULE_IDS } from '../../src/landing/model/landing-modules'
import { buildReferenceScenario } from '../../src/landing/model/reference-scenario'
import { useCalculatorStore } from '../../src/store/calculator-store'

describe('buildReferenceScenario', () => {
  it('derives a diagram from each module’s own reference-air preset', () => {
    for (const moduleId of THERMODYNAMICS_MODULE_IDS) {
      expect(buildReferenceScenario(moduleId).diagramSpec).not.toBeNull()
    }
  })

  it('preserves the complete Joule reference story', () => {
    expect(buildReferenceScenario('joule').story).toMatchObject({ mode: 'complete' })
  })

  it('does not change the active calculator module', () => {
    const activeModuleId = useCalculatorStore.getState().activeModuleId

    buildReferenceScenario('joule')

    expect(useCalculatorStore.getState().activeModuleId).toBe(activeModuleId)
  })
})

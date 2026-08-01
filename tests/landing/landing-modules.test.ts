import { describe, expect, it } from 'vitest'
import { getThermodynamicsModules } from '../../src/landing/model/landing-modules'

describe('getThermodynamicsModules', () => {
  it('presents exactly the registered thermodynamic calculators', () => {
    expect(getThermodynamicsModules().map(module => module.id))
      .toEqual(['carnot', 'otto', 'diesel', 'joule'])
    expect(getThermodynamicsModules().every(module => module.processSequence.length === 4)).toBe(true)
  })
})

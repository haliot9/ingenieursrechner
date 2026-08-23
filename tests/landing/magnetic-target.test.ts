import { describe, expect, it } from 'vitest'
import { chooseMagneticTarget } from '../../src/landing/motion/magnetic-target'

describe('chooseMagneticTarget', () => {
  it('rejects chapters below the 0.72 visibility threshold', () => {
    expect(chooseMagneticTarget([
      { id: 'haltung', visibleRatio: .719, distanceToLanding: 0 },
    ], false)).toBeUndefined()
  })

  it('rejects chapters beyond 120 px in either direction', () => {
    expect(chooseMagneticTarget([
      { id: 'module', visibleRatio: .8, distanceToLanding: 121 },
      { id: 'thermodynamik', visibleRatio: .8, distanceToLanding: -121 },
    ], false)).toBeUndefined()
  })

  it('selects the nearest chapter that meets both boundaries', () => {
    expect(chooseMagneticTarget([
      { id: 'haltung', visibleRatio: .95, distanceToLanding: 120 },
      { id: 'module', visibleRatio: .72, distanceToLanding: -36 },
      { id: 'thermodynamik', visibleRatio: .9, distanceToLanding: 18 },
    ], false)).toBe('thermodynamik')
  })

  it('never selects a target when reduced motion is enabled', () => {
    expect(chooseMagneticTarget([
      { id: 'projekt', visibleRatio: 1, distanceToLanding: 0 },
    ], true)).toBeUndefined()
  })
})

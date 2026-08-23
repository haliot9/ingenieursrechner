import { describe, expect, it } from 'vitest'
import * as rendererModule from '../../src/landing/background/renderer/LandingBackgroundRenderer'

type CameraMathModule = {
  calculateCircumscribedSphereCameraDistance?: (
    sphereRadius: number,
    verticalFovDegrees: number,
    aspect: number,
  ) => number
  calculateCircumscribedSphereNearPlane?: (
    sphereRadius: number,
    verticalFovDegrees: number,
    aspect: number,
  ) => number
  normalizeLandingBackgroundResize?: (
    width: number,
    height: number,
    deviceDpr: number,
    maximumDpr: number,
  ) => { safeWidth: number; safeHeight: number; effectiveDpr: number }
}

describe('landing background camera geometry', () => {
  it('fits the particle sphere to the viewport diagonal at desktop, mobile, and square aspects', () => {
    const calculateDistance = (rendererModule as CameraMathModule)
      .calculateCircumscribedSphereCameraDistance

    expect(calculateDistance).toBeTypeOf('function')
    if (!calculateDistance) return

    // Hand oracle: R=5 and tan(diagonalHalfFov)=tan(21deg)*hypot(aspect, 1),
    // then the exact sphere-tangent distance is R/sin(diagonalHalfFov).
    const cases = [
      { name: 'desktop 1440x900', aspect: 1.6, expectedDistance: 8.52396202575324 },
      { name: 'mobile 390x844', aspect: 390 / 844, expectedDistance: 12.8378218302744 },
      { name: 'square', aspect: 1, expectedDistance: 10.4800340141309 },
    ] as const

    for (const { name, aspect, expectedDistance } of cases) {
      const actual = calculateDistance(5, 42, aspect)
      expect(actual, name).toBeCloseTo(expectedDistance, 12)
      // The former fixed camera z = spread * 1.65 = 16.5 misses every aspect.
      expect(16.5, `${name} old fixed distance`).not.toBeCloseTo(expectedDistance, 3)
    }
  })

  it('keeps the near plane below the sphere tangent depth at extreme finite aspects', () => {
    const calculateNear = (rendererModule as CameraMathModule)
      .calculateCircumscribedSphereNearPlane

    expect(calculateNear).toBeTypeOf('function')
    if (!calculateNear) return

    // Independent numeric anchors for R=5 and vertical FOV=42deg. The tangent
    // depths are 0.09286955614966405 at aspect 19 and 0.00003393229610225766
    // at aspect 1000; the production near plane is deliberately half of each.
    const cases = [
      { aspect: 19, tangentDepth: 0.09286955614966405, expectedNear: 0.046434778074832025 },
      { aspect: 1000, tangentDepth: 0.00003393229610225766, expectedNear: 0.00001696614805112883 },
    ] as const

    for (const { aspect, tangentDepth, expectedNear } of cases) {
      const near = calculateNear(5, 42, aspect)
      expect(near).toBeCloseTo(expectedNear, 15)
      expect(near).toBeGreaterThan(0)
      expect(near).toBeLessThan(tangentDepth)
      expect(0.1).toBeGreaterThan(tangentDepth)
    }
  })

  it('normalizes invalid resize metrics before they reach WebGL', () => {
    const normalizeResize = (rendererModule as CameraMathModule)
      .normalizeLandingBackgroundResize

    expect(normalizeResize).toBeTypeOf('function')
    if (!normalizeResize) return

    expect(normalizeResize(Number.NaN, Number.POSITIVE_INFINITY, Number.NaN, 1.5))
      .toEqual({ safeWidth: 1, safeHeight: 1, effectiveDpr: 1 })
    expect(normalizeResize(0, -8, Number.POSITIVE_INFINITY, 1.5))
      .toEqual({ safeWidth: 1, safeHeight: 1, effectiveDpr: 1 })
    expect(normalizeResize(12.6, 4.4, 2, 1.5))
      .toEqual({ safeWidth: 13, safeHeight: 4, effectiveDpr: 1.5 })
  })
})

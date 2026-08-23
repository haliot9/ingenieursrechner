import { describe, expect, it } from 'vitest'
import { lineFieldConfig } from '../../src/landing/line-field/config/line-field-config.generated'
import type { LineFieldViewportGeometry } from '../../src/landing/line-field/motion/line-field-geometry'
import {
  evaluateMottoOrbit,
  prepareMottoOrbitProjection,
} from '../../src/landing/line-field/motion/motto-orbit'
import type { OrbitProjectionStatus } from '../../src/landing/line-field/motion/responsive-orbit-projection'

function geometryAt(
  scrollY = 1620,
  overrides: Partial<LineFieldViewportGeometry> = {},
): LineFieldViewportGeometry {
  return {
    scrollY,
    viewportWidth: 1440,
    viewportHeight: 900,
    pageHeight: 6000,
    filmTop: 0,
    filmHeight: 2520,
    anchorViewport: [720, 450],
    headerTargetViewportY: 72,
    mottoTop: 2520,
    mottoHeight: 900,
    mottoCardFinalCenterX: 1080,
    mottoCardFinalWidth: 490,
    mottoCardFinalHeight: 300,
    mottoCardFinalTop: 2800,
    mottoCardFinalBottom: 3100,
    ...overrides,
  }
}

describe('prepared motto orbit projection', () => {
  it('shares one immutable reference preparation and fit across progress and scroll-only frames', () => {
    const config = structuredClone(lineFieldConfig.motto)
    const geometry = geometryAt(1620)

    evaluateMottoOrbit(0.2, geometry, config)
    const prepared = prepareMottoOrbitProjection(geometry, config)
    evaluateMottoOrbit(0.8, geometryAt(2160), config)
    const reused = prepareMottoOrbitProjection(geometryAt(2160), config)

    expect(prepared.referenceSamples).toHaveLength(config.projection.sampleCount + 1)
    expect(Object.isFrozen(prepared)).toBe(true)
    expect(Object.isFrozen(prepared.referenceSamples)).toBe(true)
    expect(prepared.referenceSamples.every((sample) => (
      Object.isFrozen(sample) && Object.isFrozen(sample.referenceCenter)
    ))).toBe(true)
    expect(reused).toBe(prepared)
    expect(reused.referenceSamples).toBe(prepared.referenceSamples)
    expect(reused.fit).toBe(prepared.fit)
  })

  it('evaluates only the current motion sample after the projection is prepared', () => {
    let phiStartReads = 0
    const orbit = { ...lineFieldConfig.motto.orbit }
    Object.defineProperty(orbit, 'phiStartDegrees', {
      configurable: true,
      enumerable: true,
      get: () => {
        phiStartReads += 1
        return lineFieldConfig.motto.orbit.phiStartDegrees
      },
    })
    const config = { ...lineFieldConfig.motto, orbit }
    const geometry = geometryAt()

    evaluateMottoOrbit(0.2, geometry, config)
    expect(phiStartReads).toBe(config.projection.sampleCount + 2)

    phiStartReads = 0
    evaluateMottoOrbit(0.8, geometryAt(2100), config)
    expect(phiStartReads).toBe(1)
  })

  it.each([
    ['viewport width', { viewportWidth: 1200 }],
    ['panel top', { mottoTop: 2600 }],
    ['final center X', { mottoCardFinalCenterX: 1000 }],
    ['final center Y', { mottoCardFinalTop: 2820 }],
    ['card width', { mottoCardFinalWidth: 420 }],
  ] as const)('invalidates only the last fit when projection %s changes', (
    _case,
    geometryOverride,
  ) => {
    const config = structuredClone(lineFieldConfig.motto)
    const geometry = geometryAt()
    const initial = prepareMottoOrbitProjection(geometry, config)
    const changed = prepareMottoOrbitProjection(
      geometryAt(geometry.scrollY, geometryOverride),
      config,
    )
    const replaced = prepareMottoOrbitProjection(geometry, config)

    expect(changed).not.toBe(initial)
    expect(changed.fit).not.toBe(initial.fit)
    expect(changed.referenceSamples).toBe(initial.referenceSamples)
    expect(replaced).not.toBe(initial)
    expect(replaced).not.toBe(changed)
    expect(replaced.referenceSamples).toBe(initial.referenceSamples)
  })

  it('prepares independent sample identities for independent config identities', () => {
    const geometry = geometryAt()
    const first = prepareMottoOrbitProjection(
      geometry,
      structuredClone(lineFieldConfig.motto),
    )
    const second = prepareMottoOrbitProjection(
      geometry,
      structuredClone(lineFieldConfig.motto),
    )

    expect(second).not.toBe(first)
    expect(second.referenceSamples).not.toBe(first.referenceSamples)
    expect(second.referenceSamples).toEqual(first.referenceSamples)
  })

  it('keeps equal-progress output deterministic after forward and reverse cache reuse', () => {
    const config = structuredClone(lineFieldConfig.motto)
    const geometry = geometryAt()
    const forward = evaluateMottoOrbit(0.42, geometry, config)

    evaluateMottoOrbit(0.8, geometryAt(2100), config)
    const reverse = evaluateMottoOrbit(0.42, geometryAt(1700), config)

    expect(reverse).toEqual(forward)
    expect(prepareMottoOrbitProjection(geometryAt(1700), config)).toBe(
      prepareMottoOrbitProjection(geometry, config),
    )
  })

  it('does not prepare the full reference path for the literal final frame', () => {
    let sampleCountReads = 0
    const projection = { ...lineFieldConfig.motto.projection }
    Object.defineProperty(projection, 'sampleCount', {
      configurable: true,
      enumerable: true,
      get: () => {
        sampleCountReads += 1
        return lineFieldConfig.motto.projection.sampleCount
      },
    })
    const config = { ...lineFieldConfig.motto, projection }
    const geometry = geometryAt(2520)

    expect(evaluateMottoOrbit(1, geometry, config)).toEqual({
      translateXPx: 0,
      translateYPx: 0,
      scale: 1,
      blurPx: 0,
      opacity: 1,
      projectionStatus: 'ok',
    })
    expect(sampleCountReads).toBe(0)

    const prepared = prepareMottoOrbitProjection(geometry, config)
    expect(prepared.referenceSamples).toHaveLength(97)
    expect(sampleCountReads).toBe(1)
  })

  it('reports a collapsed actual endpoint chord without preparing the full path', () => {
    let sampleCountReads = 0
    const projection = { ...lineFieldConfig.motto.projection }
    Object.defineProperty(projection, 'sampleCount', {
      configurable: true,
      enumerable: true,
      get: () => {
        sampleCountReads += 1
        return lineFieldConfig.motto.projection.sampleCount
      },
    })
    const config = {
      ...lineFieldConfig.motto,
      orbit: {
        ...lineFieldConfig.motto.orbit,
        thetaXDegrees: 0,
        thetaYDegrees: 0,
        phiStartDegrees: 0,
        phiPeakDegrees: 180,
        phiEndDegrees: 360,
        originDriftRadiusRatio: 0,
        localOffsetRadiusRatio: 0,
      },
      projection,
    }

    expect(evaluateMottoOrbit(1, geometryAt(2520), config)).toEqual({
      translateXPx: 0,
      translateYPx: 0,
      scale: 1,
      blurPx: 0,
      opacity: 1,
      projectionStatus: 'degenerate',
    })
    expect(sampleCountReads).toBe(0)
  })

  it.each([
    [
      'an endpoint gutter violation',
      geometryAt(2520, { mottoCardFinalCenterX: 100 }),
      'endpoint-gutter-violation',
    ],
    [
      'invalid geometry',
      geometryAt(2520, { viewportWidth: Number.NaN }),
      'degenerate',
    ],
  ] as const)('keeps the literal final frame while reporting %s', (
    _case,
    geometry,
    projectionStatus: OrbitProjectionStatus,
  ) => {
    expect(evaluateMottoOrbit(1, geometry, lineFieldConfig.motto)).toEqual({
      translateXPx: 0,
      translateYPx: 0,
      scale: 1,
      blurPx: 0,
      opacity: 1,
      projectionStatus,
    })
  })
})

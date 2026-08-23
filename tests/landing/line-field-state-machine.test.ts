import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { lineFieldConfig } from '../../src/landing/line-field/config/line-field-config.generated'
import type { LineFieldAnimationConfig } from '../../src/landing/line-field/config/line-field-config.types'
import { createLaneTipOffsets } from '../../src/landing/line-field/math/line-stagger'
import {
  deriveLineFieldScrollMetrics,
  resolveHeaderTargetViewportY,
} from '../../src/landing/line-field/motion/line-field-geometry'
import type { LineFieldViewportGeometry } from '../../src/landing/line-field/motion/line-field-geometry'
import { evaluateMottoOrbit } from '../../src/landing/line-field/motion/motto-orbit'
import {
  createLineFieldMotionState,
  getLineFieldMotionSnapshot,
  stepLineFieldMotion,
} from '../../src/landing/line-field/motion/line-field-state-machine'
import type {
  LineFieldMotionInput,
  LineFieldMotionResult,
  LineFieldMotionSnapshot,
  LineFieldMotionState,
} from '../../src/landing/line-field/motion/line-field-state-machine'

const TAU = 2 * Math.PI
const BUILD_END_SCROLL_Y = 2592
const HANDOFF_DOCUMENT_Y = 3172

function geometryAt(
  scrollY: number,
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

function motionInput(
  geometry: LineFieldViewportGeometry,
  nowMs: number,
  overrides: Partial<Omit<LineFieldMotionInput, 'geometry' | 'nowMs'>> = {},
): LineFieldMotionInput {
  return {
    geometry,
    theme: 'dark',
    pointerTarget: { proximity: 0, twistNormalized: 0 },
    nowMs,
    clockMode: 'advance',
    ...overrides,
  }
}

function stepAt(
  state: LineFieldMotionState,
  scrollY: number,
  nowMs: number,
  inputOverrides: Partial<Omit<LineFieldMotionInput, 'geometry' | 'nowMs'>> = {},
  geometryOverrides: Partial<LineFieldViewportGeometry> = {},
): LineFieldMotionResult {
  return stepLineFieldMotion(
    state,
    motionInput(geometryAt(scrollY, geometryOverrides), nowMs, inputOverrides),
    lineFieldConfig,
  )
}

function advanceBy(
  result: LineFieldMotionResult,
  geometry: LineFieldViewportGeometry,
  fromNowMs: number,
  durationMs: number,
  inputOverrides: Partial<Omit<LineFieldMotionInput, 'geometry' | 'nowMs'>> = {},
): LineFieldMotionResult {
  let current = result
  let nowMs = fromNowMs
  let remainingMs = durationMs

  while (remainingMs > 0) {
    const deltaMs = Math.min(50, remainingMs)
    nowMs += deltaMs
    remainingMs -= deltaMs
    current = stepLineFieldMotion(
      current.state,
      motionInput(geometry, nowMs, inputOverrides),
      lineFieldConfig,
    )
  }

  return current
}

function firstHandoffWithConfig(config: LineFieldAnimationConfig): LineFieldMotionResult {
  const metrics = deriveLineFieldScrollMetrics(geometryAt(0), config)
  if (metrics === null) throw new Error('Expected valid test geometry')
  const seeded = stepLineFieldMotion(
    createLineFieldMotionState(config),
    motionInput(geometryAt(metrics.seedScrollY), 0, { clockMode: 'rebase' }),
    config,
  )

  return stepLineFieldMotion(
    seeded.state,
    motionInput(geometryAt(BUILD_END_SCROLL_Y), 1000),
    config,
  )
}

function firstHandoff(): LineFieldMotionResult {
  return firstHandoffWithConfig(lineFieldConfig)
}

function atBlendEnd(): LineFieldMotionResult {
  return advanceBy(firstHandoff(), geometryAt(BUILD_END_SCROLL_Y), 1000, 450)
}

function spatialValues(result: LineFieldMotionResult) {
  return {
    commonFrontDocumentY: result.frame.commonFrontDocumentY,
    unwrappedPhase: result.frame.unwrappedPhase,
    tipOffsetsViewportFractions: result.frame.tipOffsetsViewportFractions,
    upwardSpineReveal: result.frame.upwardSpineReveal,
    opacity: result.frame.opacity,
  }
}

function expectFiniteResult(result: LineFieldMotionResult) {
  const values = [
    result.frame.anchorViewport[0],
    result.frame.anchorViewport[1],
    result.frame.sourceOriginViewportFraction,
    result.frame.headerTargetViewportY,
    result.frame.originDocumentY,
    result.frame.commonFrontDocumentY,
    result.frame.upwardSpineReveal,
    result.frame.unwrappedPhase,
    result.frame.pointerProximity,
    result.state.pointerTwistNormalized,
    result.frame.opacity,
    result.frame.mottoProgress,
    result.frontVelocityPxPerSecond,
    result.phaseVelocityRadiansPerSecond,
    result.motto.translateXPx,
    result.motto.translateYPx,
    result.motto.scale,
    result.motto.blurPx,
    result.motto.opacity,
    ...result.frame.tipOffsetsViewportFractions,
  ]

  expect(values.every(Number.isFinite)).toBe(true)
}

function smoothstep01(value: number): number {
  const clamped = Math.min(1, Math.max(0, value))
  return clamped * clamped * (3 - 2 * clamped)
}

function canonicalOffsets(): readonly number[] {
  return createLaneTipOffsets({
    tipCount: 36,
    seed: lineFieldConfig.fronts.seed,
    maximumTipGapVh: lineFieldConfig.fronts.maximumTipGapVh / 100,
    staggerStrength: lineFieldConfig.fronts.staggerStrength,
  })
}

function sha256Json(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')
}

function expectedScrollBuild(scrollY: number) {
  const metrics = deriveLineFieldScrollMetrics(geometryAt(scrollY), lineFieldConfig)
  if (metrics === null) throw new Error('Expected valid test geometry')
  const buildProgress = smoothstep01(
    (scrollY - metrics.seedScrollY) / (metrics.buildEndScrollY - metrics.seedScrollY),
  )
  const maximumOffset = Math.max(...canonicalOffsets())
  const originDocumentY = scrollY + 450
  const targetCommonFrontDocumentY = metrics.handoffDocumentY - maximumOffset * 900

  return {
    commonFrontDocumentY: originDocumentY
      + (targetCommonFrontDocumentY - originDocumentY) * buildProgress,
    unwrappedPhase: TAU * lineFieldConfig.wave.scrollPhaseCycles * buildProgress,
  }
}

describe('line-field document geometry and motto orbit', () => {
  it('keeps reveal start live with an independent one-hundredth false seed', () => {
    const baselineConfig: LineFieldAnimationConfig = structuredClone(lineFieldConfig)
    const adjacentConfig: LineFieldAnimationConfig = {
      ...baselineConfig,
      reveal: { ...baselineConfig.reveal, startFilmProgress: 0.81 },
    }
    const fixedGeometry = geometryAt(2000)
    const baselineMetrics = deriveLineFieldScrollMetrics(fixedGeometry, baselineConfig)
    const adjacentMetrics = deriveLineFieldScrollMetrics(fixedGeometry, adjacentConfig)
    if (baselineMetrics === null || adjacentMetrics === null) {
      throw new Error('Expected valid test geometry')
    }
    const baseline = stepLineFieldMotion(
      createLineFieldMotionState(baselineConfig),
      motionInput(fixedGeometry, 0, { clockMode: 'rebase' }),
      baselineConfig,
    )
    const adjacent = stepLineFieldMotion(
      createLineFieldMotionState(adjacentConfig),
      motionInput(fixedGeometry, 0, { clockMode: 'rebase' }),
      adjacentConfig,
    )

    expect(baselineMetrics.filmScrollRange).toBe(1620)
    expect(baselineMetrics.seedScrollY).toBe(1296)
    expect(adjacentMetrics.seedScrollY).toBeCloseTo(1312.2, 12)
    expect(adjacentMetrics.seedScrollY - 1296).toBeCloseTo(16.2, 12)
    expect(baseline.state.mode).toBe('scroll-build')
    expect(adjacent.state.mode).toBe('scroll-build')
    expect(spatialValues(adjacent)).not.toEqual(spatialValues(baseline))
  })

  it('keeps handoff trigger live with an independent one-hundredth false seed', () => {
    const baselineConfig: LineFieldAnimationConfig = structuredClone(lineFieldConfig)
    const adjacentConfig: LineFieldAnimationConfig = {
      ...baselineConfig,
      handoff: { ...baselineConfig.handoff, triggerPastMottoVh: 8.01 },
    }
    const fixedGeometry = geometryAt(0)
    const baselineMetrics = deriveLineFieldScrollMetrics(fixedGeometry, baselineConfig)
    const adjacentMetrics = deriveLineFieldScrollMetrics(fixedGeometry, adjacentConfig)
    if (baselineMetrics === null || adjacentMetrics === null) {
      throw new Error('Expected valid test geometry')
    }
    const baselineAtOldBoundary = stepLineFieldMotion(
      createLineFieldMotionState(baselineConfig),
      motionInput(geometryAt(2592), 0, { clockMode: 'rebase' }),
      baselineConfig,
    )
    const adjacentAtOldBoundary = stepLineFieldMotion(
      createLineFieldMotionState(adjacentConfig),
      motionInput(geometryAt(2592), 0, { clockMode: 'rebase' }),
      adjacentConfig,
    )

    expect(baselineMetrics.handoffDocumentY).toBe(3172)
    expect(adjacentMetrics.handoffDocumentY).toBeCloseTo(3172.09, 12)
    expect(adjacentMetrics.handoffDocumentY - 3172).toBeCloseTo(0.09, 12)
    expect(baselineMetrics.buildEndScrollY).toBe(2592)
    expect(adjacentMetrics.buildEndScrollY).toBeCloseTo(2592.09, 12)
    expect(adjacentMetrics.buildEndScrollY - 2592).toBeCloseTo(0.09, 12)
    expect(baselineAtOldBoundary.state.mode).toBe('auto-handoff')
    expect(adjacentAtOldBoundary.state.mode).toBe('scroll-build')
  })

  it('derives the locked document-space scroll coordinates and endpoint progress', () => {
    const atOrbitStart = deriveLineFieldScrollMetrics(geometryAt(1620), lineFieldConfig)
    const atOrbitEnd = deriveLineFieldScrollMetrics(geometryAt(2520), lineFieldConfig)

    expect(atOrbitStart?.scrollY).toBe(1620)
    expect(atOrbitStart?.filmScrollRange).toBe(1620)
    expect(atOrbitStart?.filmProgress).toBe(1)
    expect(atOrbitStart?.preloadScrollY).toBeCloseTo(1166.4, 12)
    expect(atOrbitStart?.seedScrollY).toBeCloseTo(
      1620 * lineFieldConfig.reveal.startFilmProgress,
      12,
    )
    expect(atOrbitStart?.orbitStartScrollY).toBe(1620)
    expect(atOrbitStart?.orbitEndScrollY).toBe(2520)
    expect(atOrbitStart?.buildEndScrollY).toBe(2592)
    expect(atOrbitStart?.originDocumentY).toBe(2070)
    expect(atOrbitStart?.handoffDocumentY).toBe(HANDOFF_DOCUMENT_Y)
    expect(atOrbitStart?.mottoProgress).toBe(0)
    expect(atOrbitEnd?.mottoProgress).toBe(1)
  })

  it('adds the configured header gap exactly once and reveals the spine preload to seed', () => {
    const config: LineFieldAnimationConfig = {
      ...lineFieldConfig,
      geometry: { ...lineFieldConfig.geometry, headerGapPx: 8 },
    }
    const headerTargetViewportY = resolveHeaderTargetViewportY(72, config.geometry.headerGapPx)
    const metrics = deriveLineFieldScrollMetrics(geometryAt(0), config)
    if (metrics === null) throw new Error('Expected valid test geometry')
    const preloaded = stepLineFieldMotion(
      createLineFieldMotionState(config),
      motionInput(geometryAt(metrics.preloadScrollY, { headerTargetViewportY }), 0, { clockMode: 'rebase' }),
      config,
    )
    const seeded = stepLineFieldMotion(
      createLineFieldMotionState(config),
      motionInput(geometryAt(metrics.seedScrollY, { headerTargetViewportY }), 0, { clockMode: 'rebase' }),
      config,
    )

    expect(headerTargetViewportY).toBe(80)
    expect(preloaded.frame.headerTargetViewportY).toBe(80)
    expect(seeded.frame.headerTargetViewportY).toBe(80)
    expect(preloaded.frame.filmProgress).toBeCloseTo(config.reveal.preloadFilmProgress, 12)
    expect(seeded.frame.filmProgress).toBeCloseTo(config.reveal.startFilmProgress, 12)
    expect(preloaded.frame.upwardSpineReveal).toBeCloseTo(0, 12)
    expect(seeded.frame.upwardSpineReveal).toBeCloseTo(1, 12)
  })

  it('returns null for malformed measurements and ordered-card violations', () => {
    expect(deriveLineFieldScrollMetrics(geometryAt(0, { viewportHeight: 0 }), lineFieldConfig)).toBeNull()
    expect(deriveLineFieldScrollMetrics(geometryAt(0, { filmHeight: Number.NaN }), lineFieldConfig)).toBeNull()
    expect(deriveLineFieldScrollMetrics(geometryAt(0, {
      mottoCardFinalTop: 3200,
      mottoCardFinalBottom: 3100,
    }), lineFieldConfig)).toBeNull()
  })

  it('lands the orbit on literal neutral values and remains stateless on reverse evaluation', () => {
    const startGeometry = geometryAt(1620)
    const endGeometry = geometryAt(2520)
    const start = evaluateMottoOrbit(0, startGeometry, lineFieldConfig.motto)
    const end = evaluateMottoOrbit(1, endGeometry, lineFieldConfig.motto)
    const forward = evaluateMottoOrbit(0.42, startGeometry, lineFieldConfig.motto)
    evaluateMottoOrbit(0.8, startGeometry, lineFieldConfig.motto)
    const reverse = evaluateMottoOrbit(0.42, startGeometry, lineFieldConfig.motto)
    const startCenterX = startGeometry.mottoCardFinalCenterX + start.translateXPx
    const startCenterY = (
      startGeometry.mottoCardFinalTop + startGeometry.mottoCardFinalBottom
    ) / 2 + start.translateYPx

    expect(startCenterX).toBeCloseTo(0.7 * startGeometry.viewportWidth, 8)
    expect(startCenterY).toBeCloseTo(startGeometry.mottoTop, 8)
    expect(start).toMatchObject({ scale: 0.22, blurPx: 8, opacity: 0 })
    expect(end).toEqual({
      translateXPx: 0,
      translateYPx: 0,
      scale: 1,
      blurPx: 0,
      opacity: 1,
      projectionStatus: expect.any(String),
    })
    expect(reverse).toEqual(forward)
  })

  it('keeps the exact 36 staggered tips identical at 1440x900 and 390x844', () => {
    const vectors = [
      { viewportWidth: 1440, viewportHeight: 900, anchorViewport: [720, 450] as const },
      { viewportWidth: 390, viewportHeight: 844, anchorViewport: [195, 422] as const },
    ].map((viewport) => stepLineFieldMotion(
      createLineFieldMotionState(lineFieldConfig),
      motionInput(geometryAt(BUILD_END_SCROLL_Y, viewport), 0, { clockMode: 'rebase' }),
      lineFieldConfig,
    ).frame.tipOffsetsViewportFractions)

    for (const offsets of vectors) {
      expect(offsets).toHaveLength(36)
      expect(sha256Json(offsets)).toBe(
        'cf9bc0032a4c717dc6fade7c4ca53ed434d444607552ca6dd161d884f0db7ee9',
      )
      expect(offsets[0]).toBe(0)
      expect(offsets[35]).toBe(0.0019079204625450073)
    }
    expect(vectors[1]).toEqual(vectors[0])
  })

  it('negative controls change the stagger digest for seed 3818 and the count contract for 35 tips', () => {
    const seedControl: LineFieldAnimationConfig = {
      ...structuredClone(lineFieldConfig),
      fronts: { ...lineFieldConfig.fronts, seed: 3818 },
    }
    const countControl: LineFieldAnimationConfig = {
      ...structuredClone(lineFieldConfig),
      geometry: { ...lineFieldConfig.geometry, staggeredTipCount: 35 },
    }
    const baseline = createLineFieldMotionState(lineFieldConfig).canonicalOffsets
    const seedOffsets = createLineFieldMotionState(seedControl).canonicalOffsets
    const countOffsets = createLineFieldMotionState(countControl).canonicalOffsets

    expect(sha256Json(seedOffsets)).not.toBe(sha256Json(baseline))
    expect(countOffsets).toHaveLength(35)
    expect(sha256Json(countOffsets)).not.toBe(sha256Json(baseline))
    expect(countOffsets[35]).toBeUndefined()
  })
})

describe('line-field scroll build, pointer scheduler, and handoff', () => {
  it('changes only scroll phase when scrollPhaseCycles moves by one hundredth', () => {
    const baselineConfig: LineFieldAnimationConfig = structuredClone(lineFieldConfig)
    const adjacentConfig: LineFieldAnimationConfig = {
      ...baselineConfig,
      wave: { ...baselineConfig.wave, scrollPhaseCycles: 2.41 },
    }
    const scrollY = 2000
    const baseline = stepLineFieldMotion(
      createLineFieldMotionState(baselineConfig),
      motionInput(geometryAt(scrollY), 10, { clockMode: 'rebase' }),
      baselineConfig,
    )
    const adjacent = stepLineFieldMotion(
      createLineFieldMotionState(adjacentConfig),
      motionInput(geometryAt(scrollY), 10, { clockMode: 'rebase' }),
      adjacentConfig,
    )
    const rawBuildProgress = (scrollY - 1296) / (2592 - 1296)
    const buildProgress = rawBuildProgress * rawBuildProgress * (3 - 2 * rawBuildProgress)
    const { unwrappedPhase: baselinePhase, ...baselineSpatialFacts } = spatialValues(baseline)
    const { unwrappedPhase: adjacentPhase, ...adjacentSpatialFacts } = spatialValues(adjacent)

    expect(adjacentPhase - baselinePhase).toBeCloseTo(TAU * 0.01 * buildProgress, 12)
    expect(adjacentSpatialFacts).toEqual(baselineSpatialFacts)
  })

  it('keeps scroll-build spatial values deterministic across wall times', () => {
    const initial = stepAt(
      createLineFieldMotionState(lineFieldConfig),
      2000,
      10,
      { clockMode: 'rebase' },
    )
    const later = stepAt(initial.state, 2000, 10_000)

    expect(initial.state.mode).toBe('scroll-build')
    expect(spatialValues(later)).toEqual(spatialValues(initial))
  })

  it('uses the visible leading tip for the exact desktop and mobile handoff threshold', () => {
    for (const viewportWidth of [1440, 390]) {
      const result = stepAt(
        createLineFieldMotionState(lineFieldConfig),
        BUILD_END_SCROLL_Y,
        0,
        { clockMode: 'rebase' },
        { viewportWidth },
      )
      const leadingTipDocumentY = result.frame.commonFrontDocumentY
        + Math.max(...result.frame.tipOffsetsViewportFractions) * 900

      expect(result.state.mode).toBe('auto-handoff')
      expect(leadingTipDocumentY).toBeCloseTo(HANDOFF_DOCUMENT_Y, 12)
      expect(result.frame.commonFrontDocumentY).not.toBe(HANDOFF_DOCUMENT_Y)
    }
  })

  it('keeps the card-derived handoff fixed when the motto panel top moves', () => {
    const shiftedGeometry = geometryAt(0, { mottoTop: 2600 })
    const shiftedMetrics = deriveLineFieldScrollMetrics(shiftedGeometry, lineFieldConfig)
    expect(shiftedMetrics?.buildEndScrollY).toBe(2672)
    expect(shiftedMetrics?.handoffDocumentY).toBe(HANDOFF_DOCUMENT_Y)

    const result = stepAt(
      createLineFieldMotionState(lineFieldConfig),
      2672,
      0,
      { clockMode: 'rebase' },
      { mottoTop: 2600 },
    )
    const leadingTipDocumentY = result.frame.commonFrontDocumentY
      + Math.max(...result.frame.tipOffsetsViewportFractions) * 900

    expect(leadingTipDocumentY).toBeCloseTo(HANDOFF_DOCUMENT_Y, 12)
  })

  it('captures the exact rendered build snapshot at the inclusive handoff', () => {
    const metrics = deriveLineFieldScrollMetrics(geometryAt(0), lineFieldConfig)
    if (metrics === null) throw new Error('Expected valid test geometry')
    const seeded = stepAt(
      createLineFieldMotionState(lineFieldConfig),
      metrics.seedScrollY,
      0,
      { clockMode: 'rebase' },
    )
    const result = stepAt(seeded.state, BUILD_END_SCROLL_Y, 1000)
    const expectedSeed = expectedScrollBuild(metrics.seedScrollY)
    const expectedEnd = expectedScrollBuild(BUILD_END_SCROLL_Y)
    const expectedFrontVelocity = expectedEnd.commonFrontDocumentY
      - expectedSeed.commonFrontDocumentY
    const expectedPhaseVelocity = expectedEnd.unwrappedPhase - expectedSeed.unwrappedPhase
    const expected: LineFieldMotionSnapshot = {
      sourceOriginViewportFraction: 0.5,
      commonFrontDocumentY: expectedEnd.commonFrontDocumentY,
      unwrappedPhase: TAU * 2.4,
      tipOffsetsViewportFractions: canonicalOffsets(),
      upwardSpineReveal: 1,
      opacity: 1,
      pointerProximity: 0,
      pointerTwistNormalized: 0,
      frontVelocityPxPerSecond: expectedFrontVelocity,
      phaseVelocityRadiansPerSecond: expectedPhaseVelocity,
    }

    expect(result.state.mode).toBe('auto-handoff')
    expect(result.frame.mode).toBe('auto-handoff')
    expect(getLineFieldMotionSnapshot(result)).toEqual(expected)
  })

  it('uses independent cubic blends while tip offsets converge without changing lane order', () => {
    const handoff = firstHandoff()
    const halfway = advanceBy(handoff, geometryAt(BUILD_END_SCROLL_Y), 1000, 225)
    const captured = getLineFieldMotionSnapshot(handoff)
    const snapshot = getLineFieldMotionSnapshot(halfway)
    const targetFrontVelocity = 0.72 * 900
    const targetPhaseVelocity = TAU * 0.65
    const integralAtHalf = 0.5 ** 3 - 0.5 ** 4 / 2
    const expectedFront = captured.commonFrontDocumentY
      + captured.frontVelocityPxPerSecond * 0.225
      + (targetFrontVelocity - captured.frontVelocityPxPerSecond) * 0.45 * integralAtHalf
    const expectedPhase = captured.unwrappedPhase
      + captured.phaseVelocityRadiansPerSecond * 0.225
      + (targetPhaseVelocity - captured.phaseVelocityRadiansPerSecond) * 0.45 * integralAtHalf
    const expectedCatchupMultiplier = Math.exp(-7 * 0.225)

    expect(halfway.state.mode).toBe('auto-handoff')
    expect(snapshot.frontVelocityPxPerSecond).toBeGreaterThan(Math.min(
      captured.frontVelocityPxPerSecond,
      targetFrontVelocity,
    ))
    expect(snapshot.frontVelocityPxPerSecond).toBeLessThan(Math.max(
      captured.frontVelocityPxPerSecond,
      targetFrontVelocity,
    ))
    expect(snapshot.phaseVelocityRadiansPerSecond).toBeGreaterThan(Math.min(
      captured.phaseVelocityRadiansPerSecond,
      targetPhaseVelocity,
    ))
    expect(snapshot.phaseVelocityRadiansPerSecond).toBeLessThan(Math.max(
      captured.phaseVelocityRadiansPerSecond,
      targetPhaseVelocity,
    ))
    expect(snapshot.commonFrontDocumentY).toBeCloseTo(expectedFront, 12)
    expect(snapshot.unwrappedPhase).toBeCloseTo(expectedPhase, 12)
    snapshot.tipOffsetsViewportFractions.forEach((offset, laneId) => {
      expect(offset).toBeCloseTo(
        captured.tipOffsetsViewportFractions[laneId] * expectedCatchupMultiplier,
        15,
      )
    })
    expect(snapshot.upwardSpineReveal).toBe(captured.upwardSpineReveal)
    expect(snapshot.opacity).toBe(captured.opacity)
  })

  it('converges captured staggered offsets toward the common front at the configured catch-up rate', () => {
    const atRate = (catchupRatePerSecond: number) => {
      const config: LineFieldAnimationConfig = {
        ...lineFieldConfig,
        fronts: { ...lineFieldConfig.fronts, catchupRatePerSecond },
      }
      const handoff = firstHandoffWithConfig(config)
      const advanced = stepLineFieldMotion(
        handoff.state,
        motionInput(geometryAt(BUILD_END_SCROLL_Y), 1050),
        config,
      )

      return { advanced, handoff }
    }
    const slowRate = 1
    const fastRate = 14
    const slow = atRate(slowRate)
    const fast = atRate(fastRate)

    expect(fast.handoff.frame.tipOffsetsViewportFractions).toEqual(
      slow.handoff.frame.tipOffsetsViewportFractions,
    )
    expect(slow.advanced.state.mode).toBe('auto-handoff')
    expect(fast.advanced.state.mode).toBe('auto-handoff')
    for (const laneId of [1, 2]) {
      const capturedOffset = slow.handoff.frame.tipOffsetsViewportFractions[laneId]
      const slowOffset = slow.advanced.frame.tipOffsetsViewportFractions[laneId]
      const fastOffset = fast.advanced.frame.tipOffsetsViewportFractions[laneId]

      expect(capturedOffset).not.toBe(0)
      expect(slowOffset).toBeCloseTo(capturedOffset * Math.exp(-slowRate * 0.05), 15)
      expect(fastOffset).toBeCloseTo(capturedOffset * Math.exp(-fastRate * 0.05), 15)
      expect(Math.sign(slowOffset)).toBe(Math.sign(capturedOffset))
      expect(Math.sign(fastOffset)).toBe(Math.sign(capturedOffset))
      expect(Math.abs(fastOffset)).toBeLessThan(Math.abs(slowOffset))
    }
    expect(slow.advanced.frame.tipOffsetsViewportFractions[0]).toBe(0)
    expect(fast.advanced.frame.tipOffsetsViewportFractions[0]).toBe(0)
  })

  it('snaps visually settled tip offsets to one reusable zero vector', () => {
    const handoff = firstHandoff()
    const settled = advanceBy(handoff, geometryAt(BUILD_END_SCROLL_Y), 1000, 2000)

    expect(settled.state.mode).toBe('autonomous')
    expect(settled.frame.tipOffsetsViewportFractions.every(offset => offset === 0)).toBe(true)
    expect(settled.frame.tipOffsetsViewportFractions).toBe(settled.state.zeroOffsets)
  })

  it('preserves the handoff remainder across coarse and subdivided steps', () => {
    const beforeBoundary = advanceBy(
      firstHandoff(),
      geometryAt(BUILD_END_SCROLL_Y),
      1000,
      425,
    )
    const coarse = stepAt(beforeBoundary.state, BUILD_END_SCROLL_Y, 1475)
    const atBoundary = stepAt(beforeBoundary.state, BUILD_END_SCROLL_Y, 1450)
    const subdivided = stepAt(atBoundary.state, BUILD_END_SCROLL_Y, 1475)

    expect(coarse.state.mode).toBe('autonomous')
    expect(subdivided.state.mode).toBe('autonomous')
    expect(getLineFieldMotionSnapshot(coarse)).toEqual(getLineFieldMotionSnapshot(subdivided))
  })

  it('settles finite pointer targets to completion and stops scheduling idle scroll-build frames', () => {
    const geometry = geometryAt(1800)
    let result = stepLineFieldMotion(
      createLineFieldMotionState(lineFieldConfig),
      motionInput(geometry, 0, {
        clockMode: 'rebase',
        pointerTarget: { proximity: 1, twistNormalized: -1 },
      }),
      lineFieldConfig,
    )

    expect(result.requestFrame).toBe(true)

    let nowMs = 0
    for (let frame = 0; frame < 100 && result.requestFrame; frame += 1) {
      nowMs += 50
      result = stepLineFieldMotion(
        result.state,
        motionInput(geometry, nowMs, {
          pointerTarget: { proximity: 1, twistNormalized: -1 },
        }),
        lineFieldConfig,
      )
    }

    expect(result.frame.pointerProximity).toBe(1)
    expect(result.state.pointerTwistNormalized).toBe(-1)
    expect(result.requestFrame).toBe(false)

    const idle = stepAt(
      createLineFieldMotionState(lineFieldConfig),
      1800,
      0,
      { clockMode: 'rebase' },
    )
    expect(idle.requestFrame).toBe(false)
  })

  it('keeps pointer smoothing live with independent 0.16 and 0.32 false seeds at one 50ms step', () => {
    const geometry = geometryAt(1800)
    const stepWithSmoothing = (smoothingSeconds: number) => {
      const config: LineFieldAnimationConfig = {
        ...structuredClone(lineFieldConfig),
        pointer: { ...lineFieldConfig.pointer, smoothingSeconds },
      }
      const initial = stepLineFieldMotion(
        createLineFieldMotionState(config),
        motionInput(geometry, 0, { clockMode: 'rebase' }),
        config,
      )
      return stepLineFieldMotion(
        initial.state,
        motionInput(geometry, 50, {
          pointerTarget: { proximity: 1, twistNormalized: 1 },
        }),
        config,
      )
    }

    const fast = stepWithSmoothing(0.16)
    const slow = stepWithSmoothing(0.32)

    expect(fast.state.pointerTwistNormalized).toBe(0.2683843710533582)
    expect(slow.state.pointerTwistNormalized).toBe(0.14465467269257748)
    expect(fast.state.pointerTwistNormalized).not.toBe(slow.state.pointerTwistNormalized)
  })

  it('rebases the clock without advancing pointer or autonomous spatial time', () => {
    const handoff = firstHandoff()
    const rebasedHandoff = stepLineFieldMotion(
      handoff.state,
      motionInput(geometryAt(BUILD_END_SCROLL_Y), 20_000, {
        clockMode: 'rebase',
        pointerTarget: { proximity: 1, twistNormalized: 1 },
      }),
      lineFieldConfig,
    )

    expect(getLineFieldMotionSnapshot(rebasedHandoff)).toEqual(getLineFieldMotionSnapshot(handoff))
  })

  it('keeps sub-epsilon pointer errors frozen while rebasing', () => {
    const geometry = geometryAt(2000)
    const initial = stepLineFieldMotion(
      createLineFieldMotionState(lineFieldConfig),
      motionInput(geometry, 0, { clockMode: 'rebase' }),
      lineFieldConfig,
    )
    const rebased = stepLineFieldMotion(
      initial.state,
      motionInput(geometry, 1000, {
        clockMode: 'rebase',
        pointerTarget: { proximity: 0.0005, twistNormalized: 0.0005 },
      }),
      lineFieldConfig,
    )

    expect(rebased.frame.pointerProximity).toBe(0)
    expect(rebased.state.pointerTwistNormalized).toBe(0)
    expect(spatialValues(rebased)).toEqual(spatialValues(initial))
  })

  it('allows pointer-only settling without moving scroll-owned spatial values', () => {
    const geometry = geometryAt(2000)
    const initial = stepLineFieldMotion(
      createLineFieldMotionState(lineFieldConfig),
      motionInput(geometry, 0, {
        clockMode: 'rebase',
        pointerTarget: { proximity: 1, twistNormalized: 1 },
      }),
      lineFieldConfig,
    )
    const settledOnce = stepLineFieldMotion(
      initial.state,
      motionInput(geometry, 50, {
        pointerTarget: { proximity: 1, twistNormalized: 1 },
      }),
      lineFieldConfig,
    )

    expect(spatialValues(settledOnce)).toEqual(spatialValues(initial))
    expect(settledOnce.frame.pointerProximity).toBeGreaterThan(initial.frame.pointerProximity)
    expect(settledOnce.state.pointerTwistNormalized).toBeGreaterThan(
      initial.state.pointerTwistNormalized,
    )
  })

  it('uses uncapped sample time for derivatives and capped time for pointer integration', () => {
    const initialScrollY = 2000
    const nextScrollY = 2010
    const initial = stepAt(
      createLineFieldMotionState(lineFieldConfig),
      initialScrollY,
      0,
      { clockMode: 'rebase' },
    )
    const next = stepAt(
      initial.state,
      nextScrollY,
      1000,
      { pointerTarget: { proximity: 1, twistNormalized: 1 } },
    )
    const expectedInitial = expectedScrollBuild(initialScrollY)
    const expectedNext = expectedScrollBuild(nextScrollY)
    const expectedPointerAfterFiftyMilliseconds = 1 - Math.exp(-0.05 / 0.16)

    expect(next.frontVelocityPxPerSecond).toBeCloseTo(
      expectedNext.commonFrontDocumentY - expectedInitial.commonFrontDocumentY,
      12,
    )
    expect(next.phaseVelocityRadiansPerSecond).toBeCloseTo(
      expectedNext.unwrappedPhase - expectedInitial.unwrappedPhase,
      12,
    )
    expect(next.frame.pointerProximity).toBeCloseTo(expectedPointerAfterFiftyMilliseconds, 12)
    expect(next.frame.pointerProximity).toBeLessThan(0.3)
  })
})

describe('line-field autonomous, reverse, re-entry, and invalid input states', () => {
  it('advances a delayed autonomous sample by the full elapsed time', () => {
    const blendEnd = atBlendEnd()
    const delayed = stepAt(blendEnd.state, BUILD_END_SCROLL_Y, 2450)
    const subdivided = advanceBy(
      blendEnd,
      geometryAt(BUILD_END_SCROLL_Y),
      1450,
      1000,
    )

    expect(blendEnd.state.previousSampleNowMs).toBe(1450)
    expect(delayed.state.mode).toBe('autonomous')
    expect(getLineFieldMotionSnapshot(delayed)).toEqual(
      getLineFieldMotionSnapshot(subdivided),
    )
  })

  it('locks the normalized source window at handoff while the live anchor leaves and resizes', () => {
    const metrics = deriveLineFieldScrollMetrics(geometryAt(0), lineFieldConfig)
    if (metrics === null) throw new Error('Expected valid test geometry')
    const seeded = stepAt(
      createLineFieldMotionState(lineFieldConfig),
      metrics.seedScrollY,
      0,
      { clockMode: 'rebase' },
      { anchorViewport: [720, 360] },
    )
    const handoff = stepAt(
      seeded.state,
      BUILD_END_SCROLL_Y,
      1000,
      {},
      { anchorViewport: [720, -180] },
    )
    const departed = stepAt(
      handoff.state,
      BUILD_END_SCROLL_Y,
      5000,
      { clockMode: 'rebase' },
      {
        viewportWidth: 390,
        viewportHeight: 844,
        anchorViewport: [195, -1600],
      },
    )

    expect(handoff.frame.sourceOriginViewportFraction).toBeCloseTo(-0.2, 12)
    expect(departed.frame.sourceOriginViewportFraction).toBeCloseTo(-0.2, 12)
    expect(departed.frame.anchorViewport).toEqual([195, -1600])
  })

  it('advances autonomous front and phase with the exact acceleration equation', () => {
    const blendEnd = atBlendEnd()
    const start = getLineFieldMotionSnapshot(blendEnd)
    const advanced = stepAt(blendEnd.state, BUILD_END_SCROLL_Y, 1500)
    const targetFrontVelocity = 0.72 * 900
    const acceleration = 1.2 * 900
    const targetPhaseVelocity = TAU * 0.65

    expect(blendEnd.state.mode).toBe('autonomous')
    expect(advanced.state.mode).toBe('autonomous')
    expect(advanced.frame.commonFrontDocumentY).toBeCloseTo(
      start.commonFrontDocumentY + targetFrontVelocity * 0.05 + 0.5 * acceleration * 0.05 ** 2,
      12,
    )
    expect(advanced.frontVelocityPxPerSecond).toBeCloseTo(
      targetFrontVelocity + acceleration * 0.05,
      12,
    )
    expect(advanced.frame.unwrappedPhase).toBeCloseTo(
      start.unwrappedPhase + targetPhaseVelocity * 0.05,
      12,
    )
    expect(advanced.requestFrame).toBe(true)
  })

  it('keeps autonomous motion alive while upward scroll remains beyond the frozen handoff', () => {
    const deep = stepAt(
      atBlendEnd().state,
      BUILD_END_SCROLL_Y + 900,
      1500,
    )
    const upward = stepAt(
      deep.state,
      BUILD_END_SCROLL_Y + 300,
      1550,
    )
    const held = stepAt(
      upward.state,
      BUILD_END_SCROLL_Y + 300,
      1600,
    )

    expect(deep.state.mode).toBe('autonomous')
    expect(upward.state.mode).toBe('autonomous')
    expect(upward.frame.commonFrontDocumentY).toBeGreaterThan(deep.frame.commonFrontDocumentY)
    expect(upward.frame.unwrappedPhase).toBeGreaterThan(deep.frame.unwrappedPhase)
    expect(upward.requestFrame).toBe(true)
    expect(held.state.mode).toBe('autonomous')
    expect(held.frame.commonFrontDocumentY).toBeGreaterThan(upward.frame.commonFrontDocumentY)
    expect(held.frame.unwrappedPhase).toBeGreaterThan(upward.frame.unwrappedPhase)
    expect(held.requestFrame).toBe(true)
  })

  it('freezes the canonical handoff boundary even when one scroll sample overshoots it', () => {
    const metrics = deriveLineFieldScrollMetrics(geometryAt(0), lineFieldConfig)
    if (metrics === null) throw new Error('Expected valid test geometry')
    const seeded = stepAt(
      createLineFieldMotionState(lineFieldConfig),
      metrics.seedScrollY,
      0,
      { clockMode: 'rebase' },
    )
    const overshootScrollY = BUILD_END_SCROLL_Y + 600
    const overshotHandoff = stepAt(seeded.state, overshootScrollY, 1000)
    const autonomous = advanceBy(
      overshotHandoff,
      geometryAt(overshootScrollY),
      1000,
      1000,
    )
    const upwardAboveBoundary = stepAt(
      autonomous.state,
      BUILD_END_SCROLL_Y + 100,
      2050,
    )
    const crossedBoundary = stepAt(
      upwardAboveBoundary.state,
      BUILD_END_SCROLL_Y - lineFieldConfig.handoff.reverseDeadbandPx - 1,
      2100,
    )

    expect(overshotHandoff.state.mode).toBe('auto-handoff')
    expect(autonomous.state.mode).toBe('autonomous')
    expect(upwardAboveBoundary.state.mode).toBe('autonomous')
    expect(crossedBoundary.state.mode).toBe('reverse-gather')
  })

  it('detects reverse before advancing time and uses current geometry fields', () => {
    const autonomous = stepAt(
      atBlendEnd().state,
      BUILD_END_SCROLL_Y,
      1500,
      { clockMode: 'rebase' },
      { mottoTop: 3000 },
    )
    const beforeReverse = getLineFieldMotionSnapshot(autonomous)
    const reverse = stepAt(
      autonomous.state,
      BUILD_END_SCROLL_Y - 3,
      1550,
      {},
      { mottoTop: 3000 },
    )

    expect(reverse.state.mode).toBe('reverse-gather')
    expect(getLineFieldMotionSnapshot(reverse)).toEqual(beforeReverse)
    expect(reverse.frame.originDocumentY).toBe(BUILD_END_SCROLL_Y - 3 + 450)
    expect(reverse.frame.originDocumentY).not.toBe(autonomous.frame.originDocumentY)
    expect(reverse.frame.mottoProgress).toBeLessThan(autonomous.frame.mottoProgress)
  })

  it('gathers on time at fixed scroll and reconnects to canonical reverse scroll-build', () => {
    const deep = stepAt(
      atBlendEnd().state,
      BUILD_END_SCROLL_Y + 600,
      1500,
    )
    const reverseScrollY = BUILD_END_SCROLL_Y
      - lineFieldConfig.handoff.reverseDeadbandPx
      - 1
    const reverse = stepAt(deep.state, reverseScrollY, 1550)
    const halfway = advanceBy(
      reverse,
      geometryAt(reverseScrollY),
      1550,
      lineFieldConfig.handoff.velocityBlendSeconds * 500,
    )
    const gathered = advanceBy(
      reverse,
      geometryAt(reverseScrollY),
      1550,
      lineFieldConfig.handoff.velocityBlendSeconds * 1000,
    )
    const canonical = stepAt(
      {
        ...createLineFieldMotionState(lineFieldConfig),
        scrollPhaseOffsetRadians: gathered.state.scrollPhaseOffsetRadians,
      },
      reverseScrollY,
      0,
      { clockMode: 'rebase' },
    )
    const held = stepAt(gathered.state, reverseScrollY, 5000)

    expect(reverse.state.mode).toBe('reverse-gather')
    expect(spatialValues(reverse)).toEqual(spatialValues(deep))
    expect(reverse.requestFrame).toBe(true)
    expect(halfway.state.mode).toBe('reverse-gather')
    expect(spatialValues(halfway)).not.toEqual(spatialValues(reverse))
    expect(spatialValues(gathered)).not.toEqual(spatialValues(halfway))
    expect(gathered.frame.unwrappedPhase).toBeGreaterThan(halfway.frame.unwrappedPhase)
    expect(halfway.requestFrame).toBe(true)
    expect(gathered.state.mode).toBe('scroll-build')
    expect(getLineFieldMotionSnapshot(gathered)).toEqual(
      getLineFieldMotionSnapshot(canonical),
    )
    expect(gathered.requestFrame).toBe(false)
    expect(held.state.mode).toBe('scroll-build')
    expect(spatialValues(held)).toEqual(spatialValues(gathered))
    expect(held.requestFrame).toBe(false)
  })

  it('rebases long autonomous source time without a fast rewind or terminal clock snap', () => {
    const longAutonomous = advanceBy(
      atBlendEnd(),
      geometryAt(BUILD_END_SCROLL_Y),
      1450,
      120_000,
    )
    const reverseScrollY = BUILD_END_SCROLL_Y
      - lineFieldConfig.handoff.reverseDeadbandPx
      - 1
    const reverse = stepAt(longAutonomous.state, reverseScrollY, 121_500)
    let current = reverse
    let nowMs = 121_500
    let maximumPhaseStep = 0

    while (current.state.mode === 'reverse-gather') {
      const previousPhase = current.frame.unwrappedPhase
      nowMs += 50
      current = stepAt(current.state, reverseScrollY, nowMs)
      maximumPhaseStep = Math.max(
        maximumPhaseStep,
        Math.abs(current.frame.unwrappedPhase - previousPhase),
      )
    }

    expect(reverse.state.mode).toBe('reverse-gather')
    expect(current.state.mode).toBe('scroll-build')
    expect(maximumPhaseStep).toBeLessThanOrEqual(TAU * 0.1)
    expect(current.frame.unwrappedPhase).toBeCloseTo(
      reverse.frame.unwrappedPhase
        + reverse.phaseVelocityRadiansPerSecond
          * lineFieldConfig.handoff.velocityBlendSeconds
          / 2,
      12,
    )

    const reverseScrollBuild = stepAt(current.state, reverseScrollY - 50, nowMs + 50)
    expect(reverseScrollBuild.state.mode).toBe('scroll-build')
    expect(reverseScrollBuild.frame.unwrappedPhase).toBeLessThan(current.frame.unwrappedPhase)
  })

  it('restarts one analytic handoff from the current gather when scroll crosses the frozen boundary', () => {
    const deep = stepAt(atBlendEnd().state, BUILD_END_SCROLL_Y + 600, 1500)
    const reverse = stepAt(deep.state, BUILD_END_SCROLL_Y - 3, 1550)
    const halfway = advanceBy(
      reverse,
      geometryAt(BUILD_END_SCROLL_Y - 3),
      1550,
      lineFieldConfig.handoff.velocityBlendSeconds * 500,
    )
    const capture = getLineFieldMotionSnapshot(halfway)
    const reentered = stepAt(halfway.state, BUILD_END_SCROLL_Y, 1800)

    expect(halfway.state.mode).toBe('reverse-gather')
    expect(reentered.state.mode).toBe('auto-handoff')
    expect(reentered.state.epoch).toBe(halfway.state.epoch + 1)
    expect(getLineFieldMotionSnapshot(reentered)).toEqual(capture)
    expect(reentered.state.handoffCapture).toEqual(capture)
    expect(reentered.requestFrame).toBe(true)

    const next = stepAt(reentered.state, BUILD_END_SCROLL_Y, 1850)
    expect(next.state.epoch).toBe(reentered.state.epoch)
    expect(next.frame.commonFrontDocumentY).not.toBe(reentered.frame.commonFrontDocumentY)
  })

  it('preserves the exact normalized pointer twist through reverse re-entry without degree conversion', () => {
    const target = { proximity: 0.6, twistNormalized: 0.75 } as const
    const autonomous = advanceBy(
      stepAt(atBlendEnd().state, BUILD_END_SCROLL_Y + 600, 1500),
      geometryAt(BUILD_END_SCROLL_Y + 600),
      1500,
      2000,
      { pointerTarget: target },
    )
    const reverse = stepLineFieldMotion(
      autonomous.state,
      motionInput(geometryAt(BUILD_END_SCROLL_Y - 3), 3550, { pointerTarget: target }),
      lineFieldConfig,
    )
    const halfway = advanceBy(
      reverse,
      geometryAt(BUILD_END_SCROLL_Y - 3),
      3550,
      lineFieldConfig.handoff.velocityBlendSeconds * 500,
      { pointerTarget: target },
    )
    const capture = getLineFieldMotionSnapshot(halfway)
    const reentered = stepLineFieldMotion(
      halfway.state,
      motionInput(geometryAt(BUILD_END_SCROLL_Y), 3800, { pointerTarget: target }),
      lineFieldConfig,
    )

    expect(halfway.state.mode).toBe('reverse-gather')
    expect(capture.pointerTwistNormalized).toBe(0.75)
    expect(reentered.state.mode).toBe('auto-handoff')
    expect(reentered.state.pointerTwistNormalized).toBe(0.75)
    expect(reentered.state.handoffCapture?.pointerTwistNormalized).toBe(0.75)
    expect(getLineFieldMotionSnapshot(reentered).pointerTwistNormalized).toBe(0.75)
  })

  it('continues the automatic gather through direction changes below the frozen boundary', () => {
    const deep = stepAt(atBlendEnd().state, BUILD_END_SCROLL_Y + 600, 1500)
    const reverseScrollY = BUILD_END_SCROLL_Y - 100
    const reverse = stepAt(deep.state, reverseScrollY, 1550)
    const first = stepAt(reverse.state, reverseScrollY - 20, 1600)
    const fixedScroll = stepAt(first.state, reverseScrollY - 20, 1650)
    const downwardButBelowBoundary = stepAt(first.state, reverseScrollY - 19, 1650)
    const fixedSnapshot = getLineFieldMotionSnapshot(fixedScroll)
    const directionChangeSnapshot = getLineFieldMotionSnapshot(downwardButBelowBoundary)

    expect(first.state.mode).toBe('reverse-gather')
    expect(fixedScroll.state.mode).toBe('reverse-gather')
    expect(downwardButBelowBoundary.state.mode).toBe('reverse-gather')
    expect(Math.abs(
      directionChangeSnapshot.commonFrontDocumentY - fixedSnapshot.commonFrontDocumentY,
    )).toBeLessThan(1)
    expect(Math.abs(
      directionChangeSnapshot.unwrappedPhase - fixedSnapshot.unwrappedPhase,
    )).toBeLessThan(0.01)
    expect(Math.abs(
      directionChangeSnapshot.opacity - fixedSnapshot.opacity,
    )).toBeLessThan(0.01)
    expect(directionChangeSnapshot.tipOffsetsViewportFractions).toHaveLength(
      fixedSnapshot.tipOffsetsViewportFractions.length,
    )
    expect(Math.max(...directionChangeSnapshot.tipOffsetsViewportFractions.map(
      (offset, laneId) => Math.abs(
        offset - (fixedSnapshot.tipOffsetsViewportFractions[laneId] ?? 0),
      ),
    ))).toBeLessThan(0.001)
    expect(downwardButBelowBoundary.requestFrame).toBe(true)
  })

  it('keeps the canonical reverse state visible and hands forward control back at the boundary', () => {
    const deep = stepAt(atBlendEnd().state, BUILD_END_SCROLL_Y + 600, 1500)
    const reverseScrollY = BUILD_END_SCROLL_Y - 300
    const reverse = stepAt(deep.state, reverseScrollY, 1550)
    const gathered = advanceBy(
      reverse,
      geometryAt(reverseScrollY),
      1550,
      lineFieldConfig.handoff.velocityBlendSeconds * 1000,
    )
    const canonical = stepAt(
      createLineFieldMotionState(lineFieldConfig),
      reverseScrollY,
      0,
      { clockMode: 'rebase' },
    )
    const reentered = stepAt(gathered.state, BUILD_END_SCROLL_Y, 2050)

    expect(gathered.state.mode).toBe('scroll-build')
    expect(gathered.frame.opacity).toBe(canonical.frame.opacity)
    expect(gathered.frame.upwardSpineReveal).toBe(canonical.frame.upwardSpineReveal)
    expect(reentered.state.mode).toBe('auto-handoff')
    expect(reentered.frame.opacity).toBe(1)
    expect(reentered.requestFrame).toBe(true)
  })

  it('reconnects settled autonomous tips to the canonical reverse lane offsets', () => {
    const settled = advanceBy(firstHandoff(), geometryAt(BUILD_END_SCROLL_Y), 1000, 2000)
    const zeroOffsets = settled.state.zeroOffsets
    const reverseScrollY = BUILD_END_SCROLL_Y - lineFieldConfig.handoff.reverseDeadbandPx - 1
    const reverse = stepAt(settled.state, reverseScrollY, 3050)
    const halfway = advanceBy(
      reverse,
      geometryAt(reverseScrollY),
      3050,
      lineFieldConfig.handoff.velocityBlendSeconds * 500,
    )
    const gathered = advanceBy(
      reverse,
      geometryAt(reverseScrollY),
      3050,
      lineFieldConfig.handoff.velocityBlendSeconds * 1000,
    )
    const canonical = stepAt(
      createLineFieldMotionState(lineFieldConfig),
      reverseScrollY,
      0,
      { clockMode: 'rebase' },
    )

    expect(settled.frame.tipOffsetsViewportFractions).toBe(zeroOffsets)
    expect(reverse.state.mode).toBe('reverse-gather')
    expect(reverse.frame.tipOffsetsViewportFractions).toBe(zeroOffsets)
    expect(halfway.frame.tipOffsetsViewportFractions).not.toBe(zeroOffsets)
    expect(halfway.frame.tipOffsetsViewportFractions).toHaveLength(zeroOffsets.length)
    expect(gathered.frame.tipOffsetsViewportFractions).toEqual(
      canonical.frame.tipOffsetsViewportFractions,
    )
  })

  it('preserves captures and canonical offsets through resize and theme changes', () => {
    const handoff = firstHandoff()
    const capture = getLineFieldMotionSnapshot(handoff)
    const mobileLight = stepLineFieldMotion(
      handoff.state,
      motionInput(geometryAt(BUILD_END_SCROLL_Y, {
        viewportWidth: 390,
        viewportHeight: 844,
        anchorViewport: [195, 422],
      }), 5000, {
        clockMode: 'rebase',
        theme: 'light',
      }),
      lineFieldConfig,
    )
    const desktopDark = stepLineFieldMotion(
      mobileLight.state,
      motionInput(geometryAt(BUILD_END_SCROLL_Y), 9000, {
        clockMode: 'rebase',
        theme: 'dark',
      }),
      lineFieldConfig,
    )

    expect(getLineFieldMotionSnapshot(mobileLight)).toEqual(capture)
    expect(getLineFieldMotionSnapshot(desktopDark)).toEqual(capture)
    expect(mobileLight.frame.tipOffsetsViewportFractions).toBe(capture.tipOffsetsViewportFractions)
    expect(desktopDark.frame.tipOffsetsViewportFractions).toBe(capture.tipOffsetsViewportFractions)
    expect(mobileLight.frame.theme).toBe('light')
    expect(desktopDark.frame.theme).toBe('dark')
  })

  it('reuses the last valid geometry for invalid samples without reseeding motion', () => {
    const handoff = firstHandoff()
    const expected = stepLineFieldMotion(
      handoff.state,
      motionInput(geometryAt(BUILD_END_SCROLL_Y), 1050),
      lineFieldConfig,
    )
    const invalid = stepLineFieldMotion(
      handoff.state,
      motionInput(geometryAt(100, { viewportWidth: Number.NaN }), 1050),
      lineFieldConfig,
    )

    expect(getLineFieldMotionSnapshot(invalid)).toEqual(getLineFieldMotionSnapshot(expected))
    expect(invalid.frame.anchorViewport).toEqual(expected.frame.anchorViewport)
    expect(invalid.state.canonicalOffsets).toBe(handoff.state.canonicalOffsets)
  })

  it('returns a finite dormant zero-opacity frame when the first geometry is invalid', () => {
    const result = stepLineFieldMotion(
      createLineFieldMotionState(lineFieldConfig),
      motionInput(geometryAt(Number.NaN, {
        viewportWidth: 0,
        viewportHeight: Number.POSITIVE_INFINITY,
        anchorViewport: [Number.NaN, Number.NEGATIVE_INFINITY],
        mottoCardFinalTop: 3200,
        mottoCardFinalBottom: 3100,
      }), Number.NaN, {
        pointerTarget: {
          proximity: Number.POSITIVE_INFINITY,
          twistNormalized: Number.NaN,
        },
      }),
      lineFieldConfig,
    )

    expect(result.state.mode).toBe('dormant')
    expect(result.frame.mode).toBe('dormant')
    expect(result.frame.opacity).toBe(0)
    expect(result.requestFrame).toBe(false)
    expectFiniteResult(result)
  })

  it('clamps negative and overscroll samples to the page range', () => {
    const negative = stepAt(
      createLineFieldMotionState(lineFieldConfig),
      -100,
      0,
      { clockMode: 'rebase' },
    )
    const zero = stepAt(
      createLineFieldMotionState(lineFieldConfig),
      0,
      0,
      { clockMode: 'rebase' },
    )
    const overscroll = stepAt(
      createLineFieldMotionState(lineFieldConfig),
      99_999,
      0,
      { clockMode: 'rebase' },
    )
    const pageEnd = stepAt(
      createLineFieldMotionState(lineFieldConfig),
      5100,
      0,
      { clockMode: 'rebase' },
    )

    expect(negative.frame).toEqual(zero.frame)
    expect(overscroll.frame).toEqual(pageEnd.frame)
  })

  it('rebases non-finite and backward time and never persists non-finite pointer values', () => {
    const geometry = geometryAt(2000)
    const initial = stepLineFieldMotion(
      createLineFieldMotionState(lineFieldConfig),
      motionInput(geometry, 1000, {
        clockMode: 'rebase',
        pointerTarget: { proximity: 1, twistNormalized: 1 },
      }),
      lineFieldConfig,
    )
    const advanced = stepLineFieldMotion(
      initial.state,
      motionInput(geometry, 1050, {
        pointerTarget: { proximity: 1, twistNormalized: 1 },
      }),
      lineFieldConfig,
    )
    const backward = stepLineFieldMotion(
      advanced.state,
      motionInput(geometry, 1000, {
        pointerTarget: { proximity: 1, twistNormalized: 1 },
      }),
      lineFieldConfig,
    )
    const nonFinite = stepLineFieldMotion(
      backward.state,
      motionInput(geometry, Number.POSITIVE_INFINITY, {
        pointerTarget: {
          proximity: Number.NaN,
          twistNormalized: Number.NEGATIVE_INFINITY,
        },
      }),
      lineFieldConfig,
    )

    expect(getLineFieldMotionSnapshot(backward)).toEqual(getLineFieldMotionSnapshot(advanced))
    expect(spatialValues(nonFinite)).toEqual(spatialValues(backward))
    expectFiniteResult(nonFinite)

    const resumed = stepLineFieldMotion(
      nonFinite.state,
      motionInput(geometry, 1100, {
        pointerTarget: { proximity: 0, twistNormalized: 0 },
      }),
      lineFieldConfig,
    )
    expect(getLineFieldMotionSnapshot(resumed)).toEqual(getLineFieldMotionSnapshot(nonFinite))
    expectFiniteResult(resumed)
  })
})

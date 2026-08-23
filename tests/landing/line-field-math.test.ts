import { describe, expect, it } from 'vitest'
import {
  createLaneTipOffsets,
  settleTipOffset,
} from '../../src/landing/line-field/math/line-stagger'
import type { LaneTipOffsetParameters } from '../../src/landing/line-field/math/line-stagger'
import {
  THREADS_LINE_PARAMETERS,
  threadsCenterline,
  threadsLineOpacity,
  threadsLineSoftness,
  threadsLineWidth,
  threadsPerlin2D,
} from '../../src/landing/line-field/math/wave-field'

const nonFiniteNumbers = [
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
]

const staggerParameters: LaneTipOffsetParameters = {
  tipCount: 36,
  seed: 3817,
  maximumTipGapVh: 0.03,
  staggerStrength: 1,
}

describe('accepted Threads field math', () => {
  it('uses exactly forty source line parameters with p=i/40 and no p=1 endpoint', () => {
    expect(THREADS_LINE_PARAMETERS).toHaveLength(40)
    expect(THREADS_LINE_PARAMETERS[0]).toBe(0)
    expect(THREADS_LINE_PARAMETERS[1]).toBe(0.02500000037252903)
    expect(THREADS_LINE_PARAMETERS[20]).toBe(0.5)
    expect(THREADS_LINE_PARAMETERS[39]).toBe(0.9750000238418579)
  })

  it('matches independent Binary32 Perlin goldens including the 71-cell wrap', () => {
    for (const [x, y, expected] of [
      [0, 0, 0],
      [0.25, 0.75, 0.1331367940],
      [-1.25, 0.625, -0.2051103115],
      [71.25, 0.75, 0.1331367940],
      [0, 2.5, 0.2386498302],
      [0, 1.75, -0.3860482275],
    ] as const) {
      expect(Math.abs(threadsPerlin2D(x, y) - expected)).toBeLessThanOrEqual(5e-7)
    }
  })

  it('matches independent source centerlines with default and interactive uniforms', () => {
    for (const [actual, expected] of [
      [threadsCenterline(0.7, 0, 0), 0.4331173897],
      [threadsCenterline(0.45, 0.5, 3), 0.4919751585],
      [threadsCenterline(0.7, 0.975, 10, 1, 0, [0.25, 0.8]), 0.5012227297],
      [threadsCenterline(0.7, 0.25, 3, 0.6, 0.4, [0.25, 0.8]), 0.4385842085],
    ] as const) {
      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(2e-6)
    }
  })

  it('matches source width, blur softness, and per-line opacity anchors', () => {
    expect(Math.abs(threadsLineWidth(0, 1200, 900) - 0.0058333334)).toBeLessThanOrEqual(1e-7)
    expect(Math.abs(threadsLineSoftness(0.35, 0.5, 1200, 900) - 0.0041666669)).toBeLessThanOrEqual(1e-7)
    expect(Math.abs(threadsLineOpacity(0.5) - 0.0925115943)).toBeLessThanOrEqual(1e-7)
  })
})

describe('line-field lane staggering', () => {
  it('creates deterministic bounded offsets with a literal zero for lane zero', () => {
    const first = createLaneTipOffsets(staggerParameters)
    const second = createLaneTipOffsets(staggerParameters)

    expect(first).toHaveLength(36)
    expect(second).toEqual(first)
    expect(first[0]).toBe(0)

    for (const offset of first) {
      expect(offset).toBeGreaterThanOrEqual(-0.015)
      expect(offset).toBeLessThanOrEqual(0.015)
    }

    expect(Math.max(...first) - Math.min(...first)).toBeLessThanOrEqual(0.03)
  })

  it('scales the allowed half-gap by stagger strength before hashing', () => {
    const fullStrength = createLaneTipOffsets(staggerParameters)
    const halfStrength = createLaneTipOffsets({ ...staggerParameters, staggerStrength: 0.5 })
    const noStrength = createLaneTipOffsets({ ...staggerParameters, staggerStrength: 0 })

    for (let laneIndex = 0; laneIndex < staggerParameters.tipCount; laneIndex += 1) {
      expect(halfStrength[laneIndex]).toBeCloseTo(fullStrength[laneIndex] * 0.5)
      expect(noStrength[laneIndex]).toBe(0)
    }
  })

  it('settles a laggard exponentially toward its target without overshoot', () => {
    const settled = settleTipOffset(0, 1, 12, 1 / 60)

    expect(settled).toBeCloseTo(0.18126924692201818)
    expect(settled).toBeGreaterThan(0)
    expect(settled).toBeLessThan(1)
  })

  it('returns the current offset for invalid or non-positive timing inputs', () => {
    for (const deltaSeconds of [0, -1, ...nonFiniteNumbers]) {
      expect(settleTipOffset(0.25, 1, 12, deltaSeconds)).toBe(0.25)
    }

    for (const catchupRatePerSecond of [0, -1, ...nonFiniteNumbers]) {
      expect(settleTipOffset(0.25, 1, catchupRatePerSecond, 1 / 60)).toBe(0.25)
    }
  })

  it('sanitizes non-finite staggering inputs without producing non-finite offsets', () => {
    for (const value of nonFiniteNumbers) {
      expect(createLaneTipOffsets({ ...staggerParameters, tipCount: value })).toEqual([])

      for (const offsets of [
        createLaneTipOffsets({ ...staggerParameters, seed: value }),
        createLaneTipOffsets({ ...staggerParameters, maximumTipGapVh: value }),
        createLaneTipOffsets({ ...staggerParameters, staggerStrength: value }),
      ]) {
        expect(offsets).toHaveLength(36)
        expect(offsets.every(Number.isFinite)).toBe(true)
      }

      expect(Number.isFinite(settleTipOffset(value, 1, 12, 1 / 60))).toBe(true)
      expect(Number.isFinite(settleTipOffset(0, value, 12, 1 / 60))).toBe(true)
    }
  })
})

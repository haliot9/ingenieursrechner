import { describe, expect, it } from 'vitest'
import { lineFieldConfig } from '../../src/landing/line-field/config/line-field-config.generated'
import { evaluateOrbitMotion, orbitFrontView } from '../../src/landing/line-field/motion/orbit-motion'

type Vector3 = readonly [number, number, number]

const dot3 = (left: Vector3, right: Vector3) => left[0] * right[0] + left[1] * right[1] + left[2] * right[2]
const add3 = (left: Vector3, right: Vector3): Vector3 => [left[0] + right[0], left[1] + right[1], left[2] + right[2]]
const subtract3 = (left: Vector3, right: Vector3): Vector3 => [left[0] - right[0], left[1] - right[1], left[2] - right[2]]
const scale3 = (vector: Vector3, scalar: number): Vector3 => [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar]
const cross3 = (left: Vector3, right: Vector3): Vector3 => [
  left[1] * right[2] - left[2] * right[1],
  left[2] * right[0] - left[0] * right[2],
  left[0] * right[1] - left[1] * right[0],
]
const normalize3 = (vector: Vector3): Vector3 => scale3(vector, 1 / Math.sqrt(dot3(vector, vector)))
const radians = (degrees: number) => degrees * Math.PI / 180
const cosineProgress = (progress: number) => (1 - Math.cos(Math.PI * progress)) / 2

const phiAtProgress = (progress: number) => evaluateOrbitMotion(progress, lineFieldConfig.motto).phiRadians

function progressAtPhi(phiDegrees: number) {
  const target = radians(phiDegrees)
  let lower = 0
  let upper = 1
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const midpoint = (lower + upper) / 2
    if (phiAtProgress(midpoint) < target) lower = midpoint
    else upper = midpoint
  }
  return (lower + upper) / 2
}

function expectedCardCenter(progress: number, phiRadians: number, scale: number): Vector3 {
  const { orbit } = lineFieldConfig.motto
  const thetaX = radians(orbit.thetaXDegrees)
  const thetaY = radians(orbit.thetaYDegrees)
  const normal = normalize3([-Math.tan(thetaX), -Math.tan(thetaY), 1])
  const ex = normalize3(subtract3([1, 0, 0], scale3(normal, dot3([1, 0, 0], normal))))
  const ey = normalize3(cross3(normal, ex))
  const path = add3(scale3(ex, Math.cos(phiRadians)), scale3(ey, Math.sin(phiRadians)))
  return add3(add3([0, 0, -orbit.originDriftRadiusRatio * progress], path), [0, 0, orbit.localOffsetRadiusRatio * scale])
}

const velocityAt = (progress: number, step: number) => (
  phiAtProgress(progress + step) - phiAtProgress(progress - step)
) / (2 * step)

const accelerationAt = (progress: number, step: number) => (
  phiAtProgress(progress + step) - 2 * phiAtProgress(progress) + phiAtProgress(progress - step)
) / (step * step)

describe('normalized motto orbit motion', () => {
  it('projects the conventional world XZ front view into CSS coordinates', () => {
    expect(orbitFrontView([3, 4, 5])).toEqual([3, -5])
  })

  it('evaluates calibrated landmarks in world coordinates', () => {
    const start = evaluateOrbitMotion(0, lineFieldConfig.motto)
    const peakProgress = (180 - 80) / (290 - 80)
    const peak = evaluateOrbitMotion(peakProgress, lineFieldConfig.motto)
    const end = evaluateOrbitMotion(1, lineFieldConfig.motto)

    expect(start.phiRadians).toBeCloseTo(80 * Math.PI / 180, 12)
    expect(peak.phiRadians).toBeCloseTo(Math.PI, 12)
    expect(end.phiRadians).toBeCloseTo(290 * Math.PI / 180, 12)
    expect([start.scale, peak.scale, end.scale]).toEqual([0.22, 0.5, 1])
    expect([start.blurNorm, peak.blurNorm, end.blurNorm]).toEqual([1, 0.5, 0])
    expect(orbitFrontView([2, 7, -3])).toEqual([2, 3])
    const interior = evaluateOrbitMotion(0.37, lineFieldConfig.motto)
    expectedCardCenter(0.37, interior.phiRadians, interior.scale).forEach((value, index) => {
      expect(interior.cardCenter[index]).toBeCloseTo(value, 12)
    })
  })

  it('follows the approved accelerating then decelerating angular clock', () => {
    const peakProgress = (180 - 80) / (290 - 80)
    const halfBeforePeak = peakProgress * 0.5
    const halfAfterPeak = peakProgress + (1 - peakProgress) * 0.5
    const derivativeStep = 0.00001
    const accelerationStep = 0.0001
    // With segment durations proportional to their angle spans, peak dphi/dp is twice the total span.
    const expectedPeakVelocity = 7.3303828583761845

    expect(phiAtProgress(halfBeforePeak)).toBeCloseTo(1.7133724720370727, 12)
    expect(phiAtProgress(halfAfterPeak)).toBeCloseTo(4.712634853297786, 12)

    const leftPeakVelocity = (phiAtProgress(peakProgress) - phiAtProgress(peakProgress - derivativeStep)) / derivativeStep
    const rightPeakVelocity = (phiAtProgress(peakProgress + derivativeStep) - phiAtProgress(peakProgress)) / derivativeStep
    expect(leftPeakVelocity).toBeCloseTo(expectedPeakVelocity, 6)
    expect(rightPeakVelocity).toBeCloseTo(expectedPeakVelocity, 6)
    expect(leftPeakVelocity).toBeCloseTo(rightPeakVelocity, 7)

    for (const localProgress of [0.2, 0.4, 0.6, 0.8]) {
      expect(accelerationAt(peakProgress * localProgress, accelerationStep)).toBeGreaterThan(0)
      expect(accelerationAt(peakProgress + (1 - peakProgress) * localProgress, accelerationStep)).toBeLessThan(0)
    }
    expect(accelerationAt(halfBeforePeak, accelerationStep)).toBeCloseTo(24.18053078266893, 3)
    expect(accelerationAt(halfAfterPeak, accelerationStep)).toBeCloseTo(-21.982300711517208, 3)

    for (let index = 1; index < 100; index += 1) {
      const velocity = velocityAt(index / 100, derivativeStep)
      expect(velocity).toBeGreaterThan(0)
      expect(velocity).toBeLessThanOrEqual(expectedPeakVelocity + 0.000001)
    }
  })

  it('has zero endpoint angular velocity and acceleration', () => {
    // The approved cubic endpoint approach makes these one-sided estimates O(h^2) and O(h);
    // the tolerances clear floating-point noise but remain far below the old cosine clock's acceleration.
    const step = 0.00001
    const startVelocity = (phiAtProgress(step) - phiAtProgress(0)) / step
    const endVelocity = (phiAtProgress(1) - phiAtProgress(1 - step)) / step
    const startAcceleration = (phiAtProgress(2 * step) - 2 * phiAtProgress(step) + phiAtProgress(0)) / (step * step)
    const endAcceleration = (phiAtProgress(1) - 2 * phiAtProgress(1 - step) + phiAtProgress(1 - 2 * step)) / (step * step)

    expect(Math.abs(startVelocity)).toBeLessThan(0.000001)
    expect(Math.abs(endVelocity)).toBeLessThan(0.000001)
    expect(Math.abs(startAcceleration)).toBeLessThan(0.01)
    expect(Math.abs(endAcceleration)).toBeLessThan(0.01)
  })

  it('is deterministic, finite, and monotonic', () => {
    let previousPhi = -Infinity
    for (let index = 0; index <= 100; index += 1) {
      const progress = index / 100
      const sample = evaluateOrbitMotion(progress, lineFieldConfig.motto)
      expect(sample.cardCenter.every(Number.isFinite)).toBe(true)
      expect(sample.phiRadians).toBeGreaterThanOrEqual(previousPhi)
      expect(evaluateOrbitMotion(progress, lineFieldConfig.motto)).toEqual(sample)
      previousPhi = sample.phiRadians
    }
  })

  it('cosine-fades opacity in the phi domain', () => {
    for (const [phiDegrees, expectedOpacity] of [
      [80, 0],
      [90, 0.1464466094067262],
      [100, 0.5],
      [120, 1],
    ] as const) {
      const sample = evaluateOrbitMotion(progressAtPhi(phiDegrees), lineFieldConfig.motto)
      expect(sample.phiRadians).toBeCloseTo(radians(phiDegrees), 12)
      expect(sample.opacity).toBeCloseTo(expectedOpacity, 12)
    }
  })

  it('cosine-interpolates scale and blur inside both phi segments', () => {
    const peakProgress = (180 - 80) / (290 - 80)
    const firstLocalProgress = 0.25
    const secondLocalProgress = 0.6
    const first = evaluateOrbitMotion(peakProgress * firstLocalProgress, lineFieldConfig.motto)
    const second = evaluateOrbitMotion(
      peakProgress + (1 - peakProgress) * secondLocalProgress,
      lineFieldConfig.motto,
    )
    const firstCosineProgress = cosineProgress(firstLocalProgress)
    const secondCosineProgress = cosineProgress(secondLocalProgress)

    expect(first.scale).toBeCloseTo(0.22 + (0.5 - 0.22) * firstCosineProgress, 12)
    expect(first.blurNorm).toBeCloseTo(1 + (0.5 - 1) * firstCosineProgress, 12)
    expect(second.scale).toBeCloseTo(0.5 + (1 - 0.5) * secondCosineProgress, 12)
    expect(second.blurNorm).toBeCloseTo(0.5 + (0 - 0.5) * secondCosineProgress, 12)
  })

  it('applies origin drift exclusively to the world-Z contribution', () => {
    const progress = 0.37
    const baseline = evaluateOrbitMotion(progress, lineFieldConfig.motto)
    const changedConfig = structuredClone(lineFieldConfig.motto)
    changedConfig.orbit.originDriftRadiusRatio += 0.4
    const changed = evaluateOrbitMotion(progress, changedConfig)

    expect(changed.cardCenter[0]).toBe(baseline.cardCenter[0])
    expect(changed.cardCenter[1]).toBe(baseline.cardCenter[1])
    expect(changed.cardCenter[2] - baseline.cardCenter[2]).toBeCloseTo(-0.4 * progress, 12)
  })
})

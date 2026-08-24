import type { LineFieldAnimationConfig } from '../config/line-field-config.types'

export type OrbitVector3 = readonly [number, number, number]

export interface OrbitMotionSample {
  readonly progress: number
  readonly phiRadians: number
  readonly cardCenter: OrbitVector3
  readonly scale: number
  readonly blurNorm: number
  readonly opacity: number
}

const finiteOrZero = (value: number) => Number.isFinite(value) ? value : 0
const clamp01 = (value: number) => Math.min(1, Math.max(0, finiteOrZero(value)))
const normalizeZero = (value: number) => value === 0 ? 0 : finiteOrZero(value)
const radians = (degrees: number) => finiteOrZero(degrees) * Math.PI / 180

const add3 = (left: OrbitVector3, right: OrbitVector3): OrbitVector3 => [
  normalizeZero(left[0] + right[0]),
  normalizeZero(left[1] + right[1]),
  normalizeZero(left[2] + right[2]),
]
const subtract3 = (left: OrbitVector3, right: OrbitVector3): OrbitVector3 => [
  normalizeZero(left[0] - right[0]),
  normalizeZero(left[1] - right[1]),
  normalizeZero(left[2] - right[2]),
]
const scale3 = (vector: OrbitVector3, scalar: number): OrbitVector3 => [
  normalizeZero(vector[0] * finiteOrZero(scalar)),
  normalizeZero(vector[1] * finiteOrZero(scalar)),
  normalizeZero(vector[2] * finiteOrZero(scalar)),
]
const dot3 = (left: OrbitVector3, right: OrbitVector3) => finiteOrZero(left[0] * right[0] + left[1] * right[1] + left[2] * right[2])
const cross3 = (left: OrbitVector3, right: OrbitVector3): OrbitVector3 => [
  normalizeZero(left[1] * right[2] - left[2] * right[1]),
  normalizeZero(left[2] * right[0] - left[0] * right[2]),
  normalizeZero(left[0] * right[1] - left[1] * right[0]),
]
const normalize3 = (vector: OrbitVector3): OrbitVector3 => {
  const length = Math.sqrt(dot3(vector, vector))
  return length > 0 && Number.isFinite(length) ? scale3(vector, 1 / length) : [0, 0, 0]
}

const cosineEase = (progress: number) => {
  const clamped = clamp01(progress)
  if (clamped === 0) return 0
  if (clamped === 1) return 1
  return normalizeZero((1 - Math.cos(Math.PI * clamped)) / 2)
}

const cosineSegment = (start: number, end: number, progress: number) => {
  const eased = cosineEase(progress)
  if (eased === 0) return finiteOrZero(start)
  if (eased === 1) return finiteOrZero(end)
  return normalizeZero(finiteOrZero(start) + (finiteOrZero(end) - finiteOrZero(start)) * eased)
}

const angularSegment = (start: number, end: number, progress: number, beforePeak: boolean) => {
  const clamped = clamp01(progress)
  if (clamped === 0) return finiteOrZero(start)
  if (clamped === 1) return finiteOrZero(end)
  const clock = beforePeak
    ? clamped - Math.sin(Math.PI * clamped) / Math.PI
    : clamped + Math.sin(Math.PI * clamped) / Math.PI
  return normalizeZero(finiteOrZero(start) + (finiteOrZero(end) - finiteOrZero(start)) * clock)
}

const segmentProgress = (progress: number, peakProgress: number) => {
  if (progress <= peakProgress) return [0, peakProgress === 0 ? 1 : progress / peakProgress] as const
  return [1, peakProgress === 1 ? 1 : (progress - peakProgress) / (1 - peakProgress)] as const
}

export function orbitFrontView(cardCenter: OrbitVector3): readonly [number, number] {
  return [normalizeZero(cardCenter[0]), normalizeZero(-cardCenter[2])]
}

export function evaluateOrbitMotion(
  progress: number,
  config: LineFieldAnimationConfig['motto'],
): OrbitMotionSample {
  const p = clamp01(progress)
  const { orbit, depthCues, visibility } = config
  const phiStart = finiteOrZero(orbit.phiStartDegrees)
  const phiPeak = finiteOrZero(orbit.phiPeakDegrees)
  const phiEnd = finiteOrZero(orbit.phiEndDegrees)
  const phiSpan = phiEnd - phiStart
  const peakProgress = phiSpan === 0 ? 0.5 : clamp01((phiPeak - phiStart) / phiSpan)
  const [segment, localProgress] = segmentProgress(p, peakProgress)
  const phiDegrees = segment === 0
    ? angularSegment(phiStart, phiPeak, localProgress, true)
    : angularSegment(phiPeak, phiEnd, localProgress, false)
  const scale = segment === 0
    ? cosineSegment(depthCues.scaleStart, depthCues.scaleAtPhiPeak, localProgress)
    : cosineSegment(depthCues.scaleAtPhiPeak, depthCues.scaleEnd, localProgress)
  const blurNorm = segment === 0
    ? cosineSegment(depthCues.blurStart, depthCues.blurAtPhiPeak, localProgress)
    : cosineSegment(depthCues.blurAtPhiPeak, depthCues.blurEnd, localProgress)
  const phiRadians = radians(phiDegrees)
  const visibilityStart = finiteOrZero(visibility.phiStartDegrees)
  const visibilityEnd = finiteOrZero(visibility.phiEndDegrees)
  const opacity = phiDegrees <= visibilityStart
    ? finiteOrZero(visibility.opacityStart)
    : phiDegrees >= visibilityEnd
      ? finiteOrZero(visibility.opacityEnd)
      : cosineSegment(
          visibility.opacityStart,
          visibility.opacityEnd,
          (phiDegrees - visibilityStart) / (visibilityEnd - visibilityStart),
        )

  const normal = normalize3([-Math.tan(radians(orbit.thetaXDegrees)), -Math.tan(radians(orbit.thetaYDegrees)), 1])
  const ex = normalize3(subtract3([1, 0, 0], scale3(normal, dot3([1, 0, 0], normal))))
  const ey = normalize3(cross3(normal, ex))
  const orbitPosition = add3(scale3(ex, Math.cos(phiRadians)), scale3(ey, Math.sin(phiRadians)))
  const origin: OrbitVector3 = [0, 0, -finiteOrZero(orbit.originDriftRadiusRatio) * p]
  const localOffset: OrbitVector3 = [0, 0, finiteOrZero(orbit.localOffsetRadiusRatio) * scale]

  return {
    progress: p,
    phiRadians,
    cardCenter: add3(add3(origin, orbitPosition), localOffset),
    scale,
    blurNorm,
    opacity,
  }
}

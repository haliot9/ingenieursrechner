import type { LineFieldAnimationConfig } from '../config/line-field-config.types'

type Vector2 = readonly [number, number]

export interface OrbitProjectionSample {
  readonly progress: number
  readonly referenceCenter: readonly [number, number]
  readonly scale: number
  readonly blurPx: number
}

export interface OrbitProjectionGeometry {
  readonly viewportWidth: number
  readonly panelDocumentTop: number
  readonly finalCenter: readonly [number, number]
  readonly cardWidthPx: number
}

export type OrbitProjectionStatus =
  | 'ok'
  | 'gutter-constrained'
  | 'gutter-infeasible'
  | 'endpoint-gutter-violation'
  | 'degenerate'

export interface OrbitProjectionFit {
  readonly status: OrbitProjectionStatus
  readonly bulgeFactor: number
  readonly project: (referenceCenter: readonly [number, number]) => readonly [number, number]
}

const normalizeZero = (value: number) => value === 0 ? 0 : value
const finiteOrZero = (value: number) => Number.isFinite(value) ? normalizeZero(value) : 0
const isFinite2 = (vector: Vector2) => vector.every(Number.isFinite)
const same2 = (left: Vector2, right: Vector2) => left[0] === right[0] && left[1] === right[1]
const subtract2 = (left: Vector2, right: Vector2): Vector2 => [left[0] - right[0], left[1] - right[1]]
const dot2 = (left: Vector2, right: Vector2) => left[0] * right[0] + left[1] * right[1]
const cross2 = (left: Vector2, right: Vector2) => left[0] * right[1] - left[1] * right[0]

function degenerateFit(finalCenter: Vector2): OrbitProjectionFit {
  const fallback: Vector2 = [finiteOrZero(finalCenter[0]), finiteOrZero(finalCenter[1])]
  return {
    status: 'degenerate',
    bulgeFactor: 0,
    project: () => fallback,
  }
}

export function fitResponsiveOrbitProjection(
  samples: readonly OrbitProjectionSample[],
  geometry: OrbitProjectionGeometry,
  config: LineFieldAnimationConfig['motto']['projection'],
): OrbitProjectionFit {
  const fallback = degenerateFit(geometry.finalCenter)
  const finiteGeometry = Number.isFinite(geometry.viewportWidth)
    && geometry.viewportWidth > 0
    && Number.isFinite(geometry.panelDocumentTop)
    && isFinite2(geometry.finalCenter)
    && Number.isFinite(geometry.cardWidthPx)
    && geometry.cardWidthPx >= 0
  const finiteConfig = Number.isFinite(config.startCenterXViewportRatio)
    && Number.isFinite(config.preferredBulge)
    && Number.isFinite(config.minimumLeftGutterPx)
    && Number.isFinite(config.minimumLeftGutterVw)
    && Number.isFinite(config.blurSafetyMultiplier)
  const finiteSamples = samples.length >= 2 && samples.every((sample) => (
    Number.isFinite(sample.progress)
      && isFinite2(sample.referenceCenter)
      && Number.isFinite(sample.scale)
      && Number.isFinite(sample.blurPx)
  ))

  if (!finiteGeometry || !finiteConfig || !finiteSamples) return fallback

  const firstSample = samples[0]
  const finalSample = samples.at(-1)!
  const referenceStart = firstSample.referenceCenter
  const referenceEnd = finalSample.referenceCenter
  const referenceChord = subtract2(referenceEnd, referenceStart)
  const referenceChordSquared = dot2(referenceChord, referenceChord)
  const referenceChordLength = Math.sqrt(referenceChordSquared)
  const startCenter: Vector2 = [
    normalizeZero(config.startCenterXViewportRatio * geometry.viewportWidth),
    normalizeZero(geometry.panelDocumentTop),
  ]
  const finalCenter: Vector2 = [
    normalizeZero(geometry.finalCenter[0]),
    normalizeZero(geometry.finalCenter[1]),
  ]
  const targetChord = subtract2(finalCenter, startCenter)
  const targetChordLength = Math.hypot(...targetChord)

  if (!(referenceChordLength > 0) || !(targetChordLength > 0)
    || !Number.isFinite(referenceChordSquared)
    || !Number.isFinite(referenceChordLength)
    || !Number.isFinite(targetChordLength)) {
    return fallback
  }

  const targetNormal: Vector2 = [
    normalizeZero(-targetChord[1] / targetChordLength),
    normalizeZero(targetChord[0] / targetChordLength),
  ]
  const perpendicularScale = targetChordLength / referenceChordLength * config.preferredBulge

  if (!Number.isFinite(perpendicularScale)) return fallback

  const components = (referenceCenter: Vector2) => {
    const fromStart = subtract2(referenceCenter, referenceStart)
    const along = dot2(fromStart, referenceChord) / referenceChordSquared
    const signedPerpendicular = cross2(referenceChord, fromStart) / referenceChordLength
    const perpendicular = signedPerpendicular * perpendicularScale
    const base: Vector2 = [
      startCenter[0] + targetChord[0] * along,
      startCenter[1] + targetChord[1] * along,
    ]
    const coefficient: Vector2 = [
      targetNormal[0] * perpendicular,
      targetNormal[1] * perpendicular,
    ]
    return { base, coefficient }
  }

  const createProjector = (bulgeFactor: number) => (referenceCenter: Vector2): Vector2 => {
    if (!isFinite2(referenceCenter)) return finalCenter
    if (same2(referenceCenter, referenceStart)) return startCenter
    if (same2(referenceCenter, referenceEnd)) return finalCenter
    const { base, coefficient } = components(referenceCenter)
    const projected: Vector2 = [
      normalizeZero(base[0] + coefficient[0] * bulgeFactor),
      normalizeZero(base[1] + coefficient[1] * bulgeFactor),
    ]
    return isFinite2(projected) ? projected : finalCenter
  }
  const gutterInfeasibleFit = (): OrbitProjectionFit => ({
    status: 'gutter-infeasible',
    bulgeFactor: 0,
    project: createProjector(0),
  })

  const gutter = Math.max(
    config.minimumLeftGutterPx,
    config.minimumLeftGutterVw * geometry.viewportWidth / 100,
  )
  const startVisibleLeft = startCenter[0]
    - 0.5 * geometry.cardWidthPx * firstSample.scale
    - config.blurSafetyMultiplier * firstSample.blurPx
  const finalVisibleLeft = finalCenter[0]
    - 0.5 * geometry.cardWidthPx * finalSample.scale
    - config.blurSafetyMultiplier * finalSample.blurPx

  if (!Number.isFinite(gutter)
    || !Number.isFinite(startVisibleLeft)
    || !Number.isFinite(finalVisibleLeft)) {
    return fallback
  }
  if (finalVisibleLeft < gutter) {
    return {
      status: 'endpoint-gutter-violation',
      bulgeFactor: 0,
      project: createProjector(0),
    }
  }
  if (startVisibleLeft < gutter) return gutterInfeasibleFit()

  let lowerBound = 0
  let upperBound = 1
  for (let index = 1; index < samples.length - 1; index += 1) {
    const sample = samples[index]
    const { base, coefficient } = components(sample.referenceCenter)
    const baseVisibleLeft = base[0]
      - 0.5 * geometry.cardWidthPx * sample.scale
      - config.blurSafetyMultiplier * sample.blurPx
    const xCoefficient = coefficient[0]

    if (!isFinite2(base)
      || !isFinite2(coefficient)
      || !Number.isFinite(baseVisibleLeft)
      || !Number.isFinite(xCoefficient)) {
      return fallback
    }
    if (xCoefficient > 0) {
      lowerBound = Math.max(lowerBound, (gutter - baseVisibleLeft) / xCoefficient)
    } else if (xCoefficient < 0) {
      upperBound = Math.min(upperBound, (gutter - baseVisibleLeft) / xCoefficient)
    } else if (baseVisibleLeft < gutter) {
      return gutterInfeasibleFit()
    }
  }

  lowerBound = Math.max(0, lowerBound)
  upperBound = Math.min(1, upperBound)
  if (!Number.isFinite(lowerBound) || !Number.isFinite(upperBound)) return fallback
  if (lowerBound > upperBound || lowerBound > 1 || upperBound < 0) {
    return gutterInfeasibleFit()
  }

  const bulgeFactor = normalizeZero(Math.max(0, Math.min(1, upperBound)))
  return {
    status: bulgeFactor < 1 ? 'gutter-constrained' : 'ok',
    bulgeFactor,
    project: createProjector(bulgeFactor),
  }
}

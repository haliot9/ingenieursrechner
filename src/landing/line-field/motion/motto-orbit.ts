import type { LineFieldAnimationConfig } from '../config/line-field-config.types'
import type { LineFieldViewportGeometry } from './line-field-geometry'
import { evaluateOrbitMotion, orbitFrontView } from './orbit-motion'
import {
  fitResponsiveOrbitProjection,
  type OrbitProjectionFit,
  type OrbitProjectionGeometry,
  type OrbitProjectionSample,
  type OrbitProjectionStatus,
} from './responsive-orbit-projection'

export interface MottoOrbitFrame {
  readonly translateXPx: number
  readonly translateYPx: number
  readonly scale: number
  readonly blurPx: number
  readonly opacity: number
  readonly projectionStatus: OrbitProjectionStatus
}

export interface PreparedMottoOrbitProjection {
  readonly referenceSamples: readonly OrbitProjectionSample[]
  readonly fit: OrbitProjectionFit
}

interface ProjectionGeometryKey {
  readonly viewportWidth: number
  readonly panelDocumentTop: number
  readonly finalCenterX: number
  readonly finalCenterY: number
  readonly cardWidthPx: number
}

interface MottoOrbitConfigPreparation {
  readonly referenceSamples: readonly OrbitProjectionSample[]
  lastGeometryKey: ProjectionGeometryKey | null
  lastProjection: PreparedMottoOrbitProjection | null
}

const finiteOrZero = (value: number) => Number.isFinite(value) ? value : 0
const clamp01 = (value: number) => Math.min(1, Math.max(0, finiteOrZero(value)))
const normalizeZero = (value: number) => value === 0 ? 0 : finiteOrZero(value)
const preparationByConfig = new WeakMap<
  LineFieldAnimationConfig['motto'],
  MottoOrbitConfigPreparation
>()

function blurPixels(
  blurNormalized: number,
  config: LineFieldAnimationConfig['motto'],
): number {
  return normalizeZero(blurNormalized * config.depthCues.blurMaximumPx)
}

function projectionGeometryKey(
  geometry: LineFieldViewportGeometry,
): ProjectionGeometryKey {
  return {
    viewportWidth: geometry.viewportWidth,
    panelDocumentTop: geometry.mottoTop,
    finalCenterX: geometry.mottoCardFinalCenterX,
    finalCenterY: (geometry.mottoCardFinalTop + geometry.mottoCardFinalBottom) / 2,
    cardWidthPx: geometry.mottoCardFinalWidth,
  }
}

function sameProjectionGeometry(
  left: ProjectionGeometryKey,
  right: ProjectionGeometryKey,
): boolean {
  return left.viewportWidth === right.viewportWidth
    && left.panelDocumentTop === right.panelDocumentTop
    && left.finalCenterX === right.finalCenterX
    && left.finalCenterY === right.finalCenterY
    && left.cardWidthPx === right.cardWidthPx
}

function projectionGeometryFromKey(
  key: ProjectionGeometryKey,
): OrbitProjectionGeometry {
  return {
    viewportWidth: key.viewportWidth,
    panelDocumentTop: key.panelDocumentTop,
    finalCenter: [key.finalCenterX, key.finalCenterY],
    cardWidthPx: key.cardWidthPx,
  }
}

function buildReferenceSamples(
  config: LineFieldAnimationConfig['motto'],
): readonly OrbitProjectionSample[] {
  const sampleCount = Math.max(1, Math.floor(finiteOrZero(config.projection.sampleCount)))
  return Object.freeze(Array.from(
    { length: sampleCount + 1 },
    (_, index): OrbitProjectionSample => {
      const motion = evaluateOrbitMotion(index / sampleCount, config)
      return Object.freeze({
        progress: motion.progress,
        referenceCenter: Object.freeze(orbitFrontView(motion.cardCenter)),
        scale: motion.scale,
        blurPx: blurPixels(motion.blurNorm, config),
      })
    },
  ))
}

function configPreparation(
  config: LineFieldAnimationConfig['motto'],
): MottoOrbitConfigPreparation {
  const cached = preparationByConfig.get(config)
  if (cached) return cached

  const prepared: MottoOrbitConfigPreparation = {
    referenceSamples: buildReferenceSamples(config),
    lastGeometryKey: null,
    lastProjection: null,
  }
  preparationByConfig.set(config, prepared)
  return prepared
}

export function prepareMottoOrbitProjection(
  geometry: LineFieldViewportGeometry,
  config: LineFieldAnimationConfig['motto'],
): PreparedMottoOrbitProjection {
  const preparation = configPreparation(config)
  const geometryKey = projectionGeometryKey(geometry)

  if (
    preparation.lastGeometryKey !== null
    && preparation.lastProjection !== null
    && sameProjectionGeometry(preparation.lastGeometryKey, geometryKey)
  ) {
    return preparation.lastProjection
  }

  const fit = Object.freeze(fitResponsiveOrbitProjection(
    preparation.referenceSamples,
    projectionGeometryFromKey(geometryKey),
    config.projection,
  ))
  const projection = Object.freeze({
    referenceSamples: preparation.referenceSamples,
    fit,
  })
  preparation.lastGeometryKey = geometryKey
  preparation.lastProjection = projection
  return projection
}

function endpointProjectionStatus(
  geometry: LineFieldViewportGeometry,
  config: LineFieldAnimationConfig['motto'],
): OrbitProjectionStatus {
  const startMotion = evaluateOrbitMotion(0, config)
  const finalMotion = evaluateOrbitMotion(1, config)
  const endpointSamples: readonly OrbitProjectionSample[] = [
    {
      progress: startMotion.progress,
      referenceCenter: orbitFrontView(startMotion.cardCenter),
      scale: startMotion.scale,
      blurPx: blurPixels(startMotion.blurNorm, config),
    },
    {
      progress: finalMotion.progress,
      referenceCenter: orbitFrontView(finalMotion.cardCenter),
      scale: finalMotion.scale,
      blurPx: blurPixels(finalMotion.blurNorm, config),
    },
  ]
  return fitResponsiveOrbitProjection(
    endpointSamples,
    projectionGeometryFromKey(projectionGeometryKey(geometry)),
    config.projection,
  ).status
}

export function evaluateMottoOrbit(
  progress: number,
  geometry: LineFieldViewportGeometry,
  config: LineFieldAnimationConfig['motto'],
): MottoOrbitFrame {
  const p = clamp01(progress)

  if (p === 1) {
    return {
      translateXPx: 0,
      translateYPx: 0,
      scale: 1,
      blurPx: 0,
      opacity: 1,
      projectionStatus: endpointProjectionStatus(geometry, config),
    }
  }

  const prepared = prepareMottoOrbitProjection(geometry, config)
  const finalCenter: readonly [number, number] = [
    geometry.mottoCardFinalCenterX,
    (geometry.mottoCardFinalTop + geometry.mottoCardFinalBottom) / 2,
  ]
  const motion = evaluateOrbitMotion(p, config)
  const projectedCenter = prepared.fit.project(orbitFrontView(motion.cardCenter))

  return {
    translateXPx: normalizeZero(projectedCenter[0] - finalCenter[0]),
    translateYPx: normalizeZero(projectedCenter[1] - finalCenter[1]),
    scale: normalizeZero(motion.scale),
    blurPx: blurPixels(motion.blurNorm, config),
    opacity: normalizeZero(motion.opacity),
    projectionStatus: prepared.fit.status,
  }
}

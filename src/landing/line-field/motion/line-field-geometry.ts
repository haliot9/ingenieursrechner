import type { LineFieldAnimationConfig } from '../config/line-field-config.types'

export interface LineFieldViewportGeometry {
  readonly scrollY: number
  readonly viewportWidth: number
  readonly viewportHeight: number
  readonly pageHeight: number
  readonly filmTop: number
  readonly filmHeight: number
  readonly anchorViewport: readonly [number, number]
  readonly headerTargetViewportY: number
  readonly mottoTop: number
  readonly mottoHeight: number
  readonly mottoCardFinalCenterX: number
  readonly mottoCardFinalWidth: number
  readonly mottoCardFinalHeight: number
  readonly mottoCardFinalTop: number
  readonly mottoCardFinalBottom: number
}

export interface LineFieldScrollMetrics {
  readonly scrollY: number
  readonly filmScrollRange: number
  readonly filmProgress: number
  readonly preloadScrollY: number
  readonly seedScrollY: number
  readonly orbitStartScrollY: number
  readonly orbitEndScrollY: number
  readonly buildEndScrollY: number
  readonly originDocumentY: number
  readonly handoffDocumentY: number
  readonly mottoProgress: number
}

const finiteOrZero = (value: number) => Number.isFinite(value) ? value : 0

const clamp01 = (value: number) => Math.min(1, Math.max(0, finiteOrZero(value)))

function hasValidMeasurements(geometry: LineFieldViewportGeometry): boolean {
  return geometry.viewportWidth > 0
    && Number.isFinite(geometry.viewportWidth)
    && geometry.viewportHeight > 0
    && Number.isFinite(geometry.viewportHeight)
    && geometry.pageHeight >= 0
    && Number.isFinite(geometry.pageHeight)
    && geometry.filmHeight >= 0
    && Number.isFinite(geometry.filmTop)
    && Number.isFinite(geometry.filmHeight)
    && geometry.mottoHeight >= 0
    && Number.isFinite(geometry.mottoTop)
    && Number.isFinite(geometry.mottoHeight)
    && Number.isFinite(geometry.mottoCardFinalCenterX)
    && geometry.mottoCardFinalWidth >= 0
    && Number.isFinite(geometry.mottoCardFinalWidth)
    && geometry.mottoCardFinalHeight >= 0
    && Number.isFinite(geometry.mottoCardFinalHeight)
    && Number.isFinite(geometry.anchorViewport[0])
    && Number.isFinite(geometry.anchorViewport[1])
    && Number.isFinite(geometry.headerTargetViewportY)
    && Number.isFinite(geometry.mottoCardFinalTop)
    && Number.isFinite(geometry.mottoCardFinalBottom)
    && geometry.mottoCardFinalTop <= geometry.mottoCardFinalBottom
}

export function resolveHeaderTargetViewportY(
  headerBottomViewportY: number,
  headerGapPx: number,
): number {
  return finiteOrZero(finiteOrZero(headerBottomViewportY) + finiteOrZero(headerGapPx))
}

export function deriveLineFieldScrollMetrics(
  geometry: LineFieldViewportGeometry,
  config: LineFieldAnimationConfig,
): LineFieldScrollMetrics | null {
  if (!hasValidMeasurements(geometry)) {
    return null
  }

  const maximumScrollY = Math.max(0, geometry.pageHeight - geometry.viewportHeight)
  const scrollY = Math.min(maximumScrollY, Math.max(0, finiteOrZero(geometry.scrollY)))
  const filmScrollRange = Math.max(1, geometry.filmHeight - geometry.viewportHeight)
  const filmProgress = clamp01((scrollY - geometry.filmTop) / filmScrollRange)
  const preloadScrollY = geometry.filmTop
    + config.reveal.preloadFilmProgress * filmScrollRange
  const seedScrollY = geometry.filmTop
    + config.reveal.startFilmProgress * filmScrollRange
  const originDocumentY = scrollY + geometry.anchorViewport[1]
  const handoffDocumentY = geometry.mottoCardFinalBottom
    + config.handoff.triggerPastMottoVh * geometry.viewportHeight / 100
  const orbitStartScrollY = geometry.mottoTop - geometry.viewportHeight
  const orbitEndScrollY = orbitStartScrollY
    + config.motto.travelViewportHeights * geometry.viewportHeight
  const buildEndScrollY = orbitEndScrollY
    + config.handoff.triggerPastMottoVh * geometry.viewportHeight / 100
  const mottoProgress = clamp01(
    (scrollY - orbitStartScrollY) / Math.max(1, orbitEndScrollY - orbitStartScrollY),
  )

  const values = [
    scrollY,
    filmScrollRange,
    filmProgress,
    preloadScrollY,
    seedScrollY,
    orbitStartScrollY,
    orbitEndScrollY,
    buildEndScrollY,
    originDocumentY,
    handoffDocumentY,
    mottoProgress,
  ]

  if (!values.every(Number.isFinite)) {
    return null
  }

  return {
    scrollY,
    filmScrollRange,
    filmProgress,
    preloadScrollY,
    seedScrollY,
    orbitStartScrollY,
    orbitEndScrollY,
    buildEndScrollY,
    originDocumentY,
    handoffDocumentY,
    mottoProgress,
  }
}

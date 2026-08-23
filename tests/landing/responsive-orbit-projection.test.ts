import { describe, expect, it } from 'vitest'
import { lineFieldConfig } from '../../src/landing/line-field/config/line-field-config.generated'
import { evaluateOrbitMotion, orbitFrontView } from '../../src/landing/line-field/motion/orbit-motion'
import {
  fitResponsiveOrbitProjection,
  type OrbitProjectionFit,
  type OrbitProjectionGeometry,
  type OrbitProjectionSample,
} from '../../src/landing/line-field/motion/responsive-orbit-projection'

const CANONICAL_LAYOUTS: readonly OrbitProjectionGeometry[] = [
  {
    viewportWidth: 1440,
    panelDocumentTop: 2800,
    finalCenter: [1052.8, 3304],
    cardWidthPx: 544,
  },
  {
    viewportWidth: 723,
    panelDocumentTop: 2800,
    finalCenter: [393.16, 3269.84],
    cardWidthPx: 544,
  },
  {
    viewportWidth: 390,
    panelDocumentTop: 2800,
    finalCenter: [211, 3272.64],
    cardWidthPx: 326,
  },
]

function canonicalSamples(): readonly OrbitProjectionSample[] {
  const { sampleCount } = lineFieldConfig.motto.projection
  return Array.from({ length: sampleCount + 1 }, (_, index) => {
    const motion = evaluateOrbitMotion(index / sampleCount, lineFieldConfig.motto)
    return {
      progress: motion.progress,
      referenceCenter: orbitFrontView(motion.cardCenter),
      scale: motion.scale,
      blurPx: motion.blurNorm * lineFieldConfig.motto.depthCues.blurMaximumPx,
    }
  })
}

function minimumVisibleLeft(
  samples: readonly OrbitProjectionSample[],
  fit: OrbitProjectionFit,
  cardWidthPx: number,
): number {
  return Math.min(...samples.map((sample) => {
    const center = fit.project(sample.referenceCenter)
    return center[0]
      - 0.5 * cardWidthPx * sample.scale
      - lineFieldConfig.motto.projection.blurSafetyMultiplier * sample.blurPx
  }))
}

describe('responsive motto orbit projection', () => {
  it.each(CANONICAL_LAYOUTS)(
    'preserves endpoints and the configured gutter at viewport $viewportWidth',
    (geometry) => {
      const samples = canonicalSamples()
      const fit = fitResponsiveOrbitProjection(
        samples,
        geometry,
        lineFieldConfig.motto.projection,
      )
      const gutter = Math.max(
        lineFieldConfig.motto.projection.minimumLeftGutterPx,
        lineFieldConfig.motto.projection.minimumLeftGutterVw * geometry.viewportWidth / 100,
      )

      expect(samples).toHaveLength(97)
      expect(fit.project(samples[0].referenceCenter)).toEqual([
        0.7 * geometry.viewportWidth,
        geometry.panelDocumentTop,
      ])
      expect(fit.project(samples.at(-1)!.referenceCenter)).toEqual(geometry.finalCenter)
      expect(minimumVisibleLeft(samples, fit, geometry.cardWidthPx)).toBeGreaterThanOrEqual(
        gutter - 1e-7,
      )
      expect(fit.bulgeFactor).toBeGreaterThanOrEqual(0)
      expect(fit.bulgeFactor).toBeLessThanOrEqual(1)
      expect(['ok', 'gutter-constrained']).toContain(fit.status)
    },
  )

  it('chooses the feasible bulge closest to one across lower and upper constraints', () => {
    const samples: readonly OrbitProjectionSample[] = [
      { progress: 0, referenceCenter: [0, 0], scale: 1, blurPx: 0 },
      { progress: 0.25, referenceCenter: [0.5, 1], scale: 1, blurPx: 0 },
      { progress: 0.75, referenceCenter: [0.5, -1], scale: 6, blurPx: 0 },
      { progress: 1, referenceCenter: [1, 0], scale: 1, blurPx: 0 },
    ]
    const geometry: OrbitProjectionGeometry = {
      viewportWidth: 100,
      panelDocumentTop: 0,
      finalCenter: [70, 100],
      cardWidthPx: 20,
    }
    const projection = {
      ...lineFieldConfig.motto.projection,
      preferredBulge: 1,
    }
    const fit = fitResponsiveOrbitProjection(
      samples,
      geometry,
      projection,
    )

    expect(fit.status).toBe('gutter-constrained')
    expect(fit.bulgeFactor).toBeCloseTo(0.44, 12)
    expect(minimumVisibleLeft(samples, fit, geometry.cardWidthPx)).toBeCloseTo(16, 12)
  })

  it('preserves the zero-bulge chord when a zero coefficient cannot satisfy the gutter', () => {
    const samples: readonly OrbitProjectionSample[] = [
      { progress: 0, referenceCenter: [0, 0], scale: 1, blurPx: 0 },
      { progress: 0.5, referenceCenter: [0.5, 0], scale: 6, blurPx: 0 },
      { progress: 1, referenceCenter: [1, 0], scale: 1, blurPx: 0 },
    ]
    const geometry: OrbitProjectionGeometry = {
      viewportWidth: 100,
      panelDocumentTop: 0,
      finalCenter: [70, 100],
      cardWidthPx: 20,
    }
    const projection = {
      ...lineFieldConfig.motto.projection,
      preferredBulge: 1,
    }
    const fit = fitResponsiveOrbitProjection(samples, geometry, projection)

    expect(fit.status).toBe('gutter-infeasible')
    expect(fit.bulgeFactor).toBe(0)
    expect(fit.project(samples[0].referenceCenter)).toEqual([70, 0])
    expect(fit.project(samples[1].referenceCenter)).toEqual([70, 50])
    expect(fit.project(samples.at(-1)!.referenceCenter)).toEqual(geometry.finalCenter)
    expect(minimumVisibleLeft(samples, fit, geometry.cardWidthPx)).toBe(10)
  })

  it('preserves the zero-bulge chord when lower and upper bulge bounds do not overlap', () => {
    const samples: readonly OrbitProjectionSample[] = [
      { progress: 0, referenceCenter: [0, 0], scale: 1, blurPx: 0 },
      { progress: 0.25, referenceCenter: [0.25, 1], scale: 3.4, blurPx: 0 },
      { progress: 0.75, referenceCenter: [0.75, -1], scale: 13.4, blurPx: 0 },
      { progress: 1, referenceCenter: [1, 0], scale: 1, blurPx: 0 },
    ]
    const geometry: OrbitProjectionGeometry = {
      viewportWidth: 100,
      panelDocumentTop: 0,
      finalCenter: [70, 100],
      cardWidthPx: 20,
    }
    const projection = {
      ...lineFieldConfig.motto.projection,
      preferredBulge: 1,
    }
    const fit = fitResponsiveOrbitProjection(samples, geometry, projection)

    expect(fit.status).toBe('gutter-infeasible')
    expect(fit.bulgeFactor).toBe(0)
    expect(fit.project(samples[0].referenceCenter)).toEqual([70, 0])
    expect(fit.project(samples[1].referenceCenter)).toEqual([70, 25])
    expect(fit.project(samples[2].referenceCenter)).toEqual([70, 75])
    expect(fit.project(samples.at(-1)!.referenceCenter)).toEqual(geometry.finalCenter)
    expect(minimumVisibleLeft(samples, fit, geometry.cardWidthPx)).toBe(-64)
  })

  it('preserves a final endpoint that already violates the gutter', () => {
    const samples: readonly OrbitProjectionSample[] = [
      { progress: 0, referenceCenter: [0, 0], scale: 1, blurPx: 0 },
      { progress: 0.5, referenceCenter: [0.5, 0.5], scale: 1, blurPx: 0 },
      { progress: 1, referenceCenter: [1, 0], scale: 1, blurPx: 0 },
    ]
    const geometry: OrbitProjectionGeometry = {
      viewportWidth: 100,
      panelDocumentTop: 0,
      finalCenter: [10, 100],
      cardWidthPx: 20,
    }
    const fit = fitResponsiveOrbitProjection(
      samples,
      geometry,
      lineFieldConfig.motto.projection,
    )

    expect(fit.status).toBe('endpoint-gutter-violation')
    expect(fit.project(samples.at(-1)!.referenceCenter)).toEqual(geometry.finalCenter)
  })

  it('keeps exact-gutter endpoints out of affine ULP reconstruction', () => {
    const samples: readonly OrbitProjectionSample[] = [
      { progress: 0, referenceCenter: [0, 0], scale: 1, blurPx: 0 },
      { progress: 0.5, referenceCenter: [0.5, 0], scale: 1, blurPx: 0 },
      { progress: 1, referenceCenter: [1, 0], scale: 1, blurPx: 0 },
    ]
    const geometry: OrbitProjectionGeometry = {
      viewportWidth: 100,
      panelDocumentTop: 0,
      finalCenter: [16.1, 100],
      cardWidthPx: 0,
    }
    const projection = {
      ...lineFieldConfig.motto.projection,
      startCenterXViewportRatio: 1,
      minimumLeftGutterPx: 16.1,
      minimumLeftGutterVw: 0,
    }
    const fit = fitResponsiveOrbitProjection(samples, geometry, projection)

    expect(fit.status).toBe('ok')
    expect(fit.bulgeFactor).toBe(1)
    expect(fit.project(samples[0].referenceCenter)).toEqual([100, 0])
    expect(fit.project(samples.at(-1)!.referenceCenter)).toEqual(geometry.finalCenter)
  })

  it('falls back to the final center when the reference chord collapses', () => {
    const samples: readonly OrbitProjectionSample[] = [
      { progress: 0, referenceCenter: [4, 4], scale: 1, blurPx: 0 },
      { progress: 0.5, referenceCenter: [4, 4], scale: 1, blurPx: 0 },
      { progress: 1, referenceCenter: [4, 4], scale: 1, blurPx: 0 },
    ]
    const geometry: OrbitProjectionGeometry = {
      viewportWidth: 100,
      panelDocumentTop: 0,
      finalCenter: [70, 100],
      cardWidthPx: 20,
    }
    const fit = fitResponsiveOrbitProjection(
      samples,
      geometry,
      lineFieldConfig.motto.projection,
    )

    expect(fit.status).toBe('degenerate')
    expect(fit.bulgeFactor).toBe(0)
    expect(fit.project([4, 4])).toEqual(geometry.finalCenter)
  })

  it('returns a finite degenerate projector for non-finite sample input', () => {
    const samples: readonly OrbitProjectionSample[] = [
      { progress: 0, referenceCenter: [0, 0], scale: 1, blurPx: 0 },
      { progress: 0.5, referenceCenter: [Number.NaN, 1], scale: 1, blurPx: 0 },
      { progress: 1, referenceCenter: [1, 0], scale: 1, blurPx: 0 },
    ]
    const geometry: OrbitProjectionGeometry = {
      viewportWidth: 100,
      panelDocumentTop: 0,
      finalCenter: [70, 100],
      cardWidthPx: 20,
    }
    const fit = fitResponsiveOrbitProjection(
      samples,
      geometry,
      lineFieldConfig.motto.projection,
    )
    const projected = fit.project([Number.NaN, Number.POSITIVE_INFINITY])

    expect(fit.status).toBe('degenerate')
    expect(fit.bulgeFactor).toBe(0)
    expect(projected).toEqual(geometry.finalCenter)
    expect(projected.every(Number.isFinite)).toBe(true)
  })

  it('returns a finite degenerate fit when the derived viewport gutter overflows', () => {
    const samples: readonly OrbitProjectionSample[] = [
      { progress: 0, referenceCenter: [0, 0], scale: 0, blurPx: 0 },
      { progress: 0.5, referenceCenter: [0.5, 0.5], scale: 0, blurPx: 0 },
      { progress: 1, referenceCenter: [1, 0], scale: 0, blurPx: 0 },
    ]
    const geometry: OrbitProjectionGeometry = {
      viewportWidth: Number.MAX_VALUE,
      panelDocumentTop: 0,
      finalCenter: [1, 1],
      cardWidthPx: 0,
    }
    const projection = {
      ...lineFieldConfig.motto.projection,
      startCenterXViewportRatio: 0,
      minimumLeftGutterPx: 0,
      minimumLeftGutterVw: 10,
    }
    const fit = fitResponsiveOrbitProjection(samples, geometry, projection)
    const projected = fit.project([0, 0])

    expect(fit.status).toBe('degenerate')
    expect(fit.bulgeFactor).toBe(0)
    expect(projected).toEqual(geometry.finalCenter)
    expect(projected.every(Number.isFinite)).toBe(true)
  })

  it('returns a finite degenerate fit when an endpoint extent overflows', () => {
    const samples: readonly OrbitProjectionSample[] = [
      { progress: 0, referenceCenter: [0, 0], scale: 0, blurPx: 0 },
      { progress: 0.5, referenceCenter: [0.5, 0.5], scale: 0, blurPx: 0 },
      { progress: 1, referenceCenter: [1, 0], scale: 4, blurPx: 0 },
    ]
    const geometry: OrbitProjectionGeometry = {
      viewportWidth: 100,
      panelDocumentTop: 0,
      finalCenter: [70, 100],
      cardWidthPx: Number.MAX_VALUE,
    }
    const projection = {
      ...lineFieldConfig.motto.projection,
      minimumLeftGutterPx: 0,
      minimumLeftGutterVw: 0,
    }
    const fit = fitResponsiveOrbitProjection(samples, geometry, projection)
    const projected = fit.project([0.5, 0.5])

    expect(fit.status).toBe('degenerate')
    expect(fit.bulgeFactor).toBe(0)
    expect(projected).toEqual(geometry.finalCenter)
    expect(projected.every(Number.isFinite)).toBe(true)
  })
})

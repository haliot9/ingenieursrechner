// GENERATED FILE - DO NOT EDIT.
// Edit src/landing/line-field/config/line-field.animation.yaml or line-field.materials.yaml and run `npm run line-field:config`.

import type { LineFieldAnimationConfig } from './line-field-config.types'

export const lineFieldAuthoringMetadata = {
  animationVersion: 1,
  materialsVersion: 1,
} as const

export const lineFieldConfig = {
  geometry: {
    staggeredTipCount: 36,
    spineWidthPx: 1.8,
    lineWidthPx: 0.75,
    headerGapPx: 0,
  },
  wave: {
    scrollPhaseCycles: 2.4,
    autonomousCyclesPerSecond: 0.65,
  },
  reveal: {
    preloadFilmProgress: 0.72,
    startFilmProgress: 0.8,
  },
  fronts: {
    seed: 3817,
    maximumTipGapVh: 3,
    staggerStrength: 0.75,
    catchupRatePerSecond: 7,
    autonomousVelocityViewportPerSecond: 0.72,
    autonomousAccelerationViewportPerSecondSquared: 1.2,
  },
  handoff: {
    triggerPastMottoVh: 8,
    velocityBlendSeconds: 0.45,
    reverseDeadbandPx: 2,
  },
  pointer: {
    radiusVw: 18,
    smoothingSeconds: 0.16,
  },
  motto: {
    travelViewportHeights: 1,
    cardMaxWidthRem: 34,
    finalRightInsetVw: 8,
    mobileFinalLeftInsetRem: 3,
    mobileFinalRightInsetRem: 1,
    finalCenterViewportY: 0.56,
    orbit: {
      thetaXDegrees: 30,
      thetaYDegrees: 10,
      phiStartDegrees: 80,
      phiPeakDegrees: 180,
      phiEndDegrees: 290,
      originDriftRadiusRatio: 0.16,
      localOffsetRadiusRatio: 0.25,
    },
    projection: {
      startCenterXViewportRatio: 0.7,
      preferredBulge: 0.08,
      minimumLeftGutterPx: 16,
      minimumLeftGutterVw: 2,
      blurSafetyMultiplier: 2,
      sampleCount: 96,
    },
    depthCues: {
      scaleStart: 0.22,
      scaleAtPhiPeak: 0.5,
      scaleEnd: 1,
      blurStart: 1,
      blurAtPhiPeak: 0.5,
      blurEnd: 0,
      blurMaximumPx: 8,
    },
    visibility: {
      phiStartDegrees: 80,
      phiEndDegrees: 120,
      opacityStart: 0,
      opacityEnd: 1,
    },
  },
  performance: {
    maximumDpr: 1.5,
    maximumRenderDimensionPx: 1600,
  },
  theme: {
    tailOpacityAtTip: 0.1,
    dark: {
      body: {
        startColor: [0.913725, 0.270588, 0.960784],
        middleColor: [0.435294, 0.435294, 0.435294],
        endColor: [0.415686, 0.415686, 0.415686],
        coreOpacity: 0.82,
        emissionOpacity: 0.24,
        emissionRadiusPx: 8.5,
        freshTrailLengthPx: 90,
      },
      linePrimary: [1, 0.972549, 1],
      lineSecondary: [1, 0.301961, 0.721569],
      lineAccent: [0.470588, 0.94902, 1],
      baseOpacity: 0.76,
      lineGlow: {
        radiusPx: 5.5,
        opacity: 0.26,
      },
      tipGlow: {
        diameterToLineWidth: 1.75,
        tailLengthToDiameter: 4,
        haloDiameterToHead: 2.5,
        opacity: 0.88,
        freshTrailLengthPx: 90,
        pinkMix: 0.7,
        cyanMix: 0.16,
        pulseHz: 0.82,
        pulseDepth: 0.72,
        secondaryPulseRatio: 1.37,
      },
    },
    light: {
      body: {
        wetBlueBlack: [0.039216, 0.172549, 0.364706],
        settledBlue: [0.086275, 0.270588, 0.505882],
        agedSepia: [0.52549, 0.380392, 0.235294],
        fadedWarmSepia: [0.74902, 0.619608, 0.435294],
        coreOpacity: 0.62,
        freshTrailLengthPx: 52.5,
        fiberScalePx: 5,
        fiberStrength: 0.28,
        sheenOpacity: 0.12,
        absorptionRadiusPx: 11,
        absorptionOpacity: 0.1,
      },
      linePrimary: [0.231373, 0.168627, 0.12549],
      lineSecondary: [0.545098, 0.403922, 0.282353],
      paperFiber: [0.847059, 0.745098, 0.603922],
      baseOpacity: 0.44,
      tipInk: {
        wetColor: [0.043137, 0.176471, 0.356863],
        diameterToLineWidth: 1.75,
        tailLengthToDiameter: 3,
        bleedDiameterToHead: 1.6,
        lineBleedRadiusPx: 7.5,
        freshTrailLengthPx: 52.5,
        irregularity: 0.28,
        absorptionOpacity: 0.22,
        specularOpacity: 0.84,
      },
    },
  },
} as const satisfies LineFieldAnimationConfig

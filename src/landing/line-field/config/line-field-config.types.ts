export type LineFieldRgb = readonly [number, number, number]

export interface LineFieldThemeConfig {
  readonly tailOpacityAtTip: number
  readonly dark: { readonly body: { readonly startColor: LineFieldRgb; readonly middleColor: LineFieldRgb; readonly endColor: LineFieldRgb; readonly coreOpacity: number; readonly emissionOpacity: number; readonly emissionRadiusPx: number; readonly freshTrailLengthPx: number }; readonly linePrimary: LineFieldRgb; readonly lineSecondary: LineFieldRgb; readonly lineAccent: LineFieldRgb; readonly baseOpacity: number; readonly lineGlow: { readonly radiusPx: number; readonly opacity: number }; readonly tipGlow: { readonly diameterToLineWidth: number; readonly tailLengthToDiameter: number; readonly haloDiameterToHead: number; readonly opacity: number; readonly freshTrailLengthPx: number; readonly pinkMix: number; readonly cyanMix: number; readonly pulseHz: number; readonly pulseDepth: number; readonly secondaryPulseRatio: number } }
  readonly light: { readonly body: { readonly wetBlueBlack: LineFieldRgb; readonly settledBlue: LineFieldRgb; readonly agedSepia: LineFieldRgb; readonly fadedWarmSepia: LineFieldRgb; readonly coreOpacity: number; readonly freshTrailLengthPx: number; readonly fiberScalePx: number; readonly fiberStrength: number; readonly sheenOpacity: number; readonly absorptionRadiusPx: number; readonly absorptionOpacity: number }; readonly linePrimary: LineFieldRgb; readonly lineSecondary: LineFieldRgb; readonly paperFiber: LineFieldRgb; readonly baseOpacity: number; readonly tipInk: { readonly wetColor: LineFieldRgb; readonly diameterToLineWidth: number; readonly tailLengthToDiameter: number; readonly bleedDiameterToHead: number; readonly lineBleedRadiusPx: number; readonly freshTrailLengthPx: number; readonly irregularity: number; readonly absorptionOpacity: number; readonly specularOpacity: number } }
}

export interface MottoOrbitConfig {
  readonly thetaXDegrees: number
  readonly thetaYDegrees: number
  readonly phiStartDegrees: number
  readonly phiPeakDegrees: number
  readonly phiEndDegrees: number
  readonly originDriftRadiusRatio: number
  readonly localOffsetRadiusRatio: number
}

export interface MottoProjectionConfig {
  readonly startCenterXViewportRatio: number
  readonly preferredBulge: number
  readonly minimumLeftGutterPx: number
  readonly minimumLeftGutterVw: number
  readonly blurSafetyMultiplier: number
  readonly sampleCount: number
}

export interface MottoDepthCuesConfig {
  readonly scaleStart: number
  readonly scaleAtPhiPeak: number
  readonly scaleEnd: number
  readonly blurStart: number
  readonly blurAtPhiPeak: number
  readonly blurEnd: number
  readonly blurMaximumPx: number
}

export interface MottoVisibilityConfig {
  readonly phiStartDegrees: number
  readonly phiEndDegrees: number
  readonly opacityStart: number
  readonly opacityEnd: number
}

export interface LineFieldAnimationConfig {
  readonly geometry: { readonly staggeredTipCount: number; readonly spineWidthPx: number; readonly lineWidthPx: number; readonly headerGapPx: number }
  readonly wave: { readonly scrollPhaseCycles: number; readonly autonomousCyclesPerSecond: number }
  readonly reveal: { readonly preloadFilmProgress: number; readonly startFilmProgress: number }
  readonly fronts: { readonly seed: number; readonly maximumTipGapVh: number; readonly staggerStrength: number; readonly catchupRatePerSecond: number; readonly autonomousVelocityViewportPerSecond: number; readonly autonomousAccelerationViewportPerSecondSquared: number }
  readonly handoff: { readonly triggerPastMottoVh: number; readonly velocityBlendSeconds: number; readonly reverseDeadbandPx: number }
  readonly pointer: { readonly radiusVw: number; readonly smoothingSeconds: number }
  readonly motto: { readonly travelViewportHeights: number; readonly cardMaxWidthRem: number; readonly finalRightInsetVw: number; readonly mobileFinalLeftInsetRem: number; readonly mobileFinalRightInsetRem: number; readonly finalCenterViewportY: number; readonly orbit: MottoOrbitConfig; readonly projection: MottoProjectionConfig; readonly depthCues: MottoDepthCuesConfig; readonly visibility: MottoVisibilityConfig }
  readonly theme: LineFieldThemeConfig
  readonly performance: { readonly maximumDpr: number; readonly maximumRenderDimensionPx: number }
}

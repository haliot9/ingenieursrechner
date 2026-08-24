export interface LandingBackgroundDarkConfig {
  readonly seed: number
  readonly count: number
  readonly spread: number
  readonly speed: number
  readonly baseSize: number
  readonly opacity: number
  readonly glowStrength: number
  readonly hoverFactor: number
  readonly rotationSpeed: number
  readonly maximumDpr: number
}

export interface LandingBackgroundLightConfig {
  readonly layerPlacement: 'below-wavefield' | 'above-wavefield'
  readonly centerXRatio: number
  readonly widthRatio: number
  readonly heightRatio: number
  readonly borderRadiusPx: number
  readonly borderWidthRatio: number
  readonly brightness: number
  readonly surfaceOpacity: number
  readonly edgeBlurPx: number
  readonly displacementBlurPx: number
  readonly backgroundOpacity: number
  readonly saturation: number
  readonly distortionScale: number
  readonly redOffset: number
  readonly greenOffset: number
  readonly blueOffset: number
}

export interface LandingBackgroundConfig {
  readonly dark: LandingBackgroundDarkConfig
  readonly light: LandingBackgroundLightConfig
}

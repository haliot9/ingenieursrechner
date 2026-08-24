// GENERATED FILE - DO NOT EDIT.
// Edit src/landing/background/config/landing-background.effects.yaml and run `npm run landing-background:config`.

import type { LandingBackgroundConfig } from './landing-background-config.types'

export const landingBackgroundConfig = {
  "dark": {
    "seed": 7241,
    "count": 200,
    "spread": 10,
    "speed": 0.12,
    "baseSize": 125,
    "opacity": 0.78,
    "glowStrength": 0.72,
    "hoverFactor": 1,
    "rotationSpeed": 0.03,
    "maximumDpr": 1.5
  },
  "light": {
    "layerPlacement": "above-wavefield",
    "centerXRatio": 0.55,
    "widthRatio": 0.4,
    "heightRatio": 0.8,
    "borderRadiusPx": 28,
    "borderWidthRatio": 0.07,
    "brightness": 50,
    "surfaceOpacity": 0.93,
    "edgeBlurPx": 11,
    "displacementBlurPx": 0,
    "backgroundOpacity": 0.08,
    "saturation": 1,
    "distortionScale": -180,
    "redOffset": 0,
    "greenOffset": 10,
    "blueOffset": 20
  }
} as const satisfies LandingBackgroundConfig

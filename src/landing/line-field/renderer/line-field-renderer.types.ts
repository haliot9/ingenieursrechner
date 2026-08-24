import type {
  LineFieldAnimationConfig,
  LineFieldRgb,
} from '../config/line-field-config.types'
import type { LineFieldRenderFrame } from '../motion/line-field-state-machine'

/**
 * The complete public boundary between scroll motion and the accepted visual.
 *
 * The fixed 40-thread field owns its geometry. The motion controller contributes
 * the spatial reveal plane, source clock, and one scalar visibility channel;
 * lane shaping and theme-specific effects stay outside this boundary.
 */
export interface LineFieldRendererUniformPacket {
  readonly cssSizePx: readonly [number, number]
  readonly effectiveDpr: number
  readonly sourceOriginLocalPx: readonly [number, number]
  readonly physicalOriginLocalPx: readonly [number, number]
  readonly physicalFrontLocalY: number
  readonly endpointLocalYs: readonly number[]
  readonly sourceTimeSeconds: number
  readonly sourceLengthPx: number
  readonly sourceLateralScalePx: number
  readonly endpointCenterlines: readonly number[]
  readonly endpointTangentXs: readonly number[]
  readonly endpointTangentYs: readonly number[]
  readonly endpointCurvatures: readonly number[]
  readonly motionOpacity: number
  readonly themeMode: 0 | 1
  readonly bodyColor0: LineFieldRgb
  readonly bodyColor1: LineFieldRgb
  readonly bodyColor2: LineFieldRgb
  readonly bodyColor3: LineFieldRgb
  readonly bodyCoreOpacity: number
  readonly bodyEffectOpacity: number
  readonly bodyEffectRadiusPx: number
  readonly bodyFreshTrailLengthPx: number
  readonly bodyFiberScalePx: number
  readonly bodyFiberStrength: number
  readonly bodySheenOpacity: number
  readonly linePrimary: LineFieldRgb
  readonly lineSecondary: LineFieldRgb
  readonly lineAccentOrFiber: LineFieldRgb
  readonly wetInkColor: LineFieldRgb
  readonly baseOpacity: number
  readonly lineGlowOpacity: number
  readonly lineEffectRadiusPx: number
  readonly tipDiameterToLineWidth: number
  readonly tipTailLengthToDiameter: number
  readonly tipEffectDiameterToHead: number
  readonly tipTailOpacityAtTip: number
  readonly tipGlowOpacity: number
  readonly tipSpecularOpacity: number
  readonly freshTrailLengthPx: number
  readonly pinkMix: number
  readonly cyanMix: number
  readonly pulseHz: number
  readonly pulseDepth: number
  readonly secondaryPulseRatio: number
  readonly inkIrregularity: number
  readonly absorptionOpacity: number
}

export interface LandingLineRenderer {
  resize(
    cssWidth: number,
    cssHeight: number,
    deviceDpr: number,
    limits: LineFieldAnimationConfig['performance'],
  ): void
  render(frame: LineFieldRenderFrame, config: LineFieldAnimationConfig): void
  dispose(): void
}

export interface LandingLineRendererOptions {
  readonly onContextLost: () => void
}

export type LandingLineRendererLoader = () => Promise<{
  createLandingLineRenderer(
    container: HTMLElement,
    options: LandingLineRendererOptions,
  ): LandingLineRenderer
}>

export interface LandingLineFallbackGeometry {
  readonly cssWidth: number
  readonly cssHeight: number
  readonly anchorLocalX: number
  readonly anchorViewportY: number
  readonly headerTargetViewportY: number
}

export interface LandingLineFallbackProps {
  readonly theme: 'light' | 'dark'
  readonly geometry?: LandingLineFallbackGeometry
}

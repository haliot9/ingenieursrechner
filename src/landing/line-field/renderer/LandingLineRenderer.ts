import { Mesh, Program, Renderer, Triangle } from 'ogl'
import type { LineFieldAnimationConfig } from '../config/line-field-config.types'
import {
  THREADS_LATERAL_TO_LENGTH_RATIO,
  THREADS_LINE_COUNT,
  THREADS_LINE_PARAMETERS,
  threadsCenterline,
} from '../math/wave-field'
import type { LineFieldRenderFrame } from '../motion/line-field-state-machine'
import {
  lineFieldFragmentShader,
  lineFieldVertexShader,
} from './line-field-shaders'
import type {
  LandingLineRenderer,
  LandingLineRendererOptions,
  LineFieldRendererUniformPacket,
} from './line-field-renderer.types'

const TAU = 2 * Math.PI

const packetKeys = [
  'cssSizePx',
  'effectiveDpr',
  'sourceOriginLocalPx',
  'physicalOriginLocalPx',
  'physicalFrontLocalY',
  'endpointLocalYs',
  'sourceTimeSeconds',
  'sourceLengthPx',
  'sourceLateralScalePx',
  'endpointCenterlines',
  'endpointTangentXs',
  'endpointTangentYs',
  'endpointCurvatures',
  'motionOpacity',
  'themeMode',
  'bodyColor0',
  'bodyColor1',
  'bodyColor2',
  'bodyColor3',
  'bodyCoreOpacity',
  'bodyEffectOpacity',
  'bodyEffectRadiusPx',
  'bodyFreshTrailLengthPx',
  'bodyFiberScalePx',
  'bodyFiberStrength',
  'bodySheenOpacity',
  'linePrimary',
  'lineSecondary',
  'lineAccentOrFiber',
  'wetInkColor',
  'baseOpacity',
  'lineGlowOpacity',
  'lineEffectRadiusPx',
  'tipDiameterToLineWidth',
  'tipTailLengthToDiameter',
  'tipEffectDiameterToHead',
  'tipTailOpacityAtTip',
  'tipGlowOpacity',
  'tipSpecularOpacity',
  'freshTrailLengthPx',
  'pinkMix',
  'cyanMix',
  'pulseHz',
  'pulseDepth',
  'secondaryPulseRatio',
  'inkIrregularity',
  'absorptionOpacity',
] as const satisfies readonly (keyof LineFieldRendererUniformPacket)[]

type Uniforms = Record<keyof LineFieldRendererUniformPacket, { value: unknown }>

interface CanvasSize {
  readonly width: number
  readonly height: number
  readonly effectiveDpr: number
}

const finiteOrZero = (value: number) => Number.isFinite(value) ? value : 0
const clamp01 = (value: number) => Math.min(1, Math.max(0, finiteOrZero(value)))

function createInitialPacket(): LineFieldRendererUniformPacket {
  return {
    cssSizePx: [1, 1],
    effectiveDpr: 1,
    sourceOriginLocalPx: [0, 0],
    physicalOriginLocalPx: [0, 0],
    physicalFrontLocalY: 0,
    endpointLocalYs: Array.from({ length: THREADS_LINE_COUNT }, () => 0),
    sourceTimeSeconds: 0,
    sourceLengthPx: 1,
    sourceLateralScalePx: 1,
    endpointCenterlines: Array.from({ length: THREADS_LINE_COUNT }, () => 0.5),
    endpointTangentXs: Array.from({ length: THREADS_LINE_COUNT }, () => 0),
    endpointTangentYs: Array.from({ length: THREADS_LINE_COUNT }, () => 1),
    endpointCurvatures: Array.from({ length: THREADS_LINE_COUNT }, () => 0),
    motionOpacity: 0,
    themeMode: 0,
    bodyColor0: [0, 0, 0],
    bodyColor1: [0, 0, 0],
    bodyColor2: [0, 0, 0],
    bodyColor3: [0, 0, 0],
    bodyCoreOpacity: 0,
    bodyEffectOpacity: 0,
    bodyEffectRadiusPx: 1,
    bodyFreshTrailLengthPx: 1,
    bodyFiberScalePx: 1,
    bodyFiberStrength: 0,
    bodySheenOpacity: 0,
    linePrimary: [1, 1, 1],
    lineSecondary: [1, 1, 1],
    lineAccentOrFiber: [1, 1, 1],
    wetInkColor: [0, 0, 0],
    baseOpacity: 1,
    lineGlowOpacity: 0,
    lineEffectRadiusPx: 0,
    tipDiameterToLineWidth: 1,
    tipTailLengthToDiameter: 1.25,
    tipEffectDiameterToHead: 1,
    tipTailOpacityAtTip: 0.1,
    tipGlowOpacity: 0,
    tipSpecularOpacity: 0,
    freshTrailLengthPx: 8,
    pinkMix: 0,
    cyanMix: 0,
    pulseHz: 0,
    pulseDepth: 0,
    secondaryPulseRatio: 1,
    inkIrregularity: 0,
    absorptionOpacity: 0,
  }
}

function uniformsFromPacket(packet: LineFieldRendererUniformPacket): Uniforms {
  return Object.fromEntries(
    packetKeys.map((key) => [key, { value: packet[key] }]),
  ) as Uniforms
}

function requestContextLoss(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  alreadyRequested: { value: boolean },
) {
  if (alreadyRequested.value) return
  alreadyRequested.value = true
  try {
    const extension = gl.getExtension('WEBGL_lose_context') as { loseContext(): void } | null
    extension?.loseContext()
  } catch {
    // Context loss is a best-effort browser cleanup; owned resources still release.
  }
}

function resolveCanvasSize(
  cssWidth: number,
  cssHeight: number,
  deviceDpr: number,
  limits: LineFieldAnimationConfig['performance'],
): CanvasSize {
  const width = Number.isFinite(cssWidth) && cssWidth > 0 ? cssWidth : 0
  const height = Number.isFinite(cssHeight) && cssHeight > 0 ? cssHeight : 0
  const validDeviceDpr = Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 1
  const dimensionDpr = limits.maximumRenderDimensionPx / Math.max(width, height)
  const effectiveDpr = Math.max(
    0.01,
    Math.min(validDeviceDpr, limits.maximumDpr, dimensionDpr),
  )

  return { width, height, effectiveDpr }
}

/** Translate the existing scroll clock into the pinned source clock. */
function sourceTimeSeconds(frame: LineFieldRenderFrame, config: LineFieldAnimationConfig) {
  const cyclesPerSecond = finiteOrZero(config.wave.autonomousCyclesPerSecond)
  if (cyclesPerSecond <= 0) return 0
  return finiteOrZero(frame.unwrappedPhase) / (TAU * cyclesPerSecond)
}

function packetForFrame(
  frame: LineFieldRenderFrame,
  config: LineFieldAnimationConfig,
  size: CanvasSize,
  endpointCenterlines: number[],
  endpointTangentXs: number[],
  endpointTangentYs: number[],
  endpointCurvatures: number[],
): LineFieldRendererUniformPacket {
  const sourceLengthPx = Math.max(1, size.height)
  // Accepted Blender side-view mapping: longitudinal 12 units, lateral 9.
  const sourceLateralScalePx = sourceLengthPx * THREADS_LATERAL_TO_LENGTH_RATIO
  const originLocalX = finiteOrZero(frame.anchorViewport[0])
  const physicalOriginLocalY = finiteOrZero(frame.anchorViewport[1])
  const scrollY = Number.isFinite(frame.originDocumentY)
    ? frame.originDocumentY - physicalOriginLocalY
    : 0
  const physicalFrontLocalY = Number.isFinite(frame.commonFrontDocumentY)
    ? frame.commonFrontDocumentY - scrollY
    : physicalOriginLocalY
  const sourceOriginLocalY = finiteOrZero(
    frame.sourceOriginViewportFraction * size.height,
  )
  const sourceTime = sourceTimeSeconds(frame, config)
  const endpointLocalYs = Array.from(
    { length: THREADS_LINE_COUNT },
    (_, lineId) => physicalFrontLocalY
      + finiteOrZero(frame.tipOffsetsViewportFractions[lineId]) * size.height,
  )

  const derivativeSamplePx = 1
  const derivativeSampleSource = derivativeSamplePx / sourceLengthPx
  THREADS_LINE_PARAMETERS.forEach((lineParameter, lineId) => {
    const downstream = finiteOrZero(
      (endpointLocalYs[lineId] - sourceOriginLocalY) / sourceLengthPx,
    )
    const centerline = threadsCenterline(
      downstream,
      lineParameter,
      sourceTime,
    )
    const beforeCenterline = threadsCenterline(
      downstream - derivativeSampleSource,
      lineParameter,
      sourceTime,
    )
    const afterCenterline = threadsCenterline(
      downstream + derivativeSampleSource,
      lineParameter,
      sourceTime,
    )
    const centerX = centerline * sourceLateralScalePx
    const beforeX = beforeCenterline * sourceLateralScalePx
    const afterX = afterCenterline * sourceLateralScalePx
    const slope = finiteOrZero(
      (afterX - beforeX) / (2 * derivativeSamplePx),
    )
    const tangentLength = Math.hypot(slope, 1)
    const secondDerivative = finiteOrZero(
      (afterX - 2 * centerX + beforeX) / (derivativeSamplePx ** 2),
    )

    endpointCenterlines[lineId] = centerline
    endpointTangentXs[lineId] = slope / tangentLength
    endpointTangentYs[lineId] = 1 / tangentLength
    endpointCurvatures[lineId] = finiteOrZero(
      secondDerivative / (tangentLength ** 3),
    )
  })
  const appearance = frame.theme === 'dark'
    ? {
        themeMode: 0 as const,
        bodyColor0: config.theme.dark.body.startColor,
        bodyColor1: config.theme.dark.body.middleColor,
        bodyColor2: config.theme.dark.body.endColor,
        bodyColor3: config.theme.dark.body.endColor,
        bodyCoreOpacity: config.theme.dark.body.coreOpacity,
        bodyEffectOpacity: config.theme.dark.body.emissionOpacity,
        bodyEffectRadiusPx: config.theme.dark.body.emissionRadiusPx,
        bodyFreshTrailLengthPx: config.theme.dark.body.freshTrailLengthPx,
        bodyFiberScalePx: 1,
        bodyFiberStrength: 0,
        bodySheenOpacity: 0,
        linePrimary: config.theme.dark.linePrimary,
        lineSecondary: config.theme.dark.lineSecondary,
        lineAccentOrFiber: config.theme.dark.lineAccent,
        wetInkColor: [0, 0, 0] as const,
        baseOpacity: config.theme.dark.baseOpacity,
        lineGlowOpacity: config.theme.dark.lineGlow.opacity,
        lineEffectRadiusPx: config.theme.dark.lineGlow.radiusPx,
        tipDiameterToLineWidth: config.theme.dark.tipGlow.diameterToLineWidth,
        tipTailLengthToDiameter: config.theme.dark.tipGlow.tailLengthToDiameter,
        tipEffectDiameterToHead: config.theme.dark.tipGlow.haloDiameterToHead,
        tipTailOpacityAtTip: config.theme.tailOpacityAtTip,
        tipGlowOpacity: config.theme.dark.tipGlow.opacity,
        tipSpecularOpacity: 0,
        freshTrailLengthPx: config.theme.dark.tipGlow.freshTrailLengthPx,
        pinkMix: config.theme.dark.tipGlow.pinkMix,
        cyanMix: config.theme.dark.tipGlow.cyanMix,
        pulseHz: config.theme.dark.tipGlow.pulseHz,
        pulseDepth: config.theme.dark.tipGlow.pulseDepth,
        secondaryPulseRatio: config.theme.dark.tipGlow.secondaryPulseRatio,
        inkIrregularity: 0,
        absorptionOpacity: 0,
      }
    : {
        themeMode: 1 as const,
        bodyColor0: config.theme.light.body.wetBlueBlack,
        bodyColor1: config.theme.light.body.settledBlue,
        bodyColor2: config.theme.light.body.agedSepia,
        bodyColor3: config.theme.light.body.fadedWarmSepia,
        bodyCoreOpacity: config.theme.light.body.coreOpacity,
        bodyEffectOpacity: config.theme.light.body.absorptionOpacity,
        bodyEffectRadiusPx: config.theme.light.body.absorptionRadiusPx,
        bodyFreshTrailLengthPx: config.theme.light.body.freshTrailLengthPx,
        bodyFiberScalePx: config.theme.light.body.fiberScalePx,
        bodyFiberStrength: config.theme.light.body.fiberStrength,
        bodySheenOpacity: config.theme.light.body.sheenOpacity,
        linePrimary: config.theme.light.linePrimary,
        lineSecondary: config.theme.light.lineSecondary,
        lineAccentOrFiber: config.theme.light.paperFiber,
        wetInkColor: config.theme.light.tipInk.wetColor,
        baseOpacity: config.theme.light.baseOpacity,
        lineGlowOpacity: 0,
        lineEffectRadiusPx: config.theme.light.tipInk.lineBleedRadiusPx,
        tipDiameterToLineWidth: config.theme.light.tipInk.diameterToLineWidth,
        tipTailLengthToDiameter: config.theme.light.tipInk.tailLengthToDiameter,
        tipEffectDiameterToHead: config.theme.light.tipInk.bleedDiameterToHead,
        tipTailOpacityAtTip: config.theme.tailOpacityAtTip,
        tipGlowOpacity: 0,
        tipSpecularOpacity: config.theme.light.tipInk.specularOpacity,
        freshTrailLengthPx: config.theme.light.tipInk.freshTrailLengthPx,
        pinkMix: 0,
        cyanMix: 0,
        pulseHz: 0,
        pulseDepth: 0,
        secondaryPulseRatio: 1,
        inkIrregularity: config.theme.light.tipInk.irregularity,
        absorptionOpacity: config.theme.light.tipInk.absorptionOpacity,
      }

  return {
    cssSizePx: [size.width, size.height],
    effectiveDpr: size.effectiveDpr,
    sourceOriginLocalPx: [originLocalX, sourceOriginLocalY],
    physicalOriginLocalPx: [originLocalX, physicalOriginLocalY],
    physicalFrontLocalY,
    endpointLocalYs,
    sourceTimeSeconds: sourceTime,
    sourceLengthPx,
    sourceLateralScalePx,
    endpointCenterlines,
    endpointTangentXs,
    endpointTangentYs,
    endpointCurvatures,
    motionOpacity: clamp01(frame.opacity),
    ...appearance,
  }
}

export function createLandingLineRenderer(
  container: HTMLElement,
  options: LandingLineRendererOptions,
): LandingLineRenderer {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  let oglRenderer: Renderer | null = null
  let program: Program | null = null
  let triangle: Triangle | null = null
  let lossListenerAttached = false
  let contextLostNotified = false
  const lossRequested = { value: false }
  const uniforms = uniformsFromPacket(createInitialPacket())

  const onContextLost = () => {
    if (contextLostNotified) return
    contextLostNotified = true
    options.onContextLost()
  }

  try {
    oglRenderer = new Renderer({
      canvas,
      width: 1,
      height: 1,
      dpr: 1,
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      autoClear: true,
      webgl: 2,
    })
    if (!oglRenderer.isWebgl2) throw new Error('Landing line renderer requires WebGL2')

    const gl = oglRenderer.gl
    program = new Program(gl, {
      vertex: lineFieldVertexShader,
      fragment: lineFieldFragmentShader,
      uniforms,
      transparent: true,
      cullFace: false,
      depthTest: false,
      depthWrite: false,
    })
    program.setBlendFunc(gl.ONE, gl.ZERO)
    if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) {
      throw new Error('Landing line renderer program link failed')
    }
    triangle = new Triangle(gl)
    const mesh = new Mesh(gl, { geometry: triangle, program })
    canvas.addEventListener('webglcontextlost', onContextLost)
    lossListenerAttached = true
    container.append(canvas)

    const rendererResource = oglRenderer
    const programResource = program
    const triangleResource = triangle
    let disposed = false
    let size: CanvasSize = { width: 1, height: 1, effectiveDpr: 1 }
    const endpointCenterlines = Array.from({ length: THREADS_LINE_COUNT }, () => 0.5)
    const endpointTangentXs = Array.from({ length: THREADS_LINE_COUNT }, () => 0)
    const endpointTangentYs = Array.from({ length: THREADS_LINE_COUNT }, () => 1)
    const endpointCurvatures = Array.from({ length: THREADS_LINE_COUNT }, () => 0)

    return {
      resize(cssWidth, cssHeight, deviceDpr, limits) {
        if (disposed) return
        size = resolveCanvasSize(cssWidth, cssHeight, deviceDpr, limits)
        rendererResource.dpr = size.effectiveDpr
        rendererResource.setSize(size.width, size.height)
        canvas.style.width = `${size.width}px`
        canvas.style.height = `${size.height}px`
      },
      render(frame, config) {
        if (disposed) return
        const packet = packetForFrame(
          frame,
          config,
          size,
          endpointCenterlines,
          endpointTangentXs,
          endpointTangentYs,
          endpointCurvatures,
        )
        for (const key of packetKeys) uniforms[key].value = packet[key]
        rendererResource.render({ scene: mesh })
      },
      dispose() {
        if (disposed) return
        disposed = true
        canvas.removeEventListener('webglcontextlost', onContextLost)
        lossListenerAttached = false
        programResource.remove()
        triangleResource.remove()
        requestContextLoss(gl, lossRequested)
        canvas.remove()
      },
    }
  } catch (error) {
    if (lossListenerAttached) canvas.removeEventListener('webglcontextlost', onContextLost)
    program?.remove()
    triangle?.remove()
    if (oglRenderer) requestContextLoss(oglRenderer.gl, lossRequested)
    canvas.remove()
    throw error
  }
}

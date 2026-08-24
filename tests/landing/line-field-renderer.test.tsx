import { createHash } from 'node:crypto'
import { render } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lineFieldConfig } from '../../src/landing/line-field/config/line-field-config.generated'
import type { LineFieldAnimationConfig } from '../../src/landing/line-field/config/line-field-config.types'
import {
  THREADS_LINE_PARAMETERS,
  threadsCenterline,
} from '../../src/landing/line-field/math/wave-field'
import { LandingLineFallback } from '../../src/landing/line-field/LandingLineFallback'
import { createLandingLineRenderer } from '../../src/landing/line-field/renderer/LandingLineRenderer'
import { lineFieldFragmentShader } from '../../src/landing/line-field/renderer/line-field-shaders'
import {
  createLineFieldMotionState,
  stepLineFieldMotion,
} from '../../src/landing/line-field/motion/line-field-state-machine'
import type { LineFieldRenderFrame } from '../../src/landing/line-field/motion/line-field-state-machine'

const oglDouble = vi.hoisted(() => ({
  isWebgl2: true,
  linkStatus: true,
  loseContextThrows: false,
  order: [] as string[],
  renderers: [] as Array<Record<string, unknown>>,
  programs: [] as Array<Record<string, unknown>>,
  triangles: [] as Array<Record<string, unknown>>,
  meshes: [] as Array<Record<string, unknown>>,
}))

vi.mock('ogl', () => {
  class Renderer {
    readonly gl: Record<string, unknown>
    readonly isWebgl2: boolean
    readonly loseContext: ReturnType<typeof vi.fn>
    readonly options: Record<string, unknown>
    readonly render: ReturnType<typeof vi.fn>
    readonly setSize: ReturnType<typeof vi.fn>
    dpr = 1

    constructor(options: { canvas?: HTMLCanvasElement } = {}) {
      this.options = options
      const canvas = options.canvas ?? document.createElement('canvas')
      const nativeAdd = canvas.addEventListener.bind(canvas)
      const nativeRemove = canvas.removeEventListener.bind(canvas)
      canvas.addEventListener = vi.fn((type, listener, listenerOptions) => {
        oglDouble.order.push(`add:${type}`)
        nativeAdd(type, listener, listenerOptions)
      }) as typeof canvas.addEventListener
      canvas.removeEventListener = vi.fn((type, listener, listenerOptions) => {
        oglDouble.order.push(`remove:${type}`)
        nativeRemove(type, listener, listenerOptions)
      }) as typeof canvas.removeEventListener

      this.isWebgl2 = oglDouble.isWebgl2
      this.loseContext = vi.fn(() => {
        oglDouble.order.push('lose-context')
        if (oglDouble.loseContextThrows) throw new Error('loss request failed')
      })
      this.gl = {
        canvas,
        LINK_STATUS: 0x8b82,
        BLEND: 0x0be2,
        ONE: 1,
        ZERO: 0,
        SRC_ALPHA: 0x0302,
        ONE_MINUS_SRC_ALPHA: 0x0303,
        getProgramParameter: vi.fn((_program: unknown, parameter: number) => (
          parameter === 0x8b82 ? oglDouble.linkStatus : 0
        )),
        getExtension: vi.fn((name: string) => (
          name === 'WEBGL_lose_context' ? { loseContext: this.loseContext } : null
        )),
        enable: vi.fn(),
        blendFunc: vi.fn(),
      }
      this.setSize = vi.fn((width: number, height: number) => {
        canvas.width = width * this.dpr
        canvas.height = height * this.dpr
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
      })
      this.render = vi.fn()
      oglDouble.renderers.push(this as unknown as Record<string, unknown>)
    }
  }

  class Program {
    readonly options: Record<string, unknown>
    readonly program = {}
    readonly setBlendFunc: ReturnType<typeof vi.fn>
    readonly uniforms: Record<string, { value: unknown }>
    readonly remove: ReturnType<typeof vi.fn>

    constructor(_gl: unknown, options: { uniforms?: Record<string, { value: unknown }> } = {}) {
      this.options = options
      this.uniforms = options.uniforms ?? {}
      this.setBlendFunc = vi.fn()
      this.remove = vi.fn(() => oglDouble.order.push('program.remove'))
      oglDouble.programs.push(this as unknown as Record<string, unknown>)
    }
  }

  class Triangle {
    readonly remove = vi.fn(() => oglDouble.order.push('triangle.remove'))

    constructor() {
      oglDouble.triangles.push(this as unknown as Record<string, unknown>)
    }
  }

  class Mesh {
    constructor(_gl: unknown, options: Record<string, unknown>) {
      Object.assign(this, options)
      oglDouble.meshes.push(this as Record<string, unknown>)
    }
  }

  return { Mesh, Program, Renderer, Triangle }
})

const makeFrame = (overrides: Partial<LineFieldRenderFrame> = {}): LineFieldRenderFrame => ({
  mode: 'scroll-build',
  theme: 'dark',
  anchorViewport: [540, 300],
  sourceOriginViewportFraction: 0.3,
  headerTargetViewportY: 72,
  originDocumentY: 1300,
  commonFrontDocumentY: 2050,
  upwardSpineReveal: 0.6,
  unwrappedPhase: 1.25,
  tipOffsetsViewportFractions: Array.from({ length: 36 }, (_, laneId) => laneId / 1000),
  pointerProximity: 0.4,
  opacity: 0.82,
  filmProgress: lineFieldConfig.reveal.startFilmProgress,
  mottoProgress: 0.33,
  ...overrides,
})

function uniforms() {
  const program = oglDouble.programs.at(-1) as { uniforms: Record<string, { value: unknown }> }
  return Object.fromEntries(
    Object.entries(program.uniforms).map(([name, uniform]) => [name, uniform.value]),
  )
}

function sha256Json(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')
}

beforeEach(() => {
  oglDouble.isWebgl2 = true
  oglDouble.linkStatus = true
  oglDouble.loseContextThrows = false
  oglDouble.order.length = 0
  oglDouble.renderers.length = 0
  oglDouble.programs.length = 0
  oglDouble.triangles.length = 0
  oglDouble.meshes.length = 0
})

afterEach(() => {
  document.body.replaceChildren()
})

describe('deferred landing line renderer', () => {
  it('ports the accepted fixed 40-thread Perlin field instead of the rejected cosine field', () => {
    expect(lineFieldFragmentShader).toContain('const int THREAD_COUNT = 40;')
    expect(lineFieldFragmentShader).toContain('float p = float(i) / 40.0;')
    expect(lineFieldFragmentShader).toContain('float perlin2D(vec2 point)')
    expect(lineFieldFragmentShader).toContain('sourceTimeSeconds / 10.0')
    expect(lineFieldFragmentShader).not.toContain('float lowerVisible = step(physicalOriginLocalPx.y, cssPoint.y)')
    expect(lineFieldFragmentShader).not.toContain('float upperVisible = step(upperPhysicalFrontLocalY, cssPoint.y)')
    expect(lineFieldFragmentShader).toContain('uniform float endpointLocalYs[THREAD_COUNT];')
    expect(lineFieldFragmentShader).toContain('float lowerLaneVisible = step(physicalOriginLocalPx.y, cssPoint.y)')
    expect(lineFieldFragmentShader).toContain('float upperLaneVisible = step(upperEndpointY, cssPoint.y)')
    expect(lineFieldFragmentShader).toMatch(
      /sourceLineMasks\(\s*vec2\(lowerSourceX, sourceY\),\s*p,\s*sourceResolution,\s*1\.0,/,
    )
    expect(lineFieldFragmentShader).toContain('sourceFlatLineMasks(')
    expect(lineFieldFragmentShader).toContain('endpointCenterlines[i]')
    expect(lineFieldFragmentShader).not.toContain('float sourceCenterline(')
    expect(lineFieldFragmentShader).not.toContain('float upperHalfWidth')
    expect(lineFieldFragmentShader).not.toContain('DOT_RADIUS_TO_LENGTH')
    expect(lineFieldFragmentShader).toContain('uniform float endpointTangentXs[THREAD_COUNT];')
    expect(lineFieldFragmentShader).toContain('uniform float endpointCurvatures[THREAD_COUNT];')
    expect(lineFieldFragmentShader).not.toContain('cos(')
    expect(lineFieldFragmentShader).not.toContain('activeLaneCount')
    expect(lineFieldFragmentShader).not.toContain('pointerProximity')
    expect(lineFieldFragmentShader).not.toContain('revealExponent')
  })

  it('separates the stable source origin from every staggered physical endpoint', () => {
    const renderer = createLandingLineRenderer(document.createElement('div'), { onContextLost: vi.fn() })
    renderer.resize(900, 1200, 1, lineFieldConfig.performance)
    renderer.render(makeFrame({
      anchorViewport: [540, 300],
      sourceOriginViewportFraction: 0.1,
      originDocumentY: 1300,
      commonFrontDocumentY: 2050,
    }), lineFieldConfig)

    const packet = uniforms()
    expect(packet).toMatchObject({
      sourceOriginLocalPx: [540, 120],
      physicalOriginLocalPx: [540, 300],
      physicalFrontLocalY: 1050,
    })
    expect(packet).not.toHaveProperty('originLocalPx')
    expect(packet).not.toHaveProperty('revealProgress')

    const endpointCenterlines = packet.endpointCenterlines as number[]
    const endpointTangentXs = packet.endpointTangentXs as number[]
    const endpointTangentYs = packet.endpointTangentYs as number[]
    const endpointCurvatures = packet.endpointCurvatures as number[]
    const sourceTimeSeconds = 1.25 / (
      2 * Math.PI * lineFieldConfig.wave.autonomousCyclesPerSecond
    )
    expect(endpointCenterlines).toBeInstanceOf(Array)
    expect(endpointCenterlines).toHaveLength(40)
    expect(endpointTangentXs).toHaveLength(40)
    expect(endpointTangentYs).toHaveLength(40)
    expect(endpointCurvatures).toHaveLength(40)
    const endpointLocalYs = packet.endpointLocalYs as number[]
    expect(endpointLocalYs).toHaveLength(40)
    expect(new Set(endpointLocalYs.map(value => value.toFixed(6))).size).toBeGreaterThan(1)
    for (const lineId of [0, 19, 39]) {
      expect(endpointLocalYs[lineId]).toBeCloseTo(
        1050 + (makeFrame().tipOffsetsViewportFractions[lineId] ?? 0) * 1200,
        6,
      )
      expect(endpointCenterlines[lineId]).toBeCloseTo(
        threadsCenterline(
          (endpointLocalYs[lineId] - 120) / 1200,
          THREADS_LINE_PARAMETERS[lineId],
          sourceTimeSeconds,
        ),
        6,
      )
      expect(Math.hypot(endpointTangentXs[lineId], endpointTangentYs[lineId])).toBeCloseTo(1, 6)
      expect(endpointTangentYs[lineId]).toBeGreaterThan(0)
      expect(endpointCurvatures[lineId]).toBeTypeOf('number')
      expect(Number.isFinite(endpointCurvatures[lineId])).toBe(true)
    }
  })

  it('keeps the exact fixed-40 endpoint packet at 1440x900 and 390x844', () => {
    const offsets = createLineFieldMotionState(lineFieldConfig).canonicalOffsets

    for (const [width, height] of [[1440, 900], [390, 844]] as const) {
      const renderer = createLandingLineRenderer(
        document.createElement('div'),
        { onContextLost: vi.fn() },
      )
      renderer.resize(width, height, 1, lineFieldConfig.performance)
      renderer.render(makeFrame({ tipOffsetsViewportFractions: offsets }), lineFieldConfig)

      const packet = uniforms()
      const physicalFront = packet.physicalFrontLocalY as number
      const endpointLocalYs = packet.endpointLocalYs as number[]
      const normalizedOffsets = endpointLocalYs.map(
        (_endpoint, lineId) => offsets[lineId] ?? 0,
      )

      expect(endpointLocalYs).toHaveLength(40)
      for (let lineId = 0; lineId < 36; lineId += 1) {
        expect(endpointLocalYs[lineId]).toBe(physicalFront + offsets[lineId] * height)
      }
      expect(endpointLocalYs.slice(36)).toEqual([
        physicalFront,
        physicalFront,
        physicalFront,
        physicalFront,
      ])
      expect(sha256Json(normalizedOffsets)).toBe(
        '05ab4eb1579f235dba3b79e4cc2af8f0b0e40be17593fd6fe0171559849feb79',
      )
    }
  })

  it('negative control with 35 staggered tips changes the digest and resets endpoint 35', () => {
    const countControlConfig: LineFieldAnimationConfig = {
      ...structuredClone(lineFieldConfig),
      geometry: { ...lineFieldConfig.geometry, staggeredTipCount: 35 },
    }
    const baselineOffsets = createLineFieldMotionState(lineFieldConfig).canonicalOffsets
    const countControlOffsets = createLineFieldMotionState(countControlConfig).canonicalOffsets
    const renderer = createLandingLineRenderer(
      document.createElement('div'),
      { onContextLost: vi.fn() },
    )
    renderer.resize(1440, 900, 1, lineFieldConfig.performance)
    renderer.render(makeFrame({ tipOffsetsViewportFractions: baselineOffsets }), lineFieldConfig)
    const baseline = structuredClone(uniforms())
    renderer.render(makeFrame({ tipOffsetsViewportFractions: countControlOffsets }), lineFieldConfig)
    const countControl = uniforms()
    const baselineNormalized = Array.from(
      { length: 40 },
      (_, lineId) => baselineOffsets[lineId] ?? 0,
    )
    const countControlNormalized = Array.from(
      { length: 40 },
      (_, lineId) => countControlOffsets[lineId] ?? 0,
    )

    expect(countControlOffsets).toHaveLength(35)
    expect(sha256Json(countControlNormalized)).not.toBe(sha256Json(baselineNormalized))
    expect((baseline.endpointLocalYs as number[])[35]).not.toBe(baseline.physicalFrontLocalY)
    expect((countControl.endpointLocalYs as number[])[35]).toBe(countControl.physicalFrontLocalY)
  })

  it('preserves CSS geometry, caps backing pixels, and submits the accepted field plus its appearance packet', () => {
    const host = document.createElement('div')
    const onContextLost = vi.fn()
    const renderer = createLandingLineRenderer(host, { onContextLost })

    expect(host.querySelectorAll('canvas')).toHaveLength(1)

    renderer.resize(2000, 1000, 2, {
      maximumDpr: 1.5,
      maximumRenderDimensionPx: 1600,
    })
    const oglRenderer = oglDouble.renderers[0] as {
      dpr: number
      options: Record<string, unknown>
      gl: { canvas: HTMLCanvasElement; enable: ReturnType<typeof vi.fn>; blendFunc: ReturnType<typeof vi.fn> }
      render: ReturnType<typeof vi.fn>
    }
    const canvas = oglRenderer.gl.canvas
    expect(oglRenderer.dpr).toBe(0.8)
    expect([canvas.width, canvas.height]).toEqual([1600, 800])
    expect([canvas.style.width, canvas.style.height]).toEqual(['2000px', '1000px'])
    expect(oglRenderer.options).toMatchObject({
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      stencil: false,
      webgl: 2,
    })
    expect(oglRenderer.gl.enable).not.toHaveBeenCalled()
    expect(oglRenderer.gl.blendFunc).not.toHaveBeenCalled()
    const program = oglDouble.programs[0] as {
      options: Record<string, unknown>
      setBlendFunc: ReturnType<typeof vi.fn>
    }
    expect(program.options).toMatchObject({
      cullFace: false,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    })
    expect(program.setBlendFunc).toHaveBeenCalledWith(1, 0)

    renderer.render(makeFrame(), lineFieldConfig)

    expect(oglRenderer.render).toHaveBeenCalledOnce()
    expect(oglRenderer.render).toHaveBeenCalledWith({ scene: oglDouble.meshes[0] })
    const packet = uniforms()
    expect(Object.keys(packet)).toEqual([
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
    ])
    const programUniforms = (oglDouble.programs[0] as {
      uniforms: Record<string, { value: unknown }>
    }).uniforms
    expect(Reflect.ownKeys(programUniforms)).toEqual(Object.keys(packet))
    expect(packet).toMatchObject({
      cssSizePx: [2000, 1000],
      effectiveDpr: 0.8,
      sourceOriginLocalPx: [540, 300],
      physicalOriginLocalPx: [540, 300],
      physicalFrontLocalY: 1050,
      sourceLengthPx: 1000,
      sourceLateralScalePx: 750,
      motionOpacity: 0.82,
      themeMode: 0,
      bodyColor0: lineFieldConfig.theme.dark.body.startColor,
      bodyColor1: lineFieldConfig.theme.dark.body.middleColor,
      bodyColor2: lineFieldConfig.theme.dark.body.endColor,
      bodyColor3: lineFieldConfig.theme.dark.body.endColor,
      bodyCoreOpacity: lineFieldConfig.theme.dark.body.coreOpacity,
      bodyEffectOpacity: lineFieldConfig.theme.dark.body.emissionOpacity,
      bodyEffectRadiusPx: lineFieldConfig.theme.dark.body.emissionRadiusPx,
      bodyFreshTrailLengthPx: 90,
      bodyFiberScalePx: 1,
      bodyFiberStrength: 0,
      bodySheenOpacity: 0,
      linePrimary: [1, 0.972549, 1],
      lineSecondary: [1, 0.301961, 0.721569],
      lineAccentOrFiber: [0.470588, 0.94902, 1],
      wetInkColor: [0, 0, 0],
      baseOpacity: 0.76,
      lineGlowOpacity: 0.26,
      lineEffectRadiusPx: 5.5,
      tipDiameterToLineWidth: 1.75,
      tipTailLengthToDiameter: 4,
      tipEffectDiameterToHead: 2.5,
      tipTailOpacityAtTip: 0.1,
      tipGlowOpacity: lineFieldConfig.theme.dark.tipGlow.opacity,
      tipSpecularOpacity: 0,
      freshTrailLengthPx: 90,
      pinkMix: 0.7,
      cyanMix: 0.16,
      pulseHz: 0.82,
      pulseDepth: 0.72,
      secondaryPulseRatio: 1.37,
      inkIrregularity: 0,
      absorptionOpacity: 0,
    })
    expect(packet.sourceTimeSeconds).toBeCloseTo(
      1.25 / (2 * Math.PI * lineFieldConfig.wave.autonomousCyclesPerSecond),
      12,
    )
  })

  it('changes source time and its endpoint packet when autonomous frequency moves by one hundredth', () => {
    const renderer = createLandingLineRenderer(document.createElement('div'), { onContextLost: vi.fn() })
    renderer.resize(900, 1200, 1, lineFieldConfig.performance)
    const baselineConfig = structuredClone(lineFieldConfig)
    const adjacentConfig = {
      ...baselineConfig,
      wave: { ...baselineConfig.wave, autonomousCyclesPerSecond: 0.66 },
    }
    const frame = makeFrame()

    renderer.render(frame, baselineConfig)
    const baseline = structuredClone(uniforms())
    renderer.render(frame, adjacentConfig)
    const adjacent = uniforms()

    expect(baseline.sourceTimeSeconds).toBeCloseTo(1.25 / (2 * Math.PI * 0.65), 12)
    expect(adjacent.sourceTimeSeconds).toBeCloseTo(1.25 / (2 * Math.PI * 0.66), 12)
    expect((adjacent.endpointCenterlines as number[])[19]).not.toBeCloseTo(
      (baseline.endpointCenterlines as number[])[19],
      12,
    )
    for (const key of [
      'cssSizePx',
      'effectiveDpr',
      'sourceOriginLocalPx',
      'physicalOriginLocalPx',
      'physicalFrontLocalY',
      'endpointLocalYs',
      'sourceLengthPx',
      'sourceLateralScalePx',
      'motionOpacity',
      'themeMode',
      'bodyColor0',
      'linePrimary',
      'baseOpacity',
    ]) {
      expect(adjacent[key]).toEqual(baseline[key])
    }
  })

  it('keeps the accepted geometry packet identical while swapping only dark glow for light ink', () => {
    const renderer = createLandingLineRenderer(document.createElement('div'), { onContextLost: vi.fn() })
    renderer.resize(900, 1200, 1.25, lineFieldConfig.performance)

    renderer.render(makeFrame({ theme: 'dark' }), lineFieldConfig)
    const dark = uniforms()
    renderer.render(makeFrame({ theme: 'light' }), lineFieldConfig)
    const light = uniforms()

    for (const key of [
      'cssSizePx',
      'effectiveDpr',
      'sourceOriginLocalPx',
      'physicalOriginLocalPx',
      'physicalFrontLocalY',
      'sourceTimeSeconds',
      'sourceLengthPx',
      'sourceLateralScalePx',
      'endpointCenterlines',
      'endpointTangentXs',
      'endpointTangentYs',
      'endpointCurvatures',
    ]) {
      expect(light[key]).toEqual(dark[key])
    }
    expect(dark).toMatchObject({
      themeMode: 0,
      linePrimary: lineFieldConfig.theme.dark.linePrimary,
      lineSecondary: lineFieldConfig.theme.dark.lineSecondary,
      lineAccentOrFiber: lineFieldConfig.theme.dark.lineAccent,
      wetInkColor: [0, 0, 0],
      lineGlowOpacity: lineFieldConfig.theme.dark.lineGlow.opacity,
      lineEffectRadiusPx: lineFieldConfig.theme.dark.lineGlow.radiusPx,
      tipDiameterToLineWidth: lineFieldConfig.theme.dark.tipGlow.diameterToLineWidth,
      tipTailLengthToDiameter: lineFieldConfig.theme.dark.tipGlow.tailLengthToDiameter,
      tipEffectDiameterToHead: lineFieldConfig.theme.dark.tipGlow.haloDiameterToHead,
      tipTailOpacityAtTip: lineFieldConfig.theme.tailOpacityAtTip,
      tipGlowOpacity: lineFieldConfig.theme.dark.tipGlow.opacity,
      tipSpecularOpacity: 0,
      freshTrailLengthPx: lineFieldConfig.theme.dark.tipGlow.freshTrailLengthPx,
      inkIrregularity: 0,
      absorptionOpacity: 0,
    })
    expect(light).toMatchObject({
      themeMode: 1,
      linePrimary: lineFieldConfig.theme.light.linePrimary,
      lineSecondary: lineFieldConfig.theme.light.lineSecondary,
      lineAccentOrFiber: lineFieldConfig.theme.light.paperFiber,
      wetInkColor: [0.043137, 0.176471, 0.356863],
      lineGlowOpacity: 0,
      lineEffectRadiusPx: lineFieldConfig.theme.light.tipInk.lineBleedRadiusPx,
      tipDiameterToLineWidth: lineFieldConfig.theme.light.tipInk.diameterToLineWidth,
      tipTailLengthToDiameter: lineFieldConfig.theme.light.tipInk.tailLengthToDiameter,
      tipEffectDiameterToHead: lineFieldConfig.theme.light.tipInk.bleedDiameterToHead,
      tipTailOpacityAtTip: lineFieldConfig.theme.tailOpacityAtTip,
      tipGlowOpacity: 0,
      tipSpecularOpacity: lineFieldConfig.theme.light.tipInk.specularOpacity,
      freshTrailLengthPx: lineFieldConfig.theme.light.tipInk.freshTrailLengthPx,
      pinkMix: 0,
      cyanMix: 0,
      inkIrregularity: lineFieldConfig.theme.light.tipInk.irregularity,
      absorptionOpacity: lineFieldConfig.theme.light.tipInk.absorptionOpacity,
    })
  })

  it('maps body materials independently while preserving geometry, depth, motion, and endpoint uniforms', () => {
    const renderer = createLandingLineRenderer(document.createElement('div'), { onContextLost: vi.fn() })
    renderer.resize(900, 1200, 1.25, lineFieldConfig.performance)
    const config = structuredClone(lineFieldConfig) as unknown as typeof lineFieldConfig

    renderer.render(makeFrame({ theme: 'dark' }), config)
    const baseline = uniforms()
    const mutated = config as unknown as {
      theme: {
        dark: {
          body: {
            startColor: [number, number, number]
            middleColor: [number, number, number]
            endColor: [number, number, number]
            coreOpacity: number
            emissionOpacity: number
            emissionRadiusPx: number
            freshTrailLengthPx: number
          }
        }
        light: {
          body: {
            wetBlueBlack: [number, number, number]
            settledBlue: [number, number, number]
            agedSepia: [number, number, number]
            fadedWarmSepia: [number, number, number]
            coreOpacity: number
            freshTrailLengthPx: number
            fiberScalePx: number
            fiberStrength: number
            sheenOpacity: number
            absorptionRadiusPx: number
            absorptionOpacity: number
          }
        }
      }
    }
    mutated.theme.dark.body = {
      startColor: [0.01, 0.02, 0.03],
      middleColor: [0.11, 0.12, 0.13],
      endColor: [0.21, 0.22, 0.23],
      coreOpacity: 0.31,
      emissionOpacity: 0.41,
      emissionRadiusPx: 13,
      freshTrailLengthPx: 17,
    }
    renderer.render(makeFrame({ theme: 'dark' }), config)
    const changed = uniforms()

    expect(baseline).toMatchObject({
      bodyColor0: lineFieldConfig.theme.dark.body.startColor,
      bodyColor1: lineFieldConfig.theme.dark.body.middleColor,
      bodyColor2: lineFieldConfig.theme.dark.body.endColor,
      bodyColor3: lineFieldConfig.theme.dark.body.endColor,
      bodyCoreOpacity: 0.82,
      bodyEffectOpacity: 0.24,
      bodyEffectRadiusPx: 8.5,
      bodyFreshTrailLengthPx: 90,
      bodyFiberScalePx: 1,
      bodyFiberStrength: 0,
      bodySheenOpacity: 0,
    })
    expect(changed).toMatchObject({
      bodyColor0: [0.01, 0.02, 0.03],
      bodyColor1: [0.11, 0.12, 0.13],
      bodyColor2: [0.21, 0.22, 0.23],
      bodyColor3: [0.21, 0.22, 0.23],
      bodyCoreOpacity: 0.31,
      bodyEffectOpacity: 0.41,
      bodyEffectRadiusPx: 13,
      bodyFreshTrailLengthPx: 17,
    })
    for (const key of [
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
    ]) {
      expect(changed[key]).toEqual(baseline[key])
    }

    renderer.render(makeFrame({ theme: 'light' }), lineFieldConfig)
    const lightBaseline = uniforms()
    expect(lightBaseline).toMatchObject({
      bodyColor0: lineFieldConfig.theme.light.body.wetBlueBlack,
      bodyColor1: lineFieldConfig.theme.light.body.settledBlue,
      bodyColor2: lineFieldConfig.theme.light.body.agedSepia,
      bodyColor3: lineFieldConfig.theme.light.body.fadedWarmSepia,
      bodyCoreOpacity: lineFieldConfig.theme.light.body.coreOpacity,
      bodyEffectOpacity: lineFieldConfig.theme.light.body.absorptionOpacity,
      bodyEffectRadiusPx: lineFieldConfig.theme.light.body.absorptionRadiusPx,
      bodyFreshTrailLengthPx: lineFieldConfig.theme.light.body.freshTrailLengthPx,
      bodyFiberScalePx: lineFieldConfig.theme.light.body.fiberScalePx,
      bodyFiberStrength: lineFieldConfig.theme.light.body.fiberStrength,
      bodySheenOpacity: lineFieldConfig.theme.light.body.sheenOpacity,
    })

    mutated.theme.light.body = {
      wetBlueBlack: [0.31, 0.32, 0.33],
      settledBlue: [0.41, 0.42, 0.43],
      agedSepia: [0.51, 0.52, 0.53],
      fadedWarmSepia: [0.61, 0.62, 0.63],
      coreOpacity: 0.44,
      freshTrailLengthPx: 27,
      fiberScalePx: 3,
      fiberStrength: 0.19,
      sheenOpacity: 0.33,
      absorptionRadiusPx: 9,
      absorptionOpacity: 0.14,
    }
    renderer.render(makeFrame({ theme: 'light' }), config)
    expect(uniforms()).toMatchObject({
      bodyColor0: [0.31, 0.32, 0.33],
      bodyColor1: [0.41, 0.42, 0.43],
      bodyColor2: [0.51, 0.52, 0.53],
      bodyColor3: [0.61, 0.62, 0.63],
      bodyCoreOpacity: 0.44,
      bodyEffectOpacity: 0.14,
      bodyEffectRadiusPx: 9,
      bodyFreshTrailLengthPx: 27,
      bodyFiberScalePx: 3,
      bodyFiberStrength: 0.19,
      bodySheenOpacity: 0.33,
    })
  })

  it('accepts scalar opacity and per-lane endpoints while keeping pointer and spine state outside', () => {
    const renderer = createLandingLineRenderer(document.createElement('div'), { onContextLost: vi.fn() })
    renderer.resize(400, 1000, 1, lineFieldConfig.performance)
    renderer.render(makeFrame(), lineFieldConfig)
    const first = uniforms()

    renderer.render(makeFrame({
      upwardSpineReveal: 0,
      tipOffsetsViewportFractions: Array.from({ length: 36 }, (_, laneId) => -laneId / 2000),
      pointerProximity: 1,
      opacity: 0,
      headerTargetViewportY: -400,
      filmProgress: 1,
    }), lineFieldConfig)

    const second = uniforms()
    expect(first.motionOpacity).toBe(0.82)
    expect(second.motionOpacity).toBe(0)
    expect(second.endpointLocalYs).not.toEqual(first.endpointLocalYs)
    expect({
      ...second,
      motionOpacity: first.motionOpacity,
      endpointLocalYs: first.endpointLocalYs,
      endpointCenterlines: first.endpointCenterlines,
    }).toEqual(first)
  })

  it('keeps the renderer packet identical across pointer-only normalized state changes', () => {
    const geometry = {
      scrollY: 1800,
      viewportWidth: 1440,
      viewportHeight: 900,
      pageHeight: 6000,
      filmTop: 0,
      filmHeight: 2520,
      anchorViewport: [720, 450] as const,
      headerTargetViewportY: 72,
      mottoTop: 2520,
      mottoHeight: 900,
      mottoCardFinalCenterX: 1080,
      mottoCardFinalWidth: 490,
      mottoCardFinalHeight: 300,
      mottoCardFinalTop: 2800,
      mottoCardFinalBottom: 3100,
    }
    const initial = stepLineFieldMotion(
      createLineFieldMotionState(lineFieldConfig),
      {
        geometry,
        theme: 'dark',
        pointerTarget: { proximity: 0, twistNormalized: 0 },
        nowMs: 0,
        clockMode: 'rebase',
      },
      lineFieldConfig,
    )
    const pointerOnly = stepLineFieldMotion(
      initial.state,
      {
        geometry,
        theme: 'dark',
        pointerTarget: { proximity: 1, twistNormalized: 1 },
        nowMs: 50,
        clockMode: 'advance',
      },
      lineFieldConfig,
    )
    const renderer = createLandingLineRenderer(
      document.createElement('div'),
      { onContextLost: vi.fn() },
    )
    renderer.resize(1440, 900, 1, lineFieldConfig.performance)
    renderer.render(initial.frame, lineFieldConfig)
    const baseline = structuredClone(uniforms())
    renderer.render(pointerOnly.frame, lineFieldConfig)
    const changed = uniforms()

    expect(pointerOnly.state.pointerProximity).not.toBe(initial.state.pointerProximity)
    expect(pointerOnly.state.pointerTwistNormalized).not.toBe(initial.state.pointerTwistNormalized)
    expect(changed).toEqual(baseline)
  })

  it('drives staggered endpoint growth from the physical front and lets autonomous motion leave the viewport', () => {
    const renderer = createLandingLineRenderer(document.createElement('div'), { onContextLost: vi.fn() })
    renderer.resize(400, 1000, 1, lineFieldConfig.performance)

    renderer.render(makeFrame({
      originDocumentY: 1300,
      commonFrontDocumentY: 2050,
    }), lineFieldConfig)
    expect(uniforms().physicalFrontLocalY).toBe(1050)

    renderer.render(makeFrame({
      originDocumentY: 1300,
      commonFrontDocumentY: 2800,
    }), lineFieldConfig)
    expect(uniforms().physicalFrontLocalY).toBe(1800)

    renderer.render(makeFrame({ commonFrontDocumentY: -3 }), lineFieldConfig)
    expect(uniforms().physicalFrontLocalY).toBe(-1003)
    renderer.render(makeFrame({ commonFrontDocumentY: Number.NaN }), lineFieldConfig)
    expect(uniforms().physicalFrontLocalY).toBe(300)
  })

  it('rejects WebGL1 fallback and cleans the canvas and context transactionally', () => {
    oglDouble.isWebgl2 = false
    const host = document.createElement('div')

    expect(() => createLandingLineRenderer(host, { onContextLost: vi.fn() }))
      .toThrow(/WebGL2/)

    expect(host.querySelector('canvas')).toBeNull()
    const oglRenderer = oglDouble.renderers[0] as { loseContext: ReturnType<typeof vi.fn> }
    expect(oglRenderer.loseContext).toHaveBeenCalledOnce()
    expect(oglDouble.programs).toHaveLength(0)
    expect(oglDouble.triangles).toHaveLength(0)
  })

  it('rejects a failed program link before allocating geometry and removes created resources', () => {
    oglDouble.linkStatus = false
    const host = document.createElement('div')

    expect(() => createLandingLineRenderer(host, { onContextLost: vi.fn() }))
      .toThrow(/link/i)

    expect(host.querySelector('canvas')).toBeNull()
    const program = oglDouble.programs[0] as { remove: ReturnType<typeof vi.fn> }
    const oglRenderer = oglDouble.renderers[0] as { loseContext: ReturnType<typeof vi.fn> }
    expect(program.remove).toHaveBeenCalledOnce()
    expect(oglDouble.triangles).toHaveLength(0)
    expect(oglRenderer.loseContext).toHaveBeenCalledOnce()
  })

  it('disposes idempotently without synthesizing context loss', () => {
    const host = document.createElement('div')
    const onContextLost = vi.fn()
    const renderer = createLandingLineRenderer(host, { onContextLost })
    const program = oglDouble.programs[0] as { remove: ReturnType<typeof vi.fn> }
    const triangle = oglDouble.triangles[0] as { remove: ReturnType<typeof vi.fn> }
    const oglRenderer = oglDouble.renderers[0] as { loseContext: ReturnType<typeof vi.fn> }

    oglDouble.order.length = 0
    renderer.dispose()
    renderer.dispose()

    expect(program.remove).toHaveBeenCalledOnce()
    expect(triangle.remove).toHaveBeenCalledOnce()
    expect(oglRenderer.loseContext).toHaveBeenCalledOnce()
    expect(host.querySelector('canvas')).toBeNull()
    expect(onContextLost).not.toHaveBeenCalled()
    expect(oglDouble.order.indexOf('remove:webglcontextlost'))
      .toBeLessThan(oglDouble.order.indexOf('lose-context'))
  })

  it('still removes the canvas when the best-effort context-loss request throws', () => {
    const host = document.createElement('div')
    const renderer = createLandingLineRenderer(host, { onContextLost: vi.fn() })
    oglDouble.loseContextThrows = true

    expect(() => renderer.dispose()).not.toThrow()
    expect(host.querySelector('canvas')).toBeNull()
  })

  it('reports a genuine cancelable loss once without preventing it or registering restore', () => {
    const host = document.createElement('div')
    const onContextLost = vi.fn()
    createLandingLineRenderer(host, { onContextLost })
    const canvas = host.querySelector('canvas') as HTMLCanvasElement

    const firstLoss = new Event('webglcontextlost', { cancelable: true })
    const secondLoss = new Event('webglcontextlost', { cancelable: true })
    canvas.dispatchEvent(firstLoss)
    canvas.dispatchEvent(secondLoss)

    expect(firstLoss.defaultPrevented).toBe(false)
    expect(secondLoss.defaultPrevented).toBe(false)
    expect(onContextLost).toHaveBeenCalledOnce()
    expect(oglDouble.order).not.toContain('add:webglcontextrestored')
  })
})

describe('static landing line fallback', () => {
  it('renders one inert spine and five ordered below-anchor lanes in the selected theme', () => {
    const { container, rerender } = render(<LandingLineFallback theme="light" />)
    const fallback = container.querySelector('[data-line-field-fallback]') as HTMLElement
    const svg = fallback.querySelector('svg') as SVGElement
    const spine = svg.querySelectorAll('[data-line-field-spine]')
    const lanes = Array.from(svg.querySelectorAll('[data-line-field-lane]'))

    expect(fallback.dataset.theme).toBe('light')
    expect(fallback.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('focusable')).toBe('false')
    expect(svg.getAttribute('viewBox')).toBe('0 0 160 1000')
    expect(spine).toHaveLength(1)
    expect(spine[0]?.getAttribute('d')).toMatch(/^M\s+([\d.]+)\s+[\d.]+\s+L\s+\1\s+[\d.]+$/)
    expect(lanes).toHaveLength(5)
    expect(lanes.map((lane) => lane.getAttribute('data-line-field-lane'))).toEqual(['0', '1', '2', '3', '4'])
    expect(svg.querySelector('animate, animateTransform')).toBeNull()
    expect(fallback.querySelector('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])')).toBeNull()

    for (const element of [fallback, svg, ...lanes]) {
      const style = getComputedStyle(element)
      expect(['', 'none']).toContain(style.animationName)
      expect(['', 'none']).toContain(style.transitionProperty)
    }

    rerender(<LandingLineFallback
      theme="light"
      geometry={{
        cssWidth: 192,
        cssHeight: 900,
        anchorLocalX: 24,
        anchorViewportY: 310,
        headerTargetViewportY: 80,
      }}
    />)
    expect(svg.getAttribute('viewBox')).toBe('0 0 192 900')
    expect(spine[0]?.getAttribute('d')).toBe('M 24 80 L 24 310')
    for (const lane of lanes) {
      expect(lane.getAttribute('d')).toMatch(/^M 24 310\b/)
    }

    rerender(<LandingLineFallback
      theme="dark"
      geometry={{
        cssWidth: 87,
        cssHeight: 844,
        anchorLocalX: 24,
        anchorViewportY: 280,
        headerTargetViewportY: 72,
      }}
    />)
    expect(svg.getAttribute('viewBox')).toBe('0 0 87 844')
    expect(spine[0]?.getAttribute('d')).toBe('M 24 72 L 24 280')
    for (const lane of lanes) {
      expect(lane.getAttribute('d')).toMatch(/^M 24 280\b/)
    }
  })
})

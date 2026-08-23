import { expect, test, type Page } from '@playwright/test'
import { build } from 'vite'
import { lineFieldConfig } from '../src/landing/line-field/config/line-field-config.generated'

interface PixelHarnessResult {
  readonly contextAttributes: WebGLContextAttributes | null
  readonly contextLostCalls: number
  readonly glError: number
  readonly pixels: readonly (readonly [number, number, number, number])[]
}

interface PixelHarnessOptions {
  readonly opacity?: number
  readonly revealProgress: number
  readonly originY?: number
  readonly isolatedLaneId?: number
  readonly samples: readonly (readonly [number, number])[]
  readonly theme?: 'dark' | 'light'
  readonly appearance?: 'geometry' | 'tip-geometry' | 'effects' | 'tail-alpha' | 'protected-line'
  readonly disableTipGlow?: boolean
  readonly disableSpecular?: boolean
  readonly mutateBodyColors?: boolean
  readonly mutateBodyMaterial?: boolean
  readonly useLegacyLightBodyReadability?: boolean
  readonly useLegacyLightBodyAbsorption?: boolean
  readonly mutateProtectedLine?: 'core-opacity' | 'halo-opacity' | 'halo-radius' | 'freshness'
}

let rendererModuleCode = ''

test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})

async function buildActualRendererModule(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    publicDir: false,
    root: process.cwd(),
    build: {
      emptyOutDir: false,
      lib: {
        entry: 'src/landing/line-field/renderer/LandingLineRenderer.ts',
        fileName: 'line-field-renderer',
        formats: ['es'],
      },
      minify: false,
      rollupOptions: {
        output: { inlineDynamicImports: true },
      },
      target: 'es2022',
      write: false,
    },
  }) as { output: readonly ({ code?: string; isEntry?: boolean; type: string })[] }
    | readonly { output: readonly ({ code?: string; isEntry?: boolean; type: string })[] }[]
  const outputs = Array.isArray(result) ? result : [result]
  const entry = outputs
    .flatMap((output) => output.output)
    .find((item) => item.type === 'chunk' && item.isEntry)
  if (!entry?.code) throw new Error('Vite did not emit the line-field renderer entry')
  return entry.code
}

function createPixelConfig(options: PixelHarnessOptions) {
  const appearance = options.appearance ?? 'geometry'
  const config = structuredClone(lineFieldConfig) as unknown as {
    theme: {
      tailOpacityAtTip: number
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
        baseOpacity: number
        lineAccent: [number, number, number]
        lineGlow: { opacity: number; radiusPx: number }
        linePrimary: [number, number, number]
        lineSecondary: [number, number, number]
        tipGlow: {
          diameterToLineWidth: number
          tailLengthToDiameter: number
          haloDiameterToHead: number
          opacity: number
          cyanMix: number
          pinkMix: number
          pulseHz: number
          pulseDepth: number
          secondaryPulseRatio: number
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
        baseOpacity: number
        linePrimary: [number, number, number]
        lineSecondary: [number, number, number]
        paperFiber: [number, number, number]
        tipInk: {
          wetColor: [number, number, number]
          diameterToLineWidth: number
          tailLengthToDiameter: number
          bleedDiameterToHead: number
          lineBleedRadiusPx: number
          irregularity: number
          absorptionOpacity: number
          specularOpacity: number
        }
      }
    }
  }
  if (appearance === 'geometry' || appearance === 'tip-geometry') {
    config.theme.dark.body.startColor = [1, 0, 0]
    config.theme.dark.body.middleColor = [1, 0, 0]
    config.theme.dark.body.endColor = [1, 0, 0]
    config.theme.dark.body.coreOpacity = appearance === 'tip-geometry' ? 0 : 1
    config.theme.dark.body.emissionOpacity = 0
    config.theme.dark.linePrimary = [1, 0, 0]
    config.theme.dark.lineSecondary = [1, 0, 0]
    config.theme.dark.lineAccent = [1, 0, 0]
    config.theme.dark.baseOpacity = appearance === 'tip-geometry' ? 0 : 1
    config.theme.dark.lineGlow.opacity = 0
    config.theme.dark.tipGlow.diameterToLineWidth = 1.75
    config.theme.dark.tipGlow.tailLengthToDiameter = 4
    config.theme.dark.tipGlow.haloDiameterToHead = 1
    config.theme.dark.tipGlow.pulseDepth = 0
  }
  if (appearance === 'tail-alpha') {
    // Isolate the new endpoint-material overlay from the protected accepted lane.
    // Production deliberately keeps that lane intact underneath the fading overlay.
    config.theme.tailOpacityAtTip = 0.1
    config.theme.dark.linePrimary = [1, 0, 0]
    config.theme.dark.lineSecondary = [1, 0, 0]
    config.theme.dark.lineAccent = [1, 0, 0]
    config.theme.dark.baseOpacity = -100
    config.theme.dark.body.coreOpacity = 0
    config.theme.dark.body.emissionOpacity = 0
    config.theme.dark.lineGlow.opacity = 0
    config.theme.dark.tipGlow.haloDiameterToHead = 1
    config.theme.dark.tipGlow.opacity = 0
    config.theme.dark.tipGlow.pulseDepth = 0
    config.theme.light.baseOpacity = -100
    config.theme.light.body.coreOpacity = 0
    config.theme.light.body.absorptionOpacity = 0
    config.theme.light.body.sheenOpacity = 0
    config.theme.light.tipInk.bleedDiameterToHead = 1
    config.theme.light.tipInk.irregularity = 0
    config.theme.light.tipInk.absorptionOpacity = 0
    config.theme.light.tipInk.specularOpacity = 0
  }
  if (appearance === 'protected-line') {
    // Keep the production endpoint path present but compact enough that these
    // samples exercise the accepted lane masks and their material weighting.
    config.theme.dark.tipGlow.diameterToLineWidth = 1
    config.theme.dark.tipGlow.tailLengthToDiameter = 1.25
    config.theme.dark.tipGlow.haloDiameterToHead = 1
    config.theme.dark.tipGlow.opacity = 0
    config.theme.light.tipInk.diameterToLineWidth = 1
    config.theme.light.tipInk.tailLengthToDiameter = 1.25
    config.theme.light.tipInk.bleedDiameterToHead = 1
    config.theme.light.tipInk.irregularity = 0
    config.theme.light.tipInk.specularOpacity = 0
  }
  if (options.disableTipGlow) config.theme.dark.tipGlow.opacity = 0
  if (options.disableSpecular) config.theme.light.tipInk.specularOpacity = 0
  if (options.mutateBodyColors || options.mutateBodyMaterial) {
    if (options.theme === 'light') {
      config.theme.light.body.wetBlueBlack = [0.97, 0.03, 0.01]
      config.theme.light.body.settledBlue = [0.91, 0.09, 0.02]
      config.theme.light.body.agedSepia = [0.83, 0.17, 0.03]
      config.theme.light.body.fadedWarmSepia = [0.75, 0.25, 0.04]
    } else {
      config.theme.dark.body.startColor = [0.01, 0.98, 0.02]
      config.theme.dark.body.middleColor = [0.02, 0.91, 0.03]
      config.theme.dark.body.endColor = [0.03, 0.84, 0.04]
    }
  }
  if (options.mutateBodyMaterial) {
    if (options.theme === 'light') {
      config.theme.light.body.coreOpacity = 0.91
      config.theme.light.body.freshTrailLengthPx = 13
      config.theme.light.body.fiberScalePx = 19
      config.theme.light.body.fiberStrength = 0.93
      config.theme.light.body.sheenOpacity = 0.49
      config.theme.light.body.absorptionRadiusPx = 23
      config.theme.light.body.absorptionOpacity = 0.49
    } else {
      config.theme.dark.body.coreOpacity = 0.19
      config.theme.dark.body.emissionOpacity = 0.91
      config.theme.dark.body.emissionRadiusPx = 23
      config.theme.dark.body.freshTrailLengthPx = 17
    }
  }
  if (options.useLegacyLightBodyReadability) {
    config.theme.light.body.coreOpacity = 0.44
    config.theme.light.body.absorptionOpacity = 0.14
  }
  if (options.useLegacyLightBodyAbsorption) {
    config.theme.light.body.absorptionOpacity = 0.14
  }
  if (options.mutateProtectedLine === 'core-opacity') {
    config.theme.dark.baseOpacity = 0.05
    config.theme.light.baseOpacity = 0.05
  }
  if (options.mutateProtectedLine === 'halo-opacity') {
    config.theme.dark.lineGlow.opacity = 0.01
    config.theme.light.tipInk.absorptionOpacity = 0.01
  }
  if (options.mutateProtectedLine === 'halo-radius') {
    config.theme.dark.lineGlow.radiusPx = 0.5
    config.theme.light.tipInk.lineBleedRadiusPx = 0.5
  }
  if (options.mutateProtectedLine === 'freshness') {
    config.theme.dark.tipGlow.freshTrailLengthPx = 8
    config.theme.light.tipInk.freshTrailLengthPx = 8
  }
  return config
}

function createPixelFrame(
  revealProgress: number,
  originY = 32,
  theme: PixelHarnessOptions['theme'] = 'dark',
  opacity = 1,
  isolatedLaneId?: number,
) {
  const tipOffsetsViewportFractions = Array.from(
    { length: 40 },
    (_, laneId) => isolatedLaneId === undefined || laneId === isolatedLaneId
      ? 0
      : -revealProgress,
  )

  return {
    mode: 'scroll-build',
    theme,
    anchorViewport: [64, originY],
    sourceOriginViewportFraction: originY / 128,
    headerTargetViewportY: 32,
    originDocumentY: originY,
    commonFrontDocumentY: originY + revealProgress * 128,
    upwardSpineReveal: 0,
    unwrappedPhase: 0,
    tipOffsetsViewportFractions,
    pointerProximity: 0,
    opacity,
    filmProgress: 1,
    mottoProgress: 0,
  }
}

async function renderActualPixels(
  page: Page,
  options: PixelHarnessOptions,
): Promise<{ result: PixelHarnessResult; shaderMessages: readonly string[] }> {
  const shaderMessages: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') {
      shaderMessages.push(`${message.type()}: ${message.text()}`)
    }
  })
  await page.route('**/__line-field-renderer.js', async (route) => {
    await route.fulfill({
      body: rendererModuleCode,
      contentType: 'application/javascript',
      headers: { 'cache-control': 'no-store' },
    })
  })
  await page.route('**/__line-field-renderer-harness.html', async (route) => {
    await route.fulfill({
      body: '<!doctype html><html><body><div id="renderer-host"></div></body></html>',
      contentType: 'text/html',
      headers: { 'cache-control': 'no-store' },
    })
  })
  await page.goto('./__line-field-renderer-harness.html')

  const result = await page.evaluate(async ({ config, frame, samples }) => {
    const module = await import('./__line-field-renderer.js')
    const host = document.querySelector('#renderer-host') as HTMLElement
    let contextLostCalls = 0
    const renderer = module.createLandingLineRenderer(host, {
      onContextLost: () => { contextLostCalls += 1 },
    })
    renderer.resize(128, 128, 1, {
      maximumDpr: 1,
      maximumRenderDimensionPx: 128,
    })
    renderer.render(frame, config)
    const canvas = host.querySelector('canvas') as HTMLCanvasElement
    const gl = canvas.getContext('webgl2')
    if (!gl) throw new Error('Expected the production renderer to retain WebGL2')
    gl.finish()
    const pixels = samples.map(([cssPixelX, cssPixelY]) => {
      const pixel = new Uint8Array(4)
      gl.readPixels(cssPixelX, canvas.height - 1 - cssPixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
      return Array.from(pixel) as [number, number, number, number]
    })
    const glError = gl.getError()
    const contextAttributes = gl.getContextAttributes()
    renderer.dispose()
    return { contextAttributes, contextLostCalls, glError, pixels }
  }, {
    config: createPixelConfig(options),
    frame: createPixelFrame(
      options.revealProgress,
      options.originY,
      options.theme,
      options.opacity,
      options.isolatedLaneId,
    ),
    samples: options.samples,
  })

  return { result, shaderMessages }
}

test.beforeAll(async () => {
  rendererModuleCode = await buildActualRendererModule()
})

test('production WebGL2 renderer draws the accepted p=0 centerline at its independent golden position', async ({ page }) => {
  const { result, shaderMessages } = await renderActualPixels(page, {
    revealProgress: 1,
    // At source x=.7 and t=0, the independent Binary32 oracle gives y=.4331173897.
    // With origin (64,32), length 128, and the accepted 9:12 lateral scale this
    // lands near CSS pixel (58,122).
    samples: [[58, 122], [5, 122]],
  })
  const [red, green, blue, alpha] = result.pixels[0] ?? []
  const outside = result.pixels[1] ?? [0, 0, 0, 0]

  expect(shaderMessages).toEqual([])
  expect(result.glError).toBe(0)
  expect(result.contextLostCalls).toBe(0)
  expect(red).toBeGreaterThanOrEqual(240)
  expect(green).toBeLessThanOrEqual(4)
  expect(blue).toBeLessThanOrEqual(4)
  expect(alpha).toBeGreaterThanOrEqual(220)
  expect(outside[3]).toBe(0)
  expect(result.contextAttributes).toMatchObject({
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
  })
})

test('production WebGL2 renderer hard-trims the field instead of fading future geometry', async ({ page }) => {
  const { result, shaderMessages } = await renderActualPixels(page, {
    revealProgress: 0.5,
    samples: [
      [58, 122], // lower source x=.7: beyond the trim, therefore absent
      [65, 64], // lower source x=.25: already revealed and fully present
      [57, 96], // p=0 lower endpoint at source x=.5
    ],
  })
  const futureLower = result.pixels[0] ?? [0, 0, 0, 0]
  const liveInterior = result.pixels[1] ?? [0, 0, 0, 0]
  const liveEndpoint = result.pixels[2] ?? [0, 0, 0, 0]

  expect(shaderMessages).toEqual([])
  expect(result.glError).toBe(0)
  expect(futureLower[3]).toBe(0)
  expect(liveInterior[3]).toBeGreaterThan(0)
  expect(liveEndpoint[3]).toBeGreaterThan(0)
})

test('motion visibility can fully gather the accepted field without changing its geometry', async ({ page }) => {
  const visible = await renderActualPixels(page, {
    opacity: 1,
    revealProgress: 0.5,
    samples: [[65, 64], [57, 96]],
  })
  const gathered = await renderActualPixels(page, {
    opacity: 0,
    revealProgress: 0.5,
    samples: [[65, 64], [57, 96]],
  })

  expect(visible.shaderMessages).toEqual([])
  expect(gathered.shaderMessages).toEqual([])
  expect(visible.result.pixels[0]?.[3]).toBeGreaterThan(0)
  expect(visible.result.pixels[1]?.[3]).toBeGreaterThan(0)
  expect(gathered.result.pixels[0]?.[3]).toBe(0)
  expect(gathered.result.pixels[1]?.[3]).toBe(0)
})

test('production WebGL2 renderer preserves the 40 overlapping amplitudeless upper threads', async ({ page }) => {
  const { result, shaderMessages } = await renderActualPixels(page, {
    revealProgress: 0.5,
    originY: 96,
    samples: [
      [66, 64], // independent 40-thread union oracle: alpha about .477
      [64, 16], // upper source x=.625: beyond the hard trim
      [64, 32], // overlapping upper endpoint globes at source x=.5
    ],
  })
  const upperEdge = result.pixels[0] ?? [0, 0, 0, 0]
  const futureUpper = result.pixels[1] ?? [0, 0, 0, 0]
  const upperEndpoint = result.pixels[2] ?? [0, 0, 0, 0]

  expect(shaderMessages).toEqual([])
  expect(result.glError).toBe(0)
  expect(upperEdge[3]).toBeGreaterThanOrEqual(110)
  expect(upperEdge[3]).toBeLessThanOrEqual(135)
  expect(futureUpper[3]).toBe(0)
  expect(upperEndpoint[3]).toBeGreaterThanOrEqual(220)
})

test('production WebGL2 renderer carries the endpoint beyond one source length without clamping it', async ({ page }) => {
  const { result, shaderMessages } = await renderActualPixels(page, {
    revealProgress: 1.25,
    originY: -64,
    samples: [
      [64, 96], // p=0 lower endpoint: -64 + 1.25 * 128 = 96
      [64, 64], // the old clamp-to-one endpoint; now only ordinary field geometry
    ],
  })
  const continuedEndpoint = result.pixels[0] ?? [0, 0, 0, 0]

  expect(shaderMessages).toEqual([])
  expect(result.glError).toBe(0)
  expect(continuedEndpoint[3]).toBeGreaterThanOrEqual(220)
})

test('body-only mutations change the body but leave endpoint bytes and protected alpha masks unchanged', async ({ page }) => {
  for (const theme of ['dark', 'light'] as const) {
    const options = {
      appearance: 'effects' as const,
      revealProgress: 0.5,
      theme,
      isolatedLaneId: 0,
      samples: [[65, 64], [57, 96], [70, 64], [5, 64]] as const,
    }
    const baseline = await renderActualPixels(page, options)
    const mutated = await renderActualPixels(page, { ...options, mutateBodyColors: true })
    const fullyMutated = await renderActualPixels(page, { ...options, mutateBodyMaterial: true })
    const [baselineBody, baselineEndpoint, baselineDepthEdge, baselineOutside] = baseline.result.pixels
    const [mutatedBody, mutatedEndpoint, mutatedDepthEdge, mutatedOutside] = mutated.result.pixels

    expect(baseline.shaderMessages).toEqual([])
    expect(mutated.shaderMessages).toEqual([])
    expect(fullyMutated.shaderMessages).toEqual([])
    expect(mutatedBody).not.toEqual(baselineBody)
    expect(mutatedEndpoint).toEqual(baselineEndpoint)
    expect(fullyMutated.result.pixels[1]).toEqual(baselineEndpoint)
    expect(mutatedBody?.[3]).toBe(baselineBody?.[3])
    expect(mutatedDepthEdge?.[3]).toBe(baselineDepthEdge?.[3])
    expect(mutatedOutside).toEqual(baselineOutside)
  }
})

test('light readability calibration materially strengthens the body core without changing endpoint bytes', async ({ page }) => {
  const options = {
    appearance: 'effects' as const,
    revealProgress: 0.5,
    theme: 'light' as const,
    isolatedLaneId: 0,
    samples: [
      [65, 64], // representative aged body core at source x=.25
      [57, 96], // frozen wet-ink endpoint
      [5, 64], // outside the protected field
    ] as const,
  }
  const calibrated = await renderActualPixels(page, options)
  const legacy = await renderActualPixels(page, {
    ...options,
    useLegacyLightBodyReadability: true,
  })
  const [calibratedCore, calibratedEndpoint, calibratedOutside] = calibrated.result.pixels
  const [legacyCore, legacyEndpoint, legacyOutside] = legacy.result.pixels

  expect(calibrated.shaderMessages).toEqual([])
  expect(legacy.shaderMessages).toEqual([])
  expect(calibrated.result.glError).toBe(0)
  expect(legacy.result.glError).toBe(0)
  expect(calibratedCore?.[3]).toBeGreaterThanOrEqual((legacyCore?.[3] ?? 0) + 10)
  expect(calibratedEndpoint).toEqual(legacyEndpoint)
  expect(calibratedOutside).toEqual(legacyOutside)
})

test('light absorption calibration independently restrains the body fringe without changing endpoint bytes', async ({ page }) => {
  const options = {
    appearance: 'effects' as const,
    revealProgress: 0.5,
    theme: 'light' as const,
    isolatedLaneId: 0,
    samples: [
      [70, 64], // body-only absorption fringe outside the representative core
      [57, 96], // frozen wet-ink endpoint
      [5, 64], // outside the protected field
    ] as const,
  }
  const calibrated = await renderActualPixels(page, options)
  const legacyAbsorption = await renderActualPixels(page, {
    ...options,
    useLegacyLightBodyAbsorption: true,
  })
  const [calibratedFringe, calibratedEndpoint, calibratedOutside] = calibrated.result.pixels
  const [legacyFringe, legacyEndpoint, legacyOutside] = legacyAbsorption.result.pixels

  expect(calibrated.shaderMessages).toEqual([])
  expect(legacyAbsorption.shaderMessages).toEqual([])
  expect(calibrated.result.glError).toBe(0)
  expect(legacyAbsorption.result.glError).toBe(0)
  expect(calibratedFringe?.[3]).toBeLessThan(legacyFringe?.[3] ?? 0)
  expect(calibratedEndpoint).toEqual(legacyEndpoint)
  expect(calibratedOutside).toEqual(legacyOutside)
})

test('accepted core, halo, depth, and freshness controls remain live under full body mutation', async ({ page }) => {
  const samples = [
    [65, 64], // accepted p=0 core at source x=.25
    [70, 64], // accepted p=0 depth-weighted halo shoulder
    [60, 84], // near-front accepted core/freshness landmark
    [66, 84], // near-front accepted halo/freshness landmark
  ] as const

  for (const theme of ['dark', 'light'] as const) {
    const options = {
      appearance: 'protected-line' as const,
      revealProgress: 0.5,
      theme,
      isolatedLaneId: 0,
      mutateBodyMaterial: true,
      samples,
    }
    const baseline = await renderActualPixels(page, options)
    const coreOpacity = await renderActualPixels(page, {
      ...options,
      mutateProtectedLine: 'core-opacity',
    })
    const haloOpacity = await renderActualPixels(page, {
      ...options,
      mutateProtectedLine: 'halo-opacity',
    })
    const haloRadius = await renderActualPixels(page, {
      ...options,
      mutateProtectedLine: 'halo-radius',
    })
    const freshness = await renderActualPixels(page, {
      ...options,
      mutateProtectedLine: 'freshness',
    })

    expect(baseline.shaderMessages).toEqual([])
    expect(coreOpacity.shaderMessages).toEqual([])
    expect(haloOpacity.shaderMessages).toEqual([])
    expect(haloRadius.shaderMessages).toEqual([])
    expect(freshness.shaderMessages).toEqual([])
    expect(coreOpacity.result.pixels[0]?.[3]).toBeLessThan(baseline.result.pixels[0]?.[3] ?? 0)
    expect(haloOpacity.result.pixels[1]?.[3]).toBeLessThan(baseline.result.pixels[1]?.[3] ?? 0)
    // The wide body mask is a separate fringe: shrinking the accepted halo
    // exposes more of that fringe instead of redefining lineHaloAlpha itself.
    expect(haloRadius.result.pixels[1]?.[3]).toBeGreaterThan(baseline.result.pixels[1]?.[3] ?? 255)
    expect(freshness.result.pixels[2]?.[3]).toBeLessThan(baseline.result.pixels[2]?.[3] ?? 0)
    expect(freshness.result.pixels[3]?.[3]).toBeLessThan(baseline.result.pixels[3]?.[3] ?? 0)
  }
})

test('a nonzero-p lane retains accepted core and halo depth under full body mutation', async ({ page }) => {
  for (const theme of ['dark', 'light'] as const) {
    const common = {
      appearance: 'protected-line' as const,
      revealProgress: 0.5,
      theme,
      mutateBodyMaterial: true,
    }
    const frontLane = await renderActualPixels(page, {
      ...common,
      isolatedLaneId: 0,
      samples: [[65, 64], [70, 64]],
    })
    const depthLane = await renderActualPixels(page, {
      ...common,
      isolatedLaneId: 4,
      samples: [[64, 64], [69, 64]],
    })
    const [frontCore, frontHalo] = frontLane.result.pixels
    const [depthCore, depthHalo] = depthLane.result.pixels
    const expectedDepthAlpha = theme === 'dark'
      ? { core: [24, 28], halo: [22, 26] }
      : { core: [64, 68], halo: [30, 34] }

    expect(frontLane.shaderMessages).toEqual([])
    expect(depthLane.shaderMessages).toEqual([])
    expect(depthCore?.[3]).toBeGreaterThan(0)
    expect(depthHalo?.[3]).toBeGreaterThan(0)
    // For lane 4, p=.10 and the accepted depth law gives threadWeight
    // 1-smoothstep(0,1,p^.3)=.498219. These literal SwiftShader windows pin
    // the resulting production core/halo alpha without reusing renderer math.
    expect(depthCore?.[3]).toBeGreaterThanOrEqual(expectedDepthAlpha.core[0])
    expect(depthCore?.[3]).toBeLessThanOrEqual(expectedDepthAlpha.core[1])
    expect(depthHalo?.[3]).toBeGreaterThanOrEqual(expectedDepthAlpha.halo[0])
    expect(depthHalo?.[3]).toBeLessThanOrEqual(expectedDepthAlpha.halo[1])
    expect(depthCore?.[3]).toBeLessThan((frontCore?.[3] ?? 0) * 0.75)
    expect(depthHalo?.[3]).toBeLessThan((frontHalo?.[3] ?? 0) * 0.75)
  }
})

test('dark material keeps a compact comet footprint instead of restoring the old oversized globe', async ({ page }) => {
  const { result, shaderMessages } = await renderActualPixels(page, {
    appearance: 'effects',
    revealProgress: 0.5,
    theme: 'dark',
    isolatedLaneId: 0,
    samples: [
      [57, 96], // p=0 circular comet head
      [63, 93], // widened tangent shoulder behind the head
      [64, 100], // compact colored halo around the head
      [69, 103], // inside the old 25 px-radius globe, outside the new compact halo
      [90, 96], // far outside the endpoint effect
    ],
  })
  const head = result.pixels[0] ?? [0, 0, 0, 0]
  const tangentShoulder = result.pixels[1] ?? [0, 0, 0, 0]
  const compactHalo = result.pixels[2] ?? [0, 0, 0, 0]
  const oldGlobeFootprint = result.pixels[3] ?? [0, 0, 0, 0]
  const outside = result.pixels[4] ?? [0, 0, 0, 0]

  expect(shaderMessages).toEqual([])
  expect(result.glError).toBe(0)
  expect(Math.min(head[0], head[1], head[2])).toBeGreaterThanOrEqual(210)
  expect(head[3]).toBeGreaterThanOrEqual(160)
  expect(tangentShoulder[3]).toBeGreaterThan(0)
  expect(compactHalo[3]).toBeGreaterThanOrEqual(5)
  expect(compactHalo[0]).toBeGreaterThan(compactHalo[1])
  expect(compactHalo[2]).toBeGreaterThan(compactHalo[1])
  expect(oldGlobeFootprint[3]).toBe(0)
  expect(outside[3]).toBe(0)
})

test('light material renders a compact wet-ink drop and leaves the old globe footprint empty', async ({ page }) => {
  const { result, shaderMessages } = await renderActualPixels(page, {
    appearance: 'effects',
    revealProgress: 0.5,
    theme: 'light',
    isolatedLaneId: 0,
    samples: [
      [57, 96], // circular wet-ink head
      [55, 96], // small reflected highlight inside the wet head
      [63, 93], // short tangent ink pull behind the head
      [62, 99], // compact paper-soft edge
      [66, 102], // inside the old 15 px-radius globe, outside the new drop
      [65, 64], // accepted body at source x=.25: old, absorbed line
    ],
  })
  const wetHead = result.pixels[0] ?? [0, 0, 0, 0]
  const reflectedHighlight = result.pixels[1] ?? [0, 0, 0, 0]
  const tangentPull = result.pixels[2] ?? [0, 0, 0, 0]
  const compactBleed = result.pixels[3] ?? [0, 0, 0, 0]
  const oldGlobeFootprint = result.pixels[4] ?? [0, 0, 0, 0]
  const agedBody = result.pixels[5] ?? [0, 0, 0, 0]

  expect(shaderMessages).toEqual([])
  expect(result.glError).toBe(0)
  expect(wetHead[2]).toBeGreaterThan(wetHead[0])
  expect(wetHead[2]).toBeGreaterThan(wetHead[1])
  expect(wetHead[2]).toBeLessThan(120)
  expect(wetHead[3]).toBeGreaterThanOrEqual(180)
  expect(Math.max(...reflectedHighlight.slice(0, 3)))
    .toBeGreaterThan(Math.max(...wetHead.slice(0, 3)))
  expect(tangentPull[2]).toBeGreaterThan(tangentPull[0])
  expect(tangentPull[3]).toBeGreaterThan(0)
  expect(compactBleed[2]).toBeGreaterThan(compactBleed[0])
  expect(compactBleed[3]).toBeGreaterThanOrEqual(5)
  expect(oldGlobeFootprint[3]).toBe(0)
  expect(agedBody[0]).toBeGreaterThan(agedBody[2])
  expect(agedBody[3]).toBeGreaterThan(0)
})

test('both endpoint-material tail overlays fade linearly from head contact toward a 0.1 tip', async ({ page }) => {
  const samples = {
    // Dark's 4-diameter tail is 36.75 px long in this oracle.
    dark: [[64, 72], [64, 81], [64, 90], [64, 96]],
    // Light's 3-diameter tail is 27.56 px long, so sample the same
    // normalized progress positions closer to the circular head.
    light: [[64, 70], [64, 77], [64, 84], [64, 88]],
  } as const
  const expectedAlpha = {
    dark: [208, 151, 94, 56],
    light: [200, 145, 90, 54],
  } as const

  for (const theme of ['dark', 'light'] as const) {
    const { result, shaderMessages } = await renderActualPixels(page, {
      appearance: 'tail-alpha',
      revealProgress: 0.5,
      originY: 128,
      theme,
      isolatedLaneId: 0,
      samples: samples[theme],
    })
    const alphas = result.pixels.map((pixel) => pixel[3])

    expect(shaderMessages).toEqual([])
    expect(result.glError).toBe(0)
    expect(alphas[0]).toBeGreaterThan(alphas[1] ?? 0)
    expect(alphas[1]).toBeGreaterThan(alphas[2] ?? 0)
    expect(alphas[2]).toBeGreaterThan(alphas[3] ?? 0)
    expectedAlpha[theme].forEach((expected, index) => {
      expect(Math.abs((alphas[index] ?? 0) - expected)).toBeLessThanOrEqual(32)
    })
  }
})

test('dark comet glow is a material layer that can vanish without removing its compact head', async ({ page }) => {
  const live = await renderActualPixels(page, {
    appearance: 'effects',
    revealProgress: 0.5,
    theme: 'dark',
    isolatedLaneId: 0,
    samples: [[64, 100], [57, 96]],
  })
  const withoutGlow = await renderActualPixels(page, {
    appearance: 'effects',
    disableTipGlow: true,
    revealProgress: 0.5,
    theme: 'dark',
    isolatedLaneId: 0,
    samples: [[64, 100], [57, 96]],
  })
  const liveHalo = live.result.pixels[0] ?? [0, 0, 0, 0]
  const disabledHalo = withoutGlow.result.pixels[0] ?? [0, 0, 0, 0]
  const disabledHead = withoutGlow.result.pixels[1] ?? [0, 0, 0, 0]

  expect(live.shaderMessages).toEqual([])
  expect(withoutGlow.shaderMessages).toEqual([])
  expect(liveHalo[3]).toBeGreaterThan(disabledHalo[3] + 20)
  expect(disabledHead[3]).toBeGreaterThanOrEqual(150)
})

test('light wet-ink reflection can vanish without changing the dark blue drop body', async ({ page }) => {
  const live = await renderActualPixels(page, {
    appearance: 'effects',
    revealProgress: 0.5,
    theme: 'light',
    isolatedLaneId: 0,
    samples: [[55, 96], [57, 96]],
  })
  const withoutSpecular = await renderActualPixels(page, {
    appearance: 'effects',
    disableSpecular: true,
    revealProgress: 0.5,
    theme: 'light',
    isolatedLaneId: 0,
    samples: [[55, 96], [57, 96]],
  })
  const liveReflection = live.result.pixels[0] ?? [0, 0, 0, 0]
  const disabledReflection = withoutSpecular.result.pixels[0] ?? [0, 0, 0, 0]
  const liveBody = live.result.pixels[1] ?? [0, 0, 0, 0]
  const disabledBody = withoutSpecular.result.pixels[1] ?? [0, 0, 0, 0]

  expect(live.shaderMessages).toEqual([])
  expect(withoutSpecular.shaderMessages).toEqual([])
  expect(Math.max(...liveReflection.slice(0, 3)))
    .toBeGreaterThan(Math.max(...disabledReflection.slice(0, 3)) + 30)
  disabledBody.forEach((channel, index) => {
    expect(Math.abs(channel - (liveBody[index] ?? 0))).toBeLessThanOrEqual(6)
  })
})

test('the circular head is about 1.75 times the local accepted lane width', async ({ page }) => {
  const { result, shaderMessages } = await renderActualPixels(page, {
    appearance: 'tip-geometry',
    revealProgress: 0.5,
    theme: 'dark',
    isolatedLaneId: 0,
    samples: [
      // p=0 lane width = 7 * (96 / 128) = 5.25 px. At the authored
      // 1.75 ratio the head radius is 4.59375 px around (57.22, 96).
      [60, 98], // about 4.1 px from the center: still inside the circular head
      [62, 99], // about 6.3 px from the center: beyond the compact head
    ],
  })
  const insideHead = result.pixels[0] ?? [0, 0, 0, 0]
  const beyondHead = result.pixels[1] ?? [0, 0, 0, 0]

  expect(shaderMessages).toEqual([])
  expect(result.glError).toBe(0)
  expect(insideHead[3]).toBeGreaterThan(0)
  expect(beyondHead[3]).toBe(0)
})

test('the isolated endpoint has a full circular head and a tail that follows lane curvature instead of a rigid chord', async ({ page }) => {
  const { result, shaderMessages } = await renderActualPixels(page, {
    appearance: 'tip-geometry',
    revealProgress: 0.5,
    theme: 'dark',
    isolatedLaneId: 4,
    samples: [
      [54, 96], // p=.1 head center
      [53, 99], // forward half of the full circle, ahead of the moving front
      [63, 82], // curved tail center 15 px behind the head
      [56, 81], // where a rigid triangular chord would continue instead
    ],
  })
  const head = result.pixels[0] ?? [0, 0, 0, 0]
  const forwardCircle = result.pixels[1] ?? [0, 0, 0, 0]
  const curvedTail = result.pixels[2] ?? [0, 0, 0, 0]
  const rigidChord = result.pixels[3] ?? [0, 0, 0, 0]

  expect(shaderMessages).toEqual([])
  expect(result.glError).toBe(0)
  expect(head[3]).toBeGreaterThanOrEqual(100)
  expect(forwardCircle[3]).toBeGreaterThan(0)
  expect(curvedTail[3]).toBeGreaterThan(0)
  expect(rigidChord[3]).toBe(0)
})

test('the endpoint effect dissolves as its center crosses the viewport edge', async ({ page }) => {
  const live = await renderActualPixels(page, {
    appearance: 'effects',
    revealProgress: 0.5,
    originY: 32,
    theme: 'dark',
    samples: [[69, 96]],
  })
  const crossing = await renderActualPixels(page, {
    appearance: 'effects',
    revealProgress: 0.5,
    originY: 56,
    theme: 'dark',
    samples: [[69, 120]],
  })
  const liveHaloAlpha = live.result.pixels[0]?.[3] ?? 0
  const crossingHaloAlpha = crossing.result.pixels[0]?.[3] ?? 0

  expect(live.shaderMessages).toEqual([])
  expect(crossing.shaderMessages).toEqual([])
  expect(liveHaloAlpha).toBeGreaterThan(crossingHaloAlpha)
  expect(crossingHaloAlpha).toBeGreaterThan(0)
})

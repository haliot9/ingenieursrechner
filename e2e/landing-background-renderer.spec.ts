import { expect, test } from '@playwright/test'
import { build } from 'vite'
import { landingBackgroundConfig } from '../src/landing/background/config/landing-background-config.generated'

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
        entry: 'src/landing/background/renderer/LandingBackgroundRenderer.ts',
        fileName: 'landing-background-renderer',
        formats: ['es'],
      },
      minify: false,
      rollupOptions: { output: { inlineDynamicImports: true } },
      target: 'es2022',
      write: false,
    },
  }) as { output: readonly ({ code?: string; isEntry?: boolean; type: string })[] }
    | readonly { output: readonly ({ code?: string; isEntry?: boolean; type: string })[] }[]
  const outputs = Array.isArray(result) ? result : [result]
  const entry = outputs
    .flatMap(output => output.output)
    .find(item => item.type === 'chunk' && item.isEntry)
  if (!entry?.code) throw new Error('Vite did not emit the landing background renderer entry')
  return entry.code
}

test.beforeAll(async () => {
  rendererModuleCode = await buildActualRendererModule()
})

test('production Dark renderer is seeded, perspective-sized, and WebGL-clean', async ({ page }) => {
  const shaderMessages: string[] = []
  page.on('console', message => {
    if (
      (message.type() === 'error' || message.type() === 'warning')
      && /webgl|shader|program/i.test(message.text())
    ) shaderMessages.push(message.text())
  })
  await page.route('**/__landing-background-renderer.js', route => route.fulfill({
    body: rendererModuleCode,
    contentType: 'text/javascript',
  }))
  await page.route('**/__landing-background-renderer-harness.html', route => route.fulfill({
    body: '<!doctype html><main id="renderer-host"></main>',
    contentType: 'text/html',
  }))
  await page.goto('./__landing-background-renderer-harness.html')

  const evidence = await page.evaluate(async config => {
    const module = await import('./__landing-background-renderer.js')
    const readSnapshot = (host: HTMLElement) => {
      const canvas = host.querySelector('canvas') as HTMLCanvasElement
      const gl = canvas.getContext('webgl2')
      if (!gl) throw new Error('Expected the production background renderer to retain WebGL2')
      gl.finish()
      const pixels = new Uint8Array(canvas.width * canvas.height * 4)
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      const alphaValues = Array.from({ length: pixels.length / 4 }, (_, index) => pixels[index * 4 + 3])
      const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null
      if (!currentProgram) throw new Error('Expected the production renderer program to remain current')
      const readMatrix = (name: string) => {
        const location = gl.getUniformLocation(currentProgram, name)
        const value = location && gl.getUniform(currentProgram, location)
        if (!(value instanceof Float32Array)) throw new Error(`Expected live ${name} matrix`)
        return Array.from(value)
      }
      return {
        alphaValues,
        canvasCount: host.querySelectorAll('canvas').length,
        contextAttributes: gl.getContextAttributes(),
        glError: gl.getError(),
        modelViewMatrix: readMatrix('modelViewMatrix'),
        nontransparentPixels: alphaValues.filter(alpha => alpha > 0).length,
        opaqueCorePixels: alphaValues.filter(alpha => alpha > 192).length,
        projectionMatrix: readMatrix('projectionMatrix'),
      }
    }
    const renderSnapshot = (
      elapsedSeconds: number,
      snapshotConfig: typeof config = config,
    ) => {
      const host = document.createElement('div')
      document.body.append(host)
      const renderer = module.createLandingBackgroundRenderer(host, snapshotConfig)
      renderer.resize(192, 128, 1)
      renderer.render({ elapsedSeconds, pointer: [0, 0] })
      const snapshot = readSnapshot(host)
      renderer.dispose()
      const canvasCountAfterDispose = host.querySelectorAll('canvas').length
      host.remove()
      return { ...snapshot, canvasCountAfterDispose }
    }
    const snapshots = [
      renderSnapshot(0),
      renderSnapshot(0),
      renderSnapshot(6.25),
      renderSnapshot(6.25),
      renderSnapshot(0, { ...config, spread: config.spread * 2 }),
      renderSnapshot(12, { ...config, speed: 0, rotationSpeed: 0.03 }),
      renderSnapshot(12, { ...config, speed: 0, rotationSpeed: 0.03 }),
      renderSnapshot(12, { ...config, speed: 0, rotationSpeed: 0 }),
    ]

    const liveHost = document.createElement('div')
    document.body.append(liveHost)
    const liveRenderer = module.createLandingBackgroundRenderer(liveHost, {
      ...config,
      speed: 0,
      rotationSpeed: 0,
    })
    const captureResize = (width: number, height: number) => {
      liveRenderer.resize(width, height, 1)
      liveRenderer.render({ elapsedSeconds: 0, pointer: [0, 0] })
      return readSnapshot(liveHost)
    }
    const liveResize = [
      captureResize(192, 64),
      captureResize(64, 192),
      captureResize(192, 64),
    ]
    liveRenderer.dispose()
    liveHost.remove()

    return { liveResize, snapshots }
  }, landingBackgroundConfig.dark)
  const { liveResize, snapshots } = evidence

  expect(shaderMessages).toEqual([])
  expect(snapshots[0]?.glError).toBe(0)
  expect(snapshots[0]?.canvasCount).toBe(1)
  expect(snapshots[0]?.canvasCountAfterDispose).toBe(0)
  expect(snapshots[0]?.contextAttributes).toMatchObject({
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
  })
  expect(snapshots[0]?.nontransparentPixels).toBeGreaterThan(100)
  expect(snapshots[0]?.opaqueCorePixels).toBeGreaterThan(5)
  expect(snapshots[1]?.alphaValues).toEqual(snapshots[0]?.alphaValues)
  expect(snapshots[3]?.alphaValues).toEqual(snapshots[2]?.alphaValues)
  expect(snapshots[2]?.alphaValues).not.toEqual(snapshots[0]?.alphaValues)
  expect(snapshots[4]?.nontransparentPixels).toBeLessThan(
    snapshots[0]?.nontransparentPixels ?? 0,
  )
  expect(snapshots[6]?.alphaValues).toEqual(snapshots[5]?.alphaValues)
  expect(snapshots[7]?.alphaValues).not.toEqual(snapshots[5]?.alphaValues)

  const [wideFirst, tall, wideReturn] = liveResize
  expect(wideReturn?.alphaValues).toEqual(wideFirst?.alphaValues)
  expect(wideReturn?.projectionMatrix).toEqual(wideFirst?.projectionMatrix)
  expect(tall?.alphaValues).not.toEqual(wideFirst?.alphaValues)
  expect(-(wideFirst?.modelViewMatrix[14] ?? 0)).toBeCloseTo(6.478134190294924, 5)
  expect(-(tall?.modelViewMatrix[14] ?? 0)).toBeCloseTo(13.330266437217695, 5)
  const wideNear = (wideFirst?.projectionMatrix[14] ?? 0)
    / ((wideFirst?.projectionMatrix[10] ?? 0) - 1)
  const tallNear = (tall?.projectionMatrix[14] ?? 0)
    / ((tall?.projectionMatrix[10] ?? 0) - 1)
  expect(wideNear).toBeCloseTo(1.3094991620338494, 5)
  expect(tallNear).toBeCloseTo(5.7274175278631345, 5)
})

test('landing page keeps one configurable glass background relative to the line field', async ({ page }) => {
  const runtimeErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })
  page.on('pageerror', error => runtimeErrors.push(error.message))
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' })
  await page.goto('./')

  const background = page.locator('.landing-background-field')
  const lineField = page.locator('.landing-line-field')
  const transitionControl = page.getByRole('button', { name: 'Light Mode aktivieren' })
  // The product contract is a 220 ms dissolve followed by a 300 ms reassembly.
  // Keep event delivery bounded while allowing headless SwiftShader scheduling slack.
  const transitionEventTimeoutMs = 5_000
  await expect(background).toHaveCount(1, { timeout: 15_000 })
  await expect(background).toHaveAttribute('data-background-theme', 'dark')
  await expect(background).toHaveAttribute('data-background-layer', 'below-wavefield')
  await expect(background).toHaveAttribute('data-background-status', 'ready', { timeout: 15_000 })
  await expect(background.locator('canvas')).toHaveCount(1, { timeout: 15_000 })
  await expect(lineField).toHaveCount(1)
  expect(await background.evaluate((node, lineSelector) => {
    const line = document.querySelector(lineSelector)
    return Boolean(line && (node.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING))
  }, '.landing-line-field')).toBe(true)
  const backgroundStyle = await background.evaluate(node => {
    const style = getComputedStyle(node)
    return {
      clipPath: style.clipPath,
      filter: style.filter,
      height: style.height,
      inset: style.inset,
      isolation: style.isolation,
      opacity: style.opacity,
      pointerEvents: style.pointerEvents,
      position: style.position,
      transform: style.transform,
      width: style.width,
      zIndex: style.zIndex,
    }
  })
  expect(backgroundStyle).toMatchObject({
    clipPath: 'none',
    filter: 'none',
    inset: '0px',
    isolation: 'auto',
    opacity: '1',
    pointerEvents: 'none',
    position: 'fixed',
    transform: 'none',
    zIndex: '0',
  })
  expect(Number.parseFloat(backgroundStyle.width)).toBe(page.viewportSize()?.width)
  expect(Number.parseFloat(backgroundStyle.height)).toBe(page.viewportSize()?.height)
  expect(await lineField.evaluate(node => getComputedStyle(node).zIndex)).toBe('0')

  await transitionControl.click()
  await expect(transitionControl).toHaveAttribute(
    'data-phase',
    'dissolving',
    { timeout: transitionEventTimeoutMs },
  )
  await expect(background).toHaveAttribute(
    'data-background-theme',
    'light',
    { timeout: transitionEventTimeoutMs },
  )
  await expect(page.getByRole('button', { name: 'Dark Mode aktivieren' })).toHaveAttribute(
    'data-phase',
    'idle',
    { timeout: transitionEventTimeoutMs },
  )
  await expect(background.locator('canvas')).toHaveCount(0)
  await expect(background).toHaveAttribute('data-background-layer', 'above-wavefield')
  const glass = background.locator('[data-background-branch="light"][data-glass-surface]')
  await expect(glass).toHaveCount(1)
  await expect(glass).toHaveAttribute('data-glass-layer', 'above-wavefield')
  const lightSvg = glass.locator('svg[data-glass-filter]')
  await expect(lightSvg).toHaveCount(1)
  await expect(lightSvg.locator('feTurbulence')).toHaveCount(0)
  await expect(lightSvg.locator('feImage')).toHaveAttribute('href', /^data:image\/svg\+xml,/)
  await expect(lightSvg.locator('feDisplacementMap')).toHaveCount(3)
  await expect(lightSvg.locator('feGaussianBlur')).toHaveAttribute('stdDeviation', '0')
  expect(await lightSvg.locator('feDisplacementMap').evaluateAll(nodes => (
    nodes.map(node => node.getAttribute('scale'))
  ))).toEqual(['-180', '-170', '-160'])

  const viewport = page.viewportSize()
  if (!viewport) throw new Error('Glass geometry requires an explicit viewport')
  const glassRect = await glass.boundingBox()
  if (!glassRect) throw new Error('Missing rendered Light glass bounds')
  expect(glassRect.width).toBeCloseTo(viewport.width * 0.4, 0)
  expect(glassRect.height).toBeCloseTo(viewport.height * 0.8, 0)
  expect(glassRect.x + glassRect.width / 2).toBeCloseTo(viewport.width * 0.55, 0)
  expect(glassRect.y + glassRect.height / 2).toBeCloseTo(viewport.height * 0.5, 0)

  const liveLayerStyles = await page.evaluate(() => {
    const backgroundRoot = document.querySelector('.landing-background-field')
    const lineRoot = document.querySelector('.landing-line-field')
    const glassSurface = document.querySelector('[data-glass-surface]')
    if (!(backgroundRoot instanceof HTMLElement)) throw new Error('Missing background root')
    if (!(lineRoot instanceof HTMLElement)) throw new Error('Missing line-field root')
    if (!(glassSurface instanceof HTMLElement)) throw new Error('Missing glass surface')
    const before = {
      backgroundZ: getComputedStyle(backgroundRoot).zIndex,
      glassBackdrop: getComputedStyle(glassSurface).backdropFilter,
      lineBackdrop: getComputedStyle(lineRoot).backdropFilter,
      lineClip: getComputedStyle(lineRoot).clipPath,
      lineFilter: getComputedStyle(lineRoot).filter,
      lineZ: getComputedStyle(lineRoot).zIndex,
    }
    backgroundRoot.dataset.backgroundLayer = 'below-wavefield'
    glassSurface.dataset.glassLayer = 'below-wavefield'
    const below = getComputedStyle(backgroundRoot).zIndex
    backgroundRoot.dataset.backgroundLayer = 'above-wavefield'
    glassSurface.dataset.glassLayer = 'above-wavefield'
    const above = getComputedStyle(backgroundRoot).zIndex
    return { above, before, below }
  })
  expect(liveLayerStyles.before).toMatchObject({
    backgroundZ: '1',
    lineBackdrop: 'none',
    lineClip: 'none',
    lineFilter: 'none',
    lineZ: '0',
  })
  expect(liveLayerStyles.before.glassBackdrop).not.toBe('none')
  expect(liveLayerStyles.above).toBe('1')
  expect(liveLayerStyles.below).toBe('0')
  await expect(background.locator('[data-particle]')).toHaveCount(0)
  expect(runtimeErrors).toEqual([])
})

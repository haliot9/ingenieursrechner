import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { landingBackgroundConfig } from '../src/landing/background/config/landing-background-config.generated'
import { lineFieldConfig } from '../src/landing/line-field/config/line-field-config.generated'

const screenshotDirectory = join(
  process.cwd(),
  'output/playwright/line-material-background-candidate',
)

const sectionIds = ['haltung', 'module', 'thermodynamik', 'rechenweg', 'projekt'] as const
const boundarySourceBandHeightCssPx = 64
const boundarySeamBandHeightCssPx = 6
const compositedClipMaximumWidthCssPx = 360
const compositedClipMaximumHeightCssPx = 240
const minimumBandAlphaPixels = 8
const minimumFullAlphaPixels = 32
const minimumCompositedContributionRatio = 0.0001
const maximumBoundaryOpaqueCoverageRatio = 0.2
const negativeControl = process.env.CONTINUITY_NEGATIVE_CONTROL?.trim() || null
const captureEvidence = process.env.CONTINUITY_CAPTURE_EVIDENCE === '1'
const reportRatios = process.env.CONTINUITY_REPORT_RATIOS === '1'

const supportedNegativeControls = [
  'background-transparent',
  'boundary-band',
  'boundary-background-css-cutoff',
  'boundary-line-cutoff',
  'boundary-line-css-cutoff',
  'boundary-narrow-band',
  'composited-background-clip',
  'composited-line-filter',
  'line-opacity',
] as const

type EvidenceTheme = 'dark' | 'light'
type NegativeControl = typeof supportedNegativeControls[number]

if (
  negativeControl
  && !supportedNegativeControls.includes(negativeControl as NegativeControl)
) {
  throw new Error(`Unsupported CONTINUITY_NEGATIVE_CONTROL: ${negativeControl}`)
}

test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})

interface ContinuityIdentity {
  readonly backgroundBranch: string
  readonly backgroundRoot: string
  readonly lineCanvas: string
  readonly lineRoot: string
}

interface PixelBand {
  readonly height: number
  readonly top: number
}

interface RenderedContribution {
  readonly alphaRatio: number
  readonly glError: number | null
  readonly nontransparentPixels: number
  readonly pixelCount: number
}

interface ScreenshotClip {
  readonly height: number
  readonly width: number
  readonly x: number
  readonly y: number
}

async function installContributionBackbuffers(page: Page) {
  await page.addInitScript(() => {
    const nativeGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = (function patchedGetContext(
      this: HTMLCanvasElement,
      ...args: unknown[]
    ) {
      const [contextId, options] = args
      if (contextId === 'webgl2') {
        const attributes = typeof options === 'object' && options !== null ? options : {}
        return Reflect.apply(nativeGetContext, this, [
          contextId,
          { ...attributes, preserveDrawingBuffer: true },
        ])
      }
      return Reflect.apply(nativeGetContext, this, args)
    }) as typeof HTMLCanvasElement.prototype.getContext
  })
}

async function applyNegativeControl(page: Page) {
  if (negativeControl === 'line-opacity') {
    await page.addStyleTag({
      content: '.landing-line-field { opacity: 0 !important; }',
    })
  }
  if (negativeControl === 'boundary-band') {
    await page.addStyleTag({
      content: `
        #thermodynamik::before {
          position: absolute !important;
          z-index: 9999 !important;
          top: -32px !important;
          right: 0 !important;
          left: 0 !important;
          height: 64px !important;
          background: #ff00ff !important;
          content: "" !important;
          pointer-events: none !important;
        }
      `,
    })
  }
  if (negativeControl === 'boundary-narrow-band') {
    await page.addStyleTag({
      content: `
        #thermodynamik::before {
          position: absolute !important;
          z-index: 9999 !important;
          top: -2px !important;
          right: 0 !important;
          left: 0 !important;
          height: 4px !important;
          background: #ff00ff !important;
          content: "" !important;
          pointer-events: none !important;
        }
      `,
    })
  }
  if (negativeControl === 'composited-background-clip') {
    await page.addStyleTag({
      content: '.landing-background-field > * { clip-path: inset(100%) !important; }',
    })
  }
  if (negativeControl === 'composited-line-filter') {
    await page.addStyleTag({
      content: '.landing-line-field canvas { filter: opacity(0) !important; }',
    })
  }
}

async function applyBoundaryNegativeControl(
  page: Page,
  boundaryId: typeof sectionIds[number],
) {
  if (boundaryId !== 'thermodynamik') return
  if (negativeControl === 'boundary-line-css-cutoff') {
    await page.addStyleTag({
      content: '.landing-line-field canvas { clip-path: inset(0 0 50% 0) !important; }',
    })
  }
  if (negativeControl === 'boundary-background-css-cutoff') {
    await page.addStyleTag({
      content: '.landing-background-field > * { clip-path: inset(0 0 50% 0) !important; }',
    })
  }
}

function collectRuntimeFailures(page: Page) {
  const failures: string[] = []
  page.on('console', (message) => {
    const text = message.text()
    if (
      message.type() === 'error'
      || /(?:shader|program|webgl).*(?:error|failed)|(?:error|failed).*(?:shader|program|webgl)/i.test(text)
    ) {
      failures.push(`console:${message.type()}:${text}`)
    }
  })
  page.on('pageerror', error => failures.push(`pageerror:${error.message}`))
  return failures
}

async function scrollInstantly(page: Page, targetScrollY: number) {
  return page.evaluate(async (target) => {
    const previousBehavior = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo({ top: Math.ceil(target), behavior: 'auto' })
    window.dispatchEvent(new Event('scroll'))
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    document.documentElement.style.scrollBehavior = previousBehavior
    return window.scrollY
  }, targetScrollY)
}

async function scrollToBuiltField(page: Page) {
  const buildEnd = await page.locator('.wright-film-track').evaluate((track, config) => {
    void track
    const motto = document.querySelector('.wright-motto-panel')
    if (!motto) throw new Error('The Wright motto panel is required for built-field evidence')
    const mottoRect = motto.getBoundingClientRect()
    const mottoTop = mottoRect.top + window.scrollY
    const mottoStart = mottoTop - window.innerHeight
    const mottoEnd = mottoStart + config.travelViewportHeights * window.innerHeight
    return mottoEnd + config.triggerPastMottoVh * window.innerHeight / 100
  }, {
    travelViewportHeights: lineFieldConfig.motto.travelViewportHeights,
    triggerPastMottoVh: lineFieldConfig.handoff.triggerPastMottoVh,
  })

  await scrollInstantly(page, buildEnd + 4)
  return buildEnd
}

async function assignContinuityIdentity(page: Page): Promise<ContinuityIdentity> {
  return page.evaluate(() => {
    const backgroundRoot = document.querySelector('.landing-background-field') as HTMLElement | null
    const backgroundBranch = backgroundRoot?.firstElementChild as HTMLElement | null
    const lineRoot = document.querySelector('.landing-line-field') as HTMLElement | null
    const lineCanvas = lineRoot?.querySelector('canvas') as HTMLCanvasElement | null
    if (!backgroundRoot || !backgroundBranch || !lineRoot || !lineCanvas) {
      throw new Error('Continuous landing layers are incomplete')
    }
    const identify = (node: HTMLElement) => {
      node.dataset.continuityIdentity ||= crypto.randomUUID()
      return node.dataset.continuityIdentity
    }
    return {
      backgroundBranch: identify(backgroundBranch),
      backgroundRoot: identify(backgroundRoot),
      lineCanvas: identify(lineCanvas),
      lineRoot: identify(lineRoot),
    }
  })
}

async function readContinuitySnapshot(page: Page) {
  return page.evaluate(() => {
    const backgroundRoot = document.querySelector('.landing-background-field') as HTMLElement | null
    const backgroundBranch = backgroundRoot?.firstElementChild as HTMLElement | null
    const lineRoot = document.querySelector('.landing-line-field') as HTMLElement | null
    const lineHost = lineRoot?.querySelector('.landing-line-field__renderer-host') as HTMLElement | null
    const lineCanvas = lineRoot?.querySelector('canvas') as HTMLCanvasElement | null
    if (!backgroundRoot || !backgroundBranch || !lineRoot || !lineHost || !lineCanvas) {
      throw new Error('Continuous landing layers are incomplete')
    }
    const layer = (node: HTMLElement) => {
      const rect = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return {
        clipPath: style.clipPath,
        display: style.display,
        filter: style.filter,
        height: rect.height,
        left: rect.left,
        maskImage: style.maskImage || style.webkitMaskImage,
        opacity: Number.parseFloat(style.opacity),
        top: rect.top,
        visibility: style.visibility,
        width: rect.width,
      }
    }
    return {
      backgroundBranchCount: backgroundRoot.children.length,
      backgroundCanvasCount: backgroundRoot.querySelectorAll('canvas').length,
      backgroundIdentity: backgroundRoot.dataset.continuityIdentity,
      backgroundBranchIdentity: backgroundBranch.dataset.continuityIdentity,
      backgroundBranchLayer: layer(backgroundBranch),
      backgroundLayer: layer(backgroundRoot),
      lineCanvasCount: lineRoot.querySelectorAll('canvas').length,
      lineCanvasIdentity: lineCanvas.dataset.continuityIdentity,
      lineCanvasLayer: layer(lineCanvas),
      lineHostLayer: layer(lineHost),
      lineIdentity: lineRoot.dataset.continuityIdentity,
      lineLayer: layer(lineRoot),
      rootCounts: {
        background: document.querySelectorAll('.landing-background-field').length,
        line: document.querySelectorAll('.landing-line-field').length,
      },
      scrollY: window.scrollY,
      viewport: { height: window.innerHeight, width: window.innerWidth },
    }
  })
}

function expectContinuousLayers(
  snapshot: Awaited<ReturnType<typeof readContinuitySnapshot>>,
  identity: ContinuityIdentity,
  theme: EvidenceTheme,
) {
  expect(snapshot.rootCounts).toEqual({ background: 1, line: 1 })
  expect(snapshot.backgroundBranchCount).toBe(1)
  expect(snapshot.backgroundCanvasCount).toBe(theme === 'dark' ? 1 : 0)
  expect(snapshot.lineCanvasCount).toBe(1)
  expect(snapshot.backgroundIdentity).toBe(identity.backgroundRoot)
  expect(snapshot.backgroundBranchIdentity).toBe(identity.backgroundBranch)
  expect(snapshot.lineIdentity).toBe(identity.lineRoot)
  expect(snapshot.lineCanvasIdentity).toBe(identity.lineCanvas)
  for (const layer of [
    snapshot.backgroundLayer,
    snapshot.lineLayer,
    snapshot.lineHostLayer,
    snapshot.lineCanvasLayer,
  ]) {
    expect(layer).toMatchObject({
      clipPath: 'none',
      filter: 'none',
      left: 0,
      maskImage: 'none',
      top: 0,
    })
    expect(layer.width).toBeCloseTo(snapshot.viewport.width, 0)
    expect(layer.height).toBeCloseTo(snapshot.viewport.height, 0)
    expect(layer.display).not.toBe('none')
    expect(layer.visibility).toBe('visible')
    expect(layer.opacity).toBeGreaterThan(0)
  }

  const backgroundBranch = snapshot.backgroundBranchLayer
  expect(backgroundBranch).toMatchObject({
    clipPath: 'none',
    filter: 'none',
    maskImage: 'none',
  })
  expect(backgroundBranch.display).not.toBe('none')
  expect(backgroundBranch.visibility).toBe('visible')
  expect(backgroundBranch.opacity).toBeGreaterThan(0)
  if (theme === 'dark') {
    expect(backgroundBranch.left).toBeCloseTo(0, 0)
    expect(backgroundBranch.top).toBeCloseTo(0, 0)
    expect(backgroundBranch.width).toBeCloseTo(snapshot.viewport.width, 0)
    expect(backgroundBranch.height).toBeCloseTo(snapshot.viewport.height, 0)
  } else {
    const leftRatio = landingBackgroundConfig.light.centerXRatio
      - landingBackgroundConfig.light.widthRatio / 2
    expect(backgroundBranch.left).toBeCloseTo(
      snapshot.viewport.width * leftRatio,
      0,
    )
    expect(backgroundBranch.top).toBeCloseTo(
      snapshot.viewport.height * (1 - landingBackgroundConfig.light.heightRatio) / 2,
      0,
    )
    expect(backgroundBranch.width).toBeCloseTo(
      snapshot.viewport.width * landingBackgroundConfig.light.widthRatio,
      0,
    )
    expect(backgroundBranch.height).toBeCloseTo(
      snapshot.viewport.height * landingBackgroundConfig.light.heightRatio,
      0,
    )
  }
}

function compositedContributionClip(page: Page): ScreenshotClip {
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('Composited contribution evidence requires an explicit viewport')
  const width = Math.min(viewport.width, compositedClipMaximumWidthCssPx)
  const height = Math.min(viewport.height, compositedClipMaximumHeightCssPx)
  return {
    height,
    width,
    x: Math.floor((viewport.width - width) / 2),
    y: Math.floor((viewport.height - height) / 2),
  }
}

async function backgroundContributionClip(page: Page): Promise<ScreenshotClip> {
  const fallback = compositedContributionClip(page)
  const viewport = page.viewportSize()
  if (!viewport) return fallback
  const glass = page.locator('[data-background-branch="light"][data-glass-surface]')
  if (await glass.count() !== 1) return fallback
  const rect = await glass.boundingBox()
  if (!rect) return fallback

  const width = Math.min(viewport.width, 180)
  const height = Math.min(viewport.height, compositedClipMaximumHeightCssPx)
  return {
    width,
    height,
    x: Math.max(0, Math.min(viewport.width - width, Math.floor(rect.x - width / 2))),
    y: Math.max(0, Math.min(
      viewport.height - height,
      Math.floor(rect.y + rect.height / 2 - height / 2),
    )),
  }
}

async function screenshotSignificantPixelRatio(
  page: Page,
  first: Buffer,
  second: Buffer,
) {
  return page.evaluate(async ({ firstPng, secondPng }) => {
    const decode = async (base64: string) => {
      const binary = atob(base64)
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const surface = document.createElement('canvas')
      surface.width = bitmap.width
      surface.height = bitmap.height
      const context = surface.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Composited screenshot comparison canvas is unavailable')
      context.drawImage(bitmap, 0, 0)
      bitmap.close()
      return context.getImageData(0, 0, surface.width, surface.height)
    }
    const [firstImage, secondImage] = await Promise.all([
      decode(firstPng),
      decode(secondPng),
    ])
    if (
      firstImage.width !== secondImage.width
      || firstImage.height !== secondImage.height
    ) {
      throw new Error('Composited screenshot dimensions differ')
    }
    let significantPixels = 0
    for (let index = 0; index < firstImage.data.length; index += 4) {
      const maximumDelta = Math.max(
        Math.abs(firstImage.data[index] - secondImage.data[index]),
        Math.abs(firstImage.data[index + 1] - secondImage.data[index + 1]),
        Math.abs(firstImage.data[index + 2] - secondImage.data[index + 2]),
      )
      if (maximumDelta > 2) significantPixels += 1
    }
    return significantPixels / (firstImage.width * firstImage.height)
  }, {
    firstPng: first.toString('base64'),
    secondPng: second.toString('base64'),
  })
}

async function readCompositedLayerContributions(page: Page) {
  const selectors = {
    background: '.landing-background-field',
    line: '.landing-line-field',
  } as const
  const visibilityState = await page.evaluate((layerSelectors) => (
    Object.fromEntries(Object.entries(layerSelectors).map(([layer, selector]) => {
      const node = document.querySelector(selector)
      if (!(node instanceof HTMLElement)) throw new Error(`Missing composited layer: ${selector}`)
      return [layer, {
        priority: node.style.getPropertyPriority('visibility'),
        value: node.style.getPropertyValue('visibility'),
      }]
    }))
  ), selectors)
  const setVisibility = (visibleLayer: keyof typeof selectors | null) => page.evaluate((args) => {
    for (const [layer, selector] of Object.entries(args.selectors)) {
      const node = document.querySelector(selector)
      if (!(node instanceof HTMLElement)) throw new Error(`Missing composited layer: ${selector}`)
      node.style.setProperty(
        'visibility',
        layer === args.visibleLayer ? 'visible' : 'hidden',
        'important',
      )
    }
  }, { selectors, visibleLayer })
  const restore = () => page.evaluate((args) => {
    for (const [layer, selector] of Object.entries(args.selectors)) {
      const node = document.querySelector(selector)
      const state = args.visibilityState[layer]
      if (!(node instanceof HTMLElement) || !state) continue
      if (state.value) {
        node.style.setProperty('visibility', state.value, state.priority)
      } else {
        node.style.removeProperty('visibility')
      }
    }
  }, { selectors, visibilityState })
  const screenshot = (clip: ScreenshotClip) => page.screenshot({
    animations: 'disabled',
    caret: 'hide',
    clip,
  })
  try {
    const lineClip = compositedContributionClip(page)
    const backgroundClip = await backgroundContributionClip(page)
    await setVisibility('background')
    const backgroundVisible = await screenshot(backgroundClip)
    await setVisibility(null)
    const backgroundHidden = await screenshot(backgroundClip)
    const lineHidden = await screenshot(lineClip)
    await setVisibility('line')
    const lineVisible = await screenshot(lineClip)
    return {
      background: await screenshotSignificantPixelRatio(page, backgroundVisible, backgroundHidden),
      line: await screenshotSignificantPixelRatio(page, lineVisible, lineHidden),
    }
  } finally {
    await restore()
  }
}

async function expectCompositedLayerContributions(page: Page, label: string) {
  const contributions = await readCompositedLayerContributions(page)
  if (reportRatios) console.log(`composited-ratios:${label}:${JSON.stringify(contributions)}`)
  for (const [layer, ratio] of Object.entries(contributions)) {
    expect(
      ratio,
      `${label} ${layer} must independently change real composited page pixels`,
    ).toBeGreaterThan(minimumCompositedContributionRatio)
  }
}

async function readCanvasContribution(
  page: Page,
  selector: string,
  band: PixelBand | null,
  clearBeforeRead: boolean,
): Promise<RenderedContribution> {
  return page.evaluate(({ canvasSelector, clear, maximumHeight, maximumWidth, sampleBand }) => {
    const canvas = document.querySelector(canvasSelector)
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error(`Missing rendered canvas: ${canvasSelector}`)
    }
    const gl = canvas.getContext('webgl2')
    if (!gl) throw new Error(`Missing WebGL2 contribution context: ${canvasSelector}`)
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / Math.max(1, rect.width)
    const scaleY = canvas.height / Math.max(1, rect.height)
    const sampleWidthCss = Math.min(rect.width, maximumWidth)
    const leftPx = Math.max(0, Math.floor((rect.width - sampleWidthCss) / 2 * scaleX))
    const width = Math.min(canvas.width - leftPx, Math.ceil(sampleWidthCss * scaleX))
    const sampleHeightCss = sampleBand
      ? sampleBand.height
      : Math.min(rect.height, maximumHeight)
    const topCss = sampleBand
      ? sampleBand.top - rect.top
      : (rect.height - sampleHeightCss) / 2
    const topPx = Math.max(0, Math.floor(topCss * scaleY))
    const requestedHeight = Math.max(1, Math.ceil(sampleHeightCss * scaleY))
    const height = Math.min(requestedHeight, canvas.height - topPx)
    const readY = Math.max(0, canvas.height - topPx - height)

    if (clear) {
      gl.enable(gl.SCISSOR_TEST)
      gl.scissor(leftPx, readY, width, height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.disable(gl.SCISSOR_TEST)
    }
    gl.finish()
    const pixels = new Uint8Array(width * height * 4)
    gl.readPixels(leftPx, readY, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    let nontransparentPixels = 0
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 2) nontransparentPixels += 1
    }
    const pixelCount = width * height
    return {
      alphaRatio: nontransparentPixels / pixelCount,
      glError: gl.getError(),
      nontransparentPixels,
      pixelCount,
    }
  }, {
    canvasSelector: selector,
    clear: clearBeforeRead,
    maximumHeight: compositedClipMaximumHeightCssPx,
    maximumWidth: compositedClipMaximumWidthCssPx,
    sampleBand: band,
  })
}

async function readLightGlassContribution(
  page: Page,
  band: PixelBand | null,
): Promise<RenderedContribution> {
  return page.evaluate((sampleBand) => {
    const glass = document.querySelector('[data-background-branch="light"][data-glass-surface]')
    if (!(glass instanceof HTMLElement)) throw new Error('Missing rendered Light glass branch')
    const style = getComputedStyle(glass)
    const rect = glass.getBoundingClientRect()
    const sampleTop = sampleBand?.top ?? 0
    const sampleHeight = sampleBand?.height ?? window.innerHeight
    const intersectionWidth = Math.max(
      0,
      Math.min(window.innerWidth, rect.right) - Math.max(0, rect.left),
    )
    const intersectionHeight = Math.max(
      0,
      Math.min(sampleTop + sampleHeight, rect.bottom) - Math.max(sampleTop, rect.top),
    )
    const isClippedAway = /inset\(100%/.test(style.clipPath)
    const hasOpticalSurface = style.backdropFilter !== 'none'
      || style.webkitBackdropFilter !== 'none'
      || !/rgba?\([^)]*,\s*0\s*\)$/.test(style.backgroundColor)
    const horizontalRatio = intersectionWidth / Math.max(1, window.innerWidth)
    const verticalRatio = intersectionHeight / Math.max(1, sampleHeight)
    const pixelCount = 240 * 160
    const alphaRatio = style.display === 'none'
      || style.visibility !== 'visible'
      || isClippedAway
      || !hasOpticalSurface
      ? 0
      : horizontalRatio * verticalRatio
    const nontransparentPixels = Math.floor(pixelCount * alphaRatio)
    return {
      alphaRatio,
      glError: null,
      nontransparentPixels,
      pixelCount,
    }
  }, band)
}

async function readLayerContributions(
  page: Page,
  theme: EvidenceTheme,
  band: PixelBand | null,
  boundaryId: string | null,
) {
  const clearBackground = negativeControl === 'background-transparent'
    && theme === 'dark'
    && boundaryId === null
  const clearLine = negativeControl === 'boundary-line-cutoff'
    && boundaryId === 'thermodynamik'
  return {
    background: theme === 'dark'
      ? await readCanvasContribution(
          page,
          '.landing-background-field canvas',
          band,
          clearBackground,
        )
      : await readLightGlassContribution(page, band),
    line: await readCanvasContribution(
      page,
      '.landing-line-field canvas',
      band,
      clearLine,
    ),
  }
}

function expectLayerContributions(
  contributions: Awaited<ReturnType<typeof readLayerContributions>>,
  label: string,
  band: PixelBand | null,
) {
  const minimumPixels = band ? minimumBandAlphaPixels : minimumFullAlphaPixels
  for (const [layer, contribution] of Object.entries(contributions)) {
    expect([0, null], `${label} ${layer} GL error`).toContain(contribution.glError)
    expect(
      contribution.nontransparentPixels,
      `${label} ${layer} must render nontransparent pixels independently of foreground content`,
    ).toBeGreaterThan(minimumPixels)
    expect(contribution.alphaRatio, `${label} ${layer} alpha ratio`).toBeGreaterThan(0.00005)
  }
}

async function readBoundaryOpaquePatchRatio(
  page: Page,
  boundaryId: typeof sectionIds[number],
  band: PixelBand,
) {
  return page.evaluate(({ id, sampleBand }) => {
    const section = document.getElementById(id)
    if (!(section instanceof HTMLElement)) throw new Error(`Missing landing section: ${id}`)
    const coverageWidth = Math.max(1, Math.ceil(window.innerWidth))
    const coverageHeight = Math.max(1, Math.ceil(sampleBand.height))
    const coverage = new Float32Array(coverageWidth * coverageHeight)
    const colorAlpha = (color: string) => {
      const match = color.match(/^rgba?\((?:[^,]+,){3}\s*([\d.]+)\)$/)
      return match ? Number.parseFloat(match[1]) : color === 'transparent' ? 0 : 1
    }
    const paintedAlpha = (style: CSSStyleDeclaration) => {
      const imageAlpha = style.backgroundImage === 'none' ? 0 : 1
      return Math.max(colorAlpha(style.backgroundColor), imageAlpha)
        * Number.parseFloat(style.opacity || '1')
    }
    const paintCoverage = (rect: DOMRect | DOMRectReadOnly, alpha: number) => {
      if (alpha <= 0) return
      const left = Math.max(0, Math.floor(rect.left))
      const right = Math.min(coverageWidth, Math.ceil(rect.right))
      const top = Math.max(0, Math.floor(rect.top - sampleBand.top))
      const bottom = Math.min(coverageHeight, Math.ceil(rect.bottom - sampleBand.top))
      if (right <= left || bottom <= top) return
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const index = y * coverageWidth + x
          coverage[index] = 1 - (1 - coverage[index]) * (1 - alpha)
        }
      }
    }
    const pseudoRect = (
      ownerRect: DOMRect,
      style: CSSStyleDeclaration,
    ): DOMRectReadOnly => {
      const length = (value: string, fallback: number) => (
        value === 'auto' ? fallback : Number.parseFloat(value)
      )
      const left = ownerRect.left + length(style.left, 0)
      const top = ownerRect.top + length(style.top, 0)
      const rightInset = length(style.right, 0)
      const bottomInset = length(style.bottom, 0)
      const width = style.width === 'auto'
        ? Math.max(0, ownerRect.width - (left - ownerRect.left) - rightInset)
        : Number.parseFloat(style.width)
      const height = style.height === 'auto'
        ? Math.max(0, ownerRect.height - (top - ownerRect.top) - bottomInset)
        : Number.parseFloat(style.height)
      return new DOMRectReadOnly(left, top, width, height)
    }
    const rect = section.getBoundingClientRect()
    const style = getComputedStyle(section)
    if (style.display !== 'none' && style.visibility === 'visible') {
      paintCoverage(rect, paintedAlpha(style))
    }
    for (const pseudo of ['::before', '::after']) {
      const pseudoStyle = getComputedStyle(section, pseudo)
      if (
        pseudoStyle.content === 'none'
        || pseudoStyle.display === 'none'
        || pseudoStyle.visibility !== 'visible'
      ) continue
      paintCoverage(pseudoRect(rect, pseudoStyle), paintedAlpha(pseudoStyle))
    }
    return coverage.reduce((total, alpha) => total + alpha, 0) / coverage.length
  }, { id: boundaryId, sampleBand: band })
}

async function positionBoundaryAtViewportCenter(
  page: Page,
  id: typeof sectionIds[number],
) {
  const targetFor = () => page.locator(`#${id}`).evaluate(node => (
    node.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2
  ))
  await scrollInstantly(page, await targetFor())
  if (id !== 'haltung') {
    await expect.poll(() => page.locator(`#${id}`).getAttribute('data-deferred-section'), {
      timeout: 5_000,
    }).toBeNull()
  }
  await scrollInstantly(page, await targetFor())
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('Boundary evidence requires an explicit viewport')
  const sectionTop = await page.locator(`#${id}`).evaluate(node => node.getBoundingClientRect().top)
  expect(
    Math.abs(sectionTop - viewport.height / 2),
    `${id} boundary must be centered within browser scroll quantization`,
  ).toBeLessThanOrEqual(1)
  return {
    height: boundarySourceBandHeightCssPx,
    top: Math.floor(viewport.height / 2 - boundarySourceBandHeightCssPx / 2),
  }
}

async function expectCleanGl(page: Page, theme: EvidenceTheme) {
  const glState = await page.evaluate((activeTheme) => {
    const canvases = [
      document.querySelector('.landing-line-field canvas'),
      activeTheme === 'dark'
        ? document.querySelector('.landing-background-field canvas')
        : null,
    ].filter((canvas): canvas is HTMLCanvasElement => canvas instanceof HTMLCanvasElement)
    return canvases.map((canvas) => {
      const gl = canvas.getContext('webgl2')
      if (!gl) return { error: null, hasWebGl2: false }
      return { error: gl.getError(), hasWebGl2: true }
    })
  }, theme)
  expect(glState).toHaveLength(theme === 'dark' ? 2 : 1)
  expect(glState).toEqual(glState.map(() => ({ error: 0, hasWebGl2: true })))
}

async function expectForegroundOcclusion(page: Page, theme: EvidenceTheme) {
  const stacking = await page.evaluate(() => {
    const requireElement = (selector: string) => {
      const node = document.querySelector(selector)
      if (!(node instanceof HTMLElement)) throw new Error(`Missing stacking layer: ${selector}`)
      return node
    }
    const background = requireElement('.landing-background-field')
    const line = requireElement('.landing-line-field')
    const film = requireElement('.wright-hero-sticky')
    const content = requireElement('#thermodynamik')
    const navigation = requireElement('.floating-rail-trigger-surface')
    const shell = requireElement('.landing-shell')
    const zIndex = (node: HTMLElement) => Number.parseInt(getComputedStyle(node).zIndex, 10)
    return {
      backgroundBeforeLine: Boolean(
        background.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
      backgroundColor: getComputedStyle(shell).backgroundColor,
      backgroundZ: zIndex(background),
      contentZ: zIndex(content),
      filmBackground: getComputedStyle(film).backgroundColor,
      filmZ: zIndex(film),
      lineZ: zIndex(line),
      navigationZ: zIndex(navigation),
    }
  })
  expect(stacking.backgroundBeforeLine).toBe(true)
  expect(stacking.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  const expectedBackgroundZ = theme === 'light'
    && landingBackgroundConfig.light.layerPlacement === 'above-wavefield'
    ? 1
    : 0
  expect(stacking.backgroundZ).toBe(expectedBackgroundZ)
  expect(stacking.lineZ).toBe(0)
  expect(stacking.filmBackground).toBe('rgba(0, 0, 0, 0)')
  expect(stacking.filmZ).toBeGreaterThan(stacking.lineZ)
  expect(stacking.contentZ).toBeGreaterThan(stacking.backgroundZ)
  expect(stacking.contentZ).toBeGreaterThan(stacking.lineZ)
  expect(stacking.navigationZ).toBeGreaterThan(stacking.contentZ)

  await page.getByRole('button', { name: 'Navigation öffnen' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return Boolean(top && node.contains(top))
  })).toBe(true)
  expect(await page.locator('.floating-rail-overlay').evaluate(node => (
    Number.parseInt(getComputedStyle(node).zIndex, 10)
  ))).toBeGreaterThan(stacking.lineZ)
  await page.getByRole('button', { name: 'Navigation schließen' }).click()
  await expect(dialog).toHaveCount(0)
}

async function expectTransparentSectionPlanes(page: Page) {
  const sectionLayers = await page.evaluate((ids) => ids.map((id) => {
    const section = document.getElementById(id)
    if (!section) throw new Error(`Missing landing section: ${id}`)
    const style = getComputedStyle(section)
    return {
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      clipPath: style.clipPath,
      id,
      maskImage: style.maskImage || style.webkitMaskImage,
    }
  }), sectionIds)
  for (const section of sectionLayers) {
    expect(section).toMatchObject({
      backgroundColor: 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
      clipPath: 'none',
      maskImage: 'none',
    })
  }
}

for (const theme of ['dark', 'light'] as const) {
  test(`${theme} landing keeps one seamless background and line field through lower sections`, async ({
    page,
  }, testInfo) => {
    // Desktop Dark performs repeated real WebGL readbacks across every section boundary.
    // Keep its budget explicit instead of making the global browser timeout product-specific.
    test.setTimeout(60_000)
    const runtimeFailures = collectRuntimeFailures(page)
    if (captureEvidence) await mkdir(screenshotDirectory, { recursive: true })
    await installContributionBackbuffers(page)
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' })
    await page.goto('./')
    await applyNegativeControl(page)

    const background = page.locator('.landing-background-field')
    const line = page.locator('.landing-line-field')
    await expect(background).toHaveCount(1, { timeout: 15_000 })
    await expect(background).toHaveAttribute('data-background-theme', theme)
    await expect(background).toHaveAttribute(
      'data-background-status',
      theme === 'dark' ? 'ready' : 'static',
      { timeout: 15_000 },
    )

    await scrollToBuiltField(page)
    await expect(line).toHaveAttribute('data-line-field-status', 'ready', { timeout: 15_000 })
    await expect(line).toHaveAttribute('data-line-field-mode', 'autonomous', { timeout: 5_000 })
    await expect(line.locator('canvas')).toHaveCount(1)
    if (theme === 'dark') {
      await expect(background.locator('canvas')).toHaveCount(1)
    } else {
      await expect(background.locator('[data-background-branch="light"][data-glass-surface]')).toHaveCount(1)
    }

    const identity = await assignContinuityIdentity(page)
    await expectCompositedLayerContributions(page, 'built field')
    expectContinuousLayers(await readContinuitySnapshot(page), identity, theme)
    await expectCleanGl(page, theme)
    expectLayerContributions(
      await readLayerContributions(page, theme, null, null),
      'built field',
      null,
    )
    if (captureEvidence && !negativeControl) {
      await page.screenshot({
        path: join(
          screenshotDirectory,
          `${testInfo.project.name}-${theme}-built-field.png`,
        ),
      })
    }

    for (const boundaryId of sectionIds.slice(1)) {
      const boundaryBand = await positionBoundaryAtViewportCenter(page, boundaryId)
      const boundarySeamBand = {
        height: boundarySeamBandHeightCssPx,
        top: boundaryBand.top
          + Math.floor((boundaryBand.height - boundarySeamBandHeightCssPx) / 2),
      }
      await applyBoundaryNegativeControl(page, boundaryId)
      expectContinuousLayers(await readContinuitySnapshot(page), identity, theme)
      await expectCleanGl(page, theme)
      if (negativeControl === 'boundary-line-cutoff') {
        expectLayerContributions(
          await readLayerContributions(page, theme, boundaryBand, boundaryId),
          `${boundaryId} boundary`,
          boundaryBand,
        )
      }
      expect(
        await readBoundaryOpaquePatchRatio(page, boundaryId, boundarySeamBand),
        `${boundaryId} boundary must not contain an opaque section patch`,
      ).toBeLessThan(maximumBoundaryOpaqueCoverageRatio)
    }
    await expectTransparentSectionPlanes(page)

    const lowerSection = page.locator('#thermodynamik')
    await lowerSection.scrollIntoViewIfNeeded()
    await expect(lowerSection).toBeVisible()
    await scrollInstantly(page, await lowerSection.evaluate(node => (
      node.getBoundingClientRect().top + window.scrollY
    )))
    await expectCompositedLayerContributions(page, 'lower Thermodynamik')
    expectContinuousLayers(await readContinuitySnapshot(page), identity, theme)
    await expectForegroundOcclusion(page, theme)
    await expectCleanGl(page, theme)
    expectLayerContributions(
      await readLayerContributions(page, theme, null, null),
      'lower Thermodynamik',
      null,
    )
    if (captureEvidence && !negativeControl) {
      await page.screenshot({
        path: join(
          screenshotDirectory,
          `${testInfo.project.name}-${theme}-lower-thermodynamik.png`,
        ),
      })
    }

    expect(runtimeFailures).toEqual([])
  })
}

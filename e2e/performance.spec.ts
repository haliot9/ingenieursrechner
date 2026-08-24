import { readFile, readdir } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { lineFieldConfig } from '../src/landing/line-field/config/line-field-config.generated'
import {
  installLineFieldDrawCounter,
  lineFieldDrawCount,
} from './helpers/line-field-draw-counter'

const rendererAssetPattern = /^LandingLineRenderer-[^/]+\.js$/
const thermodynamicsAssetPattern = /^ThermodynamicsExplorer-[^/]+\.js$/
const referenceScenarioAssetPattern = /^reference-scenario-[^/]+\.js$/
const swiftShaderLaunchOptions = {
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
}

const coldLineFieldOutcomes = [
  'ready',
  'fallback-reduced-motion',
  'fallback-unsupported',
  'fallback-error',
  'fallback-context-lost',
] as const

type ColdLineFieldOutcome = typeof coldLineFieldOutcomes[number]

test.use({ launchOptions: swiftShaderLaunchOptions })
test.beforeEach(async ({ page }) => installLineFieldDrawCounter(page))

interface RuntimeErrorCollector {
  readonly errors: string[]
}

let rendererAssetNamePromise: Promise<string> | undefined
let thermodynamicsAssetNamePromise: Promise<string> | undefined
let solverHeavyAssetNamePromise: Promise<string> | undefined

function rendererAssetName() {
  rendererAssetNamePromise ??= readdir('dist/assets').then((entries) => {
    const matches = entries.filter(entry => rendererAssetPattern.test(entry))
    if (matches.length !== 1) {
      throw new Error(`Expected one built LandingLineRenderer asset, found: ${matches.join(', ')}`)
    }
    return matches[0]
  })
  return rendererAssetNamePromise
}

function thermodynamicsAssetName() {
  thermodynamicsAssetNamePromise ??= readdir('dist/assets').then((entries) => {
    const matches = entries.filter(entry => thermodynamicsAssetPattern.test(entry))
    if (matches.length !== 1) {
      throw new Error(`Expected one built ThermodynamicsExplorer asset, found: ${matches.join(', ')}`)
    }
    return matches[0]
  })
  return thermodynamicsAssetNamePromise
}

function solverHeavyAssetName() {
  solverHeavyAssetNamePromise ??= readdir('dist/assets').then(async (entries) => {
    const referenceMatches = entries.filter(entry => referenceScenarioAssetPattern.test(entry))
    if (referenceMatches.length !== 1) {
      throw new Error(
        `Expected one built reference-scenario asset, found: ${referenceMatches.join(', ')}`,
      )
    }
    const source = await readFile(`dist/assets/${referenceMatches[0]}`, 'utf8')
    const imports = [...source.matchAll(/from["']\.\/([^"']+\.js)["']/g)]
      .map(match => match[1])
    if (imports.length !== 1 || !entries.includes(imports[0])) {
      throw new Error(
        `Expected reference-scenario to own one built solver dependency, found: ${imports.join(', ')}`,
      )
    }
    return imports[0]
  })
  return solverHeavyAssetNamePromise
}

function collectLineFieldRuntimeErrors(page: Page): RuntimeErrorCollector {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    const text = message.text()
    if (message.type() === 'error' || /\b(?:shader|program)\b/i.test(text)) {
      errors.push(`${message.type()}: ${text}`)
    }
  })
  return { errors }
}

async function scrollFilmToProgress(page: Page, progress: number, repeatEvents = 1) {
  return page.locator('.wright-film-track').evaluate(async (element, input) => {
    const track = element as HTMLElement
    const filmTop = track.getBoundingClientRect().top + window.scrollY
    const filmRange = Math.max(1, track.offsetHeight - window.innerHeight)
    const target = Math.ceil(filmTop + filmRange * input.progress)
    const expectedProgress = Math.min(1, Math.max(0, (target - filmTop) / filmRange))
    const previousBehavior = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'auto'

    await new Promise<void>((resolve) => {
      const finishIfSynchronized = () => {
        const current = Number.parseFloat(track.style.getPropertyValue('--wright-film-progress'))
        if (!Number.isFinite(current) || Math.abs(current - expectedProgress) > (1 / filmRange)) return false
        observer.disconnect()
        resolve()
        return true
      }
      const observer = new MutationObserver(finishIfSynchronized)
      observer.observe(track, { attributes: true, attributeFilter: ['style'] })
      if (finishIfSynchronized()) return
      window.scrollTo({ top: target, behavior: 'auto' })
    })

    await new Promise<void>((resolve) => {
      const activityExtent = document.querySelector('.landing-shell__content')
      if (!activityExtent) throw new Error('Line-field activity extent is missing')
      const observer = new IntersectionObserver((entries) => {
        if (!entries.some(entry => entry.target === activityExtent && entry.isIntersecting)) return
        observer.disconnect()
        resolve()
      })
      observer.observe(activityExtent)
    })
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    for (let index = 0; index < input.repeatEvents; index += 1) {
      window.dispatchEvent(new Event('scroll'))
    }
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    document.documentElement.style.scrollBehavior = previousBehavior
    return { filmRange, filmTop, target }
  }, { progress, repeatEvents })
}

async function expectReadyLineField(page: Page) {
  const field = page.locator('.landing-line-field')
  await expect(field).toHaveAttribute('data-line-field-status', 'ready')
  await expect(field.locator('.landing-line-field__renderer-host canvas')).toHaveCount(1)
  await expect(field.locator('[data-line-field-fallback]')).toHaveCount(0)
  return field
}

async function expectColdLineFieldOutcome(page: Page, expected: ColdLineFieldOutcome) {
  const field = page.locator('.landing-line-field')
  await field.waitFor({ state: 'attached' })
  await page.waitForFunction((outcomes) => {
    const root = document.querySelector('.landing-line-field')
    const status = root?.getAttribute('data-line-field-status')
    if (status !== 'ready') return outcomes.some(outcome => outcome === status)
    const counter = Reflect.get(window, '__lineFieldDrawCounter') as
      | { snapshot(): { count: number } }
      | undefined
    const sequence = counter?.snapshot().count
    return root.querySelectorAll('.landing-line-field__renderer-host canvas').length === 1
      && root.querySelectorAll('[data-line-field-fallback]').length === 0
      && Number.isFinite(sequence)
      && (sequence ?? 0) >= 1
  }, coldLineFieldOutcomes, { timeout: 20_000 })

  const snapshot = {
    ...await field.evaluate((root) => ({
      canvasCount: root.querySelectorAll('.landing-line-field__renderer-host canvas').length,
      fallbackCount: root.querySelectorAll('[data-line-field-fallback]').length,
      mode: root.getAttribute('data-line-field-mode'),
      status: root.getAttribute('data-line-field-status'),
    })),
    sequence: await lineFieldDrawCount(page),
  }
  expect(snapshot.status).toBe(expected)

  if (expected === 'ready') {
    expect(snapshot.canvasCount).toBe(1)
    expect(snapshot.fallbackCount).toBe(0)
    expect(snapshot.sequence).toBeGreaterThanOrEqual(1)
  } else {
    expect(snapshot.mode).toBe('static')
    expect(snapshot.canvasCount).toBe(0)
    expect(snapshot.fallbackCount).toBe(1)
  }

  return field
}

test('negative control: only real line-field WebGL draws increment external frame evidence', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', {
    name: 'Nicht nur rechnen. Systeme verstehen.',
  })).toBeVisible()
  const field = page.locator('.landing-line-field')
  await expect(field).not.toHaveAttribute('data-line-field-frame-sequence')
  const beforeOtherCanvasDraw = await lineFieldDrawCount(page)

  await page.locator('.landing-background-field').evaluate((background) => {
    const canvas = document.createElement('canvas')
    background.append(canvas)
    try {
      const gl = canvas.getContext('webgl')
      if (!gl) throw new Error('Negative-control WebGL context is unavailable')
      const vertexShader = gl.createShader(gl.VERTEX_SHADER)
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
      const program = gl.createProgram()
      if (!vertexShader || !fragmentShader || !program) {
        throw new Error('Negative-control WebGL program allocation failed')
      }
      gl.shaderSource(vertexShader, 'attribute vec2 p; void main(){gl_Position=vec4(p,0.,1.);}')
      gl.shaderSource(fragmentShader, 'void main(){gl_FragColor=vec4(1.);}')
      gl.compileShader(vertexShader)
      gl.compileShader(fragmentShader)
      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)
      gl.useProgram(program)
      const buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0]), gl.STATIC_DRAW)
      const location = gl.getAttribLocation(program, 'p')
      gl.enableVertexAttribArray(location)
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0)
      gl.drawArrays(gl.POINTS, 0, 1)
      if (gl.getError() !== gl.NO_ERROR) throw new Error('Negative-control WebGL draw failed')
    } finally {
      canvas.remove()
    }
  })
  expect(await lineFieldDrawCount(page)).toBe(beforeOtherCanvasDraw)

  await scrollFilmToProgress(
    page,
    Math.max(
      lineFieldConfig.reveal.preloadFilmProgress,
      lineFieldConfig.reveal.startFilmProgress,
    ) + 0.01,
  )
  await expectReadyLineField(page)
  await expect.poll(() => lineFieldDrawCount(page)).toBeGreaterThan(beforeOtherCanvasDraw)
})

test('solver-heavy below-fold code is absent at first paint and loads near Thermodynamics', async ({ page }) => {
  const solverAssetName = await solverHeavyAssetName()
  const scriptRequests: string[] = []
  page.on('response', response => {
    if (response.url().endsWith('.js')) scriptRequests.push(response.url())
  })

  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Nicht nur rechnen. Systeme verstehen.' })).toBeVisible()
  await page.waitForTimeout(250)

  expect(scriptRequests.some(url => new URL(url).pathname.endsWith(`/assets/${solverAssetName}`))).toBe(false)
  expect(scriptRequests.some(url => /CalculatorPage-[^/]+\.js$/.test(url))).toBe(false)

  const solverResponse = page.waitForResponse(
    response => new URL(response.url()).pathname.endsWith(`/assets/${solverAssetName}`),
  )
  await page.locator('#thermodynamik').scrollIntoViewIfNeeded()
  await solverResponse
  await expect(page.getByRole('heading', { name: 'Ein System. Endliche, prüfbare Rechenräume.' })).toBeVisible()
})

test('ReactBits motor and GSAP stay inside one deferred Thermodynamics request', async ({ page }) => {
  const assetName = await thermodynamicsAssetName()
  const assetSource = await readFile(`dist/assets/${assetName}`, 'utf8')
  expect(assetSource).toContain('power3.out')
  expect(assetSource).toContain('bounce.out')
  expect(assetSource).toContain('ScrollTrigger')
  expect(assetSource).not.toContain('__elasticMenuChainAudit')
  expect(assetSource).not.toContain('elasticMenuChainAudit')

  const thermodynamicsRequests: string[] = []
  page.on('request', request => {
    if (new URL(request.url()).pathname.endsWith(`/assets/${assetName}`)) {
      thermodynamicsRequests.push(request.url())
    }
  })

  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Nicht nur rechnen. Systeme verstehen.' })).toBeVisible()
  await page.waitForTimeout(250)
  expect(thermodynamicsRequests).toEqual([])

  const responsePromise = page.waitForResponse(
    response => new URL(response.url()).pathname.endsWith(`/assets/${assetName}`),
  )
  const placeholder = page.locator('#thermodynamik')
  const chapterTop = await placeholder.evaluate(element => (
    element.getBoundingClientRect().top + window.scrollY
  ))
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'auto' }), Math.max(
    0,
    chapterTop - (page.viewportSize()?.height ?? 900) - 320,
  ))
  const response = await responsePromise
  expect(response.ok()).toBe(true)
  await expect(page.locator('.thermodynamics-menu')).toBeAttached()
  await page.waitForTimeout(100)
  expect(thermodynamicsRequests).toHaveLength(1)
})

test.describe('production landing line-field loading and geometry', () => {
  test('renderer chunk is absent at first paint and requested exactly once at generated preload', async ({ page }) => {
    const assetName = await rendererAssetName()
    const builtIndex = await readFile('dist/index.html', 'utf8')
    expect(builtIndex).not.toContain(assetName)

    const runtime = collectLineFieldRuntimeErrors(page)
    const rendererRequests: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith(`/assets/${assetName}`)) {
        rendererRequests.push(request.url())
      }
    })

    await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })
    await page.goto('./')
    await expect(page.getByRole('heading', { name: 'Nicht nur rechnen. Systeme verstehen.' })).toBeVisible()
    const field = page.locator('.landing-line-field')
    await expect(field).toHaveAttribute('data-line-field-status', 'dormant')
    await expect(field.locator('canvas')).toHaveCount(0)

    const eagerReferences = await page.locator('script[src], link[rel="modulepreload"][href]').evaluateAll((nodes) => (
      nodes.map(node => node.getAttribute('src') ?? node.getAttribute('href') ?? '')
    ))
    expect(eagerReferences.some(reference => reference.endsWith(`/assets/${assetName}`))).toBe(false)
    expect(rendererRequests).toEqual([])

    const rendererResponse = page.waitForResponse(
      response => new URL(response.url()).pathname.endsWith(`/assets/${assetName}`),
      { timeout: 10_000 },
    )
    await scrollFilmToProgress(page, lineFieldConfig.reveal.preloadFilmProgress, 4)
    const response = await rendererResponse
    expect(response.ok()).toBe(true)
    await page.waitForTimeout(100)
    expect(rendererRequests).toHaveLength(1)

    await scrollFilmToProgress(page, lineFieldConfig.reveal.startFilmProgress, 4)
    await expectReadyLineField(page)
    expect(rendererRequests).toHaveLength(1)
    expect(runtime.errors).toEqual([])
  })

  test('Reduced Motion never requests the deferred renderer asset', async ({ page }) => {
    const assetName = await rendererAssetName()
    const runtime = collectLineFieldRuntimeErrors(page)
    const rendererRequests: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith(`/assets/${assetName}`)) {
        rendererRequests.push(request.url())
      }
    })

    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
    await page.goto('./')
    const field = page.locator('.landing-line-field')
    await expect(field).toHaveAttribute('data-line-field-status', 'fallback-reduced-motion')
    await page.evaluate(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'auto' })
      window.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('scroll'))
    })
    await page.waitForTimeout(250)

    await expect(field.locator('canvas')).toHaveCount(0)
    await expect(field.locator('[data-line-field-fallback]')).toHaveCount(1)
    expect(rendererRequests).toEqual([])
    expect(runtime.errors).toEqual([])
  })

  test('desktop and mobile cover the viewport while backing buffers remain bounded', async ({ page }) => {
    const runtime = collectLineFieldRuntimeErrors(page)
    await page.addInitScript(() => {
      const descriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')
      Object.defineProperty(window, 'devicePixelRatio', {
        configurable: true,
        get: () => 3,
      })
      ;(window as typeof window & { __restoreLineFieldDpr?: () => void }).__restoreLineFieldDpr = () => {
        if (descriptor) Object.defineProperty(window, 'devicePixelRatio', descriptor)
        else Reflect.deleteProperty(window, 'devicePixelRatio')
      }
    })

    try {
      await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })
      await page.goto('./')
      await scrollFilmToProgress(page, lineFieldConfig.reveal.startFilmProgress)
      const field = await expectColdLineFieldOutcome(page, 'ready')
      const geometry = await field.evaluate((root) => {
        const canvas = root.querySelector('canvas') as HTMLCanvasElement
        const rootRect = root.getBoundingClientRect()
        const canvasStyle = getComputedStyle(canvas)
        return {
          backingHeight: canvas.height,
          backingWidth: canvas.width,
          canvasCssHeight: Number.parseFloat(canvasStyle.height),
          canvasCssWidth: Number.parseFloat(canvasStyle.width),
          documentHeight: document.documentElement.scrollHeight,
          rootHeight: rootRect.height,
          rootLeft: rootRect.left,
          rootWidth: rootRect.width,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
        }
      })

      expect(Math.abs(geometry.rootLeft)).toBeLessThanOrEqual(1)
      expect(Math.abs(geometry.rootWidth - geometry.viewportWidth)).toBeLessThanOrEqual(1)
      expect(Math.abs(geometry.canvasCssWidth - geometry.viewportWidth)).toBeLessThanOrEqual(1)
      expect(Math.abs(geometry.rootHeight - geometry.viewportHeight)).toBeLessThanOrEqual(1)
      expect(Math.abs(geometry.canvasCssHeight - geometry.viewportHeight)).toBeLessThanOrEqual(1)
      expect(geometry.rootHeight).not.toBe(geometry.documentHeight)
      expect(geometry.canvasCssHeight).not.toBe(geometry.documentHeight)
      expect(geometry.backingWidth).toBeLessThanOrEqual(
        lineFieldConfig.performance.maximumRenderDimensionPx,
      )
      expect(geometry.backingHeight).toBeLessThanOrEqual(
        lineFieldConfig.performance.maximumRenderDimensionPx,
      )
      expect(geometry.canvasCssWidth).toBe(geometry.rootWidth)
      expect(geometry.canvasCssHeight).toBe(geometry.rootHeight)
      expect(runtime.errors).toEqual([])
    } finally {
      await page.evaluate(() => {
        ;(window as typeof window & { __restoreLineFieldDpr?: () => void })
          .__restoreLineFieldDpr?.()
      }).catch(() => undefined)
    }
  })
})

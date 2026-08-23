import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import {
  lineFieldAuthoringMetadata,
  lineFieldConfig,
} from '../src/landing/line-field/config/line-field-config.generated'
import {
  installLineFieldDrawCounter,
  lineFieldDrawCount,
} from './helpers/line-field-draw-counter'

const swiftShaderLaunchOptions = {
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
}

test.use({ launchOptions: swiftShaderLaunchOptions })
test.beforeEach(async ({ page }) => installLineFieldDrawCounter(page))

const finalMottoVariables = {
  '--motto-orbit-x': '0px',
  '--motto-orbit-y': '0px',
  '--motto-orbit-z': '',
  '--motto-scale': '1',
  '--motto-blur': '0px',
  '--motto-opacity': '1',
} as const

const coldLineFieldOutcomes = [
  'ready',
  'fallback-reduced-motion',
  'fallback-unsupported',
  'fallback-error',
  'fallback-context-lost',
] as const

type ColdLineFieldOutcome = typeof coldLineFieldOutcomes[number]
type TerminalLineFieldStatus = 'fallback-error' | 'fallback-context-lost'

interface LineFieldRafAuditSnapshot {
  armed: boolean
  cancelledIds: number[]
  conflictingCallbackIds: number[]
  pendingIds: number[]
  postTerminalSchedules: number
  recognizedCallbackId: number | null
  recognizedCount: number
}

const wrightTimelineProperties = [
  '--wright-film-progress',
  '--wright-theme-fade',
  '--wright-decay',
  '--wright-light-opacity',
  '--wright-dark-opacity',
  '--wright-drift-x',
  '--wright-rotation',
  '--wright-jitter-x',
  '--wright-jitter-y',
  '--wright-panel-blur',
  '--wright-chromatic-wash',
  '--wright-desaturation',
  '--wright-contrast',
] as const

interface WrightRect {
  x: number
  y: number
  width: number
  height: number
}

interface WrightGeometry {
  stage: WrightRect
  light: WrightRect
  dark: WrightRect
  darkFits: boolean
}

interface WrightFirstPaintSnapshot {
  scrollY: number
  filmProgress: number
  themeFade: number
  lightOpacity: number
  darkOpacity: number
  lightHidden: string | null
  darkHidden: string | null
  turbulenceFrequency: number
  displacementScale: number
  videoDuration: number
  videoTime: number
}

type EvidenceTheme = 'dark' | 'light'

interface LineFieldEvidenceTargets {
  readonly buildEnd: number
  readonly filmRange: number
  readonly filmTop: number
  readonly handoffDocumentY: number
  readonly mottoEnd: number
  readonly mottoMid: number
  readonly mottoStart: number
}

interface ResponsiveMottoFrame {
  readonly blurPx: number
  readonly card: WrightRect
  readonly opacity: number
  readonly scale: number
  readonly scrollWidth: number
  readonly slot: WrightRect
  readonly translateX: number
  readonly translateY: number
  readonly viewport: WrightRect
}

interface ResponsiveMottoPaint {
  readonly bounding: WrightRect
  readonly intersection: WrightRect
  readonly intersectionArea: number
  readonly panelTop: number
  readonly viewportBoundedArea: number
}

const session3EvidenceRunDirectory = process.env.SESSION3_EVIDENCE_RUN_DIR?.trim() || null
const requestedSession3EvidenceHead = process.env.SESSION3_EVIDENCE_HEAD?.trim() || null
let validatedSession3EvidenceHead: string | null = null

function requiredSession3EvidenceRunDirectory() {
  if (!session3EvidenceRunDirectory) {
    throw new Error('SESSION3_EVIDENCE_RUN_DIR must be set for Session 3 evidence capture')
  }
  return session3EvidenceRunDirectory
}

function requiredSession3EvidenceHead() {
  if (validatedSession3EvidenceHead) return validatedSession3EvidenceHead
  if (!requestedSession3EvidenceHead) {
    throw new Error('SESSION3_EVIDENCE_HEAD must be set to the full real Git HEAD')
  }
  if (!/^[0-9a-f]{40,64}$/.test(requestedSession3EvidenceHead)) {
    throw new Error('SESSION3_EVIDENCE_HEAD must be a full Git object ID')
  }

  const actualHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim()
  if (requestedSession3EvidenceHead !== actualHead) {
    throw new Error(
      `SESSION3_EVIDENCE_HEAD ${requestedSession3EvidenceHead} does not equal real HEAD ${actualHead}`,
    )
  }
  const trackedChanges = execFileSync(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    { cwd: process.cwd(), encoding: 'utf8' },
  ).trim()
  if (trackedChanges) {
    throw new Error('Session 3 evidence requires a clean working tree at the exact HEAD')
  }

  validatedSession3EvidenceHead = actualHead
  return actualHead
}

async function createSession3EvidenceCell(baseName: string) {
  requiredSession3EvidenceHead()
  const runDirectory = requiredSession3EvidenceRunDirectory()
  await mkdir(runDirectory, { recursive: true })
  const cellDirectory = join(runDirectory, baseName)
  try {
    await mkdir(cellDirectory)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw new Error(
        `Session 3 evidence cell already exists; use a fresh run directory: ${baseName}`,
      )
    }
    throw error
  }
  return cellDirectory
}

function evidenceProgressTag(progress: number) {
  return `p${Math.round(progress * 100).toString().padStart(2, '0')}`
}

function evidenceGatherTag(progress: number) {
  return Math.round(progress * 100).toString().padStart(3, '0')
}

function evidenceViewportTag(page: Page) {
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('Session 3 evidence requires an explicit viewport')
  return `${viewport.width}x${viewport.height}`
}

async function assignEvidenceIdentity(page: Page) {
  const rootToken = await page.locator('.landing-line-field').evaluate((element) => {
    const node = element as HTMLElement
    node.dataset.evidenceRootToken ||= crypto.randomUUID()
    return node.dataset.evidenceRootToken
  })
  return rootToken
}

async function assignEvidenceCanvasIdentity(page: Page) {
  return page.locator('.landing-line-field__renderer-host canvas').evaluate((element) => {
    const node = element as HTMLElement
    node.dataset.evidenceCanvasToken ||= crypto.randomUUID()
    return node.dataset.evidenceCanvasToken
  })
}

async function assignEvidenceCanvasIdentityIfPresent(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector(
      '.landing-line-field__renderer-host canvas',
    ) as HTMLCanvasElement | null
    if (!canvas) return null
    canvas.dataset.evidenceCanvasToken ||= crypto.randomUUID()
    return canvas.dataset.evidenceCanvasToken
  })
}

async function readLineFieldEvidenceTargets(page: Page): Promise<LineFieldEvidenceTargets> {
  return page.locator('.wright-film-track').evaluate((track, config) => {
    const filmRect = track.getBoundingClientRect()
    const motto = document.querySelector('.wright-motto-panel')
    const slot = document.querySelector('.wright-motto-panel__slot')
    if (!motto || !slot) throw new Error('Session 3 evidence geometry is incomplete')

    const mottoRect = motto.getBoundingClientRect()
    const slotRect = slot.getBoundingClientRect()
    const filmTop = filmRect.top + window.scrollY
    const filmRange = Math.max(1, filmRect.height - window.innerHeight)
    const mottoTop = mottoRect.top + window.scrollY
    const mottoStart = mottoTop - window.innerHeight
    const mottoEnd = mottoStart + config.travelViewportHeights * window.innerHeight
    const triggerDistance = config.triggerPastMottoVh * window.innerHeight / 100

    return {
      buildEnd: mottoEnd + triggerDistance,
      filmRange,
      filmTop,
      handoffDocumentY: slotRect.bottom + window.scrollY + triggerDistance,
      mottoEnd,
      mottoMid: (mottoStart + mottoEnd) / 2,
      mottoStart,
    }
  }, {
    travelViewportHeights: lineFieldConfig.motto.travelViewportHeights,
    triggerPastMottoVh: lineFieldConfig.handoff.triggerPastMottoVh,
  })
}

async function readResponsiveMottoFrame(page: Page): Promise<ResponsiveMottoFrame> {
  return page.locator('.wright-motto-panel').evaluate((panel) => {
    const slot = panel.querySelector('.wright-motto-panel__slot')
    const card = panel.querySelector('.wright-motto-panel__card')
    if (!(slot instanceof HTMLElement) || !(card instanceof HTMLElement)) {
      throw new Error('Responsive motto slot/card geometry is incomplete')
    }

    const rectOf = (element: HTMLElement): WrightRect => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }
    const parseSignal = (name: string) => {
      const value = Number.parseFloat((panel as HTMLElement).style.getPropertyValue(name))
      if (!Number.isFinite(value)) throw new Error(`Responsive motto signal ${name} is not finite`)
      return value
    }

    return {
      blurPx: parseSignal('--motto-blur'),
      card: rectOf(card),
      opacity: parseSignal('--motto-opacity'),
      scale: parseSignal('--motto-scale'),
      scrollWidth: document.documentElement.scrollWidth,
      slot: rectOf(slot),
      translateX: parseSignal('--motto-orbit-x'),
      translateY: parseSignal('--motto-orbit-y'),
      viewport: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
    }
  })
}

async function readResponsiveMottoPaint(page: Page): Promise<ResponsiveMottoPaint> {
  return page.locator('.wright-motto-panel__card').evaluate(async (card) => {
    const panel = card.closest('.wright-motto-panel')
    if (!(panel instanceof HTMLElement)) {
      throw new Error('Responsive motto paint panel is incomplete')
    }

    const rectOf = (rect: DOMRectReadOnly): WrightRect => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    })
    const intersect = (first: WrightRect, second: WrightRect): WrightRect => {
      const left = Math.max(first.x, second.x)
      const top = Math.max(first.y, second.y)
      const right = Math.min(first.x + first.width, second.x + second.width)
      const bottom = Math.min(first.y + first.height, second.y + second.height)
      return {
        x: left,
        y: top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      }
    }
    const area = (rect: WrightRect) => rect.width * rect.height
    const bounding = rectOf(card.getBoundingClientRect())
    const viewport = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }
    const entry = await new Promise<IntersectionObserverEntry>((resolve) => {
      const observer = new IntersectionObserver((entries) => {
        observer.disconnect()
        resolve(entries[0])
      })
      observer.observe(card)
    })
    const intersection = rectOf(entry.intersectionRect)

    return {
      bounding,
      intersection,
      intersectionArea: area(intersection),
      panelTop: panel.getBoundingClientRect().top,
      viewportBoundedArea: area(intersect(bounding, viewport)),
    }
  })
}

function responsiveMottoViewportIntersection(frame: ResponsiveMottoFrame) {
  const visibleWidth = Math.max(
    0,
    Math.min(frame.viewport.width, frame.card.x + frame.card.width) - Math.max(0, frame.card.x),
  )
  const visibleHeight = Math.max(
    0,
    Math.min(frame.viewport.height, frame.card.y + frame.card.height) - Math.max(0, frame.card.y),
  )
  return visibleWidth * visibleHeight / (frame.card.width * frame.card.height)
}

function responsiveMottoSignedChordDistanceRatio(
  start: ResponsiveMottoFrame,
  interior: ResponsiveMottoFrame,
  end: ResponsiveMottoFrame,
) {
  const startCenter = [
    start.card.x + start.card.width / 2,
    start.card.y + start.card.height / 2,
  ] as const
  const interiorCenter = [
    interior.card.x + interior.card.width / 2,
    interior.card.y + interior.card.height / 2,
  ] as const
  const endCenter = [
    end.card.x + end.card.width / 2,
    end.card.y + end.card.height / 2,
  ] as const
  const chordX = endCenter[0] - startCenter[0]
  const chordY = endCenter[1] - startCenter[1]
  const chordLength = Math.hypot(chordX, chordY)
  if (chordLength === 0) return 0

  const perpendicularDistance = (
    chordX * (interiorCenter[1] - startCenter[1])
      - chordY * (interiorCenter[0] - startCenter[0])
  ) / chordLength
  return perpendicularDistance / Math.min(start.viewport.width, start.viewport.height)
}

function expectResponsiveMottoNoOverflow(frame: ResponsiveMottoFrame) {
  expect(frame.scrollWidth).toBeLessThanOrEqual(frame.viewport.width + 1)
}

function expectResponsiveMottoGutter(frame: ResponsiveMottoFrame) {
  const minimumGutter = Math.max(
    lineFieldConfig.motto.projection.minimumLeftGutterPx,
    lineFieldConfig.motto.projection.minimumLeftGutterVw * frame.viewport.width / 100,
  )
  const visibleLeft = frame.card.x
    - lineFieldConfig.motto.projection.blurSafetyMultiplier * frame.blurPx
  expect(visibleLeft).toBeGreaterThanOrEqual(minimumGutter - 1)
}

async function scrollResponsiveMottoTo(page: Page, targetScrollY: number) {
  return page.evaluate(async (target) => {
    const previousBehavior = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo({ top: target, behavior: 'auto' })
    window.dispatchEvent(new Event('scroll'))
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    document.documentElement.style.scrollBehavior = previousBehavior
    return window.scrollY
  }, targetScrollY)
}

async function expectResponsiveMottoOrbitAtCurrentViewport(page: Page) {
  const targets = await readLineFieldEvidenceTargets(page)

  await scrollResponsiveMottoTo(page, Math.floor(targets.mottoStart))
  const start = await readResponsiveMottoFrame(page)
  expect((start.card.x + start.card.width / 2) / start.viewport.width).toBeCloseTo(0.70, 2)
  expect(start.card.y + start.card.height / 2).toBeCloseTo(start.viewport.height, 0)
  expect(start.opacity).toBeCloseTo(0, 8)
  expect(start.scale).toBeCloseTo(0.22, 8)
  expect(start.blurPx).toBeCloseTo(8, 8)
  expectResponsiveMottoGutter(start)
  expectResponsiveMottoNoOverflow(start)

  await scrollResponsiveMottoTo(
    page,
    Math.ceil(targets.mottoStart + (targets.mottoEnd - targets.mottoStart) * 0.15),
  )
  const early = await readResponsiveMottoFrame(page)
  const earlyPaint = await readResponsiveMottoPaint(page)
  expect(responsiveMottoViewportIntersection(early)).toBeGreaterThanOrEqual(0.50)
  expect(earlyPaint.bounding.y).toBeLessThan(earlyPaint.panelTop)
  expect(earlyPaint.intersectionArea / earlyPaint.viewportBoundedArea).toBeGreaterThanOrEqual(0.95)
  expectResponsiveMottoNoOverflow(early)

  const middleTarget = Math.ceil(targets.mottoMid)
  await scrollResponsiveMottoTo(page, middleTarget)
  const middle = await readResponsiveMottoFrame(page)
  expect(responsiveMottoViewportIntersection(middle)).toBeGreaterThanOrEqual(0.15)
  expectResponsiveMottoNoOverflow(middle)
  const middleTuple = [
    middle.translateX,
    middle.translateY,
    middle.scale,
    middle.blurPx,
    middle.opacity,
  ]
  await scrollResponsiveMottoTo(
    page,
    Math.ceil(targets.mottoMid + (targets.mottoEnd - targets.mottoMid) / 2),
  )
  await scrollResponsiveMottoTo(page, middleTarget)
  const replayedMiddle = await readResponsiveMottoFrame(page)
  expect([
    replayedMiddle.translateX,
    replayedMiddle.translateY,
    replayedMiddle.scale,
    replayedMiddle.blurPx,
    replayedMiddle.opacity,
  ]).toEqual(middleTuple)

  await scrollResponsiveMottoTo(page, Math.ceil(targets.mottoEnd))
  const end = await readResponsiveMottoFrame(page)
  expect(end.translateX).toBeCloseTo(0, 8)
  expect(end.translateY).toBeCloseTo(0, 8)
  expect(end.scale).toBe(1)
  expect(end.blurPx).toBe(0)
  expect(end.opacity).toBe(1)
  expect(responsiveMottoViewportIntersection(end)).toBe(1)
  // CSS Y grows downward, so the corrected front-view sweep has a negative signed perpendicular ratio.
  expect(responsiveMottoSignedChordDistanceRatio(start, middle, end)).toBeLessThanOrEqual(-0.10)
  expect(end.card.x + end.card.width / 2).toBeCloseTo(
    end.slot.x + end.slot.width / 2,
    8,
  )
  expect(end.card.y + end.card.height / 2).toBeCloseTo(
    end.slot.y + end.slot.height / 2,
    8,
  )
  expectResponsiveMottoGutter(end)
  expectResponsiveMottoNoOverflow(end)
}

function evidenceFilmTarget(targets: LineFieldEvidenceTargets, progress: number) {
  return targets.filmTop + progress * targets.filmRange
}

async function scrollEvidenceTo(page: Page, targetScrollY: number) {
  return page.evaluate(async (target) => {
    const previousBehavior = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo({ top: Math.ceil(target), behavior: 'auto' })
    window.dispatchEvent(new Event('scroll'))
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    document.documentElement.style.scrollBehavior = previousBehavior
    return window.scrollY
  }, targetScrollY)
}

async function findFirstEvidenceHandoff(
  page: Page,
  mottoEnd: number,
  buildEnd: number,
) {
  return page.evaluate(async ({ firstTarget, finalTarget }) => {
    const root = document.querySelector('.landing-line-field')
    if (!root) throw new Error('Line-field root is missing during handoff search')
    const previousBehavior = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'auto'

    try {
      for (
        let target = Math.ceil(firstTarget);
        target <= Math.ceil(finalTarget);
        target += 1
      ) {
        window.scrollTo({ top: target, behavior: 'auto' })
        window.dispatchEvent(new Event('scroll'))
        await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
        const mode = root.getAttribute('data-line-field-mode')
        if (mode === 'auto-handoff' || mode === 'autonomous') {
          return { actualScrollY: window.scrollY, mode, requestedScrollY: target }
        }
      }
    } finally {
      document.documentElement.style.scrollBehavior = previousBehavior
    }

    return {
      actualScrollY: window.scrollY,
      mode: root.getAttribute('data-line-field-mode'),
      requestedScrollY: null,
    }
  }, { firstTarget: mottoEnd, finalTarget: buildEnd })
}

async function readLineFieldEvidenceState(
  page: Page,
  label: string,
  formula: string,
  formulaTarget: number,
  rootToken: string,
  canvasToken: string | null,
  rendererRequests: readonly string[],
) {
  const state = await page.evaluate((input) => {
    const rectOf = (element: Element | null) => {
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
        x: rect.x,
        y: rect.y,
      }
    }
    const root = document.querySelector('.landing-line-field') as HTMLElement | null
    const canvas = root?.querySelector('canvas') as HTMLCanvasElement | null
    const video = document.querySelector('.wright-hero-media')
    const videoRect = video?.getBoundingClientRect() ?? null
    const motto = document.querySelector('.wright-motto-panel') as HTMLElement | null
    const mottoStyle = motto?.style
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    return {
      actualScrollY: window.scrollY,
      anchor: videoRect
        ? { x: videoRect.left + videoRect.width / 2, y: videoRect.top + videoRect.height / 2 }
        : null,
      backing: canvas
        ? {
            effectiveDprX: canvas.width / Math.max(1, canvas.getBoundingClientRect().width),
            effectiveDprY: canvas.height / Math.max(1, canvas.getBoundingClientRect().height),
            height: canvas.height,
            width: canvas.width,
          }
        : null,
      canvasRect: rectOf(canvas),
      chapterIds: Array.from(
        document.querySelectorAll<HTMLElement>('.landing-shell__content > section[id]'),
        chapter => chapter.id,
      ),
      document: {
        height: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
      },
      fallback: (() => {
        const svg = root?.querySelector('[data-line-field-fallback] svg')
        return svg
          ? {
              spinePath: svg.querySelector('[data-line-field-spine]')?.getAttribute('d') ?? null,
              viewBox: svg.getAttribute('viewBox'),
            }
          : null
      })(),
      fieldRect: rectOf(root),
      formula: input.formula,
      formulaTarget: input.formulaTarget,
      headerRect: rectOf(document.querySelector('.landing-shell__header')),
      horizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 1,
      identity: {
        canvasAbsent: canvas === null,
        canvasToken: canvas?.dataset.evidenceCanvasToken ?? null,
        canvasTokenMatches: canvas
          ? canvas.dataset.evidenceCanvasToken === input.canvasToken
          : input.canvasToken === null,
        rootToken: root?.dataset.evidenceRootToken ?? null,
        rootTokenMatches: root?.dataset.evidenceRootToken === input.rootToken,
      },
      label: input.label,
      mode: root?.getAttribute('data-line-field-mode') ?? null,
      mottoFrame: mottoStyle
        ? {
            blur: mottoStyle.getPropertyValue('--motto-blur'),
            opacity: mottoStyle.getPropertyValue('--motto-opacity'),
            scale: mottoStyle.getPropertyValue('--motto-scale'),
            x: mottoStyle.getPropertyValue('--motto-orbit-x'),
            y: mottoStyle.getPropertyValue('--motto-orbit-y'),
            z: mottoStyle.getPropertyValue('--motto-orbit-z'),
          }
        : null,
      mottoPanelRect: rectOf(motto),
      mottoSlotRect: rectOf(document.querySelector('.wright-motto-panel__slot')),
      particleFieldCount: document.querySelectorAll('.particle-field').length,
      reducedMotion: document.querySelector('.landing-shell')?.getAttribute('data-reduced-motion'),
      rendererAssetRequestCount: input.rendererRequests.length,
      rendererAssetRequests: input.rendererRequests,
      status: root?.getAttribute('data-line-field-status') ?? null,
      theme: document.querySelector('.landing-shell')?.getAttribute('data-landing-theme'),
      videoRect: rectOf(video),
      viewport: { height: viewportHeight, width: viewportWidth },
    }
  }, {
    canvasToken,
    formula,
    formulaTarget,
    label,
    rendererRequests: rendererRequests.map(url => new URL(url).pathname),
    rootToken,
  })
  return {
    ...state,
    frameSequence: await lineFieldDrawCount(page),
  }
}

function expectEvidenceScrollTarget(
  actualScrollY: number,
  formulaTarget: number,
  label: string,
) {
  const delta = Math.abs(actualScrollY - formulaTarget)
  expect(
    delta,
    `${label} scroll must match its live formula target within 1px browser rounding`,
  ).toBeLessThanOrEqual(1)
}

async function captureLineFieldEvidenceState(
  page: Page,
  evidenceDirectory: string,
  options: {
    readonly canvasToken: string | null
    readonly filename?: string
    readonly formula: string
    readonly formulaTarget: number
    readonly label: string
    readonly rendererRequests: readonly string[]
    readonly rootToken: string
  },
) {
  const sequenceBefore = await lineFieldDrawCount(page)
  if (options.filename) {
    await page.screenshot({
      path: join(evidenceDirectory, options.filename),
    })
  }
  const state = await readLineFieldEvidenceState(
    page,
    options.label,
    options.formula,
    options.formulaTarget,
    options.rootToken,
    options.canvasToken,
    options.rendererRequests,
  )
  expectEvidenceScrollTarget(state.actualScrollY, options.formulaTarget, options.label)
  return {
    ...state,
    scrollDeltaPx: state.actualScrollY - options.formulaTarget,
    screenshot: options.filename ?? null,
    screenshotFrameSequence: options.filename
      ? { after: state.frameSequence, before: sequenceBefore }
      : null,
  }
}

async function writeSession3EvidenceJson(
  directory: string,
  filename: string,
  value: unknown,
) {
  await writeFile(join(directory, filename), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function evidenceBaseName(
  page: Page,
  projectName: string,
  theme: EvidenceTheme,
  motion: 'normal' | 'reduced',
) {
  const projectTag = projectName.replace(/-chromium$/, '')
  return `session3-${projectTag}-${evidenceViewportTag(page)}-${theme}-${motion}`
}

function evidenceMetadata(
  page: Page,
  testInfo: TestInfo,
  theme: EvidenceTheme,
  motion: 'normal' | 'reduced',
) {
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('Session 3 evidence requires an explicit metadata viewport')
  return {
    generatedConfig: {
      animationVersion: lineFieldAuthoringMetadata.animationVersion,
      materialsVersion: lineFieldAuthoringMetadata.materialsVersion,
      seedTag: evidenceProgressTag(lineFieldConfig.reveal.startFilmProgress),
    },
    motion,
    project: testInfo.project.name,
    sourceHead: requiredSession3EvidenceHead(),
    theme,
    viewport,
  }
}

async function installSession3EvidenceClock(page: Page) {
  await page.addInitScript(() => {
    const nativeRequestAnimationFrame = window.requestAnimationFrame
    const nativeCancelAnimationFrame = window.cancelAnimationFrame
    const queuedCallbacks = new Map<number, FrameRequestCallback>()
    let gated = false
    let gatedNow = performance.now()
    let nextGatedId = 2_000_000

    const patchedRequestAnimationFrame = ((callback: FrameRequestCallback) => {
      if (!gated) {
        return nativeRequestAnimationFrame.call(window, (nativeNow) => {
          if (gated) gatedNow = Math.max(gatedNow, nativeNow)
          callback(gated ? gatedNow : nativeNow)
        })
      }
      const frameId = nextGatedId
      nextGatedId += 1
      queuedCallbacks.set(frameId, callback)
      return frameId
    }) as typeof window.requestAnimationFrame

    const patchedCancelAnimationFrame = ((frameId: number) => {
      if (!queuedCallbacks.delete(frameId)) {
        nativeCancelAnimationFrame.call(window, frameId)
      }
    }) as typeof window.cancelAnimationFrame

    window.requestAnimationFrame = patchedRequestAnimationFrame
    window.cancelAnimationFrame = patchedCancelAnimationFrame

    const controls = {
      enable() {
        gated = true
        gatedNow = performance.now()
      },
      flushFrame(deltaMs = 50) {
        const batch = [...queuedCallbacks.entries()]
        if (batch.length === 0) throw new Error('No Session 3 evidence frame is queued')
        batch.forEach(([frameId]) => queuedCallbacks.delete(frameId))
        gatedNow += deltaMs
        batch.forEach(([, callback]) => callback(gatedNow))
        return { executed: batch.length, queued: queuedCallbacks.size }
      },
      queuedFrames() {
        return queuedCallbacks.size
      },
      restore() {
        gated = false
        queuedCallbacks.clear()
        if (window.requestAnimationFrame === patchedRequestAnimationFrame) {
          window.requestAnimationFrame = nativeRequestAnimationFrame
        }
        if (window.cancelAnimationFrame === patchedCancelAnimationFrame) {
          window.cancelAnimationFrame = nativeCancelAnimationFrame
        }
      },
    }
    ;(window as typeof window & { __session3EvidenceClock?: typeof controls })
      .__session3EvidenceClock = controls
  })
}

async function installLineFieldEvidenceBackbuffer(page: Page) {
  await page.addInitScript(() => {
    const nativeGetContext = HTMLCanvasElement.prototype.getContext

    // Production correctly uses the default discardable WebGL backbuffer. This evidence-only
    // seam preserves it so canvas serialization proves rendered pixels instead of compositor luck.
    HTMLCanvasElement.prototype.getContext = (function (
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

    ;(window as typeof window & { __restoreLineFieldWebgl?: () => void })
      .__restoreLineFieldWebgl = () => {
        HTMLCanvasElement.prototype.getContext = nativeGetContext
      }
  })
}

async function enableSession3EvidenceClock(page: Page) {
  await page.evaluate(() => {
    const clock = (window as typeof window & {
      __session3EvidenceClock?: { enable(): void }
    }).__session3EvidenceClock
    if (!clock) throw new Error('Session 3 evidence clock was not installed')
    clock.enable()
  })
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & {
      __session3EvidenceClock?: { queuedFrames(): number }
    }).__session3EvidenceClock?.queuedFrames() ?? 0
  ))).toBeGreaterThan(0)
}

async function flushSession3EvidenceFrame(page: Page, deltaMs = 50) {
  return page.evaluate((delta) => {
    const clock = (window as typeof window & {
      __session3EvidenceClock?: {
        flushFrame(value: number): { executed: number; queued: number }
      }
    }).__session3EvidenceClock
    if (!clock) throw new Error('Session 3 evidence clock was not installed')
    return clock.flushFrame(delta)
  }, deltaMs)
}

async function scrollEvidenceToGated(page: Page, targetScrollY: number) {
  await page.evaluate((target) => {
    const previousBehavior = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo({ top: Math.ceil(target), behavior: 'auto' })
    window.dispatchEvent(new Event('scroll'))
    document.documentElement.style.scrollBehavior = previousBehavior
  }, targetScrollY)
  await flushSession3EvidenceFrame(page)
  return page.evaluate(() => window.scrollY)
}

function collectRuntimeErrors(page: Page, allowExpectedFailedResource = false) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (allowExpectedFailedResource && message.text() === 'Failed to load resource: net::ERR_FAILED') return
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

async function scrollLineFieldFilmTo(page: Page, progress: number) {
  await scrubWrightTo(page, progress)
  await page.locator('.landing-shell__content').evaluate(async (element) => {
    await new Promise<void>((resolve) => {
      const observer = new IntersectionObserver((entries) => {
        if (!entries.some(entry => entry.target === element && entry.isIntersecting)) return
        observer.disconnect()
        resolve()
      })
      observer.observe(element)
    })
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    window.dispatchEvent(new Event('scroll'))
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
  })
}

async function scrollLineFieldToAutonomous(page: Page) {
  return page.locator('.wright-motto-panel').evaluate(async (element, handoff) => {
    const mottoTop = element.getBoundingClientRect().top + window.scrollY
    const target = Math.ceil(
      mottoTop - window.innerHeight
        + handoff.travelViewportHeights * window.innerHeight
        + handoff.triggerPastMottoVh * window.innerHeight / 100,
    )
    const previousBehavior = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo({ top: target, behavior: 'auto' })
    window.dispatchEvent(new Event('scroll'))
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    window.dispatchEvent(new Event('scroll'))
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    document.documentElement.style.scrollBehavior = previousBehavior
    return target
  }, {
    travelViewportHeights: lineFieldConfig.motto.travelViewportHeights,
    triggerPastMottoVh: lineFieldConfig.handoff.triggerPastMottoVh,
  })
}

async function scrollLineFieldInstantly(page: Page, target: number) {
  return page.evaluate(async (scrollTarget) => {
    const root = document.documentElement
    const previousBehavior = root.style.scrollBehavior
    root.style.scrollBehavior = 'auto'
    try {
      window.scrollTo({ top: scrollTarget, behavior: 'auto' })
      window.dispatchEvent(new Event('scroll'))
      await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
      window.dispatchEvent(new Event('scroll'))
      await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
      return window.scrollY
    } finally {
      root.style.scrollBehavior = previousBehavior
    }
  }, target)
}

async function lineFieldMotionOpacity(canvas: Locator) {
  return canvas.evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) {
      throw new Error('Line-field renderer canvas is unavailable')
    }
    const gl = element.getContext('webgl2')
    const program = gl?.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null
    const location = program ? gl?.getUniformLocation(program, 'motionOpacity') : null
    const value = gl && program && location ? gl.getUniform(program, location) : null
    if (typeof value !== 'number') {
      throw new Error('Line-field motion opacity uniform is unavailable')
    }
    return value
  })
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
      if (!context) throw new Error('Screenshot comparison canvas is unavailable')
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
      throw new Error('Screenshot comparison dimensions differ')
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

async function lineFieldCanvasFingerprint(canvas: Locator) {
  return canvas.evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) {
      throw new Error('Line-field renderer canvas is unavailable')
    }
    element.getContext('webgl2')?.finish()
    return element.toDataURL('image/png')
  })
}

async function lineFieldCanvasPng(canvas: Locator) {
  const dataUrl = await lineFieldCanvasFingerprint(canvas)
  const separator = dataUrl.indexOf(',')
  if (separator < 0 || !dataUrl.startsWith('data:image/png;base64,')) {
    throw new Error('Line-field canvas did not produce a PNG data URL')
  }
  return Buffer.from(dataUrl.slice(separator + 1), 'base64')
}

async function expectFinalMotto(page: Page) {
  const variables = await page.locator('.wright-motto-panel').evaluate((element, names) => {
    const inline = (element as HTMLElement).style
    return Object.fromEntries(names.map(name => [name, inline.getPropertyValue(name)]))
  }, Object.keys(finalMottoVariables))
  expect(variables).toEqual(finalMottoVariables)
}

async function expectColdLineFieldOutcome(page: Page, expected: ColdLineFieldOutcome) {
  const field = page.locator('.landing-line-field')
  await field.waitFor({ state: 'attached' })
  await page.waitForFunction((outcomes) => {
    const root = document.querySelector('.landing-line-field')
    if (!root) return false
    const status = root.getAttribute('data-line-field-status')
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

async function expectStaticLineFieldFallback(
  page: Page,
  status: TerminalLineFieldStatus,
) {
  const field = page.locator('.landing-line-field')
  await expect(field).toHaveAttribute('data-line-field-status', status)
  await expect(field).toHaveAttribute('data-line-field-mode', 'static')
  await expect(field.locator('.landing-line-field__renderer-host canvas')).toHaveCount(0)
  await expect(field.locator('[data-line-field-fallback]')).toHaveCount(1)
  await expectFinalMotto(page)
  return field
}

async function installLineFieldRafAudit(page: Page) {
  await page.addInitScript((mottoVariables) => {
    const nativeRequestAnimationFrame = window.requestAnimationFrame
    const nativeCancelAnimationFrame = window.cancelAnimationFrame
    const callbackIds = new WeakMap<FrameRequestCallback, number>()
    const pendingCallbacks = new Map<number, {
      callback: FrameRequestCallback
      callbackId: number
    }>()
    const cancellations: Array<{
      callback: FrameRequestCallback
      callbackId: number
      frameId: number
    }> = []
    const conflictingCallbacks = new Set<number>()
    let nextCallbackId = 1
    let recognizedCallback: FrameRequestCallback | null = null
    let recognizedCallbackId: number | null = null
    let recognizedCount = 0
    let armed = false
    let postTerminalSchedules = 0

    const callbackIdFor = (callback: FrameRequestCallback) => {
      const known = callbackIds.get(callback)
      if (known !== undefined) return known
      const assigned = nextCallbackId
      nextCallbackId += 1
      callbackIds.set(callback, assigned)
      return assigned
    }

    const lineFieldSignature = () => {
      const root = document.querySelector('.landing-line-field') as HTMLElement | null
      const motto = document.querySelector('.wright-motto-panel') as HTMLElement | null
      if (!root || !motto) return null

      return JSON.stringify([
        root.getAttribute('data-line-field-mode'),
        (Reflect.get(window, '__lineFieldDrawCounter') as
          | { snapshot(): { count: number } }
          | undefined)?.snapshot().count ?? null,
        root.style.top,
        root.style.left,
        root.style.width,
        root.style.height,
        ...mottoVariables.map(variable => motto.style.getPropertyValue(variable)),
      ])
    }

    const lineFieldIsTerminal = () => {
      const root = document.querySelector('.landing-line-field')
      const status = root?.getAttribute('data-line-field-status')
      return root?.getAttribute('data-line-field-mode') === 'static'
        || status?.startsWith('fallback-') === true
    }

    const snapshot = (): LineFieldRafAuditSnapshot => ({
      armed,
      cancelledIds: cancellations
        .filter(entry => entry.callback === recognizedCallback)
        .map(entry => entry.frameId),
      conflictingCallbackIds: [...conflictingCallbacks],
      pendingIds: [...pendingCallbacks.entries()]
        .filter(([, entry]) => entry.callback === recognizedCallback)
        .map(([frameId]) => frameId)
        .sort((left, right) => left - right),
      postTerminalSchedules,
      recognizedCallbackId,
      recognizedCount,
    })

    const patchedRequestAnimationFrame = ((callback: FrameRequestCallback) => {
      const callbackId = callbackIdFor(callback)
      let frameId = -1
      const auditedCallback: FrameRequestCallback = (nowMs) => {
        pendingCallbacks.delete(frameId)
        const before = lineFieldSignature()
        try {
          callback(nowMs)
        } finally {
          const after = lineFieldSignature()
          const changedLineFieldSignature = before !== null
            && after !== null
            && before !== after
          if (callback === recognizedCallback) {
            recognizedCount += 1
          } else if (changedLineFieldSignature) {
            if (recognizedCallback === null) {
              recognizedCallback = callback
              recognizedCallbackId = callbackId
              recognizedCount = 1
            } else {
              conflictingCallbacks.add(callbackId)
            }
          }
        }
      }

      frameId = nativeRequestAnimationFrame.call(window, auditedCallback)
      pendingCallbacks.set(frameId, { callback, callbackId })
      if (armed && callback === recognizedCallback && lineFieldIsTerminal()) {
        postTerminalSchedules += 1
      }
      return frameId
    }) as typeof window.requestAnimationFrame

    const patchedCancelAnimationFrame = ((frameId: number) => {
      const pending = pendingCallbacks.get(frameId)
      if (pending) {
        cancellations.push({ ...pending, frameId })
        pendingCallbacks.delete(frameId)
      }
      nativeCancelAnimationFrame.call(window, frameId)
    }) as typeof window.cancelAnimationFrame

    window.requestAnimationFrame = patchedRequestAnimationFrame
    window.cancelAnimationFrame = patchedCancelAnimationFrame

    const controls = {
      arm() {
        if (recognizedCallback === null) {
          throw new Error('Cannot arm the line-field RAF audit before recognizing runFrame')
        }
        armed = true
        return snapshot()
      },
      snapshot,
      restore() {
        if (window.requestAnimationFrame === patchedRequestAnimationFrame) {
          window.requestAnimationFrame = nativeRequestAnimationFrame
        }
        if (window.cancelAnimationFrame === patchedCancelAnimationFrame) {
          window.cancelAnimationFrame = nativeCancelAnimationFrame
        }
        armed = false
        pendingCallbacks.clear()
      },
    }
    ;(window as typeof window & { __lineFieldRafAudit?: typeof controls })
      .__lineFieldRafAudit = controls
  }, Object.keys(finalMottoVariables))
}

async function lineFieldRafAuditSnapshot(page: Page) {
  return page.evaluate(() => {
    const audit = (window as typeof window & {
      __lineFieldRafAudit?: { snapshot(): LineFieldRafAuditSnapshot }
    }).__lineFieldRafAudit
    if (!audit) throw new Error('Line-field RAF audit was not installed')
    return audit.snapshot()
  })
}

async function expectRecognizedLineFieldRaf(page: Page) {
  await expect.poll(async () => (
    await lineFieldRafAuditSnapshot(page)
  ).recognizedCount).toBeGreaterThanOrEqual(1)
  const snapshot = await lineFieldRafAuditSnapshot(page)
  expect(snapshot.recognizedCallbackId).not.toBeNull()
  expect(snapshot.conflictingCallbackIds).toEqual([])
  return snapshot.recognizedCallbackId as number
}

async function armLineFieldRafAudit(page: Page) {
  return page.evaluate(() => {
    const audit = (window as typeof window & {
      __lineFieldRafAudit?: { arm(): LineFieldRafAuditSnapshot }
    }).__lineFieldRafAudit
    if (!audit) throw new Error('Line-field RAF audit was not installed')
    return audit.arm()
  })
}

async function armLineFieldRafAuditBeforeTerminalTrigger(
  page: Page,
  recognizedCallbackId: number,
) {
  const snapshot = await armLineFieldRafAudit(page)
  expect(snapshot.armed).toBe(true)
  expect(snapshot.recognizedCallbackId).toBe(recognizedCallbackId)
  expect(snapshot.recognizedCount).toBeGreaterThanOrEqual(1)
  expect(snapshot.conflictingCallbackIds).toEqual([])
  expect(snapshot.pendingIds).toEqual([])
  expect(snapshot.postTerminalSchedules).toBe(0)
  return snapshot
}

async function expectPreTerminalLineFieldScheduleIgnored(
  page: Page,
  baseline: LineFieldRafAuditSnapshot,
) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.dispatchEvent(new Event('scroll'))
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve())
    })
  }))

  const snapshot = await lineFieldRafAuditSnapshot(page)
  expect(snapshot.armed).toBe(true)
  expect(snapshot.recognizedCallbackId).toBe(baseline.recognizedCallbackId)
  expect(snapshot.recognizedCount).toBeGreaterThan(baseline.recognizedCount)
  expect(snapshot.conflictingCallbackIds).toEqual([])
  expect(snapshot.pendingIds).toEqual([])
  expect(snapshot.postTerminalSchedules).toBe(0)
  return snapshot
}

async function rethemeStaticFallbackWithoutRetry(
  page: Page,
  rendererRequests: string[],
  stableSequence: number,
  stableStatus: TerminalLineFieldStatus,
  recognizedCallbackId: number,
) {
  const field = page.locator('.landing-line-field')
  const fallback = field.locator('[data-line-field-fallback]')
  const themeControl = page.locator('.theme-transition-control[data-variant="header"]')
  const requestCount = rendererRequests.length
  await expect(page.locator('.landing-shell')).toHaveAttribute('data-landing-theme', 'light')
  await expect(field).toHaveAttribute('data-line-field-status', stableStatus)
  await expect(fallback).toHaveAttribute('data-theme', 'light')
  await expectFinalMotto(page)

  const terminalAudit = await lineFieldRafAuditSnapshot(page)
  expect(terminalAudit.armed).toBe(true)
  expect(terminalAudit.recognizedCallbackId).toBe(recognizedCallbackId)
  expect(terminalAudit.recognizedCount).toBeGreaterThanOrEqual(1)
  expect(terminalAudit.conflictingCallbackIds).toEqual([])
  expect(terminalAudit.pendingIds).toEqual([])
  expect(terminalAudit.postTerminalSchedules).toBe(0)

  await page.evaluate(() => {
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: window.innerWidth / 2 }))
    window.dispatchEvent(new Event('resize'))
  })
  await themeControl.click()
  await expect(fallback).toHaveAttribute('data-theme', 'dark')
  await expect(themeControl).toHaveAttribute('data-phase', 'idle')
  await expect(page.locator('.landing-shell')).toHaveAttribute('data-landing-theme', 'dark')
  await expect.poll(() => lineFieldDrawCount(page)).toBe(stableSequence)
  await page.waitForTimeout(150)

  const finalAudit = await lineFieldRafAuditSnapshot(page)
  expect(finalAudit.armed).toBe(true)
  expect(finalAudit.cancelledIds).toEqual(terminalAudit.cancelledIds)
  expect(finalAudit.recognizedCallbackId).toBe(recognizedCallbackId)
  expect(finalAudit.recognizedCount).toBe(terminalAudit.recognizedCount)
  expect(finalAudit.conflictingCallbackIds).toEqual([])
  expect(finalAudit.pendingIds).toEqual([])
  expect(finalAudit.postTerminalSchedules).toBe(0)
  expect(rendererRequests).toHaveLength(requestCount)
  await expect(field).toHaveAttribute('data-line-field-status', stableStatus)
  await expectFinalMotto(page)
}

async function installLineFieldPauseSeams(page: Page) {
  await page.addInitScript(() => {
    const NativeIntersectionObserver = window.IntersectionObserver
    const nativeRequestAnimationFrame = window.requestAnimationFrame
    const nativeCancelAnimationFrame = window.cancelAnimationFrame
    const nativeGetContext = HTMLCanvasElement.prototype.getContext
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')
    const inheritedVisibilityDescriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'visibilityState',
    )
    let forcedVisibility: DocumentVisibilityState | null = null
    let gatedNow = performance.now()
    let nextGatedFrameId = 1_000_000
    const gatedFrames = new Map<number, FrameRequestCallback>()

    // A production WebGL backbuffer may be discarded after compositing. Preserve it only in this
    // pause seam so byte-identical screenshots prove renderer pixels rather than compositor luck.
    HTMLCanvasElement.prototype.getContext = (function (
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

    class ControlledIntersectionObserver {
      readonly native: IntersectionObserver
      readonly observed = new Set<Element>()
      forced: boolean | null = null

      constructor(
        readonly callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit,
      ) {
        this.native = new NativeIntersectionObserver((entries) => {
          const controlledEntries = this.forced === null
            ? entries
            : entries.map(entry => ({
                boundingClientRect: entry.boundingClientRect,
                intersectionRatio: this.forced ? Math.max(entry.intersectionRatio, 1) : 0,
                intersectionRect: entry.intersectionRect,
                isIntersecting: this.forced,
                rootBounds: entry.rootBounds,
                target: entry.target,
                time: entry.time,
              }) as IntersectionObserverEntry)
          this.callback(
            controlledEntries,
            this as unknown as IntersectionObserver,
          )
        }, options)
      }

      get root() { return this.native.root }
      get rootMargin() { return this.native.rootMargin }
      get thresholds() { return this.native.thresholds }
      observe = (target: Element) => {
        this.observed.add(target)
        this.native.observe(target)
      }
      unobserve = (target: Element) => {
        this.observed.delete(target)
        this.native.unobserve(target)
      }
      disconnect = () => {
        this.observed.clear()
        this.native.disconnect()
      }
      takeRecords = () => this.native.takeRecords()
    }

    const observers: ControlledIntersectionObserver[] = []
    const ObserverConstructor = class extends ControlledIntersectionObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super(callback, options)
        observers.push(this)
      }
    }
    window.IntersectionObserver = ObserverConstructor as unknown as typeof IntersectionObserver

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => {
        if (forcedVisibility !== null) return forcedVisibility
        if (visibilityDescriptor?.get) return visibilityDescriptor.get.call(document)
        if (visibilityDescriptor && 'value' in visibilityDescriptor) return visibilityDescriptor.value
        return inheritedVisibilityDescriptor?.get?.call(document) ?? 'visible'
      },
    })

    const findLineFieldObserver = () => observers.find(observer => (
      Array.from(observer.observed).some(target => target.matches('.landing-shell__content'))
    ))
    const lineFieldTarget = (observer: ControlledIntersectionObserver) => (
      Array.from(observer.observed).find(target => target.matches('.landing-shell__content'))
    )

    const controls = {
      setIntersection(isIntersecting: boolean) {
        const observer = findLineFieldObserver()
        if (!observer) throw new Error('Line-field IntersectionObserver was not installed')
        const target = lineFieldTarget(observer)
        if (!target) throw new Error('Line-field activity extent was not observed')
        observer.forced = isIntersecting
        const rect = target.getBoundingClientRect()
        observer.callback([{
          boundingClientRect: rect,
          intersectionRatio: isIntersecting ? 1 : 0,
          intersectionRect: isIntersecting ? rect : new DOMRectReadOnly(),
          isIntersecting,
          rootBounds: null,
          target,
          time: performance.now(),
        } as IntersectionObserverEntry], observer as unknown as IntersectionObserver)
      },
      setVisibility(visibility: DocumentVisibilityState) {
        forcedVisibility = visibility
        document.dispatchEvent(new Event('visibilitychange'))
      },
      installRafGate() {
        window.requestAnimationFrame = (callback: FrameRequestCallback) => {
          const id = nextGatedFrameId
          nextGatedFrameId += 1
          gatedFrames.set(id, callback)
          return id
        }
        window.cancelAnimationFrame = (id: number) => {
          if (!gatedFrames.delete(id)) nativeCancelAnimationFrame.call(window, id)
        }
      },
      flushUntilLineFieldDraw(deltaMs = 16) {
        const counter = Reflect.get(window, '__lineFieldDrawCounter') as
          | { snapshot(): { count: number } }
          | undefined
        if (!counter) throw new Error('Line-field WebGL draw counter is unavailable')
        const initialDrawCount = counter.snapshot().count
        gatedNow += deltaMs
        while (gatedFrames.size > 0) {
          const next = [...gatedFrames.entries()].sort(([left], [right]) => left - right)[0]
          gatedFrames.delete(next[0])
          next[1](gatedNow)
          if (counter.snapshot().count > initialDrawCount) return gatedFrames.size
        }
        throw new Error('No gated animation frame drew the line field')
      },
      restore() {
        window.IntersectionObserver = NativeIntersectionObserver
        HTMLCanvasElement.prototype.getContext = nativeGetContext
        if (visibilityDescriptor) {
          Object.defineProperty(document, 'visibilityState', visibilityDescriptor)
        } else {
          Reflect.deleteProperty(document, 'visibilityState')
        }
        window.requestAnimationFrame = nativeRequestAnimationFrame
        window.cancelAnimationFrame = nativeCancelAnimationFrame
        gatedFrames.clear()
      },
    }
    ;(window as typeof window & { __lineFieldPlatformControls?: typeof controls })
      .__lineFieldPlatformControls = controls
  })
}

async function tabTo(page: Page, target: Locator, maximumTabs = 40) {
  await expect(target).toBeVisible()
  for (let index = 0; index < maximumTabs; index += 1) {
    if (await target.evaluate(element => element === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  throw new Error(`Keyboard focus did not reach ${await target.getAttribute('aria-label') ?? await target.textContent()}`)
}

async function scrubWrightTo(page: Page, progress: number) {
  await page.locator('.wright-film-track').evaluate(async (element, value) => {
    const track = element as HTMLElement
    const top = track.getBoundingClientRect().top + window.scrollY
    const distance = Math.max(1, track.offsetHeight - window.innerHeight)
    const target = Math.ceil(top + distance * Number(value))
    const expectedProgress = Math.min(1, Math.max(0, (target - top) / distance))
    const scrollBehavior = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'auto'
    await new Promise<void>((resolve) => {
      const finishIfSynchronized = () => {
        const current = Number.parseFloat(track.style.getPropertyValue('--wright-film-progress'))
        if (!Number.isFinite(current) || Math.abs(current - expectedProgress) > (1 / distance)) return false
        observer.disconnect()
        resolve()
        return true
      }

      const observer = new MutationObserver(finishIfSynchronized)
      observer.observe(track, { attributes: true, attributeFilter: ['style'] })
      if (finishIfSynchronized()) return
      window.scrollTo({ top: target, behavior: 'auto' })
    })

    const video = track.querySelector('video') as HTMLVideoElement | null
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      await new Promise<void>((resolve) => {
        const finishIfMediaIsStable = () => {
          const ratio = video.currentTime / video.duration
          if (video.seeking || Math.abs(ratio - expectedProgress) > 0.002) return
          video.removeEventListener('seeked', finishIfMediaIsStable)
          resolve()
        }

        video.addEventListener('seeked', finishIfMediaIsStable)
        finishIfMediaIsStable()
      })
    }
    document.documentElement.style.scrollBehavior = scrollBehavior
  }, progress)
}

async function expectFiniteWrightFrame(page: Page) {
  const properties = await page.locator('.wright-film-track').evaluate((element, names) => {
    const style = getComputedStyle(element)
    return Object.fromEntries(names.map(name => [name, style.getPropertyValue(name)]))
  }, wrightTimelineProperties)

  for (const property of wrightTimelineProperties) {
    expect(Number.isFinite(Number.parseFloat(properties[property]))).toBe(true)
  }

  const turbulence = page.locator('.wright-copy-filter feTurbulence')
  const displacement = page.locator('.wright-copy-filter feDisplacementMap')
  await expect(turbulence).toHaveCount(1)
  await expect(displacement).toHaveCount(1)

  const baseFrequency = await turbulence.getAttribute('baseFrequency')
  expect(baseFrequency?.trim()).not.toBe('')
  for (const frequency of baseFrequency!.trim().split(/\s+/)) {
    expect(Number.isFinite(Number(frequency))).toBe(true)
  }
  expect(Number.isFinite(Number(await displacement.getAttribute('scale')))).toBe(true)
}

async function expectWrightVideoProgress(page: Page, expectedProgress: number) {
  const sample = await page.locator('.wright-hero-media').evaluate((element) => {
    const video = element as HTMLVideoElement
    return { currentTime: video.currentTime, duration: video.duration }
  })

  expect(Number.isFinite(sample.duration)).toBe(true)
  expect(sample.duration).toBeGreaterThan(0)
  expect(Number.isFinite(sample.currentTime)).toBe(true)
  expect(sample.currentTime / sample.duration).toBeCloseTo(expectedProgress, 2)
}

async function readWrightGeometry(page: Page): Promise<WrightGeometry> {
  return page.locator('.wright-copy-stage').evaluate((element) => {
    const rectangle = (node: Element) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }
    const light = element.querySelector('[data-copy-theme="light"]') as HTMLElement
    const dark = element.querySelector('[data-copy-theme="dark"]') as HTMLElement
    const darkRect = dark.getBoundingClientRect()
    const darkFits = Array.from(dark.children).every((child) => {
      const childRect = child.getBoundingClientRect()
      return childRect.left >= darkRect.left - 1
        && childRect.right <= darkRect.right + 1
        && childRect.top >= darkRect.top - 1
        && childRect.bottom <= darkRect.bottom + 1
    })

    return {
      stage: rectangle(element),
      light: rectangle(light),
      dark: rectangle(dark),
      darkFits,
    }
  })
}

function expectRectWithinOnePixel(actual: WrightRect, expected: WrightRect) {
  for (const property of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(actual[property] - expected[property])).toBeLessThanOrEqual(1)
  }
}

function expectRegisteredPanels(sample: WrightGeometry) {
  expectRectWithinOnePixel(sample.dark, sample.light)
}

async function readWrightFractureFrame(page: Page) {
  return page.locator('.wright-film-track').evaluate((track) => {
    const style = getComputedStyle(track)
    const alpha = track.querySelector('feFuncA')
    const floods = Array.from(track.querySelectorAll('feFlood'))

    return {
      blur: Number.parseFloat(style.getPropertyValue('--wright-panel-blur')),
      desaturation: Number.parseFloat(style.getPropertyValue('--wright-desaturation')),
      contrast: Number.parseFloat(style.getPropertyValue('--wright-contrast')),
      displacement: Number(track.querySelector('feDisplacementMap')?.getAttribute('scale')),
      slope: Number(alpha?.getAttribute('slope')),
      intercept: Number(alpha?.getAttribute('intercept')),
      floodOpacities: floods.map(node => Number(node.getAttribute('flood-opacity'))),
      turbulenceCount: track.querySelectorAll('feTurbulence').length,
      displacementCount: track.querySelectorAll('feDisplacementMap').length,
      componentTransferCount: track.querySelectorAll('feComponentTransfer').length,
      morphologyCount: track.querySelectorAll('feMorphology').length,
      floodCount: floods.length,
      arithmeticCompositeCount: track.querySelectorAll('feComposite[operator="arithmetic"]').length,
    }
  })
}

test('failed Wright media keeps the responsive landing proposition usable', async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page, true)
  const failedMediaRequests: string[] = []
  page.on('requestfailed', request => {
    if (/wright-flyer-(?:scroll-gop6\.mp4|poster\.webp)$/.test(request.url())) {
      failedMediaRequests.push(request.url())
    }
  })
  await page.route(/wright-flyer-(?:scroll-gop6\.mp4|poster\.webp)$/, route => route.abort('failed'))

  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })
  await page.goto('./')

  await expect(page.getByRole('heading', { name: 'Nicht nur rechnen. Systeme verstehen.' })).toBeVisible()
  await expect(page.locator('#landing-title')).toHaveCount(1)
  await expect(page.getByText('Bekannte Größen eingeben. Beziehungen prüfen. Den vollständigen Rechenweg nachvollziehen.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Navigation öffnen' })).toBeVisible()
  expect(failedMediaRequests.length).toBeGreaterThan(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)

  const expectedViewport = testInfo.project.name === 'mobile-chromium'
    ? { width: 390, height: 844 }
    : { width: 1440, height: 900 }
  expect(page.viewportSize()).toEqual(expectedViewport)

  if (testInfo.project.name === 'mobile-chromium') {
    for (const control of [
      page.locator('.theme-transition-control[data-variant="header"]'),
      page.getByRole('button', { name: 'Navigation öffnen' }),
    ]) {
      const box = await control.boundingBox()
      expect(box?.width).toBeGreaterThanOrEqual(44)
      expect(box?.height).toBeGreaterThanOrEqual(44)
    }
  }

  expect(runtimeErrors).toEqual([])
})

test('Dark Wright film metamorphosis advances and reverses its semantic proposition', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })
  await page.goto('./')

  const lightHeading = page.getByRole('heading', { name: 'Nicht nur rechnen. Systeme verstehen.' })
  const darkHeading = page.getByRole('heading', { name: 'Aus Größen werden Spuren. Aus Spuren wird Verständnis.' })

  await scrubWrightTo(page, 0.70)
  await expect(page.locator('#landing-title')).toHaveCount(1)
  await expect(lightHeading).toBeVisible()
  await expect(page.locator('#landing-title')).toHaveAccessibleName('Nicht nur rechnen. Systeme verstehen.')
  await expectFiniteWrightFrame(page)
  await expectWrightVideoProgress(page, 0.70)
  const openingGeometry = await readWrightGeometry(page)
  expectRegisteredPanels(openingGeometry)

  await scrubWrightTo(page, 0.855)
  expect(Number.parseFloat(await page.locator('.wright-film-track').evaluate(element => (
    getComputedStyle(element).getPropertyValue('--wright-film-progress')
  )))).toBeGreaterThanOrEqual(0.855)
  await expect(page.locator('#landing-title')).toHaveCount(1)
  await expect(darkHeading).toBeVisible()
  await expect(page.locator('#landing-title')).toHaveAccessibleName('Aus Größen werden Spuren. Aus Spuren wird Verständnis.')
  await expectFiniteWrightFrame(page)
  const peak = await readWrightFractureFrame(page)
  expect(peak.blur).toBeGreaterThan(3.4)
  expect(peak.blur).toBeLessThanOrEqual(3.5)
  expect(peak.displacement).toBeGreaterThan(90)
  expect(peak.displacement).toBeLessThanOrEqual(92)
  expect(peak.desaturation).toBeGreaterThan(0.98)
  expect(peak.desaturation).toBeLessThanOrEqual(1)
  expect(peak.contrast).toBeGreaterThan(1.53)
  expect(peak.contrast).toBeLessThanOrEqual(1.55)
  expect(peak.slope).toBeGreaterThan(6.8)
  expect(peak.slope).toBeLessThanOrEqual(7)
  expect(peak.intercept).toBeGreaterThanOrEqual(-3.78)
  expect(peak.intercept).toBeLessThan(-3.6)
  expect(peak.floodOpacities).toHaveLength(2)
  expect(peak.floodOpacities[0]).toBeGreaterThan(0.89)
  expect(peak.floodOpacities[0]).toBeLessThanOrEqual(0.92)
  expect(peak.floodOpacities[1]).toBeGreaterThan(0.70)
  expect(peak.floodOpacities[1]).toBeLessThanOrEqual(0.72)
  expect(peak.turbulenceCount).toBe(1)
  expect(peak.displacementCount).toBe(1)
  expect(peak.componentTransferCount).toBe(1)
  expect(peak.morphologyCount).toBe(2)
  expect(peak.floodCount).toBe(2)
  expect(peak.arithmeticCompositeCount).toBe(0)
  const peakGeometry = await readWrightGeometry(page)
  expectRegisteredPanels(peakGeometry)

  await scrubWrightTo(page, 0.98)
  await expect(page.locator('#landing-title')).toHaveCount(1)
  await expect(darkHeading).toBeVisible()
  await expect(page.locator('#landing-title')).toHaveAccessibleName('Aus Größen werden Spuren. Aus Spuren wird Verständnis.')
  await expectFiniteWrightFrame(page)
  await expectWrightVideoProgress(page, 0.98)
  const darkGeometry = await readWrightGeometry(page)
  expectRegisteredPanels(darkGeometry)
  expectRectWithinOnePixel(darkGeometry.stage, openingGeometry.stage)
  expectRectWithinOnePixel(darkGeometry.light, openingGeometry.light)
  expect(darkGeometry.darkFits).toBe(true)

  const darkSecondBeat = page.locator('.wright-copy-panel--dark h1 span').last()
  await expect(darkSecondBeat).toBeVisible()
  const emphasis = await darkSecondBeat.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      color: style.color,
      backgroundImage: style.backgroundImage,
      backgroundClip: style.backgroundClip,
      textFillColor: style.getPropertyValue('-webkit-text-fill-color'),
      opacity: style.opacity,
      visibility: style.visibility,
    }
  })
  expect(emphasis.color).toBe('rgb(243, 246, 251)')
  expect(emphasis.backgroundImage).toContain('linear-gradient')
  expect(emphasis.backgroundImage).toContain('rgb(109, 168, 255)')
  expect(emphasis.backgroundImage).toContain('rgb(121, 231, 225)')
  expect(emphasis.backgroundClip).toBe('text')
  expect(emphasis.textFillColor).toBe('rgba(0, 0, 0, 0)')
  expect(emphasis.opacity).toBe('1')
  expect(emphasis.visibility).toBe('visible')

  await scrubWrightTo(page, 0.70)
  await expect(page.locator('#landing-title')).toHaveCount(1)
  await expect(lightHeading).toBeVisible()
  await expect(page.locator('#landing-title')).toHaveAccessibleName('Nicht nur rechnen. Systeme verstehen.')
  await expectFiniteWrightFrame(page)
  await expectWrightVideoProgress(page, 0.70)
  const reverseGeometry = await readWrightGeometry(page)
  expectRegisteredPanels(reverseGeometry)
  expectRectWithinOnePixel(reverseGeometry.stage, openingGeometry.stage)
  expectRectWithinOnePixel(reverseGeometry.light, openingGeometry.light)

  expect(runtimeErrors).toEqual([])
})

test('restored late scroll commits the Dark Wright frame before first paint', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })
  await page.goto('./')
  await scrubWrightTo(page, 0.98)
  const restoredScrollY = await page.evaluate(() => window.scrollY)

  await page.addInitScript((restoredY) => {
    const snapshot = new Promise<WrightFirstPaintSnapshot>((resolve) => {
      let scrollRestored = false
      const observer = new MutationObserver(() => {
        if (!scrollRestored && document.documentElement) {
          document.documentElement.style.minHeight = `${restoredY + window.innerHeight + 1}px`
          window.scrollTo(0, restoredY)
          scrollRestored = true
        }

        const track = document.querySelector('.wright-film-track') as HTMLElement | null
        if (!track) return
        observer.disconnect()
        document.documentElement.style.minHeight = ''

        window.requestAnimationFrame(() => {
          const style = getComputedStyle(track)
          const video = track.querySelector('video') as HTMLVideoElement
          resolve({
            scrollY: window.scrollY,
            filmProgress: Number.parseFloat(style.getPropertyValue('--wright-film-progress')),
            themeFade: Number.parseFloat(style.getPropertyValue('--wright-theme-fade')),
            lightOpacity: Number.parseFloat(style.getPropertyValue('--wright-light-opacity')),
            darkOpacity: Number.parseFloat(style.getPropertyValue('--wright-dark-opacity')),
            lightHidden: track.querySelector('[data-copy-theme="light"]')?.getAttribute('aria-hidden') ?? null,
            darkHidden: track.querySelector('[data-copy-theme="dark"]')?.getAttribute('aria-hidden') ?? null,
            turbulenceFrequency: Number(track.querySelector('feTurbulence')?.getAttribute('baseFrequency')),
            displacementScale: Number(track.querySelector('feDisplacementMap')?.getAttribute('scale')),
            videoDuration: video.duration,
            videoTime: video.currentTime,
          })
        })
      })
      observer.observe(document, { childList: true, subtree: true })
    })
    ;(window as typeof window & { __wrightFirstPaintSnapshot: Promise<WrightFirstPaintSnapshot> })
      .__wrightFirstPaintSnapshot = snapshot
  }, restoredScrollY)

  await page.reload()
  const snapshot = await page.evaluate(() => (
    window as typeof window & { __wrightFirstPaintSnapshot: Promise<WrightFirstPaintSnapshot> }
  ).__wrightFirstPaintSnapshot)

  expect(Math.abs(snapshot.scrollY - restoredScrollY)).toBeLessThanOrEqual(1)
  expect(snapshot.filmProgress).toBeGreaterThanOrEqual(0.97)
  expect(snapshot.themeFade).toBeGreaterThan(0)
  expect(snapshot.lightOpacity).toBe(0)
  expect(snapshot.darkOpacity).toBe(1)
  expect(snapshot.lightHidden).toBe('true')
  expect(snapshot.darkHidden).toBe('false')
  expect(Number.isFinite(snapshot.turbulenceFrequency)).toBe(true)
  expect(Number.isFinite(snapshot.displacementScale)).toBe(true)
  if (Number.isFinite(snapshot.videoDuration) && snapshot.videoDuration > 0) {
    expect(snapshot.videoTime / snapshot.videoDuration).toBeCloseTo(snapshot.filmProgress, 2)
  }
  expect(runtimeErrors).toEqual([])
})

test('floating rail and explorer are operable using only the keyboard', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)
  await page.goto('./')

  const trigger = page.getByRole('button', { name: 'Navigation öffnen' })
  await tabTo(page, trigger)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Seitennavigation' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()

  await page.keyboard.press('Enter')
  const thermodynamicsChapter = page.getByRole('dialog').getByRole('button', { name: 'Thermodynamik' })
  await tabTo(page, thermodynamicsChapter)
  await page.keyboard.press('Enter')

  const menu = page.getByRole('region', { name: 'Thermodynamik-Menü' })
  await expect(menu).toBeVisible({ timeout: 12_000 })
  await expect(menu.locator('.thermodynamics-menu')).toHaveAttribute(
    'data-elastic-menu-phase',
    'settled',
    { timeout: 12_000 },
  )
  const landingUrl = page.url()
  const carnot = menu.locator('.thermodynamics-menu__row[data-module-id="carnot"]')
  await tabTo(page, carnot)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(landingUrl)
  await expect(carnot).toBeFocused()
  await expect(carnot).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('region', { name: 'Carnot-Prozess' })).toBeVisible()
  await expect(page.getByText('T-s Diagramm')).toBeVisible()

  await page.keyboard.press('Enter')
  await expect(carnot).toBeFocused()
  await expect(carnot).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('region', { name: 'Carnot-Prozess' })).toHaveCount(0)

  expect(runtimeErrors).toEqual([])
})

test('native Space and Enter each transform the theme once and preserve focus', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' })
  await page.goto('./')

  const control = page.locator('.theme-transition-control[data-variant="header"]')
  await control.focus()
  await page.evaluate(() => {
    const shell = document.querySelector('.landing-shell')
    const changes: string[] = []
    new MutationObserver(() => {
      changes.push(shell?.getAttribute('data-landing-theme') ?? '')
    }).observe(shell!, { attributes: true, attributeFilter: ['data-landing-theme'] })
    ;(window as typeof window & { __landingThemeChanges: string[] }).__landingThemeChanges = changes
  })

  await page.keyboard.down('Space')
  await expect(control).toHaveAttribute('data-phase', 'idle')
  await page.keyboard.up('Space')
  await expect(control).toHaveAttribute('data-phase', 'dissolving')
  await expect(control).toHaveAttribute('data-phase', 'idle')
  await expect(control).toBeFocused()
  await expect(control).toHaveAccessibleName('Light Mode aktivieren')
  expect(await page.evaluate(() => (
    window as typeof window & { __landingThemeChanges: string[] }
  ).__landingThemeChanges)).toEqual(['dark'])

  await page.evaluate(() => {
    ;(window as typeof window & { __landingThemeChanges: string[] }).__landingThemeChanges.length = 0
  })
  await page.keyboard.press('Enter')
  await expect(control).toHaveAttribute('data-phase', 'dissolving')
  await expect(control).toHaveAttribute('data-phase', 'idle')
  await expect(control).toBeFocused()
  await expect(control).toHaveAccessibleName('Dark Mode aktivieren')
  expect(await page.evaluate(() => (
    window as typeof window & { __landingThemeChanges: string[] }
  ).__landingThemeChanges)).toEqual(['light'])

  expect(runtimeErrors).toEqual([])
})

test('dedicated Wright motto panel is a post-film viewport sibling', async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page)
  const lightCopy = 'Überlieferte Formel ist Ausgangspunkt. Beweis ist das Ziel.'
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' })
  await page.goto('./')

  const panel = page.getByRole('region', { name: lightCopy })
  await expect(panel).toHaveAttribute('data-motto-theme', 'light')
  await expect(panel).toHaveAttribute('data-motto-motion', 'orbit')

  const structure = await page.locator('#haltung').evaluate((section) => {
    const track = section.querySelector('.wright-film-track')
    const motto = section.querySelector('[data-motto-theme]') as HTMLElement | null
    const slot = section.querySelector('.wright-motto-panel__slot') as HTMLElement | null
    const slotRect = slot?.getBoundingClientRect()
    return {
      chapterIds: Array.from(
        document.querySelectorAll<HTMLElement>('.landing-shell__content > section[id]'),
        chapter => chapter.id,
      ),
      filmLayer: getComputedStyle(section.querySelector('.wright-hero-sticky') as HTMLElement).zIndex,
      lineFieldLayer: getComputedStyle(document.querySelector('.landing-line-field') as HTMLElement).zIndex,
      immediateSibling: track?.nextElementSibling === motto,
      mottoLayer: motto ? getComputedStyle(motto).zIndex : '',
      panelTag: motto?.tagName,
      panelHeight: motto?.getBoundingClientRect().height ?? 0,
      rootFontSizePx: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      viewportHeight: window.innerHeight,
      slotLeft: slotRect?.left ?? 0,
      slotRightInset: slotRect ? window.innerWidth - slotRect.right : 0,
    }
  })

  expect(structure.chapterIds).toEqual(['haltung', 'module', 'thermodynamik', 'rechenweg', 'projekt'])
  expect(structure.immediateSibling).toBe(true)
  expect(structure.panelTag).toBe('DIV')
  expect(structure.panelHeight).toBeGreaterThanOrEqual(structure.viewportHeight)
  expect(structure.filmLayer).toBe('1')
  expect(structure.mottoLayer).toBe('2')
  expect(Number(structure.lineFieldLayer)).toBeLessThan(Number(structure.filmLayer))
  expect(Number(structure.lineFieldLayer)).toBeLessThan(Number(structure.mottoLayer))
  if (testInfo.project.name === 'mobile-chromium') {
    const expectedLeft = lineFieldConfig.motto.mobileFinalLeftInsetRem
      * structure.rootFontSizePx
    const expectedRight = lineFieldConfig.motto.mobileFinalRightInsetRem
      * structure.rootFontSizePx
    expect(Math.abs(structure.slotLeft - expectedLeft)).toBeLessThanOrEqual(1)
    expect(Math.abs(structure.slotRightInset - expectedRight)).toBeLessThanOrEqual(1)
  }

  const filmPaintOrder = await page.locator('#haltung').evaluate((section) => {
    const content = section.parentElement as HTMLElement
    const probe = document.createElement('div')
    probe.className = 'task-four-global-z2-probe'
    probe.setAttribute('aria-hidden', 'true')
    Object.assign(probe.style, {
      position: 'fixed',
      zIndex: '2',
      inset: '0',
      background: 'rgba(0, 0, 0, 0.001)',
    })
    content.append(probe)

    const media = section.querySelector('.wright-hero-media') as HTMLElement
    const sticky = section.querySelector('.wright-hero-sticky') as HTMLElement
    const copy = section.querySelector('.wright-hero-copy') as HTMLElement
    const previousCopyPointerEvents = copy.style.pointerEvents
    copy.style.pointerEvents = 'auto'
    const stickyRect = sticky.getBoundingClientRect()
    const copyRect = copy.getBoundingClientRect()
    const inside = (rect: DOMRect, x: number, y: number) => (
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    )
    const candidates = [
      [stickyRect.left + stickyRect.width * .9, stickyRect.top + stickyRect.height * .82],
      [stickyRect.left + stickyRect.width * .9, stickyRect.top + stickyRect.height * .5],
      [stickyRect.left + stickyRect.width * .5, stickyRect.top + stickyRect.height * .9],
    ]
    const mediaPoint = candidates.find(([x, y]) => !inside(copyRect, x, y))
    if (!mediaPoint) throw new Error('No media-only paint-order sample point was available')

    const orderAt = (x: number, y: number) => {
      const stack = document.elementsFromPoint(x, y)
      return {
        media: stack.indexOf(media),
        probe: stack.indexOf(probe),
        copy: stack.indexOf(copy),
      }
    }
    const copyPoint = [
      Math.min(window.innerWidth - 1, Math.max(0, copyRect.left + copyRect.width / 2)),
      Math.min(window.innerHeight - 1, Math.max(0, copyRect.top + copyRect.height / 2)),
    ] as const

    const paintOrder = {
      mediaOnly: orderAt(mediaPoint[0], mediaPoint[1]),
      semanticCopy: orderAt(copyPoint[0], copyPoint[1]),
    }
    copy.style.pointerEvents = previousCopyPointerEvents
    return paintOrder
  })

  const card = panel.locator('.wright-motto-panel__card')
  await panel.evaluate((element) => {
    const scrollBehavior = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'auto'
    element.scrollIntoView({ block: 'start' })
    document.documentElement.style.scrollBehavior = scrollBehavior
  })
  const mottoPaintOrder = await card.evaluate((element) => {
    const probe = document.querySelector('.task-four-global-z2-probe') as HTMLElement
    const previousCardPointerEvents = element.style.pointerEvents
    element.style.pointerEvents = 'auto'
    const rect = element.getBoundingClientRect()
    const stack = document.elementsFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    )
    const paintOrder = {
      card: stack.indexOf(element),
      probe: stack.indexOf(probe),
    }
    element.style.pointerEvents = previousCardPointerEvents
    return paintOrder
  })
  expect({
    mediaOnlyTargetsFound: filmPaintOrder.mediaOnly.probe >= 0 && filmPaintOrder.mediaOnly.media >= 0,
    probeAboveMedia: filmPaintOrder.mediaOnly.probe < filmPaintOrder.mediaOnly.media,
    copyPointTargetsFound: filmPaintOrder.semanticCopy.copy >= 0
      && filmPaintOrder.semanticCopy.probe >= 0
      && filmPaintOrder.semanticCopy.media >= 0,
    copyAboveProbe: filmPaintOrder.semanticCopy.copy < filmPaintOrder.semanticCopy.probe,
    probeAboveCopyPointMedia: filmPaintOrder.semanticCopy.probe < filmPaintOrder.semanticCopy.media,
    mottoTargetsFound: mottoPaintOrder.card >= 0 && mottoPaintOrder.probe >= 0,
    probeAboveMotto: mottoPaintOrder.probe < mottoPaintOrder.card,
  }).toEqual({
    mediaOnlyTargetsFound: true,
    probeAboveMedia: true,
    copyPointTargetsFound: true,
    copyAboveProbe: true,
    probeAboveCopyPointMedia: true,
    mottoTargetsFound: true,
    probeAboveMotto: true,
  })
  await page.locator('.task-four-global-z2-probe').evaluate(element => element.remove())

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.landing-shell')).toHaveAttribute('data-reduced-motion', 'true')
  await expect(panel).toHaveAttribute('data-motto-motion', 'static')
  expect(await page.locator('.wright-hero-sticky').evaluate(element => getComputedStyle(element).position)).toBe('relative')

  const reducedFrame = await panel.evaluate((element) => {
    const card = element.querySelector('.wright-motto-panel__card') as HTMLElement
    const style = getComputedStyle(card)
    return {
      panelHeight: element.getBoundingClientRect().height,
      viewportHeight: window.innerHeight,
      transform: style.transform,
      filter: style.filter,
      opacity: style.opacity,
    }
  })
  expect(reducedFrame.panelHeight).toBeGreaterThanOrEqual(reducedFrame.viewportHeight)
  expect(reducedFrame.transform).toBe('none')
  expect(reducedFrame.filter).toBe('none')
  expect(reducedFrame.opacity).toBe('1')
  await expect(panel.getByText(lightCopy)).toBeVisible()
  expect(runtimeErrors).toEqual([])
})

test('responsive motto orbit preserves its browser geometry and deterministic signals', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })
  await page.goto('./')

  await expectResponsiveMottoOrbitAtCurrentViewport(page)

  await page.setViewportSize({ width: 723, height: 839 })
  await page.reload()
  await expectResponsiveMottoOrbitAtCurrentViewport(page)

  expect(runtimeErrors).toEqual([])
})

test('reduced motion keeps the Dark Wright hero stable without scrolling', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  await page.goto('./')

  await expect(page.getByRole('heading', { name: 'Aus Größen werden Spuren. Aus Spuren wird Verständnis.' })).toBeVisible()
  await expect(page.locator('#landing-title')).toHaveCount(1)
  await expect(page.locator('.particle-field')).toHaveCount(0)
  expect(await page.locator('.wright-hero-sticky').evaluate(element => getComputedStyle(element).position)).toBe('relative')
  await expect(page.locator('.wright-copy-filter feDisplacementMap')).toHaveAttribute('scale', '0')
  await expect(page.locator('.wright-copy-filter feFuncA')).toHaveAttribute('slope', '0')
  await expect(page.locator('.wright-copy-filter feFuncA')).toHaveAttribute('intercept', '1')
  await expect(page.locator('.wright-copy-filter feFlood[data-ash-edge="charred"]')).toHaveAttribute('flood-opacity', '0')
  await expect(page.locator('.wright-copy-filter feFlood[data-ash-edge="light"]')).toHaveAttribute('flood-opacity', '0')

  const neutralProperties = await page.locator('.wright-film-track').evaluate(element => {
    const style = getComputedStyle(element)
    return {
      '--wright-panel-blur': style.getPropertyValue('--wright-panel-blur'),
      '--wright-decay': style.getPropertyValue('--wright-decay'),
      '--wright-drift-x': style.getPropertyValue('--wright-drift-x'),
      '--wright-rotation': style.getPropertyValue('--wright-rotation'),
      '--wright-jitter-x': style.getPropertyValue('--wright-jitter-x'),
      '--wright-jitter-y': style.getPropertyValue('--wright-jitter-y'),
      '--wright-chromatic-wash': style.getPropertyValue('--wright-chromatic-wash'),
      '--wright-desaturation': style.getPropertyValue('--wright-desaturation'),
      '--wright-contrast': style.getPropertyValue('--wright-contrast'),
    }
  })
  expect(neutralProperties).toEqual({
    '--wright-panel-blur': '0px',
    '--wright-decay': '0',
    '--wright-drift-x': '0px',
    '--wright-rotation': '0deg',
    '--wright-jitter-x': '0px',
    '--wright-jitter-y': '0px',
    '--wright-chromatic-wash': '0',
    '--wright-desaturation': '0',
    '--wright-contrast': '1',
  })

  expect(runtimeErrors).toEqual([])
})

test('reduced motion keeps the menu static while inline detail remains interactive', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./')

  await expect(page.locator('.landing-shell')).toHaveAttribute('data-reduced-motion', 'true')
  await expect(page.locator('.particle-field')).toHaveCount(0)
  expect(await page.locator('.wright-hero-sticky').evaluate(element => getComputedStyle(element).position)).toBe('relative')

  await page.locator('#thermodynamik').evaluate(element => element.scrollIntoView())
  const menu = page.locator('.thermodynamics-menu')
  await expect(menu).toHaveAttribute('data-elastic-menu-phase', 'reduced')
  await expect(menu.locator(':scope > *')).toHaveCount(5)
  await expect(menu.locator('.thermodynamics-menu__row')).toHaveCount(4)
  await expect(menu.locator('[inert]')).toHaveCount(0)
  expect(await menu.locator(':scope > *').evaluateAll(elements => elements.map((element) => {
    const style = getComputedStyle(element)
    return { opacity: style.opacity, transform: style.transform }
  }))).toEqual(Array.from({ length: 5 }, () => ({ opacity: '1', transform: 'none' })))

  const landingUrl = page.url()
  const carnot = menu.locator('.thermodynamics-menu__row[data-module-id="carnot"]')
  await carnot.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(landingUrl)
  await expect(carnot).toBeFocused()
  await expect(carnot).toHaveAttribute('aria-expanded', 'true')
  const detail = page.getByRole('region', { name: 'Carnot-Prozess' })
  await expect(detail).toBeVisible()
  expect(await detail.evaluate(element => getComputedStyle(element).animationName)).toBe('none')
  await expect(detail.getByText('T-s Diagramm')).toBeVisible()

  await page.keyboard.press('Enter')
  await expect(carnot).toBeFocused()
  await expect(carnot).toHaveAttribute('aria-expanded', 'false')
  await expect(detail).toHaveCount(0)

  expect(runtimeErrors).toEqual([])
})

test.describe('production landing line-field orchestration', () => {
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      ;(window as typeof window & {
        __lineFieldRafAudit?: { restore(): void }
        __lineFieldPlatformControls?: { restore(): void }
        __restoreLineFieldWebgl?: () => void
      }).__lineFieldRafAudit?.restore()
      ;(window as typeof window & { __lineFieldPlatformControls?: { restore(): void } })
        .__lineFieldPlatformControls?.restore()
      ;(window as typeof window & { __restoreLineFieldWebgl?: () => void })
        .__restoreLineFieldWebgl?.()
      ;(window as typeof window & { __restoreMagneticScrollIntoView?: () => void })
        .__restoreMagneticScrollIntoView?.()
      ;(window as typeof window & { __session3EvidenceClock?: { restore(): void } })
        .__session3EvidenceClock?.restore()
    }).catch(() => undefined)
  })

  test('fixed scroll advances autonomously, reverses on the same canvas, and cleans up on calculator navigation', async ({ page }) => {
    // This is an intentionally long visual journey: it captures and decodes several WebGL
    // checkpoints on both desktop and mobile. Give that evidence work its own stable budget
    // instead of relying on a command-line timeout override.
    test.setTimeout(60_000)
    const runtimeErrors = collectRuntimeErrors(page)
    const rendererRequests: string[] = []
    page.on('request', (request) => {
      if (/\/assets\/LandingLineRenderer-[^/]+\.js$/.test(new URL(request.url()).pathname)) {
        rendererRequests.push(request.url())
      }
    })
    await installLineFieldEvidenceBackbuffer(page)
    await installSession3EvidenceClock(page)
    await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' })
    await page.goto('./')
    await page.evaluate(() => {
      const nativeScrollIntoView = Element.prototype.scrollIntoView
      // Magnetic chapter snapping is independently covered. Isolate this wavefield journey from
      // its native timer before the first synthetic scroll so no smooth-scroll can already be in
      // flight when the fixed-scroll evidence clock is enabled.
      Element.prototype.scrollIntoView = () => undefined
      ;(window as typeof window & { __restoreMagneticScrollIntoView?: () => void })
        .__restoreMagneticScrollIntoView = () => {
          Element.prototype.scrollIntoView = nativeScrollIntoView
        }
    })
    await expect(page.locator('.landing-shell')).toHaveAttribute('data-landing-theme', 'light')
    await scrollLineFieldFilmTo(page, lineFieldConfig.reveal.startFilmProgress)

    const field = await expectColdLineFieldOutcome(page, 'ready')
    const canvas = field.locator('.landing-line-field__renderer-host canvas')
    expect(await canvas.evaluate(element => (
      (element as HTMLCanvasElement)
        .getContext('webgl2')
        ?.getContextAttributes()
        ?.preserveDrawingBuffer
    ))).toBe(true)
    const rootToken = await field.evaluate((element) => {
      const token = crypto.randomUUID()
      ;(element as HTMLElement).dataset.e2eRootToken = token
      return token
    })
    const canvasToken = await canvas.evaluate((element) => {
      const token = crypto.randomUUID()
      ;(element as HTMLElement).dataset.e2eCanvasToken = token
      return token
    })
    const viewport = page.viewportSize()
    if (!viewport) throw new Error('Line-field journey requires an explicit viewport')
    await scrollLineFieldFilmTo(page, 0.95)
    expect(await lineFieldMotionOpacity(canvas)).toBeGreaterThan(0)
    const filmFieldBox = await field.boundingBox()
    expect(filmFieldBox).not.toBeNull()
    const filmClip = {
      x: Math.max(0, filmFieldBox!.x),
      y: 0,
      width: Math.min(filmFieldBox!.width, viewport.width - Math.max(0, filmFieldBox!.x)),
      height: viewport.height,
    }
    const fadedFilmPixels = await page.screenshot({ clip: filmClip })
    await field.evaluate(element => element.style.setProperty('visibility', 'hidden'))
    const withoutFieldBaseline = await page.screenshot({ clip: filmClip })
    await field.evaluate(element => element.style.removeProperty('visibility'))
    expect(
      await screenshotSignificantPixelRatio(page, fadedFilmPixels, withoutFieldBaseline),
    ).toBeGreaterThan(0.001)
    const seedSequence = await lineFieldDrawCount(page)

    await field.evaluate((element) => {
      const history = [element.getAttribute('data-line-field-mode') ?? '']
      new MutationObserver(() => {
        history.push(element.getAttribute('data-line-field-mode') ?? '')
      }).observe(element, { attributes: true, attributeFilter: ['data-line-field-mode'] })
      ;(window as typeof window & { __lineFieldModeHistory?: string[] }).__lineFieldModeHistory = history
    })
    const handoffScrollY = await scrollLineFieldToAutonomous(page)
    await expect(field).toHaveAttribute('data-line-field-mode', 'autonomous')
    await expect.poll(() => lineFieldDrawCount(page)).toBeGreaterThan(seedSequence)
    const firstAutonomousSequence = await lineFieldDrawCount(page)
    await expect.poll(() => lineFieldDrawCount(page)).toBeGreaterThan(firstAutonomousSequence)
    const stableScrollY = await page.evaluate(() => window.scrollY)
    const fieldBox = await field.boundingBox()
    const canvasBox = await canvas.boundingBox()
    expect(fieldBox).not.toBeNull()
    expect(canvasBox).not.toBeNull()
    expect(fieldBox!.x).toBeCloseTo(0, 0)
    expect(fieldBox!.width).toBeCloseTo(viewport.width, 0)
    expect(canvasBox!.x).toBeCloseTo(0, 0)
    expect(canvasBox!.width).toBeCloseTo(viewport.width, 0)
    expect(canvasBox!.height).toBeCloseTo(viewport.height, 0)

    const filmTrack = page.locator('.wright-film-track')
    await expect(filmTrack).not.toHaveAttribute('data-line-field-aperture', /.+/)
    await expect(field).not.toHaveAttribute('data-line-field-occlusion')
    const stackingAndOcclusion = await page.evaluate(() => {
      const fieldRoot = document.querySelector('.landing-line-field')
      const filmTrack = document.querySelector('.wright-film-track')
      const rendererHost = document.querySelector('.landing-line-field__renderer-host')
      const sticky = document.querySelector('.wright-hero-sticky')
      if (
        !(fieldRoot instanceof HTMLElement)
        || !(filmTrack instanceof HTMLElement)
        || !(rendererHost instanceof HTMLElement)
        || !(sticky instanceof HTMLElement)
      ) {
        throw new Error('Line-field stacking geometry is unavailable')
      }
      const fieldStyle = getComputedStyle(fieldRoot)
      const hostStyle = getComputedStyle(rendererHost)
      const stickyStyle = getComputedStyle(sticky)
      const stickyRect = sticky.getBoundingClientRect()
      return {
        fieldMaskImage: fieldStyle.maskImage || fieldStyle.webkitMaskImage,
        fieldZIndex: fieldStyle.zIndex,
        filmAperture: filmTrack.getAttribute('data-line-field-aperture'),
        filmTrackBackground: getComputedStyle(filmTrack).backgroundColor,
        hostMaskImage: hostStyle.maskImage || hostStyle.webkitMaskImage,
        stickyMaskImage: stickyStyle.maskImage || stickyStyle.webkitMaskImage,
        stickyTop: stickyRect.top,
        stickyZIndex: stickyStyle.zIndex,
      }
    })
    expect(stackingAndOcclusion).toMatchObject({
      fieldMaskImage: 'none',
      fieldZIndex: '0',
      filmAperture: null,
      filmTrackBackground: 'rgba(0, 0, 0, 0)',
      hostMaskImage: 'none',
      stickyMaskImage: 'none',
      stickyZIndex: '1',
    })
    expect(stackingAndOcclusion.stickyTop).toBeLessThan(0)

    const autonomousPixelsBefore = await canvas.screenshot()
    const pixelSequence = await lineFieldDrawCount(page)
    await expect.poll(() => lineFieldDrawCount(page)).toBeGreaterThan(pixelSequence)
    await page.waitForTimeout(120)
    expect(await page.evaluate(() => window.scrollY)).toBe(stableScrollY)
    const autonomousPixelsAfter = await canvas.screenshot()
    expect(autonomousPixelsAfter.equals(autonomousPixelsBefore)).toBe(false)
    const modeHistory = await page.evaluate(() => (
      window as typeof window & { __lineFieldModeHistory?: string[] }
    ).__lineFieldModeHistory ?? [])
    expect(modeHistory).toContain('auto-handoff')
    expect(modeHistory).toContain('autonomous')

    const themeControl = page.locator('.theme-transition-control[data-variant="header"]')
    for (const expectedTheme of ['dark', 'light'] as const) {
      await themeControl.evaluate(element => (element as HTMLElement).click())
      await expect(themeControl).toHaveAttribute('data-phase', 'dissolving')
      await expect(themeControl).toHaveAttribute('data-phase', 'idle')
      await expect(page.locator('.landing-shell')).toHaveAttribute('data-landing-theme', expectedTheme)
      await expect(field).toHaveAttribute('data-line-field-mode', 'autonomous')
      await expect(field).toHaveAttribute('data-e2e-root-token', rootToken)
      await expect(canvas).toHaveAttribute('data-e2e-canvas-token', canvasToken)
      expect(await page.evaluate(() => window.scrollY)).toBe(stableScrollY)
      expect(rendererRequests).toHaveLength(1)
    }

    const reverseBaselineScrollY = await scrollLineFieldInstantly(
      page,
      Math.max(stableScrollY, handoffScrollY + 2 * viewport.height),
    )
    expect(reverseBaselineScrollY).toBeGreaterThan(handoffScrollY + viewport.height)
    await expect(field).toHaveAttribute('data-line-field-mode', 'autonomous')

    const upwardAutonomousScrollY = await scrollLineFieldInstantly(
      page,
      handoffScrollY + viewport.height,
    )
    expect(upwardAutonomousScrollY).toBeGreaterThan(handoffScrollY)
    await expect(field).toHaveAttribute('data-line-field-mode', 'autonomous')
    const upwardAutonomousSequence = await lineFieldDrawCount(page)
    await expect.poll(() => lineFieldDrawCount(page)).toBeGreaterThan(upwardAutonomousSequence)

    await enableSession3EvidenceClock(page)
    const reverseTriggerScrollY = await scrollEvidenceToGated(
      page,
      handoffScrollY - lineFieldConfig.handoff.reverseDeadbandPx - 20,
    )
    expect(reverseTriggerScrollY).toBeLessThan(handoffScrollY)
    await expect(field).toHaveAttribute('data-line-field-mode', 'reverse-gather')
    await expect(canvas).toHaveAttribute('data-e2e-canvas-token', canvasToken)
    await expect(canvas).toHaveCount(1)
    const reverseSequence = await lineFieldDrawCount(page)
    const reversePixels = await lineFieldCanvasPng(canvas)
    await flushSession3EvidenceFrame(
      page,
      lineFieldConfig.handoff.velocityBlendSeconds * 1000 / 2,
    )
    await expect(field).toHaveAttribute('data-line-field-mode', 'reverse-gather')
    const halfSequence = await lineFieldDrawCount(page)
    expect(halfSequence).toBeGreaterThan(reverseSequence)
    const halfGatherPixels = await lineFieldCanvasPng(canvas)
    expect(
      await screenshotSignificantPixelRatio(page, reversePixels, halfGatherPixels),
    ).toBeGreaterThan(0.00001)
    await flushSession3EvidenceFrame(
      page,
      lineFieldConfig.handoff.velocityBlendSeconds * 1000 / 2,
    )
    await expect(field).toHaveAttribute('data-line-field-mode', 'scroll-build')
    expect(await lineFieldDrawCount(page)).toBeGreaterThan(halfSequence)
    const gatheredPixels = await lineFieldCanvasPng(canvas)
    expect(
      await screenshotSignificantPixelRatio(page, halfGatherPixels, gatheredPixels),
    ).toBeGreaterThan(0.00001)
    expect(await page.evaluate(() => window.scrollY)).toBe(reverseTriggerScrollY)
    expect(await lineFieldMotionOpacity(canvas)).toBeGreaterThan(0)
    await page.evaluate(() => {
      ;(window as typeof window & { __session3EvidenceClock?: { restore(): void } })
        .__session3EvidenceClock?.restore()
    })

    const reentryHistoryStart = await page.evaluate(() => (
      window as typeof window & { __lineFieldModeHistory?: string[] }
    ).__lineFieldModeHistory?.length ?? 0)
    await scrollLineFieldInstantly(page, handoffScrollY)
    await expect(canvas).toHaveAttribute('data-e2e-canvas-token', canvasToken)
    await expect(field).toHaveAttribute('data-e2e-root-token', rootToken)
    await expect(field).toHaveAttribute('data-line-field-mode', 'autonomous', {
      timeout: lineFieldConfig.handoff.velocityBlendSeconds * 1000 + 2_000,
    })
    const reentryModeHistory = await page.evaluate((historyStart) => {
      const history = (
        window as typeof window & { __lineFieldModeHistory?: string[] }
      ).__lineFieldModeHistory ?? []
      return {
        complete: history,
        reentry: history.slice(historyStart),
      }
    }, reentryHistoryStart)
    expect(reentryModeHistory.complete).toContain('reverse-gather')
    expect(reentryModeHistory.reentry).toContain('auto-handoff')
    await expect(canvas).toHaveCount(1)
    await scrollLineFieldInstantly(page, reverseBaselineScrollY)
    await expect(field).toHaveAttribute('data-line-field-mode', 'autonomous')
    await expect(canvas).toHaveAttribute('data-e2e-canvas-token', canvasToken)
    expect(await lineFieldMotionOpacity(canvas)).toBeCloseTo(1, 6)
    const reentryPixelsBefore = await canvas.screenshot()
    const reentryPixelSequence = await lineFieldDrawCount(page)
    await expect.poll(() => lineFieldDrawCount(page)).toBeGreaterThan(reentryPixelSequence)
    await page.waitForTimeout(120)
    const reentryPixelsAfter = await canvas.screenshot()
    expect(reentryPixelsAfter.equals(reentryPixelsBefore)).toBe(false)

    await page.getByRole('button', { name: 'Navigation öffnen' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Rechner öffnen' }).click()
    await expect(page.locator('.landing-line-field')).toHaveCount(0)
    await expect(page.locator('.landing-line-field canvas')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /Carnot-Prozess/i })).toBeVisible()
    await page.waitForTimeout(150)
    expect(runtimeErrors).toEqual([])
  })

  test('native magnetic logic coexists with the automatic reverse gather', async ({ page }, testInfo) => {
    const runtimeErrors = collectRuntimeErrors(page)
    await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' })
    await page.goto('./')
    await page.evaluate(() => {
      const nativeScrollIntoView = Element.prototype.scrollIntoView
      const target = window as typeof window & {
        __magneticNativeCallCount?: number
        __restoreMagneticScrollIntoView?: () => void
      }
      target.__magneticNativeCallCount = 0
      Element.prototype.scrollIntoView = function patchedScrollIntoView(options) {
        target.__magneticNativeCallCount = (target.__magneticNativeCallCount ?? 0) + 1
        return nativeScrollIntoView.call(this, options)
      }
      target.__restoreMagneticScrollIntoView = () => {
        Element.prototype.scrollIntoView = nativeScrollIntoView
      }
    })

    await scrollLineFieldFilmTo(page, lineFieldConfig.reveal.startFilmProgress)
    const field = await expectColdLineFieldOutcome(page, 'ready')
    const canvas = field.locator('.landing-line-field__renderer-host canvas')
    const canvasToken = await canvas.evaluate((element) => {
      const token = crypto.randomUUID()
      ;(element as HTMLElement).dataset.e2eCanvasToken = token
      return token
    })
    const handoffScrollY = await scrollLineFieldToAutonomous(page)
    await expect(field).toHaveAttribute('data-line-field-mode', 'autonomous')
    const viewport = page.viewportSize()
    if (!viewport) throw new Error('Magnetic reverse smoke requires an explicit viewport')

    const upwardAboveBoundary = await scrollLineFieldInstantly(
      page,
      handoffScrollY + viewport.height,
    )
    expect(upwardAboveBoundary).toBeGreaterThan(handoffScrollY)
    await expect(field).toHaveAttribute('data-line-field-mode', 'autonomous')

    const reverseScrollY = await scrollLineFieldInstantly(
      page,
      handoffScrollY - lineFieldConfig.handoff.reverseDeadbandPx - 20,
    )
    expect(reverseScrollY).toBeLessThan(handoffScrollY)
    await expect(field).toHaveAttribute('data-line-field-mode', 'reverse-gather')
    const reverseSequence = await lineFieldDrawCount(page)
    await page.waitForTimeout(lineFieldConfig.handoff.velocityBlendSeconds * 1000 + 650)
    // The real chapter selector stays mounted and receives all scroll events. Desktop geometry
    // qualifies one native snap here; mobile geometry currently qualifies none. Both must still
    // complete the same reverse contract on the original canvas.
    const magneticCallCount = await page.evaluate(() => (
      window as typeof window & { __magneticNativeCallCount?: number }
    ).__magneticNativeCallCount ?? 0)
    expect(magneticCallCount).toBeLessThanOrEqual(1)
    if (testInfo.project.name === 'desktop-chromium') {
      expect(magneticCallCount).toBeGreaterThan(0)
    }
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(handoffScrollY)
    await expect(field).toHaveAttribute('data-line-field-mode', 'scroll-build')
    expect(await lineFieldDrawCount(page)).toBeGreaterThan(reverseSequence)
    await expect(canvas).toHaveAttribute('data-e2e-canvas-token', canvasToken)
    await expect(canvas).toHaveCount(1)
    expect(runtimeErrors).toEqual([])
  })

  test('WebGL2 acquisition failure latches one inert error fallback and only rethemes', async ({ page }) => {
    await installLineFieldRafAudit(page)
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = (function patchedGetContext(
        this: HTMLCanvasElement,
        contextId: string,
        ...options: unknown[]
      ) {
        if (contextId === 'webgl2') return null
        return Reflect.apply(original, this, [contextId, ...options])
      }) as typeof original
      ;(window as typeof window & { __restoreLineFieldWebgl?: () => void })
        .__restoreLineFieldWebgl = () => {
          HTMLCanvasElement.prototype.getContext = original
        }
    })
    const runtimeErrors = collectRuntimeErrors(page)
    const rendererRequests: string[] = []
    page.on('request', (request) => {
      if (/\/assets\/LandingLineRenderer-[^/]+\.js$/.test(new URL(request.url()).pathname)) {
        rendererRequests.push(request.url())
      }
    })

    try {
      await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' })
      await page.goto('./')
      await expect(page.locator('.landing-shell')).toHaveAttribute('data-landing-theme', 'light')
      const recognizedCallbackId = await expectRecognizedLineFieldRaf(page)
      const armedAudit = await armLineFieldRafAuditBeforeTerminalTrigger(
        page,
        recognizedCallbackId,
      )
      await expectPreTerminalLineFieldScheduleIgnored(page, armedAudit)
      await scrollLineFieldFilmTo(page, lineFieldConfig.reveal.startFilmProgress)
      const field = await expectColdLineFieldOutcome(page, 'fallback-error')
      await expect(field.locator('[data-line-field-fallback]')).toHaveAttribute('data-theme', 'light')
      await expectFinalMotto(page)
      const stableSequence = await lineFieldDrawCount(page)
      expect(rendererRequests).toHaveLength(1)
      await rethemeStaticFallbackWithoutRetry(
        page,
        rendererRequests,
        stableSequence,
        'fallback-error',
        recognizedCallbackId,
      )
      await expect(field).toHaveAttribute('data-line-field-status', 'fallback-error')
      expect(runtimeErrors).toEqual([])
    } finally {
      await page.evaluate(() => {
        ;(window as typeof window & { __restoreLineFieldWebgl?: () => void })
          .__restoreLineFieldWebgl?.()
      }).catch(() => undefined)
    }
  })

  test('a genuine native WebGL context loss latches the parallel inert fallback', async ({ page }) => {
    await installLineFieldRafAudit(page)
    const runtimeErrors = collectRuntimeErrors(page)
    const rendererRequests: string[] = []
    page.on('request', (request) => {
      if (/\/assets\/LandingLineRenderer-[^/]+\.js$/.test(new URL(request.url()).pathname)) {
        rendererRequests.push(request.url())
      }
    })
    await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' })
    await page.goto('./')
    await expect(page.locator('.landing-shell')).toHaveAttribute('data-landing-theme', 'light')
    await scrollLineFieldFilmTo(page, lineFieldConfig.reveal.startFilmProgress)
    const field = await expectColdLineFieldOutcome(page, 'ready')
    const recognizedCallbackId = await expectRecognizedLineFieldRaf(page)
    await armLineFieldRafAuditBeforeTerminalTrigger(page, recognizedCallbackId)
    const canvas = field.locator('.landing-line-field__renderer-host canvas')
    const lossEvent = await canvas.evaluate(async (element) => {
      const canvasElement = element as HTMLCanvasElement
      const gl = canvasElement.getContext('webgl2')
      const extension = gl?.getExtension('WEBGL_lose_context')
      if (!gl || !extension) throw new Error('Expected a real WEBGL_lose_context extension')
      return new Promise<{ cancelable: boolean; defaultPrevented: boolean }>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('Native webglcontextlost did not fire')), 5_000)
        canvasElement.addEventListener('webglcontextlost', (event) => {
          window.clearTimeout(timeout)
          resolve({ cancelable: event.cancelable, defaultPrevented: event.defaultPrevented })
        }, { once: true })
        extension.loseContext()
      })
    })
    expect(lossEvent.cancelable).toBe(true)
    expect(lossEvent.defaultPrevented).toBe(false)

    await expectStaticLineFieldFallback(page, 'fallback-context-lost')
    await expect(field.locator('[data-line-field-fallback]')).toHaveAttribute('data-theme', 'light')
    const stableSequence = await lineFieldDrawCount(page)
    expect(rendererRequests).toHaveLength(1)
    await rethemeStaticFallbackWithoutRetry(
      page,
      rendererRequests,
      stableSequence,
      'fallback-context-lost',
      recognizedCallbackId,
    )
    await expect(field).toHaveAttribute('data-line-field-status', 'fallback-context-lost')
    expect(runtimeErrors).toEqual([])
  })

  test('controlled intersection and visibility pauses freeze pixels and resume with an identical rebase', async ({ page }) => {
    await installLineFieldPauseSeams(page)
    const runtimeErrors = collectRuntimeErrors(page)
    await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })
    await page.goto('./')
    await scrollLineFieldFilmTo(page, lineFieldConfig.reveal.startFilmProgress)
    const field = await expectColdLineFieldOutcome(page, 'ready')
    const canvas = field.locator('.landing-line-field__renderer-host canvas')
    expect(await canvas.evaluate(element => (
      (element as HTMLCanvasElement)
        .getContext('webgl2')
        ?.getContextAttributes()
        ?.preserveDrawingBuffer
    ))).toBe(true)
    const canvasToken = await canvas.evaluate((element) => {
      const token = crypto.randomUUID()
      ;(element as HTMLElement).dataset.e2eCanvasToken = token
      // Isolate WebGL pixels from independently animated layers beneath the transparent canvas.
      ;(element as HTMLElement).style.background = 'var(--landing-bg)'
      return token
    })
    await scrollLineFieldToAutonomous(page)
    await expect(field).toHaveAttribute('data-line-field-mode', 'autonomous')

    const controls = () => page.evaluate(() => Boolean((
      window as typeof window & { __lineFieldPlatformControls?: unknown }
    ).__lineFieldPlatformControls))
    await expect.poll(controls).toBe(true)
    await page.evaluate(() => {
      const platform = (window as typeof window & {
        __lineFieldPlatformControls: {
          installRafGate(): void
          setIntersection(value: boolean): void
        }
      }).__lineFieldPlatformControls
      platform.setIntersection(false)
      platform.installRafGate()
    })
    const intersectionFrozenSequence = await lineFieldDrawCount(page)
    const intersectionFrozenPixels = await lineFieldCanvasFingerprint(canvas)
    await page.waitForTimeout(250)
    expect(await lineFieldDrawCount(page)).toBe(intersectionFrozenSequence)
    expect(await lineFieldCanvasFingerprint(canvas)).toBe(intersectionFrozenPixels)

    await page.evaluate(() => (
      window as typeof window & {
        __lineFieldPlatformControls: { setIntersection(value: boolean): void }
      }
    ).__lineFieldPlatformControls.setIntersection(true))
    await page.evaluate(() => (
      window as typeof window & {
        __lineFieldPlatformControls: { flushUntilLineFieldDraw(deltaMs: number): number }
      }
    ).__lineFieldPlatformControls.flushUntilLineFieldDraw(16))
    await expect.poll(() => lineFieldDrawCount(page)).toBe(intersectionFrozenSequence + 1)
    expect(await lineFieldCanvasFingerprint(canvas)).toBe(intersectionFrozenPixels)
    await expect(canvas).toHaveAttribute('data-e2e-canvas-token', canvasToken)

    await page.evaluate(() => (
      window as typeof window & {
        __lineFieldPlatformControls: { flushUntilLineFieldDraw(deltaMs: number): number }
      }
    ).__lineFieldPlatformControls.flushUntilLineFieldDraw(50))
    await expect.poll(() => lineFieldDrawCount(page)).toBe(intersectionFrozenSequence + 2)
    expect(await lineFieldCanvasFingerprint(canvas)).not.toBe(intersectionFrozenPixels)

    await page.evaluate(() => (
      window as typeof window & {
        __lineFieldPlatformControls: { setVisibility(value: DocumentVisibilityState): void }
      }
    ).__lineFieldPlatformControls.setVisibility('hidden'))
    const visibilityFrozenSequence = await lineFieldDrawCount(page)
    const visibilityFrozenPixels = await lineFieldCanvasFingerprint(canvas)
    await page.waitForTimeout(250)
    expect(await lineFieldDrawCount(page)).toBe(visibilityFrozenSequence)
    expect(await lineFieldCanvasFingerprint(canvas)).toBe(visibilityFrozenPixels)

    await page.evaluate(() => (
      window as typeof window & {
        __lineFieldPlatformControls: { setVisibility(value: DocumentVisibilityState): void }
      }
    ).__lineFieldPlatformControls.setVisibility('visible'))
    await page.evaluate(() => (
      window as typeof window & {
        __lineFieldPlatformControls: { flushUntilLineFieldDraw(deltaMs: number): number }
      }
    ).__lineFieldPlatformControls.flushUntilLineFieldDraw(16))
    await expect.poll(() => lineFieldDrawCount(page)).toBe(visibilityFrozenSequence + 1)
    expect(await lineFieldCanvasFingerprint(canvas)).toBe(visibilityFrozenPixels)
    await expect(canvas).toHaveAttribute('data-e2e-canvas-token', canvasToken)

    await page.evaluate(() => (
      window as typeof window & {
        __lineFieldPlatformControls: { flushUntilLineFieldDraw(deltaMs: number): number }
      }
    ).__lineFieldPlatformControls.flushUntilLineFieldDraw(50))
    await expect.poll(() => lineFieldDrawCount(page)).toBe(visibilityFrozenSequence + 2)
    expect(await lineFieldCanvasFingerprint(canvas)).not.toBe(visibilityFrozenPixels)
    await expect(canvas).toHaveAttribute('data-e2e-canvas-token', canvasToken)
    expect(runtimeErrors).toEqual([])
  })
})

test.describe('Session 3 deterministic calibration evidence', () => {
  test.describe.configure({ retries: 0 })
  test.skip(
    !session3EvidenceRunDirectory,
    'Set fresh SESSION3_EVIDENCE_RUN_DIR and exact SESSION3_EVIDENCE_HEAD to capture',
  )

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      ;(window as typeof window & {
        __session3EvidenceClock?: { restore(): void }
      }).__session3EvidenceClock?.restore()
    }).catch(() => undefined)
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`@session3-evidence ${theme} normal-motion evidence follows generated checkpoints`, async ({ page }, testInfo) => {
      test.setTimeout(120_000)
      const baseName = evidenceBaseName(page, testInfo.project.name, theme, 'normal')
      const evidenceDirectory = await createSession3EvidenceCell(baseName)
      await installSession3EvidenceClock(page)
      const runtimeErrors = collectRuntimeErrors(page)
      const rendererRequests: string[] = []
      page.on('request', (request) => {
        if (/\/assets\/LandingLineRenderer-[^/]+\.js$/.test(new URL(request.url()).pathname)) {
          rendererRequests.push(request.url())
        }
      })

      await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: theme })
      await page.goto('./')
      await expect(page.locator('.landing-shell')).toHaveAttribute('data-landing-theme', theme)
      const rootToken = await assignEvidenceIdentity(page)
      const targets = await readLineFieldEvidenceTargets(page)
      const seedTag = evidenceProgressTag(lineFieldConfig.reveal.startFilmProgress)
      const states: Array<Record<string, unknown>> = []

      const beforePreloadState = await captureLineFieldEvidenceState(page, evidenceDirectory, {
        canvasToken: null,
        formula: 'initial = 0',
        formulaTarget: 0,
        label: 'before-preload',
        rendererRequests,
        rootToken,
      })
      states.push(beforePreloadState)
      expect(beforePreloadState.identity.canvasAbsent).toBe(true)
      expect(beforePreloadState.identity.canvasTokenMatches).toBe(true)
      expect(rendererRequests).toEqual([])

      await scrollLineFieldFilmTo(page, lineFieldConfig.reveal.preloadFilmProgress)
      await expect.poll(() => rendererRequests.length).toBe(1)
      const preloadCanvasToken = await assignEvidenceCanvasIdentityIfPresent(page)
      const preloadState = await captureLineFieldEvidenceState(page, evidenceDirectory, {
        canvasToken: preloadCanvasToken,
        formula: `film(preloadFilmProgress=${lineFieldConfig.reveal.preloadFilmProgress})`,
        formulaTarget: evidenceFilmTarget(
          targets,
          lineFieldConfig.reveal.preloadFilmProgress,
        ),
        label: 'preload',
        rendererRequests,
        rootToken,
      })
      states.push(preloadState)
      expect(preloadState.identity.canvasAbsent).toBe(preloadCanvasToken === null)
      expect(preloadState.identity.canvasTokenMatches).toBe(true)

      await scrollLineFieldFilmTo(page, lineFieldConfig.reveal.startFilmProgress)
      const field = await expectColdLineFieldOutcome(page, 'ready')
      const canvas = field.locator('.landing-line-field__renderer-host canvas')
      const canvasToken = await assignEvidenceCanvasIdentity(page)
      if (preloadCanvasToken !== null) expect(canvasToken).toBe(preloadCanvasToken)
      states.push(await captureLineFieldEvidenceState(page, evidenceDirectory, {
        canvasToken,
        filename: `${baseName}-seed-${seedTag}.png`,
        formula: `film(startFilmProgress=${lineFieldConfig.reveal.startFilmProgress})`,
        formulaTarget: evidenceFilmTarget(targets, lineFieldConfig.reveal.startFilmProgress),
        label: 'visible-seed',
        rendererRequests,
        rootToken,
      }))

      for (const [label, formula, target] of [
        ['motto-start', 'mottoStart', targets.mottoStart],
        ['motto-mid', '(mottoStart + mottoEnd) / 2', targets.mottoMid],
        ['motto-end', 'mottoEnd', targets.mottoEnd],
      ] as const) {
        await scrollEvidenceTo(page, target)
        states.push(await captureLineFieldEvidenceState(page, evidenceDirectory, {
          canvasToken,
          filename: label === 'motto-end' ? `${baseName}-motto-end.png` : undefined,
          formula,
          formulaTarget: target,
          label,
          rendererRequests,
          rootToken,
        }))
      }
      await expectFinalMotto(page)

      const firstHandoff = await findFirstEvidenceHandoff(
        page,
        targets.mottoEnd,
        targets.buildEnd,
      )
      if (firstHandoff.requestedScrollY === null) {
        throw new Error('No inclusive auto-handoff was observed by buildEnd')
      }
      expectEvidenceScrollTarget(
        firstHandoff.requestedScrollY,
        targets.buildEnd,
        'first-auto-handoff requested',
      )
      expectEvidenceScrollTarget(
        firstHandoff.actualScrollY,
        targets.buildEnd,
        'first-auto-handoff actual',
      )
      expect(firstHandoff.requestedScrollY).toBeLessThanOrEqual(Math.ceil(targets.buildEnd))
      expect(firstHandoff.mode).toBe('auto-handoff')
      states.push(await captureLineFieldEvidenceState(page, evidenceDirectory, {
        canvasToken,
        formula: 'first inclusive observed auto-handoff <= buildEnd',
        formulaTarget: targets.buildEnd,
        label: 'first-auto-handoff',
        rendererRequests,
        rootToken,
      }))

      await page.waitForTimeout(
        lineFieldConfig.handoff.velocityBlendSeconds * 1000 + 120,
      )
      await expect(field).toHaveAttribute('data-line-field-mode', 'autonomous')
      const autonomousScrollY = await page.evaluate(() => window.scrollY)
      const themePersistence: Array<Record<string, unknown>> = []
      if (theme === 'light') {
        const themeControl = page.locator('.theme-transition-control[data-variant="header"]')
        themePersistence.push(await captureLineFieldEvidenceState(page, evidenceDirectory, {
          canvasToken,
          formula: 'stable autonomous theme baseline',
          formulaTarget: autonomousScrollY,
          label: 'theme-light-before',
          rendererRequests,
          rootToken,
        }))

        await themeControl.evaluate(element => (element as HTMLElement).click())
        await expect(themeControl).toHaveAttribute('data-phase', 'dissolving')
        await expect(themeControl).toHaveAttribute('data-phase', 'idle')
        await expect(page.locator('.landing-shell')).toHaveAttribute('data-landing-theme', 'dark')
        themePersistence.push(await captureLineFieldEvidenceState(page, evidenceDirectory, {
          canvasToken,
          formula: 'same-scroll Light to Dark',
          formulaTarget: autonomousScrollY,
          label: 'theme-dark',
          rendererRequests,
          rootToken,
        }))

        await themeControl.evaluate(element => (element as HTMLElement).click())
        await expect(themeControl).toHaveAttribute('data-phase', 'dissolving')
        await expect(themeControl).toHaveAttribute('data-phase', 'idle')
        await expect(page.locator('.landing-shell')).toHaveAttribute('data-landing-theme', 'light')
        themePersistence.push(await captureLineFieldEvidenceState(page, evidenceDirectory, {
          canvasToken,
          formula: 'same-scroll Dark to Light',
          formulaTarget: autonomousScrollY,
          label: 'theme-light-after',
          rendererRequests,
          rootToken,
        }))
        const persistenceSequences = themePersistence.map(state => Number(state.frameSequence))
        expect(persistenceSequences[1]).toBeGreaterThan(persistenceSequences[0])
        expect(persistenceSequences[2]).toBeGreaterThan(persistenceSequences[1])
      }

      expect(rendererRequests).toHaveLength(1)
      await expect(canvas).toHaveAttribute('data-evidence-canvas-token', canvasToken)
      await expect(field).toHaveAttribute('data-evidence-root-token', rootToken)
      await enableSession3EvidenceClock(page)
      const autonomousScreenshots: string[] = []
      const autonomousSequences: number[] = []
      for (const frame of [1, 2, 3]) {
        if (frame > 1) await flushSession3EvidenceFrame(page)
        const filename = `${baseName}-autonomous-f${String(frame).padStart(2, '0')}.png`
        autonomousScreenshots.push(filename)
        const state = await captureLineFieldEvidenceState(page, evidenceDirectory, {
          canvasToken,
          filename,
          formula: 'fixed autonomous scroll with gated 50ms evidence frames',
          formulaTarget: autonomousScrollY,
          label: `autonomous-${frame}`,
          rendererRequests,
          rootToken,
        })
        states.push(state)
        autonomousSequences.push(state.frameSequence)
        if (!state.screenshotFrameSequence) {
          throw new Error(`Autonomous evidence frame ${frame} is missing screenshot metadata`)
        }
        expect(state.screenshotFrameSequence.after).toBe(state.screenshotFrameSequence.before)
        expect(await page.evaluate(() => window.scrollY)).toBe(autonomousScrollY)
      }
      expect(autonomousSequences[1]).toBeGreaterThan(autonomousSequences[0])
      expect(autonomousSequences[2]).toBeGreaterThan(autonomousSequences[1])

      const reverseTriggerTarget = firstHandoff.actualScrollY
        - lineFieldConfig.handoff.reverseDeadbandPx
        - 20
      const reverseCaptureScrollY = await scrollEvidenceToGated(page, reverseTriggerTarget)
      expectEvidenceScrollTarget(
        reverseCaptureScrollY,
        reverseTriggerTarget,
        'reverse-trigger actual',
      )
      await expect(field).toHaveAttribute('data-line-field-mode', 'reverse-gather')
      const reverseState = await captureLineFieldEvidenceState(page, evidenceDirectory, {
        canvasToken,
        filename: `${baseName}-reverse-trigger.png`,
        formula: 'frozenHandoffScrollY - reverseDeadbandPx - 20',
        formulaTarget: reverseTriggerTarget,
        label: 'reverse-trigger',
        rendererRequests,
        rootToken,
      })
      expect(reverseState.mode).toBe('reverse-gather')
      expect(reverseState.status).toBe('ready')
      expect(reverseState.frameSequence).toBeGreaterThan(autonomousSequences[2])
      states.push(reverseState)
      let previousGatherSequence = reverseState.frameSequence

      for (const [progress, expectedMode] of [
        [0.5, 'reverse-gather'],
        [1, 'scroll-build'],
      ] as const) {
        await flushSession3EvidenceFrame(
          page,
          lineFieldConfig.handoff.velocityBlendSeconds * 1000 / 2,
        )
        const progressTag = evidenceGatherTag(progress)
        const actualScrollY = await page.evaluate(() => window.scrollY)
        expectEvidenceScrollTarget(
          actualScrollY,
          reverseCaptureScrollY,
          `gather-${progressTag} fixed-scroll actual`,
        )
        const gatherState = await captureLineFieldEvidenceState(page, evidenceDirectory, {
          canvasToken,
          filename: `${baseName}-gather-${progressTag}.png`,
          formula: `timeGather(${progress.toFixed(2)}) at fixed reverse scroll`,
          formulaTarget: reverseCaptureScrollY,
          label: `gather-${progressTag}`,
          rendererRequests,
          rootToken,
        })
        expect(gatherState.mode).toBe(expectedMode)
        expect(gatherState.status).toBe('ready')
        expect(gatherState.frameSequence).toBeGreaterThan(previousGatherSequence)
        previousGatherSequence = gatherState.frameSequence
        states.push(gatherState)
      }

      expect(states.every(state => state.horizontalOverflow === false)).toBe(true)
      expect(states.every(state => (
        state.identity as { canvasTokenMatches: boolean }
      ).canvasTokenMatches)).toBe(true)
      expect(states.every(state => (
        state.identity as { rootTokenMatches: boolean }
      ).rootTokenMatches)).toBe(true)
      expect(themePersistence.map(state => ({
        canvasMatches: (state.identity as { canvasTokenMatches: boolean }).canvasTokenMatches,
        label: state.label,
        mode: state.mode,
        rendererRequests: state.rendererAssetRequestCount,
        rootMatches: (state.identity as { rootTokenMatches: boolean }).rootTokenMatches,
        scrollY: state.actualScrollY,
      }))).toEqual(theme === 'light'
        ? [
            { canvasMatches: true, label: 'theme-light-before', mode: 'autonomous', rendererRequests: 1, rootMatches: true, scrollY: autonomousScrollY },
            { canvasMatches: true, label: 'theme-dark', mode: 'autonomous', rendererRequests: 1, rootMatches: true, scrollY: autonomousScrollY },
            { canvasMatches: true, label: 'theme-light-after', mode: 'autonomous', rendererRequests: 1, rootMatches: true, scrollY: autonomousScrollY },
          ]
        : [])
      expect(runtimeErrors).toEqual([])

      await writeSession3EvidenceJson(evidenceDirectory, `${baseName}-metadata.json`, {
        ...evidenceMetadata(page, testInfo, theme, 'normal'),
        autonomousScreenshots,
        firstHandoff,
        identity: {
          canvasAbsentAtPreload: preloadCanvasToken === null,
          canvasToken,
          rootToken,
        },
        runtimeErrors,
        states,
        targets,
        themePersistence,
      })
    })

    test(`@session3-evidence ${theme} Reduced Motion evidence remains static`, async ({ page }, testInfo) => {
      test.setTimeout(60_000)
      const baseName = evidenceBaseName(page, testInfo.project.name, theme, 'reduced')
      const evidenceDirectory = await createSession3EvidenceCell(baseName)
      const runtimeErrors = collectRuntimeErrors(page)
      const rendererRequests: string[] = []
      page.on('request', (request) => {
        if (/\/assets\/LandingLineRenderer-[^/]+\.js$/.test(new URL(request.url()).pathname)) {
          rendererRequests.push(request.url())
        }
      })

      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme })
      await page.goto('./')
      await expect(page.locator('.landing-shell')).toHaveAttribute('data-landing-theme', theme)
      await expect(page.locator('.landing-shell')).toHaveAttribute('data-reduced-motion', 'true')
      const field = page.locator('.landing-line-field')
      await expect(field).toHaveAttribute('data-line-field-status', 'fallback-reduced-motion')
      await expect(field).toHaveAttribute('data-line-field-mode', 'static')
      await expect(field.locator('canvas')).toHaveCount(0)
      const rootToken = await assignEvidenceIdentity(page)
      const targets = await readLineFieldEvidenceTargets(page)
      await scrollEvidenceTo(page, targets.mottoEnd)
      await expectFinalMotto(page)
      await page.waitForTimeout(200)

      const finalState = await captureLineFieldEvidenceState(page, evidenceDirectory, {
        canvasToken: null,
        filename: `${baseName}-final.png`,
        formula: 'mottoEnd in Reduced Motion static flow',
        formulaTarget: targets.mottoEnd,
        label: 'reduced-final',
        rendererRequests,
        rootToken,
      })

      expect(finalState.chapterIds).toEqual([
        'haltung',
        'module',
        'thermodynamik',
        'rechenweg',
        'projekt',
      ])
      expect(finalState.horizontalOverflow).toBe(false)
      expect(finalState.mode).toBe('static')
      expect(finalState.status).toBe('fallback-reduced-motion')
      expect(finalState.identity.canvasTokenMatches).toBe(true)
      expect(finalState.identity.rootTokenMatches).toBe(true)
      expect(rendererRequests).toEqual([])
      expect(runtimeErrors).toEqual([])

      await writeSession3EvidenceJson(evidenceDirectory, `${baseName}-metadata.json`, {
        ...evidenceMetadata(page, testInfo, theme, 'reduced'),
        identity: { canvasToken: null, rootToken },
        runtimeErrors,
        states: [finalState],
        targets,
      })
    })
  }
})

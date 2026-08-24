import React, { useRef } from 'react'
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, type RenderResult } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingLineField } from '../../src/landing/line-field/LandingLineField'
import { LandingLineFallback } from '../../src/landing/line-field/LandingLineFallback'
import type { LandingRenderFailure } from '../../src/landing/render-failure'
import { lineFieldConfig } from '../../src/landing/line-field/config/line-field-config.generated'
import { evaluateMottoOrbit } from '../../src/landing/line-field/motion/motto-orbit'
import {
  createLineFieldMotionState,
  stepLineFieldMotion,
  type LineFieldRenderFrame,
} from '../../src/landing/line-field/motion/line-field-state-machine'
import * as lineFieldMotionState from '../../src/landing/line-field/motion/line-field-state-machine'
import type {
  LandingLineRenderer,
  LandingLineRendererLoader,
  LandingLineRendererOptions,
} from '../../src/landing/line-field/renderer/line-field-renderer.types'

const VIEWPORT_WIDTH = 1440
const VIEWPORT_HEIGHT = 900
const FILM_TOP = 100
const FILM_HEIGHT = 2700
const MOTTO_TOP = 2800
const MOTTO_HEIGHT = 900
const MOTTO_CARD_TOP = 3220
const MOTTO_CARD_BOTTOM = 3440
const PAGE_HEIGHT = 7200

interface FakeRendererRecord {
  readonly canvas: HTMLCanvasElement
  readonly resize: ReturnType<typeof vi.fn<LandingLineRenderer['resize']>>
  readonly render: ReturnType<typeof vi.fn<LandingLineRenderer['render']>>
  readonly dispose: ReturnType<typeof vi.fn<LandingLineRenderer['dispose']>>
  readonly onContextLost: () => void
}

interface FakeRendererOptions {
  readonly constructorError?: unknown
  readonly resizeError?: unknown
  readonly renderError?: unknown
  readonly disposalError?: unknown
}

interface FakeRendererModule {
  readonly createLandingLineRenderer: ReturnType<typeof vi.fn>
  readonly records: FakeRendererRecord[]
}

interface DeferredRendererLoader {
  readonly loader: LandingLineRendererLoader & ReturnType<typeof vi.fn>
  readonly module: FakeRendererModule
  readonly resolve: () => void
  readonly reject: (error: Error) => void
}

interface TestSceneProps {
  readonly theme?: 'light' | 'dark'
  readonly reducedMotion?: boolean
  readonly rendererLoader?: LandingLineRendererLoader
  readonly onRenderFailure?: (failure: LandingRenderFailure) => void
}

class ControlledIntersectionObserver {
  static instances: ControlledIntersectionObserver[] = []

  readonly root: Element | Document | null
  readonly rootMargin: string
  readonly thresholds: readonly number[]
  readonly observed = new Set<Element>()
  readonly disconnect = vi.fn(() => this.observed.clear())

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {},
  ) {
    this.root = options.root ?? null
    this.rootMargin = options.rootMargin ?? '0px'
    this.thresholds = Array.isArray(options.threshold)
      ? options.threshold
      : [options.threshold ?? 0]
    ControlledIntersectionObserver.instances.push(this)
  }

  observe = vi.fn((target: Element) => this.observed.add(target))
  unobserve = vi.fn((target: Element) => this.observed.delete(target))
  takeRecords = vi.fn((): IntersectionObserverEntry[] => [])

  emit(entries: Array<Pick<IntersectionObserverEntry, 'isIntersecting' | 'target'>>) {
    act(() => {
      this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver)
    })
  }
}

const originalWindowDescriptors = {
  cancelAnimationFrame: Object.getOwnPropertyDescriptor(window, 'cancelAnimationFrame'),
  devicePixelRatio: Object.getOwnPropertyDescriptor(window, 'devicePixelRatio'),
  innerHeight: Object.getOwnPropertyDescriptor(window, 'innerHeight'),
  innerWidth: Object.getOwnPropertyDescriptor(window, 'innerWidth'),
  intersectionObserver: Object.getOwnPropertyDescriptor(window, 'IntersectionObserver'),
  requestAnimationFrame: Object.getOwnPropertyDescriptor(window, 'requestAnimationFrame'),
  scrollY: Object.getOwnPropertyDescriptor(window, 'scrollY'),
}
const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')
const originalDocumentScrollHeight = Object.getOwnPropertyDescriptor(document.documentElement, 'scrollHeight')
const originalBodyScrollHeight = Object.getOwnPropertyDescriptor(document.body, 'scrollHeight')
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect

let currentScrollY = 0
let currentVisibility: DocumentVisibilityState = 'visible'
let nextAnimationFrameId = 1
let animationFrames = new Map<number, FrameRequestCallback>()
let animationNowMs = 0
let mottoCardTop = MOTTO_CARD_TOP
let mottoCardBottom = MOTTO_CARD_BOTTOM
let headerHeight = 80
let videoTop = 220
let mottoCardLeftOffset = 0
let mottoCardMeasurementOverride: Partial<Pick<DOMRect, 'left' | 'width' | 'height'>> = {}

function mottoCardLayout(viewportWidth: number) {
  if (viewportWidth === 1440) return { left: 835, width: 490 }
  if (viewportWidth === 723) return { left: 121.16, width: 544 }
  if (viewportWidth === 390) return { left: 48, width: 326 }
  return { left: viewportWidth * 0.58, width: viewportWidth * 0.34 }
}

function restoreOwnDescriptor(
  target: object,
  property: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) Object.defineProperty(target, property, descriptor)
  else Reflect.deleteProperty(target, property)
}

function normalizedCapture(
  options: boolean | EventListenerOptions | undefined,
) {
  return typeof options === 'boolean' ? options : options?.capture ?? false
}

function rectangle(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect
}

function installMeasuredScene() {
  Element.prototype.getBoundingClientRect = vi.fn(function getMeasuredRect(this: Element) {
    if (this.matches('[data-line-field-test-activity]')) {
      return rectangle(0, -currentScrollY, window.innerWidth, PAGE_HEIGHT)
    }
    if (this.matches('[data-line-field-test-header]')) {
      return rectangle(0, 0, window.innerWidth, headerHeight)
    }
    if (this.matches('[data-line-field-test-film]')) {
      return rectangle(0, FILM_TOP - currentScrollY, window.innerWidth, FILM_HEIGHT)
    }
    if (this.matches('[data-line-field-test-video]')) {
      return rectangle(window.innerWidth * 0.42, videoTop, window.innerWidth * 0.16, 180)
    }
    if (this.matches('[data-line-field-test-motto]')) {
      return rectangle(0, MOTTO_TOP - currentScrollY, window.innerWidth, MOTTO_HEIGHT)
    }
    if (this.matches('[data-line-field-test-card-slot]')) {
      const layout = mottoCardLayout(window.innerWidth)
      return {
        ...rectangle(
          layout.left + mottoCardLeftOffset,
          mottoCardTop - currentScrollY,
          layout.width,
          mottoCardBottom - mottoCardTop,
        ),
        ...mottoCardMeasurementOverride,
      } as DOMRect
    }
    return originalGetBoundingClientRect.call(this)
  })
}

function TestScene({
  theme = 'dark',
  reducedMotion = false,
  rendererLoader,
  onRenderFailure,
}: TestSceneProps) {
  const activityExtentRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const filmTrackRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const mottoPanelRef = useRef<HTMLDivElement>(null)
  const mottoCardSlotRef = useRef<HTMLDivElement>(null)

  return <>
    <div ref={activityExtentRef} data-line-field-test-activity="">
      <header ref={headerRef} data-line-field-test-header="" />
      <div ref={filmTrackRef} data-line-field-test-film="">
        <div className="wright-hero-sticky">
          <video ref={videoRef} data-line-field-test-video="" />
        </div>
      </div>
      <div ref={mottoPanelRef} data-line-field-test-motto="">
        <div ref={mottoCardSlotRef} data-line-field-test-card-slot="" />
      </div>
    </div>
    <LandingLineField
      theme={theme}
      reducedMotion={reducedMotion}
      activityExtentRef={activityExtentRef}
      headerRef={headerRef}
      filmTrackRef={filmTrackRef}
      videoRef={videoRef}
      mottoPanelRef={mottoPanelRef}
      mottoCardSlotRef={mottoCardSlotRef}
      rendererLoader={rendererLoader}
      onRenderFailure={onRenderFailure}
    />
  </>
}

function createFakeRendererModule(options: FakeRendererOptions = {}): FakeRendererModule {
  const records: FakeRendererRecord[] = []
  const createLandingLineRenderer = vi.fn((
    host: HTMLElement,
    rendererOptions: LandingLineRendererOptions,
  ): LandingLineRenderer => {
    if ('constructorError' in options) throw options.constructorError

    const canvas = document.createElement('canvas')
    host.append(canvas)
    let disposed = false
    const resize = vi.fn<LandingLineRenderer['resize']>(() => {
      if ('resizeError' in options) throw options.resizeError
    })
    const renderFrame = vi.fn<LandingLineRenderer['render']>(() => {
      if ('renderError' in options) throw options.renderError
    })
    const dispose = vi.fn<LandingLineRenderer['dispose']>(() => {
      if (disposed) return
      disposed = true
      canvas.remove()
      if ('disposalError' in options) throw options.disposalError
    })
    const record = {
      canvas,
      resize,
      render: renderFrame,
      dispose,
      onContextLost: rendererOptions.onContextLost,
    }
    records.push(record)
    return { resize, render: renderFrame, dispose }
  })

  return { createLandingLineRenderer, records }
}

function createResolvedLoader(options: FakeRendererOptions = {}) {
  const module = createFakeRendererModule(options)
  const loader = vi.fn<LandingLineRendererLoader>().mockResolvedValue(module)
  return { loader, module }
}

function createDeferredLoader(options: FakeRendererOptions = {}): DeferredRendererLoader {
  const module = createFakeRendererModule(options)
  let resolvePromise: ((module: FakeRendererModule) => void) | undefined
  let rejectPromise: ((error: Error) => void) | undefined
  const loader = vi.fn<LandingLineRendererLoader>(() => new Promise((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  }))

  return {
    loader,
    module,
    resolve: () => resolvePromise?.(module),
    reject: error => rejectPromise?.(error),
  }
}

function root(view: RenderResult) {
  return view.container.querySelector<HTMLElement>('.landing-line-field') as HTMLElement
}

function host(view: RenderResult) {
  return view.container.querySelector<HTMLElement>('.landing-line-field__renderer-host') as HTMLElement
}

function activityExtent(view: RenderResult) {
  return view.container.querySelector<HTMLElement>('[data-line-field-test-activity]') as HTMLElement
}

function filmTrack(view: RenderResult) {
  return view.container.querySelector<HTMLElement>('[data-line-field-test-film]') as HTMLElement
}

function mottoPanel(view: RenderResult) {
  return view.container.querySelector<HTMLElement>('[data-line-field-test-motto]') as HTMLElement
}

function finalMottoExpectation(view: RenderResult) {
  const panel = mottoPanel(view)
  expect(panel.style.getPropertyValue('--motto-orbit-x')).toBe('0px')
  expect(panel.style.getPropertyValue('--motto-orbit-y')).toBe('0px')
  expect(panel.style.getPropertyValue('--motto-orbit-z')).toBe('')
  expect(panel.style.getPropertyValue('--motto-scale')).toBe('1')
  expect(panel.style.getPropertyValue('--motto-blur')).toBe('0px')
  expect(panel.style.getPropertyValue('--motto-opacity')).toBe('1')
}

function setFilmProgress(progress: number) {
  currentScrollY = FILM_TOP + (FILM_HEIGHT - window.innerHeight) * progress
}

function setAutonomousScroll() {
  const orbitStart = MOTTO_TOP - window.innerHeight
  const orbitEnd = orbitStart
    + lineFieldConfig.motto.travelViewportHeights * window.innerHeight
  currentScrollY = orbitEnd
    + lineFieldConfig.handoff.triggerPastMottoVh * window.innerHeight / 100
}

function currentTestGeometry() {
  const cardLayout = mottoCardLayout(window.innerWidth)
  return {
    scrollY: currentScrollY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pageHeight: PAGE_HEIGHT,
    filmTop: FILM_TOP,
    filmHeight: FILM_HEIGHT,
    anchorViewport: [window.innerWidth * 0.5, videoTop + 90] as const,
    headerTargetViewportY: headerHeight + lineFieldConfig.geometry.headerGapPx,
    mottoTop: MOTTO_TOP,
    mottoHeight: MOTTO_HEIGHT,
    mottoCardFinalCenterX: cardLayout.left + cardLayout.width / 2,
    mottoCardFinalWidth: cardLayout.width,
    mottoCardFinalHeight: mottoCardBottom - mottoCardTop,
    mottoCardFinalTop: mottoCardTop,
    mottoCardFinalBottom: mottoCardBottom,
  }
}

function emitIntersection(view: RenderResult, isIntersecting: boolean) {
  const observer = ControlledIntersectionObserver.instances.at(-1)
  if (!observer) throw new Error('Expected a controller IntersectionObserver')
  observer.emit([{ target: activityExtent(view), isIntersecting }])
}

function emitIntersectionBatch(
  view: RenderResult,
  entries: Array<{ readonly target: 'activity' | 'other'; readonly isIntersecting: boolean }>,
) {
  const observer = ControlledIntersectionObserver.instances.at(-1)
  if (!observer) throw new Error('Expected a controller IntersectionObserver')
  const other = document.createElement('div')
  observer.emit(entries.map(entry => ({
    target: entry.target === 'activity' ? activityExtent(view) : other,
    isIntersecting: entry.isIntersecting,
  })))
}

async function flushNextAnimationFrame(deltaMs = 16) {
  const next = [...animationFrames.entries()].sort(([left], [right]) => left - right)[0]
  if (!next) return false
  const [id, callback] = next
  animationFrames.delete(id)
  animationNowMs += deltaMs
  await act(async () => {
    callback(animationNowMs)
    await Promise.resolve()
  })
  return true
}

async function flushAnimationFrames(count: number, deltaMs = 50) {
  for (let index = 0; index < count; index += 1) {
    if (!await flushNextAnimationFrame(deltaMs)) break
  }
}

async function settlePromises() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function enterReadyScrollBuild(view: RenderResult, loader: LandingLineRendererLoader) {
  emitIntersection(view, true)
  setFilmProgress(lineFieldConfig.reveal.preloadFilmProgress)
  fireEvent.scroll(window)
  await flushNextAnimationFrame()
  await settlePromises()
  await flushNextAnimationFrame()
  expect(loader).toHaveBeenCalledTimes(1)
  expect(root(view)).toHaveAttribute('data-line-field-status', 'ready')
}

async function enterAutonomous(view: RenderResult, loader: LandingLineRendererLoader) {
  await enterReadyScrollBuild(view, loader)
  setAutonomousScroll()
  fireEvent.scroll(window)
  await flushNextAnimationFrame()
  await flushAnimationFrames(12, 50)
  expect(root(view)).toHaveAttribute('data-line-field-mode', 'autonomous')
}

beforeEach(() => {
  currentScrollY = 0
  currentVisibility = 'visible'
  nextAnimationFrameId = 1
  animationFrames = new Map()
  animationNowMs = 0
  mottoCardTop = MOTTO_CARD_TOP
  mottoCardBottom = MOTTO_CARD_BOTTOM
  headerHeight = 80
  videoTop = 220
  mottoCardLeftOffset = 0
  mottoCardMeasurementOverride = {}
  ControlledIntersectionObserver.instances = []

  Object.defineProperty(window, 'innerWidth', { configurable: true, value: VIEWPORT_WIDTH })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEWPORT_HEIGHT })
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 })
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => currentScrollY })
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => currentVisibility,
  })
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: PAGE_HEIGHT,
  })
  Object.defineProperty(document.body, 'scrollHeight', {
    configurable: true,
    value: PAGE_HEIGHT - 200,
  })
  window.IntersectionObserver = ControlledIntersectionObserver as unknown as typeof IntersectionObserver
  window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    const id = nextAnimationFrameId
    nextAnimationFrameId += 1
    animationFrames.set(id, callback)
    return id
  })
  window.cancelAnimationFrame = vi.fn((id: number) => {
    animationFrames.delete(id)
  })
  installMeasuredScene()
})

afterEach(() => {
  restoreOwnDescriptor(window, 'innerWidth', originalWindowDescriptors.innerWidth)
  restoreOwnDescriptor(window, 'innerHeight', originalWindowDescriptors.innerHeight)
  restoreOwnDescriptor(window, 'devicePixelRatio', originalWindowDescriptors.devicePixelRatio)
  restoreOwnDescriptor(window, 'scrollY', originalWindowDescriptors.scrollY)
  restoreOwnDescriptor(window, 'IntersectionObserver', originalWindowDescriptors.intersectionObserver)
  restoreOwnDescriptor(window, 'requestAnimationFrame', originalWindowDescriptors.requestAnimationFrame)
  restoreOwnDescriptor(window, 'cancelAnimationFrame', originalWindowDescriptors.cancelAnimationFrame)
  restoreOwnDescriptor(document, 'visibilityState', originalVisibilityDescriptor)
  restoreOwnDescriptor(document.documentElement, 'scrollHeight', originalDocumentScrollHeight)
  restoreOwnDescriptor(document.body, 'scrollHeight', originalBodyScrollHeight)
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect
  vi.restoreAllMocks()
})

describe('LandingLineField controller', () => {
  it('keeps one viewport-sized field stage unmasked and lets foreground DOM provide occlusion', async () => {
    const live = createResolvedLoader()
    const view = render(<TestScene rendererLoader={live.loader} />)
    const track = filmTrack(view)
    const fieldRoot = root(view)

    expect(track).not.toHaveAttribute('data-line-field-aperture')
    expect(fieldRoot).not.toHaveAttribute('data-line-field-occlusion')
    await enterReadyScrollBuild(view, live.loader)
    expect(track).not.toHaveAttribute('data-line-field-aperture')
    expect(fieldRoot).not.toHaveAttribute('data-line-field-occlusion')
    expect(fieldRoot.style.left).toBe('0px')
    expect(fieldRoot.style.width).toBe(`${window.innerWidth}px`)
    expect(fieldRoot.style.height).toBe(`${window.innerHeight}px`)
    expect(fieldRoot.style.getPropertyValue('--line-field-crop-feather')).toBe('')
    expect(fieldRoot.style.getPropertyValue('--line-field-occlusion-start-y')).toBe('')
    expect(fieldRoot.style.getPropertyValue('--line-field-occlusion-end-y')).toBe('')

    setAutonomousScroll()
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    expect(fieldRoot).not.toHaveAttribute('data-line-field-occlusion')

    act(() => live.module.records[0].onContextLost())
    expect(fieldRoot).not.toHaveAttribute('data-line-field-occlusion')
    view.unmount()
    expect(track).not.toHaveAttribute('data-line-field-aperture')

    const reduced = render(<TestScene reducedMotion rendererLoader={live.loader} />)
    expect(root(reduced)).not.toHaveAttribute('data-line-field-occlusion')
    reduced.unmount()

    const failing = createResolvedLoader({ renderError: new Error('render failed') })
    const failed = render(<TestScene rendererLoader={failing.loader} />)
    emitIntersection(failed, true)
    setFilmProgress(lineFieldConfig.reveal.preloadFilmProgress)
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    await settlePromises()
    await flushNextAnimationFrame()
    expect(root(failed)).toHaveAttribute('data-line-field-status', 'fallback-error')
    expect(root(failed)).not.toHaveAttribute('data-line-field-occlusion')
  })

  it('keeps autonomous motion alive across one transient unmeasurable viewport', async () => {
    const { loader, module } = createResolvedLoader()
    const view = render(<TestScene rendererLoader={loader} />)
    await enterAutonomous(view, loader)
    const rendersBeforeMissingMeasurement = module.records[0].render.mock.calls.length

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 0 })
    expect(await flushNextAnimationFrame()).toBe(true)
    expect(module.records[0].render).toHaveBeenCalledTimes(rendersBeforeMissingMeasurement)
    expect(animationFrames).toHaveLength(1)

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEWPORT_HEIGHT })
    expect(await flushNextAnimationFrame()).toBe(true)
    expect(module.records[0].render.mock.calls.length).toBeGreaterThan(
      rendersBeforeMissingMeasurement,
    )
    expect(root(view)).toHaveAttribute('data-line-field-mode', 'autonomous')
  })

  it('defers one loader until generated preload and consumes pending motion without reset', async () => {
    const deferred = createDeferredLoader()
    setFilmProgress(lineFieldConfig.reveal.preloadFilmProgress - 0.01)
    const view = render(<TestScene rendererLoader={deferred.loader} />)
    const fieldRoot = root(view)

    expect(fieldRoot).toHaveAttribute('aria-hidden', 'true')
    expect(fieldRoot).toHaveAttribute('data-line-field-status', 'dormant')
    expect(fieldRoot).toHaveAttribute('data-line-field-mode', 'dormant')
    expect(fieldRoot).not.toHaveAttribute('data-line-field-frame-sequence')
    expect(host(view)).toBeEmptyDOMElement()
    expect(view.container.querySelectorAll('[data-line-field-fallback]')).toHaveLength(0)
    emitIntersection(view, true)
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    expect(deferred.loader).not.toHaveBeenCalled()

    setFilmProgress(lineFieldConfig.reveal.preloadFilmProgress)
    fireEvent.scroll(window)
    fireEvent.scroll(window)
    fireEvent.scroll(window)
    expect(animationFrames).toHaveLength(1)
    await flushNextAnimationFrame()
    expect(deferred.loader).toHaveBeenCalledTimes(1)
    expect(fieldRoot).toHaveAttribute('data-line-field-status', 'loading')
    expect(view.container.querySelectorAll('[data-line-field-fallback]')).toHaveLength(0)
    const mottoBeforePendingScroll = mottoPanel(view).style.getPropertyValue('--motto-orbit-x')

    const pendingMottoProgress = 0.5
    currentScrollY = MOTTO_TOP - window.innerHeight
      + pendingMottoProgress * lineFieldConfig.motto.travelViewportHeights * window.innerHeight
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    const pendingMotto = evaluateMottoOrbit(
      pendingMottoProgress,
      currentTestGeometry(),
      lineFieldConfig.motto,
    )
    const pendingPanel = mottoPanel(view)
    expect(pendingPanel.style.getPropertyValue('--motto-orbit-x')).toBe(`${pendingMotto.translateXPx}px`)
    expect(pendingPanel.style.getPropertyValue('--motto-orbit-y')).toBe(`${pendingMotto.translateYPx}px`)
    expect(pendingPanel.style.getPropertyValue('--motto-orbit-z')).toBe('')
    expect(pendingPanel.style.getPropertyValue('--motto-scale')).toBe(`${pendingMotto.scale}`)
    expect(pendingPanel.style.getPropertyValue('--motto-blur')).toBe(`${pendingMotto.blurPx}px`)
    expect(pendingPanel.style.getPropertyValue('--motto-opacity')).toBe(`${pendingMotto.opacity}`)
    expect(pendingPanel.style.getPropertyValue('--motto-orbit-x')).not.toBe(mottoBeforePendingScroll)
    expect(fieldRoot).toHaveAttribute('data-line-field-mode', 'scroll-build')
    expect(host(view)).toBeEmptyDOMElement()

    animationNowMs += 60_000
    deferred.resolve()
    await settlePromises()
    expect(deferred.module.createLandingLineRenderer).toHaveBeenCalledTimes(1)
    expect(fieldRoot).toHaveAttribute('data-line-field-status', 'ready')
    expect(host(view).querySelectorAll('canvas')).toHaveLength(1)
    expect(view.container.querySelectorAll('[data-line-field-fallback]')).toHaveLength(0)
    await flushNextAnimationFrame()

    const renderer = deferred.module.records[0]
    expect(renderer.render).toHaveBeenCalledTimes(1)
    const frame = renderer.render.mock.calls[0][0] as LineFieldRenderFrame
    expect(frame.filmProgress).toBeGreaterThanOrEqual(lineFieldConfig.reveal.startFilmProgress)
    expect(frame.mode).toBe('scroll-build')
    expect(frame.mottoProgress).toBeCloseTo(pendingMottoProgress, 10)
    expect(frame.unwrappedPhase).toBeGreaterThan(0)
    expect(mottoPanel(view).style.getPropertyValue('--motto-orbit-x')).toBe(`${pendingMotto.translateXPx}px`)
    expect(animationFrames).toHaveLength(0)
  })

  it('replays pending motion exactly when a loader crosses the autonomous handoff', async () => {
    const deferred = createDeferredLoader()
    const view = render(<TestScene rendererLoader={deferred.loader} />)
    emitIntersection(view, true)

    let replayState = createLineFieldMotionState(lineFieldConfig)
    setFilmProgress(lineFieldConfig.reveal.preloadFilmProgress)
    const preloadGeometry = currentTestGeometry()
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    const preloadResult = stepLineFieldMotion(replayState, {
      geometry: preloadGeometry,
      theme: 'dark',
      pointerTarget: { proximity: 0, twistNormalized: 0 },
      nowMs: 16,
      clockMode: 'rebase',
    }, lineFieldConfig)
    replayState = preloadResult.state
    expect(deferred.loader).toHaveBeenCalledTimes(1)
    expect(root(view)).toHaveAttribute('data-line-field-status', 'loading')

    setAutonomousScroll()
    const handoffGeometry = currentTestGeometry()
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    const handoffResult = stepLineFieldMotion(replayState, {
      geometry: handoffGeometry,
      theme: 'dark',
      pointerTarget: { proximity: 0, twistNormalized: 0 },
      nowMs: 32,
      clockMode: 'advance',
    }, lineFieldConfig)
    expect(handoffResult.frame.mode).toBe('auto-handoff')
    expect(host(view)).toBeEmptyDOMElement()

    animationNowMs += 60_000
    const expectedFirstRender = stepLineFieldMotion(handoffResult.state, {
      geometry: handoffGeometry,
      theme: 'dark',
      pointerTarget: { proximity: 0, twistNormalized: 0 },
      nowMs: animationNowMs + 16,
      clockMode: 'rebase',
    }, lineFieldConfig)
    deferred.resolve()
    await settlePromises()
    await flushNextAnimationFrame()

    const firstRendered = deferred.module.records[0].render.mock.calls[0][0] as LineFieldRenderFrame
    expect(firstRendered.mode).toBe(expectedFirstRender.frame.mode)
    expect(firstRendered.commonFrontDocumentY).toBe(expectedFirstRender.frame.commonFrontDocumentY)
    expect(firstRendered.unwrappedPhase).toBe(expectedFirstRender.frame.unwrappedPhase)
    expect(firstRendered.tipOffsetsViewportFractions).toEqual(
      expectedFirstRender.frame.tipOffsetsViewportFractions,
    )
    expect(deferred.module.records[0].render).toHaveBeenCalledTimes(1)
    const expectedAdvance = stepLineFieldMotion(expectedFirstRender.state, {
      geometry: handoffGeometry,
      theme: 'dark',
      pointerTarget: { proximity: 0, twistNormalized: 0 },
      nowMs: animationNowMs + 50,
      clockMode: 'advance',
    }, lineFieldConfig)
    await flushNextAnimationFrame(50)
    const secondRendered = deferred.module.records[0].render.mock.calls[1][0] as LineFieldRenderFrame
    expect(secondRendered.mode).toBe(expectedAdvance.frame.mode)
    expect(secondRendered.commonFrontDocumentY).toBe(expectedAdvance.frame.commonFrontDocumentY)
    expect(secondRendered.unwrappedPhase).toBe(expectedAdvance.frame.unwrappedPhase)
    expect(secondRendered.tipOffsetsViewportFractions).toEqual(
      expectedAdvance.frame.tipOffsetsViewportFractions,
    )
    expect(deferred.module.records[0].render).toHaveBeenCalledTimes(2)
  })

  it('stays autonomous above the frozen handoff then gathers automatically on the same canvas', async () => {
    const { loader, module } = createResolvedLoader()
    const view = render(<TestScene rendererLoader={loader} />)
    await enterReadyScrollBuild(view, loader)
    const fieldRoot = root(view)
    const canvas = module.records[0].canvas

    setFilmProgress(lineFieldConfig.reveal.startFilmProgress)
    fireEvent.scroll(window)
    fireEvent.scroll(window)
    expect(animationFrames).toHaveLength(1)
    await flushNextAnimationFrame()
    expect(fieldRoot).toHaveAttribute('data-line-field-mode', 'scroll-build')
    expect(animationFrames).toHaveLength(0)

    setAutonomousScroll()
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    expect(fieldRoot).toHaveAttribute('data-line-field-mode', 'auto-handoff')
    const handoffRenderCount = module.records[0].render.mock.calls.length
    expect(animationFrames).toHaveLength(1)
    await flushAnimationFrames(12, 50)
    expect(fieldRoot).toHaveAttribute('data-line-field-mode', 'autonomous')
    expect(module.records[0].render.mock.calls.length).toBeGreaterThan(handoffRenderCount)

    const handoffScrollY = currentScrollY
    currentScrollY += 600
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    expect(fieldRoot).toHaveAttribute('data-line-field-mode', 'autonomous')

    currentScrollY = handoffScrollY + 300
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    expect(fieldRoot).toHaveAttribute('data-line-field-mode', 'autonomous')
    expect(animationFrames).toHaveLength(1)

    currentScrollY = handoffScrollY - lineFieldConfig.handoff.reverseDeadbandPx - 20
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    expect(fieldRoot).toHaveAttribute('data-line-field-mode', 'reverse-gather')
    expect(animationFrames).toHaveLength(1)
    await flushAnimationFrames(12, 50)
    expect(fieldRoot).toHaveAttribute('data-line-field-mode', 'scroll-build')
    expect(animationFrames).toHaveLength(0)
    expect(host(view).querySelector('canvas')).toBe(canvas)
    expect(module.createLandingLineRenderer).toHaveBeenCalledTimes(1)
  })

  it('settles pointer motion through automatic reverse gathering then stops RAF work', async () => {
    const { loader, module } = createResolvedLoader()
    const view = render(<TestScene rendererLoader={loader} />)
    await enterAutonomous(view, loader)
    const fieldRoot = root(view)
    const renderer = module.records[0]
    const anchorX = window.innerWidth * 0.5
    const radius = lineFieldConfig.pointer.radiusVw * window.innerWidth / 100

    fireEvent.pointerMove(window, {
      clientX: anchorX + radius / 2,
      clientY: 450,
    })
    await flushAnimationFrames(40, 50)
    const activePointer = renderer.render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame
    expect(activePointer.pointerProximity).toBeCloseTo(0.5, 3)

    currentScrollY -= lineFieldConfig.handoff.reverseDeadbandPx + 20
    fireEvent.scroll(window)
    await flushNextAnimationFrame(50)
    expect(fieldRoot).toHaveAttribute('data-line-field-mode', 'reverse-gather')
    expect(animationFrames).toHaveLength(1)

    fireEvent.pointerOut(window, { relatedTarget: null })
    const rendersBeforeSettling = renderer.render.mock.calls.length
    await flushAnimationFrames(80, 50)
    const settlingFrames = renderer.render.mock.calls
      .slice(rendersBeforeSettling)
      .map(([frame]) => frame as LineFieldRenderFrame)

    expect(settlingFrames.length).toBeGreaterThan(1)
    expect(settlingFrames.every((frame, index) => (
      index === 0
      || frame.pointerProximity <= settlingFrames[index - 1].pointerProximity
    ))).toBe(true)
    expect(settlingFrames.at(-1)?.pointerProximity).toBe(0)
    expect(fieldRoot).toHaveAttribute('data-line-field-mode', 'scroll-build')
    expect(animationFrames).toHaveLength(0)
  })

  it('does not repeat stable mode or final motto DOM writes across autonomous frames', async () => {
    const { loader, module } = createResolvedLoader()
    const view = render(<TestScene rendererLoader={loader} />)
    await enterAutonomous(view, loader)
    const fieldRoot = root(view)
    const panel = mottoPanel(view)
    finalMottoExpectation(view)
    const initialRenderCount = module.records[0].render.mock.calls.length
    const rootAttributeWrites = vi.spyOn(fieldRoot, 'setAttribute')
    const mottoStyleWrites = vi.spyOn(panel.style, 'setProperty')

    await flushAnimationFrames(3, 50)

    expect(module.records[0].render).toHaveBeenCalledTimes(initialRenderCount + 3)
    expect(rootAttributeWrites.mock.calls.filter(([name]) => (
      name === 'data-line-field-mode'
    ))).toHaveLength(0)
    expect(mottoStyleWrites).not.toHaveBeenCalled()
    finalMottoExpectation(view)
  })

  it('keeps frame-count evidence test-owned without publishing per-frame DOM diagnostics', async () => {
    const { loader, module } = createResolvedLoader()
    const view = render(<TestScene rendererLoader={loader} />)
    await enterAutonomous(view, loader)
    const fieldRoot = root(view)
    const initialRenderCount = module.records[0].render.mock.calls.length
    const attributeMutations: string[] = []
    const observer = new MutationObserver(records => {
      attributeMutations.push(...records.flatMap(record => (
        record.attributeName === null ? [] : [record.attributeName]
      )))
    })
    observer.observe(fieldRoot, { attributes: true })

    await flushAnimationFrames(2, 50)
    await act(async () => Promise.resolve())
    observer.disconnect()

    expect(module.records[0].render).toHaveBeenCalledTimes(initialRenderCount + 2)
    expect(fieldRoot).not.toHaveAttribute('data-line-field-frame-sequence')
    expect(attributeMutations).not.toContain('data-line-field-frame-sequence')
  })

  it('cancels hidden and nonintersecting work then rebases the identical autonomous state', async () => {
    const { loader, module } = createResolvedLoader()
    const view = render(<TestScene rendererLoader={loader} />)
    await enterAutonomous(view, loader)
    const fieldRoot = root(view)
    const renderer = module.records[0]
    const canvas = renderer.canvas
    const observer = ControlledIntersectionObserver.instances[0]
    expect(observer.observe).toHaveBeenCalledWith(activityExtent(view))
    const beforePause = renderer.render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame
    const renderCountBeforePause = renderer.render.mock.calls.length

    currentVisibility = 'hidden'
    fireEvent(document, new Event('visibilitychange'))
    expect(animationFrames).toHaveLength(0)
    const radius = lineFieldConfig.pointer.radiusVw * window.innerWidth / 100
    fireEvent.pointerMove(window, {
      clientX: window.innerWidth * 0.5 + radius / 2,
      clientY: 450,
    })
    await flushAnimationFrames(3, 500)
    expect(renderer.render).toHaveBeenCalledTimes(renderCountBeforePause)

    currentVisibility = 'visible'
    fireEvent(document, new Event('visibilitychange'))
    expect(animationFrames).toHaveLength(1)
    await flushNextAnimationFrame(10_000)
    const visibilityRebase = renderer.render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame
    expect(visibilityRebase.unwrappedPhase).toBe(beforePause.unwrappedPhase)
    expect(visibilityRebase.commonFrontDocumentY).toBe(beforePause.commonFrontDocumentY)
    expect(visibilityRebase.pointerProximity).toBe(0)
    expect(fieldRoot).toHaveAttribute('data-line-field-mode', 'autonomous')
    expect(animationFrames).toHaveLength(1)
    await flushNextAnimationFrame(50)
    const visibilityAdvance = renderer.render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame
    expect(visibilityAdvance.pointerProximity).toBe(0)

    emitIntersectionBatch(view, [
      { target: 'activity', isIntersecting: true },
      { target: 'activity', isIntersecting: false },
      { target: 'other', isIntersecting: true },
    ])
    expect(animationFrames).toHaveLength(0)
    fireEvent.pointerMove(window, {
      clientX: window.innerWidth * 0.5 - radius / 2,
      clientY: 450,
    })
    const renderCountBeforeIntersectionResume = renderer.render.mock.calls.length
    emitIntersection(view, true)
    await flushNextAnimationFrame(20_000)
    const intersectionRebase = renderer.render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame
    expect(intersectionRebase.unwrappedPhase).toBe(visibilityAdvance.unwrappedPhase)
    expect(intersectionRebase.commonFrontDocumentY).toBe(visibilityAdvance.commonFrontDocumentY)
    expect(renderer.render).toHaveBeenCalledTimes(renderCountBeforeIntersectionResume + 1)
    expect(fieldRoot).toHaveAttribute('data-line-field-mode', 'autonomous')
    expect(animationFrames).toHaveLength(1)
    expect(intersectionRebase.pointerProximity).toBe(0)
    await flushNextAnimationFrame(50)
    const intersectionAdvance = renderer.render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame
    expect(intersectionAdvance.pointerProximity).toBe(0)
    expect(host(view).querySelector('canvas')).toBe(canvas)
    expect(ControlledIntersectionObserver.instances[0]).toBe(observer)
  })

  it('measures viewport effect-stage geometry, keeps DPR out of CSS, and reuses resize dimensions', async () => {
    const { loader, module } = createResolvedLoader()
    const view = render(<TestScene rendererLoader={loader} />)
    await enterReadyScrollBuild(view, loader)
    const fieldRoot = root(view)
    const renderer = module.records[0]
    const expectedDesktopWidth = window.innerWidth

    expect(fieldRoot.style.top).toBe('0px')
    expect(fieldRoot.style.left).toBe('0px')
    expect(fieldRoot.style.width).toBe(`${expectedDesktopWidth}px`)
    expect(fieldRoot.style.height).toBe(`${window.innerHeight}px`)
    expect(renderer.resize).toHaveBeenLastCalledWith(
      expectedDesktopWidth,
      VIEWPORT_HEIGHT,
      2,
      lineFieldConfig.performance,
    )
    const desktopResizeCount = renderer.resize.mock.calls.length

    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    expect(renderer.resize).toHaveBeenCalledTimes(desktopResizeCount)

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 723 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 839 })
    fireEvent.resize(window)
    await flushNextAnimationFrame()
    const expectedTabletWidth = 723
    const expectedTabletMotto = evaluateMottoOrbit(
      0,
      currentTestGeometry(),
      lineFieldConfig.motto,
    )
    const panel = mottoPanel(view)
    expect(fieldRoot.style.width).toBe(`${expectedTabletWidth}px`)
    expect(fieldRoot.style.height).toBe('839px')
    expect(panel.style.getPropertyValue('--motto-orbit-x')).toBe(`${expectedTabletMotto.translateXPx}px`)
    expect(panel.style.getPropertyValue('--motto-orbit-y')).toBe(`${expectedTabletMotto.translateYPx}px`)
    expect(panel.style.getPropertyValue('--motto-orbit-z')).toBe('')
    expect(panel.style.getPropertyValue('--motto-scale')).toBe(`${expectedTabletMotto.scale}`)
    expect(panel.style.getPropertyValue('--motto-blur')).toBe(`${expectedTabletMotto.blurPx}px`)
    expect(panel.style.getPropertyValue('--motto-opacity')).toBe(`${expectedTabletMotto.opacity}`)

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 })
    fireEvent.resize(window)
    await flushNextAnimationFrame()
    const expectedMobileWidth = 390
    expect(fieldRoot.style.top).toBe('0px')
    expect(fieldRoot.style.left).toBe('0px')
    expect(fieldRoot.style.width).toBe(`${expectedMobileWidth}px`)
    expect(fieldRoot.style.height).toBe('844px')
    expect(renderer.resize).toHaveBeenLastCalledWith(
      expectedMobileWidth,
      844,
      3,
      lineFieldConfig.performance,
    )

    const expectedMobileMotto = evaluateMottoOrbit(
      0,
      currentTestGeometry(),
      lineFieldConfig.motto,
    )
    expect(panel.style.getPropertyValue('--motto-orbit-x')).toBe(`${expectedMobileMotto.translateXPx}px`)
    expect(panel.style.getPropertyValue('--motto-orbit-y')).toBe(`${expectedMobileMotto.translateYPx}px`)
    expect(panel.style.getPropertyValue('--motto-orbit-z')).toBe('')
    expect(panel.style.getPropertyValue('--motto-scale')).toBe(`${expectedMobileMotto.scale}`)
    expect(panel.style.getPropertyValue('--motto-blur')).toBe(`${expectedMobileMotto.blurPx}px`)
    expect(panel.style.getPropertyValue('--motto-opacity')).toBe(`${expectedMobileMotto.opacity}`)

    const frame = renderer.render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame
    expect(frame.anchorViewport[0]).toBeCloseTo(195, 10)
    expect(frame.anchorViewport[1]).toBe(310)
    expect(frame.headerTargetViewportY).toBe(80 + lineFieldConfig.geometry.headerGapPx)
    expect(frame.originDocumentY).toBe(currentScrollY + 310)
  })

  it.each([
    ['center X', { left: Number.NaN }],
    ['width', { width: Number.POSITIVE_INFINITY }],
    ['height', { height: Number.NaN }],
  ] as const)('rejects a non-finite final card %s measurement without a visible jump', async (
    _field,
    measurementOverride,
  ) => {
    const { loader, module } = createResolvedLoader()
    const view = render(<TestScene rendererLoader={loader} />)
    await enterReadyScrollBuild(view, loader)
    currentScrollY = MOTTO_TOP - window.innerHeight
      + 0.5 * lineFieldConfig.motto.travelViewportHeights * window.innerHeight
    fireEvent.scroll(window)
    await flushNextAnimationFrame()

    const panel = mottoPanel(view)
    const stableMottoFrame = {
      x: panel.style.getPropertyValue('--motto-orbit-x'),
      y: panel.style.getPropertyValue('--motto-orbit-y'),
      scale: panel.style.getPropertyValue('--motto-scale'),
      blur: panel.style.getPropertyValue('--motto-blur'),
      opacity: panel.style.getPropertyValue('--motto-opacity'),
    }
    const rendersBeforeMalformedMeasurement = module.records[0].render.mock.calls.length

    mottoCardLeftOffset = 120
    mottoCardMeasurementOverride = measurementOverride
    fireEvent.resize(window)
    await flushNextAnimationFrame()

    expect(root(view)).toHaveAttribute('data-line-field-status', 'ready')
    expect(module.records[0].render).toHaveBeenCalledTimes(
      rendersBeforeMalformedMeasurement + 1,
    )
    expect({
      x: panel.style.getPropertyValue('--motto-orbit-x'),
      y: panel.style.getPropertyValue('--motto-orbit-y'),
      scale: panel.style.getPropertyValue('--motto-scale'),
      blur: panel.style.getPropertyValue('--motto-blur'),
      opacity: panel.style.getPropertyValue('--motto-opacity'),
    }).toEqual(stableMottoFrame)
  })

  it('remeasures the live scroll-build front when theme rerender sees new motto-card geometry', async () => {
    const { loader, module } = createResolvedLoader()
    const view = render(<TestScene rendererLoader={loader} />)
    await enterReadyScrollBuild(view, loader)
    currentScrollY = 2200
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    const renderer = module.records[0]
    const initialFrame = renderer.render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame

    expect(initialFrame.mode).toBe('scroll-build')
    const initialCommonFrontDocumentY = initialFrame.commonFrontDocumentY
    mottoCardTop = 3700
    mottoCardBottom = 4080
    view.rerender(<TestScene theme="light" rendererLoader={loader} />)
    expect(animationFrames).toHaveLength(1)
    await flushNextAnimationFrame(0)

    const expected = stepLineFieldMotion(
      createLineFieldMotionState(lineFieldConfig),
      {
        geometry: {
          scrollY: 2200,
          viewportWidth: 1440,
          viewportHeight: 900,
          pageHeight: 7200,
          filmTop: 100,
          filmHeight: 2700,
          anchorViewport: [720, 310],
          headerTargetViewportY: 80,
          mottoTop: 2800,
          mottoHeight: 900,
          mottoCardFinalCenterX: 1080,
          mottoCardFinalWidth: 490,
          mottoCardFinalHeight: 380,
          mottoCardFinalTop: 3700,
          mottoCardFinalBottom: 4080,
        },
        theme: 'light',
        pointerTarget: { proximity: 0, twistNormalized: 0 },
        nowMs: 0,
        clockMode: 'rebase',
      },
      lineFieldConfig,
    )
    const remeasured = renderer.render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame

    expect(remeasured.mode).toBe('scroll-build')
    expect(remeasured.commonFrontDocumentY).toBe(expected.frame.commonFrontDocumentY)
    expect(remeasured.commonFrontDocumentY).not.toBe(initialCommonFrontDocumentY)
    expect(remeasured.theme).toBe('light')
    expect(module.createLandingLineRenderer).toHaveBeenCalledTimes(1)
  })

  it('coalesces pointer bursts before measuring once and uses the latest finite client X', async () => {
    const { loader, module } = createResolvedLoader()
    const view = render(<TestScene rendererLoader={loader} />)
    await enterReadyScrollBuild(view, loader)
    setFilmProgress(lineFieldConfig.reveal.startFilmProgress)
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    expect(animationFrames).toHaveLength(0)

    const geometryReads = vi.mocked(Element.prototype.getBoundingClientRect)
    geometryReads.mockClear()
    const anchorX = window.innerWidth * 0.5
    const radius = lineFieldConfig.pointer.radiusVw * window.innerWidth / 100
    const clientXs = [
      anchorX,
      anchorX + radius / 4,
      anchorX + radius / 2,
      anchorX + radius,
      anchorX - radius / 4,
      anchorX - radius / 2,
    ]

    for (const clientX of clientXs) {
      fireEvent.pointerMove(window, { clientX, clientY: -10_000 })
    }

    expect(geometryReads).not.toHaveBeenCalled()
    expect(animationFrames).toHaveLength(1)
    await flushNextAnimationFrame()
    expect(geometryReads).toHaveBeenCalledTimes(5)
    await flushAnimationFrames(79, 50)

    const frame = module.records[0].render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame
    expect(frame.pointerProximity).toBeCloseTo(0.5, 3)
    expect(animationFrames).toHaveLength(0)
  })

  it('keeps pointer radius live for one fixed literal client offset', async () => {
    const { loader, module } = createResolvedLoader()
    const view = render(<TestScene rendererLoader={loader} />)
    await enterReadyScrollBuild(view, loader)
    setFilmProgress(lineFieldConfig.reveal.startFilmProgress)
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    const pointer = lineFieldConfig.pointer as unknown as { radiusVw: number }
    const originalRadiusVw = pointer.radiusVw

    try {
      pointer.radiusVw = 18
      fireEvent.pointerMove(window, { clientX: 849.6, clientY: -10_000 })
      await flushAnimationFrames(80, 50)
      const radius18 = module.records[0].render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame

      pointer.radiusVw = 36
      fireEvent.pointerMove(window, { clientX: 849.6, clientY: -10_000 })
      await flushAnimationFrames(80, 50)
      const radius36 = module.records[0].render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame

      expect(radius18.pointerProximity).toBeCloseTo(0.5, 12)
      expect(radius36.pointerProximity).toBeCloseTo(0.84375, 12)
      expect(radius36.pointerProximity).not.toBe(radius18.pointerProximity)
    } finally {
      pointer.radiusVw = originalRadiusVw
    }
  })

  it('applies X-only pointer proximity and settles on exit without a permanent RAF', async () => {
    const { loader, module } = createResolvedLoader()
    const view = render(<TestScene rendererLoader={loader} />)
    await enterReadyScrollBuild(view, loader)
    setFilmProgress(lineFieldConfig.reveal.startFilmProgress)
    fireEvent.scroll(window)
    await flushNextAnimationFrame()

    const anchorX = window.innerWidth * 0.5
    const radius = lineFieldConfig.pointer.radiusVw * window.innerWidth / 100
    fireEvent.pointerMove(window, { clientX: anchorX + radius / 2, clientY: -10_000 })
    await flushAnimationFrames(80, 50)
    const frame = module.records[0].render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame
    expect(frame.pointerProximity).toBeCloseTo(0.5, 3)
    expect(animationFrames).toHaveLength(0)

    fireEvent.pointerMove(window, { clientX: anchorX + radius / 2, clientY: 10_000 })
    await flushAnimationFrames(2, 50)
    const sameX = module.records[0].render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame
    expect(sameX.pointerProximity).toBe(frame.pointerProximity)

    const rendersBeforeSignChange = module.records[0].render.mock.calls.length
    fireEvent.pointerMove(window, { clientX: anchorX - radius / 2, clientY: 0 })
    await flushAnimationFrames(80, 50)
    const negative = module.records[0].render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame
    expect(negative.pointerProximity).toBeCloseTo(0.5, 3)
    expect(module.records[0].render.mock.calls.length).toBeGreaterThan(rendersBeforeSignChange)

    fireEvent.pointerMove(window, { clientX: anchorX, clientY: -20_000 })
    await flushAnimationFrames(80, 50)
    const axis = module.records[0].render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame
    expect(axis.pointerProximity).toBe(1)

    fireEvent.pointerOut(window, { relatedTarget: null })
    await flushAnimationFrames(80, 50)
    const exited = module.records[0].render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame
    expect(exited.pointerProximity).toBe(0)
    expect(animationFrames).toHaveLength(0)

    fireEvent.pointerMove(window, { clientX: anchorX + radius * 2, clientY: 10_000 })
    await flushAnimationFrames(80, 50)
    const outside = module.records[0].render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame
    expect(outside.pointerProximity).toBe(0)
  })

  it.each([
    { failure: 'loader', stage: 'loading', error: new Error('loader failed') },
    { failure: 'constructor', stage: 'initialization', error: new Error('constructor failed') },
    { failure: 'resize', stage: 'resize', error: new Error('resize failed') },
    { failure: 'render', stage: 'render', error: new Error('render failed') },
  ] as const)('reports $stage and latches one fallback-error after a $failure failure without retrying', async ({
    failure,
    stage,
    error,
  }) => {
    const options: FakeRendererOptions = failure === 'constructor'
      ? { constructorError: error }
      : failure === 'resize'
        ? { resizeError: error }
        : failure === 'render'
          ? { renderError: error }
          : {}
    const fake = createResolvedLoader(options)
    if (failure === 'loader') fake.loader.mockRejectedValue(error)
    const reporter = vi.fn<(failure: LandingRenderFailure) => void>()
    const view = render(<TestScene rendererLoader={fake.loader} onRenderFailure={reporter} />)
    emitIntersection(view, true)
    setFilmProgress(lineFieldConfig.reveal.preloadFilmProgress)
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    await settlePromises()
    await flushNextAnimationFrame()

    const fieldRoot = root(view)
    expect(fieldRoot).toHaveAttribute('data-line-field-status', 'fallback-error')
    expect(fieldRoot).toHaveAttribute('data-line-field-mode', 'static')
    expect(view.container.querySelectorAll('[data-line-field-fallback]')).toHaveLength(1)
    expect(host(view)).toBeEmptyDOMElement()
    expect(fieldRoot).not.toHaveAttribute('data-line-field-frame-sequence')
    finalMottoExpectation(view)
    const latchedRenderCount = fake.module.records[0]?.render.mock.calls.length ?? 0

    fireEvent.scroll(window)
    fireEvent.pointerMove(window, { clientX: 720, clientY: 450 })
    view.rerender(<TestScene theme="light" rendererLoader={fake.loader} />)
    fireEvent.resize(window)
    await settlePromises()
    expect(reporter).toHaveBeenCalledTimes(1)
    expect(reporter).toHaveBeenCalledWith({ boundary: 'line-field', stage, error })
    expect(fake.loader).toHaveBeenCalledTimes(1)
    expect(fieldRoot).toHaveAttribute('data-line-field-status', 'fallback-error')
    expect(fieldRoot).toHaveAttribute('data-line-field-mode', 'static')
    expect(fake.module.records[0]?.render.mock.calls.length ?? 0).toBe(latchedRenderCount)
    expect(view.container.querySelectorAll('[data-line-field-fallback]')).toHaveLength(1)
    expect(view.container.querySelector('[data-line-field-fallback]')).toHaveAttribute('data-theme', 'light')
    expect(animationFrames).toHaveLength(0)
    finalMottoExpectation(view)
    if (fake.module.records[0]) expect(fake.module.records[0].dispose).toHaveBeenCalledTimes(1)
  })

  it('reports a synchronously thrown non-Error loader value with its original cause', async () => {
    const originalValue = { source: 'synchronous loader failure' }
    const loader = vi.fn(() => {
      throw originalValue
    }) as unknown as LandingLineRendererLoader
    const reporter = vi.fn<(failure: LandingRenderFailure) => void>()
    const view = render(<TestScene rendererLoader={loader} onRenderFailure={reporter} />)
    emitIntersection(view, true)
    setFilmProgress(lineFieldConfig.reveal.preloadFilmProgress)
    fireEvent.scroll(window)

    await expect(flushNextAnimationFrame()).resolves.toBe(true)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(root(view)).toHaveAttribute('data-line-field-status', 'fallback-error')
    expect(root(view)).toHaveAttribute('data-line-field-mode', 'static')
    expect(root(view)).not.toHaveAttribute('data-line-field-frame-sequence')
    expect(view.container.querySelectorAll('[data-line-field-fallback]')).toHaveLength(1)
    expect(host(view)).toBeEmptyDOMElement()
    expect(animationFrames).toHaveLength(0)
    finalMottoExpectation(view)
    expect(reporter).toHaveBeenCalledTimes(1)
    const failure = reporter.mock.calls[0]?.[0]
    expect(failure).toMatchObject({ boundary: 'line-field', stage: 'loading' })
    expect(failure?.error).toBeInstanceOf(Error)
    expect(failure?.error.cause).toBe(originalValue)
  })

  it('reports a motion-step Error by identity and keeps the accepted terminal fallback', async () => {
    const error = new Error('motion step failed')
    const reporter = vi.fn<(failure: LandingRenderFailure) => void>()
    vi.spyOn(lineFieldMotionState, 'stepLineFieldMotion').mockImplementationOnce(() => {
      throw error
    })
    const { loader } = createResolvedLoader()
    const view = render(<TestScene rendererLoader={loader} onRenderFailure={reporter} />)

    emitIntersection(view, true)
    await flushNextAnimationFrame()

    expect(reporter).toHaveBeenCalledTimes(1)
    expect(reporter).toHaveBeenCalledWith({
      boundary: 'line-field',
      stage: 'motion-step',
      error,
    })
    expect(root(view)).toHaveAttribute('data-line-field-status', 'fallback-error')
    expect(root(view)).toHaveAttribute('data-line-field-mode', 'static')
    expect(host(view)).toBeEmptyDOMElement()
    expect(view.container.querySelectorAll('[data-line-field-fallback]')).toHaveLength(1)
    expect(animationFrames).toHaveLength(0)
    finalMottoExpectation(view)
  })

  it('reports a disposal Error once without changing owned cleanup', async () => {
    const error = new Error('disposal failed')
    const reporter = vi.fn<(failure: LandingRenderFailure) => void>()
    const { loader, module } = createResolvedLoader({ disposalError: error })
    const view = render(<TestScene rendererLoader={loader} onRenderFailure={reporter} />)
    await enterReadyScrollBuild(view, loader)
    const renderer = module.records[0]

    expect(() => view.unmount()).not.toThrow()

    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    expect(renderer.canvas.isConnected).toBe(false)
    expect(reporter).toHaveBeenCalledTimes(1)
    expect(reporter).toHaveBeenCalledWith({
      boundary: 'line-field',
      stage: 'disposal',
      error,
    })
  })

  it('reports synchronous context-loss cleanup once as disposal without initialization retry', async () => {
    const error = new Error('context-loss disposal failed')
    const reporter = vi.fn<(failure: LandingRenderFailure) => void>()
    const dispose = vi.fn<LandingLineRenderer['dispose']>(() => {
      canvas.remove()
      throw error
    })
    const canvas = document.createElement('canvas')
    const createLandingLineRenderer = vi.fn((
      rendererHost: HTMLElement,
      options: LandingLineRendererOptions,
    ): LandingLineRenderer => {
      rendererHost.append(canvas)
      options.onContextLost()
      return {
        resize: vi.fn<LandingLineRenderer['resize']>(),
        render: vi.fn<LandingLineRenderer['render']>(),
        dispose,
      }
    })
    const loader = vi.fn<LandingLineRendererLoader>().mockResolvedValue({
      createLandingLineRenderer,
    })
    const view = render(<TestScene rendererLoader={loader} onRenderFailure={reporter} />)

    emitIntersection(view, true)
    setFilmProgress(lineFieldConfig.reveal.preloadFilmProgress)
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    await settlePromises()

    expect(root(view)).toHaveAttribute('data-line-field-status', 'fallback-context-lost')
    expect(root(view)).toHaveAttribute('data-line-field-mode', 'static')
    expect(view.container.querySelectorAll('[data-line-field-fallback]')).toHaveLength(1)
    expect(host(view)).toBeEmptyDOMElement()
    expect(animationFrames).toHaveLength(0)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(createLandingLineRenderer).toHaveBeenCalledTimes(1)
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(reporter.mock.calls.map(([failure]) => failure)).toEqual([{
      boundary: 'line-field',
      stage: 'disposal',
      error,
    }])
    expect(reporter.mock.calls.some(([failure]) => failure.stage === 'initialization')).toBe(false)
  })

  it('turns renderer context loss into one inert fallback and never restores automatically', async () => {
    const { loader, module } = createResolvedLoader()
    const reporter = vi.fn<(failure: LandingRenderFailure) => void>()
    const view = render(<TestScene rendererLoader={loader} onRenderFailure={reporter} />)
    await enterAutonomous(view, loader)
    const fieldRoot = root(view)
    const renderer = module.records[0]
    const renderCount = renderer.render.mock.calls.length

    expect(animationFrames).toHaveLength(1)
    act(() => renderer.onContextLost())
    expect(fieldRoot).toHaveAttribute('data-line-field-status', 'fallback-context-lost')
    expect(fieldRoot).toHaveAttribute('data-line-field-mode', 'static')
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    expect(host(view)).toBeEmptyDOMElement()
    expect(view.container.querySelectorAll('[data-line-field-fallback]')).toHaveLength(1)
    expect(renderer.render).toHaveBeenCalledTimes(renderCount)
    finalMottoExpectation(view)
    expect(animationFrames).toHaveLength(0)

    view.rerender(<TestScene theme="light" rendererLoader={loader} onRenderFailure={reporter} />)
    fireEvent.scroll(window)
    fireEvent.pointerMove(window, { clientX: 720, clientY: 450 })
    fireEvent.resize(window)
    await settlePromises()
    expect(loader).toHaveBeenCalledTimes(1)
    expect(module.createLandingLineRenderer).toHaveBeenCalledTimes(1)
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    expect(fieldRoot).toHaveAttribute('data-line-field-status', 'fallback-context-lost')
    expect(renderer.render).toHaveBeenCalledTimes(renderCount)
    expect(view.container.querySelectorAll('[data-line-field-fallback]')).toHaveLength(1)
    expect(view.container.querySelector('[data-line-field-fallback]')).toHaveAttribute('data-theme', 'light')
    expect(animationFrames).toHaveLength(0)
    finalMottoExpectation(view)
    expect(reporter).not.toHaveBeenCalled()
  })

  it.each(['hidden', 'nonintersecting'] as const)(
    'caches a loader resolved while %s and constructs one rebased renderer on resume',
    async (pauseMode) => {
      const deferred = createDeferredLoader()
      const view = render(<TestScene rendererLoader={deferred.loader} />)
      emitIntersection(view, true)
      setFilmProgress(lineFieldConfig.reveal.preloadFilmProgress)
      fireEvent.scroll(window)
      await flushNextAnimationFrame()
      expect(deferred.loader).toHaveBeenCalledTimes(1)
      expect(root(view)).toHaveAttribute('data-line-field-status', 'loading')

      if (pauseMode === 'hidden') {
        currentVisibility = 'hidden'
        fireEvent(document, new Event('visibilitychange'))
      } else {
        emitIntersection(view, false)
      }
      expect(animationFrames).toHaveLength(0)

      animationNowMs += 60_000
      deferred.resolve()
      await settlePromises()
      expect(deferred.module.createLandingLineRenderer).not.toHaveBeenCalled()
      expect(host(view)).toBeEmptyDOMElement()
      expect(root(view)).toHaveAttribute('data-line-field-status', 'loading')

      if (pauseMode === 'hidden') {
        currentVisibility = 'visible'
        fireEvent(document, new Event('visibilitychange'))
      } else {
        emitIntersection(view, true)
      }
      await settlePromises()
      expect(deferred.module.createLandingLineRenderer).toHaveBeenCalledTimes(1)
      expect(animationFrames).toHaveLength(1)
      await flushNextAnimationFrame(10_000)

      const renderer = deferred.module.records[0]
      const firstFrame = renderer.render.mock.calls[0][0] as LineFieldRenderFrame
      expect(firstFrame.unwrappedPhase).toBe(0)
      expect(firstFrame.commonFrontDocumentY).toBe(firstFrame.originDocumentY)
      expect(root(view)).toHaveAttribute('data-line-field-status', 'ready')
      expect(renderer.render).toHaveBeenCalledTimes(1)
      expect(deferred.loader).toHaveBeenCalledTimes(1)
    },
  )

  it('gives Reduced Motion precedence and measures its static fallback without browser capabilities', () => {
    const addWindowListener = vi.spyOn(window, 'addEventListener')
    const addDocumentListener = vi.spyOn(document, 'addEventListener')
    const { loader } = createResolvedLoader()
    const reporter = vi.fn<(failure: LandingRenderFailure) => void>()
    window.IntersectionObserver = undefined as unknown as typeof IntersectionObserver
    window.requestAnimationFrame = undefined as unknown as typeof requestAnimationFrame
    window.cancelAnimationFrame = undefined as unknown as typeof cancelAnimationFrame
    const view = render(
      <TestScene reducedMotion rendererLoader={loader} onRenderFailure={reporter} />,
    )
    const fieldRoot = root(view)
    const expectedWidth = window.innerWidth

    expect(fieldRoot).toHaveAttribute('data-line-field-status', 'fallback-reduced-motion')
    expect(fieldRoot).toHaveAttribute('data-line-field-mode', 'static')
    expect(fieldRoot).not.toHaveAttribute('data-line-field-frame-sequence')
    expect(fieldRoot.style.top).toBe('0px')
    expect(fieldRoot.style.left).toBe('0px')
    expect(fieldRoot.style.width).toBe(`${expectedWidth}px`)
    expect(fieldRoot.style.height).toBe(`${window.innerHeight}px`)
    expect(loader).not.toHaveBeenCalled()
    expect(ControlledIntersectionObserver.instances).toHaveLength(0)
    expect(addWindowListener.mock.calls
      .filter(([type]) => ['scroll', 'resize', 'pointermove', 'pointerout', 'blur'].includes(type))
      .map(([type]) => type)).toEqual(['resize'])
    expect(addDocumentListener.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(0)
    finalMottoExpectation(view)

    const fallbackSvg = view.container.querySelector('[data-line-field-fallback] svg') as SVGElement
    const fallbackSpine = fallbackSvg.querySelector('[data-line-field-spine]') as SVGPathElement
    const fallbackLanes = fallbackSvg.querySelectorAll('[data-line-field-lane]')
    const expectedHeaderTarget = 80 + lineFieldConfig.geometry.headerGapPx
    expect(fallbackSvg).toHaveAttribute('viewBox', `0 0 ${expectedWidth} ${window.innerHeight}`)
    expect(fallbackSpine).toHaveAttribute('stroke-width', `${lineFieldConfig.geometry.spineWidthPx}`)
    expect(fallbackLanes).not.toHaveLength(0)
    for (const lane of fallbackLanes) {
      expect(lane).toHaveAttribute('stroke-width', `${lineFieldConfig.geometry.lineWidthPx}`)
    }
    expect(fallbackSpine).toHaveAttribute(
      'd',
      `M ${window.innerWidth * 0.5} ${expectedHeaderTarget} L ${window.innerWidth * 0.5} 310`,
    )

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
    fireEvent.resize(window)
    const resizedWidth = 390
    const resizedAnchorX = 390 * 0.42 + 390 * 0.16 * 0.5
    expect(fallbackSvg).toHaveAttribute('viewBox', `0 0 ${resizedWidth} 844`)
    expect(fallbackSpine).toHaveAttribute(
      'd',
      `M ${resizedAnchorX} ${expectedHeaderTarget} L ${resizedAnchorX} 310`,
    )
    for (const lane of fallbackSvg.querySelectorAll('[data-line-field-lane]')) {
      expect(lane.getAttribute('d')).toMatch(new RegExp(
        `^M ${resizedAnchorX} 310\\b`,
      ))
    }

    headerHeight = 72
    videoTop = 190
    view.rerender(
      <TestScene
        reducedMotion
        theme="light"
        rendererLoader={loader}
        onRenderFailure={reporter}
      />,
    )
    expect(fallbackSvg).toHaveAttribute('viewBox', `0 0 ${resizedWidth} 844`)
    expect(fallbackSpine).toHaveAttribute(
      'd',
      `M ${resizedAnchorX} 72 L ${resizedAnchorX} 280`,
    )
    for (const lane of fallbackSvg.querySelectorAll('[data-line-field-lane]')) {
      expect(lane.getAttribute('d')).toMatch(new RegExp(
        `^M ${resizedAnchorX} 280\\b`,
      ))
    }
    finalMottoExpectation(view)
    expect(reporter).not.toHaveBeenCalled()
  })

  it('reads non-seed fallback stroke widths from generated config at render time', () => {
    const geometry = lineFieldConfig.geometry as {
      lineWidthPx: number
      spineWidthPx: number
    }
    const originalLineWidth = geometry.lineWidthPx
    const originalSpineWidth = geometry.spineWidthPx

    try {
      geometry.lineWidthPx = 1.13
      geometry.spineWidthPx = 2.37
      const view = render(<LandingLineFallback theme="dark" />)
      const fallback = view.container.querySelector('[data-line-field-fallback]') as HTMLElement

      expect(fallback.querySelector('[data-line-field-spine]')).toHaveAttribute(
        'stroke-width',
        '2.37',
      )
      for (const lane of fallback.querySelectorAll('[data-line-field-lane]')) {
        expect(lane).toHaveAttribute('stroke-width', '1.13')
      }
    } finally {
      geometry.lineWidthPx = originalLineWidth
      geometry.spineWidthPx = originalSpineWidth
    }
  })

  it.each([
    'IntersectionObserver',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ] as const)('uses a synchronous unsupported fallback when %s is absent', (missingCapability) => {
    const addWindowListener = vi.spyOn(window, 'addEventListener')
    const addDocumentListener = vi.spyOn(document, 'addEventListener')
    const { loader } = createResolvedLoader()
    const reporter = vi.fn<(failure: LandingRenderFailure) => void>()
    if (missingCapability === 'IntersectionObserver') {
      window.IntersectionObserver = undefined as unknown as typeof IntersectionObserver
    } else if (missingCapability === 'requestAnimationFrame') {
      window.requestAnimationFrame = undefined as unknown as typeof requestAnimationFrame
    } else {
      window.cancelAnimationFrame = undefined as unknown as typeof cancelAnimationFrame
    }
    const view = render(<TestScene rendererLoader={loader} onRenderFailure={reporter} />)

    expect(root(view)).toHaveAttribute('data-line-field-status', 'fallback-unsupported')
    expect(root(view)).toHaveAttribute('data-line-field-mode', 'static')
    expect(view.container.querySelectorAll('[data-line-field-fallback]')).toHaveLength(1)
    expect(loader).not.toHaveBeenCalled()
    expect(ControlledIntersectionObserver.instances).toHaveLength(0)
    expect(animationFrames).toHaveLength(0)
    expect(addWindowListener.mock.calls
      .filter(([type]) => ['scroll', 'resize', 'pointermove', 'pointerout', 'blur'].includes(type))
      .map(([type]) => type)).toEqual(['resize'])
    expect(addDocumentListener.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(0)
    finalMottoExpectation(view)

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    fireEvent.resize(window)
    expect(root(view).style.top).toBe('0px')
    expect(root(view).style.width).toBe('390px')
    expect(animationFrames).toHaveLength(0)
    finalMottoExpectation(view)
    expect(reporter).not.toHaveBeenCalled()
  })

  it('ignores an old loader resolution across normal to Reduced Motion to normal epochs', async () => {
    const module = createFakeRendererModule()
    const resolvers: Array<(resolved: FakeRendererModule) => void> = []
    const loader = vi.fn<LandingLineRendererLoader>(() => new Promise((resolve) => {
      resolvers.push(resolve)
    }))
    const view = render(<TestScene rendererLoader={loader} />)
    const originalHost = host(view)
    emitIntersection(view, true)
    setFilmProgress(lineFieldConfig.reveal.preloadFilmProgress)
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    expect(loader).toHaveBeenCalledTimes(1)
    expect(root(view)).toHaveAttribute('data-line-field-status', 'loading')

    view.rerender(<TestScene reducedMotion rendererLoader={loader} />)
    view.rerender(<TestScene rendererLoader={loader} />)
    expect(host(view)).toBe(originalHost)
    act(() => resolvers[0]?.(module))
    await settlePromises()
    expect(module.createLandingLineRenderer).not.toHaveBeenCalled()
    expect(host(view)).toBeEmptyDOMElement()

    emitIntersection(view, true)
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    expect(loader).toHaveBeenCalledTimes(2)
    act(() => resolvers[1]?.(module))
    await settlePromises()
    expect(module.createLandingLineRenderer).toHaveBeenCalledTimes(1)
    expect(host(view)).toBe(originalHost)
    expect(host(view).querySelectorAll('canvas')).toHaveLength(1)
    await flushNextAnimationFrame()
    expect(module.records[0].render).toHaveBeenCalledTimes(1)
  })

  it('restarts exactly one fresh normal lifecycle across live Reduced Motion transitions', async () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const addDocumentEventListener = vi.spyOn(document, 'addEventListener')
    const removeDocumentEventListener = vi.spyOn(document, 'removeEventListener')
    const { loader, module } = createResolvedLoader()
    const view = render(<TestScene rendererLoader={loader} />)
    await enterAutonomous(view, loader)
    const fieldRoot = root(view)
    const rendererHost = host(view)
    const firstCanvas = module.records[0].canvas
    const firstObserver = ControlledIntersectionObserver.instances[0]

    expect(animationFrames).toHaveLength(1)
    view.rerender(<TestScene reducedMotion rendererLoader={loader} />)
    expect(root(view)).toBe(fieldRoot)
    expect(host(view)).toBe(rendererHost)
    expect(fieldRoot).toHaveAttribute('data-line-field-status', 'fallback-reduced-motion')
    expect(module.records[0].dispose).toHaveBeenCalledTimes(1)
    expect(firstObserver.disconnect).toHaveBeenCalledTimes(1)
    expect(firstCanvas.isConnected).toBe(false)
    expect(animationFrames).toHaveLength(0)
    finalMottoExpectation(view)
    expect(removeEventListener.mock.calls.some(([type]) => type === 'scroll')).toBe(true)
    expect(removeEventListener.mock.calls.some(([type]) => type === 'pointermove')).toBe(true)

    view.rerender(<TestScene rendererLoader={loader} />)
    await settlePromises()
    const secondObserver = ControlledIntersectionObserver.instances[1]
    expect(secondObserver).not.toBe(firstObserver)
    emitIntersection(view, true)
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    await settlePromises()
    await flushNextAnimationFrame()

    expect(loader).toHaveBeenCalledTimes(2)
    expect(module.createLandingLineRenderer).toHaveBeenCalledTimes(2)
    expect(module.records[1].canvas).not.toBe(firstCanvas)
    expect(root(view)).toBe(fieldRoot)
    expect(host(view)).toBe(rendererHost)
    expect(host(view).querySelectorAll('canvas')).toHaveLength(1)
    view.unmount()

    const trackedWindowTypes = new Set(['scroll', 'resize', 'pointermove', 'pointerout', 'blur'])
    const windowAdds = addEventListener.mock.calls.filter(([type]) => trackedWindowTypes.has(type))
    const windowRemoves = removeEventListener.mock.calls.filter(([type]) => trackedWindowTypes.has(type))
    expect(windowRemoves).toHaveLength(windowAdds.length)
    const unmatchedWindowRemoves = [...windowRemoves]
    for (const [type, callback, options] of windowAdds) {
      const matchingIndex = unmatchedWindowRemoves.findIndex(([
        removedType,
        removedCallback,
        removedOptions,
      ]) => (
        removedType === type
          && removedCallback === callback
          && normalizedCapture(removedOptions) === normalizedCapture(options)
      ))
      expect(matchingIndex).toBeGreaterThanOrEqual(0)
      if (matchingIndex >= 0) unmatchedWindowRemoves.splice(matchingIndex, 1)
    }
    expect(unmatchedWindowRemoves).toHaveLength(0)

    const documentAdds = addDocumentEventListener.mock.calls
      .filter(([type]) => type === 'visibilitychange')
    const documentRemoves = removeDocumentEventListener.mock.calls
      .filter(([type]) => type === 'visibilitychange')
    expect(documentRemoves).toHaveLength(documentAdds.length)
    const unmatchedDocumentRemoves = [...documentRemoves]
    for (const [type, callback, options] of documentAdds) {
      const matchingIndex = unmatchedDocumentRemoves.findIndex(([
        removedType,
        removedCallback,
        removedOptions,
      ]) => (
        removedType === type
          && removedCallback === callback
          && normalizedCapture(removedOptions) === normalizedCapture(options)
      ))
      expect(matchingIndex).toBeGreaterThanOrEqual(0)
      if (matchingIndex >= 0) unmatchedDocumentRemoves.splice(matchingIndex, 1)
    }
    expect(unmatchedDocumentRemoves).toHaveLength(0)
  })

  it('preserves root, renderer, observer, capture, and canonical lanes across theme changes', async () => {
    const { loader, module } = createResolvedLoader()
    const reporter = vi.fn<(failure: LandingRenderFailure) => void>()
    const view = render(<TestScene rendererLoader={loader} onRenderFailure={reporter} />)
    await enterAutonomous(view, loader)
    const fieldRoot = root(view)
    const rendererHost = host(view)
    const canvas = module.records[0].canvas
    const observer = ControlledIntersectionObserver.instances[0]
    const before = module.records[0].render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame
    const beforeRenderCount = module.records[0].render.mock.calls.length

    expect(animationFrames).toHaveLength(1)
    view.rerender(<TestScene theme="light" rendererLoader={loader} onRenderFailure={reporter} />)
    expect(animationFrames).toHaveLength(1)
    await flushNextAnimationFrame(0)
    const after = module.records[0].render.mock.calls.at(-1)?.[0] as LineFieldRenderFrame

    expect(root(view)).toBe(fieldRoot)
    expect(host(view)).toBe(rendererHost)
    expect(host(view).querySelector('canvas')).toBe(canvas)
    expect(ControlledIntersectionObserver.instances[0]).toBe(observer)
    expect(ControlledIntersectionObserver.instances).toHaveLength(1)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(module.createLandingLineRenderer).toHaveBeenCalledTimes(1)
    expect(after.theme).toBe('light')
    expect(after.tipOffsetsViewportFractions).toEqual(before.tipOffsetsViewportFractions)
    expect(after.mode).toBe(before.mode)
    expect(after.unwrappedPhase).toBe(before.unwrappedPhase)
    expect(after.commonFrontDocumentY).toBe(before.commonFrontDocumentY)
    expect(module.records[0].render).toHaveBeenCalledTimes(beforeRenderCount + 1)
    expect(reporter).not.toHaveBeenCalled()
  })

  it('invalidates a pending loader on unmount and disposes a live renderer exactly once', async () => {
    const deferred = createDeferredLoader()
    const pendingView = render(<TestScene rendererLoader={deferred.loader} />)
    emitIntersection(pendingView, true)
    setFilmProgress(lineFieldConfig.reveal.preloadFilmProgress)
    fireEvent.scroll(window)
    await flushNextAnimationFrame()
    expect(deferred.loader).toHaveBeenCalledTimes(1)
    pendingView.unmount()
    deferred.resolve()
    await settlePromises()
    expect(deferred.module.createLandingLineRenderer).not.toHaveBeenCalled()
    expect(animationFrames).toHaveLength(0)

    const resolved = createResolvedLoader()
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const liveView = render(<TestScene rendererLoader={resolved.loader} />)
    await enterAutonomous(liveView, resolved.loader)
    const renderer = resolved.module.records[0]
    const liveObserver = ControlledIntersectionObserver.instances.at(-1)
    expect(animationFrames).toHaveLength(1)
    liveView.unmount()
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    expect(renderer.canvas.isConnected).toBe(false)
    expect(animationFrames).toHaveLength(0)
    expect(liveObserver?.disconnect).toHaveBeenCalledTimes(1)
    expect(removeEventListener.mock.calls.some(([type]) => type === 'scroll')).toBe(true)
    expect(removeEventListener.mock.calls.some(([type]) => type === 'pointermove')).toBe(true)
  })
})

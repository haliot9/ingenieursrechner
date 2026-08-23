import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import {
  reportLandingRenderFailure,
  type LandingRenderFailureReporter,
  type LandingRenderFailureStage,
} from '../render-failure'
import type { LandingTheme } from '../theme/useLandingTheme'
import { lineFieldConfig } from './config/line-field-config.generated'
import { LandingLineFallback } from './LandingLineFallback'
import type { LineFieldViewportGeometry } from './motion/line-field-geometry'
import {
  createLineFieldMotionState,
  stepLineFieldMotion,
  type LineFieldMode,
  type LineFieldMotionState,
  type LineFieldPointerTarget,
} from './motion/line-field-state-machine'
import type { MottoOrbitFrame } from './motion/motto-orbit'
import type {
  LandingLineFallbackGeometry,
  LandingLineRenderer,
  LandingLineRendererLoader,
  LandingLineRendererOptions,
} from './renderer/line-field-renderer.types'
import './LandingLineField.css'

export interface LandingLineFieldProps {
  readonly theme: LandingTheme
  readonly reducedMotion: boolean
  readonly activityExtentRef: RefObject<HTMLDivElement | null>
  readonly headerRef: RefObject<HTMLElement | null>
  readonly filmTrackRef: RefObject<HTMLDivElement | null>
  readonly videoRef: RefObject<HTMLVideoElement | null>
  readonly mottoPanelRef: RefObject<HTMLDivElement | null>
  readonly mottoCardSlotRef: RefObject<HTMLDivElement | null>
  readonly rendererLoader?: LandingLineRendererLoader
  readonly onRenderFailure?: LandingRenderFailureReporter
}

type LandingLineFieldStatus =
  | 'dormant'
  | 'loading'
  | 'ready'
  | 'fallback-reduced-motion'
  | 'fallback-unsupported'
  | 'fallback-error'
  | 'fallback-context-lost'

type LandingLineFieldPublicMode = LineFieldMode | 'static'

type LandingLineRendererFactory = (
  container: HTMLElement,
  options: LandingLineRendererOptions,
) => LandingLineRenderer

interface LandingLineFieldRefs {
  readonly activityExtentRef: RefObject<HTMLDivElement | null>
  readonly headerRef: RefObject<HTMLElement | null>
  readonly filmTrackRef: RefObject<HTMLDivElement | null>
  readonly videoRef: RefObject<HTMLVideoElement | null>
  readonly mottoPanelRef: RefObject<HTMLDivElement | null>
  readonly mottoCardSlotRef: RefObject<HTMLDivElement | null>
}

interface CropGeometry {
  readonly left: number
  readonly width: number
  readonly height: number
}

interface MeasuredLineFieldScene {
  readonly geometry: LineFieldViewportGeometry
  readonly crop: CropGeometry
}

interface RendererSizeKey {
  readonly cssWidth: number
  readonly cssHeight: number
  readonly effectiveDpr: number
}

interface LandingLineFieldControllerOptions {
  readonly generation: number
  readonly isCurrentGeneration: () => boolean
  readonly refsRef: RefObject<LandingLineFieldRefs>
  readonly rootRef: RefObject<HTMLDivElement | null>
  readonly hostRef: RefObject<HTMLDivElement | null>
  readonly themeRef: RefObject<LandingTheme>
  readonly loaderRef: RefObject<LandingLineRendererLoader>
  readonly reporterRef: RefObject<LandingRenderFailureReporter | undefined>
  readonly modeRef: RefObject<LandingLineFieldPublicMode>
  readonly commitStatus: (status: LandingLineFieldStatus) => void
  readonly commitFallbackGeometry: (geometry: LandingLineFallbackGeometry) => void
}

const passiveOptions: AddEventListenerOptions = { passive: true }
const zeroPointerTarget: LineFieldPointerTarget = { proximity: 0, twistNormalized: 0 }
const finalMottoFrame: MottoOrbitFrame = {
  translateXPx: 0,
  translateYPx: 0,
  scale: 1,
  blurPx: 0,
  opacity: 1,
  projectionStatus: 'ok',
}

const defaultRendererLoader: LandingLineRendererLoader = () => import(
  './renderer/LandingLineRenderer'
)

const finiteOrZero = (value: number) => Number.isFinite(value) ? value : 0

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, finiteOrZero(value)))
)

const smoothstep01 = (value: number) => {
  const progress = clamp(value, 0, 1)
  return progress * progress * (3 - 2 * progress)
}

function hasNormalMotionCapabilities() {
  return typeof window.IntersectionObserver === 'function'
    && typeof window.requestAnimationFrame === 'function'
    && typeof window.cancelAnimationFrame === 'function'
}

function isFallbackStatus(status: LandingLineFieldStatus) {
  return status.startsWith('fallback-')
}

function initialStatus(reducedMotion: boolean): LandingLineFieldStatus {
  if (reducedMotion) return 'fallback-reduced-motion'
  return hasNormalMotionCapabilities() ? 'dormant' : 'fallback-unsupported'
}

function measureScene(refs: LandingLineFieldRefs): MeasuredLineFieldScene | null {
  const activityExtent = refs.activityExtentRef.current
  const header = refs.headerRef.current
  const filmTrack = refs.filmTrackRef.current
  const video = refs.videoRef.current
  const mottoPanel = refs.mottoPanelRef.current
  const mottoCardSlot = refs.mottoCardSlotRef.current

  if (!activityExtent || !header || !filmTrack || !video || !mottoPanel || !mottoCardSlot) {
    return null
  }

  const viewportWidth = finiteOrZero(window.innerWidth)
  const viewportHeight = finiteOrZero(window.innerHeight)
  if (viewportWidth <= 0 || viewportHeight <= 0) return null

  const scrollY = finiteOrZero(window.scrollY)
  const headerRect = header.getBoundingClientRect()
  const filmRect = filmTrack.getBoundingClientRect()
  const videoRect = video.getBoundingClientRect()
  const mottoRect = mottoPanel.getBoundingClientRect()
  const cardRect = mottoCardSlot.getBoundingClientRect()
  const anchorViewport: readonly [number, number] = [
    finiteOrZero(videoRect.left + videoRect.width * 0.5),
    finiteOrZero(videoRect.top + videoRect.height * 0.5),
  ]
  return {
    geometry: {
      scrollY,
      viewportWidth,
      viewportHeight,
      pageHeight: Math.max(
        finiteOrZero(document.documentElement.scrollHeight),
        finiteOrZero(document.body.scrollHeight),
      ),
      filmTop: finiteOrZero(filmRect.top + scrollY),
      filmHeight: finiteOrZero(filmRect.height),
      anchorViewport,
      headerTargetViewportY: finiteOrZero(
        headerRect.bottom + lineFieldConfig.geometry.headerGapPx,
      ),
      mottoTop: finiteOrZero(mottoRect.top + scrollY),
      mottoHeight: finiteOrZero(mottoRect.height),
      mottoCardFinalCenterX: cardRect.left + cardRect.width / 2,
      mottoCardFinalWidth: cardRect.width,
      mottoCardFinalHeight: cardRect.height,
      mottoCardFinalTop: finiteOrZero(cardRect.top + scrollY),
      mottoCardFinalBottom: finiteOrZero(cardRect.bottom + scrollY),
    },
    crop: {
      left: 0,
      width: viewportWidth,
      height: viewportHeight,
    },
  }
}

function applyCropGeometry(root: HTMLDivElement, crop: CropGeometry) {
  root.style.top = '0px'
  root.style.left = `${crop.left}px`
  root.style.width = `${crop.width}px`
  root.style.height = `${crop.height}px`
}

function writeMottoFrame(panel: HTMLDivElement, frame: MottoOrbitFrame) {
  const properties = [
    ['--motto-orbit-x', `${finiteOrZero(frame.translateXPx)}px`],
    ['--motto-orbit-y', `${finiteOrZero(frame.translateYPx)}px`],
    ['--motto-scale', `${finiteOrZero(frame.scale)}`],
    ['--motto-blur', `${finiteOrZero(frame.blurPx)}px`],
    ['--motto-opacity', `${clamp(frame.opacity, 0, 1)}`],
  ] as const

  properties.forEach(([name, value]) => {
    if (panel.style.getPropertyValue(name) !== value) {
      panel.style.setProperty(name, value)
    }
  })
}

function effectiveDprFor(crop: CropGeometry, deviceDpr: number) {
  const validDeviceDpr = Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 1
  const dimensionDpr = lineFieldConfig.performance.maximumRenderDimensionPx
    / Math.max(crop.width, crop.height)

  return Math.max(
    0.01,
    Math.min(validDeviceDpr, lineFieldConfig.performance.maximumDpr, dimensionDpr),
  )
}

class LandingLineFieldController {
  private readonly options: LandingLineFieldControllerOptions
  private active = true
  private normalMotion = false
  private terminal = false
  private visible = document.visibilityState === 'visible'
  private intersecting = false
  private needsClockRebase = true
  private loadStarted = false
  private pendingLoadFailure = false
  private resolvedFactory: LandingLineRendererFactory | null = null
  private renderer: LandingLineRenderer | null = null
  private observer: IntersectionObserver | null = null
  private animationFrameId: number | null = null
  private normalListenersAttached = false
  private staticResizeAttached = false
  private latestPointerClientX: number | null = null
  private pointerTarget: LineFieldPointerTarget = zeroPointerTarget
  private motionState: LineFieldMotionState = createLineFieldMotionState(lineFieldConfig)
  private rendererSize: RendererSizeKey | null = null

  constructor(options: LandingLineFieldControllerOptions) {
    this.options = options
  }

  start(reducedMotion: boolean) {
    if (reducedMotion) {
      this.enterStatic('fallback-reduced-motion')
      return
    }
    if (!hasNormalMotionCapabilities()) {
      this.enterStatic('fallback-unsupported')
      return
    }

    this.normalMotion = true
    this.terminal = false
    this.options.commitStatus('dormant')
    this.writeMode('dormant')
    this.addNormalListeners()

    const extent = this.options.refsRef.current.activityExtentRef.current
    if (!extent) {
      this.enterStatic('fallback-error')
      return
    }

    this.observer = new window.IntersectionObserver(this.handleIntersection, { threshold: 0 })
    this.observer.observe(extent)
  }

  handleThemeChange() {
    if (!this.isCurrent()) return
    if (this.terminal) {
      this.measureStaticGeometry()
      writeMottoFrameIfPresent(this.options.refsRef.current, finalMottoFrame)
      return
    }

    this.needsClockRebase = true
    this.scheduleFrame()
  }

  destroy() {
    if (!this.active) return
    this.active = false
    this.normalMotion = false
    this.latestPointerClientX = null
    this.pointerTarget = zeroPointerTarget
    this.cancelFrame()
    this.disconnectObserver()
    this.removeNormalListeners()
    this.removeStaticResizeListener()
    this.disposeRenderer()
  }

  private isCurrent() {
    return this.active
      && this.options.isCurrentGeneration()
      && this.options.generation >= 0
  }

  private isEligible() {
    return this.isCurrent()
      && this.normalMotion
      && !this.terminal
      && this.visible
      && this.intersecting
  }

  private reportFailure(stage: LandingRenderFailureStage, reason: unknown) {
    reportLandingRenderFailure(
      this.options.reporterRef.current,
      'line-field',
      stage,
      reason,
    )
  }

  private writeMode(mode: LandingLineFieldPublicMode) {
    if (this.options.modeRef.current === mode) return
    this.options.modeRef.current = mode
    this.options.rootRef.current?.setAttribute('data-line-field-mode', mode)
  }

  private measureAndApplyCrop() {
    const root = this.options.rootRef.current
    if (!root) return null
    const measured = measureScene(this.options.refsRef.current)
    if (!measured) return null
    applyCropGeometry(root, measured.crop)
    return measured
  }

  private measureStaticGeometry() {
    const measured = this.measureAndApplyCrop()
    if (!measured) return
    this.options.commitFallbackGeometry({
      cssWidth: measured.crop.width,
      cssHeight: measured.crop.height,
      anchorLocalX: measured.geometry.anchorViewport[0],
      anchorViewportY: measured.geometry.anchorViewport[1],
      headerTargetViewportY: measured.geometry.headerTargetViewportY,
    })
  }

  private enterStatic(status: Extract<LandingLineFieldStatus, `fallback-${string}`>) {
    if (!this.isCurrent() || this.terminal) return
    this.terminal = true
    this.normalMotion = false
    this.latestPointerClientX = null
    this.pointerTarget = zeroPointerTarget
    this.cancelFrame()
    this.disconnectObserver()
    this.removeNormalListeners()
    this.disposeRenderer()
    this.measureStaticGeometry()
    writeMottoFrameIfPresent(this.options.refsRef.current, finalMottoFrame)
    this.writeMode('static')
    this.options.commitStatus(status)
    this.addStaticResizeListener()
  }

  private addStaticResizeListener() {
    if (this.staticResizeAttached || !this.active) return
    window.addEventListener('resize', this.handleStaticResize, passiveOptions)
    this.staticResizeAttached = true
  }

  private removeStaticResizeListener() {
    if (!this.staticResizeAttached) return
    window.removeEventListener('resize', this.handleStaticResize, passiveOptions)
    this.staticResizeAttached = false
  }

  private readonly handleStaticResize = () => {
    if (!this.isCurrent() || !this.terminal) return
    this.measureStaticGeometry()
    writeMottoFrameIfPresent(this.options.refsRef.current, finalMottoFrame)
  }

  private addNormalListeners() {
    if (this.normalListenersAttached) return
    window.addEventListener('scroll', this.handleScroll, passiveOptions)
    window.addEventListener('resize', this.handleResize, passiveOptions)
    window.addEventListener('pointermove', this.handlePointerMove, passiveOptions)
    window.addEventListener('pointerout', this.handlePointerOut, passiveOptions)
    window.addEventListener('blur', this.handlePointerLeave)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    this.normalListenersAttached = true
  }

  private removeNormalListeners() {
    if (!this.normalListenersAttached) return
    window.removeEventListener('scroll', this.handleScroll, passiveOptions)
    window.removeEventListener('resize', this.handleResize, passiveOptions)
    window.removeEventListener('pointermove', this.handlePointerMove, passiveOptions)
    window.removeEventListener('pointerout', this.handlePointerOut, passiveOptions)
    window.removeEventListener('blur', this.handlePointerLeave)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    this.normalListenersAttached = false
  }

  private disconnectObserver() {
    this.observer?.disconnect()
    this.observer = null
  }

  private readonly handleScroll = () => this.scheduleFrame()

  private readonly handleResize = () => this.scheduleFrame()

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (!this.isEligible()) {
      this.latestPointerClientX = null
      this.pointerTarget = zeroPointerTarget
      return
    }
    this.latestPointerClientX = Number.isFinite(event.clientX) ? event.clientX : null
    if (this.latestPointerClientX === null) this.pointerTarget = zeroPointerTarget
    this.scheduleFrame()
  }

  private readonly handlePointerOut = (event: PointerEvent) => {
    if (event.relatedTarget !== null) return
    this.handlePointerLeave()
  }

  private readonly handlePointerLeave = () => {
    this.latestPointerClientX = null
    this.pointerTarget = zeroPointerTarget
    if (!this.isEligible()) return
    this.scheduleFrame()
  }

  private readonly handleVisibilityChange = () => {
    this.visible = document.visibilityState === 'visible'
    if (!this.visible) {
      this.pause()
      return
    }
    this.resume()
  }

  private readonly handleIntersection: IntersectionObserverCallback = (entries) => {
    const extent = this.options.refsRef.current.activityExtentRef.current
    if (!extent) return
    let latest: IntersectionObserverEntry | undefined
    for (const entry of entries) {
      if (entry.target === extent) latest = entry
    }
    if (!latest) return

    this.intersecting = latest.isIntersecting
    if (!this.intersecting) {
      this.pause()
      return
    }
    this.resume()
  }

  private pause() {
    this.latestPointerClientX = null
    this.pointerTarget = zeroPointerTarget
    this.needsClockRebase = true
    this.cancelFrame()
  }

  private resume() {
    if (!this.isEligible()) return
    if (this.pendingLoadFailure) {
      this.enterStatic('fallback-error')
      return
    }
    this.constructRendererIfEligible()
    if (this.terminal) return
    this.needsClockRebase = true
    this.scheduleFrame()
  }

  private scheduleFrame() {
    if (!this.isEligible() || this.animationFrameId !== null) return
    this.animationFrameId = window.requestAnimationFrame(this.runFrame)
  }

  private cancelFrame() {
    if (this.animationFrameId === null) return
    if (typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(this.animationFrameId)
    }
    this.animationFrameId = null
  }

  private readonly runFrame: FrameRequestCallback = (nowMs) => {
    this.animationFrameId = null
    if (!this.isEligible()) return

    const measured = this.measureAndApplyCrop()
    if (!measured) {
      if (
        this.motionState.mode === 'auto-handoff'
        || this.motionState.mode === 'autonomous'
        || this.motionState.mode === 'reverse-gather'
      ) {
        this.needsClockRebase = true
        this.scheduleFrame()
      }
      return
    }
    this.updatePointerTarget(measured.geometry)
    const clockMode = this.needsClockRebase ? 'rebase' : 'advance'
    this.needsClockRebase = false
    let result

    try {
      result = stepLineFieldMotion(this.motionState, {
        geometry: measured.geometry,
        theme: this.options.themeRef.current,
        pointerTarget: this.pointerTarget,
        nowMs,
        clockMode,
      }, lineFieldConfig)
    } catch (error) {
      this.reportFailure('motion-step', error)
      this.enterStatic('fallback-error')
      return
    }

    this.motionState = result.state
    this.writeMode(result.frame.mode)
    writeMottoFrameIfPresent(this.options.refsRef.current, result.motto)

    if (result.frame.filmProgress >= lineFieldConfig.reveal.preloadFilmProgress) {
      this.beginRendererLoad()
    }

    const liveRenderer = this.renderer
    if (!liveRenderer) return
    if (!this.resizeRenderer(liveRenderer, measured.crop)) return

    try {
      liveRenderer.render(result.frame, lineFieldConfig)
    } catch (error) {
      this.reportFailure('render', error)
      this.enterStatic('fallback-error')
      return
    }

    if (!this.isEligible() || this.renderer !== liveRenderer) return
    if (
      result.state.mode === 'auto-handoff'
      || result.state.mode === 'autonomous'
      || result.requestFrame
    ) {
      this.scheduleFrame()
    }
  }

  private updatePointerTarget(geometry: LineFieldViewportGeometry) {
    const clientX = this.latestPointerClientX
    if (clientX === null) {
      this.pointerTarget = zeroPointerTarget
      return
    }
    const radiusPx = lineFieldConfig.pointer.radiusVw * geometry.viewportWidth / 100
    const normalized = radiusPx > 0
      ? clamp((clientX - geometry.anchorViewport[0]) / radiusPx, -1, 1)
      : 0
    const proximity = smoothstep01(1 - Math.abs(normalized))
    const twistNormalized = clamp(
      4 * normalized * (1 - Math.abs(normalized)),
      -1,
      1,
    )
    this.pointerTarget = { proximity, twistNormalized }
  }

  private resizeRenderer(renderer: LandingLineRenderer, crop: CropGeometry) {
    const deviceDpr = window.devicePixelRatio
    const nextSize: RendererSizeKey = {
      cssWidth: crop.width,
      cssHeight: crop.height,
      effectiveDpr: effectiveDprFor(crop, deviceDpr),
    }
    const unchanged = this.rendererSize !== null
      && this.rendererSize.cssWidth === nextSize.cssWidth
      && this.rendererSize.cssHeight === nextSize.cssHeight
      && this.rendererSize.effectiveDpr === nextSize.effectiveDpr
    if (unchanged) return true

    try {
      renderer.resize(
        crop.width,
        crop.height,
        deviceDpr,
        lineFieldConfig.performance,
      )
      this.rendererSize = nextSize
      return true
    } catch (error) {
      this.reportFailure('resize', error)
      this.enterStatic('fallback-error')
      return false
    }
  }

  private beginRendererLoad() {
    if (this.loadStarted || this.terminal || !this.isCurrent()) return
    this.loadStarted = true
    this.options.commitStatus('loading')
    const loader = this.options.loaderRef.current
    let loadPromise: ReturnType<LandingLineRendererLoader>

    try {
      loadPromise = loader()
    } catch (error) {
      this.reportFailure('loading', error)
      this.enterStatic('fallback-error')
      return
    }

    void loadPromise.then((module) => {
      if (!this.isCurrent() || !this.normalMotion || this.terminal) return
      if (typeof module.createLandingLineRenderer !== 'function') {
        throw new Error('Landing line renderer module has no factory')
      }
      this.resolvedFactory = module.createLandingLineRenderer
      if (!this.visible || !this.intersecting) return
      this.constructRendererIfEligible()
    }).catch((error: unknown) => {
      if (!this.isCurrent() || !this.normalMotion || this.terminal) return
      this.reportFailure('loading', error)
      if (!this.visible || !this.intersecting) {
        this.pendingLoadFailure = true
        return
      }
      this.enterStatic('fallback-error')
    })
  }

  private constructRendererIfEligible() {
    if (this.renderer || !this.resolvedFactory || !this.isEligible()) return
    const host = this.options.hostRef.current
    if (!host) {
      this.enterStatic('fallback-error')
      return
    }

    const factory = this.resolvedFactory
    let created: LandingLineRenderer | null = null
    try {
      if (!this.isEligible()) return
      created = factory(host, { onContextLost: this.handleContextLost })
      if (!this.isEligible()) {
        try {
          created.dispose()
        } catch (disposalError) {
          this.reportFailure('disposal', disposalError)
        }
        return
      }
      this.renderer = created
      this.rendererSize = null
      this.options.commitStatus('ready')
      this.needsClockRebase = true
      this.scheduleFrame()
    } catch (error) {
      this.reportFailure('initialization', error)
      if (this.renderer === created) {
        this.renderer = null
        this.rendererSize = null
      }
      try {
        created?.dispose()
      } catch (disposalError) {
        this.reportFailure('disposal', disposalError)
      }
      if (this.isCurrent() && this.normalMotion && !this.terminal) {
        this.enterStatic('fallback-error')
      }
    }
  }

  private readonly handleContextLost = () => {
    if (!this.isCurrent() || !this.normalMotion || this.terminal) return
    this.enterStatic('fallback-context-lost')
  }

  private disposeRenderer() {
    const renderer = this.renderer
    this.renderer = null
    this.rendererSize = null
    if (!renderer) return
    try {
      renderer.dispose()
    } catch (error) {
      this.reportFailure('disposal', error)
    }
  }
}

function writeMottoFrameIfPresent(refs: LandingLineFieldRefs, frame: MottoOrbitFrame) {
  const panel = refs.mottoPanelRef.current
  if (panel) writeMottoFrame(panel, frame)
}

export function LandingLineField({
  theme,
  reducedMotion,
  activityExtentRef,
  headerRef,
  filmTrackRef,
  videoRef,
  mottoPanelRef,
  mottoCardSlotRef,
  rendererLoader,
  onRenderFailure,
}: LandingLineFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const lifecycleGenerationRef = useRef(0)
  const mountedRef = useRef(false)
  const controllerRef = useRef<LandingLineFieldController | null>(null)
  const themeRef = useRef<LandingTheme>(theme)
  const loaderRef = useRef<LandingLineRendererLoader>(rendererLoader ?? defaultRendererLoader)
  const reporterRef = useRef<LandingRenderFailureReporter | undefined>(onRenderFailure)
  const modeRef = useRef<LandingLineFieldPublicMode>(
    isFallbackStatus(initialStatus(reducedMotion)) ? 'static' : 'dormant',
  )
  const refsRef = useRef<LandingLineFieldRefs>({
    activityExtentRef,
    headerRef,
    filmTrackRef,
    videoRef,
    mottoPanelRef,
    mottoCardSlotRef,
  })
  const initial = initialStatus(reducedMotion)
  const statusRef = useRef<LandingLineFieldStatus>(initial)
  const [status, setStatus] = useState<LandingLineFieldStatus>(initial)
  const [fallbackGeometry, setFallbackGeometry] = useState<LandingLineFallbackGeometry>()

  const commitStatus = useCallback((nextStatus: LandingLineFieldStatus) => {
    if (statusRef.current === nextStatus) return
    statusRef.current = nextStatus
    setStatus(nextStatus)
  }, [])

  const commitFallbackGeometry = useCallback((next: LandingLineFallbackGeometry) => {
    setFallbackGeometry((current) => (
      current?.cssWidth === next.cssWidth
        && current.cssHeight === next.cssHeight
        && current.anchorLocalX === next.anchorLocalX
        && current.anchorViewportY === next.anchorViewportY
        && current.headerTargetViewportY === next.headerTargetViewportY
        ? current
        : next
    ))
  }, [])

  const setRoot = useCallback((node: HTMLDivElement | null) => {
    rootRef.current = node
    if (!node) return
    node.setAttribute('data-line-field-mode', modeRef.current)
  }, [])

  useLayoutEffect(() => {
    themeRef.current = theme
    loaderRef.current = rendererLoader ?? defaultRendererLoader
    reporterRef.current = onRenderFailure
    refsRef.current = {
      activityExtentRef,
      headerRef,
      filmTrackRef,
      videoRef,
      mottoPanelRef,
      mottoCardSlotRef,
    }
  })

  useLayoutEffect(() => {
    const generation = lifecycleGenerationRef.current + 1
    lifecycleGenerationRef.current = generation
    mountedRef.current = true
    const controller = new LandingLineFieldController({
      generation,
      isCurrentGeneration: () => mountedRef.current
        && lifecycleGenerationRef.current === generation,
      refsRef,
      rootRef,
      hostRef,
      themeRef,
      loaderRef,
      reporterRef,
      modeRef,
      commitStatus,
      commitFallbackGeometry,
    })
    controllerRef.current = controller
    controller.start(reducedMotion)

    return () => {
      if (controllerRef.current === controller) controllerRef.current = null
      controller.destroy()
      if (lifecycleGenerationRef.current === generation) {
        lifecycleGenerationRef.current += 1
        mountedRef.current = false
      }
    }
  }, [commitFallbackGeometry, commitStatus, reducedMotion])

  useLayoutEffect(() => {
    controllerRef.current?.handleThemeChange()
  }, [theme])

  return <div
    ref={setRoot}
    className="landing-line-field"
    aria-hidden="true"
    data-line-field-status={status}
  >
    <div ref={hostRef} className="landing-line-field__renderer-host" />
    {isFallbackStatus(status)
      ? <LandingLineFallback theme={theme} geometry={fallbackGeometry} />
      : null}
  </div>
}

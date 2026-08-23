import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WrightCopyStage } from '../../src/landing/components/WrightCopyStage'
import { WrightHero } from '../../src/landing/components/WrightHero'

const { semanticStateSetCalls } = vi.hoisted(() => ({
  semanticStateSetCalls: [] as unknown[],
}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()

  return {
    ...actual,
    useState: <State,>(initialState: State | (() => State)) => {
      const [state, setState] = actual.useState(initialState)
      if (initialState !== 'light') return [state, setState]

      const trackedSetState: typeof setState = (nextState) => {
        semanticStateSetCalls.push(nextState)
        setState(nextState)
      }
      return [state, trackedSetState]
    },
  }
})

type ObserverEntry = Pick<IntersectionObserverEntry, 'isIntersecting' | 'target'>

function renderCopyStage(activeCopyTheme: 'light' | 'dark') {
  const turbulence = React.createRef<SVGFETurbulenceElement>()
  const displacement = React.createRef<SVGFEDisplacementMapElement>()
  const fractureAlpha = React.createRef<SVGFEFuncAElement>()
  const charredFlood = React.createRef<SVGFEFloodElement>()
  const ashFlood = React.createRef<SVGFEFloodElement>()
  const filterRefs = { turbulence, displacement, fractureAlpha, charredFlood, ashFlood }
  const view = render(
    <WrightCopyStage
      activeCopyTheme={activeCopyTheme}
      filterRefs={filterRefs}
    />,
  )

  return { ...view, ...filterRefs, filterRefs }
}

interface ReducedMotionCommitSnapshot {
  themeFade: string
  lightOpacity: string
  darkOpacity: string
  turbulenceFrequency: string | null
  displacementScale: string | null
  desaturation: string
  contrast: string
  fractureSlope: string | null
  fractureIntercept: string | null
  charredOpacity: string | null
  ashOpacity: string | null
  lightHidden: string | null
  darkHidden: string | null
}

interface NormalMotionCommitSnapshot extends ReducedMotionCommitSnapshot {
  filmProgress: string
  videoTime: number
  filter: Element | null
}

function ReducedMotionCommitProbe({
  theme,
  onLayout,
}: {
  theme: 'light' | 'dark'
  onLayout: (snapshot: ReducedMotionCommitSnapshot) => void
}) {
  const hostRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const host = hostRef.current as HTMLDivElement
    const track = host.querySelector('.wright-film-track') as HTMLElement
    onLayout({
      themeFade: track.style.getPropertyValue('--wright-theme-fade'),
      lightOpacity: track.style.getPropertyValue('--wright-light-opacity'),
      darkOpacity: track.style.getPropertyValue('--wright-dark-opacity'),
      turbulenceFrequency: host.querySelector('feTurbulence')?.getAttribute('baseFrequency') ?? null,
      displacementScale: host.querySelector('feDisplacementMap')?.getAttribute('scale') ?? null,
      desaturation: track.style.getPropertyValue('--wright-desaturation'),
      contrast: track.style.getPropertyValue('--wright-contrast'),
      fractureSlope: host.querySelector('feFuncA')?.getAttribute('slope') ?? null,
      fractureIntercept: host.querySelector('feFuncA')?.getAttribute('intercept') ?? null,
      charredOpacity: host.querySelector('feFlood[data-ash-edge="charred"]')?.getAttribute('flood-opacity') ?? null,
      ashOpacity: host.querySelector('feFlood[data-ash-edge="light"]')?.getAttribute('flood-opacity') ?? null,
      lightHidden: host.querySelector('[data-copy-theme="light"]')?.getAttribute('aria-hidden') ?? null,
      darkHidden: host.querySelector('[data-copy-theme="dark"]')?.getAttribute('aria-hidden') ?? null,
    })
  }, [onLayout, theme])

  return <div ref={hostRef}><WrightHero theme={theme} reducedMotion /></div>
}

function NormalMotionCommitProbe({
  theme,
  onLayout,
}: {
  theme: 'light' | 'dark'
  onLayout: (snapshot: NormalMotionCommitSnapshot) => void
}) {
  const hostRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const host = hostRef.current as HTMLDivElement
    const track = host.querySelector('.wright-film-track') as HTMLElement
    const video = host.querySelector('video') as HTMLVideoElement
    onLayout({
      filmProgress: track.style.getPropertyValue('--wright-film-progress'),
      themeFade: track.style.getPropertyValue('--wright-theme-fade'),
      lightOpacity: track.style.getPropertyValue('--wright-light-opacity'),
      darkOpacity: track.style.getPropertyValue('--wright-dark-opacity'),
      turbulenceFrequency: host.querySelector('feTurbulence')?.getAttribute('baseFrequency') ?? null,
      displacementScale: host.querySelector('feDisplacementMap')?.getAttribute('scale') ?? null,
      desaturation: track.style.getPropertyValue('--wright-desaturation'),
      contrast: track.style.getPropertyValue('--wright-contrast'),
      fractureSlope: host.querySelector('feFuncA')?.getAttribute('slope') ?? null,
      fractureIntercept: host.querySelector('feFuncA')?.getAttribute('intercept') ?? null,
      charredOpacity: host.querySelector('feFlood[data-ash-edge="charred"]')?.getAttribute('flood-opacity') ?? null,
      ashOpacity: host.querySelector('feFlood[data-ash-edge="light"]')?.getAttribute('flood-opacity') ?? null,
      lightHidden: host.querySelector('[data-copy-theme="light"]')?.getAttribute('aria-hidden') ?? null,
      darkHidden: host.querySelector('[data-copy-theme="dark"]')?.getAttribute('aria-hidden') ?? null,
      videoTime: video.currentTime,
      filter: host.querySelector('filter'),
    })
  })

  return <div ref={hostRef}><WrightHero theme={theme} reducedMotion={false} /></div>
}

describe('WrightCopyStage', () => {
  it('keeps both identities registered while exposing only the selected Light proposition', () => {
    const { container } = renderCopyStage('light')
    const panels = container.querySelectorAll('[data-copy-theme]')
    const lightPanel = container.querySelector('[data-copy-theme="light"]') as HTMLElement
    const darkPanel = container.querySelector('[data-copy-theme="dark"]') as HTMLElement

    expect(panels).toHaveLength(2)
    expect(container.querySelectorAll('#landing-title')).toHaveLength(1)
    expect(lightPanel.getAttribute('aria-hidden')).toBe('false')
    expect(lightPanel.hasAttribute('inert')).toBe(false)
    expect(darkPanel.getAttribute('aria-hidden')).toBe('true')
    expect(darkPanel.hasAttribute('inert')).toBe(true)
    expect(within(lightPanel).getByText('Deterministische Rechenwege')).toBeTruthy()
    expect(within(lightPanel).getByRole('heading', { name: 'Nicht nur rechnen. Systeme verstehen.' }).getAttribute('id')).toBe('landing-title')
    expect(within(lightPanel).getByText('Bekannte Größen eingeben. Beziehungen prüfen. Den vollständigen Rechenweg nachvollziehen.')).toBeTruthy()
  })

  it('keeps both identities registered while exposing only the selected Dark proposition', () => {
    const { container } = renderCopyStage('dark')
    const panels = container.querySelectorAll('[data-copy-theme]')
    const lightPanel = container.querySelector('[data-copy-theme="light"]') as HTMLElement
    const darkPanel = container.querySelector('[data-copy-theme="dark"]') as HTMLElement

    expect(panels).toHaveLength(2)
    expect(container.querySelectorAll('#landing-title')).toHaveLength(1)
    expect(lightPanel.getAttribute('aria-hidden')).toBe('true')
    expect(lightPanel.hasAttribute('inert')).toBe(true)
    expect(darkPanel.getAttribute('aria-hidden')).toBe('false')
    expect(darkPanel.hasAttribute('inert')).toBe(false)
    expect(within(darkPanel).getByText('BEOBACHTUNGSFELD // SYSTEMLOGIK')).toBeTruthy()
    expect(within(darkPanel).getByRole('heading', { name: 'Aus Größen werden Spuren. Aus Spuren wird Verständnis.' }).getAttribute('id')).toBe('landing-title')
    expect(within(darkPanel).getByText('Bekannte Größen setzen. Abhängigkeiten beobachten. Den vollständigen Rechenweg Schritt für Schritt bis zum Ergebnis verfolgen.')).toBeTruthy()
  })

  it('keeps Light as the immutable sizing template and Dark registered at inset zero', () => {
    const { container, filterRefs, rerender } = renderCopyStage('light')
    const lightPanel = container.querySelector('[data-copy-theme="light"]') as HTMLElement
    const darkPanel = container.querySelector('[data-copy-theme="dark"]') as HTMLElement

    expect(lightPanel.style.position).toBe('')
    expect(darkPanel.style.position).toBe('absolute')
    expect(darkPanel.style.inset).toBe('0px')
    expect(darkPanel.style.display).not.toBe('none')

    rerender(
      <WrightCopyStage
        activeCopyTheme="dark"
        filterRefs={filterRefs}
      />,
    )

    expect(container.querySelector('[data-copy-theme="light"]')).toBe(lightPanel)
    expect(container.querySelector('[data-copy-theme="dark"]')).toBe(darkPanel)
    expect(lightPanel.style.position).toBe('')
    expect(lightPanel.style.inset).toBe('')
    expect(lightPanel.style.display).not.toBe('none')
    expect(darkPanel.style.position).toBe('absolute')
    expect(darkPanel.style.inset).toBe('0px')
  })

  it('keeps one neutral filter graph and its external refs mounted across identity swaps', () => {
    const {
      ashFlood,
      charredFlood,
      container,
      displacement,
      filterRefs,
      fractureAlpha,
      rerender,
      turbulence,
    } = renderCopyStage('light')
    const filter = container.querySelector('filter') as SVGFilterElement
    const turbulenceNode = container.querySelector('feTurbulence')
    const displacementNode = container.querySelector('feDisplacementMap')
    const fractureAlphaNode = container.querySelector('feFuncA')
    const charredFloodNode = container.querySelector('feFlood[data-ash-edge="charred"]')
    const ashFloodNode = container.querySelector('feFlood[data-ash-edge="light"]')
    const componentTransferNode = container.querySelector('feComponentTransfer')
    const morphologyNodes = [...container.querySelectorAll('feMorphology')]
    const mergeNode = container.querySelector('feMerge')

    expect(container.querySelectorAll('filter')).toHaveLength(1)
    expect(container.querySelectorAll('feTurbulence')).toHaveLength(1)
    expect(container.querySelectorAll('feDisplacementMap')).toHaveLength(1)
    expect(container.querySelectorAll('feComponentTransfer')).toHaveLength(1)
    expect(container.querySelectorAll('feMorphology')).toHaveLength(2)
    expect(container.querySelectorAll('feFlood')).toHaveLength(2)
    expect(container.querySelectorAll('feMerge')).toHaveLength(1)
    expect(container.querySelector('feComposite[operator="arithmetic"]')).toBeNull()
    expect(filter.getAttribute('x')).toBe('-30%')
    expect(filter.getAttribute('y')).toBe('-30%')
    expect(filter.getAttribute('width')).toBe('160%')
    expect(filter.getAttribute('height')).toBe('160%')
    expect(turbulenceNode?.getAttribute('stitchTiles')).toBe('stitch')
    expect(displacementNode?.getAttribute('scale')).toBe('0')
    expect(fractureAlphaNode?.getAttribute('slope')).toBe('0')
    expect(fractureAlphaNode?.getAttribute('intercept')).toBe('1')
    expect(charredFloodNode?.getAttribute('flood-opacity')).toBe('0')
    expect(ashFloodNode?.getAttribute('flood-opacity')).toBe('0')
    expect(turbulence.current).toBe(turbulenceNode)
    expect(displacement.current).toBe(displacementNode)
    expect(fractureAlpha.current).toBe(fractureAlphaNode)
    expect(charredFlood.current).toBe(charredFloodNode)
    expect(ashFlood.current).toBe(ashFloodNode)

    rerender(
      <WrightCopyStage
        activeCopyTheme="dark"
        filterRefs={filterRefs}
      />,
    )

    expect(container.querySelector('filter')).toBe(filter)
    expect(container.querySelector('feTurbulence')).toBe(turbulenceNode)
    expect(container.querySelector('feDisplacementMap')).toBe(displacementNode)
    expect(container.querySelector('feFuncA')).toBe(fractureAlphaNode)
    expect(container.querySelector('feFlood[data-ash-edge="charred"]')).toBe(charredFloodNode)
    expect(container.querySelector('feFlood[data-ash-edge="light"]')).toBe(ashFloodNode)
    expect(container.querySelector('feComponentTransfer')).toBe(componentTransferNode)
    expect([...container.querySelectorAll('feMorphology')]).toEqual(morphologyNodes)
    expect(container.querySelector('feMerge')).toBe(mergeNode)
  })
})

describe('WrightHero', () => {
  const originalIntersectionObserver = window.IntersectionObserver
  const originalRequestAnimationFrame = window.requestAnimationFrame
  const originalCancelAnimationFrame = window.cancelAnimationFrame

  let intersectionCallback: IntersectionObserverCallback | undefined
  let disconnect: ReturnType<typeof vi.fn>
  let frameCallback: FrameRequestCallback | undefined
  let observerConstructionCount: number

  beforeEach(() => {
    disconnect = vi.fn()
    intersectionCallback = undefined
    frameCallback = undefined
    observerConstructionCount = 0
    semanticStateSetCalls.length = 0

    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerConstructionCount += 1
        intersectionCallback = callback
      }

      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = disconnect
      takeRecords = vi.fn(() => [])
      root = null
      rootMargin = '0px'
      thresholds = [0]
    }

    window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallback = callback
      return 7
    })
    window.cancelAnimationFrame = vi.fn()
  })

  afterEach(() => {
    window.IntersectionObserver = originalIntersectionObserver
    window.requestAnimationFrame = originalRequestAnimationFrame
    window.cancelAnimationFrame = originalCancelAnimationFrame
    vi.restoreAllMocks()
  })

  it('presents the local Wright media without making it part of the content contract', () => {
    const { container } = render(<WrightHero theme="dark" reducedMotion={false} />)
    const video = container.querySelector('video')
    const source = container.querySelector('source')

    expect(video).not.toBeNull()
    expect(video?.muted).toBe(true)
    expect(video?.playsInline).toBe(true)
    expect(video?.preload).toBe('metadata')
    expect(video?.getAttribute('poster')).toBe('./wright-flyer-poster.webp')
    expect(source?.getAttribute('src')).toBe('./wright-flyer-scroll-gop6.mp4')
    expect(source?.getAttribute('type')).toBe('video/mp4')
    expect(video?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByText('Deterministische Rechenwege')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Nicht nur rechnen. Systeme verstehen.' })).toBeTruthy()
    expect(screen.getByText('Bekannte Größen eingeben. Beziehungen prüfen. Den vollständigen Rechenweg nachvollziehen.')).toBeTruthy()
    expect(screen.getByText(
      'Die Formel ist nur das Signal. Die Herleitung macht den Zusammenhang sichtbar.',
    )).toBeTruthy()
  })

  it('honors all external DOM refs without replacing their nodes on rerender', () => {
    const filmTrackRef = React.createRef<HTMLDivElement>()
    const videoRef = React.createRef<HTMLVideoElement>()
    const mottoPanelRef = React.createRef<HTMLDivElement>()
    const mottoCardSlotRef = React.createRef<HTMLDivElement>()
    const props = { filmTrackRef, videoRef, mottoPanelRef, mottoCardSlotRef }
    const view = render(<WrightHero theme="light" reducedMotion={false} {...props} />)

    const filmTrack = view.container.querySelector('.wright-film-track')
    const video = view.container.querySelector('.wright-hero-media')
    const mediaSticky = view.container.querySelector('.wright-hero-sticky')
    const copyOverlay = view.container.querySelector('.wright-hero-copy-overlay')
    const copySticky = view.container.querySelector('.wright-hero-copy-sticky')
    const copy = view.container.querySelector('.wright-hero-copy')
    const mottoPanel = view.container.querySelector('.wright-motto-panel')
    const mottoCardSlot = view.container.querySelector('.wright-motto-panel__slot')

    expect(filmTrackRef.current).toBe(filmTrack)
    expect(videoRef.current).toBe(video)
    expect(mottoPanelRef.current).toBe(mottoPanel)
    expect(mottoCardSlotRef.current).toBe(mottoCardSlot)
    expect(filmTrack?.nextElementSibling).toBe(mottoPanel)
    expect(mottoPanel?.parentElement).toBe(filmTrack?.parentElement)
    expect(mottoPanel?.contains(mottoCardSlot)).toBe(true)
    expect(mediaSticky?.parentElement).toBe(filmTrack)
    expect(mediaSticky?.contains(video)).toBe(true)
    expect(mediaSticky?.contains(copy)).toBe(false)
    expect(copyOverlay?.parentElement).toBe(filmTrack)
    expect(copySticky?.parentElement).toBe(copyOverlay)
    expect(copySticky?.contains(copy)).toBe(true)

    view.rerender(<WrightHero theme="dark" reducedMotion {...props} />)

    expect(filmTrackRef.current).toBe(filmTrack)
    expect(videoRef.current).toBe(video)
    expect(mottoPanelRef.current).toBe(mottoPanel)
    expect(mottoCardSlotRef.current).toBe(mottoCardSlot)
    expect(view.container.querySelector('.wright-hero-sticky')).toBe(mediaSticky)
    expect(view.container.querySelector('.wright-hero-copy-overlay')).toBe(copyOverlay)
    expect(view.container.querySelector('.wright-hero-copy-sticky')).toBe(copySticky)
    expect(view.container.querySelector('.wright-hero-copy')).toBe(copy)
  })

  it('keeps the complete proposition readable after a video error', () => {
    const { container } = render(<WrightHero theme="light" reducedMotion={false} />)

    fireEvent.error(container.querySelector('video') as HTMLVideoElement)

    expect(screen.getByRole('heading', { name: 'Nicht nur rechnen. Systeme verstehen.' })).toBeTruthy()
    expect(screen.getByText('Bekannte Größen eingeben. Beziehungen prüfen. Den vollständigen Rechenweg nachvollziehen.')).toBeTruthy()
    expect(screen.getByText('Überlieferte Formel ist Ausgangspunkt. Beweis ist das Ziel.')).toBeTruthy()
  })

  it('keeps the theme transition responsive when video metadata is unavailable', () => {
    const { container } = render(<WrightHero theme="dark" reducedMotion={false} />)
    const track = container.querySelector('.wright-film-track') as HTMLElement
    const video = container.querySelector('video') as HTMLVideoElement

    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      top: -1600,
      height: 2400,
      bottom: 800,
      left: 0,
      right: 1280,
      width: 1280,
      x: 0,
      y: -1600,
      toJSON: () => ({}),
    })
    Object.defineProperty(video, 'duration', { configurable: true, value: Number.NaN })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })

    fireEvent.error(video)
    act(() => intersectionCallback?.([{ isIntersecting: true, target: track } as ObserverEntry as IntersectionObserverEntry], {} as IntersectionObserver))
    act(() => frameCallback?.(0))

    expect(track.style.getPropertyValue('--wright-theme-fade')).toBe('1')
  })

  it('uses the final hero visibility state from a batched observer callback', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const { container } = render(<WrightHero theme="light" reducedMotion={false} />)
    const track = container.querySelector('.wright-film-track') as HTMLElement

    act(() => intersectionCallback?.([
      { isIntersecting: true, target: track } as ObserverEntry as IntersectionObserverEntry,
      { isIntersecting: false, target: track } as ObserverEntry as IntersectionObserverEntry,
    ], {} as IntersectionObserver))

    expect(addEventListener.mock.calls.some(([type]) => type === 'scroll' || type === 'resize')).toBe(false)
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
  })

  it('scrubs through one animation frame only while the hero is visible and cleans up', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const { container, unmount } = render(<WrightHero theme="dark" reducedMotion={false} />)
    const track = container.querySelector('.wright-film-track') as HTMLElement
    const video = container.querySelector('video') as HTMLVideoElement

    const getBoundingClientRect = vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      top: -800,
      height: 2400,
      bottom: 1600,
      left: 0,
      right: 1280,
      width: 1280,
      x: 0,
      y: -800,
      toJSON: () => ({}),
    })
    Object.defineProperty(video, 'duration', { configurable: true, value: 10 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })

    expect(addEventListener.mock.calls.some(([type]) => type === 'scroll' || type === 'resize')).toBe(false)
    fireEvent.loadedMetadata(video)
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()

    act(() => intersectionCallback?.([{ isIntersecting: true, target: track } as ObserverEntry as IntersectionObserverEntry], {} as IntersectionObserver))
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))

    expect(addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true })
    expect(addEventListener).toHaveBeenCalledWith('resize', expect.any(Function), { passive: true })
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1)

    act(() => frameCallback?.(0))
    expect(video.currentTime).toBeCloseTo(5)
    expect(track.style.getPropertyValue('--wright-theme-fade')).toBe('0')

    getBoundingClientRect.mockReturnValue({
      top: -1600,
      height: 2400,
      bottom: 800,
      left: 0,
      right: 1280,
      width: 1280,
      x: 0,
      y: -1600,
      toJSON: () => ({}),
    })
    window.dispatchEvent(new Event('scroll'))
    act(() => frameCallback?.(16))
    expect(track.style.getPropertyValue('--wright-theme-fade')).toBe('1')

    act(() => intersectionCallback?.([{ isIntersecting: false, target: track } as ObserverEntry as IntersectionObserverEntry], {} as IntersectionObserver))
    expect(removeEventListener.mock.calls.some(([type]) => type === 'scroll')).toBe(true)
    expect(removeEventListener.mock.calls.some(([type]) => type === 'resize')).toBe(true)

    unmount()
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('writes the dark distortion peak and reverses to the Light identity below decay start', () => {
    const { container } = render(<WrightHero theme="dark" reducedMotion={false} />)
    const section = container.querySelector('#haltung') as HTMLElement
    const track = container.querySelector('.wright-film-track') as HTMLElement
    const video = container.querySelector('video') as HTMLVideoElement
    const lightPanel = container.querySelector('[data-copy-theme="light"]') as HTMLElement
    const darkPanel = container.querySelector('[data-copy-theme="dark"]') as HTMLElement
    const turbulence = container.querySelector('feTurbulence') as SVGFETurbulenceElement
    const displacement = container.querySelector('feDisplacementMap') as SVGFEDisplacementMapElement
    const fractureAlpha = container.querySelector('feFuncA') as SVGFEFuncAElement
    const charredFlood = container.querySelector('feFlood[data-ash-edge="charred"]') as SVGFEFloodElement
    const ashFlood = container.querySelector('feFlood[data-ash-edge="light"]') as SVGFEFloodElement

    expect(track).not.toBeNull()

    const getBoundingClientRect = vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      top: -1368,
      height: 2400,
      bottom: 1032,
      left: 0,
      right: 1280,
      width: 1280,
      x: 0,
      y: -1368,
      toJSON: () => ({}),
    })
    Object.defineProperty(video, 'duration', { configurable: true, value: 10 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })

    act(() => intersectionCallback?.([
      { isIntersecting: true, target: track } as ObserverEntry as IntersectionObserverEntry,
    ], {} as IntersectionObserver))
    act(() => frameCallback?.(0))

    expect(section.getAttribute('aria-labelledby')).toBe('landing-title')
    expect(track.style.getPropertyValue('--wright-film-progress')).toBe('0.855')
    expect(track.style.getPropertyValue('--wright-theme-fade')).toBe('0.13161822265624967')
    expect(track.style.getPropertyValue('--wright-decay')).toBe('1')
    expect(track.style.getPropertyValue('--wright-light-opacity')).toBe('0.5')
    expect(track.style.getPropertyValue('--wright-dark-opacity')).toBe('0.5')
    expect(track.style.getPropertyValue('--wright-drift-x')).toBe('7.833782484974127px')
    expect(track.style.getPropertyValue('--wright-rotation')).toBe('-0.2765542543314917deg')
    expect(track.style.getPropertyValue('--wright-jitter-x')).toBe('0.20278729535655696px')
    expect(track.style.getPropertyValue('--wright-jitter-y')).toBe('-0.9939609554551785px')
    expect(track.style.getPropertyValue('--wright-panel-blur')).toBe('3.5px')
    expect(track.style.getPropertyValue('--wright-chromatic-wash')).toBe('0.42')
    expect(track.style.getPropertyValue('--wright-desaturation')).toBe('1')
    expect(track.style.getPropertyValue('--wright-contrast')).toBe('1.55')
    expect(turbulence.getAttribute('baseFrequency')).toBe('0.046')
    expect(displacement.getAttribute('scale')).toBe('92')
    expect(fractureAlpha.getAttribute('slope')).toBe('7')
    expect(fractureAlpha.getAttribute('intercept')).toBe('-3.78')
    expect(charredFlood.getAttribute('flood-opacity')).toBe('0.92')
    expect(ashFlood.getAttribute('flood-opacity')).toBe('0.72')
    expect(lightPanel.getAttribute('aria-hidden')).toBe('true')
    expect(darkPanel.getAttribute('aria-hidden')).toBe('false')
    expect(getComputedStyle(lightPanel).visibility).not.toBe('hidden')
    expect(getComputedStyle(darkPanel).visibility).not.toBe('hidden')

    getBoundingClientRect.mockReturnValue({
      top: -1120,
      height: 2400,
      bottom: 1280,
      left: 0,
      right: 1280,
      width: 1280,
      x: 0,
      y: -1120,
      toJSON: () => ({}),
    })
    window.dispatchEvent(new Event('scroll'))
    act(() => frameCallback?.(16))

    expect(lightPanel.getAttribute('aria-hidden')).toBe('false')
    expect(darkPanel.getAttribute('aria-hidden')).toBe('true')
  })

  it('does not schedule semantic state again for repeated frames on one side of the swap', () => {
    const { container } = render(<WrightHero theme="dark" reducedMotion={false} />)
    const track = container.querySelector('.wright-film-track') as HTMLElement
    const filter = container.querySelector('filter')
    const lightPanel = container.querySelector('[data-copy-theme="light"]') as HTMLElement
    const darkPanel = container.querySelector('[data-copy-theme="dark"]') as HTMLElement

    const getBoundingClientRect = vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      top: -1440,
      height: 2400,
      bottom: 960,
      left: 0,
      right: 1280,
      width: 1280,
      x: 0,
      y: -1440,
      toJSON: () => ({}),
    })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })

    act(() => intersectionCallback?.([
      { isIntersecting: true, target: track } as ObserverEntry as IntersectionObserverEntry,
    ], {} as IntersectionObserver))
    act(() => frameCallback?.(0))

    expect(semanticStateSetCalls).toHaveLength(1)
    expect(darkPanel.getAttribute('aria-hidden')).toBe('false')

    for (const timestamp of [16, 32, 48]) {
      window.dispatchEvent(new Event('scroll'))
      act(() => frameCallback?.(timestamp))
    }

    expect(semanticStateSetCalls).toHaveLength(1)
    expect(container.querySelector('filter')).toBe(filter)
    expect(container.querySelector('[data-copy-theme="light"]')).toBe(lightPanel)
    expect(container.querySelector('[data-copy-theme="dark"]')).toBe(darkPanel)

    getBoundingClientRect.mockReturnValue({
      top: -1120,
      height: 2400,
      bottom: 1280,
      left: 0,
      right: 1280,
      width: 1280,
      x: 0,
      y: -1120,
      toJSON: () => ({}),
    })
    window.dispatchEvent(new Event('scroll'))
    act(() => frameCallback?.(64))

    expect(semanticStateSetCalls).toHaveLength(2)
    expect(lightPanel.getAttribute('aria-hidden')).toBe('false')
    expect(darkPanel.getAttribute('aria-hidden')).toBe('true')

    window.dispatchEvent(new Event('scroll'))
    act(() => frameCallback?.(80))
    expect(semanticStateSetCalls).toHaveLength(2)
  })

  it('commits a normal-motion theme change before paint without rebuilding lifecycle or filter', () => {
    const { container, rerender } = render(<WrightHero theme="dark" reducedMotion={false} />)
    const track = container.querySelector('.wright-film-track') as HTMLElement
    const filter = container.querySelector('filter')
    const lightPanel = container.querySelector('[data-copy-theme="light"]') as HTMLElement
    const darkPanel = container.querySelector('[data-copy-theme="dark"]') as HTMLElement

    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      top: -1440,
      height: 2400,
      bottom: 960,
      left: 0,
      right: 1280,
      width: 1280,
      x: 0,
      y: -1440,
      toJSON: () => ({}),
    })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })

    act(() => intersectionCallback?.([
      { isIntersecting: true, target: track } as ObserverEntry as IntersectionObserverEntry,
    ], {} as IntersectionObserver))
    act(() => frameCallback?.(0))
    expect(darkPanel.getAttribute('aria-hidden')).toBe('false')

    vi.mocked(window.requestAnimationFrame).mockClear()
    rerender(<WrightHero theme="light" reducedMotion={false} />)

    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
    expect(track.style.getPropertyValue('--wright-light-opacity')).toBe('1')
    expect(track.style.getPropertyValue('--wright-dark-opacity')).toBe('0')
    expect(lightPanel.getAttribute('aria-hidden')).toBe('false')
    expect(darkPanel.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('filter')).toBe(filter)
    expect(observerConstructionCount).toBe(1)
    expect(disconnect).not.toHaveBeenCalled()
  })

  it('commits the restored late-scroll normal-motion snapshot before passive effects', () => {
    const snapshots: NormalMotionCommitSnapshot[] = []
    const captureLayout = (snapshot: NormalMotionCommitSnapshot) => snapshots.push(snapshot)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: -1440,
      height: 2400,
      bottom: 960,
      left: 0,
      right: 1280,
      width: 1280,
      x: 0,
      y: -1440,
      toJSON: () => ({}),
    })
    vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(10)
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })

    const { container, rerender } = render(
      <NormalMotionCommitProbe theme="dark" onLayout={captureLayout} />,
    )

    const filter = container.querySelector('filter')
    const darkSnapshot = snapshots.at(-1) as NormalMotionCommitSnapshot
    expect(Number(darkSnapshot.filmProgress)).toBeCloseTo(0.9)
    expect(Number(darkSnapshot.themeFade)).toBeCloseTo(0.5)
    expect(darkSnapshot.lightOpacity).toBe('0')
    expect(darkSnapshot.darkOpacity).toBe('1')
    expect(Number(darkSnapshot.turbulenceFrequency)).toBeCloseTo(0.035714127106028976)
    expect(Number(darkSnapshot.displacementScale)).toBeCloseTo(64.16763805160782)
    expect(darkSnapshot.desaturation).toBe('0')
    expect(darkSnapshot.contrast).toBe('1')
    expect(darkSnapshot.fractureSlope).toBe('0')
    expect(darkSnapshot.fractureIntercept).toBe('1')
    expect(darkSnapshot.charredOpacity).toBe('0')
    expect(darkSnapshot.ashOpacity).toBe('0')
    expect(darkSnapshot.lightHidden).toBe('true')
    expect(darkSnapshot.darkHidden).toBe('false')
    expect(darkSnapshot.videoTime).toBeCloseTo(9)
    expect(darkSnapshot.filter).toBe(filter)

    vi.mocked(window.requestAnimationFrame).mockClear()
    rerender(<NormalMotionCommitProbe theme="light" onLayout={captureLayout} />)

    const lightSnapshot = snapshots.at(-1) as NormalMotionCommitSnapshot
    expect(Number(lightSnapshot.filmProgress)).toBeCloseTo(0.9)
    expect(Number(lightSnapshot.themeFade)).toBeCloseTo(0.5)
    expect(lightSnapshot.lightOpacity).toBe('1')
    expect(lightSnapshot.darkOpacity).toBe('0')
    expect(lightSnapshot.turbulenceFrequency).toBe('0')
    expect(lightSnapshot.displacementScale).toBe('0')
    expect(lightSnapshot.desaturation).toBe('0')
    expect(lightSnapshot.contrast).toBe('1')
    expect(lightSnapshot.fractureSlope).toBe('0')
    expect(lightSnapshot.fractureIntercept).toBe('1')
    expect(lightSnapshot.charredOpacity).toBe('0')
    expect(lightSnapshot.ashOpacity).toBe('0')
    expect(lightSnapshot.lightHidden).toBe('false')
    expect(lightSnapshot.darkHidden).toBe('true')
    expect(lightSnapshot.videoTime).toBeCloseTo(9)
    expect(lightSnapshot.filter).toBe(filter)
    expect(observerConstructionCount).toBe(1)
    expect(disconnect).not.toHaveBeenCalled()
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
  })

  it('commits reduced-motion visual and semantic identity before passive effects', () => {
    const snapshots: ReducedMotionCommitSnapshot[] = []
    const captureLayout = (snapshot: ReducedMotionCommitSnapshot) => snapshots.push(snapshot)
    const { container, rerender } = render(
      <ReducedMotionCommitProbe theme="dark" onLayout={captureLayout} />,
    )
    const track = container.querySelector('.wright-film-track')
    const filter = container.querySelector('filter')

    expect(snapshots).toEqual([{
      themeFade: '1',
      lightOpacity: '0',
      darkOpacity: '1',
      turbulenceFrequency: '0',
      displacementScale: '0',
      desaturation: '0',
      contrast: '1',
      fractureSlope: '0',
      fractureIntercept: '1',
      charredOpacity: '0',
      ashOpacity: '0',
      lightHidden: 'true',
      darkHidden: 'false',
    }])

    rerender(<ReducedMotionCommitProbe theme="light" onLayout={captureLayout} />)

    expect(container.querySelector('.wright-film-track')).toBe(track)
    expect(container.querySelector('filter')).toBe(filter)
    expect(snapshots.at(-1)).toEqual({
      themeFade: '0',
      lightOpacity: '1',
      darkOpacity: '0',
      turbulenceFrequency: '0',
      displacementScale: '0',
      desaturation: '0',
      contrast: '1',
      fractureSlope: '0',
      fractureIntercept: '1',
      charredOpacity: '0',
      ashOpacity: '0',
      lightHidden: 'false',
      darkHidden: 'true',
    })
    expect(intersectionCallback).toBeUndefined()
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
  })

  it('uses one stable representative frame and no scrolling lifecycle for reduced motion', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const { container, rerender, unmount } = render(<WrightHero theme="dark" reducedMotion />)
    const track = container.querySelector('.wright-film-track') as HTMLElement
    const video = container.querySelector('video') as HTMLVideoElement
    const lightPanel = container.querySelector('[data-copy-theme="light"]') as HTMLElement
    const darkPanel = container.querySelector('[data-copy-theme="dark"]') as HTMLElement
    const filter = container.querySelector('filter')

    Object.defineProperty(video, 'duration', { configurable: true, value: 10 })
    fireEvent.loadedMetadata(video)

    expect(video.currentTime).toBe(5)
    expect(track.style.getPropertyValue('--wright-film-progress')).toBe('0.5')
    expect(track.style.getPropertyValue('--wright-theme-fade')).toBe('1')
    expect(track.style.getPropertyValue('--wright-decay')).toBe('0')
    expect(track.style.getPropertyValue('--wright-light-opacity')).toBe('0')
    expect(track.style.getPropertyValue('--wright-dark-opacity')).toBe('1')
    expect(track.style.getPropertyValue('--wright-drift-x')).toBe('0px')
    expect(track.style.getPropertyValue('--wright-rotation')).toBe('0deg')
    expect(track.style.getPropertyValue('--wright-jitter-x')).toBe('0px')
    expect(track.style.getPropertyValue('--wright-jitter-y')).toBe('0px')
    expect(track.style.getPropertyValue('--wright-panel-blur')).toBe('0px')
    expect(track.style.getPropertyValue('--wright-chromatic-wash')).toBe('0')
    expect(track.style.getPropertyValue('--wright-desaturation')).toBe('0')
    expect(track.style.getPropertyValue('--wright-contrast')).toBe('1')
    expect(container.querySelector('feFuncA')?.getAttribute('slope')).toBe('0')
    expect(container.querySelector('feFuncA')?.getAttribute('intercept')).toBe('1')
    expect(container.querySelector('feFlood[data-ash-edge="charred"]')?.getAttribute('flood-opacity')).toBe('0')
    expect(container.querySelector('feFlood[data-ash-edge="light"]')?.getAttribute('flood-opacity')).toBe('0')
    expect(lightPanel.getAttribute('aria-hidden')).toBe('true')
    expect(darkPanel.getAttribute('aria-hidden')).toBe('false')
    expect(intersectionCallback).toBeUndefined()
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
    expect(addEventListener.mock.calls.some(([type]) => type === 'scroll' || type === 'resize')).toBe(false)

    rerender(<WrightHero theme="light" reducedMotion />)
    expect(container.querySelector('filter')).toBe(filter)
    expect(lightPanel.getAttribute('aria-hidden')).toBe('false')
    expect(darkPanel.getAttribute('aria-hidden')).toBe('true')
    expect(track.style.getPropertyValue('--wright-theme-fade')).toBe('0')
    expect(track.style.getPropertyValue('--wright-light-opacity')).toBe('1')
    expect(track.style.getPropertyValue('--wright-dark-opacity')).toBe('0')

    unmount()
  })
})

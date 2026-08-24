import React from 'react'
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingPage } from '../../src/landing/LandingPage'
import { lineFieldConfig } from '../../src/landing/line-field/config/line-field-config.generated'
import type { LineFieldRenderFrame } from '../../src/landing/line-field/motion/line-field-state-machine'
import { evaluateMottoOrbit } from '../../src/landing/line-field/motion/motto-orbit'
import type { LandingLineRenderer } from '../../src/landing/line-field/renderer/line-field-renderer.types'

interface PageRendererRecord {
  readonly canvas: HTMLCanvasElement
  readonly resize: ReturnType<typeof vi.fn<LandingLineRenderer['resize']>>
  readonly render: ReturnType<typeof vi.fn<LandingLineRenderer['render']>>
  readonly dispose: ReturnType<typeof vi.fn<LandingLineRenderer['dispose']>>
}

const landingLineRendererDouble = vi.hoisted(() => ({
  create: vi.fn(),
  records: [] as PageRendererRecord[],
}))

const landingBackgroundRendererDouble = vi.hoisted(() => ({
  create: vi.fn(),
}))

vi.mock('../../src/landing/line-field/renderer/LandingLineRenderer', () => ({
  createLandingLineRenderer: landingLineRendererDouble.create,
}))

vi.mock('../../src/landing/background/renderer/LandingBackgroundRenderer', () => ({
  createLandingBackgroundRenderer: landingBackgroundRendererDouble.create,
}))

const CHAPTER_IDS = ['haltung', 'module', 'thermodynamik', 'rechenweg', 'projekt'] as const
const CHAPTER_NAVIGATION = ['01Haltung', '02Module', '03Thermodynamik', '04Rechenweg', '05Projekt']
function mockMatchMedia(preferences: Record<string, boolean>) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: preferences[query] ?? false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

describe('complete landing page', () => {
  const originalMatchMedia = window.matchMedia
  const originalIntersectionObserver = window.IntersectionObserver
  const originalRequestAnimationFrame = window.requestAnimationFrame
  const originalCancelAnimationFrame = window.cancelAnimationFrame
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect
  const originalWindowDescriptors = {
    devicePixelRatio: Object.getOwnPropertyDescriptor(window, 'devicePixelRatio'),
    innerHeight: Object.getOwnPropertyDescriptor(window, 'innerHeight'),
    innerWidth: Object.getOwnPropertyDescriptor(window, 'innerWidth'),
    scrollY: Object.getOwnPropertyDescriptor(window, 'scrollY'),
  }
  const originalDocumentScrollHeight = Object.getOwnPropertyDescriptor(
    document.documentElement,
    'scrollHeight',
  )
  const originalBodyScrollHeight = Object.getOwnPropertyDescriptor(document.body, 'scrollHeight')

  const restoreDescriptor = (
    target: object,
    property: PropertyKey,
    descriptor: PropertyDescriptor | undefined,
  ) => {
    if (descriptor) Object.defineProperty(target, property, descriptor)
    else Reflect.deleteProperty(target, property)
  }

  beforeEach(() => {
    window.IntersectionObserver = undefined as unknown as typeof IntersectionObserver
    landingLineRendererDouble.records.length = 0
    landingLineRendererDouble.create.mockReset()
    landingLineRendererDouble.create.mockImplementation((host: HTMLElement) => {
      const canvas = document.createElement('canvas')
      host.append(canvas)
      const resize = vi.fn<LandingLineRenderer['resize']>()
      const renderFrame = vi.fn<LandingLineRenderer['render']>()
      const dispose = vi.fn<LandingLineRenderer['dispose']>(() => canvas.remove())
      landingLineRendererDouble.records.push({
        canvas,
        resize,
        render: renderFrame,
        dispose,
      })
      return { resize, render: renderFrame, dispose }
    })
    landingBackgroundRendererDouble.create.mockReset()
    landingBackgroundRendererDouble.create.mockImplementation((host: HTMLElement) => {
      const canvas = document.createElement('canvas')
      canvas.dataset.backgroundCanvas = 'dark-particles'
      host.append(canvas)
      return {
        resize: vi.fn(),
        render: vi.fn(),
        dispose: vi.fn(() => canvas.remove()),
      }
    })
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    window.IntersectionObserver = originalIntersectionObserver
    window.requestAnimationFrame = originalRequestAnimationFrame
    window.cancelAnimationFrame = originalCancelAnimationFrame
    restoreDescriptor(window, 'innerWidth', originalWindowDescriptors.innerWidth)
    restoreDescriptor(window, 'innerHeight', originalWindowDescriptors.innerHeight)
    restoreDescriptor(window, 'devicePixelRatio', originalWindowDescriptors.devicePixelRatio)
    restoreDescriptor(window, 'scrollY', originalWindowDescriptors.scrollY)
    restoreDescriptor(document.documentElement, 'scrollHeight', originalDocumentScrollHeight)
    restoreDescriptor(document.body, 'scrollHeight', originalBodyScrollHeight)
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect
    vi.restoreAllMocks()
  })

  it('drives the normal renderer from all six composed LandingPage measurement refs', async () => {
    const instances: Array<{
      callback: IntersectionObserverCallback
      observer: IntersectionObserver
      observe: ReturnType<typeof vi.fn>
      targets: Set<Element>
    }> = []

    class PageIntersectionObserver {
      readonly root = null
      readonly rootMargin = '0px'
      readonly thresholds = [0]
      readonly targets = new Set<Element>()
      readonly observe = vi.fn((target: Element) => this.targets.add(target))
      readonly unobserve = vi.fn((target: Element) => this.targets.delete(target))
      readonly disconnect = vi.fn(() => this.targets.clear())
      readonly takeRecords = vi.fn((): IntersectionObserverEntry[] => [])

      constructor(readonly callback: IntersectionObserverCallback) {
        instances.push({
          callback,
          observer: this as unknown as IntersectionObserver,
          observe: this.observe,
          targets: this.targets,
        })
      }
    }

    const animationFrames = new Map<number, FrameRequestCallback>()
    let nextAnimationFrameId = 1
    const currentScrollY = 100 + (2700 - 900) * lineFieldConfig.reveal.preloadFilmProgress
    const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
      x: left,
      y: top,
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      toJSON: () => ({}),
    } as DOMRect)

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 })
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      get: () => currentScrollY,
    })
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 7200,
    })
    Object.defineProperty(document.body, 'scrollHeight', {
      configurable: true,
      value: 7000,
    })
    Element.prototype.getBoundingClientRect = vi.fn(function measuredLandingRect(this: Element) {
      if (this.matches('.landing-shell__content')) return rect(0, -currentScrollY, 1440, 7200)
      if (this.matches('.landing-shell__header')) return rect(0, 0, 1440, 80)
      if (this.matches('.wright-film-track')) return rect(0, 100 - currentScrollY, 1440, 2700)
      if (this.matches('.wright-hero-media')) return rect(600, 220, 240, 180)
      if (this.matches('.wright-motto-panel')) return rect(0, 2800 - currentScrollY, 1440, 900)
      if (this.matches('.wright-motto-panel__slot')) {
        return rect(835, 3220 - currentScrollY, 490, 220)
      }
      return originalGetBoundingClientRect.call(this)
    })
    window.IntersectionObserver = PageIntersectionObserver as unknown as typeof IntersectionObserver
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = nextAnimationFrameId
      nextAnimationFrameId += 1
      animationFrames.set(id, callback)
      return id
    })
    window.cancelAnimationFrame = vi.fn((id: number) => animationFrames.delete(id))
    mockMatchMedia({ '(prefers-color-scheme: dark)': true })
    const { container } = render(<LandingPage onOpenCalculator={vi.fn()} />)
    const content = container.querySelector('.landing-shell__content') as HTMLDivElement
    const fieldRoot = container.querySelector('.landing-line-field') as HTMLDivElement
    const fieldObserver = instances.find(instance => instance.targets.has(content))

    expect(fieldObserver).toBeDefined()
    expect(fieldObserver?.observe).toHaveBeenCalledWith(content)
    expect(fieldRoot).toHaveAttribute('data-line-field-status', 'dormant')
    expect(fieldRoot).toHaveAttribute('data-line-field-mode', 'dormant')

    act(() => {
      fieldObserver?.callback([
        { target: content, isIntersecting: true } as IntersectionObserverEntry,
      ], fieldObserver.observer)
    })
    expect(animationFrames).toHaveLength(1)

    const flushQueuedFrames = async (nowMs: number) => {
      const queued = [...animationFrames.values()]
      if (queued.length === 0) throw new Error('Expected a queued landing frame')
      animationFrames.clear()
      await act(async () => {
        queued.forEach(callback => callback(nowMs))
        await Promise.resolve()
      })
    }
    await flushQueuedFrames(16)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(landingLineRendererDouble.create).toHaveBeenCalledTimes(1)
    // The line field and the independent Dark background each own one loop.
    expect(animationFrames).toHaveLength(2)
    await flushQueuedFrames(32)

    const renderer = landingLineRendererDouble.records[0]
    const frame = renderer.render.mock.calls[0][0] as LineFieldRenderFrame
    const expectedStageWidth = 1440
    expect(fieldRoot).toHaveAttribute('data-line-field-status', 'ready')
    expect(renderer.render).toHaveBeenCalledTimes(1)
    expect(fieldRoot.style.left).toBe('0px')
    expect(fieldRoot.style.width).toBe(`${expectedStageWidth}px`)
    expect(fieldRoot.style.height).toBe('900px')
    expect(renderer.resize).toHaveBeenCalledWith(
      expectedStageWidth,
      900,
      2,
      lineFieldConfig.performance,
    )
    expect(frame.anchorViewport).toEqual([720, 310])
    expect(frame.headerTargetViewportY).toBe(80 + lineFieldConfig.geometry.headerGapPx)
    expect(frame.filmProgress).toBeCloseTo(lineFieldConfig.reveal.preloadFilmProgress, 10)
    expect(frame.originDocumentY).toBe(currentScrollY + 310)
    const expectedMotto = evaluateMottoOrbit(
      frame.mottoProgress,
      {
        scrollY: currentScrollY,
        viewportWidth: 1440,
        viewportHeight: 900,
        pageHeight: 7200,
        filmTop: 100,
        filmHeight: 2700,
        anchorViewport: [720, 310],
        headerTargetViewportY: 80 + lineFieldConfig.geometry.headerGapPx,
        mottoTop: 2800,
        mottoHeight: 900,
        mottoCardFinalCenterX: 1080,
        mottoCardFinalWidth: 490,
        mottoCardFinalHeight: 220,
        mottoCardFinalTop: 3220,
        mottoCardFinalBottom: 3440,
      },
      lineFieldConfig.motto,
    )
    const mottoPanel = container.querySelector('.wright-motto-panel') as HTMLElement
    expect(mottoPanel.style.getPropertyValue('--motto-orbit-x')).toBe(`${expectedMotto.translateXPx}px`)
    expect(mottoPanel.style.getPropertyValue('--motto-orbit-y')).toBe(`${expectedMotto.translateYPx}px`)
    expect(mottoPanel.style.getPropertyValue('--motto-orbit-z')).toBe('')
    expect(mottoPanel.style.getPropertyValue('--motto-scale')).toBe(`${expectedMotto.scale}`)
    expect(mottoPanel.style.getPropertyValue('--motto-blur')).toBe(`${expectedMotto.blurPx}px`)
    expect(mottoPanel.style.getPropertyValue('--motto-opacity')).toBe(`${expectedMotto.opacity}`)
    expect(fieldRoot.querySelectorAll('canvas')).toHaveLength(1)
    expect(fieldRoot.querySelector('[data-line-field-fallback]')).toBeNull()
  })

  it('composes the truthful five-chapter experience and public controls in order', async () => {
    mockMatchMedia({ '(prefers-color-scheme: dark)': true })
    const onOpenCalculator = vi.fn()
    const { container } = render(<LandingPage onOpenCalculator={onOpenCalculator} />)

    expect(document.title).toBe('Ingenieursrechner · Systeme verstehen')
    const lineField = container.querySelector<HTMLElement>('.landing-line-field') as HTMLElement
    expect(lineField.parentElement).toHaveClass('landing-shell')
    expect(lineField).toHaveAttribute('aria-hidden', 'true')
    expect(lineField).toHaveAttribute('data-line-field-status', 'fallback-unsupported')
    expect(lineField).toHaveAttribute('data-line-field-mode', 'static')
    expect(lineField).not.toHaveAttribute('data-line-field-frame-sequence')
    expect(lineField.querySelector('.landing-line-field__renderer-host')).toBeEmptyDOMElement()
    expect(lineField.querySelectorAll('[data-line-field-fallback]')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Nicht nur rechnen. Systeme verstehen.' })).toBeInTheDocument()
    expect(Array.from(
      container.querySelectorAll<HTMLElement>('.landing-shell__content > section[id]'),
      section => section.id,
    )).toEqual(CHAPTER_IDS)
    const holding = container.querySelector('#haltung') as HTMLElement
    const filmTrack = holding.querySelector('.wright-film-track') as HTMLElement
    expect(filmTrack.nextElementSibling).toBe(screen.getByRole('region', {
      name: 'Die Formel ist nur das Signal. Die Herleitung macht den Zusammenhang sichtbar.',
    }))
    const moduleAtlas = await screen.findByRole(
      'region',
      { name: 'Ein System. Endliche, prüfbare Rechenräume.' },
      { timeout: 5_000 },
    )
    expect(within(moduleAtlas).queryByRole('button', {
      name: /Aktives Fachgebiet.*Thermodynamik/,
    })).not.toBeInTheDocument()
    expect(await screen.findByRole(
      'region',
      { name: 'Thermodynamik-Menü' },
      { timeout: 5_000 },
    )).toBeInTheDocument()
    expect(await screen.findByRole(
      'button',
      { name: /Carnot-Prozess.*Rechner verfügbar/ },
      { timeout: 5_000 },
    )).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thermodynamik erkunden' })).not.toBeInTheDocument()

    expect(await screen.findByText(
      'Neue Rechenräume erscheinen erst, wenn Modell, Solverpfad und Erklärung belastbar sind.',
    )).toBeInTheDocument()
    expect(container).not.toHaveTextContent(/Robotik|SPS|Rankine|Strömungsmechanik|AI-powered calculator/i)
    expect(await screen.findByRole('link', { name: 'Repository ansehen' })).toHaveAttribute(
      'href',
      'https://github.com/haliot9/ingenieursrechner',
    )

    const background = container.querySelector('.landing-background-field') as HTMLElement
    expect(background).toBeInTheDocument()
    expect(background.parentElement).toHaveClass('landing-shell')
    expect(background.compareDocumentPosition(lineField) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    await waitFor(() => expect(background.querySelectorAll('canvas')).toHaveLength(1))
    expect(background.querySelectorAll('[data-background-branch]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-particle]')).toHaveLength(0)

    expect(container.querySelector('.landing-shell__calculator-link')).not.toBeInTheDocument()
    const header = container.querySelector<HTMLElement>('.landing-shell__header') as HTMLElement
    expect(within(header).getAllByRole('button')).toHaveLength(1)
    const headerThemeControl = within(header).getByRole('button', { name: 'Light Mode aktivieren' })
    expect(headerThemeControl).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }))
    const dialog = screen.getByRole('dialog', { name: 'Seitennavigation' })
    expect(Array.from(
      dialog.querySelectorAll('.floating-rail-chapters button'),
      button => button.textContent,
    )).toEqual(CHAPTER_NAVIGATION)
    expect(within(dialog).getByRole('button', { name: 'Light Mode aktivieren' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Rechner öffnen' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })

  })

  it('separates row selection from its detail CTA and retains the choice for global actions', async () => {
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true })
    const onOpenCalculator = vi.fn()
    render(<LandingPage onOpenCalculator={onOpenCalculator} />)
    fireEvent.click(await screen.findByRole('button', {
      name: /Joule-\/Brayton-Prozess.*Rechner verfügbar/,
    }))
    expect(onOpenCalculator).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Im Rechner öffnen' }))

    const coda = await screen.findByRole('region', { name: 'Projektbeleg.' })
    fireEvent.click(within(coda).getByRole('button', { name: 'Ausgewählten Rechner öffnen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rechner öffnen' }))

    expect(onOpenCalculator.mock.calls).toEqual([['joule'], ['joule'], ['joule']])
  })

  it('updates controlled selection on the row and routes only from the inline CTA', async () => {
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true })
    const events: string[] = []
    render(<LandingPage
      selectedModuleId="carnot"
      onSelectedModuleIdChange={moduleId => events.push(`select:${moduleId}`)}
      onOpenCalculator={moduleId => events.push(`open:${moduleId}`)}
    />)

    fireEvent.click(await screen.findByRole('button', {
      name: /Diesel-Prozess.*Rechner verfügbar/,
    }))
    expect(events).toEqual(['select:diesel'])

    fireEvent.click(screen.getByRole('button', { name: 'Im Rechner öffnen' }))

    expect(events).toEqual(['select:diesel', 'open:diesel'])
  })

  it('keeps a static Dark background and removes autonomous enhancement under reduced motion', async () => {
    mockMatchMedia({
      '(prefers-color-scheme: dark)': true,
      '(prefers-reduced-motion: reduce)': true,
    })
    const { container } = render(<LandingPage onOpenCalculator={vi.fn()} />)

    const background = container.querySelector('.landing-background-field') as HTMLElement
    expect(background).toHaveAttribute('data-background-motion', 'static')
    await waitFor(() => expect(background.querySelectorAll('canvas')).toHaveLength(1))
    expect(container.querySelectorAll('[data-particle]')).toHaveLength(0)
    const lineField = container.querySelector<HTMLElement>('.landing-line-field') as HTMLElement
    expect(lineField).toHaveAttribute('data-line-field-status', 'fallback-reduced-motion')
    expect(lineField).toHaveAttribute('data-line-field-mode', 'static')
    expect(lineField).not.toHaveAttribute('data-line-field-frame-sequence')
    expect(lineField.querySelectorAll('[data-line-field-fallback]')).toHaveLength(1)
    expect(Array.from(
      container.querySelectorAll<HTMLElement>('.landing-shell__content > section[id]'),
      section => section.id,
    )).toEqual(CHAPTER_IDS)
    expect(screen.getByRole('heading', {
      name: 'Aus Größen werden Spuren. Aus Spuren wird Verständnis.',
    })).toBeInTheDocument()
    const mottoPanel = screen.getByRole('region', {
      name: 'Die Formel ist nur das Signal. Die Herleitung macht den Zusammenhang sichtbar.',
    })
    expect(mottoPanel).toHaveAttribute('data-motto-motion', 'static')
    expect(mottoPanel.closest('section')).toHaveAttribute('id', 'haltung')
    expect(await screen.findByRole('region', { name: 'Vom Modell zur Wärmezufuhr.' }, { timeout: 5_000 })).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Projektbeleg.' }, { timeout: 5_000 })).toBeInTheDocument()
  })
})

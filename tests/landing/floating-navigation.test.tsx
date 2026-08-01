import React, { useCallback, useState } from 'react'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingPage } from '../../src/landing/LandingPage'
import { FloatingNavigation, type LandingNavigationSection } from '../../src/landing/components/FloatingNavigation'
import { LiquidSurface, supportsLiquidDistortion } from '../../src/landing/components/LiquidSurface'

const sections: LandingNavigationSection[] = [
  { id: 'haltung', label: 'Haltung' },
  { id: 'module', label: 'Module' },
  { id: 'thermodynamik', label: 'Thermodynamik' },
  { id: 'rechenweg', label: 'Rechenweg' },
  { id: 'projekt', label: 'Projekt' },
]

function mockMatchMedia(preferences: Record<string, boolean>) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: preferences[query] ?? false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

function InertBackgroundHarness({ showNavigation = true }: { showNavigation?: boolean }) {
  const [navigationOpen, setNavigationOpen] = useState(false)

  return <>
    {showNavigation && <FloatingNavigation
      sections={sections}
      theme="light"
      onOpenChange={setNavigationOpen}
      onToggleTheme={vi.fn()}
      onOpenCalculator={vi.fn()}
    />}
    <div data-testid="background" inert={navigationOpen || undefined}>Seiteninhalt</div>
  </>
}

function RecreatedCallbackHarness({ revision }: { revision: number }) {
  const [navigationOpen, setNavigationOpen] = useState(false)
  const reportNavigationOpen = useCallback((nextOpen: boolean) => {
    void revision
    setNavigationOpen(nextOpen)
  }, [revision])

  return <>
    <FloatingNavigation
      sections={sections}
      theme="light"
      onOpenChange={reportNavigationOpen}
      onToggleTheme={vi.fn()}
      onOpenCalculator={vi.fn()}
    />
    <div data-testid="changing-background" inert={navigationOpen || undefined}>Seiteninhalt</div>
  </>
}

describe('FloatingNavigation', () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    mockMatchMedia({})
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('opens as a dialog, moves focus inside, and restores focus after Escape', () => {
    render(
      <FloatingNavigation
        sections={sections}
        theme="light"
        onToggleTheme={vi.fn()}
        onOpenCalculator={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Navigation öffnen' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Seitennavigation' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(within(dialog).getByRole('heading', { name: 'Seitennavigation' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })

  it('contains forward and reverse Tab navigation inside the dialog', () => {
    render(
      <FloatingNavigation
        sections={sections}
        theme="light"
        onToggleTheme={vi.fn()}
        onOpenCalculator={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }))
    const dialog = screen.getByRole('dialog')
    const heading = within(dialog).getByRole('heading', { name: 'Seitennavigation' })
    const close = within(dialog).getByRole('button', { name: 'Navigation schließen' })
    const calculator = within(dialog).getByRole('button', { name: 'Rechner öffnen' })

    expect(screen.getAllByRole('button', { name: 'Navigation schließen' })).toHaveLength(1)

    calculator.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(close).toHaveFocus()

    heading.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(calculator).toHaveFocus()
  })

  it('makes landing content inert while open and restores it after close', () => {
    render(<LandingPage onOpenCalculator={vi.fn()} />)
    const content = document.querySelector<HTMLElement>('.landing-shell__content')

    expect(content).not.toBeNull()
    expect(content).not.toHaveAttribute('inert')

    fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }))
    expect(content).toHaveAttribute('inert')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(content).not.toHaveAttribute('inert')
  })

  it('restores a background element inert state when an open rail unmounts', () => {
    const { rerender } = render(<InertBackgroundHarness />)
    const background = screen.getByTestId('background')

    fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }))
    expect(background).toHaveAttribute('inert')

    rerender(<InertBackgroundHarness showNavigation={false} />)
    expect(background).not.toHaveAttribute('inert')
  })

  it('keeps the background inert when an open rail receives a recreated callback', () => {
    const { rerender } = render(<RecreatedCallbackHarness revision={1} />)
    const background = screen.getByTestId('changing-background')

    fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(background).toHaveAttribute('inert')

    rerender(<RecreatedCallbackHarness revision={2} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(background).toHaveAttribute('inert')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(background).not.toHaveAttribute('inert')
  })

  it('scrolls to an available chapter and closes the dialog', () => {
    const target = document.createElement('section')
    target.id = 'thermodynamik'
    target.scrollIntoView = vi.fn()
    document.body.append(target)

    render(
      <FloatingNavigation
        sections={sections}
        theme="dark"
        onToggleTheme={vi.fn()}
        onOpenCalculator={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Navigation öffnen' })
    fireEvent.click(trigger)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Thermodynamik' }))

    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes safely when a later chapter is not mounted yet', () => {
    render(
      <FloatingNavigation
        sections={sections}
        theme="light"
        onToggleTheme={vi.fn()}
        onOpenCalculator={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Navigation öffnen' })
    fireEvent.click(trigger)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Projekt' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('delegates theme and calculator actions without owning module state', () => {
    const onToggleTheme = vi.fn()
    const onOpenCalculator = vi.fn()
    render(
      <FloatingNavigation
        sections={sections}
        theme="dark"
        onToggleTheme={onToggleTheme}
        onOpenCalculator={onOpenCalculator}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Darstellung wechseln' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rechner öffnen' }))

    expect(onToggleTheme).toHaveBeenCalledOnce()
    expect(onOpenCalculator).toHaveBeenCalledOnce()
    expect(onOpenCalculator).toHaveBeenCalledWith()
  })

  it('removes its Escape listener when the open rail unmounts', () => {
    const addEventListener = vi.spyOn(document, 'addEventListener')
    const removeEventListener = vi.spyOn(document, 'removeEventListener')
    const { unmount } = render(
      <FloatingNavigation
        sections={sections}
        theme="light"
        onToggleTheme={vi.fn()}
        onOpenCalculator={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }))
    const keydownRegistration = addEventListener.mock.calls.find(([type]) => type === 'keydown')
    expect(keydownRegistration).toBeDefined()

    unmount()

    expect(removeEventListener).toHaveBeenCalledWith('keydown', keydownRegistration?.[1])
  })

  it('lets LandingPage own the current module selected by the zero-argument rail action', () => {
    const onOpenCalculator = vi.fn()
    render(<LandingPage onOpenCalculator={onOpenCalculator} />)

    fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rechner öffnen' }))

    expect(onOpenCalculator).toHaveBeenCalledWith('carnot')
  })
})

describe('liquid surface support', () => {
  const originalMatchMedia = window.matchMedia
  const originalUserAgent = window.navigator.userAgent

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: originalUserAgent })
    vi.restoreAllMocks()
  })

  it('uses distortion only for fine-pointer Chromium without reduced motion', () => {
    expect(supportsLiquidDistortion('Chrome/140.0.0.0', false, false)).toBe(true)
    expect(supportsLiquidDistortion('Firefox/141.0', false, false)).toBe(false)
    expect(supportsLiquidDistortion('Version/18.5 Safari/605.1.15', false, false)).toBe(false)
    expect(supportsLiquidDistortion('Chrome/140.0.0.0', true, false)).toBe(false)
    expect(supportsLiquidDistortion('Chrome/140.0.0.0', false, true)).toBe(false)
  })

  it('keeps content outside unique distortion filters', () => {
    mockMatchMedia({
      '(prefers-reduced-motion: reduce)': false,
      '(pointer: coarse)': false,
    })
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: 'Chrome/140.0.0.0' })

    const { container } = render(
      <>
        <LiquidSurface><button type="button">Erste Aktion</button></LiquidSurface>
        <LiquidSurface><button type="button">Zweite Aktion</button></LiquidSurface>
      </>,
    )

    const surfaces = container.querySelectorAll('.liquid-surface')
    const filters = container.querySelectorAll('filter')
    expect(surfaces).toHaveLength(2)
    expect(filters).toHaveLength(2)
    expect(filters[0].id).not.toBe(filters[1].id)
    expect(surfaces[0]).toHaveAttribute('data-liquid-mode', 'distortion')
    expect(surfaces[0].querySelector('.liquid-surface-content')).toContainElement(
      screen.getByRole('button', { name: 'Erste Aktion' }),
    )
    expect(surfaces[0].querySelector('.liquid-surface-refraction')).not.toContainElement(
      screen.getByRole('button', { name: 'Erste Aktion' }),
    )
  })

  it('renders the same readable content in the deliberate frosted fallback', () => {
    mockMatchMedia({
      '(prefers-reduced-motion: reduce)': true,
      '(pointer: coarse)': false,
    })
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: 'Chrome/140.0.0.0' })

    const { container } = render(<LiquidSurface><span>Lesbarer Inhalt</span></LiquidSurface>)

    expect(container.querySelector('.liquid-surface')).toHaveAttribute('data-liquid-mode', 'frosted')
    expect(container.querySelector('filter')).not.toBeInTheDocument()
    expect(container.querySelector('.liquid-surface-content')).toHaveTextContent('Lesbarer Inhalt')
  })

  it('updates bounded pointer coordinates and offsets only on a distortion surface', () => {
    mockMatchMedia({
      '(prefers-reduced-motion: reduce)': false,
      '(pointer: coarse)': false,
    })
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: 'Chrome/140.0.0.0' })
    const { container } = render(<LiquidSurface><span>Inhalt</span></LiquidSurface>)
    const surface = container.querySelector<HTMLElement>('.liquid-surface')!
    surface.getBoundingClientRect = vi.fn(() => ({
      x: 10,
      y: 20,
      left: 10,
      top: 20,
      right: 210,
      bottom: 120,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    }))

    fireEvent.pointerMove(surface, { clientX: 60, clientY: 45 })

    expect(surface.style.getPropertyValue('--liquid-pointer-x')).toBe('25%')
    expect(surface.style.getPropertyValue('--liquid-pointer-y')).toBe('25%')
    expect(surface.style.getPropertyValue('--liquid-shift-x')).toBe('-2px')
    expect(surface.style.getPropertyValue('--liquid-shift-y')).toBe('-2px')

    fireEvent.pointerLeave(surface)
    expect(surface.style.getPropertyValue('--liquid-shift-x')).toBe('0px')
    expect(surface.style.getPropertyValue('--liquid-shift-y')).toBe('0px')
  })
})

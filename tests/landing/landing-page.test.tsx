import React from 'react'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingPage } from '../../src/landing/LandingPage'
import { ParticleField } from '../../src/landing/components/ParticleField'

const CHAPTER_IDS = ['haltung', 'module', 'thermodynamik', 'rechenweg', 'projekt']
const MODULE_NAMES = [
  'Carnot-Prozess',
  'Otto-Prozess',
  'Diesel-Prozess',
  'Joule-/Brayton-Prozess',
]

function mockMatchMedia(preferences: Record<string, boolean>) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: preferences[query] ?? false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

function advanceExplorerToCycles() {
  fireEvent.click(screen.getByRole('button', { name: 'Thermodynamik erkunden' }))
  fireEvent.click(screen.getByRole('button', { name: 'Kreisprozesse erkunden' }))
}

describe('complete landing page', () => {
  const originalMatchMedia = window.matchMedia
  const originalIntersectionObserver = window.IntersectionObserver

  beforeEach(() => {
    window.IntersectionObserver = undefined as unknown as typeof IntersectionObserver
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    window.IntersectionObserver = originalIntersectionObserver
    vi.restoreAllMocks()
  })

  it('composes the truthful five-chapter experience and public controls in order', () => {
    mockMatchMedia({ '(prefers-color-scheme: dark)': true })
    const random = vi.spyOn(Math, 'random')
    const onOpenCalculator = vi.fn()
    const { container } = render(<LandingPage onOpenCalculator={onOpenCalculator} />)

    expect(document.title).toBe('Ingenieursrechner · Systeme verstehen')
    expect(screen.getByRole('heading', { name: 'Nicht nur rechnen. Systeme verstehen.' })).toBeInTheDocument()
    expect(Array.from(
      container.querySelectorAll<HTMLElement>('.landing-shell__content > section[id]'),
      section => section.id,
    )).toEqual(CHAPTER_IDS)
    for (const moduleName of MODULE_NAMES) {
      expect(screen.getByText(new RegExp(moduleName.replace('/', '\\/')))).toBeInTheDocument()
    }

    expect(screen.getByText(
      'Neue Rechenräume erscheinen erst, wenn Modell, Solverpfad und Erklärung belastbar sind.',
    )).toBeInTheDocument()
    expect(container).not.toHaveTextContent(/Robotik|SPS|Rankine|Strömungsmechanik|AI-powered calculator/i)
    expect(screen.getByRole('link', { name: 'Repository ansehen' })).toHaveAttribute(
      'href',
      'https://github.com/haliot9/ingenieursrechner',
    )

    expect(container.querySelectorAll('[data-particle]')).toHaveLength(24)
    expect(random).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }))
    const dialog = screen.getByRole('dialog', { name: 'Seitennavigation' })
    expect(within(dialog).getByRole('button', { name: 'Darstellung wechseln' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })

    const thermodynamics = document.getElementById('thermodynamik') as HTMLElement
    thermodynamics.scrollIntoView = vi.fn()
    fireEvent.click(screen.getByRole('button', { name: /Aktives Fachgebiet.*Thermodynamik/ }))
    expect(thermodynamics.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('routes explorer selection through the Joule proof, coda, and floating rail closures', () => {
    mockMatchMedia({})
    const onOpenCalculator = vi.fn()
    render(<LandingPage onOpenCalculator={onOpenCalculator} />)
    advanceExplorerToCycles()
    fireEvent.click(screen.getByRole('button', { name: 'Joule-/Brayton-Prozess' }))

    const proof = screen.getByRole('region', { name: 'Vom Modell zur Wärmezufuhr.' })
    fireEvent.click(within(proof).getByRole('button', { name: 'Joule-Rechner öffnen' }))
    const coda = screen.getByRole('region', { name: 'Projektbeleg.' })
    fireEvent.click(within(coda).getByRole('button', { name: 'Ausgewählten Rechner öffnen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rechner öffnen' }))

    expect(onOpenCalculator.mock.calls).toEqual([['joule'], ['joule'], ['joule']])
  })

  it('removes particles and magnetic enhancement under reduced motion without removing content', () => {
    mockMatchMedia({
      '(prefers-color-scheme: dark)': true,
      '(prefers-reduced-motion: reduce)': true,
    })
    const { container } = render(<LandingPage onOpenCalculator={vi.fn()} />)

    expect(container.querySelector('.particle-field')).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-particle]')).toHaveLength(0)
    expect(Array.from(
      container.querySelectorAll<HTMLElement>('.landing-shell__content > section[id]'),
      section => section.id,
    )).toEqual(CHAPTER_IDS)
    expect(screen.getByRole('heading', { name: 'Nicht nur rechnen. Systeme verstehen.' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Vom Modell zur Wärmezufuhr.' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Projektbeleg.' })).toBeInTheDocument()
  })
})

describe('ParticleField', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders the same fixed 24-depth field without random generation', () => {
    const random = vi.spyOn(Math, 'random')
    const firstRender = render(<ParticleField enabled />)
    const firstLayout = Array.from(
      firstRender.container.querySelectorAll<HTMLElement>('[data-particle]'),
      particle => particle.style.cssText,
    )
    firstRender.unmount()

    const secondRender = render(<ParticleField enabled />)
    const secondLayout = Array.from(
      secondRender.container.querySelectorAll<HTMLElement>('[data-particle]'),
      particle => particle.style.cssText,
    )

    expect(firstLayout).toHaveLength(24)
    expect(secondLayout).toEqual(firstLayout)
    expect(random).not.toHaveBeenCalled()
    expect(secondRender.container.querySelectorAll('[style*="--particle-shift-x"]')).toHaveLength(1)
  })

  it('bounds pointer parallax and pauses it when the pointer leaves the viewport', () => {
    const { container, unmount } = render(<ParticleField enabled />)
    const field = container.querySelector<HTMLElement>('.particle-field') as HTMLElement

    fireEvent.pointerMove(window, { clientX: window.innerWidth, clientY: 0 })
    expect(field.style.getPropertyValue('--particle-shift-x')).toBe('8px')
    expect(field.style.getPropertyValue('--particle-shift-y')).toBe('-6px')

    fireEvent.pointerMove(window, { clientX: window.innerWidth + 40, clientY: -40 })
    expect(field.style.getPropertyValue('--particle-shift-x')).toBe('8px')
    expect(field.style.getPropertyValue('--particle-shift-y')).toBe('-6px')

    fireEvent.pointerOut(window, { relatedTarget: null })
    expect(field.style.getPropertyValue('--particle-shift-x')).toBe('0px')
    expect(field.style.getPropertyValue('--particle-shift-y')).toBe('0px')

    unmount()
    fireEvent.pointerMove(window, { clientX: 0, clientY: window.innerHeight })
    expect(field.style.getPropertyValue('--particle-shift-x')).toBe('0px')
  })

  it('renders nothing when the composing page disables it', () => {
    const { container } = render(<ParticleField enabled={false} />)
    expect(container).toBeEmptyDOMElement()
  })
})

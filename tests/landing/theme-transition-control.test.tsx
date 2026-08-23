import React, { useState } from 'react'
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LandingPage } from '../../src/landing/LandingPage'
import { ThemeTransitionControl } from '../../src/landing/components/ThemeTransitionControl'

function ThemeHarness({ onToggleTheme }: { onToggleTheme: () => void }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  return <ThemeTransitionControl
    theme={theme}
    reducedMotion={false}
    variant="header"
    onToggleTheme={() => {
      onToggleTheme()
      setTheme(current => current === 'light' ? 'dark' : 'light')
    }}
  />
}

function installControllableReducedMotion() {
  let reducedMotion = false
  const listeners = new Set<() => void>()

  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    if (query !== '(prefers-reduced-motion: reduce)') {
      return {
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }
    }

    return {
      get matches() {
        return reducedMotion
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    }
  })

  return {
    reduceMotion() {
      reducedMotion = true
      listeners.forEach(listener => listener())
    },
  }
}

const originalMatchMedia = window.matchMedia

afterEach(() => {
  window.matchMedia = originalMatchMedia
  vi.restoreAllMocks()
})

describe('ThemeTransitionControl', () => {
  it('uses the destination label and icon for each theme', () => {
    const { rerender } = render(
      <ThemeTransitionControl theme="light" reducedMotion={false} variant="header" onToggleTheme={vi.fn()} />,
    )

    const lightControl = screen.getByRole('button', { name: 'Dark Mode aktivieren' })
    expect(lightControl).toHaveTextContent('Dark Mode')
    expect(lightControl).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('☾')).toHaveAttribute('aria-hidden', 'true')

    rerender(<ThemeTransitionControl theme="dark" reducedMotion={false} variant="header" onToggleTheme={vi.fn()} />)

    const darkControl = screen.getByRole('button', { name: 'Light Mode aktivieren' })
    expect(darkControl).toHaveTextContent('Light Mode')
    expect(darkControl).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('☼')).toHaveAttribute('aria-hidden', 'true')
  })

  it('commits the theme only at the midpoint and ignores re-entry', () => {
    const onToggleTheme = vi.fn()
    render(<ThemeHarness onToggleTheme={onToggleTheme} />)

    const control = screen.getByRole('button', { name: 'Dark Mode aktivieren' })
    fireEvent.click(control)

    expect(control).toHaveAttribute('data-theme', 'light')
    expect(control).toHaveAttribute('data-phase', 'dissolving')
    expect(onToggleTheme).not.toHaveBeenCalled()

    fireEvent.click(control)
    expect(onToggleTheme).not.toHaveBeenCalled()

    fireEvent.animationEnd(control)
    expect(onToggleTheme).toHaveBeenCalledOnce()
    expect(control).toHaveAttribute('data-theme', 'dark')
    expect(control).toHaveAttribute('data-phase', 'reassembling')

    fireEvent.click(control)
    expect(control).toHaveAttribute('data-phase', 'reassembling')
    expect(onToggleTheme).toHaveBeenCalledOnce()

    fireEvent.animationEnd(control)
    expect(control).toHaveAttribute('data-phase', 'idle')
    expect(onToggleTheme).toHaveBeenCalledOnce()
  })

  it('switches immediately and remains idle when reduced motion is requested', () => {
    const onToggleTheme = vi.fn()
    render(
      <ThemeTransitionControl theme="light" reducedMotion variant="header" onToggleTheme={onToggleTheme} />,
    )

    const control = screen.getByRole('button', { name: 'Dark Mode aktivieren' })
    fireEvent.click(control)

    expect(onToggleTheme).toHaveBeenCalledOnce()
    expect(control).toHaveAttribute('data-phase', 'idle')
  })

  it('commits and unlocks when reduced motion interrupts dissolving', () => {
    const onToggleTheme = vi.fn()
    const { rerender } = render(
      <ThemeTransitionControl theme="light" reducedMotion={false} variant="header" onToggleTheme={onToggleTheme} />,
    )

    const control = screen.getByRole('button', { name: 'Dark Mode aktivieren' })
    fireEvent.click(control)
    expect(control).toHaveAttribute('data-phase', 'dissolving')

    rerender(<ThemeTransitionControl theme="light" reducedMotion variant="header" onToggleTheme={onToggleTheme} />)

    expect(onToggleTheme).toHaveBeenCalledOnce()
    expect(control).toHaveAttribute('data-phase', 'idle')

    fireEvent.click(control)
    expect(onToggleTheme).toHaveBeenCalledTimes(2)
  })

  it('resets without a second commit when reduced motion interrupts reassembling', () => {
    const onToggleTheme = vi.fn()
    const { rerender } = render(
      <ThemeTransitionControl theme="light" reducedMotion={false} variant="header" onToggleTheme={onToggleTheme} />,
    )

    const control = screen.getByRole('button', { name: 'Dark Mode aktivieren' })
    fireEvent.click(control)
    fireEvent.animationEnd(control)
    expect(onToggleTheme).toHaveBeenCalledOnce()
    expect(control).toHaveAttribute('data-phase', 'reassembling')

    rerender(<ThemeTransitionControl theme="dark" reducedMotion variant="header" onToggleTheme={onToggleTheme} />)

    expect(onToggleTheme).toHaveBeenCalledOnce()
    expect(control).toHaveAttribute('data-phase', 'idle')
  })

  it('uses one native click activation and keeps focus', () => {
    const onToggleTheme = vi.fn()
    render(
      <ThemeTransitionControl theme="light" reducedMotion variant="header" onToggleTheme={onToggleTheme} />,
    )

    const control = screen.getByRole('button', { name: 'Dark Mode aktivieren' })
    control.focus()
    fireEvent.click(control)

    expect(onToggleTheme).toHaveBeenCalledOnce()
    expect(control).toHaveFocus()
    expect(control).toHaveAttribute('data-phase', 'idle')
  })

  it('keeps focus on the control through both normal-motion phases', () => {
    render(<ThemeHarness onToggleTheme={vi.fn()} />)

    const control = screen.getByRole('button', { name: 'Dark Mode aktivieren' })
    control.focus()
    fireEvent.click(control)
    expect(document.activeElement).toBe(control)

    fireEvent.animationEnd(control)
    expect(document.activeElement).toBe(control)

    fireEvent.animationEnd(control)
    expect(document.activeElement).toBe(control)
  })

  it('lets only the initiating LandingPage control advance the shared transition', async () => {
    installControllableReducedMotion()
    render(<LandingPage onOpenCalculator={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }))
    const dialog = screen.getByRole('dialog')
    const headerControl = document.querySelector<HTMLButtonElement>(
      '.theme-transition-control[data-variant="header"]',
    )!
    const railControl = within(dialog).getByRole('button', { name: 'Dark Mode aktivieren' })
    const shell = document.querySelector<HTMLElement>('.landing-shell')!
    const themeChanges: string[] = []
    new MutationObserver(records => {
      records.forEach(() => themeChanges.push(shell.dataset.landingTheme ?? ''))
    }).observe(shell, { attributes: true, attributeFilter: ['data-landing-theme'] })

    fireEvent.click(railControl)
    fireEvent.click(headerControl)

    expect(headerControl).toHaveAttribute('data-phase', 'dissolving')
    expect(railControl).toHaveAttribute('data-phase', 'dissolving')
    expect(headerControl).toHaveAttribute('aria-disabled', 'true')
    expect(railControl).toHaveAttribute('aria-disabled', 'true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(dialog).toBeInTheDocument()

    fireEvent.animationEnd(headerControl)
    expect(shell).toHaveAttribute('data-landing-theme', 'light')
    expect(railControl).toHaveAttribute('data-phase', 'dissolving')

    fireEvent.animationEnd(railControl)
    expect(shell).toHaveAttribute('data-landing-theme', 'dark')
    await waitFor(() => expect(themeChanges).toEqual(['dark']))
    expect(headerControl).toHaveAttribute('data-phase', 'reassembling')
    expect(railControl).toHaveAttribute('data-phase', 'reassembling')

    fireEvent.animationEnd(headerControl)
    expect(railControl).toHaveAttribute('data-phase', 'reassembling')

    fireEvent.animationEnd(railControl)
    expect(headerControl).toHaveAttribute('data-phase', 'idle')
    expect(railControl).toHaveAttribute('data-phase', 'idle')
    expect(headerControl).toHaveAccessibleName('Light Mode aktivieren')
    expect(railControl).toHaveAccessibleName('Light Mode aktivieren')
    expect(themeChanges).toEqual(['dark'])
  })

  it('settles a shared dissolve exactly once when Reduced Motion becomes live', async () => {
    const media = installControllableReducedMotion()
    render(<LandingPage onOpenCalculator={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }))
    const dialog = screen.getByRole('dialog')
    const headerControl = document.querySelector<HTMLButtonElement>(
      '.theme-transition-control[data-variant="header"]',
    )!
    const railControl = within(dialog).getByRole('button', { name: 'Dark Mode aktivieren' })
    const shell = document.querySelector<HTMLElement>('.landing-shell')!
    const themeChanges: string[] = []
    new MutationObserver(records => {
      records.forEach(() => themeChanges.push(shell.dataset.landingTheme ?? ''))
    }).observe(shell, { attributes: true, attributeFilter: ['data-landing-theme'] })

    fireEvent.click(railControl)
    expect(headerControl).toHaveAttribute('data-phase', 'dissolving')
    expect(railControl).toHaveAttribute('data-phase', 'dissolving')

    act(() => media.reduceMotion())

    expect(shell).toHaveAttribute('data-landing-theme', 'dark')
    expect(headerControl).toHaveAttribute('data-phase', 'idle')
    expect(railControl).toHaveAttribute('data-phase', 'idle')
    expect(headerControl).toHaveAccessibleName('Light Mode aktivieren')
    expect(railControl).toHaveAccessibleName('Light Mode aktivieren')
    await waitFor(() => expect(themeChanges).toEqual(['dark']))

    fireEvent.animationEnd(headerControl)
    fireEvent.animationEnd(railControl)
    expect(shell).toHaveAttribute('data-landing-theme', 'dark')
    expect(themeChanges).toEqual(['dark'])
  })

  it('does not expose a new rail control while the header transition is active', () => {
    installControllableReducedMotion()
    render(<LandingPage onOpenCalculator={vi.fn()} />)

    const headerControl = screen.getByRole('button', { name: 'Dark Mode aktivieren' })
    const navigationTrigger = screen.getByRole('button', { name: 'Navigation öffnen' })
    fireEvent.click(headerControl)

    expect(navigationTrigger).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(navigationTrigger)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.animationEnd(headerControl)
    fireEvent.animationEnd(headerControl)
    expect(navigationTrigger).not.toHaveAttribute('aria-disabled')
    fireEvent.click(navigationTrigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

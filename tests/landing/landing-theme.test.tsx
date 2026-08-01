import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingPage } from '../../src/landing/LandingPage'

type MatchMediaController = {
  emit: (query: string, matches: boolean) => void
}

function mockMatchMedia(preferences: Record<string, boolean>): MatchMediaController {
  const listeners = new Map<string, Set<(event: MediaQueryListEvent) => void>>()

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return preferences[query] ?? false
    },
    media: query,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      const queryListeners = listeners.get(query) ?? new Set()
      queryListeners.add(listener)
      listeners.set(query, queryListeners)
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.get(query)?.delete(listener)
    },
  }))

  return {
    emit(query, matches) {
      preferences[query] = matches
      listeners.get(query)?.forEach(listener => listener({ matches } as MediaQueryListEvent))
    },
  }
}

describe('LandingPage theme', () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('uses the OS theme and changes it for this session without browser storage', () => {
    mockMatchMedia({ '(prefers-color-scheme: dark)': true })
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    render(<LandingPage onOpenCalculator={vi.fn()} />)

    const shell = screen.getByRole('main')
    expect(shell.getAttribute('data-landing-theme')).toBe('dark')

    fireEvent.click(screen.getByRole('button', { name: 'Darstellung wechseln' }))

    expect(shell.getAttribute('data-landing-theme')).toBe('light')
    expect(setItem).not.toHaveBeenCalled()
  })

  it('updates the shell when the reduced-motion preference changes', () => {
    const media = mockMatchMedia({ '(prefers-reduced-motion: reduce)': false })

    render(<LandingPage onOpenCalculator={vi.fn()} />)

    const shell = screen.getByRole('main')
    expect(shell.getAttribute('data-reduced-motion')).toBe('false')

    act(() => media.emit('(prefers-reduced-motion: reduce)', true))

    expect(shell.getAttribute('data-reduced-motion')).toBe('true')
    expect(shell.classList.contains('landing-shell--reduced-motion')).toBe(true)
  })

  it('renders when matchMedia is unavailable', () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia

    render(<LandingPage onOpenCalculator={vi.fn()} />)

    expect(screen.getByRole('main').getAttribute('data-reduced-motion')).toBe('false')
  })
})

import React, { act } from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeferredLandingSection } from '../../src/landing/components/DeferredLandingSection'

describe('DeferredLandingSection', () => {
  const originalIntersectionObserver = window.IntersectionObserver

  afterEach(() => {
    window.IntersectionObserver = originalIntersectionObserver
    vi.restoreAllMocks()
  })

  it('preserves the chapter target and waits until it approaches the viewport', () => {
    let callback: IntersectionObserverCallback | undefined
    const disconnect = vi.fn()

    class MockIntersectionObserver {
      constructor(nextCallback: IntersectionObserverCallback, public options?: IntersectionObserverInit) {
        callback = nextCallback
      }
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = disconnect
      takeRecords = vi.fn(() => [])
      root = null
      rootMargin = '600px 0px'
      thresholds = [.01]
    }
    window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

    const { container } = render(
      <DeferredLandingSection id="rechenweg" label="Rechenweg">
        <p>Schwerer Beleg</p>
      </DeferredLandingSection>,
    )

    const placeholder = container.querySelector('#rechenweg')
    expect(placeholder).toHaveAccessibleName('Rechenweg')
    expect(screen.queryByText('Schwerer Beleg')).not.toBeInTheDocument()

    act(() => callback?.([
      { target: placeholder, isIntersecting: true } as IntersectionObserverEntry,
    ], {} as IntersectionObserver))

    expect(screen.getByText('Schwerer Beleg')).toBeInTheDocument()
    expect(disconnect).toHaveBeenCalled()
  })
})

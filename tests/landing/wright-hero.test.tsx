import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WrightHero } from '../../src/landing/components/WrightHero'

type ObserverEntry = Pick<IntersectionObserverEntry, 'isIntersecting'>

describe('WrightHero', () => {
  const originalIntersectionObserver = window.IntersectionObserver
  const originalRequestAnimationFrame = window.requestAnimationFrame
  const originalCancelAnimationFrame = window.cancelAnimationFrame

  let intersectionCallback: IntersectionObserverCallback | undefined
  let disconnect: ReturnType<typeof vi.fn>
  let frameCallback: FrameRequestCallback | undefined

  beforeEach(() => {
    disconnect = vi.fn()
    intersectionCallback = undefined
    frameCallback = undefined

    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
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
    const { container } = render(<WrightHero reducedMotion={false} />)
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
    expect(screen.getByText('Überlieferte Formel ist Ausgangspunkt. Beweis ist das Ziel.')).toBeTruthy()
  })

  it('keeps the complete proposition readable after a video error', () => {
    const { container } = render(<WrightHero reducedMotion={false} />)

    fireEvent.error(container.querySelector('video') as HTMLVideoElement)

    expect(screen.getByRole('heading', { name: 'Nicht nur rechnen. Systeme verstehen.' })).toBeTruthy()
    expect(screen.getByText('Bekannte Größen eingeben. Beziehungen prüfen. Den vollständigen Rechenweg nachvollziehen.')).toBeTruthy()
    expect(screen.getByText('Überlieferte Formel ist Ausgangspunkt. Beweis ist das Ziel.')).toBeTruthy()
  })

  it('scrubs through one animation frame only while the hero is visible and cleans up', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const { container, unmount } = render(<WrightHero reducedMotion={false} />)
    const section = container.querySelector('#haltung') as HTMLElement
    const video = container.querySelector('video') as HTMLVideoElement

    const getBoundingClientRect = vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({
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

    act(() => intersectionCallback?.([{ isIntersecting: true } as ObserverEntry as IntersectionObserverEntry], {} as IntersectionObserver))
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))

    expect(addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true })
    expect(addEventListener).toHaveBeenCalledWith('resize', expect.any(Function), { passive: true })
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1)

    act(() => frameCallback?.(0))
    expect(video.currentTime).toBeCloseTo(5)
    expect(section.style.getPropertyValue('--wright-theme-fade')).toBe('0')

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
    expect(section.style.getPropertyValue('--wright-theme-fade')).toBe('1')

    act(() => intersectionCallback?.([{ isIntersecting: false } as ObserverEntry as IntersectionObserverEntry], {} as IntersectionObserver))
    expect(removeEventListener.mock.calls.some(([type]) => type === 'scroll')).toBe(true)
    expect(removeEventListener.mock.calls.some(([type]) => type === 'resize')).toBe(true)

    unmount()
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('uses one stable representative frame and no scrolling lifecycle for reduced motion', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const { container, unmount } = render(<WrightHero reducedMotion />)
    const video = container.querySelector('video') as HTMLVideoElement

    Object.defineProperty(video, 'duration', { configurable: true, value: 10 })
    fireEvent.loadedMetadata(video)

    expect(video.currentTime).toBe(5)
    expect(intersectionCallback).toBeUndefined()
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
    expect(addEventListener.mock.calls.some(([type]) => type === 'scroll' || type === 'resize')).toBe(false)

    unmount()
  })
})

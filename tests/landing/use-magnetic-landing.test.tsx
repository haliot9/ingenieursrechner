import React from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMagneticLanding } from '../../src/landing/motion/useMagneticLanding'

const CHAPTER_IDS = ['haltung', 'module', 'thermodynamik', 'rechenweg', 'projekt'] as const

function setChapterRect(id: string, top: number, height = 200) {
  const element = document.getElementById(id) as HTMLElement
  element.getBoundingClientRect = () => ({
    x: 0,
    y: top,
    top,
    right: 100,
    bottom: top + height,
    left: 0,
    width: 100,
    height,
    toJSON: () => ({}),
  })
}

function dispatchPointer(type: 'pointerdown' | 'pointerup' | 'pointercancel', pointerId: number) {
  const event = new Event(type)
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  fireEvent(window, event)
}

function dispatchTouch(type: 'touchstart' | 'touchend' | 'touchcancel', identifiers: number[]) {
  const event = new Event(type)
  Object.defineProperty(event, 'touches', {
    value: identifiers.map(identifier => ({ identifier })),
  })
  fireEvent(window, event)
}

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []

  readonly observed: Element[] = []
  readonly disconnect = vi.fn()

  constructor(private readonly callback: IntersectionObserverCallback) {
    MockIntersectionObserver.instances.push(this)
  }

  observe = (element: Element) => {
    this.observed.push(element)
  }

  unobserve = vi.fn()
  takeRecords = () => []
  root = null
  rootMargin = '0px'
  thresholds = [0, .72, 1]

  emit(entries: Array<{ id: string; visibleRatio: number; distanceToLanding: number }>) {
    for (const entry of entries) setChapterRect(entry.id, entry.distanceToLanding)
    this.callback(entries.map(entry => ({
      target: document.getElementById(entry.id),
      intersectionRatio: entry.visibleRatio,
      boundingClientRect: { top: entry.distanceToLanding },
    } as unknown as IntersectionObserverEntry)), this as unknown as IntersectionObserver)
  }
}

function MagneticHarness({ reducedMotion = false }: { reducedMotion?: boolean }) {
  useMagneticLanding(reducedMotion)

  return <>
    {CHAPTER_IDS.map(id => <section id={id} key={id}>{id}</section>)}
    <section id="details">details</section>
  </>
}

describe('useMagneticLanding', () => {
  const originalIntersectionObserver = window.IntersectionObserver

  beforeEach(() => {
    vi.useFakeTimers()
    MockIntersectionObserver.instances = []
    window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    window.IntersectionObserver = originalIntersectionObserver
    vi.restoreAllMocks()
  })

  it('observes only the five chapters and settles 140 ms after the last scroll', () => {
    render(<MagneticHarness />)

    const observer = MockIntersectionObserver.instances[0]
    expect(observer.observed.map(element => element.id)).toEqual(CHAPTER_IDS)

    const target = document.getElementById('module') as HTMLElement
    target.scrollIntoView = vi.fn()
    observer.emit([{ id: 'module', visibleRatio: .8, distanceToLanding: 24 }])

    fireEvent.scroll(window)
    act(() => vi.advanceTimersByTime(100))
    fireEvent.scroll(window)
    act(() => vi.advanceTimersByTime(139))
    expect(target.scrollIntoView).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(target.scrollIntoView).toHaveBeenCalledOnce()
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('settles a chapter at most once until a different chapter becomes dominant', () => {
    render(<MagneticHarness />)

    const observer = MockIntersectionObserver.instances[0]
    const haltung = document.getElementById('haltung') as HTMLElement
    const module = document.getElementById('module') as HTMLElement
    haltung.scrollIntoView = vi.fn()
    module.scrollIntoView = vi.fn()

    observer.emit([{ id: 'haltung', visibleRatio: .9, distanceToLanding: 18 }])
    fireEvent.scroll(window)
    act(() => vi.advanceTimersByTime(140))
    fireEvent.scroll(window)
    act(() => vi.advanceTimersByTime(140))
    expect(haltung.scrollIntoView).toHaveBeenCalledOnce()

    observer.emit([
      { id: 'haltung', visibleRatio: .2, distanceToLanding: -500 },
      { id: 'module', visibleRatio: .9, distanceToLanding: 16 },
    ])
    fireEvent.scroll(window)
    act(() => vi.advanceTimersByTime(140))
    expect(module.scrollIntoView).toHaveBeenCalledOnce()

    observer.emit([
      { id: 'haltung', visibleRatio: .9, distanceToLanding: 12 },
      { id: 'module', visibleRatio: .2, distanceToLanding: -500 },
    ])
    fireEvent.scroll(window)
    act(() => vi.advanceTimersByTime(140))
    expect(haltung.scrollIntoView).toHaveBeenCalledTimes(2)
  })

  it('refreshes chapter geometry before settling instead of snapping from a stale qualified entry', () => {
    render(<MagneticHarness />)

    const observer = MockIntersectionObserver.instances[0]
    const target = document.getElementById('module') as HTMLElement
    target.scrollIntoView = vi.fn()
    observer.emit([{ id: 'module', visibleRatio: .8, distanceToLanding: 24 }])

    fireEvent.scroll(window)
    setChapterRect('module', 140)
    act(() => vi.advanceTimersByTime(140))

    expect(target.scrollIntoView).not.toHaveBeenCalled()
  })

  it('settles the current chapter element after a deferred placeholder is replaced', () => {
    render(<MagneticHarness />)

    const original = document.getElementById('module') as HTMLElement
    const replacement = document.createElement('section')
    replacement.id = 'module'
    replacement.scrollIntoView = vi.fn()
    replacement.getBoundingClientRect = () => ({
      x: 0,
      y: 20,
      top: 20,
      right: 100,
      bottom: 820,
      left: 0,
      width: 100,
      height: 800,
      toJSON: () => ({}),
    })
    original.replaceWith(replacement)

    fireEvent.scroll(window)
    act(() => vi.advanceTimersByTime(140))

    try {
      expect(replacement.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    } finally {
      replacement.replaceWith(original)
    }
  })

  it('refreshes dominance before resetting the repeat guard', () => {
    render(<MagneticHarness />)

    const observer = MockIntersectionObserver.instances[0]
    const haltung = document.getElementById('haltung') as HTMLElement
    const module = document.getElementById('module') as HTMLElement
    haltung.scrollIntoView = vi.fn()
    module.scrollIntoView = vi.fn()
    observer.emit([
      { id: 'haltung', visibleRatio: .9, distanceToLanding: 10 },
      { id: 'module', visibleRatio: .8, distanceToLanding: 20 },
    ])

    fireEvent.scroll(window)
    act(() => vi.advanceTimersByTime(140))
    expect(haltung.scrollIntoView).toHaveBeenCalledOnce()

    setChapterRect('haltung', -200, 900)
    setChapterRect('module', 10, 800)
    fireEvent.scroll(window)
    act(() => vi.advanceTimersByTime(140))

    expect(module.scrollIntoView).toHaveBeenCalledOnce()
  })

  it('does not settle while pointer or touch input remains active', () => {
    render(<MagneticHarness />)

    const observer = MockIntersectionObserver.instances[0]
    const target = document.getElementById('projekt') as HTMLElement
    target.scrollIntoView = vi.fn()
    observer.emit([{ id: 'projekt', visibleRatio: .8, distanceToLanding: -30 }])

    fireEvent.pointerDown(window)
    fireEvent.scroll(window)
    act(() => vi.advanceTimersByTime(140))
    expect(target.scrollIntoView).not.toHaveBeenCalled()

    fireEvent.pointerUp(window)
    dispatchTouch('touchstart', [1])
    fireEvent.scroll(window)
    act(() => vi.advanceTimersByTime(140))
    expect(target.scrollIntoView).not.toHaveBeenCalled()

    dispatchTouch('touchend', [])
    fireEvent.scroll(window)
    act(() => vi.advanceTimersByTime(140))
    expect(target.scrollIntoView).toHaveBeenCalledOnce()
  })

  it('stays blocked until every overlapping pointer ends or cancels', () => {
    render(<MagneticHarness />)

    const observer = MockIntersectionObserver.instances[0]
    const target = document.getElementById('projekt') as HTMLElement
    target.scrollIntoView = vi.fn()
    observer.emit([{ id: 'projekt', visibleRatio: .8, distanceToLanding: 20 }])

    dispatchPointer('pointerdown', 1)
    dispatchPointer('pointerdown', 2)
    dispatchPointer('pointerup', 1)
    fireEvent.scroll(window)
    act(() => vi.advanceTimersByTime(140))
    expect(target.scrollIntoView).not.toHaveBeenCalled()

    dispatchPointer('pointercancel', 2)
    fireEvent.scroll(window)
    act(() => vi.advanceTimersByTime(140))
    expect(target.scrollIntoView).toHaveBeenCalledOnce()
  })

  it('stays blocked until the touch event reports no remaining contacts', () => {
    render(<MagneticHarness />)

    const observer = MockIntersectionObserver.instances[0]
    const target = document.getElementById('projekt') as HTMLElement
    target.scrollIntoView = vi.fn()
    observer.emit([{ id: 'projekt', visibleRatio: .8, distanceToLanding: 20 }])

    dispatchTouch('touchstart', [1, 2])
    dispatchTouch('touchend', [2])
    fireEvent.scroll(window)
    act(() => vi.advanceTimersByTime(140))
    expect(target.scrollIntoView).not.toHaveBeenCalled()

    dispatchTouch('touchcancel', [])
    fireEvent.scroll(window)
    act(() => vi.advanceTimersByTime(140))
    expect(target.scrollIntoView).toHaveBeenCalledOnce()
  })

  it('registers no wheel, touchmove, or keyboard interception and cleans up all lifecycle work', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<MagneticHarness />)
    const observer = MockIntersectionObserver.instances[0]

    const registeredTypes = addEventListener.mock.calls.map(([type]) => type)
    expect(registeredTypes).not.toContain('wheel')
    expect(registeredTypes).not.toContain('touchmove')
    expect(registeredTypes).not.toContain('keydown')

    fireEvent.scroll(window)
    unmount()

    expect(observer.disconnect).toHaveBeenCalledOnce()
    for (const [type, listener, options] of addEventListener.mock.calls) {
      expect(removeEventListener).toHaveBeenCalledWith(type, listener, options)
    }
  })

  it('installs no observer or input listeners under reduced motion', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    render(<MagneticHarness reducedMotion />)

    expect(MockIntersectionObserver.instances).toHaveLength(0)
    expect(addEventListener).not.toHaveBeenCalled()
  })
})

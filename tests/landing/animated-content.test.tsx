import React from 'react'
import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type TraceEntry = readonly [string, ...unknown[]]

interface TimelineDouble {
  readonly options: Record<string, unknown>
  readonly to: ReturnType<typeof vi.fn>
  readonly play: ReturnType<typeof vi.fn>
  readonly reverse: ReturnType<typeof vi.fn>
  readonly pause: ReturnType<typeof vi.fn>
  readonly progress: ReturnType<typeof vi.fn>
  readonly eventCallback: ReturnType<typeof vi.fn>
  readonly kill: ReturnType<typeof vi.fn>
  progressValue: number
}

interface TweenDouble {
  readonly payload: Record<string, unknown>
  readonly kill: ReturnType<typeof vi.fn>
}

const harness = vi.hoisted(() => {
  const trace: TraceEntry[] = []
  const timelines: TimelineDouble[] = []
  const tweens: TweenDouble[] = []
  const contexts: Array<{ readonly revert: ReturnType<typeof vi.fn> }> = []
  const scrollTriggers: Array<{
    readonly config: Record<string, unknown>
    readonly kill: ReturnType<typeof vi.fn>
  }> = []

  const ScrollTrigger = {
    pluginName: 'ScrollTrigger',
    create: vi.fn((config: Record<string, unknown>) => {
      const trigger = {
        config,
        kill: vi.fn(() => trace.push(['ScrollTrigger.kill'])),
      }
      scrollTriggers.push(trigger)
      trace.push(['ScrollTrigger.create', config])
      return trigger
    }),
  }

  const gsap = {
    registerPlugin: vi.fn((plugin: { pluginName?: string }) => {
      trace.push(['registerPlugin', plugin.pluginName ?? 'unknown'])
    }),
    set: vi.fn((element: Element, payload: Record<string, unknown>) => {
      trace.push(['set', element, payload])
    }),
    timeline: vi.fn((options: Record<string, unknown>) => {
      const eventCallbacks = new Map<string, () => void>()
      const timeline: TimelineDouble = {
        options,
        progressValue: 0,
        to: vi.fn((element: Element, payload: Record<string, unknown>) => {
          trace.push(['timeline.to', element, payload])
          return timeline
        }),
        play: vi.fn(() => {
          trace.push(['timeline.play'])
          timeline.progressValue = 1
          return timeline
        }),
        reverse: vi.fn(() => {
          trace.push(['timeline.reverse'])
          timeline.progressValue = 0
          return timeline
        }),
        pause: vi.fn(() => {
          trace.push(['timeline.pause'])
          return timeline
        }),
        progress: vi.fn((value?: number) => {
          if (typeof value === 'number') {
            timeline.progressValue = value
            return timeline
          }
          return timeline.progressValue
        }),
        eventCallback: vi.fn((name: string, callback: () => void) => {
          eventCallbacks.set(name, callback)
          return timeline
        }),
        kill: vi.fn(() => trace.push(['timeline.kill', timeline])),
      }
      Object.defineProperty(timeline.options, 'onReverseComplete', {
        configurable: true,
        enumerable: false,
        get: () => eventCallbacks.get('onReverseComplete'),
      })
      timelines.push(timeline)
      trace.push(['timeline', options])
      return timeline
    }),
    to: vi.fn((element: Element, payload: Record<string, unknown>) => {
      const tween: TweenDouble = {
        payload,
        kill: vi.fn(() => trace.push(['tween.kill', tween])),
      }
      tweens.push(tween)
      trace.push(['to', element, payload])
      return tween
    }),
    context: vi.fn((setup: () => void) => {
      const context = {
        revert: vi.fn(() => trace.push(['context.revert'])),
      }
      contexts.push(context)
      setup()
      return context
    }),
  }

  return {
    gsap,
    ScrollTrigger,
    trace,
    timelines,
    tweens,
    contexts,
    scrollTriggers,
    reset() {
      trace.length = 0
      timelines.length = 0
      tweens.length = 0
      contexts.length = 0
      scrollTriggers.length = 0
      vi.clearAllMocks()
    },
  }
})

vi.mock('gsap', () => ({ gsap: harness.gsap }))
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: harness.ScrollTrigger }))

type AnimatedContentModule = typeof import('../../src/landing/components/AnimatedContent')
  & typeof import('../../src/landing/components/AnimatedContentRuntime')

let animatedContentModule: AnimatedContentModule

beforeEach(async () => {
  harness.reset()
  document.getElementById('snap-main-container')?.remove()
  vi.resetModules()
  const [componentModule, runtimeModule] = await Promise.all([
    import('../../src/landing/components/AnimatedContent'),
    import('../../src/landing/components/AnimatedContentRuntime'),
  ])
  animatedContentModule = { ...componentModule, ...runtimeModule }
})

afterEach(() => {
  cleanup()
})

function invoke(callback: unknown) {
  expect(callback).toEqual(expect.any(Function))
  ;(callback as () => void)()
}

function initialMotorTrace(element: HTMLDivElement) {
  return harness.trace.filter(entry =>
    entry[0] === 'registerPlugin'
    || entry[0] === 'set' && entry[1] === element
    || entry[0] === 'timeline'
    || entry[0] === 'timeline.to' && entry[1] === element
    || entry[0] === 'ScrollTrigger.create',
  )
}

interface SemanticMotorTrace {
  entrySet: Record<string, unknown>
  timeline: Record<string, unknown>
  entryTarget: Record<string, unknown>
  completionOrder: string[]
}

function findDifferingPath(expected: unknown, actual: unknown, path = 'trace'): string | null {
  if (Object.is(expected, actual)) return null
  if (typeof expected !== 'object' || expected === null || typeof actual !== 'object' || actual === null) {
    return path
  }

  const expectedRecord = expected as Record<string, unknown>
  const actualRecord = actual as Record<string, unknown>
  const keys = [...new Set([...Object.keys(expectedRecord), ...Object.keys(actualRecord)])].sort()
  for (const key of keys) {
    if (!(key in expectedRecord) || !(key in actualRecord)) return `${path}.${key}`
    const difference = findDifferingPath(expectedRecord[key], actualRecord[key], `${path}.${key}`)
    if (difference) return difference
  }
  return null
}

function assertExactBase(expected: SemanticMotorTrace, actual: SemanticMotorTrace) {
  const difference = findDifferingPath(expected, actual)
  if (difference) throw new Error(`exact-base mismatch at ${difference}`)
}

function cloneSemanticTrace(trace: SemanticMotorTrace): SemanticMotorTrace {
  return {
    entrySet: { ...trace.entrySet },
    timeline: { ...trace.timeline },
    entryTarget: { ...trace.entryTarget },
    completionOrder: [...trace.completionOrder],
  }
}

function semanticTrace(
  timeline: TimelineDouble,
  entrySet: Record<string, unknown>,
  entryTarget: Record<string, unknown>,
  completionOrder: string[],
): SemanticMotorTrace {
  return {
    entrySet: { ...entrySet },
    timeline: {
      paused: timeline.options.paused,
      delay: timeline.options.delay,
      hasOnComplete: typeof timeline.options.onComplete === 'function',
    },
    entryTarget: { ...entryTarget },
    completionOrder: [...completionOrder],
  }
}

const resolvedControllerProfile = {
  distance: 100,
  direction: 'vertical',
  reverse: false,
  duration: 0.8,
  ease: 'power3.out',
  initialOpacity: 0,
  animateOpacity: true,
  scale: 1,
  threshold: 0.1,
  delay: 0,
  disappearAfter: 0.2,
  disappearDuration: 0.5,
  disappearEase: 'power3.in',
} as const

describe('AnimatedContent exact ReactBits item motor', () => {
  it('resolves every valid standalone scroller input without changing node identity', () => {
    const { AnimatedContent } = animatedContentModule
    const fallback = document.createElement('div')
    fallback.id = 'snap-main-container'
    const explicit = document.createElement('div')
    explicit.id = 'explicit-standalone-scroller'
    document.body.append(fallback, explicit)

    const cases = [
      {
        name: 'omitted container',
        props: {},
        expected: fallback,
      },
      {
        name: 'explicit element',
        props: { container: explicit },
        expected: explicit,
      },
      {
        name: 'found selector',
        props: { container: '#explicit-standalone-scroller' },
        expected: explicit,
      },
      {
        name: 'explicit null viewport',
        props: { container: null },
        expected: document.defaultView,
      },
    ] as const

    try {
      for (const scenario of cases) {
        const view = render(
          <AnimatedContent {...scenario.props}>{scenario.name}</AnimatedContent>,
        )
        expect(
          harness.scrollTriggers.at(-1)?.config.scroller,
          scenario.name,
        ).toBe(scenario.expected)
        view.unmount()
      }

      fallback.remove()
      const viewportView = render(<AnimatedContent>omitted viewport</AnimatedContent>)
      expect(harness.scrollTriggers.at(-1)?.config.scroller).toBe(document.defaultView)
      viewportView.unmount()
    } finally {
      fallback.remove()
      explicit.remove()
    }
  })

  it('resolves fallback, selector, and viewport identity from a foreign owner document', () => {
    const { resolveAnimatedContentScroller } = animatedContentModule
    const frame = document.createElement('iframe')
    document.body.append(frame)
    const foreignDocument = frame.contentDocument
    const foreignWindow = frame.contentWindow
    if (!foreignDocument || !foreignWindow) throw new Error('Foreign document fixture is unavailable')
    const fallback = foreignDocument.createElement('div')
    fallback.id = 'snap-main-container'
    const selected = foreignDocument.createElement('div')
    selected.className = 'foreign-scroller'
    foreignDocument.body.append(fallback, selected)

    try {
      expect(
        resolveAnimatedContentScroller('AnimatedContent', undefined, foreignDocument),
      ).toBe(fallback)
      expect(
        resolveAnimatedContentScroller('AnimatedContent', '.foreign-scroller', foreignDocument),
      ).toBe(selected)
      expect(
        resolveAnimatedContentScroller('AnimatedContent', null, foreignDocument),
      ).toBe(foreignWindow)
      expect(foreignWindow).not.toBe(document.defaultView)
    } finally {
      frame.remove()
    }
  })

  it('rejects an explicit viewport when its owner document has no default view', () => {
    const { resolveAnimatedContentScroller } = animatedContentModule
    const detachedDocument = document.implementation.createHTMLDocument('detached')

    expect(() => resolveAnimatedContentScroller(
      'AnimatedContent',
      null,
      detachedDocument,
    )).toThrow(
      'AnimatedContent container cannot resolve a viewport because its owner document has no window',
    )
  })

  it.each([
    ['missing', '.missing-standalone-scroller', 'AnimatedContent container selector ".missing-standalone-scroller" did not match an element'],
    ['blank', '   ', 'AnimatedContent container selector must not be blank'],
    ['malformed', '[', 'AnimatedContent container selector "[" is invalid'],
  ] as const)('rejects a %s standalone selector before allocating motion', (_name, container, message) => {
    const { AnimatedContent } = animatedContentModule

    expect(() => render(
      <AnimatedContent container={container}>invalid standalone scroller</AnimatedContent>,
    )).toThrow(message)
    expect(harness.contexts).toHaveLength(0)
    expect(harness.timelines).toHaveLength(0)
    expect(harness.scrollTriggers).toHaveLength(0)
  })

  it('rejects an item-level container when AnimatedContentChain owns registration', () => {
    const { AnimatedContent, AnimatedContentRegistrationContext } = animatedContentModule
    const registration: AnimatedContentModule['AnimatedContentRegistration'] = {
      isReady: () => true,
      reducedMotion: false,
      register: vi.fn(() => vi.fn()),
    }

    expect(() => render(
      <AnimatedContentRegistrationContext.Provider value={registration}>
        <AnimatedContent container={document.body}>invalid registered scroller</AnimatedContent>
      </AnimatedContentRegistrationContext.Provider>,
    )).toThrow(
      'AnimatedContent container is owned by AnimatedContentChain; pass the explicit container to AnimatedContentChain',
    )
    expect(registration.register).not.toHaveBeenCalled()
    expect(harness.contexts).toHaveLength(0)
    expect(harness.timelines).toHaveLength(0)
    expect(harness.scrollTriggers).toHaveLength(0)
  })

  it('defers registered controller creation while the owning chain is not ready', () => {
    const { AnimatedContent, AnimatedContentRegistrationContext } = animatedContentModule
    const registration: AnimatedContentModule['AnimatedContentRegistration'] = {
      isReady: () => false,
      reducedMotion: false,
      register: vi.fn(() => vi.fn()),
    }

    const view = render(
      <AnimatedContentRegistrationContext.Provider value={registration}>
        <AnimatedContent>preflight-pending item</AnimatedContent>
      </AnimatedContentRegistrationContext.Provider>,
    )

    expect(view.getByText('preflight-pending item')).toHaveStyle({ visibility: 'hidden' })
    expect(registration.register).not.toHaveBeenCalled()
    expect(harness.contexts).toHaveLength(0)
    expect(harness.timelines).toHaveLength(0)
    expect(harness.scrollTriggers).toHaveLength(0)
  })

  it('performs no scroller lookup while server-rendering standalone markup', () => {
    const { AnimatedContent } = animatedContentModule
    const querySelector = vi.spyOn(document, 'querySelector')

    try {
      const markup = renderToString(
        <AnimatedContent container="[">server item</AnimatedContent>,
      )

      expect(markup).toContain('server item')
      expect(querySelector).not.toHaveBeenCalled()
    } finally {
      querySelector.mockRestore()
    }
  })

  it('preserves the ordered non-default vertical trace and disappearance callback order', () => {
    const { AnimatedContent } = animatedContentModule
    const callbackOrder: string[] = []
    const view = render(
      <AnimatedContent
        distance={240}
        duration={1.4}
        ease="power3.out"
        initialOpacity={0.25}
        scale={0.86}
        threshold={0.25}
        delay={0.15}
        disappearAfter={0.4}
        disappearDuration={0.6}
        disappearEase="power3.in"
        onComplete={() => callbackOrder.push('entry')}
        onDisappearanceComplete={() => callbackOrder.push('disappearance')}
      >
        Vertical item
      </AnimatedContent>,
    )
    const element = view.getByText('Vertical item') as HTMLDivElement

    expect(initialMotorTrace(element)).toEqual([
      ['registerPlugin', 'ScrollTrigger'],
      ['set', element, { y: 240, scale: 0.86, opacity: 0.25, visibility: 'visible' }],
      ['timeline', { paused: true, delay: 0.15, onComplete: expect.any(Function) }],
      ['timeline.to', element, { y: 0, scale: 1, opacity: 1, duration: 1.4, ease: 'power3.out' }],
      ['ScrollTrigger.create', {
        trigger: element,
        scroller: window,
        start: 'top 75%',
        once: true,
        onEnter: expect.any(Function),
      }],
    ])

    invoke(harness.scrollTriggers[0].config.onEnter)
    expect(harness.timelines[0].play).toHaveBeenCalledTimes(1)
    invoke(harness.timelines[0].options.onComplete)
    expect(callbackOrder).toEqual(['entry'])
    expect(harness.tweens[0].payload).toEqual({
      y: -240,
      scale: 0.8,
      opacity: 0.25,
      delay: 0.4,
      duration: 0.6,
      ease: 'power3.in',
      onComplete: expect.any(Function),
    })
    invoke(harness.tweens[0].payload.onComplete)
    expect(callbackOrder).toEqual(['entry', 'disappearance'])
  })

  it('preserves horizontal reverse signs and the animateOpacity false opacity rules', () => {
    const { AnimatedContent } = animatedContentModule
    const view = render(
      <AnimatedContent
        direction="horizontal"
        reverse
        distance={175}
        animateOpacity={false}
        disappearAfter={0.3}
      >
        Horizontal item
      </AnimatedContent>,
    )
    const element = view.getByText('Horizontal item') as HTMLDivElement

    expect(harness.gsap.set).toHaveBeenCalledWith(element, {
      x: -175,
      scale: 1,
      opacity: 1,
      visibility: 'visible',
    })
    expect(harness.timelines[0].to).toHaveBeenCalledWith(element, {
      x: 0,
      scale: 1,
      opacity: 1,
      duration: 0.8,
      ease: 'power3.out',
    })

    invoke(harness.timelines[0].options.onComplete)
    expect(harness.tweens[0].payload).toEqual({
      x: 175,
      scale: 0.8,
      opacity: 0,
      delay: 0.3,
      duration: 0.5,
      ease: 'power3.in',
      onComplete: expect.any(Function),
    })
  })

  it('keeps the one-child registered item motor equivalent to standalone mode', () => {
    const { AnimatedContent, AnimatedContentRegistrationContext } = animatedContentModule
    const sharedProps = {
      distance: 220,
      duration: 1.25,
      initialOpacity: 0.2,
      scale: 0.9,
      delay: 0.18,
      disappearAfter: 0.35,
    } as const

    const standaloneOrder: string[] = []
    const standalone = render(
      <AnimatedContent
        {...sharedProps}
        onComplete={() => standaloneOrder.push('entry')}
        onDisappearanceComplete={() => standaloneOrder.push('disappearance')}
      >
        Standalone
      </AnimatedContent>,
    )
    const standaloneElement = standalone.getByText('Standalone') as HTMLDivElement
    const standaloneTimeline = harness.timelines[0]
    const standaloneSet = harness.gsap.set.mock.calls.find(([target]) => target === standaloneElement)?.[1]
    const standaloneTarget = standaloneTimeline.to.mock.calls[0][1]
    invoke(standaloneTimeline.options.onComplete)
    invoke(harness.tweens[0].payload.onComplete)
    const standaloneTrace = semanticTrace(
      standaloneTimeline,
      standaloneSet,
      standaloneTarget,
      standaloneOrder,
    )
    standalone.unmount()

    const traceStart = harness.trace.length
    let registeredController: AnimatedContentModule['AnimatedContentController'] | null = null
    const unregister = vi.fn()
    const registration: AnimatedContentModule['AnimatedContentRegistration'] = {
      isReady: () => true,
      reducedMotion: false,
      register(controller) {
        registeredController = controller
        return unregister
      },
    }
    const registeredOrder: string[] = []
    const registered = render(
      <AnimatedContentRegistrationContext.Provider value={registration}>
        <AnimatedContent
          {...sharedProps}
          onComplete={() => registeredOrder.push('entry')}
          onDisappearanceComplete={() => registeredOrder.push('disappearance')}
        >
          Registered
        </AnimatedContent>
      </AnimatedContentRegistrationContext.Provider>,
    )
    const registeredElement = registered.getByText('Registered') as HTMLDivElement
    const registeredTimeline = harness.timelines[1]
    const registeredSet = harness.gsap.set.mock.calls.find(([target]) => target === registeredElement)?.[1]
    const registeredTarget = registeredTimeline.to.mock.calls[0][1]
    expect(registeredController).not.toBeNull()
    ;(registeredController as unknown as AnimatedContentModule['AnimatedContentController']).play()
    invoke(registeredTimeline.options.onComplete)
    invoke(harness.tweens[1].payload.onComplete)

    assertExactBase(
      standaloneTrace,
      semanticTrace(registeredTimeline, registeredSet, registeredTarget, registeredOrder),
    )
    expect(harness.trace.slice(traceStart).some(entry => entry[0] === 'ScrollTrigger.create')).toBe(false)
    registered.unmount()
    expect(unregister).toHaveBeenCalledTimes(1)
  })

  // Catches replacing the owned timeline with a substitute tween, or letting the pre-reverse forward callback win.
  it('reverses and resumes the same owned entry timeline while stale forward callbacks stay inert', () => {
    const { createAnimatedContentController } = animatedContentModule
    const element = document.createElement('div')
    const staleForwardSettled = vi.fn()
    const forwardSettled = vi.fn()
    const onComplete = vi.fn()
    const controller = createAnimatedContentController(
      element,
      { ...resolvedControllerProfile, disappearAfter: 0 },
      { onComplete },
    )
    const timeline = harness.timelines[0]

    controller.play(staleForwardSettled)
    controller.reverse()

    expect(timeline.reverse).toHaveBeenCalledTimes(1)
    expect(harness.timelines).toHaveLength(1)
    expect(harness.gsap.to).not.toHaveBeenCalled()

    invoke(timeline.options.onComplete)
    expect(staleForwardSettled).not.toHaveBeenCalled()
    expect(onComplete).not.toHaveBeenCalled()

    controller.play(forwardSettled)
    expect(timeline.play).toHaveBeenCalledTimes(2)

    invoke(timeline.options.onComplete)
    expect(forwardSettled).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(harness.timelines).toHaveLength(1)
    expect(harness.gsap.to).not.toHaveBeenCalled()
  })

  // Catches a chain-visible phase that claims initial while the retained motor remains at partial progress.
  it('reports retained timeline progress and initializes the exact initial state without callbacks', () => {
    const { createAnimatedContentController } = animatedContentModule
    const element = document.createElement('div')
    const onComplete = vi.fn()
    const onDisappearanceComplete = vi.fn()
    const controller = createAnimatedContentController(
      element,
      { ...resolvedControllerProfile, distance: 180, initialOpacity: 0.2 },
      { onComplete, onDisappearanceComplete },
    )
    const timeline = harness.timelines[0]
    timeline.progress.mockReturnValueOnce(0.37)

    expect(controller.progress()).toBe(0.37)
    controller.initializeInitial()

    expect(timeline.pause).toHaveBeenCalledTimes(1)
    expect(timeline.progress).toHaveBeenCalledWith(0, true)
    expect(harness.gsap.set).toHaveBeenLastCalledWith(element, {
      y: 180,
      scale: 1,
      opacity: 0.2,
      visibility: 'visible',
    })
    expect(onComplete).not.toHaveBeenCalled()
    expect(onDisappearanceComplete).not.toHaveBeenCalled()
  })

  it('derives the canonical live trace and runs comparator negative controls on altered trace clones', () => {
    const { AnimatedContent } = animatedContentModule
    const callbackOrder: string[] = []
    const view = render(
      <AnimatedContent
        distance={240}
        duration={1.4}
        ease="power3.out"
        initialOpacity={0.25}
        scale={0.86}
        threshold={0.25}
        delay={0.15}
        disappearAfter={0.4}
        disappearDuration={0.6}
        disappearEase="power3.in"
        onComplete={() => callbackOrder.push('entry')}
        onDisappearanceComplete={() => callbackOrder.push('disappearance')}
      >
        Mutation authority
      </AnimatedContent>,
    )
    const element = view.getByText('Mutation authority') as HTMLDivElement
    const timeline = harness.timelines[0]
    invoke(timeline.options.onComplete)
    invoke(harness.tweens[0].payload.onComplete)
    const capturedLiveTrace = semanticTrace(
      timeline,
      harness.gsap.set.mock.calls.find(([target]) => target === element)?.[1],
      timeline.to.mock.calls[0][1],
      callbackOrder,
    )
    const pinnedOracle: SemanticMotorTrace = {
      entrySet: { y: 240, scale: 0.86, opacity: 0.25, visibility: 'visible' },
      timeline: { paused: true, delay: 0.15, hasOnComplete: true },
      entryTarget: { y: 0, scale: 1, opacity: 1, duration: 1.4, ease: 'power3.out' },
      completionOrder: ['entry', 'disappearance'],
    }
    assertExactBase(pinnedOracle, capturedLiveTrace)

    const mutations = [
      ['wrong entry axis sign', 'trace.entrySet.y', (trace: SemanticMotorTrace) => { trace.entrySet.y = -240 }],
      ['custom overshoot', 'trace.entryTarget.y', (trace: SemanticMotorTrace) => { trace.entryTarget.y = -10 }],
      ['wrong final scale', 'trace.entryTarget.scale', (trace: SemanticMotorTrace) => { trace.entryTarget.scale = 0.98 }],
      ['wrong callback order', 'trace.completionOrder.0', (trace: SemanticMotorTrace) => { trace.completionOrder.reverse() }],
      ['invented blur', 'trace.entryTarget.filter', (trace: SemanticMotorTrace) => { trace.entryTarget.filter = 'blur(8px)' }],
    ] as const

    for (const [name, differingPath, mutate] of mutations) {
      const mutated = cloneSemanticTrace(capturedLiveTrace)
      mutate(mutated)
      expect(
        () => assertExactBase(pinnedOracle, mutated),
        name,
      ).toThrow(`exact-base mismatch at ${differingPath}`)
    }
  })

  it('cleans up every standalone scoped handle in order and suppresses late callbacks', () => {
    const { AnimatedContent } = animatedContentModule
    const onComplete = vi.fn()
    const onDisappearanceComplete = vi.fn()
    const view = render(
      <AnimatedContent
        disappearAfter={0.25}
        onComplete={onComplete}
        onDisappearanceComplete={onDisappearanceComplete}
      >
        Standalone cleanup
      </AnimatedContent>,
    )
    const timeline = harness.timelines[0]
    invoke(harness.scrollTriggers[0].config.onEnter)
    invoke(timeline.options.onComplete)
    const disappearance = harness.tweens[0]
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onDisappearanceComplete).not.toHaveBeenCalled()

    const cleanupStart = harness.trace.length
    view.unmount()

    expect(harness.trace.slice(cleanupStart).map(entry => entry[0])).toEqual([
      'ScrollTrigger.kill',
      'timeline.kill',
      'tween.kill',
      'context.revert',
    ])
    expect(harness.scrollTriggers[0].kill).toHaveBeenCalledTimes(1)
    expect(timeline.kill).toHaveBeenCalledTimes(1)
    expect(disappearance.kill).toHaveBeenCalledTimes(1)
    expect(harness.contexts[0].revert).toHaveBeenCalledTimes(1)

    invoke(timeline.options.onComplete)
    invoke(disappearance.payload.onComplete)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onDisappearanceComplete).not.toHaveBeenCalled()
    expect(harness.tweens).toHaveLength(1)
  })

  it('unregisters and cleans registered controller handles without an item trigger', () => {
    const { AnimatedContent, AnimatedContentRegistrationContext } = animatedContentModule
    let controller: AnimatedContentModule['AnimatedContentController'] | null = null
    const unregister = vi.fn(() => harness.trace.push(['unregister']))
    const register = vi.fn((nextController: AnimatedContentModule['AnimatedContentController']) => {
      controller = nextController
      return unregister
    })
    const view = render(
      <AnimatedContentRegistrationContext.Provider value={{ isReady: () => true, register, reducedMotion: false }}>
        <AnimatedContent disappearAfter={0.25}>Registered cleanup</AnimatedContent>
      </AnimatedContentRegistrationContext.Provider>,
    )
    expect(controller).not.toBeNull()
    const registeredController = controller as unknown as AnimatedContentModule['AnimatedContentController']
    const kill = vi.spyOn(registeredController, 'kill')
    registeredController.play()
    invoke(harness.timelines[0].options.onComplete)
    const disappearance = harness.tweens[0]
    const cleanupStart = harness.trace.length

    view.unmount()

    expect(harness.ScrollTrigger.create).not.toHaveBeenCalled()
    expect(harness.trace.slice(cleanupStart).map(entry => entry[0])).toEqual([
      'unregister',
      'timeline.kill',
      'tween.kill',
      'context.revert',
    ])
    expect(unregister).toHaveBeenCalledTimes(1)
    expect(kill).toHaveBeenCalledTimes(1)
    expect(harness.timelines[0].kill).toHaveBeenCalledTimes(1)
    expect(disappearance.kill).toHaveBeenCalledTimes(1)
    expect(harness.contexts[0].revert).toHaveBeenCalledTimes(1)
  })

  it('does not recreate a registered controller when only the provider wrapper identity changes', () => {
    const { AnimatedContent, AnimatedContentRegistrationContext } = animatedContentModule
    const unregister = vi.fn()
    const register = vi.fn(() => unregister)
    const isReady = () => true
    const renderItem = () => (
      <AnimatedContentRegistrationContext.Provider value={{ isReady, register, reducedMotion: false }}>
        <AnimatedContent>Stable registration members</AnimatedContent>
      </AnimatedContentRegistrationContext.Provider>
    )
    const view = render(renderItem())
    const firstControllerTimeline = harness.timelines[0]

    view.rerender(renderItem())

    expect(register).toHaveBeenCalledTimes(1)
    expect(unregister).not.toHaveBeenCalled()
    expect(harness.timelines).toHaveLength(1)
    expect(harness.contexts).toHaveLength(1)
    expect(firstControllerTimeline.kill).not.toHaveBeenCalled()

    view.unmount()
    expect(unregister).toHaveBeenCalledTimes(1)
  })

  it('runs the protected public disappearance callback before the internal settled observer', () => {
    const { createAnimatedContentController } = animatedContentModule
    const element = document.createElement('div')
    const callbackOrder: string[] = []
    const controller = createAnimatedContentController(
      element,
      resolvedControllerProfile,
      { onDisappearanceComplete: () => callbackOrder.push('public') },
    )

    controller.disappear(0, () => callbackOrder.push('internal'))
    expect(harness.tweens[0].payload).toEqual({
      y: -100,
      scale: 0.8,
      opacity: 0,
      delay: 0,
      duration: 0.5,
      ease: 'power3.in',
      onComplete: expect.any(Function),
    })
    invoke(harness.tweens[0].payload.onComplete)

    expect(callbackOrder).toEqual(['public', 'internal'])
  })

  it('suppresses both public and internal late notifications after settle and kill', () => {
    const { createAnimatedContentController } = animatedContentModule
    const element = document.createElement('div')
    const onDisappearanceComplete = vi.fn()
    const onSettled = vi.fn()
    const controller = createAnimatedContentController(
      element,
      resolvedControllerProfile,
      { onDisappearanceComplete },
    )

    controller.disappear(0, onSettled)
    invoke(harness.tweens[0].payload.onComplete)
    expect(onDisappearanceComplete).toHaveBeenCalledTimes(1)
    expect(onSettled).toHaveBeenCalledTimes(1)

    controller.disappear(0, onSettled)
    const settledTween = harness.tweens[1]
    controller.settle()
    invoke(settledTween.payload.onComplete)
    expect(onDisappearanceComplete).toHaveBeenCalledTimes(1)
    expect(onSettled).toHaveBeenCalledTimes(1)

    controller.disappear(0, onSettled)
    const killedTween = harness.tweens[2]
    controller.kill()
    invoke(killedTween.payload.onComplete)
    expect(onDisappearanceComplete).toHaveBeenCalledTimes(1)
    expect(onSettled).toHaveBeenCalledTimes(1)
  })

  it('rechecks the token after the public callback so public-triggered re-entry suppresses onSettled', () => {
    const { createAnimatedContentController } = animatedContentModule
    const element = document.createElement('div')
    const callbackOrder: string[] = []
    const controller = createAnimatedContentController(
      element,
      resolvedControllerProfile,
      {
        onDisappearanceComplete: () => {
          callbackOrder.push('public')
          controller.settle()
        },
      },
    )

    controller.disappear(0, () => callbackOrder.push('internal'))
    invoke(harness.tweens[0].payload.onComplete)

    expect(callbackOrder).toEqual(['public'])
  })

  it('suppresses a superseded observer and notifies only the current disappearance completion', () => {
    const { createAnimatedContentController } = animatedContentModule
    const element = document.createElement('div')
    const callbackOrder: string[] = []
    const controller = createAnimatedContentController(
      element,
      resolvedControllerProfile,
      { onDisappearanceComplete: () => callbackOrder.push('public') },
    )

    controller.disappear(0, () => callbackOrder.push('stale-internal'))
    const staleTween = harness.tweens[0]
    controller.disappear(0, () => callbackOrder.push('current-internal'))
    const currentTween = harness.tweens[1]

    expect(staleTween.kill).toHaveBeenCalledTimes(1)
    invoke(staleTween.payload.onComplete)
    expect(callbackOrder).toEqual([])
    invoke(currentTween.payload.onComplete)
    expect(callbackOrder).toEqual(['public', 'current-internal'])
  })

  it('initializes a vertical controller at the exact callback-free disappearance terminal values', () => {
    const { createAnimatedContentController } = animatedContentModule
    const element = document.createElement('div')
    const onComplete = vi.fn()
    const onDisappearanceComplete = vi.fn()
    const controller = createAnimatedContentController(
      element,
      {
        ...resolvedControllerProfile,
        distance: 240,
        initialOpacity: 0.25,
      },
      { onComplete, onDisappearanceComplete },
    )

    controller.initializeExited()

    expect(harness.gsap.set).toHaveBeenLastCalledWith(element, {
      y: -240,
      scale: 0.8,
      opacity: 0.25,
      visibility: 'visible',
    })
    expect(harness.gsap.to).not.toHaveBeenCalled()
    expect(onComplete).not.toHaveBeenCalled()
    expect(onDisappearanceComplete).not.toHaveBeenCalled()
  })

  it('initializes horizontal reverse content at the exact opposite offset and opacity zero', () => {
    const { createAnimatedContentController } = animatedContentModule
    const element = document.createElement('div')
    const controller = createAnimatedContentController(
      element,
      {
        ...resolvedControllerProfile,
        distance: 175,
        direction: 'horizontal',
        reverse: true,
        initialOpacity: 0.4,
        animateOpacity: false,
      },
      {},
    )

    controller.initializeExited()

    expect(harness.gsap.set).toHaveBeenLastCalledWith(element, {
      x: 175,
      scale: 0.8,
      opacity: 0,
      visibility: 'visible',
    })
    expect(harness.gsap.to).not.toHaveBeenCalled()
  })

  it('cancels active entry and exit handles, suppresses late callbacks, and later settles exactly', () => {
    const { createAnimatedContentController } = animatedContentModule
    const element = document.createElement('div')
    const onComplete = vi.fn()
    const onDisappearanceComplete = vi.fn()
    const onSettled = vi.fn()
    const controller = createAnimatedContentController(
      element,
      resolvedControllerProfile,
      { onComplete, onDisappearanceComplete },
    )
    const timeline = harness.timelines[0]
    controller.disappear(0, onSettled)
    const activeExit = harness.tweens[0]

    controller.initializeExited()

    expect(timeline.kill).not.toHaveBeenCalled()
    expect(activeExit.kill).toHaveBeenCalledTimes(1)
    expect(harness.gsap.set).toHaveBeenLastCalledWith(element, {
      y: -100,
      scale: 0.8,
      opacity: 0,
      visibility: 'visible',
    })
    expect(harness.tweens).toHaveLength(1)

    invoke(timeline.options.onComplete)
    invoke(activeExit.payload.onComplete)
    expect(onComplete).not.toHaveBeenCalled()
    expect(onDisappearanceComplete).not.toHaveBeenCalled()
    expect(onSettled).not.toHaveBeenCalled()
    expect(harness.tweens).toHaveLength(1)

    controller.settle()
    expect(harness.gsap.set).toHaveBeenLastCalledWith(element, {
      y: 0,
      scale: 1,
      opacity: 1,
      visibility: 'visible',
    })
    expect(timeline.pause).toHaveBeenCalledTimes(2)
    expect(timeline.progress).toHaveBeenCalledTimes(2)
    expect(timeline.progress).toHaveBeenCalledWith(1, true)
    expect(timeline.kill).not.toHaveBeenCalled()
    expect(activeExit.kill).toHaveBeenCalledTimes(1)
  })

  it('cancels only controller-owned handles and suppresses every late callback', () => {
    const { createAnimatedContentController } = animatedContentModule
    const element = document.createElement('div')
    const onComplete = vi.fn()
    const onDisappearanceComplete = vi.fn()
    const controller = createAnimatedContentController(
      element,
      resolvedControllerProfile,
      { onComplete, onDisappearanceComplete },
    )
    const timeline = harness.timelines[0]

    controller.cancelEntry()
    expect(timeline.kill).not.toHaveBeenCalled()
    invoke(timeline.options.onComplete)
    expect(onComplete).not.toHaveBeenCalled()
    expect(harness.gsap.to).not.toHaveBeenCalled()

    controller.disappear(0)
    const disappearance = harness.tweens[0]
    controller.settle()
    expect(disappearance.kill).toHaveBeenCalledTimes(1)
    expect(harness.gsap.set).toHaveBeenLastCalledWith(element, {
      y: 0,
      scale: 1,
      opacity: 1,
      visibility: 'visible',
    })
    invoke(disappearance.payload.onComplete)
    expect(onDisappearanceComplete).not.toHaveBeenCalled()

    controller.kill()
    expect(timeline.kill).toHaveBeenCalledTimes(1)
  })

  it('renders reduced registered content settled before effects and creates no GSAP controller', () => {
    const { AnimatedContent, AnimatedContentRegistrationContext } = animatedContentModule
    const registration: AnimatedContentModule['AnimatedContentRegistration'] = {
      isReady: () => true,
      reducedMotion: true,
      register: vi.fn(() => vi.fn()),
    }
    const view = render(
      <AnimatedContentRegistrationContext.Provider value={registration}>
        <AnimatedContent>Reduced item</AnimatedContent>
      </AnimatedContentRegistrationContext.Provider>,
    )

    expect(view.getByText('Reduced item')).toHaveStyle({ visibility: 'visible' })
    expect(registration.register).not.toHaveBeenCalled()
    expect(harness.gsap.set).not.toHaveBeenCalled()
    expect(harness.gsap.timeline).not.toHaveBeenCalled()
    expect(harness.ScrollTrigger.create).not.toHaveBeenCalled()
  })
})

import React, { useContext, useEffect, useRef } from 'react'
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnimatedContent } from '../../src/landing/components/AnimatedContent'
import { AnimatedContentChain } from '../../src/landing/components/AnimatedContentChain'
import {
  AnimatedContentRegistrationContext,
  type AnimatedContentController,
} from '../../src/landing/components/AnimatedContentRuntime'

interface TimelineDouble {
  readonly options: Record<string, unknown>
  readonly to: ReturnType<typeof vi.fn>
  readonly call: ReturnType<typeof vi.fn>
  readonly play: ReturnType<typeof vi.fn>
  readonly reverse: ReturnType<typeof vi.fn>
  readonly pause: ReturnType<typeof vi.fn>
  readonly progress: ReturnType<typeof vi.fn>
  readonly eventCallback: ReturnType<typeof vi.fn>
  readonly kill: ReturnType<typeof vi.fn>
  progressValue: number
}

interface TriggerDouble {
  readonly config: Record<string, unknown>
  readonly refresh: ReturnType<typeof vi.fn>
  readonly kill: ReturnType<typeof vi.fn>
  progress: number
  isActive: boolean
}

class CapturingErrorBoundary extends React.Component<
  React.PropsWithChildren<{ readonly onError: (error: Error) => void }>,
  { readonly failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error)
  }

  render() {
    return this.state.failed ? <div>configuration failed</div> : this.props.children
  }
}

const motion = vi.hoisted(() => {
  const events: string[] = []
  const timelines: TimelineDouble[] = []
  const triggers: TriggerDouble[] = []
  let nextTriggerState = { progress: 0, isActive: false }

  const gsap = {
    registerPlugin: vi.fn(),
    timeline: vi.fn((options: Record<string, unknown>) => {
      const eventCallbacks = new Map<string, () => void>()
      const timeline: TimelineDouble = {
        options,
        progressValue: 0,
        to: vi.fn(() => timeline),
        call: vi.fn((callback: () => void, params: unknown[], position: number) => {
          events.push(`scheduler.call:${position}`)
          void callback
          void params
          return timeline
        }),
        play: vi.fn(() => {
          events.push('scheduler.play')
          if (timeline.to.mock.calls.length > 0) timeline.progressValue = 1
          return timeline
        }),
        reverse: vi.fn(() => {
          events.push('scheduler.reverse')
          if (timeline.to.mock.calls.length > 0) timeline.progressValue = 0
          return timeline
        }),
        pause: vi.fn(() => timeline),
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
        kill: vi.fn(() => events.push('scheduler.kill')),
      }
      Object.defineProperty(timeline.options, 'onReverseComplete', {
        configurable: true,
        enumerable: false,
        get: () => eventCallbacks.get('onReverseComplete'),
      })
      timelines.push(timeline)
      events.push('scheduler.create')
      return timeline
    }),
    set: vi.fn(),
    to: vi.fn(() => ({ kill: vi.fn() })),
    context: vi.fn((setup: () => void, scope?: Element | string) => {
      const element = scope instanceof HTMLElement ? scope : null
      const initialStyle = element?.getAttribute('style') ?? null
      setup()
      return {
        revert: vi.fn(() => {
          if (!element) return
          if (initialStyle === null) element.removeAttribute('style')
          else element.setAttribute('style', initialStyle)
        }),
      }
    }),
  }

  const ScrollTrigger = {
    pluginName: 'ScrollTrigger',
    create: vi.fn((config: Record<string, unknown>) => {
      const trigger: TriggerDouble = {
        config,
        progress: nextTriggerState.progress,
        isActive: nextTriggerState.isActive,
        refresh: vi.fn(() => {
          trigger.progress = nextTriggerState.progress
          trigger.isActive = nextTriggerState.isActive
          events.push('trigger.refresh')
          const onRefresh = config.onRefresh
          if (typeof onRefresh === 'function') onRefresh(trigger)
        }),
        kill: vi.fn(() => events.push('trigger.kill')),
      }
      triggers.push(trigger)
      events.push('trigger.create')
      return trigger
    }),
  }

  return {
    gsap,
    ScrollTrigger,
    events,
    timelines,
    triggers,
    setNextTriggerState(progress: number, isActive: boolean) {
      nextTriggerState = { progress, isActive }
    },
    reset() {
      events.length = 0
      timelines.length = 0
      triggers.length = 0
      nextTriggerState = { progress: 0, isActive: false }
      vi.clearAllMocks()
    },
  }
})

vi.mock('gsap', () => ({ gsap: motion.gsap }))
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: motion.ScrollTrigger }))

interface ItemProfile {
  readonly label: string
  readonly delay: number
  readonly duration: number
}

interface ControllerDouble extends AnimatedContentController {
  readonly label: string
  readonly progress: ReturnType<typeof vi.fn>
  readonly play: ReturnType<typeof vi.fn>
  readonly reverse: ReturnType<typeof vi.fn>
  readonly cancelEntry: ReturnType<typeof vi.fn>
  readonly disappear: ReturnType<typeof vi.fn>
  readonly initializeInitial: ReturnType<typeof vi.fn>
  readonly settle: ReturnType<typeof vi.fn>
  readonly kill: ReturnType<typeof vi.fn>
}

interface RegistryHarness {
  readonly controllers: ControllerDouble[]
  readonly registrationOrder: string[]
  readonly unregisterOrder: string[]
  readonly forwardObservers: Map<string, Array<() => void>>
  readonly reverseObservers: Map<string, Array<() => void>>
  readonly progressByLabel: Map<string, number>
  autoEndpoints: boolean
}

const labels = ['Thermodynamik', 'Carnot', 'Otto', 'Diesel', 'Joule/Brayton'] as const

function profiles(duration = 2.2, delays = [0, 0, 0, 0, 0]): ItemProfile[] {
  return labels.map((label, index) => ({ label, duration, delay: delays[index] }))
}

function ControlledItems({
  items,
  registry,
}: {
  readonly items: readonly ItemProfile[]
  readonly registry: RegistryHarness
}) {
  const registration = useContext(AnimatedContentRegistrationContext)
  const elementRefs = useRef<Array<HTMLDivElement | null>>([])

  useEffect(() => {
    if (!registration || !registration.isReady() || registration.reducedMotion) return

    const controllers = items.map((profile, index): ControllerDouble => {
      const element = elementRefs.current[index]
      if (!element) throw new Error(`Missing controlled element for ${profile.label}`)
      registry.progressByLabel.set(profile.label, 0)
      return {
        element,
        label: profile.label,
        delay: profile.delay,
        duration: profile.duration,
        progress: vi.fn(() => registry.progressByLabel.get(profile.label) ?? 0),
        play: vi.fn((onSettled?: () => void) => {
          motion.events.push(`play:${profile.label}`)
          if (registry.autoEndpoints) registry.progressByLabel.set(profile.label, 1)
          if (onSettled) {
            const observers = registry.forwardObservers.get(profile.label) ?? []
            observers.push(onSettled)
            registry.forwardObservers.set(profile.label, observers)
          }
        }),
        reverse: vi.fn((onSettled?: () => void) => {
          motion.events.push(`reverse:${profile.label}`)
          if (registry.autoEndpoints) registry.progressByLabel.set(profile.label, 0)
          if (onSettled) {
            const observers = registry.reverseObservers.get(profile.label) ?? []
            observers.push(onSettled)
            registry.reverseObservers.set(profile.label, observers)
          }
        }),
        cancelEntry: vi.fn(() => motion.events.push(`cancelEntry:${profile.label}`)),
        disappear: vi.fn((delayOverride?: number, onSettled?: () => void) => {
          void delayOverride
          void onSettled
          motion.events.push(`disappear:${profile.label}`)
        }),
        initializeInitial: vi.fn(() => {
          registry.progressByLabel.set(profile.label, 0)
          motion.events.push(`initializeInitial:${profile.label}`)
        }),
        initializeExited: vi.fn(() => {
          registry.progressByLabel.set(profile.label, 1)
          motion.events.push(`initializeExited:${profile.label}`)
        }),
        settle: vi.fn(() => {
          registry.progressByLabel.set(profile.label, 1)
          motion.events.push(`settle:${profile.label}`)
        }),
        kill: vi.fn(() => motion.events.push(`controller.kill:${profile.label}`)),
      }
    })
    registry.controllers.push(...controllers)

    const cleanups = [...controllers].reverse().map(controller => {
      registry.registrationOrder.push(controller.label)
      const unregister = registration.register(controller)
      return () => {
        unregister()
        registry.unregisterOrder.push(controller.label)
        controller.kill()
      }
    })

    return () => {
      for (const dispose of cleanups) dispose()
    }
  }, [items, registration, registry])

  return items.map((profile, index) => (
    <div key={profile.label} ref={element => { elementRefs.current[index] = element }}>
      <button type="button">{profile.label}</button>
    </div>
  ))
}

function createRegistry(autoEndpoints = true): RegistryHarness {
  return {
    controllers: [],
    registrationOrder: [],
    unregisterOrder: [],
    forwardObservers: new Map(),
    reverseObservers: new Map(),
    progressByLabel: new Map(),
    autoEndpoints,
  }
}

interface RenderChainOptions {
  readonly container?: Element | string | null
  readonly items?: readonly ItemProfile[]
  readonly layoutRevision?: string | number
  readonly pullAtPreviousProgress?: number
  readonly reducedMotion?: boolean
  readonly registry?: RegistryHarness
  readonly onPhaseChange?: (phase: string) => void
  readonly className?: string
}

function chainView(options: RenderChainOptions = {}) {
  const items = options.items ?? profiles()
  const registry = options.registry ?? createRegistry()
  const view = render(
    <AnimatedContentChain
      data-testid="elastic-menu-chain"
      className={options.className}
      container={options.container}
      layoutRevision={options.layoutRevision}
      reducedMotion={options.reducedMotion ?? false}
      pullAtPreviousProgress={options.pullAtPreviousProgress ?? 0.42}
      threshold={0.1}
      exitStartViewportPercent={22}
      onPhaseChange={options.onPhaseChange}
    >
      <ControlledItems items={items} registry={registry} />
    </AnimatedContentChain>,
  )
  return { ...view, items, registry }
}

function scheduler() {
  expect(motion.timelines).toHaveLength(1)
  return motion.timelines[0]
}

function trigger() {
  expect(motion.triggers).toHaveLength(1)
  return motion.triggers[0]
}

function chainSchedulers() {
  return motion.timelines.filter(timeline => timeline.call.mock.calls.length > 0)
}

function currentScheduler() {
  const active = chainSchedulers().filter(timeline => timeline.kill.mock.calls.length === 0)
  expect(active).toHaveLength(1)
  return active[0]
}

function currentTrigger() {
  const active = motion.triggers.filter(candidate => candidate.kill.mock.calls.length === 0)
  expect(active).toHaveLength(1)
  return active[0]
}

function itemTimelineFor(label: string) {
  const timeline = motion.timelines.findLast(candidate => (
    candidate.to.mock.calls.length === 1
    && candidate.to.mock.calls[0][0] instanceof HTMLElement
    && candidate.to.mock.calls[0][0].textContent?.trim() === label
  ))
  if (!timeline) throw new Error(`Missing item timeline for ${label}`)
  return timeline
}

function scheduledCalls(timeline = scheduler()) {
  return timeline.call.mock.calls as Array<[() => void, unknown[], number]>
}

function invoke(callback: unknown) {
  expect(callback).toEqual(expect.any(Function))
  act(() => { (callback as () => void)() })
}

function wrapperFor(label: string) {
  const wrapper = screen.getByText(label).parentElement
  if (!(wrapper instanceof HTMLDivElement)) throw new Error(`Missing wrapper for ${label}`)
  return wrapper
}

function lastSetPayload(label: string) {
  const wrapper = wrapperFor(label)
  const call = motion.gsap.set.mock.calls.findLast(([target]) => target === wrapper)
  if (!call) throw new Error(`Missing gsap.set call for ${label}`)
  return call[1]
}

function controllerFor(registry: RegistryHarness, label: string) {
  const controller = registry.controllers.find(candidate => candidate.label === label)
  if (!controller) throw new Error(`Missing controller for ${label}`)
  return controller
}

function setControllerProgress(registry: RegistryHarness, label: string, progress: number) {
  registry.progressByLabel.set(label, progress)
}

function completeController(
  registry: RegistryHarness,
  label: string,
  direction: 'forward' | 'reverse',
) {
  setControllerProgress(registry, label, direction === 'forward' ? 1 : 0)
  const observers = direction === 'forward'
    ? registry.forwardObservers.get(label)
    : registry.reverseObservers.get(label)
  invoke(observers?.at(-1))
}

async function waitForChain() {
  await waitFor(() => expect(motion.ScrollTrigger.create).toHaveBeenCalledTimes(1))
}

interface RealItemsProps {
  readonly distance: number
  readonly duration?: number
  readonly delay?: number
  readonly onComplete?: () => void
  readonly onDisappearanceComplete?: () => void
}

function RealAnimatedItems({
  distance,
  duration = 2.2,
  delay = 0,
  onComplete,
  onDisappearanceComplete,
}: RealItemsProps) {
  return labels.map(label => (
    <AnimatedContent
      key={label}
      distance={distance}
      duration={duration}
      delay={delay}
      initialOpacity={0.2}
      onComplete={onComplete}
      onDisappearanceComplete={onDisappearanceComplete}
    >
      <button type="button">{label}</button>
    </AnimatedContent>
  ))
}

beforeEach(() => {
  motion.reset()
})

afterEach(() => {
  cleanup()
})

describe('AnimatedContentChain causal scheduler', () => {
  it('resolves the chain selector before descendant passive effects', () => {
    const order: string[] = []
    const scroller = document.createElement('div')
    scroller.id = 'layout-preflight-scroller'
    document.body.append(scroller)
    const querySelector = vi.spyOn(document, 'querySelector').mockImplementation(selector => {
      if (selector === '#layout-preflight-scroller') order.push('preflight')
      return Document.prototype.querySelector.call(document, selector)
    })

    function PassiveProbe() {
      useEffect(() => { order.push('child-passive') }, [])
      return <div>passive probe</div>
    }

    try {
      render(
        <AnimatedContentChain
          reducedMotion={false}
          container="#layout-preflight-scroller"
          pullAtPreviousProgress={0.42}
          threshold={0.1}
          exitStartViewportPercent={22}
        >
          <PassiveProbe />
        </AnimatedContentChain>,
      )
      expect(order).toEqual(['preflight', 'child-passive'])
    } finally {
      querySelector.mockRestore()
      scroller.remove()
    }
  })

  it('performs no scroller lookup while server-rendering chained markup', () => {
    const querySelector = vi.spyOn(document, 'querySelector')

    try {
      const markup = renderToString(
        <AnimatedContentChain
          reducedMotion={false}
          container="["
          pullAtPreviousProgress={0.42}
          threshold={0.1}
          exitStartViewportPercent={22}
        >
          <div>server chain item</div>
        </AnimatedContentChain>,
      )

      expect(markup).toContain('server chain item')
      expect(querySelector).not.toHaveBeenCalled()
    } finally {
      querySelector.mockRestore()
    }
  })

  it('resolves every valid shared scroller input without changing node identity', async () => {
    const fallback = document.createElement('div')
    fallback.id = 'snap-main-container'
    const explicit = document.createElement('div')
    explicit.id = 'explicit-chain-scroller'
    document.body.append(fallback, explicit)

    const cases = [
      { name: 'omitted container', options: {}, expected: fallback },
      { name: 'explicit element', options: { container: explicit }, expected: explicit },
      { name: 'found selector', options: { container: '#explicit-chain-scroller' }, expected: explicit },
      { name: 'explicit null viewport', options: { container: null }, expected: document.defaultView },
    ] as const

    try {
      for (const scenario of cases) {
        const view = chainView(scenario.options)
        await waitForChain()
        expect(trigger().config.scroller, scenario.name).toBe(scenario.expected)
        view.unmount()
        motion.reset()
      }

      fallback.remove()
      const viewportView = chainView()
      await waitForChain()
      expect(trigger().config.scroller).toBe(document.defaultView)
      viewportView.unmount()
    } finally {
      fallback.remove()
      explicit.remove()
    }
  })

  it.each([
    ['missing', '.missing-chain-scroller', 'AnimatedContentChain container selector ".missing-chain-scroller" did not match an element'],
    ['blank', '   ', 'AnimatedContentChain container selector must not be blank'],
    ['malformed', '[', 'AnimatedContentChain container selector "[" is invalid'],
  ] as const)('rejects a %s shared selector before allocating a scheduler or trigger', async (_name, container, message) => {
    const error = vi.fn()
    const onPhaseChange = vi.fn()
    const registry = createRegistry()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      render(
        <CapturingErrorBoundary onError={error}>
          <AnimatedContentChain
            reducedMotion={false}
            container={container}
            pullAtPreviousProgress={0.42}
            threshold={0.1}
            exitStartViewportPercent={22}
            onPhaseChange={onPhaseChange}
          >
            <ControlledItems items={profiles()} registry={registry} />
            {labels.map(label => <AnimatedContent key={`real-${label}`}>{label} real</AnimatedContent>)}
          </AnimatedContentChain>
        </CapturingErrorBoundary>,
      )
      await waitFor(() => expect(error).toHaveBeenCalledWith(expect.objectContaining({ message })))
      expect(registry.registrationOrder).toEqual([])
      expect(motion.gsap.context).not.toHaveBeenCalled()
      expect(motion.timelines).toHaveLength(0)
      expect(motion.triggers).toHaveLength(0)
      expect(onPhaseChange).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })

  it('validates an explicit selector during Reduced Motion without constructing motion', async () => {
    const error = vi.fn()
    const onPhaseChange = vi.fn()
    const registry = createRegistry()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      render(
        <CapturingErrorBoundary onError={error}>
          <AnimatedContentChain
            reducedMotion
            container=".missing-reduced-scroller"
            pullAtPreviousProgress={0.42}
            threshold={0.1}
            exitStartViewportPercent={22}
            onPhaseChange={onPhaseChange}
          >
            <ControlledItems items={profiles()} registry={registry} />
            {labels.map(label => <AnimatedContent key={`real-${label}`}>{label} real</AnimatedContent>)}
          </AnimatedContentChain>
        </CapturingErrorBoundary>,
      )
      await waitFor(() => expect(error).toHaveBeenCalledWith(expect.objectContaining({
        message: 'AnimatedContentChain container selector ".missing-reduced-scroller" did not match an element',
      })))
      expect(registry.registrationOrder).toEqual([])
      expect(motion.gsap.context).not.toHaveBeenCalled()
      expect(motion.timelines).toHaveLength(0)
      expect(motion.triggers).toHaveLength(0)
      expect(onPhaseChange).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })

  it('refreshes only its existing trigger once per committed layout revision', async () => {
    const registry = createRegistry()
    const items = profiles()
    const renderTree = (layoutRevision: string) => (
      <AnimatedContentChain
        data-testid="elastic-menu-chain"
        layoutRevision={layoutRevision}
        reducedMotion={false}
        pullAtPreviousProgress={0.42}
        threshold={0.1}
        exitStartViewportPercent={22}
      >
        <ControlledItems items={items} registry={registry} />
      </AnimatedContentChain>
    )
    const view = render(renderTree('closed'))
    await waitForChain()
    const ownedTrigger = trigger()
    const ownedScheduler = scheduler()
    expect(ownedTrigger.refresh).toHaveBeenCalledTimes(1)

    view.rerender(renderTree('closed'))
    expect(ownedTrigger.refresh).toHaveBeenCalledTimes(1)

    view.rerender(renderTree('carnot'))
    expect(ownedTrigger.refresh).toHaveBeenCalledTimes(2)
    view.rerender(renderTree('diesel'))
    expect(ownedTrigger.refresh).toHaveBeenCalledTimes(3)
    view.rerender(renderTree('closed'))
    expect(ownedTrigger.refresh).toHaveBeenCalledTimes(4)

    expect(motion.ScrollTrigger.create).toHaveBeenCalledTimes(1)
    expect(motion.ScrollTrigger).not.toHaveProperty('refresh')
    expect(motion.timelines).toEqual([ownedScheduler])
    expect(registry.controllers).toHaveLength(5)
    expect(registry.unregisterOrder).toEqual([])
  })

  it('registers five real AnimatedContent motors under the one shared trigger', async () => {
    const view = render(
      <AnimatedContentChain
        data-testid="elastic-menu-chain"
        reducedMotion={false}
        pullAtPreviousProgress={0.42}
        threshold={0.1}
        exitStartViewportPercent={22}
      >
        {labels.map(label => (
          <AnimatedContent key={label} duration={2.2} delay={0}>
            {label}
          </AnimatedContent>
        ))}
      </AnimatedContentChain>,
    )
    await waitForChain()

    expect(motion.ScrollTrigger.create).toHaveBeenCalledTimes(1)
    expect(motion.timelines).toHaveLength(6)
    expect(motion.timelines.filter(timeline => timeline.to.mock.calls.length === 1)).toHaveLength(5)
    expect(motion.timelines.filter(timeline => timeline.call.mock.calls.length === 6)).toHaveLength(1)

    view.rerender(
      <AnimatedContentChain
        data-testid="elastic-menu-chain"
        className="provider-wrapper-changed"
        reducedMotion={false}
        pullAtPreviousProgress={0.42}
        threshold={0.1}
        exitStartViewportPercent={22}
      >
        {labels.map(label => (
          <AnimatedContent key={label} duration={2.2} delay={0}>
            {label}
          </AnimatedContent>
        ))}
      </AnimatedContentChain>,
    )

    expect(motion.ScrollTrigger.create).toHaveBeenCalledTimes(1)
    expect(motion.timelines).toHaveLength(6)
  })

  it('uses one shared non-scrubbed trigger, live DOM order, and exact zero-delay positions', async () => {
    const { registry } = chainView()
    await waitForChain()

    expect(registry.registrationOrder).toEqual([...labels].reverse())
    expect(motion.ScrollTrigger.create).toHaveBeenCalledTimes(1)
    expect(trigger().config).toEqual({
      trigger: expect.any(HTMLDivElement),
      scroller: window,
      start: 'top 90%',
      end: 'bottom 22%',
      onEnter: expect.any(Function),
      onLeaveBack: expect.any(Function),
      onLeave: expect.any(Function),
      onEnterBack: expect.any(Function),
      onRefresh: expect.any(Function),
    })
    expect(trigger().refresh).toHaveBeenCalledTimes(1)
    expect(trigger().config).not.toHaveProperty('scrub')
    expect(trigger().config).not.toHaveProperty('pin')
    expect(trigger().config).not.toHaveProperty('once')

    const calls = scheduledCalls()
    expect(calls.slice(0, 5).map(([, , playAt]) => playAt)).toEqual([
      0,
      0.924,
      1.848,
      2.772,
      3.696,
    ])
    expect(calls[5][2]).toBeCloseTo(5.896, 12)

    invoke(trigger().config.onEnter)
    expect(screen.getByTestId('elastic-menu-chain')).toHaveAttribute('data-elastic-menu-phase', 'entering')
    invoke(calls[0][0])
    expect(motion.events.filter(event => event.startsWith('play:'))).toEqual(['play:Thermodynamik'])
    expect(wrapperFor('Thermodynamik')).not.toHaveAttribute('inert')
    expect(wrapperFor('Carnot')).toHaveAttribute('inert')

    for (const [callback] of calls.slice(1, 5)) invoke(callback)
    expect(motion.events.filter(event => event.startsWith('play:'))).toEqual(
      labels.map(label => `play:${label}`),
    )
    invoke(calls[5][0])
    expect(screen.getByTestId('elastic-menu-chain')).toHaveAttribute('data-elastic-menu-phase', 'settled')
    for (const label of labels) expect(wrapperFor(label)).not.toHaveAttribute('inert')
  })

  it('keeps item delays on the motor and computes exact nonzero playAt and tweenStart positions', async () => {
    chainView({
      items: profiles(2, [0.2, 0.1, 0.1, 0.1, 0.1]),
      pullAtPreviousProgress: 0.5,
    })
    await waitForChain()

    const calls = scheduledCalls()
    const playAt = calls.slice(0, 5).map(([, , position]) => position)
    const itemDelays = [0.2, 0.1, 0.1, 0.1, 0.1]
    const tweenStart = playAt.map((position, index) => position + itemDelays[index])

    expect(playAt).toEqual([0, 1.2, 2.3, 3.4, 4.5])
    expect(tweenStart).toEqual([0.2, 1.3, 2.4, 3.5, 4.6])
    expect(calls[5][2]).toBe(6.6)
  })
})

describe('AnimatedContentChain lifecycle', () => {
  it('kills scheduling before entry, focuses without scrolling, and exits only after all current items complete', async () => {
    const { registry } = chainView()
    await waitForChain()
    const calls = scheduledCalls()
    invoke(trigger().config.onEnter)
    invoke(calls[0][0])
    invoke(calls[1][0])

    const focusedButton = screen.getByRole('button', { name: 'Carnot' })
    focusedButton.focus()
    expect(document.activeElement).toBe(focusedButton)
    const root = screen.getByTestId('elastic-menu-chain')
    const nativeFocus = root.focus.bind(root)
    const focus = vi.spyOn(root, 'focus').mockImplementation(options => {
      motion.events.push('root.focus')
      nativeFocus(options)
    })
    for (const label of labels) {
      const wrapper = wrapperFor(label)
      const nativeToggleAttribute = wrapper.toggleAttribute.bind(wrapper)
      vi.spyOn(wrapper, 'toggleAttribute').mockImplementation((name, force) => {
        if (name === 'inert' && force) motion.events.push(`inert:${label}`)
        return nativeToggleAttribute(name, force)
      })
    }
    motion.events.length = 0

    invoke(trigger().config.onLeave)

    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(document.activeElement).toBe(root)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exiting')
    expect(motion.events).toEqual([
      'root.focus',
      'scheduler.kill',
      ...labels.map(label => `cancelEntry:${label}`),
      ...labels.map(label => `inert:${label}`),
      ...labels.map(label => `disappear:${label}`),
    ])
    for (const label of labels) expect(wrapperFor(label)).toHaveAttribute('inert')
    for (const label of labels) {
      expect(controllerFor(registry, label).disappear).toHaveBeenCalledWith(0, expect.any(Function))
    }

    const playCountsAtExit = labels.map(label => controllerFor(registry, label).play.mock.calls.length)
    for (const [callback] of calls.slice(2)) invoke(callback)
    expect(labels.map(label => controllerFor(registry, label).play.mock.calls.length)).toEqual(playCountsAtExit)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exiting')

    const observers = labels.map(label => controllerFor(registry, label).disappear.mock.calls[0][1])
    for (const observer of observers.slice(0, 4)) invoke(observer)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exiting')
    invoke(observers[4])
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exited')
  })

  it('rescues focus through the foreign owner document before exit makes its children inert', async () => {
    const frame = document.createElement('iframe')
    document.body.append(frame)
    const foreignDocument = frame.contentDocument
    if (!foreignDocument) throw new Error('Foreign document fixture is unavailable')
    const mount = foreignDocument.createElement('div')
    foreignDocument.body.append(mount)
    const registry = createRegistry()
    const view = render(
      <AnimatedContentChain
        data-testid="foreign-elastic-menu-chain"
        container={null}
        reducedMotion={false}
        pullAtPreviousProgress={0.42}
        threshold={0.1}
        exitStartViewportPercent={22}
      >
        <ControlledItems items={profiles()} registry={registry} />
      </AnimatedContentChain>,
      { baseElement: foreignDocument.body, container: mount },
    )

    try {
      await waitForChain()
      const calls = scheduledCalls()
      invoke(trigger().config.onEnter)
      invoke(calls[0][0])
      invoke(calls[1][0])

      const root = foreignDocument.querySelector<HTMLDivElement>(
        '[data-testid="foreign-elastic-menu-chain"]',
      )
      const focusedButton = Array.from(foreignDocument.querySelectorAll('button'))
        .find(button => button.textContent === 'Carnot')
      if (!root || !focusedButton) throw new Error('Missing foreign Chain focus fixture')
      expect(root.ownerDocument).toBe(foreignDocument)
      focusedButton.focus()
      expect(foreignDocument.activeElement).toBe(focusedButton)
      expect(document.activeElement).not.toBe(focusedButton)

      const nativeFocus = root.focus.bind(root)
      const focus = vi.spyOn(root, 'focus').mockImplementation(options => {
        motion.events.push('foreign-root.focus')
        nativeFocus(options)
      })
      for (const controller of registry.controllers) {
        const nativeToggleAttribute = controller.element.toggleAttribute.bind(controller.element)
        vi.spyOn(controller.element, 'toggleAttribute').mockImplementation((name, force) => {
          if (name === 'inert' && force) motion.events.push(`inert:${controller.label}`)
          return nativeToggleAttribute(name, force)
        })
      }
      motion.events.length = 0

      invoke(trigger().config.onLeave)

      expect(focus).toHaveBeenCalledWith({ preventScroll: true })
      expect(foreignDocument.activeElement).toBe(root)
      expect(motion.events).toEqual([
        'foreign-root.focus',
        'scheduler.kill',
        ...labels.map(label => `cancelEntry:${label}`),
        ...labels.map(label => `inert:${label}`),
        ...labels.map(label => `disappear:${label}`),
      ])
    } finally {
      view.unmount()
      frame.remove()
    }
  })

  // Catches a missing upper callback, forward-order reversal, snapping at scroll stop, or a retained one-shot latch.
  it('autonomously reverses in exact causal reverse order, rearms initial, and replays entry', async () => {
    const { registry } = chainView()
    await waitForChain()
    const sharedTrigger = trigger()
    const firstEntry = scheduledCalls()
    invoke(sharedTrigger.config.onEnter)
    for (const [callback] of firstEntry) invoke(callback)
    const root = screen.getByTestId('elastic-menu-chain')
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')

    invoke(sharedTrigger.config.onLeaveBack)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'reversing')
    const reverseScheduler = currentScheduler()
    expect(reverseScheduler.options).toEqual({ paused: true })
    expect(reverseScheduler.play).toHaveBeenCalledTimes(1)
    const reverseCalls = scheduledCalls(reverseScheduler)
    expect(reverseCalls.slice(0, 5).map(([, , position]) => position)).toEqual([
      0,
      0.924,
      1.848,
      2.772,
      3.696,
    ])

    for (const [callback] of reverseCalls.slice(0, 5)) invoke(callback)
    expect(motion.events.filter(event => event.startsWith('reverse:'))).toEqual(
      labels.toReversed().map(label => `reverse:${label}`),
    )
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'reversing')

    invoke(reverseCalls[5][0])
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'initial')
    for (const label of labels) expect(wrapperFor(label)).toHaveAttribute('inert')

    const replayScheduler = currentScheduler()
    expect(replayScheduler).not.toBe(reverseScheduler)
    invoke(sharedTrigger.config.onEnter)
    for (const [callback] of scheduledCalls(replayScheduler)) invoke(callback)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    expect(labels.map(label => controllerFor(registry, label).play.mock.calls.length))
      .toEqual([2, 2, 2, 2, 2])
  })

  // Catches snapping/substitute tweens on direction change and a stale reverse scheduler overriding the latest entry.
  it('continues already-reversing owned timelines forward and ignores the stale reverse completion', async () => {
    const { registry } = chainView()
    await waitForChain()
    const sharedTrigger = trigger()
    invoke(sharedTrigger.config.onEnter)
    for (const [callback] of scheduledCalls()) invoke(callback)
    const root = screen.getByTestId('elastic-menu-chain')

    registry.autoEndpoints = false
    invoke(sharedTrigger.config.onLeaveBack)
    const reverseScheduler = currentScheduler()
    const reverseCalls = scheduledCalls(reverseScheduler)
    invoke(reverseCalls[0][0])
    invoke(reverseCalls[1][0])
    setControllerProgress(registry, 'Joule/Brayton', 0.4)
    setControllerProgress(registry, 'Diesel', 0.65)
    expect(motion.events.filter(event => event.startsWith('reverse:'))).toEqual([
      'reverse:Joule/Brayton',
      'reverse:Diesel',
    ])

    const substituteTweenCount = motion.gsap.to.mock.calls.length
    invoke(sharedTrigger.config.onEnter)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'entering')
    expect(controllerFor(registry, 'Joule/Brayton').play).toHaveBeenCalledTimes(2)
    expect(controllerFor(registry, 'Diesel').play).toHaveBeenCalledTimes(2)
    expect(controllerFor(registry, 'Otto').play).toHaveBeenCalledTimes(1)
    expect(motion.gsap.to).toHaveBeenCalledTimes(substituteTweenCount)

    invoke(reverseCalls[5][0])
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'entering')
    for (const label of ['Joule/Brayton', 'Diesel'] as const) {
      completeController(registry, label, 'forward')
    }
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    for (const label of labels) expect(wrapperFor(label)).not.toHaveAttribute('inert')
  })

  // Catches omission of never-entered motors and any terminal phase published before all real progress reaches one.
  it('settles every retained motor after partial entry, upward reverse, and early downward re-entry', async () => {
    const registry = createRegistry(false)
    chainView({ registry })
    await waitForChain()
    const sharedTrigger = trigger()
    const entryCalls = scheduledCalls()
    const root = screen.getByTestId('elastic-menu-chain')

    invoke(sharedTrigger.config.onEnter)
    invoke(entryCalls[0][0])
    setControllerProgress(registry, 'Thermodynamik', 0.25)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'entering')

    invoke(sharedTrigger.config.onLeaveBack)
    const reverseScheduler = currentScheduler()
    const reverseCalls = scheduledCalls(reverseScheduler)
    expect(reverseScheduler.play).toHaveBeenCalledTimes(1)
    expect(reverseCalls).toHaveLength(2)
    invoke(reverseCalls[0][0])
    expect(motion.events.filter(event => event.startsWith('reverse:'))).toEqual([
      'reverse:Thermodynamik',
    ])
    setControllerProgress(registry, 'Thermodynamik', 0.1)

    const substituteTweenCount = motion.gsap.to.mock.calls.length
    invoke(sharedTrigger.config.onEnter)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'entering')
    expect(registry.progressByLabel).toEqual(new Map([
      ['Thermodynamik', 0.1],
      ['Carnot', 0],
      ['Otto', 0],
      ['Diesel', 0],
      ['Joule/Brayton', 0],
    ]))
    expect(registry.controllers.every(controller => controller.settle.mock.calls.length === 0)).toBe(true)
    expect(motion.gsap.to).toHaveBeenCalledTimes(substituteTweenCount)

    const resumeScheduler = currentScheduler()
    const resumeCalls = scheduledCalls(resumeScheduler)
    expect(resumeScheduler.play).toHaveBeenCalledTimes(1)
    expect(resumeCalls).toHaveLength(4)
    expect(resumeCalls.map(([, , startAt]) => startAt)).toEqual([
      0.704,
      1.628,
      2.552,
      3.476,
    ])
    motion.events.length = 0
    completeController(registry, 'Thermodynamik', 'forward')
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'entering')
    for (const [index, label] of labels.slice(1).entries()) {
      invoke(resumeCalls[index][0])
      completeController(registry, label, 'forward')
      if (label !== 'Joule/Brayton') {
        expect(root).toHaveAttribute('data-elastic-menu-phase', 'entering')
      }
    }
    expect(motion.events.filter(event => event.startsWith('play:'))).toEqual(
      labels.slice(1).map(label => `play:${label}`),
    )

    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    expect([...registry.progressByLabel.values()]).toEqual([1, 1, 1, 1, 1])
    for (const label of labels) expect(wrapperFor(label)).not.toHaveAttribute('inert')
  })

  // Catches publishing initial during a rebuild while retained timelines remain at mixed partial progress.
  it('normalizes every retained motor to initial before publishing a reversing reconfiguration', async () => {
    const registry = createRegistry(true)
    const items = profiles()
    const renderTree = (pullAtPreviousProgress: number) => (
      <AnimatedContentChain
        data-testid="elastic-menu-chain"
        reducedMotion={false}
        pullAtPreviousProgress={pullAtPreviousProgress}
        threshold={0.1}
        exitStartViewportPercent={22}
      >
        <ControlledItems items={items} registry={registry} />
      </AnimatedContentChain>
    )
    const view = render(renderTree(0.42))
    await waitForChain()
    const sharedTrigger = currentTrigger()
    invoke(sharedTrigger.config.onEnter)
    for (const [callback] of scheduledCalls(currentScheduler())) invoke(callback)
    expect(screen.getByTestId('elastic-menu-chain')).toHaveAttribute('data-elastic-menu-phase', 'settled')

    registry.autoEndpoints = false
    invoke(sharedTrigger.config.onLeaveBack)
    const staleReverseScheduler = currentScheduler()
    const staleReverseCalls = scheduledCalls(staleReverseScheduler)
    invoke(staleReverseCalls[0][0])
    invoke(staleReverseCalls[1][0])
    setControllerProgress(registry, 'Joule/Brayton', 0.4)
    setControllerProgress(registry, 'Diesel', 0.65)

    view.rerender(renderTree(0.5))

    const root = screen.getByTestId('elastic-menu-chain')
    await waitFor(() => expect(root).toHaveAttribute('data-elastic-menu-phase', 'initial'))
    expect(staleReverseScheduler.kill).toHaveBeenCalledTimes(1)
    expect([...registry.progressByLabel.values()]).toEqual([0, 0, 0, 0, 0])
    for (const label of labels) {
      expect(controllerFor(registry, label).initializeInitial).toHaveBeenCalledTimes(1)
      expect(wrapperFor(label)).toHaveAttribute('inert')
    }

    const setCount = motion.gsap.set.mock.calls.length
    for (const [callback] of staleReverseCalls) invoke(callback)
    expect([...registry.progressByLabel.values()]).toEqual([0, 0, 0, 0, 0])
    expect(motion.gsap.set).toHaveBeenCalledTimes(setCount)

    registry.autoEndpoints = true
    invoke(currentTrigger().config.onEnter)
    for (const [callback] of scheduledCalls(currentScheduler())) invoke(callback)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    expect([...registry.progressByLabel.values()]).toEqual([1, 1, 1, 1, 1])
  })

  // Catches cycle counters or controller state that work once but fail to rearm deterministically.
  it('keeps five complete reverse and replay cycles deterministic on the same shared trigger', async () => {
    const { registry } = chainView()
    await waitForChain()
    const sharedTrigger = trigger()
    invoke(sharedTrigger.config.onEnter)
    for (const [callback] of scheduledCalls()) invoke(callback)
    const root = screen.getByTestId('elastic-menu-chain')

    for (let cycle = 0; cycle < 5; cycle += 1) {
      invoke(sharedTrigger.config.onLeaveBack)
      const reverseCalls = scheduledCalls(currentScheduler())
      for (const [callback] of reverseCalls) invoke(callback)
      expect(root).toHaveAttribute('data-elastic-menu-phase', 'initial')

      invoke(sharedTrigger.config.onEnter)
      const entryCalls = scheduledCalls(currentScheduler())
      for (const [callback] of entryCalls) invoke(callback)
      expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    }

    expect(motion.ScrollTrigger.create).toHaveBeenCalledTimes(1)
    expect(labels.map(label => controllerFor(registry, label).reverse.mock.calls.length))
      .toEqual([5, 5, 5, 5, 5])
    expect(labels.map(label => controllerFor(registry, label).play.mock.calls.length))
      .toEqual([6, 6, 6, 6, 6])
    expect(motion.gsap.to).not.toHaveBeenCalled()
  })

  it('settles immediately inside and initializes terminal exited state beyond the interval', async () => {
    motion.setNextTriggerState(0.5, true)
    const active = chainView()
    await waitForChain()
    expect(screen.getByTestId('elastic-menu-chain')).toHaveAttribute('data-elastic-menu-phase', 'settled')
    for (const label of labels) expect(wrapperFor(label)).not.toHaveAttribute('inert')
    expect(active.registry.controllers.every(controller => controller.play.mock.calls.length === 0)).toBe(true)
    active.unmount()

    motion.reset()
    motion.setNextTriggerState(1, false)
    const beyond = chainView()
    await waitForChain()
    const root = screen.getByTestId('elastic-menu-chain')
    await waitFor(() => expect(root).toHaveAttribute('data-elastic-menu-phase', 'exited'))
    for (const label of labels) {
      const controller = controllerFor(beyond.registry, label)
      expect(controller.initializeExited).toHaveBeenCalledTimes(1)
      expect(controller.disappear).not.toHaveBeenCalled()
      expect(wrapperFor(label)).toHaveAttribute('inert')
    }
    expect(beyond.registry.controllers.every(controller => controller.play.mock.calls.length === 0)).toBe(true)

    invoke(currentTrigger().config.onEnterBack)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    for (const label of labels) expect(wrapperFor(label)).not.toHaveAttribute('inert')
    expect(beyond.registry.controllers.every(controller => controller.play.mock.calls.length === 0)).toBe(true)
  })

  it('keeps the current StrictMode generation live and makes probed-generation callbacks inert', async () => {
    const entryComplete = vi.fn()
    const publicExit = vi.fn()
    const strictTree = (pullAtPreviousProgress: number) => (
      <React.StrictMode>
        <AnimatedContentChain
          data-testid="elastic-menu-chain"
          reducedMotion={false}
          pullAtPreviousProgress={pullAtPreviousProgress}
          threshold={0.1}
          exitStartViewportPercent={22}
        >
          <RealAnimatedItems
            distance={340}
            onComplete={entryComplete}
            onDisappearanceComplete={publicExit}
          />
        </AnimatedContentChain>
      </React.StrictMode>
    )
    const firstView = render(strictTree(0.42))

    await waitFor(() => {
      expect(motion.triggers.filter(candidate => candidate.kill.mock.calls.length === 0)).toHaveLength(1)
      expect(chainSchedulers().filter(candidate => candidate.kill.mock.calls.length === 0)).toHaveLength(1)
    })
    const root = screen.getByTestId('elastic-menu-chain')
    const postProbeTrigger = currentTrigger()
    const postProbeScheduler = currentScheduler()
    const probedItemTimelines = motion.timelines.filter(
      timeline => timeline.to.mock.calls.length === 1 && timeline.kill.mock.calls.length > 0,
    )
    expect(motion.triggers.filter(candidate => candidate !== postProbeTrigger)).toEqual([])
    expect(chainSchedulers().filter(candidate => candidate !== postProbeScheduler)).toEqual([])
    expect(probedItemTimelines).toHaveLength(5)

    firstView.rerender(strictTree(0.5))
    await waitFor(() => {
      expect(postProbeTrigger.kill).toHaveBeenCalledTimes(1)
      expect(postProbeScheduler.kill).toHaveBeenCalledTimes(1)
      expect(currentTrigger()).not.toBe(postProbeTrigger)
      expect(currentScheduler()).not.toBe(postProbeScheduler)
    })
    const liveTrigger = currentTrigger()
    const liveScheduler = currentScheduler()

    invoke(liveTrigger.config.onEnter)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'entering')
    const eventCountDuringLiveGeneration = motion.events.length
    invoke(postProbeTrigger.config.onEnter)
    invoke(postProbeTrigger.config.onLeave)
    invoke(postProbeTrigger.config.onEnterBack)
    act(() => {
      const onRefresh = postProbeTrigger.config.onRefresh
      if (typeof onRefresh !== 'function') throw new Error('Missing prior-generation onRefresh callback')
      onRefresh(postProbeTrigger)
    })
    for (const [callback] of scheduledCalls(postProbeScheduler)) invoke(callback)
    for (const timeline of probedItemTimelines) invoke(timeline.options.onComplete)
    expect(motion.events).toHaveLength(eventCountDuringLiveGeneration)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'entering')
    expect(entryComplete).not.toHaveBeenCalled()
    expect(publicExit).not.toHaveBeenCalled()

    for (const [callback] of scheduledCalls(liveScheduler)) invoke(callback)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')

    invoke(liveTrigger.config.onLeave)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exiting')
    const exitCallbacks = motion.gsap.to.mock.calls.slice(-5).map(([, payload]) => payload.onComplete)
    for (const callback of exitCallbacks) invoke(callback)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exited')
    expect(publicExit).toHaveBeenCalledTimes(5)
    invoke(liveTrigger.config.onEnterBack)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')

    const oldCallbacks = scheduledCalls(liveScheduler).map(([callback]) => callback)
    const oldItemCompletions = motion.timelines
      .filter(timeline => timeline.to.mock.calls.length === 1 && timeline.kill.mock.calls.length === 0)
      .map(timeline => timeline.options.onComplete)
    firstView.unmount()

    render(strictTree(0.42))
    await waitFor(() => {
      expect(motion.triggers.filter(candidate => candidate.kill.mock.calls.length === 0)).toHaveLength(1)
      expect(chainSchedulers().filter(candidate => candidate.kill.mock.calls.length === 0)).toHaveLength(1)
    })
    const remountedRoot = screen.getByTestId('elastic-menu-chain')
    const remountedTrigger = currentTrigger()
    const remountedScheduler = currentScheduler()
    invoke(remountedTrigger.config.onEnter)
    expect(remountedRoot).toHaveAttribute('data-elastic-menu-phase', 'entering')

    const eventCount = motion.events.length
    invoke(liveTrigger.config.onEnter)
    invoke(liveTrigger.config.onLeave)
    invoke(liveTrigger.config.onEnterBack)
    for (const callback of oldCallbacks) invoke(callback)
    for (const callback of oldItemCompletions) invoke(callback)
    expect(motion.events).toHaveLength(eventCount)
    expect(remountedRoot).toHaveAttribute('data-elastic-menu-phase', 'entering')
    expect(entryComplete).not.toHaveBeenCalled()
    expect(publicExit).toHaveBeenCalledTimes(5)

    for (const [callback] of scheduledCalls(remountedScheduler)) invoke(callback)
    expect(remountedRoot).toHaveAttribute('data-elastic-menu-phase', 'settled')
  })

  it('canonicalizes a chain-timing rebuild during entering to visible settled state', async () => {
    const onComplete = vi.fn()
    const renderTree = (pullAtPreviousProgress: number) => (
      <AnimatedContentChain
        data-testid="elastic-menu-chain"
        reducedMotion={false}
        pullAtPreviousProgress={pullAtPreviousProgress}
        threshold={0.1}
        exitStartViewportPercent={22}
      >
        <RealAnimatedItems distance={120} onComplete={onComplete} />
      </AnimatedContentChain>
    )
    const view = render(renderTree(0.42))
    await waitForChain()
    const oldTrigger = currentTrigger()
    const oldScheduler = currentScheduler()
    const staleCallbacks = scheduledCalls(oldScheduler).map(([callback]) => callback)
    invoke(oldTrigger.config.onEnter)
    invoke(staleCallbacks[0])
    expect(screen.getByTestId('elastic-menu-chain')).toHaveAttribute('data-elastic-menu-phase', 'entering')

    view.rerender(renderTree(0.5))

    const root = screen.getByTestId('elastic-menu-chain')
    await waitFor(() => expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled'))
    expect(oldTrigger.kill).toHaveBeenCalledTimes(1)
    expect(oldScheduler.kill).toHaveBeenCalledTimes(1)
    expect(chainSchedulers().filter(candidate => candidate.kill.mock.calls.length === 0)).toEqual([])
    expect(currentTrigger()).not.toBe(oldTrigger)
    for (const label of labels) {
      expect(lastSetPayload(label)).toEqual({ y: 0, scale: 1, opacity: 1, visibility: 'visible' })
      expect(wrapperFor(label)).not.toHaveAttribute('inert')
    }

    const setCount = motion.gsap.set.mock.calls.length
    const toCount = motion.gsap.to.mock.calls.length
    for (const callback of staleCallbacks) invoke(callback)
    invoke(oldTrigger.config.onLeave)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    expect(motion.gsap.set).toHaveBeenCalledTimes(setCount)
    expect(motion.gsap.to).toHaveBeenCalledTimes(toCount)
  })

  it('canonicalizes a real controller/profile replacement during entering to settled', async () => {
    const firstComplete = vi.fn()
    const replacementComplete = vi.fn()
    const renderTree = (distance: number, onComplete: () => void) => (
      <AnimatedContentChain
        data-testid="elastic-menu-chain"
        reducedMotion={false}
        pullAtPreviousProgress={0.42}
        threshold={0.1}
        exitStartViewportPercent={22}
      >
        <RealAnimatedItems distance={distance} onComplete={onComplete} />
      </AnimatedContentChain>
    )
    const view = render(renderTree(100, firstComplete))
    await waitForChain()
    const oldTrigger = currentTrigger()
    const oldScheduler = currentScheduler()
    const staleCallbacks = scheduledCalls(oldScheduler).map(([callback]) => callback)
    invoke(oldTrigger.config.onEnter)
    invoke(staleCallbacks[0])

    view.rerender(renderTree(180, replacementComplete))

    const root = screen.getByTestId('elastic-menu-chain')
    await waitFor(() => expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled'))
    expect(oldTrigger.kill).toHaveBeenCalledTimes(1)
    expect(oldScheduler.kill).toHaveBeenCalledTimes(1)
    expect(chainSchedulers().filter(candidate => candidate.kill.mock.calls.length === 0)).toEqual([])
    for (const label of labels) {
      expect(lastSetPayload(label)).toEqual({ y: 0, scale: 1, opacity: 1, visibility: 'visible' })
      expect(wrapperFor(label)).not.toHaveAttribute('inert')
    }
    expect(firstComplete).not.toHaveBeenCalled()
    expect(replacementComplete).not.toHaveBeenCalled()

    const setCount = motion.gsap.set.mock.calls.length
    for (const callback of staleCallbacks) invoke(callback)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    expect(motion.gsap.set).toHaveBeenCalledTimes(setCount)
  })

  it('canonicalizes real replacements in settled, exiting, and exited phases', async () => {
    const publicExit = vi.fn()
    const renderTree = (distance: number) => (
      <AnimatedContentChain
        data-testid="elastic-menu-chain"
        reducedMotion={false}
        pullAtPreviousProgress={0.42}
        threshold={0.1}
        exitStartViewportPercent={22}
      >
        <RealAnimatedItems
          distance={distance}
          onDisappearanceComplete={publicExit}
        />
      </AnimatedContentChain>
    )
    const view = render(renderTree(100))
    await waitForChain()
    invoke(currentTrigger().config.onEnter)
    for (const [callback] of scheduledCalls(currentScheduler())) invoke(callback)
    const root = screen.getByTestId('elastic-menu-chain')
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')

    view.rerender(renderTree(140))
    await waitFor(() => {
      for (const label of labels) {
        expect(lastSetPayload(label)).toEqual({ y: 0, scale: 1, opacity: 1, visibility: 'visible' })
      }
    })
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')

    const settledTrigger = currentTrigger()
    invoke(settledTrigger.config.onLeave)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exiting')
    expect(motion.gsap.to).toHaveBeenCalledTimes(5)
    const staleExitCallbacks = motion.gsap.to.mock.calls.map(([, payload]) => payload.onComplete)
    const tweenCount = motion.gsap.to.mock.calls.length

    view.rerender(renderTree(180))
    await waitFor(() => expect(root).toHaveAttribute('data-elastic-menu-phase', 'exited'))
    expect(settledTrigger.kill).toHaveBeenCalledTimes(1)
    expect(motion.gsap.to).toHaveBeenCalledTimes(tweenCount)
    for (const label of labels) {
      expect(lastSetPayload(label)).toEqual({
        y: -180,
        scale: 0.8,
        opacity: 0.2,
        visibility: 'visible',
      })
      expect(wrapperFor(label)).toHaveAttribute('inert')
    }

    for (const callback of staleExitCallbacks) invoke(callback)
    expect(publicExit).not.toHaveBeenCalled()
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exited')

    view.rerender(renderTree(220))
    await waitFor(() => {
      for (const label of labels) {
        expect(lastSetPayload(label)).toEqual({
          y: -220,
          scale: 0.8,
          opacity: 0.2,
          visibility: 'visible',
        })
      }
    })
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exited')
    expect(motion.gsap.to).toHaveBeenCalledTimes(tweenCount)
    expect(motion.triggers.filter(candidate => candidate.kill.mock.calls.length === 0)).toHaveLength(1)
    expect(chainSchedulers().filter(candidate => candidate.kill.mock.calls.length === 0)).toEqual([])

    const itemPlayCountBeforeRestore = motion.timelines
      .filter(timeline => timeline.to.mock.calls.length === 1)
      .reduce((count, timeline) => count + timeline.play.mock.calls.length, 0)
    invoke(currentTrigger().config.onEnterBack)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    for (const label of labels) {
      expect(lastSetPayload(label)).toEqual({ y: 0, scale: 1, opacity: 1, visibility: 'visible' })
      expect(wrapperFor(label)).not.toHaveAttribute('inert')
    }
    expect(motion.timelines
      .filter(timeline => timeline.to.mock.calls.length === 1)
      .reduce((count, timeline) => count + timeline.play.mock.calls.length, 0))
      .toBe(itemPlayCountBeforeRestore)
  })

  it('uses callback-free real terminal initialization beyond exit and restores without intro', async () => {
    motion.setNextTriggerState(1, false)
    const entryComplete = vi.fn()
    const publicExit = vi.fn()
    render(
      <AnimatedContentChain
        data-testid="elastic-menu-chain"
        reducedMotion={false}
        pullAtPreviousProgress={0.42}
        threshold={0.1}
        exitStartViewportPercent={22}
      >
        <RealAnimatedItems
          distance={240}
          onComplete={entryComplete}
          onDisappearanceComplete={publicExit}
        />
      </AnimatedContentChain>,
    )

    const root = screen.getByTestId('elastic-menu-chain')
    await waitFor(() => expect(root).toHaveAttribute('data-elastic-menu-phase', 'exited'))
    expect(motion.gsap.to).not.toHaveBeenCalled()
    expect(entryComplete).not.toHaveBeenCalled()
    expect(publicExit).not.toHaveBeenCalled()
    for (const label of labels) {
      expect(lastSetPayload(label)).toEqual({
        y: -240,
        scale: 0.8,
        opacity: 0.2,
        visibility: 'visible',
      })
      expect(wrapperFor(label)).toHaveAttribute('inert')
    }
    expect(motion.timelines.filter(timeline => timeline.to.mock.calls.length === 1)
      .every(timeline => timeline.play.mock.calls.length === 0)).toBe(true)

    invoke(currentTrigger().config.onEnterBack)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    for (const label of labels) {
      expect(lastSetPayload(label)).toEqual({ y: 0, scale: 1, opacity: 1, visibility: 'visible' })
      expect(wrapperFor(label)).not.toHaveAttribute('inert')
    }
    expect(entryComplete).not.toHaveBeenCalled()
    expect(publicExit).not.toHaveBeenCalled()
  })

  it('reconciles a replacement trigger constructed beyond exit without an exit tween or replay', async () => {
    const entryComplete = vi.fn()
    const publicExit = vi.fn()
    const renderTree = (pullAtPreviousProgress: number) => (
      <AnimatedContentChain
        data-testid="elastic-menu-chain"
        reducedMotion={false}
        pullAtPreviousProgress={pullAtPreviousProgress}
        threshold={0.1}
        exitStartViewportPercent={22}
      >
        <RealAnimatedItems
          distance={260}
          onComplete={entryComplete}
          onDisappearanceComplete={publicExit}
        />
      </AnimatedContentChain>
    )
    const view = render(renderTree(0.42))
    await waitForChain()
    invoke(currentTrigger().config.onEnter)
    for (const [callback] of scheduledCalls(currentScheduler())) invoke(callback)
    const root = screen.getByTestId('elastic-menu-chain')
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    const itemPlayCount = motion.timelines
      .filter(timeline => timeline.to.mock.calls.length === 1)
      .reduce((count, timeline) => count + timeline.play.mock.calls.length, 0)
    const exitTweenCount = motion.gsap.to.mock.calls.length

    motion.setNextTriggerState(1, false)
    view.rerender(renderTree(0.5))

    await waitFor(() => expect(root).toHaveAttribute('data-elastic-menu-phase', 'exited'))
    expect(motion.gsap.to).toHaveBeenCalledTimes(exitTweenCount)
    expect(publicExit).not.toHaveBeenCalled()
    for (const label of labels) {
      expect(lastSetPayload(label)).toEqual({
        y: -260,
        scale: 0.8,
        opacity: 0.2,
        visibility: 'visible',
      })
      expect(wrapperFor(label)).toHaveAttribute('inert')
    }

    invoke(currentTrigger().config.onEnterBack)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    expect(motion.timelines
      .filter(timeline => timeline.to.mock.calls.length === 1)
      .reduce((count, timeline) => count + timeline.play.mock.calls.length, 0))
      .toBe(itemPlayCount)
  })

  it('reconciles a later refresh of the same settled trigger beyond exit without animation', async () => {
    const entryComplete = vi.fn()
    const publicExit = vi.fn()
    render(
      <AnimatedContentChain
        data-testid="elastic-menu-chain"
        reducedMotion={false}
        pullAtPreviousProgress={0.42}
        threshold={0.1}
        exitStartViewportPercent={22}
      >
        <RealAnimatedItems
          distance={280}
          onComplete={entryComplete}
          onDisappearanceComplete={publicExit}
        />
      </AnimatedContentChain>,
    )
    await waitForChain()
    const settledTrigger = currentTrigger()
    invoke(settledTrigger.config.onEnter)
    for (const [callback] of scheduledCalls(currentScheduler())) invoke(callback)
    const root = screen.getByTestId('elastic-menu-chain')
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    const itemPlayCount = motion.timelines
      .filter(timeline => timeline.to.mock.calls.length === 1)
      .reduce((count, timeline) => count + timeline.play.mock.calls.length, 0)
    const exitTweenCount = motion.gsap.to.mock.calls.length

    motion.setNextTriggerState(1, false)
    act(() => { settledTrigger.refresh() })

    expect(currentTrigger()).toBe(settledTrigger)
    expect(motion.ScrollTrigger.create).toHaveBeenCalledTimes(1)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exited')
    expect(motion.gsap.to).toHaveBeenCalledTimes(exitTweenCount)
    expect(entryComplete).not.toHaveBeenCalled()
    expect(publicExit).not.toHaveBeenCalled()
    for (const label of labels) {
      expect(lastSetPayload(label)).toEqual({
        y: -280,
        scale: 0.8,
        opacity: 0.2,
        visibility: 'visible',
      })
      expect(wrapperFor(label)).toHaveAttribute('inert')
    }

    invoke(settledTrigger.config.onEnterBack)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    for (const label of labels) {
      expect(lastSetPayload(label)).toEqual({ y: 0, scale: 1, opacity: 1, visibility: 'visible' })
      expect(wrapperFor(label)).not.toHaveAttribute('inert')
    }
    expect(motion.timelines
      .filter(timeline => timeline.to.mock.calls.length === 1)
      .reduce((count, timeline) => count + timeline.play.mock.calls.length, 0))
      .toBe(itemPlayCount)
  })

  it.each(['initial', 'entering', 'exited'] as const)(
    'reconciles a live %s chain to visible interactive Reduced Motion without new motion',
    async (startingPhase) => {
      if (startingPhase === 'exited') motion.setNextTriggerState(1, false)
      const entryComplete = vi.fn()
      const publicExit = vi.fn()
      const renderTree = (reducedMotion: boolean) => (
        <AnimatedContentChain
          data-testid="elastic-menu-chain"
          reducedMotion={reducedMotion}
          pullAtPreviousProgress={0.42}
          threshold={0.1}
          exitStartViewportPercent={22}
        >
          <RealAnimatedItems
            distance={300}
            onComplete={entryComplete}
            onDisappearanceComplete={publicExit}
          />
        </AnimatedContentChain>
      )
      const view = render(renderTree(false))
      await waitForChain()
      const root = screen.getByTestId('elastic-menu-chain')
      if (startingPhase === 'entering') {
        invoke(currentTrigger().config.onEnter)
        invoke(scheduledCalls(currentScheduler())[0][0])
      }
      await waitFor(() => expect(root).toHaveAttribute('data-elastic-menu-phase', startingPhase))

      const staleTrigger = currentTrigger()
      const staleScheduler = chainSchedulers()[0]
      const staleSchedulerCallbacks = scheduledCalls(staleScheduler).map(([callback]) => callback)
      const staleItemCompletions = motion.timelines
        .filter(timeline => timeline.to.mock.calls.length === 1)
        .map(timeline => timeline.options.onComplete)
      const timelineCount = motion.timelines.length
      const triggerCount = motion.triggers.length
      const exitTweenCount = motion.gsap.to.mock.calls.length

      view.rerender(renderTree(true))

      await waitFor(() => expect(root).toHaveAttribute('data-elastic-menu-phase', 'reduced'))
      expect(motion.timelines).toHaveLength(timelineCount)
      expect(motion.triggers).toHaveLength(triggerCount)
      expect(motion.gsap.to).toHaveBeenCalledTimes(exitTweenCount)
      expect(motion.triggers.filter(candidate => candidate.kill.mock.calls.length === 0)).toEqual([])
      expect(chainSchedulers().filter(candidate => candidate.kill.mock.calls.length === 0)).toEqual([])
      for (const label of labels) {
        expect(lastSetPayload(label)).toEqual({ y: 0, scale: 1, opacity: 1, visibility: 'visible' })
        expect(wrapperFor(label)).not.toHaveAttribute('inert')
        expect(wrapperFor(label)).toHaveStyle({ visibility: 'visible' })
      }
      const firstButton = screen.getByRole('button', { name: labels[0] })
      firstButton.focus()
      expect(document.activeElement).toBe(firstButton)

      const setCount = motion.gsap.set.mock.calls.length
      invoke(staleTrigger.config.onEnter)
      invoke(staleTrigger.config.onLeave)
      invoke(staleTrigger.config.onEnterBack)
      act(() => {
        const onRefresh = staleTrigger.config.onRefresh
        if (typeof onRefresh !== 'function') throw new Error('Missing stale onRefresh callback')
        onRefresh(staleTrigger)
      })
      for (const callback of staleSchedulerCallbacks) invoke(callback)
      for (const completion of staleItemCompletions) invoke(completion)
      expect(root).toHaveAttribute('data-elastic-menu-phase', 'reduced')
      expect(motion.gsap.set).toHaveBeenCalledTimes(setCount)
      expect(motion.gsap.to).toHaveBeenCalledTimes(exitTweenCount)
      expect(entryComplete).not.toHaveBeenCalled()
      expect(publicExit).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['initial', 0, false, true, { y: 320, scale: 1, opacity: 0.2, visibility: 'visible' }],
    ['settled', 0.5, true, false, { y: 0, scale: 1, opacity: 1, visibility: 'visible' }],
    ['exited', 1, false, true, { y: -320, scale: 0.8, opacity: 0.2, visibility: 'visible' }],
  ] as const)(
    'restores Reduced Motion to canonical normal phase %s at trigger progress %s',
    async (expectedPhase, progress, isActive, expectedInert, expectedPayload) => {
      const entryComplete = vi.fn()
      const publicExit = vi.fn()
      const renderTree = (reducedMotion: boolean) => (
        <AnimatedContentChain
          data-testid="elastic-menu-chain"
          reducedMotion={reducedMotion}
          pullAtPreviousProgress={0.42}
          threshold={0.1}
          exitStartViewportPercent={22}
        >
          <RealAnimatedItems
            distance={320}
            onComplete={entryComplete}
            onDisappearanceComplete={publicExit}
          />
        </AnimatedContentChain>
      )
      const view = render(renderTree(true))
      const root = screen.getByTestId('elastic-menu-chain')
      expect(root).toHaveAttribute('data-elastic-menu-phase', 'reduced')
      expect(motion.timelines).toEqual([])
      expect(motion.triggers).toEqual([])

      motion.setNextTriggerState(progress, isActive)
      view.rerender(renderTree(false))

      await waitFor(() => expect(root).toHaveAttribute('data-elastic-menu-phase', expectedPhase))
      expect(motion.ScrollTrigger.create).toHaveBeenCalledTimes(1)
      expect(motion.gsap.to).not.toHaveBeenCalled()
      expect(motion.timelines.filter(timeline => timeline.to.mock.calls.length === 1))
        .toHaveLength(5)
      expect(motion.timelines.filter(timeline => timeline.to.mock.calls.length === 1)
        .every(timeline => timeline.play.mock.calls.length === 0)).toBe(true)
      for (const label of labels) {
        expect(lastSetPayload(label)).toEqual(expectedPayload)
        expect(wrapperFor(label).hasAttribute('inert')).toBe(expectedInert)
      }
      expect(entryComplete).not.toHaveBeenCalled()
      expect(publicExit).not.toHaveBeenCalled()
    },
  )

  it('keeps provider semantics stable and performs only scoped unmount cleanup with no late work', async () => {
    const registry = createRegistry()
    const items = profiles()
    const firstPhase = vi.fn()
    const view = chainView({ registry, items, className: 'first', onPhaseChange: firstPhase })
    await waitForChain()
    const sharedTrigger = trigger()
    const sharedScheduler = scheduler()
    const staleCallbacks = scheduledCalls().map(([callback]) => callback)

    view.rerender(
      <AnimatedContentChain
        data-testid="elastic-menu-chain"
        className="second"
        reducedMotion={false}
        pullAtPreviousProgress={0.42}
        threshold={0.1}
        exitStartViewportPercent={22}
        onPhaseChange={vi.fn()}
      >
        <ControlledItems items={items} registry={registry} />
      </AnimatedContentChain>,
    )

    expect(registry.controllers).toHaveLength(5)
    expect(registry.unregisterOrder).toEqual([])
    expect(motion.timelines).toHaveLength(1)
    expect(motion.triggers).toHaveLength(1)

    view.unmount()
    expect(sharedTrigger.kill).toHaveBeenCalledTimes(1)
    expect(sharedScheduler.kill).toHaveBeenCalledTimes(1)
    expect(registry.unregisterOrder).toEqual([...labels].reverse())
    for (const controller of registry.controllers) expect(controller.kill).toHaveBeenCalledTimes(1)

    const eventCount = motion.events.length
    for (const callback of staleCallbacks) invoke(callback)
    expect(motion.events).toHaveLength(eventCount)
  })

  it('renders Reduced Motion settled and interactive without constructing motion objects', async () => {
    const registry = createRegistry()
    const view = chainView({ registry, reducedMotion: true, layoutRevision: 'closed' })

    const root = screen.getByTestId('elastic-menu-chain')
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'reduced')
    for (const label of labels) expect(wrapperFor(label)).not.toHaveAttribute('inert')
    expect(registry.controllers).toEqual([])
    expect(motion.gsap.timeline).not.toHaveBeenCalled()
    expect(motion.gsap.set).not.toHaveBeenCalled()
    expect(motion.gsap.to).not.toHaveBeenCalled()
    expect(motion.ScrollTrigger.create).not.toHaveBeenCalled()

    view.rerender(
      <AnimatedContentChain
        data-testid="elastic-menu-chain"
        layoutRevision="joule"
        reducedMotion
        pullAtPreviousProgress={0.42}
        threshold={0.1}
        exitStartViewportPercent={22}
      >
        <ControlledItems items={view.items} registry={registry} />
      </AnimatedContentChain>,
    )
    expect(motion.gsap.timeline).not.toHaveBeenCalled()
    expect(motion.gsap.to).not.toHaveBeenCalled()
    expect(motion.ScrollTrigger.create).not.toHaveBeenCalled()
  })
})

describe('AnimatedContentChain transition characterization', () => {
  it('publishes settled from real item completions after every public entry callback and before the scheduler fallback', async () => {
    const order: string[] = []
    render(
      <AnimatedContentChain
        data-testid="elastic-menu-chain"
        reducedMotion={false}
        pullAtPreviousProgress={0.42}
        threshold={0.1}
        exitStartViewportPercent={22}
        onPhaseChange={nextPhase => order.push(`phase:${nextPhase}`)}
      >
        {labels.map(label => (
          <AnimatedContent
            key={label}
            duration={2.2}
            onComplete={() => order.push(`public:${label}`)}
          >
            {label}
          </AnimatedContent>
        ))}
      </AnimatedContentChain>,
    )
    await waitForChain()
    const root = screen.getByTestId('elastic-menu-chain')
    const sharedTrigger = currentTrigger()
    const entryScheduler = currentScheduler()
    const entryCalls = scheduledCalls(entryScheduler)
    const itemTimelines = labels.map(label => itemTimelineFor(label))
    const timelineIdentities = [...motion.timelines]

    invoke(sharedTrigger.config.onEnter)
    expect(order).toEqual(['phase:entering'])
    for (const [index] of labels.entries()) {
      invoke(entryCalls[index][0])
      invoke(itemTimelines[index].options.onComplete)
      expect(root).toHaveAttribute(
        'data-elastic-menu-phase',
        index === labels.length - 1 ? 'settled' : 'entering',
      )
    }

    expect(order).toEqual([
      'phase:entering',
      ...labels.map(label => `public:${label}`),
      'phase:settled',
    ])
    expect(entryCalls).toHaveLength(labels.length + 1)

    const settledOrder = [...order]
    const eventCount = motion.events.length
    const playCounts = itemTimelines.map(timeline => timeline.play.mock.calls.length)
    invoke(entryCalls.at(-1)?.[0])
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    expect(order).toEqual(settledOrder)
    expect(motion.events).toHaveLength(eventCount)
    expect(currentTrigger()).toBe(sharedTrigger)
    expect(motion.timelines).toHaveLength(timelineIdentities.length)
    for (const [index, timeline] of motion.timelines.entries()) {
      expect(timeline).toBe(timelineIdentities[index])
    }
    for (const [index, timeline] of itemTimelines.entries()) {
      expect(itemTimelineFor(labels[index])).toBe(timeline)
      expect(timeline.play).toHaveBeenCalledTimes(playCounts[index])
    }
  })

  it('finishes zero-progress and real reverse completions before rearming the same trigger', async () => {
    const zeroProgressPhases: string[] = []
    const zeroProgressView = chainView({
      registry: createRegistry(false),
      onPhaseChange: phase => zeroProgressPhases.push(phase),
    })
    await waitForChain()
    const zeroProgressRoot = screen.getByTestId('elastic-menu-chain')
    const zeroProgressTrigger = currentTrigger()
    const unusedEntryScheduler = currentScheduler()

    expect(zeroProgressPhases).toEqual([])
    invoke(zeroProgressTrigger.config.onEnter)
    invoke(zeroProgressTrigger.config.onLeaveBack)

    expect(zeroProgressRoot).toHaveAttribute('data-elastic-menu-phase', 'initial')
    expect(zeroProgressPhases).toEqual(['entering', 'reversing', 'initial'])
    expect(motion.events.filter(event => event.startsWith('reverse:'))).toEqual([])
    expect(unusedEntryScheduler.kill).toHaveBeenCalledTimes(1)
    expect(currentTrigger()).toBe(zeroProgressTrigger)
    expect(currentScheduler()).not.toBe(unusedEntryScheduler)

    zeroProgressView.unmount()
    motion.reset()

    const phases: string[] = []
    render(
      <AnimatedContentChain
        data-testid="elastic-menu-chain"
        reducedMotion={false}
        pullAtPreviousProgress={0.42}
        threshold={0.1}
        exitStartViewportPercent={22}
        onPhaseChange={phase => phases.push(phase)}
      >
        {labels.map(label => (
          <AnimatedContent key={label} duration={2.2}>{label}</AnimatedContent>
        ))}
      </AnimatedContentChain>,
    )
    await waitForChain()
    const root = screen.getByTestId('elastic-menu-chain')
    const sharedTrigger = currentTrigger()
    const itemTimelines = labels.map(label => itemTimelineFor(label))

    invoke(sharedTrigger.config.onEnter)
    for (const [index] of labels.entries()) {
      invoke(scheduledCalls(currentScheduler())[index][0])
      invoke(itemTimelines[index].options.onComplete)
    }
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')

    phases.length = 0
    invoke(sharedTrigger.config.onLeaveBack)
    const reverseScheduler = currentScheduler()
    const reverseCalls = scheduledCalls(reverseScheduler)
    expect(phases).toEqual(['reversing'])

    for (const [index, timeline] of itemTimelines.toReversed().entries()) {
      invoke(reverseCalls[index][0])
      invoke(timeline.options.onReverseComplete)
      expect(root).toHaveAttribute(
        'data-elastic-menu-phase',
        index === labels.length - 1 ? 'initial' : 'reversing',
      )
    }

    const rearmedScheduler = currentScheduler()
    expect(rearmedScheduler).not.toBe(reverseScheduler)
    expect(currentTrigger()).toBe(sharedTrigger)
    expect(phases).toEqual(['reversing', 'initial'])

    invoke(sharedTrigger.config.onEnter)
    for (const [index] of labels.entries()) {
      invoke(scheduledCalls(rearmedScheduler)[index][0])
      invoke(itemTimelines[index].options.onComplete)
    }
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    expect(phases).toEqual(['reversing', 'initial', 'entering', 'settled'])
    const currentItemTimelines = motion.timelines
      .filter(timeline => timeline.to.mock.calls.length === 1)
    expect(currentItemTimelines).toHaveLength(itemTimelines.length)
    for (const [index, timeline] of currentItemTimelines.entries()) {
      expect(timeline).toBe(itemTimelines[index])
      expect(itemTimelineFor(labels[index])).toBe(timeline)
    }
  })

  it('restores a live exit with exact settle order and rejects every stale exit completion', async () => {
    const registry = createRegistry()
    const items = profiles()
    const supersededPhases: string[] = []
    const latestPhases: string[] = []
    const renderTree = (onPhaseChange: (phase: string) => void) => (
      <AnimatedContentChain
        data-testid="elastic-menu-chain"
        reducedMotion={false}
        pullAtPreviousProgress={0.42}
        threshold={0.1}
        exitStartViewportPercent={22}
        onPhaseChange={onPhaseChange}
      >
        <ControlledItems items={items} registry={registry} />
      </AnimatedContentChain>
    )
    const view = render(renderTree(phase => supersededPhases.push(phase)))
    await waitForChain()
    const root = screen.getByTestId('elastic-menu-chain')
    const sharedTrigger = currentTrigger()
    const controllerIdentities = [...registry.controllers]

    invoke(sharedTrigger.config.onEnter)
    for (const [callback] of scheduledCalls(currentScheduler())) invoke(callback)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    expect(supersededPhases).toEqual(['entering', 'settled'])

    view.rerender(renderTree(phase => {
      latestPhases.push(phase)
      motion.events.push(`phase:${phase}`)
    }))
    invoke(sharedTrigger.config.onLeave)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exiting')
    const staleExitCompletions = labels.map(
      label => controllerFor(registry, label).disappear.mock.calls.at(-1)?.[1],
    )

    for (const label of labels) {
      const wrapper = wrapperFor(label)
      const nativeToggleAttribute = wrapper.toggleAttribute.bind(wrapper)
      vi.spyOn(wrapper, 'toggleAttribute').mockImplementation((name, force) => {
        if (name === 'inert' && force === false) motion.events.push(`interactive:${label}`)
        return nativeToggleAttribute(name, force)
      })
    }
    motion.events.length = 0

    invoke(sharedTrigger.config.onEnterBack)

    expect(motion.events.filter(event => event === 'phase:settled')).toHaveLength(1)
    expect(motion.events).toHaveLength(labels.length * 2 + 1)
    const settledPhaseIndex = motion.events.indexOf('phase:settled')
    for (const label of labels) {
      const settleEvent = `settle:${label}`
      const interactiveEvent = `interactive:${label}`
      expect(motion.events.filter(event => event === settleEvent)).toHaveLength(1)
      expect(motion.events.filter(event => event === interactiveEvent)).toHaveLength(1)
      expect(motion.events.indexOf(settleEvent)).toBeLessThan(settledPhaseIndex)
      expect(motion.events.indexOf(interactiveEvent)).toBeLessThan(settledPhaseIndex)
    }
    expect(latestPhases).toEqual(['exiting', 'settled'])
    expect(supersededPhases).toEqual(['entering', 'settled'])
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    expect(currentTrigger()).toBe(sharedTrigger)
    expect(registry.controllers).toHaveLength(controllerIdentities.length)
    for (const [index, controller] of registry.controllers.entries()) {
      expect(controller).toBe(controllerIdentities[index])
    }
    for (const label of labels) expect(wrapperFor(label)).not.toHaveAttribute('inert')

    invoke(sharedTrigger.config.onLeave)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exiting')
    const currentExitCompletions = labels.map(
      label => controllerFor(registry, label).disappear.mock.calls.at(-1)?.[1],
    )
    const eventCount = motion.events.length
    for (const completion of staleExitCompletions) invoke(completion)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exiting')
    expect(latestPhases).toEqual(['exiting', 'settled', 'exiting'])
    expect(motion.events).toHaveLength(eventCount)

    for (const completion of currentExitCompletions.slice(0, -1)) invoke(completion)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exiting')
    invoke(currentExitCompletions.at(-1))
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exited')
    expect(latestPhases).toEqual(['exiting', 'settled', 'exiting', 'exited'])
  })

  it('keeps invalid events and stale onLeaveBack command-free while preserving broad jumps', async () => {
    const registry = createRegistry()
    const items = profiles()
    const phases: string[] = []
    const onPhaseChange = (phase: string) => phases.push(phase)
    const renderTree = (pullAtPreviousProgress: number) => (
      <AnimatedContentChain
        data-testid="elastic-menu-chain"
        reducedMotion={false}
        pullAtPreviousProgress={pullAtPreviousProgress}
        threshold={0.1}
        exitStartViewportPercent={22}
        onPhaseChange={onPhaseChange}
      >
        <ControlledItems items={items} registry={registry} />
      </AnimatedContentChain>
    )
    const view = render(renderTree(0.42))
    await waitForChain()
    const root = screen.getByTestId('elastic-menu-chain')
    const sharedTrigger = currentTrigger()
    const controllerIdentities = [...registry.controllers]
    const commandCount = () => registry.controllers.reduce((count, controller) => (
      count
      + controller.play.mock.calls.length
      + controller.reverse.mock.calls.length
      + controller.cancelEntry.mock.calls.length
      + controller.disappear.mock.calls.length
      + controller.initializeInitial.mock.calls.length
      + controller.initializeExited.mock.calls.length
      + controller.settle.mock.calls.length
      + controller.kill.mock.calls.length
    ), 0)
    const assertNoOps = (
      phase: string,
      callbacks: ReadonlyArray<readonly [string, unknown]>,
    ) => {
      for (const [event, callback] of callbacks) {
        const beforeEvents = motion.events.length
        const beforeCommands = commandCount()
        const beforePhaseCallbacks = phases.length
        const beforeTriggers = motion.triggers.filter(candidate => candidate.kill.mock.calls.length === 0)
        const beforeSchedulers = chainSchedulers()
          .filter(candidate => candidate.kill.mock.calls.length === 0)

        invoke(callback)

        expect(root, `${phase}:${event}`).toHaveAttribute('data-elastic-menu-phase', phase)
        expect(motion.events, `${phase}:${event}`).toHaveLength(beforeEvents)
        expect(commandCount(), `${phase}:${event}`).toBe(beforeCommands)
        expect(phases, `${phase}:${event}`).toHaveLength(beforePhaseCallbacks)
        const activeTriggers = motion.triggers
          .filter(candidate => candidate.kill.mock.calls.length === 0)
        expect(activeTriggers, `${phase}:${event}`).toHaveLength(beforeTriggers.length)
        for (const [index, activeTrigger] of activeTriggers.entries()) {
          expect(activeTrigger, `${phase}:${event}:trigger:${index}`)
            .toBe(beforeTriggers[index])
        }
        const activeSchedulers = chainSchedulers()
          .filter(candidate => candidate.kill.mock.calls.length === 0)
        expect(activeSchedulers, `${phase}:${event}`).toHaveLength(beforeSchedulers.length)
        for (const [index, activeScheduler] of activeSchedulers.entries()) {
          expect(activeScheduler, `${phase}:${event}:scheduler:${index}`)
            .toBe(beforeSchedulers[index])
        }
        expect(registry.controllers, `${phase}:${event}`)
          .toHaveLength(controllerIdentities.length)
        for (const [index, controller] of registry.controllers.entries()) {
          expect(controller, `${phase}:${event}:controller:${index}`)
            .toBe(controllerIdentities[index])
        }
      }
    }

    expect(phases).toEqual([])
    assertNoOps('initial', [
      ['onLeaveBack', sharedTrigger.config.onLeaveBack],
      ['onEnterBack', sharedTrigger.config.onEnterBack],
    ])

    invoke(sharedTrigger.config.onEnter)
    assertNoOps('entering', [['onEnter', sharedTrigger.config.onEnter]])
    invoke(sharedTrigger.config.onEnterBack)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
    assertNoOps('settled', [
      ['onEnter', sharedTrigger.config.onEnter],
      ['onEnterBack', sharedTrigger.config.onEnterBack],
    ])

    invoke(sharedTrigger.config.onLeaveBack)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'reversing')
    assertNoOps('reversing', [['onLeaveBack', sharedTrigger.config.onLeaveBack]])
    invoke(sharedTrigger.config.onLeave)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exiting')
    assertNoOps('exiting', [
      ['onEnter', sharedTrigger.config.onEnter],
      ['onLeaveBack', sharedTrigger.config.onLeaveBack],
      ['onLeave', sharedTrigger.config.onLeave],
    ])
    invoke(sharedTrigger.config.onEnterBack)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')

    view.rerender(renderTree(0.5))
    await waitFor(() => expect(currentTrigger()).not.toBe(sharedTrigger))
    const replacementTrigger = currentTrigger()
    assertNoOps('settled', [['stale onLeaveBack', sharedTrigger.config.onLeaveBack]])

    invoke(replacementTrigger.config.onLeave)
    const exitCompletions = labels.map(
      label => controllerFor(registry, label).disappear.mock.calls.at(-1)?.[1],
    )
    for (const completion of exitCompletions) invoke(completion)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exited')
    assertNoOps('exited', [
      ['onEnter', replacementTrigger.config.onEnter],
      ['onLeaveBack', replacementTrigger.config.onLeaveBack],
      ['onLeave', replacementTrigger.config.onLeave],
    ])

    invoke(replacementTrigger.config.onEnterBack)
    invoke(replacementTrigger.config.onLeaveBack)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'reversing')
    invoke(replacementTrigger.config.onEnterBack)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')

    view.unmount()
    motion.reset()
    const initialExitPhases: string[] = []
    const initialExitView = chainView({
      onPhaseChange: phase => initialExitPhases.push(phase),
    })
    await waitForChain()
    invoke(currentTrigger().config.onLeave)
    expect(screen.getByTestId('elastic-menu-chain'))
      .toHaveAttribute('data-elastic-menu-phase', 'exiting')
    expect(initialExitPhases).toEqual(['exiting'])
    expect(initialExitView.registry.controllers.map(controller => controller.disappear.mock.calls.length))
      .toEqual([1, 1, 1, 1, 1])
  })

  it('lets one layout refresh past the end dominate live entry and invalidate all stale work', async () => {
    const registry = createRegistry(false)
    const items = profiles()
    const phases: string[] = []
    const renderTree = (layoutRevision: string) => (
      <AnimatedContentChain
        data-testid="elastic-menu-chain"
        layoutRevision={layoutRevision}
        reducedMotion={false}
        pullAtPreviousProgress={0.42}
        threshold={0.1}
        exitStartViewportPercent={22}
        onPhaseChange={phase => phases.push(phase)}
      >
        <ControlledItems items={items} registry={registry} />
      </AnimatedContentChain>
    )
    const view = render(renderTree('closed'))
    await waitForChain()
    const root = screen.getByTestId('elastic-menu-chain')
    const sharedTrigger = currentTrigger()
    const entryScheduler = currentScheduler()
    const entryCalls = scheduledCalls(entryScheduler)
    const controllerIdentities = [...registry.controllers]
    const timelineIdentities = [...motion.timelines]

    expect(phases).toEqual([])
    expect(sharedTrigger.refresh).toHaveBeenCalledTimes(1)
    invoke(sharedTrigger.config.onEnter)
    invoke(entryCalls[0][0])
    setControllerProgress(registry, labels[0], 0.35)
    const staleForwardCompletion = registry.forwardObservers.get(labels[0])?.at(-1)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'entering')

    motion.setNextTriggerState(1, false)
    view.rerender(renderTree('open'))

    expect(currentTrigger()).toBe(sharedTrigger)
    expect(sharedTrigger.refresh).toHaveBeenCalledTimes(2)
    expect(motion.ScrollTrigger.create).toHaveBeenCalledTimes(1)
    expect(motion.timelines).toHaveLength(timelineIdentities.length)
    for (const [index, timeline] of motion.timelines.entries()) {
      expect(timeline).toBe(timelineIdentities[index])
    }
    expect(entryScheduler.kill).toHaveBeenCalledTimes(1)
    expect(chainSchedulers().filter(candidate => candidate.kill.mock.calls.length === 0)).toEqual([])
    expect(registry.controllers).toHaveLength(controllerIdentities.length)
    for (const [index, controller] of registry.controllers.entries()) {
      expect(controller).toBe(controllerIdentities[index])
    }
    expect(phases).toEqual(['entering', 'exited'])
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exited')
    for (const label of labels) {
      expect(controllerFor(registry, label).initializeExited).toHaveBeenCalledTimes(1)
      expect(wrapperFor(label)).toHaveAttribute('inert')
    }

    view.rerender(renderTree('open'))
    expect(sharedTrigger.refresh).toHaveBeenCalledTimes(2)
    expect(phases).toEqual(['entering', 'exited'])

    const eventCount = motion.events.length
    const phaseCount = phases.length
    for (const [callback] of entryCalls) invoke(callback)
    invoke(staleForwardCompletion)
    expect(root).toHaveAttribute('data-elastic-menu-phase', 'exited')
    expect(phases).toHaveLength(phaseCount)
    expect(motion.events).toHaveLength(eventCount)
    expect(motion.timelines).toHaveLength(timelineIdentities.length)
    for (const [index, timeline] of motion.timelines.entries()) {
      expect(timeline).toBe(timelineIdentities[index])
    }
    expect(currentTrigger()).toBe(sharedTrigger)
  })

  it('normalizes reversing and exiting chains to Reduced Motion and invalidates every stale completion', async () => {
    for (const startingPhase of ['reversing', 'exiting'] as const) {
      const phases: string[] = []
      const entryComplete = vi.fn()
      const publicExit = vi.fn()
      const onPhaseChange = (phase: string) => phases.push(phase)
      const renderTree = (reducedMotion: boolean) => (
        <AnimatedContentChain
          data-testid="elastic-menu-chain"
          reducedMotion={reducedMotion}
          pullAtPreviousProgress={0.42}
          threshold={0.1}
          exitStartViewportPercent={22}
          onPhaseChange={onPhaseChange}
        >
          <RealAnimatedItems
            distance={300}
            onComplete={entryComplete}
            onDisappearanceComplete={publicExit}
          />
        </AnimatedContentChain>
      )
      const view = render(renderTree(false))
      await waitForChain()
      const root = screen.getByTestId('elastic-menu-chain')
      const sharedTrigger = currentTrigger()
      const entryScheduler = currentScheduler()
      const itemTimelines = labels.map(label => itemTimelineFor(label))

      invoke(sharedTrigger.config.onEnter)
      for (const [index] of labels.entries()) {
        invoke(scheduledCalls(entryScheduler)[index][0])
        invoke(itemTimelines[index].options.onComplete)
      }
      expect(root).toHaveAttribute('data-elastic-menu-phase', 'settled')
      entryComplete.mockClear()
      phases.length = 0

      let ownedScheduler = entryScheduler
      let staleCompletions: unknown[]
      let exitTweens: Array<{ readonly kill: ReturnType<typeof vi.fn> }> = []
      if (startingPhase === 'reversing') {
        invoke(sharedTrigger.config.onLeaveBack)
        ownedScheduler = currentScheduler()
        const reverseCalls = scheduledCalls(ownedScheduler)
        invoke(reverseCalls[0][0])
        staleCompletions = [
          ...reverseCalls.map(([callback]) => callback),
          ...itemTimelines.map(timeline => timeline.options.onReverseComplete),
        ]
      } else {
        invoke(sharedTrigger.config.onLeave)
        staleCompletions = motion.gsap.to.mock.calls.slice(-labels.length)
          .map(([, vars]) => vars.onComplete)
        exitTweens = motion.gsap.to.mock.results.slice(-labels.length)
          .map(result => result.value as { readonly kill: ReturnType<typeof vi.fn> })
      }
      expect(root).toHaveAttribute('data-elastic-menu-phase', startingPhase)
      expect(phases).toEqual([startingPhase])

      const wrapperIdentities = new Map(labels.map(label => [label, wrapperFor(label)]))
      const timelineIdentities = [...motion.timelines]
      const triggerIdentities = [...motion.triggers]
      const contextScopes = motion.gsap.context.mock.results
        .map(result => result.value as { readonly revert: ReturnType<typeof vi.fn> })
      const exitTweenCount = motion.gsap.to.mock.calls.length

      view.rerender(renderTree(true))

      await waitFor(() => expect(root).toHaveAttribute('data-elastic-menu-phase', 'reduced'))
      expect(phases).toEqual([startingPhase, 'reduced'])
      expect(sharedTrigger.kill).toHaveBeenCalledTimes(1)
      expect(ownedScheduler.kill).toHaveBeenCalledTimes(1)
      expect(motion.timelines).toHaveLength(timelineIdentities.length)
      for (const [index, timeline] of motion.timelines.entries()) {
        expect(timeline).toBe(timelineIdentities[index])
      }
      expect(motion.triggers).toHaveLength(triggerIdentities.length)
      for (const [index, triggerIdentity] of motion.triggers.entries()) {
        expect(triggerIdentity).toBe(triggerIdentities[index])
      }
      expect(motion.triggers.filter(candidate => candidate.kill.mock.calls.length === 0)).toEqual([])
      expect(chainSchedulers().filter(candidate => candidate.kill.mock.calls.length === 0)).toEqual([])
      for (const [index, timeline] of itemTimelines.entries()) {
        expect(itemTimelineFor(labels[index])).toBe(timeline)
        expect(timeline.kill).toHaveBeenCalledTimes(1)
      }
      for (const scope of contextScopes) expect(scope.revert).toHaveBeenCalledTimes(1)
      for (const tween of exitTweens) expect(tween.kill).toHaveBeenCalledTimes(1)
      for (const label of labels) {
        expect(wrapperFor(label)).toBe(wrapperIdentities.get(label))
        expect(lastSetPayload(label)).toEqual({
          y: 0,
          scale: 1,
          opacity: 1,
          visibility: 'visible',
        })
        expect(wrapperFor(label)).not.toHaveAttribute('inert')
        expect(wrapperFor(label)).toHaveStyle({ visibility: 'visible' })
      }

      const eventCount = motion.events.length
      const phaseCount = phases.length
      const setCount = motion.gsap.set.mock.calls.length
      invoke(sharedTrigger.config.onLeaveBack)
      for (const completion of staleCompletions) invoke(completion)
      expect(root).toHaveAttribute('data-elastic-menu-phase', 'reduced')
      expect(phases).toHaveLength(phaseCount)
      expect(motion.events).toHaveLength(eventCount)
      expect(motion.gsap.set).toHaveBeenCalledTimes(setCount)
      expect(motion.gsap.to).toHaveBeenCalledTimes(exitTweenCount)
      expect(motion.timelines).toHaveLength(timelineIdentities.length)
      for (const [index, timeline] of motion.timelines.entries()) {
        expect(timeline).toBe(timelineIdentities[index])
      }
      expect(motion.triggers).toHaveLength(triggerIdentities.length)
      for (const [index, triggerIdentity] of motion.triggers.entries()) {
        expect(triggerIdentity).toBe(triggerIdentities[index])
      }
      expect(entryComplete).not.toHaveBeenCalled()
      expect(publicExit).not.toHaveBeenCalled()

      view.unmount()
      cleanup()
      motion.reset()
    }
  })
})

interface ChainOracle {
  playAt: number[]
  replayCount: number
  restoredInert: boolean[]
  cleanup: string[]
}

function differingPath(expected: unknown, actual: unknown, path = 'chain'): string | null {
  if (Object.is(expected, actual)) return null
  if (typeof expected !== 'object' || expected === null || typeof actual !== 'object' || actual === null) {
    return path
  }
  const expectedRecord = expected as Record<string, unknown>
  const actualRecord = actual as Record<string, unknown>
  const keys = [...new Set([...Object.keys(expectedRecord), ...Object.keys(actualRecord)])].sort()
  for (const key of keys) {
    if (!(key in expectedRecord) || !(key in actualRecord)) return `${path}.${key}`
    const difference = differingPath(expectedRecord[key], actualRecord[key], `${path}.${key}`)
    if (difference) return difference
  }
  return null
}

function assertChainOracle(expected: ChainOracle, actual: ChainOracle) {
  const difference = differingPath(expected, actual)
  if (difference) throw new Error(`chain behavior mismatch at ${difference}`)
}

describe('AnimatedContentChain comparator negative controls', () => {
  it('rejects altered trace clones for parallel scheduling, replay, hidden restoration, and global cleanup', async () => {
    const { registry, unmount } = chainView()
    await waitForChain()
    const calls = scheduledCalls()
    invoke(trigger().config.onEnter)
    for (const [callback] of calls) invoke(callback)
    invoke(trigger().config.onLeave)
    invoke(trigger().config.onEnterBack)

    const captured: ChainOracle = {
      playAt: calls.slice(0, 5).map(([, , position]) => position),
      replayCount: labels.reduce(
        (count, label) => count + controllerFor(registry, label).play.mock.calls.length,
        0,
      ) - 5,
      restoredInert: labels.map(label => wrapperFor(label).hasAttribute('inert')),
      cleanup: [],
    }
    motion.events.length = 0
    unmount()
    captured.cleanup = motion.events.filter(event =>
      event === 'trigger.kill'
      || event === 'scheduler.kill'
      || event.startsWith('controller.kill:'),
    )

    const oracle: ChainOracle = {
      playAt: [0, 0.924, 1.848, 2.772, 3.696],
      replayCount: 0,
      restoredInert: [false, false, false, false, false],
      cleanup: [
        'trigger.kill',
        ...labels.toReversed().map(label => `controller.kill:${label}`),
      ],
    }
    assertChainOracle(oracle, captured)

    const mutations = [
      ['all-parallel call positions', 'chain.playAt.1', (value: ChainOracle) => { value.playAt = [0, 0, 0, 0, 0] }],
      ['replay on enter-back', 'chain.replayCount', (value: ChainOracle) => { value.replayCount = 5 }],
      ['hidden restore', 'chain.restoredInert.0', (value: ChainOracle) => { value.restoredInert = [true, true, true, true, true] }],
      ['global cleanup', 'chain.cleanup.0', (value: ChainOracle) => { value.cleanup = ['global.kill'] }],
    ] as const

    for (const [name, path, mutate] of mutations) {
      const mutated = structuredClone(captured)
      mutate(mutated)
      expect(() => assertChainOracle(oracle, mutated), name).toThrow(`chain behavior mismatch at ${path}`)
    }
  })
})

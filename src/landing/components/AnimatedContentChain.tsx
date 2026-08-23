import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  AnimatedContentRegistrationContext,
  resolveAnimatedContentScroller,
  type AnimatedContentController,
  type AnimatedContentRegistration,
  type ResolvedAnimatedContentScroller,
} from './AnimatedContentRuntime'

export type ElasticMenuChainPhase =
  | 'initial'
  | 'entering'
  | 'settled'
  | 'reversing'
  | 'exiting'
  | 'exited'
  | 'reduced'

export interface AnimatedContentChainProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly children: React.ReactNode
  readonly reducedMotion: boolean
  readonly layoutRevision?: string | number
  readonly container?: Element | string | null
  readonly pullAtPreviousProgress: number
  readonly threshold: number
  readonly exitStartViewportPercent: number
  readonly onPhaseChange?: (phase: ElasticMenuChainPhase) => void
}

function setInert(controller: AnimatedContentController, inert: boolean) {
  controller.element.toggleAttribute('inert', inert)
}

function sortByDocumentOrder(
  controllers: Iterable<AnimatedContentController>,
): AnimatedContentController[] {
  return Array.from(controllers).sort((left, right) => {
    const relation = left.element.compareDocumentPosition(right.element)
    return relation & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  })
}

function preciseTime(value: number) {
  return Number(value.toFixed(12))
}

export function AnimatedContentChain({
  children,
  reducedMotion,
  layoutRevision,
  container,
  pullAtPreviousProgress,
  threshold,
  exitStartViewportPercent,
  onPhaseChange,
  ...rootProps
}: AnimatedContentChainProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const resolvedScrollerRef = useRef<ResolvedAnimatedContentScroller | null>(null)
  const scrollerReadyRef = useRef(false)
  const controllersRef = useRef(new Map<HTMLElement, AnimatedContentController>())
  const reducedElementsRef = useRef(new Set<HTMLElement>())
  const schedulerRef = useRef<ReturnType<typeof gsap.timeline> | null>(null)
  const triggerRef = useRef<ReturnType<typeof ScrollTrigger.create> | null>(null)
  const previousLayoutRevisionRef = useRef(layoutRevision)
  const latestTransitionToken = useRef(0)
  const entryStartedRef = useRef(reducedMotion)
  const nextMountGenerationRef = useRef(0)
  const activeMountGenerationRef = useRef(0)
  const resourceGenerationRef = useRef(0)
  const reducedMotionRef = useRef(reducedMotion)
  const onPhaseChangeRef = useRef(onPhaseChange)
  const initialPhase: ElasticMenuChainPhase = reducedMotion ? 'reduced' : 'initial'
  const [phase, setPhase] = useState<ElasticMenuChainPhase>(initialPhase)
  const phaseRef = useRef<ElasticMenuChainPhase>(initialPhase)
  const publishedPhaseRef = useRef<ElasticMenuChainPhase>(initialPhase)
  const [registrationVersion, setRegistrationVersion] = useState(0)

  const commitPhase = useCallback((nextPhase: ElasticMenuChainPhase) => {
    phaseRef.current = nextPhase
    if (publishedPhaseRef.current === nextPhase) return
    publishedPhaseRef.current = nextPhase
    setPhase(nextPhase)
    onPhaseChangeRef.current?.(nextPhase)
  }, [])

  const register = useCallback<AnimatedContentRegistration['register']>((controller) => {
    const controllers = controllersRef.current
    if (controllers.has(controller.element)) {
      throw new Error('AnimatedContentChain received a duplicate element registration')
    }

    controllers.set(controller.element, controller)
    reducedElementsRef.current.delete(controller.element)
    setInert(
      controller,
      !reducedMotionRef.current && phaseRef.current !== 'settled',
    )
    setRegistrationVersion(version => version + 1)

    let registered = true
    return () => {
      if (!registered) return
      registered = false
      if (controllers.get(controller.element) !== controller) return
      if (reducedMotionRef.current) {
        controller.settle()
        setInert(controller, false)
        reducedElementsRef.current.add(controller.element)
      } else {
        reducedElementsRef.current.delete(controller.element)
      }
      controllers.delete(controller.element)
      setRegistrationVersion(version => version + 1)
    }
  }, [])

  const isReady = useCallback(() => scrollerReadyRef.current, [])

  const registration = useMemo<AnimatedContentRegistration>(() => ({
    isReady,
    register,
    reducedMotion,
  }), [isReady, reducedMotion, register])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    scrollerReadyRef.current = false
    resolvedScrollerRef.current = null
    resolvedScrollerRef.current = resolveAnimatedContentScroller(
      'AnimatedContentChain',
      container,
      root.ownerDocument,
    )
    scrollerReadyRef.current = true
    return () => {
      scrollerReadyRef.current = false
      resolvedScrollerRef.current = null
    }
  }, [container])

  useLayoutEffect(() => {
    if (!scrollerReadyRef.current) return
    reducedMotionRef.current = reducedMotion
  }, [reducedMotion])

  useLayoutEffect(() => {
    if (!scrollerReadyRef.current) return
    const previousLayoutRevision = previousLayoutRevisionRef.current
    previousLayoutRevisionRef.current = layoutRevision
    if (reducedMotion || Object.is(previousLayoutRevision, layoutRevision)) return
    triggerRef.current?.refresh()
  }, [layoutRevision, reducedMotion])

  useEffect(() => {
    if (!scrollerReadyRef.current) return
    const mountGeneration = ++nextMountGenerationRef.current
    activeMountGenerationRef.current = mountGeneration

    return () => {
      if (activeMountGenerationRef.current === mountGeneration) {
        activeMountGenerationRef.current = 0
      }
      resourceGenerationRef.current += 1
      latestTransitionToken.current += 1
    }
  }, [])

  useEffect(() => {
    if (!scrollerReadyRef.current) return
    onPhaseChangeRef.current = onPhaseChange
  }, [onPhaseChange])

  useEffect(() => {
    if (!scrollerReadyRef.current) return
    const mountGeneration = activeMountGenerationRef.current
    let cancelled = false
    queueMicrotask(() => {
      if (
        cancelled
        || mountGeneration === 0
        || activeMountGenerationRef.current !== mountGeneration
      ) return

      if (reducedMotion) {
        latestTransitionToken.current += 1
        entryStartedRef.current = true
        const root = rootRef.current
        for (const element of reducedElementsRef.current) {
          if (!root?.contains(element)) continue
          element.style.visibility = 'visible'
          element.toggleAttribute('inert', false)
        }
        reducedElementsRef.current.clear()
        commitPhase('reduced')
      } else if (phaseRef.current === 'reduced') {
        reducedElementsRef.current.clear()
        entryStartedRef.current = false
        commitPhase('initial')
      }
    })
    return () => { cancelled = true }
  }, [commitPhase, reducedMotion])

  useEffect(() => {
    if (!scrollerReadyRef.current || reducedMotion || registrationVersion === 0) return
    const root = rootRef.current
    const scrollerTarget = resolvedScrollerRef.current
    if (!root || !scrollerTarget) return
    const mountGeneration = activeMountGenerationRef.current
    const controllers = sortByDocumentOrder(controllersRef.current.values())
    if (mountGeneration === 0 || controllers.length === 0) return

    const resourceGeneration = ++resourceGenerationRef.current
    const isCurrent = () => (
      activeMountGenerationRef.current === mountGeneration
      && resourceGenerationRef.current === resourceGeneration
    )
    const canonicalizePhase = (nextPhase: ElasticMenuChainPhase) => {
      phaseRef.current = nextPhase
      queueMicrotask(() => {
        if (!isCurrent() || phaseRef.current !== nextPhase) return
        commitPhase(nextPhase)
      })
    }

    const progressOf = (controller: AnimatedContentController) => {
      const progress = controller.progress()
      return Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0))
    }
    const isInitial = (controller: AnimatedContentController) => progressOf(controller) <= 1e-6
    const isSettled = (controller: AnimatedContentController) => progressOf(controller) >= 1 - 1e-6
    const allInitial = () => controllers.every(isInitial)
    const allSettled = () => controllers.every(isSettled)

    let scheduler: ReturnType<typeof gsap.timeline> | null = null
    const killScheduler = () => {
      if (!scheduler) return
      const ownedScheduler = scheduler
      scheduler = null
      ownedScheduler.kill()
      if (schedulerRef.current === ownedScheduler) schedulerRef.current = null
    }

    const commitSettledIfCanonical = () => {
      if (!allSettled()) return false
      for (const controller of controllers) setInert(controller, false)
      commitPhase('settled')
      return true
    }

    const createEntryScheduler = () => {
      killScheduler()
      const ownedScheduler = gsap.timeline({ paused: true })
      scheduler = ownedScheduler
      schedulerRef.current = ownedScheduler

      let playAt = 0
      let finalCompletionAt = 0
      for (const controller of controllers) {
        ownedScheduler.call(() => {
          if (
            !isCurrent()
            || scheduler !== ownedScheduler
            || phaseRef.current !== 'entering'
          ) return
          setInert(controller, false)
          controller.play(() => {
            if (
              !isCurrent()
              || scheduler !== ownedScheduler
              || phaseRef.current !== 'entering'
            ) return
            commitSettledIfCanonical()
          })
        }, [], playAt)
        finalCompletionAt = preciseTime(playAt + controller.delay + controller.duration)
        playAt = preciseTime(
          playAt + controller.delay + controller.duration * pullAtPreviousProgress,
        )
      }

      ownedScheduler.call(() => {
        if (
          !isCurrent()
          || scheduler !== ownedScheduler
          || phaseRef.current !== 'entering'
        ) return
        commitSettledIfCanonical()
      }, [], finalCompletionAt)
    }

    let phaseAtSetup = phaseRef.current
    if (phaseAtSetup === 'reduced') {
      phaseAtSetup = 'initial'
      entryStartedRef.current = false
      canonicalizePhase('initial')
    }

    if (phaseAtSetup === 'initial') {
      createEntryScheduler()
    } else if (phaseAtSetup === 'entering') {
      latestTransitionToken.current += 1
      entryStartedRef.current = true
      for (const controller of controllers) controller.cancelEntry()
      for (const controller of controllers) controller.settle()
      for (const controller of controllers) setInert(controller, false)
      canonicalizePhase('settled')
    } else if (phaseAtSetup === 'settled') {
      entryStartedRef.current = true
      for (const controller of controllers) controller.settle()
      for (const controller of controllers) setInert(controller, false)
      canonicalizePhase('settled')
    } else if (phaseAtSetup === 'reversing') {
      latestTransitionToken.current += 1
      entryStartedRef.current = false
      for (const controller of controllers) controller.initializeInitial()
      for (const controller of controllers) setInert(controller, true)
      if (allInitial()) {
        canonicalizePhase('initial')
        createEntryScheduler()
      }
    } else if (phaseAtSetup === 'exiting' || phaseAtSetup === 'exited') {
      latestTransitionToken.current += 1
      entryStartedRef.current = true
      for (const controller of controllers) controller.initializeExited()
      for (const controller of controllers) setInert(controller, true)
      canonicalizePhase('exited')
    }

    let reconcilingRefresh = true
    const resumeReversingForward = () => {
      if (!isCurrent() || phaseRef.current !== 'reversing') return
      const transitionToken = ++latestTransitionToken.current
      killScheduler()
      for (const controller of controllers) controller.cancelEntry()
      commitPhase('entering')
      const progress = controllers.map(progressOf)
      if (allSettled()) {
        commitSettledIfCanonical()
        return
      }

      const settleLatestEntry = () => {
        if (
          !isCurrent()
          || latestTransitionToken.current !== transitionToken
          || phaseRef.current !== 'entering'
        ) return
        commitSettledIfCanonical()
      }
      const playForward = (controller: AnimatedContentController) => {
        setInert(controller, false)
        controller.play(settleLatestEntry)
      }

      const startTimes: number[] = []
      const scheduledControllers: Array<{
        controller: AnimatedContentController
        startAt: number
      }> = []
      for (const [index, controller] of controllers.entries()) {
        const currentProgress = progress[index]
        if (currentProgress >= 1 - 1e-6) {
          startTimes[index] = 0
          setInert(controller, false)
          continue
        }
        if (currentProgress > 1e-6) {
          startTimes[index] = 0
          playForward(controller)
          continue
        }

        let startAt = 0
        if (index > 0) {
          const previous = controllers[index - 1]
          const previousProgress = progress[index - 1]
          if (previousProgress > 1e-6 && previousProgress < pullAtPreviousProgress) {
            startAt = preciseTime(
              (pullAtPreviousProgress - previousProgress) * previous.duration,
            )
          } else if (previousProgress <= 1e-6) {
            startAt = preciseTime(
              startTimes[index - 1]
              + previous.delay
              + previous.duration * pullAtPreviousProgress,
            )
          }
        }
        startTimes[index] = startAt
        scheduledControllers.push({ controller, startAt })
      }

      if (scheduledControllers.length === 0) return
      const ownedScheduler = gsap.timeline({ paused: true })
      scheduler = ownedScheduler
      schedulerRef.current = ownedScheduler
      for (const { controller, startAt } of scheduledControllers) {
        ownedScheduler.call(() => {
          if (
            !isCurrent()
            || scheduler !== ownedScheduler
            || latestTransitionToken.current !== transitionToken
            || phaseRef.current !== 'entering'
          ) return
          playForward(controller)
        }, [], startAt)
      }
      ownedScheduler.play()
    }

    const startEntry = () => {
      if (phaseRef.current === 'reversing') {
        resumeReversingForward()
        return
      }
      if (
        !isCurrent()
        || reconcilingRefresh
        || entryStartedRef.current
        || phaseRef.current !== 'initial'
        || !scheduler
      ) return
      entryStartedRef.current = true
      latestTransitionToken.current += 1
      commitPhase('entering')
      scheduler.play()
    }

    const startReverse = () => {
      if (
        !isCurrent()
        || reconcilingRefresh
        || (phaseRef.current !== 'settled' && phaseRef.current !== 'entering')
      ) return

      const transitionToken = ++latestTransitionToken.current
      entryStartedRef.current = true
      killScheduler()
      for (const controller of controllers) controller.cancelEntry()
      const progressedControllers = controllers.filter(controller => !isInitial(controller))
      for (const controller of controllers) setInert(controller, true)
      commitPhase('reversing')

      const finishReverseIfCanonical = () => {
        if (
          !isCurrent()
          || latestTransitionToken.current !== transitionToken
          || phaseRef.current !== 'reversing'
          || !allInitial()
        ) return
        for (const controller of controllers) setInert(controller, true)
        entryStartedRef.current = false
        commitPhase('initial')
        createEntryScheduler()
      }
      if (progressedControllers.length === 0) {
        finishReverseIfCanonical()
        return
      }

      const ownedScheduler = gsap.timeline({ paused: true })
      scheduler = ownedScheduler
      schedulerRef.current = ownedScheduler

      let reverseAt = 0
      let finalCompletionAt = 0
      for (const controller of [...progressedControllers].reverse()) {
        ownedScheduler.call(() => {
          if (
            !isCurrent()
            || scheduler !== ownedScheduler
            || latestTransitionToken.current !== transitionToken
            || phaseRef.current !== 'reversing'
          ) return
          controller.reverse(finishReverseIfCanonical)
        }, [], reverseAt)
        finalCompletionAt = preciseTime(reverseAt + controller.delay + controller.duration)
        reverseAt = preciseTime(
          reverseAt + controller.delay + controller.duration * pullAtPreviousProgress,
        )
      }

      ownedScheduler.call(() => {
        if (
          !isCurrent()
          || scheduler !== ownedScheduler
          || latestTransitionToken.current !== transitionToken
          || phaseRef.current !== 'reversing'
        ) return
        finishReverseIfCanonical()
      }, [], finalCompletionAt)
      ownedScheduler.play()
    }

    const exitDownward = () => {
      if (
        !isCurrent()
        || reconcilingRefresh
        || phaseRef.current === 'reduced'
        || phaseRef.current === 'exiting'
        || phaseRef.current === 'exited'
      ) return

      entryStartedRef.current = true
      const transitionToken = ++latestTransitionToken.current
      const activeElement = root.ownerDocument.activeElement
      if (activeElement && activeElement !== root && root.contains(activeElement)) {
        root.focus({ preventScroll: true })
      }

      killScheduler()
      for (const controller of controllers) controller.cancelEntry()
      for (const controller of controllers) setInert(controller, true)
      commitPhase('exiting')

      let settledExitCount = 0
      for (const controller of controllers) {
        controller.disappear(0, () => {
          if (
            !isCurrent()
            || latestTransitionToken.current !== transitionToken
            || phaseRef.current !== 'exiting'
          ) return
          settledExitCount += 1
          if (settledExitCount === controllers.length) commitPhase('exited')
        })
      }
    }

    const restoreSettled = () => {
      if (
        !isCurrent()
        || reconcilingRefresh
        || phaseRef.current === 'initial'
        || phaseRef.current === 'reduced'
        || phaseRef.current === 'settled'
      ) return

      entryStartedRef.current = true
      latestTransitionToken.current += 1
      for (const controller of controllers) controller.settle()
      for (const controller of controllers) setInert(controller, false)
      commitPhase('settled')
    }

    const reconcilePosition = (
      ownedTrigger: ReturnType<typeof ScrollTrigger.create>,
    ) => {
      if (
        !isCurrent()
        || triggerRef.current !== ownedTrigger
        || phaseRef.current === 'reduced'
      ) return

      if (ownedTrigger.progress >= 1 && phaseRef.current !== 'exited') {
        entryStartedRef.current = true
        latestTransitionToken.current += 1
        killScheduler()
        for (const controller of controllers) controller.initializeExited()
        for (const controller of controllers) setInert(controller, true)
        commitPhase('exited')
      } else if (
        phaseRef.current === 'initial'
        && (ownedTrigger.isActive || ownedTrigger.progress > 0)
      ) {
        entryStartedRef.current = true
        latestTransitionToken.current += 1
        killScheduler()
        for (const controller of controllers) controller.settle()
        for (const controller of controllers) setInert(controller, false)
        commitPhase('settled')
      }
    }

    const sharedTrigger = ScrollTrigger.create({
      trigger: root,
      scroller: scrollerTarget,
      start: `top ${(1 - threshold) * 100}%`,
      end: `bottom ${exitStartViewportPercent}%`,
      onEnter: startEntry,
      onLeaveBack: startReverse,
      onLeave: exitDownward,
      onEnterBack: restoreSettled,
      onRefresh: refreshedTrigger => reconcilePosition(refreshedTrigger),
    })
    triggerRef.current = sharedTrigger
    sharedTrigger.refresh()
    reconcilingRefresh = false

    let disposed = false
    queueMicrotask(() => {
      if (disposed || !isCurrent()) return
      reconcilePosition(sharedTrigger)
    })

    return () => {
      disposed = true
      if (resourceGenerationRef.current === resourceGeneration) {
        resourceGenerationRef.current += 1
      }
      latestTransitionToken.current += 1
      sharedTrigger.kill()
      if (triggerRef.current === sharedTrigger) triggerRef.current = null
      killScheduler()
    }
  }, [
    commitPhase,
    container,
    exitStartViewportPercent,
    pullAtPreviousProgress,
    reducedMotion,
    registrationVersion,
    threshold,
  ])

  return (
    <AnimatedContentRegistrationContext.Provider value={registration}>
      <div
        {...rootProps}
        ref={rootRef}
        tabIndex={-1}
        data-elastic-menu-phase={phase}
      >
        {children}
      </div>
    </AnimatedContentRegistrationContext.Provider>
  )
}

export default AnimatedContentChain

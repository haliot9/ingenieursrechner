import React, { createContext } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { AnimatedContentMotionProfile } from '../motion/config/elastic-menu-chain-config.types'

gsap.registerPlugin(ScrollTrigger)

export interface AnimatedContentController {
  readonly element: HTMLDivElement
  readonly delay: number
  readonly duration: number
  progress(): number
  play(onSettled?: () => void): void
  reverse(onSettled?: () => void): void
  cancelEntry(): void
  disappear(delayOverride?: number, onSettled?: () => void): void
  initializeInitial(): void
  initializeExited(): void
  settle(): void
  kill(): void
}

export interface AnimatedContentRegistration {
  register(controller: AnimatedContentController): () => void
  isReady(): boolean
  readonly reducedMotion: boolean
}

export interface ResolvedAnimatedContentMotion {
  readonly distance: number
  readonly direction: AnimatedContentMotionProfile['direction']
  readonly reverse: boolean
  readonly duration: number
  readonly ease: string
  readonly initialOpacity: number
  readonly animateOpacity: boolean
  readonly scale: number
  readonly threshold: number
  readonly delay: number
  readonly disappearAfter: number
  readonly disappearDuration: number
  readonly disappearEase: string
}

export interface AnimatedContentMotionProps {
  readonly distance?: number
  readonly direction?: AnimatedContentMotionProfile['direction']
  readonly reverse?: boolean
  readonly duration?: number
  readonly ease?: string
  readonly initialOpacity?: number
  readonly animateOpacity?: boolean
  readonly scale?: number
  readonly threshold?: number
  readonly delay?: number
  readonly disappearAfter?: number
  readonly disappearDuration?: number
  readonly disappearEase?: string
}

export interface AnimatedContentProps
  extends React.HTMLAttributes<HTMLDivElement>, AnimatedContentMotionProps {
  readonly container?: Element | string | null
  readonly children: React.ReactNode
  readonly onComplete?: () => void
  readonly onDisappearanceComplete?: () => void
}

export type AnimatedContentScrollerOwner = 'AnimatedContent' | 'AnimatedContentChain'
export type ResolvedAnimatedContentScroller = Element | Window

function ownerWindow(
  owner: AnimatedContentScrollerOwner,
  ownerDocument: Document,
): Window {
  const resolvedWindow = ownerDocument.defaultView
  if (!resolvedWindow) {
    throw new Error(`${owner} container cannot resolve a viewport because its owner document has no window`)
  }
  return resolvedWindow
}

export function resolveAnimatedContentScroller(
  owner: AnimatedContentScrollerOwner,
  input: Element | string | null | undefined,
  ownerDocument: Document,
): ResolvedAnimatedContentScroller {
  if (input === undefined) {
    return ownerDocument.getElementById('snap-main-container')
      ?? ownerWindow(owner, ownerDocument)
  }
  if (input === null) return ownerWindow(owner, ownerDocument)
  if (typeof input !== 'string') return input
  if (input.trim().length === 0) {
    throw new Error(`${owner} container selector must not be blank`)
  }

  let resolved: Element | null
  try {
    resolved = ownerDocument.querySelector(input)
  } catch {
    throw new Error(`${owner} container selector ${JSON.stringify(input)} is invalid`)
  }
  if (!resolved) {
    throw new Error(`${owner} container selector ${JSON.stringify(input)} did not match an element`)
  }
  return resolved
}

export const AnimatedContentRegistrationContext = createContext<AnimatedContentRegistration | null>(null)

export function createAnimatedContentController(
  element: HTMLDivElement,
  profile: ResolvedAnimatedContentMotion,
  callbacks: Pick<AnimatedContentProps, 'onComplete' | 'onDisappearanceComplete'>,
): AnimatedContentController {
  const axis = profile.direction === 'horizontal' ? 'x' : 'y'
  const offset = profile.reverse ? -profile.distance : profile.distance
  let killed = false
  let entryCompleted = false
  let entryTimelineKilled = false
  let motionToken = 0
  let motionDirection: 'forward' | 'reverse' | null = 'forward'
  let forwardSettled: (() => void) | undefined
  let reverseSettled: (() => void) | undefined
  let disappearanceToken = 0
  let disappearanceTween: ReturnType<typeof gsap.to> | null = null

  gsap.set(element, {
    [axis]: offset,
    scale: profile.scale,
    opacity: profile.animateOpacity ? profile.initialOpacity : 1,
    visibility: 'visible',
  })

  const disappear = (delayOverride = profile.disappearAfter, onSettled?: () => void) => {
    if (killed) return

    disappearanceToken += 1
    disappearanceTween?.kill()
    const currentToken = disappearanceToken
    disappearanceTween = gsap.to(element, {
      [axis]: profile.reverse ? profile.distance : -profile.distance,
      scale: 0.8,
      opacity: profile.animateOpacity ? profile.initialOpacity : 0,
      delay: delayOverride,
      duration: profile.disappearDuration,
      ease: profile.disappearEase,
      onComplete: () => {
        if (killed || currentToken !== disappearanceToken) return
        disappearanceTween = null
        callbacks.onDisappearanceComplete?.()
        if (killed || currentToken !== disappearanceToken) return
        onSettled?.()
      },
    })
  }

  const timeline = gsap.timeline({
    paused: true,
    delay: profile.delay,
    onComplete: () => {
      if (killed || motionDirection !== 'forward') return
      const currentToken = motionToken
      entryCompleted = true
      motionDirection = null
      callbacks.onComplete?.()
      if (killed || currentToken !== motionToken) return
      const onSettled = forwardSettled
      forwardSettled = undefined
      onSettled?.()
      if (killed || currentToken !== motionToken) return
      if (!killed && profile.disappearAfter > 0) disappear(profile.disappearAfter)
    },
  })

  timeline.to(element, {
    [axis]: 0,
    scale: 1,
    opacity: 1,
    duration: profile.duration,
    ease: profile.ease,
  })

  timeline.eventCallback('onReverseComplete', () => {
    if (killed || motionDirection !== 'reverse') return
    const currentToken = motionToken
    motionDirection = null
    entryCompleted = false
    const onSettled = reverseSettled
    reverseSettled = undefined
    onSettled?.()
    if (killed || currentToken !== motionToken) return
  })

  const killEntryTimeline = () => {
    if (entryTimelineKilled) return
    entryTimelineKilled = true
    timeline.kill()
  }

  const cancelDisappearance = () => {
    disappearanceToken += 1
    disappearanceTween?.kill()
    disappearanceTween = null
  }

  return {
    element,
    delay: profile.delay,
    duration: profile.duration,
    progress() {
      return timeline.progress()
    },
    play(onSettled) {
      if (killed) return
      cancelDisappearance()
      motionToken += 1
      motionDirection = 'forward'
      entryCompleted = false
      reverseSettled = undefined
      forwardSettled = onSettled
      timeline.play()
    },
    reverse(onSettled) {
      if (killed) return
      cancelDisappearance()
      motionToken += 1
      motionDirection = 'reverse'
      entryCompleted = false
      forwardSettled = undefined
      reverseSettled = onSettled
      timeline.reverse()
    },
    cancelEntry() {
      if (killed || motionDirection === null || entryCompleted) return
      motionToken += 1
      motionDirection = null
      forwardSettled = undefined
      reverseSettled = undefined
      timeline.pause()
    },
    disappear,
    initializeInitial() {
      if (killed) return
      motionToken += 1
      motionDirection = null
      forwardSettled = undefined
      reverseSettled = undefined
      timeline.pause().progress(0, true)
      entryCompleted = false
      cancelDisappearance()
      gsap.set(element, {
        [axis]: offset,
        scale: profile.scale,
        opacity: profile.animateOpacity ? profile.initialOpacity : 1,
        visibility: 'visible',
      })
    },
    initializeExited() {
      if (killed) return
      motionToken += 1
      motionDirection = null
      forwardSettled = undefined
      reverseSettled = undefined
      timeline.pause().progress(1, true)
      entryCompleted = true
      cancelDisappearance()
      gsap.set(element, {
        [axis]: profile.reverse ? profile.distance : -profile.distance,
        scale: 0.8,
        opacity: profile.animateOpacity ? profile.initialOpacity : 0,
        visibility: 'visible',
      })
    },
    settle() {
      if (killed) return
      motionToken += 1
      motionDirection = null
      forwardSettled = undefined
      reverseSettled = undefined
      timeline.pause().progress(1, true)
      entryCompleted = true
      cancelDisappearance()
      gsap.set(element, {
        [axis]: 0,
        scale: 1,
        opacity: 1,
        visibility: 'visible',
      })
    },
    kill() {
      if (killed) return
      killed = true
      disappearanceToken += 1
      motionToken += 1
      motionDirection = null
      forwardSettled = undefined
      reverseSettled = undefined
      killEntryTimeline()
      disappearanceTween?.kill()
      disappearanceTween = null
    },
  }
}

export interface AnimatedContentRuntimeScope {
  readonly controller: AnimatedContentController
  revert(): void
}

export function createAnimatedContentRuntimeScope(
  element: HTMLDivElement,
  profile: ResolvedAnimatedContentMotion,
  callbacks: Pick<AnimatedContentProps, 'onComplete' | 'onDisappearanceComplete'>,
): AnimatedContentRuntimeScope {
  let controller: AnimatedContentController | undefined
  const context = gsap.context(() => {
    controller = createAnimatedContentController(element, profile, callbacks)
  }, element)
  if (!controller) {
    context.revert()
    throw new Error('AnimatedContent controller initialization did not complete')
  }

  return {
    controller,
    revert() {
      context.revert()
    },
  }
}

export interface AnimatedContentTriggerHandle {
  kill(): void
}

export function createStandaloneAnimatedContentTrigger(
  element: HTMLDivElement,
  scroller: ResolvedAnimatedContentScroller,
  threshold: number,
  controller: AnimatedContentController,
): AnimatedContentTriggerHandle {
  const startPct = (1 - threshold) * 100
  return ScrollTrigger.create({
    trigger: element,
    scroller,
    start: `top ${startPct}%`,
    once: true,
    onEnter: () => controller.play(),
  })
}

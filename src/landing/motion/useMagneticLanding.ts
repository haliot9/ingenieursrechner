import { useEffect } from 'react'
import { chooseMagneticTarget, type MagneticCandidate } from './magnetic-target'

const CHAPTER_IDS = ['haltung', 'module', 'thermodynamik', 'rechenweg', 'projekt'] as const
const SETTLE_DELAY_MS = 140

function measureCandidate(chapter: HTMLElement): MagneticCandidate {
  const bounds = chapter.getBoundingClientRect()
  const visibleHeight = Math.max(
    0,
    Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0),
  )

  return {
    id: chapter.id,
    visibleRatio: bounds.height > 0 ? Math.min(1, visibleHeight / bounds.height) : 0,
    distanceToLanding: bounds.top,
  }
}

export function useMagneticLanding(reducedMotion: boolean) {
  useEffect(() => {
    if (reducedMotion || !window.IntersectionObserver) return

    const chapters = CHAPTER_IDS
      .map(id => document.getElementById(id))
      .filter((chapter): chapter is HTMLElement => chapter !== null)
    const passiveOptions: AddEventListenerOptions = { passive: true }
    let settleTimer: number | undefined
    const activePointerIds = new Set<number>()
    let activeTouchCount = 0
    let dominantChapterId: string | undefined
    let settledChapterId: string | undefined

    const observer = new window.IntersectionObserver(() => undefined, { threshold: [0, .72, 1] })

    for (const chapter of chapters) observer.observe(chapter)

    const settle = () => {
      settleTimer = undefined
      if (activePointerIds.size > 0 || activeTouchCount > 0) return

      const currentChapters = CHAPTER_IDS
        .map(id => document.getElementById(id))
        .filter((chapter): chapter is HTMLElement => chapter !== null)
      const currentCandidates = currentChapters.map(measureCandidate)
      const dominant = currentCandidates
        .slice()
        .sort((a, b) => b.visibleRatio - a.visibleRatio)[0]?.id

      if (dominant && dominant !== dominantChapterId) {
        dominantChapterId = dominant
        settledChapterId = undefined
      }

      const targetId = chooseMagneticTarget(currentCandidates, reducedMotion)
      if (!targetId || targetId === settledChapterId) return

      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      settledChapterId = targetId
    }

    const scheduleSettle = () => {
      if (settleTimer !== undefined) window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(settle, SETTLE_DELAY_MS)
    }
    const markPointerActive: EventListener = event => {
      activePointerIds.add((event as PointerEvent).pointerId)
    }
    const markPointerInactive: EventListener = event => {
      activePointerIds.delete((event as PointerEvent).pointerId)
    }
    const syncTouchContacts: EventListener = event => {
      activeTouchCount = (event as TouchEvent).touches.length
    }

    const listeners: Array<readonly [string, EventListener]> = [
      ['scroll', scheduleSettle],
      ['pointerdown', markPointerActive],
      ['pointerup', markPointerInactive],
      ['pointercancel', markPointerInactive],
      ['touchstart', syncTouchContacts],
      ['touchend', syncTouchContacts],
      ['touchcancel', syncTouchContacts],
    ]

    for (const [type, listener] of listeners) {
      window.addEventListener(type, listener, passiveOptions)
    }

    return () => {
      if (settleTimer !== undefined) window.clearTimeout(settleTimer)
      observer.disconnect()
      for (const [type, listener] of listeners) {
        window.removeEventListener(type, listener, passiveOptions)
      }
    }
  }, [reducedMotion])
}

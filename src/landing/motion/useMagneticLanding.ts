import { useEffect } from 'react'
import { chooseMagneticTarget, type MagneticCandidate } from './magnetic-target'

const CHAPTER_IDS = ['haltung', 'module', 'thermodynamik', 'rechenweg', 'projekt'] as const
const SETTLE_DELAY_MS = 140

export function useMagneticLanding(reducedMotion: boolean) {
  useEffect(() => {
    if (reducedMotion || !window.IntersectionObserver) return

    const chapters = CHAPTER_IDS
      .map(id => document.getElementById(id))
      .filter((chapter): chapter is HTMLElement => chapter !== null)
    const candidates = new Map<string, MagneticCandidate>()
    const passiveOptions: AddEventListenerOptions = { passive: true }
    let settleTimer: number | undefined
    let pointerActive = false
    let touchActive = false
    let dominantChapterId: string | undefined
    let settledChapterId: string | undefined

    const observer = new window.IntersectionObserver(entries => {
      for (const entry of entries) {
        candidates.set(entry.target.id, {
          id: entry.target.id,
          visibleRatio: entry.intersectionRatio,
          distanceToLanding: entry.boundingClientRect.top,
        })
      }
    }, { threshold: [0, .72, 1] })

    for (const chapter of chapters) observer.observe(chapter)

    const settle = () => {
      settleTimer = undefined
      if (pointerActive || touchActive) return

      const currentCandidates = Array.from(candidates.values())
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
    const markPointerActive = () => { pointerActive = true }
    const markPointerInactive = () => { pointerActive = false }
    const markTouchActive = () => { touchActive = true }
    const markTouchInactive = () => { touchActive = false }

    const listeners: Array<readonly [string, EventListener]> = [
      ['scroll', scheduleSettle],
      ['pointerdown', markPointerActive],
      ['pointerup', markPointerInactive],
      ['pointercancel', markPointerInactive],
      ['touchstart', markTouchActive],
      ['touchend', markTouchInactive],
      ['touchcancel', markTouchInactive],
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

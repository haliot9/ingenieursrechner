import { useEffect, type RefObject } from 'react'
import { scrollProgress } from './scroll-progress'

const REPRESENTATIVE_PROGRESS = .5

export function useScrollVideo(
  sectionRef: RefObject<HTMLElement | null>,
  videoRef: RefObject<HTMLVideoElement | null>,
  reducedMotion: boolean,
) {
  useEffect(() => {
    let frame: number | undefined
    let listening = false

    const update = () => {
      frame = undefined
      const section = sectionRef.current
      const video = videoRef.current
      if (!section || !video || !Number.isFinite(video.duration)) return

      const rect = section.getBoundingClientRect()
      const progress = scrollProgress(rect.top, rect.height, window.innerHeight)
      const themeFade = progress >= 1 ? 1 : Math.max(0, (progress - .8) / .2)
      section.style.setProperty('--wright-theme-fade', String(themeFade))
      video.currentTime = progress * video.duration
    }

    const scheduleUpdate = () => {
      if (frame !== undefined) return
      frame = window.requestAnimationFrame(update)
    }

    const scheduleWhileListening = () => {
      if (listening) scheduleUpdate()
    }

    const stopListening = () => {
      if (listening) {
        window.removeEventListener('scroll', scheduleUpdate)
        window.removeEventListener('resize', scheduleUpdate)
        listening = false
      }
      if (frame !== undefined) {
        window.cancelAnimationFrame(frame)
        frame = undefined
      }
    }

    const showRepresentativeFrame = () => {
      const video = videoRef.current
      if (!video || !Number.isFinite(video.duration)) return
      video.currentTime = video.duration * REPRESENTATIVE_PROGRESS
    }

    const video = videoRef.current
    if (reducedMotion) {
      stopListening()
      showRepresentativeFrame()
      video?.addEventListener('loadedmetadata', showRepresentativeFrame)
      return () => {
        video?.removeEventListener('loadedmetadata', showRepresentativeFrame)
        stopListening()
      }
    }

    const section = sectionRef.current
    if (!section || !window.IntersectionObserver) return stopListening

    const startListening = () => {
      if (listening) return
      window.addEventListener('scroll', scheduleUpdate, { passive: true })
      window.addEventListener('resize', scheduleUpdate, { passive: true })
      listening = true
      scheduleUpdate()
    }

    const observer = new window.IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) startListening()
      else stopListening()
    })

    video?.addEventListener('loadedmetadata', scheduleWhileListening)
    observer.observe(section)

    return () => {
      video?.removeEventListener('loadedmetadata', scheduleWhileListening)
      observer.disconnect()
      stopListening()
    }
  }, [reducedMotion, sectionRef, videoRef])
}

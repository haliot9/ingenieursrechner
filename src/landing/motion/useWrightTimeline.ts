import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { WrightFilterRefs } from '../components/WrightCopyStage'
import type { LandingTheme } from '../theme/useLandingTheme'
import { scrollProgress } from './scroll-progress'
import { wrightTimeline, type WrightTimelineState } from './wright-timeline'

const REPRESENTATIVE_PROGRESS = 0.5

function finite(value: number) {
  return Number.isFinite(value) ? value : 0
}

function writeTimelineFrame(
  track: HTMLElement,
  turbulence: SVGFETurbulenceElement | null,
  displacement: SVGFEDisplacementMapElement | null,
  fractureAlpha: SVGFEFuncAElement | null,
  charredFlood: SVGFEFloodElement | null,
  ashFlood: SVGFEFloodElement | null,
  state: WrightTimelineState,
) {
  track.style.setProperty('--wright-film-progress', String(finite(state.filmProgress)))
  track.style.setProperty('--wright-theme-fade', String(finite(state.themeFade)))
  track.style.setProperty('--wright-decay', String(finite(state.decay)))
  track.style.setProperty('--wright-light-opacity', String(finite(state.lightOpacity)))
  track.style.setProperty('--wright-dark-opacity', String(finite(state.darkOpacity)))
  track.style.setProperty('--wright-drift-x', `${finite(state.driftX)}px`)
  track.style.setProperty('--wright-rotation', `${finite(state.rotation)}deg`)
  track.style.setProperty('--wright-jitter-x', `${finite(state.jitterX)}px`)
  track.style.setProperty('--wright-jitter-y', `${finite(state.jitterY)}px`)
  track.style.setProperty('--wright-panel-blur', `${finite(state.blur)}px`)
  track.style.setProperty('--wright-chromatic-wash', String(finite(state.chromaticWash)))
  track.style.setProperty('--wright-desaturation', String(finite(state.desaturation)))
  track.style.setProperty('--wright-contrast', String(finite(state.contrast)))
  turbulence?.setAttribute('baseFrequency', String(finite(state.turbulenceFrequency)))
  displacement?.setAttribute('scale', String(finite(state.displacementScale)))
  fractureAlpha?.setAttribute('slope', String(finite(state.fractureSlope)))
  fractureAlpha?.setAttribute('intercept', String(finite(state.fractureIntercept)))
  charredFlood?.setAttribute('flood-opacity', String(finite(state.charredOpacity)))
  ashFlood?.setAttribute('flood-opacity', String(finite(state.ashOpacity)))
}

function writeVideoFrame(video: HTMLVideoElement | null, state: WrightTimelineState) {
  if (!video || !Number.isFinite(video.duration)) return
  video.currentTime = state.filmProgress * video.duration
}

function normalMotionSnapshot(
  track: HTMLElement,
  video: HTMLVideoElement | null,
  turbulence: SVGFETurbulenceElement | null,
  displacement: SVGFEDisplacementMapElement | null,
  fractureAlpha: SVGFEFuncAElement | null,
  charredFlood: SVGFEFloodElement | null,
  ashFlood: SVGFEFloodElement | null,
  selectedTheme: LandingTheme,
) {
  const rect = track.getBoundingClientRect()
  const progress = scrollProgress(rect.top, rect.height, window.innerHeight)
  const state = wrightTimeline(progress, selectedTheme)
  writeTimelineFrame(
    track,
    turbulence,
    displacement,
    fractureAlpha,
    charredFlood,
    ashFlood,
    state,
  )
  writeVideoFrame(video, state)
  return state
}

function synchronizeNormalMotionTheme(
  track: HTMLElement,
  lastTheme: { current: 'light' | 'dark' },
  setTheme: (theme: 'light' | 'dark') => void,
  nextTheme: 'light' | 'dark',
) {
  if (lastTheme.current === nextTheme) return

  for (const panel of track.querySelectorAll<HTMLElement>('[data-copy-theme]')) {
    const active = panel.dataset.copyTheme === nextTheme
    panel.setAttribute('aria-hidden', String(!active))
    panel.toggleAttribute('inert', !active)

    const heading = panel.querySelector('h1')
    if (active) heading?.setAttribute('id', 'landing-title')
    else heading?.removeAttribute('id')
  }

  lastTheme.current = nextTheme
  setTheme(nextTheme)
}

function stableReducedMotionState(selectedTheme: LandingTheme): WrightTimelineState {
  const dark = selectedTheme === 'dark'

  return {
    filmProgress: REPRESENTATIVE_PROGRESS,
    themeFade: dark ? 1 : 0,
    decay: 0,
    lightOpacity: dark ? 0 : 1,
    darkOpacity: dark ? 1 : 0,
    activeCopyTheme: selectedTheme,
    driftX: 0,
    rotation: 0,
    jitterX: 0,
    jitterY: 0,
    blur: 0,
    displacementScale: 0,
    turbulenceFrequency: 0,
    chromaticWash: 0,
    fractureSlope: 0,
    fractureIntercept: 1,
    charredOpacity: 0,
    ashOpacity: 0,
    desaturation: 0,
    contrast: 1,
  }
}

export function useWrightTimeline(
  trackRef: RefObject<HTMLElement | null>,
  videoRef: RefObject<HTMLVideoElement | null>,
  filterRefs: WrightFilterRefs,
  selectedTheme: LandingTheme,
  reducedMotion: boolean,
): 'light' | 'dark' {
  const {
    turbulence: turbulenceRef,
    displacement: displacementRef,
    fractureAlpha: fractureAlphaRef,
    charredFlood: charredFloodRef,
    ashFlood: ashFloodRef,
  } = filterRefs
  const selectedThemeRef = useRef(selectedTheme)
  const lastNormalMotionThemeRef = useRef<'light' | 'dark'>('light')
  const [activeCopyTheme, setActiveCopyTheme] = useState<'light' | 'dark'>('light')

  useLayoutEffect(() => {
    selectedThemeRef.current = selectedTheme
    const track = trackRef.current
    if (!track) return

    if (reducedMotion) {
      const state = stableReducedMotionState(selectedTheme)
      writeTimelineFrame(
        track,
        turbulenceRef.current,
        displacementRef.current,
        fractureAlphaRef.current,
        charredFloodRef.current,
        ashFloodRef.current,
        state,
      )
      writeVideoFrame(videoRef.current, state)
      return
    }

    const state = normalMotionSnapshot(
      track,
      videoRef.current,
      turbulenceRef.current,
      displacementRef.current,
      fractureAlphaRef.current,
      charredFloodRef.current,
      ashFloodRef.current,
      selectedTheme,
    )
    synchronizeNormalMotionTheme(
      track,
      lastNormalMotionThemeRef,
      setActiveCopyTheme,
      state.activeCopyTheme,
    )
  }, [
    ashFloodRef,
    charredFloodRef,
    displacementRef,
    fractureAlphaRef,
    reducedMotion,
    selectedTheme,
    trackRef,
    turbulenceRef,
    videoRef,
  ])

  useEffect(() => {
    let frame: number | undefined
    let listening = false

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
      writeVideoFrame(videoRef.current, stableReducedMotionState(selectedThemeRef.current))
    }

    const update = () => {
      frame = undefined
      const track = trackRef.current
      if (!track) return

      const state = normalMotionSnapshot(
        track,
        videoRef.current,
        turbulenceRef.current,
        displacementRef.current,
        fractureAlphaRef.current,
        charredFloodRef.current,
        ashFloodRef.current,
        selectedThemeRef.current,
      )
      synchronizeNormalMotionTheme(
        track,
        lastNormalMotionThemeRef,
        setActiveCopyTheme,
        state.activeCopyTheme,
      )
    }

    function scheduleUpdate() {
      if (frame !== undefined) return
      frame = window.requestAnimationFrame(update)
    }

    const scheduleWhileListening = () => {
      if (listening) scheduleUpdate()
    }

    const video = videoRef.current
    if (reducedMotion) {
      showRepresentativeFrame()
      video?.addEventListener('loadedmetadata', showRepresentativeFrame)
      return () => {
        video?.removeEventListener('loadedmetadata', showRepresentativeFrame)
        stopListening()
      }
    }

    const track = trackRef.current
    if (!track || !window.IntersectionObserver) return stopListening

    const startListening = () => {
      if (listening) return
      window.addEventListener('scroll', scheduleUpdate, { passive: true })
      window.addEventListener('resize', scheduleUpdate, { passive: true })
      listening = true
      scheduleUpdate()
    }

    const observer = new window.IntersectionObserver(entries => {
      let latestEntry: IntersectionObserverEntry | undefined
      for (const entry of entries) {
        if (entry.target === track) latestEntry = entry
      }
      if (!latestEntry) return

      if (latestEntry.isIntersecting) startListening()
      else stopListening()
    })

    video?.addEventListener('loadedmetadata', scheduleWhileListening)
    observer.observe(track)

    return () => {
      video?.removeEventListener('loadedmetadata', scheduleWhileListening)
      observer.disconnect()
      stopListening()
    }
  }, [
    ashFloodRef,
    charredFloodRef,
    displacementRef,
    fractureAlphaRef,
    reducedMotion,
    trackRef,
    turbulenceRef,
    videoRef,
  ])

  return reducedMotion ? selectedTheme : activeCopyTheme
}

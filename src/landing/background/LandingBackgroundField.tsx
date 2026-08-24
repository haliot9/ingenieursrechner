import { useEffect, useRef, useState } from 'react'
import {
  reportLandingRenderFailure,
  type LandingRenderFailureReporter,
  type LandingRenderFailureStage,
} from '../render-failure'
import { landingBackgroundConfig } from './config/landing-background-config.generated'
import type { LandingBackgroundDarkConfig } from './config/landing-background-config.types'
import { LightGlassField } from './LightGlassField'
import './LandingBackgroundField.css'
import type {
  LandingBackgroundRenderFrame,
  LandingBackgroundRenderer,
  LandingBackgroundRendererOptions,
} from './renderer/landing-background-renderer.types'

type LandingTheme = 'dark' | 'light'

export interface LandingBackgroundRendererModule {
  createLandingBackgroundRenderer(
    host: HTMLElement,
    config: LandingBackgroundDarkConfig,
    options?: LandingBackgroundRendererOptions,
  ): LandingBackgroundRenderer
}

export type LandingBackgroundRendererLoader = () => Promise<LandingBackgroundRendererModule>

export interface LandingBackgroundFieldProps {
  readonly theme: LandingTheme
  readonly reducedMotion: boolean
  readonly rendererLoader?: LandingBackgroundRendererLoader
  readonly onRenderFailure?: LandingRenderFailureReporter
}

const loadDefaultRenderer: LandingBackgroundRendererLoader = () => (
  import('./renderer/LandingBackgroundRenderer')
)

export function LandingBackgroundField({
  theme,
  reducedMotion,
  rendererLoader = loadDefaultRenderer,
  onRenderFailure,
}: LandingBackgroundFieldProps) {
  const darkHostRef = useRef<HTMLDivElement>(null)
  const reporterRef = useRef<LandingRenderFailureReporter | undefined>(onRenderFailure)
  reporterRef.current = onRenderFailure
  const [status, setStatus] = useState(theme === 'light' ? 'static' : 'loading')

  useEffect(() => {
    if (theme !== 'dark') {
      setStatus('static')
      return
    }
    const host = darkHostRef.current
    if (!host) return
    let active = true
    let renderer: LandingBackgroundRenderer | null = null
    let animationFrameId: number | null = null
    let startTimeMs: number | null = null
    let contextAvailable = true
    let terminalFailure = false
    const pointer: [number, number] = [0, 0]
    const reportFailure = (stage: LandingRenderFailureStage, reason: unknown) => {
      reportLandingRenderFailure(reporterRef.current, 'background', stage, reason)
    }

    const cancelLoop = () => {
      if (animationFrameId === null) return
      window.cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    const releaseRenderer = (target: LandingBackgroundRenderer | null) => {
      if (renderer === target) renderer = null
      try {
        target?.dispose()
      } catch (error) {
        reportFailure('disposal', error)
      }
      host.replaceChildren()
    }
    const failTerminally = () => {
      if (!active || terminalFailure) return
      terminalFailure = true
      contextAvailable = false
      cancelLoop()
      releaseRenderer(renderer)
      setStatus('fallback-error')
    }
    const renderSafely = (frame: LandingBackgroundRenderFrame) => {
      if (!renderer || terminalFailure) return false
      try {
        renderer.render(frame)
        return true
      } catch (error) {
        reportFailure('render', error)
        failTerminally()
        return false
      }
    }
    const renderFrame = (nowMs: number) => {
      animationFrameId = null
      if (
        !active
        || terminalFailure
        || !contextAvailable
        || reducedMotion
        || document.visibilityState !== 'visible'
        || !renderer
      ) return
      startTimeMs ??= nowMs
      if (!renderSafely({
        elapsedSeconds: (nowMs - startTimeMs) / 1000,
        pointer,
      })) return
      animationFrameId = window.requestAnimationFrame(renderFrame)
    }
    const armLoop = () => {
      if (
        animationFrameId !== null
        || terminalFailure
        || !contextAvailable
        || reducedMotion
        || document.visibilityState !== 'visible'
        || !renderer
      ) return
      animationFrameId = window.requestAnimationFrame(renderFrame)
    }
    const resize = () => {
      if (!renderer || !contextAvailable || terminalFailure) return false
      try {
        renderer.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio)
      } catch (error) {
        reportFailure('resize', error)
        failTerminally()
        return false
      }
      if (reducedMotion && !renderSafely({ elapsedSeconds: 0, pointer })) return false
      return true
    }
    const syncVisibility = () => {
      if (document.visibilityState === 'visible') armLoop()
      else cancelLoop()
    }
    const updatePointer = (event: PointerEvent) => {
      if (window.innerWidth <= 0 || window.innerHeight <= 0) return
      pointer[0] = Math.max(-1, Math.min(1, event.clientX / window.innerWidth * 2 - 1))
      pointer[1] = Math.max(-1, Math.min(1, 1 - event.clientY / window.innerHeight * 2))
    }
    const resetPointer = () => {
      pointer[0] = 0
      pointer[1] = 0
    }
    const onPointerOut = (event: PointerEvent) => {
      if (event.relatedTarget === null) resetPointer()
    }

    setStatus('loading')
    window.addEventListener('resize', resize)
    if (!reducedMotion) {
      window.addEventListener('pointermove', updatePointer, { passive: true })
      window.addEventListener('pointerout', onPointerOut, { passive: true })
      window.addEventListener('blur', resetPointer)
    }
    document.addEventListener('visibilitychange', syncVisibility)

    void rendererLoader().then(module => {
      if (!active) return
      try {
        const created = module.createLandingBackgroundRenderer(
          host,
          landingBackgroundConfig.dark,
          {
            onContextLost: () => {
              if (!active) return
              contextAvailable = false
              cancelLoop()
              setStatus('fallback-context-lost')
            },
          },
        )
        if (!active) {
          releaseRenderer(created)
          return
        }
        renderer = created
        if (!resize()) return
        if (!reducedMotion && !renderSafely({ elapsedSeconds: 0, pointer })) return
        setStatus('ready')
        armLoop()
      } catch (error) {
        reportFailure('initialization', error)
        failTerminally()
      }
    }).catch((error: unknown) => {
      if (!active) return
      reportFailure('loading', error)
      failTerminally()
    })

    return () => {
      active = false
      cancelLoop()
      window.removeEventListener('resize', resize)
      if (!reducedMotion) {
        window.removeEventListener('pointermove', updatePointer)
        window.removeEventListener('pointerout', onPointerOut)
        window.removeEventListener('blur', resetPointer)
      }
      document.removeEventListener('visibilitychange', syncVisibility)
      releaseRenderer(renderer)
    }
  }, [reducedMotion, rendererLoader, theme])

  return <div
    className="landing-background-field"
    aria-hidden="true"
    data-background-motion={reducedMotion ? 'static' : 'animated'}
    data-background-status={status}
    data-background-theme={theme}
    data-background-layer={theme === 'light'
      ? landingBackgroundConfig.light.layerPlacement
      : 'below-wavefield'}
  >
    {theme === 'dark'
      ? <div
          ref={darkHostRef}
          className="landing-background-field__dark"
          data-background-branch="dark"
        />
      : <LightGlassField config={landingBackgroundConfig.light} />}
  </div>
}

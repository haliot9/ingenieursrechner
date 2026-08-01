import { useId, type CSSProperties, type PointerEvent, type ReactNode } from 'react'

export interface LiquidSurfaceProps {
  children: ReactNode
  className?: string
  reducedMotion?: boolean
}

type LiquidSurfaceStyle = CSSProperties & {
  '--liquid-pointer-x'?: string
  '--liquid-pointer-y'?: string
  '--liquid-shift-x'?: string
  '--liquid-shift-y'?: string
}

// This pure predicate is exported with the component so support policy stays directly testable.
// eslint-disable-next-line react-refresh/only-export-components
export function supportsLiquidDistortion(userAgent: string, reducedMotion: boolean, coarsePointer: boolean) {
  const firefox = /Firefox/i.test(userAgent)
  const safari = /Safari/i.test(userAgent) && !/Chrome|Chromium|Edg/i.test(userAgent)
  return !reducedMotion && !coarsePointer && !firefox && !safari
}

export function LiquidSurface({ children, className, reducedMotion = false }: LiquidSurfaceProps) {
  const filterId = useId().replaceAll(':', '')
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const motionReduced = reducedMotion || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const enabled = supportsLiquidDistortion(window.navigator.userAgent, motionReduced, coarsePointer)

  const updatePointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, bounds.width ? ((event.clientX - bounds.left) / bounds.width) * 100 : 50))
    const y = Math.min(100, Math.max(0, bounds.height ? ((event.clientY - bounds.top) / bounds.height) * 100 : 50))
    event.currentTarget.style.setProperty('--liquid-pointer-x', `${x}%`)
    event.currentTarget.style.setProperty('--liquid-pointer-y', `${y}%`)
    event.currentTarget.style.setProperty('--liquid-shift-x', `${(x - 50) * .08}px`)
    event.currentTarget.style.setProperty('--liquid-shift-y', `${(y - 50) * .08}px`)
  }

  const resetPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled) return
    event.currentTarget.style.setProperty('--liquid-pointer-x', '50%')
    event.currentTarget.style.setProperty('--liquid-pointer-y', '50%')
    event.currentTarget.style.setProperty('--liquid-shift-x', '0px')
    event.currentTarget.style.setProperty('--liquid-shift-y', '0px')
  }

  const surfaceStyle: LiquidSurfaceStyle = {
    '--liquid-pointer-x': '50%',
    '--liquid-pointer-y': '50%',
    '--liquid-shift-x': '0px',
    '--liquid-shift-y': '0px',
  }

  return <div
    className={`liquid-surface${className ? ` ${className}` : ''}`}
    data-liquid-mode={enabled ? 'distortion' : 'frosted'}
    onPointerMove={updatePointer}
    onPointerLeave={resetPointer}
    style={surfaceStyle}
  >
    {enabled && <svg className="liquid-surface-filter" width="0" height="0" aria-hidden="true">
      <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="17" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="14" xChannelSelector="R" yChannelSelector="B" />
      </filter>
    </svg>}
    <div
      className="liquid-surface-refraction"
      aria-hidden="true"
      style={enabled ? { filter: `url(#${filterId})` } : undefined}
    />
    <div className="liquid-surface-content">{children}</div>
  </div>
}

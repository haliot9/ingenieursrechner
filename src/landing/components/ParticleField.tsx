import { useEffect, useRef, type CSSProperties } from 'react'

export interface ParticleFieldProps {
  enabled: boolean
}

type ParticleStyle = CSSProperties & {
  '--particle-depth': number
  '--particle-delay': string
}

type ParticleFieldStyle = CSSProperties & {
  '--particle-shift-x': string
  '--particle-shift-y': string
}

const PARTICLE_DATA = new Float32Array([
  7.5, 12, .28, 18, 7, .62, 31, 18, .4, 43, 9, .78,
  57, 15, .34, 69, 6, .92, 82, 20, .5, 94, 11, .7,
  12, 38, .82, 25, 29, .46, 38, 43, .66, 52, 32, .3,
  64, 45, .88, 76, 34, .54, 89, 48, .74, 5, 61, .38,
  19, 72, .96, 34, 58, .58, 47, 76, .42, 61, 64, .72,
  73, 81, .32, 86, 68, .84, 96, 87, .48, 42, 92, .68,
])

export function ParticleField({ enabled }: ParticleFieldProps) {
  const fieldRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled) return

    const passiveOptions: AddEventListenerOptions = { passive: true }
    const resetParallax = () => {
      fieldRef.current?.style.setProperty('--particle-shift-x', '0px')
      fieldRef.current?.style.setProperty('--particle-shift-y', '0px')
    }
    const updateParallax = (event: PointerEvent) => {
      const { innerHeight, innerWidth } = window
      if (
        event.clientX < 0 || event.clientX > innerWidth
        || event.clientY < 0 || event.clientY > innerHeight
      ) return

      const x = innerWidth > 0 ? (event.clientX / innerWidth) * 2 - 1 : 0
      const y = innerHeight > 0 ? (event.clientY / innerHeight) * 2 - 1 : 0
      fieldRef.current?.style.setProperty('--particle-shift-x', `${Math.max(-1, Math.min(1, x)) * 8}px`)
      fieldRef.current?.style.setProperty('--particle-shift-y', `${Math.max(-1, Math.min(1, y)) * 6}px`)
    }
    const pauseOutsideViewport = (event: PointerEvent) => {
      if (event.relatedTarget === null) resetParallax()
    }
    const pauseWhenHidden = () => {
      if (document.visibilityState !== 'visible') resetParallax()
    }

    window.addEventListener('pointermove', updateParallax, passiveOptions)
    window.addEventListener('pointerout', pauseOutsideViewport, passiveOptions)
    window.addEventListener('blur', resetParallax)
    document.addEventListener('visibilitychange', pauseWhenHidden)

    return () => {
      window.removeEventListener('pointermove', updateParallax, passiveOptions)
      window.removeEventListener('pointerout', pauseOutsideViewport, passiveOptions)
      window.removeEventListener('blur', resetParallax)
      document.removeEventListener('visibilitychange', pauseWhenHidden)
    }
  }, [enabled])

  if (!enabled) return null

  const fieldStyle: ParticleFieldStyle = {
    '--particle-shift-x': '0px',
    '--particle-shift-y': '0px',
  }

  return <div ref={fieldRef} className="particle-field" aria-hidden="true" style={fieldStyle}>
    {Array.from({ length: PARTICLE_DATA.length / 3 }, (_, index) => {
      const offset = index * 3
      const depth = PARTICLE_DATA[offset + 2]
      const style: ParticleStyle = {
        left: `${PARTICLE_DATA[offset]}%`,
        top: `${PARTICLE_DATA[offset + 1]}%`,
        '--particle-depth': depth,
        '--particle-delay': `${-(index % 8) * .7}s`,
      }
      return <span key={index} className="particle-field__particle" data-particle style={style} />
    })}
  </div>
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type PropsWithChildren,
} from 'react'
import type { LandingTheme } from '../theme/useLandingTheme'
import './ThemeTransitionControl.css'

export type ThemeControlVariant = 'header' | 'rail'
export type ThemeTransitionPhase = 'idle' | 'dissolving' | 'reassembling'

export interface ThemeTransitionControlProps {
  theme: LandingTheme
  reducedMotion: boolean
  variant: ThemeControlVariant
  onToggleTheme: () => void
}

export const THEME_CONTROL_LABELS = {
  light: { text: 'Dark Mode', icon: '☾', accessibleName: 'Dark Mode aktivieren' },
  dark: { text: 'Light Mode', icon: '☼', accessibleName: 'Light Mode aktivieren' },
} as const

const PARTICLE_POSITIONS = [
  [-1, -.55],
  [-.5, -1],
  [.3, -.85],
  [.92, -.3],
  [1, .45],
  [.42, .95],
  [-.38, .88],
  [-.92, .28],
] as const

type ParticleStyle = CSSProperties & {
  '--particle-index': number
  '--particle-x': number
  '--particle-y': number
}

type TransitionOwner = symbol

interface ThemeTransitionCoordinatorValue {
  phase: ThemeTransitionPhase
  requestToggle: (owner: TransitionOwner) => void
  finishPhase: (owner: TransitionOwner) => void
}

const ThemeTransitionCoordinatorContext = createContext<ThemeTransitionCoordinatorValue | null>(null)

function useThemeTransitionCoordinator(
  reducedMotion: boolean,
  onToggleTheme: () => void,
): ThemeTransitionCoordinatorValue {
  const [phase, setPhase] = useState<ThemeTransitionPhase>('idle')
  const phaseRef = useRef<ThemeTransitionPhase>('idle')
  const ownerRef = useRef<TransitionOwner | null>(null)
  const previousReducedMotionRef = useRef(reducedMotion)

  const setVisualPhase = useCallback((nextPhase: ThemeTransitionPhase) => {
    phaseRef.current = nextPhase
    setPhase(nextPhase)
  }, [])

  const requestToggle = useCallback((owner: TransitionOwner) => {
    if (phaseRef.current !== 'idle') return
    if (reducedMotion) {
      onToggleTheme()
      return
    }

    ownerRef.current = owner
    setVisualPhase('dissolving')
  }, [onToggleTheme, reducedMotion, setVisualPhase])

  const finishPhase = useCallback((owner: TransitionOwner) => {
    if (ownerRef.current !== owner) return

    if (phaseRef.current === 'dissolving') {
      onToggleTheme()
      setVisualPhase('reassembling')
    } else if (phaseRef.current === 'reassembling') {
      ownerRef.current = null
      setVisualPhase('idle')
    }
  }, [onToggleTheme, setVisualPhase])

  const settleReducedMotionInterruption = useEffectEvent(() => {
    if (phaseRef.current === 'dissolving') onToggleTheme()
    ownerRef.current = null
    setVisualPhase('idle')
  })

  useEffect(() => {
    const reducedMotionInterrupted = reducedMotion && !previousReducedMotionRef.current
    previousReducedMotionRef.current = reducedMotion
    if (!reducedMotionInterrupted || phaseRef.current === 'idle') return

    settleReducedMotionInterruption()
  }, [reducedMotion, setVisualPhase])

  return useMemo(() => ({ phase, requestToggle, finishPhase }), [finishPhase, phase, requestToggle])
}

export function LandingThemeTransitionCoordinator({
  children,
  reducedMotion,
  onToggleTheme,
}: PropsWithChildren<Pick<ThemeTransitionControlProps, 'reducedMotion' | 'onToggleTheme'>>) {
  const coordinator = useThemeTransitionCoordinator(reducedMotion, onToggleTheme)

  return <ThemeTransitionCoordinatorContext value={coordinator}>
    {children}
  </ThemeTransitionCoordinatorContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLandingThemeTransitionLock() {
  const coordinator = useContext(ThemeTransitionCoordinatorContext)
  return coordinator ? coordinator.phase !== 'idle' : false
}

export function ThemeTransitionControl({
  theme,
  reducedMotion,
  variant,
  onToggleTheme,
}: ThemeTransitionControlProps) {
  const sharedCoordinator = useContext(ThemeTransitionCoordinatorContext)
  const standaloneCoordinator = useThemeTransitionCoordinator(reducedMotion, onToggleTheme)
  const coordinator = sharedCoordinator ?? standaloneCoordinator
  const controlRef = useRef<HTMLButtonElement>(null)
  const owner = useRef<TransitionOwner>(Symbol('theme-transition-control')).current
  const label = THEME_CONTROL_LABELS[theme]
  const { phase } = coordinator

  const requestToggle = () => {
    coordinator.requestToggle(owner)
  }

  const finishPhase = useCallback((event: AnimationEvent<HTMLButtonElement> | globalThis.AnimationEvent) => {
    if (event.target !== event.currentTarget) return
    coordinator.finishPhase(owner)
  }, [coordinator, owner])

  useEffect(() => {
    const control = controlRef.current
    if (!control || 'AnimationEvent' in window) return

    control.addEventListener('animationend', finishPhase)
    return () => control.removeEventListener('animationend', finishPhase)
  }, [finishPhase])

  return <button
    ref={controlRef}
    className="theme-transition-control"
    type="button"
    data-theme={theme}
    data-phase={phase}
    data-variant={variant}
    aria-label={label.accessibleName}
    aria-pressed={theme === 'dark'}
    aria-disabled={phase !== 'idle' || undefined}
    onClick={requestToggle}
    onAnimationEnd={finishPhase}
  >
    <span className="theme-transition-control__shell" aria-hidden="true" />
    <span className="theme-transition-control__content">
      <span className="theme-transition-control__label">{label.text}</span>
      <span className="theme-transition-control__icon" aria-hidden="true">{label.icon}</span>
    </span>
    <span className="theme-transition-control__particles" aria-hidden="true">
      {PARTICLE_POSITIONS.map(([x, y], index) => {
        const particleStyle: ParticleStyle = {
          '--particle-index': index,
          '--particle-x': x,
          '--particle-y': y,
        }

        return <span
          key={index}
          className="theme-transition-control__particle"
          style={particleStyle}
        />
      })}
    </span>
  </button>
}

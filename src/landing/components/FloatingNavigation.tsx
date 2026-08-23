import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import type { LandingChapterId } from '../landing-chapters'
import type { LandingTheme } from '../theme/useLandingTheme'
import { LiquidSurface } from './LiquidSurface'
import { ThemeTransitionControl, useLandingThemeTransitionLock } from './ThemeTransitionControl'
import './FloatingNavigation.css'

export interface LandingNavigationSection {
  id: LandingChapterId
  label: string
}

export interface FloatingNavigationProps {
  sections: readonly LandingNavigationSection[]
  theme: LandingTheme
  reducedMotion: boolean
  onOpenChange?: (open: boolean) => void
  onToggleTheme: () => void
  onOpenCalculator: () => void
}

const DIALOG_ID = 'floating-navigation-dialog'

export function FloatingNavigation({
  sections,
  theme,
  reducedMotion,
  onOpenChange,
  onToggleTheme,
  onOpenCalculator,
}: FloatingNavigationProps) {
  const [open, setOpen] = useState(false)
  const themeTransitionLocked = useLandingThemeTransitionLock()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const notifyUnmount = useEffectEvent(() => onOpenChange?.(false))

  const closeNavigation = useCallback(() => {
    if (themeTransitionLocked) return
    setOpen(false)
    onOpenChange?.(false)
    restoreFocusRef.current?.focus()
  }, [onOpenChange, themeTransitionLocked])

  const openNavigation = () => {
    if (themeTransitionLocked) return
    restoreFocusRef.current = triggerRef.current
    setOpen(true)
    onOpenChange?.(true)
  }

  useEffect(() => () => notifyUnmount(), [])

  useEffect(() => {
    if (!open) return

    headingRef.current?.focus()
    const containDialogFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeNavigation()
        return
      }
      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter(element => element.tabIndex >= 0)
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) {
        event.preventDefault()
        headingRef.current?.focus()
        return
      }

      const active = document.activeElement
      const outsideDialog = !(active instanceof Node) || !dialog.contains(active)
      if (event.shiftKey && (active === first || active === headingRef.current || outsideDialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || outsideDialog)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', containDialogFocus)
    return () => document.removeEventListener('keydown', containDialogFocus)
  }, [closeNavigation, open])

  const visitChapter = (id: LandingNavigationSection['id']) => {
    if (themeTransitionLocked) return
    document.getElementById(id)?.scrollIntoView?.({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    })
    closeNavigation()
  }

  const openCalculator = () => {
    if (themeTransitionLocked) return
    onOpenCalculator()
    closeNavigation()
  }

  return <nav className="floating-rail" aria-label="Seitennavigation">
    <LiquidSurface className="floating-rail-trigger-surface" reducedMotion={reducedMotion}>
      <button
        ref={triggerRef}
        className="floating-rail-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={DIALOG_ID}
        aria-label="Navigation öffnen"
        aria-disabled={themeTransitionLocked || undefined}
        aria-hidden={open || undefined}
        tabIndex={open ? -1 : undefined}
        onClick={openNavigation}
      >
        <span aria-hidden="true">⌁</span>
        <span>Kapitel</span>
      </button>
    </LiquidSurface>

    {open && <div className="floating-rail-overlay">
      <div
        className="floating-rail-dimmer"
        aria-hidden="true"
        onClick={closeNavigation}
      />
      <LiquidSurface className="floating-rail-panel" reducedMotion={reducedMotion}>
        <section
          ref={dialogRef}
          id={DIALOG_ID}
          className="floating-rail-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${DIALOG_ID}-title`}
        >
          <header className="floating-rail-dialog__header">
            <div>
              <p className="floating-rail-dialog__eyebrow">Ingenieursrechner</p>
              <h2 id={`${DIALOG_ID}-title`} ref={headingRef} tabIndex={-1}>Seitennavigation</h2>
            </div>
            <button
              className="floating-rail-close"
              type="button"
              aria-disabled={themeTransitionLocked || undefined}
              onClick={closeNavigation}
            >
              <span aria-hidden="true">×</span>
              <span className="floating-rail-visually-hidden">Navigation schließen</span>
            </button>
          </header>

          <ol className="floating-rail-chapters">
            {sections.map((section, index) => <li key={section.id}>
              <button
                type="button"
                aria-disabled={themeTransitionLocked || undefined}
                onClick={() => visitChapter(section.id)}
              >
                <span className="floating-rail-chapter__number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>{section.label}</span>
              </button>
            </li>)}
          </ol>

          <footer className="floating-rail-actions">
            <ThemeTransitionControl
              theme={theme}
              reducedMotion={reducedMotion}
              variant="rail"
              onToggleTheme={onToggleTheme}
            />
            <button
              className="floating-rail-calculator"
              type="button"
              aria-disabled={themeTransitionLocked || undefined}
              onClick={openCalculator}
            >
              Rechner öffnen
            </button>
          </footer>
        </section>
      </LiquidSurface>
    </div>}
  </nav>
}

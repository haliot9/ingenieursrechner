import { useCallback, useEffect, useRef, useState } from 'react'
import type { LandingTheme } from '../theme/useLandingTheme'
import { useReducedMotion } from '../motion/useReducedMotion'
import { LiquidSurface } from './LiquidSurface'
import './FloatingNavigation.css'

export interface LandingNavigationSection {
  id: 'haltung' | 'module' | 'thermodynamik' | 'rechenweg' | 'projekt'
  label: string
}

export interface FloatingNavigationProps {
  sections: LandingNavigationSection[]
  theme: LandingTheme
  onOpenChange?: (open: boolean) => void
  onToggleTheme: () => void
  onOpenCalculator: () => void
}

const DIALOG_ID = 'floating-navigation-dialog'

export function FloatingNavigation({
  sections,
  theme,
  onOpenChange,
  onToggleTheme,
  onOpenCalculator,
}: FloatingNavigationProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const reducedMotion = useReducedMotion()

  const closeNavigation = useCallback(() => {
    setOpen(false)
    onOpenChange?.(false)
    restoreFocusRef.current?.focus()
  }, [onOpenChange])

  const openNavigation = () => {
    restoreFocusRef.current = triggerRef.current
    setOpen(true)
    onOpenChange?.(true)
  }

  useEffect(() => () => onOpenChange?.(false), [onOpenChange])

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
    document.getElementById(id)?.scrollIntoView?.({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    })
    closeNavigation()
  }

  const openCalculator = () => {
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
            <button className="floating-rail-close" type="button" onClick={closeNavigation}>
              <span aria-hidden="true">×</span>
              <span className="floating-rail-visually-hidden">Navigation schließen</span>
            </button>
          </header>

          <ol className="floating-rail-chapters">
            {sections.map((section, index) => <li key={section.id}>
              <button type="button" onClick={() => visitChapter(section.id)}>
                <span className="floating-rail-chapter__number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>{section.label}</span>
              </button>
            </li>)}
          </ol>

          <footer className="floating-rail-actions">
            <button
              className="floating-rail-theme"
              type="button"
              aria-label="Darstellung wechseln"
              aria-pressed={theme === 'dark'}
              onClick={onToggleTheme}
            >
              {theme === 'dark' ? 'Helle Darstellung' : 'Dunkle Darstellung'}
            </button>
            <button className="floating-rail-calculator" type="button" onClick={openCalculator}>
              Rechner öffnen
            </button>
          </footer>
        </section>
      </LiquidSurface>
    </div>}
  </nav>
}

import './landing.css'
import { FloatingNavigation, type LandingNavigationSection } from './components/FloatingNavigation'
import { WrightHero } from './components/WrightHero'
import { useReducedMotion } from './motion/useReducedMotion'
import { useLandingTheme } from './theme/useLandingTheme'

export interface LandingPageProps {
  onOpenCalculator: (moduleId: string) => void
}

const LANDING_NAVIGATION_SECTIONS: LandingNavigationSection[] = [
  { id: 'haltung', label: 'Haltung' },
  { id: 'module', label: 'Module' },
  { id: 'thermodynamik', label: 'Thermodynamik' },
  { id: 'rechenweg', label: 'Rechenweg' },
  { id: 'projekt', label: 'Projekt' },
]

export function LandingPage({ onOpenCalculator }: LandingPageProps) {
  const { theme, toggleTheme } = useLandingTheme()
  const reducedMotion = useReducedMotion()
  const selectedModuleId = 'carnot'
  const openSelectedModule = () => onOpenCalculator(selectedModuleId)

  return <main
    className={`landing-shell${reducedMotion ? ' landing-shell--reduced-motion' : ''}`}
    aria-labelledby="landing-title"
    data-landing-theme={theme}
    data-reduced-motion={reducedMotion}
  >
    <FloatingNavigation
      sections={LANDING_NAVIGATION_SECTIONS}
      theme={theme}
      onToggleTheme={toggleTheme}
      onOpenCalculator={openSelectedModule}
    />
    <header className="landing-shell__header">
      <p className="landing-shell__eyebrow">Ingenieursrechner</p>
      <div className="landing-shell__header-actions">
        <button className="landing-shell__calculator-link" type="button" onClick={openSelectedModule}>
          Rechner öffnen
        </button>
        <button
          className="landing-shell__theme-toggle"
          type="button"
          aria-label="Darstellung wechseln"
          aria-pressed={theme === 'dark'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? 'Helle Darstellung' : 'Dunkle Darstellung'}
        </button>
      </div>
    </header>
    <WrightHero reducedMotion={reducedMotion} />
  </main>
}

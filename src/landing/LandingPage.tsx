import './landing.css'
import { WrightHero } from './components/WrightHero'
import { useReducedMotion } from './motion/useReducedMotion'
import { useLandingTheme } from './theme/useLandingTheme'

export interface LandingPageProps {
  onOpenCalculator: (moduleId: string) => void
}

export function LandingPage({ onOpenCalculator }: LandingPageProps) {
  const { theme, toggleTheme } = useLandingTheme()
  const reducedMotion = useReducedMotion()

  return <main
    className={`landing-shell${reducedMotion ? ' landing-shell--reduced-motion' : ''}`}
    aria-labelledby="landing-title"
    data-landing-theme={theme}
    data-reduced-motion={reducedMotion}
  >
    <header className="landing-shell__header">
      <p className="landing-shell__eyebrow">Ingenieursrechner</p>
      <div className="landing-shell__header-actions">
        <button className="landing-shell__calculator-link" type="button" onClick={() => onOpenCalculator('carnot')}>
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

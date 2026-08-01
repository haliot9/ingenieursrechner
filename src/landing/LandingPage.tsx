import './landing.css'
import { useReducedMotion } from './motion/useReducedMotion'
import { useLandingTheme } from './theme/useLandingTheme'

export interface LandingPageProps {
  onOpenCalculator: (moduleId: string) => void
}

export function LandingPage({ onOpenCalculator }: LandingPageProps) {
  const { theme, toggleTheme } = useLandingTheme()
  const reducedMotion = useReducedMotion()

  return <main
    className="landing-shell"
    aria-labelledby="landing-title"
    data-landing-theme={theme}
    data-reduced-motion={reducedMotion}
  >
    <header className="landing-shell__header">
      <p className="landing-shell__eyebrow">Ingenieursrechner</p>
      <button
        className="landing-shell__theme-toggle"
        type="button"
        aria-label="Darstellung wechseln"
        aria-pressed={theme === 'dark'}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? 'Helle Darstellung' : 'Dunkle Darstellung'}
      </button>
    </header>
    <section className="landing-shell__content">
      <h1 className="landing-shell__title" id="landing-title">Nicht nur rechnen. Systeme verstehen.</h1>
      <p className="landing-shell__intro">
        Thermodynamische Zusammenhänge nachvollziehen – mit überprüfbaren Formeln und klaren Einheiten.
      </p>
      <button className="landing-shell__calculator-link" type="button" onClick={() => onOpenCalculator('carnot')}>
        Rechner öffnen
      </button>
    </section>
  </main>
}

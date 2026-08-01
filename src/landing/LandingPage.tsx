import { useEffect, useState } from 'react'
import './landing.css'
import { FloatingNavigation, type LandingNavigationSection } from './components/FloatingNavigation'
import { JouleProof } from './components/JouleProof'
import { ModuleAtlas } from './components/ModuleAtlas'
import { ParticleField } from './components/ParticleField'
import { ProjectCoda } from './components/ProjectCoda'
import { ThermodynamicsExplorer } from './components/ThermodynamicsExplorer'
import { WrightHero } from './components/WrightHero'
import type { ThermodynamicsModuleId } from './model/landing-modules'
import { useMagneticLanding } from './motion/useMagneticLanding'
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
  const [navigationOpen, setNavigationOpen] = useState(false)
  const { theme, toggleTheme } = useLandingTheme()
  const reducedMotion = useReducedMotion()
  const [selectedModuleId, setSelectedModuleId] = useState<ThermodynamicsModuleId>('carnot')
  const openSelectedModule = () => onOpenCalculator(selectedModuleId)
  useMagneticLanding(reducedMotion)

  useEffect(() => {
    document.title = 'Ingenieursrechner · Systeme verstehen'
  }, [])

  const exploreThermodynamics = () => {
    document.getElementById('thermodynamik')?.scrollIntoView?.({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  return <main
    className={`landing-shell${reducedMotion ? ' landing-shell--reduced-motion' : ''}`}
    aria-labelledby="landing-title"
    data-landing-theme={theme}
    data-reduced-motion={reducedMotion}
  >
    <ParticleField enabled={theme === 'dark' && !reducedMotion} />
    <FloatingNavigation
      sections={LANDING_NAVIGATION_SECTIONS}
      theme={theme}
      onOpenChange={setNavigationOpen}
      onToggleTheme={toggleTheme}
      onOpenCalculator={openSelectedModule}
    />
    <div className="landing-shell__content" inert={navigationOpen || undefined}>
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
      <ModuleAtlas onExploreThermodynamics={exploreThermodynamics} />
      <ThermodynamicsExplorer
        onSelectionChange={setSelectedModuleId}
        onOpenCalculator={onOpenCalculator}
      />
      <JouleProof onOpenCalculator={() => onOpenCalculator('joule')} />
      <ProjectCoda
        onOpenCalculator={openSelectedModule}
        calculatorAccessibleName="Ausgewählten Rechner öffnen"
      />
    </div>
  </main>
}

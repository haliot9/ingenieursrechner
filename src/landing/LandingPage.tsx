import { lazy, useEffect, useState } from 'react'
import './landing.css'
import { AsyncContent } from '../components/AsyncContent'
import { DeferredLandingSection } from './components/DeferredLandingSection'
import { FloatingNavigation, type LandingNavigationSection } from './components/FloatingNavigation'
import { ParticleField } from './components/ParticleField'
import { WrightHero } from './components/WrightHero'
import type { ThermodynamicsModuleId } from './model/landing-modules'
import { useMagneticLanding } from './motion/useMagneticLanding'
import { useReducedMotion } from './motion/useReducedMotion'
import { useLandingTheme } from './theme/useLandingTheme'

const JouleProof = lazy(() => import('./components/JouleProof').then(module => ({ default: module.JouleProof })))
const ModuleAtlas = lazy(() => import('./components/ModuleAtlas').then(module => ({ default: module.ModuleAtlas })))
const ProjectCoda = lazy(() => import('./components/ProjectCoda').then(module => ({ default: module.ProjectCoda })))
const ThermodynamicsExplorer = lazy(() => import('./components/ThermodynamicsExplorer').then(module => ({
  default: module.ThermodynamicsExplorer,
})))

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
      <DeferredLandingSection id="module" label="Modulatlas">
        <AsyncContent loadingLabel="Modulatlas wird geladen" sectionId="module" sectionLabel="Modulatlas">
          <ModuleAtlas onExploreThermodynamics={exploreThermodynamics} />
        </AsyncContent>
      </DeferredLandingSection>
      <DeferredLandingSection id="thermodynamik" label="Thermodynamik-Explorer">
        <AsyncContent
          loadingLabel="Thermodynamik-Explorer wird geladen"
          sectionId="thermodynamik"
          sectionLabel="Thermodynamik-Explorer"
        >
          <ThermodynamicsExplorer
            onSelectionChange={setSelectedModuleId}
            onOpenCalculator={onOpenCalculator}
          />
        </AsyncContent>
      </DeferredLandingSection>
      <DeferredLandingSection id="rechenweg" label="Rechenweg">
        <AsyncContent loadingLabel="Rechenweg wird geladen" sectionId="rechenweg" sectionLabel="Rechenweg">
          <JouleProof onOpenCalculator={() => onOpenCalculator('joule')} />
        </AsyncContent>
      </DeferredLandingSection>
      <DeferredLandingSection id="projekt" label="Projektbeleg">
        <AsyncContent loadingLabel="Projektbeleg wird geladen" sectionId="projekt" sectionLabel="Projektbeleg">
          <ProjectCoda
            onOpenCalculator={openSelectedModule}
            calculatorAccessibleName="Ausgewählten Rechner öffnen"
          />
        </AsyncContent>
      </DeferredLandingSection>
    </div>
  </main>
}

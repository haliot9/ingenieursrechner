import { lazy, useEffect, useRef, useState } from 'react'
import './landing.css'
import { AsyncContent } from '../components/AsyncContent'
import { LandingBackgroundField } from './background/LandingBackgroundField'
import { DeferredLandingSection } from './components/DeferredLandingSection'
import { FloatingNavigation } from './components/FloatingNavigation'
import {
  LandingThemeTransitionCoordinator,
  ThemeTransitionControl,
} from './components/ThemeTransitionControl'
import { WrightHero } from './components/WrightHero'
import {
  LandingLineField,
  type LandingLineFieldProps,
} from './line-field/LandingLineField'
import { LANDING_CHAPTERS } from './landing-chapters'
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
  selectedModuleId?: ThermodynamicsModuleId
  onSelectedModuleIdChange?: (moduleId: ThermodynamicsModuleId) => void
}

export function LandingPage({
  onOpenCalculator,
  selectedModuleId,
  onSelectedModuleIdChange,
}: LandingPageProps) {
  const activityExtentRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const filmTrackRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const mottoPanelRef = useRef<HTMLDivElement>(null)
  const mottoCardSlotRef = useRef<HTMLDivElement>(null)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const { theme, toggleTheme } = useLandingTheme()
  const reducedMotion = useReducedMotion()
  const [localSelectedModuleId, setLocalSelectedModuleId] = useState<ThermodynamicsModuleId>('carnot')
  const effectiveSelectedModuleId = selectedModuleId ?? localSelectedModuleId
  const openSelectedModule = () => onOpenCalculator(effectiveSelectedModuleId)
  const selectThermodynamicsModule = (moduleId: ThermodynamicsModuleId) => {
    setLocalSelectedModuleId(moduleId)
    onSelectedModuleIdChange?.(moduleId)
  }
  useMagneticLanding(reducedMotion)

  useEffect(() => {
    document.title = 'Ingenieursrechner · Systeme verstehen'
  }, [])

  const lineFieldProps = {
    theme,
    reducedMotion,
    activityExtentRef,
    headerRef,
    filmTrackRef,
    videoRef,
    mottoPanelRef,
    mottoCardSlotRef,
  } satisfies LandingLineFieldProps

  return <LandingThemeTransitionCoordinator reducedMotion={reducedMotion} onToggleTheme={toggleTheme}>
    <main
      className={`landing-shell${reducedMotion ? ' landing-shell--reduced-motion' : ''}`}
      aria-labelledby="landing-title"
      data-landing-theme={theme}
      data-reduced-motion={reducedMotion}
    >
      <LandingBackgroundField theme={theme} reducedMotion={reducedMotion} />
      <FloatingNavigation
        sections={LANDING_CHAPTERS}
        theme={theme}
        reducedMotion={reducedMotion}
        onOpenChange={setNavigationOpen}
        onToggleTheme={toggleTheme}
        onOpenCalculator={openSelectedModule}
      />
      <div ref={activityExtentRef} className="landing-shell__content" inert={navigationOpen || undefined}>
        <header ref={headerRef} className="landing-shell__header">
          <p className="landing-shell__eyebrow">Ingenieursrechner</p>
          <div className="landing-shell__header-actions">
            <ThemeTransitionControl
              theme={theme}
              reducedMotion={reducedMotion}
              variant="header"
              onToggleTheme={toggleTheme}
            />
          </div>
        </header>
        <WrightHero
          theme={theme}
          reducedMotion={reducedMotion}
          filmTrackRef={filmTrackRef}
          videoRef={videoRef}
          mottoPanelRef={mottoPanelRef}
          mottoCardSlotRef={mottoCardSlotRef}
        />
        <DeferredLandingSection id="module" label="Modulatlas">
          <AsyncContent loadingLabel="Modulatlas wird geladen" sectionId="module" sectionLabel="Modulatlas">
            <ModuleAtlas />
          </AsyncContent>
        </DeferredLandingSection>
        <DeferredLandingSection id="thermodynamik" label="Thermodynamik-Explorer">
          <AsyncContent
            loadingLabel="Thermodynamik-Explorer wird geladen"
            sectionId="thermodynamik"
            sectionLabel="Thermodynamik-Explorer"
          >
            <ThermodynamicsExplorer
              reducedMotion={reducedMotion}
              onSelectionChange={selectThermodynamicsModule}
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
      <LandingLineField {...lineFieldProps} />
    </main>
  </LandingThemeTransitionCoordinator>
}

import { lazy, useState } from 'react'
import { AsyncContent } from './components/AsyncContent'
import type { ThermodynamicsModuleId } from './landing/model/landing-modules'
import { useAppLocation } from './navigation/useAppLocation'

const CalculatorPage = lazy(() => import('./calculator/CalculatorPage').then(module => ({
  default: module.CalculatorPage,
})))
const LandingPage = lazy(() => import('./landing/LandingPage').then(module => ({
  default: module.LandingPage,
})))

export default function App() {
  const { location, navigate } = useAppLocation()
  const [selectedThermodynamicsModuleId, setSelectedThermodynamicsModuleId] =
    useState<ThermodynamicsModuleId>('carnot')

  return <AsyncContent
    key={location.page}
    loadingLabel={location.page === 'calculator' ? 'Rechner wird geladen' : 'Landingpage wird geladen'}
  >
    {location.page === 'calculator'
      ? <CalculatorPage
          moduleId={location.moduleId}
          onBackToLanding={() => navigate({ page: 'landing' })}
        />
      : <LandingPage
          selectedModuleId={selectedThermodynamicsModuleId}
          onSelectedModuleIdChange={setSelectedThermodynamicsModuleId}
          onOpenCalculator={moduleId => navigate({ page: 'calculator', moduleId })}
        />}
  </AsyncContent>
}

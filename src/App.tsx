import { lazy } from 'react'
import { AsyncContent } from './components/AsyncContent'
import { useAppLocation } from './navigation/useAppLocation'

const CalculatorPage = lazy(() => import('./calculator/CalculatorPage').then(module => ({
  default: module.CalculatorPage,
})))
const LandingPage = lazy(() => import('./landing/LandingPage').then(module => ({
  default: module.LandingPage,
})))

export default function App() {
  const { location, navigate } = useAppLocation()

  return <AsyncContent
    key={location.page}
    loadingLabel={location.page === 'calculator' ? 'Rechner wird geladen' : 'Landingpage wird geladen'}
  >
    {location.page === 'calculator'
      ? <CalculatorPage
          moduleId={location.moduleId}
          onBackToLanding={() => navigate({ page: 'landing' })}
        />
      : <LandingPage onOpenCalculator={moduleId => navigate({ page: 'calculator', moduleId })} />}
  </AsyncContent>
}

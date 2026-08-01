import { useEffect } from 'react'
import { CalculatorPage } from './calculator/CalculatorPage'
import { LandingPage } from './landing/LandingPage'
import { getModule } from './modules'
import { useAppLocation } from './navigation/useAppLocation'
import { useCalculatorStore } from './store/calculator-store'

export default function App() {
  const { location, navigate } = useAppLocation()
  const setModule = useCalculatorStore(state => state.setModule)

  useEffect(() => {
    if (location.page === 'calculator' && location.moduleId && getModule(location.moduleId)) {
      setModule(location.moduleId)
    }
  }, [location, setModule])

  return location.page === 'calculator'
    ? <CalculatorPage onBackToLanding={() => navigate({ page: 'landing' })} />
    : <LandingPage onOpenCalculator={moduleId => navigate({ page: 'calculator', moduleId })} />
}

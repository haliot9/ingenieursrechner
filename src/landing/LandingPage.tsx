export interface LandingPageProps {
  onOpenCalculator: (moduleId: string) => void
}

export function LandingPage({ onOpenCalculator }: LandingPageProps) {
  return <main aria-labelledby="landing-title">
    <h1 id="landing-title">Nicht nur rechnen. Systeme verstehen.</h1>
    <button type="button" onClick={() => onOpenCalculator('carnot')}>Rechner öffnen</button>
  </main>
}

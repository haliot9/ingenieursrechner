import './JouleProof.css'

export interface ProjectCodaProps {
  onOpenCalculator: () => void
}

const PROOF_POINTS = [
  'Browser-only',
  'Deterministisch',
  'Getestet',
  'Modular',
  'Agent-ready',
] as const

export function ProjectCoda({ onOpenCalculator }: ProjectCodaProps) {
  return <section id="projekt" className="project-coda" aria-labelledby="project-coda-title">
    <div className="project-coda__layout">
      <div>
        <p className="landing-eyebrow">Projekt</p>
        <h2 id="project-coda-title">Projektbeleg.</h2>
        <ul className="project-coda__proof-points" aria-label="Projekteigenschaften">
          {PROOF_POINTS.map(point => <li key={point}>{point}</li>)}
        </ul>
      </div>
      <div className="project-coda__actions">
        <a
          className="project-coda__repository"
          href="https://github.com/haliot9/ingenieursrechner"
        >
          Repository ansehen
        </a>
        <button className="project-coda__calculator" type="button" onClick={() => onOpenCalculator()}>
          Rechner öffnen
        </button>
      </div>
    </div>
  </section>
}

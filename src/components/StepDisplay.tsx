import { renderLatex } from '../utils/latex'
import type { SolutionStep } from '../core/types'

interface StepDisplayProps {
  steps: SolutionStep[]
}

export function StepDisplay({ steps }: StepDisplayProps) {
  if (steps.length === 0) {
    return (
      <section className="empty-state">
        <span className="empty-index">01</span>
        <div>
          <h2>Noch keine Rechenschritte</h2>
          <p>Lade den Referenzfall oder gib bekannte Zustandsgrößen ein. Ergebnisse, Diagramme und Herleitung erscheinen hier live.</p>
        </div>
      </section>
    )
  }

  return (
    <details className="steps-panel" open>
      <summary>
        <span>
          <small className="eyebrow">Herleitung</small>
          Rechenschritte
        </span>
        <b>{steps.length}</b>
      </summary>
      <div className="step-list">
        {steps.map((step, index) => (
          <StepCard key={`${step.formulaId}-${step.targetVariable}-${index}`} step={step} index={index} />
        ))}
      </div>
    </details>
  )
}

function StepCard({ step, index }: { step: SolutionStep; index: number }) {
  return (
    <details className="step-card">
      <summary>
        <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
        <span>
          <strong>{step.formulaName}</strong>
          <small>{step.explanation}</small>
        </span>
      </summary>
      <div className="step-body">
        <FormulaLine label="Formel" latex={step.originalLatex} block />
        <FormulaLine label="Umgestellt" latex={step.rearrangedLatex} block />
        <FormulaLine label="Eingesetzt" latex={step.substitutedLatex} />
        <div className="step-result" dangerouslySetInnerHTML={{ __html: renderLatex(step.resultLatex, true) }} />
      </div>
    </details>
  )
}

function FormulaLine({ label, latex, block = false }: { label: string; latex: string; block?: boolean }) {
  return (
    <div className="formula-line">
      <span>{label}</span>
      <div dangerouslySetInnerHTML={{ __html: renderLatex(latex, block) }} />
    </div>
  )
}

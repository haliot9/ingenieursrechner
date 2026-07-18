import { orderStepsByNarrative } from '../core/derivation-builder'
import type { DerivationRowKind, SolutionStep } from '../core/types'
import { renderLatex } from '../utils/latex'

interface StepDisplayProps {
  steps: SolutionStep[]
}

const derivationRowLabels: Record<DerivationRowKind, string> = {
  formula: 'Formel',
  rearrangement: 'Umgestellt',
  substitution: 'Eingesetzt',
  result: 'Ergebnis',
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

  const orderedSteps = orderStepsByNarrative(steps)
  const hasJouleDerivation = steps.some(step => step.derivationState?.mode === 'structured' || step.derivationState?.mode === 'unavailable')
  return (
    <details className="steps-panel" open>
      <summary>
        <span>
          <small className="eyebrow">Herleitung</small>
          Rechenschritte
        </span>
        <b>{steps.length}</b>
      </summary>
      {hasJouleDerivation && <p className="derivation-disclosure">Rechenwege verwenden die vom Solver verwendeten Standard-/SI-Einheiten. Anzeigenwerte können je nach gewählter Einheit abweichen.</p>}
      <div className="step-list">
        {orderedSteps.map((step, index) => <StepCard key={`${step.formulaId}-${step.targetVariable}-${index}`} step={step} index={index} />)}
      </div>
    </details>
  )
}

function StepCard({ step, index }: { step: SolutionStep; index: number }) {
  const content = step.derivationState?.mode === 'structured'
    ? step.derivationState.rows.map(row => <FormulaLine key={row.kind} label={derivationRowLabels[row.kind]} latex={row.latex} block={row.displayMode} />)
    : step.derivationState?.mode === 'unavailable'
      ? <><p className="derivation-unavailable">Rechenweg für diesen Schritt nicht verfügbar.</p><FormulaLine label="Ergebnis" latex={step.derivationState.resultRow.latex} block /></>
      : <LegacyRows step={step} />

  return (
    <details className="step-card">
      <summary>
        <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
        <span>
          <strong>{step.formulaName}</strong>
          <small>{step.explanation}</small>
        </span>
      </summary>
      <div className="step-body">{content}</div>
    </details>
  )
}

function LegacyRows({ step }: { step: SolutionStep }) {
  return <>
    <FormulaLine label="Formel" latex={step.originalLatex} block />
    <FormulaLine label="Umgestellt" latex={step.rearrangedLatex} block />
    <FormulaLine label="Eingesetzt" latex={step.substitutedLatex} />
    <div className="step-result" dangerouslySetInnerHTML={{ __html: renderLatex(step.resultLatex, true) }} />
  </>
}

function FormulaLine({ label, latex, block = false }: { label: string; latex: string; block?: boolean }) {
  return (
    <div className="formula-line">
      <span>{label}</span>
      <div dangerouslySetInnerHTML={{ __html: renderLatex(latex, block) }} />
    </div>
  )
}

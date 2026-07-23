import { orderStepsByNarrative } from '../core/derivation-builder'
import type { DerivationRowKind, PresentationPlan, SolutionStep, SolverError } from '../core/types'
import { renderLatex } from '../utils/latex'

interface StepDisplayProps {
  steps: SolutionStep[]
  presentation?: PresentationPlan
  contradictions?: SolverError[]
}

const derivationRowLabels: Record<DerivationRowKind, string> = {
  formula: 'Formel', rearrangement: 'Umgestellt', substitution: 'Eingesetzt', result: 'Ergebnis',
}

export function StepDisplay({ steps, presentation, contradictions = [] }: StepDisplayProps) {
  const primarySteps = presentation?.primarySteps ?? orderStepsByNarrative(steps)
  const hasPresentation = primarySteps.length > 0 || (presentation?.alternatives.length ?? 0) > 0 || (presentation?.blocked.length ?? 0) > 0 || contradictions.length > 0
  if (!hasPresentation) return <section className="empty-state"><span className="empty-index">01</span><div><h2>Noch keine Rechenschritte</h2><p>Lade den Referenzfall oder gib bekannte Zustandsgrößen ein. Ergebnisse, Diagramme und Herleitung erscheinen hier live.</p></div></section>

  const hasJouleDerivation = primarySteps.some(step => step.derivationState?.mode === 'structured' || step.derivationState?.mode === 'unavailable')
  const alternativesByTarget = new Map<string, PresentationPlan['alternatives']>()
  for (const alternative of presentation?.alternatives ?? []) {
    alternativesByTarget.set(alternative.targetId, [...(alternativesByTarget.get(alternative.targetId) ?? []), alternative])
  }
  return <details className="steps-panel" open>
    <summary><span><small className="eyebrow">Herleitung</small>Rechenschritte</span><b>{primarySteps.length}</b></summary>
    {hasJouleDerivation && <p className="derivation-disclosure">Rechenwege verwenden die vom Solver verwendeten Standard-/SI-Einheiten. Anzeigenwerte können je nach gewählter Einheit abweichen.</p>}
    {primarySteps.length > 0 && <div className="step-list">{primarySteps.map((step, index) => <StepCard key={`${step.formulaId}-${step.targetVariable}-${index}`} step={step} index={index} />)}</div>}
    {[...alternativesByTarget.entries()].map(([targetId, alternatives]) => <details className="alternative-derivation" data-target-id={targetId} key={targetId}>
      <summary>Alternative Herleitung für {targetId}</summary>
      {alternatives.map(alternative => <div key={alternative.formulaId}>
        <p>{alternative.formulaName}</p>
        <FormulaLine label="Ideale Annahme" latex={alternative.latex} block />
      </div>)}
    </details>)}
    {presentation?.blocked.map(blocked => <section className="blocked-relation" key={blocked.relationId}>
      <h3>Noch nicht eindeutig bestimmbar: {blocked.targetIds.join(', ')}</h3>
      <FormulaLine label="Bekannte Beziehung" latex={blocked.latex} block />
      <p>Zusätzlich benötigt: {blocked.missingFactHint}.</p>
    </section>)}
    {contradictions.length > 0 && <section className="contradiction-panel" role="alert"><h3>Widerspruch</h3>{contradictions.map((error, index) => <p key={`${error.variableId ?? 'global'}-${index}`}>{error.message}</p>)}</section>}
  </details>
}

function StepCard({ step, index }: { step: SolutionStep; index: number }) {
  const content = step.derivationState?.mode === 'structured'
    ? step.derivationState.rows.map(row => <FormulaLine key={row.kind} label={derivationRowLabels[row.kind]} latex={row.latex} block={row.displayMode} />)
    : step.derivationState?.mode === 'unavailable'
      ? <><p className="derivation-unavailable">Rechenweg für diesen Schritt nicht verfügbar.</p><FormulaLine label="Ergebnis" latex={step.derivationState.resultRow.latex} block /></>
      : <LegacyRows step={step} />
  return <details className="step-card" open><summary><span className="step-index">{String(index + 1).padStart(2, '0')}</span><span><strong>{step.formulaName}</strong><small>{step.explanation}</small></span></summary><div className="step-body">{content}</div></details>
}

function LegacyRows({ step }: { step: SolutionStep }) {
  return <><FormulaLine label="Formel" latex={step.originalLatex} block /><FormulaLine label="Umgestellt" latex={step.rearrangedLatex} block /><FormulaLine label="Eingesetzt" latex={step.substitutedLatex} /><div className="step-result" dangerouslySetInnerHTML={{ __html: renderLatex(step.resultLatex, true) }} /></>
}

function FormulaLine({ label, latex, block = false }: { label: string; latex: string; block?: boolean }) {
  return <div className="formula-line"><span>{label}</span><div dangerouslySetInnerHTML={{ __html: renderLatex(latex, block) }} /></div>
}

import { numberToLatex } from '../../utils/latex'
import type { CalculationStory, CalculationStoryCompositionInput, CalculationStoryConsumedStep, CalculationStoryRow, CalculationStoryState } from '../../core/calculation-story'

const CV_DIRECTION = 'cv_from_Rs_kappa:cv'
const CP_DIRECTION = 'cp_from_kappa_cv:cp'

const CV_CONSUMED_STEP: CalculationStoryConsumedStep = {
  formulaId: 'cv_from_Rs_kappa', targetVariable: 'cv', directionId: CV_DIRECTION,
}
const CP_CONSUMED_STEP: CalculationStoryConsumedStep = {
  formulaId: 'cp_from_kappa_cv', targetVariable: 'cp', directionId: CP_DIRECTION,
}

function selectedDirection(input: CalculationStoryCompositionInput, targetId: string): string | undefined {
  return input.plan?.primaryByTarget.get(targetId)?.directionId
}

function hasStep(input: CalculationStoryCompositionInput, formulaId: string, targetId: string): boolean {
  return input.steps.some(step => step.formulaId === formulaId && step.targetVariable === targetId)
}

function latexFor(input: CalculationStoryCompositionInput, id: string): string {
  return input.variables.find(variable => variable.id === id)?.latex ?? id
}

function finalNumericLatex(input: CalculationStoryCompositionInput, id: string): string | undefined {
  const state = input.values[id]
  const variable = input.variables.find(candidate => candidate.id === id)
  if (!state || state.value === null || state.value === undefined || !Number.isFinite(state.value)) return undefined
  return `${latexFor(input, id)} = ${numberToLatex(state.value, variable?.defaultUnit)}`
}

function unavailable(reason: string): CalculationStoryState {
  return { mode: 'unavailable', reason }
}

function referenceStory(input: CalculationStoryCompositionInput): CalculationStoryState {
  if (selectedDirection(input, 'cp') !== CP_DIRECTION || !hasStep(input, 'cv_from_Rs_kappa', 'cv') || !hasStep(input, 'cp_from_kappa_cv', 'cp')) {
    return unavailable('Der ausgewählte Stoffeigenschaftsweg ist unvollständig; eine verlässliche Herleitung wird deshalb nicht angezeigt.')
  }
  const cvNumeric = finalNumericLatex(input, 'cv')
  const cpNumeric = finalNumericLatex(input, 'cp')
  if (!cvNumeric || !cpNumeric) return unavailable('Für die Stoffeigenschafts-Herleitung fehlen bestätigte Solverwerte.')

  const cp = latexFor(input, 'cp')
  const cv = latexFor(input, 'cv')
  const rs = latexFor(input, 'Rs')
  const kappa = latexFor(input, 'kappa')
  const rows: CalculationStoryRow[] = [
    { id: 'kappa-governing', kind: 'governing', equationLatex: `${kappa} = \\frac{${cp}}{${cv}}`, note: 'Freigegebene Grundbeziehung.' },
    { id: 'cp-derived-relation', kind: 'result', equationLatex: `${cp} = ${kappa} ${cv}`, operation: 'äquivalent umstellen', note: 'Beziehung isoliert; noch nicht mit Zahlen auswertbar.', state: 'derived' },
    { id: 'rs-governing', kind: 'governing', equationLatex: `${rs} = ${cp} - ${cv}`, note: 'Freigegebene Grundbeziehung.' },
    { id: 'substitute-cp', kind: 'transform', equationLatex: `${rs} = ${kappa} ${cv} - ${cv}`, operation: `${cp} einsetzen`, note: 'Gleiche Beziehung, nur mit der zuvor isolierten Form.' },
    { id: 'factor-cv', kind: 'transform', equationLatex: `${rs} = ${cv}(${kappa} - 1)`, operation: `${cv} ausklammern`, note: 'Gemeinsamen Faktor sammeln.' },
    { id: 'cv-resolved', kind: 'result', equationLatex: `${cv} = \\frac{${rs}}{${kappa} - 1}`, operation: 'durch κ − 1 teilen', note: 'Vollständig erreichbar, weil Rₛ und κ bekannt sind; κ ≠ 1.', state: 'reachable' },
    { id: 'cv-numeric', kind: 'numeric', equationLatex: cvNumeric, note: 'Numerischer Solverwert; die Zahlenarbeit bleibt der Herleitung untergeordnet.' },
    { id: 'cp-reuse', kind: 'reuse', equationLatex: `${cp} = ${kappa} ${cv}`, operation: `${cv} wiederverwenden`, note: 'Die bereits bewiesene Beziehung wird jetzt mit dem erreichten cᵥ verwendet.', state: 'reachable' },
    { id: 'cp-numeric', kind: 'numeric', equationLatex: cpNumeric, note: 'Numerischer Solverwert; die Wertetabelle bleibt die Ergebnisoberfläche.' },
  ]
  const story: CalculationStory = { route: 'rs-kappa-to-cv-cp', title: 'Stoffeigenschaften: Rₛ + κ → cᵥ → cₚ', rows, consumedSteps: [CV_CONSUMED_STEP, CP_CONSUMED_STEP] }
  return { mode: 'complete', story }
}

function directCpStory(input: CalculationStoryCompositionInput): CalculationStoryState {
  if (!hasStep(input, 'cp_from_kappa_cv', 'cp')) return unavailable('Der ausgewählte Weg zu cₚ enthält keine bestätigte Solver-Provenienz.')
  const cpNumeric = finalNumericLatex(input, 'cp')
  if (!cpNumeric) return unavailable('Für die cₚ-Herleitung fehlt ein bestätigter Solverwert.')
  const cp = latexFor(input, 'cp')
  const cv = latexFor(input, 'cv')
  const kappa = latexFor(input, 'kappa')
  const story: CalculationStory = {
    route: 'cv-kappa-to-cp',
    title: 'Stoffeigenschaften: cᵥ + κ → cₚ',
    consumedSteps: [CP_CONSUMED_STEP],
    rows: [
      { id: 'kappa-governing', kind: 'governing', equationLatex: `${kappa} = \\frac{${cp}}{${cv}}`, note: 'Freigegebene Grundbeziehung.' },
      { id: 'cp-resolved', kind: 'result', equationLatex: `${cp} = ${kappa} ${cv}`, operation: 'äquivalent umstellen', note: 'Vollständig erreichbar, weil cᵥ und κ bekannt sind.', state: 'reachable' },
      { id: 'cp-numeric', kind: 'numeric', equationLatex: cpNumeric, note: 'Numerischer Solverwert; keine unnötige Eliminierung über Rₛ.' },
    ],
  }
  return { mode: 'complete', story }
}

export function composeJouleCalculationStory(input: CalculationStoryCompositionInput): CalculationStoryState {
  const cvRoute = selectedDirection(input, 'cv')
  const cpRoute = selectedDirection(input, 'cp')
  if (cvRoute === CV_DIRECTION) return referenceStory(input)
  if (input.values.cv?.isUserInput && cpRoute === CP_DIRECTION) return directCpStory(input)
  return { mode: 'not-applicable' }
}

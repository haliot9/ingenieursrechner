import { numberToLatex } from '../../utils/latex'
import type {
  CalculationStoryCompositionInput,
  CalculationStoryConsumedStep,
  CalculationStoryRow,
  CalculationStoryState,
  StoryOperationKind,
} from '../../core/calculation-story'
import { JOULE_DIRECTION_POLICIES } from './config'
import { JOULE_FORMULAS } from './formulas'

export interface JouleStoryRecipe {
  directionId: string
  entryPointLatex: string
  conditions: readonly string[]
  transitions: readonly StoryOperationKind[]
  sharedProofNodeKey?: string
}

const VALIDATE_ONLY = new Set(['ideal_gas_1:Rs', 'ideal_gas_2:Rs', 'ideal_gas_3:Rs', 'ideal_gas_4:Rs'])

function recipeFor(formulaId: string, targetId: string, entryPointLatex: string): JouleStoryRecipe {
  const directionId = `${formulaId}:${targetId}`
  const policy = JOULE_DIRECTION_POLICIES[directionId]
  const conditions = policy?.conditions?.map(condition => condition.id) ?? []
  const sharedProofNodeKey = formulaId.startsWith('ideal_gas_')
    ? 'ideal-gas-state'
    : formulaId.startsWith('entropy_abs_')
      ? 'relative-entropy-datum'
      : formulaId === 'cp_from_kappa_cv' || formulaId === 'cv_from_Rs_kappa'
        ? 'material-properties'
        : undefined
  return { directionId, entryPointLatex, conditions, transitions: ['isolate'], sharedProofNodeKey }
}

/** The frozen finite registry is generated only from live registered directions. */
export const JOULE_STORY_RECIPES: Readonly<Record<string, JouleStoryRecipe>> = Object.fromEntries(
  JOULE_FORMULAS.flatMap(formula => Object.keys(formula.solveFor)
    .map(targetId => recipeFor(formula.id, targetId, formula.latex))
    .filter(recipe => !VALIDATE_ONLY.has(recipe.directionId)))
    .map(recipe => [recipe.directionId, recipe]),
)

function latexFor(input: CalculationStoryCompositionInput, id: string): string {
  return input.variables.find(variable => variable.id === id)?.latex ?? id
}

function finalNumericLatex(input: CalculationStoryCompositionInput, id: string): string | undefined {
  const state = input.values[id]
  const variable = input.variables.find(candidate => candidate.id === id)
  if (!state || state.value === null || !Number.isFinite(state.value)) return undefined
  return `${latexFor(input, id)} = ${numberToLatex(state.value, variable?.defaultUnit)}`
}

function equation(latex: string, continuation = false) {
  const [lhs, ...right] = latex.split('=')
  const rhs = right.join('=').trim()
  return { lhsLatex: continuation ? undefined : lhs.trim(), relationLatex: '=', rhsLatex: rhs || latex.trim() }
}

function consumed(directionId: string): CalculationStoryConsumedStep {
  const [formulaId, targetVariable] = directionId.split(':')
  return { formulaId, targetVariable, directionId }
}

function operation(kind: StoryOperationKind, label: string) {
  const text = label.replaceAll('\\', '').replaceAll('_', ' ').replaceAll('κ', 'kappa').replaceAll('η', 'eta').replace(/[{}]/g, '')
  return { kind, latex: `\\xrightarrow{\\text{${text}}}` }
}

function row(
  id: string,
  kind: CalculationStoryRow['kind'],
  rowRole: NonNullable<CalculationStoryRow['rowRole']>,
  equationLatex: string,
  options: Partial<CalculationStoryRow> = {},
): CalculationStoryRow {
  return { id, kind, rowRole, chainId: id.split(':')[0], equationLatex, equation: equation(equationLatex, rowRole === 'continuation'), ...options }
}

function materialRows(input: CalculationStoryCompositionInput, selected: Set<string>): CalculationStoryRow[] {
  const cv = latexFor(input, 'cv')
  const cp = latexFor(input, 'cp')
  const rs = latexFor(input, 'Rs')
  const kappa = latexFor(input, 'kappa')
  const rows: CalculationStoryRow[] = []
  if (selected.has('cv_from_Rs_kappa:cv')) {
    const cvNumeric = finalNumericLatex(input, 'cv')
    if (!cvNumeric) throw new Error('missing accepted cv value')
    rows.push(
      row('material:kappa-governing', 'governing', 'start', `${kappa} = \\frac{${cp}}{${cv}}`, { note: 'Freigegebene Stoffbeziehung; c_v > 0.' }),
      row('material:cp-derived-relation', 'result', 'subject-change', `${cp} = ${kappa} ${cv}`, { equation: { bridgeLatex: '\\Longleftrightarrow', lhsLatex: cp, relationLatex: '=', rhsLatex: `${kappa} ${cv}` }, note: 'Dünne wiederverwendbare Relation.', state: 'derived' }),
      row('material:rs-governing', 'governing', 'start', `${rs} = ${cp} - ${cv}`, { note: 'Zweite freigegebene Stoffbeziehung.' }),
      row('material:substitute-cp', 'transform', 'continuation', `${rs} = ${kappa} ${cv} - ${cv}`, { operation: operation('substitute', `substitute ${cp}`), note: 'Der linke Gegenstand bleibt dieselbe Beziehung.' }),
      row('material:factor-cv', 'transform', 'continuation', `${rs} = ${cv}(${kappa} - 1)`, { operation: operation('factor', `factor ${cv}`) }),
      row('material:cv-resolved', 'result', 'subject-change', `${cv} = \\frac{${rs}}{${kappa} - 1}`, { equation: { bridgeLatex: '\\Longleftrightarrow', lhsLatex: cv, relationLatex: '=', rhsLatex: `\\frac{${rs}}{${kappa} - 1}` }, operation: operation('divide', `divide by ${kappa} - 1`), note: `${kappa} \\ne 1`, state: 'reachable' }),
      row('material:cv-numeric', 'numeric', 'numeric', cvNumeric, { equation: equation(cvNumeric, true), note: 'Akzeptierter Solverwert.' }),
    )
  }
  if (selected.has('cp_from_kappa_cv:cp')) {
    const cpNumeric = finalNumericLatex(input, 'cp')
    if (!cpNumeric) throw new Error('missing accepted cp value')
    rows.push(
      row('material:cp-reuse', 'reuse', 'reuse', `${cp} = ${kappa} ${cv}`, { operation: operation('reuse', `reuse ${cv}`), note: 'Die zuvor bewiesene Relation wird mit dem erreichten c_v verwendet.', state: 'reachable' }),
      row('material:cp-numeric', 'numeric', 'numeric', cpNumeric, { equation: equation(cpNumeric, true), note: 'Akzeptierter Solverwert.' }),
    )
  }
  return rows
}

function formulaById(id: string) {
  return JOULE_FORMULAS.find(formula => formula.id === id)
}

function genericRows(input: CalculationStoryCompositionInput, directionId: string, seenProofNodes: Set<string>): CalculationStoryRow[] {
  const recipe = JOULE_STORY_RECIPES[directionId]
  const step = input.steps.find(candidate => `${candidate.formulaId}:${candidate.targetVariable}` === directionId)
  if (!recipe || !step) throw new Error(`missing recipe evidence for ${directionId}`)
  const formula = formulaById(step.formulaId)
  if (!formula) throw new Error(`unknown live formula for ${directionId}`)
  const rows: CalculationStoryRow[] = []
  const proofKey = recipe.sharedProofNodeKey ?? directionId
  if (!seenProofNodes.has(proofKey)) {
    rows.push(row(`${directionId}:governing`, 'governing', 'start', recipe.entryPointLatex, {
      chainId: proofKey,
      note: recipe.conditions.length > 0 ? `Bedingungen: ${recipe.conditions.join(', ')}.` : formula.name,
    }))
    seenProofNodes.add(proofKey)
  }
  rows.push(
    row(`${directionId}:result`, 'result', 'subject-change', step.rearrangedLatex, {
      chainId: directionId,
      equation: { ...equation(step.rearrangedLatex), bridgeLatex: '\\Longleftrightarrow' },
      operation: operation('isolate', `solve for ${latexFor(input, step.targetVariable)}`),
      state: 'reachable',
      note: 'Aus der registrierten, ausgewählten Richtung.',
    }),
    row(`${directionId}:numeric`, 'numeric', 'numeric', step.resultLatex, {
      chainId: directionId,
      equation: equation(step.resultLatex, true),
      note: 'Akzeptierter Solverwert.',
    }),
  )
  if (directionId === 'entropy_abs_4:s4') rows.push(row(`${directionId}:check`, 'reuse', 'check', 's_4 - s_3 = 0', {
    chainId: 'isentropic-check-34', operation: operation('reuse', 'isentropic check'), note: 'Prüfung; die primäre Provenienz bleibt die relative Entropieformel.',
  }))
  if (directionId === 'net_work:w_netto') rows.push(row(`${directionId}:check`, 'reuse', 'check', 'w_{netto} + (q_{in} + q_{out}) \\approx 0', {
    chainId: 'cycle-balance-check', operation: operation('reuse', 'cycle check'), note: 'Plausibilitätsprüfung, keine zweite primäre Ableitung.',
  }))
  return rows
}

export function composeJouleCalculationStory(input: CalculationStoryCompositionInput): CalculationStoryState {
  if (!input.plan) return { mode: 'not-applicable' }
  const selected = [...input.plan.primaryByTarget.values()].map(direction => direction.directionId)
  if (selected.length === 0) return { mode: 'not-applicable' }
  const unsupported = selected.filter(directionId => !JOULE_STORY_RECIPES[directionId])
  if (unsupported.length > 0) return { mode: 'unavailable', reason: `Für die ausgewählte Richtung fehlt eine freigegebene Rechenkette: ${unsupported.join(', ')}.` }
  const missingEvidence = selected.filter(directionId => !input.steps.some(step => `${step.formulaId}:${step.targetVariable}` === directionId))
  if (missingEvidence.length > 0) return { mode: 'unavailable', reason: 'Für mindestens eine ausgewählte Richtung fehlt bestätigte Solver-Provenienz.' }
  try {
    const selectedSet = new Set(selected)
    const rows = materialRows(input, selectedSet)
    const seenProofNodes = new Set(['material-properties'])
    for (const directionId of selected) {
      if (directionId === 'cv_from_Rs_kappa:cv' || directionId === 'cp_from_kappa_cv:cp') continue
      rows.push(...genericRows(input, directionId, seenProofNodes))
    }
    const consumedSteps = selected.map(consumed)
    return { mode: 'complete', story: {
      route: 'joule-selected-direction-composer',
      title: 'Joule-/Brayton-Rechengeschichte',
      rows,
      consumedSteps,
      unconsumedPrimarySteps: [],
    } }
  } catch {
    return { mode: 'unavailable', reason: 'Die gewählte Joule-Route konnte nicht als belegte Rechenkette aufgebaut werden; die bestätigten Rechenwerte bleiben erhalten.' }
  }
}

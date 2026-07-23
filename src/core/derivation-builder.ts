import { parse } from 'mathjs'
import { numberToLatex } from '../utils/latex'
import type {
  DerivationContext,
  DerivationProvenance,
  DerivationRow,
  Formula,
  SolutionStep,
  Variable,
} from './types'

export function formatNumber(value: number): string {
  return numberToLatex(value)
}

export interface BuildSolutionStepInput {
  formula: Formula
  targetId: string
  target: Variable | undefined
  evaluationScope: Record<string, number>
  acceptedValue: number
  sourceVariableIds: readonly string[]
  sourceStepIndexes: Readonly<Record<string, number>>
  rawStepIndex: number
}

function resultLatex(target: Variable | undefined, targetId: string, value: number): { latex: string; unit: string } {
  const symbol = target?.latex ?? targetId
  const unit = target?.defaultUnit ?? ''
  try {
    return { latex: `${symbol} = ${numberToLatex(value, unit)}`, unit }
  } catch {
    try {
      return { latex: `${symbol} = ${numberToLatex(value)}`, unit: '' }
    } catch {
      return { latex: `${symbol} = ${String(value)}`, unit: '' }
    }
  }
}

function makeMinimumStep(input: BuildSolutionStepInput): SolutionStep {
  const definition = input.formula.latexSteps[input.targetId]
  const result = resultLatex(input.target, input.targetId, input.acceptedValue)
  const provenance: DerivationProvenance = {
    formulaId: input.formula.id,
    targetId: input.targetId,
    sourceVariableIds: input.sourceVariableIds,
    sourceStepIndexes: input.sourceStepIndexes,
    rawStepIndex: input.rawStepIndex,
  }
  return {
    formulaId: input.formula.id,
    formulaName: input.formula.name,
    targetVariable: input.targetId,
    targetSymbol: input.target?.latex ?? input.targetId,
    originalLatex: input.formula.latex,
    rearrangedLatex: definition?.rearranged ?? input.formula.latex,
    substitutedLatex: '',
    resultLatex: result.latex,
    resultValue: input.acceptedValue,
    resultUnit: result.unit,
    explanation: definition?.explanation ?? `Berechnet mit ${input.formula.name}`,
    derivationProvenance: provenance,
  }
}

function legacySubstitution(scope: Record<string, number>, variables: Variable[]): string {
  return Object.entries(scope).map(([id, value]) => {
    const variable = variables.find(item => item.id === id)
    return `${variable?.latex ?? id} = ${formatNumber(value)}`
  }).join(', \\quad ')
}

function substitutedExpression(expression: string, scope: Record<string, number>, variables: Variable[]): string {
  const latexById = new Map(variables.map(variable => [variable.id, variable.latex]))
  return parse(expression).toTex({
    handler: (node: { isSymbolNode?: boolean; name?: string }) => {
      if (!node.isSymbolNode || !node.name) return undefined
      if (Object.prototype.hasOwnProperty.call(scope, node.name)) return formatNumber(scope[node.name])
      return latexById.get(node.name) ?? node.name
    },
  })
}

function unavailable(step: SolutionStep, reasonCode: 'metadata_invalid' | 'ast_unacceptable' | 'render_input_invalid' | 'adapter_exception'): SolutionStep {
  const resultRow: DerivationRow = { kind: 'result', latex: step.resultLatex, displayMode: true }
  return { ...step, derivationState: { mode: 'unavailable', resultRow, reasonCode } }
}

export function buildSolutionStepNoThrow(input: BuildSolutionStepInput, variables: Variable[]): { step: SolutionStep } {
  const minimum = makeMinimumStep(input)
  try {
    const definition = input.formula.latexSteps[input.targetId]
    const derivation = definition?.derivation
    if (!derivation) {
      return {
        step: {
          ...minimum,
          substitutedLatex: legacySubstitution(input.evaluationScope, variables),
          derivationState: { mode: 'legacy' },
        },
      }
    }
    if (!derivation.optedIn || !definition.rearranged || !input.formula.solveFor[input.targetId]) {
      return { step: unavailable(minimum, 'metadata_invalid') }
    }
    if (derivation.rearrangement !== 'show' && derivation.rearrangement !== 'omit') {
      return { step: unavailable(minimum, 'metadata_invalid') }
    }

    const context: DerivationContext = { values: input.evaluationScope, formatValue: formatNumber }
    const substitution = derivation.substitution.mode === 'explicit-override'
      ? derivation.substitution.buildLatex(context)
      : substitutedExpression(input.formula.solveFor[input.targetId], input.evaluationScope, variables)
    if (!substitution.trim()) return { step: unavailable(minimum, 'render_input_invalid') }

    const rows: DerivationRow[] = [{ kind: 'formula', latex: input.formula.latex, displayMode: true }]
    if (derivation.rearrangement === 'show') {
      rows.push({ kind: 'rearrangement', latex: definition.rearranged, displayMode: true })
    }
    rows.push({ kind: 'substitution', latex: substitution, displayMode: true })
    rows.push({ kind: 'result', latex: minimum.resultLatex, displayMode: true })
    return { step: { ...minimum, derivationState: { mode: 'structured', rows }, narrative: derivation.narrative } }
  } catch {
    return { step: unavailable(minimum, 'adapter_exception') }
  }
}

export function orderStepsByNarrative(steps: SolutionStep[], policy?: import('./types').NarrativeOrderingPolicy): SolutionStep[] {
  const byRawIndex = new Map(steps.map((step, index) => [step.derivationProvenance?.rawStepIndex ?? index, step]))
  const remaining = new Set(steps)
  const ordered: SolutionStep[] = []

  while (remaining.size > 0) {
    const ready = [...remaining].filter(step => Object.values(step.derivationProvenance?.sourceStepIndexes ?? {}).every(sourceIndex => {
      const source = byRawIndex.get(sourceIndex)
      return !source || ordered.includes(source)
    }))
    if (ready.length === 0) return steps
    ready.sort((left, right) => {
      const leftNarrative = left.narrative
      const rightNarrative = right.narrative
      const leftContext = leftNarrative?.contextId
      const rightContext = rightNarrative?.contextId
      const leftRank = leftContext === undefined ? Number.MAX_SAFE_INTEGER : policy?.contextRanks[leftContext] ?? Number.MAX_SAFE_INTEGER
      const rightRank = rightContext === undefined ? Number.MAX_SAFE_INTEGER : policy?.contextRanks[rightContext] ?? Number.MAX_SAFE_INTEGER
      return leftRank - rightRank
        || (leftNarrative?.rank ?? 0) - (rightNarrative?.rank ?? 0)
        || (left.derivationProvenance?.rawStepIndex ?? steps.indexOf(left)) - (right.derivationProvenance?.rawStepIndex ?? steps.indexOf(right))
    })
    const next = ready[0]
    ordered.push(next)
    remaining.delete(next)
  }
  return ordered
}


export interface BuildPresentationPlanInput {
  steps: readonly SolutionStep[]
  plan?: import('./derivation-planner').ReachabilityPlan
  formulas: readonly Formula[]
  orderingPolicy?: import('./types').NarrativeOrderingPolicy
  diagnostics?: readonly import('./types').DiagnosticRelation[]
  visibleAlternativeDirectionIds?: readonly string[]
}

function directionFormulaId(directionId: string): string {
  return directionId.slice(0, directionId.lastIndexOf(':'))
}

export function buildPresentationPlan(input: BuildPresentationPlanInput): import('./types').PresentationPlan {
  const primarySteps = orderStepsByNarrative([...input.steps], input.orderingPolicy)
  if (!input.plan) return { primarySteps, alternatives: [], blocked: [] }

  const formulas = new Map(input.formulas.map(formula => [formula.id, formula]))
  const visibleAlternativeIds = input.visibleAlternativeDirectionIds ? new Set(input.visibleAlternativeDirectionIds) : undefined
  const alternatives = [...input.plan.alternativesByTarget.entries()].flatMap(([targetId, candidates]) => candidates
    .filter(candidate => !visibleAlternativeIds || visibleAlternativeIds.has(candidate.directionId))
    .flatMap(candidate => {
    const formula = formulas.get(directionFormulaId(candidate.directionId))
    return formula ? [{ targetId, formulaId: formula.id, formulaName: formula.name, label: 'Alternative Herleitung', latex: formula.latex }] : []
  }))
  const blockedTargets = new Map(input.plan.blocked.map(blocked => [blocked.targetId, blocked]))
  const blocked = (input.diagnostics ?? []).flatMap(relation => {
    if (!relation.targetIds.every(targetId => blockedTargets.has(targetId))) return []
    const missingIds = [...new Set(relation.targetIds.flatMap(targetId => blockedTargets.get(targetId)!.candidates.flatMap(candidate => candidate.missingIds)))].sort()
    return [{ relationId: relation.id, targetIds: relation.targetIds, latex: relation.latex, missingFactHint: relation.missingFactHint, missingIds }]
  })
  return { primarySteps, alternatives, blocked }
}

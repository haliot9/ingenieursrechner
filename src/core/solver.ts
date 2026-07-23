import { evaluate } from 'mathjs'
import type { SolutionStep, SolverResult, VariableState, Variable, SolverError } from './types'
import { FormulaRegistry } from './formula-registry'
import { validateInput } from './validator'
import { buildSolutionStepNoThrow, formatNumber } from './derivation-builder'
import { compileSolveDirections, type DirectionPolicy } from './solve-directions'
import { planDerivations, type KnownFact, type PreconditionOutcome } from './derivation-planner'

export interface PlannedExecutionConfig {
  policies?: Readonly<Record<string, DirectionPolicy>>
  postValidate?: (targetId: string, values: Record<string, VariableState>) => SolverError[]
  preconditionOutcomes?: (knownFacts: readonly KnownFact[], directions: readonly import('./solve-directions').SolveDirection[]) => Readonly<Record<string, PreconditionOutcome>>
}

interface SolverConfig {
  maxIterations?: number
  tolerance?: number
  plannedExecution?: PlannedExecutionConfig
}

/**
 * Fixed-point iteration solver.
 *
 * Algorithm:
 * 1. Collect all known variables (user inputs)
 * 2. Find formulas where exactly ONE variable is unknown
 * 3. Solve for that unknown
 * 4. Record the step
 * 5. Repeat until no new values can be computed
 * 6. Report unsolved variables
 */
export function solve(
  registry: FormulaRegistry,
  variables: Variable[],
  inputValues: Record<string, VariableState>,
  activeProcesses: string[] = [],
  config: SolverConfig = {}
): SolverResult {
  if (config.plannedExecution) return solveSelectedPlan(registry, variables, inputValues, activeProcesses, config.plannedExecution)
  const { maxIterations = 50 } = config

  // Clone input state
  const values: Record<string, VariableState> = {}
  for (const v of variables) {
    values[v.id] = inputValues[v.id]
      ? { ...inputValues[v.id] }
      : { value: null, unit: v.defaultUnit, isUserInput: false, isComputed: false }
  }

  const steps: SolutionStep[] = []
  const errors: SolverError[] = []
  let changed = true
  let iteration = 0

  while (changed && iteration < maxIterations) {
    changed = false
    iteration++

    const allFormulas = registry.filterByProcess(registry.getAll(), activeProcesses)

    for (const formula of allFormulas) {
      // Find which variables in this formula are unknown
      const unknowns = formula.variables.filter(
        varId => values[varId]?.value === null || values[varId]?.value === undefined
      )

      // We can only solve if exactly ONE variable is unknown
      if (unknowns.length !== 1) continue

      const targetId = unknowns[0]

      // Check if we have a solve-for expression for this variable
      if (!(targetId in formula.solveFor)) continue

      // Build the scope (known values) for math.js evaluation
      const scope: Record<string, number> = {}
      let canSolve = true

      for (const varId of formula.variables) {
        if (varId === targetId) continue
        const state = values[varId]
        if (state?.value === null || state?.value === undefined) {
          canSolve = false
          break
        }
        scope[varId] = state.value
      }

      if (!canSolve) continue

      try {
        // Evaluate the expression
        const expression = formula.solveFor[targetId]
        const result = evaluate(expression, scope)
        const numResult = typeof result === 'number' ? result : Number(result)

        if (!isFinite(numResult)) {
          errors.push({
            type: 'computation_error',
            message: `Berechnung von ${targetId} ergab keinen endlichen Wert (Division durch 0?)`,
            variableId: targetId,
            formulaId: formula.id,
          })
          continue
        }

        // Find the variable definition for LaTeX info
        const targetVar = variables.find(v => v.id === targetId)
        if (targetVar) {
          const constraintError = validateInput(targetVar, {
            value: numResult,
            unit: targetVar.defaultUnit,
            isUserInput: false,
            isComputed: true,
          })
          if (constraintError) {
            errors.push({ ...constraintError, formulaId: formula.id })
            continue
          }
        }
        const rawStepIndex = steps.length
        const sourceStepIndexes = Object.fromEntries(
          formula.variables
            .filter(varId => varId !== targetId)
            .flatMap(varId => values[varId]?.isComputed && values[varId]?.stepIndex !== undefined
              ? [[varId, values[varId].stepIndex]]
              : [])
        )
        values[targetId] = {
          value: numResult,
          unit: values[targetId]?.unit ?? targetVar?.defaultUnit ?? '',
          isUserInput: false,
          isComputed: true,
          stepIndex: rawStepIndex,
        }
        changed = true

        const presentation = buildSolutionStepNoThrow({
          formula,
          targetId,
          target: targetVar,
          evaluationScope: scope,
          acceptedValue: numResult,
          sourceVariableIds: formula.variables.filter(varId => varId !== targetId),
          sourceStepIndexes,
          rawStepIndex,
        }, variables)
        steps.push(presentation.step)
      } catch (err) {
        errors.push({
          type: 'computation_error',
          message: `Fehler bei ${formula.name}: ${err instanceof Error ? err.message : String(err)}`,
          variableId: targetId,
          formulaId: formula.id,
        })
      }
    }
  }

  // Determine unsolved variables
  const unsolved = variables
    .filter(v => values[v.id]?.value === null || values[v.id]?.value === undefined)
    .map(v => v.id)

  if (unsolved.length > 0 && errors.length === 0) {
    errors.push({
      type: 'insufficient_data',
      message: `Zu wenig gegebene Werte um ${unsolved.map(id => {
        const v = variables.find(v => v.id === id)
        return v?.symbol ?? id
      }).join(', ')} zu berechnen.`,
    })
  }

  return { values, steps, unsolved, errors }
}

export { formatNumber }


function equalDerivedValue(left: number, right: number, userFact = false): boolean {
  const relative = userFact ? 1e-6 : 1e-9
  return Math.abs(left - right) <= Math.max(1e-9, relative * Math.max(Math.abs(left), Math.abs(right), 1))
}

function cloneValues(variables: Variable[], inputValues: Record<string, VariableState>): Record<string, VariableState> {
  return Object.fromEntries(variables.map(variable => [variable.id, inputValues[variable.id]
    ? { ...inputValues[variable.id] }
    : { value: null, unit: variable.defaultUnit, isUserInput: false, isComputed: false }]))
}

function deduplicatePlannedContradictions(errors: readonly SolverError[]): SolverError[] {
  const seenFormulaIds = new Set<string>()
  return errors.filter(error => {
    if (error.type !== 'contradiction' || !error.formulaId) return true
    if (seenFormulaIds.has(error.formulaId)) return false
    seenFormulaIds.add(error.formulaId)
    return true
  })
}

function solveSelectedPlan(
  registry: FormulaRegistry,
  variables: Variable[],
  inputValues: Record<string, VariableState>,
  activeProcesses: string[],
  execution: PlannedExecutionConfig,
): SolverResult {
  const values = cloneValues(variables, inputValues)
  const formulas = registry.filterByProcess(registry.getAll(), [...activeProcesses, 'known-facts-first'])
  const formulaById = new Map(formulas.map(formula => [formula.id, formula]))
  const directions = compileSolveDirections(formulas, variables.map(variable => variable.id), execution.policies)
  const knownFacts: KnownFact[] = Object.entries(values)
    .filter(([, state]) => state.value !== null && state.value !== undefined)
    .map(([id, state]) => ({ id, valueSI: state.value!, source: state.isUserInput ? 'user' : 'derived' }))
  const preconditionOutcomes = execution.preconditionOutcomes?.(knownFacts, directions) ?? {}
  const plan = planDerivations({ knownFacts, directions, preconditionOutcomes })
  const errors: SolverError[] = []
  const steps: SolutionStep[] = []

  const primary = [...plan.primaryByTarget.values()].sort((left, right) =>
    left.cost.closureApplications - right.cost.closureApplications || left.directionId.localeCompare(right.directionId))

  for (const candidate of primary) {
    const direction = directions.find(item => item.id === candidate.directionId)!
    const formula = formulaById.get(direction.formulaId)!
    const scope: Record<string, number> = {}
    if (!direction.requiredIds.every(id => values[id]?.value !== null && values[id]?.value !== undefined)) {
      errors.push({ type: 'computation_error', variableId: direction.targetId, formulaId: formula.id, message: `Der ausgewählte Rechenweg „${direction.id}“ enthält nicht mehr alle erforderlichen Werte.` })
      break
    }
    for (const id of direction.requiredIds) scope[id] = values[id].value!
    try {
      const evaluated = evaluate(formula.solveFor[direction.targetId], scope)
      const value = typeof evaluated === 'number' ? evaluated : Number(evaluated)
      if (!Number.isFinite(value)) { errors.push({ type: 'computation_error', variableId: direction.targetId, formulaId: formula.id, message: `Der ausgewählte Rechenweg „${direction.id}“ ergab keinen endlichen Wert.` }); break }
      const target = variables.find(variable => variable.id === direction.targetId)
      if (target) {
        const constraint = validateInput(target, { value, unit: target.defaultUnit, isUserInput: false, isComputed: true })
        if (constraint) { errors.push({ ...constraint, formulaId: formula.id }); break }
      }
      const trial = { ...values, [direction.targetId]: { value, unit: target?.defaultUnit ?? '', isUserInput: false, isComputed: true } }
      const validationErrors = execution.postValidate?.(direction.targetId, trial) ?? []
      if (validationErrors.length) { errors.push(...validationErrors.map(error => ({ ...error, formulaId: formula.id }))); break }
      const rawStepIndex = steps.length
      const sourceStepIndexes = Object.fromEntries(direction.requiredIds.flatMap(id => values[id]?.isComputed && values[id]?.stepIndex !== undefined ? [[id, values[id].stepIndex]] : []))
      values[direction.targetId] = { ...trial[direction.targetId], stepIndex: rawStepIndex }
      const presentation = buildSolutionStepNoThrow({ formula, targetId: direction.targetId, target, evaluationScope: scope, acceptedValue: value, sourceVariableIds: direction.requiredIds, sourceStepIndexes, rawStepIndex }, variables)
      steps.push(presentation.step)
    } catch (error) {
      errors.push({ type: 'computation_error', variableId: direction.targetId, formulaId: formula.id, message: `Der ausgewählte Rechenweg „${direction.id}“ konnte nicht ausgeführt werden: ${error instanceof Error ? error.message : String(error)}` })
      break
    }
  }

  // Validate-only directions and redundant immutable user facts may report disagreement,
  // but never create or overwrite a target value.
  for (const direction of directions) {
    if (direction.mode === 'disabled' || !values[direction.targetId]?.isUserInput) continue
    if (!direction.requiredIds.every(id => values[id]?.value !== null && values[id]?.value !== undefined)) continue
    const formula = formulaById.get(direction.formulaId)!
    try {
      const scope = Object.fromEntries(direction.requiredIds.map(id => [id, values[id].value!]))
      const evaluated = evaluate(formula.solveFor[direction.targetId], scope)
      const value = typeof evaluated === 'number' ? evaluated : Number(evaluated)
      if (!Number.isFinite(value) || !equalDerivedValue(value, values[direction.targetId].value!, true)) {
        errors.push({ type: 'contradiction', variableId: direction.targetId, formulaId: formula.id, message: `Unveränderliche eingegebene Werte widersprechen der Beziehung „${formula.name}“ (${direction.id}).` })
      }
    } catch (error) {
      errors.push({ type: 'computation_error', variableId: direction.targetId, formulaId: formula.id, message: `Die Prüfbeziehung „${direction.id}“ konnte nicht ausgeführt werden: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  const unsolved = variables.filter(variable => values[variable.id]?.value === null || values[variable.id]?.value === undefined).map(variable => variable.id)
  return { values, steps, unsolved, errors: deduplicatePlannedContradictions(errors), plan }
}

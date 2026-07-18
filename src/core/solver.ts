import { evaluate } from 'mathjs'
import type { SolutionStep, SolverResult, VariableState, Variable, SolverError } from './types'
import { FormulaRegistry } from './formula-registry'
import { validateInput } from './validator'
import { buildSolutionStepNoThrow, formatNumber } from './derivation-builder'

interface SolverConfig {
  maxIterations?: number
  tolerance?: number
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

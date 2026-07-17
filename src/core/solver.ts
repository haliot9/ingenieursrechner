import { evaluate } from 'mathjs'
import type { SolutionStep, SolverResult, VariableState, Variable, SolverError } from './types'
import { FormulaRegistry } from './formula-registry'
import { validateInput } from './validator'
import { unitToLatex } from '../utils/latex'

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
        const latexSteps = formula.latexSteps[targetId]

        // Build substitution LaTeX
        const substitutedLatex = buildSubstitutedLatex(
          formula.solveFor[targetId],
          scope,
          variables
        )

        const resultUnit = values[targetId]?.unit ?? targetVar?.defaultUnit ?? ''
        const resultUnitLatex = unitToLatex(resultUnit)

        // Record the step
        const step: SolutionStep = {
          formulaId: formula.id,
          formulaName: formula.name,
          targetVariable: targetId,
          targetSymbol: targetVar?.latex ?? targetId,
          originalLatex: formula.latex,
          rearrangedLatex: latexSteps?.rearranged ?? formula.latex,
          substitutedLatex,
          resultLatex: `${targetVar?.latex ?? targetId} = ${formatNumber(numResult)}${resultUnitLatex ? ` \\; ${resultUnitLatex}` : ''}`,
          resultValue: numResult,
          resultUnit,
          explanation: latexSteps?.explanation ?? `Berechnet mit ${formula.name}`,
        }

        steps.push(step)
        values[targetId] = {
          value: numResult,
          unit: values[targetId]?.unit ?? targetVar?.defaultUnit ?? '',
          isUserInput: false,
          isComputed: true,
          stepIndex: steps.length - 1,
        }

        changed = true
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

/** Format a number nicely for LaTeX display */
function formatNumber(n: number): string {
  if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-3 && n !== 0)) {
    const exp = Math.floor(Math.log10(Math.abs(n)))
    const mantissa = n / Math.pow(10, exp)
    return `${mantissa.toFixed(3)} \\times 10^{${exp}}`
  }
  // Avoid floating point noise
  const rounded = Math.round(n * 1e10) / 1e10
  if (Number.isInteger(rounded)) return rounded.toString()
  return rounded.toPrecision(6).replace(/\.?0+$/, '')
}

/** Build a LaTeX string showing the substitution of values */
function buildSubstitutedLatex(
  _expression: string,
  scope: Record<string, number>,
  variables: Variable[]
): string {
  // Build a simple substitution display
  const parts = Object.entries(scope).map(([varId, value]) => {
    const v = variables.find(v => v.id === varId)
    return `${v?.latex ?? varId} = ${formatNumber(value)}`
  })
  return parts.join(', \\quad ')
}

export { formatNumber }

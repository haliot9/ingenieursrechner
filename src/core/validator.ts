import type { Variable, VariableState, SolverError } from './types'

/**
 * Validates user inputs against variable constraints.
 */
export function validateInput(
  variable: Variable,
  state: VariableState
): SolverError | null {
  if (state.value === null || state.value === undefined) return null

  const value = state.value

  if (!isFinite(value)) {
    return {
      type: 'constraint_violation',
      message: `${variable.name}: Wert muss eine endliche Zahl sein`,
      variableId: variable.id,
    }
  }

  if (!variable.constraints) return null

  for (const constraint of variable.constraints) {
    switch (constraint.type) {
      case 'positive':
        if (value <= 0) {
          return {
            type: 'constraint_violation',
            message: constraint.message,
            variableId: variable.id,
          }
        }
        break
      case 'nonzero':
        if (value === 0) {
          return {
            type: 'constraint_violation',
            message: constraint.message,
            variableId: variable.id,
          }
        }
        break
      case 'min':
        if (constraint.value !== undefined && value < constraint.value) {
          return {
            type: 'constraint_violation',
            message: constraint.message,
            variableId: variable.id,
          }
        }
        break
      case 'greaterThan':
        if (constraint.value !== undefined && value <= constraint.value) {
          return {
            type: 'constraint_violation',
            message: constraint.message,
            variableId: variable.id,
          }
        }
        break
      case 'lessThan':
        if (constraint.value !== undefined && value >= constraint.value) {
          return {
            type: 'constraint_violation',
            message: constraint.message,
            variableId: variable.id,
          }
        }
        break
      case 'max':
        if (constraint.value !== undefined && value > constraint.value) {
          return {
            type: 'constraint_violation',
            message: constraint.message,
            variableId: variable.id,
          }
        }
        break
    }
  }

  return null
}

/** Validate all inputs and return errors */
export function validateAllInputs(
  variables: Variable[],
  values: Record<string, VariableState>
): SolverError[] {
  const errors: SolverError[] = []
  for (const v of variables) {
    const state = values[v.id]
    if (!state) continue
    const err = validateInput(v, state)
    if (err) errors.push(err)
  }
  return errors
}

/** Check if enough data is provided to start solving */
export function hasMinimumInputs(
  variables: Variable[],
  values: Record<string, VariableState>,
  minimumCount: number = 2
): boolean {
  const filledCount = variables.filter(v => {
    const state = values[v.id]
    return state?.value !== null && state?.value !== undefined && state.isUserInput
  }).length
  return filledCount >= minimumCount
}

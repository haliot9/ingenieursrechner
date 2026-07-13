import type { CalculatorModule, VariableState } from '../core/types'
import { convertUnit } from '../core/unit-converter'

/** Convert display-unit state back to the module's canonical/default units. */
export function convertValuesToModuleUnits(
  module: CalculatorModule,
  values: Record<string, VariableState>,
): Record<string, VariableState> {
  const variables = new Map(module.variables.map(variable => [variable.id, variable]))
  const converted: Record<string, VariableState> = {}

  for (const [id, state] of Object.entries(values)) {
    const variable = variables.get(id)
    const targetUnit = variable?.defaultUnit ?? state.unit

    if (state.value === null || !state.unit || state.unit === targetUnit) {
      converted[id] = { ...state, unit: targetUnit }
      continue
    }

    converted[id] = {
      ...state,
      value: convertUnit(state.value, state.unit, targetUnit),
      unit: targetUnit,
    }
  }

  return converted
}

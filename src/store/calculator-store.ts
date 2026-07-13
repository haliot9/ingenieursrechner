import { create } from 'zustand'
import type { CalculatorModule, VariableState, SolutionStep, SolverError } from '../core/types'
import { FormulaRegistry } from '../core/formula-registry'
import { solve } from '../core/solver'
import { validateAllInputs } from '../core/validator'
import { convertUnit } from '../core/unit-converter'
import { MODULES } from '../modules'

interface CalculatorStore {
  // Current module
  activeModuleId: string
  module: CalculatorModule | null
  registry: FormulaRegistry | null

  // Variable values (stored in user's display unit, converted to SI only during solve)
  values: Record<string, VariableState>

  // Solver output
  steps: SolutionStep[]
  unsolved: string[]
  errors: SolverError[]

  // Active processes (for modules that have process types)
  activeProcesses: Record<string, string>

  // Actions
  setModule: (moduleId: string) => void
  setValue: (variableId: string, value: number | null) => void
  setUnit: (variableId: string, unit: string) => void
  setProcess: (transitionKey: string, processId: string) => void
  loadPreset: (presetId: string) => void
  clearAll: () => void
  recalculate: () => void
}

function createInitialValues(mod: CalculatorModule): Record<string, VariableState> {
  const values: Record<string, VariableState> = {}
  for (const v of mod.variables) {
    values[v.id] = {
      value: null,
      unit: v.defaultUnit,
      isUserInput: false,
      isComputed: false,
    }
  }
  return values
}

/** Convert a user-entered value to SI for the solver. Falls back to raw value on error. */
function toSI(value: number, fromUnit: string, defaultUnit: string): number {
  if (!fromUnit || fromUnit === defaultUnit) return value
  try {
    return convertUnit(value, fromUnit, defaultUnit)
  } catch {
    return value
  }
}

/** Convert a computed SI value to the user's display unit. Falls back to SI value on error. */
function fromSI(value: number, defaultUnit: string, displayUnit: string): number {
  if (!displayUnit || displayUnit === defaultUnit) return value
  try {
    return convertUnit(value, defaultUnit, displayUnit)
  } catch {
    return value
  }
}

export const useCalculatorStore = create<CalculatorStore>((set, get) => ({
  activeModuleId: 'carnot',
  module: MODULES['carnot'] ?? null,
  registry: MODULES['carnot'] ? FormulaRegistry.fromModule(MODULES['carnot']) : null,
  values: MODULES['carnot'] ? createInitialValues(MODULES['carnot']) : {},
  steps: [],
  unsolved: [],
  errors: [],
  activeProcesses: {},

  setModule: (moduleId: string) => {
    const mod = MODULES[moduleId]
    if (!mod) return
    set({
      activeModuleId: moduleId,
      module: mod,
      registry: FormulaRegistry.fromModule(mod),
      values: createInitialValues(mod),
      steps: [],
      unsolved: [],
      errors: [],
      activeProcesses: {},
    })
  },

  setValue: (variableId: string, value: number | null) => {
    const { values } = get()
    const newValues = {
      ...values,
      [variableId]: {
        ...values[variableId],
        value,
        isUserInput: value !== null,
        isComputed: false,
      },
    }
    set({ values: newValues })
    get().recalculate()
  },

  setUnit: (variableId: string, newUnit: string) => {
    const { values } = get()
    const state = values[variableId]
    const oldUnit = state?.unit ?? ''

    // Convert the stored value to preserve the physical quantity (e.g. 287 J → 0.287 kJ)
    let newValue = state?.value ?? null
    if (newValue !== null && state?.isUserInput && oldUnit && oldUnit !== newUnit) {
      try {
        newValue = convertUnit(newValue, oldUnit, newUnit)
      } catch {
        // Units incompatible (e.g. bar → K), keep current value in new unit
      }
    }

    set({
      values: {
        ...values,
        [variableId]: { ...state, value: newValue, unit: newUnit },
      },
    })
    get().recalculate()
  },

  setProcess: (transitionKey: string, processId: string) => {
    const { activeProcesses } = get()
    set({
      activeProcesses: { ...activeProcesses, [transitionKey]: processId },
    })
    get().recalculate()
  },

  loadPreset: (presetId: string) => {
    const { module } = get()
    const preset = module?.presets?.find(candidate => candidate.id === presetId)
    if (!module || !preset) return

    const presetValues = createInitialValues(module)
    for (const [id, value] of Object.entries(preset.values)) {
      if (!presetValues[id]) continue
      presetValues[id] = {
        ...presetValues[id],
        value,
        isUserInput: true,
      }
    }

    set({ values: presetValues, steps: [], unsolved: [], errors: [] })
    get().recalculate()
  },

  clearAll: () => {
    const { module } = get()
    if (!module) return
    set({
      values: createInitialValues(module),
      steps: [],
      unsolved: [],
      errors: [],
      activeProcesses: {},
    })
  },

  recalculate: () => {
    const { module, registry, values, activeProcesses } = get()
    if (!module || !registry) return

    // Convert all user inputs to SI for the solver
    const siInputs: Record<string, VariableState> = {}
    for (const [id, state] of Object.entries(values)) {
      if (!state.isUserInput || state.value === null) continue
      const variable = module.variables.find(v => v.id === id)
      const siValue = variable
        ? toSI(state.value, state.unit, variable.defaultUnit)
        : state.value
      siInputs[id] = {
        ...state,
        value: siValue,
        unit: variable?.defaultUnit ?? state.unit,
      }
    }

    // Validate SI values (so e.g. -10°C correctly passes the T > 0 check as 263 K)
    const validationErrors = validateAllInputs(module.variables, siInputs)
    const moduleInputErrors = module.validateValues?.(siInputs) ?? []
    const inputErrors = [...validationErrors, ...moduleInputErrors]
    if (inputErrors.length > 0) {
      set({ errors: inputErrors, steps: [], unsolved: [] })
      return
    }

    const processes = Object.values(activeProcesses)
    const result = solve(registry, module.variables, siInputs, processes)
    const moduleResultErrors = module.validateValues?.(result.values) ?? []
    const resultErrors = [...result.errors, ...moduleResultErrors]

    // Merge results: solver returns SI values — convert computed values to user's display unit
    const mergedValues: Record<string, VariableState> = {}
    for (const [id, solverState] of Object.entries(result.values)) {
      const displayUnit = values[id]?.unit ?? solverState.unit

      if (solverState.isUserInput) {
        // Keep user's display value as-is (already converted in setUnit)
        mergedValues[id] = values[id] ?? solverState
      } else if (solverState.isComputed && solverState.value !== null) {
        // Convert computed SI value to user's display unit
        const variable = module.variables.find(v => v.id === id)
        const displayValue = variable
          ? fromSI(solverState.value, variable.defaultUnit, displayUnit)
          : solverState.value
        mergedValues[id] = { ...solverState, value: displayValue, unit: displayUnit }
      } else {
        // Not yet computed — preserve display unit
        mergedValues[id] = { ...solverState, unit: displayUnit }
      }
    }

    set({
      values: mergedValues,
      steps: result.steps,
      unsolved: result.unsolved,
      errors: resultErrors,
    })
  },
}))

import { create } from 'zustand'
import type { CalculatorModule, PresentationPlan, SolutionStep, SolverError, VariableState } from '../core/types'
import { buildPresentationPlan } from '../core/derivation-builder'
import type { ReachabilityPlan } from '../core/derivation-planner'
import { FormulaRegistry } from '../core/formula-registry'
import { solve, type PlannedExecutionConfig } from '../core/solver'
import { validateAllInputs } from '../core/validator'
import { convertUnit } from '../core/unit-converter'
import { MODULES } from '../modules'

interface CalculatorStore {
  activeModuleId: string
  module: CalculatorModule | null
  registry: FormulaRegistry | null
  values: Record<string, VariableState>
  steps: SolutionStep[]
  unsolved: string[]
  errors: SolverError[]
  plan?: ReachabilityPlan
  presentation?: PresentationPlan
  activeProcesses: Record<string, string>
  setModule: (moduleId: string) => void
  setValue: (variableId: string, value: number | null) => void
  setUnit: (variableId: string, unit: string) => void
  setProcess: (transitionKey: string, processId: string) => void
  loadPreset: (presetId: string) => void
  clearAll: () => void
  recalculate: () => void
}

interface ScenarioResult {
  values: Record<string, VariableState>
  steps: SolutionStep[]
  unsolved: string[]
  errors: SolverError[]
  plan?: ReachabilityPlan
  presentation?: PresentationPlan
}

function createInitialValues(mod: CalculatorModule): Record<string, VariableState> {
  return Object.fromEntries(mod.variables.map(variable => [variable.id, {
    value: null, unit: variable.defaultUnit, isUserInput: false, isComputed: false,
  }]))
}

function toSI(value: number, fromUnit: string, defaultUnit: string): number {
  if (!fromUnit || fromUnit === defaultUnit) return value
  try { return convertUnit(value, fromUnit, defaultUnit) } catch { return value }
}

function fromSI(value: number, defaultUnit: string, displayUnit: string): number {
  if (!displayUnit || displayUnit === defaultUnit) return value
  try { return convertUnit(value, defaultUnit, displayUnit) } catch { return value }
}

type PresentationExecutionConfig = PlannedExecutionConfig & { narrativeOrderingPolicy?: import('../core/types').NarrativeOrderingPolicy; diagnostics?: readonly import('../core/types').DiagnosticRelation[]; visibleAlternativeDirectionIds?: readonly string[] }

function solveScenario(
  module: CalculatorModule,
  registry: FormulaRegistry,
  displayValues: Record<string, VariableState>,
  activeProcesses: Record<string, string>,
): ScenarioResult {
  const siInputs: Record<string, VariableState> = {}
  for (const [id, state] of Object.entries(displayValues)) {
    if (!state.isUserInput || state.value === null) continue
    const variable = module.variables.find(candidate => candidate.id === id)
    siInputs[id] = { ...state, value: variable ? toSI(state.value, state.unit, variable.defaultUnit) : state.value, unit: variable?.defaultUnit ?? state.unit }
  }

  const inputErrors = [...validateAllInputs(module.variables, siInputs), ...(module.validateValues?.(siInputs) ?? [])]
  if (inputErrors.length > 0) return { values: displayValues, steps: [], unsolved: [], errors: inputErrors }

  const result = solve(registry, module.variables, siInputs, Object.values(activeProcesses), { plannedExecution: module.plannedExecution })
  const errors = [...result.errors, ...(module.validateValues?.(result.values) ?? [])]
  const values: Record<string, VariableState> = {}
  for (const [id, solverState] of Object.entries(result.values)) {
    const displayUnit = displayValues[id]?.unit ?? solverState.unit
    if (solverState.isUserInput) values[id] = displayValues[id] ?? solverState
    else if (solverState.isComputed && solverState.value !== null) {
      const variable = module.variables.find(candidate => candidate.id === id)
      values[id] = { ...solverState, value: variable ? fromSI(solverState.value, variable.defaultUnit, displayUnit) : solverState.value, unit: displayUnit }
    } else values[id] = { ...solverState, unit: displayUnit }
  }

  const presentationConfig = module.plannedExecution as PresentationExecutionConfig | undefined
  const presentation = result.plan
    ? buildPresentationPlan({
      steps: result.steps,
      plan: result.plan,
      formulas: module.formulas,
      orderingPolicy: presentationConfig?.narrativeOrderingPolicy,
      diagnostics: presentationConfig?.diagnostics,
      visibleAlternativeDirectionIds: presentationConfig?.visibleAlternativeDirectionIds,
    })
    : undefined
  return { values, steps: result.steps, unsolved: result.unsolved, errors, plan: result.plan, presentation }
}

export const useCalculatorStore = create<CalculatorStore>((set, get) => ({
  activeModuleId: 'carnot',
  module: MODULES.carnot ?? null,
  registry: MODULES.carnot ? FormulaRegistry.fromModule(MODULES.carnot) : null,
  values: MODULES.carnot ? createInitialValues(MODULES.carnot) : {},
  steps: [], unsolved: [], errors: [], activeProcesses: {},

  setModule: (moduleId) => {
    const module = MODULES[moduleId]
    if (!module) return
    set({ activeModuleId: moduleId, module, registry: FormulaRegistry.fromModule(module), values: createInitialValues(module), steps: [], unsolved: [], errors: [], plan: undefined, presentation: undefined, activeProcesses: {} })
  },

  setValue: (variableId, value) => {
    const state = get()
    if (!state.module || !state.registry || !state.values[variableId]) return
    const values = { ...state.values, [variableId]: { ...state.values[variableId], value, isUserInput: value !== null, isComputed: false, stepIndex: undefined } }
    set(solveScenario(state.module, state.registry, values, state.activeProcesses))
  },

  setUnit: (variableId, unit) => {
    const state = get()
    const current = state.values[variableId]
    if (!state.module || !state.registry || !current) return
    let value = current.value
    if (value !== null && current.isUserInput && current.unit && current.unit !== unit) {
      try { value = convertUnit(value, current.unit, unit) } catch { /* preserve the display value for incompatible units */ }
    }
    const values = { ...state.values, [variableId]: { ...current, value, unit } }
    set(solveScenario(state.module, state.registry, values, state.activeProcesses))
  },

  setProcess: (transitionKey, processId) => {
    const state = get()
    if (!state.module || !state.registry) return
    const activeProcesses = { ...state.activeProcesses, [transitionKey]: processId }
    set({ activeProcesses, ...solveScenario(state.module, state.registry, state.values, activeProcesses) })
  },

  loadPreset: (presetId) => {
    const state = get()
    const preset = state.module?.presets?.find(candidate => candidate.id === presetId)
    if (!state.module || !state.registry || !preset) return
    const values = createInitialValues(state.module)
    for (const [id, value] of Object.entries(preset.values)) if (values[id]) values[id] = { ...values[id], value, isUserInput: true }
    set(solveScenario(state.module, state.registry, values, state.activeProcesses))
  },

  clearAll: () => {
    const module = get().module
    if (!module) return
    set({ values: createInitialValues(module), steps: [], unsolved: [], errors: [], plan: undefined, presentation: undefined, activeProcesses: {} })
  },

  recalculate: () => {
    const state = get()
    if (state.module && state.registry) set(solveScenario(state.module, state.registry, state.values, state.activeProcesses))
  },
}))

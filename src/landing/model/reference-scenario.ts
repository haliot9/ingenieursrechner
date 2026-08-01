import type { CalculationStoryState } from '../../core/calculation-story'
import { FormulaRegistry } from '../../core/formula-registry'
import { solve } from '../../core/solver'
import type { CalculatorModule, DiagramSpec, VariableState } from '../../core/types'
import { getModule } from '../../modules'

export interface ReferenceScenario {
  module: CalculatorModule
  values: Record<string, VariableState>
  diagramSpec: DiagramSpec | null
  story?: CalculationStoryState
}

export function buildReferenceScenario(moduleId: string): ReferenceScenario {
  const module = getModule(moduleId)
  const preset = module?.presets?.find(candidate => candidate.id === 'reference-air')
  if (!module || !preset) throw new Error(`Missing reference-air preset: ${moduleId}`)

  const inputs = Object.fromEntries(Object.entries(preset.values).map(([id, value]) => [id, {
    value,
    unit: module.variables.find(variable => variable.id === id)?.defaultUnit ?? '',
    isUserInput: true,
    isComputed: false,
  }]))
  const result = solve(FormulaRegistry.fromModule(module), module.variables, inputs, [], {
    plannedExecution: module.plannedExecution,
  })
  const story = module.calculationStory?.({
    plan: result.plan,
    steps: result.steps,
    values: result.values,
    variables: module.variables,
  })

  return {
    module,
    values: result.values,
    diagramSpec: module.getDiagramSpec?.(result.values) ?? null,
    story,
  }
}

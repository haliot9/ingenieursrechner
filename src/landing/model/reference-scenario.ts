import type { CalculationStoryState } from '../../core/calculation-story'
import { FormulaRegistry } from '../../core/formula-registry'
import { solve } from '../../core/solver'
import type { CalculatorModule, DiagramSpec, VariableState } from '../../core/types'
import { getModule } from '../../modules'

export interface ReferenceScenario {
  module: CalculatorModule
  values: Record<string, VariableState>
  diagramSpec: DiagramSpec
  story?: CalculationStoryState
}

const invalidLandingDiagram = (moduleId: string, detail: string): never => {
  throw new Error(`Invalid landing T-s diagram for module "${moduleId}": ${detail}`)
}

function validateLandingDiagram(moduleId: string, diagram: DiagramSpec) {
  if (diagram.statePoints.length !== 4) {
    invalidLandingDiagram(
      moduleId,
      `expected exactly four states, received ${diagram.statePoints.length}`,
    )
  }

  const stateIds = new Set(diagram.statePoints.map(point => point.id))
  if (stateIds.size !== 4) invalidLandingDiagram(moduleId, 'state IDs must be unique')
  for (const state of diagram.statePoints) {
    if (!Number.isFinite(state.T) || !Number.isFinite(state.s)) {
      invalidLandingDiagram(moduleId, `state "${state.id}" must have finite T and s`)
    }
  }

  if (diagram.segments.length !== 4) {
    invalidLandingDiagram(
      moduleId,
      `expected exactly four segments, received ${diagram.segments.length}`,
    )
  }

  const segmentLocations = new Set<string>()
  const outgoing = new Map<string, string>()
  const incoming = new Map<string, string>()
  for (const segment of diagram.segments) {
    const location = `${segment.from}-${segment.to}`
    if (!stateIds.has(segment.from)) {
      invalidLandingDiagram(
        moduleId,
        `segment "${location}" references missing state "${segment.from}"`,
      )
    }
    if (!stateIds.has(segment.to)) {
      invalidLandingDiagram(
        moduleId,
        `segment "${location}" references missing state "${segment.to}"`,
      )
    }
    if (outgoing.has(segment.from) || incoming.has(segment.to)) {
      invalidLandingDiagram(moduleId, 'segments must form one connected four-state cycle')
    }
    outgoing.set(segment.from, segment.to)
    incoming.set(segment.to, segment.from)
    segmentLocations.add(location)
  }

  const firstStateId = diagram.statePoints[0].id
  const visited = new Set<string>()
  let currentStateId = firstStateId
  for (let step = 0; step < 4; step += 1) {
    visited.add(currentStateId)
    currentStateId = outgoing.get(currentStateId)
      ?? invalidLandingDiagram(moduleId, 'segments must form one connected four-state cycle')
  }
  if (currentStateId !== firstStateId || visited.size !== 4 || incoming.size !== 4) {
    invalidLandingDiagram(moduleId, 'segments must form one connected four-state cycle')
  }

  for (const flow of diagram.energyFlows ?? []) {
    if (flow.location !== 'global' && !segmentLocations.has(flow.location)) {
      invalidLandingDiagram(
        moduleId,
        `flow "${flow.label}" references missing segment "${flow.location}"`,
      )
    }
  }
}

export function buildReferenceScenario(moduleId: string): ReferenceScenario {
  const module = getModule(moduleId)
  const preset = module?.presets?.find(candidate => candidate.id === 'reference-air')
  if (!module || !preset) throw new Error(`Missing reference-air preset: ${moduleId}`)

  const variableById = new Map(module.variables.map(variable => [variable.id, variable]))
  const inputs = Object.fromEntries(Object.entries(preset.values).map(([id, value]) => {
    const variable = variableById.get(id)
    if (!variable) {
      throw new Error(`Unknown reference-air preset variable "${id}" in module "${moduleId}"`)
    }
    return [id, {
      value,
      unit: variable.defaultUnit,
      isUserInput: true,
      isComputed: false,
    }]
  }))
  const result = solve(FormulaRegistry.fromModule(module), module.variables, inputs, [], {
    plannedExecution: module.plannedExecution,
  })
  const diagramAdapter = module.getDiagramSpec
  if (!diagramAdapter) throw new Error(`Missing landing diagram adapter for module "${moduleId}"`)
  const diagramSpec = diagramAdapter(result.values)
  if (!diagramSpec) throw new Error(`Landing diagram unavailable for module "${moduleId}"`)
  validateLandingDiagram(moduleId, diagramSpec)
  const story = module.calculationStory?.({
    plan: result.plan,
    steps: result.steps,
    values: result.values,
    variables: module.variables,
  })

  return {
    module,
    values: result.values,
    diagramSpec,
    story,
  }
}

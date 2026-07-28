import type { ReachabilityPlan } from './derivation-planner'
import type { SolutionStep, Variable, VariableState } from './types'

export type CalculationStoryRowKind = 'governing' | 'transform' | 'result' | 'numeric' | 'reuse'
export type CalculationStoryFactState = 'derived' | 'reachable'

export interface CalculationStoryRow {
  id: string
  kind: CalculationStoryRowKind
  equationLatex: string
  operation?: string
  note?: string
  state?: CalculationStoryFactState
}

export interface CalculationStory {
  route: string
  title: string
  rows: readonly CalculationStoryRow[]
}

export type CalculationStoryState =
  | { mode: 'not-applicable' }
  | { mode: 'complete'; story: CalculationStory }
  | { mode: 'unavailable'; reason: string }

export interface CalculationStoryCompositionInput {
  plan?: ReachabilityPlan
  steps: readonly SolutionStep[]
  values: Record<string, VariableState>
  variables: readonly Variable[]
}

export type CalculationStoryComposer = (input: CalculationStoryCompositionInput) => CalculationStoryState

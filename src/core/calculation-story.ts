import type { ReachabilityPlan } from './derivation-planner'
import type { PresentationPlan, SolutionStep, Variable, VariableState } from './types'

export type CalculationStoryRowKind = 'governing' | 'transform' | 'result' | 'numeric' | 'reuse'
export type CalculationStoryFactState = 'derived' | 'reachable'
export type StoryRelation = 'equals' | 'equivalent' | 'implies'
export type StoryRowRole = 'start' | 'continuation' | 'subject-change' | 'reuse' | 'numeric' | 'check'
export type StoryOperationKind = 'substitute' | 'equate' | 'isolate' | 'factor' | 'divide' | 'multiply' | 'exponentiate' | 'root' | 'logarithm' | 'integrate' | 'reuse'

export interface StoryEquation {
  bridgeLatex?: string
  lhsLatex?: string
  relationLatex: string
  rhsLatex: string
}

export interface StoryOperation {
  kind: StoryOperationKind
  latex: string
}

export interface CalculationStoryRow {
  id: string
  kind: CalculationStoryRowKind
  /** Semantic chain identity; rendering must never infer it from strings. */
  chainId?: string
  rowRole?: StoryRowRole
  equationLatex: string
  equation?: StoryEquation
  operation?: StoryOperation | string
  note?: string
  state?: CalculationStoryFactState
}

export interface CalculationStoryConsumedStep {
  formulaId: string
  targetVariable: string
  directionId: string
}

export interface CalculationStory {
  route: string
  title: string
  rows: readonly CalculationStoryRow[]
  /** Exact selected solver directions represented by the continuous story. */
  consumedSteps: readonly CalculationStoryConsumedStep[]
  /** Selected primary directions that could not be represented; complete stories keep this empty. */
  unconsumedPrimarySteps?: readonly CalculationStoryConsumedStep[]
}

export function isConsumedStoryStep(story: CalculationStory, step: SolutionStep): boolean {
  return story.consumedSteps.some(consumed => (
    consumed.formulaId === step.formulaId
    && consumed.targetVariable === step.targetVariable
    && consumed.directionId === `${step.formulaId}:${step.targetVariable}`
  ))
}

/** Keep all legacy presentation metadata while removing only story-owned cards. */
export function removeConsumedStorySteps(
  presentation: PresentationPlan | undefined,
  story: CalculationStory,
): PresentationPlan | undefined {
  if (!presentation) return undefined
  return {
    ...presentation,
    primarySteps: presentation.primarySteps.filter(step => !isConsumedStoryStep(story, step)),
  }
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

import type { ReachabilityPlan } from './derivation-planner'
import type { PresentationPlan, SolutionStep, Variable, VariableState } from './types'

export type CalculationStoryRowKind = 'governing' | 'transform' | 'result' | 'numeric' | 'reuse' | 'milestone'
export type CalculationStoryFactState = 'derived' | 'reachable'
export type StoryRelation = 'equals' | 'equivalent' | 'implies'
export type StoryRowRole = 'start' | 'continuation' | 'subject-change' | 'reuse' | 'numeric' | 'check' | 'milestone'
export type StoryOperationKind = 'substitute' | 'equate' | 'isolate' | 'factor' | 'divide' | 'multiply' | 'add' | 'subtract' | 'exponentiate' | 'root' | 'logarithm' | 'integrate' | 'reuse'
export type CalculationStorySectionTier = 'main' | 'foundation' | 'optional' | 'check' | 'alternative'
export type StorySupportKind = 'foundation' | 'condition' | 'unit' | 'reuse'
export type StoryFactBox = 'core' | 'outline' | 'ready'

export interface StoryEquation { bridgeLatex?: string; lhsLatex?: string; relationLatex: string; rhsLatex: string }
export interface StoryOperation { kind: StoryOperationKind; latex: string }
export interface StorySupportRow { id: string; kind: CalculationStoryRowKind; chainId?: string; rowRole?: StoryRowRole; equationLatex: string; equation?: StoryEquation; operation?: StoryOperation | string; note?: string; label?: string; box?: StoryFactBox; state?: CalculationStoryFactState; spacing?: 'continuation' | 'nested' | 'result' | 'chain' }
export interface CalculationStorySupport { id: string; title: string; kind: StorySupportKind; defaultOpen?: boolean; rows: readonly StorySupportRow[] }
export interface CalculationStoryRow extends StorySupportRow { support?: CalculationStorySupport }
export interface CalculationStoryConsumedStep { formulaId: string; targetVariable: string; directionId: string }
export interface CalculationStorySection { id: string; title: string; rows: readonly CalculationStoryRow[]; tier?: CalculationStorySectionTier; defaultOpen?: boolean; sideLatex?: string }
export interface CalculationStoryOverview { model: string; givens: readonly string[]; scope: string; signs: readonly string[]; route: readonly string[] }
export interface CalculationStoryAlternative { parentRowId: string; title: string; rows: readonly CalculationStoryRow[] }
export interface CalculationStory {
  route: string
  title: string
  rows: readonly CalculationStoryRow[]
  overview?: CalculationStoryOverview
  sections?: readonly CalculationStorySection[]
  alternatives?: readonly CalculationStoryAlternative[]
  consumedSteps: readonly CalculationStoryConsumedStep[]
  unconsumedPrimarySteps?: readonly CalculationStoryConsumedStep[]
}

export function isConsumedStoryStep(story: CalculationStory, step: SolutionStep): boolean {
  return story.consumedSteps.some(consumed => consumed.formulaId === step.formulaId && consumed.targetVariable === step.targetVariable && consumed.directionId === `${step.formulaId}:${step.targetVariable}`)
}

export function removeConsumedStorySteps(presentation: PresentationPlan | undefined, story: CalculationStory): PresentationPlan | undefined {
  if (!presentation) return undefined
  return { ...presentation, primarySteps: presentation.primarySteps.filter(step => !isConsumedStoryStep(story, step)) }
}

export type CalculationStoryState = { mode: 'not-applicable' } | { mode: 'complete'; story: CalculationStory } | { mode: 'unavailable'; reason: string }
export interface CalculationStoryCompositionInput { plan?: ReachabilityPlan; steps: readonly SolutionStep[]; values: Record<string, VariableState>; variables: readonly Variable[] }
export type CalculationStoryComposer = (input: CalculationStoryCompositionInput) => CalculationStoryState

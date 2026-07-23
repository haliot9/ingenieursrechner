import type { SolveDirection } from './solve-directions'

export interface KnownFact {
  id: string
  valueSI: number
  source: 'user' | 'derived'
}

export type PreconditionOutcome = 'satisfied' | 'unsatisfied' | 'unknown'

export interface RouteCost {
  closureApplications: number
  nonUserIntermediateFacts: number
  downstreamReuse: number
  detachedBranchStarts: number
}

export interface RouteCandidate {
  targetId: string
  directionId: string
  dependencyIds: readonly string[]
  closureDirectionIds: readonly string[]
  cost: RouteCost
  disposition: 'candidate' | 'primary' | 'equivalent-alternative' | 'diagnostic'
}

export interface BlockedCandidate {
  directionId: string
  missingIds: readonly string[]
  preconditionState?: Exclude<PreconditionOutcome, 'satisfied'>
}

export interface BlockedQuantity {
  targetId: string
  candidates: readonly BlockedCandidate[]
}

export interface ReachabilityPlan {
  reachableIds: readonly string[]
  primaryByTarget: ReadonlyMap<string, RouteCandidate>
  alternativesByTarget: ReadonlyMap<string, readonly RouteCandidate[]>
  blocked: readonly BlockedQuantity[]
}

export interface DerivationPlannerInput {
  knownFacts: readonly KnownFact[]
  directions: readonly SolveDirection[]
  targetIds?: readonly string[]
  preconditionOutcomes?: Readonly<Record<string, PreconditionOutcome>>
}

const compareStrings = (left: string, right: string) => left.localeCompare(right)

function preconditionState(
  direction: SolveDirection,
  outcomes: Readonly<Record<string, PreconditionOutcome>>,
): PreconditionOutcome {
  if (!direction.conditions?.length) return 'satisfied'
  let result: PreconditionOutcome = 'satisfied'
  for (const condition of direction.conditions) {
    const outcome = outcomes[`${direction.id}:${condition.id}`] ?? 'unknown'
    if (outcome === 'unsatisfied') return 'unsatisfied'
    if (outcome === 'unknown') result = 'unknown'
  }
  return result
}

function selectedClosure(
  direction: SolveDirection,
  selected: ReadonlyMap<string, RouteCandidate>,
): string[] {
  const closure = new Set<string>()
  const visiting = new Set<string>()
  const visit = (factId: string) => {
    const candidate = selected.get(factId)
    if (!candidate || visiting.has(factId)) return
    visiting.add(factId)
    candidate.dependencyIds.forEach(visit)
    closure.add(candidate.directionId)
    visiting.delete(factId)
  }

  direction.requiredIds.forEach(visit)
  closure.add(direction.id)
  return [...closure].sort(compareStrings)
}

function wouldCreatePredecessorCycle(
  direction: SolveDirection,
  selected: ReadonlyMap<string, RouteCandidate>,
): boolean {
  const reachesTarget = (factId: string, visiting: ReadonlySet<string>): boolean => {
    if (factId === direction.targetId) return true
    const candidate = selected.get(factId)
    if (!candidate || visiting.has(factId)) return false
    const nextVisiting = new Set(visiting)
    nextVisiting.add(factId)
    return candidate.dependencyIds.some(dependencyId => reachesTarget(dependencyId, nextVisiting))
  }

  return direction.requiredIds.some(requiredId => reachesTarget(requiredId, new Set()))
}

function candidateFor(
  direction: SolveDirection,
  selected: ReadonlyMap<string, RouteCandidate>,
  knownFactIds: ReadonlySet<string>,
  disposition: RouteCandidate['disposition'],
): RouteCandidate {
  const closureDirectionIds = selectedClosure(direction, selected)
  const nonUserIntermediateFacts = direction.requiredIds.filter(id => selected.has(id) && !knownFactIds.has(id)).length
  const downstreamReuse = [...selected.values()].filter(candidate => candidate.dependencyIds.includes(direction.targetId)).length
  return {
    targetId: direction.targetId,
    directionId: direction.id,
    dependencyIds: [...direction.requiredIds].sort(compareStrings),
    closureDirectionIds,
    cost: {
      closureApplications: closureDirectionIds.length,
      nonUserIntermediateFacts,
      downstreamReuse,
      detachedBranchStarts: 0,
    },
    disposition,
  }
}

function compareCandidates(left: RouteCandidate, right: RouteCandidate, directions: ReadonlyMap<string, SolveDirection>): number {
  const leftDirection = directions.get(left.directionId)!
  const rightDirection = directions.get(right.directionId)!
  return leftDirection.routePriority - rightDirection.routePriority
    || left.cost.closureApplications - right.cost.closureApplications
    || left.cost.nonUserIntermediateFacts - right.cost.nonUserIntermediateFacts
    || right.cost.downstreamReuse - left.cost.downstreamReuse
    || left.cost.detachedBranchStarts - right.cost.detachedBranchStarts
    || compareStrings(left.directionId, right.directionId)
}

function refreshSelected(
  selected: ReadonlyMap<string, RouteCandidate>,
  directions: ReadonlyMap<string, SolveDirection>,
  knownFactIds: ReadonlySet<string>,
): Map<string, RouteCandidate> {
  const refreshed = new Map<string, RouteCandidate>()
  for (const [targetId, existing] of selected) {
    const direction = directions.get(existing.directionId)!
    refreshed.set(targetId, candidateFor(direction, selected, knownFactIds, 'primary'))
  }
  return refreshed
}

function relevantTargets(
  targetIds: readonly string[] | undefined,
  selected: ReadonlyMap<string, RouteCandidate>,
): ReadonlySet<string> {
  if (!targetIds) return new Set(selected.keys())
  const relevant = new Set<string>()
  const visit = (targetId: string) => {
    if (relevant.has(targetId)) return
    const candidate = selected.get(targetId)
    if (!candidate) return
    relevant.add(targetId)
    candidate.dependencyIds.forEach(visit)
  }
  targetIds.forEach(visit)
  return relevant
}

export function planDerivations(input: DerivationPlannerInput): ReachabilityPlan {
  const knownFactIds = new Set(input.knownFacts.map(fact => fact.id))
  const reachable = new Set(knownFactIds)
  const outcomes = input.preconditionOutcomes ?? {}
  const directions = [...input.directions].sort((left, right) => compareStrings(left.id, right.id))
  const directionsById = new Map(directions.map(direction => [direction.id, direction]))
  let selected = new Map<string, RouteCandidate>()

  while (true) {
    selected = refreshSelected(selected, directionsById, knownFactIds)
    const readyByTarget = new Map<string, RouteCandidate[]>()
    for (const direction of directions) {
      if (direction.mode !== 'derive' || knownFactIds.has(direction.targetId)) continue
      if (preconditionState(direction, outcomes) !== 'satisfied') continue
      if (!direction.requiredIds.every(requiredId => reachable.has(requiredId))) continue
      if (wouldCreatePredecessorCycle(direction, selected)) continue
      const candidate = candidateFor(direction, selected, knownFactIds, 'candidate')
      const candidates = readyByTarget.get(direction.targetId) ?? []
      candidates.push(candidate)
      readyByTarget.set(direction.targetId, candidates)
    }

    let changed = false
    for (const [targetId, candidates] of [...readyByTarget.entries()].sort(([left], [right]) => compareStrings(left, right))) {
      const next = [...candidates].sort((left, right) => compareCandidates(left, right, directionsById))[0]
      const previous = selected.get(targetId)
      if (!previous || compareCandidates(next, previous, directionsById) < 0) {
        const direction = directionsById.get(next.directionId)!
        if (wouldCreatePredecessorCycle(direction, selected)) continue
        selected.set(targetId, { ...next, disposition: 'primary' })
        reachable.add(targetId)
        changed = true
      }
    }
    if (!changed) break
  }

  selected = refreshSelected(selected, directionsById, knownFactIds)
  const relevant = relevantTargets(input.targetIds, selected)
  const primaryByTarget = new Map<string, RouteCandidate>()
  for (const [targetId, candidate] of selected) {
    if (relevant.has(targetId)) primaryByTarget.set(targetId, candidate)
  }

  let alternativeBudget = 3
  const alternativesByTarget = new Map<string, readonly RouteCandidate[]>()
  for (const [targetId, primary] of primaryByTarget) {
    if (alternativeBudget === 0) break
    const alternatives = directions
      .filter(direction => direction.targetId === targetId && direction.id !== primary.directionId)
      .filter(direction => direction.mode === 'derive' && preconditionState(direction, outcomes) === 'satisfied')
      .filter(direction => direction.requiredIds.every(requiredId => reachable.has(requiredId)))
      .filter(direction => !wouldCreatePredecessorCycle(direction, selected))
      .map(direction => candidateFor(direction, selected, knownFactIds, 'equivalent-alternative'))
      .sort((left, right) => compareCandidates(left, right, directionsById))
      .slice(0, Math.min(2, alternativeBudget))
    if (alternatives.length) alternativesByTarget.set(targetId, alternatives)
    alternativeBudget -= alternatives.length
  }

  const blocked = [...new Set(directions.filter(direction => direction.mode === 'derive' && !reachable.has(direction.targetId)).map(direction => direction.targetId))]
    .sort(compareStrings)
    .map(targetId => {
      const candidates = directions
        .filter(direction => direction.targetId === targetId && direction.mode === 'derive')
        .map(direction => {
          const state = preconditionState(direction, outcomes)
          return {
            directionId: direction.id,
            missingIds: direction.requiredIds.filter(requiredId => !reachable.has(requiredId)).sort(compareStrings),
            ...(state === 'satisfied' ? {} : { preconditionState: state }),
          }
        })
        .sort((left, right) => left.missingIds.length - right.missingIds.length || compareStrings(left.directionId, right.directionId))
        .slice(0, 2)
      return { targetId, candidates }
    })

  return {
    reachableIds: [...reachable].sort(compareStrings),
    primaryByTarget,
    alternativesByTarget,
    blocked,
  }
}

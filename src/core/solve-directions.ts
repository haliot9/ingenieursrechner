import { parse } from 'mathjs'
import type { Formula } from './types'

export type SolveDirectionMode = 'derive' | 'validate-only' | 'disabled'

export interface DomainCondition {
  id: string
  description?: string
}

export interface DirectionPolicy {
  mode?: SolveDirectionMode
  routePriority?: number
  conditions?: readonly DomainCondition[]
}

export interface SolveDirection {
  id: string
  formulaId: string
  targetId: string
  requiredIds: readonly string[]
  mode: SolveDirectionMode
  routePriority: number
  conditions?: readonly DomainCondition[]
}

const ALLOWED_FUNCTIONS = new Set(['log'])

export function compileSolveDirections(
  formulas: readonly Formula[],
  variableIds: readonly string[],
  policies: Readonly<Record<string, DirectionPolicy>> = {},
): SolveDirection[] {
  const knownVariables = new Set(variableIds)
  const directions: SolveDirection[] = []

  for (const formula of [...formulas].sort((left, right) => left.id.localeCompare(right.id))) {
    for (const [targetId, expression] of Object.entries(formula.solveFor).sort(([left], [right]) => left.localeCompare(right))) {
      const id = `${formula.id}:${targetId}`
      const symbols = new Set<string>()
      for (const node of parse(expression).filter(candidate => candidate.type === 'SymbolNode')) {
        const name = (node as unknown as { name: string }).name
        if (!knownVariables.has(name) && !ALLOWED_FUNCTIONS.has(name)) {
          throw new Error(`Unknown symbol in ${id}: ${name}`)
        }
        if (knownVariables.has(name)) symbols.add(name)
      }
      if (symbols.has(targetId)) throw new Error(`Self reference in ${id}`)

      const policy = policies[id]
      directions.push({
        id,
        formulaId: formula.id,
        targetId,
        requiredIds: [...symbols].sort(),
        mode: policy?.mode ?? 'derive',
        routePriority: policy?.routePriority ?? 0,
        ...(policy?.conditions ? { conditions: [...policy.conditions] } : {}),
      })
    }
  }

  return directions
}

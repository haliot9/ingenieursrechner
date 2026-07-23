import { describe, expect, it } from 'vitest'
import { planDerivations, type KnownFact } from '../../src/core/derivation-planner'
import type { SolveDirection } from '../../src/core/solve-directions'

const direction = (
  id: string,
  targetId: string,
  requiredIds: readonly string[],
  routePriority = 0,
): SolveDirection => ({
  id,
  formulaId: id.split(':')[0],
  targetId,
  requiredIds,
  mode: 'derive',
  routePriority,
})

const fact = (id: string, valueSI = 1): KnownFact => ({ id, valueSI, source: 'user' })

describe('planDerivations', () => {
  it('returns only target-relevant predecessors while closing reachability monotonically', () => {
    const result = planDerivations({
      knownFacts: [fact('seed')],
      directions: [
        direction('a_from_seed:a', 'a', ['seed']),
        direction('target_from_a:target', 'target', ['a']),
        direction('unrelated_from_seed:unrelated', 'unrelated', ['seed']),
      ],
      targetIds: ['target'],
    })

    expect(result.reachableIds).toEqual(['a', 'seed', 'target', 'unrelated'])
    expect([...result.primaryByTarget.keys()]).toEqual(['a', 'target'])
    expect(result.primaryByTarget.get('target')?.closureDirectionIds).toEqual([
      'a_from_seed:a',
      'target_from_a:target',
    ])
  })

  it('chooses the same lower-priority-number route across registry permutations', () => {
    const directions = [
      direction('route_b:target', 'target', ['seed'], 20),
      direction('route_a:target', 'target', ['seed'], 10),
    ]

    const forward = planDerivations({ knownFacts: [fact('seed')], directions, targetIds: ['target'] })
    const reversed = planDerivations({ knownFacts: [fact('seed')], directions: [...directions].reverse(), targetIds: ['target'] })

    expect(forward.primaryByTarget.get('target')?.directionId).toBe('route_a:target')
    expect([...reversed.primaryByTarget.entries()]).toEqual([...forward.primaryByTarget.entries()])
  })

  it('bounds semantically equivalent alternatives per target and per scenario', () => {
    const directions = ['one', 'two', 'three'].flatMap(targetId => [
      direction(`${targetId}_a:${targetId}`, targetId, ['seed']),
      direction(`${targetId}_b:${targetId}`, targetId, ['seed']),
      direction(`${targetId}_c:${targetId}`, targetId, ['seed']),
    ])

    const result = planDerivations({ knownFacts: [fact('seed')], directions, targetIds: ['one', 'two', 'three'] })
    const alternatives = [...result.alternativesByTarget.values()]

    expect(alternatives.every(routes => routes.length <= 2)).toBe(true)
    expect(alternatives.flat()).toHaveLength(3)
    expect(alternatives.flat().every(route => route.disposition === 'equivalent-alternative')).toBe(true)
  })

  it('blocks disabled, validate-only, cyclic, and unknown-precondition routes without mutating facts', () => {
    const facts = Object.freeze([fact('seed')])
    const disabled = { ...direction('disabled:disabled', 'disabled', ['seed']), mode: 'disabled' as const }
    const validateOnly = { ...direction('validate:validate', 'validate', ['seed']), mode: 'validate-only' as const }
    const cyclic = direction('cycle:a', 'a', ['b'])
    const cyclicBack = direction('cycle:b', 'b', ['a'])
    const guarded = {
      ...direction('guarded:guarded', 'guarded', ['seed']),
      conditions: [{ id: 'positive-seed' }],
    }

    const result = planDerivations({
      knownFacts: facts,
      directions: [disabled, validateOnly, cyclic, cyclicBack, guarded],
      preconditionOutcomes: { 'guarded:guarded:positive-seed': 'unknown' },
    })

    expect(result.reachableIds).toEqual(['seed'])
    expect(result.blocked.map(entry => entry.targetId)).toEqual(['a', 'b', 'guarded'])
    expect(result.blocked.find(entry => entry.targetId === 'guarded')?.candidates).toEqual([
      expect.objectContaining({ directionId: 'guarded:guarded', preconditionState: 'unknown' }),
    ])
    expect(facts).toEqual([fact('seed')])
  })
})

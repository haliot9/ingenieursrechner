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

  it('keeps a lower-ranked semantic route as an alternative while priority selects the primary', () => {
    const result = planDerivations({
      knownFacts: [fact('seed')],
      directions: [
        direction('a_ideal:eta', 'eta', ['seed'], 20),
        direction('z_energy:eta', 'eta', ['seed'], 10),
      ],
      targetIds: ['eta'],
    })

    expect(result.primaryByTarget.get('eta')?.directionId).toBe('z_energy:eta')
    expect(result.alternativesByTarget.get('eta')?.map(route => route.directionId)).toEqual(['a_ideal:eta'])
  })

  it('replaces an early lower-priority primary after its better route becomes reachable', () => {
    const result = planDerivations({
      knownFacts: [fact('pressureRatio'), fact('kappa'), fact('seed')],
      directions: [
        direction('ideal_efficiency:eta', 'eta', ['pressureRatio', 'kappa'], 20),
        direction('heat_input:q_in', 'q_in', ['seed']),
        direction('net_work:w_netto', 'w_netto', ['q_in']),
        direction('efficiency:eta', 'eta', ['q_in', 'w_netto'], 10),
      ],
      targetIds: ['eta'],
    })

    expect(result.primaryByTarget.get('eta')?.directionId).toBe('efficiency:eta')
    expect(result.alternativesByTarget.get('eta')?.map(route => route.directionId)).toEqual(['ideal_efficiency:eta'])
  })

  it('chooses the same late replacement across registry permutations', () => {
    const directions = [
      direction('ideal_efficiency:eta', 'eta', ['pressureRatio', 'kappa'], 20),
      direction('heat_input:q_in', 'q_in', ['seed']),
      direction('net_work:w_netto', 'w_netto', ['q_in']),
      direction('efficiency:eta', 'eta', ['q_in', 'w_netto'], 10),
    ]
    const knownFacts = [fact('pressureRatio'), fact('kappa'), fact('seed')]

    const forward = planDerivations({ knownFacts, directions, targetIds: ['eta'] })
    const reversed = planDerivations({ knownFacts, directions: [...directions].reverse(), targetIds: ['eta'] })

    expect([...reversed.primaryByTarget.entries()]).toEqual([...forward.primaryByTarget.entries()])
    expect([...reversed.alternativesByTarget.entries()]).toEqual([...forward.alternativesByTarget.entries()])
  })

  it('rejects an indirect cyclic replacement that depends on the target prior route', () => {
    const result = planDerivations({
      knownFacts: [fact('seed')],
      directions: [
        direction('ideal_efficiency:eta', 'eta', ['seed'], 20),
        direction('q_from_eta:q_in', 'q_in', ['eta']),
        direction('efficiency:eta', 'eta', ['q_in'], 10),
      ],
      targetIds: ['eta'],
    })

    expect(result.primaryByTarget.get('eta')?.directionId).toBe('ideal_efficiency:eta')
    expect(result.alternativesByTarget.get('eta')).toBeUndefined()
  })

  it('rejects a mutually cyclic pair of late replacements in deterministic target order', () => {
    const result = planDerivations({
      knownFacts: [fact('seed')],
      directions: [
        direction('old:a', 'a', ['seed'], 20),
        direction('old:b', 'b', ['seed'], 20),
        direction('better:a', 'a', ['b'], 10),
        direction('better:b', 'b', ['a'], 10),
      ],
      targetIds: ['a', 'b'],
    })

    expect(result.primaryByTarget.get('a')?.directionId).toBe('better:a')
    expect(result.primaryByTarget.get('b')?.directionId).toBe('old:b')
  })

  it('recomputes downstream closure from the final replacement route', () => {
    const result = planDerivations({
      knownFacts: [fact('pressureRatio'), fact('kappa'), fact('seed')],
      directions: [
        direction('ideal_efficiency:eta', 'eta', ['pressureRatio', 'kappa'], 20),
        direction('heat_input:q_in', 'q_in', ['seed']),
        direction('net_work:w_netto', 'w_netto', ['q_in']),
        direction('efficiency:eta', 'eta', ['q_in', 'w_netto'], 10),
        direction('downstream:result', 'result', ['eta']),
      ],
      targetIds: ['result'],
    })

    expect(result.primaryByTarget.get('result')?.closureDirectionIds).toEqual([
      'downstream:result',
      'efficiency:eta',
      'heat_input:q_in',
      'net_work:w_netto',
    ])
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

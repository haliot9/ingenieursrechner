import { describe, expect, it } from 'vitest'
import type { VariableState } from '../../../src/core/types'
import { validateJouleCycle } from '../../../src/modules/joule/validation'

function value(number: number): VariableState { return { value: number, unit: '', isUserInput: true, isComputed: false } }

describe('Joule cycle validation', () => {
  it('rejects pressure, isentrope, heat-engine order, energy, efficiency and BWR contradictions', () => {
    const errors = validateJouleCycle({ pressureRatio: value(1), p1: value(100000), p4: value(200000), p2: value(1000000), p3: value(900000), s1: value(0), s2: value(1), s3: value(2), s4: value(3), T1: value(300), T2: value(280), T3: value(270), T4: value(290), q_in: value(10), q_out: value(-2), w_comp: value(2), w_turb: value(-3), w_netto: value(-4), eta: value(1.2), back_work_ratio: value(1.1) })
    for (const id of ['pressureRatio', 'p4', 'p3', 's2', 's4', 'T2', 'T3', 'w_netto', 'eta', 'back_work_ratio']) expect(errors).toContainEqual(expect.objectContaining({ type: 'contradiction', variableId: id }))
  })
})
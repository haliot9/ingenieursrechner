import { describe, expect, it } from 'vitest'
import type { VariableState } from '../../../src/core/types'
import { getJouleDiagramSpec } from '../../../src/modules/joule/diagram'

function value(number: number): VariableState { return { value: number, unit: '', isUserInput: false, isComputed: true } }

describe('Joule diagram specification', () => {
  it('declares four canonical states, the static topology, energy locations and heat-engine direction', () => {
    const spec = getJouleDiagramSpec({ p1: value(100000), v1: value(0.861), T1: value(300), s1: value(0), p2: value(1000000), v2: value(0.166), T2: value(579), s2: value(0), p3: value(1000000), v3: value(0.402), T3: value(1400), s3: value(890), p4: value(100000), v4: value(2.081), T4: value(725), s4: value(890), q_in: value(824484), q_out: value(-427040), w_netto: value(-397445), kappa: value(1.4), Rs: value(287), cp: value(1004.5), cv: value(717.5) })!
    expect(spec.statePoints).toHaveLength(4)
    expect(spec.segments.map(segment => segment.processType)).toEqual(['adiabatic', 'isobaric', 'adiabatic', 'isobaric'])
    expect(spec.energyFlows.map(flow => flow.location)).toEqual(['2-3', '4-1', 'global'])
    expect(spec.processDirection).toBe('clockwise')
  })
})

import { describe, expect, it } from 'vitest'
import type { VariableState } from '../../../src/core/types'
import { getDieselDiagramSpec } from '../../../src/modules/diesel/diagram'

function value(number: number): VariableState {
  return { value: number, unit: '', isUserInput: false, isComputed: true }
}

describe('Diesel diagram specification', () => {
  it('declares the Diesel topology and energy-flow locations for canonical SI values', () => {
    const spec = getDieselDiagramSpec({
      p1: value(100_000), v1: value(0.861), T1: value(300), s1: value(0),
      p2: value(5_719_809), v2: value(0.0478), T2: value(953), s2: value(0),
      p3: value(5_719_809), v3: value(0.0957), T3: value(1907), s3: value(693),
      p4: value(263_902), v4: value(0.861), T4: value(792), s4: value(693),
      q_in: value(957_591), q_out: value(-352_798), w_netto: value(-604_793),
      kappa: value(1.4), Rs: value(287), cp: value(1004.5), cv: value(717.5),
    })!

    expect(spec.segments.map(segment => segment.processType)).toEqual(['adiabatic', 'isobaric', 'adiabatic', 'isochoric'])
    expect(spec.energyFlows.map(flow => flow.location)).toEqual(['2-3', '4-1', 'global'])
    expect(spec.processDirection).toBe('clockwise')
  })
})

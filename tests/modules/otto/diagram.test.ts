import { describe, expect, it } from 'vitest'
import type { VariableState } from '../../../src/core/types'
import { getOttoDiagramSpec } from '../../../src/modules/otto/diagram'

function value(number: number): VariableState {
  return { value: number, unit: '', isUserInput: false, isComputed: true }
}

describe('Otto diagram specification', () => {
  it('declares the Otto topology and energy-flow locations for canonical SI values', () => {
    const spec = getOttoDiagramSpec({
      p1: value(100_000), v1: value(0.861), T1: value(300), s1: value(0),
      p2: value(2_511_886), v2: value(0.0861), T2: value(754), s2: value(0),
      p3: value(6_000_000), v3: value(0.0861), T3: value(1_800), s3: value(623),
      p4: value(238_864), v4: value(0.861), T4: value(717), s4: value(623),
      q_in: value(750_816), q_out: value(-298_905), w_netto: value(-451_911),
      kappa: value(1.4), Rs: value(287), cp: value(1_004.5), cv: value(717.5),
    })!

    expect(spec.segments.map(segment => segment.processType)).toEqual(['adiabatic', 'isochoric', 'adiabatic', 'isochoric'])
    expect(spec.energyFlows.map(flow => flow.location)).toEqual(['2-3', '4-1', 'global'])
    expect(spec.processDirection).toBe('clockwise')
  })
})

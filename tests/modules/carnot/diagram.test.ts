import { describe, it, expect } from 'vitest'
import { getCarnotDiagramSpec } from '../../../src/modules/carnot/diagram'
import type { VariableState } from '../../../src/core/types'

function makeVal(value: number): VariableState {
  return { value, unit: '', isUserInput: false, isComputed: true }
}

// Realistischer Carnot-Zustand (Luft, T1=300K, T3=600K)
const values: Record<string, VariableState> = {
  p1: makeVal(100_000), v1: makeVal(0.861), T1: makeVal(300), s1: makeVal(1000),
  p2: makeVal(400_000), v2: makeVal(0.430), T2: makeVal(600), s2: makeVal(1000),
  p3: makeVal(400_000), v3: makeVal(1.721), T3: makeVal(600), s3: makeVal(1500),
  p4: makeVal(100_000), v4: makeVal(3.443), T4: makeVal(300), s4: makeVal(1500),
  q_in:    makeVal(300_000),
  q_out:   makeVal(-150_000),
  w_netto: makeVal(-150_000),
  kappa:   makeVal(1.4),
  Rs:      makeVal(287),
  cp:      makeVal(1005),
  cv:      makeVal(718),
}

describe('getCarnotDiagramSpec', () => {
  const spec = getCarnotDiagramSpec(values)!

  it('gibt nicht null zurueck wenn alle 4 Zustandspunkte vorhanden', () => {
    expect(spec).not.toBeNull()
  })

  it('hat genau 4 StatePoints', () => {
    expect(spec.statePoints).toHaveLength(4)
  })

  it('hat genau 4 Segments', () => {
    expect(spec.segments).toHaveLength(4)
  })

  it('Segments haben korrekten processType', () => {
    expect(spec.segments[0].processType).toBe('adiabatic')  // 1→2
    expect(spec.segments[1].processType).toBe('isothermal') // 2→3
    expect(spec.segments[2].processType).toBe('adiabatic')  // 3→4
    expect(spec.segments[3].processType).toBe('isothermal') // 4→1
  })

  it('processDirection ist clockwise (w_netto < 0)', () => {
    expect(spec.processDirection).toBe('clockwise')
  })

  it('EnergyFlows enthalten q_in, q_out und w_netto', () => {
    const labels = spec.energyFlows.map(f => f.label)
    expect(labels).toContain('q_{zu}')
    expect(labels).toContain('q_{ab}')
    expect(labels).toContain('w_{netto}')
  })

  it('gibt null zurueck wenn weniger als 2 Zustandspunkte vollstaendig', () => {
    const sparse = { p1: makeVal(100_000) }
    expect(getCarnotDiagramSpec(sparse)).toBeNull()
  })
})

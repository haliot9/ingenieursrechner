import { describe, it, expect } from 'vitest'
import { solve } from '../../../src/core/solver'
import { FormulaRegistry } from '../../../src/core/formula-registry'
import { carnotModule } from '../../../src/modules/carnot'
import type { VariableState } from '../../../src/core/types'

const registry = FormulaRegistry.fromModule(carnotModule)

function input(value: number, unit = ''): VariableState {
  return { value, unit, isUserInput: true, isComputed: false }
}

describe('Carnot: Dichte (ρ)', () => {
  it('berechnet rho1 aus m und V1', () => {
    // rho = m/V: m=2kg, V1=0.5m³ → rho1 = 4 kg/m³
    const result = solve(registry, carnotModule.variables, {
      m: input(2, 'kg'),
      V1: input(0.5, 'm^3'),
    })
    expect(result.values['rho1']?.value).toBeCloseTo(4, 4)
    expect(result.values['rho1']?.isComputed).toBe(true)
  })

  it('berechnet V1 aus m und rho1 (Rueckrichtung)', () => {
    // V = m/rho: m=2kg, rho1=4 → V1=0.5m³
    const result = solve(registry, carnotModule.variables, {
      m: input(2, 'kg'),
      rho1: input(4, 'kg/m^3'),
    })
    expect(result.values['V1']?.value).toBeCloseTo(0.5, 4)
  })

  it('berechnet rho1 aus p1, Rs, T1 ueber ideales Gas', () => {
    // p = rho*Rs*T: p1=100000Pa, Rs=287, T1=300K → rho1=100000/(287*300)≈1.1614
    const result = solve(registry, carnotModule.variables, {
      p1: input(100000, 'Pa'),
      Rs: input(287, 'J/(kg*K)'),
      T1: input(300, 'K'),
    })
    expect(result.values['rho1']?.value).toBeCloseTo(100000 / (287 * 300), 3)
  })
})

describe('Carnot: Spezifisches Volumen (v)', () => {
  it('berechnet v1 aus V1 und m', () => {
    // v = V/m: V1=0.5m³, m=2kg → v1=0.25 m³/kg
    const result = solve(registry, carnotModule.variables, {
      V1: input(0.5, 'm^3'),
      m: input(2, 'kg'),
    })
    expect(result.values['v1']?.value).toBeCloseTo(0.25, 4)
    expect(result.values['v1']?.isComputed).toBe(true)
  })

  it('berechnet v1 aus rho1 (v = 1/rho)', () => {
    // rho1=4 kg/m³ → v1=0.25 m³/kg
    const result = solve(registry, carnotModule.variables, {
      m: input(2, 'kg'),
      V1: input(0.5, 'm^3'),
    })
    expect(result.values['v1']?.value).toBeCloseTo(0.25, 4)
  })

  it('berechnet v1 aus p1, Rs, T1 ueber ideales Gas (p*v = Rs*T)', () => {
    // v = Rs*T/p: p1=100000, Rs=287, T1=300 → v1=0.861 m³/kg
    const result = solve(registry, carnotModule.variables, {
      p1: input(100000, 'Pa'),
      Rs: input(287, 'J/(kg*K)'),
      T1: input(300, 'K'),
    })
    expect(result.values['v1']?.value).toBeCloseTo((287 * 300) / 100000, 3)
  })

  it('berechnet p1 aus v1, Rs, T1 (Rueckrichtung p*v=Rs*T)', () => {
    // p = Rs*T/v: Rs=287, T1=300, v1=0.861 → p1≈100000
    const result = solve(registry, carnotModule.variables, {
      Rs: input(287, 'J/(kg*K)'),
      T1: input(300, 'K'),
      v1: input((287 * 300) / 100000, 'm^3/kg'),
    })
    expect(result.values['p1']?.value).toBeCloseTo(100000, 0)
  })
})

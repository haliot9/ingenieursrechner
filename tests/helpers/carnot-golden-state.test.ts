import { describe, it, expect } from 'vitest'
import { generateGoldenState, pickSubset } from './carnot-golden-state'

describe('Golden State Generator', () => {
  const golden = generateGoldenState({
    T_cold: 300, T_hot: 600, v2: 0.1435, v3: 0.7175, Rs: 287, kappa: 1.4,
  })

  it('isothermal constraints: T1=T4=T_cold, T2=T3=T_hot', () => {
    expect(golden.T1).toBe(300)
    expect(golden.T4).toBe(300)
    expect(golden.T2).toBe(600)
    expect(golden.T3).toBe(600)
  })

  it('ideal gas law holds at all 4 states: p*v = Rs*T', () => {
    for (const i of [1, 2, 3, 4] as const) {
      const p = golden[`p${i}`]
      const v = golden[`v${i}`]
      const T = golden[`T${i}`]
      expect(p * v).toBeCloseTo(golden.Rs * T, 3)
    }
  })

  it('adiabatic T-v relation holds for 1->2 and 3->4', () => {
    const k = golden.kappa
    // T1 * v1^(k-1) = T2 * v2^(k-1)
    const lhs12 = golden.T1 * Math.pow(golden.v1, k - 1)
    const rhs12 = golden.T2 * Math.pow(golden.v2, k - 1)
    expect(lhs12).toBeCloseTo(rhs12, 3)

    // T3 * v3^(k-1) = T4 * v4^(k-1)
    const lhs34 = golden.T3 * Math.pow(golden.v3, k - 1)
    const rhs34 = golden.T4 * Math.pow(golden.v4, k - 1)
    expect(lhs34).toBeCloseTo(rhs34, 3)
  })

  it('adiabatic p-v relation holds for 1->2 and 3->4', () => {
    const k = golden.kappa
    // p1 * v1^k = p2 * v2^k
    const lhs12 = golden.p1 * Math.pow(golden.v1, k)
    const rhs12 = golden.p2 * Math.pow(golden.v2, k)
    expect(lhs12).toBeCloseTo(rhs12, 1)

    // p3 * v3^k = p4 * v4^k
    const lhs34 = golden.p3 * Math.pow(golden.v3, k)
    const rhs34 = golden.p4 * Math.pow(golden.v4, k)
    expect(lhs34).toBeCloseTo(rhs34, 1)
  })

  it('extensive volumes V = v * m (default m=1)', () => {
    expect(golden.m).toBe(1)
    for (const i of [1, 2, 3, 4] as const) {
      expect(golden[`V${i}`]).toBeCloseTo(golden[`v${i}`] * golden.m, 6)
    }
  })

  it('densities rho = 1/v', () => {
    for (const i of [1, 2, 3, 4] as const) {
      expect(golden[`rho${i}`]).toBeCloseTo(1 / golden[`v${i}`], 6)
    }
  })

  it('Mayer relation: cp = cv + Rs', () => {
    expect(golden.cp).toBeCloseTo(golden.cv + golden.Rs, 6)
  })

  it('kappa definition: kappa = cp/cv', () => {
    expect(golden.kappa).toBeCloseTo(golden.cp / golden.cv, 6)
  })

  it('molar mass: M = R/Rs', () => {
    expect(golden.M).toBeCloseTo(8.314 / golden.Rs, 6)
  })

  it('efficiency: eta = 1 - T_cold/T_hot', () => {
    expect(golden.eta).toBeCloseTo(1 - 300 / 600, 6)
    expect(golden.eta).toBeCloseTo(0.5, 6)
  })

  it('isothermal heat formulas yield correct q_in and q_out', () => {
    // q_in = Rs * T_hot * ln(v3/v2)
    const expectedQIn = 287 * 600 * Math.log(0.7175 / 0.1435)
    expect(golden.q_in).toBeCloseTo(expectedQIn, 3)
    expect(golden.q_in).toBeGreaterThan(0)

    // q_out = Rs * T_cold * ln(v1/v4) — negative
    expect(golden.q_out).toBeLessThan(0)
  })

  it('first law: w_netto = -(q_in + q_out)', () => {
    expect(golden.w_netto).toBeCloseTo(-(golden.q_in + golden.q_out), 3)
  })

  it('energy-based eta matches temperature-based eta', () => {
    const etaEnergy = -golden.w_netto / golden.q_in
    expect(etaEnergy).toBeCloseTo(golden.eta, 6)
  })

  it('all values are finite and well-defined', () => {
    for (const [key, value] of Object.entries(golden)) {
      expect(isFinite(value as number), `${key} should be finite`).toBe(true)
    }
  })
})

describe('pickSubset', () => {
  const golden = generateGoldenState({
    T_cold: 300, T_hot: 600, v2: 0.1435, v3: 0.7175, Rs: 287, kappa: 1.4,
  })

  it('extracts correct variables as VariableState', () => {
    const subset = pickSubset(golden, ['T1', 'T3', 'Rs', 'kappa'])
    expect(Object.keys(subset)).toHaveLength(4)
    expect(subset['T1'].value).toBe(300)
    expect(subset['T3'].value).toBe(600)
    expect(subset['Rs'].value).toBe(287)
    expect(subset['kappa'].value).toBe(1.4)
    expect(subset['T1'].isUserInput).toBe(true)
  })

  it('throws on invalid variable ID', () => {
    expect(() => pickSubset(golden, ['nonexistent'])).toThrow()
  })
})

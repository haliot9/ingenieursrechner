/**
 * Golden State Generator for Carnot cycle testing.
 *
 * Computes a fully consistent Carnot state from 6 (or 7) independent parameters.
 * This is the "ground truth" against which the solver is tested.
 *
 * Inputs:  T_cold, T_hot, v2, v3, Rs, kappa [, m]
 * Outputs: All ~30 Carnot variables (p1-4, T1-4, v1-4, V1-4, rho1-4, m, Rs, M, kappa, cp, cv, q_in, q_out, w_netto, eta)
 */

export interface GoldenStateParams {
  T_cold: number  // T1 = T4 [K]
  T_hot: number   // T2 = T3 [K]
  v2: number      // specific volume at state 2 [m^3/kg]
  v3: number      // specific volume at state 3 [m^3/kg]
  Rs: number      // specific gas constant [J/(kg*K)]
  kappa: number   // isentropic exponent [-]
  m?: number      // mass [kg], default 1
}

export interface GoldenState {
  // Temperatures
  T1: number; T2: number; T3: number; T4: number
  // Specific volumes
  v1: number; v2: number; v3: number; v4: number
  // Pressures
  p1: number; p2: number; p3: number; p4: number
  // Extensive volumes
  V1: number; V2: number; V3: number; V4: number
  // Densities
  rho1: number; rho2: number; rho3: number; rho4: number
  // Specific entropies (reference: T0=273.15 K, p0=101325 Pa, s0=0)
  s1: number; s2: number; s3: number; s4: number
  // Mass & gas properties
  m: number; Rs: number; M: number; kappa: number; cv: number; cp: number
  // Energy balance
  q_in: number; q_out: number; w_netto: number; eta: number
}

export function generateGoldenState(params: GoldenStateParams): GoldenState {
  const { T_cold, T_hot, v2, v3, Rs, kappa, m = 1 } = params

  // Isothermal constraints
  const T1 = T_cold
  const T2 = T_hot
  const T3 = T_hot
  const T4 = T_cold

  // Adiabatic relations: T * v^(kappa-1) = const
  // 1->2 adiabatic: T1 * v1^(k-1) = T2 * v2^(k-1)
  //   v1 = v2 * (T2/T1)^(1/(k-1))
  const exp = 1 / (kappa - 1)
  const v1 = v2 * Math.pow(T_hot / T_cold, exp)

  // 3->4 adiabatic: T3 * v3^(k-1) = T4 * v4^(k-1)
  //   v4 = v3 * (T3/T4)^(1/(k-1))
  const v4 = v3 * Math.pow(T_hot / T_cold, exp)

  // Ideal gas: p = Rs * T / v
  const p1 = Rs * T1 / v1
  const p2 = Rs * T2 / v2
  const p3 = Rs * T3 / v3
  const p4 = Rs * T4 / v4

  // Extensive volumes: V = v * m
  const V1 = v1 * m
  const V2 = v2 * m
  const V3 = v3 * m
  const V4 = v4 * m

  // Densities: rho = 1/v
  const rho1 = 1 / v1
  const rho2 = 1 / v2
  const rho3 = 1 / v3
  const rho4 = 1 / v4

  // Gas properties
  const cv = Rs / (kappa - 1)
  const cp = kappa * cv
  const M = 8.314 / Rs

  // Specific entropies: s = cp·ln(T/T0) - Rs·ln(p/p0) with T0=273.15 K, p0=101325 Pa
  const T0 = 273.15
  const p0 = 101325
  const s1 = cp * Math.log(T1 / T0) - Rs * Math.log(p1 / p0)
  const s2 = cp * Math.log(T2 / T0) - Rs * Math.log(p2 / p0)
  const s3 = cp * Math.log(T3 / T0) - Rs * Math.log(p3 / p0)
  const s4 = cp * Math.log(T4 / T0) - Rs * Math.log(p4 / p0)

  // Energy balance
  const eta = 1 - T_cold / T_hot
  const q_in = Rs * T_hot * Math.log(v3 / v2)   // isothermal expansion 2->3 (positive)
  const q_out = Rs * T_cold * Math.log(v1 / v4)  // isothermal compression 4->1 (negative, v1 < v4)
  const w_netto = -(q_in + q_out)                 // work output (negative by convention)

  return {
    T1, T2, T3, T4,
    v1, v2, v3, v4,
    p1, p2, p3, p4,
    V1, V2, V3, V4,
    rho1, rho2, rho3, rho4,
    s1, s2, s3, s4,
    m, Rs, M, kappa, cv, cp,
    q_in, q_out, w_netto, eta,
  }
}

/**
 * Pick a subset of variables from a golden state, returning them as
 * solver-compatible VariableState records.
 */
export function pickSubset(
  golden: GoldenState,
  varIds: string[]
): Record<string, { value: number; unit: string; isUserInput: boolean; isComputed: boolean }> {
  const result: Record<string, { value: number; unit: string; isUserInput: boolean; isComputed: boolean }> = {}
  for (const id of varIds) {
    const value = golden[id as keyof GoldenState] as number
    if (value === undefined) {
      throw new Error(`Variable '${id}' not found in golden state`)
    }
    result[id] = { value, unit: '', isUserInput: true, isComputed: false }
  }
  return result
}

/**
 * All named minimal input subsets that should fully determine a Carnot cycle.
 *
 * Each set defines:
 *   - name: Human-readable identifier
 *   - variables: Which golden-state variables are given as input
 *   - expectedOutputs: Which variables the solver should be able to compute
 *
 * Categorization follows the ACTIVE.md plan.
 */

export interface InputSet {
  name: string
  variables: string[]
  /** Variables that MUST be computable from this input set */
  expectedOutputs: string[]
}

// Common output expectations
const CORE_INTENSIVE = [
  'T1', 'T2', 'T3', 'T4',
  'v1', 'v2', 'v3', 'v4',
  'p1', 'p2', 'p3', 'p4',
  'rho1', 'rho2', 'rho3', 'rho4',
  's1', 's2', 's3', 's4',
  'eta',
]

const CORE_INTENSIVE_WITH_ENERGY = [
  ...CORE_INTENSIVE,
  'q_in', 'q_out', 'w_netto',
]

const CORE_WITH_EXTENSIVE = [
  ...CORE_INTENSIVE_WITH_ENERGY,
  'V1', 'V2', 'V3', 'V4',
]

const STOFFEIGENSCHAFTEN = ['cv', 'cp', 'M']

// ─── Category A: Two temperatures + two p/v from different isotherms ───

const A1: InputSet = {
  name: 'A1: T1, T3, p2, p3, Rs, κ (reference case)',
  variables: ['T1', 'T3', 'p2', 'p3', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

const A2: InputSet = {
  name: 'A2: T1, T3, v2, v3, Rs, κ',
  variables: ['T1', 'T3', 'v2', 'v3', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

const A3: InputSet = {
  name: 'A3: T2, T4, p1, p4, Rs, κ',
  variables: ['T2', 'T4', 'p1', 'p4', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

const A4: InputSet = {
  name: 'A4: T2, T4, v1, v4, Rs, κ',
  variables: ['T2', 'T4', 'v1', 'v4', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

const A5: InputSet = {
  name: 'A5: T1, T3, p1, p3, Rs, κ (cross-isotherm pressures)',
  variables: ['T1', 'T3', 'p1', 'p3', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

const A6: InputSet = {
  name: 'A6: T1, T3, v1, v3, Rs, κ (cross-isotherm volumes)',
  variables: ['T1', 'T3', 'v1', 'v3', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

const A7: InputSet = {
  name: 'A7: T1, T3, p2, v3, Rs, κ (mixed p + v)',
  variables: ['T1', 'T3', 'p2', 'v3', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

const A8: InputSet = {
  name: 'A8: T1, T3, v2, p3, Rs, κ (mixed v + p)',
  variables: ['T1', 'T3', 'v2', 'p3', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

// ─── Category B: Temperature + efficiency instead of second temperature ───

const B1: InputSet = {
  name: 'B1: T1, η, p2, p3, Rs, κ',
  variables: ['T1', 'eta', 'p2', 'p3', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

const B2: InputSet = {
  name: 'B2: T3, η, v2, v3, Rs, κ',
  variables: ['T3', 'eta', 'v2', 'v3', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

const B3: InputSet = {
  name: 'B3: T1, η, v1, v3, Rs, κ',
  variables: ['T1', 'eta', 'v1', 'v3', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

// ─── Category C: Temperature + energy quantity as bridge ───

const C1: InputSet = {
  name: 'C1: T1, T3, v2, q_in, Rs, κ',
  variables: ['T1', 'T3', 'v2', 'q_in', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

const C2: InputSet = {
  name: 'C2: T1, T3, v4, q_out, Rs, κ',
  variables: ['T1', 'T3', 'v4', 'q_out', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

const C3: InputSet = {
  name: 'C3: T1, T3, p2, q_in, Rs, κ',
  variables: ['T1', 'T3', 'p2', 'q_in', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

// ─── Category D: p+T at one state (no explicit v given) — BUG-4 territory ───

const D1: InputSet = {
  name: 'D1: p2, T2, p3, T1, Rs, κ (BUG-4 case)',
  variables: ['p2', 'T2', 'p3', 'T1', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

const D2: InputSet = {
  name: 'D2: p1, T1, p3, T3, Rs, κ',
  variables: ['p1', 'T1', 'p3', 'T3', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

const D3: InputSet = {
  name: 'D3: p2, T3, p4, T1, Rs, κ',
  variables: ['p2', 'T3', 'p4', 'T1', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

// ─── Category E: Material properties varied (Rs not directly given) ───

const E1: InputSet = {
  name: 'E1: T1, T3, p2, p3, cv, κ (Rs from Mayer)',
  variables: ['T1', 'T3', 'p2', 'p3', 'cv', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, 'Rs', 'cp', 'M'],
}

const E2: InputSet = {
  name: 'E2: T1, T3, p2, p3, cp, cv (Rs and κ derived)',
  variables: ['T1', 'T3', 'p2', 'p3', 'cp', 'cv'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, 'Rs', 'kappa', 'M'],
}

const E3: InputSet = {
  name: 'E3: T1, T3, p2, p3, M, κ (Rs from R/M)',
  variables: ['T1', 'T3', 'p2', 'p3', 'M', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, 'Rs', 'cv', 'cp'],
}

// ─── Category F: With mass (extensive quantities V, ρ) ───

const F1: InputSet = {
  name: 'F1: T1, T3, V2, V3, Rs, κ, m',
  variables: ['T1', 'T3', 'V2', 'V3', 'Rs', 'kappa', 'm'],
  expectedOutputs: [...CORE_WITH_EXTENSIVE, ...STOFFEIGENSCHAFTEN],
}

const F2: InputSet = {
  name: 'F2: T1, T3, p2, p3, Rs, κ, m (A1 + mass)',
  variables: ['T1', 'T3', 'p2', 'p3', 'Rs', 'kappa', 'm'],
  expectedOutputs: [...CORE_WITH_EXTENSIVE, ...STOFFEIGENSCHAFTEN],
}

// ─── Category G: Entropy as input (s replaces T or p) ───

const G1: InputSet = {
  name: 'G1: T1, s1, p2, p3, Rs, κ (s1+p2 → T2, replaces T3)',
  variables: ['T1', 's1', 'p2', 'p3', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

const G2: InputSet = {
  name: 'G2: T3, s3, p1, p4, Rs, κ (s3+p4 → T4, replaces T1)',
  variables: ['T3', 's3', 'p1', 'p4', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

const G3: InputSet = {
  name: 'G3: s1, s3, T1, p2, Rs, κ (s1+p2 → T2; s3+T3 → p3)',
  variables: ['s1', 's3', 'T1', 'p2', 'Rs', 'kappa'],
  expectedOutputs: [...CORE_INTENSIVE_WITH_ENERGY, ...STOFFEIGENSCHAFTEN],
}

// ─── Exports ───

export const ALL_INPUT_SETS: InputSet[] = [
  A1, A2, A3, A4, A5, A6, A7, A8,
  B1, B2, B3,
  C1, C2, C3,
  D1, D2, D3,
  E1, E2, E3,
  F1, F2,
  G1, G2, G3,
]

/** Critical subsets for property-based testing (fast-check) — keep small for speed */
export const CRITICAL_INPUT_SETS: InputSet[] = [
  A1, A2, A5, A7, D1, D2, G1,
]

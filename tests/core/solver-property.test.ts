import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { solve } from '../../src/core/solver'
import { FormulaRegistry } from '../../src/core/formula-registry'
import { carnotModule } from '../../src/modules/carnot'
import { generateGoldenState, pickSubset } from '../helpers/carnot-golden-state'
import { CRITICAL_INPUT_SETS } from '../helpers/carnot-input-sets'

const registry = FormulaRegistry.fromModule(carnotModule)
const variables = carnotModule.variables

describe('Carnot Solver: property-based tests (random values)', () => {
  it('solves eta correctly for all critical input sets with random parameters', () => {
    fc.assert(fc.property(
      fc.double({ min: 200, max: 500, noNaN: true }),      // T_cold
      fc.double({ min: 550, max: 1200, noNaN: true }),     // T_hot
      fc.double({ min: 0.01, max: 5, noNaN: true }),       // v2
      fc.double({ min: 0.1, max: 50, noNaN: true }),       // v3
      fc.double({ min: 100, max: 500, noNaN: true }),      // Rs
      fc.double({ min: 1.1, max: 1.67, noNaN: true }),     // kappa
      (T_cold, T_hot, v2, v3, Rs, kappa) => {
        fc.pre(T_hot > T_cold + 50)   // minimum temperature difference
        fc.pre(v3 > v2 * 1.5)         // expansion: v3 meaningfully > v2

        const golden = generateGoldenState({ T_cold, T_hot, v2, v3, Rs, kappa })

        for (const inputSet of CRITICAL_INPUT_SETS) {
          const inputs = pickSubset(golden, inputSet.variables)
          const result = solve(registry, variables, inputs)

          // Efficiency must always be computed and match
          const etaVal = result.values['eta']?.value
          expect(etaVal).not.toBeNull()
          if (etaVal !== null && etaVal !== undefined) {
            expect(Math.abs(etaVal - golden.eta)).toBeLessThan(1e-6)
          }
        }
      }
    ), { numRuns: 100 })
  })

  it('solves all 4 temperatures correctly with random parameters', () => {
    fc.assert(fc.property(
      fc.double({ min: 200, max: 500, noNaN: true }),
      fc.double({ min: 550, max: 1200, noNaN: true }),
      fc.double({ min: 0.05, max: 5, noNaN: true }),
      fc.double({ min: 0.5, max: 50, noNaN: true }),
      fc.double({ min: 150, max: 450, noNaN: true }),
      fc.double({ min: 1.1, max: 1.67, noNaN: true }),
      (T_cold, T_hot, v2, v3, Rs, kappa) => {
        fc.pre(T_hot > T_cold + 50)
        fc.pre(v3 > v2 * 1.5)

        const golden = generateGoldenState({ T_cold, T_hot, v2, v3, Rs, kappa })
        // Use A1 (the reference input set): T1, T3, p2, p3, Rs, kappa
        const inputs = pickSubset(golden, ['T1', 'T3', 'p2', 'p3', 'Rs', 'kappa'])
        const result = solve(registry, variables, inputs)

        for (const tId of ['T1', 'T2', 'T3', 'T4'] as const) {
          const val = result.values[tId]?.value
          expect(val).not.toBeNull()
          if (val !== null && val !== undefined) {
            expect(Math.abs(val - golden[tId])).toBeLessThan(1e-3)
          }
        }
      }
    ), { numRuns: 100 })
  })

  it('solves all pressures and specific volumes correctly (A1)', () => {
    fc.assert(fc.property(
      fc.double({ min: 250, max: 400, noNaN: true }),
      fc.double({ min: 600, max: 1000, noNaN: true }),
      fc.double({ min: 0.05, max: 2, noNaN: true }),
      fc.double({ min: 0.5, max: 20, noNaN: true }),
      fc.double({ min: 200, max: 400, noNaN: true }),
      fc.double({ min: 1.15, max: 1.6, noNaN: true }),
      (T_cold, T_hot, v2, v3, Rs, kappa) => {
        fc.pre(T_hot > T_cold + 100)
        fc.pre(v3 > v2 * 2)

        const golden = generateGoldenState({ T_cold, T_hot, v2, v3, Rs, kappa })
        const inputs = pickSubset(golden, ['T1', 'T3', 'p2', 'p3', 'Rs', 'kappa'])
        const result = solve(registry, variables, inputs)

        for (const i of [1, 2, 3, 4]) {
          const pVal = result.values[`p${i}`]?.value
          const vVal = result.values[`v${i}`]?.value
          const goldenP = golden[`p${i}` as keyof typeof golden] as number
          const goldenV = golden[`v${i}` as keyof typeof golden] as number

          expect(pVal).not.toBeNull()
          expect(vVal).not.toBeNull()
          if (pVal != null) {
            expect(Math.abs(pVal - goldenP) / goldenP).toBeLessThan(1e-3)
          }
          if (vVal != null) {
            expect(Math.abs(vVal - goldenV) / goldenV).toBeLessThan(1e-3)
          }
        }
      }
    ), { numRuns: 100 })
  })

  it('energy balance is consistent: w_netto = -(q_in + q_out)', () => {
    fc.assert(fc.property(
      fc.double({ min: 250, max: 450, noNaN: true }),
      fc.double({ min: 550, max: 1100, noNaN: true }),
      fc.double({ min: 0.05, max: 3, noNaN: true }),
      fc.double({ min: 0.5, max: 30, noNaN: true }),
      fc.double({ min: 150, max: 450, noNaN: true }),
      fc.double({ min: 1.1, max: 1.67, noNaN: true }),
      (T_cold, T_hot, v2, v3, Rs, kappa) => {
        fc.pre(T_hot > T_cold + 50)
        fc.pre(v3 > v2 * 1.5)

        const golden = generateGoldenState({ T_cold, T_hot, v2, v3, Rs, kappa })
        const inputs = pickSubset(golden, ['T1', 'T3', 'v2', 'v3', 'Rs', 'kappa'])
        const result = solve(registry, variables, inputs)

        const qIn = result.values['q_in']?.value
        const qOut = result.values['q_out']?.value
        const wNet = result.values['w_netto']?.value

        expect(qIn).not.toBeNull()
        expect(qOut).not.toBeNull()
        expect(wNet).not.toBeNull()

        if (qIn != null && qOut != null && wNet != null) {
          // First law: w_netto = -(q_in + q_out)
          expect(Math.abs(wNet - (-(qIn + qOut)))).toBeLessThan(Math.abs(wNet) * 1e-6 + 1e-6)
          // q_in > 0 (heat added)
          expect(qIn).toBeGreaterThan(0)
          // q_out < 0 (heat rejected)
          expect(qOut).toBeLessThan(0)
          // w_netto < 0 (work output)
          expect(wNet).toBeLessThan(0)
        }
      }
    ), { numRuns: 100 })
  })

  it('D1 (BUG-4 input pattern) works with random values', () => {
    fc.assert(fc.property(
      fc.double({ min: 250, max: 450, noNaN: true }),
      fc.double({ min: 550, max: 1100, noNaN: true }),
      fc.double({ min: 0.05, max: 3, noNaN: true }),
      fc.double({ min: 0.5, max: 30, noNaN: true }),
      fc.double({ min: 150, max: 450, noNaN: true }),
      fc.double({ min: 1.1, max: 1.67, noNaN: true }),
      (T_cold, T_hot, v2, v3, Rs, kappa) => {
        fc.pre(T_hot > T_cold + 50)
        fc.pre(v3 > v2 * 1.5)

        const golden = generateGoldenState({ T_cold, T_hot, v2, v3, Rs, kappa })
        // D1: p2, T2, p3, T1, Rs, kappa — the BUG-4 pattern
        const inputs = pickSubset(golden, ['p2', 'T2', 'p3', 'T1', 'Rs', 'kappa'])
        const result = solve(registry, variables, inputs)

        // v2 MUST be computed (this was the BUG-4 failure)
        const v2Val = result.values['v2']?.value
        expect(v2Val).not.toBeNull()
        if (v2Val != null) {
          expect(Math.abs(v2Val - golden.v2) / golden.v2).toBeLessThan(1e-3)
        }

        // eta must be correct
        const etaVal = result.values['eta']?.value
        expect(etaVal).not.toBeNull()
        if (etaVal != null) {
          expect(Math.abs(etaVal - golden.eta)).toBeLessThan(1e-6)
        }
      }
    ), { numRuns: 100 })
  })
})

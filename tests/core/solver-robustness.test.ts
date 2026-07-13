import { describe, it, expect } from 'vitest'
import { solve } from '../../src/core/solver'
import { FormulaRegistry } from '../../src/core/formula-registry'
import { carnotModule } from '../../src/modules/carnot'
import { generateGoldenState, pickSubset } from '../helpers/carnot-golden-state'
import { ALL_INPUT_SETS } from '../helpers/carnot-input-sets'

// Reference golden state — fixed values used by all parameterized tests
const GOLDEN_PARAMS = {
  T_cold: 300,
  T_hot: 600,
  v2: 0.1435,
  v3: 0.7175,
  Rs: 287,
  kappa: 1.4,
  m: 1,
}
const golden = generateGoldenState(GOLDEN_PARAMS)

const registry = FormulaRegistry.fromModule(carnotModule)
const variables = carnotModule.variables

describe('Carnot Solver: all valid input combinations (parameterized)', () => {
  for (const inputSet of ALL_INPUT_SETS) {
    it(`solves correctly with ${inputSet.name}`, () => {
      // 1) Extract only the variables of this input set from the golden state
      const inputs = pickSubset(golden, inputSet.variables)

      // 2) Run the solver
      const result = solve(registry, variables, inputs)

      // 3) Check all expected outputs against golden values
      const failures: string[] = []
      for (const varId of inputSet.expectedOutputs) {
        // Skip variables that are already in the input set
        if (inputSet.variables.includes(varId)) continue

        const actual = result.values[varId]?.value
        const expected = golden[varId as keyof typeof golden] as number

        if (actual === null || actual === undefined) {
          failures.push(`${varId}: not computed (expected ${expected.toPrecision(6)})`)
        } else if (Math.abs(actual - expected) > Math.abs(expected) * 1e-3 + 1e-10) {
          failures.push(`${varId}: got ${actual.toPrecision(6)}, expected ${expected.toPrecision(6)}`)
        }
      }

      if (failures.length > 0) {
        // Also report which variables WERE successfully computed for debugging
        const computed = Object.entries(result.values)
          .filter(([, s]) => s.isComputed)
          .map(([id]) => id)
        expect.fail(
          `${failures.length} variable(s) wrong/missing:\n` +
          failures.map(f => `  - ${f}`).join('\n') +
          `\n\nComputed: [${computed.join(', ')}]` +
          `\nUnsolved: [${result.unsolved.join(', ')}]` +
          `\nErrors: ${result.errors.map(e => e.message).join('; ')}`
        )
      }
    })
  }
})

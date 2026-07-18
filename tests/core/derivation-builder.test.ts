import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { FormulaRegistry } from '../../src/core/formula-registry'
import { buildSolutionStepNoThrow, formatNumber, orderStepsByNarrative } from '../../src/core/derivation-builder'
import { solve } from '../../src/core/solver'
import type { Formula, SolutionStep, VariableState } from '../../src/core/types'
import { jouleModule } from '../../src/modules/joule'

function input(value: number, unit = ''): VariableState {
  return { value, unit, isUserInput: true, isComputed: false }
}

const correctedTargets = [
  'ideal_gas_1:v1', 'cv_from_Rs_kappa:cv', 'cp_from_kappa_cv:cp',
  'pressure_ratio:p2', 'high_pressure_isobar:p3', 'low_pressure_isobar:p4',
  'compressor_temperature:T2', 'turbine_temperature:T4', 'compressor_work:w_comp',
  'turbine_work:w_turb', 'net_work:w_netto', 'heat_input:q_in',
  'heat_rejection:q_out', 'efficiency:eta', 'back_work_ratio:back_work_ratio',
  'ideal_gas_2:v2', 'ideal_gas_3:v3', 'ideal_gas_4:v4', 'entropy_abs_1:s1',
  'entropy_abs_2:s2', 'entropy_abs_3:s3', 'entropy_abs_4:s4',
]
const correctedDigest = 'e7a400d9477e1e8823b967257fbb2cb0e721fbbdd7d24f49a5a95911c4c6e10e'

function solveReference() {
  return solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, {
    T1: input(300, 'K'), p1: input(100_000, 'Pa'), pressureRatio: input(10),
    T3: input(1400, 'K'), kappa: input(1.4), Rs: input(287, 'J/(kg*K)'),
  })
}

describe('Joule derivation inventory (corrected RED contract)', () => {
  it('proves the frozen solver provenance before derivation metadata is added', () => {
    const result = solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, {
      T1: input(300, 'K'), p1: input(100_000, 'Pa'), pressureRatio: input(10),
      T3: input(1400, 'K'), kappa: input(1.4), Rs: input(287, 'J/(kg*K)'),
    })
    const identities = result.steps.map(step => `${step.formulaId}:${step.targetVariable}`)

    expect(identities).toEqual(correctedTargets)
    expect(createHash('sha256').update(identities.join('\n')).digest('hex')).toBe(correctedDigest)
    expect(identities).toContain('entropy_abs_2:s2')
    expect(identities).toContain('entropy_abs_4:s4')
    expect(identities.some(identity => identity.startsWith('isentropic_entropy_12:'))).toBe(false)
    expect(identities.some(identity => identity.startsWith('isentropic_entropy_34:'))).toBe(false)
  })

  it('covers every corrected Joule target with structured rows, truthful omissions, and source provenance', () => {
    const result = solveReference()
    expect(result.steps).toHaveLength(22)
    for (const resultStep of result.steps) {
      expect(resultStep.derivationState?.mode).toBe('structured')
      expect(`${resultStep.derivationProvenance?.formulaId}:${resultStep.derivationProvenance?.targetId}`).toBe(`${resultStep.formulaId}:${resultStep.targetVariable}`)
      const rows = resultStep.derivationState?.mode === 'structured' ? resultStep.derivationState.rows : []
      expect(rows.map(row => row.kind)).toEqual(expect.arrayContaining(['formula', 'substitution', 'result']))
    }
    const byIdentity = Object.fromEntries(result.steps.map(resultStep => [`${resultStep.formulaId}:${resultStep.targetVariable}`, resultStep]))
    for (const identity of ['high_pressure_isobar:p3', 'low_pressure_isobar:p4']) {
      const state = byIdentity[identity].derivationState
      expect(state?.mode === 'structured' && state.rows.some(row => row.kind === 'rearrangement')).toBe(false)
    }
    for (const identity of correctedTargets.filter(identity => !['high_pressure_isobar:p3', 'low_pressure_isobar:p4'].includes(identity))) {
      const state = byIdentity[identity].derivationState
      expect(state?.mode === 'structured' && state.rows.some(row => row.kind === 'rearrangement')).toBe(true)
    }
    expect(byIdentity['entropy_abs_2:s2'].derivationProvenance?.formulaId).toBe('entropy_abs_2')
    expect(byIdentity['entropy_abs_4:s4'].derivationProvenance?.formulaId).toBe('entropy_abs_4')
  })

  it('keeps trailing zeroes and explicit signed-ratio grouping', () => {
    const result = solveReference()
    expect(formatNumber(-677_910)).toBe('-677910')
    const substitution = (target: string) => {
      const state = result.steps.find(step => step.targetVariable === target)?.derivationState
      return state?.mode === 'structured' ? state.rows.find(row => row.kind === 'substitution')?.latex : ''
    }
    expect(substitution('eta')).toContain('\\left(')
    expect(substitution('back_work_ratio')).toContain('\\left(')
  })

  it('returns a result-only unavailable step when opted-in metadata is malformed', () => {
    const formula: Formula = {
      id: 'broken', name: 'Broken', latex: 'x = a', variables: ['x', 'a'], solveFor: { x: 'a' },
      latexSteps: { x: { rearranged: '', explanation: 'Broken', derivation: { optedIn: true, rearrangement: 'show', substitution: { mode: 'mathjs' }, narrative: { phase: 'performance', rank: 1 } } } },
    }
    const built = buildSolutionStepNoThrow({ formula, targetId: 'x', target: { id: 'x', symbol: 'x', latex: 'x', name: 'x', defaultUnit: '', alternativeUnits: [] }, evaluationScope: { a: 10 }, acceptedValue: 10, sourceVariableIds: ['a'], sourceStepIndexes: {}, rawStepIndex: 0 }, [])
    expect(built.step.derivationState?.mode).toBe('unavailable')
    expect(built.step.derivationState?.mode === 'unavailable' && built.step.derivationState.resultRow.latex).toBe('x = 10')
  })

  it('keeps provenance dependencies ahead of preferred narrative phase', () => {
    const source: SolutionStep = { formulaId: 'source', formulaName: 'source', targetVariable: 'source', targetSymbol: 'source', originalLatex: '', rearrangedLatex: '', substitutedLatex: '', resultLatex: '', resultValue: 1, resultUnit: '', explanation: '', derivationProvenance: { formulaId: 'source', targetId: 'source', sourceVariableIds: [], sourceStepIndexes: {}, rawStepIndex: 1 }, narrative: { phase: 'performance', rank: 1 } }
    const target: SolutionStep = { ...source, formulaId: 'target', targetVariable: 'target', derivationProvenance: { formulaId: 'target', targetId: 'target', sourceVariableIds: ['source'], sourceStepIndexes: { source: 1 }, rawStepIndex: 0 }, narrative: { phase: 'given-state-and-properties', rank: 1 } }
    expect(orderStepsByNarrative([target, source]).map(step => step.targetVariable)).toEqual(['source', 'target'])
  })

})

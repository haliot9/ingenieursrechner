import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { FormulaRegistry } from '../../src/core/formula-registry'
import { buildPresentationPlan, buildSolutionStepNoThrow, formatNumber, orderStepsByNarrative } from '../../src/core/derivation-builder'
import { solve } from '../../src/core/solver'
import type { Formula, ReachabilityPlan, SolutionStep, VariableState } from '../../src/core/types'
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



  it('uses module context policy only after dependency readiness', () => {
    const later: SolutionStep = { formulaId: 'later', formulaName: 'later', targetVariable: 'later', targetSymbol: 'later', originalLatex: '', rearrangedLatex: '', substitutedLatex: '', resultLatex: '', resultValue: 1, resultUnit: '', explanation: '', derivationProvenance: { formulaId: 'later', targetId: 'later', sourceVariableIds: [], sourceStepIndexes: {}, rawStepIndex: 0 }, narrative: { contextId: 'late', phase: 'late', rank: 0 } }
    const preferred: SolutionStep = { ...later, formulaId: 'preferred', targetVariable: 'preferred', derivationProvenance: { formulaId: 'preferred', targetId: 'preferred', sourceVariableIds: [], sourceStepIndexes: {}, rawStepIndex: 1 }, narrative: { contextId: 'preferred', phase: 'preferred', rank: 0 } }
    expect(orderStepsByNarrative([later, preferred], { contextRanks: { preferred: 0, late: 1 } }).map(step => step.targetVariable)).toEqual(['preferred', 'later'])
  })



  it('builds serializable alternative and blocked presentation without promoting a relation to evidence', () => {
    const primary: SolutionStep = { formulaId: 'efficiency', formulaName: 'Energie-Wirkungsgrad', targetVariable: 'eta', targetSymbol: '\\eta', originalLatex: '\\eta = -w/q', rearrangedLatex: '', substitutedLatex: '', resultLatex: '\\eta = 0.48', resultValue: 0.48, resultUnit: '', explanation: '', derivationProvenance: { formulaId: 'efficiency', targetId: 'eta', sourceVariableIds: [], sourceStepIndexes: {}, rawStepIndex: 0 }, narrative: { contextId: 'performance', rank: 0 } }
    const plan: ReachabilityPlan = {
      reachableIds: ['eta'],
      primaryByTarget: new Map([['eta', { targetId: 'eta', directionId: 'efficiency:eta', dependencyIds: [], closureDirectionIds: ['efficiency:eta'], cost: { closureApplications: 1, nonUserIntermediateFacts: 0, downstreamReuse: 0, detachedBranchStarts: 0 }, disposition: 'primary' }]]),
      alternativesByTarget: new Map([['eta', [
        { targetId: 'eta', directionId: 'ideal_efficiency:eta', dependencyIds: ['pressureRatio', 'kappa'], closureDirectionIds: ['ideal_efficiency:eta'], cost: { closureApplications: 1, nonUserIntermediateFacts: 0, downstreamReuse: 0, detachedBranchStarts: 0 }, disposition: 'equivalent-alternative' },
        { targetId: 'eta', directionId: 'other_efficiency:eta', dependencyIds: [], closureDirectionIds: ['other_efficiency:eta'], cost: { closureApplications: 1, nonUserIntermediateFacts: 0, downstreamReuse: 0, detachedBranchStarts: 0 }, disposition: 'equivalent-alternative' },
      ]]]),
      blocked: [{ targetId: 'T2', candidates: [{ directionId: 'compressor_temperature:T2', missingIds: ['pressureRatio'] }] }, { targetId: 'T3', candidates: [{ directionId: 'heat_input:T3', missingIds: ['T2'] }] }],
    }
    const presentation = buildPresentationPlan({
      steps: [primary], plan,
      formulas: [
        { id: 'ideal_efficiency', name: 'Idealer Joule-Wirkungsgrad', latex: '\\eta = 1 - 1/r_p', variables: [], solveFor: {}, latexSteps: {} },
        { id: 'other_efficiency', name: 'Andere Herleitung', latex: '\\eta = 0.48', variables: [], solveFor: {}, latexSteps: {} },
      ],
      visibleAlternativeDirectionIds: ['ideal_efficiency:eta'],
      diagnostics: [{ id: 'temperature-gap', targetIds: ['T2', 'T3'], latex: 'T_3 = T_2 + q_{in}/c_p', missingFactHint: 'r_p oder p_2' }],
    })
    expect(presentation.primarySteps).toEqual([primary])
    expect(presentation.alternatives).toEqual([expect.objectContaining({ targetId: 'eta', label: 'Alternative Herleitung', latex: '\\eta = 1 - 1/r_p' })])
    expect(presentation.blocked).toEqual([expect.objectContaining({ latex: 'T_3 = T_2 + q_{in}/c_p', missingFactHint: 'r_p oder p_2' })])
    expect(JSON.parse(JSON.stringify(presentation)).blocked[0]).not.toHaveProperty('value')
  })

})

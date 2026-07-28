import { describe, expect, it } from 'vitest'
import { FormulaRegistry } from '../../../src/core/formula-registry'
import { solve } from '../../../src/core/solver'
import type { VariableState } from '../../../src/core/types'
import { composeJouleCalculationStory, formatStoryNumberLatex } from '../../../src/modules/joule/calculation-story'
import { jouleModule } from '../../../src/modules/joule'

function input(value: number, unit = ''): VariableState { return { value, unit, isUserInput: true, isComputed: false } }
function referenceResult() { return solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, { T1: input(300, 'K'), p1: input(100_000, 'Pa'), pressureRatio: input(10), T3: input(1400, 'K'), kappa: input(1.4), Rs: input(287, 'J/(kg*K)') }, [], { plannedExecution: jouleModule.plannedExecution }) }
function referenceStory() { const result = referenceResult(); const story = composeJouleCalculationStory({ plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables }); if (story.mode !== 'complete') throw new Error('expected complete story'); return { result, story: story.story } }

describe('Joule learning story Golden v0.2', () => {
  it('keeps accepted solver evidence unchanged while composing the learning hierarchy', () => {
    const { result, story } = referenceStory()
    expect(story.sections?.map(section => section.id)).toEqual(['material-properties', 'state-1', 'compression-1-2', 'heat-input-2-3', 'expansion-3-4', 'heat-rejection-4-1', 'cycle-balance-performance', 'optional-entropy'])
    expect(story.sections?.find(section => section.id === 'optional-entropy')).toMatchObject({ tier: 'optional', defaultOpen: false })
    expect(story.consumedSteps.map(step => step.directionId).sort()).toEqual([...result.plan!.primaryByTarget.values()].map(step => step.directionId).sort())
    expect(story.consumedSteps).toHaveLength(22)
    expect(story.overview?.model).toContain('stationärer')
    expect(story.overview?.scope).toContain('spezifisches Volumen')
  })

  it('uses every ordered entropy micro-step exactly once without skipping a Golden state', () => {
    const { story } = referenceStory()
    const expected = ['derivative', 'antiderivative', 'differential', 'integrate-both', 'left-bounds', 'pull-cp', 'pull-rs', 'primitive-temperature', 'primitive-pressure', 'temperature-bounds', 'pressure-bounds', 'log-quotient', 'quotient-temperature', 'quotient-pressure', 'integrated', 'reference-temperature', 'reference-pressure', 'reference-entropy', 'substitute-reference-entropy', 'simplify-left', 'substitute-reference-temperature', 'substitute-reference-pressure', 'datum']
    expect(story.rows.filter(row => row.id.startsWith('shared:entropy-')).map(row => row.id)).toEqual(expected.map(id => `shared:entropy-${id}`))
  })

  it('teaches every first-use physical bridge before reuse and marks all completed states', () => {
    const { story } = referenceStory(); const ids = story.rows.map(row => row.id); const position = (id: string) => ids.indexOf(id)
    expect(position('shared:isentropic-exponent-definition')).toBeLessThan(position('compressor_temperature:T2:ratio'))
    expect(['high_pressure_isobar:p3:condition', 'high_pressure_isobar:p3:dp', 'high_pressure_isobar:p3:result'].map(position)).toEqual([...['high_pressure_isobar:p3:condition', 'high_pressure_isobar:p3:dp', 'high_pressure_isobar:p3:result'].map(position)].sort((a, b) => a - b))
    expect(story.rows.find(row => row.id === 'heat_input:q_in:reuse-steady-flow')?.note).toContain('wiederverwendet')
    expect(story.rows.find(row => row.id === 'heat_rejection:q_out:reuse')?.equationLatex).toContain('c_p(T_1-T_4)')
    expect(story.rows.find(row => row.id === 'compressor_work:w_comp:family')?.equationLatex).toContain('c_p(T_2-T_1)')
    expect(story.rows.find(row => row.id === 'turbine_work:w_turb:reuse')?.equationLatex).toContain('c_p(T_4-T_3)')
    expect(story.rows.filter(row => row.id.endsWith(':complete')).map(row => row.id)).toEqual(['state-1:complete', 'state-2:complete', 'state-3:complete', 'state-4:complete'])
  })

  it('keeps result payload boxes separate from bridges, shows dimensional substitution, and removes telemetry notes', () => {
    const { story } = referenceStory()
    expect(story.rows.find(row => row.id === 'material:cp')?.equation).toMatchObject({ bridgeLatex: '\\Longleftrightarrow', lhsLatex: 'c_p', rhsLatex: '\\kappa c_v' })
    expect(story.rows.find(row => row.id === 'material:cv-substitution')?.equationLatex).toContain('\\frac{\\mathrm J}{\\mathrm{kg}\\,\\mathrm K}')
    expect(story.rows.some(row => /Solverwert|Bereits hergeleitete|Wiederverwendbare äquivalente/.test(row.note ?? ''))).toBe(false)
  })

  it('uses parent-attached alternatives without changing selected provenance or solver values', () => {
    const result = referenceResult(); const values = JSON.stringify(result.values); const steps = JSON.stringify(result.steps)
    const composed = composeJouleCalculationStory({ plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables })
    expect(composed.mode).toBe('complete'); if (composed.mode !== 'complete') throw new Error('expected complete story')
    expect(composed.story.alternatives?.every(alternative => alternative.parentRowId.endsWith(':numeric') && alternative.rows.length === 1)).toBe(true)
    expect(JSON.stringify(result.values)).toBe(values); expect(JSON.stringify(result.steps)).toBe(steps)
  })

  it('composes the reference route as explicit, target-consistent teaching steps', () => {
    const { story } = referenceStory()
    const byId = (id: string) => story.rows.find(row => row.id === id)

    expect(story.sections?.map(section => section.id)).not.toContain('overview')
    expect(byId('material:memory')).toBeUndefined()
    expect(story.rows.some(row => row.equationLatex.includes('κc_v'))).toBe(false)
    expect(byId('material:cp')?.equation?.rhsLatex).toBe('\\kappa c_v')
    expect(byId('material:cp')?.equation?.bridgeLatex).toBe('\\Longleftrightarrow')
    expect(byId('material:cv-resolved')?.equation?.rhsLatex).toBe('\\frac{R_s}{\\kappa-1}')
    expect(byId('ideal_gas_1:v1:result')?.equation?.lhsLatex).toBe('v_1')
    expect(byId('high_pressure_isobar:p3:dp')?.equationLatex).toBe('dp=0')
    expect(byId('shared:isentropic-apply-exponential')?.equationLatex).toContain('e^{')
    expect(byId('shared:isentropic-inverse-exponential')?.equationLatex).toContain('e^{\\ln y}=y')
    expect(byId('heat_input:q_in:reuse-steady-flow')?.equationLatex).toContain('q-w_s=h_{out}-h_{in}')
    expect(byId('state-1:complete')?.rowRole as string).toBe('milestone')
    expect(byId('state-1:complete')?.equationLatex).not.toContain('=')
    expect(story.rows.filter(row => row.id.endsWith(':numeric')).every((row) => {
      const index = story.rows.indexOf(row)
      return story.rows[index - 1]?.id.includes('substitution')
    })).toBe(true)
  })

  it('keeps primary substitutions mathematical, explicit, and numerically grounded', () => {
    const { story } = referenceStory()
    const substitutions = [
      ['ideal_gas_1:v1:substitution', '287'], ['pressure_ratio:p2:substitution', '100000'],
      ['compressor_temperature:T2:substitution', '300'], ['ideal_gas_2:v2:substitution', '287'],
      ['high_pressure_isobar:p3:substitution', '100000'], ['heat_input:q_in:substitution', '1004.5'],
      ['ideal_gas_3:v3:substitution', '287'], ['low_pressure_isobar:p4:substitution', '100000'],
      ['turbine_temperature:T4:substitution', '1400'], ['ideal_gas_4:v4:substitution', '287'],
      ['compressor_work:w_comp:substitution', '1004.5'], ['turbine_work:w_turb:substitution', '1004.5'],
      ['heat_rejection:q_out:substitution', '1004.5'], ['net_work:w_netto:substitution', '+'],
      ['efficiency:eta:substitution', '-'],
    ]
    for (const [id, operand] of substitutions) {
      const row = story.rows.find(candidate => candidate.id === id)
      expect(row?.equation?.rhsLatex, id).toContain(operand)
      expect(row?.equation?.rhsLatex, id).toMatch(/\\mathrm|[0-9]/)
    }
  })

  it('preserves significant terminal integer zeros in story-local numerical values and agrees with solver facts', () => {
    const { result, story } = referenceStory()
    expect(formatStoryNumberLatex(427040)).toBe('427040')
    expect(formatStoryNumberLatex(-677910)).toBe('-677910')
    for (const id of ['turbine_work:w_turb:numeric', 'heat_rejection:q_out:numeric', 'net_work:w_netto:numeric']) {
      const target = id.split(':')[1]
      expect(story.rows.find(row => row.id === id)?.equation?.rhsLatex).toContain(formatStoryNumberLatex(result.values[target]?.value ?? NaN))
    }
  })

  it('uses explicit subjects, equation-only exponential rows, no immediate generic ideal-gas duplicate, and an explicit state-4 dependency cue', () => {
    const { story } = referenceStory()
    expect(story.rows.find(row => row.id === 'high_pressure_isobar:p3:dp')?.rowRole).toBe('subject-change')
    expect(story.rows.find(row => row.id === 'high_pressure_isobar:p3:dp')?.equationLatex).toBe('dp=0')
    expect(story.rows.find(row => row.id === 'heat_input:q_in:reuse-steady-flow')?.note).toContain('wiederverwendet')
    expect(story.rows.find(row => row.id === 'heat_input:q_in:without-work')?.equationLatex).toBe('w_s=0')
    expect(story.rows.find(row => row.id === 'shared:isentropic-apply-exponential')?.operation).toMatchObject({ kind: 'exponentiate', latex: '\\text{wende }e^{(\\cdot)}\\text{ auf beide Seiten an}' })
    expect(story.rows.find(row => row.id === 'shared:isentropic-apply-exponential')?.equationLatex).toBe('e^{\\ln(T_2/T_1)}=e^{\\ln((p_2/p_1)^a)}')
    expect(story.rows.find(row => row.id === 'shared:ideal-gas')).toBeUndefined()
    expect(story.rows.find(row => row.id === 'expansion:state-4-pressure-dependency')?.label).toContain('p₄ fehlt')
  })
})


describe('Joule SFEE first-use continuity', () => {
  it('reduces the compressor balance one physical assumption at a time before the repository work convention', () => {
    const { story } = referenceStory()
    const ids = [
      'compressor_work:w_comp:steady-flow',
      'compressor_work:w_comp:delta-ke',
      'compressor_work:w_comp:without-ke',
      'compressor_work:w_comp:delta-pe',
      'compressor_work:w_comp:without-pe',
      'compressor_work:w_comp:adiabatic',
      'compressor_work:w_comp:without-heat',
      'compressor_work:w_comp:convention',
      'compressor_work:w_comp:enthalpy',
      'compressor_work:w_comp:integral',
      'compressor_work:w_comp:constant-cp',
      'compressor_work:w_comp:primitive',
      'compressor_work:w_comp:family',
    ]
    expect(ids.map(id => story.rows.find(row => row.id === id)?.equationLatex)).toEqual([
      'q-w_s=(h_{out}-h_{in})+\\Delta ke+\\Delta pe',
      '\\Delta ke=0',
      'q-w_s=(h_{out}-h_{in})+\\Delta pe',
      '\\Delta pe=0',
      'q-w_s=h_{out}-h_{in}',
      'q=0',
      '-w_s=h_2-h_1',
      'w_{comp}:=-w_s',
      'w_{comp}=h_2-h_1',
      '=\\int_{T_1}^{T_2}c_p\\,dT',
      '=c_p\\int_{T_1}^{T_2}dT',
      '=c_p[T]_{T_1}^{T_2}',
      'w_{comp}=c_p(T_2-T_1)>0',
    ])
  })

  it('reuses the proven reduced balance before specializing the heater heat chain', () => {
    const { story } = referenceStory()
    const ids = [
      'heat_input:q_in:reuse-steady-flow',
      'heat_input:q_in:without-work',
      'heat_input:q_in:enthalpy',
      'heat_input:q_in:endpoint',
      'heat_input:q_in:integral',
      'heat_input:q_in:constant-cp',
      'heat_input:q_in:primitive',
      'heat_input:q_in:bounds',
      'heat_input:q_in:family',
    ]
    expect(ids.map(id => story.rows.find(row => row.id === id)?.equationLatex)).toEqual([
      'q-w_s=h_{out}-h_{in}',
      'w_s=0',
      'q=h_{out}-h_{in}',
      'q_{in}=h_3-h_2',
      '=\\int_{T_2}^{T_3}c_p\\,dT',
      '=c_p\\int_{T_2}^{T_3}\\,dT',
      '=c_p[T]_{T_2}^{T_3}',
      '=c_p(T_3-T_2)',
      'q_{in}=c_p(T_3-T_2)',
    ])
    expect(story.rows.some(row => row.id === 'heat_input:q_in:delta-ke' || row.id === 'heat_input:q_in:delta-pe')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { FormulaRegistry } from '../../../src/core/formula-registry'
import { solve } from '../../../src/core/solver'
import type { VariableState } from '../../../src/core/types'
import { composeJouleCalculationStory } from '../../../src/modules/joule/calculation-story'
import { jouleModule } from '../../../src/modules/joule'

function input(value: number, unit = ''): VariableState { return { value, unit, isUserInput: true, isComputed: false } }
function referenceResult() { return solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, { T1: input(300, 'K'), p1: input(100_000, 'Pa'), pressureRatio: input(10), T3: input(1400, 'K'), kappa: input(1.4), Rs: input(287, 'J/(kg*K)') }, [], { plannedExecution: jouleModule.plannedExecution }) }
function referenceStory() { const result = referenceResult(); const story = composeJouleCalculationStory({ plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables }); if (story.mode !== 'complete') throw new Error('expected complete story'); return { result, story: story.story } }

describe('Joule learning story Golden v0.2', () => {
  it('keeps accepted solver evidence unchanged while composing the nine-tier learning hierarchy', () => {
    const { result, story } = referenceStory()
    expect(story.sections?.map(section => section.id)).toEqual(['overview', 'material-properties', 'state-1', 'compression-1-2', 'heat-input-2-3', 'expansion-3-4', 'heat-rejection-4-1', 'cycle-balance-performance', 'optional-entropy'])
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
    expect(story.rows.find(row => row.id === 'heat_input:q_in:conditions')?.note).toContain('Stationär')
    expect(story.rows.find(row => row.id === 'heat_rejection:q_out:reuse')?.equationLatex).toContain('c_p(T_1-T_4)')
    expect(story.rows.find(row => row.id === 'compressor_work:w_comp:family')?.equationLatex).toContain('c_p(T_2-T_1)')
    expect(story.rows.find(row => row.id === 'turbine_work:w_turb:reuse')?.equationLatex).toContain('c_p(T_4-T_3)')
    expect(story.rows.filter(row => row.id.endsWith(':complete')).map(row => row.id)).toEqual(['state-1:complete', 'state-2:complete', 'state-3:complete', 'state-4:complete'])
  })

  it('keeps result payload boxes separate from bridges, shows dimensional substitution, and removes telemetry notes', () => {
    const { story } = referenceStory()
    expect(story.rows.find(row => row.id === 'material:cp')?.equation).toMatchObject({ bridgeLatex: '\\Longleftrightarrow', lhsLatex: 'c_p', rhsLatex: '\\boxed{c_p=\\kappa c_v}' })
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
})

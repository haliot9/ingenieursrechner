import { describe, expect, it } from 'vitest'
import { FormulaRegistry } from '../../../src/core/formula-registry'
import { solve } from '../../../src/core/solver'
import { compileSolveDirections } from '../../../src/core/solve-directions'
import type { VariableState } from '../../../src/core/types'
import { composeJouleCalculationStory } from '../../../src/modules/joule/calculation-story'
import { JOULE_STORY_FAMILIES, JOULE_STORY_RECIPES } from '../../../src/modules/joule/calculation-story-recipes'
import { ALL_VARIABLES, JOULE_DIRECTION_POLICIES } from '../../../src/modules/joule/config'
import { JOULE_FORMULAS } from '../../../src/modules/joule/formulas'
import { jouleModule } from '../../../src/modules/joule'

function input(value: number, unit = ''): VariableState {
  return { value, unit, isUserInput: true, isComputed: false }
}

function referenceResult() {
  return solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, {
    T1: input(300, 'K'), p1: input(100_000, 'Pa'), pressureRatio: input(10),
    T3: input(1400, 'K'), kappa: input(1.4), Rs: input(287, 'J/(kg*K)'),
  }, [], { plannedExecution: jouleModule.plannedExecution })
}

const familyIds = [
  'material-properties', 'ideal-gas-state', 'relative-entropy', 'pressure-ratio',
  'isobaric-pressure', 'isentropic-temperature', 'isentropic-entropy', 'component-work',
  'net-work', 'isobaric-heat', 'ideal-efficiency', 'performance-ratios',
]

describe('full Joule calculation-story contract', () => {
  it('reconciles an explicit independent 12-family authority to the live direction inventory', () => {
    const directions = compileSolveDirections(JOULE_FORMULAS, ALL_VARIABLES.map(variable => variable.id), JOULE_DIRECTION_POLICIES)
    const deriveIds = directions.filter(direction => direction.mode === 'derive').map(direction => direction.id).sort()
    const validateIds = directions.filter(direction => direction.mode === 'validate-only').map(direction => direction.id).sort()

    expect(directions).toHaveLength(48)
    expect(deriveIds).toHaveLength(44)
    expect(validateIds).toEqual(['ideal_gas_1:Rs', 'ideal_gas_2:Rs', 'ideal_gas_3:Rs', 'ideal_gas_4:Rs'])
    expect(JOULE_STORY_FAMILIES.map(family => family.id)).toEqual(familyIds)
    expect(Object.keys(JOULE_STORY_RECIPES).sort()).toEqual(deriveIds)
    expect(Object.values(JOULE_STORY_RECIPES).every(recipe => recipe.familyId && recipe.entryPointLatex && recipe.transitions.length > 0)).toBe(true)
    expect(Object.keys(JOULE_STORY_RECIPES)).not.toContain('ideal_gas_1:Rs')
  })

  it('consumes the full reference primary route in eight Golden sections with family-specific bridge rows', () => {
    const result = referenceResult()
    const story = composeJouleCalculationStory({ plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables })

    expect(story.mode).toBe('complete')
    if (story.mode !== 'complete') throw new Error('expected full story')
    const primaryIds = [...result.plan!.primaryByTarget.values()].map(direction => direction.directionId).sort()
    const consumed = story.story.consumedSteps.map(step => step.directionId).sort()
    expect(consumed).toEqual(primaryIds)
    expect(consumed).toHaveLength(22)
    expect(new Set(consumed).size).toBe(consumed.length)
    expect(story.story.unconsumedPrimarySteps).toEqual([])
    expect(story.story.sections.map(section => section.id)).toEqual([
      'material-properties', 'reusable-thermodynamic-relations', 'state-1', 'compression-1-2',
      'heat-input-2-3', 'expansion-3-4', 'heat-rejection-4-1', 'cycle-balance-performance',
    ])
    expect(story.story.rows.some(row => row.equationLatex === 'ds = c_p \\frac{dT}{T} - R_s \\frac{dp}{p}')).toBe(true)
    expect(story.story.rows.some(row => row.equationLatex === 'w_{comp} = h_2 - h_1')).toBe(true)
    expect(story.story.rows.some(row => row.equationLatex === 'q_{in} = h_3 - h_2')).toBe(true)
    expect(story.story.rows.some(row => row.operation?.latex.includes('p_2/p_1=r_p'))).toBe(true)
    expect(story.story.rows.some(row => row.operation?.latex.includes('raise both sides'))).toBe(false)
    expect(story.story.rows.some(row => row.rowRole === 'check')).toBe(true)
    expect(story.story.rows.filter(row => row.rowRole === 'numeric').every(row => row.equation?.lhsLatex === undefined)).toBe(true)
    expect(story.story.rows.some(row => row.equation?.bridgeLatex === '\\Longleftrightarrow')).toBe(true)
    expect(story.story.rows.some(row => row.operation?.latex.startsWith('\\xrightarrow'))).toBe(true)
    expect(story.story.rows.some(row => row.note === 'Aus der registrierten, ausgewählten Richtung.')).toBe(false)
    expect(story.story.sections.map(section => section.title)).toEqual([
      'Stoffeigenschaften', 'Wiederverwendbare thermodynamische Beziehungen', 'Zustand 1', '1 → 2 Isentrope Verdichtung',
      '2 → 3 Isobare Wärmezufuhr', '3 → 4 Isentrope Expansion', '4 → 1 Isobare Wärmeabfuhr', 'Kreisprozessbilanz und Kennzahlen',
    ])
    const directDirections = ['entropy_abs_1:s1', 'high_pressure_isobar:p3', 'compressor_work:w_comp', 'net_work:w_netto', 'heat_input:q_in', 'ideal_efficiency:eta', 'efficiency:eta']
    expect(story.story.rows.filter(row => directDirections.some(directionId => row.id === `${directionId}:result`))).toEqual([])
    const normalize = (latex: string) => latex.replace(/\s+/g, '')
    for (let index = 1; index < story.story.rows.length; index += 1) {
      const previous = story.story.rows[index - 1]
      const current = story.story.rows[index]
      if (previous.rowRole !== 'check' && current.rowRole !== 'check') expect(normalize(previous.equationLatex)).not.toBe(normalize(current.equationLatex))
    }
    expect(story.story.rows.map(row => row.equationLatex)).toEqual(expect.arrayContaining([
      'w_{comp} = h_2 - h_1', 'w_{turb} = h_4 - h_3', 'q_{in} = h_3 - h_2', 'q_{out} = h_1 - h_4',
      'p_3 = p_2', 'p_4 = p_1', '\\frac{T_2}{T_1} = \\left(\\frac{p_2}{p_1}\\right)^a', '\\frac{T_4}{T_3} = \\left(\\frac{p_4}{p_3}\\right)^a',
      '\\eta = \\frac{-w_{netto}}{q_{in}}', 'BWR = \\frac{w_{comp}}{-w_{turb}}',
    ]))
  })
})

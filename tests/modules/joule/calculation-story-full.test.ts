import { describe, expect, it } from 'vitest'
import { FormulaRegistry } from '../../../src/core/formula-registry'
import { solve } from '../../../src/core/solver'
import type { VariableState } from '../../../src/core/types'
import { jouleModule } from '../../../src/modules/joule'
import { composeJouleCalculationStory, formatStoryNumberLatex } from '../../../src/modules/joule/calculation-story'
import { JOULE_STORY_FAMILIES, JOULE_STORY_RECIPES } from '../../../src/modules/joule/calculation-story-recipes'
import { compileSolveDirections } from '../../../src/core/solve-directions'
import { JOULE_DIRECTION_POLICIES, ALL_VARIABLES } from '../../../src/modules/joule/config'
import { JOULE_FORMULAS } from '../../../src/modules/joule/formulas'

function input(value: number, unit = ''): VariableState {
  return { value, unit, isUserInput: true, isComputed: false }
}

function referenceStory(overrides: Partial<Record<string, VariableState>> = {}) {
  const result = solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, {
    T1: input(300, 'K'),
    p1: input(100_000, 'Pa'),
    pressureRatio: input(10),
    T3: input(1400, 'K'),
    kappa: input(1.4),
    Rs: input(287, 'J/(kg*K)'),
    ...overrides,
  }, [], { plannedExecution: jouleModule.plannedExecution })
  const composed = composeJouleCalculationStory({
    plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables,
  })
  if (composed.mode !== 'complete') throw new Error('expected complete story')
  return { result, story: composed.story }
}

describe('full Joule calculation-story authority', () => {
  it('reconciles the finite presentation authority with exactly 44 derive and four validate-only directions', () => {
    const directions = compileSolveDirections(JOULE_FORMULAS, ALL_VARIABLES.map(variable => variable.id), JOULE_DIRECTION_POLICIES)
    const derive = directions.filter(direction => direction.mode === 'derive').map(direction => direction.id).sort()
    expect(directions).toHaveLength(48)
    expect(derive).toHaveLength(44)
    expect(directions.filter(direction => direction.mode === 'validate-only').map(direction => direction.id).sort()).toEqual(['ideal_gas_1:Rs', 'ideal_gas_2:Rs', 'ideal_gas_3:Rs', 'ideal_gas_4:Rs'])
    expect(JOULE_STORY_FAMILIES).toHaveLength(12)
    expect(Object.keys(JOULE_STORY_RECIPES).sort()).toEqual(derive)
  })

  it('composes the frozen seven-section human-reference route with exactly 62 rows in target order', () => {
    const { story } = referenceStory()
    expect(story.sections?.map(section => section.title)).toEqual([
      'Stoffeigenschaften',
      'Zustand 1',
      '1 → 2 · isentrope Verdichtung',
      '2 → 3 · isobare Wärmezufuhr',
      '3 → 4 · isentrope Expansion',
      'Energiepfad',
      'Kreisbilanz und Kennwerte',
    ])
    expect(story.rows).toHaveLength(62)
    expect(story.sections?.every(section => section.tier === 'main')).toBe(true)
  })

  it('attaches the 26 proof/support blocks to their consumers with the frozen initial disclosure state', () => {
    const { story } = referenceStory()
    const supportedRows = story.rows.filter(row => row.support)
    expect(supportedRows).toHaveLength(26)
    expect(supportedRows.filter(row => row.support?.defaultOpen !== false)).toHaveLength(25)
    expect(new Set(supportedRows.map(row => row.id)).size).toBe(26)
    expect(supportedRows.every(row => row.support && row.support.rows.length > 0)).toBe(true)
  })

  it('models formula-local outline and ready facts without learner-facing implementation telemetry', () => {
    const { story } = referenceStory()
    const boxed = story.rows.filter(row => row.box)
    expect(boxed.filter(row => String(row.box) === 'outline')).toHaveLength(5)
    expect(boxed.filter(row => String(row.box) === 'ready')).toHaveLength(22)
    expect(story.rows.filter(row => row.rowRole === 'continuation' || row.rowRole === 'numeric').every(row => !row.equation?.lhsLatex)).toBe(true)
    const learnerText = story.rows.flatMap(row => [row.note ?? '', row.label ?? '', row.operation && typeof row.operation !== 'string' ? row.operation.latex : '']).join('\n')
    expect(learnerText).not.toMatch(/Zustand vollständig|Solverwert|Werte mit Einheiten eingesetzt|Numerisches Ergebnis|Bereits hergeleitete|Formel angewendet/i)
  })

  it('keeps the required entropy, energy, unit, condition, and signed-result grammar at their approved path locations', () => {
    const { story } = referenceStory()
    const section = (id: string) => story.sections?.find(candidate => candidate.id === id)?.rows ?? []
    const equations = (id: string) => section(id).flatMap(row => [row, ...(row.support?.rows ?? [])]).map(row => row.equationLatex).join('\n')
    expect(equations('compression-1-2')).toContain('s_2-s_1=0')
    expect(equations('compression-1-2')).toContain('\\frac{T_2}{T_1}')
    expect(equations('energy-path')).toContain('\\frac{dE_{CV}}{dt}')
    expect(equations('energy-path')).toContain('q_{ij}+w_{t,ij}=h_j-h_i')
    expect(equations('energy-path')).toContain('dh=c_p\\,dT')
    expect(equations('energy-path')).toContain('\\Delta e_{kin}')
    expect(equations('cycle-balance-performance')).toContain('w_{netto}=w_{comp}+w_{turb}')
    expect(equations('cycle-balance-performance')).toContain('BWR=')
    const byId = (id: string) => story.rows.find(row => row.id === id)
    expect(byId('energy:wcomp')?.operation).toBe('q_{12}=0')
    expect(byId('energy:wturb')?.operation).toBe('q_{34}=0')
    expect(byId('energy:qin')?.operation).toBe('w_{t,23}=0')
    expect(byId('energy:qout')?.operation).toBe('w_{t,41}=0')
    expect(story.rows.some(row => row.operation && typeof row.operation !== 'string' && row.operation.kind === 'isolate')).toBe(true)
    expect(story.rows.some(row => row.operation && typeof row.operation !== 'string' && row.operation.kind === 'substitute')).toBe(true)
  })

  it('takes displayed reference and altered-case values from the live solver result rather than copied reference literals', () => {
    const baseline = referenceStory()
    const altered = referenceStory({ T3: input(1500, 'K') })
    const rhs = (id: string) => baseline.story.rows.find(row => row.id === id)?.equation?.rhsLatex ?? ''
    const shown = (id: string, divisor = 1) => formatStoryNumberLatex((baseline.result.values[id]?.value ?? NaN) / divisor)
    const baselineHeat = rhs('energy:qin:numeric')
    const alteredHeat = altered.story.rows.find(row => row.id === 'energy:qin:numeric')?.equation?.rhsLatex
    expect(rhs('energy:wcomp:numeric')).toContain(shown('cp', 1000))
    expect(rhs('energy:wcomp:numeric')).toContain(shown('T2'))
    expect(rhs('energy:wcomp:numeric')).toContain(shown('T1'))
    expect(rhs('energy:wturb:numeric')).toContain(shown('T4'))
    expect(rhs('energy:wturb:numeric')).toContain(shown('T3'))
    expect(baselineHeat).toContain(shown('cp', 1000))
    expect(baselineHeat).toContain(shown('T3'))
    expect(baselineHeat).toContain(shown('T2'))
    expect(rhs('energy:qout:numeric')).toContain(shown('T1'))
    expect(rhs('energy:qout:numeric')).toContain(shown('T4'))
    expect(rhs('cycle:netto-numeric')).toContain(shown('w_comp', 1000))
    expect(rhs('cycle:netto-numeric')).toContain(shown('w_turb', 1000))
    expect(rhs('cycle:eta-numeric')).toContain(shown('w_netto', 1000))
    expect(rhs('cycle:eta-numeric')).toContain(shown('q_in', 1000))
    expect(rhs('cycle:bwr-numeric')).toContain(shown('w_comp', 1000))
    expect(rhs('cycle:bwr-numeric')).toContain(shown('w_turb', 1000))
    expect(baselineHeat).toContain(formatStoryNumberLatex((baseline.result.values.q_in?.value ?? NaN) / 1000))
    expect(alteredHeat).toContain(formatStoryNumberLatex((altered.result.values.q_in?.value ?? NaN) / 1000))
    expect(alteredHeat).not.toBe(baselineHeat)
    expect(altered.story.sections?.map(section => section.title)).toEqual(baseline.story.sections?.map(section => section.title))
  })
})

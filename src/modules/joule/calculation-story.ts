import { numberToLatex } from '../../utils/latex'
import type { CalculationStoryCompositionInput, CalculationStoryConsumedStep, CalculationStoryRow, CalculationStoryState, StoryOperationKind } from '../../core/calculation-story'
import { JOULE_STORY_RECIPES, type JouleStoryRecipe } from './calculation-story-recipes'

const SECTION_ORDER = [
  ['material-properties', 'Material properties'],
  ['reusable-thermodynamic-relations', 'Reusable thermodynamic relations'],
  ['state-1', 'State 1'],
  ['compression-1-2', '1 → 2 Isentropic compression'],
  ['heat-input-2-3', '2 → 3 Isobaric heat input'],
  ['expansion-3-4', '3 → 4 Isentropic expansion'],
  ['heat-rejection-4-1', '4 → 1 Isobaric heat rejection'],
  ['cycle-balance-performance', 'Cycle balance and performance'],
] as const

type SectionId = typeof SECTION_ORDER[number][0]

function latexFor(input: CalculationStoryCompositionInput, id: string): string {
  return input.variables.find(variable => variable.id === id)?.latex ?? id
}

function numeric(input: CalculationStoryCompositionInput, id: string): string {
  const state = input.values[id]
  const variable = input.variables.find(candidate => candidate.id === id)
  if (!state || state.value === null || !Number.isFinite(state.value)) throw new Error(`missing accepted ${id} value`)
  return numberToLatex(state.value, variable?.defaultUnit)
}

function equation(latex: string, continuation = false) {
  const [lhs, ...right] = latex.split('=')
  return { lhsLatex: continuation ? undefined : lhs.trim(), relationLatex: '=', rhsLatex: right.join('=').trim() || latex.trim() }
}

function operation(kind: StoryOperationKind, prose: string, math = '') {
  return { kind, latex: `\\xrightarrow{\\text{${prose}}${math}}` }
}

function row(id: string, kind: CalculationStoryRow['kind'], rowRole: NonNullable<CalculationStoryRow['rowRole']>, equationLatex: string, options: Partial<CalculationStoryRow> = {}): CalculationStoryRow {
  return { id, kind, rowRole, chainId: id.split(':')[0], equationLatex, equation: equation(equationLatex, rowRole === 'continuation' || rowRole === 'numeric'), ...options }
}

function consumed(directionId: string): CalculationStoryConsumedStep {
  const [formulaId, targetVariable] = directionId.split(':')
  return { formulaId, targetVariable, directionId }
}

function stepFor(input: CalculationStoryCompositionInput, directionId: string) {
  const step = input.steps.find(candidate => `${candidate.formulaId}:${candidate.targetVariable}` === directionId)
  if (!step) throw new Error(`missing recipe evidence for ${directionId}`)
  return step
}

function targetRow(input: CalculationStoryCompositionInput, directionId: string, operationValue: ReturnType<typeof operation> | undefined, note: string, latex?: string): CalculationStoryRow[] {
  const step = stepFor(input, directionId)
  const target = step.targetVariable
  const resolved = latex ?? step.rearrangedLatex
  return [
    row(`${directionId}:result`, 'result', 'subject-change', resolved, { equation: { ...equation(resolved), bridgeLatex: '\\Longleftrightarrow' }, operation: operationValue, state: 'reachable', note }),
    row(`${directionId}:numeric`, 'numeric', 'numeric', `= ${numeric(input, target)}`, { equation: { relationLatex: '=', rhsLatex: numeric(input, target) }, note: 'Accepted solver value.' }),
  ]
}

function sectionFor(directionId: string, recipe: JouleStoryRecipe): SectionId {
  if (directionId.startsWith('ideal_gas_1') || directionId === 'entropy_abs_1:s1') return 'state-1'
  if (directionId.startsWith('ideal_gas_2') || directionId.startsWith('isentropic_entropy_12') || directionId.startsWith('compressor_') || directionId === 'pressure_ratio:p2' || directionId === 'pressure_ratio:p1' || directionId === 'pressure_ratio:pressureRatio') return 'compression-1-2'
  if (directionId.startsWith('ideal_gas_3') || directionId === 'entropy_abs_3:s3' || directionId.startsWith('high_pressure_isobar') || directionId.startsWith('heat_input')) return 'heat-input-2-3'
  if (directionId.startsWith('isentropic_entropy_34') || directionId.startsWith('turbine_') || directionId === 'entropy_abs_4:s4' || directionId.startsWith('low_pressure_isobar')) return 'expansion-3-4'
  if (directionId.startsWith('ideal_gas_4') || directionId.startsWith('heat_rejection')) return 'heat-rejection-4-1'
  return recipe.sectionId as SectionId
}

function materialRows(input: CalculationStoryCompositionInput, selected: Set<string>): CalculationStoryRow[] {
  if (!selected.has('cv_from_Rs_kappa:cv') && !selected.has('cp_from_kappa_cv:cp')) return []
  const cp = latexFor(input, 'cp'); const cv = latexFor(input, 'cv'); const rs = latexFor(input, 'Rs'); const kappa = latexFor(input, 'kappa')
  const rows: CalculationStoryRow[] = []
  if (selected.has('cv_from_Rs_kappa:cv')) rows.push(
    row('material:kappa', 'governing', 'start', `${kappa} = \\frac{${cp}}{${cv}}`, { note: 'Approved material-property relation.' }),
    row('material:cp', 'result', 'subject-change', `${cp} = ${kappa} ${cv}`, { equation: { bridgeLatex: '\\Longleftrightarrow', lhsLatex: cp, relationLatex: '=', rhsLatex: `${kappa} ${cv}` }, note: 'Reusable equivalent relation.' }),
    row('material:rs', 'governing', 'start', `${rs} = ${cp} - ${cv}`, { note: 'Second approved material-property relation.' }),
    row('material:substitute-cp', 'transform', 'continuation', `${rs} = ${kappa} ${cv} - ${cv}`, { operation: operation('substitute', 'substitute ', cp) }),
    row('material:factor', 'transform', 'continuation', `${rs} = ${cv}(${kappa} - 1)`, { operation: operation('factor', 'factor ', cv) }),
    row('material:cv-resolved', 'result', 'subject-change', `${cv} = \\frac{${rs}}{${kappa}-1}`, { equation: { bridgeLatex: '\\Longleftrightarrow', lhsLatex: cv, relationLatex: '=', rhsLatex: `\\frac{${rs}}{${kappa}-1}` }, operation: operation('divide', 'divide by ', `${kappa}-1`), note: `${kappa} \\ne 1`, state: 'reachable' }),
    row('material:cv-numeric', 'numeric', 'numeric', `= ${numeric(input, 'cv')}`, { equation: { relationLatex: '=', rhsLatex: numeric(input, 'cv') }, note: 'Accepted solver value.' }),
  )
  if (selected.has('cp_from_kappa_cv:cp')) rows.push(
    row('material:cp-reuse', 'reuse', 'reuse', `${cp} = ${kappa} ${cv}`, { operation: operation('reuse', 'reuse ', cv), note: 'Reuse the proven material relation.' }),
    row('material:cp-numeric', 'numeric', 'numeric', `= ${numeric(input, 'cp')}`, { equation: { relationLatex: '=', rhsLatex: numeric(input, 'cp') }, note: 'Accepted solver value.' }),
  )
  return rows
}

function familyRows(input: CalculationStoryCompositionInput, directionId: string, shared: Set<string>): CalculationStoryRow[] {
  const recipe = JOULE_STORY_RECIPES[directionId]
  if (!recipe) throw new Error(`missing explicit family authority for ${directionId}`)
  const target = directionId.split(':')[1]
  const state = directionId.match(/_(\d):/)?.[1]
  switch (recipe.familyId) {
    case 'ideal-gas-state': {
      if (!shared.has('ideal-gas')) shared.add('ideal-gas')
      const p = `p_${state}`; const v = `v_${state}`; const t = `T_${state}`
      const result = target === `p${state}` ? `${p} = \\frac{R_s ${t}}{${v}}` : target === `v${state}` ? `${v} = \\frac{R_s ${t}}{${p}}` : `${t} = \\frac{${p}${v}}{R_s}`
      const op = target === `p${state}` ? operation('divide', 'divide by ', v) : target === `v${state}` ? operation('divide', 'divide by ', p) : operation('divide', 'divide by ', 'R_s')
      return [row(`${directionId}:reuse`, 'reuse', 'reuse', `${p}${v} = R_s${t}`, { operation: operation('reuse', 'apply state ', state!), note: 'Reuse the ideal-gas state relation.' }), ...targetRow(input, directionId, op, 'Target-specific ideal-gas isolation.', result)]
    }
    case 'relative-entropy': {
      const s = `s_${state}`; const t = `T_${state}`; const p = `p_${state}`
      return [row(`${directionId}:entropy`, 'reuse', 'reuse', `${s} = c_p \\ln\\left(\\frac{${t}}{273.15}\\right)-R_s\\ln\\left(\\frac{${p}}{101325}\\right)`, { operation: operation('reuse', 'reuse entropy datum for state ', state!), note: 'Repository-relative entropy datum.' }), ...targetRow(input, directionId, undefined, 'Selected relative-entropy direction.')]
    }
    case 'pressure-ratio': {
      const result = target === 'p2' ? 'p_2 = p_1 r_p' : target === 'p1' ? 'p_1 = \\frac{p_2}{r_p}' : 'r_p = \\frac{p_2}{p_1}'
      const op = target === 'p2' ? operation('multiply', 'multiply by ', 'p_1') : target === 'p1' ? operation('divide', 'divide by ', 'r_p') : undefined
      return [row(`${directionId}:definition`, 'governing', 'start', 'r_p = \\frac{p_2}{p_1}', { note: 'Definition of the pressure ratio.' }), ...targetRow(input, directionId, op, 'Target-specific pressure-ratio relation.', result)]
    }
    case 'isobaric-pressure': {
      const high = directionId.startsWith('high_'); const left = high ? 'p_3' : 'p_4'; const right = high ? 'p_2' : 'p_1'
      return [row(`${directionId}:condition`, 'governing', 'start', `${left} = ${right}`, { note: high ? 'Isobaric heat addition: dp=0.' : 'Isobaric heat rejection: dp=0.' }), ...targetRow(input, directionId, operation('equate', 'apply isobaric equality'), 'Process condition in the selected direction.', target === left.replace('_', '') ? `${left} = ${right}` : `${right} = ${left}`)]
    }
    case 'isentropic-temperature': {
      const compression = directionId.startsWith('compressor_')
      const governing = compression ? '\\frac{T_2}{T_1} = \\left(\\frac{p_2}{p_1}\\right)^a' : '\\frac{T_4}{T_3} = \\left(\\frac{p_4}{p_3}\\right)^a'
      const substituted = compression ? '= r_p^a' : '= \\left(\\frac{1}{r_p}\\right)^a'
      const result = compression ? 'T_2 = T_1 r_p^a' : 'T_4 = \\frac{T_3}{r_p^a}'
      return [row(`${directionId}:governing`, 'governing', 'start', governing, { note: 'Ideal-gas isentropic temperature relation; a=(κ-1)/κ.' }), row(`${directionId}:ratio`, 'transform', 'continuation', substituted, { equation: { relationLatex: '=', rhsLatex: substituted.slice(1) }, operation: operation('substitute', 'substitute ', compression ? 'p_2/p_1=r_p' : 'p_4/p_3=1/r_p') }), ...targetRow(input, directionId, operation('multiply', 'multiply by ', compression ? 'T_1' : 'T_3'), 'Selected isentropic-temperature direction.', result)]
    }
    case 'isentropic-entropy': {
      const pair = directionId.includes('_12') ? ['s_2', 's_1'] : ['s_4', 's_3']; const result = target === pair[0].replace('_', '') ? `${pair[0]} = ${pair[1]}` : `${pair[1]} = ${pair[0]}`
      return [row(`${directionId}:ds`, 'governing', 'start', 'ds = 0', { note: 'Internally reversible adiabatic process.' }), row(`${directionId}:integral`, 'transform', 'continuation', `${pair[0]}-${pair[1]} = 0`, { operation: operation('integrate', 'integrate inlet to outlet') }), ...targetRow(input, directionId, operation('equate', 'apply isentropic equality'), 'Selected isentropic-entropy direction.', result)]
    }
    case 'component-work': {
      const comp = directionId.startsWith('compressor_'); const work = comp ? 'w_{comp}' : 'w_{turb}'; const h = comp ? 'h_2 - h_1' : 'h_4 - h_3'; const temp = comp ? 'c_p(T_2-T_1)' : 'c_p(T_4-T_3)'
      return [row(`${directionId}:enthalpy`, 'governing', 'start', `${work} = ${h}`, { note: 'Adiabatic steady-flow component; repository sign convention.' }), row(`${directionId}:cp`, 'transform', 'continuation', `= ${temp}`, { equation: { relationLatex: '=', rhsLatex: temp }, operation: operation('substitute', 'use ', 'dh=c_p\\,dT') }), ...targetRow(input, directionId, undefined, 'Selected component-work direction.', `${work} = ${temp}`)]
    }
    case 'net-work': return [row(`${directionId}:governing`, 'governing', 'start', 'w_{netto} = w_{comp}+w_{turb}', { note: 'Signed cycle-work sum.' }), ...targetRow(input, directionId, undefined, 'Selected net-work direction.'), row(`${directionId}:check`, 'reuse', 'check', 'w_{netto}+(q_{in}+q_{out}) \\approx 0', { operation: operation('reuse', 'cycle check'), note: 'Supporting energy-balance check.' })]
    case 'isobaric-heat': {
      const inputHeat = directionId.startsWith('heat_input'); const q = inputHeat ? 'q_{in}' : 'q_{out}'; const h = inputHeat ? 'h_3 - h_2' : 'h_1 - h_4'; const integral = inputHeat ? '\\int_{T_2}^{T_3}c_p\\,dT' : '\\int_{T_4}^{T_1}c_p\\,dT'; const compact = inputHeat ? 'c_p(T_3-T_2)' : 'c_p(T_1-T_4)'
      const result = target === (inputHeat ? 'q_in' : 'q_out') ? `${q} = ${compact}` : stepFor(input, directionId).rearrangedLatex
      const op = target.startsWith('T') ? operation(target === (inputHeat ? 'T3' : 'T1') ? 'multiply' : 'divide', target === (inputHeat ? 'T3' : 'T1') ? 'add target temperature relation' : 'subtract target temperature relation') : undefined
      return [row(`${directionId}:enthalpy`, 'governing', 'start', `${q} = ${h}`, { note: 'Isobaric heat relation under the declared model.' }), row(`${directionId}:integral`, 'transform', 'continuation', `= ${integral}`, { equation: { relationLatex: '=', rhsLatex: integral }, operation: operation('integrate', 'integrate ', inputHeat ? 'T_2\\to T_3' : 'T_4\\to T_1') }), row(`${directionId}:constant-cp`, 'transform', 'continuation', `= ${compact}`, { equation: { relationLatex: '=', rhsLatex: compact }, operation: operation('substitute', 'constant ', 'c_p') }), ...targetRow(input, directionId, op, 'Target-specific isobaric-heat direction.', result)]
    }
    case 'ideal-efficiency': {
      if (target === 'eta') return [row(`${directionId}:governing`, 'governing', 'start', '\\eta_{ideal} = 1-r_p^{-a}', { note: 'Bounded ideal Joule model; a=(κ-1)/κ.' }), ...targetRow(input, directionId, undefined, 'Selected ideal-efficiency direction.')]
      return [row(`${directionId}:governing`, 'governing', 'start', '\\eta_{ideal} = 1-r_p^{-a}', { note: 'Bounded ideal Joule model.' }), row(`${directionId}:subtract`, 'transform', 'subject-change', '1-\\eta_{ideal} = r_p^{-a}', { operation: operation('isolate', 'subtract from ', '1') }), row(`${directionId}:power`, 'transform', 'subject-change', 'r_p = (1-\\eta_{ideal})^{-1/a}', { equation: { bridgeLatex: '\\Longleftrightarrow', lhsLatex: 'r_p', relationLatex: '=', rhsLatex: '(1-\\eta_{ideal})^{-1/a}' }, operation: operation('exponentiate', 'raise both sides to ', '-1/a') }), ...targetRow(input, directionId, undefined, 'Selected inverse ideal-efficiency direction.', 'r_p = (1-\\eta_{ideal})^{-\\frac{\\kappa}{\\kappa-1}}')]
    }
    case 'performance-ratios': {
      const eta = directionId.startsWith('efficiency'); const lhs = eta ? '\\eta' : 'BWR'; const rhs = eta ? '\\frac{-w_{netto}}{q_{in}}' : '\\frac{w_{comp}}{-w_{turb}}'
      return [row(`${directionId}:definition`, 'governing', 'start', `${lhs} = ${rhs}`, { note: 'Explicit repository sign convention.' }), ...targetRow(input, directionId, operation('substitute', 'apply repository signs'), 'Selected performance-ratio direction.', `${lhs} = ${rhs}`)]
    }
  }
  throw new Error(`unhandled explicit family authority: ${recipe.familyId}`)
}

export function composeJouleCalculationStory(input: CalculationStoryCompositionInput): CalculationStoryState {
  if (!input.plan) return { mode: 'not-applicable' }
  const selected = [...input.plan.primaryByTarget.values()].map(direction => direction.directionId)
  if (selected.length === 0) return { mode: 'not-applicable' }
  const unsupported = selected.filter(directionId => !JOULE_STORY_RECIPES[directionId])
  if (unsupported.length) return { mode: 'unavailable', reason: `No approved calculation-story family exists for: ${unsupported.join(', ')}.` }
  if (selected.some(directionId => !input.steps.some(step => `${step.formulaId}:${step.targetVariable}` === directionId))) return { mode: 'unavailable', reason: 'Confirmed solver provenance is missing for at least one selected direction.' }
  try {
    const buckets = new Map<SectionId, CalculationStoryRow[]>(SECTION_ORDER.map(([id]) => [id, []]))
    const append = (id: SectionId, rows: CalculationStoryRow[]) => buckets.get(id)?.push(...rows)
    const selectedSet = new Set(selected)
    append('material-properties', materialRows(input, selectedSet))
    const hasIdeal = selected.some(id => JOULE_STORY_RECIPES[id].familyId === 'ideal-gas-state')
    const hasEntropy = selected.some(id => JOULE_STORY_RECIPES[id].familyId === 'relative-entropy')
    if (hasIdeal) append('reusable-thermodynamic-relations', [row('shared:ideal-gas', 'governing', 'start', 'p_i v_i = R_s T_i', { note: 'Approved ideal-gas state relation; target isolation depends on the selected state fact.' })])
    if (hasEntropy) append('reusable-thermodynamic-relations', [row('shared:entropy-differential', 'governing', 'start', 'ds = c_p \\frac{dT}{T} - R_s \\frac{dp}{p}', { note: 'Constant-property relative-entropy entry point.' }), row('shared:entropy-integral', 'transform', 'continuation', 's_i-s_{ref}=c_p\\ln\\left(\\frac{T_i}{T_{ref}}\\right)-R_s\\ln\\left(\\frac{p_i}{p_{ref}}\\right)', { operation: operation('integrate', 'integrate ', 'ref\\to i') }), row('shared:entropy-datum', 'result', 'subject-change', 's_i=c_p\\ln\\left(\\frac{T_i}{273.15}\\right)-R_s\\ln\\left(\\frac{p_i}{101325}\\right)', { equation: { bridgeLatex: '\\Longleftrightarrow', lhsLatex: 's_i', relationLatex: '=', rhsLatex: 'c_p\\ln\\left(\\frac{T_i}{273.15}\\right)-R_s\\ln\\left(\\frac{p_i}{101325}\\right)' }, note: 'Repository-relative datum; s_ref=0.' })])
    const shared = new Set<string>()
    for (const directionId of selected) {
      if (directionId === 'cv_from_Rs_kappa:cv' || directionId === 'cp_from_kappa_cv:cp') continue
      append(sectionFor(directionId, JOULE_STORY_RECIPES[directionId]), familyRows(input, directionId, shared))
    }
    const sections = SECTION_ORDER.map(([id, title]) => ({ id, title, rows: buckets.get(id) ?? [] }))
    return { mode: 'complete', story: { route: 'joule-selected-direction-composer', title: 'Joule-/Brayton-Rechengeschichte', rows: sections.flatMap(section => section.rows), sections, consumedSteps: selected.map(consumed), unconsumedPrimarySteps: [] } }
  } catch {
    return { mode: 'unavailable', reason: 'The selected Joule route could not be composed as an evidenced calculation story; accepted solver values remain unchanged.' }
  }
}

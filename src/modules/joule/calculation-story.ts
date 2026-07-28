import { numberToLatex } from '../../utils/latex'
import type { CalculationStoryAlternative, CalculationStoryCompositionInput, CalculationStoryConsumedStep, CalculationStoryRow, CalculationStorySection, CalculationStoryState, StoryOperationKind } from '../../core/calculation-story'
import { JOULE_STORY_RECIPES } from './calculation-story-recipes'

const SECTION_ORDER = [
  ['overview', 'Rechenüberblick', 'main'],
  ['material-properties', 'Stoffeigenschaften', 'foundation'],
  ['state-1', 'Zustand 1', 'main'],
  ['compression-1-2', '1 → 2 Isentrope Verdichtung', 'main'],
  ['heat-input-2-3', '2 → 3 Isobare Wärmezufuhr', 'main'],
  ['expansion-3-4', '3 → 4 Isentrope Expansion', 'main'],
  ['heat-rejection-4-1', '4 → 1 Isobare Wärmeabfuhr', 'main'],
  ['cycle-balance-performance', 'Kreisprozessbilanz und Kennzahlen', 'main'],
  ['optional-entropy', 'Optional: relativer Entropiebezug', 'optional'],
] as const

type SectionId = typeof SECTION_ORDER[number][0]

function latexFor(input: CalculationStoryCompositionInput, id: string): string { return input.variables.find(variable => variable.id === id)?.latex ?? id }
function unitLatex(unit: string): string {
  const units: Record<string, string> = {
    'J/(kg*K)': '\\frac{\\mathrm J}{\\mathrm{kg}\\,\\mathrm K}', 'J/kg': '\\frac{\\mathrm J}{\\mathrm{kg}}', 'm^3/kg': '\\frac{\\mathrm{m^3}}{\\mathrm{kg}}',
    K: '\\mathrm K', Pa: '\\mathrm{Pa}', bar: '\\mathrm{bar}', '': '',
  }
  return units[unit] ?? `\\mathrm{${unit}}`
}
function valueLatex(input: CalculationStoryCompositionInput, id: string): string {
  const state = input.values[id]; const variable = input.variables.find(candidate => candidate.id === id)
  if (!state || state.value === null || !Number.isFinite(state.value)) throw new Error(`missing accepted ${id} value`)
  const unit = unitLatex(variable?.defaultUnit ?? state.unit)
  return `${numberToLatex(state.value, '')}${unit ? `\\;${unit}` : ''}`
}
function equation(latex: string, continuation = false) { const [lhs, ...right] = latex.split('='); return { lhsLatex: continuation ? undefined : lhs.trim(), relationLatex: '=', rhsLatex: right.join('=').trim() || latex.trim() } }
function operation(kind: StoryOperationKind, latex: string) { return { kind, latex: `\\xrightarrow{\\text{${latex}}}` } }
function row(id: string, kind: CalculationStoryRow['kind'], rowRole: NonNullable<CalculationStoryRow['rowRole']>, equationLatex: string, options: Partial<CalculationStoryRow> = {}): CalculationStoryRow {
  return { id, kind, rowRole, chainId: id.split(':')[0], equationLatex, equation: equation(equationLatex, rowRole === 'continuation' || rowRole === 'numeric'), spacing: rowRole === 'subject-change' ? 'result' : rowRole === 'start' ? 'chain' : 'continuation', ...options }
}
function consumed(directionId: string): CalculationStoryConsumedStep { const [formulaId, targetVariable] = directionId.split(':'); return { formulaId, targetVariable, directionId } }
function stepFor(input: CalculationStoryCompositionInput, directionId: string) { const step = input.steps.find(candidate => `${candidate.formulaId}:${candidate.targetVariable}` === directionId); if (!step) throw new Error(`missing recipe evidence for ${directionId}`); return step }
function numericRow(input: CalculationStoryCompositionInput, directionId: string): CalculationStoryRow { return row(`${directionId}:numeric`, 'numeric', 'numeric', `= ${valueLatex(input, stepFor(input, directionId).targetVariable)}`, { equation: { relationLatex: '=', rhsLatex: valueLatex(input, stepFor(input, directionId).targetVariable) } }) }
function targetRow(input: CalculationStoryCompositionInput, directionId: string, latex: string, note?: string): CalculationStoryRow[] { return [row(`${directionId}:result`, 'result', 'subject-change', latex, { equation: { ...equation(latex), bridgeLatex: '\\Longleftrightarrow' }, state: 'reachable', note }), numericRow(input, directionId)] }
function sectionFor(directionId: string): SectionId {
  if (directionId.startsWith('ideal_gas_1')) return 'state-1'
  if (directionId.startsWith('ideal_gas_2') || directionId.startsWith('compressor_') || directionId.startsWith('isentropic_entropy_12') || directionId.startsWith('pressure_ratio')) return 'compression-1-2'
  if (directionId.startsWith('ideal_gas_3') || directionId.startsWith('high_pressure_isobar') || directionId.startsWith('heat_input')) return 'heat-input-2-3'
  if (directionId.startsWith('ideal_gas_4') || directionId.startsWith('turbine_') || directionId.startsWith('isentropic_entropy_34') || directionId.startsWith('low_pressure_isobar')) return 'expansion-3-4'
  if (directionId.startsWith('heat_rejection')) return 'heat-rejection-4-1'
  return 'cycle-balance-performance'
}

function materialRows(input: CalculationStoryCompositionInput, selected: Set<string>): CalculationStoryRow[] {
  if (!selected.has('cv_from_Rs_kappa:cv') && !selected.has('cp_from_kappa_cv:cp')) return []
  const cp = latexFor(input, 'cp'); const cv = latexFor(input, 'cv'); const rs = latexFor(input, 'Rs'); const kappa = latexFor(input, 'kappa')
  const rows: CalculationStoryRow[] = [row('material:memory', 'governing', 'start', `\\kappa=\\frac{${cp}}{${cv}}\\qquad\\cap\\qquad${rs}=${cp}-${cv}`, { note: 'Konstante Stoffwerte im idealen Gasmodell.' }), row('material:kappa', 'governing', 'start', `κ = \\frac{${cp}}{${cv}}`)]
  if (selected.has('cv_from_Rs_kappa:cv')) rows.push(
    row('material:cp', 'result', 'subject-change', `${cp}=\\boxed{${cp}=\\kappa ${cv}}`, { equation: { bridgeLatex: '\\Longleftrightarrow', lhsLatex: cp, relationLatex: '=', rhsLatex: `\\boxed{${cp}=\\kappa ${cv}}` }, note: 'Wiederverwendbare Stoffbeziehung.' }),
    row('material:rs', 'governing', 'start', `${rs} = ${cp} - ${cv}`),
    row('material:substitute-cp', 'transform', 'continuation', `=${kappa}${cv}-${cv}`),
    row('material:factor', 'transform', 'continuation', `=${cv}(\\kappa-1)`),
    row('material:cv-resolved', 'result', 'subject-change', `${cv}=\\boxed{\\frac{${rs}}{\\kappa-1}}`, { equation: { bridgeLatex: '\\Longleftrightarrow', lhsLatex: cv, relationLatex: '=', rhsLatex: `\\boxed{\\frac{${rs}}{\\kappa-1}}` }, state: 'reachable' }),
    row('material:cv-substitution', 'numeric', 'numeric', `=\\frac{${valueLatex(input, 'Rs')}}{${valueLatex(input, 'kappa')}-1}`, { equation: { relationLatex: '=', rhsLatex: `\\frac{${valueLatex(input, 'Rs')}}{${valueLatex(input, 'kappa')}-1}` } }),
    row('material:cv-numeric', 'numeric', 'numeric', `=${valueLatex(input, 'cv')}`, { equation: { relationLatex: '=', rhsLatex: valueLatex(input, 'cv') } }),
  )
  if (selected.has('cp_from_kappa_cv:cp')) rows.push(
    row('material:cp-reuse', 'reuse', 'reuse', `${cp}=\\boxed{${cp}=\\kappa ${cv}}`, { note: 'Die etablierte Stoffbeziehung wird erneut verwendet.' }),
    row('material:cp-substitution', 'numeric', 'numeric', `=${valueLatex(input, 'kappa')}\\cdot${valueLatex(input, 'cv')}`, { equation: { relationLatex: '=', rhsLatex: `${valueLatex(input, 'kappa')}\\cdot${valueLatex(input, 'cv')}` } }),
    row('cp_from_kappa_cv:cp:numeric', 'numeric', 'numeric', `=${valueLatex(input, 'cp')}`, { equation: { relationLatex: '=', rhsLatex: valueLatex(input, 'cp') } }),
  )
  return rows
}

function exponentFoundation(): CalculationStoryRow[] { return [
  row('shared:isentropic-entropy-change', 'governing', 'start', 's_2-s_1=c_p\\ln\\left(\\frac{T_2}{T_1}\\right)-R_s\\ln\\left(\\frac{p_2}{p_1}\\right)', { note: 'Relative Entropieänderung für ideales Gas mit konstanten Stoffwerten.' }),
  row('shared:isentropic-condition', 'governing', 'start', 's_2-s_1=0', { note: 'Reversibel adiabatisch bedeutet isentrop.' }),
  row('shared:isentropic-substitute', 'transform', 'continuation', '=c_p\\ln\\left(\\frac{T_2}{T_1}\\right)-R_s\\ln\\left(\\frac{p_2}{p_1}\\right)'),
  row('shared:isentropic-move-pressure', 'transform', 'continuation', 'c_p\\ln\\left(\\frac{T_2}{T_1}\\right)=R_s\\ln\\left(\\frac{p_2}{p_1}\\right)'),
  row('shared:isentropic-divide-cp', 'transform', 'continuation', '\\ln\\left(\\frac{T_2}{T_1}\\right)=\\frac{R_s}{c_p}\\ln\\left(\\frac{p_2}{p_1}\\right)'),
  row('shared:isentropic-property-start', 'transform', 'start', '\\frac{R_s}{c_p}=\\frac{c_p-c_v}{c_p}'),
  row('shared:isentropic-property-one', 'transform', 'continuation', '=1-\\frac{c_v}{c_p}'),
  row('shared:isentropic-property-two', 'transform', 'continuation', '=1-\\frac{1}{\\kappa}'),
  row('shared:isentropic-property-three', 'transform', 'continuation', '=\\frac{\\kappa-1}{\\kappa}'),
  row('shared:isentropic-exponent-definition', 'result', 'subject-change', 'a=\\boxed{\\frac{\\kappa-1}{\\kappa}}', { equation: { bridgeLatex: '\\Longleftrightarrow', lhsLatex: 'a', relationLatex: '=', rhsLatex: '\\boxed{\\frac{\\kappa-1}{\\kappa}}' }, note: 'a ist nur die Kurzschreibweise des isentropen Exponenten.' }),
  row('shared:isentropic-substitute-a', 'transform', 'continuation', '\\ln\\left(\\frac{T_2}{T_1}\\right)=a\\ln\\left(\\frac{p_2}{p_1}\\right)'),
  row('shared:isentropic-log-power', 'governing', 'start', 'a\\ln x=\\ln(x^a),\\quad x>0'),
  row('shared:isentropic-power', 'transform', 'continuation', '\\ln\\left(\\frac{T_2}{T_1}\\right)=\\ln\\left[\\left(\\frac{p_2}{p_1}\\right)^a\\right]'),
  row('shared:isentropic-exponentiate', 'transform', 'continuation', '\\frac{T_2}{T_1}=\\left(\\frac{p_2}{p_1}\\right)^a'),
] }
function entropyFoundation(): CalculationStoryRow[] {
  const sequence: Array<[string, string, CalculationStoryRow['kind'], StoryOperationKind?]> = [
    ['derivative', '\\frac{d}{dx}\\ln x=\\frac1x,\\quad x>0', 'governing'], ['antiderivative', '\\int\\frac1x\\,dx=\\ln x+C', 'governing'], ['differential', 'ds=c_p\\frac{dT}{T}-R_s\\frac{dp}{p}', 'governing'], ['integrate-both', '\\int_{s_{ref}}^{s_i}ds=\\int_{T_{ref}}^{T_i}c_p\\frac{dT}{T}-\\int_{p_{ref}}^{p_i}R_s\\frac{dp}{p}', 'transform', 'integrate'], ['left-bounds', 's_i-s_{ref}=\\int_{T_{ref}}^{T_i}c_p\\frac{dT}{T}-\\int_{p_{ref}}^{p_i}R_s\\frac{dp}{p}', 'transform'], ['pull-cp', '=c_p\\int_{T_{ref}}^{T_i}\\frac{dT}{T}-\\int_{p_{ref}}^{p_i}R_s\\frac{dp}{p}', 'transform'], ['pull-rs', '=c_p\\int_{T_{ref}}^{T_i}\\frac{dT}{T}-R_s\\int_{p_{ref}}^{p_i}\\frac{dp}{p}', 'transform'], ['primitive-temperature', '=c_p[\\ln T]_{T_{ref}}^{T_i}-R_s\\int_{p_{ref}}^{p_i}\\frac{dp}{p}', 'transform'], ['primitive-pressure', '=c_p[\\ln T]_{T_{ref}}^{T_i}-R_s[\\ln p]_{p_{ref}}^{p_i}', 'transform'], ['temperature-bounds', '=c_p(\\ln T_i-\\ln T_{ref})-R_s[\\ln p]_{p_{ref}}^{p_i}', 'transform'], ['pressure-bounds', '=c_p(\\ln T_i-\\ln T_{ref})-R_s(\\ln p_i-\\ln p_{ref})', 'transform'], ['log-quotient', '\\ln A-\\ln B=\\ln\\left(\\frac AB\\right),\\quad A>0, B>0', 'governing'], ['quotient-temperature', '=c_p\\ln\\left(\\frac{T_i}{T_{ref}}\\right)-R_s(\\ln p_i-\\ln p_{ref})', 'transform'], ['quotient-pressure', '=c_p\\ln\\left(\\frac{T_i}{T_{ref}}\\right)-R_s\\ln\\left(\\frac{p_i}{p_{ref}}\\right)', 'transform'], ['integrated', 's_i-s_{ref}=\\boxed{c_p\\ln\\left(\\frac{T_i}{T_{ref}}\\right)-R_s\\ln\\left(\\frac{p_i}{p_{ref}}\\right)}', 'result'], ['reference-temperature', 'T_{ref}:=273.15\\;\\mathrm K', 'governing'], ['reference-pressure', 'p_{ref}:=101325\\;\\mathrm{Pa}', 'governing'], ['reference-entropy', 's_{ref}:=0\\;\\frac{\\mathrm J}{\\mathrm{kg}\\,\\mathrm K}', 'governing'], ['substitute-reference-entropy', 's_i-0=c_p\\ln\\left(\\frac{T_i}{T_{ref}}\\right)-R_s\\ln\\left(\\frac{p_i}{p_{ref}}\\right)', 'transform'], ['simplify-left', 's_i=c_p\\ln\\left(\\frac{T_i}{T_{ref}}\\right)-R_s\\ln\\left(\\frac{p_i}{p_{ref}}\\right)', 'transform'], ['substitute-reference-temperature', '=c_p\\ln\\left(\\frac{T_i}{273.15\\;\\mathrm K}\\right)-R_s\\ln\\left(\\frac{p_i}{p_{ref}}\\right)', 'transform'], ['substitute-reference-pressure', '=c_p\\ln\\left(\\frac{T_i}{273.15\\;\\mathrm K}\\right)-R_s\\ln\\left(\\frac{p_i}{101325\\;\\mathrm{Pa}}\\right)', 'transform'], ['datum', 's_i=\\boxed{c_p\\ln\\left(\\frac{T_i}{273.15\\;\\mathrm K}\\right)-R_s\\ln\\left(\\frac{p_i}{101325\\;\\mathrm{Pa}}\\right)}', 'result'],
  ]
  return sequence.map(([id, latex, kind, op]) => row(`shared:entropy-${id}`, kind, latex.startsWith('=') ? 'continuation' : 'start', latex, { operation: op ? operation(op, 'integriere') : undefined, state: id === 'integrated' || id === 'datum' ? 'reachable' : undefined }))
}

function familyRows(input: CalculationStoryCompositionInput, directionId: string): CalculationStoryRow[] {
  const recipe = JOULE_STORY_RECIPES[directionId]; if (!recipe) throw new Error(`missing explicit family authority for ${directionId}`)
  const target = directionId.split(':')[1]
  switch (recipe.familyId) {
    case 'ideal-gas-state': { const state = directionId.match(/_(\\d):/)?.[1] ?? 'i'; const p = `p_${state}`; const v = `v_${state}`; const t = `T_${state}`; const result = target === `p${state}` ? `${p}=\\frac{R_s${t}}{${v}}` : target === `v${state}` ? `${v}=\\frac{R_s${t}}{${p}}` : `${t}=\\frac{${p}${v}}{R_s}`; return [row(`${directionId}:governing`, 'reuse', 'reuse', `${p}${v}=R_s${t}`, { note: 'Spezifische ideale Gasgleichung; v ist spezifisches Volumen.' }), ...targetRow(input, directionId, result)] }
    case 'pressure-ratio': { const result = target === 'p2' ? 'p_2=p_1r_p' : target === 'p1' ? 'p_1=\\frac{p_2}{r_p}' : 'r_p=\\frac{p_2}{p_1}'; return [row(`${directionId}:definition`, 'governing', 'start', 'r_p=\\frac{p_2}{p_1}', { note: 'Druckverhältnis.' }), ...targetRow(input, directionId, result)] }
    case 'isobaric-pressure': { const high = directionId.startsWith('high_'); const left = high ? 'p_3' : 'p_4'; const right = high ? 'p_2' : 'p_1'; const result = `${left}=${right}`; return [row(`${directionId}:condition`, 'governing', 'start', 'p=\\mathrm{const.}', { note: 'Isobare Prozessbedingung.' }), row(`${directionId}:dp`, 'transform', 'continuation', 'dp=0'), row(`${directionId}:result`, 'result', 'subject-change', result, { equation: { bridgeLatex: '\\Longrightarrow', lhsLatex: left, relationLatex: '=', rhsLatex: right }, state: 'reachable' }), numericRow(input, directionId)] }
    case 'isentropic-temperature': { const compression = directionId.startsWith('compressor_'); const governing = compression ? '\\frac{T_2}{T_1}=\\left(\\frac{p_2}{p_1}\\right)^a' : '\\frac{T_4}{T_3}=\\left(\\frac{p_4}{p_3}\\right)^a'; const ratio = compression ? '=r_p^a' : '=\\left(\\frac1{r_p}\\right)^a'; const result = compression ? 'T_2=T_1r_p^a' : 'T_4=\\frac{T_3}{r_p^a}'; return [row(`${directionId}:governing`, 'governing', 'start', governing, { note: 'Bewiesene isentrope Temperaturfamilie.' }), row(`${directionId}:ratio`, 'transform', 'continuation', ratio), ...targetRow(input, directionId, result)] }
    case 'isentropic-entropy': { const pair = directionId.includes('_12') ? ['s_2', 's_1'] : ['s_4', 's_3']; const result = `${pair[0]}=${pair[1]}`; return [row(`${directionId}:ds`, 'governing', 'start', 'ds=0', { note: 'Intern reversibel und adiabatisch.' }), row(`${directionId}:integral`, 'transform', 'subject-change', `${pair[0]}-${pair[1]}=0`, { equation: { bridgeLatex: '\\Longrightarrow', lhsLatex: `${pair[0]}-${pair[1]}`, relationLatex: '=', rhsLatex: '0' }, operation: operation('integrate', 'integriere Eintritt zu Austritt') }), ...targetRow(input, directionId, result)] }
    case 'component-work': { const comp = directionId.startsWith('compressor_'); const work = comp ? 'w_{comp}' : 'w_{turb}'; const h = comp ? 'h_2-h_1' : 'h_4-h_3'; const temp = comp ? 'c_p(T_2-T_1)' : 'c_p(T_4-T_3)'; if (comp) return [row(`${directionId}:conditions`, 'governing', 'start', 'q=0', { note: 'Stationär, adiabatisch, vernachlässigbare kinetische und potentielle Energie; konstantes c_p.' }), row(`${directionId}:enthalpy`, 'governing', 'start', `${work}=${h}`), row(`${directionId}:integral`, 'transform', 'continuation', `=\\int_{T_1}^{T_2}c_p\\,dT`), row(`${directionId}:constant-cp`, 'transform', 'continuation', '=c_p\\int_{T_1}^{T_2}dT'), row(`${directionId}:primitive`, 'transform', 'continuation', '=c_p[T]_{T_1}^{T_2}'), row(`${directionId}:family`, 'result', 'subject-change', `${work}=\\boxed{${temp}}>0`, { state: 'reachable' }), numericRow(input, directionId)]; return [row(`${directionId}:reuse`, 'reuse', 'reuse', `${work}=${temp}<0`, { note: 'Die etablierte stationäre Komponentenarbeitsfamilie wird wiederverwendet.' }), numericRow(input, directionId)] }
    case 'isobaric-heat': { const hot = directionId.startsWith('heat_input'); const q = hot ? 'q_{in}' : 'q_{out}'; const h = hot ? 'h_3-h_2' : 'h_1-h_4'; const integral = hot ? '\\int_{T_2}^{T_3}c_p\\,dT' : '\\int_{T_4}^{T_1}c_p\\,dT'; const temp = hot ? 'c_p(T_3-T_2)' : 'c_p(T_1-T_4)'; if (hot) return [row(`${directionId}:conditions`, 'governing', 'start', 'w_s=0', { note: 'Stationär, ein Ein- und Austritt, keine Wellenarbeit, vernachlässigbare kinetische und potentielle Energie; konstantes c_p.' }), row(`${directionId}:enthalpy`, 'governing', 'start', `${q}=${h}`), row(`${directionId}:integral`, 'transform', 'continuation', `=${integral}`), row(`${directionId}:constant-cp`, 'transform', 'continuation', `=c_p${integral.replace('c_p', '')}`), row(`${directionId}:primitive`, 'transform', 'continuation', '=c_p[T]_{T_2}^{T_3}'), row(`${directionId}:bounds`, 'transform', 'continuation', `=${temp}`), row(`${directionId}:family`, 'result', 'subject-change', `${q}=\\boxed{${temp}}`, { state: 'reachable' }), numericRow(input, directionId)]; const result = target === 'q_out' ? `${q}=${temp}` : target === 'T1' ? 'T_1=T_4+\\frac{q_{out}}{c_p}' : 'T_4=T_1-\\frac{q_{out}}{c_p}'; return [row(`${directionId}:reuse`, 'reuse', 'reuse', `${q}=${temp}<0`, { note: 'Die etablierte Wärmefamilie wird mit der Vorzeichenkonvention wiederverwendet.' }), ...(target === 'q_out' ? [numericRow(input, directionId)] : [row(`${directionId}:divide-cp`, 'transform', 'continuation', `\\frac{${q}}{c_p}=T_1-T_4`), ...targetRow(input, directionId, result)])] }
    case 'relative-entropy': { const state = directionId.match(/_(\\d):/)?.[1] ?? 'i'; return [row(`${directionId}:reuse`, 'reuse', 'reuse', `s_${state}=c_p\\ln\\left(\\frac{T_${state}}{273.15\\;\\mathrm K}\\right)-R_s\\ln\\left(\\frac{p_${state}}{101325\\;\\mathrm{Pa}}\\right)`, { note: 'Relativer Referenzwert, keine universelle absolute Entropie.' }), numericRow(input, directionId)] }
    case 'net-work': return [row(`${directionId}:governing`, 'governing', 'start', 'w_{netto}=w_{comp}+w_{turb}', { note: 'Vorzeichenbehaftete Kreisarbeitssumme.' }), numericRow(input, directionId), row(`${directionId}:check`, 'reuse', 'check', 'w_{netto}+(q_{in}+q_{out})\\approx0', { equation: { lhsLatex: 'w_{netto}+(q_{in}+q_{out})', relationLatex: '\\approx', rhsLatex: '0' }, note: 'Energiebilanzprüfung.' })]
    case 'ideal-efficiency': return [row(`${directionId}:governing`, 'governing', 'start', '\\eta_{ideal}=1-r_p^{-a}', { note: 'Begrenztes ideales Joule-Modell.' }), numericRow(input, directionId)]
    case 'performance-ratios': { const lhs = directionId.startsWith('efficiency') ? '\\eta' : 'BWR'; const rhs = directionId.startsWith('efficiency') ? '\\frac{-w_{netto}}{q_{in}}' : '\\frac{w_{comp}}{-w_{turb}}'; return [row(`${directionId}:definition`, 'governing', 'start', `${lhs}=${rhs}`, { note: 'Projektweite Vorzeichenkonvention.' }), numericRow(input, directionId)] }
  }
  throw new Error(`unhandled explicit family authority: ${recipe.familyId}`)
}

export function composeJouleCalculationStory(input: CalculationStoryCompositionInput): CalculationStoryState {
  if (!input.plan) return { mode: 'not-applicable' }
  const selected = [...input.plan.primaryByTarget.values()].map(direction => direction.directionId)
  if (selected.length === 0) return { mode: 'not-applicable' }
  const unsupported = selected.filter(directionId => !JOULE_STORY_RECIPES[directionId])
  if (unsupported.length || selected.some(directionId => !input.steps.some(step => `${step.formulaId}:${step.targetVariable}` === directionId))) return { mode: 'unavailable', reason: 'The selected Joule route could not be composed as evidenced calculation story.' }
  try {
    const buckets = new Map<SectionId, CalculationStoryRow[]>(SECTION_ORDER.map(([id]) => [id, []]))
    const append = (id: SectionId, rows: CalculationStoryRow[]) => buckets.get(id)?.push(...rows)
    const selectedSet = new Set(selected)
    append('material-properties', materialRows(input, selectedSet))
    if (selected.some(id => id.startsWith('ideal_gas_'))) append('state-1', [row('shared:ideal-gas', 'governing', 'start', 'p_iv_i=R_sT_i', { note: 'Spezifische ideale Gasgleichung; v ist nicht das Gesamtvolumen.' })])
    if (selected.some(id => id.startsWith('compressor_temperature') || id.startsWith('turbine_temperature'))) append('compression-1-2', exponentFoundation())
    for (const directionId of selected) if (JOULE_STORY_RECIPES[directionId].familyId !== 'material-properties') append(JOULE_STORY_RECIPES[directionId].familyId === 'relative-entropy' ? 'optional-entropy' : sectionFor(directionId), familyRows(input, directionId))
    for (const [sectionId, marker] of [['state-1', 'state-1:complete'], ['compression-1-2', 'state-2:complete'], ['heat-input-2-3', 'state-3:complete'], ['expansion-3-4', 'state-4:complete']] as const) append(sectionId, [row(marker, 'result', 'check', '\\text{Zustand vollständig}', { note: 'Die für diesen Zustand benötigten Größen sind im aktuellen Modul bestimmt.' })])
    if (selected.some(id => id.startsWith('entropy_abs_'))) append('optional-entropy', entropyFoundation().concat(buckets.get('optional-entropy') ?? []))
    const alternatives: CalculationStoryAlternative[] = [...input.plan.alternativesByTarget.entries()].flatMap(([target, candidates]) => candidates.map(candidate => ({ parentRowId: `${input.plan!.primaryByTarget.get(target)?.directionId}:numeric`, title: `Alternative Herleitung für ${target}`, rows: [row(`alternative:${candidate.directionId}`, 'reuse', 'reuse', JOULE_STORY_RECIPES[candidate.directionId]?.entryPointLatex ?? candidate.directionId, { note: 'Alternative, gleichwertig erreichbare Route.' })] })))
    const sections: CalculationStorySection[] = SECTION_ORDER.map(([id, title, tier]) => ({ id, title, tier, defaultOpen: tier !== 'optional', rows: buckets.get(id) ?? [] }))
    return { mode: 'complete', story: { route: 'joule-learning-story-v0.2', title: 'Joule-/Brayton-Rechengeschichte', overview: { model: 'Einfacher idealer stationärer Joule-/Brayton-Kreisprozess pro Masseneinheit.', givens: ['T_1', 'p_1', 'r_p', 'T_3', 'R_s', '\\kappa'], scope: 'Ideales Gas, konstante Stoffwerte; v ist spezifisches Volumen. Massenstrom, Gesamtleistung und instationäre Kolbenprozesse liegen außerhalb des Moduls.', signs: ['q_{in}>0', 'q_{out}<0', 'w_{comp}>0', 'w_{turb}<0', 'w_{netto}<0'], route: ['Stoffwerte', 'Zustand 1', '1→2', '2→3', '3→4', '4→1', 'Bilanz', 'optional'] }, rows: sections.flatMap(section => section.rows), sections, alternatives, consumedSteps: selected.map(consumed), unconsumedPrimarySteps: [] } }
  } catch { return { mode: 'unavailable', reason: 'The selected Joule route could not be composed as an evidenced calculation story; accepted solver values remain unchanged.' } }
}

import type {
  CalculationStoryCompositionInput,
  CalculationStoryConsumedStep,
  CalculationStoryRow,
  CalculationStorySection,
  CalculationStoryState,
  CalculationStorySupport,
  StoryEquation,
  StoryOperationKind,
  StoryRowRole,
  StorySupportRow,
} from '../../core/calculation-story'

const SECTION_TITLES = [
  ['material-properties', 'Stoffeigenschaften'],
  ['state-1', 'Zustand 1'],
  ['compression-1-2', '1 → 2 · isentrope Verdichtung'],
  ['heat-input-2-3', '2 → 3 · isobare Wärmezufuhr'],
  ['expansion-3-4', '3 → 4 · isentrope Expansion'],
  ['energy-path', 'Energiepfad'],
  ['cycle-balance-performance', 'Kreisbilanz und Kennwerte'],
] as const

type ArrowKind = 'operation' | 'equivalent' | 'implies'

export function formatStoryNumberLatex(value: number): string {
  if (!Number.isFinite(value)) return '\\text{undefined}'
  const rounded = Math.round(value * 1e10) / 1e10
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toPrecision(6).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '').replace('.', '{,}')
}

function equation(latex: string, role: StoryRowRole): StoryEquation {
  const equalsIndex = latex.indexOf('=')
  if (equalsIndex < 0) return { relationLatex: '', rhsLatex: latex }
  return {
    lhsLatex: role === 'continuation' || role === 'numeric' ? undefined : latex.slice(0, equalsIndex).trim(),
    relationLatex: '=',
    rhsLatex: latex.slice(equalsIndex + 1).trim(),
  }
}

function operation(kind: StoryOperationKind, label: string, arrow: ArrowKind = 'operation') {
  const command = arrow === 'equivalent' ? '\\xleftrightarrow' : arrow === 'implies' ? '\\xRightarrow' : '\\xrightarrow'
  const safeLabel = label.replaceAll('_', '\\_').replaceAll('Δ', 'delta').replaceAll('κ', 'kappa ').replaceAll('→', 'to')
  return { kind, latex: `${command}{\\text{${safeLabel}}}` }
}

function supportRow(id: string, equationLatex: string, role: StoryRowRole = 'start', op?: StorySupportRow['operation']): StorySupportRow {
  return { id, kind: 'governing', rowRole: role, equationLatex, equation: equation(equationLatex, role), operation: op, spacing: role === 'continuation' ? 'continuation' : 'nested' }
}

function support(id: string, title: string, kind: CalculationStorySupport['kind'], rows: readonly StorySupportRow[], defaultOpen = true): CalculationStorySupport {
  return { id, title, kind, rows, defaultOpen }
}

function row(
  id: string,
  equationLatex: string,
  role: StoryRowRole,
  options: Omit<Partial<CalculationStoryRow>, 'id' | 'equationLatex' | 'equation' | 'rowRole'> = {},
): CalculationStoryRow {
  return {
    id,
    kind: role === 'numeric' ? 'numeric' : role === 'reuse' ? 'reuse' : options.box ? 'result' : 'governing',
    rowRole: role,
    chainId: id.split(':')[0],
    equationLatex,
    equation: equation(equationLatex, role),
    spacing: role === 'subject-change' ? 'result' : role === 'start' ? 'chain' : 'continuation',
    ...options,
  }
}

function number(input: CalculationStoryCompositionInput, id: string): number {
  const value = input.values[id]?.value
  if (value === null || value === undefined || !Number.isFinite(value)) throw new Error(`missing live solver value: ${id}`)
  return value
}

function display(input: CalculationStoryCompositionInput, id: string): string {
  const value = number(input, id)
  if (id === 'pressureRatio' || id === 'kappa' || id === 'eta' || id === 'back_work_ratio') return formatStoryNumberLatex(value)
  if (id.startsWith('p')) return `${formatStoryNumberLatex(value / 1000)}\\;\\mathrm{kPa}`
  if (id === 'Rs' || id === 'cp' || id === 'cv' || id.startsWith('s')) return `${formatStoryNumberLatex(value / 1000)}\\;\\frac{\\mathrm{kJ}}{\\mathrm{kg}\\,\\mathrm K}`
  if (id.startsWith('q_') || id.startsWith('w_')) return `${formatStoryNumberLatex(value / 1000)}\\;\\frac{\\mathrm{kJ}}{\\mathrm{kg}}`
  if (id.startsWith('T')) return `${formatStoryNumberLatex(value)}\\;\\mathrm K`
  return formatStoryNumberLatex(value)
}

function consumed(input: CalculationStoryCompositionInput): CalculationStoryConsumedStep[] {
  return [...(input.plan?.primaryByTarget.values() ?? [])].map(step => {
    const [formulaId, targetVariable] = step.directionId.split(':')
    return { formulaId, targetVariable, directionId: step.directionId }
  })
}

function materialRows(input: CalculationStoryCompositionInput): CalculationStoryRow[] {
  const Rs = display(input, 'Rs'); const kappa = display(input, 'kappa'); const cv = display(input, 'cv'); const cp = display(input, 'cp')
  return [
    row('material:kappa', '\\kappa=\\frac{c_p}{c_v}', 'start', { support: support('material-relations', 'Grundlage · Beziehungen', 'foundation', [supportRow('material-relations-rs', 'R_s=c_p-c_v'), supportRow('material-relations-kappa', '\\kappa=\\frac{c_p}{c_v}')]) }),
    row('material:cp-outline', 'c_p=\\kappa c_v', 'subject-change', { box: 'outline', state: 'derived', operation: operation('isolate', 'solve for c_p', 'equivalent') }),
    row('material:rs', 'R_s=c_p-c_v', 'start'),
    row('material:substitute', '=\\kappa c_v-c_v', 'continuation', { operation: operation('substitute', 'substitute c_p with κc_v') }),
    row('material:factor', '=c_v(\\kappa-1)', 'continuation'),
    row('material:cv-ready', 'c_v=\\frac{R_s}{\\kappa-1}', 'subject-change', { box: 'ready', state: 'reachable' }),
    row('material:cv-numeric', `=\\frac{${Rs}}{${kappa}-1}=${cv}`, 'numeric'),
    row('material:cp-ready', 'c_p=\\kappa c_v', 'reuse', { box: 'ready', state: 'reachable', operation: operation('reuse', 'insert c_v'), support: support('material-cv-reuse', 'Reuse · c_v', 'reuse', [supportRow('material-cv-reuse-value', `c_v=${cv}`)]) }),
    row('material:cp-numeric', `=${kappa}\\cdot${cv}=${cp}`, 'numeric'),
  ]
}

function stateOneRows(input: CalculationStoryCompositionInput): CalculationStoryRow[] {
  const v1 = display(input, 'v1'); const s1 = display(input, 's1'); const Rs = display(input, 'Rs'); const T1 = display(input, 'T1'); const p1 = display(input, 'p1')
  return [
    row('state1:ideal-gas', 'p_1v_1=R_sT_1', 'start', { support: support('state1-ideal-gas', 'Grundlage · IGG', 'foundation', [supportRow('state1-igg-total', 'pV=mR_sT'), supportRow('state1-igg-substitute', 'p(mv)=mR_sT', 'subject-change', operation('substitute', 'substitute V with mv')), supportRow('state1-igg-specific', 'pv=R_sT', 'subject-change', operation('divide', 'divide by m', 'equivalent'))]) }),
    row('state1:v-ready', 'v_1=\\frac{R_sT_1}{p_1}', 'subject-change', { box: 'ready', state: 'reachable', operation: operation('isolate', 'solve for v_1', 'equivalent'), support: support('state1-units', 'Einheit · Einheit', 'unit', [supportRow('state1-joule', '1\\;\\mathrm J=1\\;\\mathrm N\\,\\mathrm m'), supportRow('state1-pascal', '1\\;\\mathrm{Pa}=\\frac{1\\;\\mathrm N}{\\mathrm{m^2}}'), supportRow('state1-unit-result', '\\frac{\\mathrm J}{\\mathrm{kg}\\,\\mathrm{Pa}}=\\frac{\\mathrm{m^3}}{\\mathrm{kg}}')], false) }),
    row('state1:v-numeric', `=\\frac{${Rs}\\cdot${T1}}{${p1}}=${v1}`, 'numeric'),
    row('state1:entropy-outline', 's_1-s_{ref}=c_p\\ln\\left(\\frac{T_1}{T_{ref}}\\right)-R_s\\ln\\left(\\frac{p_1}{p_{ref}}\\right)', 'subject-change', { box: 'outline', state: 'derived', support: support('state1-entropy-proof', 'Herleitung · 1. HS + 2. HS → Entropieform', 'foundation', [supportRow('state1-first-law', 'du=\\delta q_{rev}-p\\,dv', 'start', '\\text{1. HS; rev.}'), supportRow('state1-second-law', '\\delta q_{rev}=T\\,ds', 'start', '\\text{2. HS; rev.}'), supportRow('state1-substitute-heat', 'T\\,ds=du+p\\,dv', 'subject-change', operation('substitute', 'substitute δq_rev')), supportRow('state1-enthalpy-differential', 'dh=du+p\\,dv+v\\,dp', 'start', 'h=u+pv'), supportRow('state1-gibbs', 'T\\,ds=dh-v\\,dp', 'subject-change', operation('substitute', 'substitute du+pdv')), supportRow('state1-ideal-enthalpy', 'dh=c_p\\,dT', 'start', '\\text{IGG}'), supportRow('state1-ideal-volume', 'v=\\frac{R_sT}{p}', 'start', '\\text{IGG}'), supportRow('state1-ideal-differential', 'ds=c_p\\frac{dT}{T}-R_s\\frac{dp}{p}', 'subject-change', operation('substitute', 'substitute')), supportRow('state1-integrated-entropy', 's_i-s_{ref}=c_p\\ln\\left(\\frac{T_i}{T_{ref}}\\right)-R_s\\ln\\left(\\frac{p_i}{p_{ref}}\\right)', 'subject-change', '\\int\\frac{dx}{x}=\\ln x')]) }),
    row('state1:entropy-ready', 's_1=c_p\\ln\\left(\\frac{T_1}{T_{ref}}\\right)-R_s\\ln\\left(\\frac{p_1}{p_{ref}}\\right)', 'subject-change', { box: 'ready', state: 'reachable', support: support('state1-reference-condition', 'Bedingung · Bezug', 'condition', [supportRow('state1-reference-values', 's_{ref}=0,\\;T_{ref}=273.15\\;\\mathrm K,\\;p_{ref}=101.325\\;\\mathrm{kPa}')]) }),
    row('state1:entropy-numeric', `=${s1}`, 'numeric'),
  ]
}

function compressionRows(input: CalculationStoryCompositionInput): CalculationStoryRow[] {
  const p2 = display(input, 'p2'); const T2 = display(input, 'T2'); const v2 = display(input, 'v2'); const s2 = display(input, 's2'); const T1 = display(input, 'T1'); const rp = display(input, 'pressureRatio')
  return [
    row('compression:p2-ready', 'p_2=p_1r_p', 'subject-change', { box: 'ready', state: 'reachable', operation: operation('isolate', 'solve for p_2', 'equivalent'), support: support('compression-pressure-ratio', 'Grundlage · Druckverhältnis', 'foundation', [supportRow('compression-rp', 'r_p=\\frac{p_2}{p_1}'), supportRow('compression-p2', 'p_2=p_1r_p', 'subject-change', operation('isolate', 'solve for p_2', 'equivalent'))]) }),
    row('compression:p2-numeric', `=${display(input, 'p1')}\\cdot${rp}=${p2}`, 'numeric'),
    row('compression:isentropic-outline', '\\frac{T_2}{T_1}=\\left(\\frac{p_2}{p_1}\\right)^{\\frac{\\kappa-1}{\\kappa}}', 'subject-change', { box: 'outline', state: 'derived', support: support('compression-isentropy-proof', 'Herleitung · Isentropie', 'foundation', [supportRow('compression-delta-s', 's_2-s_1=0', 'start', 'q_{12}=0\\;\\text{; rev.}'), supportRow('compression-log-relation', '0=c_p\\ln\\left(\\frac{T_2}{T_1}\\right)-R_s\\ln\\left(\\frac{p_2}{p_1}\\right)', 'subject-change', operation('substitute', 'substitute Δs')), supportRow('compression-log-solve', '\\ln\\left(\\frac{T_2}{T_1}\\right)=\\frac{R_s}{c_p}\\ln\\left(\\frac{p_2}{p_1}\\right)', 'subject-change', operation('isolate', 'solve for ln(T_2/T_1)', 'equivalent')), supportRow('compression-rs-cp', '\\frac{R_s}{c_p}=\\frac{c_p-c_v}{c_p}=1-\\frac{c_v}{c_p}=1-\\frac1{\\kappa}=\\frac{\\kappa-1}{\\kappa}'), supportRow('compression-kappa-substitute', '\\ln\\left(\\frac{T_2}{T_1}\\right)=\\frac{\\kappa-1}{\\kappa}\\ln\\left(\\frac{p_2}{p_1}\\right)', 'subject-change', operation('substitute', 'substitute')), supportRow('compression-log-power', '=\\ln\\left[\\left(\\frac{p_2}{p_1}\\right)^{\\frac{\\kappa-1}{\\kappa}}\\right]', 'continuation'), supportRow('compression-temperature-relation', '\\frac{T_2}{T_1}=\\left(\\frac{p_2}{p_1}\\right)^{\\frac{\\kappa-1}{\\kappa}}', 'subject-change', operation('exponentiate', 'exponentiate', 'equivalent'))]) }),
    row('compression:t2-ready', 'T_2=T_1r_p^{\\frac{\\kappa-1}{\\kappa}}', 'subject-change', { box: 'ready', state: 'reachable', operation: operation('substitute', 'insert p_2/p_1 = r_p'), support: support('compression-isentrope-reuse', 'Reuse · Isentropenrelation', 'reuse', [supportRow('compression-ratio-reuse', '\\frac{R_s}{c_p}=\\frac{\\kappa-1}{\\kappa}')]) }),
    row('compression:t2-numeric', `=${T1}\\cdot${rp}^{\\frac{${formatStoryNumberLatex(number(input, 'kappa') - 1)}}{${formatStoryNumberLatex(number(input, 'kappa'))}}}=${T2}`, 'numeric'),
    row('compression:v2-ready', 'v_2=\\frac{R_sT_2}{p_2}', 'subject-change', { box: 'ready', state: 'reachable', operation: operation('reuse', 'reuse IGG') }),
    row('compression:v2-numeric', `=\\frac{${display(input, 'Rs')}\\cdot${T2}}{${p2}}=${v2}`, 'numeric'),
    row('compression:s2-ready', 's_2=s_1', 'subject-change', { box: 'ready', state: 'reachable', operation: operation('implies' as StoryOperationKind, 'ds = 0', 'implies'), support: support('compression-ds-condition', 'Bedingung · isentrop', 'condition', [supportRow('compression-ds-zero', 'ds=0')]) }),
    row('compression:s2-numeric', `=${s2}`, 'numeric'),
  ]
}

function heatInputRows(input: CalculationStoryCompositionInput): CalculationStoryRow[] {
  const p3 = display(input, 'p3'); const v3 = display(input, 'v3'); const s3 = display(input, 's3')
  return [
    row('heat:p3-ready', 'p_3=p_2', 'subject-change', { box: 'ready', state: 'reachable', operation: operation('reuse', 'p = const.'), support: support('heat-isobaric-condition', 'Bedingung · isobar', 'condition', [supportRow('heat-dp', 'dp=0')]) }),
    row('heat:p3-numeric', `=${p3}`, 'numeric'),
    row('heat:v3-ready', 'v_3=\\frac{R_sT_3}{p_3}', 'subject-change', { box: 'ready', state: 'reachable', operation: operation('reuse', 'reuse IGG') }),
    row('heat:v3-numeric', `=${v3}`, 'numeric'),
    row('heat:s3-ready', 's_3=c_p\\ln\\left(\\frac{T_3}{T_{ref}}\\right)-R_s\\ln\\left(\\frac{p_3}{p_{ref}}\\right)', 'subject-change', { box: 'ready', state: 'reachable', operation: operation('reuse', 'reuse Entropiedatum'), support: support('heat-entropy-reuse', 'Reuse · Entropiedatum', 'reuse', [supportRow('heat-reference-entropy', 's_{ref}=0')]) }),
    row('heat:s3-numeric', `=${s3}`, 'numeric'),
  ]
}

function expansionRows(input: CalculationStoryCompositionInput): CalculationStoryRow[] {
  const p4 = display(input, 'p4'); const T4 = display(input, 'T4'); const v4 = display(input, 'v4'); const s4 = display(input, 's4')
  return [
    row('expansion:p4-ready', 'p_4=p_1', 'subject-change', { box: 'ready', state: 'reachable', operation: operation('reuse', '4 → 1: p = const.'), support: support('expansion-pressure-level', 'Bedingung · Druckniveau', 'condition', [supportRow('expansion-pressure-levels', 'p_3=p_2,\\;p_4=p_1')]) }),
    row('expansion:p4-numeric', `=${p4}`, 'numeric'),
    row('expansion:t4-ready', 'T_4=\\frac{T_3}{r_p^{\\frac{\\kappa-1}{\\kappa}}}', 'subject-change', { box: 'ready', state: 'reachable', operation: operation('reuse', 'reuse Isentropenrelation'), support: support('expansion-isentrope-reuse', 'Reuse · Reuse', 'reuse', [supportRow('expansion-temperature-ratio', '\\frac{T_4}{T_3}=\\left(\\frac{p_4}{p_3}\\right)^{\\frac{\\kappa-1}{\\kappa}}'), supportRow('expansion-pressure-ratio', '\\frac{p_4}{p_3}=\\frac{p_1}{p_2}=\\frac1{r_p}')]) }),
    row('expansion:t4-numeric', `=${T4}`, 'numeric'),
    row('expansion:v4-ready', 'v_4=\\frac{R_sT_4}{p_4}', 'subject-change', { box: 'ready', state: 'reachable', operation: operation('reuse', 'reuse IGG') }),
    row('expansion:v4-numeric', `=${v4}`, 'numeric'),
    row('expansion:s4-ready', 's_4=s_3', 'subject-change', { box: 'ready', state: 'reachable', operation: operation('reuse', 'ds = 0'), support: support('expansion-ds-condition', 'Bedingung · isentrop', 'condition', [supportRow('expansion-ds-zero', 'ds=0')]) }),
    row('expansion:s4-numeric', `=${s4}`, 'numeric'),
  ]
}

function energyRows(input: CalculationStoryCompositionInput): CalculationStoryRow[] {
  const wComp = display(input, 'w_comp'); const wTurb = display(input, 'w_turb'); const qIn = display(input, 'q_in'); const qOut = display(input, 'q_out')
  const cp = display(input, 'cp'); const T1 = display(input, 'T1'); const T2 = display(input, 'T2'); const T3 = display(input, 'T3'); const T4 = display(input, 'T4')
  return [
    row('energy:balance', '\\frac{dE_{CV}}{dt}=\\dot Q+\\dot W_t+\\dot m(e_i-e_j)', 'start', { support: support('energy-control-volume', 'Grundlage · Kontrollvolumen-Energie', 'foundation', [supportRow('energy-kinetic', 'E_{kin}=\\frac{m\\mathrm v^2}{2}'), supportRow('energy-specific-kinetic', 'e_{kin}:=\\frac{E_{kin}}m=\\frac{\\mathrm v^2}{2}', 'subject-change', operation('divide', 'divide by m')), supportRow('energy-potential', 'E_{pot}=mg(z-z_0)'), supportRow('energy-specific-potential', 'e_{pot}:=\\frac{E_{pot}}m=g(z-z_0)', 'subject-change', operation('divide', 'divide by m')), supportRow('energy-enthalpy-definition', 'h:=u+pv', 'subject-change', '\\text{Definition}'), supportRow('energy-combined-specific', 'e=h+\\frac{\\mathrm v^2}{2}+g(z-z_0)', 'subject-change', operation('add', 'combine specific energies'))]) }),
    row('energy:stationary', '\\frac{dE_{CV}}{dt}=0', 'subject-change', { operation: operation('substitute', 'stationär', 'implies'), support: support('energy-no-accumulation', 'Bedingung · keine Akkumulation', 'condition', [supportRow('energy-stored-not-zero', 'E_{CV}\\ne0,\\;\\frac{dE_{CV}}{dt}=0')]) }),
    row('energy:mass', '0=\\dot Q+\\dot W_t+\\dot m(e_i-e_j)', 'subject-change', { support: support('energy-mass-flow', 'Bedingung · ein Ein- und Austritt', 'condition', [supportRow('energy-mass-balance', '\\dot m_i=\\dot m_j=\\dot m')]) }),
    row('energy:rates', '\\dot Q+\\dot W_t=\\dot m(e_j-e_i)', 'subject-change', { operation: operation('isolate', 'solve for rates', 'equivalent') }),
    row('energy:specific', '\\frac{\\dot Q}{\\dot m}+\\frac{\\dot W_t}{\\dot m}=e_j-e_i', 'subject-change', { operation: operation('divide', 'divide by ṁ', 'equivalent'), support: support('energy-specific-transfer', 'Definition · spezifische Übertragung', 'foundation', [supportRow('energy-q-definition', 'q:=\\frac{\\dot Q}{\\dot m}'), supportRow('energy-w-definition', 'w_t:=\\frac{\\dot W_t}{\\dot m}')]) }),
    row('energy:definitions', 'q_{ij}+w_{t,ij}=(h_j-h_i)+\\Delta e_{kin}+\\Delta e_{pot}', 'subject-change', { operation: operation('substitute', 'substitute definitions') }),
    row('energy:model-reduction', 'q_{ij}+w_{t,ij}=h_j-h_i+\\underbrace{\\Delta e_{kin}}_{\\approx0}+\\underbrace{\\Delta e_{pot}}_{\\approx0}', 'subject-change', { support: support('energy-model-condition', 'Modell · Änderungen vernachlässigbar', 'condition', [supportRow('energy-negligible', '\\Delta e_{kin}\\approx0,\\;\\Delta e_{pot}\\approx0')]) }),
    row('energy:reduced', 'q_{ij}+w_{t,ij}=h_j-h_i', 'subject-change', { box: 'outline', state: 'derived', operation: operation('substitute', 'reduce model', 'implies') }),
    row('energy:enthalpy', 'h_j-h_i=c_p(T_j-T_i)', 'subject-change', { box: 'outline', state: 'derived', support: support('energy-enthalpy-proof', 'Herleitung · IGG → Enthalpieänderung', 'foundation', [supportRow('energy-dh', 'dh=\\left(\\frac{\\partial h}{\\partial T}\\right)_p dT+\\left(\\frac{\\partial h}{\\partial p}\\right)_T dp'), supportRow('energy-cp-definition', 'c_p:=\\left(\\frac{\\partial h}{\\partial T}\\right)_p'), supportRow('energy-dh-cp', 'dh=c_p\\,dT', 'subject-change', operation('substitute', 'ideales Gas')), supportRow('energy-integrated-h', 'h_j-h_i=c_p(T_j-T_i)', 'subject-change', operation('integrate', 'c_p = const.'))]) }),
    row('energy:wcomp', 'w_{comp}=h_2-h_1=c_p(T_2-T_1)', 'subject-change', { box: 'ready', state: 'reachable', operation: 'q_{12}=0', support: support('energy-compressor-reuse', 'Reuse · reduzierte Energiebilanz', 'reuse', [supportRow('energy-compressor-balance', 'q_{ij}+w_{t,ij}=h_j-h_i')]) }),
    row('energy:wcomp:numeric', `=${cp}\\cdot\\left(${T2}-${T1}\\right)=${wComp}`, 'numeric'),
    row('energy:wturb', 'w_{turb}=h_4-h_3=c_p(T_4-T_3)', 'subject-change', { box: 'ready', state: 'reachable', operation: 'q_{34}=0' }),
    row('energy:wturb:numeric', `=${cp}\\cdot\\left(${T4}-${T3}\\right)=${wTurb}`, 'numeric'),
    row('energy:qin', 'q_{in}=h_3-h_2=c_p(T_3-T_2)', 'subject-change', { box: 'ready', state: 'reachable', operation: 'w_{t,23}=0', support: support('energy-heater-condition', 'Bedingung · Heizer', 'condition', [supportRow('energy-heater-work', 'w_{t,23}=0')]) }),
    row('energy:qin:numeric', `=${cp}\\cdot\\left(${T3}-${T2}\\right)=${qIn}`, 'numeric'),
    row('energy:qout', 'q_{out}=h_1-h_4=c_p(T_1-T_4)', 'subject-change', { box: 'ready', state: 'reachable', operation: 'w_{t,41}=0', support: support('energy-cooler-condition', 'Bedingung · Kühler', 'condition', [supportRow('energy-cooler-work', 'w_{t,41}=0')]) }),
    row('energy:qout:numeric', `=${cp}\\cdot\\left(${T1}-${T4}\\right)=${qOut}`, 'numeric'),
  ]
}

function cycleRows(input: CalculationStoryCompositionInput): CalculationStoryRow[] {
  const net = display(input, 'w_netto'); const eta = display(input, 'eta'); const bwr = display(input, 'back_work_ratio')
  const wComp = display(input, 'w_comp'); const wTurb = display(input, 'w_turb'); const qIn = display(input, 'q_in')
  return [
    row('cycle:netto', 'w_{netto}=w_{comp}+w_{turb}', 'subject-change', { box: 'ready', state: 'reachable' }),
    row('cycle:netto-numeric', `=${wComp}+\\left(${wTurb}\\right)=${net}`, 'numeric'),
    row('cycle:eta', '\\eta=\\frac{-w_{netto}}{q_{in}}', 'subject-change', { box: 'ready', state: 'reachable', support: support('cycle-sign', 'Bedingung · Vorzeichen', 'condition', [supportRow('cycle-sign-value', 'w_{netto}<0\\;:\\;\\text{Arbeitsabgabe}')]) }),
    row('cycle:eta-numeric', `=\\frac{-\\left(${net}\\right)}{${qIn}}=${eta}=${formatStoryNumberLatex(number(input, 'eta') * 100)}\\;\\%`, 'numeric'),
    row('cycle:bwr', 'BWR=\\frac{w_{comp}}{-w_{turb}}', 'subject-change', { box: 'ready', state: 'reachable' }),
    row('cycle:bwr-numeric', `=\\frac{${wComp}}{-\\left(${wTurb}\\right)}=${bwr}=${formatStoryNumberLatex(number(input, 'back_work_ratio') * 100)}\\;\\%`, 'numeric'),
    row('cycle:checks', 'q_{in}+q_{out}+w_{netto}=0', 'check', { support: support('cycle-checks', 'Kontrolle · Kontrollen', 'condition', [supportRow('cycle-energy-check', 'q_{in}+q_{out}+w_{netto}=0'), supportRow('cycle-s12-check', 's_2-s_1=0'), supportRow('cycle-s34-check', 's_4-s_3=0'), supportRow('cycle-eta-check', `\\eta=1-\\frac1{r_p^{\\frac{\\kappa-1}{\\kappa}}}=${eta}`)]) }),
  ]
}

export function composeJouleCalculationStory(input: CalculationStoryCompositionInput): CalculationStoryState {
  if (!input.plan) return { mode: 'not-applicable' }
  try {
    const required = ['T1', 'p1', 'pressureRatio', 'T3', 'kappa', 'Rs', 'cv', 'cp', 'v1', 's1', 'p2', 'T2', 'v2', 's2', 'p3', 'v3', 's3', 'p4', 'T4', 'v4', 's4', 'w_comp', 'w_turb', 'q_in', 'q_out', 'w_netto', 'eta', 'back_work_ratio']
    required.forEach(id => number(input, id))
    const sections: CalculationStorySection[] = [
      { id: 'material-properties', title: 'Stoffeigenschaften', tier: 'main', sideLatex: 'R_s>0\;\text{;}\;1<\kappa\le2', rows: materialRows(input) },
      { id: 'state-1', title: 'Zustand 1', tier: 'main', sideLatex: 'p_1,\;T_1\;\text{gegeben}', rows: stateOneRows(input) },
      { id: 'compression-1-2', title: '1 → 2 · isentrope Verdichtung', tier: 'main', sideLatex: 'q_{12}=0\;\text{; rev.}', rows: compressionRows(input) },
      { id: 'heat-input-2-3', title: '2 → 3 · isobare Wärmezufuhr', tier: 'main', sideLatex: 'p=\mathrm{const.}\;\text{;}\;T_3\;\text{gegeben}', rows: heatInputRows(input) },
      { id: 'expansion-3-4', title: '3 → 4 · isentrope Expansion', tier: 'main', sideLatex: 'q_{34}=0\;\text{; rev.}', rows: expansionRows(input) },
      { id: 'energy-path', title: 'Energiepfad', tier: 'main', sideLatex: 'q>0,\;w_t>0\;\text{ ins System}', rows: energyRows(input) },
      { id: 'cycle-balance-performance', title: 'Kreisbilanz und Kennwerte', tier: 'main', sideLatex: '\text{mit Vorzeichen}', rows: cycleRows(input) },
    ]
    const rows = sections.flatMap(section => section.rows)
    if (rows.length !== 62 || rows.filter(candidate => candidate.support).length !== 26) throw new Error('reference recipe integrity failure')
    return {
      mode: 'complete',
      story: {
        route: 'joule-human-reference-v1',
        title: 'Joule-/Brayton-Prozess · Rechenweg',
        overview: {
          model: 'Ideales Gas · konstante Stoffwerte · ideale Verdichtung und Expansion.',
          givens: [`T_1=${display(input, 'T1')}`, `p_1=${display(input, 'p1')}`, `r_p=${display(input, 'pressureRatio')}`, `T_3=${display(input, 'T3')}`, `\\kappa=${display(input, 'kappa')}`, `R_s=${formatStoryNumberLatex(number(input, 'Rs'))}\\;\\frac{\\mathrm J}{\\mathrm{kg}\\,\\mathrm K}=${display(input, 'Rs')}`],
          scope: 'Spezifische Größen; v ist spezifisches Volumen.',
          signs: ['q_{in}>0', 'q_{out}<0', 'w_{comp}>0', 'w_{turb}<0', 'w_{netto}<0'],
          route: SECTION_TITLES.map(([, title]) => title),
        },
        rows,
        sections,
        consumedSteps: consumed(input),
        unconsumedPrimarySteps: [],
      },
    }
  } catch {
    return { mode: 'unavailable', reason: 'Der Rechenweg benötigt einen vollständig belegten Joule-Referenzzustand.' }
  }
}

import type { Formula } from '../../core/types'

function formula(id: string, name: string, latex: string, variables: string[], solveFor: Record<string, string>, category: string): Formula {
  return { id, name, latex, variables, solveFor, category, latexSteps: Object.fromEntries(Object.keys(solveFor).map(target => [target, { rearranged: latex, explanation: name + ': direkt nach ' + target + ' aufgelöst.' }])) }
}

const idealGas = ([1, 2, 3, 4] as const).map(state => formula(
  'ideal_gas_' + state,
  'Ideale Gasgleichung (Zustand ' + state + ')',
  'p_' + state + ' v_' + state + ' = R_s T_' + state,
  ['p' + state, 'v' + state, 'Rs', 'T' + state],
  { ['p' + state]: 'Rs * T' + state + ' / v' + state, ['v' + state]: 'Rs * T' + state + ' / p' + state, ['T' + state]: 'p' + state + ' * v' + state + ' / Rs', Rs: 'p' + state + ' * v' + state + ' / T' + state },
  'Zustandsgleichung',
))

const entropy = ([1, 2, 3, 4] as const).map(state => formula(
  'entropy_abs_' + state,
  'Relative Entropie (Zustand ' + state + ')',
  's_' + state + ' = c_p ln(T_' + state + '/273.15) - R_s ln(p_' + state + '/101325)',
  ['s' + state, 'cp', 'T' + state, 'Rs', 'p' + state],
  { ['s' + state]: 'cp * log(T' + state + ' / 273.15) - Rs * log(p' + state + ' / 101325)' },
  'Entropie',
))

const BASE_JOULE_FORMULAS: Formula[] = [
  ...idealGas,
  ...entropy,
  formula('cv_from_Rs_kappa', 'cv aus Rs und κ', 'c_v = R_s / (κ - 1)', ['cv', 'Rs', 'kappa'], { cv: 'Rs / (kappa - 1)' }, 'Stoffeigenschaften'),
  formula('cp_from_kappa_cv', 'cp aus κ und cv', 'c_p = κ c_v', ['cp', 'kappa', 'cv'], { cp: 'kappa * cv' }, 'Stoffeigenschaften'),
  formula('pressure_ratio', 'Druckverhältnis', 'p_2 = p_1 r_p', ['p2', 'p1', 'pressureRatio'], { p2: 'p1 * pressureRatio', p1: 'p2 / pressureRatio', pressureRatio: 'p2 / p1' }, 'Zustandsänderungen'),
  formula('high_pressure_isobar', 'Isobare Wärmezufuhr', 'p_3 = p_2', ['p3', 'p2'], { p3: 'p2', p2: 'p3' }, 'Zustandsänderungen'),
  formula('low_pressure_isobar', 'Isobare Wärmeabfuhr', 'p_4 = p_1', ['p4', 'p1'], { p4: 'p1', p1: 'p4' }, 'Zustandsänderungen'),
  formula('compressor_temperature', 'Isentrope Verdichtung: Temperatur', 'T_2 = T_1 r_p^((κ-1)/κ)', ['T2', 'T1', 'pressureRatio', 'kappa'], { T2: 'T1 * pressureRatio ^ ((kappa - 1) / kappa)' }, 'Zustandsänderungen'),
  formula('turbine_temperature', 'Isentrope Expansion: Temperatur', 'T_4 = T_3 / r_p^((κ-1)/κ)', ['T4', 'T3', 'pressureRatio', 'kappa'], { T4: 'T3 / pressureRatio ^ ((kappa - 1) / kappa)' }, 'Zustandsänderungen'),
  formula('isentropic_entropy_12', 'Isentrope Bedingung (1→2)', 's_2 = s_1', ['s2', 's1'], { s2: 's1', s1: 's2' }, 'Entropie'),
  formula('isentropic_entropy_34', 'Isentrope Bedingung (3→4)', 's_4 = s_3', ['s4', 's3'], { s4: 's3', s3: 's4' }, 'Entropie'),
  formula('compressor_work', 'Verdichterarbeit', 'w_comp = c_p (T_2 - T_1)', ['w_comp', 'cp', 'T2', 'T1'], { w_comp: 'cp * (T2 - T1)' }, 'Energiebilanz'),
  formula('turbine_work', 'Turbinenarbeit', 'w_turb = c_p (T_4 - T_3)', ['w_turb', 'cp', 'T4', 'T3'], { w_turb: 'cp * (T4 - T3)' }, 'Energiebilanz'),
  formula('net_work', 'Nettoarbeit', 'w_netto = w_comp + w_turb', ['w_netto', 'w_comp', 'w_turb'], { w_netto: 'w_comp + w_turb' }, 'Energiebilanz'),
  formula('heat_input', 'Isobare Wärmezufuhr', 'q_in = c_p (T_3 - T_2)', ['q_in', 'cp', 'T3', 'T2'], { q_in: 'cp * (T3 - T2)' }, 'Energiebilanz'),
  formula('heat_rejection', 'Isobare Wärmeabfuhr', 'q_out = c_p (T_1 - T_4)', ['q_out', 'cp', 'T1', 'T4'], { q_out: 'cp * (T1 - T4)' }, 'Energiebilanz'),
  formula('efficiency', 'Wirkungsgrad aus Energien', 'η = -w_netto / q_in', ['eta', 'w_netto', 'q_in'], { eta: '-w_netto / q_in' }, 'Wirkungsgrad'),
  formula('back_work_ratio', 'Back-Work-Ratio', 'BWR = w_comp / (-w_turb)', ['back_work_ratio', 'w_comp', 'w_turb'], { back_work_ratio: 'w_comp / (-w_turb)' }, 'Wirkungsgrad'),
]


type PresentationEntry = {
  rearranged: string
  derivation: import('../../core/types').JouleTargetPresentation
}

const presentation = (rearranged: string, phase: import('../../core/types').NarrativePhase, rank: number, policy: 'show' | 'omit' = 'show', substitution: import('../../core/types').SubstitutionPolicy = { mode: 'mathjs' }): PresentationEntry => ({
  rearranged,
  derivation: { optedIn: true, rearrangement: policy, substitution, narrative: { phase, rank } },
})

const JOULE_PRESENTATION: Record<string, PresentationEntry> = {
  'ideal_gas_1:v1': presentation('v_1 = \\frac{R_s T_1}{p_1}', 'given-state-and-properties', 30),
  'cv_from_Rs_kappa:cv': presentation('c_v = \\frac{R_s}{\\kappa - 1}', 'given-state-and-properties', 10),
  'cp_from_kappa_cv:cp': presentation('c_p = \\kappa c_v', 'given-state-and-properties', 20),
  'pressure_ratio:p2': presentation('p_2 = p_1 r_p', 'compression-1-2', 10),
  'high_pressure_isobar:p3': presentation('p_3 = p_2', 'heat-input-2-3', 10, 'omit'),
  'low_pressure_isobar:p4': presentation('p_4 = p_1', 'heat-rejection-4-1', 10, 'omit'),
  'compressor_temperature:T2': presentation('T_2 = T_1 r_p^{\\frac{\\kappa - 1}{\\kappa}}', 'compression-1-2', 20),
  'turbine_temperature:T4': presentation('T_4 = \\frac{T_3}{r_p^{\\frac{\\kappa - 1}{\\kappa}}}', 'expansion-3-4', 10),
  'compressor_work:w_comp': presentation('w_{comp} = c_p (T_2 - T_1)', 'balances', 10),
  'turbine_work:w_turb': presentation('w_{turb} = c_p (T_4 - T_3)', 'balances', 20),
  'net_work:w_netto': presentation('w_{netto} = w_{comp} + w_{turb}', 'balances', 30),
  'heat_input:q_in': presentation('q_{in} = c_p (T_3 - T_2)', 'balances', 40),
  'heat_rejection:q_out': presentation('q_{out} = c_p (T_1 - T_4)', 'balances', 50),
  'efficiency:eta': presentation('\\eta = \\frac{-w_{netto}}{q_{in}}', 'performance', 10, 'show', { mode: 'explicit-override', buildLatex: ({ values, formatValue }) => `\\frac{-\\left(${formatValue(values.w_netto)}\\right)}{${formatValue(values.q_in)}}` }),
  'back_work_ratio:back_work_ratio': presentation('BWR = \\frac{w_{comp}}{-w_{turb}}', 'performance', 20, 'show', { mode: 'explicit-override', buildLatex: ({ values, formatValue }) => `\\frac{${formatValue(values.w_comp)}}{-\\left(${formatValue(values.w_turb)}\\right)}` }),
  'ideal_gas_2:v2': presentation('v_2 = \\frac{R_s T_2}{p_2}', 'compression-1-2', 30),
  'ideal_gas_3:v3': presentation('v_3 = \\frac{R_s T_3}{p_3}', 'heat-input-2-3', 20),
  'ideal_gas_4:v4': presentation('v_4 = \\frac{R_s T_4}{p_4}', 'heat-rejection-4-1', 20),
  'entropy_abs_1:s1': presentation('s_1 = c_p \\ln\\left(\\frac{T_1}{273.15}\\right) - R_s \\ln\\left(\\frac{p_1}{101325}\\right)', 'given-state-and-properties', 40),
  'entropy_abs_2:s2': presentation('s_2 = c_p \\ln\\left(\\frac{T_2}{273.15}\\right) - R_s \\ln\\left(\\frac{p_2}{101325}\\right)', 'compression-1-2', 40),
  'entropy_abs_3:s3': presentation('s_3 = c_p \\ln\\left(\\frac{T_3}{273.15}\\right) - R_s \\ln\\left(\\frac{p_3}{101325}\\right)', 'heat-input-2-3', 30),
  'entropy_abs_4:s4': presentation('s_4 = c_p \\ln\\left(\\frac{T_4}{273.15}\\right) - R_s \\ln\\left(\\frac{p_4}{101325}\\right)', 'expansion-3-4', 20),
}

export const JOULE_FORMULAS: Formula[] = BASE_JOULE_FORMULAS.map(formula => {
  const latexSteps = Object.fromEntries(Object.entries(formula.latexSteps).map(([targetId, definition]) => {
    const entry = JOULE_PRESENTATION[`${formula.id}:${targetId}`]
    return [targetId, entry ? { ...definition, rearranged: entry.rearranged, derivation: entry.derivation } : definition]
  }))
  return { ...formula, latexSteps }
})

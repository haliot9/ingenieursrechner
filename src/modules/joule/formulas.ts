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

export const JOULE_FORMULAS: Formula[] = [
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

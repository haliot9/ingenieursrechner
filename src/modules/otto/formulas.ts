import type { Formula } from '../../core/types'

function formula(id: string, name: string, latex: string, variables: string[], solveFor: Record<string, string>, category: string): Formula {
  return {
    id, name, latex, variables, solveFor, category,
    latexSteps: Object.fromEntries(Object.keys(solveFor).map(target => [target, {
      rearranged: latex,
      explanation: `${name}: direkt nach ${target} aufgelöst.`,
    }])),
  }
}

const idealGas = ([1, 2, 3, 4] as const).map(state => formula(
  `ideal_gas_${state}`,
  `Ideale Gasgleichung (Zustand ${state})`,
  `p_${state} \\cdot v_${state} = R_s \\cdot T_${state}`,
  [`p${state}`, `v${state}`, 'Rs', `T${state}`],
  {
    [`p${state}`]: `Rs * T${state} / v${state}`,
    [`v${state}`]: `Rs * T${state} / p${state}`,
    [`T${state}`]: `p${state} * v${state} / Rs`,
    Rs: `p${state} * v${state} / T${state}`,
  },
  'Zustandsgleichung',
))

const entropy = ([1, 2, 3, 4] as const).map(state => formula(
  `entropy_abs_${state}`,
  `Absolute Entropie (Zustand ${state})`,
  `s_${state} = c_p \\cdot \\ln\\frac{T_${state}}{273.15} - R_s \\cdot \\ln\\frac{p_${state}}{101325}`,
  [`s${state}`, 'cp', `T${state}`, 'Rs', `p${state}`],
  { [`s${state}`]: `cp * log(T${state} / 273.15) - Rs * log(p${state} / 101325)` },
  'Entropie',
))

export const OTTO_FORMULAS: Formula[] = [
  ...idealGas,
  ...entropy,
  formula('cv_from_Rs_kappa', 'cv aus Rs und κ', 'c_v = \\frac{R_s}{\\kappa - 1}', ['cv', 'Rs', 'kappa'], { cv: 'Rs / (kappa - 1)' }, 'Stoffeigenschaften'),
  formula('cp_from_kappa_cv', 'cp aus κ und cv', 'c_p = \\kappa \\cdot c_v', ['cp', 'kappa', 'cv'], { cp: 'kappa * cv' }, 'Stoffeigenschaften'),

  formula('compression_temperature', 'Isentrope Verdichtung: Temperatur', 'T_2 = T_1 \\cdot r^{\\kappa-1}', ['T2', 'T1', 'r', 'kappa'], { T2: 'T1 * r ^ (kappa - 1)' }, 'Zustandsänderungen'),
  formula('compression_pressure', 'Isentrope Verdichtung: Druck', 'p_2 = p_1 \\cdot r^{\\kappa}', ['p2', 'p1', 'r', 'kappa'], { p2: 'p1 * r ^ kappa' }, 'Zustandsänderungen'),
  formula('compression_volume', 'Verdichtungsverhältnis', 'v_2 = \\frac{v_1}{r}', ['v2', 'v1', 'r'], { v2: 'v1 / r' }, 'Zustandsänderungen'),

  formula('isochoric_heat_addition_volume', 'Isochore Wärmezufuhr', 'v_3 = v_2', ['v3', 'v2'], { v3: 'v2', v2: 'v3' }, 'Zustandsänderungen'),
  formula('isochoric_heat_addition_pressure', 'Isochore Wärmezufuhr', 'p_3 = p_2 \\cdot \\frac{T_3}{T_2}', ['p3', 'p2', 'T3', 'T2'], { p3: 'p2 * T3 / T2' }, 'Zustandsänderungen'),

  formula('expansion_temperature', 'Isentrope Expansion: Temperatur', 'T_4 = \\frac{T_3}{r^{\\kappa-1}}', ['T4', 'T3', 'r', 'kappa'], { T4: 'T3 / r ^ (kappa - 1)' }, 'Zustandsänderungen'),
  formula('expansion_pressure', 'Isentrope Expansion: Druck', 'p_4 = \\frac{p_3}{r^{\\kappa}}', ['p4', 'p3', 'r', 'kappa'], { p4: 'p3 / r ^ kappa' }, 'Zustandsänderungen'),
  formula('isochoric_heat_rejection_volume', 'Isochore Wärmeabfuhr', 'v_4 = v_1', ['v4', 'v1'], { v4: 'v1', v1: 'v4' }, 'Zustandsänderungen'),

  formula('isentropic_entropy_12', 'Isentrope Bedingung (1→2)', 's_2 = s_1', ['s2', 's1'], { s2: 's1', s1: 's2' }, 'Entropie'),
  formula('isentropic_entropy_34', 'Isentrope Bedingung (3→4)', 's_4 = s_3', ['s4', 's3'], { s4: 's3', s3: 's4' }, 'Entropie'),

  formula('heat_input', 'Isochore Wärmezufuhr', 'q_{in} = c_v \\cdot (T_3 - T_2)', ['q_in', 'cv', 'T3', 'T2'], { q_in: 'cv * (T3 - T2)' }, 'Energiebilanz'),
  formula('heat_rejection', 'Isochore Wärmeabfuhr', 'q_{out} = c_v \\cdot (T_1 - T_4)', ['q_out', 'cv', 'T1', 'T4'], { q_out: 'cv * (T1 - T4)' }, 'Energiebilanz'),
  formula('first_law', '1. Hauptsatz (Energiebilanz)', 'w_{netto} = -(q_{in} + q_{out})', ['w_netto', 'q_in', 'q_out'], { w_netto: '-q_in - q_out' }, 'Energiebilanz'),
  formula('efficiency', 'Wirkungsgrad aus Energien', '\\eta = -\\frac{w_{netto}}{q_{in}}', ['eta', 'w_netto', 'q_in'], { eta: '-w_netto / q_in' }, 'Wirkungsgrad'),
]

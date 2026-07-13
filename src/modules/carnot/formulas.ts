import type { Formula } from '../../core/types'

/**
 * All formulas for the Carnot cycle calculator.
 * Each formula has pre-solved expressions for every variable it can determine.
 */
export const CARNOT_FORMULAS: Formula[] = [
  // ===== IDEAL GAS LAW (for each state) =====
  ...([1, 2, 3, 4] as const).map(i => ({
    id: `ideal_gas_${i}`,
    name: `Ideale Gasgleichung (Zustand ${i})`,
    latex: `p_${i} \\cdot V_${i} = m \\cdot R_s \\cdot T_${i}`,
    variables: [`p${i}`, `V${i}`, `T${i}`, 'm', 'Rs'],
    solveFor: {
      [`p${i}`]: `m * Rs * T${i} / V${i}`,
      [`V${i}`]: `m * Rs * T${i} / p${i}`,
      [`T${i}`]: `p${i} * V${i} / (m * Rs)`,
      'm': `p${i} * V${i} / (Rs * T${i})`,
      'Rs': `p${i} * V${i} / (m * T${i})`,
    },
    latexSteps: {
      [`p${i}`]: {
        rearranged: `p_${i} = \\frac{m \\cdot R_s \\cdot T_${i}}{V_${i}}`,
        explanation: `Ideale Gasgleichung nach p${i} umgestellt: Division beider Seiten durch V${i}`,
      },
      [`V${i}`]: {
        rearranged: `V_${i} = \\frac{m \\cdot R_s \\cdot T_${i}}{p_${i}}`,
        explanation: `Ideale Gasgleichung nach V${i} umgestellt: Division beider Seiten durch p${i}`,
      },
      [`T${i}`]: {
        rearranged: `T_${i} = \\frac{p_${i} \\cdot V_${i}}{m \\cdot R_s}`,
        explanation: `Ideale Gasgleichung nach T${i} umgestellt: Division beider Seiten durch (m·Rs)`,
      },
      'm': {
        rearranged: `m = \\frac{p_${i} \\cdot V_${i}}{R_s \\cdot T_${i}}`,
        explanation: `Ideale Gasgleichung nach m umgestellt: Division beider Seiten durch (Rs·T${i})`,
      },
      'Rs': {
        rearranged: `R_s = \\frac{p_${i} \\cdot V_${i}}{m \\cdot T_${i}}`,
        explanation: `Ideale Gasgleichung nach Rs umgestellt: Division beider Seiten durch (m·T${i})`,
      },
    },
    category: 'Zustandsgleichung',
  } as Formula)),

  // ===== MAYER RELATION =====
  {
    id: 'mayer',
    name: 'Mayer-Beziehung',
    latex: 'c_p - c_v = R_s',
    variables: ['cp', 'cv', 'Rs'],
    solveFor: {
      'cp': 'cv + Rs',
      'cv': 'cp - Rs',
      'Rs': 'cp - cv',
    },
    latexSteps: {
      'cp': {
        rearranged: 'c_p = c_v + R_s',
        explanation: 'Mayer-Beziehung: cp ergibt sich aus cv + Rs',
      },
      'cv': {
        rearranged: 'c_v = c_p - R_s',
        explanation: 'Mayer-Beziehung nach cv umgestellt: cv = cp - Rs',
      },
      'Rs': {
        rearranged: 'R_s = c_p - c_v',
        explanation: 'Mayer-Beziehung nach Rs umgestellt: Rs = cp - cv',
      },
    },
    category: 'Stoffeigenschaften',
  },

  // ===== ISENTROPIC EXPONENT =====
  {
    id: 'kappa_def',
    name: 'Isentropenexponent',
    latex: '\\kappa = \\frac{c_p}{c_v}',
    variables: ['kappa', 'cp', 'cv'],
    solveFor: {
      'kappa': 'cp / cv',
      'cp': 'kappa * cv',
      'cv': 'cp / kappa',
    },
    latexSteps: {
      'kappa': {
        rearranged: '\\kappa = \\frac{c_p}{c_v}',
        explanation: 'Definition des Isentropenexponenten: κ = cp/cv',
      },
      'cp': {
        rearranged: 'c_p = \\kappa \\cdot c_v',
        explanation: 'Umgestellt: cp = κ · cv',
      },
      'cv': {
        rearranged: 'c_v = \\frac{c_p}{\\kappa}',
        explanation: 'Umgestellt: cv = cp / κ',
      },
    },
    category: 'Stoffeigenschaften',
  },

  // ===== DERIVED: cv from Rs and kappa (breaks Mayer+kappa_def deadlock) =====
  // From Mayer: cp = cv + Rs  and  kappa = cp/cv:
  //   kappa = (cv + Rs)/cv = 1 + Rs/cv  →  cv = Rs / (kappa - 1)
  {
    id: 'cv_from_Rs_kappa',
    name: 'cv aus Rs und κ',
    latex: 'c_v = \\frac{R_s}{\\kappa - 1}',
    variables: ['cv', 'Rs', 'kappa'],
    solveFor: {
      'cv': 'Rs / (kappa - 1)',
      'Rs': 'cv * (kappa - 1)',
      'kappa': 'Rs / cv + 1',
    },
    latexSteps: {
      'cv': {
        rearranged: 'c_v = \\frac{R_s}{\\kappa - 1}',
        explanation: 'Aus Mayer-Beziehung und κ-Definition kombiniert: cv = Rs / (κ - 1)',
      },
      'Rs': {
        rearranged: 'R_s = c_v \\cdot (\\kappa - 1)',
        explanation: 'Spez. Gaskonstante: Rs = cv · (κ - 1)',
      },
      'kappa': {
        rearranged: '\\kappa = \\frac{R_s}{c_v} + 1',
        explanation: 'Isentropenexponent: κ = Rs/cv + 1',
      },
    },
    category: 'Stoffeigenschaften',
  },

  // ===== MOLAR MASS / SPECIFIC GAS CONSTANT =====
  {
    id: 'Rs_from_M',
    name: 'Spez. Gaskonstante aus molarer Masse',
    latex: 'R_s = \\frac{R}{M}',
    variables: ['Rs', 'M'],
    solveFor: {
      'Rs': '8.314 / M',
      'M': '8.314 / Rs',
    },
    latexSteps: {
      'Rs': {
        rearranged: 'R_s = \\frac{R}{M} = \\frac{8.314}{M}',
        explanation: 'Spezifische Gaskonstante: Rs = R/M mit R = 8.314 J/(mol·K)',
      },
      'M': {
        rearranged: 'M = \\frac{R}{R_s} = \\frac{8.314}{R_s}',
        explanation: 'Molare Masse: M = R/Rs mit R = 8.314 J/(mol·K)',
      },
    },
    category: 'Stoffeigenschaften',
  },

  // ===== ADIABATIC RELATIONS (Carnot: 1→2 and 3→4 are adiabatic) =====
  // T-V relation (extensive volume): T * V^(κ-1) = const
  ...generateAdiabaticTVFormulas(),

  // p-V relation (extensive volume): p * V^κ = const
  ...generateAdiabaticPVFormulas(),

  // T-v relation (specific volume): T * v^(κ-1) = const
  ...generateAdiabaticTvFormulas(),

  // p-v relation (specific volume): p * v^κ = const
  ...generateAdiabaticPvFormulas(),

  // ===== ISENTROPIC ENTROPY CONSTRAINTS (Carnot: 1→2 and 3→4 are adiabatic/isentropic) =====
  ...generateIsentropicSFormulas(),

  // ===== ABSOLUTE ENTROPY (ideal gas, reference state T0=273.15 K, p0=101325 Pa) =====
  ...generateAbsoluteEntropyFormulas(),

  // ===== ENTROPY DIFFERENCE FROM ISOTHERMAL HEAT =====
  ...generateEntropyHeatFormulas(),

  // ===== ISOTHERMAL CONSTRAINTS (Carnot: 2→3 hot isotherm, 4→1 cold isotherm) =====
  // T2 = T3 (hot isotherm 2→3, always active)
  // T4 = T1 (cold isotherm 4→1, always active)
  ...generateIsothermalTFormulas(),

  // ===== ISOTHERMAL HEAT (q_in for hot isotherm, q_out for cold isotherm) =====
  ...generateIsothermalHeatFormulas(),

  // ===== CARNOT EFFICIENCY =====
  // Convention: state 1 & 4 are on the cold isotherm (T1 = T4 = T_cold)
  //             state 2 & 3 are on the hot isotherm  (T2 = T3 = T_hot)
  // → η = 1 - T_kalt/T_warm = 1 - T1/T3
  {
    id: 'carnot_eta',
    name: 'Carnot-Wirkungsgrad',
    latex: '\\eta_C = 1 - \\frac{T_{kalt}}{T_{warm}} = 1 - \\frac{T_1}{T_3}',
    variables: ['eta', 'T1', 'T3'],
    solveFor: {
      'eta': '1 - T1 / T3',
      'T1': 'T3 * (1 - eta)',
      'T3': 'T1 / (1 - eta)',
    },
    latexSteps: {
      'eta': {
        rearranged: '\\eta = 1 - \\frac{T_1}{T_3}',
        explanation: 'Carnot-Wirkungsgrad: η = 1 - T_kalt/T_warm (T1 = kalt, T3 = warm)',
      },
      'T1': {
        rearranged: 'T_1 = T_3 \\cdot (1 - \\eta)',
        explanation: 'Kalte Temperatur: T1 = T3 · (1 - η)',
      },
      'T3': {
        rearranged: 'T_3 = \\frac{T_1}{1 - \\eta}',
        explanation: 'Warme Temperatur: T3 = T1 / (1 - η)',
      },
    },
    category: 'Wirkungsgrad',
  },

  // ===== FIRST LAW: ENERGY BALANCE =====
  // Sign convention (physics/thermodynamics):
  //   q_in  > 0  (heat into the system at hot source)
  //   q_out < 0  (heat out of the system at cold sink)
  //   w_netto < 0  (work done BY the engine = output, negative in physics convention)
  // First law for a cycle: Q_net + W_net = 0  →  w_netto = -(q_in + q_out)
  {
    id: 'first_law',
    name: '1. Hauptsatz (Energiebilanz)',
    latex: 'w_{netto} = -(q_{in} + q_{out})',
    variables: ['q_in', 'w_netto', 'q_out'],
    solveFor: {
      'w_netto': '-q_in - q_out',
      'q_in':    '-w_netto - q_out',
      'q_out':   '-w_netto - q_in',
    },
    latexSteps: {
      'w_netto': {
        rearranged: 'w_{netto} = -(q_{in} + q_{out})',
        explanation: '1. Hauptsatz: Kreisprozess-Arbeit = -(q_in + q_out); w_netto < 0 bedeutet Arbeit abgegeben',
      },
      'q_in': {
        rearranged: 'q_{in} = -w_{netto} - q_{out}',
        explanation: 'Zugeführte Wärme aus Arbeit und abgeführter Wärme',
      },
      'q_out': {
        rearranged: 'q_{out} = -w_{netto} - q_{in}',
        explanation: 'Abgeführte Wärme (negativ: verlässt das System)',
      },
    },
    category: 'Energiebilanz',
  },

  // ===== DENSITY & SPECIFIC VOLUME =====
  ...generateDensityFormulas(),
  ...generateSpecificVolumeFormulas(),
  ...generateRhoVRelationFormulas(),
  ...generateIdealGasRhoFormulas(),
  ...generateIdealGasSpecVolumeFormulas(),

  // ===== EFFICIENCY FROM ENERGY =====
  // Since w_netto < 0 (work output), η = |w_netto| / q_in = -w_netto / q_in
  {
    id: 'eta_from_energy',
    name: 'Wirkungsgrad aus Energien',
    latex: '\\eta = -\\frac{w_{netto}}{q_{in}}',
    variables: ['eta', 'w_netto', 'q_in'],
    solveFor: {
      'eta':     '-w_netto / q_in',
      'w_netto': '-eta * q_in',
      'q_in':    '-w_netto / eta',
    },
    latexSteps: {
      'eta': {
        rearranged: '\\eta = -\\frac{w_{netto}}{q_{in}}',
        explanation: 'Wirkungsgrad = |Nutzarbeit| / Zugeführte Wärme (w_netto < 0 → Vorzeichen invertiert)',
      },
      'w_netto': {
        rearranged: 'w_{netto} = -\\eta \\cdot q_{in}',
        explanation: 'Netto-Arbeit (negativ = abgegeben): w_netto = -η · q_in',
      },
      'q_in': {
        rearranged: 'q_{in} = -\\frac{w_{netto}}{\\eta}',
        explanation: 'Zugeführte Wärme = -Netto-Arbeit / Wirkungsgrad',
      },
    },
    category: 'Wirkungsgrad',
  },
]

// ===== GENERATOR FUNCTIONS: ENTROPY =====

/**
 * Isentropic entropy constraints for the Carnot cycle.
 * s1 = s2 (adiabatic compression 1→2)
 * s3 = s4 (adiabatic expansion 3→4)
 */
function generateIsentropicSFormulas(): Formula[] {
  return [
    {
      id: 'isentropic_s_12',
      name: 'Isentrope Bedingung (1→2)',
      latex: 's_1 = s_2',
      variables: ['s1', 's2'],
      solveFor: { 's1': 's2', 's2': 's1' },
      latexSteps: {
        's1': {
          rearranged: 's_1 = s_2',
          explanation: 'Adiabate Kompression 1→2: Entropie bleibt konstant (s1 = s2)',
        },
        's2': {
          rearranged: 's_2 = s_1',
          explanation: 'Adiabate Kompression 1→2: Entropie bleibt konstant (s2 = s1)',
        },
      },
      category: 'Zustandsänderungen',
    },
    {
      id: 'isentropic_s_34',
      name: 'Isentrope Bedingung (3→4)',
      latex: 's_3 = s_4',
      variables: ['s3', 's4'],
      solveFor: { 's3': 's4', 's4': 's3' },
      latexSteps: {
        's3': {
          rearranged: 's_3 = s_4',
          explanation: 'Adiabate Expansion 3→4: Entropie bleibt konstant (s3 = s4)',
        },
        's4': {
          rearranged: 's_4 = s_3',
          explanation: 'Adiabate Expansion 3→4: Entropie bleibt konstant (s4 = s3)',
        },
      },
      category: 'Zustandsänderungen',
    },
  ] as Formula[]
}

/**
 * Absolute specific entropy for ideal gas at each state point.
 * Reference state: T0 = 273.15 K, p0 = 101325 Pa, s0 = 0
 *
 * s_i = cp · ln(T_i / T0) - Rs · ln(p_i / p0)
 */
function generateAbsoluteEntropyFormulas(): Formula[] {
  return [1, 2, 3, 4].map(i => ({
    id: `entropy_abs_${i}`,
    name: `Absolute Entropie (Zustand ${i})`,
    latex: `s_${i} = c_p \\cdot \\ln\\frac{T_${i}}{T_0} - R_s \\cdot \\ln\\frac{p_${i}}{p_0}`,
    variables: [`s${i}`, 'cp', `T${i}`, 'Rs', `p${i}`],
    solveFor: {
      [`s${i}`]: `cp * log(T${i} / 273.15) - Rs * log(p${i} / 101325)`,
      [`T${i}`]: `273.15 * exp((s${i} + Rs * log(p${i} / 101325)) / cp)`,
      [`p${i}`]: `101325 * exp((cp * log(T${i} / 273.15) - s${i}) / Rs)`,
      'cp': `(s${i} + Rs * log(p${i} / 101325)) / log(T${i} / 273.15)`,
      'Rs': `(cp * log(T${i} / 273.15) - s${i}) / log(p${i} / 101325)`,
    },
    latexSteps: {
      [`s${i}`]: {
        rearranged: `s_${i} = c_p \\cdot \\ln\\frac{T_${i}}{T_0} - R_s \\cdot \\ln\\frac{p_${i}}{p_0}`,
        explanation: `Absolute Entropie am Zustand ${i} (ideales Gas, T₀ = 273{,}15 K, p₀ = 101325 Pa)`,
      },
      [`T${i}`]: {
        rearranged: `T_${i} = T_0 \\cdot e^{\\frac{s_${i} + R_s \\cdot \\ln\\frac{p_${i}}{p_0}}{c_p}}`,
        explanation: `Temperatur aus Entropie und Druck am Zustand ${i}`,
      },
      [`p${i}`]: {
        rearranged: `p_${i} = p_0 \\cdot e^{\\frac{c_p \\cdot \\ln\\frac{T_${i}}{T_0} - s_${i}}{R_s}}`,
        explanation: `Druck aus Entropie und Temperatur am Zustand ${i}`,
      },
      'cp': {
        rearranged: `c_p = \\frac{s_${i} + R_s \\cdot \\ln\\frac{p_${i}}{p_0}}{\\ln\\frac{T_${i}}{T_0}}`,
        explanation: `Spez. Wärmekapazität cp aus Entropie, Temperatur und Druck am Zustand ${i}`,
      },
      'Rs': {
        rearranged: `R_s = \\frac{c_p \\cdot \\ln\\frac{T_${i}}{T_0} - s_${i}}{\\ln\\frac{p_${i}}{p_0}}`,
        explanation: `Spez. Gaskonstante aus Entropie, Temperatur und Druck am Zustand ${i}`,
      },
    },
    category: 'Entropie',
  } as Formula))
}

/**
 * Entropy difference from isothermal heat transfer.
 *
 * Hot isotherm 2→3:  Δs = s3 - s1 = q_in / T3   (since s2 = s1)
 * Cold isotherm 4→1: Δs = s3 - s1 = -q_out / T1  (since s4 = s3, and q_out < 0)
 */
function generateEntropyHeatFormulas(): Formula[] {
  return [
    {
      id: 'delta_s_q_in',
      name: 'Entropie-Differenz aus Wärmezufuhr (2→3)',
      latex: 's_3 - s_1 = \\frac{q_{in}}{T_3}',
      variables: ['s3', 's1', 'q_in', 'T3'],
      solveFor: {
        's3': 's1 + q_in / T3',
        's1': 's3 - q_in / T3',
        'q_in': '(s3 - s1) * T3',
        'T3': 'q_in / (s3 - s1)',
      },
      latexSteps: {
        's3': {
          rearranged: 's_3 = s_1 + \\frac{q_{in}}{T_3}',
          explanation: 'Entropie am heißen Zustand aus kalter Entropie und Wärmezufuhr',
        },
        's1': {
          rearranged: 's_1 = s_3 - \\frac{q_{in}}{T_3}',
          explanation: 'Entropie am kalten Zustand aus heißer Entropie und Wärmezufuhr',
        },
        'q_in': {
          rearranged: 'q_{in} = (s_3 - s_1) \\cdot T_3',
          explanation: 'Zugeführte Wärme aus Entropie-Differenz und heißer Temperatur',
        },
        'T3': {
          rearranged: 'T_3 = \\frac{q_{in}}{s_3 - s_1}',
          explanation: 'Heiße Temperatur aus Wärmezufuhr und Entropie-Differenz',
        },
      },
      category: 'Entropie',
    },
    {
      id: 'delta_s_q_out',
      name: 'Entropie-Differenz aus Wärmeabfuhr (4→1)',
      latex: 's_3 - s_1 = -\\frac{q_{out}}{T_1}',
      variables: ['s3', 's1', 'q_out', 'T1'],
      solveFor: {
        's3': 's1 - q_out / T1',
        's1': 's3 + q_out / T1',
        'q_out': '-(s3 - s1) * T1',
        'T1': '-q_out / (s3 - s1)',
      },
      latexSteps: {
        's3': {
          rearranged: 's_3 = s_1 - \\frac{q_{out}}{T_1}',
          explanation: 'Entropie am heißen Zustand aus kalter Entropie und Wärmeabfuhr (q_out < 0)',
        },
        's1': {
          rearranged: 's_1 = s_3 + \\frac{q_{out}}{T_1}',
          explanation: 'Entropie am kalten Zustand aus heißer Entropie und Wärmeabfuhr',
        },
        'q_out': {
          rearranged: 'q_{out} = -(s_3 - s_1) \\cdot T_1',
          explanation: 'Abgeführte Wärme aus Entropie-Differenz und kalter Temperatur (negativ)',
        },
        'T1': {
          rearranged: 'T_1 = -\\frac{q_{out}}{s_3 - s_1}',
          explanation: 'Kalte Temperatur aus Wärmeabfuhr und Entropie-Differenz',
        },
      },
      category: 'Entropie',
    },
  ] as Formula[]
}

// ===== GENERATOR FUNCTIONS: DENSITY & SPECIFIC VOLUME =====

function generateDensityFormulas(): Formula[] {
  return [1, 2, 3, 4].map(i => ({
    id: `rho_def_${i}`,
    name: `Dichte (Zustand ${i})`,
    latex: `\\rho_${i} = \\frac{m}{V_${i}}`,
    variables: [`rho${i}`, `V${i}`, 'm'],
    solveFor: {
      [`rho${i}`]: `m / V${i}`,
      [`V${i}`]: `m / rho${i}`,
      'm': `rho${i} * V${i}`,
    },
    latexSteps: {
      [`rho${i}`]: {
        rearranged: `\\rho_${i} = \\frac{m}{V_${i}}`,
        explanation: `Dichte aus Masse und Volumen: ρ${i} = m / V${i}`,
      },
      [`V${i}`]: {
        rearranged: `V_${i} = \\frac{m}{\\rho_${i}}`,
        explanation: `Volumen aus Masse und Dichte: V${i} = m / ρ${i}`,
      },
      'm': {
        rearranged: `m = \\rho_${i} \\cdot V_${i}`,
        explanation: `Masse aus Dichte und Volumen: m = ρ${i} · V${i}`,
      },
    },
    category: 'Zustandsgleichung',
  } as Formula))
}

function generateSpecificVolumeFormulas(): Formula[] {
  return [1, 2, 3, 4].map(i => ({
    id: `v_def_${i}`,
    name: `Spezifisches Volumen (Zustand ${i})`,
    latex: `v_${i} = \\frac{V_${i}}{m}`,
    variables: [`v${i}`, `V${i}`, 'm'],
    solveFor: {
      [`v${i}`]: `V${i} / m`,
      [`V${i}`]: `v${i} * m`,
      'm': `V${i} / v${i}`,
    },
    latexSteps: {
      [`v${i}`]: {
        rearranged: `v_${i} = \\frac{V_${i}}{m}`,
        explanation: `Spezifisches Volumen: v${i} = V${i} / m`,
      },
      [`V${i}`]: {
        rearranged: `V_${i} = v_${i} \\cdot m`,
        explanation: `Volumen aus spez. Volumen und Masse: V${i} = v${i} · m`,
      },
      'm': {
        rearranged: `m = \\frac{V_${i}}{v_${i}}`,
        explanation: `Masse aus Volumen und spez. Volumen: m = V${i} / v${i}`,
      },
    },
    category: 'Zustandsgleichung',
  } as Formula))
}

function generateRhoVRelationFormulas(): Formula[] {
  return [1, 2, 3, 4].map(i => ({
    id: `rho_v_${i}`,
    name: `Dichte-Spez.Volumen (Zustand ${i})`,
    latex: `\\rho_${i} = \\frac{1}{v_${i}}`,
    variables: [`rho${i}`, `v${i}`],
    solveFor: {
      [`rho${i}`]: `1 / v${i}`,
      [`v${i}`]: `1 / rho${i}`,
    },
    latexSteps: {
      [`rho${i}`]: {
        rearranged: `\\rho_${i} = \\frac{1}{v_${i}}`,
        explanation: `Dichte ist Kehrwert des spez. Volumens: ρ${i} = 1 / v${i}`,
      },
      [`v${i}`]: {
        rearranged: `v_${i} = \\frac{1}{\\rho_${i}}`,
        explanation: `Spez. Volumen ist Kehrwert der Dichte: v${i} = 1 / ρ${i}`,
      },
    },
    category: 'Zustandsgleichung',
  } as Formula))
}

function generateIdealGasRhoFormulas(): Formula[] {
  return [1, 2, 3, 4].map(i => ({
    id: `ideal_gas_rho_${i}`,
    name: `Ideale Gasgleichung mit Dichte (Zustand ${i})`,
    latex: `p_${i} = \\rho_${i} \\cdot R_s \\cdot T_${i}`,
    variables: [`p${i}`, `rho${i}`, 'Rs', `T${i}`],
    solveFor: {
      [`p${i}`]: `rho${i} * Rs * T${i}`,
      [`rho${i}`]: `p${i} / (Rs * T${i})`,
      'Rs': `p${i} / (rho${i} * T${i})`,
      [`T${i}`]: `p${i} / (rho${i} * Rs)`,
    },
    latexSteps: {
      [`p${i}`]: {
        rearranged: `p_${i} = \\rho_${i} \\cdot R_s \\cdot T_${i}`,
        explanation: `Ideale Gasgleichung mit Dichte: p${i} = ρ${i} · Rs · T${i}`,
      },
      [`rho${i}`]: {
        rearranged: `\\rho_${i} = \\frac{p_${i}}{R_s \\cdot T_${i}}`,
        explanation: `Dichte aus Druck und Temperatur: ρ${i} = p${i} / (Rs · T${i})`,
      },
      'Rs': {
        rearranged: `R_s = \\frac{p_${i}}{\\rho_${i} \\cdot T_${i}}`,
        explanation: `Spez. Gaskonstante: Rs = p${i} / (ρ${i} · T${i})`,
      },
      [`T${i}`]: {
        rearranged: `T_${i} = \\frac{p_${i}}{\\rho_${i} \\cdot R_s}`,
        explanation: `Temperatur aus Druck und Dichte: T${i} = p${i} / (ρ${i} · Rs)`,
      },
    },
    category: 'Zustandsgleichung',
  } as Formula))
}

function generateIdealGasSpecVolumeFormulas(): Formula[] {
  return [1, 2, 3, 4].map(i => ({
    id: `ideal_gas_v_${i}`,
    name: `Ideale Gasgleichung spez. Volumen (Zustand ${i})`,
    latex: `p_${i} \\cdot v_${i} = R_s \\cdot T_${i}`,
    variables: [`p${i}`, `v${i}`, 'Rs', `T${i}`],
    solveFor: {
      [`p${i}`]: `Rs * T${i} / v${i}`,
      [`v${i}`]: `Rs * T${i} / p${i}`,
      'Rs': `p${i} * v${i} / T${i}`,
      [`T${i}`]: `p${i} * v${i} / Rs`,
    },
    latexSteps: {
      [`p${i}`]: {
        rearranged: `p_${i} = \\frac{R_s \\cdot T_${i}}{v_${i}}`,
        explanation: `Druck aus spez. Volumen: p${i} = Rs · T${i} / v${i}`,
      },
      [`v${i}`]: {
        rearranged: `v_${i} = \\frac{R_s \\cdot T_${i}}{p_${i}}`,
        explanation: `Spez. Volumen: v${i} = Rs · T${i} / p${i}`,
      },
      'Rs': {
        rearranged: `R_s = \\frac{p_${i} \\cdot v_${i}}{T_${i}}`,
        explanation: `Spez. Gaskonstante: Rs = p${i} · v${i} / T${i}`,
      },
      [`T${i}`]: {
        rearranged: `T_${i} = \\frac{p_${i} \\cdot v_${i}}{R_s}`,
        explanation: `Temperatur: T${i} = p${i} · v${i} / Rs`,
      },
    },
    category: 'Zustandsgleichung',
  } as Formula))
}

// ===== GENERATOR FUNCTIONS FOR REPETITIVE FORMULAS =====

/**
 * Adiabatic T-V relations (extensive volume).
 * Only for the adiabatic transitions in Carnot: 1→2 and 3→4.
 * No applicableProcesses filter: always active (Carnot cycle structure is fixed).
 */
function generateAdiabaticTVFormulas(): Formula[] {
  const pairs = [[1, 2], [3, 4]] // Carnot: 1→2 adiabatic compression, 3→4 adiabatic expansion
  return pairs.map(([a, b]) => ({
    id: `adiabatic_TV_${a}_${b}`,
    name: `Adiabate T-V-Beziehung (${a}→${b})`,
    latex: `T_${a} \\cdot V_${a}^{\\kappa-1} = T_${b} \\cdot V_${b}^{\\kappa-1}`,
    variables: [`T${a}`, `V${a}`, `T${b}`, `V${b}`, 'kappa'],
    solveFor: {
      [`T${b}`]: `T${a} * (V${a} / V${b}) ^ (kappa - 1)`,
      [`T${a}`]: `T${b} * (V${b} / V${a}) ^ (kappa - 1)`,
      [`V${b}`]: `V${a} * (T${a} / T${b}) ^ (1 / (kappa - 1))`,
      [`V${a}`]: `V${b} * (T${b} / T${a}) ^ (1 / (kappa - 1))`,
    },
    latexSteps: {
      [`T${b}`]: {
        rearranged: `T_${b} = T_${a} \\cdot \\left(\\frac{V_${a}}{V_${b}}\\right)^{\\kappa-1}`,
        explanation: `Adiabate T-V-Beziehung nach T${b} umgestellt`,
      },
      [`T${a}`]: {
        rearranged: `T_${a} = T_${b} \\cdot \\left(\\frac{V_${b}}{V_${a}}\\right)^{\\kappa-1}`,
        explanation: `Adiabate T-V-Beziehung nach T${a} umgestellt`,
      },
      [`V${b}`]: {
        rearranged: `V_${b} = V_${a} \\cdot \\left(\\frac{T_${a}}{T_${b}}\\right)^{\\frac{1}{\\kappa-1}}`,
        explanation: `Adiabate T-V-Beziehung nach V${b} umgestellt`,
      },
      [`V${a}`]: {
        rearranged: `V_${a} = V_${b} \\cdot \\left(\\frac{T_${b}}{T_${a}}\\right)^{\\frac{1}{\\kappa-1}}`,
        explanation: `Adiabate T-V-Beziehung nach V${a} umgestellt`,
      },
    },
    category: 'Zustandsänderungen',
  } as Formula))
}

/**
 * Adiabatic p-V relations (extensive volume).
 * Only for the adiabatic transitions in Carnot: 1→2 and 3→4.
 */
function generateAdiabaticPVFormulas(): Formula[] {
  const pairs = [[1, 2], [3, 4]] // Carnot: 1→2 adiabatic compression, 3→4 adiabatic expansion
  return pairs.map(([a, b]) => ({
    id: `adiabatic_pV_${a}_${b}`,
    name: `Adiabate p-V-Beziehung (${a}→${b})`,
    latex: `p_${a} \\cdot V_${a}^{\\kappa} = p_${b} \\cdot V_${b}^{\\kappa}`,
    variables: [`p${a}`, `V${a}`, `p${b}`, `V${b}`, 'kappa'],
    solveFor: {
      [`p${b}`]: `p${a} * (V${a} / V${b}) ^ kappa`,
      [`p${a}`]: `p${b} * (V${b} / V${a}) ^ kappa`,
      [`V${b}`]: `V${a} * (p${a} / p${b}) ^ (1 / kappa)`,
      [`V${a}`]: `V${b} * (p${b} / p${a}) ^ (1 / kappa)`,
    },
    latexSteps: {
      [`p${b}`]: {
        rearranged: `p_${b} = p_${a} \\cdot \\left(\\frac{V_${a}}{V_${b}}\\right)^{\\kappa}`,
        explanation: `Adiabate p-V-Beziehung nach p${b} umgestellt`,
      },
      [`p${a}`]: {
        rearranged: `p_${a} = p_${b} \\cdot \\left(\\frac{V_${b}}{V_${a}}\\right)^{\\kappa}`,
        explanation: `Adiabate p-V-Beziehung nach p${a} umgestellt`,
      },
      [`V${b}`]: {
        rearranged: `V_${b} = V_${a} \\cdot \\left(\\frac{p_${a}}{p_${b}}\\right)^{\\frac{1}{\\kappa}}`,
        explanation: `Adiabate p-V-Beziehung nach V${b} umgestellt`,
      },
      [`V${a}`]: {
        rearranged: `V_${a} = V_${b} \\cdot \\left(\\frac{p_${b}}{p_${a}}\\right)^{\\frac{1}{\\kappa}}`,
        explanation: `Adiabate p-V-Beziehung nach V${a} umgestellt`,
      },
    },
    category: 'Zustandsänderungen',
  } as Formula))
}

/**
 * Adiabatic T-v relations using SPECIFIC volume (v = V/m).
 * T_a * v_a^(κ-1) = T_b * v_b^(κ-1)
 * Only for Carnot adiabatic transitions: 1→2 and 3→4.
 * These allow the solver to propagate through the cycle without needing mass m.
 */
function generateAdiabaticTvFormulas(): Formula[] {
  const pairs = [[1, 2], [3, 4]]
  return pairs.map(([a, b]) => ({
    id: `adiabatic_Tv_${a}_${b}`,
    name: `Adiabate T-v-Beziehung spez. (${a}→${b})`,
    latex: `T_${a} \\cdot v_${a}^{\\kappa-1} = T_${b} \\cdot v_${b}^{\\kappa-1}`,
    variables: [`T${a}`, `v${a}`, `T${b}`, `v${b}`, 'kappa'],
    solveFor: {
      [`T${b}`]: `T${a} * (v${a} / v${b}) ^ (kappa - 1)`,
      [`T${a}`]: `T${b} * (v${b} / v${a}) ^ (kappa - 1)`,
      [`v${b}`]: `v${a} * (T${a} / T${b}) ^ (1 / (kappa - 1))`,
      [`v${a}`]: `v${b} * (T${b} / T${a}) ^ (1 / (kappa - 1))`,
    },
    latexSteps: {
      [`T${b}`]: {
        rearranged: `T_${b} = T_${a} \\cdot \\left(\\frac{v_${a}}{v_${b}}\\right)^{\\kappa-1}`,
        explanation: `Adiabate T-v-Beziehung (spez. Volumen) nach T${b} umgestellt`,
      },
      [`T${a}`]: {
        rearranged: `T_${a} = T_${b} \\cdot \\left(\\frac{v_${b}}{v_${a}}\\right)^{\\kappa-1}`,
        explanation: `Adiabate T-v-Beziehung (spez. Volumen) nach T${a} umgestellt`,
      },
      [`v${b}`]: {
        rearranged: `v_${b} = v_${a} \\cdot \\left(\\frac{T_${a}}{T_${b}}\\right)^{\\frac{1}{\\kappa-1}}`,
        explanation: `Adiabate T-v-Beziehung (spez. Volumen) nach v${b} umgestellt`,
      },
      [`v${a}`]: {
        rearranged: `v_${a} = v_${b} \\cdot \\left(\\frac{T_${b}}{T_${a}}\\right)^{\\frac{1}{\\kappa-1}}`,
        explanation: `Adiabate T-v-Beziehung (spez. Volumen) nach v${a} umgestellt`,
      },
    },
    category: 'Zustandsänderungen',
  } as Formula))
}

/**
 * Adiabatic p-v relations using SPECIFIC volume.
 * p_a * v_a^κ = p_b * v_b^κ
 * Only for Carnot adiabatic transitions: 1→2 and 3→4.
 */
function generateAdiabaticPvFormulas(): Formula[] {
  const pairs = [[1, 2], [3, 4]]
  return pairs.map(([a, b]) => ({
    id: `adiabatic_pv_${a}_${b}`,
    name: `Adiabate p-v-Beziehung spez. (${a}→${b})`,
    latex: `p_${a} \\cdot v_${a}^{\\kappa} = p_${b} \\cdot v_${b}^{\\kappa}`,
    variables: [`p${a}`, `v${a}`, `p${b}`, `v${b}`, 'kappa'],
    solveFor: {
      [`p${b}`]: `p${a} * (v${a} / v${b}) ^ kappa`,
      [`p${a}`]: `p${b} * (v${b} / v${a}) ^ kappa`,
      [`v${b}`]: `v${a} * (p${a} / p${b}) ^ (1 / kappa)`,
      [`v${a}`]: `v${b} * (p${b} / p${a}) ^ (1 / kappa)`,
    },
    latexSteps: {
      [`p${b}`]: {
        rearranged: `p_${b} = p_${a} \\cdot \\left(\\frac{v_${a}}{v_${b}}\\right)^{\\kappa}`,
        explanation: `Adiabate p-v-Beziehung (spez. Volumen) nach p${b} umgestellt`,
      },
      [`p${a}`]: {
        rearranged: `p_${a} = p_${b} \\cdot \\left(\\frac{v_${b}}{v_${a}}\\right)^{\\kappa}`,
        explanation: `Adiabate p-v-Beziehung (spez. Volumen) nach p${a} umgestellt`,
      },
      [`v${b}`]: {
        rearranged: `v_${b} = v_${a} \\cdot \\left(\\frac{p_${a}}{p_${b}}\\right)^{\\frac{1}{\\kappa}}`,
        explanation: `Adiabate p-v-Beziehung (spez. Volumen) nach v${b} umgestellt`,
      },
      [`v${a}`]: {
        rearranged: `v_${a} = v_${b} \\cdot \\left(\\frac{p_${b}}{p_${a}}\\right)^{\\frac{1}{\\kappa}}`,
        explanation: `Adiabate p-v-Beziehung (spez. Volumen) nach v${a} umgestellt`,
      },
    },
    category: 'Zustandsänderungen',
  } as Formula))
}

/**
 * Isothermal temperature constraints for the Carnot cycle.
 *
 * Convention: 1→2 and 3→4 are ADIABATIC; 2→3 and 4→1 are ISOTHERMAL.
 *   T2 = T3 = T_warm (hot isotherm 2→3)
 *   T4 = T1 = T_cold (cold isotherm 4→1)
 *
 * Always active — the Carnot process structure is fixed by definition.
 */
function generateIsothermalTFormulas(): Formula[] {
  return [
    {
      id: 'isothermal_T_23',
      name: 'Isotherme Bedingung (2→3, heiß)',
      latex: 'T_2 = T_3',
      variables: ['T2', 'T3'],
      solveFor: {
        'T2': 'T3',
        'T3': 'T2',
      },
      latexSteps: {
        'T2': {
          rearranged: 'T_2 = T_3',
          explanation: 'Isotherme Expansion 2→3: Temperatur bleibt konstant (T2 = T3 = T_warm)',
        },
        'T3': {
          rearranged: 'T_3 = T_2',
          explanation: 'Isotherme Expansion 2→3: Temperatur bleibt konstant (T3 = T2 = T_warm)',
        },
      },
      category: 'Zustandsänderungen',
    },
    {
      id: 'isothermal_T_41',
      name: 'Isotherme Bedingung (4→1, kalt)',
      latex: 'T_4 = T_1',
      variables: ['T4', 'T1'],
      solveFor: {
        'T4': 'T1',
        'T1': 'T4',
      },
      latexSteps: {
        'T4': {
          rearranged: 'T_4 = T_1',
          explanation: 'Isotherme Kompression 4→1: Temperatur bleibt konstant (T4 = T1 = T_kalt)',
        },
        'T1': {
          rearranged: 'T_1 = T_4',
          explanation: 'Isotherme Kompression 4→1: Temperatur bleibt konstant (T1 = T4 = T_kalt)',
        },
      },
      category: 'Zustandsänderungen',
    },
  ] as Formula[]
}

/**
 * Isothermal heat formulas using the ideal gas relation.
 * For an isothermal process: q = Rs * T * ln(v_end / v_start)
 *
 * Hot isotherm 2→3 (expansion): q_in = Rs * T3 * ln(v3 / v2)
 * Cold isotherm 4→1 (compression): q_out = Rs * T1 * ln(v1 / v4)  [negative = heat rejected]
 *
 * These allow the solver to compute v2/v3 from q_in (or v1/v4 from q_out).
 */
function generateIsothermalHeatFormulas(): Formula[] {
  return [
    {
      id: 'q_in_isothermal',
      name: 'Wärme der isothermen Expansion (2→3)',
      latex: 'q_{in} = R_s \\cdot T_3 \\cdot \\ln\\frac{v_3}{v_2}',
      variables: ['q_in', 'Rs', 'T3', 'v3', 'v2'],
      solveFor: {
        'q_in': 'Rs * T3 * log(v3 / v2)',
        'v3':   'v2 * exp(q_in / (Rs * T3))',
        'v2':   'v3 * exp(-(q_in / (Rs * T3)))',
        'Rs':   'q_in / (T3 * log(v3 / v2))',
        'T3':   'q_in / (Rs * log(v3 / v2))',
      },
      latexSteps: {
        'q_in': {
          rearranged: 'q_{in} = R_s \\cdot T_3 \\cdot \\ln\\frac{v_3}{v_2}',
          explanation: 'Wärme der isothermen Expansion 2→3 (ideales Gas)',
        },
        'v3': {
          rearranged: 'v_3 = v_2 \\cdot e^{\\frac{q_{in}}{R_s \\cdot T_3}}',
          explanation: 'Spez. Endvolumen der Expansion aus Wärme',
        },
        'v2': {
          rearranged: 'v_2 = v_3 \\cdot e^{-\\frac{q_{in}}{R_s \\cdot T_3}}',
          explanation: 'Spez. Startvolumen der Expansion aus Wärme',
        },
        'Rs': {
          rearranged: 'R_s = \\frac{q_{in}}{T_3 \\cdot \\ln\\frac{v_3}{v_2}}',
          explanation: 'Spez. Gaskonstante aus isothermem Wärmeumsatz',
        },
        'T3': {
          rearranged: 'T_3 = \\frac{q_{in}}{R_s \\cdot \\ln\\frac{v_3}{v_2}}',
          explanation: 'Warme Temperatur aus isothermem Wärmeumsatz',
        },
      },
      category: 'Wärme',
    },
    {
      id: 'q_out_isothermal',
      name: 'Wärme der isothermen Kompression (4→1)',
      // Sign convention: q_out < 0 (heat leaves the system during compression 4→1).
      // From ∫p dV: q_41 = Rs·T1·ln(v1/v4) < 0 since v1 < v4 (compression).
      latex: 'q_{out} = R_s \\cdot T_1 \\cdot \\ln\\frac{v_1}{v_4}',
      variables: ['q_out', 'Rs', 'T1', 'v4', 'v1'],
      solveFor: {
        // q_out = Rs·T1·ln(v1/v4) < 0  (v1 < v4 → ln < 0)
        'q_out': 'Rs * T1 * log(v1 / v4)',
        // Inverse: ln(v1/v4) = q_out/(Rs·T1) → v4 = v1 / exp(q_out/(Rs·T1)) = v1·exp(-q_out/(Rs·T1))
        'v4':    'v1 * exp(-(q_out / (Rs * T1)))',
        // v1 = v4·exp(q_out/(Rs·T1))  (q_out<0 → exp<1 → v1<v4 ✓)
        'v1':    'v4 * exp(q_out / (Rs * T1))',
        // Rs = q_out / (T1·ln(v1/v4))  (both numerator and denominator negative → Rs>0 ✓)
        'Rs':    'q_out / (T1 * log(v1 / v4))',
        'T1':    'q_out / (Rs * log(v1 / v4))',
      },
      latexSteps: {
        'q_out': {
          rearranged: 'q_{out} = R_s \\cdot T_1 \\cdot \\ln\\frac{v_1}{v_4}',
          explanation: 'Wärme der isothermen Kompression 4→1 (negativ: Wärme verlässt das System)',
        },
        'v4': {
          rearranged: 'v_4 = v_1 \\cdot e^{-\\frac{q_{out}}{R_s \\cdot T_1}}',
          explanation: 'Spez. Startvolumen der Kompression aus abgeführter Wärme',
        },
        'v1': {
          rearranged: 'v_1 = v_4 \\cdot e^{\\frac{q_{out}}{R_s \\cdot T_1}}',
          explanation: 'Spez. Endvolumen der Kompression aus abgeführter Wärme',
        },
        'Rs': {
          rearranged: 'R_s = \\frac{q_{out}}{T_1 \\cdot \\ln\\frac{v_1}{v_4}}',
          explanation: 'Spez. Gaskonstante aus isothermem Wärmeumsatz',
        },
        'T1': {
          rearranged: 'T_1 = \\frac{q_{out}}{R_s \\cdot \\ln\\frac{v_1}{v_4}}',
          explanation: 'Kalte Temperatur aus isothermem Wärmeumsatz',
        },
      },
      category: 'Wärme',
    },
  ] as Formula[]
}

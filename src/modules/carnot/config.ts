import type { Variable, ProcessType } from '../../core/types'

// ============ PROCESS TYPES ============

export const PROCESSES: ProcessType[] = [
  {
    id: 'isothermal',
    name: 'Isotherm',
    description: 'T = const, Wärmeaustausch bei konstanter Temperatur',
    constraints: ['T2 = T3 (heiß) oder T4 = T1 (kalt)'],
  },
  {
    id: 'adiabatic',
    name: 'Adiabat (Isentrop)',
    description: 'q = 0, kein Wärmeaustausch mit Umgebung',
    constraints: ['q = 0', 's = const'],
  },
  {
    id: 'isobaric',
    name: 'Isobar',
    description: 'p = const, konstanter Druck',
    constraints: ['p1 = p2'],
  },
  {
    id: 'isochoric',
    name: 'Isochor',
    description: 'V = const, konstantes Volumen',
    constraints: ['V1 = V2'],
  },
]

// ============ HELPER: create state variables ============

function stateVar(stateNum: number, baseId: string, symbol: string, latex: string, name: string, defaultUnit: string, altUnits: string[], constraints?: Variable['constraints']): Variable {
  return {
    id: `${baseId}${stateNum}`,
    symbol: `${symbol}${String.fromCharCode(8320 + stateNum)}`,  // subscript number
    latex: `${latex}_${stateNum}`,
    name: `${name} (Zustand ${stateNum})`,
    defaultUnit,
    alternativeUnits: altUnits,
    constraints,
    group: `Zustand ${stateNum}`,
  }
}

// ============ STATE VARIABLES (Z1-Z4) ============

const stateVariables: Variable[] = []

for (let i = 1; i <= 4; i++) {
  stateVariables.push(
    stateVar(i, 'p', 'p', 'p', 'Druck', 'Pa', ['kPa', 'bar', 'MPa', 'atm'], [
      { type: 'positive', message: `Druck p${i} muss positiv sein` },
    ]),
    stateVar(i, 'V', 'V', 'V', 'Volumen', 'm^3', ['L', 'cm^3'], [
      { type: 'positive', message: `Volumen V${i} muss positiv sein` },
    ]),
    stateVar(i, 'T', 'T', 'T', 'Temperatur', 'K', ['degC'], [
      { type: 'positive', message: `Temperatur T${i} muss positiv sein (in Kelvin)` },
    ]),
    stateVar(i, 'rho', 'ρ', '\\rho', 'Dichte', 'kg/m^3', ['g/L'], [
      { type: 'positive', message: `Dichte ρ${i} muss positiv sein` },
    ]),
    stateVar(i, 'v', 'v', 'v', 'Spezifisches Volumen', 'm^3/kg', ['L/kg'], [
      { type: 'positive', message: `Spezifisches Volumen v${i} muss positiv sein` },
    ]),
    stateVar(i, 's', 's', 's', 'Spezifische Entropie', 'J/(kg*K)', ['kJ/(kg*K)']),
  )
}

// ============ GLOBAL VARIABLES ============

const globalVariables: Variable[] = [
  {
    id: 'm',
    symbol: 'm',
    latex: 'm',
    name: 'Gasmasse',
    defaultUnit: 'kg',
    alternativeUnits: ['g'],
    constraints: [{ type: 'positive', message: 'Masse muss positiv sein' }],
    group: 'Stoffeigenschaften',
  },
  {
    id: 'Rs',
    symbol: 'Rₛ',
    latex: 'R_s',
    name: 'Spezifische Gaskonstante',
    defaultUnit: 'J/(kg*K)',
    alternativeUnits: [],
    constraints: [{ type: 'positive', message: 'Rs muss positiv sein' }],
    group: 'Stoffeigenschaften',
  },
  {
    id: 'M',
    symbol: 'M',
    latex: 'M',
    name: 'Molare Masse',
    defaultUnit: 'kg/mol',
    alternativeUnits: ['g/mol'],
    constraints: [{ type: 'positive', message: 'Molare Masse muss positiv sein' }],
    group: 'Stoffeigenschaften',
  },
  {
    id: 'kappa',
    symbol: 'κ',
    latex: '\\kappa',
    name: 'Isentropenexponent',
    defaultUnit: '',
    alternativeUnits: [],
    constraints: [
      { type: 'greaterThan', value: 1, message: 'κ muss > 1 sein' },
      { type: 'max', value: 2, message: 'κ muss ≤ 2 sein (physikalisch sinnvoll)' },
    ],
    group: 'Stoffeigenschaften',
  },
  {
    id: 'cv',
    symbol: 'cᵥ',
    latex: 'c_v',
    name: 'Spezifische Wärmekapazität bei konst. Volumen',
    defaultUnit: 'J/(kg*K)',
    alternativeUnits: ['kJ/(kg*K)'],
    constraints: [{ type: 'positive', message: 'cv muss positiv sein' }],
    group: 'Stoffeigenschaften',
  },
  {
    id: 'cp',
    symbol: 'cₚ',
    latex: 'c_p',
    name: 'Spezifische Wärmekapazität bei konst. Druck',
    defaultUnit: 'J/(kg*K)',
    alternativeUnits: ['kJ/(kg*K)'],
    constraints: [{ type: 'positive', message: 'cp muss positiv sein' }],
    group: 'Stoffeigenschaften',
  },
  {
    id: 'q_in',
    symbol: 'qᵢₙ',
    latex: 'q_{in}',
    name: 'Zugeführte spezifische Wärme',
    defaultUnit: 'J/kg',
    alternativeUnits: ['kJ/kg'],
    constraints: [{ type: 'greaterThan', value: 0, message: 'q_in muss für die Carnot-Kraftmaschine > 0 sein' }],
    group: 'Energiebilanz',
  },
  {
    id: 'q_out',
    symbol: 'qₒᵤₜ',
    latex: 'q_{out}',
    name: 'Abgeführte spezifische Wärme',
    defaultUnit: 'J/kg',
    alternativeUnits: ['kJ/kg'],
    constraints: [{ type: 'lessThan', value: 0, message: 'q_out muss für die Carnot-Kraftmaschine < 0 sein' }],
    group: 'Energiebilanz',
  },
  {
    id: 'w_netto',
    symbol: 'wₙₑₜₜₒ',
    latex: 'w_{netto}',
    name: 'Spezifische Netto-Arbeit',
    defaultUnit: 'J/kg',
    alternativeUnits: ['kJ/kg'],
    constraints: [{ type: 'lessThan', value: 0, message: 'w_netto muss für abgegebene Arbeit < 0 sein' }],
    group: 'Energiebilanz',
  },
  {
    id: 'eta',
    symbol: 'η',
    latex: '\\eta',
    name: 'Thermischer Wirkungsgrad',
    defaultUnit: '',
    alternativeUnits: [],
    constraints: [
      { type: 'greaterThan', value: 0, message: 'Wirkungsgrad muss für einen nicht-degenerierten Kreisprozess > 0 sein' },
      { type: 'max', value: 1, message: 'Wirkungsgrad muss ≤ 1 sein' },
    ],
    group: 'Energiebilanz',
  },
]

export const ALL_VARIABLES: Variable[] = [...stateVariables, ...globalVariables]

export const VARIABLE_GROUPS = [
  'Zustand 1',
  'Zustand 2',
  'Zustand 3',
  'Zustand 4',
  'Stoffeigenschaften',
  'Energiebilanz',
]

import type { ProcessType, Variable } from '../../core/types'
import type { PlannedExecutionConfig } from '../../core/solver'
import type { PreconditionOutcome } from '../../core/derivation-planner'
import type { DirectionPolicy } from '../../core/solve-directions'
import { validateJouleCycle } from './validation'

export const PROCESSES: ProcessType[] = [
  { id: 'adiabatic', name: 'Adiabat (isentrop)', description: 'q = 0, s = const', constraints: ['q = 0', 's = const'] },
  { id: 'isobaric', name: 'Isobar', description: 'p = const', constraints: ['p2 = p3', 'p4 = p1'] },
]

function stateVariable(state: number, id: 'p' | 'v' | 'T' | 's', symbol: string, latex: string, name: string, unit: string, alternativeUnits: string[], constraints?: Variable['constraints']): Variable {
  return { id: id + state, symbol: symbol + String.fromCharCode(8320 + state), latex: latex + '_' + state, name: name + ' (Zustand ' + state + ')', defaultUnit: unit, alternativeUnits, constraints, group: 'Zustand ' + state }
}

const stateVariables: Variable[] = []
for (let state = 1; state <= 4; state++) {
  stateVariables.push(
    stateVariable(state, 'p', 'p', 'p', 'Druck', 'Pa', ['kPa', 'bar', 'MPa', 'atm'], [{ type: 'positive', message: 'Druck p' + state + ' muss positiv sein' }]),
    stateVariable(state, 'v', 'v', 'v', 'Spezifisches Volumen', 'm^3/kg', ['L/kg'], [{ type: 'positive', message: 'Spezifisches Volumen v' + state + ' muss positiv sein' }]),
    stateVariable(state, 'T', 'T', 'T', 'Temperatur', 'K', ['degC'], [{ type: 'positive', message: 'Temperatur T' + state + ' muss positiv sein (in Kelvin)' }]),
    stateVariable(state, 's', 's', 's', 'Spezifische Entropie', 'J/(kg*K)', ['kJ/(kg*K)']),
  )
}

const cycleVariables: Variable[] = [
  { id: 'pressureRatio', symbol: 'rₚ', latex: 'r_p', name: 'Druckverhältnis', defaultUnit: '', alternativeUnits: [], constraints: [{ type: 'greaterThan', value: 1, message: 'Druckverhältnis r_p muss > 1 sein' }], group: 'Kreisprozessparameter' },
  { id: 'Rs', symbol: 'Rₛ', latex: 'R_s', name: 'Spezifische Gaskonstante', defaultUnit: 'J/(kg*K)', alternativeUnits: [], constraints: [{ type: 'positive', message: 'Rs muss positiv sein' }], group: 'Stoffeigenschaften' },
  { id: 'kappa', symbol: 'κ', latex: 'κ', name: 'Isentropenexponent', defaultUnit: '', alternativeUnits: [], constraints: [{ type: 'greaterThan', value: 1, message: 'κ muss > 1 sein' }, { type: 'max', value: 2, message: 'κ muss ≤ 2 sein (physikalisch sinnvoll)' }], group: 'Stoffeigenschaften' },
  { id: 'cv', symbol: 'cᵥ', latex: 'c_v', name: 'Spezifische Wärmekapazität bei konstantem Volumen', defaultUnit: 'J/(kg*K)', alternativeUnits: ['kJ/(kg*K)'], constraints: [{ type: 'positive', message: 'cv muss positiv sein' }], group: 'Stoffeigenschaften' },
  { id: 'cp', symbol: 'cₚ', latex: 'c_p', name: 'Spezifische Wärmekapazität bei konstantem Druck', defaultUnit: 'J/(kg*K)', alternativeUnits: ['kJ/(kg*K)'], constraints: [{ type: 'positive', message: 'cp muss positiv sein' }], group: 'Stoffeigenschaften' },
  { id: 'q_in', symbol: 'qᵢₙ', latex: 'q_{in}', name: 'Zugeführte spezifische Wärme', defaultUnit: 'J/kg', alternativeUnits: ['kJ/kg'], constraints: [{ type: 'greaterThan', value: 0, message: 'q_in muss für die Joule-Kraftmaschine > 0 sein' }], group: 'Energiebilanz' },
  { id: 'q_out', symbol: 'qₒᵤₜ', latex: 'q_{out}', name: 'Abgeführte spezifische Wärme', defaultUnit: 'J/kg', alternativeUnits: ['kJ/kg'], constraints: [{ type: 'lessThan', value: 0, message: 'q_out muss für die Joule-Kraftmaschine < 0 sein' }], group: 'Energiebilanz' },
  { id: 'w_comp', symbol: 'w_c', latex: 'w_{comp}', name: 'Spezifische Verdichterarbeit', defaultUnit: 'J/kg', alternativeUnits: ['kJ/kg'], constraints: [{ type: 'greaterThan', value: 0, message: 'w_comp muss für den Verdichter > 0 sein' }], group: 'Energiebilanz' },
  { id: 'w_turb', symbol: 'w_t', latex: 'w_{turb}', name: 'Spezifische Turbinenarbeit', defaultUnit: 'J/kg', alternativeUnits: ['kJ/kg'], constraints: [{ type: 'lessThan', value: 0, message: 'w_turb muss für die Turbine < 0 sein' }], group: 'Energiebilanz' },
  { id: 'w_netto', symbol: 'wₙₑₜₜₒ', latex: 'w_{netto}', name: 'Spezifische Netto-Arbeit', defaultUnit: 'J/kg', alternativeUnits: ['kJ/kg'], constraints: [{ type: 'lessThan', value: 0, message: 'w_netto muss für abgegebene Arbeit < 0 sein' }], group: 'Energiebilanz' },
  { id: 'eta', symbol: 'η', latex: 'η', name: 'Thermischer Wirkungsgrad', defaultUnit: '', alternativeUnits: [], constraints: [{ type: 'greaterThan', value: 0, message: 'Wirkungsgrad muss > 0 sein' }, { type: 'max', value: 1, message: 'Wirkungsgrad muss ≤ 1 sein' }], group: 'Energiebilanz' },
  { id: 'back_work_ratio', symbol: 'BWR', latex: 'BWR', name: 'Back-Work-Ratio', defaultUnit: '', alternativeUnits: [], constraints: [{ type: 'greaterThan', value: 0, message: 'BWR muss > 0 sein' }, { type: 'max', value: 1, message: 'BWR muss < 1 sein' }], group: 'Energiebilanz' },
]

export const ALL_VARIABLES = [...stateVariables, ...cycleVariables]
export const VARIABLE_GROUPS = ['Zustand 1', 'Zustand 2', 'Zustand 3', 'Zustand 4', 'Kreisprozessparameter', 'Stoffeigenschaften', 'Energiebilanz']


const heatInputConditions = [{ id: 'positive-cp-and-q-in' }]
const heatRejectionConditions = [{ id: 'positive-cp-and-negative-q-out' }]
const idealEtaConditions = [{ id: 'kappa-and-pressure-ratio-domain' }]
const idealPressureRatioConditions = [{ id: 'kappa-and-efficiency-domain' }]

function combine(...outcomes: PreconditionOutcome[]): PreconditionOutcome {
  if (outcomes.includes('unsatisfied')) return 'unsatisfied'
  return outcomes.includes('unknown') ? 'unknown' : 'satisfied'
}

function positive(value: number | undefined): PreconditionOutcome {
  return value === undefined ? 'unknown' : value > 0 ? 'satisfied' : 'unsatisfied'
}

function negative(value: number | undefined): PreconditionOutcome {
  return value === undefined ? 'unknown' : value < 0 ? 'satisfied' : 'unsatisfied'
}

function greaterThanOne(value: number | undefined): PreconditionOutcome {
  return value === undefined ? 'unknown' : value > 1 ? 'satisfied' : 'unsatisfied'
}

function efficiencyDomain(value: number | undefined): PreconditionOutcome {
  return value === undefined ? 'unknown' : value > 0 && value < 1 ? 'satisfied' : 'unsatisfied'
}

function positiveCp(values: ReadonlyMap<string, number>): PreconditionOutcome {
  const cp = values.get('cp')
  if (cp !== undefined) return positive(cp)
  // In a frozen Joule scenario cp is known positive when its canonical property roots prove it.
  const rs = values.get('Rs')
  const kappa = values.get('kappa')
  return combine(positive(rs), greaterThanOne(kappa))
}

export const JOULE_DIRECTION_POLICIES: Readonly<Record<string, DirectionPolicy>> = {
  'heat_input:T3': { mode: 'derive', routePriority: 0, conditions: heatInputConditions, sourceRef: 'golden-routes.md#GR-02' },
  'heat_input:T2': { mode: 'derive', routePriority: 0, conditions: heatInputConditions, sourceRef: 'golden-routes.md#direction-policy' },
  'heat_rejection:T1': { mode: 'derive', routePriority: 0, conditions: heatRejectionConditions, sourceRef: 'golden-routes.md#GR-03' },
  'heat_rejection:T4': { mode: 'derive', routePriority: 0, conditions: heatRejectionConditions, sourceRef: 'golden-routes.md#direction-policy' },
  'efficiency:eta': { mode: 'derive', routePriority: 10, sourceRef: 'golden-routes.md#GR-06-energy-primary' },
  'ideal_efficiency:eta': { mode: 'derive', routePriority: 20, conditions: idealEtaConditions, sourceRef: 'golden-routes.md#GR-06-ideal-alternative' },
  'ideal_efficiency:pressureRatio': { mode: 'derive', routePriority: 0, conditions: idealPressureRatioConditions, sourceRef: 'golden-routes.md#GR-03' },
  'ideal_gas_1:Rs': { mode: 'validate-only', sourceRef: 'golden-routes.md#GR-07' },
  'ideal_gas_2:Rs': { mode: 'validate-only', sourceRef: 'golden-routes.md#GR-07' },
  'ideal_gas_3:Rs': { mode: 'validate-only', sourceRef: 'golden-routes.md#GR-07' },
  'ideal_gas_4:Rs': { mode: 'validate-only', sourceRef: 'golden-routes.md#GR-07' },
}

export const joulePreconditionOutcomes: PlannedExecutionConfig['preconditionOutcomes'] = (knownFacts, directions) => {
  const values = new Map(knownFacts.map(fact => [fact.id, fact.valueSI]))
  const outcomes: Record<string, PreconditionOutcome> = {}
  for (const direction of directions) {
    for (const condition of direction.conditions ?? []) {
      const outcome = condition.id === 'positive-cp-and-q-in'
        ? combine(positiveCp(values), positive(values.get('q_in')))
        : condition.id === 'positive-cp-and-negative-q-out'
          ? combine(positiveCp(values), negative(values.get('q_out')))
          : condition.id === 'kappa-and-pressure-ratio-domain'
            ? combine(greaterThanOne(values.get('kappa')), greaterThanOne(values.get('pressureRatio')))
            : condition.id === 'kappa-and-efficiency-domain'
              ? combine(greaterThanOne(values.get('kappa')), efficiencyDomain(values.get('eta')))
              : 'unknown'
      outcomes[`${direction.id}:${condition.id}`] = outcome
    }
  }
  return outcomes
}

export const JOULE_PLANNED_EXECUTION: PlannedExecutionConfig = {
  policies: JOULE_DIRECTION_POLICIES,
  preconditionOutcomes: joulePreconditionOutcomes,
  postValidate: (targetId, values) => validateJouleCycle(values).filter(error => error.variableId === targetId),
}

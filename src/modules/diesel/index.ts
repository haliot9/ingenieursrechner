import type { CalculatorModule } from '../../core/types'
import { ALL_VARIABLES, PROCESSES, VARIABLE_GROUPS } from './config'
import { getDieselDiagramSpec } from './diagram'
import { DIESEL_FORMULAS } from './formulas'
import { validateDieselCycle } from './validation'

export const dieselModule: CalculatorModule = {
  id: 'diesel',
  name: 'Diesel-Prozess',
  description: 'Berechnung der Zustandsgrößen eines idealisierten Luftstandard-Diesel-Kreisprozesses mit isobarer Wärmezufuhr und isochorer Wärmeabfuhr.',
  variables: ALL_VARIABLES,
  formulas: DIESEL_FORMULAS,
  processes: PROCESSES,
  presets: [{
    id: 'reference-air',
    name: 'Referenzfall Luft',
    description: '300 K · 100 kPa · r = 18 · ρ = 2 · idealisierte Luft',
    values: { T1: 300, p1: 100_000, r: 18, rho_cutoff: 2, kappa: 1.4, Rs: 287 },
  }],
  groups: VARIABLE_GROUPS,
  validateValues: validateDieselCycle,
  getDiagramSpec: getDieselDiagramSpec,
  summaryTitle: 'Diesel-Bilanz',
  processSequence: [
    { transition: '1 → 2', label: 'adiabate Kompression' },
    { transition: '2 → 3', label: 'isobare Wärmezufuhr' },
    { transition: '3 → 4', label: 'adiabate Expansion' },
    { transition: '4 → 1', label: 'isochore Wärmeabfuhr' },
  ],
}

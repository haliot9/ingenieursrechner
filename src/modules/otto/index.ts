import type { CalculatorModule } from '../../core/types'
import { ALL_VARIABLES, PROCESSES, VARIABLE_GROUPS } from './config'
import { getOttoDiagramSpec } from './diagram'
import { OTTO_FORMULAS } from './formulas'
import { validateOttoCycle } from './validation'

export const ottoModule: CalculatorModule = {
  id: 'otto',
  name: 'Otto-Prozess',
  description: 'Berechnung der Zustandsgrößen eines idealisierten Luftstandard-Otto-Kreisprozesses mit isochorer Wärmezufuhr und isochorer Wärmeabfuhr.',
  variables: ALL_VARIABLES,
  formulas: OTTO_FORMULAS,
  processes: PROCESSES,
  presets: [{
    id: 'reference-air',
    name: 'Referenzfall Luft',
    description: '300 K · 100 kPa · r = 10 · T₃ = 1800 K · idealisierte Luft',
    values: { T1: 300, p1: 100_000, r: 10, T3: 1_800, kappa: 1.4, Rs: 287 },
  }],
  groups: VARIABLE_GROUPS,
  validateValues: validateOttoCycle,
  getDiagramSpec: getOttoDiagramSpec,
  summaryTitle: 'Otto-Bilanz',
  processSequence: [
    { transition: '1 → 2', label: 'adiabate Kompression' },
    { transition: '2 → 3', label: 'isochore Wärmezufuhr' },
    { transition: '3 → 4', label: 'adiabate Expansion' },
    { transition: '4 → 1', label: 'isochore Wärmeabfuhr' },
  ],
}

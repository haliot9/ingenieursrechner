import type { CalculatorModule } from '../../core/types'
import { ALL_VARIABLES, PROCESSES, VARIABLE_GROUPS } from './config'
import { JOULE_FORMULAS } from './formulas'
import { validateJouleCycle } from './validation'
import { getJouleDiagramSpec } from './diagram'

export const jouleModule: CalculatorModule = {
  id: 'joule',
  name: 'Joule-/Brayton-Prozess',
  description: 'Berechnung eines statischen idealen Joule-/Brayton-Kreisprozesses mit isentroper Verdichtung und Expansion sowie isobarer Wärmezu- und -abfuhr.',
  variables: ALL_VARIABLES,
  formulas: JOULE_FORMULAS,
  processes: PROCESSES,
  presets: [{ id: 'reference-air', name: 'Referenzfall Luft', description: '300 K · 100 kPa · rₚ = 10 · 1400 K · idealisierte Luft', values: { T1: 300, p1: 100_000, pressureRatio: 10, T3: 1400, kappa: 1.4, Rs: 287 } }],
  groups: VARIABLE_GROUPS,
  validateValues: validateJouleCycle,
  getDiagramSpec: getJouleDiagramSpec,
  summaryTitle: 'Joule-/Brayton-Bilanz',
  processSequence: [
    { transition: '1 → 2', label: 'adiabate Verdichtung' },
    { transition: '2 → 3', label: 'isobare Wärmezufuhr' },
    { transition: '3 → 4', label: 'adiabate Expansion' },
    { transition: '4 → 1', label: 'isobare Wärmeabfuhr' },
  ],
}

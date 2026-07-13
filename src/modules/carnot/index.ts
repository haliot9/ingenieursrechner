import type { CalculatorModule } from '../../core/types'
import { ALL_VARIABLES, VARIABLE_GROUPS, PROCESSES } from './config'
import { CARNOT_FORMULAS } from './formulas'
import { getCarnotDiagramSpec } from './diagram'
import { validateCarnotCycle } from './validation'

export const carnotModule: CalculatorModule = {
  id: 'carnot',
  name: 'Carnot-Prozess',
  description: 'Berechnung thermodynamischer Zustandsgrößen für den idealen Carnot-Kreisprozess mit 4 Zuständen und verschiedenen Prozesstypen.',
  variables: ALL_VARIABLES,
  formulas: CARNOT_FORMULAS,
  processes: PROCESSES,
  presets: [
    {
      id: 'reference-air',
      name: 'Referenzfall Luft',
      description: '250 K / 500 K · 1 MPa / 200 kPa · idealisierte Luft',
      values: {
        T1: 250,
        T3: 500,
        p2: 1_000_000,
        p3: 200_000,
        Rs: 287,
        kappa: 1.4,
      },
    },
  ],
  groups: VARIABLE_GROUPS,
  validateValues: validateCarnotCycle,
  getDiagramSpec: getCarnotDiagramSpec,
}

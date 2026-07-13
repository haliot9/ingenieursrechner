import type { Variable } from '../../core/types'

/**
 * Template: Variablen-Definition für ein neues Modul.
 * Kopiere diesen Ordner und passe die Werte an.
 */

export const VARIABLES: Variable[] = [
  {
    id: 'example_var',
    symbol: 'x',
    latex: 'x',
    name: 'Beispiel-Variable',
    defaultUnit: 'm',
    alternativeUnits: ['cm', 'mm', 'km'],
    constraints: [
      { type: 'positive', message: 'Wert muss positiv sein' },
    ],
    group: 'Gruppe 1',
  },
  // ... weitere Variablen hier
]

export const VARIABLE_GROUPS = ['Gruppe 1']

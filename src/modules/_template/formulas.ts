import type { Formula } from '../../core/types'

/**
 * Template: Formel-Definition für ein neues Modul.
 *
 * WICHTIG: Jede Formel braucht:
 * 1. solveFor für JEDE Variable die berechnet werden kann
 * 2. latexSteps mit umgestellter Formel + Erklärung
 * 3. variables Array mit allen beteiligten Variable-IDs
 */

export const FORMULAS: Formula[] = [
  {
    id: 'example_formula',
    name: 'Beispiel: v = s / t',
    latex: 'v = \\frac{s}{t}',
    variables: ['v', 's', 't'],
    solveFor: {
      'v': 's / t',
      's': 'v * t',
      't': 's / v',
    },
    latexSteps: {
      'v': {
        rearranged: 'v = \\frac{s}{t}',
        explanation: 'Geschwindigkeit = Strecke / Zeit',
      },
      's': {
        rearranged: 's = v \\cdot t',
        explanation: 'Strecke = Geschwindigkeit × Zeit',
      },
      't': {
        rearranged: 't = \\frac{s}{v}',
        explanation: 'Zeit = Strecke / Geschwindigkeit',
      },
    },
    category: 'Kinematik',
  },
]

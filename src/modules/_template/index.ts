import type { CalculatorModule } from '../../core/types'
import { VARIABLES, VARIABLE_GROUPS } from './config'
import { FORMULAS } from './formulas'

/**
 * Template: Modul-Export.
 * Ändere id, name und description für dein Modul.
 */
export const templateModule: CalculatorModule = {
  id: 'template',
  name: 'Template-Modul',
  description: 'Beschreibung des Moduls',
  variables: VARIABLES,
  formulas: FORMULAS,
  groups: VARIABLE_GROUPS,
}

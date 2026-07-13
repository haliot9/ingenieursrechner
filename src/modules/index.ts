import type { CalculatorModule } from '../core/types'
import { carnotModule } from './carnot'

/** Registry of all available calculator modules */
export const MODULES: Record<string, CalculatorModule> = {
  carnot: carnotModule,
}

/** Get module by ID */
export function getModule(id: string): CalculatorModule | undefined {
  return MODULES[id]
}

/** Get all module IDs */
export function getModuleIds(): string[] {
  return Object.keys(MODULES)
}

/** Get all modules as array */
export function getAllModules(): CalculatorModule[] {
  return Object.values(MODULES)
}

import type { CalculatorModule } from '../core/types'
import { carnotModule } from './carnot'
import { dieselModule } from './diesel'
import { ottoModule } from './otto'

/** Registry of all available calculator modules */
export const MODULES: Record<string, CalculatorModule> = {
  carnot: carnotModule,
  diesel: dieselModule,
  otto: ottoModule,
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

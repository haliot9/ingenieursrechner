import type { CalculatorModule } from '../../core/types'
import { getModule } from '../../modules'

export const THERMODYNAMICS_MODULE_IDS = ['carnot', 'otto', 'diesel', 'joule'] as const
export type ThermodynamicsModuleId = typeof THERMODYNAMICS_MODULE_IDS[number]

export interface LandingModule {
  id: ThermodynamicsModuleId
  name: string
  description: string
  processSequence: NonNullable<CalculatorModule['processSequence']>
}

export function getThermodynamicsModules(): LandingModule[] {
  return THERMODYNAMICS_MODULE_IDS.map(id => {
    const module = getModule(id)
    if (!module?.processSequence) throw new Error(`Landing module missing registry metadata: ${id}`)
    return {
      id,
      name: module.name,
      description: module.description,
      processSequence: module.processSequence,
    }
  })
}

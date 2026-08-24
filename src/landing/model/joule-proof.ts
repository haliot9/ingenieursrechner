import type { CalculationStoryRow } from '../../core/calculation-story'
import { buildReferenceScenario } from './reference-scenario'

const PROOF_IDS = [
  'energy:model-reduction',
  'energy:reduced',
  'energy:enthalpy',
  'energy:qin',
  'energy:qin:numeric',
] as const

export function getJouleProofExcerpt(): CalculationStoryRow[] {
  const story = buildReferenceScenario('joule').story
  if (story?.mode !== 'complete') throw new Error('Joule reference story unavailable')

  return PROOF_IDS.map(id => {
    const row = story.story.rows.find(candidate => candidate.id === id)
    if (!row) throw new Error(`Joule proof row missing: ${id}`)
    return row
  })
}

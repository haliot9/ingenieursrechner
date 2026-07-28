import { describe, expect, it } from 'vitest'
import { compileSolveDirections } from '../../../src/core/solve-directions'
import { JOULE_DIRECTION_POLICIES, ALL_VARIABLES } from '../../../src/modules/joule/config'
import { JOULE_FORMULAS } from '../../../src/modules/joule/formulas'
import { JOULE_STORY_FAMILIES, JOULE_STORY_RECIPES } from '../../../src/modules/joule/calculation-story-recipes'

describe('full Joule calculation-story authority', () => {
  it('reconciles the finite presentation authority with exactly 44 derive and four validate-only directions', () => {
    const directions = compileSolveDirections(JOULE_FORMULAS, ALL_VARIABLES.map(variable => variable.id), JOULE_DIRECTION_POLICIES)
    const derive = directions.filter(direction => direction.mode === 'derive').map(direction => direction.id).sort()
    expect(directions).toHaveLength(48); expect(derive).toHaveLength(44)
    expect(directions.filter(direction => direction.mode === 'validate-only').map(direction => direction.id).sort()).toEqual(['ideal_gas_1:Rs', 'ideal_gas_2:Rs', 'ideal_gas_3:Rs', 'ideal_gas_4:Rs'])
    expect(JOULE_STORY_FAMILIES).toHaveLength(12); expect(Object.keys(JOULE_STORY_RECIPES).sort()).toEqual(derive)
  })
})

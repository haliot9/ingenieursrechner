import type { StoryOperationKind } from '../../core/calculation-story'

export type JouleStoryFamilyId =
  | 'material-properties' | 'ideal-gas-state' | 'relative-entropy' | 'pressure-ratio'
  | 'isobaric-pressure' | 'isentropic-temperature' | 'isentropic-entropy' | 'component-work'
  | 'net-work' | 'isobaric-heat' | 'ideal-efficiency' | 'performance-ratios'

export interface JouleStoryFamilyAuthority {
  id: JouleStoryFamilyId
  directionIds: readonly string[]
  entryPointLatex: string
  conditions: readonly string[]
  sectionId: string
  transitions: readonly StoryOperationKind[]
}

/**
 * Finite module authority. This list deliberately does not inspect JOULE_FORMULAS:
 * live inventory is reconciled by tests, never used to grant a new explanation.
 */
export const JOULE_STORY_FAMILIES: readonly JouleStoryFamilyAuthority[] = [
  { id: 'material-properties', directionIds: ['cv_from_Rs_kappa:cv', 'cp_from_kappa_cv:cp'], entryPointLatex: '\\kappa = \\frac{c_p}{c_v}', conditions: ['constant material properties', '\\kappa > 1'], sectionId: 'material-properties', transitions: ['substitute', 'factor', 'divide', 'reuse'] },
  { id: 'ideal-gas-state', directionIds: ['ideal_gas_1:p1', 'ideal_gas_1:v1', 'ideal_gas_1:T1', 'ideal_gas_2:p2', 'ideal_gas_2:v2', 'ideal_gas_2:T2', 'ideal_gas_3:p3', 'ideal_gas_3:v3', 'ideal_gas_3:T3', 'ideal_gas_4:p4', 'ideal_gas_4:v4', 'ideal_gas_4:T4'], entryPointLatex: 'p_i v_i = R_s T_i', conditions: ['ideal gas', 'p_i > 0'], sectionId: 'reusable-thermodynamic-relations', transitions: ['divide', 'multiply'] },
  { id: 'relative-entropy', directionIds: ['entropy_abs_1:s1', 'entropy_abs_2:s2', 'entropy_abs_3:s3', 'entropy_abs_4:s4'], entryPointLatex: 'ds = c_p \\frac{dT}{T} - R_s \\frac{dp}{p}', conditions: ['constant properties', 'T_{ref}=273.15\\,\\mathrm K', 'p_{ref}=101325\\,\\mathrm{Pa}'], sectionId: 'reusable-thermodynamic-relations', transitions: ['integrate', 'reuse'] },
  { id: 'pressure-ratio', directionIds: ['pressure_ratio:p2', 'pressure_ratio:p1', 'pressure_ratio:pressureRatio'], entryPointLatex: 'r_p = \\frac{p_2}{p_1}', conditions: ['p_1 > 0', 'r_p > 1'], sectionId: 'compression-1-2', transitions: ['multiply', 'divide'] },
  { id: 'isobaric-pressure', directionIds: ['high_pressure_isobar:p3', 'high_pressure_isobar:p2', 'low_pressure_isobar:p4', 'low_pressure_isobar:p1'], entryPointLatex: 'p_3 = p_2', conditions: ['isobaric process'], sectionId: 'heat-input-2-3', transitions: ['equate', 'reuse'] },
  { id: 'isentropic-temperature', directionIds: ['compressor_temperature:T2', 'turbine_temperature:T4'], entryPointLatex: '\\frac{T_j}{T_i} = \\left(\\frac{p_j}{p_i}\\right)^{\\frac{\\kappa-1}{\\kappa}}', conditions: ['internally reversible adiabatic process', '\\kappa > 1'], sectionId: 'compression-1-2', transitions: ['substitute', 'multiply', 'divide'] },
  { id: 'isentropic-entropy', directionIds: ['isentropic_entropy_12:s2', 'isentropic_entropy_12:s1', 'isentropic_entropy_34:s4', 'isentropic_entropy_34:s3'], entryPointLatex: 'ds = 0', conditions: ['internally reversible adiabatic process'], sectionId: 'compression-1-2', transitions: ['integrate', 'equate'] },
  { id: 'component-work', directionIds: ['compressor_work:w_comp', 'turbine_work:w_turb'], entryPointLatex: 'w_{comp} = h_2-h_1', conditions: ['steady adiabatic component', 'negligible kinetic/potential changes', 'constant c_p'], sectionId: 'compression-1-2', transitions: ['substitute', 'reuse'] },
  { id: 'net-work', directionIds: ['net_work:w_netto'], entryPointLatex: 'w_{netto} = w_{comp}+w_{turb}', conditions: ['repository sign convention'], sectionId: 'cycle-balance-performance', transitions: ['reuse'] },
  { id: 'isobaric-heat', directionIds: ['heat_input:q_in', 'heat_input:T3', 'heat_input:T2', 'heat_rejection:q_out', 'heat_rejection:T1', 'heat_rejection:T4'], entryPointLatex: 'q_{in} = h_3-h_2', conditions: ['isobaric component', 'constant c_p'], sectionId: 'heat-input-2-3', transitions: ['integrate', 'substitute', 'divide', 'add', 'subtract'] },
  { id: 'ideal-efficiency', directionIds: ['ideal_efficiency:eta', 'ideal_efficiency:pressureRatio'], entryPointLatex: '\\eta_{ideal} = 1-r_p^{-a}', conditions: ['bounded ideal Joule model', 'a=(\\kappa-1)/\\kappa'], sectionId: 'cycle-balance-performance', transitions: ['exponentiate', 'reuse'] },
  { id: 'performance-ratios', directionIds: ['efficiency:eta', 'back_work_ratio:back_work_ratio'], entryPointLatex: '\\eta = \\frac{-w_{netto}}{q_{in}}', conditions: ['repository sign convention'], sectionId: 'cycle-balance-performance', transitions: ['substitute', 'reuse'] },
]

export interface JouleStoryRecipe {
  directionId: string
  familyId: JouleStoryFamilyId
  entryPointLatex: string
  conditions: readonly string[]
  sectionId: string
  transitions: readonly StoryOperationKind[]
}

export const JOULE_STORY_RECIPES: Readonly<Record<string, JouleStoryRecipe>> = Object.freeze(
  Object.fromEntries(JOULE_STORY_FAMILIES.flatMap(family => family.directionIds.map(directionId => [directionId, {
    directionId, familyId: family.id, entryPointLatex: family.entryPointLatex, conditions: family.conditions,
    sectionId: family.sectionId, transitions: family.transitions,
  }]))) as Record<string, JouleStoryRecipe>,
)

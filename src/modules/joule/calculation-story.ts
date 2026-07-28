import { numberToLatex } from '../../utils/latex'
import type { CalculationStoryCompositionInput, CalculationStoryConsumedStep, CalculationStoryRow, CalculationStoryState, StoryOperationKind } from '../../core/calculation-story'
import { JOULE_STORY_RECIPES, type JouleStoryRecipe } from './calculation-story-recipes'

const SECTION_ORDER = [
  ['material-properties', 'Stoffeigenschaften'],
  ['reusable-thermodynamic-relations', 'Wiederverwendbare thermodynamische Beziehungen'],
  ['state-1', 'Zustand 1'],
  ['compression-1-2', '1 → 2 Isentrope Verdichtung'],
  ['heat-input-2-3', '2 → 3 Isobare Wärmezufuhr'],
  ['expansion-3-4', '3 → 4 Isentrope Expansion'],
  ['heat-rejection-4-1', '4 → 1 Isobare Wärmeabfuhr'],
  ['cycle-balance-performance', 'Kreisprozessbilanz und Kennzahlen'],
] as const

type SectionId = typeof SECTION_ORDER[number][0]

function latexFor(input: CalculationStoryCompositionInput, id: string): string {
  return input.variables.find(variable => variable.id === id)?.latex ?? id
}

function numeric(input: CalculationStoryCompositionInput, id: string): string {
  const state = input.values[id]
  const variable = input.variables.find(candidate => candidate.id === id)
  if (!state || state.value === null || !Number.isFinite(state.value)) throw new Error(`missing accepted ${id} value`)
  return numberToLatex(state.value, variable?.defaultUnit)
}

function equation(latex: string, continuation = false) {
  const [lhs, ...right] = latex.split('=')
  return { lhsLatex: continuation ? undefined : lhs.trim(), relationLatex: '=', rhsLatex: right.join('=').trim() || latex.trim() }
}

function operation(kind: StoryOperationKind, prose: string, math = '') {
  return { kind, latex: `\\xrightarrow{\\text{${prose}}${math}}` }
}

function row(id: string, kind: CalculationStoryRow['kind'], rowRole: NonNullable<CalculationStoryRow['rowRole']>, equationLatex: string, options: Partial<CalculationStoryRow> = {}): CalculationStoryRow {
  return { id, kind, rowRole, chainId: id.split(':')[0], equationLatex, equation: equation(equationLatex, rowRole === 'continuation' || rowRole === 'numeric'), ...options }
}

function numericRow(input: CalculationStoryCompositionInput, directionId: string): CalculationStoryRow {
  const target = stepFor(input, directionId).targetVariable
  return row(`${directionId}:numeric`, 'numeric', 'numeric', `= ${numeric(input, target)}`, { equation: { relationLatex: '=', rhsLatex: numeric(input, target) }, note: 'Übernommener Solverwert.' })
}

function consumed(directionId: string): CalculationStoryConsumedStep {
  const [formulaId, targetVariable] = directionId.split(':')
  return { formulaId, targetVariable, directionId }
}

function stepFor(input: CalculationStoryCompositionInput, directionId: string) {
  const step = input.steps.find(candidate => `${candidate.formulaId}:${candidate.targetVariable}` === directionId)
  if (!step) throw new Error(`missing recipe evidence for ${directionId}`)
  return step
}

function targetRow(input: CalculationStoryCompositionInput, directionId: string, operationValue: ReturnType<typeof operation> | undefined, note: string, latex?: string): CalculationStoryRow[] {
  const step = stepFor(input, directionId)
  const resolved = latex ?? step.rearrangedLatex
  return [
    row(`${directionId}:result`, 'result', 'subject-change', resolved, { equation: { ...equation(resolved), bridgeLatex: '\\Longleftrightarrow' }, operation: operationValue, state: 'reachable', note }),
    numericRow(input, directionId),
  ]
}

function sectionFor(directionId: string, recipe: JouleStoryRecipe): SectionId {
  if (directionId.startsWith('ideal_gas_1') || directionId === 'entropy_abs_1:s1') return 'state-1'
  if (directionId.startsWith('ideal_gas_2') || directionId.startsWith('isentropic_entropy_12') || directionId.startsWith('compressor_') || directionId === 'pressure_ratio:p2' || directionId === 'pressure_ratio:p1' || directionId === 'pressure_ratio:pressureRatio') return 'compression-1-2'
  if (directionId.startsWith('ideal_gas_3') || directionId === 'entropy_abs_3:s3' || directionId.startsWith('high_pressure_isobar') || directionId.startsWith('heat_input')) return 'heat-input-2-3'
  if (directionId.startsWith('isentropic_entropy_34') || directionId.startsWith('turbine_') || directionId === 'entropy_abs_4:s4' || directionId.startsWith('low_pressure_isobar')) return 'expansion-3-4'
  if (directionId.startsWith('ideal_gas_4') || directionId.startsWith('heat_rejection')) return 'heat-rejection-4-1'
  return recipe.sectionId as SectionId
}

function materialRows(input: CalculationStoryCompositionInput, selected: Set<string>): CalculationStoryRow[] {
  if (!selected.has('cv_from_Rs_kappa:cv') && !selected.has('cp_from_kappa_cv:cp')) return []
  const cp = latexFor(input, 'cp'); const cv = latexFor(input, 'cv'); const rs = latexFor(input, 'Rs'); const kappa = latexFor(input, 'kappa')
  const rows: CalculationStoryRow[] = []
  if (selected.has('cv_from_Rs_kappa:cv')) rows.push(
    row('material:kappa', 'governing', 'start', `${kappa} = \\frac{${cp}}{${cv}}`, { note: 'Zugelassene Stoffbeziehung.' }),
    row('material:cp', 'result', 'subject-change', `${cp} = ${kappa} ${cv}`, { equation: { bridgeLatex: '\\Longleftrightarrow', lhsLatex: cp, relationLatex: '=', rhsLatex: `${kappa} ${cv}` }, note: 'Wiederverwendbare äquivalente Beziehung.' }),
    row('material:rs', 'governing', 'start', `${rs} = ${cp} - ${cv}`, { note: 'Zweite zugelassene Stoffbeziehung.' }),
    row('material:substitute-cp', 'transform', 'continuation', `${rs} = ${kappa} ${cv} - ${cv}`, { operation: operation('substitute', 'ersetze ', cp) }),
    row('material:factor', 'transform', 'continuation', `${rs} = ${cv}(${kappa} - 1)`, { operation: operation('factor', 'klammere ', cv) }),
    row('material:cv-resolved', 'result', 'subject-change', `${cv} = \\frac{${rs}}{${kappa}-1}`, { equation: { bridgeLatex: '\\Longleftrightarrow', lhsLatex: cv, relationLatex: '=', rhsLatex: `\\frac{${rs}}{${kappa}-1}` }, operation: operation('divide', 'teile durch ', `${kappa}-1`), state: 'reachable' }),
    row('material:cv-numeric', 'numeric', 'numeric', `= ${numeric(input, 'cv')}`, { equation: { relationLatex: '=', rhsLatex: numeric(input, 'cv') }, note: 'Übernommener Solverwert.' }),
  )
  if (selected.has('cp_from_kappa_cv:cp')) {
    if (selected.has('cv_from_Rs_kappa:cv')) rows.push(row('material:cp-reuse', 'reuse', 'reuse', `${cp} = ${kappa} ${cv}`, { operation: operation('reuse', 'verwende ', cv), note: 'Bereits hergeleitete Stoffbeziehung.' }))
    else rows.push(
      row('material:cp-governing', 'governing', 'start', `${kappa} = \\frac{${cp}}{${cv}}`, { note: 'Zugelassene Stoffbeziehung.' }),
      row('material:cp-resolved', 'result', 'subject-change', `${cp} = ${kappa} ${cv}`, { equation: { bridgeLatex: '\\Longleftrightarrow', lhsLatex: cp, relationLatex: '=', rhsLatex: `${kappa} ${cv}` }, operation: operation('multiply', 'multipliziere mit ', cv), note: 'Aus der Stoffbeziehung aufgelöst.' }),
    )
    rows.push(numericRow(input, 'cp_from_kappa_cv:cp'))
  }
  return rows
}

function familyRows(input: CalculationStoryCompositionInput, directionId: string, shared: Set<string>): CalculationStoryRow[] {
  const recipe = JOULE_STORY_RECIPES[directionId]
  if (!recipe) throw new Error(`missing explicit family authority for ${directionId}`)
  const target = directionId.split(':')[1]
  const state = directionId.match(/_(\d):/)?.[1]
  switch (recipe.familyId) {
    case 'ideal-gas-state': {
      if (!shared.has('ideal-gas')) shared.add('ideal-gas')
      const p = `p_${state}`; const v = `v_${state}`; const t = `T_${state}`
      const result = target === `p${state}` ? `${p} = \\frac{R_s ${t}}{${v}}` : target === `v${state}` ? `${v} = \\frac{R_s ${t}}{${p}}` : `${t} = \\frac{${p}${v}}{R_s}`
      const op = target === `p${state}` ? operation('divide', 'teile durch ', v) : target === `v${state}` ? operation('divide', 'teile durch ', p) : operation('divide', 'teile durch ', 'R_s')
      return [row(`${directionId}:reuse`, 'reuse', 'reuse', `${p}${v} = R_s${t}`, { operation: operation('reuse', 'verwende Zustand ', state!), note: 'Wiederverwendung der idealen Gasgleichung.' }), ...targetRow(input, directionId, op, 'Zielspezifische Umstellung der idealen Gasgleichung.', result)]
    }
    case 'relative-entropy': {
      const s = `s_${state}`; const t = `T_${state}`; const p = `p_${state}`
      return [row(`${directionId}:entropy`, 'reuse', 'reuse', `${s} = c_p \\ln\\left(\\frac{${t}}{273.15}\\right)-R_s\\ln\\left(\\frac{${p}}{101325}\\right)`, { operation: operation('reuse', 'verwende Entropiebezug für Zustand ', state!), note: 'Projektbezogener Entropiebezug.' }), numericRow(input, directionId)]
    }
    case 'pressure-ratio': {
      const result = target === 'p2' ? 'p_2 = p_1 r_p' : target === 'p1' ? 'p_1 = \\frac{p_2}{r_p}' : 'r_p = \\frac{p_2}{p_1}'
      const op = target === 'p2' ? operation('multiply', 'multipliziere mit ', 'p_1') : target === 'p1' ? operation('divide', 'teile durch ', 'r_p') : undefined
      return [row(`${directionId}:definition`, 'governing', 'start', 'r_p = \\frac{p_2}{p_1}', { note: 'Definition des Druckverhältnisses.' }), ...targetRow(input, directionId, op, 'Zielspezifische Druckverhältnis-Beziehung.', result)]
    }
    case 'isobaric-pressure': {
      const high = directionId.startsWith('high_'); const left = high ? 'p_3' : 'p_4'; const right = high ? 'p_2' : 'p_1'
      const result = target === left.replace('_', '') ? `${left} = ${right}` : `${right} = ${left}`
      return [row(`${directionId}:condition`, 'governing', 'start', `${left} = ${right}`, { note: high ? 'Isobare Wärmezufuhr.' : 'Isobare Wärmeabfuhr.' }), ...(target === left.replace('_', '') ? [numericRow(input, directionId)] : targetRow(input, directionId, operation('equate', 'nutze isobare Gleichheit'), 'Prozessbedingung in der gewählten Richtung.', result))]
    }
    case 'isentropic-temperature': {
      const compression = directionId.startsWith('compressor_')
      const governing = compression ? '\\frac{T_2}{T_1} = \\left(\\frac{p_2}{p_1}\\right)^a' : '\\frac{T_4}{T_3} = \\left(\\frac{p_4}{p_3}\\right)^a'
      const substituted = compression ? '= r_p^a' : '= \\left(\\frac{1}{r_p}\\right)^a'
      const result = compression ? 'T_2 = T_1 r_p^a' : 'T_4 = \\frac{T_3}{r_p^a}'
      return [row(`${directionId}:governing`, 'governing', 'start', governing, { note: 'Isentrope Temperaturbeziehung für das ideale Gas.' }), row(`${directionId}:ratio`, 'transform', 'continuation', substituted, { equation: { relationLatex: '=', rhsLatex: substituted.slice(1) }, operation: operation('substitute', 'ersetze ', compression ? 'p_2/p_1=r_p' : 'p_4/p_3=1/r_p') }), ...targetRow(input, directionId, operation('multiply', 'multipliziere mit ', compression ? 'T_1' : 'T_3'), 'Gewählte isentrope Temperaturbeziehung.', result)]
    }
    case 'isentropic-entropy': {
      const pair = directionId.includes('_12') ? ['s_2', 's_1'] : ['s_4', 's_3']; const result = target === pair[0].replace('_', '') ? `${pair[0]} = ${pair[1]}` : `${pair[1]} = ${pair[0]}`
      return [row(`${directionId}:ds`, 'governing', 'start', 'ds = 0', { note: 'Intern reversibler adiabater Prozess.' }), row(`${directionId}:integral`, 'transform', 'continuation', `${pair[0]}-${pair[1]} = 0`, { operation: operation('integrate', 'integriere Eintritt zu Austritt') }), ...targetRow(input, directionId, operation('equate', 'nutze isentrope Gleichheit'), 'Gewählte isentrope Entropiebeziehung.', result)]
    }
    case 'component-work': {
      const comp = directionId.startsWith('compressor_'); const work = comp ? 'w_{comp}' : 'w_{turb}'; const h = comp ? 'h_2 - h_1' : 'h_4 - h_3'; const temp = comp ? 'c_p(T_2-T_1)' : 'c_p(T_4-T_3)'
      return [row(`${directionId}:enthalpy`, 'governing', 'start', `${work} = ${h}`, { note: 'Adiabate stationäre Komponente; projektweite Vorzeichenkonvention.' }), row(`${directionId}:cp`, 'transform', 'continuation', `= ${temp}`, { equation: { relationLatex: '=', rhsLatex: temp }, operation: operation('substitute', 'nutze ', 'dh=c_p\\,dT') }), numericRow(input, directionId)]
    }
    case 'net-work': return [row(`${directionId}:governing`, 'governing', 'start', 'w_{netto} = w_{comp}+w_{turb}', { note: 'Vorzeichenbehaftete Kreisarbeitssumme.' }), numericRow(input, directionId), row(`${directionId}:check`, 'reuse', 'check', 'w_{netto}+(q_{in}+q_{out}) \\approx 0', { operation: operation('reuse', 'Kreisprozessprüfung'), note: 'Unterstützende Energiebilanzprüfung.' })]
    case 'isobaric-heat': {
      const inputHeat = directionId.startsWith('heat_input'); const q = inputHeat ? 'q_{in}' : 'q_{out}'; const h = inputHeat ? 'h_3 - h_2' : 'h_1 - h_4'; const integral = inputHeat ? '\\int_{T_2}^{T_3}c_p\\,dT' : '\\int_{T_4}^{T_1}c_p\\,dT'; const compact = inputHeat ? 'c_p(T_3-T_2)' : 'c_p(T_1-T_4)'
      const rows = [
        row(`${directionId}:enthalpy`, 'governing', 'start', `${q} = ${h}`, { note: 'Isobare Wärmebeziehung im deklarierten Modell.' }),
        row(`${directionId}:integral`, 'transform', 'continuation', `= ${integral}`, { equation: { relationLatex: '=', rhsLatex: integral }, operation: operation('integrate', 'integriere ', inputHeat ? 'T_2\\to T_3' : 'T_4\\to T_1') }),
        row(`${directionId}:constant-cp`, 'transform', 'continuation', `= ${compact}`, { equation: { relationLatex: '=', rhsLatex: compact }, operation: operation('substitute', 'konstantes ', 'c_p') }),
      ]
      if (target === (inputHeat ? 'q_in' : 'q_out')) return [...rows, numericRow(input, directionId)]
      const quotient = `\\frac{${q}}{c_p}`
      const difference = inputHeat ? 'T_3-T_2' : 'T_1-T_4'
      const result = inputHeat
        ? target === 'T3' ? `T_3 = T_2 + ${quotient}` : `T_2 = T_3 - ${quotient}`
        : target === 'T1' ? `T_1 = T_4 + ${quotient}` : `T_4 = T_1 - ${quotient}`
      const operationValue = target === 'T3' || target === 'T1'
        ? operation('add', 'addiere ', inputHeat ? 'T_2' : 'T_4')
        : operation('subtract', 'subtrahiere ', quotient)
      return [
        ...rows,
        row(`${directionId}:divide-cp`, 'transform', 'continuation', `${quotient} = ${difference}`, { equation: { lhsLatex: quotient, relationLatex: '=', rhsLatex: difference }, operation: operation('divide', 'teile durch ', 'c_p') }),
        row(`${directionId}:result`, 'result', 'subject-change', result, { equation: { ...equation(result), bridgeLatex: '\\Longleftrightarrow' }, operation: operationValue, state: 'reachable', note: 'Explizit auf die Zieltemperatur umgestellt.' }),
        numericRow(input, directionId),
      ]
    }
    case 'ideal-efficiency': {
      if (target === 'eta') return [row(`${directionId}:governing`, 'governing', 'start', '\\eta_{ideal} = 1-r_p^{-a}', { note: 'Begrenztes ideales Joule-Modell.' }), numericRow(input, directionId)]
      return [row(`${directionId}:governing`, 'governing', 'start', '\\eta_{ideal} = 1-r_p^{-a}', { note: 'Begrenztes ideales Joule-Modell.' }), row(`${directionId}:subtract`, 'transform', 'subject-change', '1-\\eta_{ideal} = r_p^{-a}', { operation: operation('isolate', 'subtrahiere von ', '1') }), row(`${directionId}:power`, 'transform', 'subject-change', 'r_p = (1-\\eta_{ideal})^{-1/a}', { equation: { bridgeLatex: '\\Longleftrightarrow', lhsLatex: 'r_p', relationLatex: '=', rhsLatex: '(1-\\eta_{ideal})^{-1/a}' }, operation: operation('exponentiate', 'potenziere mit ', '-1/a') }), ...targetRow(input, directionId, undefined, 'Gewählte inverse ideale Wirkungsgradbeziehung.', 'r_p = (1-\\eta_{ideal})^{-\\frac{\\kappa}{\\kappa-1}}')]
    }
    case 'performance-ratios': {
      const eta = directionId.startsWith('efficiency'); const lhs = eta ? '\\eta' : 'BWR'; const rhs = eta ? '\\frac{-w_{netto}}{q_{in}}' : '\\frac{w_{comp}}{-w_{turb}}'
      return [row(`${directionId}:definition`, 'governing', 'start', `${lhs} = ${rhs}`, { note: 'Explizite projektweite Vorzeichenkonvention.' }), numericRow(input, directionId)]
    }
  }
  throw new Error(`unhandled explicit family authority: ${recipe.familyId}`)
}

export function composeJouleCalculationStory(input: CalculationStoryCompositionInput): CalculationStoryState {
  if (!input.plan) return { mode: 'not-applicable' }
  const selected = [...input.plan.primaryByTarget.values()].map(direction => direction.directionId)
  if (selected.length === 0) return { mode: 'not-applicable' }
  const unsupported = selected.filter(directionId => !JOULE_STORY_RECIPES[directionId])
  if (unsupported.length) return { mode: 'unavailable', reason: `No approved calculation-story family exists for: ${unsupported.join(', ')}.` }
  if (selected.some(directionId => !input.steps.some(step => `${step.formulaId}:${step.targetVariable}` === directionId))) return { mode: 'unavailable', reason: 'Confirmed solver provenance is missing for at least one selected direction.' }
  try {
    const buckets = new Map<SectionId, CalculationStoryRow[]>(SECTION_ORDER.map(([id]) => [id, []]))
    const append = (id: SectionId, rows: CalculationStoryRow[]) => buckets.get(id)?.push(...rows)
    const selectedSet = new Set(selected)
    append('material-properties', materialRows(input, selectedSet))
    const hasIdeal = selected.some(id => JOULE_STORY_RECIPES[id].familyId === 'ideal-gas-state')
    const hasEntropy = selected.some(id => JOULE_STORY_RECIPES[id].familyId === 'relative-entropy')
    if (hasIdeal) append('reusable-thermodynamic-relations', [row('shared:ideal-gas', 'governing', 'start', 'p_i v_i = R_s T_i', { note: 'Zugelassene ideale Gasgleichung.' })])
    if (hasEntropy) append('reusable-thermodynamic-relations', [row('shared:entropy-differential', 'governing', 'start', 'ds = c_p \\frac{dT}{T} - R_s \\frac{dp}{p}', { note: 'Relativer Entropieansatz bei konstanten Stoffwerten.' }), row('shared:entropy-integral', 'transform', 'continuation', 's_i-s_{ref}=c_p\\ln\\left(\\frac{T_i}{T_{ref}}\\right)-R_s\\ln\\left(\\frac{p_i}{p_{ref}}\\right)', { operation: operation('integrate', 'integriere ', 'ref\\to i') }), row('shared:entropy-datum', 'result', 'subject-change', 's_i=c_p\\ln\\left(\\frac{T_i}{273.15}\\right)-R_s\\ln\\left(\\frac{p_i}{101325}\\right)', { equation: { bridgeLatex: '\\Longleftrightarrow', lhsLatex: 's_i', relationLatex: '=', rhsLatex: 'c_p\\ln\\left(\\frac{T_i}{273.15}\\right)-R_s\\ln\\left(\\frac{p_i}{101325}\\right)' }, note: 'Projektbezogener Entropiebezug.' })])
    const shared = new Set<string>()
    for (const directionId of selected) {
      if (directionId === 'cv_from_Rs_kappa:cv' || directionId === 'cp_from_kappa_cv:cp') continue
      append(sectionFor(directionId, JOULE_STORY_RECIPES[directionId]), familyRows(input, directionId, shared))
    }
    const sections = SECTION_ORDER.map(([id, title]) => ({ id, title, rows: buckets.get(id) ?? [] }))
    return { mode: 'complete', story: { route: 'joule-selected-direction-composer', title: 'Joule-/Brayton-Rechengeschichte', rows: sections.flatMap(section => section.rows), sections, consumedSteps: selected.map(consumed), unconsumedPrimarySteps: [] } }
  } catch {
    return { mode: 'unavailable', reason: 'The selected Joule route could not be composed as an evidenced calculation story; accepted solver values remain unchanged.' }
  }
}

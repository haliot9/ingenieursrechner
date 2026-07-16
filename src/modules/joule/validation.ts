import type { SolverError, VariableState } from '../../core/types'

function get(values: Record<string, VariableState>, id: string): number | null { return values[id]?.value ?? null }
function closeEnough(actual: number, expected: number, tolerance = 1e-4): boolean { return Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(actual), Math.abs(expected)) }

export function validateJouleCycle(values: Record<string, VariableState>): SolverError[] {
  const errors: SolverError[] = []
  const contradiction = (variableId: string, message: string) => errors.push({ type: 'contradiction', variableId, message })
  const ratio = get(values, 'pressureRatio')
  if (ratio !== null && ratio <= 1) contradiction('pressureRatio', 'Für den Joule-Kreisprozess muss das Druckverhältnis r_p strikt größer als 1 sein.')
  const p1 = get(values, 'p1'), p2 = get(values, 'p2'), p3 = get(values, 'p3'), p4 = get(values, 'p4')
  if (p1 !== null && p4 !== null && !closeEnough(p1, p4)) contradiction('p4', 'Widersprüchliche isobare Wärmeabfuhr: p4 muss p1 entsprechen.')
  if (p2 !== null && p3 !== null && !closeEnough(p2, p3)) contradiction('p3', 'Widersprüchliche isobare Wärmezufuhr: p3 muss p2 entsprechen.')
  const s1 = get(values, 's1'), s2 = get(values, 's2'), s3 = get(values, 's3'), s4 = get(values, 's4')
  if (s1 !== null && s2 !== null && !closeEnough(s1, s2)) contradiction('s2', 'Widersprüchliche Isentrope 1→2: s1 muss s2 entsprechen.')
  if (s3 !== null && s4 !== null && !closeEnough(s3, s4)) contradiction('s4', 'Widersprüchliche Isentrope 3→4: s3 muss s4 entsprechen.')
  const T1 = get(values, 'T1'), T2 = get(values, 'T2'), T3 = get(values, 'T3'), T4 = get(values, 'T4')
  if (T1 !== null && T2 !== null && T2 <= T1) contradiction('T2', 'Für die Verdichtung muss T2 größer als T1 sein.')
  if (T2 !== null && T3 !== null && T3 <= T2) contradiction('T3', 'Für die Wärmezufuhr muss T3 größer als T2 sein.')
  if (T3 !== null && T4 !== null && T4 >= T3) contradiction('T4', 'Für die Expansion muss T4 kleiner als T3 sein.')
  if (T1 !== null && T4 !== null && T4 <= T1) contradiction('T4', 'Für den Wärmekraftprozess muss T4 größer als T1 sein.')
  const qIn = get(values, 'q_in'), qOut = get(values, 'q_out'), wComp = get(values, 'w_comp'), wTurb = get(values, 'w_turb'), wNetto = get(values, 'w_netto'), eta = get(values, 'eta'), bwr = get(values, 'back_work_ratio')
  if (wComp !== null && wComp <= 0) contradiction('w_comp', 'w_comp muss für den Verdichter positiv sein.')
  if (wTurb !== null && wTurb >= 0) contradiction('w_turb', 'w_turb muss für die Turbine negativ sein.')
  if (qIn !== null && qIn <= 0) contradiction('q_in', 'q_in muss positiv sein.')
  if (qOut !== null && qOut >= 0) contradiction('q_out', 'q_out muss negativ sein.')
  if (wComp !== null && wTurb !== null && wNetto !== null && !closeEnough(wNetto, wComp + wTurb)) contradiction('w_netto', 'Widersprüchliche Komponentenbilanz: w_netto muss w_comp + w_turb entsprechen.')
  if (qIn !== null && qOut !== null && wNetto !== null && !closeEnough(wNetto, -(qIn + qOut))) contradiction('w_netto', 'Widersprüchliche Energiebilanz: w_netto muss -(q_in + q_out) entsprechen.')
  if (eta !== null && wNetto !== null && qIn !== null && !closeEnough(eta, -wNetto / qIn)) contradiction('eta', 'Widersprüchlicher Wirkungsgrad aus der Energiebilanz.')
  if (bwr !== null && wComp !== null && wTurb !== null && !closeEnough(bwr, wComp / -wTurb)) contradiction('back_work_ratio', 'Widersprüchliche Back-Work-Ratio.')
  return errors
}
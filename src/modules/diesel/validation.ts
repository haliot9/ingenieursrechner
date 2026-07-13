import type { SolverError, VariableState } from '../../core/types'

function get(values: Record<string, VariableState>, id: string): number | null { return values[id]?.value ?? null }
function closeEnough(actual: number, expected: number, tolerance = 1e-4): boolean {
  return Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(actual), Math.abs(expected))
}

export function validateDieselCycle(values: Record<string, VariableState>): SolverError[] {
  const errors: SolverError[] = []
  const contradiction = (variableId: string, message: string) => errors.push({ type: 'contradiction', variableId, message })
  const r = get(values, 'r')
  const rho = get(values, 'rho_cutoff')
  if (r !== null && rho !== null && rho >= r) contradiction('rho_cutoff', 'Für den Diesel-Kreisprozess muss das Cut-off-Verhältnis ρ strikt kleiner als r sein.')

  const p2 = get(values, 'p2'), p3 = get(values, 'p3')
  if (p2 !== null && p3 !== null && !closeEnough(p2, p3)) contradiction('p3', 'Widersprüchliche isobare Wärmezufuhr: p2 muss p3 entsprechen.')
  const v1 = get(values, 'v1'), v4 = get(values, 'v4')
  if (v1 !== null && v4 !== null && !closeEnough(v1, v4)) contradiction('v4', 'Widersprüchliche isochore Wärmeabfuhr: v4 muss v1 entsprechen.')
  const s1 = get(values, 's1'), s2 = get(values, 's2'), s3 = get(values, 's3'), s4 = get(values, 's4')
  if (s1 !== null && s2 !== null && !closeEnough(s1, s2)) contradiction('s2', 'Widersprüchliche Isentrope 1→2: s1 muss s2 entsprechen.')
  if (s3 !== null && s4 !== null && !closeEnough(s3, s4)) contradiction('s4', 'Widersprüchliche Isentrope 3→4: s3 muss s4 entsprechen.')
  const qIn = get(values, 'q_in'), qOut = get(values, 'q_out'), wNetto = get(values, 'w_netto')
  if (qIn !== null && qOut !== null && wNetto !== null && !closeEnough(wNetto, -(qIn + qOut))) contradiction('w_netto', 'Widersprüchliche Energiebilanz: w_netto muss -(q_in + q_out) entsprechen.')
  return errors
}
